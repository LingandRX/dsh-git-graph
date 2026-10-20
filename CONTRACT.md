# dsh-git-graph — implementation contract (v1)

Port the core of <https://github.com/mhutchie/vscode-git-graph> into a DeepSeek Harness
Web plugin: a Git commit graph that opens as a tab in the **right sidebar** (rightbar),
next to 工作区文件 / 上下文 / 新建终端 on the start page.

Package name / plugin id / tab kind:

| thing | value |
| --- | --- |
| npm package | `dsh-git-graph` (workspace root `/home/wp/dsh-git-graph`) |
| Cordis row id | `dsh-git-graph` |
| client module id | `dsh-git-graph` |
| rightbar tab kind | `git-graph` |
| locale namespace (client) | `dshGitGraph` |

## File ownership (do not write outside your scope)

| scope | files | owner |
| --- | --- | --- |
| host | `lib/git.js`, `lib/index.js`, `test/host.test.js` | `host-git` |
| client | `lib/client.js`, `test/client.test.js` | `git-ui` |
| bundle | `package.json`, `cordis.patch.yml`, `locale/*.json`, `icon.svg`, `README.md`, `CONTRACT.md`, `.gitignore` | lead |

Never edit the profile (`$DSH_PROFILE_DIR`), never run `plugin_manager`, never `pnpm install`,
never `npm install`, never touch `/home/wp/.dsh`. The lead installs the bundle.

## Hard rules

- Plain ESM JavaScript (host) and plain browser JavaScript (client). No TypeScript, no build
  step, no new dependencies, no network calls. `node --check` must pass.
- Host half imports only `node:` builtins.
- Client half is **one self-contained file** (`lib/client.js`). It must not `require()`
  `@deepseek-ai/dsh-client-ui-primitives` or any other Harness client package; `react`,
  `react/jsx-runtime` and other registered bundles are the only allowed requires
  (`react` is enough — use `React.createElement`).
- Client styling: theme tokens only (`var(--dsw-alias-*)`), no literal colors except the
  graph lane palette / status colors that are artwork. Render the `<style>` tag inside the
  tab body component so unmounting removes it.
- All visible UI text goes through the client locale service (`t("...")`, zh + en).
- The tab must keep working when the session workspace is not a Git repository: show an
  explanatory empty state, never throw.

## Host half — `lib/index.js`

Export form (Cordis plugin):

```js
export const name = "dsh-git-graph";
export function apply(ctx, config) { ... }
```

Services are optional; wrap each area in `ctx.inject([...], (c) => { ... })` so the plugin
still loads in profiles without them:

- `ctx.inject(["sessions", "workingDirectory"], ...)` — only used to resolve cwd lazily.
- `ctx.inject(["connection"], (c) => { ... c.connection.fetch.register(route) ... })` — API
  routes. Register inside `c.effect(() => c.connection.fetch.register({...}))`.
- `ctx.inject(["tools"], (t) => { t.effect(() => t.tools.register(tool)) })` — agent tool.

Route registration shape (exact, proven in this profile by `dsh-context`):

```js
const dispose = c.connection.fetch.register({
  path: "/api/dsh-git-graph/graph",
  methods: ["POST"],
  requestBody: "buffered",
  fetch: async (request) => { /* Response.json(...) */ },
});
```

Handler receives a Fetch `Request` with a JSON body; return `Response.json({...})`.
Always answer HTTP 200 with an envelope; the client checks `ok`.

### cwd resolution

```js
function resolveCwd(ctx, sessionId, requestedPath) // -> { cwd, workspace }
```

1. `ctx.sessions.get(sessionId)` → `ctx.workingDirectory.get(session)` → `session.header.cwd`.
2. Fall back to `ctx.workingDirectory.defaultDirectory`.
3. If the request carries `path`: absolute path used as-is, relative path joined onto (2).
4. Then `repoPath` config (see below) overrides when non-empty.

### Raw config (no `Config` export, so no dependency is needed)

`apply(ctx, config)` reads `config || {}`:

| key | default | meaning |
| --- | --- | --- |
| `repoPath` | `""` | optional fixed repository path; empty = session cwd |
| `maxCommits` | `400` | default page size for the graph |
| `showRemoteBranches` | `true` | include `refs/remotes/*` refs |

Read values defensively (`typeof x === "string"`, finite positive integers).

### Git layer — `lib/git.js`

Pure-ish module with an injectable runner so it is unit-testable:

```js
export function createGitRunner({ execFileImpl, timeoutMs = 30_000 })
export function createGitApi(run) // run(argv, opts) -> { stdout, stderr, code }
export const api = {
  detectRepo(cwd) -> { isRepo, repoPath, error? },
  readGraph(cwd, { maxCommits, showRemoteBranches }) -> graph value,
  readCommit(cwd, hash) -> commit detail value,
  readDiff(cwd, { hash, path: filePath, oldPath, status }) -> diff value,
  listBranches(cwd) -> { current, branches },
  performAction(cwd, action, args) -> { message, output },
}
```

`run` uses `child_process.execFile("git", argv, { cwd, timeout, maxBuffer, env })`,
`GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, `--no-pager`, `--no-color`, and never a shell.
Trim/limit outputs (graph: `maxCommits`, detail body: 8 KiB, diff: 300 KiB with
`truncated: true`).

#### Graph value (`POST /api/dsh-git-graph/graph`)

Request body: `{ sessionId?: string, path?: string, limit?: number }`.

```jsonc
{ "ok": true, "value": {
  "repoPath": "/abs/repo", "workspacePath": "/abs/workspace",
  "isRepo": true,
  "head": { "branch": "main", "hash": "…", "detached": false },
  "status": { "branch": "main", "detached": false, "dirty": 2 },
  "refs": [
    { "name": "refs/heads/main", "shortName": "main", "type": "branch",
      "hash": "…", "head": true, "upstream": "origin/main" }
  ],
  "commits": [
    { "hash": "…", "abbrev": "abc1234", "parents": ["…"],
      "authorName": "…", "authorEmail": "…", "authorTime": 1700000000,
      "committerName": "…", "committerEmail": "…", "committerTime": 1700000000,
      "subject": "…", "refs": ["main", "tag: v1"] }
  ],
  "truncated": false,
  "generatedAt": 1700000000000
} }
```

Not-a-repo is a successful call with `value.isRepo === false` and
`value.error = "NOT_A_REPO"` (client renders the empty state).

Git command hints (use `-z` and `%x1f`/`%00` separators, never split on spaces):

- `git rev-parse --show-toplevel`
- `git rev-parse HEAD`, `git rev-parse --abbrev-ref HEAD`
- `git log --all --date-order --max-count=N -z --format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%s`
- `git for-each-ref --format=%(refname)%00%(objectname)%00%(HEAD)%00%(upstream:short) refs/heads refs/remotes refs/tags`
- `git status --porcelain=v1`

#### Commit detail (`POST /api/dsh-git-graph/commit`)

Request: `{ sessionId?, path?, hash }`. Response `value`:

```jsonc
{ "hash": "…", "abbrev": "abc1234", "parents": ["…"],
  "authorName": "…", "authorEmail": "…", "authorTime": 1700000000,
  "committerName": "…", "committerEmail": "…", "committerTime": 1700000000,
  "subject": "…", "body": "…", "refs": ["main"],
  "stats": { "files": 3, "insertions": 10, "deletions": 2 },
  "files": [
    { "status": "M", "path": "lib/index.js", "oldPath": null,
      "added": 5, "removed": 1, "binary": false }
  ] }
```

`status` is the first letter of `git diff-tree --name-status` (`A M D R C T U`); renames
carry `oldPath`. Use `git show -s --format=…` for metadata and
`git diff-tree --root --no-commit-id -r -M --name-status -z` / `--numstat -z` for files.

#### Diff (`POST /api/dsh-git-graph/diff`)

Request: `{ sessionId?, path?, hash, file, oldPath?, status? }`. Response `value`:

```jsonc
{ "patch": "diff --git …", "truncated": false, "binary": false }
```

Use `git show --format= --find-renames --patch --no-color <hash> -- <file> [oldPath]`.
Binary patches (`Binary files … differ`, `GIT binary patch`) → `binary: true` and an empty
patch. Cap the text at 300 KiB and set `truncated`.

#### Actions (`POST /api/dsh-git-graph/action`)

Request: `{ sessionId?, path?, action, ...args }`. Response `{ ok: true, value: { message, output } }`
(`output` = combined stdout+stderr, capped 8 KiB) or `{ ok: false, error: { code, message } }`
with `code: "GIT_FAILED"` and the git stderr as message.

| action | args | git argv |
| --- | --- | --- |
| `checkoutBranch` | `branch` | `switch <branch>` (fallback `checkout <branch>`) |
| `checkoutCommit` | `hash` | `switch --detach <hash>` |
| `createBranch` | `name`, `startPoint` | `branch <name> <startPoint>` |
| `deleteBranch` | `name`, `force` | `branch -d/-D <name>` |
| `cherryPick` | `hash` | `cherry-pick <hash>` |
| `revertCommit` | `hash` | `revert --no-edit <hash>` |
| `createTag` | `name`, `hash` | `tag <name> <hash>` |
| `deleteTag` | `name` | `tag -d <name>` |
| `fetch` | `remote?` | `fetch --prune [remote]` |

Validate every ref-like argument with `/^[A-Za-z0-9._][A-Za-z0-9._/-]*$/`, reject strings
starting with `-`, containing `..`, `@{`, whitespace, or ending in `.lock` / `/`. Reject
unknown actions and missing args with `{ ok:false, error:{code:"BAD_REQUEST"} }`.
Never pass user text to a shell.

### Agent tool — `git_graph`

Read-only tool registered when `tools` is present. Name `git_graph`, description in English
that says it reads the Git graph/commits/diffs of the current session workspace.

```jsonc
parameters: {
  "type": "object",
  "properties": {
    "action": { "type": "string", "enum": ["log", "show", "diff", "branches", "status"] },
    "commit": { "type": "string" },
    "file": { "type": "string" },
    "limit": { "type": "integer", "minimum": 1, "maximum": 500 }
  },
  "required": ["action"],
  "additionalProperties": false
}
```

`execute(args, exec)`: resolve cwd from `exec.agent` (its session; `ctx.workingDirectory.get`
then `session.header.cwd`, else `defaultDirectory`), reuse the same git API as the routes
(no separate logic), and return `{ action, ...value }` as the canonical JSON value.
Tool `output` declaration: `schema: { type:"object", additionalProperties:true }` and
`render(args, value)` returning `[{ type: "text", text: <human summary> }]` — log: up to 100
`<abbrev> <subject> (<refs>)` lines plus a header with branch/status; show: metadata + file
list; diff: the patch; branches: list; status: branch + dirty count.

Tool failures: throw an `Error` with a clear message (the registry renders it). Never
mutate the repository from the tool.

## Client half — `lib/client.js`

Follow the shipped pattern of
`/home/wp/.npm/_npx/c8633a242642d858/node_modules/@deepseek-ai/dsh-client-ui-sidebar-terminal/lib/client.js`
(read it first: same registration calls, same module-loader wrapper). Structure:

```js
window.__ModuleLoader__.load({
  id: "dsh-git-graph",
  factory(require) {
    const React = require("react");
    // ... components + apply ...
    const inject = ["slots", "locale", "sidebarRight", "sidebarRightTabs"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register("dshGitGraph", { zh, en }), "dsh-git-graph.copy");
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: "dsh-git-graph",
        kind: "git-graph",
        title: () => t("tab.title"),
        guide: [{ id: "open", order: 40, title: () => t("tab.title"),
                  description: () => t("tab.description"), icon: GitGraphIcon }],
      }), "dsh-git-graph.type");
      ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () =>
        ctx.slots.register({ name: "sidebar.right.pane.tab", key: "dsh-git-graph", locale: "dshGitGraph",
          inject: (sessionId) => ({ sessionId }) }, GitGraphBody)), "dsh-git-graph.body");
    }
    return { apply, inject };
  },
});
```

Notes proven from shipped code:

- `ctx.sidebarRightTabs.register(...)` is stage one (static type + guide entry).
- `ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({ name, key, locale, inject }, Component))`
  is stage two (body), keyed by the definition `id` (`"dsh-git-graph"`).
- `ctx.locale.register(ns, { zh, en })`; `const t = ctx.locale.bind(ns)`.
- The `inject` callback runs once per session; its returned object is spread into the body
  props (so `sessionId` arrives as a prop). The body also receives `useTabInfo()` hook and
  `t`.
- No title slot is needed: the definition `title()` text is captured when the tab opens.
- Client → host HTTP: `fetch("api/dsh-git-graph/graph", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) })`
  (relative, no leading slash — proven by `dsh-context`). Parse JSON, handle `ok:false`.
  Use `AbortController` per request; abort on unmount and on superseding refresh.

### UI spec (right sidebar width, ~380–520 px)

Master/detail inside one tab; no iframes, no portals outside the tab.

1. **Toolbar**: git icon + repository folder name (basename), branch chip (e.g. `main`),
   dirty indicator when `status.dirty > 0`, refresh button, "fetch" in an overflow menu.
2. **Graph list**: one row per commit, newest first. Each row:
   - left: inline `<svg>` lane graph, fixed lane width (~14 px), row height 38 px, one node
     per commit, colored by lane; merge commits get a ring; edges drawn as vertical lines
     with bezier curves into the parent lane. Cap displayed lanes at 14 (clamp extras).
   - middle: subject (ellipsis), second line `abbrev · authorName · relative time`.
   - right/top: ref chips for branches/tags/HEAD (`main`, `origin/main`, `v1.0`), branch
     chips visually distinct from tags and remotes.
   - keyboard accessible: row is a `<button>`-like element, Enter opens detail, focus ring.
   - virtualization is not required; render up to `limit` rows with a "load more" button
     when `truncated`.
3. **Detail view** (after clicking a commit, back button in the toolbar): subject, author /
   committer with absolute + relative time, full/short hash with copy button, parents,
   refs, stats (`N files, +A −D`), file list grouped by status letter with add/remove counts,
   and per-file expandable diff (`<pre>` lines; `+` green, `-` red, `@@` accent; binary and
   truncated states).
4. **Actions** (detail view + branch chips): checkout branch, create branch at commit,
   checkout commit (detached), cherry-pick, revert, create tag, delete tag, fetch. Each
   destructive action asks for confirmation inside the panel (two-step confirm row; do not
   use `window.confirm`). Show progress (`running…`) and the resulting message/error inline.
   After a successful action refresh the graph.
5. **States**: loading skeleton/spinner, error with retry, empty state (not a repo:
   "当前工作区不是 Git 仓库" + path + retry), refresh keeps the previous list visible.
6. **Lane layout**: pure function `layoutGraph(commits)` → `{ rows, laneCount }` with per-row
   `{ lane, edges[] }`; deterministic, no React dependency. Handle: root commit, merges,
   octopus merges, multiple roots, disconnected histories, `parents` filtered to commits
   present in the page. Include `test/client.test.js` covering this function indirectly is
   optional; if the function is not exported it must at least be exercised by the smoke test
   through a stub React render (not required).

Locale dictionary keys (both zh and en must exist):

```
tab.title, tab.description, toolbar.refresh, toolbar.fetch, toolbar.back, toolbar.copyHash,
toolbar.copied, toolbar.repository, toolbar.branch, toolbar.dirty, toolbar.loadMore,
state.loading, state.notRepo, state.notRepoHint, state.error, state.retry, state.empty,
detail.author, detail.committer, detail.parents, detail.hash, detail.committed,
detail.stats, detail.files, detail.noFiles, detail.diff, detail.binary, detail.truncated,
detail.showingDiff, detail.hideDiff, action.checkoutBranch, action.checkoutCommit,
action.createBranch, action.cherryPick, action.revert, action.createTag, action.deleteTag,
action.fetch, action.confirm, action.cancel, action.running, action.branchName,
action.tagName, action.success, action.failed, action.cleanWorktreeWarning,
common.refresh, common.close
```

## Verification (lead runs it)

1. `node --check lib/index.js lib/git.js lib/client.js`
2. `node --test test/` (host tests create a throwaway repo under `/tmp`, never the workspace)
3. Lead: `plugin_manager install_bundle` → `application: applied`; then
   `cordis_inspect_query` `client` `Slots.listSubTree` with root `sidebar.right.pane.tab`
   must list key `dsh-git-graph`, and `sidebar.right.tab.guide` must show the entry.
4. The workspace will be `git init`-ed by the lead after the code exists so the tab has real
   data; nobody else commits.
