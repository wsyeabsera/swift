---
description: Use when the user wants to look at or change the open Swift Canvas design (read a frame, edit nodes, change a design token, undo).
---

# Swift Canvas

The `swift` MCP server talks to the running Swift Canvas helper and the open app. The helper and the app must be running; if a tool says the helper is not running, tell the user to start it (`swift-canvas status`) and stop.

Tools (they show as `mcp__plugin_swift-canvas_swift__<name>`):

- `read_subtree`: read a node and its children. Always read before editing.
- `apply_ops`: apply a batch of ops (max 200) as ONE undo step. Core validates and dry-runs the batch; fix the reported error and resend.
- `set_token`: set a design token (for example `--ac`) instead of editing every node.
- `undo`: undo the last step. Use it when an edit went wrong.

Order: `read_subtree`, then `apply_ops` (or `set_token`), then `read_subtree` again to confirm. Prefer one batch over many small calls.

More tools: `list_frames`, `check`, `screenshot`, `export`, `artifact_page` (read side), `list_templates`, `new_from_template`, `fill_slots` (templates). For "make a page for X" use the `template` skill; for edits and fixes use the `design-loop` skill.
