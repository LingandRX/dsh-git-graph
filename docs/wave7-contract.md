# Wave 7 contract — closing A6, A8, A9 and multi-remote push

Final gap-closing wave. Baseline: **183 tests** (host 83, client 100), HEAD `67d9033`.

## Ownership

| scope | files | owner |
| --- | --- | --- |
| host | `lib/git.js`, `lib/index.js`, `test/host.test.js` | `host-git` |
| client | `lib/client.js`, `test/client.test.js` | `git-ui` |

## Host: push to multiple remotes (parity "push 到多远端")

`performAction` case `"pushToMultipleRemotes"`, args `{ branch, remotes }`:
- `remotes` is a non-empty array (cap 10) of remote names; each validated with the ref
  validator; `branch` validated too. Missing/empty/too many → `BAD_REQUEST`.
- Run `git push <remote> <branch>` **once per remote**, collecting results; a failure does
  not stop the remaining remotes (report them all). Return
  `{ message, output }` where `message` summarizes `pushed 2/3 remotes` and `output`
  lists one `remote: ok|failed (...) ` line per remote.
- `ACTION_FIELDS.pushToMultipleRemotes = ["branch", "remotes"]`.
- Tests: two remotes (bare repos in tmp) both receive the branch; one failing remote is
  reported while the other succeeds; BAD_REQUEST for empty/missing/unsafe/over-cap input.

**Out of scope this wave** (do not build): `git archive`, server-side full-text search,
compare-working-tree-with-commit. They are recorded as declared non-goals in the parity doc.

## Client

### C1. Column visibility (A6)

- The toolbar overflow menu gains three checkboxes: show author, show date, show hash
  (`presentation`-independent, component state, default all on).
- When off, the corresponding part of the row meta line is omitted (author, relative
  date, abbrev respectively). Column *width dragging* is explicitly out of scope — the
  sidebar is 380–520 px wide and has no resizable table; record that in the UI comment.
- Pure helper `rowMetaParts(commit, visibility, lang)` → the array of meta segments so
  the omission rules are unit-testable.

### C2. File tree view (A8)

- The detail and comparison views get a segmented toggle: flat (status groups, today) vs
  tree (directory hierarchy).
- Tree mode groups by path segments with collapsible directories, directories sorted
  first then files, and every file keeps its review checkbox and diff expansion.
- Pure helper `buildFileTree(files)` → `{ nodes: [{ type: "dir"|"file", name, path, children?, file? }], fileCount }`;
  a single-child directory chain is compacted (`a/b/c`) like the upstream "compact folders".
- Default stays flat, so existing behavior and tests are unchanged.

### C3. Remaining tab shortcuts (A9)

- `Ctrl/Cmd+S` moves to the next stash-containing commit and `Ctrl/Cmd+Shift+S` to the
  previous one (stash refs already arrive in the graph value), scrolling it into view;
  disabled with no visible effect when the page has no stash commits.
- In the detail view, `ArrowUp`/`ArrowDown` open the detail on the commit above/below the
  current one in the displayed order (plain order, no branch-following).
- Keep the existing typing-target guard and Escape ordering; update the comment listing
  the tab-scoped shortcuts.

### C4. Multi-remote push UI

- Branch menu gains "push to multiple remotes…": a dialog with the branch name and a
  checkbox list of remotes (from the `/remotes` data the panel already loads), plus the
  existing force checkbox; submits `{ branch, remotes, force? }` — if `force` is ticked,
  pass it through per remote by sending one action per remote instead (the host action
  takes no force), or omit the force option from this dialog and document why.
- Show per-remote results from `output` in the feedback disclosure (already exists).

### C5. Localization

Every new string zh + en and in `CONTRACT_KEYS`.
