//! Say: run one request through the user's LOCAL Claude Code (never the API, never an API key) and stream its text back.
//! The binary is `claude` unless SWIFT_CLAUDE_BIN points elsewhere (tests use a fake). Lean flags keep start-up fast (spike #1707).
use serde_json::{json, Value};
use std::{io::{self, BufRead, BufReader, Write}, process::{Child, ChildStdin, ChildStdout, Command, Stdio}, sync::Mutex, time::{Duration, Instant}};

pub const MAX_REQUEST_BYTES: usize = 64 * 1024;
pub const MAX_CONCURRENT: usize = 4;
/// An idle spare holds ~250 MB (spike #1707): reap it after this long without a Say.
pub const SPARE_IDLE: Duration = Duration::from_secs(120);
#[derive(Debug, PartialEq)]
pub enum Out { Delta(String), Done, Error(String) }

pub fn claude_args(model: &str) -> Vec<String> {
    ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--include-partial-messages", "--verbose", "--model", model, "--no-session-persistence", "--tools", "", "--disable-slash-commands", "--strict-mcp-config", "--setting-sources", "project"].iter().map(|s| s.to_string()).collect()
}
/// The one stream-json user message: instructions + request in a single turn.
pub fn user_message(system: &str, request: &str) -> String { json!({ "type": "user", "message": { "role": "user", "content": format!("{system}\n\nRequest: {request}") } }).to_string() }
/// What a stream-json line means for us: a text delta, the end of the turn, or nothing.
pub fn parse_line(line: &str) -> Option<Out> {
    let v: Value = serde_json::from_str(line).ok()?;
    match v.get("type")?.as_str()? {
        "stream_event" => { let ev = v.get("event")?; if ev.get("type")?.as_str()? != "content_block_delta" { return None; } let t = ev.get("delta")?.get("text")?.as_str()?; Some(Out::Delta(t.to_string())) }
        "result" => if v.get("is_error").and_then(Value::as_bool) == Some(true) { Some(Out::Error(v.get("result").and_then(Value::as_str).unwrap_or("claude reported an error").to_string())) } else { Some(Out::Done) },
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
    pub fn prewarm(&self) { let mut g = self.spare.lock().unwrap(); if g.is_none() { *g = Spare::spawn(&self.bin, &self.model).ok(); } }
    pub fn take(&self) -> Option<Spare> { self.spare.lock().unwrap().take() }
    pub fn has_spare(&self) -> bool { self.spare.lock().unwrap().is_some() }
    pub fn reap(&self, now: Instant, max_age: Duration) -> bool { let mut g = self.spare.lock().unwrap(); if g.as_ref().is_some_and(|s| now.duration_since(s.born) > max_age) { if let Some(mut s) = g.take() { let _ = s.child.kill(); let _ = s.child.wait(); } true } else { false } }
}
/// Blocking: use the spare (or spawn), send, stream `Out`s to `emit`, always end with Done or Error.
/// A spare may have died while idle (logged out, crashed): if it takes the message but produces nothing, retry once with a fresh process.
pub fn run_say(pool: &Pool, system: &str, request: &str, mut emit: impl FnMut(Out)) {
    if system.len() + request.len() > MAX_REQUEST_BYTES { return emit(Out::Error("request too large".into())); }
    let msg = user_message(system, request); let mut spare = pool.take();
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
        assert_eq!(parse_line(r#"{"type":"result","is_error":false}"#), Some(Out::Done)); assert_eq!(parse_line(r#"{"type":"result","is_error":true,"result":"limit"}"#), Some(Out::Error("limit".into())));
        assert_eq!(parse_line(r#"{"type":"system"}"#), None); assert_eq!(parse_line("garbage"), None); assert_eq!(parse_line(r#"{"type":"stream_event","event":{"type":"message_start"}}"#), None);
    }
    #[test] fn reap_kills_only_old_spares() { let p = Pool::new("sleep", "haiku"); assert!(!p.has_spare()); assert!(!p.reap(Instant::now(), SPARE_IDLE)); }
    #[test] fn user_message_is_one_json_line() { let m = user_message("SYS", "make it bigger"); assert!(!m.contains('\n')); let v: Value = serde_json::from_str(&m).unwrap(); assert!(v["message"]["content"].as_str().unwrap().ends_with("Request: make it bigger")); }
}
