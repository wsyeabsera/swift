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
