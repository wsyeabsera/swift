# Spike #1827: which MCP tools work with no app tab open

Measured 2026-11-05, debug build of `helper/`, macOS, Chrome 1280x800 headless. Probe: a stdio MCP client against `swift-canvas-helper mcp`, 5 calls per tool, p50. "No app" = helper running, no app WebSocket. "Fake app" = a client that registers with `mcp.register` and answers `mcp.req` at once, so the numbers are the relay cost alone, without the app's own work.

## Today's five tools

| Tool | Where it runs | No app | Fake app (relay only) | Hops to the app |
|---|---|---|---|---|
| `read_subtree` | app (`app/src/mcp.ts`) | error in 32 ms: "no Swift Canvas app is connected" | 32 ms | 1 |
| `apply_ops` | helper dry run (core crate), then app | same error, 32 ms | 63 ms | 2 (`tree`, then `apply_ops`) |
| `set_token` | same as `apply_ops` | same error, 32 ms | 64 ms | 2 |
| `artifact_page` | app builds the page from live frames | same error, 32 ms | 33 ms | 1 |
| `undo` | app (the Undo button) | same error, 32 ms | 34 ms | 1 |

**All five need the app tab.** `Hub::ask_app` (`helper/src/mcp.rs`) is the only path, and it fails at once with a clear message when no app is registered. Nothing hangs.

Why every call costs about 32 ms and the dry run 63 ms: each helper connection loop reads with a 30 ms timeout and flushes its outgoing channel only between reads (`helper/src/lib.rs`, `set_read_timeout(30ms)`). Every hop (MCP process to helper, helper to app, app to helper, helper to MCP process) can wait up to one tick. Real app work comes on top of this floor (the e2e `apply_ops` batch of 12 ops is measured in `e2e/mcp.mjs`).

## What the helper alone can already do (not exposed over MCP)

| Capability | Where | Headless | Time |
|---|---|---|---|
| Read and write project files | `store.rs` (`<data_dir>/<id>.project.json`, atomic) | yes, no Chrome, no app | under 1 ms (file I/O) |
| Scan a repo for brand tokens | `scan.rs`, `swift-canvas-helper scan <dir>` | yes | not timed |
| Screenshot or DOM dump of a localhost page | `capture.rs` (Chrome `--dump-dom`) | yes, needs Chrome | 0.64 to 0.88 s |
| One PNG screenshot of any HTML | Chrome `--screenshot` (as in `render.rs`) | yes, needs Chrome | 0.69 to 0.78 s |
| MP4 from frames | `render.rs` (CDP, one browser) | yes, needs Chrome and ffmpeg | 30 frames at 640x360 in 1.9 s |
| Repo export on a new branch | `repo.rs` (`repo.plan`, `repo.export`) | yes, only inside allowed folders, but reachable only from the app WebSocket role, not the MCP role | not timed |

The MCP role may only send `mcp.call` and `ping` (`handle_text`), so none of these is reachable from Claude Code today.

## What Claude Code cannot do today

| Need | Missing | Where the code already is | Headless? |
|---|---|---|---|
| List frames and projects | `read_subtree` returns `frames` ids of the open project only; no project list | project files in the data dir (`store.rs`) | yes, from files; the open project needs the app |
| Critique findings (`check`) | no tool | `app/src/canvas/critique.ts` (prompt and parser) plus `audit.ts` facts; the model call goes through the helper's `say` | needs app for live facts; an LLM call through the local login |
| Screenshot | no tool | helper Chrome shot (0.7 s) of HTML from `artifact_page` or a frame snapshot | yes once it has the HTML |
| Export (html, react, artifact) | only `artifact_page`; no frame HTML, React or Tailwind | `app/src/ship.ts` `TARGETS`, `publish.ts` | needs app |
| Templates | nothing in `app/src` | to build in group 9 | n/a |
| Tour | nothing | task #1843 | n/a |

## Findings that change the plan

1. **No app tab means no design tools.** Claude Code in a terminal must open the app first. A headless mode is only worth it for the read side (list, screenshot of a saved project), not for editing, because edits and undo live in the app.
2. **Read-side tools can be mostly headless.** `list_frames` and `screenshot` can work from the saved project file plus the helper's Chrome, with no app, at about 0.7 s a shot. `check` and `export` need the app's live state; offer them with the same "open the app" error.
3. **The 30 ms read poll is the whole latency floor.** Tools that add a hop (`apply_ops` has two) pay it again. If a later task needs faster steps (the live tail in #1829 especially), wake the loop from the channel instead of polling; that is a helper change, not an MCP one.
4. **Tools to add, in this order:** `list_frames` (project list plus frames, headless from the store where possible), `screenshot` (HTML to PNG through the helper's Chrome), `check` (Critique findings), `export` (html and react targets from `ship.ts`). Then `list_templates`, `new_from_template`, `fill_slots` once the template format (#1832) exists.
5. **The MCP role needs a headless branch in `run_tool`.** Today every tool is `ask_app`. `list_frames` and `screenshot` run inside the helper, so `run_tool` gains tools that skip the app. Folder-allow-list checks that guard `repo.*` must apply there too.
