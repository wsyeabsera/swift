//! Local helper for Swift Canvas: an authenticated WebSocket on 127.0.0.1.
//! Security rules (task #1719): bind loopback only; accept a connection only when its Origin is on the exact allow-list AND the token matches;
//! the allow-list is empty by default, so nothing connects until an extension id (or dev origin) is configured.
pub mod mem;
pub mod say;
pub mod scan;
pub mod capture;
pub mod status;
pub mod store;
pub mod mcp;
pub mod data;
pub mod templates;
pub mod repo;
pub mod render;
pub mod live;
use say::Pool;
use status::Shared;
use std::{io, net::TcpListener, sync::{atomic::{AtomicUsize, Ordering}, mpsc, Arc}, thread, time::Duration};
use tungstenite::{accept_hdr, handshake::server::{ErrorResponse, Request, Response}, http, Error as WsError, Message};

pub const DEFAULT_PORT: u16 = 7431;
pub const DEV_ORIGIN: &str = "http://localhost:5173";

#[derive(Clone, Debug)]
pub struct Config { pub port: u16, pub token: String, pub allowed: Vec<String>, pub claude_bin: String, pub model: String, pub project_roots: Vec<std::path::PathBuf>, pub data_dir: std::path::PathBuf, pub picker_bin: String, pub min_free_mb: u64 }

/// Build the config from environment-like lookups (so it is testable without touching the process environment).
pub fn config_from(get: impl Fn(&str) -> Option<String>, random_token: impl Fn() -> String) -> Config {
    let dev = get("SWIFT_DEV").as_deref() == Some("1");
    let mut allowed: Vec<String> = get("SWIFT_ALLOWED_ORIGINS").unwrap_or_default().split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    if dev { allowed.push(get("SWIFT_DEV_ORIGIN").filter(|o| o.starts_with("http://localhost:") || o.starts_with("http://127.0.0.1:")).unwrap_or_else(|| DEV_ORIGIN.to_string())); } // tests run their dev page on another port (SWIFT_DEV_ORIGIN); only a local http origin is accepted
    let token = get("SWIFT_HELPER_TOKEN").filter(|t| !t.is_empty()).unwrap_or_else(|| if dev { "dev-token".to_string() } else { random_token() });
    let port = get("SWIFT_HELPER_PORT").and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_PORT);
    Config { port, token, allowed, claude_bin: get("SWIFT_CLAUDE_BIN").filter(|b| !b.is_empty()).unwrap_or_else(|| "claude".to_string()), model: get("SWIFT_CLAUDE_MODEL").filter(|m| !m.is_empty()).unwrap_or_else(|| "haiku".to_string()), project_roots: get("SWIFT_PROJECT_ROOTS").unwrap_or_default().split(':').filter(|s| !s.is_empty()).map(std::path::PathBuf::from).collect(), min_free_mb: get("SWIFT_MIN_FREE_MB").and_then(|v| v.parse().ok()).unwrap_or(mem::DEFAULT_MIN_FREE_MB), picker_bin: get("SWIFT_PICKER_BIN").filter(|b| !b.is_empty()).unwrap_or_else(|| "osascript".to_string()), data_dir: get("SWIFT_DATA_DIR").filter(|d| !d.is_empty()).map(std::path::PathBuf::from).unwrap_or_else(|| std::path::PathBuf::from(get("HOME").unwrap_or_else(|| ".".to_string())).join(".swift-canvas")) }
}

/// Exact match only: "chrome-extension://abc" must not match "chrome-extension://abcd", and an empty Origin never matches.
pub fn origin_allowed(origin: &str, allowed: &[String]) -> bool { !origin.is_empty() && allowed.iter().any(|a| a == origin) }

/// Constant-time comparison so response timing does not leak the token.
pub fn token_ok(given: &str, expected: &str) -> bool {
    let (a, b) = (given.as_bytes(), expected.as_bytes());
    if a.len() != b.len() || b.is_empty() { return false; }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Value of `key` in a query string like "token=abc&x=1" (percent-decoded for %XX and +).
pub fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').filter_map(|kv| kv.split_once('=')).find(|(k, _)| *k == key).map(|(_, v)| percent_decode(v))
}
fn percent_decode(s: &str) -> String {
    let b = s.as_bytes(); let mut out = Vec::with_capacity(b.len()); let mut i = 0;
    while i < b.len() {
        match b[i] { b'+' => { out.push(b' '); i += 1; }
            b'%' if i + 2 < b.len() => {
                let h = std::str::from_utf8(&b[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok());
                if let Some(v) = h { out.push(v); i += 3; } else { out.push(b'%'); i += 1; } }
            c => { out.push(c); i += 1; } }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn forbidden() -> ErrorResponse { http::Response::builder().status(403).body(Some("forbidden".to_string())).expect("static response") }

/// Accept loop: one thread per connection. Returns only on listener error.
pub fn serve(listener: TcpListener, cfg: Config) -> io::Result<()> {
    let busy = Arc::new(AtomicUsize::new(0)); let pool = Arc::new(Pool::new(&cfg.claude_bin, &cfg.model)); let picked: Picked = Arc::new(std::sync::Mutex::new(Vec::new())); let shared = Arc::new(Shared::new(&cfg.claude_bin)); let next_id = Arc::new(AtomicUsize::new(0));
    let hub = Arc::new(mcp::Hub::default()); let live = Arc::new(live::LiveHub::default()); if let Err(e) = mcp::write_token_file(&cfg.data_dir, cfg.port, &cfg.token) { eprintln!("cannot write the MCP token file in {}: {e} (`swift-canvas-helper mcp` will not connect)", cfg.data_dir.display()); } // port is the configured one (tests bind port 0 and do not use MCP)
    { let shared = shared.clone(); let every = Duration::from_millis(std::env::var("SWIFT_STATUS_POLL_MS").ok().and_then(|v| v.parse().ok()).unwrap_or(5000)); thread::spawn(move || loop { thread::sleep(every); if shared.get().state != "ready" { shared.refresh(false); } }); } // re-check only while not ready
    { let pool = pool.clone(); thread::spawn(move || loop { thread::sleep(Duration::from_secs(10)); pool.reap(std::time::Instant::now(), say::SPARE_IDLE); }); }
    for stream in listener.incoming() {
        let stream = stream?; let cfg = cfg.clone(); let busy = busy.clone(); let pool = pool.clone(); let picked = picked.clone(); let shared = shared.clone(); let cid = next_id.fetch_add(1, Ordering::SeqCst); let hub = hub.clone(); let live = live.clone();
        thread::spawn(move || {
            let mcp_role = std::cell::Cell::new(false);
            let check = |req: &Request, resp: Response| -> Result<Response, ErrorResponse> {
                let origin = req.headers().get("origin").and_then(|v| v.to_str().ok());
                let query = req.uri().query().unwrap_or(""); let token = query_param(query, "token").unwrap_or_default();
                if !token_ok(&token, &cfg.token) { return Err(forbidden()); }
                // the MCP subcommand is a local process, not a web page: it has NO Origin header (a browser always sends one, so no page can take this path) and holds the token from the 0600 file
                if query_param(query, "role").as_deref() == Some("mcp") && origin.is_none() { mcp_role.set(true); return Ok(resp); }
                if origin_allowed(origin.unwrap_or(""), &cfg.allowed) { Ok(resp) } else { Err(forbidden()) }
            };
            let Ok(mut ws) = accept_hdr(stream, check) else { return }; let is_mcp = mcp_role.get();
            let cs = shared.cached_or_refresh(Duration::from_secs(30)); let hello = serde_json::json!({ "type": "hello", "version": env!("CARGO_PKG_VERSION"), "claude": cs.legacy(), "claudeStatus": { "state": cs.state, "message": cs.message } });
            if ws.send(Message::text(hello.to_string())).is_err() { return; }
            if !is_mcp { let pool = pool.clone(); thread::spawn(move || pool.prewarm()); } // a client is here: have a spare ready for its first Say
            // Writes from Say worker threads go through a channel; the read loop uses a short timeout so it can flush them.
            let (tx, rx) = mpsc::channel::<String>(); shared.subscribe(cid, tx.clone()); let _ = ws.get_mut().set_read_timeout(Some(Duration::from_millis(30)));
            loop {
                while let Ok(m) = rx.try_recv() { if ws.send(Message::text(m)).is_err() { return; } }
                for m in live.drain(cid) { if ws.send(Message::text(m)).is_err() { live.disconnect(cid); return; } }
                match ws.read() {
                    Ok(Message::Text(t)) => handle_text(t.as_str(), &cfg, &tx, &busy, &pool, &picked, &shared, &hub, &live, cid, is_mcp),
                    Ok(Message::Close(_)) | Err(WsError::ConnectionClosed) | Err(WsError::AlreadyClosed) => break,
                    Err(WsError::Io(e)) if matches!(e.kind(), io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut) => continue,
                    Err(_) => break, Ok(_) => {}
                }
            }
            shared.unsubscribe(cid); hub.unregister_app(cid); live.disconnect(cid);
        });
    }
    Ok(())
}

/// The native folder dialog (macOS `choose folder` via osascript). The reply is only a path: scanning still goes through the allow-list.
fn pick_folder(bin: &str) -> Result<String, String> {
    let out = std::process::Command::new(bin).args(["-e", "POSIX path of (choose folder with prompt \"Choose a project folder\")"]).output().map_err(|e| format!("no folder dialog: {e}"))?;
    if !out.status.success() { return Err("cancelled".to_string()); }
    let p = String::from_utf8_lossy(&out.stdout).trim().to_string(); if p.is_empty() { Err("cancelled".to_string()) } else { Ok(p) }
}

/// Messages from the app: ping, and say {id, system, request}. Everything is validated; unknown or malformed input is ignored, never executed.
/// Folders the user chose in the native dialog this run: choosing one is consent to read it, so they count as allowed roots (never anything the client merely names).
type Picked = Arc<std::sync::Mutex<Vec<std::path::PathBuf>>>;
fn handle_text(text: &str, cfg: &Config, tx: &mpsc::Sender<String>, busy: &Arc<AtomicUsize>, pool: &Arc<Pool>, picked: &Picked, shared: &Arc<Shared>, hub: &Arc<mcp::Hub>, live: &Arc<live::LiveHub>, cid: usize, is_mcp: bool) {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(text) else { return };
    let ty = v.get("type").and_then(|t| t.as_str());
    // MCP processes may only call MCP tools (and ping); app connections may not call them
    if is_mcp && !matches!(ty, Some("mcp.call" | "ping" | "live.event" | "live.subscribe")) { return; }
    if !is_mcp && ty == Some("mcp.call") { return; }
    match v.get("type").and_then(|t| t.as_str()) {
        Some("mcp.register") => hub.register_app(cid, tx.clone()), // the app announces itself as the target of relayed design ops
        // Live agent stream (#1803). The browser role registers like the app does for MCP; Claude Code (the mcp role) and the app/panel/extension all publish and subscribe.
        Some("live.register") => { if !is_mcp && v.get("role").and_then(|x| x.as_str()) == Some("browser") { live.register_browser(cid); let _ = tx.send("{\"type\":\"live.registered\",\"role\":\"browser\"}".to_string()); } }
        Some("live.subscribe") => { live.subscribe(cid); let _ = tx.send("{\"type\":\"live.subscribed\"}".to_string()); }
        Some("live.event") => {
            let run: String = v.get("run").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect();
            let parsed = serde_json::from_value::<swift_canvas_core::live::LiveEvent>(v.get("event").cloned().unwrap_or(serde_json::Value::Null)).map_err(|e| e.to_string()).and_then(|e| e.validate().map(|_| e));
            match parsed { Ok(ev) if !run.is_empty() => {
                    let source = if is_mcp { swift_canvas_core::live::Source::Agent } else { swift_canvas_core::live::Source::Browser };
                    let d = live.publish(cid, &run, source, ev); // the sender learns whether anyone listens and whether a browser role exists: absent browser is reported, not silent
                    let _ = tx.send(serde_json::json!({ "type": "live.ack", "run": run, "seq": d.seq, "delivered": d.delivered, "browser": d.browser }).to_string()); }
                Ok(_) => { let _ = tx.send("{\"type\":\"live.nack\",\"error\":\"run id required\"}".to_string()); }
                Err(e) => { let _ = tx.send(serde_json::json!({ "type": "live.nack", "run": run, "error": e }).to_string()); } }
        }
        Some("mcp.res") => { if let Some(id) = v.get("id").and_then(|x| x.as_str()) { hub.deliver(id, v.clone()); } }
        Some("mcp.call") => {
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let tool = v.get("tool").and_then(|x| x.as_str()).unwrap_or("").to_string(); let args = v.get("args").cloned().unwrap_or(serde_json::Value::Null);
            let (tx, hub) = (tx.clone(), hub.clone()); let mut roots = cfg.project_roots.clone(); roots.extend(picked.lock().map(|p| p.clone()).unwrap_or_default()); let ctx = mcp::Ctx { roots, data_dir: cfg.data_dir.clone(), chrome: std::env::var("SWIFT_CHROME_BIN").ok().filter(|b| !b.is_empty()).unwrap_or_else(|| "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".to_string()) };
            thread::spawn(move || { let r = if tool == "save_template" { templates::save_tool(&hub, &ctx.data_dir, &ctx.roots, &args) } else { mcp::run_tool(&hub, &ctx, &tool, &args) }; let reply = match r { Ok(r) => serde_json::json!({ "type": "mcp.result", "id": id, "ok": true, "result": r }), Err(e) => serde_json::json!({ "type": "mcp.result", "id": id, "ok": false, "error": e }) }; let _ = tx.send(reply.to_string()); });
        }
        Some("ping") => { let _ = tx.send("{\"type\":\"pong\"}".to_string()); }
        Some("project.scan") => {
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let path = v.get("path").and_then(|x| x.as_str()).unwrap_or("").to_string();
            let (tx, mut roots) = (tx.clone(), cfg.project_roots.clone()); roots.extend(picked.lock().map(|p| p.clone()).unwrap_or_default());
            thread::spawn(move || { let reply = match scan::allowed_root(std::path::Path::new(&path), &roots) {
                None => serde_json::json!({ "type": "project.scan", "id": id, "ok": false, "error": "folder not allowed: pick it with Choose… (or set SWIFT_PROJECT_ROOTS)" }),
                Some(p) => match scan::scan_dir(&p) { Ok(s) => serde_json::json!({ "type": "project.scan", "id": id, "ok": true, "scan": s }), Err(e) => serde_json::json!({ "type": "project.scan", "id": id, "ok": false, "error": e.to_string() }) } };
                let _ = tx.send(reply.to_string()); });
        }
        Some(t @ ("store.put" | "store.get")) => {
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let project = v.get("project").and_then(|x| x.as_str()).unwrap_or("").to_string(); let data = v.get("data").and_then(|x| x.as_str()).map(str::to_string);
            let (tx, dir, kind) = (tx.clone(), cfg.data_dir.clone(), t.to_string());
            // inline, in arrival order: a thread per write let an older save land AFTER a newer one (the undo+redo pair of the e2e lost its last op)
            (move || { let r = if kind == "store.put" { match data { Some(d) => store::put(&dir, &project, &d).map(|_| None), None => Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "no data")) } } else { store::get(&dir, &project) };
                let reply = match r { Ok(d) => serde_json::json!({ "type": kind, "id": id, "ok": true, "data": d }), Err(e) => serde_json::json!({ "type": kind, "id": id, "ok": false, "error": e.to_string() }) }; let _ = tx.send(reply.to_string()); })();
        }
        Some("project.write") => { // the git-friendly copy inside a folder the user allowed (picked or SWIFT_PROJECT_ROOTS): <folder>/.swift-canvas/project.json
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let path = v.get("path").and_then(|x| x.as_str()).unwrap_or("").to_string(); let data = v.get("data").and_then(|x| x.as_str()).unwrap_or("").to_string();
            let (tx, mut roots) = (tx.clone(), cfg.project_roots.clone()); roots.extend(picked.lock().map(|p| p.clone()).unwrap_or_default());
            thread::spawn(move || { let reply = match scan::allowed_root(std::path::Path::new(&path), &roots) {
                None => serde_json::json!({ "type": "project.write", "id": id, "ok": false, "error": "folder not allowed: pick it with Choose… first" }),
                Some(p) => match store::put_in_repo(&p, &data) { Ok(f) => serde_json::json!({ "type": "project.write", "id": id, "ok": true, "path": f.to_string_lossy() }), Err(e) => serde_json::json!({ "type": "project.write", "id": id, "ok": false, "error": e.to_string() }) } };
                let _ = tx.send(reply.to_string()); });
        }
        Some(kind @ ("repo.plan" | "repo.export")) => { // a branch in a folder the user allowed: plan = preview, export = commit on a NEW branch (never the current one, never over uncommitted work)
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let kind = kind.to_string(); let path = v.get("path").and_then(|x| x.as_str()).unwrap_or("").to_string(); let name = v.get("name").and_then(|x| x.as_str()).unwrap_or("export").chars().take(60).collect::<String>();
            let files: Vec<(String, String)> = v.get("files").and_then(|x| x.as_array()).map(|a| a.iter().filter_map(|f| Some((f.get("path")?.as_str()?.to_string(), f.get("content")?.as_str()?.to_string()))).take(200).collect()).unwrap_or_default();
            let (tx, mut roots) = (tx.clone(), cfg.project_roots.clone()); roots.extend(picked.lock().map(|p| p.clone()).unwrap_or_default());
            thread::spawn(move || { let reply = match scan::allowed_root(std::path::Path::new(&path), &roots) {
                None => serde_json::json!({ "type": kind, "id": id, "ok": false, "error": "folder not allowed: pick it with Choose… first" }),
                Some(p) => if kind == "repo.plan" { match repo::plan(&p, &name, &files) { Ok(pl) => serde_json::json!({ "type": kind, "id": id, "ok": true, "branch": pl.branch, "entries": pl.entries.iter().map(|e| serde_json::json!({ "path": e.path, "status": e.status })).collect::<Vec<_>>() }), Err(e) => serde_json::json!({ "type": kind, "id": id, "ok": false, "error": e.to_string() }) } }
                    else { match repo::export(&p, &name, &files) { Ok(b) => serde_json::json!({ "type": kind, "id": id, "ok": true, "branch": b }), Err(e) => serde_json::json!({ "type": kind, "id": id, "ok": false, "error": e.to_string() }) } } };
                let _ = tx.send(reply.to_string()); });
        }
        Some("render.mp4") => { // Motion export: the app sends one standalone document per time step; Chrome rasterizes them, ffmpeg encodes (see render.rs)
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let n = |k: &str, d: u64| v.get(k).and_then(|x| x.as_u64()).unwrap_or(d) as u32;
            let job = render::Job { w: n("w", 0), h: n("h", 0), fps: n("fps", 0), docs: v.get("docs").and_then(|x| x.as_array()).map(|a| a.iter().filter_map(|d| d.as_str().map(String::from)).collect()).unwrap_or_default() };
            let tx = tx.clone(); let (chrome, ffmpeg) = (std::env::var("SWIFT_CHROME_BIN").ok().filter(|b| !b.is_empty()).unwrap_or_else(|| "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".to_string()), std::env::var("SWIFT_FFMPEG_BIN").ok().filter(|b| !b.is_empty()).unwrap_or_else(|| "ffmpeg".to_string()));
            let key = format!("{cid}:{id}"); let flag = render::register(&key); let ptx = tx.clone(); let pid = id.clone(); let ctl = render::Ctl { cancel: flag, on_frame: Box::new(move |done, total| { let _ = ptx.send(serde_json::json!({ "type": "render.progress", "id": pid, "done": done, "total": total }).to_string()); }) };
            thread::spawn(move || { let t0 = std::time::Instant::now(); let r = if std::env::var("SWIFT_RENDER_SLOW").is_ok() { render::render_ctl(&chrome, &ffmpeg, &job, 4, &ctl) } else { render::render_cdp_ctl(&chrome, &ffmpeg, &job, &ctl) }; render::finish(&key); let reply = match r { Ok(b) => serde_json::json!({ "type": "render.mp4", "id": id, "ok": true, "mp4": render::b64(&b), "bytes": b.len(), "ms": t0.elapsed().as_millis() as u64 }), Err(e) => serde_json::json!({ "type": "render.mp4", "id": id, "ok": false, "error": e }) }; let _ = tx.send(reply.to_string()); });
        }
        Some("render.cancel") => { let id = v.get("id").and_then(|x| x.as_str()).unwrap_or(""); render::cancel(&format!("{cid}:{id}")); }
        Some("crew.read") => { // the project's crew sheets from a folder the user allowed (picked or SWIFT_PROJECT_ROOTS)
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let path = v.get("path").and_then(|x| x.as_str()).unwrap_or("").to_string();
            let (tx, mut roots) = (tx.clone(), cfg.project_roots.clone()); roots.extend(picked.lock().map(|p| p.clone()).unwrap_or_default());
            thread::spawn(move || { let reply = match scan::allowed_root(std::path::Path::new(&path), &roots) {
                None => serde_json::json!({ "type": "crew.read", "id": id, "ok": false, "error": "folder not allowed: pick it with Choose… first" }),
                Some(p) => match store::read_crew(&p) { Ok(f) => serde_json::json!({ "type": "crew.read", "id": id, "ok": true, "files": f.iter().map(|(n, t)| serde_json::json!({ "name": n, "text": t })).collect::<Vec<_>>() }), Err(e) => serde_json::json!({ "type": "crew.read", "id": id, "ok": false, "error": e.to_string() }) } };
                let _ = tx.send(reply.to_string()); });
        }
        Some("project.pick") => {
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let (tx, bin, picked) = (tx.clone(), cfg.picker_bin.clone(), picked.clone());
            thread::spawn(move || { let reply = match pick_folder(&bin) { Ok(p) => { if let Ok(c) = std::fs::canonicalize(&p) { if let Ok(mut g) = picked.lock() { if g.len() < 50 && !g.contains(&c) { g.push(c); } } } serde_json::json!({ "type": "project.pick", "id": id, "ok": true, "path": p }) }, Err(e) => serde_json::json!({ "type": "project.pick", "id": id, "ok": false, "error": e }) }; let _ = tx.send(reply.to_string()); });
        }
        Some("capture.url") => { // a RUNNING localhost page -> static HTML (Chrome renders it; see capture.rs). Never any other host.
            let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); let url = v.get("url").and_then(|x| x.as_str()).unwrap_or("").to_string(); let tx = tx.clone(); let size = capture::clamp_size(v.get("w").and_then(|x| x.as_u64()), v.get("h").and_then(|x| x.as_u64()));
            thread::spawn(move || { let reply = match capture::capture(&url, size) { Ok(html) => serde_json::json!({ "type": "capture.url", "id": id, "ok": true, "html": html }), Err(e) => serde_json::json!({ "type": "capture.url", "id": id, "ok": false, "error": e }) }; let _ = tx.send(reply.to_string()); });
        }
        Some("pool.status") => { let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").chars().take(64).collect::<String>(); // for the Pulse board: how many Says run, is a warm spare parked, memory left
            let _ = tx.send(serde_json::json!({ "type": "pool.status", "id": id, "running": busy.load(Ordering::SeqCst), "max": say::MAX_CONCURRENT, "spare": pool.has_spare(), "availableMb": mem::available_mb(), "minFreeMb": cfg.min_free_mb }).to_string()); }
        Some("claude.status") => { let (tx, shared) = (tx.clone(), shared.clone()); thread::spawn(move || { let s = shared.refresh(true); let _ = tx.send(s.event()); }); }
        Some("prewarm") => { let pool = pool.clone(); thread::spawn(move || pool.prewarm()); }
        Some("say") => {
            let (Some(id), Some(system), Some(request)) = (v.get("id").and_then(|x| x.as_str()), v.get("system").and_then(|x| x.as_str()), v.get("request").and_then(|x| x.as_str())) else { return };
            let id = id.chars().take(64).collect::<String>(); let ev = move |kind: &str, text: &str| serde_json::json!({ "type": "say.event", "id": id, "kind": kind, "text": text }).to_string();
            let images = match say::parse_images(v.get("images")) { Ok(i) => i, Err(e) => { let _ = tx.send(ev("error", &e)); return; } }; // a bad image is an error event, never a silent drop
            if let Err(e) = mem::check(cfg.min_free_mb, mem::available_mb()) { let _ = tx.send(ev("error", &e)); return; }
            if busy.fetch_add(1, Ordering::SeqCst) >= say::MAX_CONCURRENT { busy.fetch_sub(1, Ordering::SeqCst); let _ = tx.send(ev("error", "too many Says at once")); return; }
            let (tx, busy, pool, system, request, shared) = (tx.clone(), busy.clone(), pool.clone(), system.to_string(), request.to_string(), shared.clone());
            thread::spawn(move || { let mut held = true; let release = |held: &mut bool| { if *held { *held = false; busy.fetch_sub(1, Ordering::SeqCst); } }; // the slot frees when the answer is sent, not when claude finishes exiting: the app starts its next Say the moment it sees done
                say::run_say_images(&pool, &system, &request, &images, |o| { if matches!(o, say::Out::Done(_) | say::Out::Error(_)) { release(&mut held); } let _ = tx.send(match o { say::Out::Delta(t) => ev("delta", &t), say::Out::Done(u) => { shared.say_ok(); let mut m: serde_json::Value = serde_json::from_str(&ev("done", "")).unwrap(); if let Some(u) = u { m["usage"] = u; } m.to_string() } say::Out::Error(e) => { if status::is_limit(&e) { shared.limit_reached(&e); } else { let sh = shared.clone(); thread::spawn(move || { sh.refresh(false); }); } ev("error", &e) } }); }); release(&mut held); pool.prewarm(); });
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn origin_exact_match_only() {
        let a = vec!["chrome-extension://abc".to_string()];
        assert!(origin_allowed("chrome-extension://abc", &a)); assert!(!origin_allowed("chrome-extension://abcd", &a)); assert!(!origin_allowed("", &a)); assert!(!origin_allowed("http://evil.test", &a));
        assert!(!origin_allowed("chrome-extension://abc", &[]));
    }
    #[test] fn token_compare() { assert!(token_ok("s3cret", "s3cret")); assert!(!token_ok("s3cret!", "s3cret")); assert!(!token_ok("", "")); assert!(!token_ok("x", "")); }
    #[test] fn query_parsing() { assert_eq!(query_param("a=1&token=a%20b+c", "token").as_deref(), Some("a b c")); assert_eq!(query_param("a=1", "token"), None); assert_eq!(query_param("token=%zz", "token").as_deref(), Some("%zz")); }
    #[test] fn config_defaults_are_closed() {
        let c = config_from(|_| None, || "rnd".into()); assert!(c.allowed.is_empty()); assert_eq!(c.token, "rnd"); assert_eq!(c.port, DEFAULT_PORT);
        let d = config_from(|k| (k == "SWIFT_DEV").then(|| "1".to_string()), || "rnd".into()); assert_eq!(d.allowed, vec![DEV_ORIGIN.to_string()]); assert_eq!(d.token, "dev-token"); let t = config_from(|k| match k { "SWIFT_DEV" => Some("1".into()), "SWIFT_DEV_ORIGIN" => Some("http://localhost:5273".into()), _ => None }, || "rnd".into()); assert_eq!(t.allowed, vec!["http://localhost:5273".to_string()], "a test helper allows its own dev page"); let bad = config_from(|k| match k { "SWIFT_DEV" => Some("1".into()), "SWIFT_DEV_ORIGIN" => Some("https://evil.example".into()), _ => None }, || "rnd".into()); assert_eq!(bad.allowed, vec![DEV_ORIGIN.to_string()], "a non-local dev origin is ignored");
        let e = config_from(|k| (k == "SWIFT_ALLOWED_ORIGINS").then(|| "chrome-extension://a, chrome-extension://b".to_string()), || "rnd".into()); assert_eq!(e.allowed.len(), 2);
    }
}
