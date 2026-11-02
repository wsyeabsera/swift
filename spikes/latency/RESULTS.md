# Spike #1707: Say through the local Claude Code (partial, 2026-11-02)

Claude Code 2.1.316, Haiku, one persistent process per session, `--input-format stream-json --output-format stream-json
--include-partial-messages`, trivial prompt ("Reply with exactly one word: ok"), no API key (`ANTHROPIC_API_KEY=''`).
"lean" = `--tools '' --disable-slash-commands --strict-mcp-config --setting-sources project`. `node measure.mjs lean 4`.

| Setup | Turn 1 first token | Warm turns first token |
|---|---|---|
| lean, 1 session | 1317 ms | 692-817 ms |
| default (hooks, plugins, tools) | 1865 ms | 846-1266 ms |
| lean, 12 sessions in parallel | 1.57-1.76 s | 0.63-0.93 s |

## What this says
- A warm local session answers a trivial prompt in ~0.7-0.9 s to the first token; the first turn costs ~0.6 s more, so
  pre-warm each session with a throwaway turn when a project opens.
- The lean setup is ~0.5 s faster than the default on the first turn: sessions for Say must skip user hooks and plugins.
- 12 parallel lean sessions did not slow each other visibly on this Mac (M2 Pro, 16 GB); memory not measured yet.
- The `cost` field is Claude Code's API-equivalent estimate, not billed (subscription).

## Not measured yet
Real Say input (selected subtree + design-ops output, MCP tool round trip), memory of 12 processes, usage meter drop per
Spark, the Agent SDK `startup()` path, larger models. A real Say will be slower than this trivial prompt, so the
1.5 s target is not confirmed; the local-model tier (#1713) must cover the instant part.

## Pass 2: a real Say (2026-11-02, `say.mjs`)
Persistent lean session, 2 KB selected subtree (tvdash TV idle screen) + one request, JSONL design ops out, no tools, no API key.
| Model | First token | First complete op | Total | Valid JSONL |
|---|---|---|---|---|
| Haiku (5 requests) | 0.45-1.2 s | 0.66-1.27 s (single-op answers: n/a) | 0.67-2.1 s | 5/5 |
| Sonnet (5 requests) | 1.0-1.8 s | 1.1-1.9 s | 1.5-2.7 s | 4/5 |
Applying ops as each JSONL line completes gives a first visible change of about 0.7-1.3 s on Haiku: **inside the 1.5 s target, small sample**.
Sonnet is ~0.5 s slower and had one invalid line: use Haiku for Say and keep Sonnet for heavy work. 12 parallel sessions earlier showed no slowdown;
real parallel Spark (memory, usage drop per Spark) still not measured. Subscription usage burn not measured.

## Pass 3: Spark = 12 real Say sessions in parallel (Haiku, lean, `say.mjs`, 2026-11-02)
| Turn | First token (min / median / max) | First complete op (median / max) | Total (median / max) | Valid JSONL |
|---|---|---|---|---|
| 1 (cold: instructions + 2 KB subtree) | 1.12 / 1.30 / 1.60 s | n/a (single-op answers) | 1.50 / 1.82 s | 12/12 |
| 2 (warm) | 0.42 / 0.63 / 1.14 s | 0.84 / 1.42 s | 0.85 / 1.44 s | 12/12 |
- **12 parallel sessions work**: the cold first paint of a Spark wall is ~1.5-1.8 s end to end here, inside the 2 s target; warm follow-ups ~0.85-1.4 s.
- **Memory is the cost: the 12 Claude Code processes peaked at ~3.0 GB RSS (~250 MB each)** on a 16 GB Mac that also runs Chrome (~1 GB for the canvas) and the local model (~2.5 GB). A Spark of 12 is fine; 12 held open permanently is not: pool size and idle shutdown matter.
- Same prompt in all 12 (no per-take variation), tiny output. A real Spark asks for whole directions (more tokens), so expect longer totals.
- Subscription usage burned per Spark: still NOT measured (no usage meter readable from here).

## Pass 4: Agent SDK 0.3.316 (`sdk.mjs`, Haiku, `settingSources: []`, `tools: []`, no API key; n=3 each)
| Path | First token | Total |
|---|---|---|
| `query()` cold, new process per request | 0.89 / 0.99 / 1.40 s | 1.15 / 1.19 / 1.67 s |
| `prewarm()` a spare (returns in ~0.2 s, waited 2.5 s) then `claim()` | 1.72 / 1.24 / 0.70 s | 1.80 / 1.34 / 0.88 s |
- A minimal SDK `query()` is as fast as or faster than the CLI's first turn (1.3-1.8 s), so the SDK is a fine driver; **`prewarm()` showed no consistent gain at n=3** (high variance, needs 30+ runs). A parked spare holds 230-260 MB (matches the ~250 MB per session measured).
- `claim()` needs `options.cwd` (without it the process answers `not_claimed`).
- Fastest remains a **persistent session**: 0.45-0.9 s to first token on warm turns (CLI stream-json; the SDK streaming-input mode should match, not tested).

## Pass 5: tokens per Say request (Claude Code `result.usage`, Haiku, 3 turns, 2026-11-02)
| Turn | Input (new) | Cache write | Cache read | Output | API-equivalent cost |
|---|---|---|---|---|---|
| 1 (cold, instructions + 2 KB subtree) | 2 | 2531 | 2800 | 30 | $0.00055 |
| 2 | 4 | 374 | 5016 | 72 | $0.00071 |
| 3 | 4 | 91 | 5390 | 136 | $0.00085 |
- Even with `--tools ''`, Claude Code's own prompt is ~2.8k cached tokens per session; the subtree and instructions add ~2.5k once.
- **A Spark of 12 cold sessions is ~64k input tokens (about 30k cache-written, 34k cache-read) plus ~0.4k output at this output size: roughly $0.007 API-equivalent.** Whole-direction outputs (2-4k tokens each) would dominate: ~12 x 3k = ~36k output tokens.
- The subscription's own usage meter is still not readable from here; token counts are the usable proxy for the Account board's "cost before you run" estimate (cost per Say ~0.0005-0.0009 USD-equivalent, ~5.3k tokens).

## Pass 6: 30 varied Say requests in ONE warm Haiku session (`MANY=1 node say.mjs haiku 30`, requests from `spikes/localmodel/cases.json`)
- First visible change (first complete op, or the whole answer when it is a single op): **p50 1.15 s, p95 2.38 s, max 2.59 s**: the p95 misses the 1.5 s target (the 5-request pass looked better because it was a small, easy sample).
- **No latency growth** over the session: first token median 1.24 s for turns 2-11, 0.82 s for the last 10 turns. Slow turns are the ones with long or prose answers.
- **Only 19/30 answers were valid JSONL.** 11 invalid, by request type: full 6/9, token 3/10, property 2/11. They are requests the tree cannot satisfy ("add a QR code", "write a friendlier empty state", "button text bigger" when the tree has no button, "lake photo"), where the model answers in prose. The op language needs `add`/`remove` ops, an `ask`/`cannot` op, a validate-and-repair loop, and the subtree must include enough context.
- By route (from the table below, written when this was recorded):
  - token: n=10 first visible p50 1267 ms, max 2590 ms, valid 7/10
  - property: n=10 first visible p50 985 ms, max 1290 ms, valid 8/10
  - full: n=9 first visible p50 1322 ms, max 1855 ms, valid 3/9
- Implication: send **token and property edits through the local tier first** (instant preview, #1713) and use Claude for the creative ones; budget Say by route (first visible change p50: property 0.99 s, token 1.27 s, full 1.32 s; the 2.6 s maximum was a token request) instead of one number; with the local tier answering token/property edits instantly, Claude's p95 matters mostly for the creative ones.

## Pass 7: Say through an in-process MCP tool (`mcp.mjs`, Agent SDK cold `query()` per request, Haiku, `apply_op` tool, 5 requests)
| Request | tool_use starts | first handler call (op applied) | handler calls | total |
|---|---|---|---|---|
| make the clock bigger | 1.09 s | 1.35 s | 1 | 1.99 s |
| Recent panel more transparent + heading blue | 1.99 s | 2.33 s | 2 | 4.26 s |
| dim the date and move it right | 2.31 s | 2.61 s | 2 | 3.58 s |
| tighten the rows, titles 26px | 2.35 s | 2.72 s | 12 | 9.48 s |
| hide the row meta text | 1.90 s | 2.22 s | 6 | 5.17 s |
- The first op is applied **1.3-2.7 s** after the request (vs 0.7-1.3 s for streamed JSON text on a warm session, 0.9-1.4 s to first token cold). The tool call only fires when its whole `tool_use` block is complete, the SDK runs the handler, then the model gets a result turn: totals are 2-9.5 s, growing with the number of ops.
- **Decision: the Say/Spark hot path streams JSON ops as text and applies line by line (task #1731); the in-app MCP server (#1712) serves heavy multi-step work and Claude Code sessions that drive the canvas.**

## Pass 8: Say op language v2/v3 on the same 30 requests (strict validation; `V2=1` / `V3=1 MANY=1 node say.mjs haiku 30`)
| Prompt | Valid (strict) | `ask` answers | First visible change p50 / p95 / max |
|---|---|---|---|
| v1 (set + token only, JSONL check only) | 19/30 | n/a | 1.15 / 2.38 / 2.59 s |
| v2: + text, add, remove, ask ops and a rule to ask when something is missing | 30/30 | 14 (some over-cautious) | 1.23 / 1.96 / 3.35 s |
| v3: v2 + brand tokens in scope, the list of element ids, "prefer a sensible default over asking" | 29/30 | 9 (mostly legitimate: no title/button/thumbnail in the tree, another project's palette, a Spark-sized request) | 1.24 / 3.05 / 3.63 s |
- The op language fixes validity (19 -> 29-30 of 30): the failures were a missing vocabulary, not the model. Giving it tokens and ids cuts needless asks from 14 to 9.
- Latency: p50 stays ~1.2 s; p95 rises to 2-3 s because `add` answers carry HTML. That is the creative route; token/property edits go through the local tier first.
- The tested prompt is in `OPS-PROMPT.md` (the contract for task #1731). One of 30 was still invalid (a malformed line on "lake photo"): keep the validate-and-repair loop.
