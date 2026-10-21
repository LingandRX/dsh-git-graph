# Wave 8 contract — closing the five §5 residuals

Baseline: HEAD `eda9d4c`, **197 tests** (host 85 / client 112), tree clean.
Goal: `docs/parity.md` §5 no longer contains any "残余" row; the five residuals become
implemented features. Non-goals in §5 stay non-goals.

| # | Residual | Owner |
| --- | --- | --- |
| 1 | 服务端全量提交搜索 (`POST /search`) | host: `lib/git.js`, `lib/index.js`, `test/host.test.js` |
| 2 | 自定义分支 glob 过滤 (client-side matcher + UI) | client: `lib/client.js`, `test/client.test.js` |
| 3 | 工作区改动 ↔ 指定提交对比 (`/compare` + `/diff` extension) | host then client |
| 4 | 全局/可配置快捷键 (`keyboardShortcut.*`, `globalShortcuts`, Ctrl+Up/Down) | client (+ config) |
| 5 | 上游 110 项设置逐键对齐 | settings: `lib/settings.js`, `test/settings.test.js`, `docs/settings-parity.md` |

## Ownership (hard rules)

- One writer per file. Never edit a file owned by another worker.
- `host-worker`: `lib/git.js`, `lib/index.js`, `test/host.test.js`.
- `client-worker`: `lib/client.js`, `test/client.test.js`.
- `settings-worker`: `lib/settings.js` (new), `test/settings.test.js` (new),
  `docs/settings-parity.md` (new).
- Nobody runs `git add`/`git commit`; the Lead commits. Do not edit `docs/parity.md`,
  `docs/todolist.md`, `README.md`, `cordis.patch.yml` (Lead owns them).
- No new npm dependencies. Host and client halves stay dependency-free (`node:` builtins
  only on the host, `require("react")` only in the client factory).
- Every new user-visible string needs `zh` + `en` entries in the client dictionary.
- Styles use only `--dsw-alias-*` theme tokens (lane palette is the sole literal-colour
  exception).

## 1. `POST /api/dsh-git-graph/search` — server-side full-history search

Request body:

```json
{
  "sessionId": "<optional string>",
  "path": "<optional string>",
  "query": "<required non-empty string, trimmed, max 200 chars>",
  "scope": "all | message | author | ref",
  "limit": 50,
  "offset": 0
}
```

- `scope` defaults to `all`; unknown values → `BAD_REQUEST`.
- `limit` 1–200 (default 50); `offset` ≥ 0 (default 0). Non-numeric/out-of-range →
  `BAD_REQUEST` with a message naming the field.
- Query is a case-insensitive substring; `scope: "all"` searches subject + body + author
  name/email + short hash + ref names, the narrower scopes search one facet.
- Host implementation may read up to `SEARCH_SCAN_LIMIT = 20000` commits
  (`git log --all --format=… --date-order -n 20000`, plus `--use-mailmap` when configured)
  and filter in JavaScript; do not shell out per keystroke — this is one git call.

Response value (always HTTP 200 envelope):

```json
{
  "isRepo": true,
  "query": "fix",
  "scope": "all",
  "commits": [ { "hash": "…", "parents": ["…"], "author": {"name","email","date"},
                 "committer": {"name","email","date"}, "subject": "…",
                 "refs": [{"type":"branch","name":"main"}] } ],
  "offset": 0,
  "limit": 50,
  "hasMore": false,
  "scanned": 1234,
  "capped": false
}
```

- `scanned` = commits examined; `capped: true` when `scanned` hit the scan limit (UI must
  say "仅扫描最近 20000 个提交" in that case).
- `commits` reuse the graph commit shape (`hash`, `parents`, `author`, `committer`,
  `subject`, `refs`) so the client can render them with the existing row components.
- Outside a repository: `{ "isRepo": false, "query": …, "commits": [],
  "offset": 0, "limit": …, "hasMore": false, "scanned": 0, "capped": false }` — no throw.
- Git failures → `GIT_FAILED` with git stderr as `error.output` (same as other routes).
- Export a `searchCommits(cwd, options)` method from `lib/git.js` and add it to the API
  object; route registration goes through the existing `ROUTES` table in `lib/index.js`.

## 2. Working-tree ↔ commit comparison

Extend the existing routes rather than adding new ones.

`POST /compare`:

- Existing form `{ base, head }` (both commit-ish) keeps working unchanged.
- New form `{ base: "<commit-ish>", working: true }` compares **the working tree**
  (tracked changes, staged + unstaged) **against `base`**, ignoring `head`.
- Response adds `working: true` and `head: null`; `base` is the resolved commit hash,
  `baseAbbrev` its 7-char form, and `files` / `stats` keep the current shape.
- Untracked files must be included as `status: "A"` entries with `added` = line count
  (or `binary: true` when the probe says binary). They are part of "工作区改动" in the
  UI, so the comparison must not silently drop them.
- Validation: `base` required and a valid ref (`BAD_REQUEST` otherwise); `working` must be
  a boolean when present.

`POST /diff`:

- New scope `"working"`: requires `hash` (the base commit) and `file`; returns the patch
  of that file between `hash` and the working tree. Untracked files return their content
  as an all-added patch (empty file → patch with zero hunks).
- `scope: "working"` with a missing `hash` → `BAD_REQUEST`; unknown scope stays
  `BAD_REQUEST`.

Host tests must cover: tracked modification visible, staged change visible, untracked file
listed as `A`, diff for an untracked file, `working: true` without `base` rejected,
repository without a HEAD (fresh `git init`) handled gracefully (empty comparison, not a
crash).

## 3. `lib/settings.js` — 110 upstream settings, one key each

Upstream v1.30.0 declares exactly **110** keys in
`contributes.configuration.properties`. The raw dump is at `/tmp/up-settings.json`
(regenerate with the curl/git clone already done at `/tmp/up-gg`). The module must export:

```js
export const SETTINGS = [ { key, type, default, aliasOf?, wiring, note } … ]; // exactly 110
export const CANONICAL_KEYS;             // keys without aliasOf
export const PRESENTATION_KEYS;          // keys forwarded to the client
export function normalizeSettings(rawConfig); // → { values, presentation, shortcuts,
                                              //    aliased, unknown, invalid }
```

Rules:

- `key` is the upstream key **without** the `git-graph.` prefix (e.g.
  `repository.commits.initialLoad`).
- `type` is `"boolean" | "string" | "number" | "array" | "object"`.
- `aliasOf` marks the 29 legacy flat aliases (upstream kept both spellings). Every
  `aliasOf` must point at a key that exists in `SETTINGS`; alias values fold into the
  canonical value, canonical wins when both are set explicitly and differ.
- `wiring` is one of:
  - `"mapped"` — the value changes observable behavior in this plugin;
  - `"vscode-only"` — VS Code host feature with no DSH counterpart (e.g.
    `integratedTerminalShell`, `retainContextWhenHidden`, `tabIconColourTheme`);
  - `"out-of-scope"` — a declared non-goal (avatars, PR providers, interactive rebase).
  Every non-`mapped` entry needs a one-line `note` reason.
- `normalizeSettings` coerces values by type (string→number where declared, boolean
  truthiness only for `true`/`false`, arrays copied, objects shallow-copied), and reports
  every dropped/coerced key in `invalid` with a reason; unknown keys go to `unknown`.
  It must never throw.
- `presentation` is the payload the host forwards on `/graph` (see §4) and must be
  deterministic and JSON-serializable.
- `shortcuts` resolves `keyboardShortcut.find/refresh/scrollToHead/scrollToStash`
  descriptors (`"CTRL/CMD + F"`) into `{ key, ctrl, meta, alt, shift }`; an unparsable
  descriptor falls back to the default and is reported in `invalid`.
- Keep the module dependency-free and side-effect free so `test/settings.test.js` can
  import it directly.

`docs/settings-parity.md` is a 110-row table: key, type, default, aliasOf/wiring, note.
Plus a short "how this is verified" paragraph and the count summary
(`mapped` / `vscode-only` / `out-of-scope` / aliases).

## 4. Presentation payload (host → client)

`/graph` already returns `presentation`. Extend it (additive, keep existing keys) with:

```json
{
  "graphStyle": "rounded", "graphColours": [], "showSignature": false,
  "showEmoji": true, "issueUrlTemplate": "", "useMailmap": false,
  "dateType": "Author Date", "dateFormat": "Date & Time",
  "referenceLabelAlignment": "Normal", "combineLocalAndRemoteBranchLabels": true,
  "columnVisibility": { "Date": true, "Author": true, "Commit": true },
  "fileViewType": "File Tree", "compactFolders": true, "autoCenterDetails": true,
  "markdown": true, "muteMergeCommits": true, "muteNonAncestors": false,
  "emojiMappings": {}, "customBranchGlobPatterns": [],
  "dialogDefaults": { … }, "contextMenuVisibility": {},
  "shortcuts": { "find": {…}, "refresh": {…}, "scrollToHead": {…}, "scrollToStash": {…} },
  "globalShortcuts": false, "enhancedAccessibility": false,
  "repositoryDropdownOrder": "Workspace Full Path", "fileEncoding": "utf8",
  "initialLoad": 300, "loadMore": 100, "loadMoreAutomatically": true
}
```

The payload is built by `lib/settings.js` (`PRESENTATION_KEYS`, 29 keys: the 26 above plus the
three page-size keys appended in wave 8-B). The client consumes every key across waves 8-C. `presentation` must stay request-independent.

## 5. Client work (staged over waves)

Wave A (client-worker now):

- **Server search**: the Find bar gets a scope toggle ("当前已加载 / 全部历史") and, in
  full-history mode, calls `/search` with the typed query (debounced ≥ 250 ms), shows
  result count + "加载更多" pagination, and reuses the existing commit-row rendering.
  Errors surface as an inline message; `capped` shows the scan-limit notice. Existing
  in-page matching stays the default and must keep its 112 tests green.
- **Glob filter**: the branch-filter popover gains a glob input. Matcher supports `*`
  (no `/`), `**` (across `/`), `?`, `[abc]`, `[!abc]`, and a leading `!` to negate.
  Invalid patterns are rejected inline (no request). Globs combine with the existing
  multi-select as a union; `customBranchGlobPatterns` (from presentation) pre-fills the
  list once available. Unit-test the matcher directly through the exported `__test` hook.

Wave B: working-tree compare entry points + configurable shortcuts
(`keyboardShortcut.*`, Ctrl/Cmd+Up/Down child/parent navigation, opt-in
`globalShortcuts` document-level scope).

Wave C: consume the new presentation keys (date type/format, markdown subset in
messages/tag details, reference-label alignment/combining, muted rows, dialog defaults,
context-menu visibility, custom emoji mappings, column defaults, file-view default,
auto-center, accessibility flag).

## 6. Acceptance for everyone

- `node --check lib/*.js` clean; `node --test` green; baseline 197 must not decrease.
- New behavior covered by `node:test` cases; host tests use real temporary repositories
  (`mkdtemp` + `git init`), client tests use the existing fake-React/fake-fetch harness.
- Report back: files changed, test counts (host/client), exact commands run, and any
  deviation from this contract. Do not claim a behavior you did not exercise.
