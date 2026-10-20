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
- **Commit graph** of the Session workspace: colored lanes, merge/octopus commits, branch,
  remote and tag chips, HEAD marker, dirty-worktree indicator, load-more pagination.
- **Commit details**: author/committer, timestamps, parents, refs, changed files with
  A/M/D/R status and line counts, and an expandable unified diff per file.
- **Actions** (confirmed in-panel): checkout branch, checkout commit (detached), create
  branch at a commit, cherry-pick, revert, create/delete tag, fetch.
- **Agent tool `git_graph`** (read-only): `log`, `show`, `diff`, `branches`, `status` for
  the current Session workspace, sharing the exact same Git layer as the UI.

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

## Notes

- The graph reads the repository at the Session's effective working directory (or
  `repoPath`); it never creates commits on its own.
- Actions are user gestures in the panel. The agent tool is deliberately read-only.
- Requires `git` on `PATH` on the Host.
