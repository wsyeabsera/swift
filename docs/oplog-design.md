# Op log + branches (design draft for #1741, then #1683). No code yet.

Status: DRAFT 2026-11-03. STEP 1 BUILT (`app/src/oplog.ts` + 7 tests, pure, NOT used by the app yet) with these DEFAULTS for the open questions, pending the owner: Keep = fast-forward main (refused if main moved since the fork); undo stops at the branch base; one-way v1->v2 file upgrade (not built). STEPS 2+3 BUILT (2026-11-03, owner said go): `App.tsx` undo/redo/history now run entirely on the op log (kinds: set, snap, frameDel/frameAdd, discard/restore, rename, group; `rec` tags telemetry); the old Entry list and redoStack are gone; all existing e2e undo/redo/nudge/frame-delete/discard/rename checks pass unchanged, 133 unit tests pass. STEP 4 BUILT: the log is saved with the frames in ONE localStorage write (`doc.ts`: parseLog/parseOp all-or-nothing, fitLog drops the oldest steps past 2000 ops / 1.5 MB), restored on load; e2e reloads and undoes/redoes on the restored log. UPDATE: the log now ALSO travels in the exported project file (optional `log` key, file stays version 1; a damaged log is dropped, frames still open; opening a file restores the history in the new project) and in the helper backup (restore brings the history back). e2e proves both (undo count 4 -> 4). STEP 5 (switcher) BUILT: Frame ▾ → Branches: Fork here, switch (replays exactly the difference), Keep this branch (fast-forward main), delete (never main/current/parents). e2e proves: change on a fork leaves main untouched, switch both ways, keep, delete. Found by the e2e: `fork` now DROPS the redo tail of the branch it leaves (forking is a new divergence point; otherwise keep refused with a misleading 'main has changed'), refused if another branch forks from inside that tail. Switching clears the selection. NOT built: Spark takes as branches (a PRODUCT decision, see handoff), merge/conflict (#1743), compare (#1742), trimming of multi-branch logs.

## Why
Undo today is an in-memory list of mixed entries (`edit`, `say` + whole snapshot, `frameDel`, `discard`, `rename`) in `App.tsx`. It is lost on reload, cannot be browsed, and cannot fork. Spark takes are cloned frames, not history. #1741 (branches = named forks of the op log), #1683 (V cycles variants, B branches from a take) and the History board all need ONE ordered, saved log.

## Shape (smallest that serves all three)
- `Op` = one reversible change: `{ id, t, frame, kind, ... }` with `kind` in: `set {el, prop, before, after}`, `text`, `add`, `remove` (carry the removed markup), `token`, `frameAdd/frameDel/rename` (carry what undo needs), and `say {prompt, ms, ops[]}` as a GROUP of child ops (not a snapshot). Every op stores what undo needs, so undo never needs a snapshot.
- `Log` = `{ ops: Op[], head: number }`. Undo = move head back and apply inverse; redo = forward. A new op after an undo drops the tail ONLY on the current branch (see below), instead of the redo stack being a separate structure.
- `Branch` = `{ name, base: opId, ops: Op[] }`; `main` is the first. A take or "B" creates a branch whose `base` is the op id it forked from. Switching branch = replay (base prefix + branch ops) onto the frames; deleting a branch never touches `main`.
- A Spark take stays a frame for display, but is recorded as a branch (`try-warm-room`) so Keep = make that branch the new main tip, Discard = delete the branch.
- Persisted inside the project file (`doc.ts`, `projectFile.ts` version bump to 2; v1 files load as one branch with an empty log). Export to the git folder is a later step of #1741, not part of the first cut.

## Rules to keep
- Replay must be deterministic: ops are data (no snapshots, no closures), applied through the same `edit/text/add/remove` seam the bridge already has.
- Coalescing (nudge 800 ms, drag, resize = ONE undo step) stays: a coalesced op just keeps its first `before` and last `after`.
- Size cap: log capped (e.g. 2000 ops / 2 MB); beyond it the oldest ops fold into a new base snapshot, never silently dropped.
- Failure modes tested: corrupt/old stored log -> load as empty with a message (like `doc.ts` all-or-nothing parse); replay failure on one op -> stop at that op and say which.

## Non-goals for the first cut
Merge and conflict view (#1743), compare (#1742), cross-device sync, git export. Branch UI beyond a switcher menu.

## Migration of existing code (the real cost)
`App.tsx` undo/redo (~60 lines) and every push to `history.current` (edit, say, frameDel, discard, rename, drag, resize, nudge, delete, library insert) move behind `log.apply(op)`. Existing e2e undo/redo checks (local, nudge hold, say, frame delete, discard, rename) are the regression net: all must pass unchanged.

## Order of work
1. `oplog.ts` pure module + unit tests (apply/undo/redo/branch/replay, caps, parse) with NO UI.
2. Move the `edit` and `say` paths onto it, keep everything else on the old list (both lists coexist for a step), e2e green.
3. Move the remaining entry kinds; delete the old list.
4. Persist in the project file; v1 compat test.
5. Branch switcher + take<->branch mapping (this is #1741's UI and unlocks #1683).

## Open questions for the owner
1. Is "Keep take" = fast-forward main to the take's branch (my proposal), or a copy?
2. Should undo past a branch point be allowed (walks back into the parent) or stop at the base?
3. Is v1 -> v2 project-file migration acceptable without a downgrade path?
