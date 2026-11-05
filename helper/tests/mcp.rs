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
    let names: Vec<&str> = r[1]["result"]["tools"].as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect(); assert_eq!(names, ["read_subtree", "apply_ops", "set_token", "artifact_page", "list_frames", "check", "screenshot", "export", "fill_from_data", "save_template", "list_templates", "new_from_template", "fill_slots", "undo"]);
    assert_eq!(r[2]["result"]["content"][0]["text"], "{\"applied\":1}"); assert_eq!(be.0[0].0, "apply_ops");
}
#[test] fn protocol_errors_are_reported() {
    let mut be = Fake(vec![], Err("boom".into()));
    let r = talk("not json\n{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"nope\"}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"nope\"}}\n{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"undo\"}}\n", &mut be);
    assert_eq!(r[0]["error"]["code"], -32700); assert_eq!(r[1]["error"]["code"], -32601); assert_eq!(r[2]["error"]["code"], -32602); assert_eq!(r[3]["result"]["isError"], true); assert_eq!(r[3]["result"]["content"][0]["text"], "boom");
    let big = format!("{{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"tools/call\",\"params\":{{\"name\":\"apply_ops\",\"arguments\":{{\"ops\":[{{\"op\":\"text\",\"id\":\"a\",\"value\":\"{}\"}}]}}}}}}\n", "x".repeat(300_000));
    let r = talk(&big, &mut be); assert_eq!(r[0]["result"]["isError"], true); assert_eq!(be.0.len(), 1, "oversized call never reached the backend");
}

struct Rig { port: u16, dir: std::path::PathBuf, applied: Arc<Mutex<Vec<Value>>>, calls: Arc<Mutex<Vec<(String, Value)>>> }
/// A real helper, plus a fake app: an allowed-origin client that registers and answers `tree` / `apply_ops` / `undo` relays.
fn rig(with_app: bool) -> Rig { rig_roots(with_app, vec![]) }
fn rig_roots(with_app: bool, roots: Vec<std::path::PathBuf>) -> Rig {
    let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port(); let dir = std::env::temp_dir().join(format!("sc-mcp-{port}"));
    let cfg = Config { port, token: "tok".into(), allowed: vec!["http://app.test".into()], claude_bin: "claude".into(), model: "haiku".into(), project_roots: roots, data_dir: dir.clone(), picker_bin: "osascript".into(), min_free_mb: 0 };
    thread::spawn(move || { let _ = serve(l, cfg); }); thread::sleep(std::time::Duration::from_millis(100));
    let applied = Arc::new(Mutex::new(Vec::new())); let calls = Arc::new(Mutex::new(Vec::new()));
    if with_app { let ap = applied.clone(); let cl = calls.clone(); thread::spawn(move || {
        let mut r = format!("ws://127.0.0.1:{port}/?token=tok").into_client_request().unwrap(); r.headers_mut().insert("Origin", "http://app.test".parse().unwrap()); let (mut ws, _) = connect(r).unwrap();
        ws.send(Message::text("{\"type\":\"mcp.register\"}")).unwrap();
        loop { let Ok(Message::Text(t)) = ws.read() else { return }; let v: Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] != "mcp.req" { continue; }
            cl.lock().unwrap().push((v["tool"].as_str().unwrap().to_string(), v["args"].clone()));
            let res = match v["tool"].as_str().unwrap() {
                "list_frames" => json!({ "frames": [{ "id": "tv", "name": "TV", "w": 1920, "h": 1080, "lens": "tv" }] }),
                "check" => json!({ "frame": "tv", "findings": [{ "n": 1, "el": "clock", "kind": "contrast", "message": "low", "fix": { "prop": "color", "value": "#fff" } }] }),
                "frame_html" => json!({ "frame": "tv", "w": 320, "h": 240, "html": "<p>hi</p>" }),
                "export" => json!({ "target": v["args"]["target"], "preview": "x", "confirm": v["args"]["confirm"] }),
                "tree" => json!({ "frame": "tv", "tree": [{ "id": "root", "parent": null, "tag": "div", "text": "" }, { "id": "clock", "parent": "root", "tag": "div", "text": "12:00" }] }),
                "apply_ops" => { ap.lock().unwrap().push(v["args"].clone()); json!({ "applied": v["args"]["ops"].as_array().unwrap().len() }) }
                "fill_rows" => { ap.lock().unwrap().push(v["args"].clone()); json!({ "rows": v["args"]["rows"].as_array().unwrap().len() }) }
                "save_template" => if v["args"]["name"] == "boom" { json!({ "slug": "../x", "files": { "template.json": "{}" } }) } else { json!({ "slug": "my-t", "name": v["args"]["name"], "slots": 1, "warnings": [], "files": { "template.json": "{\"n\":1}", "frames/home.html": "<div id=\"home\"></div>" }, "sawScan": v["args"].get("scan").is_some() }) },
                _ => json!({ "ok": true }) };
            ws.send(Message::text(json!({ "type": "mcp.res", "id": v["id"], "ok": true, "result": res }).to_string())).unwrap(); } }); thread::sleep(std::time::Duration::from_millis(200)); }
    let rig = Rig { port, dir, applied, calls };
    if with_app { for _ in 0..60 { // wait until the app has registered (a fixed sleep raced under load)
        if mcp::WsBackend::new(rig.dir.clone()).call("undo", json!({})).is_ok() { break; } thread::sleep(std::time::Duration::from_millis(50)); }
        rig.calls.lock().unwrap().clear(); }
    rig
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

// ---- read-side tools (#1828)
use std::time::Duration;
fn script(n: &str, body: &str) -> String { let p = std::env::temp_dir().join(format!("sc-mcp-{n}-{}.sh", std::process::id())); std::fs::write(&p, format!("#!/bin/sh\n{body}\n")).unwrap(); #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755)).unwrap(); } p.to_string_lossy().into() }
const CHROME: &str = r#"for a in "$@"; do case "$a" in --screenshot=*) f="${a#--screenshot=}";; esac; done; printf 'PNGDATA' > "$f""#;
fn ctx(n: &str, chrome: &str) -> mcp::Ctx { let d = std::env::temp_dir().join(format!("sc-mcp-ctx-{n}-{}", std::process::id())); let _ = std::fs::remove_dir_all(&d); std::fs::create_dir_all(&d).unwrap(); mcp::Ctx { data_dir: d, chrome: chrome.into(), roots: vec![] } }
fn save(c: &mcp::Ctx, id: &str, frames: Value) { std::fs::write(c.data_dir.join(format!("{id}.project.json")), json!({ "swiftCanvas": 1, "name": id, "frames": frames }).to_string()).unwrap(); }
fn frames() -> Value { json!([{ "id": "tv-1", "title": "Living room", "w": 1920, "h": 1080, "html": "<div id=\"tv-1\">a</div>" }, { "id": "phone-1", "title": "Phone", "w": 390, "h": 844, "html": "<div>b</div>" }]) }

#[test] fn image_results_become_mcp_image_blocks() {
    let mut be = Fake(vec![], Ok(json!({ "frame": "tv", "_image": { "mimeType": "image/png", "data": "QUJD" } })));
    let r = talk("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"screenshot\"}}\n", &mut be);
    let c = r[0]["result"]["content"].as_array().unwrap(); assert_eq!(c.len(), 2); assert_eq!(c[1]["type"], "image"); assert_eq!(c[1]["data"], "QUJD"); assert_eq!(c[1]["mimeType"], "image/png"); assert!(!c[0]["text"].as_str().unwrap().contains("QUJD"), "the bytes are not repeated in the text");
}
#[test] fn headless_list_frames_from_a_saved_project_and_from_the_project_list() {
    let c = ctx("list", "unused"); save(&c, "demo", frames()); save(&c, "empty", json!([])); std::fs::write(c.data_dir.join("broken.project.json"), "{}").unwrap(); let hub = mcp::Hub::default();
    let r = mcp::run_tool(&hub, &c, "list_frames", &json!({ "project": "demo" })).unwrap(); assert_eq!(r["frames"][0], json!({ "id": "tv-1", "name": "Living room", "w": 1920.0, "h": 1080.0, "lens": "tv" })); assert_eq!(r["frames"][1]["lens"], "phone");
    let r = mcp::run_tool(&hub, &c, "list_frames", &json!({})).unwrap(); let ps = r["projects"].as_array().unwrap(); assert_eq!(ps.iter().map(|p| p["project"].as_str().unwrap()).collect::<Vec<_>>(), ["broken", "demo", "empty"]); assert_eq!(ps[1]["frames"], 2); assert!(ps[0]["error"].as_str().unwrap().contains("no frames"), "a bad file is reported, not skipped");
    assert!(mcp::run_tool(&hub, &c, "list_frames", &json!({ "project": "nope" })).unwrap_err().contains("no saved project"));
    for bad in [json!("../x"), json!("A"), json!(5)] { assert!(mcp::run_tool(&hub, &c, "list_frames", &json!({ "project": bad })).is_err()); }
}
#[test] fn headless_screenshot_renders_the_saved_frame_and_cleans_up() {
    let c = ctx("shot", &script("ok", CHROME)); save(&c, "demo", frames()); let hub = mcp::Hub::default();
    let r = mcp::run_tool(&hub, &c, "screenshot", &json!({ "project": "demo", "frame": "phone-1" })).unwrap(); assert_eq!(r["frame"], "phone-1"); assert_eq!(r["bytes"], 7); assert_eq!(r["_image"]["mimeType"], "image/png"); assert_eq!(r["_image"]["data"], "UE5HREFUQQ==");
    assert!(mcp::run_tool(&hub, &c, "screenshot", &json!({ "project": "demo" })).is_ok(), "default = first frame");
    assert!(mcp::run_tool(&hub, &c, "screenshot", &json!({ "project": "demo", "frame": "zz" })).unwrap_err().contains("unknown frame"));
    assert!(mcp::run_tool(&hub, &c, "screenshot", &json!({ "project": "demo", "frame": 3 })).unwrap_err().contains("frame must be a string"));
    save(&c, "tiny", json!([{ "id": "a", "title": "A", "w": 10, "h": 10, "html": "x" }])); assert!(mcp::run_tool(&hub, &c, "screenshot", &json!({ "project": "tiny" })).unwrap_err().contains("outside"));
    save(&c, "huge", json!([{ "id": "a", "title": "A", "w": 400, "h": 400, "html": "x".repeat(2 * 1024 * 1024 + 1) }])); assert!(mcp::run_tool(&hub, &c, "screenshot", &json!({ "project": "huge" })).unwrap_err().contains("too large"));
}
#[test] fn a_failing_browser_is_an_error_not_an_empty_image() { let c = ctx("badshot", &script("bad", "exit 3")); save(&c, "demo", frames()); let e = mcp::run_tool(&mcp::Hub::default(), &c, "screenshot", &json!({ "project": "demo" })).unwrap_err(); assert!(e.contains("browser failed"), "{e}"); let c2 = ctx("nochrome", "/no/such/chrome"); save(&c2, "demo", frames()); assert!(mcp::run_tool(&mcp::Hub::default(), &c2, "screenshot", &json!({ "project": "demo" })).unwrap_err().contains("cannot start the browser")); }
#[test] fn without_an_app_check_export_and_live_screenshot_say_so() {
    let r = rig(false); for (t, a) in [("check", json!({})), ("export", json!({ "target": "html" })), ("screenshot", json!({}))] { let e = call(&r, t, a).unwrap_err(); assert!(e.contains("no Swift Canvas app"), "{t}: {e}"); }
    assert!(call(&r, "list_frames", json!({})).is_ok(), "list_frames falls back to the saved projects");
}
#[test] fn read_side_tools_relay_to_the_app_with_validated_args() {
    let r = rig(true);
    assert_eq!(call(&r, "list_frames", json!({})).unwrap()["frames"][0]["id"], "tv");
    assert_eq!(call(&r, "check", json!({ "frame": "tv", "judge": true })).unwrap()["findings"][0]["el"], "clock");
    let e = call(&r, "export", json!({ "target": "html" })).unwrap(); assert_eq!(e["confirm"], false); assert_eq!(call(&r, "export", json!({ "target": "react", "confirm": true })).unwrap()["confirm"], true);
    { let c = r.calls.lock().unwrap(); let chk = c.iter().find(|x| x.0 == "check").unwrap(); assert_eq!(chk.1, json!({ "frame": "tv", "judge": true })); }
    let n = r.calls.lock().unwrap().len();
    for (t, a, why) in [("export", json!({}), "target must be a string"), ("export", json!({ "target": "glb" }), "unknown export target"), ("export", json!({ "target": "../x" }), "unknown export target"), ("export", json!({ "target": "html", "confirm": "yes" }), "confirm must be"), ("export", json!({ "target": "html", "frame": 1 }), "frame must be"), ("check", json!({ "judge": 1 }), "judge must be"), ("check", json!({ "frame": ["a"] }), "frame must be")] {
        let e = call(&r, t, a).unwrap_err(); assert!(e.contains(why), "{t}: {e} should mention {why}"); }
    assert_eq!(r.calls.lock().unwrap().len(), n, "bad arguments never reached the app");
    let _ = Duration::from_millis(1);
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
#[test] fn save_template_writes_the_folder_the_app_built_and_refuses_unsafe_ones() {
    let r = rig(true); let ok = call(&r, "save_template", json!({ "name": "My T" })).unwrap();
    let dir = r.dir.join("templates/my-t"); assert_eq!(ok["saved"], dir.display().to_string()); assert_eq!(std::fs::read_to_string(dir.join("template.json")).unwrap(), "{\"n\":1}"); assert!(dir.join("frames/home.html").exists());
    assert!(call(&r, "save_template", json!({ "name": "My T" })).unwrap_err().contains("already exists")); assert!(call(&r, "save_template", json!({ "name": "My T", "overwrite": true })).is_ok());
    assert!(call(&r, "save_template", json!({ "name": "boom" })).unwrap_err().contains("bad template folder name")); assert!(!r.dir.join("x").exists());
    assert!(call(&r, "save_template", json!({})).unwrap_err().contains("name is required"));
    assert!(call(&r, "save_template", json!({ "name": "a", "from_repo": "/etc" })).unwrap_err().contains("not allowed")); assert!(call(&r, "save_template", json!({ "name": "a", "dest": "repo" })).unwrap_err().contains("from_repo")); assert!(call(&r, "save_template", json!({ "name": "a", "dest": "nope" })).unwrap_err().contains("dest must be"));
}

#[test] fn template_tools_validate_args_then_relay_with_the_users_template_folders() {
    let r = rig(true); let t = r.dir.join("templates");
    std::fs::create_dir_all(t.join("mine/frames")).unwrap(); std::fs::write(t.join("mine/template.json"), "{\"name\":\"Mine\"}").unwrap(); std::fs::write(t.join("mine/frames/a.html"), "<div id=\"a\">{{x}}</div>").unwrap(); std::fs::write(t.join("mine/frames/skip.txt"), "no").unwrap();
    std::fs::create_dir_all(t.join("big")).unwrap(); std::fs::write(t.join("big/template.json"), "x".repeat(300_000)).unwrap();
    #[cfg(unix)] { std::fs::create_dir_all(r.dir.join("elsewhere")).unwrap(); std::os::unix::fs::symlink(r.dir.join("elsewhere"), t.join("link")).unwrap(); }
    assert_eq!(call(&r, "list_templates", json!({})).unwrap()["ok"], true);
    let calls = r.calls.lock().unwrap().clone(); let (name, a) = calls.last().unwrap(); assert_eq!(name, "list_templates");
    let us = a["userTemplates"].as_array().unwrap(); let mine = us.iter().find(|u| u["dir"] == "mine").unwrap(); assert!(mine["files"]["template.json"].is_string()); assert!(mine["files"]["frames/a.html"].is_string()); assert!(mine["files"].get("frames/skip.txt").is_none());
    assert!(us.iter().find(|u| u["dir"] == "big").unwrap()["error"].as_str().unwrap().contains("too large"), "oversize is reported, not read"); assert!(us.iter().all(|u| u["dir"] != "link"), "symlinked folders are skipped");
    drop(calls);
    let n0 = r.calls.lock().unwrap().len();
    assert_eq!(call(&r, "new_from_template", json!({ "template": "Pricing", "values": { "a": "b" } })).unwrap()["ok"], true);
    assert_eq!(call(&r, "fill_slots", json!({ "instance": "t1", "values": { "headline": "Hi" } })).unwrap()["ok"], true);
    let c = r.calls.lock().unwrap().clone(); assert_eq!(c.len(), n0 + 2); assert_eq!(c[n0].1["values"]["a"], "b"); assert_eq!(c[n0 + 1].1["instance"], "t1");
    let bad: Vec<(&str, Value, &str)> = vec![
        ("new_from_template", json!({}), "template must be a string"), ("new_from_template", json!({ "template": 5 }), "template must be a string"), ("new_from_template", json!({ "template": "  " }), "1-80"), ("new_from_template", json!({ "template": "x".repeat(81) }), "1-80"),
        ("new_from_template", json!({ "template": "a", "values": [1] }), "object"), ("fill_slots", json!({}), "object"), ("fill_slots", json!({ "values": "x" }), "object"), ("fill_slots", json!({ "values": {} }), "empty"),
        ("fill_slots", json!({ "values": { "a": "b" }, "instance": 3 }), "instance"), ("fill_slots", json!({ "values": { "a": "b" }, "instance": "" }), "instance"),
        ("fill_slots", json!({ "values": (0..41).map(|i| (format!("s{i}"), json!("v"))).collect::<serde_json::Map<_, _>>() }), "too many")];
    for (tool, args, why) in bad { let e = call(&r, tool, args.clone()).unwrap_err(); assert!(e.contains(why), "{tool} {args}: {e}"); }
    assert_eq!(r.calls.lock().unwrap().len(), n0 + 2, "bad arguments never reached the app");
}
#[test] fn template_tools_without_an_app_say_to_open_it() {
    let r = rig(false); for (t, a) in [("list_templates", json!({})), ("new_from_template", json!({ "template": "x" })), ("fill_slots", json!({ "values": { "a": "b" } }))] { assert!(call(&r, t, a).unwrap_err().contains("no Swift Canvas app")); }
}
