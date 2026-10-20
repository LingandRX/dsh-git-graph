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
  find, branch filtering, column visibility, sort order, load-more pagination.
- **Commit details**: author/committer, timestamps, parents, refs, signature status, stats,
  changed files (flat or tree view) with per-file review checkboxes, review progress, and
  expandable unified diffs.
- **Comparison view**: Ctrl/Cmd+click two commits (or use the menu) to compare trees, swap
  sides, and diff any file; the same review marks apply.
- **Uncommitted changes**: a synthetic row above the graph with staged / unstaged / untracked
  groups, per-file diffs, stash-all, clean (dry-run first), reset and per-file discard.
- **Actions** (all confirmed in-panel, destructive ones with explicit warnings): checkout
  branch/commit, create/rename/delete/merge/pull/push/rebase/reset branches, fetch into a
  local branch, fetch, push to multiple remotes, cherry-pick, revert, merge, rebase onto, drop
  and reset to commits, create/delete/push tags with annotated tag details, the full stash
  family, and remote add/edit/delete/prune.
- **Multiple repositories**: discovered under the workspace, switchable from the toolbar, with
  every path fenced to the workspace (`OUTSIDE_WORKSPACE` otherwise).
- **Presentation**: rounded/angular graph style, custom lane colours, emoji shortcodes, issue
  links, mailmap support, tab-scoped shortcuts (Ctrl/Cmd+H/R/F/S).
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

The row's `config` is read defensively; edit it in `cordis.patch.yml`:

| key | default | meaning |
| --- | --- | --- |
| `repoPath` | `""` | pin every session to this repository path; empty = the session workspace |
| `maxCommits` | `400` | default number of commits loaded in the graph |
| `showRemoteBranches` | `true` | include `refs/remotes/*` chips and commits |

## Files

| file | purpose |
| --- | --- |
| `lib/index.js` | Host plugin: cwd resolution, `/api/dsh-git-graph/*` routes, `git_graph` tool |
| `lib/git.js` | Dependency-free Git command layer (parsing, caps, ref validation) |
| `lib/client.js` | Browser half: right-sidebar tab type, guide card, graph/details/actions UI |
| `cordis.patch.yml` | Bundle patch (inserts the `dsh-git-graph` row) |
| `locale/*.json` | Plugin Manager title/description (en, zh) |
| `icon.svg` | Plugin artwork |
| `docs/parity.md` | Migration report vs vscode-git-graph v1.30.0: what landed, what did not, and the evidence used |
| `docs/todolist.md` | Actionable backlog (20 items) with file scope and acceptance criteria per item |

## Migration status

This plugin ports the core of vscode-git-graph, not all of it. The graph, commit
details and per-file diffs are complete; the full right-click Git action surface,
commit comparison, uncommitted-change node, find/filter and the engineering
surroundings (multi-repo, code review, theming/settings) are not yet ported.

See [docs/parity.md](docs/parity.md) for the checked gap list and
[docs/todolist.md](docs/todolist.md) for the ordered backlog.

## Notes

- The graph reads the repository at the Session's effective working directory (or
  `repoPath`); it never creates commits on its own.
- Actions are user gestures in the panel. The agent tool is deliberately read-only.
- Requires `git` on `PATH` on the Host.
