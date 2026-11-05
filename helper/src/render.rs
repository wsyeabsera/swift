//! Motion export: one standalone HTML document per time step -> PNG screenshots (headless Chrome, a few at a time) -> one H.264 MP4 (ffmpeg).
//! The app does the deterministic part (it applies the timeline at time t and snapshots the frame); this module only rasterizes and encodes.
//! Scripts are blocked in every document by a Content-Security-Policy (script-src 'none': inline handlers too; Chrome's screenshot mode does not work with scripting switched off), the work dir is private and removed afterwards, and sizes/counts are capped.
use std::{fs, io, path::{Path, PathBuf}, process::{Command, Stdio}, sync::{atomic::{AtomicBool, AtomicUsize, Ordering}, Arc, Mutex}, thread, time::{Duration, Instant}};

pub const MAX_FRAMES: usize = 600; pub const MAX_DOC: usize = 2 * 1024 * 1024; pub(crate) const CSP: &str = "<meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'\">"; const PER_FRAME: Duration = Duration::from_secs(20);
/// Standard base64 (the MP4 travels in a JSON text frame).
pub fn b64(b: &[u8]) -> String { const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; let mut o = String::with_capacity(b.len() / 3 * 4 + 4); for c in b.chunks(3) { let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32; o.push(T[(n >> 18) as usize & 63] as char); o.push(T[(n >> 12) as usize & 63] as char); o.push(if c.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' }); o.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' }); } o }
/// Cancel flag and per-frame progress for one render; `Ctl::none()` for callers that need neither.
pub struct Ctl { pub cancel: Arc<AtomicBool>, pub on_frame: Box<dyn Fn(usize, usize) + Send + Sync> }
impl Ctl { pub fn none() -> Ctl { Ctl { cancel: Arc::new(AtomicBool::new(false)), on_frame: Box::new(|_, _| {}) } } }
static LIVE: Mutex<Vec<(String, Arc<AtomicBool>)>> = Mutex::new(Vec::new());
/// Renders in flight, by `<connection>:<request id>`, so a `render.cancel` from the same connection can stop one.
pub fn register(key: &str) -> Arc<AtomicBool> { let f = Arc::new(AtomicBool::new(false)); if let Ok(mut l) = LIVE.lock() { l.push((key.to_string(), f.clone())); } f }
pub fn cancel(key: &str) -> bool { LIVE.lock().ok().and_then(|l| l.iter().find(|(k, _)| k == key).map(|(_, f)| f.store(true, Ordering::SeqCst))).is_some() }
pub fn finish(key: &str) { if let Ok(mut l) = LIVE.lock() { l.retain(|(k, _)| k != key); } }
pub const CANCELLED: &str = "cancelled";
pub struct Job { pub w: u32, pub h: u32, pub fps: u32, pub docs: Vec<String> }
pub fn check(j: &Job) -> Result<(), String> {
    if j.docs.is_empty() { return Err("no frames".into()); } if j.docs.len() > MAX_FRAMES { return Err(format!("at most {MAX_FRAMES} frames")); }
    if !(160..=3840).contains(&j.w) || !(160..=2160).contains(&j.h) { return Err("size must be 160-3840 x 160-2160".into()); } if !(1..=60).contains(&j.fps) { return Err("fps must be 1-60".into()); }
    if j.docs.iter().any(|d| d.len() > MAX_DOC) { return Err("a frame is too large".into()); } Ok(())
}
pub(crate) fn shot(chrome: &str, doc: &Path, png: &Path, w: u32, h: u32) -> Result<(), String> {
    let mut child = Command::new(chrome).args(["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--force-device-scale-factor=1", &format!("--window-size={w},{h}"), &format!("--screenshot={}", png.display()), &format!("file://{}", doc.display())]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| format!("cannot start the browser ({chrome}): {e}"))?;
    let t0 = Instant::now(); loop { match child.try_wait() { Ok(Some(s)) => { return if s.success() && png.exists() { Ok(()) } else { Err(format!("the browser failed on a frame ({s})")) }; } Ok(None) if t0.elapsed() > PER_FRAME => { let _ = child.kill(); let _ = child.wait(); return Err("the browser hung on a frame".into()); } Ok(None) => thread::sleep(Duration::from_millis(15)), Err(e) => return Err(e.to_string()) } }
}

/// Standard base64 decoder (Chrome returns screenshots as base64 text).
pub fn unb64(s: &str) -> Option<Vec<u8>> { let mut out = Vec::with_capacity(s.len() / 4 * 3); let (mut acc, mut bits) = (0u32, 0); for c in s.bytes() { let v = match c { b'A'..=b'Z' => c - b'A', b'a'..=b'z' => c - b'a' + 26, b'0'..=b'9' => c - b'0' + 52, b'+' => 62, b'/' => 63, b'=' | b'\n' | b'\r' => continue, _ => return None }; acc = acc << 6 | v as u32; bits += 6; if bits >= 8 { bits -= 8; out.push((acc >> bits) as u8); acc &= (1 << bits) - 1; } } Some(out) }
/// One headless Chrome kept open, driven over the DevTools Protocol: each frame is `Page.setDocumentContent` + `Page.captureScreenshot` (~tens of ms) instead of a browser launch per frame.
struct Cdp { ws: tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>, id: u64, session: String, child: std::process::Child }
impl Cdp {
    fn call(&mut self, method: &str, params: serde_json::Value, session: bool) -> Result<serde_json::Value, String> {
        self.id += 1; let id = self.id; let mut m = serde_json::json!({ "id": id, "method": method, "params": params }); if session { m["sessionId"] = self.session.clone().into(); }
        self.ws.send(tungstenite::Message::text(m.to_string())).map_err(|e| format!("{method}: {e}"))?;
        loop { match self.ws.read().map_err(|e| format!("{method}: {e}"))? { tungstenite::Message::Text(t) => { let v: serde_json::Value = serde_json::from_str(t.as_str()).map_err(|e| e.to_string())?; if v.get("id").and_then(|x| x.as_u64()) == Some(id) { return match v.get("error") { Some(e) => Err(format!("{method}: {}", e.get("message").and_then(|x| x.as_str()).unwrap_or("error"))), None => Ok(v["result"].clone()) }; } } tungstenite::Message::Close(_) => return Err(format!("{method}: the browser closed the connection")), _ => {} } }
    }
    fn open(chrome: &str, prof: &Path, w: u32, h: u32) -> Result<Cdp, String> {
        let child = Command::new(chrome).args(["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--remote-debugging-port=0", &format!("--user-data-dir={}", prof.display()), &format!("--window-size={w},{h}"), "about:blank"]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| format!("cannot start the browser ({chrome}): {e}"))?;
        let mut guard = Cdp::placeholder(child); let t0 = Instant::now(); let (port, path) = loop { if let Ok(t) = fs::read_to_string(prof.join("DevToolsActivePort")) { let mut l = t.lines(); if let (Some(p), Some(q)) = (l.next(), l.next()) { break (p.trim().to_string(), q.trim().to_string()); } } if t0.elapsed() > Duration::from_secs(15) { return Err("the browser did not open its debugging port".into()); } thread::sleep(Duration::from_millis(30)); };
        let (ws, _) = tungstenite::connect(format!("ws://127.0.0.1:{port}{path}")).map_err(|e| format!("cannot connect to the browser: {e}"))?; guard.ws = Some(ws); let mut c = guard.into_cdp();
        let t = c.call("Target.createTarget", serde_json::json!({ "url": "about:blank" }), false)?; let tid = t["targetId"].as_str().ok_or("no target")?.to_string();
        let a = c.call("Target.attachToTarget", serde_json::json!({ "targetId": tid, "flatten": true }), false)?; c.session = a["sessionId"].as_str().ok_or("no session")?.to_string();
        c.call("Emulation.setDeviceMetricsOverride", serde_json::json!({ "width": w, "height": h, "deviceScaleFactor": 1, "mobile": false }), true)?; c.call("Page.enable", serde_json::json!({}), true)?; Ok(c)
    }
    fn placeholder(child: std::process::Child) -> Guard { Guard { child: Some(child), ws: None } }
    fn shot(&mut self, doc: &str) -> Result<Vec<u8>, String> {
        let tree = self.call("Page.getFrameTree", serde_json::json!({}), true)?; let fid = tree["frameTree"]["frame"]["id"].as_str().ok_or("no frame")?.to_string();
        self.call("Page.setDocumentContent", serde_json::json!({ "frameId": fid, "html": doc }), true)?;
        self.call("Runtime.evaluate", serde_json::json!({ "expression": "Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => 0))]).then(() => 1)", "awaitPromise": true }), true)?; // fonts and images are in before the capture
        let r = self.call("Page.captureScreenshot", serde_json::json!({ "format": "png", "optimizeForSpeed": true }), true)?; unb64(r["data"].as_str().ok_or("no screenshot data")?).ok_or_else(|| "bad screenshot data".to_string())
    }
}
impl Drop for Cdp { fn drop(&mut self) { let _ = self.child.kill(); let _ = self.child.wait(); } }
struct Guard { child: Option<std::process::Child>, ws: Option<tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>> }
impl Guard { fn into_cdp(mut self) -> Cdp { Cdp { ws: self.ws.take().unwrap(), id: 0, session: String::new(), child: self.child.take().unwrap() } } }
impl Drop for Guard { fn drop(&mut self) { if let Some(mut c) = self.child.take() { let _ = c.kill(); let _ = c.wait(); } } }

fn encode(dir: &Path, j: &Job, ffmpeg: &str) -> Result<Vec<u8>, String> {
        let mp4 = dir.join("out.mp4"); let o = Command::new(ffmpeg).args(["-y", "-v", "error", "-framerate", &j.fps.to_string(), "-i"]).arg(dir.join("f%04d.png")).args(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-movflags", "+faststart"]).arg(&mp4).stdin(Stdio::null()).output().map_err(|e| format!("cannot start ffmpeg ({ffmpeg}): {e}"))?;
        if !o.status.success() { return Err(format!("ffmpeg failed: {}", String::from_utf8_lossy(&o.stderr).trim().chars().take(300).collect::<String>())); }
        fs::read(&mp4).map_err(|e: io::Error| e.to_string())
}
pub(crate) fn workdir() -> Result<PathBuf, String> { static N: AtomicUsize = AtomicUsize::new(0); let dir = std::env::temp_dir().join(format!("sc-render-{}-{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst))); fs::create_dir_all(&dir).map_err(|e| e.to_string())?; Ok(dir) }
/// The fast path: one browser over the DevTools Protocol (see Cdp), then one encode.
pub fn render_cdp(chrome: &str, ffmpeg: &str, j: &Job) -> Result<Vec<u8>, String> { render_cdp_ctl(chrome, ffmpeg, j, &Ctl::none()) }
pub fn render_cdp_ctl(chrome: &str, ffmpeg: &str, j: &Job, ctl: &Ctl) -> Result<Vec<u8>, String> {
    check(j)?; let dir = workdir()?;
    let out = (|| -> Result<Vec<u8>, String> { let mut c = Cdp::open(chrome, &dir.join("prof"), j.w, j.h)?; for (i, d) in j.docs.iter().enumerate() { if ctl.cancel.load(Ordering::SeqCst) { return Err(CANCELLED.into()); } let png = c.shot(&format!("{CSP}{d}")).map_err(|e| format!("frame {i}: {e}"))?; fs::write(dir.join(format!("f{i:04}.png")), png).map_err(|e| e.to_string())?; (ctl.on_frame)(i + 1, j.docs.len()); } if ctl.cancel.load(Ordering::SeqCst) { return Err(CANCELLED.into()); } drop(c); encode(&dir, j, ffmpeg) })();
    let _ = fs::remove_dir_all(&dir); out
}
/// The slow path (a browser per frame, a few at a time): needs nothing but a Chrome that can `--screenshot`. Returns the MP4 bytes. `chrome` and `ffmpeg` are executables; `workers` frames are rasterized at once.
pub fn render(chrome: &str, ffmpeg: &str, j: &Job, workers: usize) -> Result<Vec<u8>, String> { render_ctl(chrome, ffmpeg, j, workers, &Ctl::none()) }
pub fn render_ctl(chrome: &str, ffmpeg: &str, j: &Job, workers: usize, ctl: &Ctl) -> Result<Vec<u8>, String> {
    check(j)?; let dir = workdir()?;
    let out = (|| -> Result<Vec<u8>, String> {
        for (i, d) in j.docs.iter().enumerate() { fs::write(dir.join(format!("f{i:04}.html")), format!("{CSP}{d}")).map_err(|e| e.to_string())?; }
        let next = AtomicUsize::new(0); let done = AtomicUsize::new(0); let err: Mutex<Option<String>> = Mutex::new(None);
        thread::scope(|s| { for _ in 0..workers.clamp(1, 8) { s.spawn(|| loop { let i = next.fetch_add(1, Ordering::SeqCst); if i >= j.docs.len() || ctl.cancel.load(Ordering::SeqCst) || err.lock().map(|e| e.is_some()).unwrap_or(true) { break; } match shot(chrome, &dir.join(format!("f{i:04}.html")), &dir.join(format!("f{i:04}.png")), j.w, j.h) { Err(e) => { if let Ok(mut g) = err.lock() { g.get_or_insert(format!("frame {i}: {e}")); } } Ok(()) => (ctl.on_frame)(done.fetch_add(1, Ordering::SeqCst) + 1, j.docs.len()) } }); } });
        if let Some(e) = err.into_inner().ok().flatten() { return Err(e); } if ctl.cancel.load(Ordering::SeqCst) { return Err(CANCELLED.into()); }
        encode(&dir, j, ffmpeg)
    })();
    let _ = fs::remove_dir_all(&dir); out
}
#[cfg(test)] mod tests {
    use super::*;
    fn script(n: &str, body: &str) -> String { let p = std::env::temp_dir().join(format!("sc-rtest-{n}-{}.sh", std::process::id())); fs::write(&p, format!("#!/bin/sh\n{body}\n")).unwrap(); #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(&p, fs::Permissions::from_mode(0o755)).unwrap(); } p.to_string_lossy().into() }
    fn job(n: usize) -> Job { Job { w: 320, h: 240, fps: 30, docs: (0..n).map(|i| format!("<p>{i}</p>")).collect() } }
    const CHROME: &str = r#"for a in "$@"; do case "$a" in --screenshot=*) f="${a#--screenshot=}";; esac; done; echo png > "$f""#;
    #[test] fn base64_matches_the_standard_vectors() { for (i, o) in [("", ""), ("f", "Zg=="), ("fo", "Zm8="), ("foo", "Zm9v"), ("foob", "Zm9vYg=="), ("fooba", "Zm9vYmE="), ("foobar", "Zm9vYmFy")] { assert_eq!(b64(i.as_bytes()), o); } }
    #[test] fn base64_round_trips() { for i in ["", "f", "fo", "foo", "foob", "fooba", "foobar"] { assert_eq!(unb64(&b64(i.as_bytes())).unwrap(), i.as_bytes()); } assert!(unb64("a$b").is_none()); assert_eq!(unb64("Zm9v\nYmFy").unwrap(), b"foobar"); }
    #[test] fn limits_are_enforced() { assert!(check(&Job { docs: vec![], ..job(0) }).is_err()); assert!(check(&job(MAX_FRAMES + 1)).is_err()); assert!(check(&Job { w: 10, ..job(1) }).is_err()); assert!(check(&Job { fps: 0, ..job(1) }).is_err()); assert!(check(&Job { docs: vec!["x".repeat(MAX_DOC + 1)], ..job(1) }).is_err()); assert!(check(&job(3)).is_ok()); }
    #[test] fn every_frame_is_shot_in_order_then_encoded_and_the_work_dir_is_removed() {
        let dirlog = std::env::temp_dir().join(format!("sc-rdir-{}", std::process::id())); let _ = fs::remove_file(&dirlog);
        let chrome = script("ok-chrome", &format!("{CHROME}; dirname \"$f\" > {}", dirlog.display())); let log = std::env::temp_dir().join(format!("sc-rlog-{}", std::process::id())); let _ = fs::remove_file(&log);
        let ff = script("ok-ff", &format!("prev=; for a in \"$@\"; do if [ \"$prev\" = -i ]; then d=$(dirname \"$a\"); fi; prev=$a; last=$a; done; ls \"$d\"/*.png | wc -l > {}; echo mp4bytes > \"$last\"", log.display()));
        let bytes = render(&chrome, &ff, &job(7), 3).unwrap(); assert_eq!(String::from_utf8_lossy(&bytes).trim(), "mp4bytes"); assert_eq!(fs::read_to_string(&log).unwrap().trim(), "7", "ffmpeg saw all 7 frames");
        let used = fs::read_to_string(&dirlog).unwrap(); assert!(used.contains("sc-render-") && !Path::new(used.trim()).exists(), "the work dir {used} is removed");
    }
    #[test] fn a_failing_browser_names_the_frame_and_nothing_is_encoded() { let chrome = script("bad-chrome", "exit 3"); let ff = script("never-ff", "touch /tmp/sc-ff-ran-should-not-exist; exit 0"); let _ = fs::remove_file("/tmp/sc-ff-ran-should-not-exist"); let e = render(&chrome, &ff, &job(2), 2).unwrap_err(); assert!(e.contains("frame ") && e.contains("failed"), "{e}"); assert!(!Path::new("/tmp/sc-ff-ran-should-not-exist").exists()); }
    #[test] fn a_missing_browser_or_encoder_is_reported() { assert!(render("/no/such/chrome", "/no/such/ff", &job(1), 1).unwrap_err().contains("cannot start the browser")); let chrome = script("ok2-chrome", CHROME); assert!(render(&chrome, "/no/such/ff", &job(1), 1).unwrap_err().contains("cannot start ffmpeg")); }
    #[test] fn an_encoder_error_is_surfaced() { let chrome = script("ok3-chrome", CHROME); let ff = script("bad-ff", "echo boom >&2; exit 1"); assert!(render(&chrome, &ff, &job(1), 1).unwrap_err().contains("boom")); }
    /// Real Chrome + ffmpeg: `cargo test real_tools -- --ignored` (writes SC_RENDER_OUT, default /tmp/sc-render-test.mp4).
    #[test] #[ignore] fn real_tools_make_a_playable_mp4() {
        let docs = (0..30).map(|i| format!("<body style=\"margin:0;background:#101820\" onload=\"document.body.style.background='red'\"><script>document.body.style.background='red'</script><div style=\"position:absolute;left:{}px;top:40px;width:80px;height:80px;border-radius:20px;background:#7cf0d0;opacity:{}\"></div></body>", i * 20, 1.0 - i as f32 / 40.0)).collect();
        let chrome = std::env::var("SWIFT_CHROME_BIN").unwrap_or_else(|_| "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into()); let t0 = Instant::now();
        let bytes = render_cdp(&chrome, "ffmpeg", &Job { w: 640, h: 360, fps: 30, docs }).unwrap(); eprintln!("30 frames 640x360 in {:?}, {} bytes", t0.elapsed(), bytes.len());
        assert!(bytes.len() > 1000 && &bytes[4..8] == b"ftyp"); fs::write(std::env::var("SC_RENDER_OUT").unwrap_or("/tmp/sc-render-test.mp4".into()), bytes).unwrap();
    }
    /// Proof run on real documents (cargo test real_documents -- --ignored --nocapture) with SC_DOCS=docs.json (a JSON array of HTML strings, 1920x1080 at 30 fps) and SC_RENDER_OUT=out.mp4.
    #[test] #[ignore] fn real_documents_render() {
        let Ok(p) = std::env::var("SC_DOCS") else { return }; let v: serde_json::Value = serde_json::from_str(&fs::read_to_string(p).unwrap()).unwrap(); let docs: Vec<String> = v.as_array().unwrap().iter().map(|d| d.as_str().unwrap().to_string()).collect();
        let chrome = std::env::var("SWIFT_CHROME_BIN").unwrap_or_else(|_| "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into()); let (n, t0) = (docs.len(), Instant::now());
        let b = if std::env::var("SC_SLOW").is_ok() { render(&chrome, "ffmpeg", &Job { w: 1920, h: 1080, fps: 30, docs }, 4) } else { render_cdp(&chrome, "ffmpeg", &Job { w: 1920, h: 1080, fps: 30, docs }) }.unwrap(); eprintln!("{n} frames 1920x1080 in {:?}, {} bytes", t0.elapsed(), b.len()); fs::write(std::env::var("SC_RENDER_OUT").unwrap(), b).unwrap();
    }
    #[test] fn the_registry_cancels_only_the_named_render_and_forgets_finished_ones() { let a = register("1:m1"); let b = register("2:m1"); assert!(cancel("1:m1")); assert!(a.load(Ordering::SeqCst) && !b.load(Ordering::SeqCst)); assert!(!cancel("3:m1")); finish("1:m1"); assert!(!cancel("1:m1")); finish("2:m1"); }
    #[test] fn progress_is_reported_per_frame_and_cancel_stops_the_run_and_cleans_up() {
        let chrome = script("prog-chrome", CHROME); let ff = script("prog-ff", "for last; do :; done; echo mp4 > \"$last\"");
        let seen = Arc::new(Mutex::new(Vec::new())); let s2 = seen.clone(); let ctl = Ctl { cancel: Arc::new(AtomicBool::new(false)), on_frame: Box::new(move |d, t| s2.lock().unwrap().push((d, t))) };
        render_ctl(&chrome, &ff, &job(5), 1, &ctl).unwrap(); assert_eq!(*seen.lock().unwrap(), vec![(1, 5), (2, 5), (3, 5), (4, 5), (5, 5)]);
        let cancel = Arc::new(AtomicBool::new(false)); let c2 = cancel.clone(); let n = Arc::new(AtomicUsize::new(0)); let n2 = n.clone(); let ctl = Ctl { cancel, on_frame: Box::new(move |d, _| { n2.store(d, Ordering::SeqCst); if d == 2 { c2.store(true, Ordering::SeqCst); } }) };
        let e = render_ctl(&chrome, &ff, &job(50), 1, &ctl).unwrap_err(); assert_eq!(e, CANCELLED); assert!(n.load(Ordering::SeqCst) <= 3, "stopped early, shot {}", n.load(Ordering::SeqCst));
    }
}
