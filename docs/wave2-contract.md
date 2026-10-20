# Wave 2 contract — TODO-3, TODO-4, TODO-6, TODO-7

Append to `CONTRACT.md`; same rules apply (plain ESM, no deps, no profile writes,
`node --check` + `node --test` must stay green, all visible text localized zh+en,
theme tokens only).

Baseline at the start of this wave: **60 tests** (host 38, client 22), all passing.

## Ownership

| scope | files | owner |
| --- | --- | --- |
| host | `lib/git.js`, `lib/index.js`, `test/host.test.js` | `host-git` |
| client | `lib/client.js`, `test/client.test.js` | `git-ui` |

Neither side may edit the other's files. The lead integrates and commits.

---

## TODO-6 (host): uncommitted changes as a value

New route `POST /api/dsh-git-graph/uncommitted`, body `{ sessionId?, path? }`.

Envelope as always: `{ ok: true, value }` / `{ ok: false, error: { code, message } }`.

```jsonc
{ "repoPath": "/abs/repo", "isRepo": true,
  "head": { "branch": "main", "hash": "…", "detached": false },
  "staged":   [ { "status": "M", "path": "lib/index.js", "oldPath": null } ],
  "unstaged": [ { "status": "M", "path": "lib/client.js", "oldPath": null } ],
  "untracked":[ { "status": "A", "path": "notes.md", "oldPath": null } ],
  "counts": { "staged": 1, "unstaged": 1, "untracked": 1 } }
```

- One `git status --porcelain=v1 -z --untracked-files=all` call, no per-file work.
- `status` is the single porcelain letter (rename `R`/copy `C` carry `oldPath`;
  an unstaged deletion is `D`, etc.). Porcelain XY is two letters: X = staged,
  Y = unstaged — put the entry in `staged` when X is not space/`?`, in `unstaged`
  when Y is not space; an entry may legitimately appear in both with its own
  letter each. `??` goes to `untracked` with status `A`.
- Not a repo → success with `{ isRepo: false, error: "NOT_A_REPO", message }`,
  matching the graph route's posture.
- Expose it on the git API as `readUncommitted(cwd)`.

Also extend `readDiff` so a diff can be requested for the working tree:

```jsonc
POST /api/dsh-git-graph/diff  { sessionId?, path?, scope: "commit" | "staged" | "unstaged", hash?, file }
```

- `scope` omitted or `"commit"` → today's behavior, `hash` required (unchanged).
- `"staged"` → `git diff --cached --patch --no-color -- <file>` (the index vs HEAD).
- `"unstaged"` → `git diff --patch --no-color -- <file>` (worktree vs index).
- Same 300 KiB cap, `truncated`, `binary` handling; no commit required for the
  two working-tree scopes.

## TODO-7 (host): commit comparison

New route `POST /api/dsh-git-graph/compare`, body `{ sessionId?, path?, base, head }`.

```jsonc
{ "base": "…", "head": "…",
  "baseAbbrev": "abc1234", "headAbbrev": "def5678",
  "stats": { "files": 3, "insertions": 10, "deletions": 2 },
  "files": [ { "status": "M", "path": "a.txt", "oldPath": null,
               "added": 5, "removed": 1, "binary": false } ] }
```

- Diff the two commits directly: `git diff --name-status -z -M <base> <head>` plus
  `git diff --numstat -z -M <base> <head>`. Use plain `git diff` (not `diff-tree`),
  so this is the tree-to-tree comparison of exactly those two commits.
- `status` letters must match `readCommit`'s vocabulary (`A M D R C T U`).
- Same ref validation as `readCommit` on both endpoints; `BAD_REQUEST` on missing
  or unsafe values.
- Diff for one file inside a comparison goes through the existing `diff` route:
  add `scope: "compare"` with `base` + `head` + `file`, running
  `git diff --patch --no-color -M <base> <head> -- <file>`.
- Expose as `compareCommits(cwd, { base, head })` on the git API.
- **The `git_graph` tool stays read-only** and does not gain these scopes; it may
  keep its current five actions unchanged.

## TODO-3 + TODO-4 (client): commit context menu

- Right-click (and the keyboard ContextMenu key / Shift+F10) on a commit row opens
  a menu at the pointer: `{ x, y, commit }`, rendered inside the tab body (never
  `document.body`), `position: fixed`, `role="menu"` with `role="menuitem"` items.
- Items for a commit: checkout commit, create branch here, cherry-pick, revert,
  create tag here, copy hash. Each item must call the SAME `openDialog`/`startAction`
  path the detail-view buttons use — no duplicate request construction.
- Close on: Escape, pointer down outside, choosing an item, scroll, resize, and
  when the selected commit disappears after a refresh.
- Keyboard: ArrowUp/ArrowDown move the active item, Home/End jump, Enter runs,
  Escape closes; the active item carries `aria-activedescendant` (or the item has
  focus) and a visible focus ring. Do not let Tab escape the menu.
- Extract the item list as a pure function `commitMenuItems(commit, context)` so it
  can be tested without rendering; return `[{ id, labelKey, kind, disabled?, reasonKey? }]`.

## TODO-6 + TODO-7 (client): uncommitted row and comparison view

- **Uncommitted row**: when `counts` is non-zero, render one synthetic first row
  above the graph (distinct style, dashed border, "未提交改动" + counts). It is NOT
  passed through `layoutGraph` (keep that function's input purely real commits —
  assert in a test that a page of real commits produces identical layout whether or
  not the synthetic row is displayed).
- Selecting it opens a detail-like pane listing staged / unstaged / untracked
  groups, each file expandable via the `diff` route with `scope: "staged"` or
  `"unstaged"`.
- **Comparison view**: after a commit is selected, Ctrl/Cmd+clicking another row
  (or a menu item "compare with …") enters comparison mode showing both abbrevs,
  a swap button, the `compare` route's file list, and per-file diffs via
  `scope: "compare"`. Escape exits comparison first, then the detail view.
- All new strings get zh + en entries in the `dshGitGraph` namespace and must be
  added to `CONTRACT_KEYS` in `test/client.test.js`.
