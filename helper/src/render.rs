//! Motion export: one standalone HTML document per time step -> PNG screenshots (headless Chrome, a few at a time) -> one H.264 MP4 (ffmpeg).
//! The app does the deterministic part (it applies the timeline at time t and snapshots the frame); this module only rasterizes and encodes.
//! Scripts are blocked in every document by a Content-Security-Policy (script-src 'none': inline handlers too; Chrome's screenshot mode does not work with scripting switched off), the work dir is private and removed afterwards, and sizes/counts are capped.
use std::{fs, io, path::{Path, PathBuf}, process::{Command, Stdio}, sync::{atomic::{AtomicUsize, Ordering}, Mutex}, thread, time::{Duration, Instant}};

pub const MAX_FRAMES: usize = 600; pub const MAX_DOC: usize = 2 * 1024 * 1024; const CSP: &str = "<meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'\">"; const PER_FRAME: Duration = Duration::from_secs(20);
/// Standard base64 (the MP4 travels in a JSON text frame).
pub fn b64(b: &[u8]) -> String { const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; let mut o = String::with_capacity(b.len() / 3 * 4 + 4); for c in b.chunks(3) { let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32; o.push(T[(n >> 18) as usize & 63] as char); o.push(T[(n >> 12) as usize & 63] as char); o.push(if c.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' }); o.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' }); } o }
pub struct Job { pub w: u32, pub h: u32, pub fps: u32, pub docs: Vec<String> }
pub fn check(j: &Job) -> Result<(), String> {
    if j.docs.is_empty() { return Err("no frames".into()); } if j.docs.len() > MAX_FRAMES { return Err(format!("at most {MAX_FRAMES} frames")); }
    if !(160..=3840).contains(&j.w) || !(160..=2160).contains(&j.h) { return Err("size must be 160-3840 x 160-2160".into()); } if !(1..=60).contains(&j.fps) { return Err("fps must be 1-60".into()); }
    if j.docs.iter().any(|d| d.len() > MAX_DOC) { return Err("a frame is too large".into()); } Ok(())
}
fn shot(chrome: &str, doc: &Path, png: &Path, w: u32, h: u32) -> Result<(), String> {
    let mut child = Command::new(chrome).args(["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--force-device-scale-factor=1", &format!("--window-size={w},{h}"), &format!("--screenshot={}", png.display()), &format!("file://{}", doc.display())]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| format!("cannot start the browser ({chrome}): {e}"))?;
    let t0 = Instant::now(); loop { match child.try_wait() { Ok(Some(s)) => { return if s.success() && png.exists() { Ok(()) } else { Err(format!("the browser failed on a frame ({s})")) }; } Ok(None) if t0.elapsed() > PER_FRAME => { let _ = child.kill(); let _ = child.wait(); return Err("the browser hung on a frame".into()); } Ok(None) => thread::sleep(Duration::from_millis(15)), Err(e) => return Err(e.to_string()) } }
}
/// Returns the MP4 bytes. `chrome` and `ffmpeg` are executables; `workers` frames are rasterized at once.
pub fn render(chrome: &str, ffmpeg: &str, j: &Job, workers: usize) -> Result<Vec<u8>, String> {
    check(j)?; static N: AtomicUsize = AtomicUsize::new(0); let dir: PathBuf = std::env::temp_dir().join(format!("sc-render-{}-{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst))); fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let out = (|| -> Result<Vec<u8>, String> {
        for (i, d) in j.docs.iter().enumerate() { fs::write(dir.join(format!("f{i:04}.html")), format!("{CSP}{d}")).map_err(|e| e.to_string())?; }
        let next = AtomicUsize::new(0); let err: Mutex<Option<String>> = Mutex::new(None);
        thread::scope(|s| { for _ in 0..workers.clamp(1, 8) { s.spawn(|| loop { let i = next.fetch_add(1, Ordering::SeqCst); if i >= j.docs.len() || err.lock().map(|e| e.is_some()).unwrap_or(true) { break; } if let Err(e) = shot(chrome, &dir.join(format!("f{i:04}.html")), &dir.join(format!("f{i:04}.png")), j.w, j.h) { if let Ok(mut g) = err.lock() { g.get_or_insert(format!("frame {i}: {e}")); } } }); } });
        if let Some(e) = err.into_inner().ok().flatten() { return Err(e); }
        let mp4 = dir.join("out.mp4"); let o = Command::new(ffmpeg).args(["-y", "-v", "error", "-framerate", &j.fps.to_string(), "-i"]).arg(dir.join("f%04d.png")).args(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-movflags", "+faststart"]).arg(&mp4).stdin(Stdio::null()).output().map_err(|e| format!("cannot start ffmpeg ({ffmpeg}): {e}"))?;
        if !o.status.success() { return Err(format!("ffmpeg failed: {}", String::from_utf8_lossy(&o.stderr).trim().chars().take(300).collect::<String>())); }
        fs::read(&mp4).map_err(|e: io::Error| e.to_string())
    })();
    let _ = fs::remove_dir_all(&dir); out
}
#[cfg(test)] mod tests {
    use super::*;
    fn script(n: &str, body: &str) -> String { let p = std::env::temp_dir().join(format!("sc-rtest-{n}-{}.sh", std::process::id())); fs::write(&p, format!("#!/bin/sh\n{body}\n")).unwrap(); #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(&p, fs::Permissions::from_mode(0o755)).unwrap(); } p.to_string_lossy().into() }
    fn job(n: usize) -> Job { Job { w: 320, h: 240, fps: 30, docs: (0..n).map(|i| format!("<p>{i}</p>")).collect() } }
    const CHROME: &str = r#"for a in "$@"; do case "$a" in --screenshot=*) f="${a#--screenshot=}";; esac; done; echo png > "$f""#;
    #[test] fn base64_matches_the_standard_vectors() { for (i, o) in [("", ""), ("f", "Zg=="), ("fo", "Zm8="), ("foo", "Zm9v"), ("foob", "Zm9vYg=="), ("fooba", "Zm9vYmE="), ("foobar", "Zm9vYmFy")] { assert_eq!(b64(i.as_bytes()), o); } }
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
        let bytes = render(&chrome, "ffmpeg", &Job { w: 640, h: 360, fps: 30, docs }, 4).unwrap(); eprintln!("30 frames 640x360 in {:?}, {} bytes", t0.elapsed(), bytes.len());
        assert!(bytes.len() > 1000 && &bytes[4..8] == b"ftyp"); fs::write(std::env::var("SC_RENDER_OUT").unwrap_or("/tmp/sc-render-test.mp4".into()), bytes).unwrap();
    }
    /// Proof run on real documents (cargo test real_documents -- --ignored --nocapture) with SC_DOCS=docs.json (a JSON array of HTML strings, 1920x1080 at 30 fps) and SC_RENDER_OUT=out.mp4.
    #[test] #[ignore] fn real_documents_render() {
        let Ok(p) = std::env::var("SC_DOCS") else { return }; let v: serde_json::Value = serde_json::from_str(&fs::read_to_string(p).unwrap()).unwrap(); let docs: Vec<String> = v.as_array().unwrap().iter().map(|d| d.as_str().unwrap().to_string()).collect();
        let chrome = std::env::var("SWIFT_CHROME_BIN").unwrap_or_else(|_| "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into()); let (n, t0) = (docs.len(), Instant::now());
        let b = render(&chrome, "ffmpeg", &Job { w: 1920, h: 1080, fps: 30, docs }, 4).unwrap(); eprintln!("{n} frames 1920x1080 in {:?}, {} bytes", t0.elapsed(), b.len()); fs::write(std::env::var("SC_RENDER_OUT").unwrap(), b).unwrap();
    }
}
