# Nightly eval (real Claude Code)

Drives the real app + helper + local Claude Code login. Never part of `npm run e2e` or `npm test`.

## Run
`node e2e/nightly-eval.mjs` (all 19 requests in `e2e/nightly-requests.json`); `LIMIT=6` runs the first 6 (one per class). `REPORT=path` overrides the output.
Needs `target/debug/swift-canvas-helper` built, port 5173/7431 free, `claude` logged in. Project data goes to a temp `SWIFT_DATA_DIR`.
Classes: token, property, add (Say on tvdash), spark (x4 on tvdash), blank-add, blank-spark (project created from a scanned folder: this repo's `app/`).
Output: `e2e/nightly-report.json` {date, model, results[], stats per class (valid rate, p50/p95 first change, p50 total), regressions}; a one-screen summary.
Exit 0 ok, 1 regression (a class's valid rate dropped, or p95 first change > 25% worse), 2 run aborted.
Baseline: the previous `nightly-report.json`; on the first run `docs/say-regression.json` (Say classes only; `full` maps to `add`). Edit requests are undone and takes discarded after each request.
Caveat: with few samples per class, p95 is the max, so small runs are noisy; judge LIMIT=6 runs loosely. Model is whatever the app/helper selects; the report records the `claude` CLI version.

## Schedule (text only, nothing installed)
cron: `15 2 * * * cd /Users/yab/Hobby/swift-canvas && /usr/local/bin/node e2e/nightly-eval.mjs >> /tmp/nightly-eval.log 2>&1`
launchd: `tools/com.swiftcanvas.nightly-eval.plist` (not installed; install and remove commands are in its header comment). The report records the model name and each Spark row a `diversity` score (mean pairwise Jaccard distance of what each take changed vs the base: 0 identical, 1 disjoint; 0.66 measured on tvdash).
(The Mac must be awake and logged in; PATH must include `claude`.)

## Cost
Full run: 16 Say requests (1 small session each) + 3 Spark runs (4 sessions each) = about 28 sessions, roughly 5-8 minutes, a few percent of a daily subscription window. LIMIT=6 is about 12 sessions. Uses the subscription only, never an API key.
