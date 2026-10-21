# dsh-git-graph

A Git commit graph for the **DeepSeek Harness Web right sidebar**. It ports the core
experience of [mhutchie/vscode-git-graph](https://github.com/mhutchie/vscode-git-graph) to
DSH: a commit graph with lanes, branches, tags and diffs, plus the everyday Git actions —
without leaving the conversation.

This is an original implementation (no source code copied from the VS Code extension); it
targets the DSH Web UI and the Harness plugin model.

## What it does

- **Entry in the right sidebar.** On the right-sidebar guide page (开始) the plugin adds a
  **Git Graph / Git 图谱** card next to *工作区文件*, *上下文* and *新建终端*. Selecting it opens
  the graph as a tab in the right column.
- **Commit graph**: colored lanes (rounded or angular), merge/octopus commits, branch/remote/tag
  and stash chips, HEAD marker, dirty indicator, hover tooltips (containment + which refs),
  in-page find, **full-history search** (`POST /search`, paginated, scan-limit notice), branch
  filtering with **glob patterns** (`*`, `**`, `?`, `[abc]`, `!` negation), column visibility,
  sort order, configurable date type/format, muted merge/non-ancestor rows, auto-load pagination.
- **Commit details**: author/committer, timestamps, parents, refs, signature status, stats,
  changed files (flat or tree view) with per-file review checkboxes, review progress, and
  expandable unified diffs.
- **Comparison view**: Ctrl/Cmd+click two commits (or use the menu) to compare trees, swap
  sides, and diff any file; the same review marks apply. **Working tree vs a commit** is one
  menu item away (tracked + untracked files, per-file working-tree diffs).
- **Uncommitted changes**: a synthetic row above the graph with staged / unstaged / untracked
  groups, per-file diffs, stash-all, clean (dry-run first), reset and per-file discard.
- **Actions** (all confirmed in-panel, destructive ones with explicit warnings): checkout
  branch/commit, create/rename/delete/merge/pull/push/rebase/reset branches, fetch into a
  local branch, fetch, push to multiple remotes, cherry-pick, revert, merge, rebase onto, drop
  and reset to commits, create/delete/push tags with annotated tag details, the full stash
  family, and remote add/edit/delete/prune.
- **Multiple repositories**: discovered under the workspace, switchable from the toolbar, with
  every path fenced to the workspace (`OUTSIDE_WORKSPACE` otherwise).
- **Presentation**: rounded/angular graph style, custom lane colours, emoji shortcodes (plus
  custom mappings), issue links, mailmap, inline-Markdown subset in messages and tag details,
  reference-label alignment/combining, dialog defaults, context-menu visibility, enhanced
  accessibility indicators, repository dropdown order — all driven by the config surface.
- **Shortcuts**: `keyboardShortcut.*` remapping with strict modifier matching, Ctrl/Cmd+Up/Down
  child/parent navigation, and an opt-in document-level scope (`globalShortcuts`).
- **Agent tool `git_graph`** (read-only): `log`, `show`, `diff`, `branches`, `status` for the
  current Session workspace, sharing the exact same Git layer as the UI.

## Install

From a DSH profile:

```
plugin_manager install_bundle  target=/home/wp/dsh-git-graph
```

The bundle patch inserts one row (`dsh-git-graph`); the package's `dsh.client` declaration
makes the Web UI load `lib/client.js`.

## Configuration

The row's `config` is read defensively; edit it in `cordis.patch.yml`. The plugin accepts the
**whole upstream settings surface** — all 110 keys from vscode-git-graph v1.30.0, written
without the `git-graph.` prefix (for example `repository.commits.initialLoad`, `graph.style`,
`keyboardShortcut.find`). Legacy flat spellings and their nested canonical keys are both
accepted, and conflicts resolve in favour of the canonical key.

- [docs/settings-parity.md](docs/settings-parity.md) is the per-key disposition table:
  **71 mapped** (real behaviour here), **10 vscode-only**, **29 out-of-scope** (each with a
  reason), plus the 29-key presentation payload the client receives.
- Host-level keys: `repoPath` (pin the repository; empty = session workspace) and `maxCommits`
  (caps the default graph page).
- DSH extensions on top of the upstream keys: `showEmoji`, `issueUrlTemplate`,
  `globalShortcuts`; DSH compat spellings `showSignature` / `showRemoteBranches` /
  `showStashes` fold into their canonical keys.

**Defaults that changed with the upstream alignment:** `fetch` no longer prunes implicitly
(`repository.fetchAndPrune` / `fetchAndPruneTags` are opt-in, as upstream); the default graph
page is 300 commits (`repository.commits.initialLoad`, previously 400); the default lane palette
is the upstream 12-colour list.

## Files

| file | purpose |
| --- | --- |
| `lib/index.js` | Host plugin: cwd resolution, `/api/dsh-git-graph/*` routes, `git_graph` tool |
| `lib/git.js` | Dependency-free Git command layer (parsing, caps, ref validation) |
| `lib/client.js` | Browser half: right-sidebar tab type, guide card, graph/details/actions UI |
| `cordis.patch.yml` | Bundle patch (inserts the `dsh-git-graph` row) |
| `locale/*.json` | Plugin Manager title/description (en, zh) |
| `icon.svg` | Plugin artwork |
| `lib/settings.js` | 110-key upstream settings surface, alias folding, presentation payload |
| `docs/parity.md` | Migration report vs vscode-git-graph v1.30.0: what landed, what did not, and the evidence used |
| `docs/settings-parity.md` | Per-key disposition table for all 110 upstream settings |
| `docs/todolist.md` | Actionable backlog (26 items) with file scope and acceptance criteria per item |
| `docs/wave8-contract.md` | Contract for the wave that closed the last five gaps (search, working-tree compare, settings, client staging) |

## Migration status

**Complete at the capability level, and the last five residual differences are closed**
(wave 8): server-side full-history search, custom branch globs, working-tree-vs-commit
comparison, configurable/global shortcuts, and per-key disposition of all 110 upstream
settings. What remains is only the six explicitly declared non-goals in
[docs/parity.md §5.2](docs/parity.md) (column-width drag, `git archive`, avatars, PR-creation
integrations, cross-workspace batch review, repo-config import/export).

- [docs/parity.md](docs/parity.md) — evidence-backed gap report; §5.1 lists what wave 8 closed.
- [docs/todolist.md](docs/todolist.md) — 26 items, all `[x]`, no open sub-items.

Verification: `node --test` → **303/303** (host 102, client 155, settings 46), real-repository
probes for search/compare/settings behaviour, and a cross-end check that feeds the client's
actual request bodies through the registered host routes (14/14). Not verified in this
workspace: pixel-level layout and live click/hover behaviour in the browser (no browser
control in the session), and GPG-signed commits (no `gpg` available — only the unsigned `N`
path was exercised).

## Notes

- The graph reads the repository at the Session's effective working directory (or
  `repoPath`); it never creates commits on its own.
- Actions are user gestures in the panel. The agent tool is deliberately read-only.
- Requires `git` on `PATH` on the Host.
