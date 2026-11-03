//! Capture a RUNNING page (localhost only) as static HTML: headless Chrome renders it and dumps the DOM, linked stylesheets are fetched and inlined, scripts are dropped.
//! Only http://localhost / 127.0.0.1 / [::1] is ever fetched: the helper must not become a way to read other machines or the internet.
use std::{io::{Read, Write}, net::TcpStream, process::{Command, Stdio}, time::{Duration, Instant}};

pub const MAX_BYTES: usize = 4_000_000;
#[derive(Debug, PartialEq)] pub struct Target { pub host: String, pub port: u16, pub path: String }

/// `http://localhost:5173/a?b` -> host, port, path. Anything that is not plain http to this machine is refused.
pub fn parse_local_url(url: &str) -> Result<Target, String> {
    let rest = url.strip_prefix("http://").ok_or("only http://localhost pages can be captured")?;
    let (auth, path) = match rest.find('/') { Some(i) => (&rest[..i], &rest[i..]), None => (rest, "/") };
    if auth.contains('@') { return Err("only http://localhost pages can be captured".into()); }
    let (host, port) = if let Some(h) = auth.strip_prefix('[') { let end = h.find(']').ok_or("bad address")?; (&h[..end], h[end + 1..].strip_prefix(':').map(str::to_string)) } else { match auth.rsplit_once(':') { Some((h, p)) => (h, Some(p.to_string())), None => (auth, None) } };
    if !matches!(host, "localhost" | "127.0.0.1" | "::1") { return Err("only http://localhost pages can be captured".into()); }
    let port = match port { Some(p) => p.parse::<u16>().map_err(|_| "bad port")?, None => 80 };
    Ok(Target { host: host.to_string(), port, path: path.to_string() })
}

fn decode_chunked(mut b: &[u8]) -> Vec<u8> {
    let mut out = vec![]; loop { let Some(i) = b.windows(2).position(|w| w == b"\r\n") else { break }; let n = usize::from_str_radix(std::str::from_utf8(&b[..i]).unwrap_or("0").split(';').next().unwrap_or("0").trim(), 16).unwrap_or(0); if n == 0 || b.len() < i + 2 + n { break; } out.extend_from_slice(&b[i + 2..i + 2 + n]); b = &b[(i + 2 + n + 2).min(b.len())..]; } out
}
/// Plain HTTP GET with a size cap and a timeout (no TLS: localhost only).
pub fn http_get(t: &Target) -> Result<String, String> {
    let addr = if t.host == "::1" { format!("[::1]:{}", t.port) } else { format!("{}:{}", if t.host == "localhost" { "127.0.0.1" } else { &t.host }, t.port) };
    let mut s = TcpStream::connect(&addr).map_err(|e| format!("cannot reach {addr}: {e}"))?; s.set_read_timeout(Some(Duration::from_secs(8))).ok();
    write!(s, "GET {} HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\nAccept: text/css,*/*\r\n\r\n", t.path, t.host, t.port).map_err(|e| e.to_string())?;
    let mut buf = vec![]; s.take(MAX_BYTES as u64).read_to_end(&mut buf).map_err(|e| e.to_string())?;
    let i = buf.windows(4).position(|w| w == b"\r\n\r\n").ok_or("bad response")?; let head = String::from_utf8_lossy(&buf[..i]).to_lowercase();
    if !head.starts_with("http/1.1 200") && !head.starts_with("http/1.0 200") { return Err(format!("status: {}", head.lines().next().unwrap_or(""))); }
    let body = &buf[i + 4..]; let body = if head.contains("transfer-encoding: chunked") { decode_chunked(body) } else { body.to_vec() }; Ok(String::from_utf8_lossy(&body).into_owned())
}

/// Resolve a stylesheet href against the page; only the same local origin is followed.
pub fn resolve(base: &Target, href: &str) -> Option<Target> {
    if href.starts_with("//") || href.starts_with("data:") { return None; }
    if href.starts_with("http://") || href.starts_with("https://") { let t = parse_local_url(href).ok()?; return (t.host == base.host && t.port == base.port).then_some(t); }
    let path = if href.starts_with('/') { href.to_string() } else { let dir = base.path.rsplit_once('/').map(|x| x.0).unwrap_or(""); format!("{dir}/{href}") };
    Some(Target { host: base.host.clone(), port: base.port, path })
}
fn attr<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let key = format!("{name}="); let i = tag.find(&key)?; let rest = &tag[i + key.len()..]; let q = rest.chars().next()?; if q != '"' && q != '\'' { return None; } let end = rest[1..].find(q)?; Some(&rest[1..1 + end])
}
/// Drop every <script> (frames are static designs) and inline each same-origin `<link rel=stylesheet>` as a <style> via `fetch`.
pub fn inline_styles(html: &str, base: &Target, fetch: &dyn Fn(&Target) -> Option<String>) -> String {
    let mut out = String::new(); let mut rest = html; let lower = html.to_ascii_lowercase(); let mut pos = 0usize;
    while let Some(i) = lower[pos..].find('<') { let a = pos + i; out.push_str(&rest[..a - pos]); rest = &rest[a - pos..]; pos = a;
        let l = &lower[pos..];
        if l.starts_with("<script") { let end = l.find("</script>").map(|e| e + 9).unwrap_or(l.len()); rest = &rest[end..]; pos += end; continue; }
        if l.starts_with("<link") { let end = l.find('>').map(|e| e + 1).unwrap_or(l.len()); let tag = &rest[..end];
            if tag.to_lowercase().contains("stylesheet") { if let Some(css) = attr(tag, "href").and_then(|h| resolve(base, h)).and_then(|t| fetch(&t)) { out.push_str("<style>"); out.push_str(&css.replace("</style", "<\\/style")); out.push_str("</style>"); rest = &rest[end..]; pos += end; continue; } }
            out.push_str(tag); rest = &rest[end..]; pos += end; continue; }
        out.push('<'); rest = &rest[1..]; pos += 1; }
    out.push_str(rest); out
}

/// Render with headless Chrome (`SWIFT_CHROME_BIN` overrides the macOS Chrome path) and return the serialized DOM.
pub fn dump_dom(chrome: &str, url: &str, size: (u32, u32), timeout: Duration) -> Result<String, String> {
    let mut child = Command::new(chrome).args(["--headless=new", "--disable-gpu", "--hide-scrollbars", "--dump-dom", "--virtual-time-budget=5000", &format!("--window-size={},{}", size.0, size.1), url]).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().map_err(|e| format!("cannot start Chrome ({chrome}): {e}"))?;
    let mut out = child.stdout.take().ok_or("no output")?; let (tx, rx) = std::sync::mpsc::channel(); std::thread::spawn(move || { let mut s = String::new(); let _ = out.by_ref().take(MAX_BYTES as u64).read_to_string(&mut s); let _ = tx.send(s); });
    let t0 = Instant::now(); loop { if let Ok(s) = rx.try_recv() { let _ = child.wait(); return if s.trim().is_empty() { Err("Chrome returned an empty page".into()) } else { Ok(s) }; } if t0.elapsed() > timeout { let _ = child.kill(); let _ = child.wait(); return Err("Chrome took too long to render the page".into()); } std::thread::sleep(Duration::from_millis(50)); }
}
/// Viewport the page is laid out for (a phone page needs a phone-wide window): clamped so a client cannot ask for a huge render.
pub fn clamp_size(w: Option<u64>, h: Option<u64>) -> (u32, u32) { (w.unwrap_or(1280).clamp(320, 2560) as u32, h.unwrap_or(800).clamp(400, 4000) as u32) }
pub fn capture(url: &str, size: (u32, u32)) -> Result<String, String> {
    let t = parse_local_url(url)?; let chrome = std::env::var("SWIFT_CHROME_BIN").ok().filter(|b| !b.is_empty()).unwrap_or_else(|| "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".to_string());
    let dom = dump_dom(&chrome, url, size, Duration::from_secs(25))?; Ok(inline_styles(&dom, &t, &|r| http_get(r).ok()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn only_this_machine_over_plain_http() {
        assert_eq!(parse_local_url("http://localhost:5173/a?b=1").unwrap(), Target { host: "localhost".into(), port: 5173, path: "/a?b=1".into() });
        assert_eq!(parse_local_url("http://127.0.0.1").unwrap().port, 80); assert_eq!(parse_local_url("http://[::1]:9/x").unwrap().host, "::1");
        for bad in ["https://localhost/", "http://example.com/", "http://localhost.evil.com/", "http://user@localhost/", "http://192.168.1.5/", "file:///etc/passwd", "http://localhost:99999/", "localhost"] { assert!(parse_local_url(bad).is_err(), "{bad}"); }
    }
    #[test] fn stylesheets_resolve_on_the_same_origin_only() {
        let b = Target { host: "localhost".into(), port: 5173, path: "/app/index.html".into() };
        assert_eq!(resolve(&b, "main.css").unwrap().path, "/app/main.css"); assert_eq!(resolve(&b, "/x.css").unwrap().path, "/x.css"); assert_eq!(resolve(&b, "http://localhost:5173/y.css").unwrap().path, "/y.css");
        assert!(resolve(&b, "http://localhost:9999/y.css").is_none()); assert!(resolve(&b, "https://cdn.example.com/a.css").is_none()); assert!(resolve(&b, "//cdn.example.com/a.css").is_none());
    }
    #[test] fn scripts_go_and_local_stylesheets_are_inlined() {
        let b = Target { host: "localhost".into(), port: 1, path: "/".into() };
        let html = r#"<html><head><link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="https://cdn.example.com/b.css"><script>evil()</script></head><body><p onclick="x">hi</p><SCRIPT src="y.js"></SCRIPT>a < b</body></html>"#;
        let out = inline_styles(html, &b, &|t| (t.path == "/a.css").then(|| "p{color:red}".to_string()));
        assert!(out.contains("<style>p{color:red}</style>")); assert!(!out.to_lowercase().contains("<script")); assert!(out.contains("evil") == false);
        assert!(out.contains(r#"href="https://cdn.example.com/b.css""#)); assert!(out.contains("a < b")); assert!(out.contains("<p onclick")); // other markup untouched
    }
    #[test] fn the_viewport_is_clamped() { assert_eq!(clamp_size(None, None), (1280, 800)); assert_eq!(clamp_size(Some(1), Some(1)), (320, 400)); assert_eq!(clamp_size(Some(99999), Some(99999)), (2560, 4000)); assert_eq!(clamp_size(Some(390), Some(844)), (390, 844)); }
    #[test] fn a_style_close_tag_inside_css_cannot_break_out() { let b = Target { host: "localhost".into(), port: 1, path: "/".into() }; let out = inline_styles(r#"<link rel="stylesheet" href="/a.css">"#, &b, &|_| Some("a{}</style><img src=x>".into())); assert_eq!(out.matches("</style>").count(), 1); }
    #[test] fn dump_dom_reports_a_missing_browser_and_a_hang() {
        assert!(dump_dom("/nonexistent/chrome", "http://localhost:1/", (1280, 800), Duration::from_secs(1)).unwrap_err().contains("cannot start Chrome"));
        assert!(dump_dom("/bin/sleep", "30", (1280, 800), Duration::from_millis(300)).is_err());
    }
}
