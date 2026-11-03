use helper::{config_from, serve};
use std::{env, fs, net::TcpListener};
fn random_token() -> String { let mut b = [0u8; 16]; if let Ok(mut f) = fs::File::open("/dev/urandom") { use std::io::Read; let _ = f.read_exact(&mut b); } b.iter().map(|x| format!("{x:02x}")).collect() }
fn main() -> std::io::Result<()> {
    // `swift-canvas-helper scan <folder>`: print the brand tokens found in a project folder (the user runs this themselves, so no allow-list is needed)
    let args: Vec<String> = env::args().collect();
    if args.get(1).map(String::as_str) == Some("scan") { let Some(dir) = args.get(2) else { eprintln!("usage: swift-canvas-helper scan <folder>"); std::process::exit(2) }; let root = fs::canonicalize(dir)?; println!("{}", serde_json::to_string_pretty(&helper::scan::scan_dir(&root)?).expect("json")); return Ok(()); }
    // `swift-canvas-helper mcp`: MCP server on stdio for a Claude Code session (`claude mcp add swift -- swift-canvas-helper mcp`); talks to the RUNNING helper.
    if args.get(1).map(String::as_str) == Some("mcp") { let cfg = config_from(|k| env::var(k).ok(), || String::new()); let mut be = helper::mcp::WsBackend::new(cfg.data_dir); let stdin = std::io::stdin(); return helper::mcp::serve_stdio(stdin.lock(), std::io::stdout(), &mut be); }
    let cfg = config_from(|k| env::var(k).ok(), random_token);
    let listener = TcpListener::bind(("127.0.0.1", cfg.port))?; // loopback only
    eprintln!("swift-canvas-helper 127.0.0.1:{} claude={} allowed_origins={}", cfg.port, helper::status::probe(&cfg.claude_bin).legacy(), cfg.allowed.len());
    if cfg.allowed.is_empty() { eprintln!("no allowed origins: set SWIFT_ALLOWED_ORIGINS=chrome-extension://<id> (or SWIFT_DEV=1 for the dev page)"); }
    if env::var("SWIFT_HELPER_TOKEN").is_err() && env::var("SWIFT_DEV").as_deref() != Ok("1") { eprintln!("token: {}", cfg.token); }
    serve(listener, cfg)
}
