# Wave 9 contract — migrating the six declared non-goals

Baseline: HEAD `535dc02`, **305 tests** (host 102 / client 157 / settings 46), tree clean.
Goal: `docs/parity.md` §5.2 stops existing — all six former non-goals are implemented with
DSH-native equivalents, tested, and reclassified in `docs/settings-parity.md`.

| # | Upstream feature | DSH-native implementation |
| --- | --- | --- |
| 1 | 列宽拖拽 | client: pointer-drag header handles, CSS-variable column widths, persisted locally |
| 2 | `git archive` 导出 | host: `git archive` into `<workspace>/.dsh-git-graph/archives/`, path-fenced, returns the relative path |
| 3 | 作者头像 | host: Gravatar URL (md5 of e-mail, identicon fallback) when `repository.commits.fetchAvatars`; client renders img + initials fallback |
| 4 | PR 创建集成 | host: remote-URL parsing → provider detection → compare/MR/PR URL (built-in + custom `$1..$8` template); client dialog copies/opens it |
| 5 | 跨工作区批量结束评审 | host: `/review` gains `scopes` + `end` across every stored session key (entries gain `repoPath`); client management panel |
| 6 | 仓库配置导入/导出 | host: `<repo>/.gitgraph.json` export/import, per-repo override applied per request; client settings dialog |

Ownership: host worker owns `lib/git.js`, `lib/index.js`, `test/host.test.js`; client worker
owns `lib/client.js`, `test/client.test.js`. Nobody else edits those four files. The Lead
owns `lib/settings.js` wiring follow-ups, docs, `cordis.patch.yml`, `package.json`.

## 1. Column widths (client only)

- Columns: Date, Author, Commit. Widths in px; defaults 96 / 132 / 78.
- Clamp per column: Date 48–200, Author 64–260, Commit 64–220.
- A drag handle in each header cell (pointer events, pointer capture, `touch-action: none`),
  double-click resets that column. Widths persist in `localStorage` under
  `dsh-git-graph:column-widths:v1`; unreadable/foreign values fall back to defaults.
- Apply widths through CSS variables `--dgg-col-date`, `--dgg-col-author`, `--dgg-col-commit`
  on the list container; header and rows read them (flex-basis / grid), so the existing
  layout keeps working when they are absent.
- Export pure helpers via `__test`: `COLUMN_WIDTH_DEFAULTS`, `COLUMN_WIDTH_RANGES`,
  `clampColumnWidth(column, px)`, `applyColumnResize(widths, column, deltaPx)`,
  `columnWidthVars(widths)`, `readStoredColumnWidths(storage)`, `writeStoredColumnWidths(storage, widths)`.

## 2. Archive export (host + client)

`POST /api/dsh-git-graph/archive`, body `{ sessionId, path?, ref, format }`:

- `format` ∈ `"zip" | "tar.gz"`, default `"zip"`; `ref` required and must pass `isValidRefName`
  and `git rev-parse --verify <ref>^{commit}`.
- Target directory: `<workspace>/.dsh-git-graph/archives/` (created on demand). The resolved
  real path must stay inside the workspace real path, otherwise `OUTSIDE_WORKSPACE`.
- File name: `<repoBasename>-<refSlug>-<yyyyMMdd-HHmmss>.<zip|tar.gz>`, sanitized to
  `[a-z0-9._-]` (fallback `archive`), collision → append `-2`, `-3`…
- Command: `git archive --format=<format> --prefix=<repoBasename>/ -o <absPath> <resolvedHash>`.
- Value: `{ isRepo: true, path: <workspace-relative>, format, ref, name, bytes }`;
  outside a repo → `{ isRepo: false }`; git failure → `GIT_FAILED` with stderr.
- Client: commit menu item "导出归档…" and the branch/stash-independent ref menu equivalent;
  dialog with a format picker; result row shows the workspace-relative path + size + copy
  button; errors inline. Locale strings in zh + en.

## 3. Avatars (host + client)

- Setting `repository.commits.fetchAvatars` (already in `SETTINGS`, currently out-of-scope)
  becomes the switch; default **false** (privacy: no network request unless enabled).
- Host, when enabled: `/graph` commit rows gain `authorAvatar` and `committerAvatar`
  (Gravatar URL `https://secure.gravatar.com/avatar/<md5>?s=64&d=identicon`,
  md5 of `email.trim().toLowerCase()`; empty/invalid e-mail → `null`), and `/commit` adds the
  same two fields for the author/committer. Presentation gains `avatars: true|false`.
- No host-side network calls and no disk cache: the browser loads the image with
  `referrerPolicy:"no-referrer"`, `loading:"lazy"`, `alt` = initials.
- Client: when `presentation.avatars` is true render a 20–24 px round avatar in the commit row
  and the detail header; on load error (or missing URL) fall back to an initials circle with a
  deterministic hue from the e-mail. When false, render exactly today's markup.
- Tests: md5 vectors (`test@example.com` → `55502f40dc8b7c769880b10874abc9d0`), URL shape,
  disabled → no avatar fields/keys, client img props and fallback.

## 4. Pull-request creation (host + client)

`POST /api/dsh-git-graph/pr`, body `{ sessionId, path?, branch?, base? }`:

- Pick the remote: `origin` or the first configured remote; `git remote get-url <name>`.
- Parse https/ssh remotes into `{ provider, owner, repo, webUrl }`:
  `github` (`github.com/OWNER/REPO`), `gitlab` (`gitlab.com/GROUP[/SUB]/REPO`),
  `bitbucket` (`bitbucket.org/OWNER/REPO`), anything else → `provider:"other"` with `webUrl`
  when the URL is https, else `provider:"unknown"`.
- `branch`: request value → current branch; detached HEAD → `BAD_REQUEST`.
- `base`: request value → `origin/HEAD` symbolic ref (stripped) → `main` if it exists →
  `master` if it exists → `"main"`.
- URL:
  - github `https://github.com/<owner>/<repo>/compare/<base>...<branch>?expand=1`
  - gitlab `https://gitlab.com/<group>/<repo>/-/merge_requests/new?merge_request[source_branch]=<branch>&merge_request[target_branch]=<base>`
  - bitbucket `https://bitbucket.org/<owner>/<repo>/pull-requests/new?source=<branch>&dest=<base>`
  - custom providers from `customPullRequestProviders` (`[{name, templateUrl}]`), template
    variables `$1`=hostRootUrl `$2`=sourceOwner `$3`=sourceRepo `$4`=sourceBranch
    `$5`=destOwner `$6`=destRepo `$7`=destProjectId `$8`=destBranch (upstream semantics);
    unknown `$n` stays literal.
- Value: `{ isRepo, remote: { name, url, provider, owner, repo, webUrl }, branch, base, url,
  custom: [{ name, url }] }`; no remote → `BAD_REQUEST` ("no remote is configured").
- Client: toolbar overflow item "创建 Pull Request…" (disabled without a remote), dialog shows
  provider, `base ← branch`, the URL, and copy/open buttons; custom providers listed as choices
  when configured. Opening uses `window.open(url, "_blank", "noopener,noreferrer")` guarded.

## 5. Cross-workspace review management (host + client)

- Review entries gain `repoPath` (the resolved repository root) when written; old entries
  without it are still readable (`repoPath: null`).
- `/review` gains two actions that do **not** require `kind`/`base`/`head`:
  - `action:"scopes"` → `{ scopes: [{ sessionId, repoPath, kind, base, head, reviewed, total,
    updatedAt }] }`, one row per stored entry across **every** session key in the table
    (iterate `table.keys()`), pruned by the existing retention rules. `total` may be `null`
    when it cannot be computed (repo gone); `reviewed` is always the stored file count.
  - `action:"end"` → body `{ all: true }` or `{ scopes: [{sessionId, kind, base, head}] }`
    clears those entries (prune + write back) and returns `{ ended: n }`.
- Client: "评审管理" panel (toolbar overflow): scopes grouped by repository, each row shows
  `base..head`/commit + reviewed/total, a "结束" button; "全部结束" with a confirmation step.

## 6. Repository config import/export (host + client)

- File: `<repoRoot>/.gitgraph.json` (max 128 KiB) —
  `{ "version": 1, "exportedAt": "<iso>", "settings": { "<upstream key without git-graph.>": <value> } }`.
- `POST /api/dsh-git-graph/repoconfig`, body `{ sessionId, path?, action }`:
  - `"status"` → `{ isRepo, present, path, valid, keys, error?, overrides }`
  - `"export"` → writes the file with the current **effective** settings that differ from the
    declared defaults (canonical keys only; aliases are folded), returns `{ path, keys, bytes }`
  - `"import"` → reads + validates the file (`normalizeSettings`; unknown/invalid reported),
    applies it as a per-repository override for later requests, returns `{ applied, keys,
    unknown, invalid }`
  - `"clear"` → deletes the file (client must confirm) and drops the override
- Effective config: for any request, settings = base plugin config ← repository overrides
  (repository wins; overrides cached by file mtime). Graph options, presentation, fetch/prune
  defaults and `uncommitted` behavior must all read the per-repo effective settings.
- Client: settings section in the overflow menu — "仓库配置" with status, 导出 / 导入 / 清除
  buttons and the resulting conflict list; after import the graph reloads.

## Acceptance

- `node --check lib/*.js` clean, `node --test` green, **no test-count decrease** (305 baseline).
- Real-repository host tests: archive zip/tar.gz magic + path fence, avatar URLs toggled by the
  setting, PR URLs for github/gitlab/bitbucket/other + ssh/https remotes + detached HEAD,
  review scopes/end across two session keys and two repos, repo-config export→import round-trip
  (including a repo override changing the effective page size/presentation).
- Client tests for every new UI path (pure helpers where hooks are not executed + direct
  component renders where they are).
- Report exact counts, files changed, deviations, and anything the harness cannot verify.
