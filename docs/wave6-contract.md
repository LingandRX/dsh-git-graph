# Wave 6 contract — TODO-18, TODO-19

Same rules as earlier waves. Baseline at the start of this wave is whatever wave 5
leaves (expected: host ≥ 73, client ≥ 80, all green).

## Ownership

| scope | files | owner |
| --- | --- | --- |
| host | `lib/git.js`, `lib/index.js`, `test/host.test.js` | `host-git` |
| client | `lib/client.js`, `test/client.test.js` | `git-ui` |

## TODO-18: multiple repositories

### H1. Repository discovery

`POST /api/dsh-git-graph/repos` body `{ sessionId?, path?, maxDepth? }` returns:

```jsonc
{ "workspacePath": "/abs/workspace",
  "maxDepth": 2,
  "repos": [ { "path": "/abs/workspace/a", "name": "a", "isCurrent": true } ] }
```

- Discovery: walk the workspace root up to `maxDepth` directories (new config key
  `maxDepthOfRepoSearch`, default `1`), skipping `node_modules`, `.git`, `dist`, `build`
  and any directory that is itself a repository root (do not descend into a found repo).
  A directory is a repo when it contains a `.git` entry (file or directory).
- The session's own repository is always included and marked `isCurrent` (compare
  real paths).
- Cap the walk (hard limit 2000 directories visited, 50 repositories) and report
  `truncated: true` when either cap is hit.
- Not a repo and no repos found → success with `repos: []` (an empty workspace is a
  normal state, not an error).

### H2. Repository selection must be validated

Every route that accepts `path` must now **reject** a resolved path that is not inside the
session workspace, with `BAD_REQUEST` code `OUTSIDE_WORKSPACE` and a message naming the
path. Resolve symlinks before comparing (`fs.realpath`), so `..` and symlink escapes are
both refused. This applies to `graph`, `commit`, `diff`, `action`, `uncommitted`,
`compare`, `stashes`, `tag`, `remotes` and `contains`. The `repoPath` config override is
exempt (it is the operator's explicit choice) — document that in the message.
The `git_graph` tool keeps using the session workspace only.

### H3. Client

- When `/repos` reports more than one repository, the toolbar repository label becomes a
  select; choosing one sends that absolute path as `path` on every subsequent request and
  updates the chips/graph.
- The selection is remembered for the tab's lifetime and reset if the workspace changes.
- With exactly one repository the current label stays (no select).
- A refused path (`OUTSIDE_WORKSPACE`) surfaces as the normal error state with the
  message, never a crash.

## TODO-19: code-review marks

### H1. Storage

Use the Host `storageDomain` service (`ctx.inject(["storageDomain"], …)`) to open a domain
named `dsh-git-graph` with one collection `reviews` keyed by session id:

```jsonc
{ "sessionId": "…",
  "entries": [ { "kind": "commit", "base": "…", "head": "…",
                 "files": { "lib/a.ts": 1700000000000 },     // path -> reviewedAt
                 "updatedAt": 1700000000000 } ] }
```

- Key by `(kind, base, head)`; `kind` is `"commit"` (base === head) or `"compare"`.
- Entries older than 90 days are dropped on read (and the pruned value written back lazily).
- Cap at 200 entries per session (drop oldest `updatedAt`).

### H2. Routes

`POST /api/dsh-git-graph/review` with one of:

```jsonc
{ "sessionId": "…", "action": "read", "kind": "commit", "base": "…", "head": "…" }
{ "sessionId": "…", "action": "toggle", "kind": "commit", "base": "…", "head": "…", "file": "lib/a.ts" }
{ "sessionId": "…", "action": "clear", "kind": "commit", "base": "…", "head": "…" }
```

`read` → `{ files: { path: reviewedAt }, total, reviewed }`; `toggle` → the same value
after flipping one path; `clear` → `{ files: {}, total: 0, reviewed: 0 }`.
`BAD_REQUEST` for unknown action/kind, unsafe refs or a missing file. When
`storageDomain` is absent the route returns `{ ok: false, error: { code: "UNAVAILABLE" } }`
rather than throwing.

`total` comes from the commit/compare file list (reuse `readCommit`/`compareCommits`),
so it is the authoritative denominator and never a client guess.

### H3. Client

- In the commit detail and comparison views, every file row gets a review checkbox;
  unreviewed files are bold, reviewed ones are dimmed with a check.
- A progress line `已评审 3/8` sits above the file list, plus a "全部标记/清除" control.
- Marks load with the detail (one `read` request) and toggle optimistically, reverting on
  failure with the error shown in the feedback bar.
- Toggling a file does not mark it for a per-file diff request — review state is separate
  from the diff cache.
- A `UNAVAILABLE` response hides the control entirely (no error toast).

### Localization

Every new string zh + en and in `CONTRACT_KEYS` (both sides where text is shown).
