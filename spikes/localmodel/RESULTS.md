# Spike #1709: local model routes a Say request (2026-11-02)

Qwen3-4B-Instruct-2507 4-bit via `mlx-lm` 0.32 (Python 3.12 venv made with `uv`; Python 3.15 failed on `sentencepiece`), M2 Pro 16 GB,
model load 1.9 s. 30 Say requests labelled token / property / full by hand (`cases.json`). `route.py`, `route2.py`.

| Pass | Accuracy | Median | p95 |
|---|---|---|---|
| 1: short instructions, no cache | 24/30 = 80% | 492 ms | 518 ms |
| 2: 15 worked examples + cached system prefix | 29/30 = 97% | 199 ms | 215 ms |

Pass 2 meets the bar (>= 90%, < 400 ms). Only miss: "make the glass thicker" (a glass style is a token; model said property).

## Caveats
- 30 cases I labelled myself, and I wrote the worked examples after seeing pass-1 misses: likely optimistic. Needs ~100
  held-out requests from real Say use before trusting the number.
- Memory with a loaded canvas not measured (model ~2.5 GB).
- **Apple's on-device model is not available here**: this Mac runs macOS 15.5; Foundation Models needs macOS 26.
- The prefix cache is what buys the speed (the examples are processed once); keep the examples fixed.
- Run measured while another Playwright job was active, so times are, if anything, pessimistic.
