# Wave 4 contract — TODO-12, 13, 14, 15, 16, 17

Same rules as earlier waves. Baseline: **112 tests** (host 53, client 59), HEAD `235a11e`.

## Ownership

| scope | files | owner |
| --- | --- | --- |
| host | `lib/git.js`, `lib/index.js`, `test/host.test.js` | `host-git` |
| client | `lib/client.js`, `test/client.test.js` | `git-ui` |

## Host: every action goes through `performAction` + `ACTION_FIELDS`

All argv arrays, never a shell. Every ref-like argument passes the existing
validator. Every action returns `{ message, output }` via the existing envelope;
failures throw `GitGraphError` with git's stderr attached (TODO-2 already forwards
it as `error.output`). Destructive modes are explicit arguments — never implicit.

| action | fields | argv / semantics |
| --- | --- | --- |
| `merge` | `hash`, `noFastForward`?, `noCommit`?, `squash`? | `git merge [--no-ff] [--no-commit] [--squash] <hash>`; conflicts surface git stderr, no auto-abort |
| `resetToCommit` | `hash`, `mode` (`soft`/`mixed`/`hard`) | `git reset --<mode> <hash>`; `mode` required and validated |
| `pullBranch` | `remote`?, `branch`?, `noFastForward`?, `rebase`? | `git pull [--no-ff | --rebase] [<remote> [<branch>]]` |
| `pushBranch` | `remote`?, `branch`?, `setUpstream`?, `force`? | `git push [-u] [--force-with-lease] [<remote> [<branch>]]`; `force` means `--force-with-lease` (never bare `--force`) |
| `rebase` | `onto` | `git rebase <onto>` (non-interactive only) |
| `dropCommit` | `hash` | Remove one commit with `git rebase --onto <hash>^ <hash>`; refuse when `hash` is HEAD or has children reachable from any ref (check first, `BAD_REQUEST` with the reason) |
| `mergeCommit` | `hash` | Alias of `merge` with `noCommit: false` |
| `createBranchFromCommit` | `name`, `hash` | `git branch <name> <hash>` (already covered by `createBranch`, keep it) |
| `pushTag` | `name`, `remote`? | `git push <remote> <tag>` |
| `stashPush` | `includeUntracked`?, `message`? | `git stash push [-u] [-m <message>]` |
| `stashApply` | `index`, `reinstateIndex`? | `git stash apply [--index] stash@{<index>}` |
| `stashPop` | `index`, `reinstateIndex`? | `git stash pop [--index] stash@{<index>}` |
| `stashDrop` | `index` | `git stash drop stash@{<index>}` |
| `branchFromStash` | `index`, `name` | `git stash branch <name> stash@{<index>}` |
| `cleanUntracked` | `dryRun`? (default true from the UI) | `git clean -fd` (+`-n` when dryRun) |
| `resetUncommitted` | `mode` (`mixed`/`hard`) | `git reset --<mode>` (HEAD), then report remaining dirty count |
| `stashUncommitted` | `includeUntracked`? | same as `stashPush` (separate name for the uncommitted pane) |
| `resetFileToRevision` | `path`, `hash` | `git checkout <hash> -- <path>` |
| `addRemote` | `name`, `url` | `git remote add <name> <url>` |
| `editRemote` | `name`, `url` | `git remote set-url <name> <url>` |
| `deleteRemote` | `name` | `git remote remove <name>` |
| `pruneRemote` | `name` | `git remote prune <name>` |

`stash@{n}` indexes must be integers `>= 0` (validate; never interpolate raw text).
`hash`/`onto` are validated as refs; `path` as a repo-relative path (existing helper).
`remote` names validated with the same ref validator.
`mode` values validated against the literal set.

### New read routes

- `POST /api/dsh-git-graph/stashes` → `{ isRepo, stashes: [{ index, hash, message, author, time }] }`
  from `git stash list --format=…` (reflog format; one call).
- `POST /api/dsh-git-graph/tag` → `{ name, annotated, tagger: { name, email, time } | null, message }`
  for one tag (`for-each-ref refs/tags/<name>` + `cat-file tag`), `BAD_REQUEST` when the name
  is not a tag; lightweight tags return `annotated: false` with a null tagger and the commit subject.
- `POST /api/dsh-git-graph/remotes` → `{ isRepo, remotes: [{ name, fetchUrl, pushUrl }] }`
  from `git remote -v` (dedupe fetch/push pairs).
- The `graph` value additionally reports `stashes` as chips (see below) only if cheap: add
  `stashes: [{ index, hash, message }]` to the graph value when `showStashes` config is on
  (new config key, default `true`). Do not change commit fetching.

### Graph: stash refs

When `showStashes` is on, append stash entries to the graph's `refs` array as
`{ name: "refs/stash@{n}", shortName: "stash@{n}", type: "stash", hash, head: false, upstream: null }`
so the client can render chips without a second request. Keep `stashes` out of the
commit walk unless already reachable.

### `git_graph` tool

Unchanged: five read-only actions, same parameters. Do **not** expose any new action.

## Client

### C1. Wire the new actions

- Commit menu / detail action row: merge into this commit, rebase onto this commit,
  drop this commit (disabled with a reason for HEAD / a commit with children),
  reset current branch to this commit (mode picker: soft/mixed/hard, hard shows the
  dirty-worktree warning), create branch (exists).
- Branch menu: merge, pull, push, rebase (branch as `onto`), reset…, rename, delete,
  fetch into local branch.
- Tag menu: push tag, delete, **tag details** (shows tagger name/email/time and message;
  lightweight tags say so).
- Uncommitted pane: stash all, stash including untracked, clean untracked (dry-run first,
  show the file list, then confirm), reset uncommitted (mixed/hard with confirmation),
  discard one file to HEAD.
- Stash chips in the graph open a stash menu: apply, pop, drop, branch from stash.
- Remote management: a small section (or menu) listing remotes, add / edit / delete / prune.
  A repository with no remotes is a normal state, not an error.

### C2. Multi-field dialogs

Extend `ActionDialog` with the shapes this needs — keep one dialog component, declarative:
`needs: "rename"` exists; add `needs: "url"` (name + url), `needs: "mode"` (mode picker),
`needs: "hashAndMode"` (reset-to-commit), and boolean options (`noFastForward`, `noCommit`,
`squash`, `force`, `includeUntracked`, `dryRun`, `setUpstream`, `reinstateIndex`) rendered as
checkboxes from a declarative `options: [{ key, labelKey }]` list. No one-off dialogs.

### C3. Guardrails

- `hard` reset, `clean`, `dropCommit`, `push --force-with-lease` must show an explicit
  consequences warning in the dialog (reuse `dgg-dialog-warning`), never `window.confirm`.
- `clean` runs dry-run first and shows the files it would remove; the confirm action is
  disabled until the dry-run result is shown.
- After any successful action, refresh the graph; after stash actions also refresh the
  stash chips.
- Busy state disables every menu item while one action runs.

### C4. Localization

Every new string in zh + en and in `CONTRACT_KEYS`.
