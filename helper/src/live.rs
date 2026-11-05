//! Live agent stream (task #1803): fan-out of typed run events to any number of subscribers, with a bounded queue per subscriber.
//! A slow subscriber never blocks the run: when its queue is full the OLDEST events are dropped and the count is reported to it (`live.dropped`), never silently.
use std::{collections::{HashMap, VecDeque}, sync::Mutex};
use swift_canvas_core::live::{LiveEnvelope, LiveEvent, Source};

pub const QUEUE_CAP: usize = 256;
const MAX_RUNS: usize = 64;

#[derive(Default)]
struct Sub { q: VecDeque<String>, dropped: u64 }
pub struct LiveHub { cap: usize, subs: Mutex<HashMap<usize, Sub>>, browser: Mutex<Option<usize>>, seqs: Mutex<HashMap<String, u64>> }
impl Default for LiveHub { fn default() -> Self { Self::with_cap(QUEUE_CAP) } }

/// What a publish reached: how many subscribers got it and whether a browser role is registered (so the agent knows nobody is acting on its steps).
pub struct Delivery { pub seq: u64, pub delivered: usize, pub browser: bool }

impl LiveHub {
    pub fn with_cap(cap: usize) -> Self { LiveHub { cap: cap.max(1), subs: Mutex::default(), browser: Mutex::default(), seqs: Mutex::default() } }
    pub fn subscribe(&self, cid: usize) { self.subs.lock().unwrap().entry(cid).or_default(); }
    /// `role=browser`: this connection is the one that acts on the page. It is also a subscriber (it receives the agent's steps).
    pub fn register_browser(&self, cid: usize) { *self.browser.lock().unwrap() = Some(cid); self.subscribe(cid); }
    pub fn browser_present(&self) -> bool { self.browser.lock().unwrap().is_some() }
    pub fn disconnect(&self, cid: usize) { self.subs.lock().unwrap().remove(&cid); let mut b = self.browser.lock().unwrap(); if *b == Some(cid) { *b = None; } }
    /// Stamp and fan out one event to every subscriber except its sender. Never blocks.
    pub fn publish(&self, from: usize, run: &str, source: Source, event: LiveEvent) -> Delivery {
        let seq = { let mut s = self.seqs.lock().unwrap(); if !s.contains_key(run) && s.len() >= MAX_RUNS { s.clear(); } let n = s.entry(run.to_string()).or_insert(0); *n += 1; let v = *n; if matches!(event, LiveEvent::Done { .. }) { s.remove(run); } v };
        let msg = serde_json::json!({ "type": "live.event", "envelope": LiveEnvelope { run: run.to_string(), seq, source, event } }).to_string();
        let mut delivered = 0;
        for (cid, sub) in self.subs.lock().unwrap().iter_mut() {
            if *cid == from { continue; }
            if sub.q.len() >= self.cap { sub.q.pop_front(); sub.dropped += 1; }
            sub.q.push_back(msg.clone()); delivered += 1;
        }
        Delivery { seq, delivered, browser: self.browser_present() }
    }
    /// Everything waiting for one subscriber; a `live.dropped` notice comes first when events were lost.
    pub fn drain(&self, cid: usize) -> Vec<String> {
        let mut g = self.subs.lock().unwrap(); let Some(sub) = g.get_mut(&cid) else { return Vec::new() };
        let mut out = Vec::with_capacity(sub.q.len() + 1);
        if sub.dropped > 0 { out.push(serde_json::json!({ "type": "live.dropped", "count": sub.dropped }).to_string()); sub.dropped = 0; }
        out.extend(sub.q.drain(..)); out
    }
}

/// Run id for everything Claude Code does through MCP tool calls (so a tail shows each step with no extra setup).
pub const MCP_RUN: &str = "mcp";
pub fn announce_start(live: &LiveHub, cid: usize, id: &str, tool: &str) { live.publish(cid, MCP_RUN, Source::Agent, LiveEvent::ToolStart { id: id.to_string(), tool: tool.to_string() }); }
/// tool.end (with the error text when it failed) and, for a successful apply_ops, one `op` event per op so a watcher sees what changed.
pub fn announce_end(live: &LiveHub, cid: usize, id: &str, tool: &str, args: &serde_json::Value, r: &Result<serde_json::Value, String>) {
    if r.is_ok() && tool == "apply_ops" { if let Some(ops) = args.get("ops").and_then(|o| o.as_array()) { for op in ops.iter().take(50) { live.publish(cid, MCP_RUN, Source::Agent, LiveEvent::Op { op: op.clone() }); } } }
    live.publish(cid, MCP_RUN, Source::Agent, LiveEvent::ToolEnd { id: id.to_string(), ok: r.is_ok(), detail: r.as_ref().err().map(|e| e.chars().take(300).collect()) });
}

/// One plain-text line for the terminal tail (`swift-canvas-helper watch`): what happened, never the screenshot bytes.
pub fn format_line(env: &LiveEnvelope) -> String {
    let who = match env.source { Source::Agent => "agent", Source::Browser => "you" };
    let cut = |t: &str, n: usize| { let one: String = t.split_whitespace().collect::<Vec<_>>().join(" "); if one.chars().count() > n { format!("{}...", one.chars().take(n).collect::<String>()) } else { one } };
    let what = match &env.event {
        LiveEvent::ThinkingDelta { text } => format!("thinking: {}", cut(text, 100)),
        LiveEvent::Op { op } => format!("op: {}", cut(&op.to_string(), 120)),
        LiveEvent::ToolStart { tool, .. } => format!("tool.start {tool}"),
        LiveEvent::ToolEnd { ok, detail, .. } => if *ok { "tool.end ok".to_string() } else { format!("tool.end FAILED {}", cut(detail.as_deref().unwrap_or(""), 120)) },
        LiveEvent::Shot { png } => format!("shot ({} bytes)", png.len() * 3 / 4),
        LiveEvent::Snapshot { text } => format!("snapshot ({} chars)", text.len()),
        LiveEvent::UserAction { action, detail } => format!("user.action {action} {}", cut(detail.as_deref().unwrap_or(""), 80)).trim_end().to_string(),
        LiveEvent::Error { message } => format!("error: {}", cut(message, 160)),
        LiveEvent::Done { summary } => format!("done {}", cut(summary.as_deref().unwrap_or(""), 120)).trim_end().to_string(),
    };
    format!("{}:{:<3} {who:<5} {what}", env.run, env.seq)
}

/// The read-only tail: connect as a local (mcp-role) client, subscribe, print one line per event. Sends nothing but `live.subscribe`. Reconnects when the helper restarts.
pub fn watch(data_dir: &std::path::Path, mut out: impl std::io::Write, stop: &std::sync::atomic::AtomicBool) {
    let mut announced = false;
    while !stop.load(std::sync::atomic::Ordering::SeqCst) {
        match crate::mcp::connect_ws(data_dir, Some(std::time::Duration::from_millis(200))) {
            Err(e) => { if !announced { let _ = writeln!(out, "waiting for the helper: {e}"); announced = true; } std::thread::sleep(std::time::Duration::from_millis(500)); }
            Ok(mut ws) => {
                announced = false; if ws.send(tungstenite::Message::text("{\"type\":\"live.subscribe\"}")).is_err() { continue; }
                while !stop.load(std::sync::atomic::Ordering::SeqCst) {
                    match ws.read() {
                        Ok(tungstenite::Message::Text(t)) => { let Ok(v) = serde_json::from_str::<serde_json::Value>(t.as_str()) else { continue };
                            match v["type"].as_str() {
                                Some("live.subscribed") => { let _ = writeln!(out, "watching (read-only)"); let _ = out.flush(); }
                                Some("live.dropped") => { let _ = writeln!(out, "-- {} events dropped (this reader was too slow)", v["count"]); let _ = out.flush(); }
                                Some("live.event") => { if let Ok(e) = serde_json::from_value::<LiveEnvelope>(v["envelope"].clone()) { let _ = writeln!(out, "{}", format_line(&e)); let _ = out.flush(); } }
                                _ => {} } }
                        Ok(tungstenite::Message::Close(_)) | Err(tungstenite::Error::ConnectionClosed) | Err(tungstenite::Error::AlreadyClosed) => break,
                        Err(tungstenite::Error::Io(e)) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => continue,
                        Err(_) => break, Ok(_) => {} }
                }
                if !stop.load(std::sync::atomic::Ordering::SeqCst) { let _ = writeln!(out, "helper connection lost, reconnecting..."); let _ = out.flush(); std::thread::sleep(std::time::Duration::from_millis(500)); }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ev(t: &str) -> LiveEvent { LiveEvent::ThinkingDelta { text: t.into() } }
    #[test] fn fans_out_to_every_subscriber_but_not_back_to_the_sender() {
        let h = LiveHub::default(); for c in [1, 2, 3] { h.subscribe(c); }
        let d = h.publish(1, "r", Source::Agent, ev("a")); assert_eq!((d.seq, d.delivered, d.browser), (1, 2, false));
        assert_eq!(h.drain(2).len(), 1); assert_eq!(h.drain(3).len(), 1); assert!(h.drain(1).is_empty());
    }
    #[test] fn a_slow_subscriber_drops_the_oldest_and_is_told_how_many() {
        let h = LiveHub::with_cap(2); h.subscribe(2);
        for i in 0..5 { h.publish(1, "r", Source::Agent, ev(&i.to_string())); }
        let got = h.drain(2); assert_eq!(got.len(), 3); assert!(got[0].contains("live.dropped") && got[0].contains("\"count\":3"));
        assert!(got[1].contains("\"seq\":4") && got[2].contains("\"seq\":5")); assert_eq!(h.drain(2).len(), 0);
    }
    #[test] fn a_gone_subscriber_is_forgotten_and_the_browser_role_clears() {
        let h = LiveHub::default(); h.register_browser(7); assert!(h.browser_present()); h.subscribe(2);
        h.disconnect(7); assert!(!h.browser_present()); assert_eq!(h.publish(1, "r", Source::Agent, ev("x")).delivered, 1);
    }
    #[test] fn done_ends_the_run_sequence() {
        let h = LiveHub::default(); h.publish(1, "r", Source::Agent, ev("a")); h.publish(1, "r", Source::Agent, LiveEvent::Done { summary: None }); assert_eq!(h.publish(1, "r", Source::Agent, ev("b")).seq, 1);
    }
    #[test] fn tail_lines_are_one_plain_line_per_event_and_never_dump_images() {
        let e = |event| LiveEnvelope { run: "r".into(), seq: 3, source: Source::Agent, event };
        assert_eq!(format_line(&e(LiveEvent::ToolStart { id: "1".into(), tool: "apply_ops".into() })), "r:3   agent tool.start apply_ops");
        assert!(format_line(&e(LiveEvent::ToolEnd { id: "1".into(), ok: false, detail: Some("bad\nop".into()) })).ends_with("tool.end FAILED bad op"));
        let shot = format_line(&e(LiveEvent::Shot { png: "A".repeat(4000) })); assert!(shot.len() < 60 && shot.contains("3000 bytes"), "{shot}");
        assert!(!format_line(&e(LiveEvent::ThinkingDelta { text: "x\ny".repeat(500) })).contains('\n'));
    }
}
