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
                Ok(v) => ok(json!({ "content": [{ "type": "text", "text": v.to_string() }] })),
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
    pub fn ask_app(&self, tool: &str, args: Value, wait: Duration) -> Result<Value, String> {
        let tx = self.app.lock().unwrap().as_ref().map(|a| a.1.clone()).ok_or("no Swift Canvas app is connected to the helper: open the app first")?;
        let id = format!("m{}", self.next.fetch_add(1, std::sync::atomic::Ordering::SeqCst)); let (rtx, rrx) = mpsc::channel(); self.waiting.lock().unwrap().insert(id.clone(), rtx);
        if tx.send(json!({ "type": "mcp.req", "id": id, "tool": tool, "args": args }).to_string()).is_err() { self.waiting.lock().unwrap().remove(&id); return Err("the app disconnected".into()); }
        match rrx.recv_timeout(wait) { Ok(v) => if v["ok"] == true { Ok(v.get("result").cloned().unwrap_or(Value::Null)) } else { Err(v["error"].as_str().unwrap_or("the app reported an error").to_string()) },
            Err(_) => { self.waiting.lock().unwrap().remove(&id); Err("the app did not answer in time".into()) } }
    }
}
const WAIT: Duration = Duration::from_secs(15);

/// Execute one tool call from an MCP process: validate and dry-run with the core crate, then relay.
pub fn run_tool(hub: &Hub, tool: &str, args: &Value) -> Result<Value, String> {
    let frame = args.get("frame").cloned().filter(|f| f.is_string());
    let with_frame = |mut a: Value| { if let Some(f) = &frame { a["frame"] = f.clone(); } a };
    match tool {
        "read_subtree" => hub.ask_app("read_subtree", args.clone(), WAIT),
        "undo" => hub.ask_app("undo", json!({}), WAIT),
        "artifact_page" => hub.ask_app("artifact_page", json!({ "frames": args.get("frames").cloned().filter(|f| f.is_array()) }), WAIT),
        "set_token" => { let ops = json!([{ "op": "token", "name": args.get("name"), "value": args.get("value") }]); apply(hub, &with_frame(json!({ "ops": ops }))) }
        "apply_ops" => apply(hub, args),
        _ => Err(format!("unknown tool {tool}")),
    }
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
