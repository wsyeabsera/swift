//! Live agent events (task #1803): the typed messages that flow both ways between Claude Code, the helper, the app, the side panel and the extension worker.
//! One `LiveEvent` per step of a run; the helper wraps each in a `LiveEnvelope` (run id + sequence number) and fans it out. TS types are generated from these (`gen.rs`).
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const MAX_TEXT_LEN: usize = 100_000;

/// Who produced an event: the agent side (Claude Code through MCP) or the browser side (the extension worker, the page, the user).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "lowercase")]
pub enum Source { Agent, Browser }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(tag = "kind")]
pub enum LiveEvent {
    #[serde(rename = "thinking.delta")] ThinkingDelta { text: String },
    /// A design op the agent applied (opaque JSON: validated by the core `Op` type where it is applied).
    #[serde(rename = "op")] Op { #[ts(type = "unknown")] op: serde_json::Value },
    #[serde(rename = "tool.start")] ToolStart { id: String, tool: String },
    #[serde(rename = "tool.end")] ToolEnd { id: String, ok: bool, #[serde(default, skip_serializing_if = "Option::is_none")] #[ts(optional)] detail: Option<String> },
    /// A screenshot (PNG, base64).
    #[serde(rename = "shot")] Shot { png: String },
    /// A page snapshot (text with stable @refs).
    #[serde(rename = "snapshot")] Snapshot { text: String },
    /// Something the user did in the page or the overlay (steer, pause, take over...).
    #[serde(rename = "user.action")] UserAction { action: String, #[serde(default, skip_serializing_if = "Option::is_none")] #[ts(optional)] detail: Option<String> },
    #[serde(rename = "error")] Error { message: String },
    #[serde(rename = "done")] Done { #[serde(default, skip_serializing_if = "Option::is_none")] #[ts(optional)] summary: Option<String> },
}

impl LiveEvent {
    /// Reject oversized text so one event cannot flood a subscriber.
    pub fn validate(&self) -> Result<(), String> {
        let big = |s: &str| s.len() > MAX_TEXT_LEN;
        let too_big = match self { LiveEvent::ThinkingDelta { text } | LiveEvent::Snapshot { text } => big(text), LiveEvent::Error { message } => big(message), LiveEvent::Op { op } => op.to_string().len() > MAX_TEXT_LEN, _ => false };
        if too_big { Err("event too large".into()) } else { Ok(()) }
    }
}

/// What a subscriber receives: the event with its run and a per-run sequence number, so gaps (drops) are visible.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, JsonSchema, TS)]
pub struct LiveEnvelope {
    pub run: String,
    #[ts(type = "number")] pub seq: u64,
    pub source: Source,
    pub event: LiveEvent,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn every_kind_round_trips_with_its_dotted_name() {
        let all = vec![LiveEvent::ThinkingDelta { text: "hm".into() }, LiveEvent::Op { op: serde_json::json!({"op":"token"}) }, LiveEvent::ToolStart { id: "t1".into(), tool: "click".into() }, LiveEvent::ToolEnd { id: "t1".into(), ok: true, detail: None }, LiveEvent::Shot { png: "AAAA".into() }, LiveEvent::Snapshot { text: "@e1 button".into() }, LiveEvent::UserAction { action: "pause".into(), detail: None }, LiveEvent::Error { message: "x".into() }, LiveEvent::Done { summary: Some("ok".into()) }];
        let names = ["thinking.delta", "op", "tool.start", "tool.end", "shot", "snapshot", "user.action", "error", "done"];
        for (e, n) in all.iter().zip(names) { let j = serde_json::to_value(e).unwrap(); assert_eq!(j["kind"], n); assert_eq!(&serde_json::from_value::<LiveEvent>(j).unwrap(), e); }
    }
    #[test] fn unknown_kinds_and_oversized_events_are_refused() {
        assert!(serde_json::from_str::<LiveEvent>("{\"kind\":\"bogus\"}").is_err());
        assert!(LiveEvent::ThinkingDelta { text: "x".repeat(MAX_TEXT_LEN + 1) }.validate().is_err()); assert!(LiveEvent::Done { summary: None }.validate().is_ok());
    }
}
