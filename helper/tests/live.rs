// Live agent stream over a real WebSocket server (#1803): an agent (mcp role) streams one run, two subscribers receive it, the browser role is reported, failures are visible.
use helper::{serve, Config};
use std::{net::{TcpListener, TcpStream}, thread, time::Duration};
use tungstenite::{client::IntoClientRequest, connect, stream::MaybeTlsStream, Message, WebSocket};
type Ws = WebSocket<MaybeTlsStream<TcpStream>>;
fn start() -> u16 { let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port(); let cfg = Config { port, token: "tok".into(), allowed: vec!["chrome-extension://good".into()], claude_bin: "claude".into(), model: "haiku".into(), project_roots: vec![], data_dir: { let d = std::env::temp_dir().join("sc-unused-live"); let _ = std::fs::create_dir_all(&d); d }, picker_bin: "osascript".into(), min_free_mb: 0 }; thread::spawn(move || { let _ = serve(l, cfg); }); port }
fn open(port: u16, role: &str) -> Ws {
    let mut r = format!("ws://127.0.0.1:{port}/?token=tok{role}").into_client_request().unwrap();
    if role.is_empty() { r.headers_mut().insert("Origin", "chrome-extension://good".parse().unwrap()); }
    let (mut ws, _) = connect(r).expect("handshake"); read_type(&mut ws, "hello");
    if let MaybeTlsStream::Plain(s) = ws.get_mut() { s.set_read_timeout(Some(Duration::from_secs(3))).unwrap(); } ws
}
fn app(port: u16) -> Ws { open(port, "") }
fn agent(port: u16) -> Ws { open(port, "&role=mcp") }
fn next(ws: &mut Ws) -> serde_json::Value { loop { match ws.read() { Ok(Message::Text(t)) => { let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); return v; } Ok(_) => {} Err(e) => panic!("no message: {e}") } } }
fn read_type(ws: &mut Ws, ty: &str) -> serde_json::Value { loop { let v = next(ws); if v["type"] == ty { return v; } } }
fn send(ws: &mut Ws, v: serde_json::Value) { ws.send(Message::text(v.to_string())).unwrap(); }
fn emit(ws: &mut Ws, run: &str, ev: serde_json::Value) -> serde_json::Value { send(ws, serde_json::json!({ "type": "live.event", "run": run, "event": ev })); read_type(ws, "live.ack") }
fn subscribe(ws: &mut Ws) { send(ws, serde_json::json!({ "type": "live.subscribe" })); read_type(ws, "live.subscribed"); }

#[test] fn two_subscribers_receive_one_run_in_order_and_the_browser_role_is_reported() {
    let p = start(); let (mut panel, mut tail, mut claude) = (app(p), agent(p), agent(p));
    subscribe(&mut panel); subscribe(&mut tail);
    let mut browser = app(p); send(&mut browser, serde_json::json!({ "type": "live.register", "role": "browser" })); read_type(&mut browser, "live.registered");
    let steps = [serde_json::json!({ "kind": "thinking.delta", "text": "look" }), serde_json::json!({ "kind": "tool.start", "id": "t1", "tool": "click" }), serde_json::json!({ "kind": "tool.end", "id": "t1", "ok": true }), serde_json::json!({ "kind": "done" })];
    for (i, s) in steps.iter().enumerate() { let a = emit(&mut claude, "run1", s.clone()); assert_eq!(a["seq"], i + 1); assert_eq!(a["browser"], true); assert_eq!(a["delivered"], 3); }
    for ws in [&mut panel, &mut tail, &mut browser] {
        for (i, s) in steps.iter().enumerate() { let m = read_type(ws, "live.event"); assert_eq!(m["envelope"]["seq"], i + 1); assert_eq!(m["envelope"]["run"], "run1"); assert_eq!(m["envelope"]["source"], "agent"); assert_eq!(m["envelope"]["event"], *s); }
    }
}
#[test] fn the_browser_can_answer_and_the_agent_hears_it() {
    let p = start(); let (mut claude, mut browser) = (agent(p), app(p)); subscribe(&mut claude);
    let a = emit(&mut browser, "r", serde_json::json!({ "kind": "user.action", "action": "pause" })); assert_eq!(a["delivered"], 1);
    let m = read_type(&mut claude, "live.event"); assert_eq!(m["envelope"]["source"], "browser"); assert_eq!(m["envelope"]["event"]["action"], "pause");
}
#[test] fn browser_role_absent_is_reported_to_the_agent() {
    let p = start(); let mut claude = agent(p); let a = emit(&mut claude, "r", serde_json::json!({ "kind": "done" })); assert_eq!(a["browser"], false); assert_eq!(a["delivered"], 0);
}
#[test] fn a_subscriber_dropping_mid_run_does_not_stop_the_others() {
    let p = start(); let (mut stays, mut leaves, mut claude) = (app(p), app(p), agent(p)); subscribe(&mut stays); subscribe(&mut leaves);
    emit(&mut claude, "r", serde_json::json!({ "kind": "thinking.delta", "text": "1" })); read_type(&mut leaves, "live.event"); drop(leaves); thread::sleep(Duration::from_millis(200));
    let a = emit(&mut claude, "r", serde_json::json!({ "kind": "thinking.delta", "text": "2" })); assert_eq!(a["delivered"], 1);
    assert_eq!(read_type(&mut stays, "live.event")["envelope"]["seq"], 1); assert_eq!(read_type(&mut stays, "live.event")["envelope"]["seq"], 2);
}
#[test] fn bad_events_are_refused_loudly_and_a_page_cannot_use_the_agent_path() {
    let p = start(); let mut claude = agent(p); send(&mut claude, serde_json::json!({ "type": "live.event", "run": "r", "event": { "kind": "bogus" } })); assert!(read_type(&mut claude, "live.nack")["error"].is_string());
    send(&mut claude, serde_json::json!({ "type": "live.event", "run": "", "event": { "kind": "done" } })); assert!(read_type(&mut claude, "live.nack")["error"].is_string());
    let mut page = app(p); send(&mut page, serde_json::json!({ "type": "mcp.call", "id": "1", "tool": "undo" })); send(&mut page, serde_json::json!({ "type": "ping" }));
    read_type(&mut page, "pong"); // mcp.call from a page is ignored, as before
}
#[test] fn origin_and_token_rules_are_unchanged_for_live() {
    let p = start(); assert!(connect(format!("ws://127.0.0.1:{p}/?token=bad&role=mcp")).is_err());
    let mut r = format!("ws://127.0.0.1:{p}/?token=tok").into_client_request().unwrap(); r.headers_mut().insert("Origin", "http://evil.test".parse().unwrap()); assert!(connect(r).is_err());
}
