# Claude Code quickstart

Drive Swift Canvas from a Claude Code session in your terminal: start from a template, fill it from a brief and your repo's data, check it, screenshot it, fix it, export it. There is no separate CLI. Claude Code talks to the same in-app MCP server the app uses (`swift-canvas-helper mcp`), and every change shows up live in the open app and is one undo step there.

Template folder format: `docs/template-authoring.md`.

## What is built, what is not

Built (all in this branch): the MCP tools below, the template format and loader, five content packs, `save_template`, `fill_from_data`.

Not built (do not look for them):
- **No built-in starter templates yet.** The task for them (#1833) is separate and was not merged here. `list_templates` returns only your own folders until it lands.
- **No app UI for templates** (no "New from template" screen, no "Save as template" button, no "New from brief"). Templates are MCP only.
- **No `swift-canvas new`** or any other new CLI verb. `swift-canvas install|status|...` is the existing installer only; it does not register the MCP server with Claude Code (use the command below).
- **Plugin skills** (template, brief, watch) are written separately; this guide does not cover them.
- No repo-level template folder is read by `list_templates` (only built-in ones and `~/.swift-canvas/templates`). `save_template` with `dest: "repo"` can write `<repo>/.swift-canvas/templates`, but nothing reads that folder back over MCP yet.
- The terminal tail / second-terminal observer (#1829) and `swift-canvas doctor` (#1830) are not built.

## Setup

1. Install and start the helper and the app (see `README.md`: `npm install`, `npm run dev`, `SWIFT_DEV=1 npm run helper`, or the extension build). The helper must be running and **an app tab must be open**: almost every tool is relayed to the app.
2. Register the MCP server with Claude Code (once):
   ```
   claude mcp add swift -- swift-canvas-helper mcp
   ```
   Use the full path to the `swift-canvas-helper` binary if it is not on your PATH. If the helper uses a non-default data folder, pass `SWIFT_DATA_DIR` in the server's `env`. The MCP process reads `<data dir>/mcp.json` (port and token, written by the helper at start, mode 0600).
3. Allow a project folder for repo-reading tools (`fill_from_data`, `save_template` with `from_repo`): in the app click Choose... on the project folder, or start the helper with `SWIFT_PROJECT_ROOTS=/path/to/repo`.
4. Start `claude` and ask it to list the Swift Canvas frames. If it says "no Swift Canvas app is connected", open the app.

Latency: each call costs about 32 ms of relay on top of the app's own work; `apply_ops` and `set_token` do two hops (about 64 ms). Screenshots take about 0.7 s (headless Chrome). `check` with `judge: true` can take up to a minute. (Measured in `spikes/mcp/RESULTS.md`, debug build.)

## Tools, in the order you use them

| # | Tool | What it does | Needs the app |
|---|---|---|---|
| 1 | `list_frames` | Frames of the open project (id, name, size, lens tv/phone/desktop, selection). Pass `project` to read a saved project file; with nothing open it lists saved projects. | No when `project` is given or nothing is open |
| 2 | `list_templates` | Templates you can start from: name, description, source, slot count, frames. Also reports folders that failed to load (`problems`). | Yes |
| 3 | `new_from_template` | Adds a template's frames and brand tokens to the project with default content, as ONE undo step. Returns an `instance` id and the slots. Optional `values`. | Yes |
| 4 | `fill_slots` | You fill the slots from the user's brief: `{instance?, values: {slotId: value}}`. Validated first, all or nothing, one undo step. | Yes |
| 5 | `fill_from_data` | Reads a JSON/CSV/TSV/OpenAPI file from the project folder; with `el`, fills rows into a list or table container. | Yes (to fill) |
| 6 | `read_subtree` | Element ids, tags, text, outer HTML of one element. Call before editing by hand. | Yes |
| 7 | `apply_ops` | Batch of up to 200 ops (set, token, text, add, remove); dry-run first; one undo step. | Yes |
| 8 | `set_token` | One design token (for example `--ac`) on a frame root. | Yes |
| 9 | `check` | Critique findings, numbered, each with element id, kind, message and often a safe `fix` to pass to `apply_ops`. Local checks always run; `judge: true` also asks Claude. | Yes |
| 10 | `screenshot` | PNG of a frame. With `project`, renders a saved project with no app. | No with `project` |
| 11 | `export` | `html`, `react` (Tailwind), `tokens` (DTCG JSON), `project`. Without `confirm: true` you get a preview only; nothing is written to disk. Max 1 MB. | Yes |
| 12 | `artifact_page` | The whole project as one self-contained HTML page (max 2 MB, 24 frames), to publish as a Claude artifact. | Yes |
| 13 | `save_template` | Save the selection (or a repo's tokens) as a template folder. See below. | Yes (for a selection) |
| 14 | `undo` | Same as the Undo button. | Yes |

## The design loop

1. `list_frames`: see what is on the canvas.
2. `list_templates`, then `new_from_template` with a name. Read the returned slots: each has a type (`text`, `list`, `image`, `color`), a label, a prompt telling you what to write, a default and whether it is required.
3. `fill_slots` with values you write yourself from the user's brief. Claude Code does the writing; nothing in Swift Canvas calls Claude for this.
4. `check` on each frame. Apply the safe `fix` values with `apply_ops` (batch them). Run `check` again.
5. `screenshot` each frame to confirm it looks right.
6. `export` (preview, then `confirm: true`) or `artifact_page`.
7. `undo` steps back one batch; a template instance and a fill are each one step.

Gotchas:
- `fill_slots` right after `new_from_template` can answer "frame not ready": retry once.
- Template instances live in memory in the app: after an app reload run `new_from_template` again.
- `fill_slots` re-renders the frames from the template, so it overwrites manual edits made to those frames since.
- `new_from_template` puts a visible placeholder like `[Headline]` in required text/list slots that have no default, so you see what is still unfilled.

## Content packs (realistic data, not lorem ipsum)

Any text or list slot value may contain `{{pack.field}}` markers; `fill_slots` and `new_from_template` replace them with realistic values. Output is deterministic per template instance (same instance, same values), and an unknown pack or field is an error, not silent filler.

| Pack | Fields | Shortcuts |
|---|---|---|
| `people` | first, last, role, company, city, joined | `people.name`, `people.email` |
| `products` | name, category, price, rating, reviews, sku | |
| `orders` | id, status, total, items, date | `orders.label` ("Order #12345") |
| `metrics` | revenue, users, conversion, churn, delta, day, kpi | |
| `copy` | headline, subhead, cta, quote | |

Example: `fill_slots` with `{"values": {"customer": "{{people.name}}", "plan": "{{products.name}}", "total": "{{orders.total}}"}}`. Several packs have German and other locale lists; money, number and date formats follow the locale. The packs live in `app/src/content/packs/*.json`. Whole-row record helpers and chart series exist in `app/src/content/pack.ts` for code, but there is no MCP tool for them yet: use markers.

## Bind real data (`fill_from_data`)

```
fill_from_data { "path": "data/users.csv" }                       // read only: returns columns and rows
fill_from_data { "path": "data/users.csv", "el": "user-list" }    // also fill the container
```

- Reads `.json`, `.csv`, `.tsv`, or an OpenAPI `.json` (it uses the documented example values; pass `example` such as `"GET /users 200"` to pick one, the labels found are returned). For JSON with the array deeper in, pass `pointer` (for example `/data/items`).
- `columns` picks and orders columns; `max_rows` keeps up to 200 (default 50). Cells are cut at 120 characters; what was cut is reported in `dropped`.
- With `el`, the container's first child is the row template: its text elements take the columns in order. All or nothing, one undo step. Add one example row first if the container is empty.
- Safety: only a file inside a folder you allowed (Choose... in the app, or `SWIFT_PROJECT_ROOTS`). Anything outside, hidden files such as `.env`, dependency and build folders, other file types and files over 1 MB are refused. Data is treated as text, never as markup.

## Templates in short

A template is a folder with `template.json` and `frames/*.html`. Templates are read from `~/.swift-canvas/templates/<name>/` (or `SWIFT_DATA_DIR/templates`). A folder that fails validation is listed under `problems` with the reason and never hides the good ones. A user template with the same name as a built-in one replaces it. Writing your own: `docs/template-authoring.md`.

### save_template

```
save_template { "name": "Pricing v2" }                                   // the selected frame -> ~/.swift-canvas/templates/pricing-v2
save_template { "name": "Acme", "from_repo": "/path/to/repo" }           // brand starter from the repo's scanned tokens, colours, fonts
save_template { "name": "Acme", "from_repo": "/path/to/repo", "dest": "repo" }   // into <repo>/.swift-canvas/templates
```

From a design, every plain text becomes a `text` slot (default = the original text) and bare `<li>` runs become a `list` slot; custom properties on the frame root become template tokens. It refuses to replace an existing template unless `overwrite: true`. Review the saved slots: the labels are generic, so edit `template.json` to give good prompts.
