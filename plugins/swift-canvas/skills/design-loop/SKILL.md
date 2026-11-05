---
description: Use when changing, fixing or polishing a design in the open Swift Canvas project (edit elements, fix Critique findings, change a token), and for the final check and share step.
---

# Swift Canvas: the edit loop

Tools are on the `swift` MCP server (`mcp__plugin_swift-canvas_swift__<name>`). The helper and the app must be open.

Loop:

1. `list_frames` to find the frame id (the selected frame is included).
2. `read_subtree` to learn element ids and current values. Always read before editing; never guess ids.
3. `apply_ops`: ONE batch for the whole change (max 200 ops, one undo step). Core validates it first; on an error read the message, fix the batch, resend. Use `set_token` when a brand value (color, radius) should change everywhere instead of editing nodes.
4. `check` after EVERY edit batch, on the frame you touched. Findings carry the element id (`el`), a message and sometimes a safe `fix` {prop,value}; pass those fixes to `apply_ops`, then `check` again. Set `judge` true only for a final pass (slower, asks Claude about hierarchy, spacing, copy).
5. `screenshot` the frame to confirm a visual change; do not trust the ops alone.
6. If a step made things worse, `undo` it (one call per batch) instead of piling on repairs.

Finish: `export` previews by default (targets html, react, tokens, project); call again with `confirm` only when the user wants the content. `artifact_page` builds the whole project as one self-contained HTML page: write its `html` to a file and publish it with the Artifact tool (pass the earlier artifact `url` to update it).

Keep the loop short: batch edits, one `check` per batch, no screenshots between every op.
