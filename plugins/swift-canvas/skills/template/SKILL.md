---
description: Use when the user asks to make a page, screen, landing page, pricing page, deck or other design "for X" in Swift Canvas, or to start from a template. Picks a template, fills its slots from the brief, then checks the result.
---

# Swift Canvas: start from a template

Tools are on the `swift` MCP server (shown as `mcp__plugin_swift-canvas_swift__<name>`). The helper and the app must be open; if a tool says so, tell the user and stop.

Order, do not skip steps:

1. `list_templates`: pick the template whose name and description fit the request. If none fits, say so and use the `design-loop` skill on the open frame instead.
2. `new_from_template` with the template name. It adds the frames as ONE undo step and returns the slots (id, type `text|list|image|color`, label, what to write, default, required) and an `instance` id.
3. Write every required slot yourself from the user's brief (real copy for X, not placeholders). Ask the user only for facts you cannot invent (names, prices, legal text).
4. `fill_slots` with `instance` and `values` (slot id to value: text is a string, list is an array of strings, image is an https or data:image URL, color is a color literal). Values are validated first; if one is rejected nothing changed, fix it and resend. Use `{{pack.field}}` markers (for example `{{people.name}}`) only when the user wants sample data.
5. `check` on each new frame (`list_frames` gives the ids). Apply any returned `fix` through `apply_ops` (see `design-loop`), then `check` again. Stop when no findings remain or the rest are judgment calls you report.
6. `screenshot` each frame once to confirm it looks right, and tell the user what you made in two lines.

`undo` reverts a whole template step or fill if the user does not like it. Never edit the helper's files directly.
