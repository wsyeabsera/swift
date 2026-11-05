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
}
