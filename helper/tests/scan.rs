// project.scan over the real WebSocket: allowed folder is scanned, anything else (outside the roots, traversal, missing) is refused.
use helper::{serve, Config};
use std::{fs, net::TcpListener, thread};
use tungstenite::{client::IntoClientRequest, connect, Message};
fn start(root: &std::path::Path) -> tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>> { let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port();
    let cfg = Config { port, token: "t".into(), allowed: vec!["chrome-extension://good".into()], claude_bin: "claude".into(), model: "haiku".into(), project_roots: vec![root.to_path_buf()], data_dir: std::env::temp_dir().join("sc-unused"), picker_bin: "osascript".into(), min_free_mb: 0 }; thread::spawn(move || { let _ = serve(l, cfg); });
    let mut r = format!("ws://127.0.0.1:{port}/?token=t").into_client_request().unwrap(); r.headers_mut().insert("Origin", "chrome-extension://good".parse().unwrap()); let (mut ws, _) = connect(r).unwrap(); let _ = ws.read().unwrap(); ws }
fn scan(ws: &mut tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>, path: &str) -> serde_json::Value {
    ws.send(Message::text(serde_json::json!({ "type": "project.scan", "id": "p1", "path": path }).to_string())).unwrap();
    loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] == "project.scan" { return v; } } }
#[test] fn scans_allowed_folders_and_refuses_everything_else() {
    let root = std::env::temp_dir().join(format!("proj-root-{}", std::process::id())); let _ = fs::remove_dir_all(&root); fs::create_dir_all(root.join("app")).unwrap(); fs::write(root.join("app/t.css"), ":root{--ink:#0b0b0f;--blue:#0a84ff} h1{font-family:Inter}").unwrap();
    let outside = std::env::temp_dir().join(format!("proj-out-{}", std::process::id())); fs::create_dir_all(&outside).unwrap(); fs::write(outside.join("o.css"), ":root{--x:#fff}").unwrap();
    let mut ws = start(&root);
    let ok = scan(&mut ws, root.join("app").to_str().unwrap()); assert_eq!(ok["ok"], true); assert_eq!(ok["scan"]["tokens"][0]["name"], "--ink"); assert_eq!(ok["scan"]["fonts"][0]["value"], "Inter");
    for bad in [outside.to_str().unwrap().to_string(), format!("{}/../{}", root.display(), outside.file_name().unwrap().to_string_lossy()), "/etc".to_string(), root.join("missing").to_string_lossy().into_owned(), String::new()] { let r = scan(&mut ws, &bad); assert_eq!(r["ok"], false, "{bad}"); assert!(r["error"].as_str().unwrap().contains("not allowed")); }
}
#[test] fn project_write_lands_in_an_allowed_repo_and_nowhere_else() {
    let root = std::env::temp_dir().join(format!("proj-write-{}", std::process::id())); let _ = fs::remove_dir_all(&root); fs::create_dir_all(root.join("repo")).unwrap(); let outside = std::env::temp_dir().join(format!("proj-write-out-{}", std::process::id())); fs::create_dir_all(&outside).unwrap();
    let mut ws = start(&root); let mut write = |path: &str, data: &str| -> serde_json::Value { ws.send(Message::text(serde_json::json!({ "type": "project.write", "id": "w1", "path": path, "data": data }).to_string())).unwrap(); loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] == "project.write" { return v; } } };
    let ok = write(root.join("repo").to_str().unwrap(), "{\"frames\":[]}"); assert_eq!(ok["ok"], true, "{ok}"); assert_eq!(fs::read_to_string(root.join("repo/.swift-canvas/project.json")).unwrap(), "{\"frames\":[]}");
    assert_eq!(write(outside.to_str().unwrap(), "{}")["ok"], false); assert!(!outside.join(".swift-canvas").exists());
    assert_eq!(write(&format!("{}/../{}", root.join("repo").display(), outside.file_name().unwrap().to_str().unwrap()), "{}")["ok"], false);
    assert_eq!(write(root.join("repo").to_str().unwrap(), "not json")["ok"], false);
}
