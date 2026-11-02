// project.pick over the real WebSocket with a fake dialog binary: a chosen folder comes back as a path, cancel and a missing dialog are errors.
use helper::{serve, Config};
use std::{fs, net::TcpListener, os::unix::fs::PermissionsExt, thread};
use tungstenite::{client::IntoClientRequest, connect, Message};
type Ws = tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>;
fn start(bin: &str) -> Ws { let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port();
    let cfg = Config { port, token: "t".into(), allowed: vec!["chrome-extension://good".into()], claude_bin: "claude".into(), model: "haiku".into(), project_roots: vec![], data_dir: std::env::temp_dir().join("sc-unused"), picker_bin: bin.into() }; thread::spawn(move || { let _ = serve(l, cfg); });
    let mut r = format!("ws://127.0.0.1:{port}/?token=t").into_client_request().unwrap(); r.headers_mut().insert("Origin", "chrome-extension://good".parse().unwrap()); let (mut ws, _) = connect(r).unwrap(); let _ = ws.read().unwrap(); ws }
fn pick(ws: &mut Ws) -> serde_json::Value { ws.send(Message::text("{\"type\":\"project.pick\",\"id\":\"k1\"}")).unwrap(); loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] == "project.pick" { return v; } } }
fn script(name: &str, body: &str) -> String { let p = std::env::temp_dir().join(format!("{name}-{}.sh", std::process::id())); fs::write(&p, format!("#!/bin/sh\n{body}\n")).unwrap(); fs::set_permissions(&p, fs::Permissions::from_mode(0o755)).unwrap(); p.to_string_lossy().into_owned() }
#[test] fn picked_folder_cancel_and_missing_dialog() {
    let ok = pick(&mut start(&script("pick-ok", "echo /Users/me/Hobby/hearth/"))); assert_eq!(ok["ok"], true); assert_eq!(ok["path"], "/Users/me/Hobby/hearth/"); assert_eq!(ok["id"], "k1");
    let cancel = pick(&mut start(&script("pick-cancel", "exit 1"))); assert_eq!(cancel["ok"], false); assert_eq!(cancel["error"], "cancelled");
    let empty = pick(&mut start(&script("pick-empty", "echo"))); assert_eq!(empty["ok"], false);
    let missing = pick(&mut start("/nonexistent/dialog")); assert_eq!(missing["ok"], false); assert!(missing["error"].as_str().unwrap().contains("no folder dialog"));
}
