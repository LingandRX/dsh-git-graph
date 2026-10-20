# Wave 5 contract — TODO-8, TODO-20, TODO-21

Same rules as earlier waves. Baseline: **142 tests** (host 69, client 73), HEAD `936a530`.

## Ownership

| scope | files | owner |
| --- | --- | --- |
| host | `lib/git.js`, `lib/index.js`, `test/host.test.js` | `host-git` |
| client | `lib/client.js`, `test/client.test.js` | `git-ui` |

## Host

### H1. `fetchIntoLocalBranch` (TODO-21)

`performAction` case `"fetchIntoLocalBranch"`, args `{ remote, branch, local }`:
`git fetch <remote> <branch>:<local>` — updates the local branch **without** switching
to it. Validate all three with the existing ref validator (a leading `-`, `..`, `@{`,
whitespace or trailing `.lock`/`/` is `BAD_REQUEST`). `ACTION_FIELDS
.fetchIntoLocalBranch = ["remote", "branch", "local"]`. Message:
`Fetched "<remote>/<branch>" into "<local>".`

Non-fast-forward is refused by git; surface its stderr through the existing envelope
(no `--force`, no `+` prefix).

### H2. `POST /contains` — the tooltip's data (TODO-8)

Body `{ sessionId?, path?, hash }`; `hash` validated as a ref, `BAD_REQUEST` otherwise.

```jsonc
{ "hash": "<full hash>",
  "shortHash": "abc1234",
  "inHead": true,
  "branches": [{ "name": "main", "isHead": true }, { "name": "feature", "isHead": false }],
  "tags": ["v1.0"],
  "stashes": [{ "index": 0, "shortName": "stash@{0}" }],
  "generatedAt": 1700000000000 }
```

- One `git for-each-ref --contains <hash> --format=%(refname)` call for all refs;
  classify by prefix (`refs/heads/`, `refs/tags/`, `refs/remotes/` — include remotes in
  `branches` with `isHead:false` and their short name, so the tooltip can distinguish
  them only by name; no separate array), and `refs/stash@{n}` → `stashes`.
- `inHead` from `git merge-base --is-ancestor <hash> HEAD` (exit code 1 means "not
  contained", and is **not** an error).
- One hash per request: the route must not accept an array (the client caches).

### H3. Signature status (TODO-20)

`readCommit` gains `signature: { status: "G" | "B" | "U" | "X" | "Y" | "R" | "N" | null,
signer: string | null, keyId: string | null }` non-null, derived from `%G?`, `%GS`, `%GK`
on the existing `git show -s` invocation (no extra process). `N` = no signature.
Only the commit route gains it — the graph page stays as fast as it is now.

### H4. Presentation config forwarded to the client (TODO-20)

New config keys, all read defensively in `apply()` (do **not** change
`normalizeConfig`'s exported shape — it has its own test):

| key | default | meaning |
| --- | --- | --- |
| `graphStyle` | `"rounded"` | `rounded` \| `angular`; anything else falls back to `rounded` |
| `graphColours` | `[]` | array of CSS colours used cyclically for lanes; invalid entries are dropped |
| `showSignature` | `false` | show the signature badge in the commit detail |
| `showEmoji` | `true` | render emoji shortcodes in subjects/bodies |
| `issueUrlTemplate` | `""` | e.g. `https://example.com/issues/{id}`; empty disables issue links |
| `useMailmap` | `false` | pass `--use-mailmap` to the commit walk |

Every `graph` response gains exactly one new key:

```jsonc
"presentation": { "graphStyle": "rounded", "graphColours": [],
                  "showSignature": false, "showEmoji": true,
                  "issueUrlTemplate": "", "useMailmap": false }
```

Unchanged response keys otherwise. `git_graph` stays five read-only actions.

## Client

### C1. Hover tooltip on commit nodes (TODO-8)

- Pointer enters a commit row's lane node (or the row) → after **400 ms** show a
  controlled tooltip anchored near the pointer/row; pointer leaves → hide immediately.
- Content from `POST /contains` only (never guessed): "包含于 HEAD / 不包含于 HEAD",
  then up to 6 branch names (current branch marked), tags, stashes, plus "+N" overflow.
- Cache per hash, **LRU ≤ 64** entries; one in-flight request per hash; abort on unmount.
- Keyboard focus on a row shows the same tooltip after the same delay; Escape hides it.
- Must not block list scrolling or steal pointer events (`pointer-events: none`), and must
  stay inside the tab body (no portal).

### C2. Visual settings (TODO-20)

- `graphStyle`: `rounded` → current bezier; `angular` → orthogonal lane segments
  (vertical, horizontal elbow, vertical). `lanePath` takes the style as a parameter so
  both are unit-testable; the value comes from the graph response's `presentation`.
- `graphColours`: when non-empty, lanes cycle through it instead of the built-in palette.
- Signature badge in the detail view when `showSignature` is on and a status exists:
  verified / bad / unknown / expired / revoked, with the signer when known; `N` renders
  nothing.
- Emoji shortcodes: when `showEmoji` is on, render a small built-in map (`:smile:`,
  `:tada:`, `:bug:`, `:rocket:`, `:sparkles:`, `:fire:`, `:heart:`, `:thumbsup:`,
  `:warning:`, `:white_check_mark:`) in subjects and commit bodies. Unknown shortcodes
  stay literal.
- Issue links: when `issueUrlTemplate` contains `{id}`, render `#123` in subjects/bodies
  as an `<a href>` built from the template, `target="_blank"`, `rel="noreferrer noopener"`.
  Only digits after `#` count; never build a URL from anything else.
- Shortcuts **inside the tab only** (no global registration): `Ctrl/Cmd+H` expands and
  scrolls to the current HEAD commit, `Ctrl/Cmd+R` refreshes, `Ctrl/Cmd+F` opens the find
  row. Ignore them while focus is in a text input/textarea/select. The tab root's
  keydown handler owns this; document in a comment that these are tab-scoped because the
  right sidebar has no per-tab shortcut scope.

### C3. Localization

Every new string zh + en and in `CONTRACT_KEYS`.
