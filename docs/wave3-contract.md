# Wave 3 contract — TODO-5, TODO-9, TODO-10, TODO-11 + renameBranch

Append to `CONTRACT.md` / `docs/wave2-contract.md`; same rules apply (plain ESM,
no deps, no profile writes, `node --check` + `node --test` green, zh+en for every
visible string, theme tokens only, no `document.body`, no `window.confirm`).

Baseline at the start of this wave: **87 tests** (host 46, client 41), HEAD `384c5df`.

## Ownership

| scope | files | owner |
| --- | --- | --- |
| host | `lib/git.js`, `lib/index.js`, `test/host.test.js` | `host-git` |
| client | `lib/client.js`, `test/client.test.js` | `git-ui` |

Neither side edits the other's files; the lead integrates and commits.

---

## Host additions

### H1. `renameBranch` action (unblocks the branch menu)

`performAction` case `"renameBranch"`, args `{ name, newName }`:
`git branch -m <name> <newName>`. Validate BOTH names with the existing ref
validator (no leading `-`, no spaces, no `..`, no `@{`, no trailing `.lock`/`/`).
`ACTION_FIELDS.renameBranch = ["name", "newName"]`. Message: `Renamed branch "a" to "b".`
Add `renameBranch` to the UI action enum nothing else needs to change.

### H2. Graph filtering and ordering (unblocks TODO-10 and TODO-11)

`readGraph(cwd, options)` gains two optional inputs, both already in the request
body of `POST /graph`:

```jsonc
{ "sessionId": "…", "path": "…", "limit": 400,
  "branches": ["main", "feature"],      // optional; omitted/empty = every ref
  "order": "date" | "author-date" | "topo" }
```

- `branches` (array of strings): restrict the revision walk to those refs.
  Validate each with `isValidRefName`; unknown ref → `BAD_REQUEST` naming it.
  Omitted or `[]` keeps today's behavior exactly (all branches, tags and,
  when configured, remotes plus HEAD).
- `order`: `"date"` → `--date-order` (today's behavior, the default),
  `"author-date"` → `--author-date-order`, `"topo"` → `--topo-order`.
  Any other value → `BAD_REQUEST`.
- The `git_graph` tool keeps its current five actions and parameters; do not add
  these options to it.

## Client additions

### C1. Branch / tag context menus (TODO-5)

Extend the TODO-3 menu machinery to ref chips:
- Right-click (and Shift+F10) on a **branch chip** opens a menu: checkout branch,
  rename branch…, delete branch, copy branch name.
- Right-click on a **tag chip**: delete tag, copy tag name.
- Right-click on a **remote chip**: copy ref name, fetch (disabled with a reason when
  the repo has no remotes).
- Reuse the existing `openDialog`/`startAction`/`actionArguments` path for every
  mutating item; never construct a request in the menu code. `renameBranch` needs
  two text inputs — extend `ActionDialog` with a second field (`needs: "rename"`)
  rather than building one-off UI.
- Pure helper `refMenuItems(chip, context)` → `[{ id, labelKey, kind, disabled?, reasonKey? }]`;
  test it directly for all three chip kinds, including that the checked-out branch
  can be checked out but not deleted, and that an unknown chip kind yields no items.

### C2. Find control (TODO-9)

- A search affordance in the toolbar (magnifier icon) toggles an input row.
- Filters the **already loaded page** client-side (no host call): case-insensitive
  substring over subject, author name, full hash and short hash, and ref labels.
- Shows `N/M` matches and moves between them (Enter / Shift+Enter, plus prev/next
  buttons) with `scrollIntoView`-free behavior — mark the active match and let the
  browser scroll it with `element.scrollIntoView({ block: "nearest" })` on a ref.
- Escape clears the query and closes the row; an empty query restores the full list.
- Pure helper `filterCommits(commits, query)` → `{ matches, indices }` and
  `nextMatch(index, length, direction)`; test both.

### C3. Branch filter control (TODO-10)

- A filter affordance listing local branches with checkboxes (multi-select) plus an
  "all" reset. Selection is per tab session (component state; no persistence needed).
- Passes `branches` through the existing `graph` request body; clearing the filter
  omits the field entirely (so behavior equals today's).
- Pure helper `branchFilterOptions(refs)` → `[{ name, isHead, selectedByDefault }]`;
  test it.

### C4. Sort order (TODO-11)

- A small select in the toolbar overflow menu with the three orders; request body
  carries `order`; default `date` omits the field.
- Include an invariant test that the default request body is byte-identical to
  today's (no new keys when nothing is chosen).

### C5. Localization

All new strings get zh + en and must be added to `CONTRACT_KEYS` in
`test/client.test.js` (that array is asserted for parity).
