// The memory guard over the real WebSocket: when the Mac is short of free memory a Say is refused with a clear reason and no Claude process starts.
use helper::{serve, Config};
use std::{net::TcpListener, thread};
use tungstenite::{client::IntoClientRequest, connect, Message};
#[cfg(target_os = "macos")]
#[test] fn say_is_refused_when_memory_is_short() {
    let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port();
    // a threshold no machine meets; the "claude" binary does not exist, so reaching it would give a different error
    let cfg = Config { port, token: "t".into(), allowed: vec!["chrome-extension://good".into()], claude_bin: "/nonexistent/claude".into(), model: "haiku".into(), project_roots: vec![], data_dir: std::env::temp_dir().join("sc-unused"), picker_bin: "osascript".into(), min_free_mb: 10_000_000_000 };
    thread::spawn(move || { let _ = serve(l, cfg); });
    let mut r = format!("ws://127.0.0.1:{port}/?token=t").into_client_request().unwrap(); r.headers_mut().insert("Origin", "chrome-extension://good".parse().unwrap()); let (mut ws, _) = connect(r).unwrap(); let _ = ws.read().unwrap();
    ws.send(Message::text(serde_json::json!({ "type": "say", "id": "m1", "system": "S", "request": "R" }).to_string())).unwrap();
    loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] != "say.event" { continue; } assert_eq!(v["kind"], "error"); assert!(v["text"].as_str().unwrap().contains("free memory"), "{v}"); break; }
}
