//! Claude Code status for the app: missing / logged_out / ready / limit_reached. Probes never call a model: `claude --version`, then `claude auth status` (local JSON, exit 1 when logged out).
//! limit_reached comes from a Say that returned a usage-limit error; a successful Say or an explicit re-check clears it (the free probe cannot see limits, so the 5 s poll keeps it).
use std::{process::{Command, Stdio}, sync::{mpsc::Sender, Mutex}, time::{Duration, Instant}};

#[derive(Clone, Debug, PartialEq)]
pub struct Status { pub state: &'static str, pub message: String, pub version: String }
impl Status {
    pub fn event(&self) -> String { serde_json::json!({ "type": "claude.status", "state": self.state, "message": self.message }).to_string() }
    /// The legacy hello string: "ready (2.1.316 (Claude Code))", "missing", ...
    pub fn legacy(&self) -> String { if self.state == "ready" { format!("ready ({})", self.version) } else { self.state.to_string() } }
}
fn st(state: &'static str, message: &str, version: &str) -> Status { Status { state, message: message.to_string(), version: version.to_string() } }

/// Run with a deadline; None when it cannot start or times out.
fn run(bin: &str, args: &[&str], wait: Duration) -> Option<(bool, String)> {
    let mut c = Command::new(bin).args(args).env("ANTHROPIC_API_KEY", "").stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().ok()?;
    let t = Instant::now();
    loop { match c.try_wait() { Ok(Some(_)) => break, Ok(None) if t.elapsed() < wait => std::thread::sleep(Duration::from_millis(20)), _ => { let _ = c.kill(); let _ = c.wait(); return None; } } }
    let o = c.wait_with_output().ok()?; Some((o.status.success(), String::from_utf8_lossy(&o.stdout).trim().to_string()))
}
pub fn probe(bin: &str) -> Status {
    let Some((true, version)) = run(bin, &["--version"], Duration::from_secs(10)) else { return st("missing", "Claude Code is not installed", "") };
    match run(bin, &["auth", "status"], Duration::from_secs(10)) {
        Some((true, out)) if serde_json::from_str::<serde_json::Value>(&out).ok().and_then(|v| v.get("loggedIn").and_then(|b| b.as_bool())) != Some(false) => st("ready", &format!("Claude Code {version}"), &version),
        Some(_) => st("logged_out", "Claude Code is signed out: run `claude auth login`", &version),
        None => st("missing", "Claude Code did not answer", &version),
    }
}
pub fn is_limit(msg: &str) -> bool { let m = msg.to_lowercase(); ["usage limit", "limit reached", "rate limit", "hit your limit", "out of extra usage"].iter().any(|k| m.contains(k)) }

/// Current status plus the connected clients to push changes to.
pub struct Shared { cur: Mutex<Status>, clients: Mutex<Vec<(usize, Sender<String>)>>, bin: String, probed: Mutex<Option<Instant>> }
impl Shared {
    pub fn new(bin: &str) -> Shared { Shared { cur: Mutex::new(st("missing", "not checked yet", "")), clients: Mutex::new(vec![]), bin: bin.to_string(), probed: Mutex::new(None) } }
    pub fn get(&self) -> Status { self.cur.lock().unwrap().clone() }
    pub fn subscribe(&self, id: usize, tx: Sender<String>) { self.clients.lock().unwrap().push((id, tx)); }
    pub fn unsubscribe(&self, id: usize) { self.clients.lock().unwrap().retain(|(i, _)| *i != id); }
    fn set(&self, s: Status) -> bool { let mut g = self.cur.lock().unwrap(); if *g == s { return false; } *g = s.clone(); drop(g); let ev = s.event(); self.clients.lock().unwrap().retain(|(_, tx)| tx.send(ev.clone()).is_ok()); true }
    /// Probe now. `clear_limit`: an explicit re-check also forgets limit_reached; the poll keeps it while the probe says ready.
    pub fn refresh(&self, clear_limit: bool) -> Status {
        let p = probe(&self.bin); *self.probed.lock().unwrap() = Some(Instant::now()); let keep = !clear_limit && p.state == "ready" && self.get().state == "limit_reached";
        if !keep { self.set(p); } self.get()
    }
    /// For a new connection: a probe younger than `max_age` is reused, so a reconnect/reload gets its hello at once instead of waiting for `claude` to be run again (the poll and `claude.status` re-check keep it fresh).
    pub fn cached_or_refresh(&self, max_age: Duration) -> Status {
        let fresh = self.probed.lock().unwrap().is_some_and(|t| t.elapsed() < max_age); if fresh { self.get() } else { self.refresh(false) }
    }
    pub fn limit_reached(&self, msg: &str) { let v = self.get().version; self.set(st("limit_reached", &msg.chars().take(200).collect::<String>(), &v)); }
    /// A Say succeeded: Claude is ready (and not limited).
    pub fn say_ok(&self) { let cur = self.get(); if cur.state != "ready" { let v = if cur.version.is_empty() { probe(&self.bin).version } else { cur.version }; self.set(st("ready", &format!("Claude Code {v}"), &v)); } }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn limit_messages() { assert!(is_limit("Claude usage limit reached")); assert!(is_limit("You've hit your limit")); assert!(!is_limit("claude ended without an answer")); }
    #[test] fn legacy_string() { assert_eq!(st("ready", "m", "2.1 (Claude Code)").legacy(), "ready (2.1 (Claude Code))"); assert_eq!(st("logged_out", "m", "v").legacy(), "logged_out"); }
    #[test] fn missing_binary() { assert_eq!(probe("/nonexistent/claude").state, "missing"); }
}
