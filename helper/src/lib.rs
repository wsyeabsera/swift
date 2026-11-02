//! Local helper for Swift Canvas: an authenticated WebSocket on 127.0.0.1.
//! Security rules (task #1719): bind loopback only; accept a connection only when its Origin is on the exact allow-list AND the token matches;
//! the allow-list is empty by default, so nothing connects until an extension id (or dev origin) is configured.
use std::{io, net::TcpListener, process::Command, thread};
use tungstenite::{accept_hdr, handshake::server::{ErrorResponse, Request, Response}, http, Message};

pub const DEFAULT_PORT: u16 = 7431;
pub const DEV_ORIGIN: &str = "http://localhost:5173";

#[derive(Clone, Debug)]
pub struct Config { pub port: u16, pub token: String, pub allowed: Vec<String> }

/// Build the config from environment-like lookups (so it is testable without touching the process environment).
pub fn config_from(get: impl Fn(&str) -> Option<String>, random_token: impl Fn() -> String) -> Config {
    let dev = get("SWIFT_DEV").as_deref() == Some("1");
    let mut allowed: Vec<String> = get("SWIFT_ALLOWED_ORIGINS").unwrap_or_default().split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    if dev { allowed.push(DEV_ORIGIN.to_string()); }
    let token = get("SWIFT_HELPER_TOKEN").filter(|t| !t.is_empty()).unwrap_or_else(|| if dev { "dev-token".to_string() } else { random_token() });
    let port = get("SWIFT_HELPER_PORT").and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_PORT);
    Config { port, token, allowed }
}

/// Exact match only: "chrome-extension://abc" must not match "chrome-extension://abcd", and an empty Origin never matches.
pub fn origin_allowed(origin: &str, allowed: &[String]) -> bool { !origin.is_empty() && allowed.iter().any(|a| a == origin) }

/// Constant-time comparison so response timing does not leak the token.
pub fn token_ok(given: &str, expected: &str) -> bool {
    let (a, b) = (given.as_bytes(), expected.as_bytes());
    if a.len() != b.len() || b.is_empty() { return false; }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Value of `key` in a query string like "token=abc&x=1" (percent-decoded for %XX and +).
pub fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').filter_map(|kv| kv.split_once('=')).find(|(k, _)| *k == key).map(|(_, v)| percent_decode(v))
}
fn percent_decode(s: &str) -> String {
    let b = s.as_bytes(); let mut out = Vec::with_capacity(b.len()); let mut i = 0;
    while i < b.len() {
        match b[i] { b'+' => { out.push(b' '); i += 1; }
            b'%' if i + 2 < b.len() => {
                let h = std::str::from_utf8(&b[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok());
                if let Some(v) = h { out.push(v); i += 3; } else { out.push(b'%'); i += 1; } }
            c => { out.push(c); i += 1; } }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// "ready (2.1.316 (Claude Code))" or "missing". Login state is added later (task: report Claude Code status).
pub fn claude_status() -> String {
    match Command::new("claude").arg("--version").output() { Ok(o) if o.status.success() => format!("ready ({})", String::from_utf8_lossy(&o.stdout).trim()), _ => "missing".to_string() }
}

fn forbidden() -> ErrorResponse { http::Response::builder().status(403).body(Some("forbidden".to_string())).expect("static response") }

/// Accept loop: one thread per connection. Returns only on listener error.
pub fn serve(listener: TcpListener, cfg: Config) -> io::Result<()> {
    for stream in listener.incoming() {
        let stream = stream?; let cfg = cfg.clone();
        thread::spawn(move || {
            let check = |req: &Request, resp: Response| -> Result<Response, ErrorResponse> {
                let origin = req.headers().get("origin").and_then(|v| v.to_str().ok()).unwrap_or("");
                let token = query_param(req.uri().query().unwrap_or(""), "token").unwrap_or_default();
                if origin_allowed(origin, &cfg.allowed) && token_ok(&token, &cfg.token) { Ok(resp) } else { Err(forbidden()) }
            };
            let Ok(mut ws) = accept_hdr(stream, check) else { return };
            let hello = serde_json::json!({ "type": "hello", "version": env!("CARGO_PKG_VERSION"), "claude": claude_status() });
            if ws.send(Message::text(hello.to_string())).is_err() { return; }
            while let Ok(msg) = ws.read() {
                if let Message::Text(t) = msg { if t.as_str().contains("\"ping\"") && ws.send(Message::text("{\"type\":\"pong\"}")).is_err() { break; } } else if msg.is_close() { break; }
            }
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn origin_exact_match_only() {
        let a = vec!["chrome-extension://abc".to_string()];
        assert!(origin_allowed("chrome-extension://abc", &a)); assert!(!origin_allowed("chrome-extension://abcd", &a)); assert!(!origin_allowed("", &a)); assert!(!origin_allowed("http://evil.test", &a));
        assert!(!origin_allowed("chrome-extension://abc", &[]));
    }
    #[test] fn token_compare() { assert!(token_ok("s3cret", "s3cret")); assert!(!token_ok("s3cret!", "s3cret")); assert!(!token_ok("", "")); assert!(!token_ok("x", "")); }
    #[test] fn query_parsing() { assert_eq!(query_param("a=1&token=a%20b+c", "token").as_deref(), Some("a b c")); assert_eq!(query_param("a=1", "token"), None); assert_eq!(query_param("token=%zz", "token").as_deref(), Some("%zz")); }
    #[test] fn config_defaults_are_closed() {
        let c = config_from(|_| None, || "rnd".into()); assert!(c.allowed.is_empty()); assert_eq!(c.token, "rnd"); assert_eq!(c.port, DEFAULT_PORT);
        let d = config_from(|k| (k == "SWIFT_DEV").then(|| "1".to_string()), || "rnd".into()); assert_eq!(d.allowed, vec![DEV_ORIGIN.to_string()]); assert_eq!(d.token, "dev-token");
        let e = config_from(|k| (k == "SWIFT_ALLOWED_ORIGINS").then(|| "chrome-extension://a, chrome-extension://b".to_string()), || "rnd".into()); assert_eq!(e.allowed.len(), 2);
    }
}
