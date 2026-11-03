// Say end to end against a fake `claude` (a shell script): streaming deltas, errors, limits. No real Claude, no network.
use helper::{serve, Config};
use std::{fs, net::TcpListener, os::unix::fs::PermissionsExt, thread, time::Duration};
use tungstenite::{client::IntoClientRequest, connect, Message, WebSocket, stream::MaybeTlsStream};
type Ws = WebSocket<MaybeTlsStream<std::net::TcpStream>>;
static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
fn fake(script: &str) -> String { let p = std::env::temp_dir().join(format!("fake-claude-{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst))); fs::write(&p, format!("#!/bin/sh\n{script}\n")).unwrap(); fs::set_permissions(&p, fs::Permissions::from_mode(0o755)).unwrap(); p.to_string_lossy().into_owned() }
fn start(bin: &str) -> Ws { let l = TcpListener::bind(("127.0.0.1", 0)).unwrap(); let port = l.local_addr().unwrap().port(); let cfg = Config { port, token: "t".into(), allowed: vec!["chrome-extension://good".into()], claude_bin: bin.into(), model: "haiku".into(), project_roots: vec![], data_dir: std::env::temp_dir().join("sc-unused"), picker_bin: "osascript".into(), min_free_mb: 0 }; thread::spawn(move || { let _ = serve(l, cfg); });
    let mut r = format!("ws://127.0.0.1:{port}/?token=t").into_client_request().unwrap(); r.headers_mut().insert("Origin", "chrome-extension://good".parse().unwrap()); let (mut ws, _) = connect(r).unwrap(); let _ = ws.read().unwrap(); ws }
fn say(ws: &mut Ws, id: &str, request: &str) -> Vec<(String, String)> {
    ws.send(Message::text(serde_json::json!({ "type": "say", "id": id, "system": "SYS", "request": request }).to_string())).unwrap(); let mut out = vec![];
    loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] != "say.event" { continue; } let kind = v["kind"].as_str().unwrap().to_string(); out.push((kind.clone(), v["text"].as_str().unwrap().to_string())); if kind != "delta" { return out; } }
}
fn say_raw(ws: &mut Ws, id: &str) -> serde_json::Value {
    ws.send(Message::text(serde_json::json!({ "type": "say", "id": id, "system": "SYS", "request": "r" }).to_string())).unwrap();
    loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] == "say.event" && v["kind"] != "delta" { return v; } }
}
#[test] fn done_carries_usage_when_the_result_has_it() { let mut ws = start(&fake(r#"read line; printf '%s\n' '{"type":"result","is_error":false,"usage":{"input_tokens":120,"output_tokens":34,"cache_read_input_tokens":7}}'"#)); let v = say_raw(&mut ws, "u1"); assert_eq!(v["kind"], "done"); assert_eq!(v["usage"], serde_json::json!({"input_tokens":120,"output_tokens":34,"cache_read_input_tokens":7})); }
#[test] fn a_result_without_usage_still_completes() { let mut ws = start(&fake(r#"read line; printf '%s\n' '{"type":"result","is_error":false}'"#)); let v = say_raw(&mut ws, "u2"); assert_eq!(v["kind"], "done"); assert!(v.get("usage").is_none()); }
const OK: &str = r#"read line; printf '%s\n' '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"{\"op\":\"ask\","}}}'; printf '%s\n' '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"\"value\":\"ok\"}"}}}'; printf '%s\n' '{"type":"result","is_error":false}'"#;
#[test] fn streams_deltas_then_done() { let mut ws = start(&fake(OK)); let ev = say(&mut ws, "a1", "hi"); assert_eq!(ev.len(), 3, "{ev:?}"); assert_eq!(ev[0], ("delta".into(), "{\"op\":\"ask\",".into())); assert_eq!(ev[2].0, "done"); }
#[test] fn the_request_reaches_claude_as_one_user_message() { let mut ws = start(&fake(r#"read line; printf '%s\n' "$line" | grep -q 'Request: tell me' && printf '%s\n' '{"type":"result","is_error":false}'"#)); assert_eq!(say(&mut ws, "a2", "tell me").last().unwrap().0, "done"); }
#[test] fn a_missing_binary_is_an_error_event_not_a_crash() { let mut ws = start("/nonexistent/claude"); let ev = say(&mut ws, "a3", "x"); assert_eq!(ev[0].0, "error"); assert!(ev[0].1.contains("cannot start")); assert_eq!(say(&mut ws, "a4", "y")[0].0, "error"); }
#[test] fn claude_exiting_without_an_answer_is_reported() { let mut ws = start(&fake("read line; exit 1")); let ev = say(&mut ws, "a5", "x"); assert_eq!(ev[0].0, "error"); assert!(ev[0].1.contains("without an answer")); }
#[test] fn an_error_result_is_reported() { let mut ws = start(&fake(r#"read line; printf '%s\n' '{"type":"result","is_error":true,"result":"usage limit reached"}'"#)); assert_eq!(say(&mut ws, "a6", "x"), vec![("error".to_string(), "usage limit reached".to_string())]); }
#[test] fn oversized_requests_are_refused() { let mut ws = start(&fake(OK)); let ev = say(&mut ws, "a7", &"x".repeat(70_000)); assert_eq!(ev[0], ("error".to_string(), "request too large".to_string())); }
#[test] fn at_most_four_says_run_at_once() { let mut ws = start(&fake("read line; sleep 1; printf '%s\\n' '{\"type\":\"result\",\"is_error\":false}'"));
    for i in 0..5 { ws.send(Message::text(serde_json::json!({ "type": "say", "id": format!("c{i}"), "system": "S", "request": "r" }).to_string())).unwrap(); }
    let mut busy = 0; let mut done = 0; while busy + done < 5 { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["kind"] == "error" && v["text"] == "too many Says at once" { busy += 1; } if v["kind"] == "done" { done += 1; } } assert_eq!((busy, done), (1, 4)); thread::sleep(Duration::from_millis(10)); }

#[test] fn the_slot_frees_when_done_is_sent_not_when_claude_finishes_exiting() {
    // claude answers at once but lingers 2 s before exiting: the app sees `done` and starts the next Say immediately, so four back-to-back rounds of four must never hit the cap
    let mut ws = start(&fake("read line; printf '%s\\n' '{\"type\":\"result\",\"is_error\":false}'; sleep 2"));
    for round in 0..2 { for i in 0..4 { ws.send(Message::text(serde_json::json!({ "type": "say", "id": format!("r{round}-{i}"), "system": "S", "request": "r" }).to_string())).unwrap(); }
        let mut done = 0; while done < 4 { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] != "say.event" { continue; } assert_ne!(v["text"], "too many Says at once", "round {round}"); if v["kind"] == "done" { done += 1; } } }
}

#[test] fn a_prewarmed_spare_serves_the_say_and_is_replaced() {
    let count = std::env::temp_dir().join(format!("spawn-count-{}", std::process::id())); let _ = fs::remove_file(&count);
    let script = format!("case \"$1\" in --version|auth) exit 0;; esac; echo x >> {}; read line; printf '%s\\n' '{{\"type\":\"result\",\"is_error\":false}}'", count.display());
    let mut ws = start(&fake(&script));
    let spawned = |c: &std::path::Path| fs::read_to_string(c).map(|s| s.lines().count()).unwrap_or(0);
    // macOS can stall a fresh /bin/sh at dyld_start for 20+ s when many test processes spawn at once (seen with `sample`): wait up to 90 s
    let wait_for = |want: usize| { for _ in 0..1800 { if spawned(&count) >= want { return; } thread::sleep(Duration::from_millis(50)); } };
    wait_for(1); assert_eq!(spawned(&count), 1, "connecting prewarms exactly one spare");
    assert_eq!(say(&mut ws, "w1", "hi").last().unwrap().0, "done"); wait_for(2); thread::sleep(Duration::from_millis(300));
    assert_eq!(spawned(&count), 2, "the spare served the Say and one replacement was started (a cold Say would have made it 3)");
}
#[test] fn a_spare_that_died_while_idle_falls_back_to_a_fresh_process() {
    // the first process started (the spare) exits at once; later ones answer
    let flag = std::env::temp_dir().join(format!("swift-seen-{}-{}", std::process::id(), N.fetch_add(1, std::sync::atomic::Ordering::SeqCst))); let _ = fs::remove_file(&flag);
    let script = format!("if [ ! -e {f} ]; then touch {f}; exit 0; fi; read line; printf '%s\\n' '{{\"type\":\"result\",\"is_error\":false}}'", f = flag.display());
    let mut ws = start(&fake(&script)); thread::sleep(Duration::from_millis(500)); assert_eq!(say(&mut ws, "w2", "hi").last().unwrap().0, "done");
}

const PNG_B64: &str = "iVBORw0KGgoAAAANSUhEUg==";
fn say_images(ws: &mut Ws, id: &str, images: serde_json::Value) -> Vec<(String, String)> {
    ws.send(Message::text(serde_json::json!({ "type": "say", "id": id, "system": "SYS", "request": "rebuild", "images": images }).to_string())).unwrap(); let mut out = vec![];
    loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] != "say.event" { continue; } let kind = v["kind"].as_str().unwrap().to_string(); out.push((kind.clone(), v["text"].as_str().unwrap().to_string())); if kind != "delta" { return out; } }
}
#[test] fn an_image_reaches_claude_as_an_image_content_block() {
    // the fake only answers when the one stream-json line holds a base64 png image block after the text block
    let mut ws = start(&fake(&format!(r#"read line; printf '%s\n' "$line" | grep -q '"type":"image"' && printf '%s\n' "$line" | grep -q '"media_type":"image/png"' && printf '%s\n' "$line" | grep -q '{PNG_B64}' && printf '%s\n' '{{"type":"stream_event","event":{{"type":"content_block_delta","delta":{{"type":"text_delta","text":"<div id=\"r\"></div>"}}}}}}' && printf '%s\n' '{{"type":"result","is_error":false}}'"#)));
    let ev = say_images(&mut ws, "i1", serde_json::json!([{ "mediaType": "image/png", "data": PNG_B64 }])); assert_eq!(ev.iter().map(|e| e.0.as_str()).collect::<Vec<_>>(), ["delta", "done"], "{ev:?}"); assert_eq!(ev[0].1, "<div id=\"r\"></div>");
}
#[test] fn bad_images_are_error_events_and_never_reach_claude() {
    let mut ws = start(&fake(OK));
    for (images, want) in [
        (serde_json::json!([{ "mediaType": "image/gif", "data": PNG_B64 }]), "unsupported"), (serde_json::json!([{ "mediaType": "image/png", "data": "####" }]), "base64"),
        (serde_json::json!([{ "mediaType": "image/jpeg", "data": PNG_B64 }]), "do not match"), (serde_json::json!([{ "mediaType": "image/png", "data": format!("iVBORw0K{}", "A".repeat(7 * 1024 * 1024)) }]), "too large"),
        (serde_json::json!("nope"), "list"),
    ] { let ev = say_images(&mut ws, "i2", images); assert_eq!(ev.len(), 1, "{ev:?}"); assert_eq!(ev[0].0, "error"); assert!(ev[0].1.contains(want), "{} should contain {want}", ev[0].1); }
    assert_eq!(say(&mut ws, "i3", "still works").last().unwrap().0, "done"); // the helper and its slot are fine afterwards
}
#[test] fn pool_status_reports_the_cap_running_says_and_memory_floor() {
    let mut ws = start(&fake(OK)); ws.send(Message::text(serde_json::json!({ "type": "pool.status", "id": "s1" }).to_string())).unwrap();
    let v = loop { let Message::Text(t) = ws.read().unwrap() else { continue }; let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap(); if v["type"] == "pool.status" { break v; } };
    assert_eq!(v["id"], "s1"); assert_eq!(v["running"], 0); assert_eq!(v["max"], 4); assert!(v["spare"].is_boolean()); assert_eq!(v["minFreeMb"], 0);
}
