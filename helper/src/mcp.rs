//! In-app MCP server of design ops (task #1712). `swift-canvas-helper mcp` speaks MCP (JSON-RPC 2.0 over stdio, protocol 2024-11-05) to a Claude Code
//! session and forwards each tool call over the helper's authenticated localhost WebSocket; the running helper validates + dry-runs ops with the core
//! crate and relays them to the app, which applies a whole batch as ONE undo step. Never used by the Say hot path.
use serde_json::{json, Value};
use std::{collections::HashMap, io::{BufRead, Write}, sync::{mpsc, Mutex}, time::Duration};
use swift_canvas_core::{dry_run, FlatNode, Op, Tree, MAX_OPS};

pub const PROTOCOL: &str = "2024-11-05";
pub const MAX_LINE: usize = 1 << 20; // one JSON-RPC message
pub const MAX_ARGS: usize = 256 * 1024; // tool arguments
pub const TOKEN_FILE: &str = "mcp.json";
pub const EXPORT_TARGETS: [&str; 4] = ["html", "react", "tokens", "project"];
pub const MAX_SHOT: usize = 8 * 1024 * 1024; // PNG bytes handed back over the WebSocket

/// Whatever executes a tool call (the WebSocket client in production, a fake in tests).
pub trait Backend { fn call(&mut self, tool: &str, args: Value) -> Result<Value, String>; }

pub fn tools() -> Value {
    let frame = json!({ "type": "string", "description": "Frame id (default: the selected frame, else the first)." });
    json!([
        { "name": "read_subtree", "description": "Read the element tree of the open Swift Canvas design: ids, tags, text, plus the outer HTML and computed values of one element. Defaults to the selected element (else the frame root). Call this first to learn the element ids.",
          "inputSchema": { "type": "object", "properties": { "frame": frame, "el": { "type": "string", "description": "Element id (default: the selected element, else the frame root)." }, "props": { "type": "array", "items": { "type": "string" }, "description": "CSS properties whose computed values to return for el, e.g. [\"font-size\"]." } } } },
        { "name": "apply_ops", "description": "Apply a BATCH of design ops in one call (max 200). Ops are validated and dry-run first (nothing is applied if any op is bad); the whole batch is ONE undo step in the app. Op forms: {\"op\":\"set\",\"id\":\"clock\",\"prop\":\"font-size\",\"value\":\"300px\"}, {\"op\":\"token\",\"name\":\"--ac\",\"value\":\"#0a84ff\"}, {\"op\":\"text\",\"id\":\"title\",\"value\":\"Hello\"}, {\"op\":\"add\",\"parent\":\"card\",\"id\":\"badge\",\"html\":\"<span>new</span>\"}, {\"op\":\"remove\",\"id\":\"badge\"}. Values max 200 chars, html max 4000, no script/on*=/javascript:.",
          "inputSchema": { "type": "object", "required": ["ops"], "properties": { "frame": frame, "ops": { "type": "array", "minItems": 1, "maxItems": MAX_OPS, "items": { "type": "object", "required": ["op"], "properties": { "op": { "type": "string", "enum": ["set", "token", "text", "add", "remove"] }, "id": { "type": "string" }, "prop": { "type": "string" }, "name": { "type": "string" }, "value": { "type": "string" }, "parent": { "type": "string" }, "html": { "type": "string" } } } } } } },
        { "name": "set_token", "description": "Set one design token (a CSS custom property such as --ac) on a frame root. One undo step.",
          "inputSchema": { "type": "object", "required": ["name", "value"], "properties": { "frame": frame, "name": { "type": "string", "description": "e.g. --ac" }, "value": { "type": "string" } } } },
        { "name": "artifact_page", "description": "Build the open Swift Canvas project as ONE self-contained HTML page (a tab per frame, each frame in a sandboxed script-free iframe, light and dark) and return it as `html` with `title`, `frames` and `bytes`. To publish it as a Claude artifact, write `html` to a file and pass that file to your Artifact tool (pass the project's previous artifact `url` to update it in place). Max 2 MB and 24 frames; pass `frames` (ids) to pick some. Read-only: nothing in the design changes.",
          "inputSchema": { "type": "object", "properties": { "frames": { "type": "array", "items": { "type": "string" }, "maxItems": 24, "description": "Frame ids to include (default: all)." } } } },
        { "name": "list_frames", "description": "List the frames of a Swift Canvas project: id, name, size and lens (tv, phone or desktop). With no `project` it asks the open app (live, includes the selected frame); with no app open it lists the saved projects instead. With `project` (a project id from that list) it reads the saved file: no app needed. Read-only.",
          "inputSchema": { "type": "object", "properties": { "project": { "type": "string", "description": "Saved project id (default: the open project in the app)." } } } },
        { "name": "check", "description": "Run Critique on one frame and return numbered findings, each with the element id (`el`), a kind, a message and, when there is one, a safe CSS `fix` {prop,value} you can pass to apply_ops. Local checks (contrast, safe area, clipping, tap size, legibility) always run; set `judge` true to also ask Claude about hierarchy, spacing and copy (slower, up to a minute). Needs the app open. Read-only: nothing changes until you apply a fix.",
          "inputSchema": { "type": "object", "properties": { "frame": frame, "judge": { "type": "boolean", "description": "Also ask Claude for design-judgment findings (default false)." } } } },
        { "name": "screenshot", "description": "A PNG screenshot of one frame (returned as an image). With `project` it renders the saved project file with the helper's Chrome: no app needed. Otherwise it shoots the live frame from the open app. Use it after apply_ops to confirm a fix. Read-only.",
          "inputSchema": { "type": "object", "properties": { "frame": frame, "project": { "type": "string", "description": "Saved project id (default: the open project in the app)." } } } },
        { "name": "export", "description": "Export a frame or the project through the same paths as the app's Ship board. Targets: html (frame page), react (frame as React + Tailwind), tokens (design tokens, DTCG JSON), project (the project file). Without `confirm` you get a PREVIEW only (name, size, first lines); call again with confirm true to receive the full content (max 1 MB). Nothing is written to disk. Needs the app open.",
          "inputSchema": { "type": "object", "required": ["target"], "properties": { "frame": frame, "target": { "type": "string", "enum": EXPORT_TARGETS }, "confirm": { "type": "boolean", "description": "true = return the full content, not just the preview." } } } },
        { "name": "undo", "description": "Undo the last step in the app (the same as the Undo button): an apply_ops batch is one step.",
          "inputSchema": { "type": "object", "properties": {} } }
    ])
}

fn rpc_err(id: &Value, code: i64, msg: &str) -> Value { json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": msg } }) }
/// Handle one JSON-RPC message; None for notifications (no reply).
pub fn handle(msg: &Value, backend: &mut dyn Backend) -> Option<Value> {
    let id = msg.get("id").cloned();
    let Some(method) = msg.get("method").and_then(|m| m.as_str()) else { return id.map(|i| rpc_err(&i, -32600, "invalid request")); };
    let Some(id) = id else { return None }; // notification (e.g. notifications/initialized)
    let ok = |r: Value| Some(json!({ "jsonrpc": "2.0", "id": id, "result": r }));
    match method {
        "initialize" => ok(json!({ "protocolVersion": PROTOCOL, "capabilities": { "tools": {} }, "serverInfo": { "name": "swift-canvas", "version": env!("CARGO_PKG_VERSION") } })),
        "ping" => ok(json!({})),
        "tools/list" => ok(json!({ "tools": tools() })),
        "tools/call" => {
            let p = msg.get("params").cloned().unwrap_or(Value::Null); let Some(name) = p.get("name").and_then(|n| n.as_str()) else { return Some(rpc_err(&id, -32602, "missing tool name")) };
            if !tools().as_array().unwrap().iter().any(|t| t["name"] == name) { return Some(rpc_err(&id, -32602, &format!("unknown tool {name}"))); }
            let args = p.get("arguments").cloned().unwrap_or_else(|| json!({}));
            if args.to_string().len() > MAX_ARGS { return ok(json!({ "isError": true, "content": [{ "type": "text", "text": "arguments too large (max 256 KB)" }] })); }
            match backend.call(name, args) {
                Ok(mut v) => { // a result with `_image` {mimeType, data} becomes an MCP image block next to its text
                    let img = v.as_object_mut().and_then(|m| m.remove("_image"));
                    let mut content = vec![json!({ "type": "text", "text": v.to_string() })];
                    if let Some(i) = img { content.push(json!({ "type": "image", "data": i["data"], "mimeType": i["mimeType"] })); }
                    ok(json!({ "content": content }))
                }
                Err(e) => ok(json!({ "isError": true, "content": [{ "type": "text", "text": e }] })),
            }
        }
        _ => Some(rpc_err(&id, -32601, &format!("method not found: {method}"))),
    }
}

/// The stdio loop: one JSON message per line. Bad JSON gets a parse error reply, an oversized line is refused, nothing is silently dropped.
pub fn serve_stdio<R: BufRead, W: Write>(r: R, mut w: W, backend: &mut dyn Backend) -> std::io::Result<()> {
    for line in r.lines() {
        let line = line?; if line.trim().is_empty() { continue; }
        let reply = if line.len() > MAX_LINE { Some(rpc_err(&Value::Null, -32600, "message too large")) } else {
            match serde_json::from_str::<Value>(&line) { Ok(v) => handle(&v, backend), Err(e) => Some(rpc_err(&Value::Null, -32700, &format!("parse error: {e}"))) } };
        if let Some(r) = reply { writeln!(w, "{r}")?; w.flush()?; }
    }
    Ok(())
}

// ---------------------------------------------------------------- the helper side: relay to the app
/// The app connection (the app is a WebSocket client) and the calls waiting for its answer.
#[derive(Default)]
pub struct Hub { app: Mutex<Option<(usize, mpsc::Sender<String>)>>, waiting: Mutex<HashMap<String, mpsc::Sender<Value>>>, next: std::sync::atomic::AtomicUsize }
impl Hub {
    pub fn register_app(&self, cid: usize, tx: mpsc::Sender<String>) { *self.app.lock().unwrap() = Some((cid, tx)); }
    pub fn unregister_app(&self, cid: usize) { let mut g = self.app.lock().unwrap(); if g.as_ref().map(|a| a.0) == Some(cid) { *g = None; } }
    /// The app's answer to a relayed request.
    pub fn deliver(&self, id: &str, v: Value) { if let Some(t) = self.waiting.lock().unwrap().remove(id) { let _ = t.send(v); } }
    pub fn has_app(&self) -> bool { self.app.lock().unwrap().is_some() }
    pub fn ask_app(&self, tool: &str, args: Value, wait: Duration) -> Result<Value, String> {
        let tx = self.app.lock().unwrap().as_ref().map(|a| a.1.clone()).ok_or("no Swift Canvas app is connected to the helper: open the app first")?;
        let id = format!("m{}", self.next.fetch_add(1, std::sync::atomic::Ordering::SeqCst)); let (rtx, rrx) = mpsc::channel(); self.waiting.lock().unwrap().insert(id.clone(), rtx);
        if tx.send(json!({ "type": "mcp.req", "id": id, "tool": tool, "args": args }).to_string()).is_err() { self.waiting.lock().unwrap().remove(&id); return Err("the app disconnected".into()); }
        match rrx.recv_timeout(wait) { Ok(v) => if v["ok"] == true { Ok(v.get("result").cloned().unwrap_or(Value::Null)) } else { Err(v["error"].as_str().unwrap_or("the app reported an error").to_string()) },
            Err(_) => { self.waiting.lock().unwrap().remove(&id); Err("the app did not answer in time".into()) } }
    }
}
const WAIT: Duration = Duration::from_secs(15);

/// What a tool may use besides the app: the project files and the browser. `chrome` is an executable that can `--screenshot`.
pub struct Ctx { pub data_dir: std::path::PathBuf, pub chrome: String }
const WAIT_CHECK: Duration = Duration::from_secs(55); // a Claude critique, still inside the MCP process's 60 s read timeout

/// Execute one tool call from an MCP process: validate and dry-run with the core crate, then relay. `list_frames` and `screenshot` of a saved project run here, with no app.
pub fn run_tool(hub: &Hub, ctx: &Ctx, tool: &str, args: &Value) -> Result<Value, String> {
    let frame = args.get("frame").cloned().filter(|f| f.is_string());
    let with_frame = |mut a: Value| { if let Some(f) = &frame { a["frame"] = f.clone(); } a };
    match tool {
        "read_subtree" => hub.ask_app("read_subtree", args.clone(), WAIT),
        "undo" => hub.ask_app("undo", json!({}), WAIT),
        "artifact_page" => hub.ask_app("artifact_page", json!({ "frames": args.get("frames").cloned().filter(|f| f.is_array()) }), WAIT),
        "set_token" => { let ops = json!([{ "op": "token", "name": args.get("name"), "value": args.get("value") }]); apply(hub, &with_frame(json!({ "ops": ops }))) }
        "apply_ops" => apply(hub, args),
        "list_frames" => list_frames(hub, ctx, args),
        "screenshot" => screenshot(hub, ctx, args),
        "check" => { let judge = opt_bool(args, "judge")?; check_frame_arg(args)?; hub.ask_app("check", with_frame(json!({ "judge": judge })), WAIT_CHECK) }
        "export" => {
            let target = args.get("target").and_then(|t| t.as_str()).ok_or("target must be a string")?;
            if !EXPORT_TARGETS.contains(&target) { return Err(format!("unknown export target {target:?} (one of: {}; use artifact_page for the artifact page)", EXPORT_TARGETS.join(", "))); }
            check_frame_arg(args)?; let confirm = opt_bool(args, "confirm")?;
            hub.ask_app("export", with_frame(json!({ "target": target, "confirm": confirm })), WAIT)
        }
        _ => Err(format!("unknown tool {tool}")),
    }
}
fn opt_bool(args: &Value, k: &str) -> Result<bool, String> { match args.get(k) { None | Some(Value::Null) => Ok(false), Some(Value::Bool(b)) => Ok(*b), Some(_) => Err(format!("{k} must be true or false")) } }
fn check_frame_arg(args: &Value) -> Result<(), String> { match args.get("frame") { None | Some(Value::Null) | Some(Value::String(_)) => Ok(()), Some(_) => Err("frame must be a string".into()) } }
fn project_arg(args: &Value) -> Result<Option<&str>, String> {
    match args.get("project") { None | Some(Value::Null) => Ok(None), Some(Value::String(p)) if crate::store::valid_id(p) => Ok(Some(p)), Some(Value::String(p)) => Err(format!("bad project id {p:?} (lowercase letters, digits and dashes)")), Some(_) => Err("project must be a string".into()) }
}
/// The frames array of a saved project file (id, title, w, h, html), or why it cannot be read.
fn saved_frames(ctx: &Ctx, project: &str) -> Result<Vec<Value>, String> {
    let raw = crate::store::get(&ctx.data_dir, project).map_err(|e| format!("cannot read project {project}: {e}"))?.ok_or_else(|| format!("no saved project {project:?} (call list_frames with no arguments to see the saved projects)"))?;
    let v: Value = serde_json::from_str(&raw).map_err(|e| format!("project {project} is not valid JSON: {e}"))?;
    v.get("frames").and_then(|f| f.as_array()).cloned().ok_or_else(|| format!("project {project} has no frames"))
}
fn lens(w: f64, id: &str) -> &'static str { // the same rule as the app's surfaceOf: preset prefix `<kind>-<n>`, else by width
    if let Some((k, n)) = id.rsplit_once('-') { if !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) { match k { "phone" => return "phone", "desktop" | "browser" | "popup" | "email" => return "desktop", "tv" => return "tv", _ => {} } } }
    if w >= 1600.0 { "tv" } else if w <= 500.0 { "phone" } else { "desktop" }
}
fn list_frames(hub: &Hub, ctx: &Ctx, args: &Value) -> Result<Value, String> {
    if let Some(p) = project_arg(args)? {
        let fr = saved_frames(ctx, p)?;
        let list: Vec<Value> = fr.iter().map(|f| { let (w, h) = (f["w"].as_f64().unwrap_or(0.0), f["h"].as_f64().unwrap_or(0.0)); let id = f["id"].as_str().unwrap_or(""); json!({ "id": id, "name": f["title"], "w": w, "h": h, "lens": lens(w, id) }) }).collect();
        return Ok(json!({ "source": "saved project", "project": p, "frames": list }));
    }
    if hub.has_app() { return hub.ask_app("list_frames", json!({}), WAIT); }
    // no app: the saved projects, with their frame counts
    let rd = std::fs::read_dir(&ctx.data_dir).map_err(|e| format!("no Swift Canvas app is connected to the helper (open the app), and the saved projects cannot be read from {}: {e}", ctx.data_dir.display()))?;
    let mut names: Vec<String> = rd.filter_map(|e| e.ok()).filter_map(|e| e.file_name().into_string().ok()).filter_map(|n| n.strip_suffix(".project.json").map(str::to_string)).filter(|n| crate::store::valid_id(n)).collect(); names.sort();
    let projects: Vec<Value> = names.iter().map(|n| match saved_frames(ctx, n) { Ok(f) => json!({ "project": n, "frames": f.len() }), Err(e) => json!({ "project": n, "error": e }) }).collect();
    Ok(json!({ "source": "saved projects (no app is open: pass `project` to list one project's frames)", "projects": projects }))
}
/// One frame's HTML -> PNG with the helper's Chrome, as an MCP image block.
pub fn png_of(chrome: &str, html: &str, w: u32, h: u32) -> Result<Vec<u8>, String> {
    if !(160..=3840).contains(&w) || !(160..=2160).contains(&h) { return Err(format!("frame size {w}x{h} is outside 160-3840 x 160-2160")); }
    if html.len() > crate::render::MAX_DOC { return Err("the frame is too large to screenshot (max 2 MB of HTML)".into()); }
    let dir = crate::render::workdir()?;
    let out = (|| { let doc = dir.join("f.html"); let png = dir.join("f.png"); std::fs::write(&doc, format!("{}{html}", crate::render::CSP)).map_err(|e| e.to_string())?; crate::render::shot(chrome, &doc, &png, w, h)?; std::fs::read(&png).map_err(|e| e.to_string()) })();
    let _ = std::fs::remove_dir_all(&dir); out
}
fn screenshot(hub: &Hub, ctx: &Ctx, args: &Value) -> Result<Value, String> {
    check_frame_arg(args)?;
    let (id, w, h, html) = if let Some(p) = project_arg(args)? {
        let fr = saved_frames(ctx, p)?; let want = args.get("frame").and_then(|f| f.as_str());
        let f = match want { Some(w) => fr.iter().find(|f| f["id"] == w).ok_or_else(|| format!("unknown frame {w:?} in project {p} (frames: {})", fr.iter().filter_map(|f| f["id"].as_str()).collect::<Vec<_>>().join(", ")))?, None => fr.first().ok_or("the project has no frames")? };
        (f["id"].as_str().unwrap_or("").to_string(), f["w"].as_f64().unwrap_or(0.0), f["h"].as_f64().unwrap_or(0.0), f["html"].as_str().unwrap_or("").to_string())
    } else {
        let mut a = json!({}); if let Some(f) = args.get("frame").filter(|f| f.is_string()) { a["frame"] = f.clone(); }
        let r = hub.ask_app("frame_html", a, WAIT)?;
        (r["frame"].as_str().ok_or("the app sent no frame id")?.to_string(), r["w"].as_f64().unwrap_or(0.0), r["h"].as_f64().unwrap_or(0.0), r["html"].as_str().ok_or("the app sent no frame html")?.to_string())
    };
    let png = png_of(&ctx.chrome, &html, w.round() as u32, h.round() as u32)?;
    if png.len() > MAX_SHOT { return Err(format!("the screenshot is {} bytes (max {MAX_SHOT})", png.len())); }
    Ok(json!({ "frame": id, "w": w, "h": h, "bytes": png.len(), "_image": { "mimeType": "image/png", "data": crate::render::b64(&png) } }))
}
fn apply(hub: &Hub, args: &Value) -> Result<Value, String> {
    let raw = args.get("ops").and_then(|o| o.as_array()).ok_or("ops must be an array")?;
    if raw.is_empty() { return Err("ops is empty".into()); } if raw.len() > MAX_OPS { return Err(format!("too many ops ({}; max {MAX_OPS})", raw.len())); }
    let mut ops = Vec::with_capacity(raw.len());
    for (i, o) in raw.iter().enumerate() { match serde_json::from_value::<Op>(o.clone()) { Ok(op) => ops.push(op), Err(e) => return Err(format!("op {i}: {e}")) } }
    for (i, o) in ops.iter().enumerate() { swift_canvas_core::validate_external(o).map_err(|e| format!("op {i}: {e}"))?; }
    let frame = args.get("frame").cloned().filter(|f| f.is_string());
    let fa = |extra: Value| { let mut a = extra; if let Some(f) = &frame { a["frame"] = f.clone(); } a };
    let t = hub.ask_app("tree", fa(json!({})), WAIT)?; // the dry run needs the live element list
    let flat: Vec<FlatNode> = serde_json::from_value(t.get("tree").cloned().unwrap_or(Value::Null)).map_err(|e| format!("bad tree from the app: {e}"))?;
    let tree = Tree::from_flat(&flat).map_err(|e| e.to_string())?;
    let frame_id = t.get("frame").cloned().unwrap_or(Value::Null);
    dry_run(&tree, &ops).map_err(|(i, e)| format!("dry run failed at op {i}: {e} (nothing was applied)"))?;
    let mut r = hub.ask_app("apply_ops", json!({ "frame": frame_id, "ops": ops }), WAIT)?; if let Value::Object(m) = &mut r { m.insert("dryRun".into(), json!("ok")); } Ok(r)
}

// ---------------------------------------------------------------- the MCP process: WebSocket client of the running helper
pub struct WsBackend { data_dir: std::path::PathBuf, ws: Option<tungstenite::WebSocket<std::net::TcpStream>>, n: usize }
impl WsBackend {
    pub fn new(data_dir: std::path::PathBuf) -> Self { WsBackend { data_dir, ws: None, n: 0 } }
    fn connect(&self) -> Result<tungstenite::WebSocket<std::net::TcpStream>, String> {
        let p = self.data_dir.join(TOKEN_FILE); let raw = std::fs::read_to_string(&p).map_err(|e| format!("cannot read {} ({e}): is the Swift Canvas helper running?", p.display()))?;
        let v: Value = serde_json::from_str(&raw).map_err(|e| format!("bad {}: {e}", p.display()))?; let port = v["port"].as_u64().ok_or("no port in the token file")?; let token = v["token"].as_str().ok_or("no token in the token file")?;
        let s = std::net::TcpStream::connect_timeout(&std::net::SocketAddr::from(([127, 0, 0, 1], port as u16)), Duration::from_secs(3)).map_err(|e| format!("helper not reachable on 127.0.0.1:{port} ({e}): start it with `swift-canvas-helper`"))?;
        s.set_read_timeout(Some(Duration::from_secs(60))).ok();
        let url = format!("ws://127.0.0.1:{port}/?token={token}&role=mcp"); let (ws, _) = tungstenite::client(url.as_str(), s).map_err(|e| format!("helper refused the connection: {e}"))?; Ok(ws)
    }
}
impl Backend for WsBackend {
    fn call(&mut self, tool: &str, args: Value) -> Result<Value, String> {
        for attempt in 0..2 {
            if self.ws.is_none() { self.ws = Some(self.connect()?); }
            self.n += 1; let id = format!("c{}", self.n); let ws = self.ws.as_mut().unwrap();
            if ws.send(tungstenite::Message::text(json!({ "type": "mcp.call", "id": id, "tool": tool, "args": args }).to_string())).is_err() { self.ws = None; if attempt == 0 { continue; } return Err("lost the helper connection".into()); }
            loop {
                match ws.read() {
                    Ok(tungstenite::Message::Text(t)) => { let Ok(v) = serde_json::from_str::<Value>(t.as_str()) else { continue }; if v["type"] == "mcp.result" && v["id"] == id { return if v["ok"] == true { Ok(v["result"].clone()) } else { Err(v["error"].as_str().unwrap_or("failed").to_string()) }; } }
                    Ok(_) => {}
                    Err(e) => { self.ws = None; return Err(format!("lost the helper connection: {e}")); }
                }
            }
        }
        Err("lost the helper connection".into())
    }
}
/// Write `<data_dir>/mcp.json` ({port, token}) readable only by the user (0600): the MCP subcommand's way in, with no browser Origin.
pub fn write_token_file(data_dir: &std::path::Path, port: u16, token: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(data_dir)?; let p = data_dir.join(TOKEN_FILE); let tmp = data_dir.join("mcp.json.tmp");
    #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; let mut f = std::fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(&tmp)?; f.write_all(json!({ "port": port, "token": token }).to_string().as_bytes())?; }
    #[cfg(not(unix))] std::fs::write(&tmp, json!({ "port": port, "token": token }).to_string())?;
    std::fs::rename(tmp, p)
}
