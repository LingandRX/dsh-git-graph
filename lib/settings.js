/**
 * Upstream settings parity for the dsh-git-graph plugin.
 *
 * Ports the **110** configuration keys that mhutchie/vscode-git-graph v1.30.0
 * declares in `package.json` → `contributes.configuration.properties`, and
 * normalizes this plugin's raw configuration into plain values plus the
 * `/graph` `presentation` payload and its keyboard-shortcut descriptors.
 *
 * The module is dependency-free and side-effect free (no imports, no global
 * state): the host half, the client half and the tests can consume it with a
 * single `import`. {@link normalizeSettings} never throws, whatever the raw
 * configuration contains.
 *
 * Design notes:
 *
 * - `key` is the upstream key **without** the `git-graph.` prefix.
 * - The 29 legacy flat spellings are recorded with `aliasOf`; their value
 *   folds into the canonical key, and the canonical key wins when both are set.
 * - `wiring` is `mapped` (this plugin honours the value today, either through
 *   the `/graph` presentation payload or through an existing graph/config
 *   option), `vscode-only` (only meaningful inside the VS Code host) or
 *   `out-of-scope` (a declared non-goal of this port). Every non-mapped entry
 *   carries a one-line `note` explaining the limitation.
 * - Three DSH-only presentation settings (`showEmoji`, `issueUrlTemplate`,
 *   `globalShortcuts`) are accepted but are **not** part of the upstream 110;
 *   they are listed in {@link EXTENSION_KEYS}.
 *
 * @module dsh-git-graph/settings
 */

/**
 * @typedef {"boolean" | "string" | "number" | "array" | "object"} SettingType
 * @typedef {"mapped" | "vscode-only" | "out-of-scope"} Wiring
 * @typedef {{ key: string, type: SettingType, default: unknown, aliasOf?: string, wiring: Wiring, note: string }} Setting
 * @typedef {{ key: string, ctrl: boolean, meta: boolean, alt: boolean, shift: boolean }} Shortcut
 * @typedef {{ key: string, canonical: string, discarded: boolean }} AliasedKey
 * @typedef {{ key: string, reason: string, value?: string | number | boolean }} InvalidEntry
 * @typedef {{ values: Record<string, unknown>, presentation: Record<string, unknown>, shortcuts: Record<string, Shortcut>, aliased: AliasedKey[], unknown: string[], invalid: InvalidEntry[] }} NormalizedSettings
 */

/* ------------------------------------------------------------------------- */
/* The upstream 110-key table                                                  */
/* ------------------------------------------------------------------------- */

export const SETTINGS = [
  {
    key: "commitDetailsView.autoCenter",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "presentation.autoCenterDetails -> DetailView scrollDetailIntoView (auto-centers the opened detail)",
  },
  {
    key: "commitDetailsView.fileView.fileTree.compactFolders",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "presentation.compactFolders -> buildFileTree compact chains in the detail/comparison file view",
  },
  {
    key: "commitDetailsView.fileView.type",
    type: "string",
    default: "File Tree",
    wiring: "mapped",
    note: "presentation.fileViewType -> default detail file view (fileViewOf)",
  },
  {
    key: "commitDetailsView.location",
    type: "string",
    default: "Inline",
    wiring: "vscode-only",
    note: "VS Code webview layout (inline vs docked); the DSH sidebar has one fixed layout",
  },
  {
    key: "contextMenuActionsVisibility",
    type: "object",
    default: {},
    wiring: "mapped",
    note: "presentation.contextMenuVisibility -> context-menu filter (visibleMenuItems); groups are flattened to action ids, so one false hides that action across menus",
  },
  {
    key: "customBranchGlobPatterns",
    type: "array",
    default: [],
    wiring: "mapped",
    note: "presentation.customBranchGlobPatterns -> branch-filter glob prefill (globPrefillText)",
  },
  {
    key: "customEmojiShortcodeMappings",
    type: "array",
    default: [],
    wiring: "mapped",
    note: "presentation.emojiMappings -> emojiTable merged into richTextParts",
  },
  {
    key: "customPullRequestProviders",
    type: "array",
    default: [],
    wiring: "mapped",
    note: "lib/git.js readPullRequest substitutes $1..$8 in each custom {name, templateUrl} provider; the client PR dialog lists the returned URLs (POST /pr)",
  },
  {
    key: "date.format",
    type: "string",
    default: "Date & Time",
    wiring: "mapped",
    note: "presentation.dateFormat -> formatCommitDate (commit row and detail dates)",
  },
  {
    key: "date.type",
    type: "string",
    default: "Author Date",
    wiring: "mapped",
    note: "presentation.dateType -> author vs committer date in the commit row and detail",
  },
  {
    key: "defaultColumnVisibility",
    type: "object",
    default: {"Date":true,"Author":true,"Commit":true},
    wiring: "mapped",
    note: "presentation.columnVisibility -> initial column toggles (columnsOf)",
  },
  {
    key: "dialog.addTag.pushToRemote",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "no add-tag push option in the DSH dialog; pushing tags is a separate action",
  },
  {
    key: "dialog.addTag.type",
    type: "string",
    default: "Annotated",
    wiring: "out-of-scope",
    note: "the DSH create-tag action always creates a lightweight tag",
  },
  {
    key: "dialog.applyStash.reinstateIndex",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "presentation.dialogDefaults.applyStash.reinstateIndex -> ActionDialog stash-apply default (dialogDefaultsFor)",
  },
  {
    key: "dialog.cherryPick.noCommit",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "the DSH cherry-pick dialog has no option controls",
  },
  {
    key: "dialog.cherryPick.recordOrigin",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "the DSH cherry-pick dialog has no option controls",
  },
  {
    key: "dialog.createBranch.checkOut",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "no check-out option in the DSH create-branch dialog",
  },
  {
    key: "dialog.deleteBranch.forceDelete",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "delete starts non-force and only escalates after git refuses",
  },
  {
    key: "dialog.fetchIntoLocalBranch.forceFetch",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "fetch-into-local-branch never forces",
  },
  {
    key: "dialog.fetchRemote.prune",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "the fetch dialog has no prune control; the canonical repository.fetchAndPrune applies",
  },
  {
    key: "dialog.fetchRemote.pruneTags",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "the fetch dialog has no prune-tags control; the canonical repository.fetchAndPruneTags applies",
  },
  {
    key: "dialog.general.referenceInputSpaceSubstitution",
    type: "string",
    default: "None",
    wiring: "out-of-scope",
    note: "DSH ref-name inputs do not substitute spaces",
  },
  {
    key: "dialog.merge.noCommit",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "presentation.dialogDefaults.merge.noCommit -> ActionDialog merge checkbox default (dialogDefaultsFor)",
  },
  {
    key: "dialog.merge.noFastForward",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "presentation.dialogDefaults.merge.noFastForward -> ActionDialog merge checkbox default (dialogDefaultsFor)",
  },
  {
    key: "dialog.merge.squashCommits",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "presentation.dialogDefaults.merge.squashCommits -> ActionDialog merge squash default (dialogDefaultsFor)",
  },
  {
    key: "dialog.merge.squashMessageFormat",
    type: "string",
    default: "Default",
    wiring: "out-of-scope",
    note: "the squash message format is not configurable",
  },
  {
    key: "dialog.popStash.reinstateIndex",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "presentation.dialogDefaults.popStash.reinstateIndex -> ActionDialog stash-pop default (dialogDefaultsFor)",
  },
  {
    key: "dialog.pullBranch.noFastForward",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "presentation.dialogDefaults.pullBranch.noFastForward -> ActionDialog pull checkbox default (dialogDefaultsFor)",
  },
  {
    key: "dialog.pullBranch.squashCommits",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "the pull dialog offers rebase, not squash",
  },
  {
    key: "dialog.pullBranch.squashMessageFormat",
    type: "string",
    default: "Default",
    wiring: "out-of-scope",
    note: "the pull dialog offers no squash option",
  },
  {
    key: "dialog.rebase.ignoreDate",
    type: "boolean",
    default: true,
    wiring: "out-of-scope",
    note: "the rebase dialog only takes an --onto target",
  },
  {
    key: "dialog.rebase.launchInteractiveRebase",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "non-goal: interactive rebase",
  },
  {
    key: "dialog.resetCurrentBranchToCommit.mode",
    type: "string",
    default: "Mixed",
    wiring: "mapped",
    note: "presentation.dialogDefaults.resetCurrentBranchToCommit.mode -> ActionDialog reset-mode default (dialogDefaultsFor)",
  },
  {
    key: "dialog.resetUncommittedChanges.mode",
    type: "string",
    default: "Mixed",
    wiring: "mapped",
    note: "presentation.dialogDefaults.resetUncommittedChanges.mode -> ActionDialog reset-uncommitted mode default (dialogDefaultsFor)",
  },
  {
    key: "dialog.stashUncommittedChanges.includeUntracked",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "presentation.dialogDefaults.stashUncommittedChanges.includeUntracked -> ActionDialog stash include-untracked default (dialogDefaultsFor)",
  },
  {
    key: "enhancedAccessibility",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "presentation.enhancedAccessibility -> FileRow status text/aria labels and ActionDialog accessibility labels",
  },
  {
    key: "fileEncoding",
    type: "string",
    default: "utf8",
    wiring: "out-of-scope",
    note: "value is forwarded in presentation.fileEncoding but the client has no consumer; file-content encoding selection is not implemented",
  },
  {
    key: "graph.colours",
    type: "array",
    default: ["#0085d9","#d9008f","#00d90a","#d98500","#a300d9","#ff0000","#00d9cc","#e138e8","#85d900","#dc5b23","#6f24d6","#ffcc00"],
    wiring: "mapped",
    note: "presentation.graphColours -> laneColor graph palette",
  },
  {
    key: "graph.style",
    type: "string",
    default: "rounded",
    wiring: "mapped",
    note: "presentation.graphStyle -> lanePath/Graph rounded vs angular rendering",
  },
  {
    key: "graph.uncommittedChanges",
    type: "string",
    default: "Open Circle at the Uncommitted Changes",
    wiring: "out-of-scope",
    note: "the uncommitted-changes row is always drawn at the top; no rendering option",
  },
  {
    key: "integratedTerminalShell",
    type: "string",
    default: "",
    wiring: "vscode-only",
    note: "VS Code integrated terminal shell; DSH has no integrated terminal",
  },
  {
    key: "keyboardShortcut.find",
    type: "string",
    default: "CTRL/CMD + F",
    wiring: "mapped",
    note: "presentation.shortcuts.find -> tab-scoped keydown handler (shortcutFor)",
  },
  {
    key: "keyboardShortcut.refresh",
    type: "string",
    default: "CTRL/CMD + R",
    wiring: "mapped",
    note: "presentation.shortcuts.refresh -> tab-scoped keydown handler (shortcutFor)",
  },
  {
    key: "keyboardShortcut.scrollToHead",
    type: "string",
    default: "CTRL/CMD + H",
    wiring: "mapped",
    note: "presentation.shortcuts.scrollToHead -> tab-scoped keydown handler (shortcutFor)",
  },
  {
    key: "keyboardShortcut.scrollToStash",
    type: "string",
    default: "CTRL/CMD + S",
    wiring: "mapped",
    note: "presentation.shortcuts.scrollToStash -> tab-scoped keydown handler (shortcutFor)",
  },
  {
    key: "markdown",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "presentation.markdown -> RichText markdown subset in tag detail messages",
  },
  {
    key: "maxDepthOfRepoSearch",
    type: "number",
    default: 0,
    wiring: "mapped",
    note: "lib/index.js normalizeSearchDepth -> repository discovery depth",
  },
  {
    key: "openNewTabEditorGroup",
    type: "string",
    default: "Active",
    wiring: "vscode-only",
    note: "VS Code editor-group placement for the diff view; DSH renders diffs in its own panel",
  },
  {
    key: "openToTheRepoOfTheActiveTextEditorDocument",
    type: "boolean",
    default: false,
    wiring: "vscode-only",
    note: "depends on the VS Code active text editor/document",
  },
  {
    key: "referenceLabels.alignment",
    type: "string",
    default: "Normal",
    wiring: "mapped",
    note: "presentation.referenceLabelAlignment -> layoutRefChips alignment",
  },
  {
    key: "referenceLabels.combineLocalAndRemoteBranchLabels",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "presentation.combineLocalAndRemoteBranchLabels -> combineLocalAndRemoteChips in layoutRefChips",
  },
  {
    key: "repository.commits.fetchAvatars",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "lib/git.js readGraph/readCommit add authorAvatar/committerAvatar Gravatar URLs when true (default false: no network unless enabled); presentation.avatars switches client avatar rendering (initials fallback)",
  },
  {
    key: "repository.commits.initialLoad",
    type: "number",
    default: 300,
    wiring: "mapped",
    note: "default graph page size (300) when the request omits `limit`; still capped; presentation.initialLoad seeds the client's first request (paginationOf)",
  },
  {
    key: "repository.commits.loadMore",
    type: "number",
    default: 100,
    wiring: "mapped",
    note: "presentation.loadMore -> client pagination step (requestMoreCommits)",
  },
  {
    key: "repository.commits.loadMoreAutomatically",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "presentation.loadMoreAutomatically -> shouldAutoLoad load-more-on-scroll",
  },
  {
    key: "repository.commits.mute.commitsThatAreNotAncestorsOfHead",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "presentation.muteNonAncestors -> muted row styling (nonAncestorHashes)",
  },
  {
    key: "repository.commits.mute.mergeCommits",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "presentation.muteMergeCommits -> muted merge-row styling (CommitRow)",
  },
  {
    key: "repository.commits.order",
    type: "string",
    default: "date",
    wiring: "mapped",
    note: "lib/index.js defaultOrder -> git readGraph order flag when the request omits `order`; invalid values fall back to date",
  },
  {
    key: "repository.commits.showSignatureStatus",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "presentation.showSignature -> signatureBadge in DetailView",
  },
  {
    key: "repository.fetchAndPrune",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "lib/git.js performAction fetch: --prune only when true (upstream default false; request prune overrides)",
  },
  {
    key: "repository.fetchAndPruneTags",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "lib/git.js performAction fetch: --prune-tags only when true (request pruneTags overrides)",
  },
  {
    key: "repository.includeCommitsMentionedByReflogs",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "lib/index.js includeReflogCommits -> readGraph --reflog on the default walk",
  },
  {
    key: "repository.onLoad.scrollToHead",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "there is no scroll-to-head on repository load",
  },
  {
    key: "repository.onLoad.showCheckedOutBranch",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "branch filtering defaults to all branches",
  },
  {
    key: "repository.onLoad.showSpecificBranches",
    type: "array",
    default: [],
    wiring: "out-of-scope",
    note: "there is no per-repository branch filter on load",
  },
  {
    key: "repository.onlyFollowFirstParent",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "lib/index.js firstParent -> readGraph --first-parent on the walk",
  },
  {
    key: "repository.showCommitsOnlyReferencedByTags",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "lib/git.js readGraph includeTags -> --tags walk source (with showTags)",
  },
  {
    key: "repository.showRemoteBranches",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "lib/git.js readGraph --remotes walk plus remote branch chips",
  },
  {
    key: "repository.showRemoteHeads",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "lib/git.js readGraph drops refs/remotes/<remote>/HEAD refs and origin/HEAD decoration chips",
  },
  {
    key: "repository.showStashes",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "lib/git.js readGraph stash refs/list and the `stashes` member",
  },
  {
    key: "repository.showTags",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "lib/git.js readGraph --tags walk source plus tag refs/chips/menus",
  },
  {
    key: "repository.showUncommittedChanges",
    type: "boolean",
    default: true,
    wiring: "out-of-scope",
    note: "the uncommitted-changes row is always shown",
  },
  {
    key: "repository.showUntrackedFiles",
    type: "boolean",
    default: true,
    wiring: "mapped",
    note: "lib/git.js readUncommitted passes --untracked-files=no when false",
  },
  {
    key: "repository.sign.commits",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "non-goal: commit signing (-S) is not implemented",
  },
  {
    key: "repository.sign.tags",
    type: "boolean",
    default: false,
    wiring: "out-of-scope",
    note: "non-goal: tag signing is not implemented",
  },
  {
    key: "repository.useMailmap",
    type: "boolean",
    default: false,
    wiring: "mapped",
    note: "lib/git.js readGraph --use-mailmap + mailmap-aware placeholders; also presentation.useMailmap",
  },
  {
    key: "repositoryDropdownOrder",
    type: "string",
    default: "Workspace Full Path",
    wiring: "mapped",
    note: "presentation.repositoryDropdownOrder -> orderedRepositories repo-dropdown sort",
  },
  {
    key: "retainContextWhenHidden",
    type: "boolean",
    default: true,
    wiring: "vscode-only",
    note: "VS Code webview retention; DSH panels stay mounted",
  },
  {
    key: "showStatusBarItem",
    type: "boolean",
    default: true,
    wiring: "vscode-only",
    note: "VS Code status bar item; DSH has no status bar",
  },
  {
    key: "sourceCodeProviderIntegrationLocation",
    type: "string",
    default: "Inline",
    wiring: "vscode-only",
    note: "VS Code Source Control provider integration",
  },
  {
    key: "tabIconColourTheme",
    type: "string",
    default: "colour",
    wiring: "vscode-only",
    note: "VS Code tab icon theming",
  },
  {
    key: "autoCenterCommitDetailsView",
    type: "boolean",
    default: true,
    aliasOf: "commitDetailsView.autoCenter",
    wiring: "mapped",
    note: "Legacy alias of commitDetailsView.autoCenter; wired through commitDetailsView.autoCenter",
  },
  {
    key: "combineLocalAndRemoteBranchLabels",
    type: "boolean",
    default: true,
    aliasOf: "referenceLabels.combineLocalAndRemoteBranchLabels",
    wiring: "mapped",
    note: "Legacy alias of referenceLabels.combineLocalAndRemoteBranchLabels; wired through referenceLabels.combineLocalAndRemoteBranchLabels",
  },
  {
    key: "commitDetailsViewFileTreeCompactFolders",
    type: "boolean",
    default: true,
    aliasOf: "commitDetailsView.fileView.fileTree.compactFolders",
    wiring: "mapped",
    note: "Legacy alias of commitDetailsView.fileView.fileTree.compactFolders; wired through commitDetailsView.fileView.fileTree.compactFolders",
  },
  {
    key: "commitDetailsViewLocation",
    type: "string",
    default: "Inline",
    aliasOf: "commitDetailsView.location",
    wiring: "vscode-only",
    note: "Legacy alias of commitDetailsView.location; folds into it — VS Code webview layout (inline vs docked); the DSH sidebar has one fixed layout",
  },
  {
    key: "commitOrdering",
    type: "string",
    default: "date",
    aliasOf: "repository.commits.order",
    wiring: "mapped",
    note: "Legacy alias of repository.commits.order; wired through repository.commits.order",
  },
  {
    key: "dateFormat",
    type: "string",
    default: "Date & Time",
    aliasOf: "date.format",
    wiring: "mapped",
    note: "Legacy alias of date.format; wired through date.format",
  },
  {
    key: "dateType",
    type: "string",
    default: "Author Date",
    aliasOf: "date.type",
    wiring: "mapped",
    note: "Legacy alias of date.type; wired through date.type",
  },
  {
    key: "defaultFileViewType",
    type: "string",
    default: "File Tree",
    aliasOf: "commitDetailsView.fileView.type",
    wiring: "mapped",
    note: "Legacy alias of commitDetailsView.fileView.type; wired through commitDetailsView.fileView.type",
  },
  {
    key: "fetchAndPrune",
    type: "boolean",
    default: false,
    aliasOf: "repository.fetchAndPrune",
    wiring: "mapped",
    note: "Legacy alias of repository.fetchAndPrune; wired through repository.fetchAndPrune",
  },
  {
    key: "fetchAvatars",
    type: "boolean",
    default: false,
    aliasOf: "repository.commits.fetchAvatars",
    wiring: "mapped",
    note: "Legacy alias of repository.commits.fetchAvatars; wired through repository.commits.fetchAvatars",
  },
  {
    key: "graphColours",
    type: "array",
    default: ["#0085d9","#d9008f","#00d90a","#d98500","#a300d9","#ff0000","#00d9cc","#e138e8","#85d900","#dc5b23","#6f24d6","#ffcc00"],
    aliasOf: "graph.colours",
    wiring: "mapped",
    note: "Legacy alias of graph.colours; wired through graph.colours",
  },
  {
    key: "graphStyle",
    type: "string",
    default: "rounded",
    aliasOf: "graph.style",
    wiring: "mapped",
    note: "Legacy alias of graph.style; wired through graph.style",
  },
  {
    key: "includeCommitsMentionedByReflogs",
    type: "boolean",
    default: false,
    aliasOf: "repository.includeCommitsMentionedByReflogs",
    wiring: "mapped",
    note: "Legacy alias of repository.includeCommitsMentionedByReflogs; wired through repository.includeCommitsMentionedByReflogs",
  },
  {
    key: "initialLoadCommits",
    type: "number",
    default: 300,
    aliasOf: "repository.commits.initialLoad",
    wiring: "mapped",
    note: "Legacy alias of repository.commits.initialLoad; wired through repository.commits.initialLoad",
  },
  {
    key: "loadMoreCommits",
    type: "number",
    default: 100,
    aliasOf: "repository.commits.loadMore",
    wiring: "mapped",
    note: "Legacy alias of repository.commits.loadMore; wired through repository.commits.loadMore",
  },
  {
    key: "loadMoreCommitsAutomatically",
    type: "boolean",
    default: true,
    aliasOf: "repository.commits.loadMoreAutomatically",
    wiring: "mapped",
    note: "Legacy alias of repository.commits.loadMoreAutomatically; wired through repository.commits.loadMoreAutomatically",
  },
  {
    key: "muteCommitsThatAreNotAncestorsOfHead",
    type: "boolean",
    default: false,
    aliasOf: "repository.commits.mute.commitsThatAreNotAncestorsOfHead",
    wiring: "mapped",
    note: "Legacy alias of repository.commits.mute.commitsThatAreNotAncestorsOfHead; wired through repository.commits.mute.commitsThatAreNotAncestorsOfHead",
  },
  {
    key: "muteMergeCommits",
    type: "boolean",
    default: true,
    aliasOf: "repository.commits.mute.mergeCommits",
    wiring: "mapped",
    note: "Legacy alias of repository.commits.mute.mergeCommits; wired through repository.commits.mute.mergeCommits",
  },
  {
    key: "onlyFollowFirstParent",
    type: "boolean",
    default: false,
    aliasOf: "repository.onlyFollowFirstParent",
    wiring: "mapped",
    note: "Legacy alias of repository.onlyFollowFirstParent; wired through repository.onlyFollowFirstParent",
  },
  {
    key: "openDiffTabLocation",
    type: "string",
    default: "Active",
    aliasOf: "openNewTabEditorGroup",
    wiring: "vscode-only",
    note: "Legacy alias of openNewTabEditorGroup; folds into it — VS Code editor-group placement for the diff view; DSH renders diffs in its own panel",
  },
  {
    key: "openRepoToHead",
    type: "boolean",
    default: false,
    aliasOf: "repository.onLoad.scrollToHead",
    wiring: "out-of-scope",
    note: "Legacy alias of repository.onLoad.scrollToHead; folds into it — there is no scroll-to-head on repository load",
  },
  {
    key: "referenceLabelAlignment",
    type: "string",
    default: "Normal",
    aliasOf: "referenceLabels.alignment",
    wiring: "mapped",
    note: "Legacy alias of referenceLabels.alignment; wired through referenceLabels.alignment",
  },
  {
    key: "showCommitsOnlyReferencedByTags",
    type: "boolean",
    default: true,
    aliasOf: "repository.showCommitsOnlyReferencedByTags",
    wiring: "mapped",
    note: "Legacy alias of repository.showCommitsOnlyReferencedByTags; wired through repository.showCommitsOnlyReferencedByTags",
  },
  {
    key: "showCurrentBranchByDefault",
    type: "boolean",
    default: false,
    aliasOf: "repository.onLoad.showCheckedOutBranch",
    wiring: "out-of-scope",
    note: "Legacy alias of repository.onLoad.showCheckedOutBranch; folds into it — branch filtering defaults to all branches",
  },
  {
    key: "showSignatureStatus",
    type: "boolean",
    default: false,
    aliasOf: "repository.commits.showSignatureStatus",
    wiring: "mapped",
    note: "Legacy alias of repository.commits.showSignatureStatus; wired through repository.commits.showSignatureStatus",
  },
  {
    key: "showTags",
    type: "boolean",
    default: true,
    aliasOf: "repository.showTags",
    wiring: "mapped",
    note: "Legacy alias of repository.showTags; wired through repository.showTags",
  },
  {
    key: "showUncommittedChanges",
    type: "boolean",
    default: true,
    aliasOf: "repository.showUncommittedChanges",
    wiring: "out-of-scope",
    note: "Legacy alias of repository.showUncommittedChanges; folds into it — the uncommitted-changes row is always shown",
  },
  {
    key: "showUntrackedFiles",
    type: "boolean",
    default: true,
    aliasOf: "repository.showUntrackedFiles",
    wiring: "mapped",
    note: "Legacy alias of repository.showUntrackedFiles; wired through repository.showUntrackedFiles",
  },
  {
    key: "useMailmap",
    type: "boolean",
    default: false,
    aliasOf: "repository.useMailmap",
    wiring: "mapped",
    note: "Legacy alias of repository.useMailmap; wired through repository.useMailmap",
  },
];

/* ------------------------------------------------------------------------- */
/* Catalogues derived from SETTINGS                                            */
/* ------------------------------------------------------------------------- */

/** Keys without a legacy alias — the real upstream configuration surface. */
export const CANONICAL_KEYS = SETTINGS.filter((setting) => setting.aliasOf === undefined).map((setting) => setting.key);

/**
 * The exact key order of the `/graph` `presentation` payload (contract §4).
 *
 * The first 26 keys are the contract §4 payload; `initialLoad`, `loadMore` and
 * `loadMoreAutomatically` are appended for the client pagination consumer, and
 * `avatars` last for the wave-9 client avatar rendering (the privacy switch for
 * `repository.commits.fetchAvatars`). Appending keeps every existing client
 * assertion valid. The host forwards `presentation` verbatim, so this order is
 * part of the payload contract and stable.
 */
export const PRESENTATION_KEYS = [
  "graphStyle",
  "graphColours",
  "showSignature",
  "showEmoji",
  "issueUrlTemplate",
  "useMailmap",
  "dateType",
  "dateFormat",
  "referenceLabelAlignment",
  "combineLocalAndRemoteBranchLabels",
  "columnVisibility",
  "fileViewType",
  "compactFolders",
  "autoCenterDetails",
  "markdown",
  "muteMergeCommits",
  "muteNonAncestors",
  "emojiMappings",
  "customBranchGlobPatterns",
  "dialogDefaults",
  "contextMenuVisibility",
  "shortcuts",
  "globalShortcuts",
  "enhancedAccessibility",
  "repositoryDropdownOrder",
  "fileEncoding",
  "initialLoad",
  "loadMore",
  "loadMoreAutomatically",
  "avatars",
];

/** Setting types accepted by the upstream JSON schema. */
const SETTING_TYPES = new Set(["boolean", "string", "number", "array", "object"]);

/**
 * Enumerations from the upstream schema, keyed by canonical setting key.
 *
 * Keyboard shortcuts are deliberately absent: {@link parseShortcut} accepts a
 * wider grammar (CTRL/CMD/ALT/SHIFT plus function keys) than the upstream enum.
 */
const ENUMS = {
  "commitDetailsView.fileView.type": ["File Tree", "File List"],
  "commitDetailsView.location": ["Inline", "Docked to Bottom"],
  "date.format": ["Date & Time", "Date Only", "ISO Date & Time", "ISO Date Only", "Relative"],
  "date.type": ["Author Date", "Commit Date"],
  "dialog.addTag.type": ["Annotated", "Lightweight"],
  "dialog.general.referenceInputSpaceSubstitution": ["None", "Hyphen", "Underscore"],
  "dialog.merge.squashMessageFormat": ["Default", "Git SQUASH_MSG"],
  "dialog.pullBranch.squashMessageFormat": ["Default", "Git SQUASH_MSG"],
  "dialog.resetCurrentBranchToCommit.mode": ["Soft", "Mixed", "Hard"],
  "dialog.resetUncommittedChanges.mode": ["Mixed", "Hard"],
  "graph.style": ["rounded", "angular"],
  "graph.uncommittedChanges": ["Open Circle at the Uncommitted Changes", "Open Circle at the Checked Out Commit"],
  openNewTabEditorGroup: ["Active", "Beside", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"],
  "referenceLabels.alignment": [
    "Normal",
    "Branches (on the left) & Tags (on the right)",
    "Branches (aligned to the graph) & Tags (on the right)",
  ],
  "repository.commits.order": ["date", "author-date", "topo"],
  repositoryDropdownOrder: ["Full Path", "Name", "Workspace Full Path"],
  sourceCodeProviderIntegrationLocation: ["Inline", "More Actions"],
  tabIconColourTheme: ["colour", "grey"],
};

/**
 * DSH-only presentation settings accepted on top of the upstream keys.
 *
 * They are not part of the 110 and therefore never appear in {@link SETTINGS};
 * they only populate the corresponding `presentation` members.
 */
const EXTENSION_SETTINGS = [
  { key: "showEmoji", type: "boolean", default: true },
  { key: "issueUrlTemplate", type: "string", default: "" },
  { key: "globalShortcuts", type: "boolean", default: false },
];

/**
 * DSH short spellings kept as drop-in aliases for the keys the plugin's
 * `cordis.patch.yml` already ships (`showRemoteBranches`, `showStashes`,
 * `showSignature`). They are **not** upstream `git-graph.*` keys, so they do not
 * appear in {@link SETTINGS}; they fold exactly like the 29 legacy aliases:
 * canonical key wins when both are set, and each present alias is reported in
 * `aliased` (with `discarded: true` when the canonical key was set explicitly).
 */
const COMPAT_ALIASES = {
  showRemoteBranches: "repository.showRemoteBranches",
  showStashes: "repository.showStashes",
  showSignature: "repository.commits.showSignatureStatus",
};

/** Host-level keys owned by `normalizeConfig` in `lib/index.js`; not settings. */
const HOST_ONLY_KEYS = new Set(["repoPath", "maxCommits"]);

/** The four configurable shortcuts, in presentation order. */
const SHORTCUT_SLOTS = ["find", "refresh", "scrollToHead", "scrollToStash"];

/**
 * Dialog defaults the DSH dialogs can actually honour, keyed by their upstream
 * suffix. Unsupported dialog options stay out of `presentation.dialogDefaults`
 * and are documented as `out-of-scope` in {@link SETTINGS}.
 */
const DIALOG_DEFAULT_KEYS = [
  "applyStash.reinstateIndex",
  "merge.noCommit",
  "merge.noFastForward",
  "merge.squashCommits",
  "popStash.reinstateIndex",
  "pullBranch.noFastForward",
  "resetCurrentBranchToCommit.mode",
  "resetUncommittedChanges.mode",
  "stashUncommittedChanges.includeUntracked",
];

/** Indexes used by the normalizer (built once, read-only afterwards). */
const SETTING_BY_KEY = new Map(SETTINGS.map((setting) => [setting.key, setting]));
const EXTENSION_BY_KEY = new Map(EXTENSION_SETTINGS.map((setting) => [setting.key, setting]));

/** Declared defaults for the pagination members appended to `presentation`. */
const PAGE_SIZE_DEFAULTS = {
  initialLoad: SETTING_BY_KEY.get("repository.commits.initialLoad")?.default ?? 300,
  loadMore: SETTING_BY_KEY.get("repository.commits.loadMore")?.default ?? 100,
};

/** canonical key → the alias keys that fold into it (upstream order, then DSH). */
const ALIASES_BY_CANONICAL = (() => {
  const map = new Map();
  for (const setting of SETTINGS) {
    if (setting.aliasOf === undefined) continue;
    const list = map.get(setting.aliasOf) ?? [];
    list.push(setting.key);
    map.set(setting.aliasOf, list);
  }
  for (const [aliasKey, canonical] of Object.entries(COMPAT_ALIASES)) {
    const list = map.get(canonical) ?? [];
    if (!list.includes(aliasKey)) list.push(aliasKey);
    map.set(canonical, list);
  }
  return map;
})();

/* ------------------------------------------------------------------------- */
/* Caps and conservative validators for forwarded values                       */
/* ------------------------------------------------------------------------- */

/** Caps for forwarded presentation config (same numbers as `lib/index.js`). */
const MAX_GRAPH_COLOURS = 64;
const MAX_ISSUE_URL_TEMPLATE = 2048;
const MAX_EMOJI_MAPPINGS = 500;
const MAX_BRANCH_GLOB_PATTERNS = 200;
const MAX_CONTEXT_MENU_GROUPS = 50;
const MAX_CONTEXT_MENU_ACTIONS = 100;
const MAX_FILE_ENCODING_LENGTH = 64;
const MAX_COLOUR_LENGTH = 64;
const MAX_MAPPING_FIELD_LENGTH = 200;
/** Accepted `presentation.initialLoad` / `presentation.loadMore` range. */
const MAX_PRESENTATION_PAGE_SIZE = 2000;

/** Accepted `graphColours` values; anything else is dropped (see `lib/index.js`). */
const CSS_COLOUR_PATTERN = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|var\(--[A-Za-z0-9-_.]+\)|(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s]+\))$/;

/* ------------------------------------------------------------------------- */
/* Small defensive helpers                                                     */
/* ------------------------------------------------------------------------- */

/** True for non-null, non-array objects (plain or class instances). */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Recursively copy a JSON-shaped value (used for defaults). Never throws on JSON data. */
function cloneValue(value) {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (isPlainObject(value)) {
    const copy = {};
    for (const key of Object.keys(value)) copy[key] = cloneValue(value[key]);
    return copy;
  }
  return value;
}

/** `Object.prototype.hasOwnProperty` that tolerates exotic objects. */
function hasOwn(object, key) {
  try {
    return Object.prototype.hasOwnProperty.call(object, key);
  } catch {
    return false;
  }
}

/**
 * Read one raw config value, tolerating a live schemastery field wrapper.
 *
 * Mirrors `readConfigValue` in `lib/index.js` so that this module can replace
 * that implementation without changing behaviour.
 */
function readRawValue(source, key) {
  let value;
  try {
    value = source[key];
  } catch {
    return undefined;
  }
  if (value !== null && typeof value === "object" && typeof value.get === "function") {
    try {
      value = value.get();
    } catch {
      return undefined;
    }
  }
  return value;
}

/** Deep equality for JSON-shaped values (used for alias-vs-canonical conflicts). */
function valuesEqual(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!valuesEqual(left[index], right[index])) return false;
    }
    return true;
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    if (leftKeys.length !== Object.keys(right).length) return false;
    for (const key of leftKeys) {
      if (!hasOwn(right, key) || !valuesEqual(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}

/** Short, JSON-safe description of a rejected value for `invalid` entries. */
function describeValue(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") return "object";
  if (typeof value === "string") {
    const text = value.length > 80 ? `${value.slice(0, 77)}...` : value;
    return `string(${JSON.stringify(text)})`;
  }
  return `${typeof value}(${String(value)})`;
}

/** Build one `invalid` entry; primitive values are kept for debuggability. */
function invalidEntry(key, reason, value) {
  const entry = { key, reason };
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") entry.value = value;
  return entry;
}

/* ------------------------------------------------------------------------- */
/* Type coercion                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Coerce one raw value to a setting's declared type.
 *
 * Booleans are only ever derived from `true`/`false` (plus the unambiguous
 * `"true"`/`"false"` strings and `1`/`0`), never from generic truthiness.
 * Arrays are copied and objects shallow-copied, so callers cannot mutate the
 * configuration through the returned values.
 *
 * @param {unknown} value - raw configured value (never `undefined` here).
 * @param {{ type: SettingType }} setting - declared setting type.
 * @param {unknown} fallback - cloned default to use when coercion fails.
 * @returns {{ value: unknown, issue: string | null }} coerced value and reason.
 */
function coerceValue(value, setting, fallback) {
  switch (setting.type) {
    case "boolean": {
      if (typeof value === "boolean") return { value, issue: null };
      if (typeof value === "string") {
        const lowered = value.trim().toLowerCase();
        if (lowered === "true") return { value: true, issue: `coerced string ${JSON.stringify(value)} to boolean true` };
        if (lowered === "false") return { value: false, issue: `coerced string ${JSON.stringify(value)} to boolean false` };
      }
      if (value === 1) return { value: true, issue: "coerced number 1 to boolean true" };
      if (value === 0) return { value: false, issue: "coerced number 0 to boolean false" };
      return { value: fallback, issue: `expected boolean, got ${describeValue(value)}; default used` };
    }
    case "number": {
      if (typeof value === "number" && Number.isFinite(value)) return { value, issue: null };
      if (typeof value === "string") {
        const text = value.trim();
        if (text !== "" && Number.isFinite(Number(text))) {
          return { value: Number(text), issue: `coerced string ${JSON.stringify(value)} to number ${Number(text)}` };
        }
      }
      return { value: fallback, issue: `expected number, got ${describeValue(value)}; default used` };
    }
    case "string": {
      if (typeof value === "string") return { value, issue: null };
      return { value: fallback, issue: `expected string, got ${describeValue(value)}; default used` };
    }
    case "array": {
      if (Array.isArray(value)) return { value: value.slice(), issue: null };
      return { value: fallback, issue: `expected array, got ${describeValue(value)}; default used` };
    }
    case "object": {
      if (isPlainObject(value)) return { value: { ...value }, issue: null };
      return { value: fallback, issue: `expected object, got ${describeValue(value)}; default used` };
    }
    default:
      return { value: fallback, issue: `unknown setting type ${JSON.stringify(setting.type)}; default used` };
  }
}

/** Validate a coerced string against the upstream enum, when it has one. */
function enumIssue(key, value) {
  const allowed = ENUMS[key];
  if (allowed === undefined || typeof value !== "string") return null;
  if (allowed.includes(value)) return null;
  return `expected one of ${allowed.map((entry) => JSON.stringify(entry)).join(", ")}, got ${JSON.stringify(value)}; default used`;
}

/* ------------------------------------------------------------------------- */
/* Keyboard shortcuts                                                          */
/* ------------------------------------------------------------------------- */

/** Modifier tokens accepted in a shortcut descriptor. */
const MODIFIER_TOKENS = Object.freeze({
  CTRL: "ctrl",
  CONTROL: "ctrl",
  CMD: "meta",
  COMMAND: "meta",
  META: "meta",
  ALT: "alt",
  OPTION: "alt",
  SHIFT: "shift",
});

/** Named non-letter keys accepted in a shortcut descriptor. */
const NAMED_SHORTCUT_KEYS = Object.freeze({
  HOME: "home",
  END: "end",
  PAGEUP: "pageup",
  PAGEDOWN: "pagedown",
  ARROWUP: "arrowup",
  ARROWDOWN: "arrowdown",
  ARROWLEFT: "arrowleft",
  ARROWRIGHT: "arrowright",
  UP: "arrowup",
  DOWN: "arrowdown",
  LEFT: "arrowleft",
  RIGHT: "arrowright",
  ESC: "escape",
  ESCAPE: "escape",
  ENTER: "enter",
  SPACE: "space",
  TAB: "tab",
  BACKSPACE: "backspace",
  DELETE: "delete",
  INSERT: "insert",
});

/** Build the fixed-shape shortcut record (stable field order). */
function shortcutValue(key, modifiers) {
  return {
    key,
    ctrl: modifiers.ctrl === true,
    meta: modifiers.meta === true,
    alt: modifiers.alt === true,
    shift: modifiers.shift === true,
  };
}

/** Parse one non-modifier token into its canonical key name, or `null`. */
function parseShortcutKey(token) {
  if (/^[A-Z]$/.test(token)) return token.toLowerCase();
  if (/^[0-9]$/.test(token)) return token;
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(token)) return token.toLowerCase();
  return NAMED_SHORTCUT_KEYS[token] ?? null;
}

/**
 * Resolve an upstream shortcut descriptor into `{ key, ctrl, meta, alt, shift }`.
 *
 * Accepts the upstream `"CTRL/CMD + F"` spelling plus plain `CTRL`, `CMD`,
 * `ALT`, `SHIFT` combinations (letters, digits, `F1`–`F24` and common named
 * keys). `key` is always lowercase (`"f"`, `"f5"`, `"pageup"`). `"UNASSIGNED"`
 * and the empty string resolve to the all-false record with an empty `key`. An
 * unparsable descriptor returns `{ shortcut: null, error }`;
 * {@link normalizeSettings} then falls back to the declared default.
 *
 * @param {unknown} descriptor - configured descriptor.
 * @returns {{ shortcut: Shortcut | null, error: string | null }} parsed shortcut or the reason it failed.
 */
export function parseShortcut(descriptor) {
  if (typeof descriptor !== "string") {
    return { shortcut: null, error: `keyboard shortcut must be a string, got ${describeValue(descriptor)}` };
  }
  const text = descriptor.trim();
  if (text === "" || text.toUpperCase() === "UNASSIGNED") {
    return { shortcut: shortcutValue("", {}), error: null };
  }
  if (text.length > 64) return { shortcut: null, error: "keyboard shortcut descriptor is too long" };
  const tokens = text
    .toUpperCase()
    .replace(/\//g, "+")
    .split("+")
    .map((token) => token.trim());
  const modifiers = {};
  let key = null;
  for (const token of tokens) {
    if (token === "") return { shortcut: null, error: `empty key token in ${JSON.stringify(descriptor)}` };
    const modifier = MODIFIER_TOKENS[token];
    if (modifier !== undefined) {
      modifiers[modifier] = true;
      continue;
    }
    if (key !== null) return { shortcut: null, error: `more than one key in ${JSON.stringify(descriptor)}` };
    const parsed = parseShortcutKey(token);
    if (parsed === null) return { shortcut: null, error: `unknown key token ${JSON.stringify(token)} in ${JSON.stringify(descriptor)}` };
    key = parsed;
  }
  if (key === null) return { shortcut: null, error: `no key in ${JSON.stringify(descriptor)}` };
  return { shortcut: shortcutValue(key, modifiers), error: null };
}

/* ------------------------------------------------------------------------- */
/* Presentation builders                                                       */
/* ------------------------------------------------------------------------- */

/** Sanitize `graph.colours` (same rules as `lib/index.js`). */
function sanitizeGraphColours(raw, invalid) {
  const colours = [];
  if (!Array.isArray(raw)) return colours;
  for (const entry of raw) {
    if (colours.length >= MAX_GRAPH_COLOURS) {
      invalid.push(invalidEntry("graph.colours", `colour cap of ${MAX_GRAPH_COLOURS} reached; remaining entries dropped`));
      break;
    }
    if (typeof entry !== "string") {
      invalid.push(invalidEntry("graph.colours", `dropped non-string colour ${describeValue(entry)}`));
      continue;
    }
    const colour = entry.trim();
    if (colour === "" || colour.length > MAX_COLOUR_LENGTH || !CSS_COLOUR_PATTERN.test(colour)) {
      invalid.push(invalidEntry("graph.colours", `dropped invalid colour ${JSON.stringify(entry)}`, entry));
      continue;
    }
    if (!colours.includes(colour)) colours.push(colour);
  }
  return colours;
}

/** Normalize `defaultColumnVisibility` to exactly the three documented columns. */
function normalizeColumnVisibility(raw, invalid) {
  const visibility = { Date: true, Author: true, Commit: true };
  if (!isPlainObject(raw)) return visibility;
  for (const name of ["Date", "Author", "Commit"]) {
    if (!hasOwn(raw, name)) continue;
    const value = raw[name];
    if (typeof value === "boolean") {
      visibility[name] = value;
    } else {
      invalid.push(invalidEntry("defaultColumnVisibility", `${name} must be boolean, got ${describeValue(value)}; default true used`));
    }
  }
  return visibility;
}

/** Sanitize `customEmojiShortcodeMappings` into `{ shortcode, emoji }` records. */
function sanitizeEmojiMappings(raw, invalid) {
  const mappings = [];
  if (!Array.isArray(raw)) return mappings;
  for (const entry of raw) {
    if (mappings.length >= MAX_EMOJI_MAPPINGS) {
      invalid.push(invalidEntry("customEmojiShortcodeMappings", `mapping cap of ${MAX_EMOJI_MAPPINGS} reached; remaining entries dropped`));
      break;
    }
    if (!isPlainObject(entry)) {
      invalid.push(invalidEntry("customEmojiShortcodeMappings", `dropped non-object mapping ${describeValue(entry)}`));
      continue;
    }
    const shortcode = typeof entry.shortcode === "string" ? entry.shortcode.trim() : "";
    const emoji = typeof entry.emoji === "string" ? entry.emoji.trim() : "";
    if (shortcode === "" || emoji === "" || shortcode.length > MAX_MAPPING_FIELD_LENGTH || emoji.length > MAX_MAPPING_FIELD_LENGTH) {
      invalid.push(invalidEntry("customEmojiShortcodeMappings", "dropped mapping without a non-empty shortcode and emoji"));
      continue;
    }
    mappings.push({ shortcode, emoji });
  }
  return mappings;
}

/** Sanitize `customBranchGlobPatterns` into `{ name, glob }` records. */
function sanitizeBranchGlobPatterns(raw, invalid) {
  const patterns = [];
  if (!Array.isArray(raw)) return patterns;
  for (const entry of raw) {
    if (patterns.length >= MAX_BRANCH_GLOB_PATTERNS) {
      invalid.push(invalidEntry("customBranchGlobPatterns", `pattern cap of ${MAX_BRANCH_GLOB_PATTERNS} reached; remaining entries dropped`));
      break;
    }
    if (!isPlainObject(entry)) {
      invalid.push(invalidEntry("customBranchGlobPatterns", `dropped non-object pattern ${describeValue(entry)}`));
      continue;
    }
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const glob = typeof entry.glob === "string" ? entry.glob.trim() : "";
    const invalidGlob = glob === "" || glob.length > MAX_MAPPING_FIELD_LENGTH || glob.includes("\u0000") || glob.includes("\n") || glob.includes("\r");
    if (name === "" || name.length > MAX_MAPPING_FIELD_LENGTH || invalidGlob) {
      invalid.push(invalidEntry("customBranchGlobPatterns", "dropped pattern without a non-empty name and glob"));
      continue;
    }
    patterns.push({ name, glob });
  }
  return patterns;
}

/** Sanitize `contextMenuActionsVisibility` (two levels of booleans). */
function sanitizeContextMenuVisibility(raw, invalid) {
  const visibility = {};
  if (!isPlainObject(raw)) return visibility;
  let actionCount = 0;
  for (const group of Object.keys(raw).slice(0, MAX_CONTEXT_MENU_GROUPS)) {
    const value = raw[group];
    if (!isPlainObject(value)) {
      invalid.push(invalidEntry("contextMenuActionsVisibility", `dropped non-object group ${JSON.stringify(group)}`));
      continue;
    }
    const actions = {};
    for (const action of Object.keys(value)) {
      if (actionCount >= MAX_CONTEXT_MENU_ACTIONS) {
        invalid.push(invalidEntry("contextMenuActionsVisibility", `action cap of ${MAX_CONTEXT_MENU_ACTIONS} reached; remaining entries dropped`));
        break;
      }
      if (typeof value[action] !== "boolean") {
        invalid.push(invalidEntry("contextMenuActionsVisibility", `${group}.${action} must be boolean, got ${describeValue(value[action])}`));
        continue;
      }
      actions[action] = value[action];
      actionCount += 1;
    }
    visibility[group] = actions;
  }
  return visibility;
}

/** Build the nested `dialogDefaults` payload from the supported dialog keys. */
function buildDialogDefaults(values) {
  const defaults = {};
  for (const dotted of DIALOG_DEFAULT_KEYS) {
    const parts = dotted.split(".");
    let cursor = defaults;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (!isPlainObject(cursor[part])) cursor[part] = {};
      cursor = cursor[part];
    }
    cursor[parts[parts.length - 1]] = values[`dialog.${dotted}`];
  }
  return defaults;
}

/** Validate the DSH-only `issueUrlTemplate` before forwarding it. */
function normalizeIssueUrlTemplate(value, invalid) {
  if (typeof value !== "string") return "";
  const template = value.trim();
  if (template === "") return "";
  if (template.length > MAX_ISSUE_URL_TEMPLATE || template.includes("\u0000") || template.includes("\n") || template.includes("\r")) {
    invalid.push(invalidEntry("issueUrlTemplate", "template is too long or contains control characters; ignored", value));
    return "";
  }
  return template;
}

/** Validate the DSH-only `fileEncoding` name before forwarding it. */
function normalizeFileEncoding(value, invalid) {
  if (typeof value !== "string") return "utf8";
  const encoding = value.trim();
  if (encoding === "" || encoding.length > MAX_FILE_ENCODING_LENGTH || /[\u0000-\u001f]/.test(encoding)) {
    invalid.push(invalidEntry("fileEncoding", `invalid encoding name ${JSON.stringify(value)}; default utf8 used`, value));
    return "utf8";
  }
  return encoding;
}

/**
 * Clamp one configured pagination size for `presentation.initialLoad` / `loadMore`.
 *
 * The client consumes these members in wave 8-C part 2; the accepted range is
 * 1–{@link MAX_PRESENTATION_PAGE_SIZE}. Out-of-range or fractional values are
 * clamped and reported in `invalid` (the configured `values` entry keeps the
 * coerced raw number).
 *
 * @param {unknown} value - normalized canonical value.
 * @param {number} fallback - declared default.
 * @param {string} key - canonical setting key used in the `invalid` report.
 * @param {InvalidEntry[]} invalid - collector.
 * @returns {number} clamped page size.
 */
function normalizePageSize(value, fallback, key, invalid) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  if (integer === value && integer >= 1 && integer <= MAX_PRESENTATION_PAGE_SIZE) return integer;
  const clamped = Math.min(Math.max(integer, 1), MAX_PRESENTATION_PAGE_SIZE);
  invalid.push(invalidEntry(key, `page size ${value} is outside 1-${MAX_PRESENTATION_PAGE_SIZE}; clamped to ${clamped}`, value));
  return clamped;
}

/** Resolve all four configurable shortcuts, falling back to their defaults. */
function resolveShortcuts(values, invalid) {
  const shortcuts = {};
  for (const slot of SHORTCUT_SLOTS) {
    const settingKey = `keyboardShortcut.${slot}`;
    const setting = SETTING_BY_KEY.get(settingKey);
    const descriptor = values[settingKey];
    const parsed = parseShortcut(descriptor);
    if (parsed.error === null && parsed.shortcut !== null) {
      shortcuts[slot] = parsed.shortcut;
      continue;
    }
    const fallbackDescriptor = setting === undefined ? "UNASSIGNED" : setting.default;
    const fallback = parseShortcut(fallbackDescriptor);
    const reason = parsed.error === null ? "unparsable keyboard shortcut" : parsed.error;
    invalid.push(
      invalidEntry(settingKey, `${reason}; default ${JSON.stringify(fallbackDescriptor)} used`, typeof descriptor === "string" ? descriptor : undefined),
    );
    shortcuts[slot] = fallback.shortcut === null ? shortcutValue("", {}) : fallback.shortcut;
  }
  return shortcuts;
}

/**
 * Build the request-independent `presentation` payload in {@link PRESENTATION_KEYS} order.
 *
 * @param {Record<string, unknown>} values - normalized canonical values.
 * @param {{ showEmoji: unknown, issueUrlTemplate: unknown, globalShortcuts: unknown }} extensions - DSH-only values.
 * @param {InvalidEntry[]} invalid - collector for dropped/coerced presentation entries.
 * @returns {Record<string, unknown>} presentation payload.
 */
function buildPresentation(values, extensions, invalid) {
  return {
    graphStyle: values["graph.style"],
    graphColours: sanitizeGraphColours(values["graph.colours"], invalid),
    showSignature: values["repository.commits.showSignatureStatus"],
    showEmoji: extensions.showEmoji,
    issueUrlTemplate: normalizeIssueUrlTemplate(extensions.issueUrlTemplate, invalid),
    useMailmap: values["repository.useMailmap"],
    dateType: values["date.type"],
    dateFormat: values["date.format"],
    referenceLabelAlignment: values["referenceLabels.alignment"],
    combineLocalAndRemoteBranchLabels: values["referenceLabels.combineLocalAndRemoteBranchLabels"],
    columnVisibility: normalizeColumnVisibility(values["defaultColumnVisibility"], invalid),
    fileViewType: values["commitDetailsView.fileView.type"],
    compactFolders: values["commitDetailsView.fileView.fileTree.compactFolders"],
    autoCenterDetails: values["commitDetailsView.autoCenter"],
    markdown: values.markdown,
    muteMergeCommits: values["repository.commits.mute.mergeCommits"],
    muteNonAncestors: values["repository.commits.mute.commitsThatAreNotAncestorsOfHead"],
    emojiMappings: sanitizeEmojiMappings(values.customEmojiShortcodeMappings, invalid),
    customBranchGlobPatterns: sanitizeBranchGlobPatterns(values.customBranchGlobPatterns, invalid),
    dialogDefaults: buildDialogDefaults(values),
    contextMenuVisibility: sanitizeContextMenuVisibility(values.contextMenuActionsVisibility, invalid),
    shortcuts: resolveShortcuts(values, invalid),
    globalShortcuts: extensions.globalShortcuts,
    enhancedAccessibility: values.enhancedAccessibility,
    repositoryDropdownOrder: values.repositoryDropdownOrder,
    fileEncoding: normalizeFileEncoding(values.fileEncoding, invalid),
    /* Appended for the wave-8-C part 2 client pagination consumer; see PRESENTATION_KEYS. */
    initialLoad: normalizePageSize(values["repository.commits.initialLoad"], PAGE_SIZE_DEFAULTS.initialLoad, "repository.commits.initialLoad", invalid),
    loadMore: normalizePageSize(values["repository.commits.loadMore"], PAGE_SIZE_DEFAULTS.loadMore, "repository.commits.loadMore", invalid),
    loadMoreAutomatically: values["repository.commits.loadMoreAutomatically"],
    avatars: values["repository.commits.fetchAvatars"],
  };
}

/* ------------------------------------------------------------------------- */
/* Normalization                                                               */
/* ------------------------------------------------------------------------- */

/** Default value map: one cloned default per canonical key plus the extensions. */
function defaultValueMap() {
  const values = {};
  for (const setting of SETTINGS) {
    if (setting.aliasOf === undefined) values[setting.key] = cloneValue(setting.default);
  }
  for (const extension of EXTENSION_SETTINGS) values[extension.key] = cloneValue(extension.default);
  return values;
}

/** Last-resort result used only if normalization itself unexpectedly throws. */
function fallbackResult() {
  const values = defaultValueMap();
  const invalid = [invalidEntry("", "configuration could not be read; defaults used")];
  const extensions = { showEmoji: true, issueUrlTemplate: "", globalShortcuts: false };
  const presentation = buildPresentation(values, extensions, invalid);
  return { values, presentation, shortcuts: presentation.shortcuts, aliased: [], unknown: [], invalid };
}

/**
 * Normalize the plugin's raw configuration.
 *
 * The result is:
 *
 * - `values` — every canonical upstream key coerced to its declared type, plus
 *   the three DSH-only extension keys (`showEmoji`, `issueUrlTemplate`,
 *   `globalShortcuts`). Missing keys get a fresh copy of their default.
 * - `presentation` — exactly the keys of {@link PRESENTATION_KEYS}, in that
 *   order, deterministic and JSON-serializable.
 * - `shortcuts` — the same object as `presentation.shortcuts`, convenience for
 *   callers that only need the resolved `{ key, ctrl, meta, alt, shift }` records.
 * - `aliased` — one `{ key, canonical, discarded }` record per legacy alias that
 *   was present (the 29 upstream spellings plus the DSH compat spellings
 *   `showRemoteBranches`, `showStashes` and `showSignature`); `discarded` is
 *   true when the canonical key was set explicitly.
 * - `unknown` — raw keys this module does not know (DSH host keys `repoPath`
 *   and `maxCommits` are owned by `normalizeConfig` and are not reported here).
 * - `invalid` — one `{ key, reason }` record per dropped/coerced value.
 *
 * This function never throws: non-object input, exotic proxies and throwing
 * getters all normalize to the documented defaults.
 *
 * @param {unknown} rawConfig - the `apply` configuration (may be undefined or partial).
 * @returns {NormalizedSettings} normalized settings.
 */
export function normalizeSettings(rawConfig) {
  try {
    return normalizeSettingsInner(rawConfig);
  } catch {
    try {
      return fallbackResult();
    } catch {
      return {
        values: {},
        presentation: {},
        shortcuts: {},
        aliased: [],
        unknown: [],
        invalid: [invalidEntry("", "settings normalization failed; defaults unavailable")],
      };
    }
  }
}

/**
 * Implementation of {@link normalizeSettings}; `normalizeSettings` wraps it in a
 * final safety net so a single malformed value can never escape as a throw.
 *
 * @param {unknown} rawConfig - raw configuration.
 * @returns {NormalizedSettings} normalized settings.
 */
function normalizeSettingsInner(rawConfig) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  const values = {};
  const extensions = {};
  const aliased = [];
  const unknown = [];
  const invalid = [];

  /* Unknown keys: anything not upstream, not an alias and not a DSH extension. */
  try {
    for (const key of Object.keys(source)) {
      if (SETTING_BY_KEY.has(key)) continue;
      if (EXTENSION_BY_KEY.has(key)) continue;
      if (hasOwn(COMPAT_ALIASES, key)) continue;
      if (HOST_ONLY_KEYS.has(key)) continue;
      unknown.push(key);
    }
  } catch {
    /* Exotic objects may refuse enumeration; the rest of the normalizer still runs. */
  }

  /* Canonical keys, folding any legacy (and DSH compatibility) aliases. */
  for (const setting of SETTINGS) {
    if (setting.aliasOf !== undefined) continue;
    const fallback = cloneValue(setting.default);
    const rawCanonical = readRawValue(source, setting.key);
    const canonicalPresent = rawCanonical !== undefined;
    const aliasKeys = ALIASES_BY_CANONICAL.get(setting.key) ?? [];
    /** Aliases present in the raw config, in catalogue order. */
    const presentAliases = [];
    let aliasCandidate = null;

    for (const aliasKey of aliasKeys) {
      const rawAlias = readRawValue(source, aliasKey);
      if (rawAlias === undefined) continue;
      presentAliases.push({ key: aliasKey, raw: rawAlias });
      if (!canonicalPresent && aliasCandidate === null) {
        aliasCandidate = { key: aliasKey, raw: rawAlias };
        aliased.push({ key: aliasKey, canonical: setting.key, discarded: false });
      } else if (canonicalPresent) {
        aliased.push({ key: aliasKey, canonical: setting.key, discarded: true });
      } else {
        aliased.push({ key: aliasKey, canonical: setting.key, discarded: true });
        invalid.push(invalidEntry(aliasKey, `ignored: alias ${JSON.stringify(aliasCandidate.key)} is already set`, rawAlias));
      }
    }

    let value;
    let usedKey = setting.key;
    if (canonicalPresent) {
      const coerced = coerceValue(rawCanonical, setting, fallback);
      value = coerced.value;
      if (coerced.issue !== null) invalid.push(invalidEntry(setting.key, coerced.issue, rawCanonical));
      for (const present of presentAliases) {
        const aliasCoerced = coerceValue(present.raw, setting, fallback);
        if (!valuesEqual(value, aliasCoerced.value)) {
          invalid.push(invalidEntry(present.key, `ignored: canonical key ${JSON.stringify(setting.key)} is set and differs`, present.raw));
        }
      }
    } else if (aliasCandidate !== null) {
      usedKey = aliasCandidate.key;
      const coerced = coerceValue(aliasCandidate.raw, setting, fallback);
      value = coerced.value;
      if (coerced.issue !== null) invalid.push(invalidEntry(aliasCandidate.key, coerced.issue, aliasCandidate.raw));
    } else {
      value = fallback;
    }

    const issue = enumIssue(setting.key, value);
    if (issue !== null) {
      invalid.push(invalidEntry(usedKey, issue, value));
      value = fallback;
    }
    values[setting.key] = value;
  }

  /* DSH-only presentation settings. */
  for (const extension of EXTENSION_SETTINGS) {
    const fallback = cloneValue(extension.default);
    const raw = readRawValue(source, extension.key);
    if (raw === undefined) {
      extensions[extension.key] = fallback;
      values[extension.key] = cloneValue(fallback);
      continue;
    }
    const coerced = coerceValue(raw, extension, fallback);
    if (coerced.issue !== null) invalid.push(invalidEntry(extension.key, coerced.issue, raw));
    extensions[extension.key] = coerced.value;
    values[extension.key] = coerced.value;
  }

  const presentation = buildPresentation(values, extensions, invalid);
  return { values, presentation, shortcuts: presentation.shortcuts, aliased, unknown, invalid };
}

/** Setting types and wiring kinds, exposed for the parity tests only. */
export const META = {
  types: SETTING_TYPES,
  enums: ENUMS,
  aliases: COMPAT_ALIASES,
  hostOnlyKeys: HOST_ONLY_KEYS,
  extensions: EXTENSION_SETTINGS.map((setting) => setting.key),
  dialogDefaultKeys: DIALOG_DEFAULT_KEYS,
  shortcutSlots: SHORTCUT_SLOTS,
};
