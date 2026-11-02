# Fake Claude Code (prototype for task #1723, 2026-11-02)

Record a real session, replay it with no Claude, no login, no network:
```
RECORD=fixtures-say3.json V3=1 MANY=1 node say.mjs haiku 3          # real Claude Code, writes every stream line with its time offset
PATH="$PWD/fake-bin:$PATH" FAKE_FIXTURE=$PWD/fixtures-say3.json V3=1 MANY=1 node say.mjs haiku 3   # replay (original timings)
... FAKE_SPEED=20 ...                                                # 20x faster for unit/e2e tests
```
`fake-bin/claude` ignores the flags, emits an init message, then for each user message on stdin replays the next recorded turn's lines (stream events + result) with their `dt` offsets.
Result: same answers and validity; timings reproduce (turn 1 +0.35 s from process start); at 20x a turn takes ~0.1 s. Fixture size 48 KB for 3 turns (all partial messages kept; compress later by dropping `usage`/`stream_event` noise the app ignores).
For the app: the helper takes a `claudeBin` setting; tests point it at `fake-bin/claude`. Not done yet: fixtures per example project and request class, error/limit scenarios (logged out, limit reached, invalid ops), the fake local-model router.
