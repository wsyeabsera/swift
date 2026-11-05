// The read-only tail (#1829) against a real helper: Claude Code's MCP calls show up as lines in a second terminal within 200 ms; it waits for a helper that is not up yet.
use helper::{serve, Config};
use std::{net::TcpListener, sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex}, thread, time::{Duration, Instant}};
use tungstenite::Message;
#[derive(Clone, Default)] struct Buf(Arc<Mutex<Vec<u8>>>);
impl std::io::Write for Buf { fn write(&mut self, b: &[u8]) -> std::io::Result<usize> { self.0.lock().unwrap().extend_from_slice(b); Ok(b.len()) } fn flush(&mut self) -> std::io::Result<()> { Ok(()) } }
impl Buf { fn text(&self) -> String { String::from_utf8_lossy(&self.0.lock().unwrap()).into_owned() } fn wait_for(&self, needle: &str, ms: u64) -> Option<Duration> { let t = Instant::now(); while t.elapsed() < Duration::from_millis(ms) { if self.text().contains(needle) { return Some(t.elapsed()); } thread::sleep(Duration::from_millis(5)); } None } }
fn start_on(l: TcpListener, dir: std::path::PathBuf) { let port = l.local_addr().unwrap().port(); let cfg = Config { port, token: "tok".into(), allowed: vec![], claude_bin: "claude".into(), model: "haiku".into(), project_roots: vec![], data_dir: dir, picker_bin: "osascript".into(), min_free_mb: 0 }; thread::spawn(move || { let _ = serve(l, cfg); }); }
fn tmp(name: &str) -> std::path::PathBuf { let d = std::env::temp_dir().join(format!("sc-watch-{name}-{}", std::process::id())); let _ = std::fs::remove_dir_all(&d); std::fs::create_dir_all(&d).unwrap(); d }
fn spawn_watch(dir: std::path::PathBuf) -> (Buf, Arc<AtomicBool>) { let (buf, stop) = (Buf::default(), Arc::new(AtomicBool::new(false))); let (b, s) = (buf.clone(), stop.clone()); thread::spawn(move || helper::live::watch(&dir, b, &s)); (buf, stop) }

#[test] fn mcp_calls_appear_in_the_tail_within_200ms() {
    let dir = tmp("live"); let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port(); start_on(l, dir.clone());
    let (buf, stop) = spawn_watch(dir.clone()); assert!(buf.wait_for("watching (read-only)", 3000).is_some(), "{}", buf.text());
    // Claude Code: an mcp-role client making a tool call (no app is connected, so it fails: the tail must say so)
    let (mut ws, _) = tungstenite::connect(format!("ws://127.0.0.1:{port}/?token=tok&role=mcp")).unwrap();
    ws.send(Message::text(serde_json::json!({ "type": "mcp.call", "id": "c1", "tool": "undo", "args": {} }).to_string())).unwrap(); let sent = Instant::now();
    let seen = buf.wait_for("mcp:2   agent tool.end FAILED", 2000).expect(&buf.text()); let _ = sent;
    assert!(seen < Duration::from_millis(200), "took {seen:?}"); let t = buf.text(); assert!(t.contains("mcp:1   agent tool.start undo"), "{t}"); assert!(t.contains("no Swift Canvas app"), "{t}");
    stop.store(true, Ordering::SeqCst);
}
#[test] fn the_tail_waits_for_a_helper_that_is_not_up_then_connects() {
    let dir = tmp("late"); let (buf, stop) = spawn_watch(dir.clone()); assert!(buf.wait_for("waiting for the helper", 2000).is_some());
    let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); start_on(l, dir.clone()); assert!(buf.wait_for("watching (read-only)", 5000).is_some(), "{}", buf.text());
    stop.store(true, Ordering::SeqCst);
}
