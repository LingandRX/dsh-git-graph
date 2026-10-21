# Settings parity — 110 upstream configuration keys

This table covers the **110 configuration keys** that mhutchie/vscode-git-graph v1.30.0
declares in `package.json` → `contributes.configuration.properties`, keyed **without** the
`git-graph.` prefix. The machine-readable catalogue lives in `lib/settings.js`
(`SETTINGS`, `CANONICAL_KEYS`, `PRESENTATION_KEYS`, `normalizeSettings`); this document is
generated from it, so a missing/extra row is a test failure.

**Wiring legend**

- `mapped` — the plugin has a **concrete consumer** in host or client code that changes observable
  behaviour: a `lib/index.js` / `lib/git.js` option or argv flag, or a `presentation.*` member the
  client actually reads (the note names the consumer). Values that are only passed through the
  payload without a consumer are not mapped.
- `vscode-only` — the setting only means something inside the VS Code host (editor groups,
  integrated terminal, status bar, webview retention, tab theming) and has no DSH counterpart.
- `out-of-scope` — a declared non-goal of this port (avatars, PR providers, interactive rebase,
  signing, per-repository filter state, unsupported dialog options). Every non-mapped entry
  carries its one-line reason in the note column.

Three DSH-only presentation settings — `showEmoji`, `issueUrlTemplate`, `globalShortcuts` —
are accepted by `normalizeSettings` but are **not** part of the upstream 110 and therefore do
not appear in this table.

## Counts

| Wiring | Entries | Canonical | Aliases |
| --- | ---: | ---: | ---: |
| `mapped` | 74 | 50 | 24 |
| `vscode-only` | 10 | 8 | 2 |
| `out-of-scope` | 26 | 23 | 3 |
| **total** | **110** | **81** | **29** |

Catalog: 110 entries = 81 canonical settings + 29 aliases, split **mapped 74** / **vscode-only 10** / **out-of-scope 26**.

`aliasOf` marks the 29 legacy flat spellings upstream still declares: their value folds into
the canonical key and the canonical key wins when both are set and differ.

## Presentation payload

`PRESENTATION_KEYS` holds **30** keys: the 26 contract §4 keys in their original order, then
`initialLoad` (300), `loadMore` (100) and `loadMoreAutomatically` (true) for the client pagination
consumer, and `avatars` (false) last for the wave-9 client avatar rendering. `presentation.initialLoad` /
`presentation.loadMore` are clamped to **1–2000**; out-of-range or fractional values are clamped and
reported in `invalid`.

## Audit

Every `mapped` row was re-audited against the final code: the host consumers live in
`lib/index.js` (`apply`/`handleGraph`/`handleAction`, repository discovery) and `lib/git.js`
(`readGraph`/`readUncommitted`/`performAction`); the client consumers live in `lib/client.js`
(`presentationOf` plus the components that read each member, e.g. `formatCommitDate`,
`dialogDefaultsFor`, `layoutRefChips`, `paginationOf`/`shouldAutoLoad`, `shortcutFor`,
`visibleMenuItems`, `orderedRepositories`). The only former `mapped` key demoted in this audit is
`fileEncoding`: the value is still forwarded as `presentation.fileEncoding`, but no host or client
code reads it, so it is now `out-of-scope`. Wave 9 later mapped two former non-goals for real:
`repository.commits.fetchAvatars` (host Gravatar URLs + `presentation.avatars` client rendering) and
`customPullRequestProviders` (host `POST /pr` URL substitution + client PR dialog). Legacy aliases
inherit the wiring and consumer of their canonical key. `test/settings.test.js` pins the invariant
that no mapped note defers to a future wave, and that this document's count table matches the module.

## Key table

| Key | Type | Default | aliasOf / wiring | Note |
| --- | --- | --- | --- | --- |
| `commitDetailsView.autoCenter` | `boolean` | `true` | `mapped` | presentation.autoCenterDetails -> DetailView scrollDetailIntoView (auto-centers the opened detail) |
| `commitDetailsView.fileView.fileTree.compactFolders` | `boolean` | `true` | `mapped` | presentation.compactFolders -> buildFileTree compact chains in the detail/comparison file view |
| `commitDetailsView.fileView.type` | `string` | `"File Tree"` | `mapped` | presentation.fileViewType -> default detail file view (fileViewOf) |
| `commitDetailsView.location` | `string` | `"Inline"` | `vscode-only` | VS Code webview layout (inline vs docked); the DSH sidebar has one fixed layout |
| `contextMenuActionsVisibility` | `object` | `{}` | `mapped` | presentation.contextMenuVisibility -> context-menu filter (visibleMenuItems); groups are flattened to action ids, so one false hides that action across menus |
| `customBranchGlobPatterns` | `array` | `[]` | `mapped` | presentation.customBranchGlobPatterns -> branch-filter glob prefill (globPrefillText) |
| `customEmojiShortcodeMappings` | `array` | `[]` | `mapped` | presentation.emojiMappings -> emojiTable merged into richTextParts |
| `customPullRequestProviders` | `array` | `[]` | `mapped` | lib/git.js readPullRequest substitutes $1..$8 in each custom {name, templateUrl} provider; the client PR dialog lists the returned URLs (POST /pr) |
| `date.format` | `string` | `"Date & Time"` | `mapped` | presentation.dateFormat -> formatCommitDate (commit row and detail dates) |
| `date.type` | `string` | `"Author Date"` | `mapped` | presentation.dateType -> author vs committer date in the commit row and detail |
| `defaultColumnVisibility` | `object` | `{"Date":true,"Author":true,"Commit":true}` | `mapped` | presentation.columnVisibility -> initial column toggles (columnsOf) |
| `dialog.addTag.pushToRemote` | `boolean` | `false` | `out-of-scope` | no add-tag push option in the DSH dialog; pushing tags is a separate action |
| `dialog.addTag.type` | `string` | `"Annotated"` | `out-of-scope` | the DSH create-tag action always creates a lightweight tag |
| `dialog.applyStash.reinstateIndex` | `boolean` | `false` | `mapped` | presentation.dialogDefaults.applyStash.reinstateIndex -> ActionDialog stash-apply default (dialogDefaultsFor) |
| `dialog.cherryPick.noCommit` | `boolean` | `false` | `out-of-scope` | the DSH cherry-pick dialog has no option controls |
| `dialog.cherryPick.recordOrigin` | `boolean` | `false` | `out-of-scope` | the DSH cherry-pick dialog has no option controls |
| `dialog.createBranch.checkOut` | `boolean` | `false` | `out-of-scope` | no check-out option in the DSH create-branch dialog |
| `dialog.deleteBranch.forceDelete` | `boolean` | `false` | `out-of-scope` | delete starts non-force and only escalates after git refuses |
| `dialog.fetchIntoLocalBranch.forceFetch` | `boolean` | `false` | `out-of-scope` | fetch-into-local-branch never forces |
| `dialog.fetchRemote.prune` | `boolean` | `false` | `out-of-scope` | the fetch dialog has no prune control; the canonical repository.fetchAndPrune applies |
| `dialog.fetchRemote.pruneTags` | `boolean` | `false` | `out-of-scope` | the fetch dialog has no prune-tags control; the canonical repository.fetchAndPruneTags applies |
| `dialog.general.referenceInputSpaceSubstitution` | `string` | `"None"` | `out-of-scope` | DSH ref-name inputs do not substitute spaces |
| `dialog.merge.noCommit` | `boolean` | `false` | `mapped` | presentation.dialogDefaults.merge.noCommit -> ActionDialog merge checkbox default (dialogDefaultsFor) |
| `dialog.merge.noFastForward` | `boolean` | `true` | `mapped` | presentation.dialogDefaults.merge.noFastForward -> ActionDialog merge checkbox default (dialogDefaultsFor) |
| `dialog.merge.squashCommits` | `boolean` | `false` | `mapped` | presentation.dialogDefaults.merge.squashCommits -> ActionDialog merge squash default (dialogDefaultsFor) |
| `dialog.merge.squashMessageFormat` | `string` | `"Default"` | `out-of-scope` | the squash message format is not configurable |
| `dialog.popStash.reinstateIndex` | `boolean` | `false` | `mapped` | presentation.dialogDefaults.popStash.reinstateIndex -> ActionDialog stash-pop default (dialogDefaultsFor) |
| `dialog.pullBranch.noFastForward` | `boolean` | `false` | `mapped` | presentation.dialogDefaults.pullBranch.noFastForward -> ActionDialog pull checkbox default (dialogDefaultsFor) |
| `dialog.pullBranch.squashCommits` | `boolean` | `false` | `out-of-scope` | the pull dialog offers rebase, not squash |
| `dialog.pullBranch.squashMessageFormat` | `string` | `"Default"` | `out-of-scope` | the pull dialog offers no squash option |
| `dialog.rebase.ignoreDate` | `boolean` | `true` | `out-of-scope` | the rebase dialog only takes an --onto target |
| `dialog.rebase.launchInteractiveRebase` | `boolean` | `false` | `out-of-scope` | non-goal: interactive rebase |
| `dialog.resetCurrentBranchToCommit.mode` | `string` | `"Mixed"` | `mapped` | presentation.dialogDefaults.resetCurrentBranchToCommit.mode -> ActionDialog reset-mode default (dialogDefaultsFor) |
| `dialog.resetUncommittedChanges.mode` | `string` | `"Mixed"` | `mapped` | presentation.dialogDefaults.resetUncommittedChanges.mode -> ActionDialog reset-uncommitted mode default (dialogDefaultsFor) |
| `dialog.stashUncommittedChanges.includeUntracked` | `boolean` | `true` | `mapped` | presentation.dialogDefaults.stashUncommittedChanges.includeUntracked -> ActionDialog stash include-untracked default (dialogDefaultsFor) |
| `enhancedAccessibility` | `boolean` | `false` | `mapped` | presentation.enhancedAccessibility -> FileRow status text/aria labels and ActionDialog accessibility labels |
| `fileEncoding` | `string` | `"utf8"` | `out-of-scope` | value is forwarded in presentation.fileEncoding but the client has no consumer; file-content encoding selection is not implemented |
| `graph.colours` | `array` | `["#0085d9","#d9008f","#00d90a","#d98500","#a300d9","#ff0000","#00d9cc","#e138e8","#85d900","#dc5b23","#6f24d6","#ffcc00"]` | `mapped` | presentation.graphColours -> laneColor graph palette |
| `graph.style` | `string` | `"rounded"` | `mapped` | presentation.graphStyle -> lanePath/Graph rounded vs angular rendering |
| `graph.uncommittedChanges` | `string` | `"Open Circle at the Uncommitted Changes"` | `out-of-scope` | the uncommitted-changes row is always drawn at the top; no rendering option |
| `integratedTerminalShell` | `string` | `""` | `vscode-only` | VS Code integrated terminal shell; DSH has no integrated terminal |
| `keyboardShortcut.find` | `string` | `"CTRL/CMD + F"` | `mapped` | presentation.shortcuts.find -> tab-scoped keydown handler (shortcutFor) |
| `keyboardShortcut.refresh` | `string` | `"CTRL/CMD + R"` | `mapped` | presentation.shortcuts.refresh -> tab-scoped keydown handler (shortcutFor) |
| `keyboardShortcut.scrollToHead` | `string` | `"CTRL/CMD + H"` | `mapped` | presentation.shortcuts.scrollToHead -> tab-scoped keydown handler (shortcutFor) |
| `keyboardShortcut.scrollToStash` | `string` | `"CTRL/CMD + S"` | `mapped` | presentation.shortcuts.scrollToStash -> tab-scoped keydown handler (shortcutFor) |
| `markdown` | `boolean` | `true` | `mapped` | presentation.markdown -> RichText markdown subset in tag detail messages |
| `maxDepthOfRepoSearch` | `number` | `0` | `mapped` | lib/index.js normalizeSearchDepth -> repository discovery depth |
| `openNewTabEditorGroup` | `string` | `"Active"` | `vscode-only` | VS Code editor-group placement for the diff view; DSH renders diffs in its own panel |
| `openToTheRepoOfTheActiveTextEditorDocument` | `boolean` | `false` | `vscode-only` | depends on the VS Code active text editor/document |
| `referenceLabels.alignment` | `string` | `"Normal"` | `mapped` | presentation.referenceLabelAlignment -> layoutRefChips alignment |
| `referenceLabels.combineLocalAndRemoteBranchLabels` | `boolean` | `true` | `mapped` | presentation.combineLocalAndRemoteBranchLabels -> combineLocalAndRemoteChips in layoutRefChips |
| `repository.commits.fetchAvatars` | `boolean` | `false` | `mapped` | lib/git.js readGraph/readCommit add authorAvatar/committerAvatar Gravatar URLs when true (default false: no network unless enabled); presentation.avatars switches client avatar rendering (initials fallback) |
| `repository.commits.initialLoad` | `number` | `300` | `mapped` | default graph page size (300) when the request omits `limit`; still capped; presentation.initialLoad seeds the client's first request (paginationOf) |
| `repository.commits.loadMore` | `number` | `100` | `mapped` | presentation.loadMore -> client pagination step (requestMoreCommits) |
| `repository.commits.loadMoreAutomatically` | `boolean` | `true` | `mapped` | presentation.loadMoreAutomatically -> shouldAutoLoad load-more-on-scroll |
| `repository.commits.mute.commitsThatAreNotAncestorsOfHead` | `boolean` | `false` | `mapped` | presentation.muteNonAncestors -> muted row styling (nonAncestorHashes) |
| `repository.commits.mute.mergeCommits` | `boolean` | `true` | `mapped` | presentation.muteMergeCommits -> muted merge-row styling (CommitRow) |
| `repository.commits.order` | `string` | `"date"` | `mapped` | lib/index.js defaultOrder -> git readGraph order flag when the request omits `order`; invalid values fall back to date |
| `repository.commits.showSignatureStatus` | `boolean` | `false` | `mapped` | presentation.showSignature -> signatureBadge in DetailView |
| `repository.fetchAndPrune` | `boolean` | `false` | `mapped` | lib/git.js performAction fetch: --prune only when true (upstream default false; request prune overrides) |
| `repository.fetchAndPruneTags` | `boolean` | `false` | `mapped` | lib/git.js performAction fetch: --prune-tags only when true (request pruneTags overrides) |
| `repository.includeCommitsMentionedByReflogs` | `boolean` | `false` | `mapped` | lib/index.js includeReflogCommits -> readGraph --reflog on the default walk |
| `repository.onLoad.scrollToHead` | `boolean` | `false` | `out-of-scope` | there is no scroll-to-head on repository load |
| `repository.onLoad.showCheckedOutBranch` | `boolean` | `false` | `out-of-scope` | branch filtering defaults to all branches |
| `repository.onLoad.showSpecificBranches` | `array` | `[]` | `out-of-scope` | there is no per-repository branch filter on load |
| `repository.onlyFollowFirstParent` | `boolean` | `false` | `mapped` | lib/index.js firstParent -> readGraph --first-parent on the walk |
| `repository.showCommitsOnlyReferencedByTags` | `boolean` | `true` | `mapped` | lib/git.js readGraph includeTags -> --tags walk source (with showTags) |
| `repository.showRemoteBranches` | `boolean` | `true` | `mapped` | lib/git.js readGraph --remotes walk plus remote branch chips |
| `repository.showRemoteHeads` | `boolean` | `true` | `mapped` | lib/git.js readGraph drops refs/remotes/<remote>/HEAD refs and origin/HEAD decoration chips |
| `repository.showStashes` | `boolean` | `true` | `mapped` | lib/git.js readGraph stash refs/list and the `stashes` member |
| `repository.showTags` | `boolean` | `true` | `mapped` | lib/git.js readGraph --tags walk source plus tag refs/chips/menus |
| `repository.showUncommittedChanges` | `boolean` | `true` | `out-of-scope` | the uncommitted-changes row is always shown |
| `repository.showUntrackedFiles` | `boolean` | `true` | `mapped` | lib/git.js readUncommitted passes --untracked-files=no when false |
| `repository.sign.commits` | `boolean` | `false` | `out-of-scope` | non-goal: commit signing (-S) is not implemented |
| `repository.sign.tags` | `boolean` | `false` | `out-of-scope` | non-goal: tag signing is not implemented |
| `repository.useMailmap` | `boolean` | `false` | `mapped` | lib/git.js readGraph --use-mailmap + mailmap-aware placeholders; also presentation.useMailmap |
| `repositoryDropdownOrder` | `string` | `"Workspace Full Path"` | `mapped` | presentation.repositoryDropdownOrder -> orderedRepositories repo-dropdown sort |
| `retainContextWhenHidden` | `boolean` | `true` | `vscode-only` | VS Code webview retention; DSH panels stay mounted |
| `showStatusBarItem` | `boolean` | `true` | `vscode-only` | VS Code status bar item; DSH has no status bar |
| `sourceCodeProviderIntegrationLocation` | `string` | `"Inline"` | `vscode-only` | VS Code Source Control provider integration |
| `tabIconColourTheme` | `string` | `"colour"` | `vscode-only` | VS Code tab icon theming |
| `autoCenterCommitDetailsView` | `boolean` | `true` | `aliasOf` → `commitDetailsView.autoCenter` | Legacy alias of commitDetailsView.autoCenter; wired through commitDetailsView.autoCenter |
| `combineLocalAndRemoteBranchLabels` | `boolean` | `true` | `aliasOf` → `referenceLabels.combineLocalAndRemoteBranchLabels` | Legacy alias of referenceLabels.combineLocalAndRemoteBranchLabels; wired through referenceLabels.combineLocalAndRemoteBranchLabels |
| `commitDetailsViewFileTreeCompactFolders` | `boolean` | `true` | `aliasOf` → `commitDetailsView.fileView.fileTree.compactFolders` | Legacy alias of commitDetailsView.fileView.fileTree.compactFolders; wired through commitDetailsView.fileView.fileTree.compactFolders |
| `commitDetailsViewLocation` | `string` | `"Inline"` | `aliasOf` → `commitDetailsView.location` | Legacy alias of commitDetailsView.location; folds into it — VS Code webview layout (inline vs docked); the DSH sidebar has one fixed layout |
| `commitOrdering` | `string` | `"date"` | `aliasOf` → `repository.commits.order` | Legacy alias of repository.commits.order; wired through repository.commits.order |
| `dateFormat` | `string` | `"Date & Time"` | `aliasOf` → `date.format` | Legacy alias of date.format; wired through date.format |
| `dateType` | `string` | `"Author Date"` | `aliasOf` → `date.type` | Legacy alias of date.type; wired through date.type |
| `defaultFileViewType` | `string` | `"File Tree"` | `aliasOf` → `commitDetailsView.fileView.type` | Legacy alias of commitDetailsView.fileView.type; wired through commitDetailsView.fileView.type |
| `fetchAndPrune` | `boolean` | `false` | `aliasOf` → `repository.fetchAndPrune` | Legacy alias of repository.fetchAndPrune; wired through repository.fetchAndPrune |
| `fetchAvatars` | `boolean` | `false` | `aliasOf` → `repository.commits.fetchAvatars` | Legacy alias of repository.commits.fetchAvatars; wired through repository.commits.fetchAvatars |
| `graphColours` | `array` | `["#0085d9","#d9008f","#00d90a","#d98500","#a300d9","#ff0000","#00d9cc","#e138e8","#85d900","#dc5b23","#6f24d6","#ffcc00"]` | `aliasOf` → `graph.colours` | Legacy alias of graph.colours; wired through graph.colours |
| `graphStyle` | `string` | `"rounded"` | `aliasOf` → `graph.style` | Legacy alias of graph.style; wired through graph.style |
| `includeCommitsMentionedByReflogs` | `boolean` | `false` | `aliasOf` → `repository.includeCommitsMentionedByReflogs` | Legacy alias of repository.includeCommitsMentionedByReflogs; wired through repository.includeCommitsMentionedByReflogs |
| `initialLoadCommits` | `number` | `300` | `aliasOf` → `repository.commits.initialLoad` | Legacy alias of repository.commits.initialLoad; wired through repository.commits.initialLoad |
| `loadMoreCommits` | `number` | `100` | `aliasOf` → `repository.commits.loadMore` | Legacy alias of repository.commits.loadMore; wired through repository.commits.loadMore |
| `loadMoreCommitsAutomatically` | `boolean` | `true` | `aliasOf` → `repository.commits.loadMoreAutomatically` | Legacy alias of repository.commits.loadMoreAutomatically; wired through repository.commits.loadMoreAutomatically |
| `muteCommitsThatAreNotAncestorsOfHead` | `boolean` | `false` | `aliasOf` → `repository.commits.mute.commitsThatAreNotAncestorsOfHead` | Legacy alias of repository.commits.mute.commitsThatAreNotAncestorsOfHead; wired through repository.commits.mute.commitsThatAreNotAncestorsOfHead |
| `muteMergeCommits` | `boolean` | `true` | `aliasOf` → `repository.commits.mute.mergeCommits` | Legacy alias of repository.commits.mute.mergeCommits; wired through repository.commits.mute.mergeCommits |
| `onlyFollowFirstParent` | `boolean` | `false` | `aliasOf` → `repository.onlyFollowFirstParent` | Legacy alias of repository.onlyFollowFirstParent; wired through repository.onlyFollowFirstParent |
| `openDiffTabLocation` | `string` | `"Active"` | `aliasOf` → `openNewTabEditorGroup` | Legacy alias of openNewTabEditorGroup; folds into it — VS Code editor-group placement for the diff view; DSH renders diffs in its own panel |
| `openRepoToHead` | `boolean` | `false` | `aliasOf` → `repository.onLoad.scrollToHead` | Legacy alias of repository.onLoad.scrollToHead; folds into it — there is no scroll-to-head on repository load |
| `referenceLabelAlignment` | `string` | `"Normal"` | `aliasOf` → `referenceLabels.alignment` | Legacy alias of referenceLabels.alignment; wired through referenceLabels.alignment |
| `showCommitsOnlyReferencedByTags` | `boolean` | `true` | `aliasOf` → `repository.showCommitsOnlyReferencedByTags` | Legacy alias of repository.showCommitsOnlyReferencedByTags; wired through repository.showCommitsOnlyReferencedByTags |
| `showCurrentBranchByDefault` | `boolean` | `false` | `aliasOf` → `repository.onLoad.showCheckedOutBranch` | Legacy alias of repository.onLoad.showCheckedOutBranch; folds into it — branch filtering defaults to all branches |
| `showSignatureStatus` | `boolean` | `false` | `aliasOf` → `repository.commits.showSignatureStatus` | Legacy alias of repository.commits.showSignatureStatus; wired through repository.commits.showSignatureStatus |
| `showTags` | `boolean` | `true` | `aliasOf` → `repository.showTags` | Legacy alias of repository.showTags; wired through repository.showTags |
| `showUncommittedChanges` | `boolean` | `true` | `aliasOf` → `repository.showUncommittedChanges` | Legacy alias of repository.showUncommittedChanges; folds into it — the uncommitted-changes row is always shown |
| `showUntrackedFiles` | `boolean` | `true` | `aliasOf` → `repository.showUntrackedFiles` | Legacy alias of repository.showUntrackedFiles; wired through repository.showUntrackedFiles |
| `useMailmap` | `boolean` | `false` | `aliasOf` → `repository.useMailmap` | Legacy alias of repository.useMailmap; wired through repository.useMailmap |

## How this is verified

`test/settings.test.js` (node:test) imports `lib/settings.js` directly and runs with `node --test` (plus `node --check lib/settings.js` for the syntax gate). It asserts: exactly 110 unique keys and the 110-row table above; the 81 canonical / 29 alias split with every `aliasOf` target existing and being canonical; the 74 mapped / 10 vscode-only / 26 out-of-scope split with a non-empty one-line note on every non-mapped entry; folding of all 29 aliases and canonical-wins precedence when both are set and differ; that the wave-8-B host-wired keys are mapped and their notes describe the current behaviour; that every mapped note names a concrete consumer and none defers to a future wave or admits having no consumer (and that this document's count table matches the module exactly); number/boolean/array/object coercion and the `invalid`/`unknown` reports; a presentation payload containing exactly the 30 keys (the 26 contract §4 keys, the three pagination keys and `avatars`) in order that survives `JSON.stringify` and is request-independent; the 1–2000 pagination clamp; and `parseShortcut` for all four `keyboardShortcut.*` keys (CTRL/CMD/ALT/SHIFT and function keys) including the default fallback for unparsable descriptors. The suite also feeds `normalizeSettings` non-objects, throwing proxies and throwing getters to prove it never throws.

## User-visible defaults changed by the host wiring

- `fetch` no longer passes `--prune` by default: `repository.fetchAndPrune` / `repository.fetchAndPruneTags`
  default to false and the request's `prune` / `pruneTags` flags override them.
- The default graph page size comes from `repository.commits.initialLoad` (300) when the request omits
  `limit` (still capped); `presentation.initialLoad` / `loadMore` / `loadMoreAutomatically` carry the
  pagination defaults to the client in wave 8-C part 2.
- `repository.showTags` removes tag refs/chips/menus and controls the `--tags` walk source;
  `repository.showRemoteHeads` drops `origin/HEAD`-style refs and decoration chips;
  `repository.showRemoteBranches` already hid remote branch chips.
- `repository.showUntrackedFiles: false` makes `/uncommitted` pass `--untracked-files=no`.
- `repository.commits.order` supplies the default ordering for requests without `order`;
  `onlyFollowFirstParent` and `includeCommitsMentionedByReflogs` change the default walk.
- Avatars stay off by default: `repository.commits.fetchAvatars: true` is an explicit opt-in that
  makes the host add Gravatar URLs to `/graph` rows and `/commit` (network only when enabled); the
  client then renders them with an initials fallback.
- `customPullRequestProviders` feeds the `POST /pr` route: each `{name, templateUrl}` gets `$1..$8`
  substituted and the resulting URLs are listed by the client PR dialog.

## Classification notes

- Already wired before this module existed (11 config keys): `graph.style`/`graphColours`,
  `repository.commits.showSignatureStatus`, `repository.showRemoteBranches`,
  `repository.showStashes`, `repository.useMailmap`, `maxDepthOfRepoSearch`, plus the DSH-only
  `showEmoji`/`issueUrlTemplate` extensions and the host-level `repoPath`/`maxCommits` keys
  (owned by `normalizeConfig`).
- `presentation.dialogDefaults` deliberately contains only the 9 dialog options the DSH dialog
  component can honour; the other 14 `dialog.*` keys stay out of the payload and are
  `out-of-scope` here with their reason, rather than being forwarded as dead data.
- For drop-in compatibility with the keys wired before this wave, `normalizeSettings` also accepts
  the three DSH compat spellings (`showRemoteBranches`, `showStashes`, `showSignature`) as aliases of
  their canonical keys. The host-level `repoPath` / `maxCommits` keys stay owned by
  `normalizeConfig` and are ignored (not reported as unknown) here; the full 11-key
  `cordis.patch.yml` object therefore normalizes with `unknown: []`.

