# Template authoring

A smart template is a folder you can write by hand or save from a design (`save_template`, see `docs/claude-code-quickstart.md`). The format is checked by `parseTemplate` in `app/src/template.ts`; this page says what it accepts. Version: `swiftCanvasTemplate: 1`.

## Where templates live

| Place | Read by `list_templates` |
|---|---|
| `~/.swift-canvas/templates/<name>/` (or `$SWIFT_DATA_DIR/templates`) | yes |
| built into the app | the list exists but is empty today (starter templates, #1833, not merged) |
| `<repo>/.swift-canvas/templates/<name>/` | no: `save_template` can write there, nothing reads it back over MCP yet |

At most 100 folders are read from the user folder. A user template shadows a built-in one of the same name.

## Folder layout

```
my-template/
  template.json          manifest (max 64 KB)
  frames/
    hero.html            one file per frame, named in the manifest
    pricing.html
```

Only `template.json` and `frames/*.html` are read (max 100 frame files). Symlinks and other files are ignored; oversized files make the folder a reported problem. Whole folder: 1 MB at most.

## template.json

```json
{
  "swiftCanvasTemplate": 1,
  "name": "Landing",
  "description": "Hero with three features",
  "tokens": { "--ac": "#0a84ff", "--bg": "#0b0b0f" },
  "slots": [
    { "id": "headline", "type": "text", "label": "Headline", "prompt": "One line, under 8 words, says what the product does", "default": "Ship faster", "required": false },
    { "id": "features", "type": "list", "label": "Features", "prompt": "Three short feature names", "default": ["Fast", "Safe", "Simple"] },
    { "id": "hero-image", "type": "image", "label": "Hero image", "prompt": "An https image URL" },
    { "id": "accent", "type": "color", "label": "Accent", "prompt": "Brand colour", "default": "#0a84ff" }
  ],
  "frames": [
    { "id": "landing", "file": "hero.html", "title": "Landing", "w": 1440, "h": 900 }
  ]
}
```

Fields:
- `swiftCanvasTemplate`: must be `1`. A newer number is refused.
- `name` (required, up to 60 characters), `description` (cut at 300).
- `tokens`: optional design tokens `"--name": "value"` added to the project's brand. Plain values only: no `; { } < > \`, up to 60 characters; at most 64.
- `slots`: up to 40. Each: `id` (lowercase letter first, then lowercase letters, digits, dashes, up to 40), `type`, `label` (up to 60), `prompt` (cut at 300; this is what Claude Code reads to know what to write, so make it specific), `default`, `required`.
- `frames`: 1 to 12. Each: `id` (letter first, letters/digits/`_`/`-`), `file` (a plain name like `hero.html` in `frames/`), `w` and `h` (positive numbers up to 20000), optional `title`, `root`, `x`, `y`. Frames without `x` are laid out left to right with a 120 px gap. `root` is the id of the frame's root element; by default the first `id="..."` in the file.

## Slot types

| Type | Value | Limits | Default if none given |
|---|---|---|---|
| `text` | string | 2000 characters | empty |
| `list` | array of strings; rendered as `<li>` items | 30 items, 2000 characters each | empty list |
| `image` | `https://` URL or `data:image/png|jpeg|gif|webp;base64,...` | | none: the slot is then required |
| `color` | `#hex`, `rgb()`, `hsl()` or `oklch()` | | none: the slot is then required |

A slot is required if you say so, or if it is an image/color with no default. A required slot with no value is an error when the template is used, except through MCP's `new_from_template`, which puts a `[Label]` placeholder in required empty text and list slots so the frames can be created first.

## Placeholders

In frame HTML write `{{slot-id}}` (spaces inside the braces are fine). Rules:
- Every placeholder must name a slot in `template.json`, or the template is refused. A slot never used in any frame is only a warning.
- Values are escaped as text. A `list` slot needs to sit inside a `<ul>`/`<ol>` or other list container yourself: `<ul>{{features}}</ul>` becomes `<ul><li>Fast</li>...</ul>`.
- Values are HTML-escaped (including quotes and `&`), so a placeholder is safe in element text and in a quoted attribute such as `<img src="{{hero-image}}">`. Do not put one inside a `<style>` block; use a token (`var(--ac)`) for colours instead.
- Every frame needs a root element: an element with the `id` named by `root`. Give elements stable `id`s: Critique findings, `apply_ops` and `fill_from_data` all address elements by id.
- Values may contain `{{pack.field}}` markers when filled over MCP (see the content packs table in the quickstart). That is a fill-time feature: do not put pack markers in the frame HTML itself.

## Safety rules (enforced, all or nothing)

A template is untrusted input, even your own, because folders get shared in repos. The whole folder is refused, with the reason, if a frame contains:
- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<base>`, `<form>`, `<frame>`, `<frameset>`;
- an event handler attribute (`onclick=` and so on);
- a `javascript:` or `vbscript:` URL;
- `@import`, or an external `url(...)` in a `<style>` element.

Also refused: unknown or duplicate slot/frame ids, a missing or empty frame file, a placeholder without a slot, bad sizes or tokens, anything over the size caps. Slot values are validated against their type before any frame changes, and a failed fill changes nothing.

Write images as `https://` URLs or data URLs; the sandboxed frames do not run scripts.

## Try it

1. Create `~/.swift-canvas/templates/my-template/` with the files above.
2. In Claude Code run `list_templates`. If your folder is missing, look at `problems`: it names the folder and the first thing wrong.
3. `new_from_template`, `fill_slots`, `check`, `screenshot`.

You can also build one from a design: select a frame, run `save_template { "name": "..." }`, then edit the saved `template.json` to improve labels and prompts. There is no app screen for any of this yet, and no `swift-canvas new` command.
