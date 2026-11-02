// store.put / store.get over the real WebSocket: a project survives a helper restart (new connection, same data dir); bad ids and bad data are refused.
use helper::{serve, Config};
use std::{fs, net::TcpListener, path::Path, thread};
use tungstenite::{client::IntoClientRequest, connect, Message};
type Ws = tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>;
fn start(dir: &Path) -> Ws { let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port();
    let cfg = Config { port, token: "t".into(), allowed: vec!["chrome-extension://good".into()], claude_bin: "claude".into(), model: "haiku".into(), project_roots: vec![], data_dir: dir.to_path_buf(), picker_bin: "osascript".into(), min_free_mb: 0 }; thread::spawn(move || { let _ = serve(l, cfg); });
    let mut r = format!("ws://127.0.0.1:{port}/?token=t").into_client_request().unwrap(); r.headers_mut().insert("Origin", "chrome-extension://good".parse().unwrap()); let (mut ws, _) = connect(r).unwrap(); let _ = ws.read().unwrap(); ws }
fn call(ws: &mut Ws, msg: serde_json::Value) -> serde_json::Value { let kind = msg["type"].clone(); ws.send(Message::text(msg.to_string())).unwrap(); loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] == kind { return v; } } }
#[test] fn projects_persist_across_connections_and_bad_input_is_refused() {
    let dir = std::env::temp_dir().join(format!("sc-store-ws-{}", std::process::id())); let _ = fs::remove_dir_all(&dir);
    let mut a = start(&dir);
    assert_eq!(call(&mut a, serde_json::json!({ "type": "store.get", "id": "g0", "project": "tvdash" }))["data"], serde_json::Value::Null);
    let put = call(&mut a, serde_json::json!({ "type": "store.put", "id": "p1", "project": "tvdash", "data": "{\"frames\":[1]}" })); assert_eq!(put["ok"], true); assert_eq!(put["id"], "p1");
    let mut b = start(&dir); let got = call(&mut b, serde_json::json!({ "type": "store.get", "id": "g1", "project": "tvdash" })); assert_eq!(got["ok"], true); assert_eq!(got["data"], "{\"frames\":[1]}");
    for (p, d) in [("../evil", "{}"), ("", "{}"), ("ok", "not json")] { let r = call(&mut b, serde_json::json!({ "type": "store.put", "id": "x", "project": p, "data": d })); assert_eq!(r["ok"], false, "{p}/{d}"); }
    assert_eq!(call(&mut b, serde_json::json!({ "type": "store.put", "id": "x", "project": "ok" }))["ok"], false); assert!(!dir.join("ok.project.json").exists()); assert!(!dir.parent().unwrap().join("evil.project.json").exists());
}
