//! Say: run one request through the user's LOCAL Claude Code (never the API, never an API key) and stream its text back.
//! The binary is `claude` unless SWIFT_CLAUDE_BIN points elsewhere (tests use a fake). Lean flags keep start-up fast (spike #1707).
use serde_json::{json, Value};
use std::{io::{BufRead, BufReader, Write}, process::{Command, Stdio}};

pub const MAX_REQUEST_BYTES: usize = 64 * 1024;
pub const MAX_CONCURRENT: usize = 4;
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
/// Blocking: spawn, send, stream `Out`s to `emit`, always end with Done or Error.
pub fn run_say(bin: &str, model: &str, system: &str, request: &str, mut emit: impl FnMut(Out)) {
    if system.len() + request.len() > MAX_REQUEST_BYTES { return emit(Out::Error("request too large".into())); }
    let mut child = match Command::new(bin).args(claude_args(model)).env("ANTHROPIC_API_KEY", "").current_dir(std::env::temp_dir()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn() {
        Ok(c) => c, Err(e) => return emit(Out::Error(format!("cannot start {bin}: {e}"))) };
    let mut stdin = child.stdin.take();
    if let Some(w) = stdin.as_mut() { if writeln!(w, "{}", user_message(system, request)).and_then(|_| w.flush()).is_err() { let _ = child.kill(); return emit(Out::Error("claude closed its input".into())); } }
    let Some(out) = child.stdout.take() else { let _ = child.kill(); return emit(Out::Error("no output from claude".into())) };
    let mut finished = false;
    for line in BufReader::new(out).lines().map_while(Result::ok) {
        match parse_line(&line) { Some(Out::Delta(t)) => emit(Out::Delta(t)), Some(end) => { finished = true; drop(stdin.take()); emit(end); break; } None => {} }
    }
    drop(stdin); let _ = child.wait();
    if !finished { emit(Out::Error("claude ended without an answer (logged out?)".into())); }
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
    #[test] fn user_message_is_one_json_line() { let m = user_message("SYS", "make it bigger"); assert!(!m.contains('\n')); let v: Value = serde_json::from_str(&m).unwrap(); assert!(v["message"]["content"].as_str().unwrap().ends_with("Request: make it bigger")); }
}
