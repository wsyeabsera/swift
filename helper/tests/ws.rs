// Integration test: a real server on an ephemeral port. Wrong origin, wrong token, and no token are refused; the right pair gets a hello and a pong.
use helper::{serve, Config};
use std::{net::TcpListener, thread};
use tungstenite::{client::IntoClientRequest, connect, Message};
fn start() -> u16 { let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port(); let cfg = Config { port, token: "tok".into(), allowed: vec!["chrome-extension://good".into()] }; thread::spawn(move || { let _ = serve(l, cfg); }); port }
fn req(port: u16, query: &str, origin: &str) -> tungstenite::handshake::client::Request { let mut r = format!("ws://127.0.0.1:{port}/{query}").into_client_request().unwrap(); if !origin.is_empty() { r.headers_mut().insert("Origin", origin.parse().unwrap()); } r }
#[test] fn refuses_wrong_origin() { let p = start(); assert!(connect(req(p, "?token=tok", "http://evil.test")).is_err()); }
#[test] fn refuses_missing_origin() { let p = start(); assert!(connect(req(p, "?token=tok", "")).is_err()); }
#[test] fn refuses_wrong_or_missing_token() { let p = start(); assert!(connect(req(p, "?token=nope", "chrome-extension://good")).is_err()); assert!(connect(req(p, "", "chrome-extension://good")).is_err()); }
#[test] fn accepts_right_pair_and_answers_ping() {
    let p = start(); let (mut ws, _) = connect(req(p, "?token=tok", "chrome-extension://good")).expect("handshake");
    let Message::Text(t) = ws.read().unwrap() else { panic!("hello") }; assert!(t.as_str().contains("\"hello\""), "{t}");
    ws.send(Message::text("{\"type\":\"ping\"}")).unwrap(); let Message::Text(t) = ws.read().unwrap() else { panic!("pong") }; assert!(t.as_str().contains("pong"));
}
