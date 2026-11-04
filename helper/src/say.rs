//! Say: run one request through the user's LOCAL Claude Code (never the API, never an API key) and stream its text back.
//! The binary is `claude` unless SWIFT_CLAUDE_BIN points elsewhere (tests use a fake). Lean flags keep start-up fast (spike #1707).
use serde_json::{json, Value};
use std::{io::{self, BufRead, BufReader, Write}, process::{Child, ChildStdin, ChildStdout, Command, Stdio}, sync::Mutex, time::{Duration, Instant}};

pub const MAX_REQUEST_BYTES: usize = 64 * 1024;
pub const MAX_CONCURRENT: usize = 4;
/// An idle spare holds ~250 MB (spike #1707): reap it after this long without a Say.
pub const SPARE_IDLE: Duration = Duration::from_secs(120);
#[derive(Debug, PartialEq)]
pub enum Out { Delta(String), Done(Option<Value>), Error(String) }

pub fn claude_args(model: &str) -> Vec<String> {
    let mut a: Vec<String> = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--include-partial-messages", "--verbose", "--model", model, "--no-session-persistence", "--tools", "", "--disable-slash-commands", "--strict-mcp-config", "--setting-sources", "project"].iter().map(|s| s.to_string()).collect();
    if let Ok(e) = std::env::var("SWIFT_CLAUDE_EFFORT") { if matches!(e.as_str(), "low" | "medium" | "high") { a.push("--effort".into()); a.push(e); } } // opt-in experiment: a lower effort level (measured in docs/handoff.md before any default changes)
    a
}
/// An image sent with a Say (a screenshot to rebuild): validated, never trusted.
#[derive(Debug, Clone, PartialEq)]
pub struct Image { pub media_type: String, pub data: String }
pub const MAX_IMAGES: usize = 2;
/// Decoded size cap per image (5 MB).
pub const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;
fn b64_val(c: u8) -> Option<u8> { match c { b'A'..=b'Z' => Some(c - b'A'), b'a'..=b'z' => Some(c - b'a' + 26), b'0'..=b'9' => Some(c - b'0' + 52), b'+' => Some(62), b'/' => Some(63), _ => None } }
/// The first bytes of a base64 string (enough for the file signature); None when it is not strict, padded base64.
fn b64_head(d: &str) -> Option<Vec<u8>> {
    let b = d.as_bytes(); if b.is_empty() || b.len() % 4 != 0 { return None; }
    let pad = b.iter().rev().take_while(|&&c| c == b'=').count(); if pad > 2 || b[..b.len() - pad].iter().any(|&c| b64_val(c).is_none()) { return None; }
    let mut out = vec![]; for q in b.chunks(4).take(3) { let v: Vec<u32> = q.iter().map(|&c| b64_val(c).unwrap_or(0) as u32).collect(); let n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3]; out.extend([(n >> 16) as u8, (n >> 8) as u8, n as u8]); } Some(out)
}
/// Decoded byte length of a strict base64 string.
fn b64_len(d: &str) -> usize { d.len() / 4 * 3 - d.bytes().rev().take_while(|&c| c == b'=').count() }
/// The `images` of a say message: `[{mediaType, data}]`, png or jpeg only, at most MAX_IMAGES, each at most MAX_IMAGE_BYTES decoded, and the bytes must really start like that format.
pub fn parse_images(v: Option<&Value>) -> Result<Vec<Image>, String> {
    let Some(v) = v else { return Ok(vec![]) }; let a = v.as_array().ok_or("images must be a list")?;
    if a.len() > MAX_IMAGES { return Err(format!("too many images (max {MAX_IMAGES})")); }
    a.iter().map(|x| {
        let mt = x.get("mediaType").and_then(Value::as_str).unwrap_or(""); let data = x.get("data").and_then(Value::as_str).unwrap_or("");
        if mt != "image/png" && mt != "image/jpeg" { return Err("unsupported image type (png or jpeg only)".to_string()); }
        if data.len() > MAX_IMAGE_BYTES / 3 * 4 + 8 || (!data.is_empty() && data.len() % 4 == 0 && b64_len(data) > MAX_IMAGE_BYTES) { return Err("image too large (max 5 MB)".to_string()); }
        let head = b64_head(data).ok_or("image data is not valid base64")?;
        let ok = if mt == "image/png" { head.starts_with(&[0x89, b'P', b'N', b'G']) } else { head.starts_with(&[0xFF, 0xD8, 0xFF]) };
        if !ok { return Err("image bytes do not match their type".to_string()); }
        Ok(Image { media_type: mt.to_string(), data: data.to_string() })
    }).collect()
}
/// The one stream-json user message: instructions + request in a single turn.
pub fn user_message(system: &str, request: &str) -> String { user_message_with(system, request, &[]) }
/// Same, with images as content blocks after the text (plain string content when there are none, as before).
pub fn user_message_with(system: &str, request: &str, images: &[Image]) -> String {
    let text = format!("{system}\n\nRequest: {request}");
    let content = if images.is_empty() { json!(text) } else { let mut c = vec![json!({ "type": "text", "text": text })]; c.extend(images.iter().map(|i| json!({ "type": "image", "source": { "type": "base64", "media_type": i.media_type, "data": i.data } }))); Value::Array(c) };
    json!({ "type": "user", "message": { "role": "user", "content": content } }).to_string()
}
/// The `result` line's token usage (input/output/cache counts only, numbers only); None when absent. Forwarded as-is on `done`.
fn usage_of(v: &Value) -> Option<Value> {
    let u = v.get("usage")?.as_object()?; let mut o = serde_json::Map::new();
    for k in ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"] { if let Some(n) = u.get(k).and_then(Value::as_u64) { o.insert(k.into(), json!(n)); } }
    if o.is_empty() { None } else { Some(Value::Object(o)) }
}
/// What a stream-json line means for us: a text delta, the end of the turn, or nothing.
pub fn parse_line(line: &str) -> Option<Out> {
    let v: Value = serde_json::from_str(line).ok()?;
    match v.get("type")?.as_str()? {
        "stream_event" => { let ev = v.get("event")?; if ev.get("type")?.as_str()? != "content_block_delta" { return None; } let t = ev.get("delta")?.get("text")?.as_str()?; Some(Out::Delta(t.to_string())) }
        "result" => if v.get("is_error").and_then(Value::as_bool) == Some(true) { Some(Out::Error(v.get("result").and_then(Value::as_str).unwrap_or("claude reported an error").to_string())) } else { Some(Out::Done(usage_of(&v))) },
        _ => None,
    }
}
/// A pre-spawned, idle Claude Code process (spike: first token 1.02 s cold vs 0.64 s with a spare). One spare serves exactly one Say (clean context), then is replaced.
pub struct Spare { child: Child, stdin: ChildStdin, stdout: ChildStdout, born: Instant }
impl Spare {
    pub fn spawn(bin: &str, model: &str) -> io::Result<Spare> {
        let mut child = Command::new(bin).args(claude_args(model)).env("ANTHROPIC_API_KEY", "").current_dir(std::env::temp_dir()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn()?;
        let stdin = child.stdin.take().ok_or_else(|| io::Error::other("no stdin"))?; let stdout = child.stdout.take().ok_or_else(|| io::Error::other("no stdout"))?;
        Ok(Spare { child, stdin, stdout, born: Instant::now() })
    }
}
/// Holds at most one spare. `prewarm` is cheap to call often; `take` hands the spare to a Say; `reap` kills one that has idled too long.
pub struct Pool { spare: Mutex<Option<Spare>>, bin: String, model: String }
impl Pool {
    pub fn new(bin: &str, model: &str) -> Pool { Pool { spare: Mutex::new(None), bin: bin.to_string(), model: model.to_string() } }
    pub fn prewarm(&self) { let mut g = self.spare.lock().unwrap(); if g.is_none() { match Spare::spawn(&self.bin, &self.model) { Ok(sp) => *g = Some(sp), Err(e) => eprintln!("prewarm: cannot start {}: {e}", self.bin) } } }
    pub fn take(&self) -> Option<Spare> { self.spare.lock().unwrap().take() }
    pub fn has_spare(&self) -> bool { self.spare.lock().unwrap().is_some() }
    pub fn reap(&self, now: Instant, max_age: Duration) -> bool { let mut g = self.spare.lock().unwrap(); if g.as_ref().is_some_and(|s| now.duration_since(s.born) > max_age) { if let Some(mut s) = g.take() { let _ = s.child.kill(); let _ = s.child.wait(); } true } else { false } }
}
/// Blocking: use the spare (or spawn), send, stream `Out`s to `emit`, always end with Done or Error.
/// A spare may have died while idle (logged out, crashed): if it takes the message but produces nothing, retry once with a fresh process.
pub fn run_say(pool: &Pool, system: &str, request: &str, emit: impl FnMut(Out)) { run_say_images(pool, system, request, &[], emit) }
/// `run_say` with images (already validated by `parse_images`); the text cap does not count them.
pub fn run_say_images(pool: &Pool, system: &str, request: &str, images: &[Image], mut emit: impl FnMut(Out)) {
    if system.len() + request.len() > MAX_REQUEST_BYTES { return emit(Out::Error("request too large".into())); }
    let msg = user_message_with(system, request, images); let mut spare = pool.take();
    for attempt in 0..2 {
        let from_spare = spare.is_some();
        let mut sp = match spare.take() { Some(sp) => sp, None => match Spare::spawn(&pool.bin, &pool.model) { Ok(sp) => sp, Err(e) => return emit(Out::Error(format!("cannot start {}: {e}", pool.bin))) } };
        if writeln!(sp.stdin, "{msg}").and_then(|_| sp.stdin.flush()).is_err() { let _ = sp.child.kill(); let _ = sp.child.wait(); if from_spare && attempt == 0 { continue; } return emit(Out::Error("claude closed its input".into())); }
        let Spare { mut child, stdin, stdout, .. } = sp; let mut stdin = Some(stdin); let (mut finished, mut got_any) = (false, false);
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            match parse_line(&line) { Some(Out::Delta(t)) => { got_any = true; emit(Out::Delta(t)) } Some(end) => { finished = true; drop(stdin.take()); emit(end); break; } None => {} }
        }
        drop(stdin); let _ = child.wait();
        if finished { return; }
        if from_spare && !got_any && attempt == 0 { continue; } // a dead spare: try a fresh process
        return emit(Out::Error("claude ended without an answer (logged out?)".into()));
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn args_are_lean_and_never_bare() { let a = claude_args("haiku"); assert!(a.contains(&"--strict-mcp-config".into()) && a.contains(&"--no-session-persistence".into())); assert!(!a.contains(&"--bare".into())); assert_eq!(a[a.iter().position(|x| x == "--model").unwrap() + 1], "haiku"); }
    #[test] fn parses_delta_result_and_ignores_the_rest() {
        assert_eq!(parse_line(r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}}"#), Some(Out::Delta("hi".into())));
        assert_eq!(parse_line(r#"{"type":"result","is_error":false}"#), Some(Out::Done(None))); assert_eq!(parse_line(r#"{"type":"result","is_error":false,"usage":{"input_tokens":12,"output_tokens":3,"cache_read_input_tokens":5,"junk":"x"}}"#), Some(Out::Done(Some(json!({"input_tokens":12,"output_tokens":3,"cache_read_input_tokens":5}))))); assert_eq!(parse_line(r#"{"type":"result","is_error":true,"result":"limit"}"#), Some(Out::Error("limit".into())));
        assert_eq!(parse_line(r#"{"type":"system"}"#), None); assert_eq!(parse_line("garbage"), None); assert_eq!(parse_line(r#"{"type":"stream_event","event":{"type":"message_start"}}"#), None);
    }
    #[test] fn reap_kills_only_old_spares() { let p = Pool::new("sleep", "haiku"); assert!(!p.has_spare()); assert!(!p.reap(Instant::now(), SPARE_IDLE)); }
    const PNG: &str = "iVBORw0KGgoAAAANSUhEUg=="; const JPG: &str = "/9j/4AAQSkZJRgABAQAA";
    #[test] fn images_validate() {
        let img = |mt: &str, d: &str| json!([{ "mediaType": mt, "data": d }]);
        assert_eq!(parse_images(None).unwrap(), vec![]); assert_eq!(parse_images(Some(&img("image/png", PNG))).unwrap().len(), 1); assert_eq!(parse_images(Some(&img("image/jpeg", JPG))).unwrap().len(), 1);
        assert!(parse_images(Some(&img("image/gif", PNG))).unwrap_err().contains("unsupported")); assert!(parse_images(Some(&img("image/png", JPG))).unwrap_err().contains("do not match")); assert!(parse_images(Some(&img("image/png", "not base64!"))).unwrap_err().contains("base64")); assert!(parse_images(Some(&img("image/png", ""))).is_err());
        assert!(parse_images(Some(&json!("x"))).is_err()); assert!(parse_images(Some(&json!([{"mediaType":"image/png"}]))).is_err());
        let three = json!([{"mediaType":"image/png","data":PNG},{"mediaType":"image/png","data":PNG},{"mediaType":"image/png","data":PNG}]); assert!(parse_images(Some(&three)).unwrap_err().contains("too many"));
        let big = format!("iVBORw0K{}", "A".repeat(7 * 1024 * 1024)); assert!(parse_images(Some(&img("image/png", &big))).unwrap_err().contains("too large"));
    }
    #[test] fn images_become_content_blocks_after_the_text() { let imgs = parse_images(Some(&json!([{ "mediaType": "image/png", "data": PNG }]))).unwrap(); let v: Value = serde_json::from_str(&user_message_with("SYS", "rebuild", &imgs)).unwrap(); let c = v["message"]["content"].as_array().unwrap(); assert_eq!(c[0]["type"], "text"); assert!(c[0]["text"].as_str().unwrap().ends_with("Request: rebuild")); assert_eq!(c[1]["type"], "image"); assert_eq!(c[1]["source"]["media_type"], "image/png"); assert_eq!(c[1]["source"]["type"], "base64"); assert_eq!(c[1]["source"]["data"], PNG); }
    #[test] fn user_message_is_one_json_line() { let m = user_message("SYS", "make it bigger"); assert!(!m.contains('\n')); let v: Value = serde_json::from_str(&m).unwrap(); assert!(v["message"]["content"].as_str().unwrap().ends_with("Request: make it bigger")); }
}
