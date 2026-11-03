// Claude Code status transitions against a fake `claude` (SWIFT_CLAUDE_BIN): missing, logged_out, ready, limit_reached. No model calls.
use helper::{serve, Config};
use std::{fs, net::TcpListener, os::unix::fs::PermissionsExt, time::{Duration, Instant}};
use tungstenite::{client::IntoClientRequest, connect, Message, WebSocket, stream::MaybeTlsStream};
type Ws = WebSocket<MaybeTlsStream<std::net::TcpStream>>;
static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
/// A fake claude whose behaviour follows files in a per-test dir: `login` present = logged in; `limit` present = Say returns a usage-limit error.
fn fake() -> (String, std::path::PathBuf) {
    let d = std::env::temp_dir().join(format!("fake-status-{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst))); fs::create_dir_all(&d).unwrap(); let p = d.join("claude");
    let s = format!("#!/bin/sh\nD={}\nif [ \"$1\" = --version ]; then echo '9.9.9 (Claude Code)'; exit 0; fi\nif [ \"$1\" = auth ]; then if [ -e $D/login ]; then echo '{{\"loggedIn\":true}}'; exit 0; else echo '{{\"loggedIn\":false}}'; exit 1; fi; fi\nread line\nif [ -e $D/limit ]; then printf '%s\\n' '{{\"type\":\"result\",\"is_error\":true,\"result\":\"usage limit reached\"}}'; else printf '%s\\n' '{{\"type\":\"result\",\"is_error\":false}}'; fi\n", d.display());
    fs::write(&p, s).unwrap(); fs::set_permissions(&p, fs::Permissions::from_mode(0o755)).unwrap(); (p.display().to_string(), d)
}
fn start(bin: &str) -> (Ws, String) {
    std::env::set_var("SWIFT_STATUS_POLL_MS", "100");
    let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port(); let cfg = Config { port, token: "t".into(), allowed: vec!["chrome-extension://good".into()], claude_bin: bin.into(), model: "haiku".into(), project_roots: vec![], data_dir: std::env::temp_dir(), picker_bin: "false".into(), min_free_mb: 0 };
    std::thread::spawn(move || { let _ = serve(l, cfg); });
    let mut r = format!("ws://127.0.0.1:{port}/?token=t").into_client_request().unwrap(); r.headers_mut().insert("Origin", "chrome-extension://good".parse().unwrap()); let (mut ws, _) = connect(r).unwrap();
    if let MaybeTlsStream::Plain(t) = ws.get_mut() { let _ = t.set_read_timeout(Some(Duration::from_secs(30))); }
    let Message::Text(h) = ws.read().unwrap() else { panic!("hello") }; (ws, h.to_string())
}
fn next_status(ws: &mut Ws) -> serde_json::Value { let t = Instant::now(); loop { assert!(t.elapsed() < Duration::from_secs(60), "no claude.status"); if let Ok(Message::Text(m)) = ws.read() { let v: serde_json::Value = serde_json::from_str(m.as_str()).unwrap(); if v["type"] == "claude.status" { return v; } } } }
fn recheck(ws: &mut Ws) -> serde_json::Value { ws.send(Message::text("{\"type\":\"claude.status\"}")).unwrap(); next_status(ws) }
/// Returns the say.event kind that ended the Say plus the claude.status states seen meanwhile (the helper pushes the change just before the final event).
fn say(ws: &mut Ws) -> (String, Vec<String>) { ws.send(Message::text(serde_json::json!({ "type": "say", "id": "x", "system": "S", "request": "r" }).to_string())).unwrap(); let mut seen = vec![]; loop { if let Message::Text(m) = ws.read().unwrap() { let v: serde_json::Value = serde_json::from_str(m.as_str()).unwrap(); if v["type"] == "claude.status" { seen.push(v["state"].as_str().unwrap().to_string()); } if v["type"] == "say.event" && v["kind"] != "delta" { return (v["kind"].as_str().unwrap().to_string(), seen); } } } }

#[test] fn missing_binary_then_hello_keeps_the_legacy_string() { let (mut ws, h) = start("/nonexistent/claude"); let v: serde_json::Value = serde_json::from_str(&h).unwrap(); assert_eq!(v["claude"], "missing"); assert_eq!(v["claudeStatus"]["state"], "missing"); assert_eq!(recheck(&mut ws)["state"], "missing"); }
#[test] fn logged_out_is_pushed_to_ready_by_the_poll_without_asking() {
    let (bin, d) = fake(); let (mut ws, h) = start(&bin); let v: serde_json::Value = serde_json::from_str(&h).unwrap(); assert_eq!(v["claude"], "logged_out"); assert_eq!(v["claudeStatus"]["state"], "logged_out");
    assert_eq!(recheck(&mut ws)["state"], "logged_out");
    fs::write(d.join("login"), "").unwrap(); let s = next_status(&mut ws); assert_eq!(s["state"], "ready"); assert!(s["message"].as_str().unwrap().contains("9.9.9"));
}
#[test] fn ready_then_logout_is_found_by_an_explicit_recheck() { let (bin, d) = fake(); fs::write(d.join("login"), "").unwrap(); let (mut ws, h) = start(&bin); assert!(h.contains("\"claude\":\"ready (9.9.9 (Claude Code))\""), "{h}"); fs::remove_file(d.join("login")).unwrap(); assert_eq!(recheck(&mut ws)["state"], "logged_out"); }
#[test] fn a_limit_error_sets_limit_reached_and_a_good_say_clears_it() {
    let (bin, d) = fake(); fs::write(d.join("login"), "").unwrap(); let (mut ws, _) = start(&bin); fs::write(d.join("limit"), "").unwrap();
    assert_eq!(say(&mut ws), ("error".to_string(), vec!["limit_reached".to_string()]));
    std::thread::sleep(Duration::from_millis(400)); // the 5 s poll must not clear it (a free probe cannot see limits); an unrelated Say after the limit lifts does
    fs::remove_file(d.join("limit")).unwrap(); assert_eq!(say(&mut ws), ("done".to_string(), vec!["ready".to_string()]));
}
#[test] fn an_explicit_recheck_clears_limit_reached() {
    let (bin, d) = fake(); fs::write(d.join("login"), "").unwrap(); let (mut ws, _) = start(&bin); fs::write(d.join("limit"), "").unwrap(); assert_eq!(say(&mut ws).1, vec!["limit_reached".to_string()]);
    assert_eq!(recheck(&mut ws)["state"], "ready");
}
