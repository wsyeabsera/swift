//! MCP server tests (task #1712): the stdio protocol with a fake backend, and the real relay (helper server + fake app client + the real WebSocket backend).
use helper::{mcp::{self, Backend}, serve, Config};
use serde_json::{json, Value};
use std::{net::TcpListener, sync::{Arc, Mutex}, thread};
use tungstenite::{client::IntoClientRequest, connect, Message};

struct Fake(Vec<(String, Value)>, Result<Value, String>);
impl Backend for Fake { fn call(&mut self, t: &str, a: Value) -> Result<Value, String> { self.0.push((t.into(), a)); self.1.clone() } }
fn talk(input: &str, be: &mut dyn Backend) -> Vec<Value> { let mut out = Vec::new(); mcp::serve_stdio(input.as_bytes(), &mut out, be).unwrap(); String::from_utf8(out).unwrap().lines().map(|l| serde_json::from_str(l).unwrap()).collect() }

#[test] fn protocol_handshake_list_and_call() {
    let mut be = Fake(vec![], Ok(json!({ "applied": 1 })));
    let r = talk("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"t\",\"version\":\"1\"}}}\n{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}\n{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"apply_ops\",\"arguments\":{\"ops\":[]}}}\n", &mut be);
    assert_eq!(r.len(), 3, "the notification gets no reply"); assert_eq!(r[0]["result"]["protocolVersion"], "2024-11-05"); assert_eq!(r[0]["id"], 1);
    let names: Vec<&str> = r[1]["result"]["tools"].as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect(); assert_eq!(names, ["read_subtree", "apply_ops", "set_token", "artifact_page", "fill_from_data", "undo"]);
    assert_eq!(r[2]["result"]["content"][0]["text"], "{\"applied\":1}"); assert_eq!(be.0[0].0, "apply_ops");
}
#[test] fn protocol_errors_are_reported() {
    let mut be = Fake(vec![], Err("boom".into()));
    let r = talk("not json\n{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"nope\"}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"nope\"}}\n{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"undo\"}}\n", &mut be);
    assert_eq!(r[0]["error"]["code"], -32700); assert_eq!(r[1]["error"]["code"], -32601); assert_eq!(r[2]["error"]["code"], -32602); assert_eq!(r[3]["result"]["isError"], true); assert_eq!(r[3]["result"]["content"][0]["text"], "boom");
    let big = format!("{{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"tools/call\",\"params\":{{\"name\":\"apply_ops\",\"arguments\":{{\"ops\":[{{\"op\":\"text\",\"id\":\"a\",\"value\":\"{}\"}}]}}}}}}\n", "x".repeat(300_000));
    let r = talk(&big, &mut be); assert_eq!(r[0]["result"]["isError"], true); assert_eq!(be.0.len(), 1, "oversized call never reached the backend");
}

struct Rig { port: u16, dir: std::path::PathBuf, applied: Arc<Mutex<Vec<Value>>> }
/// A real helper, plus a fake app: an allowed-origin client that registers and answers `tree` / `apply_ops` / `undo` relays.
fn rig(with_app: bool) -> Rig { rig_roots(with_app, vec![]) }
fn rig_roots(with_app: bool, roots: Vec<std::path::PathBuf>) -> Rig {
    let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port(); let dir = std::env::temp_dir().join(format!("sc-mcp-{port}"));
    let cfg = Config { port, token: "tok".into(), allowed: vec!["http://app.test".into()], claude_bin: "claude".into(), model: "haiku".into(), project_roots: roots, data_dir: dir.clone(), picker_bin: "osascript".into(), min_free_mb: 0 };
    thread::spawn(move || { let _ = serve(l, cfg); }); thread::sleep(std::time::Duration::from_millis(100));
    let applied = Arc::new(Mutex::new(Vec::new()));
    if with_app { let ap = applied.clone(); thread::spawn(move || {
        let mut r = format!("ws://127.0.0.1:{port}/?token=tok").into_client_request().unwrap(); r.headers_mut().insert("Origin", "http://app.test".parse().unwrap()); let (mut ws, _) = connect(r).unwrap();
        ws.send(Message::text("{\"type\":\"mcp.register\"}")).unwrap();
        loop { let Ok(Message::Text(t)) = ws.read() else { return }; let v: Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] != "mcp.req" { continue; }
            let res = match v["tool"].as_str().unwrap() {
                "tree" => json!({ "frame": "tv", "tree": [{ "id": "root", "parent": null, "tag": "div", "text": "" }, { "id": "clock", "parent": "root", "tag": "div", "text": "12:00" }] }),
                "apply_ops" => { ap.lock().unwrap().push(v["args"].clone()); json!({ "applied": v["args"]["ops"].as_array().unwrap().len() }) }
                "fill_rows" => { ap.lock().unwrap().push(v["args"].clone()); json!({ "rows": v["args"]["rows"].as_array().unwrap().len() }) }
                _ => json!({ "ok": true }) };
            ws.send(Message::text(json!({ "type": "mcp.res", "id": v["id"], "ok": true, "result": res }).to_string())).unwrap(); } }); thread::sleep(std::time::Duration::from_millis(200)); }
    Rig { port, dir, applied }
}
fn call(rig: &Rig, tool: &str, args: Value) -> Result<Value, String> { let mut be = mcp::WsBackend::new(rig.dir.clone()); be.call(tool, args) }

#[test] fn batch_is_validated_dry_run_and_relayed_once() {
    let r = rig(true);
    let ok = call(&r, "apply_ops", json!({ "ops": [{ "op": "set", "id": "clock", "prop": "font-size", "value": "300px" }, { "op": "text", "id": "clock", "value": "now" }] })).unwrap();
    assert_eq!(ok["applied"], 2); assert_eq!(ok["dryRun"], "ok"); assert_eq!(r.applied.lock().unwrap().len(), 1, "one relay = one undo step"); assert_eq!(r.applied.lock().unwrap()[0]["frame"], "tv");
    assert!(call(&r, "set_token", json!({ "name": "--ac", "value": "#fff" })).is_ok());
    assert!(call(&r, "undo", json!({})).is_ok());
}
#[test] fn bad_ops_are_rejected_before_the_app_sees_them() {
    let r = rig(true); let n = |r: &Rig| r.applied.lock().unwrap().len();
    for (ops, why) in [
        (json!([{ "op": "set", "id": "nope", "prop": "color", "value": "red" }]), "unknown_id"),
        (json!([{ "op": "set", "id": "clock", "prop": "color", "value": "red" }, { "op": "remove", "id": "root" }]), "root_protected"),
        (json!([{ "op": "add", "parent": "root", "id": "x", "html": "<script>alert(1)</script>" }]), "bad_html"),
        (json!([{ "op": "add", "parent": "root", "id": "x", "html": "<img src=x onerror=alert(1)>" }]), "bad_html"),
        (json!([{ "op": "add", "parent": "root", "id": "x", "html": "<a href=\"javascript:alert(1)\">x</a>" }]), "bad_html"),
        (json!([{ "op": "set", "id": "clock", "prop": "color", "value": "x".repeat(201) }]), "bad_value"),
        (json!([{ "op": "set", "id": "clock", "prop": "bad prop", "value": "1" }]), "bad_property"),
        (json!([{ "op": "insert", "parent": "root", "index": 0, "node": { "id": "z" } }]), "internal_op"),
        (json!([{ "op": "explode" }]), "unknown variant"),
    ] { let e = call(&r, "apply_ops", json!({ "ops": ops })).unwrap_err(); assert!(e.contains(why), "{e} should mention {why}"); }
    assert!(call(&r, "apply_ops", json!({ "ops": (0..201).map(|_| json!({ "op": "set", "id": "clock", "prop": "color", "value": "red" })).collect::<Vec<_>>() })).unwrap_err().contains("too many"));
    assert_eq!(n(&r), 0, "nothing reached the app");
}
#[test] fn no_app_connected_is_an_error() { let r = rig(false); let e = call(&r, "read_subtree", json!({})).unwrap_err(); assert!(e.contains("no Swift Canvas app"), "{e}"); }
#[test] fn missing_helper_is_an_error() { let mut be = mcp::WsBackend::new(std::env::temp_dir().join("sc-mcp-nothing-here")); assert!(be.call("undo", json!({})).unwrap_err().contains("is the Swift Canvas helper running")); }
#[test] fn mcp_role_needs_token_and_no_origin_and_only_mcp_calls() {
    let r = rig(false); let p = r.port;
    let mk = |q: &str, origin: Option<&str>| { let mut x = format!("ws://127.0.0.1:{p}/{q}").into_client_request().unwrap(); if let Some(o) = origin { x.headers_mut().insert("Origin", o.parse().unwrap()); } connect(x) };
    assert!(mk("?token=nope&role=mcp", None).is_err(), "wrong token"); assert!(mk("?role=mcp", None).is_err(), "no token"); assert!(mk("?token=tok", None).is_err(), "no origin and not mcp role");
    assert!(mk("?token=tok&role=mcp", Some("http://evil.test")).is_err(), "a web page (it always has an Origin) cannot take the mcp path");
    let (mut ws, _) = mk("?token=tok&role=mcp", None).expect("mcp role"); let _hello = ws.read().unwrap();
    ws.send(Message::text("{\"type\":\"say\",\"id\":\"1\",\"system\":\"s\",\"request\":\"r\"}")).unwrap(); ws.send(Message::text("{\"type\":\"ping\"}")).unwrap();
    let Message::Text(t) = ws.read().unwrap() else { panic!() }; assert!(t.as_str().contains("pong"), "say from an mcp connection is ignored: {t}");
    let tok = std::fs::read_to_string(r.dir.join(mcp::TOKEN_FILE)).unwrap(); assert!(tok.contains("\"token\":\"tok\""));
    #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; assert_eq!(std::fs::metadata(r.dir.join(mcp::TOKEN_FILE)).unwrap().permissions().mode() & 0o777, 0o600); }
}

#[test] fn fill_from_data_reads_inside_the_root_only_and_relays_the_capped_table() {
    let root = std::fs::canonicalize(std::env::temp_dir()).unwrap().join(format!("sc-data-{}", std::process::id())); let _ = std::fs::remove_dir_all(&root); std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("users.csv"), "name,role\nAda,admin\nBo,dev\nCy,dev\n").unwrap(); let outside = root.parent().unwrap().join(format!("sc-secret-{}.csv", std::process::id())); std::fs::write(&outside, "k\n1\n").unwrap();
    let r = rig_roots(true, vec![root.clone()]);
    let preview = call(&r, "fill_from_data", json!({ "path": "users.csv", "max_rows": 2 })).unwrap();
    assert_eq!(preview["filled"], false); assert_eq!(preview["rows"].as_array().unwrap().len(), 2); assert_eq!(preview["dropped"]["rows"], 1); assert!(r.applied.lock().unwrap().is_empty(), "no el = nothing relayed");
    let filled = call(&r, "fill_from_data", json!({ "path": "users.csv", "el": "list", "columns": ["role", "name"] })).unwrap();
    assert_eq!(filled["fill"]["rows"], 3); let sent = r.applied.lock().unwrap()[0].clone(); assert_eq!(sent["el"], "list"); assert_eq!(sent["columns"], json!(["role", "name"])); assert_eq!(sent["rows"][0], json!(["admin", "Ada"]));
    for bad in [outside.to_str().unwrap(), "../sc-secret.csv", "nope.csv"] { assert!(call(&r, "fill_from_data", json!({ "path": bad, "el": "list" })).is_err(), "{bad}"); }
    assert_eq!(r.applied.lock().unwrap().len(), 1, "a refused path never reaches the app");
    let none = rig_roots(true, vec![]); assert!(call(&none, "fill_from_data", json!({ "path": "users.csv" })).unwrap_err().contains("no project folder"));
}
