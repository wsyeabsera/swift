use helper::{claude_status, config_from, serve};
use std::{env, fs, net::TcpListener};
fn random_token() -> String { let mut b = [0u8; 16]; if let Ok(mut f) = fs::File::open("/dev/urandom") { use std::io::Read; let _ = f.read_exact(&mut b); } b.iter().map(|x| format!("{x:02x}")).collect() }
fn main() -> std::io::Result<()> {
    let cfg = config_from(|k| env::var(k).ok(), random_token);
    let listener = TcpListener::bind(("127.0.0.1", cfg.port))?; // loopback only
    eprintln!("swift-canvas-helper 127.0.0.1:{} claude={} allowed_origins={}", cfg.port, claude_status(), cfg.allowed.len());
    if cfg.allowed.is_empty() { eprintln!("no allowed origins: set SWIFT_ALLOWED_ORIGINS=chrome-extension://<id> (or SWIFT_DEV=1 for the dev page)"); }
    if env::var("SWIFT_HELPER_TOKEN").is_err() && env::var("SWIFT_DEV").as_deref() != Ok("1") { eprintln!("token: {}", cfg.token); }
    serve(listener, cfg)
}
