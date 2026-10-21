import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const CLIENT_PATH = new URL("../lib/client.js", import.meta.url);
const SOURCE = readFileSync(CLIENT_PATH, "utf8");

/** Every locale key CONTRACT.md requires, in zh and en. */
const CONTRACT_KEYS = [
  "tab.title",
  "tab.description",
  "toolbar.refresh",
  "toolbar.fetch",
  "toolbar.back",
  "toolbar.copyHash",
  "toolbar.copied",
  "toolbar.repository",
  "toolbar.branch",
  "toolbar.dirty",
  "toolbar.loadMore",
  "state.loading",
  "state.notRepo",
  "state.notRepoHint",
  "state.error",
  "state.retry",
  "state.empty",
  "detail.author",
  "detail.committer",
  "detail.parents",
  "detail.hash",
  "detail.committed",
  "detail.stats",
  "detail.files",
  "detail.noFiles",
  "detail.diff",
  "detail.binary",
  "detail.truncated",
  "detail.showingDiff",
  "detail.hideDiff",
  "action.checkoutBranch",
  "action.checkoutCommit",
  "action.createBranch",
  "action.cherryPick",
  "action.revert",
  "action.createTag",
  "action.deleteTag",
  "action.deleteBranch",
  "action.forceDeleteBranch",
  "action.notMerged",
  "action.output",
  "action.hideOutput",
  "action.fetch",
  "action.confirm",
  "action.cancel",
  "action.running",
  "action.branchName",
  "action.tagName",
  "action.success",
  "action.failed",
  "action.cleanWorktreeWarning",
  "menu.label",
  "menu.noCommit",
  "menu.busy",
  "menu.mergeRevert",
  "menu.compare",
  "uncommitted.title",
  "uncommitted.total",
  "uncommitted.counts",
  "uncommitted.staged",
  "uncommitted.unstaged",
  "uncommitted.untracked",
  "uncommitted.empty",
  "uncommitted.error",
  "uncommitted.untrackedHint",
  "compare.title",
  "compare.base",
  "compare.head",
  "compare.swap",
  "compare.exit",
  "compare.empty",
  "compare.error",
  "compare.hint",
  "action.renameBranch",
  "action.oldBranchName",
  "action.newBranchName",
  "menu.refLabel",
  "menu.copyName",
  "menu.copyRef",
  "menu.checkedOutBranch",
  "menu.noRemotes",
  "menu.noRef",
  "find.label",
  "find.placeholder",
  "find.counter",
  "find.noMatches",
  "find.prev",
  "find.next",
  "find.close",
  "filter.label",
  "filter.all",
  "filter.empty",
  "filter.close",
  "filter.current",
  "order.label",
  "order.date",
  "order.authorDate",
  "order.topo",
  "action.merge",
  "action.rebase",
  "action.dropCommit",
  "action.resetToCommit",
  "action.pullBranch",
  "action.pushBranch",
  "action.pushTag",
  "action.tagDetails",
  "action.stashApply",
  "action.stashPop",
  "action.stashDrop",
  "action.branchFromStash",
  "action.stashUncommitted",
  "action.stashUntracked",
  "action.cleanUntracked",
  "action.resetUncommitted",
  "action.resetFileToRevision",
  "action.addRemote",
  "action.editRemote",
  "action.deleteRemote",
  "action.pruneRemote",
  "action.mode",
  "action.remote",
  "action.remoteName",
  "action.remoteUrl",
  "action.cleanPreview",
  "action.previewing",
  "action.cleanNothing",
  "action.warningForcePush",
  "action.warningDrop",
  "action.warningHardReset",
  "action.warningStashDrop",
  "action.warningClean",
  "action.warningDiscard",
  "action.warningRemoveRemote",
  "check.noFastForward",
  "check.noCommit",
  "check.squash",
  "check.force",
  "check.setUpstream",
  "check.includeUntracked",
  "check.dryRun",
  "check.reinstateIndex",
  "check.rebase",
  "mode.soft",
  "mode.mixed",
  "mode.hard",
  "menu.dropHead",
  "menu.dropHasChildren",
  "menu.sameBranch",
  "detail.tagger",
  "detail.tagTime",
  "detail.tagType",
  "detail.tagMessage",
  "detail.lightweight",
  "detail.annotated",
  "detail.tagNoMessage",
  "remote.title",
  "remote.empty",
  "remote.error",
  "remote.fetchUrl",
  "remote.pushUrl",
  "remote.add",
  "remote.edit",
  "remote.delete",
  "remote.prune",
  "remote.close",
  "toolbar.remotes",
  "tooltip.label",
  "tooltip.containsHead",
  "tooltip.notContainsHead",
  "tooltip.branches",
  "tooltip.tags",
  "tooltip.stashes",
  "tooltip.overflow",
  "tooltip.currentBranch",
  "tooltip.loading",
  "tooltip.error",
  "detail.signature",
  "detail.signatureVerified",
  "detail.signatureBad",
  "detail.signatureUnknown",
  "detail.signatureExpired",
  "detail.signatureRevoked",
  "detail.signer",
  "repo.label",
  "repo.current",
  "review.progress",
  "review.markAll",
  "review.clear",
  "review.toggle",
  "review.failed",
  "column.showAuthor",
  "column.showDate",
  "column.showHash",
  "tree.flat",
  "tree.tree",
  "tree.view",
  "tree.toggle",
  "action.pushToMultipleRemotes",
  "action.branch",
  "action.remotes",
  "menu.compareWorking",
  "uncommitted.compareWorking",
  "mute.mergeCommit",
  "mute.nonAncestor",
  "file.status.A",
  "file.status.M",
  "file.status.D",
  "file.status.R",
  "file.status.C",
  "file.status.T",
  "file.status.U",
  "file.status.other",
  "column.header",
  "column.date",
  "column.author",
  "column.commit",
  "column.resize",
  "column.graph",
  "column.description",
  "review.staleHost",
  "menu.archive",
  "archive.title",
  "archive.ref",
  "archive.format",
  "archive.zip",
  "archive.tarGz",
  "archive.confirm",
  "archive.running",
  "archive.failed",
  "archive.path",
  "archive.size",
  "archive.copy",
  "archive.notRepo",
  "menu.pr",
  "menu.reviewManager",
  "menu.repoConfig",
  "pr.title",
  "pr.provider",
  "pr.branches",
  "pr.source",
  "pr.copy",
  "pr.open",
  "pr.noUrl",
  "pr.noRemote",
  "pr.failed",
  "review.managerTitle",
  "review.unknownRepo",
  "review.noScopes",
  "review.end",
  "review.endAll",
  "review.endAllConfirm",
  "review.unavailable",
  "review.failed",
  "repoconfig.title",
  "repoconfig.present",
  "repoconfig.absent",
  "repoconfig.pathLabel",
  "repoconfig.keys",
  "repoconfig.export",
  "repoconfig.import",
  "repoconfig.clear",
  "repoconfig.exported",
  "repoconfig.imported",
  "repoconfig.unknown",
  "repoconfig.invalid",
  "repoconfig.clearConfirm",
  "repoconfig.cleared",
  "repoconfig.failed",
  "repoconfig.invalidFile",
  "compare.workingTitle",
  "compare.workingTree",
  "common.refresh",
  "common.close",
];

/**
 * A minimal React stand-in: only `createElement` ever runs at load time, and no
 * hook is executed because the smoke test never renders a component tree.
 */
function createFakeReact(options = {}) {
  // `states` lets one render start from a non-initial state (e.g. a loaded graph)
  // so value-dependent branches can be executed instead of stopping at first paint.
  const states = Array.isArray(options.states) ? options.states.slice() : [];
  let stateCall = 0;
  return {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children };
    },
    Fragment: Symbol.for("react.fragment"),
    useState: (initial) => {
      const next = stateCall < states.length ? states[stateCall] : typeof initial === "function" ? initial() : initial;
      stateCall += 1;
      return [next, () => {}];
    },
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: (initial) => ({ current: initial }),
    useCallback: (callback) => callback,
  };
}

/**
 * Load the browser file with a stubbed module loader.
 * @param source - client source to evaluate.
 * @returns `{ id, factory }` captured from `window.__ModuleLoader__.load`.
 */
function loadDefinition(source, fetchImpl) {
  const definitions = [];
  const windowStub = {
    __ModuleLoader__: {
      load(definition) {
        definitions.push(definition);
      },
    },
  };
  const sandbox = {
    window: windowStub,
    console,
    setTimeout,
    clearTimeout,
    Intl,
    URL,
    AbortController,
    fetch: fetchImpl ?? (async () => {
      throw new Error("tests must not perform network requests");
    }),
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "lib/client.js" });
  assert.equal(definitions.length, 1, "the module loader is asked to load exactly one module");
  return definitions[0];
}

/**
 * Evaluate the factory once with a recording `require`.
 * @param source - client source to evaluate.
 * @returns the load id, the factory exports and every requested module id.
 */
function loadModule(source = SOURCE, fetchImpl, reactImpl) {
  const definition = loadDefinition(source, fetchImpl);
  const fakeReact = reactImpl ?? createFakeReact();
  const requested = [];
  const requireStub = (id) => {
    requested.push(id);
    if (id === "react") return fakeReact;
    throw new Error("lib/client.js must not require " + id);
  };
  const exported = definition.factory(requireStub);
  return { id: definition.id, exported, requested };
}

/**
 * The client source with extra names attached to the factory's return value, so
 * internals can be exercised directly. The shipped file is untouched; only the
 * evaluated copy gets the extra export.
 * @param exports - extra export expression, e.g. `__test: { layoutGraph }`.
 * @returns the instrumented source.
 */
function instrument(exports) {
  const needle = "return { apply, inject };";
  assert.equal(SOURCE.split(needle).length - 1, 1, "the factory return anchor must exist exactly once");
  return SOURCE.replace(needle, "return { apply, inject, " + exports + " };");
}

/**
 * Load the module with the internal pure helpers and the presentational
 * `RefChips` component attached.
 * @param fetchImpl - optional fetch stub used by request-path tests.
 * @returns the internal helpers and views the tests exercise directly.
 */
function loadInternals(fetchImpl, reactImpl) {
  const { exported } = loadModule(
    instrument(
      "__test: { layoutGraph, classifyRefs, groupFiles, lanePath, RefChips, actionDialogSpec, actionArguments, isUnmergedRefusal, " +
        "commitMenuItems, menuStep, placeMenu, menuStillValid, uncommittedSummary, uncommittedRow, buildListModel, " +
        "uncommittedGroups, diffRequest, diffCacheKey, compareRequest, CommitMenu, CommitRow, UncommittedRow, " +
        "UncommittedView, CompareView, refMenuItems, refCopyValue, refMenuStillValid, filterCommits, nextMatch, " +
        "branchFilterOptions, branchRequestValue, toggleBranchSelection, graphRequest, COMMIT_ORDER_OPTIONS, " +
        "ActionDialog, Toolbar, FindBar, BranchFilterBar, CommitList, commitActionItems, refActionItems, " +
        "insertMenuItems, stashIndex, commitHasChildren, outputLines, ACTION_CHECKS, RESET_MODES, " +
        "TagDetails, RemotesPanel, UncommittedView, DetailView, presentationOf, laneColor, richTextParts, " +
        "signatureBadge, containsSummary, tooltipPosition, createLruCache, isTypingTarget, shortcutFor, " +
        "fileRowKey, RichText, SignatureBadge, CommitTooltip, RepoLabel, repoOptions, withRepoPath, " +
        "reviewKey, reviewRequest, reviewStateOf, toggleReviewFile, unreviewedPaths, isUnavailableError, " +
        "ReviewBar, ReviewCheckbox, FileRow, CompareView, Toolbar, rowMetaParts, buildFileTree, " +
        "nextIndex, neighbourHash, stashHashesIn, multiRemotePushItem, FileTree, FileViewToggle, DEFAULT_COLUMNS, " +
        "findModeOf, searchRequest, normalizeSearchCommit, normalizeSearchValue, searchStateFrom, appendSearchPage, " +
        "loadSearchPage, createDebouncer, compileGlob, compileGlobList, parseGlobInput, branchFilterUnion, " +
        "globPrefillText, SearchResults, FIND_SCOPE_PAGE, FIND_SCOPE_ALL, SEARCH_LIMIT, SEARCH_DEBOUNCE_MS, EMPTY_SEARCH, " +
        "branchFilterState, branchRequestKey, NO_MATCH_BRANCH_KEY, NoGlobMatchState, matchShortcut, shortcutsOf, " +
        "normalizeShortcut, DEFAULT_SHORTCUTS, UNASSIGNED_SHORTCUT, parentHash, childHash, detailArrowHash, " +
        "registerGlobalShortcutPanel, activeGlobalShortcutPanel, dispatchGlobalShortcut, installGlobalShortcutListener, " +
        "absoluteTime, relativeTime, formatCommitDate, columnsOf, fileViewOf, compactFoldersOf, autoCenterDetailsOf, " +
        "refLabelConfig, layoutRefChips, combineLocalAndRemoteChips, nonAncestorHashes, sanitizeEmojiMappings, " +
        "emojiTable, scrollDetailIntoView, personLine, sanitizeDialogDefaults, dialogDefaultsFor, " +
        "sanitizeContextMenuVisibility, hiddenMenuIds, normalizeMenuId, visibleMenuItems, orderedRepositories, " +
        "shouldAutoLoad, fileStatusKey, paginationOf, GitGraphBody, COLUMN_WIDTH_DEFAULTS, COLUMN_WIDTH_RANGES, refColourIndex, refIcon, refChipChildren, laneColor, fittingColumns, isDateOnlyLayout, DESC_MIN_WIDTH, DATE_COMPACT_WIDTH, ROW_HORIZONTAL_PADDING, " +
        "COLUMN_WIDTH_STORAGE_KEY, clampColumnWidth, applyColumnResize, resetColumnWidth, columnWidthVars, " +
        "normalizeColumnWidths, readStoredColumnWidths, writeStoredColumnWidths, ColumnHeader, Avatar, " +
        "avatarInitials, avatarHue, archiveRequest, formatBytes, ArchiveDialog, archiveRefItem, rowMetaSegments, " +
        "graphWidthVar, prRequest, prValueOf, prUrlChoices, openExternalUrl, reviewScopesRequest, reviewEndRequest, " +
        "reviewEndAllRequest, reviewScopeLabel, normalizeReviewScopes, repoConfigRequest, repoConfigValueOf, " +
        "conflictLabel, PullRequestDialog, ReviewManagerPanel, RepoConfigPanel }",
    ),
    fetchImpl,
    reactImpl,
  );
  assert.ok(exported !== null && typeof exported.__test === "object" && exported.__test !== null);
  return exported.__test;
}

/**
 * Walk a fake-React element tree depth first.
 * @param node - element, array or text produced by the fake React.
 * @returns every element node in tree order.
 */
function collectElements(node) {
  const found = [];
  const visit = (value) => {
    if (value === null || value === undefined || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    found.push(value);
    visit(value.children);
  };
  visit(node);
  return found;
}

/**
 * Visible text of one ref chip (the label span, not the icon).
 * @param element - a chip element produced by RefChips.
 * @returns the label text.
 */
function chipLabelText(element) {
  const label = collectElements(element).find((child) => String(child.props.className || "").split(" ").includes("dgg-chip-label"));
  return label === undefined ? element.children.join("") : label.children.join("");
}

/**
 * Index of the map of host refs used by the chip classifier.
 * @param refs - ref records shaped like the host's graph value.
 * @returns a Map of full and short names to chip metadata.
 */
function refIndexFrom(refs) {
  const index = new Map();
  for (const ref of refs) {
    const entry = { label: ref.shortName, kind: ref.type, name: ref.name, head: ref.head === true };
    index.set(ref.name, entry);
    index.set(ref.shortName, entry);
  }
  return index;
}

/**
 * A record-only Cordis context with the four injected services.
 * @returns `{ ctx, records }`.
 */
function createFakeCtx() {
  const records = {
    locales: [],
    tabs: [],
    slotInjects: [],
    slotRegistrations: [],
    effects: [],
  };
  const ctx = {
    locale: {
      register(namespace, dictionaries) {
        records.locales.push({ namespace, dictionaries });
        return () => {};
      },
      bind(namespace) {
        assert.equal(namespace, "dshGitGraph");
        return (key, params) => {
          if (params === undefined) return key;
          return Object.entries(params).reduce(
            (text, [name, value]) => text.replaceAll("{" + name + "}", String(value)),
            key,
          );
        };
      },
    },
    sidebarRightTabs: {
      register(definition) {
        records.tabs.push(definition);
        return () => {};
      },
    },
    slots: {
      inject(name, callback) {
        records.slotInjects.push(name);
        return callback();
      },
      register(definition, component) {
        records.slotRegistrations.push({ definition, component });
        return () => {};
      },
    },
    effect(callback, label) {
      records.effects.push(label);
      const disposer = callback();
      return typeof disposer === "function" ? disposer : () => {};
    },
  };
  return { ctx, records };
}

/**
 * Apply the plugin to a fresh recording context.
 * @returns `{ exported, records }`.
 */
function applied() {
  const { exported } = loadModule();
  const { ctx, records } = createFakeCtx();
  assert.doesNotThrow(() => exported.apply(ctx));
  return { exported, records };
}

test("module id and exported plugin face", () => {
  const { id, exported } = loadModule();
  assert.equal(id, "dsh-git-graph");
  assert.ok(exported !== null && typeof exported === "object");
  assert.equal(typeof exported.apply, "function");
  assert.deepEqual(Array.from(exported.inject), ["slots", "locale", "sidebarRight", "sidebarRightTabs"]);
});

test("requires react only and avoids blocking browser APIs", () => {
  const { requested } = loadModule();
  assert.deepEqual(requested, ["react"]);
  assert.doesNotMatch(SOURCE, /window\.confirm\s*\(/);
  assert.doesNotMatch(SOURCE, /window\.prompt\s*\(/);
  assert.doesNotMatch(SOURCE, /@deepseek-ai\//);
  assert.doesNotMatch(SOURCE, /^\s*import\s/m);
  assert.doesNotMatch(SOURCE, /^\s*export\s/m);
  // Requests stay relative to the page so the host route prefix resolves.
  assert.match(SOURCE, /const API_PREFIX = "api\/dsh-git-graph\/"/);
  assert.match(SOURCE, /fetch\(API_PREFIX \+ path/);
});

test("locale namespace carries complete zh and en dictionaries", () => {
  const { records } = applied();
  assert.equal(records.locales.length, 1);
  const [{ namespace, dictionaries }] = records.locales;
  assert.equal(namespace, "dshGitGraph");
  assert.ok(dictionaries !== null && typeof dictionaries === "object");
  const { zh, en } = dictionaries;
  assert.ok(zh !== null && typeof zh === "object");
  assert.ok(en !== null && typeof en === "object");

  for (const key of CONTRACT_KEYS) {
    assert.equal(typeof zh[key], "string", "zh is missing " + key);
    assert.ok(zh[key].trim() !== "", "zh." + key + " is empty");
    assert.equal(typeof en[key], "string", "en is missing " + key);
    assert.ok(en[key].trim() !== "", "en." + key + " is empty");
  }

  // Both dictionaries expose the same key set, and every value is flat text.
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(zh)) assert.equal(typeof value, "string", "zh." + key + " must be a string");
  for (const [key, value] of Object.entries(en)) assert.equal(typeof value, "string", "en." + key + " must be a string");

  // Every literal t("…") call in the client resolves to a registered key.
  const literalKeys = new Set();
  for (const match of SOURCE.matchAll(/\bt\(\s*"([A-Za-z][\w.]*[\w])"/g)) literalKeys.add(match[1]);
  assert.ok(literalKeys.size > 20, "the client should call t() with literal keys");
  for (const key of literalKeys) {
    assert.ok(key in zh, "zh lacks the literal key " + key);
    assert.ok(key in en, "en lacks the literal key " + key);
  }
});

test("postJson posts relative JSON and unwraps the host envelope", async () => {
  const calls = [];
  const replies = [
    { status: 200, json: async () => ({ ok: true, value: { isRepo: true } }) },
    { status: 200, json: async () => ({ ok: false, error: { code: "GIT_FAILED", message: "fatal: not a branch" } }) },
    { status: 500, json: async () => { throw new SyntaxError("not json"); } },
  ];
  const { exported } = loadModule(
    SOURCE.replace("return { apply, inject };", "return { apply, inject, postJson };"),
    async (url, options) => {
      calls.push({ url, options });
      const reply = replies.shift();
      assert.ok(reply !== undefined, "unexpected extra request");
      return typeof reply === "function" ? reply() : reply;
    },
  );

  const value = await exported.postJson("graph", { sessionId: "s1", limit: 120 }, undefined);
  assert.equal(value.isRepo, true);
  assert.equal(calls[0].url, "api/dsh-git-graph/graph");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.equal(calls[0].options.body, JSON.stringify({ sessionId: "s1", limit: 120 }));

  await assert.rejects(
    () => exported.postJson("action", { action: "checkoutBranch", branch: "x" }, undefined),
    /fatal: not a branch/,
  );
  await assert.rejects(() => exported.postJson("commit", { hash: "a1" }, undefined), /HTTP 500/);
});

test("registers the git-graph tab type with its guide card", () => {
  const { records } = applied();
  assert.equal(records.tabs.length, 1);
  const [tab] = records.tabs;
  assert.equal(tab.id, "dsh-git-graph");
  assert.equal(tab.kind, "git-graph");
  assert.equal(typeof tab.title, "function");
  assert.equal(tab.title(), "tab.title");

  assert.ok(Array.isArray(tab.guide));
  assert.equal(tab.guide.length, 1);
  const [entry] = tab.guide;
  assert.equal(entry.id, "open");
  assert.equal(entry.order, 40);
  assert.equal(typeof entry.title, "function");
  assert.equal(typeof entry.description, "function");
  assert.equal(typeof entry.icon, "function");
  assert.equal(entry.title(), "tab.title");
  assert.equal(entry.description(), "tab.description");
  // The icon must be a renderable component, not a bare element.
  const icon = entry.icon({ size: 16 });
  assert.equal(icon.type, "svg");
});

test("registers the pane body under the definition id in the right sidebar tab seat", () => {
  const { records } = applied();
  assert.deepEqual(records.slotInjects, ["sidebar.right.pane.tab"]);
  assert.equal(records.slotRegistrations.length, 1);
  const [{ definition, component }] = records.slotRegistrations;
  assert.equal(definition.name, "sidebar.right.pane.tab");
  assert.equal(definition.key, "dsh-git-graph");
  assert.equal(definition.locale, "dshGitGraph");
  assert.equal(typeof definition.inject, "function");
  const injected = definition.inject("session-1");
  assert.deepEqual(Object.keys(injected), ["sessionId"]);
  assert.equal(injected.sessionId, "session-1");
  assert.equal(typeof component, "function");
  assert.equal(component.name, "GitGraphBody");
});

test("GitGraphBody renders on first paint without a TDZ error", () => {
  // Every `React.useMemo`/`useEffect` dependency array is evaluated at call time,
  // so a `const` declared *after* its first use throws a ReferenceError here. The
  // harness never rendered this body before, which is how a `headHash` TDZ crash
  // reached the browser.
  const { GitGraphBody } = loadInternals();
  let tree;
  assert.doesNotThrow(() => {
    tree = GitGraphBody({ sessionId: "session-1", t: (key) => key });
  });
  assert.ok(tree !== null && typeof tree === "object", "the tab body returns an element tree");
  assert.ok(Array.isArray(tree.children) && tree.children.length > 0, "the first paint renders children");
});

test("GitGraphBody renders a loaded graph without a TDZ error", () => {
  const graphValue = {
    isRepo: true,
    repoPath: "/tmp/repo",
    workspacePath: "/tmp/repo",
    head: { branch: "main", hash: "h1", detached: false },
    refs: [
      { name: "refs/heads/main", shortName: "main", hash: "h1", head: true },
      { name: "refs/remotes/origin/main", shortName: "origin/main", hash: "h1", head: false },
    ],
    commits: [
      { hash: "h1", parents: ["h0"], abbrev: "h1", authorName: "A", authorEmail: "a@e", authorTime: 1, committerName: "A", committerEmail: "a@e", committerTime: 1, subject: "one", refs: ["HEAD -> main"] },
      { hash: "h0", parents: [], abbrev: "h0", authorName: "A", authorEmail: "a@e", authorTime: 0, committerName: "A", committerEmail: "a@e", committerTime: 0, subject: "zero", refs: [] },
    ],
    presentation: {
      muteNonAncestors: true,
      muteMergeCommits: true,
      initialLoad: 300,
      loadMore: 100,
      loadMoreAutomatically: true,
      columnVisibility: { Date: true, Author: true, Commit: true },
      fileViewType: "File Tree",
      shortcuts: {},
    },
  };
  // First `useState` call is the graph state; start it in the ready state so every
  // value-dependent memo/effect body is evaluated once.
  const react = createFakeReact({ states: [{ status: "ready", value: graphValue, error: null }] });
  const { GitGraphBody } = loadInternals(undefined, react);
  let tree;
  assert.doesNotThrow(() => {
    tree = GitGraphBody({ sessionId: "session-1", t: (key) => key });
  });
  assert.ok(tree !== null && typeof tree === "object" && Array.isArray(tree.children));
});

test("apply is repeatable and registers inside labelled effects", () => {
  const { exported } = loadModule();
  const first = createFakeCtx();
  const second = createFakeCtx();
  assert.doesNotThrow(() => exported.apply(first.ctx));
  assert.doesNotThrow(() => exported.apply(second.ctx));
  assert.deepEqual(first.records.effects, ["dsh-git-graph.copy", "dsh-git-graph.type", "dsh-git-graph.body"]);
  assert.equal(second.records.tabs.length, 1);
  assert.equal(second.records.slotRegistrations.length, 1);
});

test("layoutGraph handles a linear history", () => {
  const { layoutGraph } = loadInternals();
  const layout = layoutGraph([
    { hash: "d", parents: ["c"] },
    { hash: "c", parents: ["b"] },
    { hash: "b", parents: ["a"] },
    { hash: "a", parents: [] },
  ]);
  assert.equal(layout.rows.length, 4);
  assert.equal(layout.laneCount, 1);
  assert.deepEqual(Array.from(layout.rows, (row) => row.lane), [0, 0, 0, 0]);
  assert.deepEqual(Array.from(layout.rows, (row) => row.merge), [false, false, false, false]);
  assert.deepEqual(Array.from(layout.rows, (row) => row.root), [false, false, false, true]);
  const rootRow = layout.rows[3];
  const incoming = rootRow.edges.filter((edge) => edge.toY === 0.5);
  assert.equal(incoming.length, 1);
  assert.equal(rootRow.edges.filter((edge) => edge.fromY === 0.5).length, 0);
});

test("layoutGraph handles merges and octopus merges", () => {
  const { layoutGraph } = loadInternals();
  const merge = layoutGraph([
    { hash: "m", parents: ["a", "b"] },
    { hash: "b", parents: [] },
    { hash: "a", parents: [] },
  ]);
  assert.equal(merge.laneCount, 2);
  assert.equal(merge.rows[0].merge, true);
  const mergeEdges = merge.rows[0].edges.filter((edge) => edge.fromY === 0.5 && edge.toY === 1);
  assert.equal(mergeEdges.length, 2);
  assert.deepEqual(new Set(mergeEdges.map((edge) => edge.toLane)), new Set([0, 1]));

  const octopus = layoutGraph([
    { hash: "o", parents: ["a", "b", "c"] },
    { hash: "a", parents: [] },
    { hash: "b", parents: [] },
    { hash: "c", parents: [] },
  ]);
  assert.equal(octopus.laneCount, 3);
  assert.equal(octopus.rows[0].merge, true);
  assert.equal(octopus.rows[0].edges.filter((edge) => edge.fromY === 0.5).length, 3);
  assert.deepEqual(new Set(Array.from(octopus.rows, (row) => row.lane)), new Set([0, 1, 2]));
});

test("layoutGraph keeps disconnected histories on separate lanes", () => {
  const { layoutGraph } = loadInternals();
  const layout = layoutGraph([
    { hash: "x1", parents: ["x0"] },
    { hash: "y1", parents: ["y0"] },
    { hash: "x0", parents: [] },
    { hash: "y0", parents: [] },
  ]);
  assert.equal(layout.laneCount, 2);
  assert.deepEqual(Array.from(layout.rows, (row) => row.lane), [0, 1, 0, 1]);
  assert.equal(layout.rows.filter((row) => row.root).length, 2);
});

test("layoutGraph caps lanes at fourteen and stays deterministic", () => {
  const { layoutGraph } = loadInternals();
  const commits = [];
  for (let index = 0; index < 24; index += 1) commits.push({ hash: "m" + index, parents: ["p" + index, "q" + index] });
  for (let index = 0; index < 24; index += 1) {
    commits.push({ hash: "p" + index, parents: [] }, { hash: "q" + index, parents: [] });
  }
  const layout = layoutGraph(commits);
  assert.equal(layout.laneCount, 14);
  assert.equal(layout.rows.length, commits.length);
  for (const row of layout.rows) {
    assert.ok(row.lane >= 0 && row.lane < 14, "lane " + row.lane + " out of range");
    for (const edge of row.edges) {
      assert.ok(edge.fromLane >= 0 && edge.fromLane < 14, "edge start out of range");
      assert.ok(edge.toLane >= 0 && edge.toLane < 14, "edge end out of range");
    }
  }
  assert.equal(JSON.stringify(layout), JSON.stringify(layoutGraph(commits)));
  const small = layoutGraph(commits.slice(0, 3));
  assert.ok(small.laneCount <= 14);
});

test("layoutGraph survives empty and malformed input", () => {
  const { layoutGraph } = loadInternals();
  const empty = layoutGraph([]);
  assert.deepEqual(Array.from(empty.rows), []);
  assert.equal(empty.laneCount, 1);
  const nullLayout = layoutGraph(null);
  assert.equal(nullLayout.rows.length, 0);
  const malformed = layoutGraph([null, {}, { hash: "a", parents: [null, 3, "a", "missing"] }, { hash: "b" }]);
  assert.equal(malformed.rows.length, 4);
  assert.equal(malformed.rows[2].root, true);
  assert.ok(malformed.laneCount >= 1 && malformed.laneCount <= 14);
});

test("classifyRefs marks branches, remotes, tags and HEAD", () => {
  const { classifyRefs } = loadInternals();
  const index = new Map([
    ["refs/heads/main", { label: "main", kind: "branch", name: "refs/heads/main", head: false }],
    ["main", { label: "main", kind: "branch", name: "refs/heads/main", head: false }],
    ["origin/dev", { label: "origin/dev", kind: "remote", name: "refs/remotes/origin/dev", head: false }],
    ["v1.0", { label: "v1.0", kind: "tag", name: "refs/tags/v1.0", head: false }],
  ]);
  const chips = classifyRefs(["HEAD -> main", "tag: v1.0", "origin/dev", "main", 42, ""], index, 4);
  assert.equal(chips.length, 4);
  assert.deepEqual(Array.from(chips, (chip) => chip.kind), ["head", "tag", "remote", "branch"]);
  assert.deepEqual(Array.from(chips, (chip) => chip.label), ["main", "v1.0", "origin/dev", "main"]);
  for (const chip of chips) assert.equal(typeof chip.key, "string");
  assert.equal(classifyRefs(["main", "origin/dev"], index, 1).length, 1);
  const unknown = classifyRefs(["feature/x", "topic"], new Map(), 4);
  assert.deepEqual(Array.from(unknown, (chip) => chip.kind), ["remote", "branch"]);
});

test("classifyRefs keeps a branch at HEAD actionable", () => {
  const { classifyRefs, RefChips } = loadInternals();
  // Exactly the real shape: the host flags the current branch with head: true,
  // and the commit lists HEAD and that branch as two separate decorations.
  const index = refIndexFrom([
    { name: "refs/heads/main", shortName: "main", type: "branch", hash: "a1", head: true },
  ]);
  const chips = classifyRefs(["HEAD", "main"], index, 4);
  assert.equal(chips.length, 2);
  assert.deepEqual(Array.from(chips.map((chip) => chip.label)), ["HEAD", "main"]);
  assert.deepEqual(Array.from(chips.map((chip) => chip.kind)), ["head", "branch"]);
  assert.deepEqual(Array.from(chips.map((chip) => chip.isHead)), [true, true]);

  // Rendered with a pick handler: the branch is a button, HEAD stays a span.
  const tree = RefChips({ chips, t: (key) => key, onPick: () => {} });
  const elements = collectElements(tree);
  const buttons = elements.filter((element) => element.type === "button");
  const spans = elements.filter((element) => element.type === "span" && "title" in element.props);
  assert.equal(buttons.length, 1, "only the branch chip should be actionable");
  assert.equal(chipLabelText(buttons[0]), "main");
  assert.match(buttons[0].props.className, /dgg-chip-branch/);
  assert.match(buttons[0].props.className, /dgg-chip-head/, "the current branch keeps the head accent");
  assert.equal(buttons[0].props.title, "action.checkoutBranch: main");
  assert.equal(spans.length, 1, "HEAD must remain a non-actionable chip");
  assert.equal(chipLabelText(spans[0]), "HEAD");
  assert.match(spans[0].props.className, /dgg-chip-head/);

  // Without a pick handler (the master list) both chips are inert spans.
  const inert = collectElements(RefChips({ chips, t: (key) => key }));
  assert.equal(inert.filter((element) => element.type === "button").length, 0);
  assert.equal(inert.filter((element) => element.type === "span" && "title" in element.props).length, 2);
});

test("ref chips carry a coloured type icon (lane colour, per-name fallback)", () => {
  const { RefChips, refColourIndex } = loadInternals();
  const chips = [
    { key: "b", label: "main", kind: "branch", isHead: true },
    { key: "r", label: "origin/main", kind: "remote", isHead: false },
    { key: "t", label: "v1.0", kind: "tag", isHead: false },
    { key: "s", label: "stash@{0}", kind: "stash", isHead: false },
  ];
  const palette = ["#111111", "#222222", "#333333"];
  const tree = collectElements(RefChips({ chips, t: (key) => key, colourIndex: 2, colours: palette }));
  const icons = tree.filter((element) => String(element.props.className || "").split(" ").includes("dgg-chip-icon"));
  assert.equal(icons.length, 4, "every chip gets an icon square");
  for (const icon of icons) assert.deepEqual(plain(icon.props.style), { background: palette[2] }, "list chips use the row's lane colour");
  // The glyph differs per kind: branch/remote share the branch glyph (5 shapes),
  // tag and stash have their own (2 and 3).
  assert.deepEqual(icons.map((icon) => icon.children[0].children[0].length), [5, 5, 2, 3]);
  const headChip = tree.find((element) => String(element.props.className || "").includes("dgg-chip-head"));
  assert.equal(headChip.props.style.borderColor, palette[2], "the HEAD chip borrows the lane colour for its border");
  // Without a lane (details pane) the colour is a stable per-name palette index.
  const named = collectElements(RefChips({ chips, t: (key) => key, colours: palette }));
  const namedIcons = named.filter((element) => String(element.props.className || "").split(" ").includes("dgg-chip-icon"));
  assert.deepEqual(namedIcons.map((icon) => icon.props.style.background), chips.map((chip) => palette[refColourIndex(chip.label, palette.length)]));
  assert.equal(refColourIndex("main", 3), refColourIndex("main", 3), "the index is stable");
  assert.notEqual(refColourIndex("main", 12), refColourIndex("origin/main", 12), "different names usually land elsewhere");
  // The label span keeps the readable text while the icon is aria-hidden.
  const firstChip = tree[0].children[0];
  assert.equal(chipLabelText(firstChip), "main");
  assert.equal(icons[0].props["aria-hidden"], "true");
});

test("classifyRefs keeps HEAD -> branch and bare HEAD decorations as head chips", () => {
  const { classifyRefs } = loadInternals();
  const index = refIndexFrom([
    { name: "refs/heads/main", shortName: "main", type: "branch", hash: "a1", head: true },
  ]);
  const arrow = classifyRefs(["HEAD -> main"], index, 4);
  assert.equal(arrow.length, 1);
  assert.equal(arrow[0].kind, "head");
  assert.equal(arrow[0].isHead, true);
  assert.equal(arrow[0].label, "main");
  const bare = classifyRefs(["HEAD"], index, 4);
  assert.equal(bare[0].kind, "head");
  assert.equal(bare[0].isHead, true);
  assert.equal(bare[0].label, "HEAD");
});

test("classifyRefs classifies unknown decorations by shape", () => {
  const { classifyRefs } = loadInternals();
  const unknown = classifyRefs(["feature/x", "topic", "tag: v2"], new Map(), 4);
  assert.deepEqual(Array.from(unknown.map((chip) => chip.kind)), ["remote", "branch", "tag"]);
  assert.deepEqual(Array.from(unknown.map((chip) => chip.label)), ["feature/x", "topic", "v2"]);
  assert.deepEqual(Array.from(unknown.map((chip) => chip.isHead)), [false, false, false]);
});

test("classifyRefs keeps tags, remotes and head-flagged refs non-branch", () => {
  const { classifyRefs, RefChips } = loadInternals();
  const index = refIndexFrom([
    { name: "refs/heads/main", shortName: "main", type: "branch", hash: "a1", head: true },
    { name: "refs/remotes/origin/main", shortName: "origin/main", type: "remote", hash: "a1", head: true },
    { name: "refs/tags/v1.0", shortName: "v1.0", type: "tag", hash: "a1", head: true },
  ]);
  const chips = classifyRefs(["origin/main", "tag: v1.0"], index, 4);
  assert.deepEqual(Array.from(chips.map((chip) => chip.kind)), ["remote", "tag"]);
  // `tag: v1.0` is classified from the decoration itself, so only the indexed
  // remote carries its host head flag. Neither may borrow the branch accent,
  // which `RefChips` also gates on the branch kind.
  assert.deepEqual(Array.from(chips.map((chip) => chip.isHead)), [true, false]);

  // Tags and remotes never become checkout buttons, even flagged as head.
  const elements = collectElements(RefChips({ chips, t: (key) => key, onPick: () => {} }));
  assert.equal(elements.filter((element) => element.type === "button").length, 0);
  const spans = elements.filter((element) => element.type === "span" && "title" in element.props);
  assert.equal(spans.length, 2);
  assert.match(spans[0].props.className, /dgg-chip-remote/);
  assert.doesNotMatch(spans[0].props.className, /dgg-chip-branch/);
  assert.doesNotMatch(spans[0].props.className, /dgg-chip-head/);
  assert.match(spans[1].props.className, /dgg-chip-tag/);
  assert.doesNotMatch(spans[1].props.className, /dgg-chip-head/);
});

test("groupFiles groups by status letter in order", () => {
  const { groupFiles } = loadInternals();
  const groups = groupFiles([
    { status: "M", path: "a" },
    { status: "A", path: "b" },
    { status: "D", path: "c" },
    { status: "M", path: "d" },
    { status: "R", path: "e", oldPath: "f" },
    { status: "" },
  ]);
  assert.deepEqual(Array.from(groups, ([status]) => status), ["A", "D", "M", "R"]);
  // A missing status normalizes to "M", so the M group holds three entries.
  assert.equal(groups[2][1].length, 3);
  assert.equal(groupFiles("nope").length, 0);
});

test("lanePath draws straight continuations and curved merges", () => {
  const { lanePath } = loadInternals();
  assert.equal(lanePath(9, 0, 9, 38), "M9 0 L9 38");
  assert.match(lanePath(9, 0, 23, 38), /^M9 0 C9 19, 23 19, 23 38$/);
});


// ── TODO-1 / TODO-2: delete-branch wiring and action feedback ─────────────────

test("actionDialogSpec offers delete-branch choices without the checked-out branch", () => {
  const { actionDialogSpec } = loadInternals();
  const choices = {
    branches: [{ name: "main" }, { name: "feature" }, { name: "topic" }],
    tags: [{ name: "v1.0" }],
    currentBranch: "main",
  };
  const spec = actionDialogSpec("deleteBranch", choices);
  assert.equal(spec.needs, "branch");
  assert.equal(spec.destructive, true);
  // Deleting the branch you are standing on would be refused by git.
  assert.deepEqual(Array.from(spec.options, (option) => option.name), ["feature", "topic"]);
  // A delete does not touch the worktree, so no dirty-worktree warning.
  assert.equal(spec.dirtySensitive, false);

  const tagSpec = actionDialogSpec("deleteTag", choices);
  assert.equal(tagSpec.needs, "tag");
  assert.deepEqual(Array.from(tagSpec.options, (option) => option.name), ["v1.0"]);

  const checkout = actionDialogSpec("checkoutBranch", choices);
  assert.deepEqual(Array.from(checkout.options, (option) => option.name), ["main", "feature", "topic"]);
  assert.equal(checkout.dirtySensitive, true);

  // Unknown kinds degrade to a hash-only, non-destructive dialog.
  const other = actionDialogSpec("cherryPick", choices);
  assert.equal(other.needs, null);
  assert.equal(other.options.length, 0);
  assert.equal(other.destructive, true);
});

test("actionArguments builds the exact request a confirmed dialog submits", () => {
  const { actionArguments } = loadInternals();
  // The client module is evaluated in a separate realm, so compare shape as JSON.
  const shape = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(shape(actionArguments("deleteBranch", { ref: "feature" })), { name: "feature", force: false });
  assert.deepEqual(shape(actionArguments("checkoutBranch", { ref: "main" })), { branch: "main" });
  assert.deepEqual(shape(actionArguments("deleteTag", { ref: "v1.0" })), { name: "v1.0" });
  assert.deepEqual(shape(actionArguments("createBranch", { name: "topic", hash: "abc123" })), { name: "topic", startPoint: "abc123" });
  assert.deepEqual(shape(actionArguments("createTag", { name: "v2", hash: "abc123" })), { name: "v2", hash: "abc123" });
  assert.deepEqual(shape(actionArguments("revert", { hash: "abc123" })), { hash: "abc123" });
  // A first delete attempt never forces; escalation is a separate click.
  assert.equal(actionArguments("deleteBranch", { ref: "x" }).force, false);
});

test("isUnmergedRefusal only escalates a not-merged branch deletion", () => {
  const { isUnmergedRefusal } = loadInternals();
  assert.equal(isUnmergedRefusal("deleteBranch", 'error: the branch "x" is not fully merged.'), true);
  assert.equal(isUnmergedRefusal("deleteBranch", "该分支尚未合并"), true);
  assert.equal(isUnmergedRefusal("deleteBranch", "error: branch not found"), false);
  // Other actions never offer force delete.
  assert.equal(isUnmergedRefusal("checkoutBranch", "not fully merged"), false);
  assert.equal(isUnmergedRefusal("deleteBranch", undefined), false);
});

// ── TODO-3 / TODO-4: commit context menu ─────────────────────────────────────

/** JSON copy of a value built in the client's realm, for structural compares. */
const plain = (value) => JSON.parse(JSON.stringify(value));

test("commitMenuItems lists the six commit actions in order", () => {
  const { commitMenuItems } = loadInternals();
  const items = commitMenuItems({ hash: "a1", parents: ["p1"] }, undefined);
  assert.deepEqual(Array.from(items, (item) => item.id), [
    "checkout-commit",
    "create-branch",
    "cherry-pick",
    "revert",
    "create-tag",
    "copy-hash",
  ]);
  assert.deepEqual(Array.from(items, (item) => item.kind), [
    "checkoutCommit",
    "createBranch",
    "cherryPick",
    "revert",
    "createTag",
    "copyHash",
  ]);
  assert.deepEqual(Array.from(items, (item) => item.labelKey), [
    "action.checkoutCommit",
    "action.createBranch",
    "action.cherryPick",
    "action.revert",
    "action.createTag",
    "toolbar.copyHash",
  ]);
  for (const item of items) assert.equal(item.disabled, undefined);
});

test("commitMenuItems disables a direct revert of a merge commit", () => {
  const { commitMenuItems } = loadInternals();
  const merge = commitMenuItems({ hash: "m1", parents: ["p1", "p2"] }, undefined);
  const revert = merge.find((item) => item.kind === "revert");
  assert.equal(revert.disabled, true);
  assert.equal(revert.reasonKey, "menu.mergeRevert");
  // Only the revert is blocked; everything else still works on a merge commit.
  assert.deepEqual(Array.from(merge.filter((item) => item.disabled === true), (item) => item.id), ["revert"]);
  const linear = commitMenuItems({ hash: "a1", parents: ["p1"] }, undefined);
  assert.equal(linear.find((item) => item.kind === "revert").disabled, undefined);
});

test("commitMenuItems disables everything while running or without a commit", () => {
  const { commitMenuItems } = loadInternals();
  const busy = commitMenuItems({ hash: "a1", parents: [] }, { busy: true });
  assert.equal(busy.length, 6);
  for (const item of busy) {
    assert.equal(item.disabled, true);
    assert.equal(item.reasonKey, "menu.busy");
  }
  const missing = commitMenuItems({}, undefined);
  assert.equal(missing.length, 6);
  for (const item of missing) {
    assert.equal(item.disabled, true);
    assert.equal(item.reasonKey, "menu.noCommit");
  }
  // No hash means no comparison either, even with a base selected.
  const comparable = commitMenuItems({}, { baseHash: "b1" });
  assert.equal(comparable.some((item) => item.kind === "compare"), false);
});

test("commitMenuItems offers a comparison with the selected commit", () => {
  const { commitMenuItems } = loadInternals();
  const items = commitMenuItems({ hash: "h1", parents: ["p1"] }, { baseHash: "b1", baseAbbrev: "bbbbbbb" });
  assert.equal(items.length, 7);
  const compare = items.find((item) => item.id === "compare");
  assert.ok(compare, "the comparison item should exist");
  assert.equal(compare.kind, "compare");
  assert.equal(compare.labelKey, "menu.compare");
  assert.deepEqual(plain(compare.params), { base: "bbbbbbb" });
  // The item sits before the copy action, and never compares a commit with itself.
  const ids = Array.from(items, (item) => item.id);
  assert.ok(ids.indexOf("compare") < ids.indexOf("copy-hash"));
  const self = commitMenuItems({ hash: "b1", parents: [] }, { baseHash: "b1" });
  assert.equal(self.some((item) => item.kind === "compare"), false);
});

test("menuStep moves through enabled items with wrapping", () => {
  const { menuStep } = loadInternals();
  const items = [{}, { disabled: true }, {}, { disabled: true }, {}];
  assert.equal(menuStep(items, 0, "ArrowDown"), 2);
  assert.equal(menuStep(items, 2, "ArrowDown"), 4);
  assert.equal(menuStep(items, 4, "ArrowDown"), 0, "ArrowDown wraps to the first item");
  assert.equal(menuStep(items, 0, "ArrowUp"), 4, "ArrowUp wraps to the last item");
  assert.equal(menuStep(items, 3, "ArrowDown"), 0, "a disabled active item snaps to the first");
  assert.equal(menuStep(items, 2, "Home"), 0);
  assert.equal(menuStep(items, 2, "End"), 4);
  assert.equal(menuStep(items, 2, "Tab"), -1);
  assert.equal(menuStep([{ disabled: true }], 0, "ArrowDown"), -1);
  assert.equal(menuStep([], 0, "ArrowDown"), -1);
});

test("placeMenu clamps a fixed menu inside the viewport", () => {
  const { placeMenu } = loadInternals();
  assert.deepEqual(plain(placeMenu({ x: 10, y: 10 }, { width: 190, height: 180 }, { width: 600, height: 500 })), {
    left: 10,
    top: 10,
    maxHeight: 492,
  });
  assert.deepEqual(plain(placeMenu({ x: 500, y: 400 }, { width: 190, height: 180 }, { width: 600, height: 500 })), {
    left: 406,
    top: 316,
    maxHeight: 492,
  });
  // No viewport (server-side or hidden tab): keep the pointer position, floor at the margin.
  assert.deepEqual(plain(placeMenu({ x: -5, y: Number.NaN }, { width: 190, height: 180 }, { width: 0, height: 0 })), {
    left: 4,
    top: 4,
    maxHeight: 0,
  });
});

test("menuStillValid drops a menu whose commit left the page", () => {
  const { menuStillValid } = loadInternals();
  const page = [{ hash: "a1" }, { hash: "b1" }];
  assert.equal(menuStillValid({ hash: "a1" }, page), true);
  assert.equal(menuStillValid({ hash: "c1" }, page), false, "a refreshed page can drop the menu's commit");
  assert.equal(menuStillValid(null, page), false);
  assert.equal(menuStillValid({}, page), false);
  assert.equal(menuStillValid({ hash: "a1" }, null), false);
});

test("CommitMenu renders role=menu with menuitems, reasons and the active item", () => {
  const { commitMenuItems, CommitMenu } = loadInternals();
  const items = commitMenuItems({ hash: "m1", parents: ["p1", "p2"] }, { baseHash: "b1", baseAbbrev: "bbbbbbb" });
  const tree = CommitMenu({
    t: (key) => key,
    menu: { style: { left: 12, top: 24 } },
    items,
    activeIndex: 2,
    menuRef: { current: null },
  });
  assert.equal(tree.type, "div");
  assert.equal(tree.props.role, "menu");
  assert.equal(tree.props.className, "dgg-context-menu");
  assert.equal(tree.props["aria-label"], "menu.label");
  assert.deepEqual(plain(tree.props.style), { left: 12, top: 24 });

  const elements = collectElements(tree);
  const menuitems = elements.filter((element) => element.props.role === "menuitem");
  assert.equal(menuitems.length, items.length);
  assert.equal(menuitems[0].type, "button");
  const disabled = menuitems.filter((element) => element.props.disabled === true);
  assert.equal(disabled.length, 1);
  assert.equal(disabled[0].props.title, "menu.mergeRevert");
  assert.equal(menuitems[0].props.title, undefined);
  assert.match(menuitems[2].props.className, /dgg-context-item-active/);
  assert.doesNotMatch(menuitems[0].props.className, /dgg-context-item-active/);
  for (const item of menuitems) assert.equal(item.props.tabIndex, -1);
});

test("CommitRow opens the commit menu from pointer and keyboard", () => {
  const { CommitRow } = loadInternals();
  const selected = [];
  const menus = [];
  const commit = { hash: "a1", abbrev: "a1", subject: "Subject", parents: ["p1"] };
  const tree = CommitRow({
    t: (key) => key,
    commit,
    row: { lane: 0, edges: [], merge: false, root: false },
    laneCount: 1,
    refIndex: new Map(),
    selected: true,
    onSelect: (hash, options) => selected.push({ hash, options }),
    onMenu: (point) => menus.push(point),
  });
  assert.equal(tree.type, "button");
  assert.equal(tree.props["aria-haspopup"], "menu");
  assert.match(tree.props.className, /dgg-row-selected/);

  let prevented = 0;
  tree.props.onContextMenu({ preventDefault: () => { prevented += 1; }, clientX: 120, clientY: 80 });
  assert.equal(prevented, 1, "the native context menu is suppressed");
  assert.deepEqual({ x: menus[0].x, y: menus[0].y, hash: menus[0].hash }, { x: 120, y: 80, hash: "a1" });
  assert.equal(menus[0].commit.subject, "Subject");

  tree.props.onKeyDown({
    key: "ContextMenu",
    preventDefault: () => { prevented += 1; },
    currentTarget: { getBoundingClientRect: () => ({ left: 5, top: 10, height: 38 }) },
  });
  assert.equal(prevented, 2);
  assert.deepEqual({ x: menus[1].x, y: menus[1].y }, { x: 29, y: 29 });

  tree.props.onKeyDown({ key: "F10", shiftKey: true, preventDefault: () => {}, currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, height: 40 }) } });
  assert.equal(menus.length, 3, "Shift+F10 opens the menu too");
  tree.props.onKeyDown({ key: "F10", shiftKey: false, preventDefault: () => {}, currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, height: 40 }) } });
  assert.equal(menus.length, 3, "plain F10 does not");

  tree.props.onClick({ metaKey: false, ctrlKey: true });
  tree.props.onClick({ metaKey: true, ctrlKey: false });
  tree.props.onClick({ metaKey: false, ctrlKey: false });
  assert.deepEqual(selected.map((entry) => entry.options.compare), [true, true, false]);
  assert.deepEqual(selected.map((entry) => entry.hash), ["a1", "a1", "a1"]);
});

// ── TODO-6: the synthetic uncommitted row ────────────────────────────────────

test("uncommittedSummary falls back to the graph's dirty count", () => {
  const { uncommittedSummary } = loadInternals();
  const counted = uncommittedSummary({ isRepo: true, counts: { staged: 1, unstaged: 2, untracked: 0 } }, 9);
  assert.deepEqual(plain(counted), { staged: 1, unstaged: 2, untracked: 0, listed: 3, dirty: 9, total: 3, visible: true });

  // The counts route has not answered yet (or the host predates it): use dirty.
  const fallback = uncommittedSummary(null, 3);
  assert.equal(fallback.visible, true);
  assert.equal(fallback.total, 3);
  assert.deepEqual(plain([fallback.staged, fallback.unstaged, fallback.untracked]), [0, 0, 0]);

  assert.equal(uncommittedSummary(null, 0).visible, false);
  assert.equal(uncommittedSummary({ isRepo: false, counts: { staged: 1 } }, 5).visible, false);
  const garbage = uncommittedSummary({ counts: { staged: -2, unstaged: Number.NaN, untracked: "3" } }, -1);
  assert.deepEqual(plain([garbage.staged, garbage.unstaged, garbage.untracked, garbage.visible]), [0, 0, 0, false]);
});

test("uncommittedRow only appears for a non-zero, in-repo summary", () => {
  const { uncommittedSummary, uncommittedRow } = loadInternals();
  assert.equal(uncommittedRow(uncommittedSummary(null, 0)), null);
  assert.equal(uncommittedRow(null), null);
  const row = uncommittedRow(uncommittedSummary({ isRepo: true, counts: { staged: 1, unstaged: 0, untracked: 2 } }, 3));
  assert.deepEqual(plain(row), { key: "uncommitted", total: 3, counts: { staged: 1, unstaged: 0, untracked: 2 } });
});

test("buildListModel never feeds the synthetic row to layoutGraph", () => {
  const { buildListModel, layoutGraph } = loadInternals();
  const commits = [
    { hash: "c3", parents: ["c2"] },
    { hash: "c2", parents: ["c1"] },
    { hash: "c1", parents: [] },
  ];
  const hidden = buildListModel(commits, { visible: false, total: 0, staged: 0, unstaged: 0, untracked: 0 });
  const shown = buildListModel(commits, { visible: true, total: 2, staged: 1, unstaged: 1, untracked: 0 });
  assert.equal(hidden.synthetic, null);
  assert.ok(shown.synthetic !== null);
  assert.equal(hidden.rowCount, 3);
  assert.equal(shown.rowCount, 4);
  // The invariant: displaying the row cannot move a lane or a commit.
  assert.equal(JSON.stringify(shown.layout), JSON.stringify(hidden.layout));
  assert.equal(JSON.stringify(shown.layout), JSON.stringify(layoutGraph(commits)));
  assert.equal(shown.layout.rows.length, commits.length);
  assert.equal(shown.commits.length, commits.length);
  assert.doesNotMatch(JSON.stringify(shown.layout), /uncommitted/);
});

test("UncommittedRow renders the dashed synthetic row with localized counts", () => {
  const { UncommittedRow } = loadInternals();
  const selected = [];
  const t = (key, params) => (params === undefined ? key : key + "(" + Object.values(params).join(",") + ")");
  const tree = UncommittedRow({
    t,
    summary: { key: "uncommitted", total: 3, counts: { staged: 1, unstaged: 1, untracked: 1 } },
    onSelect: () => selected.push(true),
  });
  assert.equal(tree.type, "button");
  assert.match(tree.props.className, /dgg-row-uncommitted/);
  assert.match(tree.props["aria-label"], /^uncommitted\.title /);
  const text = collectElements(tree).map((element) => element.children.join("")).join(" ");
  assert.match(text, /uncommitted\.title/);
  assert.match(text, /uncommitted\.counts\(1,1,1\)/);
  const cells = collectElements(tree).filter((element) => String(element.props.className || "").split(" ").includes("dgg-cell"));
  assert.deepEqual(cells.map((element) => (String(element.props.className || "").match(/dgg-cell-(graph|desc|date|author|commit)/) || [])[1]), ["graph", "desc", "date", "author", "commit"], "the synthetic row uses the same column structure");
  assert.equal(collectElements(cells[0]).filter((element) => element.type !== "span" || element.props.className).length, 1, "the graph cell stays empty");
  assert.ok(collectElements(cells[1]).some((element) => String(element.props.className || "").includes("dgg-subject")));
  for (const empty of cells.slice(2)) assert.equal(collectElements(empty).length, 1, "Date/Author/Commit stay empty");
  tree.props.onClick();
  assert.equal(selected.length, 1);
});

test("uncommittedGroups maps working-tree sections to diff scopes", () => {
  const { uncommittedGroups } = loadInternals();
  const groups = uncommittedGroups({
    isRepo: true,
    staged: [{ status: "M", path: "a" }],
    unstaged: [{ status: "M", path: "b" }],
    untracked: [{ status: "A", path: "c" }],
  });
  assert.deepEqual(Array.from(groups, (group) => group.id), ["staged", "unstaged", "untracked"]);
  assert.deepEqual(Array.from(groups, (group) => group.scope), ["staged", "unstaged", "unstaged"]);
  assert.deepEqual(Array.from(groups, (group) => group.labelKey), ["uncommitted.staged", "uncommitted.unstaged", "uncommitted.untracked"]);
  assert.equal(groups[0].hintKey, undefined);
  assert.equal(groups[1].hintKey, undefined);
  assert.equal(groups[2].hintKey, "uncommitted.untrackedHint");
  assert.deepEqual(Array.from(uncommittedGroups({ staged: [], unstaged: null, untracked: "x" })), []);
  assert.deepEqual(Array.from(uncommittedGroups(null)), []);
});

test("UncommittedView wires file rows to staged/unstaged scopes", () => {
  const { UncommittedView } = loadInternals();
  const tree = UncommittedView({
    t: (key) => key,
    value: {
      isRepo: true,
      counts: { staged: 1, unstaged: 1, untracked: 1 },
      staged: [{ status: "M", path: "staged.js" }],
      unstaged: [{ status: "M", path: "unstaged.js" }],
      untracked: [{ status: "A", path: "new.md" }],
    },
    sessionId: "s1",
    cache: { current: new Map() },
  });
  assert.equal(tree.props.className, "dgg-uncommitted");
  const rows = collectElements(tree).filter((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.deepEqual(Array.from(rows, (row) => row.props.file.path), ["staged.js", "unstaged.js", "new.md"]);
  assert.deepEqual(Array.from(rows, (row) => row.props.scope), ["staged", "unstaged", "unstaged"]);
  assert.equal(rows[2].props.emptyHintKey, "uncommitted.untrackedHint");
  const headings = collectElements(tree)
    .filter((element) => element.type === "h3")
    .map((element) => element.children.join(""));
  assert.deepEqual(headings, ["uncommitted.staged (1)", "uncommitted.unstaged (1)", "uncommitted.untracked (1)"]);
});

// ── TODO-7: comparison view ─────────────────────────────────────────────────

test("compareRequest builds the compare route body", () => {
  const { compareRequest } = loadInternals();
  assert.deepEqual(plain(compareRequest({ sessionId: "s1", base: "b1", head: "h1" })), { sessionId: "s1", base: "b1", head: "h1" });
  const empty = compareRequest(null);
  assert.equal(empty.sessionId, undefined);
  assert.deepEqual(plain(empty), { base: "", head: "" });
});

test("diffRequest builds each scope's body and a matching cache key", () => {
  const { diffRequest, diffCacheKey } = loadInternals();
  assert.deepEqual(plain(diffRequest({ sessionId: "s1", hash: "h1", file: "a.txt", status: "M" })), {
    sessionId: "s1",
    scope: "commit",
    file: "a.txt",
    hash: "h1",
    status: "M",
  });
  assert.deepEqual(plain(diffRequest({ sessionId: "s1", scope: "staged", file: "a.txt" })), {
    sessionId: "s1",
    scope: "staged",
    file: "a.txt",
  });
  assert.deepEqual(plain(diffRequest({ sessionId: "s1", scope: "unstaged", file: "a.txt", oldPath: "b.txt" })), {
    sessionId: "s1",
    scope: "unstaged",
    file: "a.txt",
    oldPath: "b.txt",
  });
  assert.deepEqual(plain(diffRequest({ sessionId: "s1", scope: "compare", base: "b1", head: "h1", file: "a.txt" })), {
    sessionId: "s1",
    scope: "compare",
    file: "a.txt",
    base: "b1",
    head: "h1",
  });
  // An unknown scope degrades to a commit diff rather than sending nonsense.
  assert.equal(diffRequest({ scope: "bogus", file: "a.txt" }).scope, "commit");

  assert.equal(diffCacheKey({ hash: "h1", file: "a.txt" }), "commit|h1|a.txt|");
  assert.equal(diffCacheKey({ scope: "staged", file: "a.txt" }), "staged||a.txt|");
  assert.equal(diffCacheKey({ scope: "compare", base: "b1", head: "h1", file: "a.txt" }), "compare|b1..h1|a.txt|");
  assert.equal(diffCacheKey({ hash: "h1", file: "a.txt", oldPath: "b.txt" }), "commit|h1|a.txt|b.txt");
});

test("CompareView shows both abbrevs, a swap button and compare-scoped rows", () => {
  const { CompareView } = loadInternals();
  const swapped = [];
  const exited = [];
  const tree = CompareView({
    t: (key) => key,
    pair: { base: "b1fullhash", head: "h1fullhash" },
    value: {
      base: "b1fullhash",
      head: "h1fullhash",
      baseAbbrev: "bbbbbbb",
      headAbbrev: "hhhhhhh",
      stats: { files: 1, insertions: 2, deletions: 1 },
      files: [{ status: "M", path: "a.txt", added: 2, removed: 1, binary: false }],
    },
    status: "ready",
    error: null,
    sessionId: "s1",
    cache: { current: new Map() },
    onSwap: () => swapped.push(true),
    onExit: () => exited.push(true),
    onRetry: () => {},
  });
  assert.equal(tree.props.className, "dgg-compare");
  const elements = collectElements(tree);
  const codes = elements.filter((element) => element.type === "code");
  assert.deepEqual(codes.map((element) => element.children.join("")), ["bbbbbbb", "hhhhhhh"]);
  assert.deepEqual(codes.map((element) => element.props.title), ["b1fullhash", "h1fullhash"]);
  const swap = elements.find((element) => element.props["aria-label"] === "compare.swap");
  assert.ok(swap, "the swap control should be present");
  swap.props.onClick();
  assert.equal(swapped.length, 1);
  const exit = elements.find((element) => element.type === "button" && element.children.join("") === "compare.exit");
  exit.props.onClick();
  assert.equal(exited.length, 1);
  const rows = elements.filter((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].props.scope, "compare");
  assert.equal(rows[0].props.base, "b1fullhash");
  assert.equal(rows[0].props.head, "h1fullhash");
});

test("CompareView renders loading, error and empty states", () => {
  const { CompareView } = loadInternals();
  const base = {
    t: (key) => key,
    pair: { base: "b1", head: "h1" },
    sessionId: "s1",
    cache: { current: new Map() },
    onSwap: () => {},
    onExit: () => {},
    onRetry: () => {},
  };
  const loading = CompareView({ ...base, value: null, status: "loading", error: null });
  assert.ok(collectElements(loading).some((element) => typeof element.type === "function" && element.type.name === "LoadingState"));
  const failed = CompareView({ ...base, value: null, status: "error", error: "boom" });
  const errorState = collectElements(failed).find((element) => typeof element.type === "function" && element.type.name === "ErrorState");
  assert.ok(errorState, "an error status should render the retry state");
  assert.equal(errorState.props.message, "boom");
  const empty = CompareView({ ...base, value: { base: "b1", head: "h1", files: [] }, status: "ready", error: null });
  assert.ok(collectElements(empty).some((element) => element.type === "p" && element.children.join("") === "compare.empty"));
});

// ── TODO-5: branch / tag / remote ref-chip menus ─────────────────────────────

test("refMenuItems offers branch actions and blocks deleting the checked-out branch", () => {
  const { refMenuItems } = loadInternals();
  const items = refMenuItems({ label: "feature", kind: "branch", isHead: false }, { currentBranch: "main" });
  assert.deepEqual(Array.from(items, (item) => item.id), ["checkout-branch", "rename-branch", "delete-branch", "copy-ref"]);
  assert.deepEqual(Array.from(items, (item) => item.kind), ["checkoutBranch", "renameBranch", "deleteBranch", "copyRef"]);
  assert.deepEqual(Array.from(items, (item) => item.labelKey), [
    "action.checkoutBranch",
    "action.renameBranch",
    "action.deleteBranch",
    "menu.copyName",
  ]);
  for (const item of items) assert.equal(item.disabled, undefined);

  // The checked-out branch may still be checked out (git accepts it) and renamed,
  // but deleting it would be refused, so only that item is disabled with a reason.
  const current = refMenuItems({ label: "main", kind: "branch", isHead: true }, { currentBranch: "main" });
  const checkout = current.find((item) => item.kind === "checkoutBranch");
  const rename = current.find((item) => item.kind === "renameBranch");
  const remove = current.find((item) => item.kind === "deleteBranch");
  assert.equal(checkout.disabled, undefined);
  assert.equal(rename.disabled, undefined);
  assert.equal(remove.disabled, true);
  assert.equal(remove.reasonKey, "menu.checkedOutBranch");
  // The current branch is recognised even without the isHead flag on the chip.
  const byName = refMenuItems({ label: "main", kind: "branch", isHead: false }, { currentBranch: "main" });
  assert.equal(byName.find((item) => item.kind === "deleteBranch").disabled, true);
});

test("refMenuItems offers tag and remote actions", () => {
  const { refMenuItems } = loadInternals();
  const tag = refMenuItems({ label: "v1.0", kind: "tag" }, { currentBranch: "main" });
  assert.deepEqual(Array.from(tag, (item) => item.kind), ["deleteTag", "copyRef"]);
  assert.deepEqual(Array.from(tag, (item) => item.labelKey), ["action.deleteTag", "menu.copyName"]);

  const remote = refMenuItems({ label: "origin/main", kind: "remote", refName: "refs/remotes/origin/main" }, { hasRemotes: true });
  assert.deepEqual(Array.from(remote, (item) => item.kind), ["copyRef", "fetch"]);
  assert.deepEqual(Array.from(remote, (item) => item.labelKey), ["menu.copyRef", "action.fetch"]);
  assert.equal(remote.find((item) => item.kind === "fetch").disabled, undefined);

  // Without any remote, the fetch item explains itself instead of failing.
  const noRemotes = refMenuItems({ label: "origin/main", kind: "remote" }, { hasRemotes: false });
  const fetch = noRemotes.find((item) => item.kind === "fetch");
  assert.equal(fetch.disabled, true);
  assert.equal(fetch.reasonKey, "menu.noRemotes");
  assert.equal(noRemotes.find((item) => item.kind === "copyRef").disabled, undefined);
});

test("refMenuItems returns nothing for HEAD and unknown chip kinds", () => {
  const { refMenuItems } = loadInternals();
  assert.deepEqual(Array.from(refMenuItems({ label: "HEAD", kind: "head", isHead: true }, {})), []);
  assert.deepEqual(Array.from(refMenuItems({ label: "x", kind: "mystery" }, {})), []);
  assert.deepEqual(Array.from(refMenuItems({ label: "", kind: "branch" }, {})), []);
  assert.deepEqual(Array.from(refMenuItems(null, null)), []);
});

test("refMenuItems disables everything while an action runs", () => {
  const { refMenuItems } = loadInternals();
  const items = refMenuItems({ label: "dev", kind: "branch" }, { currentBranch: "main", busy: true });
  assert.equal(items.length, 4);
  for (const item of items) {
    assert.equal(item.disabled, true);
    assert.equal(item.reasonKey, "menu.busy");
  }
  // Busy wins over the checked-out rule: the reason stays the transient one.
  const current = refMenuItems({ label: "main", kind: "branch", isHead: true }, { currentBranch: "main", busy: true });
  assert.equal(current.find((item) => item.kind === "deleteBranch").reasonKey, "menu.busy");
});

test("refCopyValue copies the short name for branches and the full ref for remotes", () => {
  const { refCopyValue } = loadInternals();
  assert.equal(refCopyValue({ label: "feature/x", kind: "branch" }), "feature/x");
  assert.equal(refCopyValue({ label: "v1.0", kind: "tag" }), "v1.0");
  assert.equal(refCopyValue({ label: "origin/main", kind: "remote", refName: "refs/remotes/origin/main" }), "refs/remotes/origin/main");
  assert.equal(refCopyValue({ label: "origin/main", kind: "remote" }), "origin/main");
  assert.equal(refCopyValue(null), "");
});

test("refMenuStillValid follows the ref list", () => {
  const { refMenuStillValid } = loadInternals();
  const refs = [
    { name: "refs/heads/main", shortName: "main", type: "branch" },
    { name: "refs/tags/v1", shortName: "v1", type: "tag" },
  ];
  assert.equal(refMenuStillValid({ label: "main" }, refs), true);
  assert.equal(refMenuStillValid({ label: "v1" }, refs), true);
  assert.equal(refMenuStillValid({ label: "gone" }, refs), false, "a refresh can drop the ref");
  assert.equal(refMenuStillValid(null, refs), false);
  assert.equal(refMenuStillValid({}, refs), false);
  // Falls back to the full name when a ref record has no shortName.
  assert.equal(refMenuStillValid({ label: "main" }, [{ name: "refs/heads/main" }]), true);
});

test("RefChips opens ref menus from buttons and from row spans", () => {
  const { classifyRefs, RefChips } = loadInternals();
  const index = refIndexFrom([
    { name: "refs/heads/main", shortName: "main", type: "branch", hash: "a1", head: true },
    { name: "refs/remotes/origin/main", shortName: "origin/main", type: "remote", hash: "a1" },
    { name: "refs/tags/v1.0", shortName: "v1.0", type: "tag", hash: "a1" },
  ]);
  const chips = classifyRefs(["HEAD", "main", "tag: v1.0", "origin/main"], index, 8);
  const picked = [];
  const menus = [];

  // Detail pane: chips are buttons; branch click checks out, others open the menu.
  const detail = collectElements(
    RefChips({
      chips,
      t: (key) => key,
      buttons: true,
      onPick: (chip) => picked.push(chip.label),
      onRefMenu: (chip, point) => menus.push({ label: chip.label, point }),
    }),
  );
  const buttons = detail.filter((element) => element.type === "button");
  assert.equal(buttons.length, 3, "branch, tag and remote chips are buttons; HEAD is not");
  assert.equal(chipLabelText(buttons[0]), "main");
  assert.equal(buttons[0].props["aria-haspopup"], "menu");
  buttons[0].props.onClick({ stopPropagation() {} });
  assert.deepEqual(picked, ["main"], "a branch chip click is still checkout");
  buttons[1].props.onClick({ stopPropagation() {} });
  buttons[2].props.onClick({ stopPropagation() {} });
  assert.deepEqual(Array.from(menus, (entry) => entry.label), ["v1.0", "origin/main"]);
  let prevented = 0;
  buttons[0].props.onContextMenu({ preventDefault: () => { prevented += 1; }, stopPropagation() {}, clientX: 30, clientY: 40 });
  assert.equal(prevented, 1);
  assert.deepEqual({ x: menus[2].point.x, y: menus[2].point.y }, { x: 30, y: 40 });
  buttons[2].props.onKeyDown({ key: "F10", shiftKey: true, preventDefault() {}, stopPropagation() {}, currentTarget: { getBoundingClientRect: () => ({ left: 5, top: 9, bottom: 21 }) } });
  assert.deepEqual({ x: menus[3].point.x, y: menus[3].point.y }, { x: 5, y: 21 });

  // Commit rows: no nested buttons — span chips still expose the ref menu.
  const row = collectElements(RefChips({ chips, t: (key) => key, buttons: false, onRefMenu: (chip, point) => menus.push({ label: chip.label, point }) }));
  assert.equal(row.filter((element) => element.type === "button").length, 0, "rows never nest buttons");
  const spans = row.filter((element) => element.type === "span" && typeof element.props.className === "string" && element.props.className.startsWith("dgg-chip "));
  assert.equal(spans.length, 4);
  const tagSpan = spans.find((element) => chipLabelText(element) === "v1.0");
  tagSpan.props.onContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 7, clientY: 8 });
  assert.deepEqual({ x: menus.at(-1).point.x, y: menus.at(-1).point.y }, { x: 7, y: 8 });
  // Row chips are keyboard reachable too: Shift+F10/Enter open the same menu.
  assert.equal(tagSpan.props.role, "button");
  assert.equal(tagSpan.props.tabIndex, 0);
  assert.equal(tagSpan.props["aria-haspopup"], "menu");
  tagSpan.props.onKeyDown({ key: "F10", shiftKey: true, preventDefault() {}, stopPropagation() {}, currentTarget: { getBoundingClientRect: () => ({ left: 2, top: 4, bottom: 16 }) } });
  assert.deepEqual({ x: menus.at(-1).point.x, y: menus.at(-1).point.y }, { x: 2, y: 16 });
  tagSpan.props.onKeyDown({ key: "Enter", preventDefault() {}, stopPropagation() {}, currentTarget: { getBoundingClientRect: () => ({ left: 3, top: 5, bottom: 17 }) } });
  assert.equal(menus.at(-1).label, "v1.0");
  const headSpan = spans.find((element) => chipLabelText(element) === "HEAD");
  assert.equal(headSpan.props.onContextMenu, undefined, "the HEAD badge has no menu");
  assert.equal(headSpan.props.onKeyDown, undefined);
  assert.equal(headSpan.props.tabIndex, undefined);
});

test("ActionDialog rename uses two text fields and submits both names", () => {
  const { ActionDialog, actionArguments } = loadInternals();
  const confirmed = [];
  const tree = ActionDialog({
    t: (key) => key,
    dialog: { kind: "renameBranch", needs: "rename", requestedRef: "old-name", options: [], destructive: false, dirtySensitive: false, hash: "" },
    dirty: 0,
    running: false,
    onCancel: () => {},
    onConfirm: (...args) => confirmed.push(args),
  });
  const elements = collectElements(tree);
  const inputs = elements.filter((element) => element.type === "input");
  assert.equal(inputs.length, 2, "rename needs exactly two text fields");
  assert.deepEqual(inputs.map((input) => input.props["aria-label"]), ["action.oldBranchName", "action.newBranchName"]);
  assert.equal(inputs[0].props.value, "old-name", "the current name is prefilled");
  assert.equal(inputs[1].props.value, "");
  assert.equal(elements.filter((element) => element.type === "select").length, 0);
  // Until a different new name is typed the confirmation is unavailable.
  const run = elements.find((element) => element.type === "button" && element.children.join("") === "action.run");
  assert.equal(run.props.disabled, true);
  run.props.onClick();
  assert.deepEqual(confirmed, [["old-name", "", ""]]);
  // The submitted body is the host's `{ name, newName }`.
  assert.deepEqual(plain(actionArguments("renameBranch", { name: "old-name", newName: "new-name" })), { name: "old-name", newName: "new-name" });
});

// ── TODO-9: find control ────────────────────────────────────────────────────

test("filterCommits matches subject, author, hashes and ref labels", () => {
  const { filterCommits } = loadInternals();
  const commits = [
    { hash: "aaaa1111", abbrev: "aaaa111", subject: "Add parser", authorName: "Alice", authorEmail: "alice@x", refs: ["HEAD", "main"] },
    { hash: "bbbb2222", abbrev: "bbbb222", subject: "Fix crash", authorName: "Bob", authorEmail: "bob@x", refs: ["dev"] },
    { hash: "cccc3333", abbrev: "cccc333", subject: "Release notes", authorName: "Carol", authorEmail: "carol@x", refs: ["tag: v2.0"] },
  ];
  const shape = (result) => ({ matches: result.matches, indices: Array.from(result.indices) });
  assert.deepEqual(shape(filterCommits(commits, "PARSER")), { matches: 1, indices: [0] }, "subject, case-insensitive");
  assert.deepEqual(shape(filterCommits(commits, "bob")), { matches: 1, indices: [1] }, "author name");
  assert.deepEqual(shape(filterCommits(commits, "cccc")), { matches: 1, indices: [2] }, "short hash prefix");
  assert.deepEqual(shape(filterCommits(commits, "cccc3333")), { matches: 1, indices: [2] }, "full hash");
  assert.deepEqual(shape(filterCommits(commits, "v2.0")), { matches: 1, indices: [2] }, "tag ref label");
  assert.deepEqual(shape(filterCommits(commits, "main")), { matches: 1, indices: [0] }, "branch ref label");
  assert.deepEqual(shape(filterCommits(commits, "zzz")), { matches: 0, indices: [] });
  // Empty/whitespace restores the whole page.
  assert.deepEqual(shape(filterCommits(commits, "")), { matches: 3, indices: [0, 1, 2] });
  assert.deepEqual(shape(filterCommits(commits, "   ")), { matches: 3, indices: [0, 1, 2] });
  assert.deepEqual(shape(filterCommits(null, "x")), { matches: 0, indices: [] });
});

test("nextMatch wraps in both directions", () => {
  const { nextMatch } = loadInternals();
  assert.equal(nextMatch(0, 3, 1), 1);
  assert.equal(nextMatch(2, 3, 1), 0, "next wraps");
  assert.equal(nextMatch(0, 3, -1), 2, "previous wraps");
  assert.equal(nextMatch(1, 3, -1), 0);
  assert.equal(nextMatch(-1, 3, 1), 0);
  assert.equal(nextMatch(-1, 3, -1), 2);
  assert.equal(nextMatch(9, 3, 1), 0);
  assert.equal(nextMatch(0, 0, 1), -1);
  assert.equal(nextMatch(0, Number.NaN, 1), -1);
});

test("FindBar shows the counter and handles Enter, Shift+Enter and Escape", () => {
  const { FindBar } = loadInternals();
  const calls = { query: [], next: 0, prev: 0, close: 0 };
  const tree = FindBar({
    t: (key) => key,
    query: "abc",
    total: 3,
    activeIndex: 1,
    onQuery: (value) => calls.query.push(value),
    onNext: () => { calls.next += 1; },
    onPrev: () => { calls.prev += 1; },
    onClose: () => { calls.close += 1; },
  });
  const elements = collectElements(tree);
  const input = elements.find((element) => element.type === "input");
  assert.equal(input.props.value, "abc");
  assert.equal(input.props.placeholder, "find.placeholder");
  assert.equal(input.props["aria-label"], "find.label");
  input.props.onChange({ target: { value: "abcd" } });
  assert.deepEqual(calls.query, ["abcd"]);
  input.props.onKeyDown({ key: "Enter", preventDefault() {} });
  assert.equal(calls.next, 1);
  input.props.onKeyDown({ key: "Enter", shiftKey: true, preventDefault() {} });
  assert.equal(calls.prev, 1);
  input.props.onKeyDown({ key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(calls.close, 1);
  const counter = elements.find((element) => element.props.className === "dgg-find-count");
  assert.equal(counter.children.join(""), "2/3");
  assert.equal(counter.props["aria-label"], "find.counter");
  const buttons = elements.filter((element) => element.type === "button");
  assert.deepEqual(buttons.map((button) => button.props["aria-label"]), ["find.prev", "find.next", "find.close"]);
  buttons[1].props.onClick();
  assert.equal(calls.next, 2);

  // With nothing to move through, the arrows are disabled and the counter is 0/0.
  const idle = collectElements(FindBar({ t: (key) => key, query: "", total: 0, activeIndex: -1, onQuery() {}, onNext() {}, onPrev() {}, onClose() {} }));
  assert.equal(idle.find((element) => element.props.className === "dgg-find-count").children.join(""), "0/0");
  assert.equal(idle.filter((element) => element.type === "button" && element.props.disabled === true).length, 2);
});

// ── TODO-10: branch filter ──────────────────────────────────────────────────

test("branchFilterOptions lists local branches with defaults", () => {
  const { branchFilterOptions } = loadInternals();
  const options = branchFilterOptions([
    { name: "refs/heads/main", shortName: "main", type: "branch", head: true },
    { name: "refs/heads/dev", shortName: "dev", type: "branch", head: false },
    { name: "refs/remotes/origin/main", shortName: "origin/main", type: "remote" },
    { name: "refs/tags/v1", shortName: "v1", type: "tag" },
  ]);
  assert.deepEqual(plain(options), [
    { name: "main", isHead: true, selectedByDefault: true },
    { name: "dev", isHead: false, selectedByDefault: true },
  ]);
  assert.deepEqual(Array.from(branchFilterOptions(null)), []);
});

test("branchRequestValue omits the field for all or none and sends a subset", () => {
  const { branchRequestValue } = loadInternals();
  const options = branchFilterOptionsOf(["main", "dev", "topic"]);
  assert.equal(branchRequestValue(null, options), null, "the implicit all-selection sends nothing");
  assert.equal(branchRequestValue([], options), null, "clearing the filter sends nothing");
  assert.equal(branchRequestValue(["main", "dev", "topic"], options), null, "every branch selected sends nothing");
  assert.deepEqual(Array.from(branchRequestValue(["topic", "main"], options)), ["main", "topic"], "options order, not click order");
  assert.equal(branchRequestValue(["ghost"], options), null, "unknown names fall back to no filter");
});

/** Branch options helper: names in, filter options out. */
function branchFilterOptionsOf(names) {
  const { branchFilterOptions } = loadInternals();
  return branchFilterOptions(names.map((name) => ({ name: "refs/heads/" + name, shortName: name, type: "branch" })));
}

test("toggleBranchSelection toggles from the implicit all selection", () => {
  const { toggleBranchSelection } = loadInternals();
  const options = branchFilterOptionsOf(["main", "dev", "topic"]);
  assert.deepEqual(Array.from(toggleBranchSelection(null, "dev", options)), ["main", "topic"], "unchecking from all");
  assert.deepEqual(Array.from(toggleBranchSelection(["main", "topic"], "dev", options)), ["main", "dev", "topic"], "re-checking");
  assert.deepEqual(Array.from(toggleBranchSelection(["main", "dev", "topic"], "topic", options)), ["main", "dev"]);
  assert.deepEqual(Array.from(toggleBranchSelection(["ghost"], "main", options)), ["main"]);
});

test("BranchFilterBar renders checkbox options and the all reset", () => {
  const { BranchFilterBar } = loadInternals();
  const toggled = [];
  const resets = [];
  let closed = 0;
  const options = [
    { name: "main", isHead: true, selectedByDefault: true },
    { name: "dev", isHead: false, selectedByDefault: true },
  ];
  const all = collectElements(
    BranchFilterBar({ t: (key) => key, options, selection: null, onToggle: (name) => toggled.push(name), onReset: () => resets.push(true), onClose: () => { closed += 1; } }),
  );
  const boxes = all.filter((element) => element.type === "input" && element.props.type === "checkbox");
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes.map((box) => box.props.checked), [true, true], "default is every branch");
  boxes[1].props.onChange();
  assert.deepEqual(toggled, ["dev"]);
  const allButton = all.find((element) => element.type === "button" && element.children.join("") === "filter.all");
  allButton.props.onClick();
  assert.equal(resets.length, 1);
  const closeButton = all.find((element) => element.type === "button" && element.props["aria-label"] === "filter.close");
  closeButton.props.onClick();
  assert.equal(closed, 1);
  assert.ok(all.some((element) => element.children.join("") === "filter.current"), "the HEAD branch is badged");

  const subset = collectElements(BranchFilterBar({ t: (key) => key, options, selection: ["dev"], onToggle() {}, onReset() {}, onClose() {} }));
  assert.deepEqual(subset.filter((element) => element.type === "input" && element.props.type === "checkbox").map((box) => box.props.checked), [false, true]);

  const empty = collectElements(BranchFilterBar({ t: (key) => key, options: [], selection: null, onToggle() {}, onReset() {}, onClose() {} }));
  assert.ok(empty.some((element) => element.children.join("") === "filter.empty"));
});

// ── TODO-11: sort order and the graph request ──���────────────────────────────

test("graphRequest keeps the default body byte-identical", () => {
  const { graphRequest } = loadInternals();
  const today = JSON.stringify({ sessionId: "session-1", limit: 120 });
  assert.equal(JSON.stringify(graphRequest({ sessionId: "session-1", limit: 120 })), today);
  assert.equal(JSON.stringify(graphRequest({ sessionId: "session-1", limit: 120, branches: null, order: "date" })), today);
  assert.equal(JSON.stringify(graphRequest({ sessionId: "session-1", limit: 120, branches: [], order: "date" })), today);
  assert.equal(JSON.stringify(graphRequest({ sessionId: "session-1", limit: 120, order: "bogus" })), today, "unknown orders fall back to date");
  // Only an explicit, non-default choice adds a key.
  assert.deepEqual(plain(graphRequest({ sessionId: "s", limit: 50, branches: ["main"], order: "topo" })), {
    sessionId: "s",
    limit: 50,
    branches: ["main"],
    order: "topo",
  });
  assert.deepEqual(plain(graphRequest({ sessionId: "s", limit: 50, order: "author-date" })), { sessionId: "s", limit: 50, order: "author-date" });
  assert.deepEqual(Array.from(COMMIT_ORDER_VALUES()), ["date", "author-date", "topo"]);
});

/** The order select's option values, in display order. */
function COMMIT_ORDER_VALUES() {
  const { COMMIT_ORDER_OPTIONS } = loadInternals();
  return COMMIT_ORDER_OPTIONS.map((option) => option.value);
}

test("Toolbar exposes find, filter and the order select", () => {
  const { Toolbar } = loadInternals();
  const calls = { find: 0, filter: 0, order: [], refresh: 0, menu: 0 };
  const props = {
    t: (key) => key,
    repoLabel: "repo",
    repoPath: "/tmp/repo",
    branchLabel: "main",
    dirty: 0,
    busy: false,
    backVisible: false,
    menuOpen: false,
    running: false,
    order: "date",
    findOpen: true,
    filterOpen: false,
    onRefresh: () => { calls.refresh += 1; },
    onToggleFind: () => { calls.find += 1; },
    onToggleFilter: () => { calls.filter += 1; },
    onOrderChange: (value) => calls.order.push(value),
    onToggleMenu: () => { calls.menu += 1; },
    onCloseMenu: () => {},
    onFetch: () => {},
    onBack: () => {},
  };
  const elements = collectElements(Toolbar(props));
  const find = elements.find((element) => element.props["aria-label"] === "find.label");
  assert.equal(find.props["aria-pressed"], true, "the active find control is pressed");
  find.props.onClick();
  assert.equal(calls.find, 1);
  const filter = elements.find((element) => element.props["aria-label"] === "filter.label");
  assert.equal(filter.props["aria-pressed"], false);
  filter.props.onClick();
  assert.equal(calls.filter, 1);
  assert.equal(elements.filter((element) => element.type === "select").length, 0, "the order select lives in the overflow menu");

  const open = collectElements(Toolbar({ ...props, menuOpen: true }));
  const select = open.find((element) => element.type === "select");
  assert.ok(select, "the overflow menu holds the order select");
  assert.equal(select.props.value, "date");
  assert.deepEqual(select.children.flat().map((option) => option.props.value), ["date", "author-date", "topo"]);
  select.props.onChange({ target: { value: "topo" } });
  assert.deepEqual(calls.order, ["topo"]);
});

test("CommitList renders only filtered indices and marks the active match", () => {
  const { CommitList, layoutGraph } = loadInternals();
  const commits = [
    { hash: "a1", abbrev: "a1", subject: "One", parents: [] },
    { hash: "b1", abbrev: "b1", subject: "Two", parents: ["a1"] },
    { hash: "c1", abbrev: "c1", subject: "Three", parents: ["b1"] },
  ];
  const value = { commits, refs: [] };
  const layout = layoutGraph(commits);
  const tree = CommitList({
    t: (key) => key,
    value,
    layout,
    refIndex: new Map(),
    uncommitted: null,
    selectedHash: "",
    indices: [2],
    activeHash: "c1",
    onSelect() {},
    onMenu() {},
    onRefMenu() {},
    onLoadMore() {},
    canLoadMore: false,
    loadingMore: false,
  });
  const elements = collectElements(tree);
  const rows = elements.filter((element) => typeof element.type === "function" && element.type.name === "CommitRow");
  assert.equal(rows.length, 1, "only the matching commit is rendered");
  assert.equal(rows[0].props.commit.hash, "c1");
  assert.equal(rows[0].props.active, true);
  assert.ok(rows[0].props.rowRef !== null && typeof rows[0].props.rowRef === "object", "the active row carries the scroll ref");
  assert.equal(typeof rows[0].props.onRefMenu, "function", "row chips receive the ref menu handler");
  // The lane layout still comes from the whole page: rendering row 2 of 3 keeps
  // its own layout row rather than re-laying out the filtered subset.
  assert.equal(rows[0].props.row, layout.rows[2]);

  const none = collectElements(CommitList({ t: (key) => key, value, layout, refIndex: new Map(), uncommitted: null, indices: [], activeHash: "", onSelect() {}, onMenu() {}, onRefMenu() {} }));
  assert.equal(none.filter((element) => typeof element.type === "function" && element.type.name === "CommitRow").length, 0);
});

// ── wave 4: extended commit / ref menus ─────────────────────────────────────

test("commitActionItems adds merge, rebase, drop and reset with drop guardrails", () => {
  const { commitActionItems } = loadInternals();
  const commits = [
    { hash: "h3", parents: ["h2"] },
    { hash: "h2", parents: ["h1"] },
    { hash: "h1", parents: [] },
  ];
  const items = commitActionItems({ hash: "h2", parents: ["h1"] }, { headHash: "h3", commits });
  assert.deepEqual(Array.from(items, (item) => item.id), ["compare-working", "merge", "rebase", "drop-commit", "reset-commit", "archive"]);
  assert.deepEqual(Array.from(items, (item) => item.kind), ["compareWorking", "merge", "rebase", "dropCommit", "resetToCommit", "archive"]);
  assert.deepEqual(Array.from(items, (item) => item.labelKey), ["menu.compareWorking", "action.merge", "action.rebase", "action.dropCommit", "action.resetToCommit", "menu.archive"]);
  assert.equal(items[1].after, "create-branch");
  assert.equal(items[4].after, "drop-commit");
  assert.equal(items[5].after, "copy-hash", "the archive item lands after copy-hash");
  // h2 still has h3 as a child, so dropping it would rewrite reachable history.
  const drop = items.find((item) => item.kind === "dropCommit");
  assert.equal(drop.disabled, true);
  assert.equal(drop.reasonKey, "menu.dropHasChildren");

  const leaf = commitActionItems({ hash: "orphan", parents: [] }, { headHash: "h3", commits });
  assert.equal(leaf.find((item) => item.kind === "dropCommit").disabled, undefined);
  const atHead = commitActionItems({ hash: "h3", parents: ["h2"] }, { headHash: "h3", commits });
  assert.equal(atHead.find((item) => item.kind === "dropCommit").reasonKey, "menu.dropHead");
  const busy = commitActionItems({ hash: "orphan", parents: [] }, { headHash: "h3", commits, busy: true });
  for (const item of busy) {
    assert.equal(item.disabled, true);
    assert.equal(item.reasonKey, "menu.busy");
  }
});

test("refActionItems adds branch operations guarded by remotes and branch", () => {
  const { refActionItems } = loadInternals();
  const available = { currentBranch: "main", hasRemotes: true };
  const branch = refActionItems({ label: "dev", kind: "branch", isHead: false }, available);
  assert.deepEqual(Array.from(branch, (item) => item.id), [
    "merge-branch", "pull-branch", "push-branch", "rebase-branch", "reset-branch", "fetch-branch",
  ]);
  assert.deepEqual(Array.from(branch, (item) => item.kind), ["merge", "pullBranch", "pushBranch", "rebase", "resetToCommit", "fetchIntoBranch"]);
  for (const item of branch) assert.equal(item.disabled, undefined);
  assert.equal(branch[5].after, "delete-branch");

  const local = refActionItems({ label: "dev", kind: "branch" }, { currentBranch: "main", hasRemotes: false });
  for (const kind of ["pullBranch", "pushBranch", "fetchIntoBranch"]) {
    const item = local.find((entry) => entry.kind === kind);
    assert.equal(item.disabled, true);
    assert.equal(item.reasonKey, "menu.noRemotes");
  }
  assert.equal(local.find((entry) => entry.kind === "merge").disabled, undefined);
  // Rebasing a branch onto itself is refused before the dialog opens.
  const current = refActionItems({ label: "main", kind: "branch", isHead: true }, available);
  assert.equal(current.find((entry) => entry.kind === "rebase").reasonKey, "menu.sameBranch");

  const busy = refActionItems({ label: "dev", kind: "branch" }, { ...available, busy: true });
  for (const item of busy) assert.equal(item.reasonKey, "menu.busy");

  const tag = refActionItems({ label: "v1.0", kind: "tag" }, available);
  assert.deepEqual(Array.from(tag, (item) => item.kind), ["tagDetails", "pushTag"]);
  assert.equal(tag[0].before, "delete-tag");
  assert.equal(tag[1].after, "tag-details");
  assert.equal(refActionItems({ label: "v1.0", kind: "tag" }, { hasRemotes: false }).find((entry) => entry.kind === "pushTag").reasonKey, "menu.noRemotes");

  const stash = refActionItems({ label: "stash@{2}", kind: "stash" }, available);
  assert.deepEqual(Array.from(stash, (item) => item.kind), ["stashApply", "stashPop", "stashDrop", "branchFromStash"]);
  for (const item of refActionItems({ label: "stash", kind: "stash" }, available)) {
    assert.equal(item.disabled, true);
    assert.equal(item.reasonKey, "menu.noRef");
  }
  // The remote chip menu keeps its wave-3 base items only.
  assert.deepEqual(Array.from(refActionItems({ label: "origin/main", kind: "remote" }, available)), []);
});

test("insertMenuItems places extended actions next to their anchors", () => {
  const { insertMenuItems } = loadInternals();
  const base = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const combined = insertMenuItems(base, [{ id: "x", after: "a" }, { id: "y", before: "c" }, { id: "z" }]);
  assert.deepEqual(Array.from(combined, (item) => item.id), ["a", "x", "b", "y", "c", "z"]);
  assert.deepEqual(Array.from(base, (item) => item.id), ["a", "b", "c"], "the base list is not mutated");
  assert.deepEqual(Array.from(insertMenuItems(null, [{ id: "only" }]), (item) => item.id), ["only"]);
});

test("stashIndex and commitHasChildren support the stash/drop guardrails", () => {
  const { stashIndex, commitHasChildren } = loadInternals();
  assert.equal(stashIndex("stash@{0}"), 0);
  assert.equal(stashIndex("stash@{12}"), 12);
  assert.equal(stashIndex("stash"), -1);
  assert.equal(stashIndex("stash@{}"), -1);
  assert.equal(stashIndex("main"), -1);
  assert.equal(stashIndex(null), -1);

  const commits = [{ hash: "b", parents: ["a"] }, { hash: "a", parents: [] }];
  assert.equal(commitHasChildren(commits, "a"), true);
  assert.equal(commitHasChildren(commits, "b"), false);
  assert.equal(commitHasChildren(commits, "missing"), false);
  assert.equal(commitHasChildren(null, "a"), false);
});

// ── wave 4: declarative dialog spec + arguments ─────────────────────────────

test("actionDialogSpec describes the new dialog shapes", () => {
  const { actionDialogSpec } = loadInternals();
  const choices = {
    branches: [{ name: "main" }, { name: "dev" }],
    tags: [{ name: "v1.0" }],
    remotes: [{ name: "origin" }],
    currentBranch: "main",
  };
  const merge = actionDialogSpec("merge", choices);
  assert.equal(merge.needs, null);
  assert.deepEqual(Array.from(merge.options, (option) => option.key), ["noFastForward", "noCommit", "squash"]);
  assert.deepEqual(Array.from(merge.options, (option) => option.labelKey), ["check.noFastForward", "check.noCommit", "check.squash"]);
  assert.equal(merge.destructive, false);
  assert.equal(merge.dirtySensitive, true);

  const reset = actionDialogSpec("resetToCommit", choices);
  assert.equal(reset.needs, "hashAndMode");
  assert.deepEqual(Array.from(reset.choices, (choice) => choice.value), ["soft", "mixed", "hard"]);
  assert.equal(reset.destructive, true);
  assert.equal(reset.modeWarnings.hard, "action.warningHardReset");

  const resetUncommitted = actionDialogSpec("resetUncommitted", choices);
  assert.equal(resetUncommitted.needs, "mode");
  assert.deepEqual(Array.from(resetUncommitted.choices, (choice) => choice.value), ["mixed", "hard"]);

  const pull = actionDialogSpec("pullBranch", choices);
  assert.equal(pull.needs, "remote");
  assert.deepEqual(Array.from(pull.options, (option) => option.name), ["origin"]);
  assert.deepEqual(Array.from(pull.checks, (option) => option.key), ["noFastForward", "rebase"]);
  const push = actionDialogSpec("pushBranch", choices);
  assert.deepEqual(Array.from(push.options, (option) => option.name), ["origin"]);
  assert.deepEqual(Array.from(push.checks, (option) => option.key), ["force", "setUpstream"]);
  assert.equal(push.checkWarnings.force, "action.warningForcePush");
  assert.equal(actionDialogSpec("pushTag", choices).needs, "remote");

  const addRemote = actionDialogSpec("addRemote", choices);
  assert.deepEqual(Array.from(addRemote.fields, (field) => field.key), ["name", "url"]);
  assert.deepEqual(Array.from(addRemote.fields, (field) => field.labelKey), ["action.remoteName", "action.remoteUrl"]);
  const rename = actionDialogSpec("renameBranch", choices);
  assert.deepEqual(Array.from(rename.fields, (field) => field.labelKey), ["action.oldBranchName", "action.newBranchName"]);
  assert.equal(actionDialogSpec("deleteRemote", choices).warnings[0], "action.warningRemoveRemote");

  const clean = actionDialogSpec("cleanUntracked", choices);
  assert.equal(clean.requiresPreview, true);
  assert.equal(clean.destructive, true);
  assert.deepEqual(Array.from(clean.options), []);
  assert.deepEqual(Array.from(clean.checks), []);
  assert.deepEqual(Array.from(clean.warnings), ["action.warningClean"]);
  assert.equal(actionDialogSpec("dropCommit", choices).warnings[0], "action.warningDrop");
});

test("actionArguments builds the wave-4 request bodies", () => {
  const { actionArguments } = loadInternals();
  const shape = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(shape(actionArguments("merge", { hash: "h1", flags: { noFastForward: true, squash: true } })), {
    hash: "h1",
    noFastForward: true,
    noCommit: false,
    squash: true,
  });
  assert.deepEqual(shape(actionArguments("rebase", { hash: "main" })), { onto: "main" });
  assert.deepEqual(shape(actionArguments("dropCommit", { hash: "h1" })), { hash: "h1" });
  assert.deepEqual(shape(actionArguments("resetToCommit", { hash: "h1", extra: "hard" })), { hash: "h1", mode: "hard" });
  assert.deepEqual(shape(actionArguments("resetToCommit", { hash: "h1", extra: "bogus" })), { hash: "h1", mode: "soft" });
  assert.deepEqual(shape(actionArguments("pullBranch", { ref: "origin", branch: "dev", flags: { noFastForward: true } })), {
    remote: "origin",
    branch: "dev",
    noFastForward: true,
  });
  assert.deepEqual(shape(actionArguments("pushBranch", { ref: "origin", branch: "dev", flags: { setUpstream: true, force: true } })), {
    remote: "origin",
    branch: "dev",
    setUpstream: true,
    force: true,
  });
  assert.deepEqual(shape(actionArguments("pushTag", { ref: "origin", tagName: "v1.0" })), { name: "v1.0", remote: "origin" });
  assert.deepEqual(shape(actionArguments("stashApply", { index: 2, flags: { reinstateIndex: true } })), { index: 2, reinstateIndex: true });
  assert.deepEqual(shape(actionArguments("stashPop", { index: 0 })), { index: 0, reinstateIndex: false });
  assert.deepEqual(shape(actionArguments("stashDrop", { index: 1 })), { index: 1 });
  assert.deepEqual(shape(actionArguments("branchFromStash", { index: 0, name: "recover" })), { index: 0, name: "recover" });
  assert.deepEqual(shape(actionArguments("stashUncommitted", { flags: { includeUntracked: true } })), { includeUntracked: true });
  // The UI previews with dryRun: true and confirms with the real clean.
  assert.deepEqual(shape(actionArguments("cleanUntracked", { flags: { dryRun: true } })), { dryRun: true });
  assert.deepEqual(shape(actionArguments("cleanUntracked", { flags: {} })), { dryRun: false });
  assert.deepEqual(shape(actionArguments("resetUncommitted", { extra: "hard" })), { mode: "hard" });
  assert.deepEqual(shape(actionArguments("resetFileToRevision", { path: "a.txt" })), { path: "a.txt", hash: "HEAD" });
  assert.deepEqual(shape(actionArguments("addRemote", { name: "origin", extra: "https://example.com/r.git" })), {
    name: "origin",
    url: "https://example.com/r.git",
  });
  assert.deepEqual(shape(actionArguments("editRemote", { name: "origin", extra: "git@example.com:r.git" })), {
    name: "origin",
    url: "git@example.com:r.git",
  });
  assert.deepEqual(shape(actionArguments("deleteRemote", { remoteName: "origin" })), { name: "origin" });
  assert.deepEqual(shape(actionArguments("pruneRemote", { remoteName: "origin" })), { name: "origin" });
  assert.deepEqual(shape(actionArguments("fetch", { ref: "origin" })), { remote: "origin" });
});

// ── wave 4: the one dialog, rendered declaratively ─────────────────────────

/** Build a dialog descriptor the way GitGraphBody does. */
function dialogFor(kind, choices, extra) {
  const { actionDialogSpec } = loadInternals();
  return { kind, hash: "h1", requestedRef: "", preview: null, ...actionDialogSpec(kind, choices), ...extra };
}

test("ActionDialog renders checkboxes and submits the flags", () => {
  const { ActionDialog } = loadInternals();
  const confirmed = [];
  const tree = ActionDialog({
    t: (key) => key,
    dialog: dialogFor("merge", { branches: [], tags: [], remotes: [], currentBranch: "" }),
    dirty: 0,
    running: false,
    onCancel: () => {},
    onConfirm: (...args) => confirmed.push(args),
  });
  const elements = collectElements(tree);
  const boxes = elements.filter((element) => element.type === "input" && element.type === "input" && element.props.type === "checkbox");
  assert.equal(boxes.length, 3, "merge offers its three boolean options");
  assert.deepEqual(boxes.map((box) => box.props.checked), [false, false, false]);
  const labels = elements.filter((element) => element.type === "span" && String(element.props.className).includes("dgg-check-label"));
  assert.deepEqual(labels.map((label) => label.children.join("")), ["check.noFastForward", "check.noCommit", "check.squash"]);
  const run = elements.find((element) => element.type === "button" && element.children.join("") === "action.run");
  assert.equal(run.props.disabled, false);
  run.props.onClick();
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].length, 4, "flag dialogs pass the checkbox map as a fourth argument");
  assert.deepEqual(plain(confirmed[0][3]), { noFastForward: false, noCommit: false, squash: false });
});

test("ActionDialog renders mode pickers and guardrail warnings", () => {
  const { ActionDialog } = loadInternals();
  const confirmed = [];
  const reset = ActionDialog({
    t: (key) => key,
    dialog: dialogFor("resetToCommit", { branches: [], tags: [], remotes: [], currentBranch: "" }),
    dirty: 0,
    running: false,
    onCancel: () => {},
    onConfirm: (...args) => confirmed.push(args),
  });
  const resetElements = collectElements(reset);
  const modeSelect = resetElements.find((element) => element.type === "select" && element.props["aria-label"] === "action.mode");
  assert.ok(modeSelect, "the reset dialog has a mode picker");
  assert.deepEqual(modeSelect.children.flat().map((option) => option.props.value), ["soft", "mixed", "hard"]);
  const run = resetElements.find((element) => element.type === "button" && element.children.join("") === "action.run");
  run.props.onClick();
  assert.deepEqual(plain(confirmed[0]), ["", "", "soft"]);

  const drop = collectElements(
    ActionDialog({ t: (key) => key, dialog: dialogFor("dropCommit", {}), dirty: 0, running: false, onCancel() {}, onConfirm() {} }),
  );
  const warning = drop.find((element) => element.type === "p" && element.props.className === "dgg-dialog-warning");
  assert.equal(warning.children.join(""), "action.warningDrop", "dropping shows its consequences");
});

test("ActionDialog gates clean behind the dry-run preview", () => {
  const { ActionDialog } = loadInternals();
  const confirmed = [];
  const base = {
    t: (key) => key,
    dirty: 0,
    running: false,
    onCancel: () => {},
    onConfirm: (...args) => confirmed.push(args),
  };
  const pending = collectElements(ActionDialog({ ...base, dialog: dialogFor("cleanUntracked", {}) }));
  const pendingRun = pending.find((element) => element.type === "button" && element.children.join("") === "action.run");
  assert.equal(pendingRun.props.disabled, true, "clean cannot run before the dry run is shown");
  assert.ok(pending.some((element) => element.children.join("") === "action.previewing"));

  const previewed = collectElements(
    ActionDialog({ ...base, dialog: dialogFor("cleanUntracked", {}, { preview: { lines: ["build/out.js", "tmp.log"] } }) }),
  );
  const lines = previewed.filter((element) => element.type === "li").map((element) => element.children.join(""));
  assert.deepEqual(lines, ["build/out.js", "tmp.log"]);
  const readyRun = previewed.find((element) => element.type === "button" && element.children.join("") === "action.run");
  assert.equal(readyRun.props.disabled, false);
  readyRun.props.onClick();
  assert.deepEqual(plain(confirmed[0]), ["", "", ""]);

  const empty = collectElements(ActionDialog({ ...base, dialog: dialogFor("cleanUntracked", {}, { preview: { lines: [] } }) }));
  assert.ok(empty.some((element) => element.children.join("") === "action.cleanNothing"));
});

test("ActionDialog renders the remote url fields", () => {
  const { ActionDialog } = loadInternals();
  const confirmed = [];
  const tree = ActionDialog({
    t: (key) => key,
    dialog: dialogFor("addRemote", {}),
    dirty: 0,
    running: false,
    onCancel: () => {},
    onConfirm: (...args) => confirmed.push(args),
  });
  const elements = collectElements(tree);
  const inputs = elements.filter((element) => element.type === "input");
  assert.deepEqual(inputs.map((input) => input.props["aria-label"]), ["action.remoteName", "action.remoteUrl"]);
  assert.deepEqual(inputs.map((input) => input.props.value), ["", ""]);
  const run = elements.find((element) => element.type === "button" && element.children.join("") === "action.run");
  assert.equal(run.props.disabled, true, "both fields are required");
  run.props.onClick();
  assert.deepEqual(plain(confirmed[0]), ["", "", ""]);
});

// ── wave 4: tag details, remotes, uncommitted actions, detail row ──────────

test("TagDetails shows annotated and lightweight tags", () => {
  const { TagDetails } = loadInternals();
  const annotated = collectElements(
    TagDetails({
      t: (key) => key,
      name: "v1.0",
      status: "ready",
      value: { name: "v1.0", annotated: true, tagger: { name: "Ann", email: "ann@x", time: 1700000000 }, message: "Release 1.0" },
    }),
  );
  const text = annotated.map((element) => element.children.join("")).join(" | ");
  assert.match(text, /action\.tagDetails/);
  assert.match(text, /detail\.annotated/);
  assert.match(text, /detail\.tagger/);
  assert.match(text, /detail\.tagTime/);
  assert.ok(annotated.some((element) => element.type === "pre" && element.children.join("") === "Release 1.0"));

  const lightweight = collectElements(
    TagDetails({ t: (key) => key, name: "v1.0", status: "ready", value: { name: "v1.0", annotated: false, tagger: null, message: "" } }),
  );
  const lightweightText = lightweight.map((element) => element.children.join("")).join(" | ");
  assert.match(lightweightText, /detail\.lightweight/);
  assert.match(lightweightText, /detail\.tagNoMessage/);

  const loading = collectElements(TagDetails({ t: (key) => key, name: "v1.0", status: "loading" }));
  assert.ok(loading.some((element) => element.children.join("") === "state.loading"));
  const failed = collectElements(TagDetails({ t: (key) => key, name: "v1.0", status: "error", error: "boom" }));
  assert.match(failed.map((element) => element.children.join("")).join(" | "), /boom/);
});

test("RemotesPanel lists remotes and treats an empty list as normal", () => {
  const { RemotesPanel } = loadInternals();
  const calls = { add: 0, edit: [], prune: [], remove: [] };
  const tree = RemotesPanel({
    t: (key) => key,
    status: "ready",
    value: { isRepo: true, remotes: [{ name: "origin", fetchUrl: "https://example.com/r.git", pushUrl: "https://example.com/r.git" }] },
    error: null,
    onAdd: () => { calls.add += 1; },
    onEdit: (remote) => calls.edit.push(remote.name),
    onPrune: (remote) => calls.prune.push(remote.name),
    onDelete: (remote) => calls.remove.push(remote.name),
    onRefresh: () => {},
    onClose: () => {},
  });
  const elements = collectElements(tree);
  assert.ok(elements.some((element) => element.type === "span" && element.props.className === "dgg-remote-name" && element.children.join("") === "origin"));
  assert.ok(elements.some((element) => element.props.className === "dgg-remote-url" && element.children.join("") === "https://example.com/r.git"));
  const buttons = elements.filter((element) => element.type === "button");
  const edit = buttons.find((button) => button.children.join("") === "remote.edit");
  edit.props.onClick();
  assert.deepEqual(calls.edit, ["origin"]);
  buttons.find((button) => button.children.join("") === "remote.prune").props.onClick();
  assert.deepEqual(calls.prune, ["origin"]);
  buttons.find((button) => button.children.join("") === "remote.delete").props.onClick();
  assert.deepEqual(calls.remove, ["origin"]);
  buttons.find((button) => button.children.join("") === "remote.add").props.onClick();
  assert.equal(calls.add, 1);

  const empty = collectElements(RemotesPanel({ t: (key) => key, status: "ready", value: { isRepo: true, remotes: [] } }));
  assert.ok(empty.some((element) => element.children.join("") === "remote.empty"));
  const failed = collectElements(RemotesPanel({ t: (key) => key, status: "error", error: "no route", value: null }));
  assert.match(failed.map((element) => element.children.join("")).join(" | "), /no route/);
});

test("UncommittedView exposes stash, clean, reset and per-file discard", () => {
  const { UncommittedView } = loadInternals();
  const calls = { stash: 0, untracked: 0, clean: 0, reset: 0, discard: [] };
  const value = {
    isRepo: true,
    counts: { staged: 1, unstaged: 1, untracked: 0 },
    staged: [{ status: "M", path: "a.js" }],
    unstaged: [{ status: "M", path: "b.js" }],
    untracked: [],
  };
  const tree = UncommittedView({
    t: (key) => key,
    value,
    sessionId: "s1",
    cache: { current: new Map() },
    dialog: null,
    dirty: 1,
    running: false,
    onStash: () => { calls.stash += 1; },
    onStashUntracked: () => { calls.untracked += 1; },
    onClean: () => { calls.clean += 1; },
    onReset: () => { calls.reset += 1; },
    onDiscard: (file) => calls.discard.push(file.path),
    onCancelDialog: () => {},
    onConfirmDialog: () => {},
  });
  const elements = collectElements(tree);
  const buttons = elements.filter((element) => element.type === "button");
  buttons.find((button) => button.children.join("") === "action.stashUncommitted").props.onClick();
  buttons.find((button) => button.children.join("") === "action.stashUntracked").props.onClick();
  buttons.find((button) => button.children.join("") === "action.cleanUntracked").props.onClick();
  buttons.find((button) => button.children.join("") === "action.resetUncommitted").props.onClick();
  assert.deepEqual(calls, { stash: 1, untracked: 1, clean: 1, reset: 1, discard: [] });
  const rows = elements.filter((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.equal(rows.length, 2);
  assert.equal(typeof rows[0].props.onDiscard, "function");
  rows[0].props.onDiscard({ path: "a.js" });
  assert.deepEqual(calls.discard, ["a.js"]);

  const withDialog = collectElements(
    UncommittedView({
      t: (key) => key,
      value,
      dialog: { kind: "resetUncommitted", needs: "mode", options: [], fields: [], choices: [{ value: "mixed", labelKey: "mode.mixed" }, { value: "hard", labelKey: "mode.hard" }], destructive: true, dirtySensitive: false, hash: "", requestedRef: "", preview: null },
      dirty: 0,
      running: false,
      onStash() {},
      onStashUntracked() {},
      onClean() {},
      onReset() {},
      onDiscard() {},
      onCancelDialog() {},
      onConfirmDialog() {},
    }),
  );
  assert.ok(withDialog.some((element) => typeof element.type === "function" && element.type.name === "ActionDialog"), "the pane hosts the shared dialog");
});

test("DetailView offers merge, rebase, drop and reset and disables drop with a reason", () => {
  const { DetailView } = loadInternals();
  const commit = {
    hash: "h1",
    abbrev: "h1",
    parents: ["p1"],
    authorName: "Ann",
    authorEmail: "ann@x",
    authorTime: 1700000000,
    committerName: "Ann",
    committerEmail: "ann@x",
    committerTime: 1700000000,
    subject: "Subject",
    body: "",
    refs: [],
    stats: { files: 0, insertions: 0, deletions: 0 },
    files: [],
  };
  const baseProps = {
    t: (key) => key,
    commit,
    refIndex: new Map(),
    branches: [],
    dirty: 0,
    dialog: null,
    run: null,
    copy: { state: "idle", text: "" },
    sessionId: "s1",
    diffCache: { current: new Map() },
    onOpenDialog: () => {},
    onCancelDialog: () => {},
    onConfirmDialog: () => {},
    onRunFetch: () => {},
    onSelectCommit: () => {},
    onCopy: () => {},
    onRefMenu: () => {},
  };
  const elements = collectElements(DetailView({ ...baseProps, dropDisabledReason: "menu.dropHead" }));
  const labels = elements.filter((element) => element.type === "button").map((element) => element.children.join(""));
  for (const key of ["action.merge", "action.rebase", "action.dropCommit", "action.resetToCommit"]) {
    assert.ok(labels.includes(key), "the detail row offers " + key);
  }
  const drop = elements.find((element) => element.type === "button" && element.children.join("") === "action.dropCommit");
  assert.equal(drop.props.disabled, true);
  assert.equal(drop.props.title, "menu.dropHead");
  const merge = elements.find((element) => element.type === "button" && element.children.join("") === "action.merge");
  assert.equal(merge.props.disabled, false);
  const open = collectElements(DetailView({ ...baseProps, dropDisabledReason: "" }));
  assert.equal(open.find((element) => element.type === "button" && element.children.join("") === "action.dropCommit").props.disabled, false);
});

// ── wave 5: presentation, rich text, signatures ─────────────────────────────

test("presentationOf normalizes the graph presentation settings", () => {
  const { presentationOf, DEFAULT_SHORTCUTS } = loadInternals();
  const defaultShortcuts = {
    find: { ...DEFAULT_SHORTCUTS.find },
    refresh: { ...DEFAULT_SHORTCUTS.refresh },
    scrollToHead: { ...DEFAULT_SHORTCUTS.scrollToHead },
    scrollToStash: { ...DEFAULT_SHORTCUTS.scrollToStash },
    stashPrevious: { ...DEFAULT_SHORTCUTS.scrollToStash, shift: true },
  };
  const waveC = {
    dateType: "Author Date",
    dateFormat: "",
    columnVisibility: { Date: true, Author: true, Commit: true },
    fileViewType: "",
    compactFolders: true,
    autoCenterDetails: false,
    referenceLabelAlignment: "Normal",
    combineLocalAndRemoteBranchLabels: false,
    muteMergeCommits: false,
    muteNonAncestors: false,
    emojiMappings: {},
    markdown: false,
    enhancedAccessibility: false,
    repositoryDropdownOrder: "",
    initialLoad: 0,
    loadMore: 0,
    loadMoreAutomatically: false,
    dialogDefaults: {},
    contextMenuVisibility: {},
    avatars: false,
  };
  const defaults = presentationOf(null);
  assert.deepEqual(plain(defaults), {
    graphStyle: "rounded",
    graphColours: [],
    showSignature: false,
    showEmoji: true,
    issueUrlTemplate: "",
    customBranchGlobPatterns: [],
    shortcuts: defaultShortcuts,
    globalShortcuts: false,
    ...waveC,
  });
  const configured = presentationOf({
    presentation: {
      graphStyle: "angular",
      graphColours: ["#111", "", 7, "#222"],
      showSignature: true,
      showEmoji: false,
      issueUrlTemplate: "https://example.com/issues/{id}",
      useMailmap: true,
      customBranchGlobPatterns: [{ name: "feature", glob: "feature/*" }, "", 5, "release/**"],
      dateType: "Commit Date",
      dateFormat: "ISO Date Only",
      columnVisibility: { Date: false, Author: true, Commit: false },
      fileViewType: "File Tree",
      compactFolders: false,
      autoCenterDetails: true,
      referenceLabelAlignment: "Branches (aligned to the graph) & Tags (on the right)",
      combineLocalAndRemoteBranchLabels: true,
      muteMergeCommits: true,
      muteNonAncestors: true,
      emojiMappings: [
        { shortcode: "party", emoji: "🎉" },
        { shortcode: "smile", emoji: "X" },
        { shortcode: "", emoji: "ignored" },
        { shortcode: "bad", emoji: 7 },
      ],
      markdown: true,
      enhancedAccessibility: true,
      repositoryDropdownOrder: "Name",
      initialLoad: 500,
      loadMore: 250,
      loadMoreAutomatically: true,
      dialogDefaults: {
        applyStash: { reinstateIndex: true },
        popStash: { reinstateIndex: true },
        merge: { noCommit: true, noFastForward: true, squashCommits: true },
        pullBranch: { noFastForward: true },
        resetCurrentBranchToCommit: { mode: "Hard" },
        resetUncommittedChanges: { mode: "Mixed" },
        stashUncommittedChanges: { includeUntracked: true },
      },
      contextMenuVisibility: { commit: { cherryPick: false }, branch: { deleteBranch: true } },
      avatars: true,
    },
  });
  assert.deepEqual(plain(configured), {
    graphStyle: "angular",
    graphColours: ["#111", "#222"],
    showSignature: true,
    showEmoji: false,
    issueUrlTemplate: "https://example.com/issues/{id}",
    customBranchGlobPatterns: ["feature/*", "release/**"],
    shortcuts: defaultShortcuts,
    globalShortcuts: false,
    markdown: true,
    enhancedAccessibility: true,
    repositoryDropdownOrder: "Name",
    initialLoad: 500,
    loadMore: 250,
    loadMoreAutomatically: true,
    dialogDefaults: {
      applyStash: { reinstateIndex: true },
      popStash: { reinstateIndex: true },
      merge: { noCommit: true, noFastForward: true, squashCommits: true },
      pullBranch: { noFastForward: true },
      resetCurrentBranchToCommit: { mode: "hard" },
      resetUncommittedChanges: { mode: "mixed" },
      stashUncommittedChanges: { includeUntracked: true },
    },
    contextMenuVisibility: { commit: { cherryPick: false }, branch: { deleteBranch: true } },
    avatars: true,
    dateType: "Commit Date",
    dateFormat: "ISO Date Only",
    columnVisibility: { Date: false, Author: true, Commit: false },
    fileViewType: "tree",
    compactFolders: false,
    autoCenterDetails: true,
    referenceLabelAlignment: "Branches (aligned to the graph) & Tags (on the right)",
    combineLocalAndRemoteBranchLabels: true,
    muteMergeCommits: true,
    muteNonAncestors: true,
    emojiMappings: { party: "🎉", smile: "X" },
  });
  // An unknown style falls back, and a template without {id} is disabled.
  const fallback = presentationOf({ presentation: { graphStyle: "bogus", issueUrlTemplate: "https://example.com/issues/" } });
  assert.equal(fallback.graphStyle, "rounded");
  assert.equal(fallback.issueUrlTemplate, "");
});

test("lanePath draws rounded curves or angular elbows", () => {
  const { lanePath } = loadInternals();
  assert.equal(lanePath(9, 0, 9, 38, "angular"), "M9 0 L9 38", "vertical segments are straight in both styles");
  assert.equal(lanePath(9, 0, 9, 38), "M9 0 L9 38");
  assert.match(lanePath(9, 0, 23, 38, "rounded"), /^M9 0 C9 19, 23 19, 23 38$/);
  assert.equal(lanePath(9, 0, 23, 38, "angular"), "M9 0 L9 19 L23 19 L23 38");
  assert.match(lanePath(9, 0, 23, 38), /^M9 0 C9 19/, "the default stays rounded");
});

test("laneColor cycles the presentation palette when one is configured", () => {
  const { laneColor } = loadInternals();
  const palette = ["#111111", "#222222"];
  assert.equal(laneColor(0, palette), "#111111");
  assert.equal(laneColor(1, palette), "#222222");
  assert.equal(laneColor(2, palette), "#111111");
  assert.equal(laneColor(0, []), "#5B8CFF", "an empty palette keeps the built-in lane palette");
  assert.equal(laneColor(0, null), "#5B8CFF");
});

test("richTextParts renders known emoji and leaves unknown shortcodes literal", () => {
  const { richTextParts } = loadInternals();
  const parts = richTextParts(":rocket: ship :unknown: :bug:", { showEmoji: true });
  assert.deepEqual(Array.from(parts, (part) => part.type), ["emoji", "text", "emoji"]);
  assert.equal(parts[0].text, "\u{1F680}");
  assert.equal(parts[0].shortcode, ":rocket:");
  assert.equal(parts[1].text, " ship :unknown: ", "an unknown shortcode stays literal");
  assert.equal(parts[2].text, "\u{1F41B}");
  const off = richTextParts(":rocket:", { showEmoji: false });
  assert.deepEqual(Array.from(off, (part) => part.type), ["text"]);
  assert.equal(off[0].text, ":rocket:");
  assert.deepEqual(Array.from(richTextParts("", {})), []);
});

test("richTextParts links only numeric issue references from a valid template", () => {
  const { richTextParts } = loadInternals();
  const presentation = { showEmoji: false, issueUrlTemplate: "https://example.com/issues/{id}" };
  const parts = richTextParts("fix #12 and #7", presentation);
  assert.deepEqual(Array.from(parts, (part) => part.type), ["text", "issue", "text", "issue"]);
  assert.equal(parts[1].text, "#12");
  assert.equal(parts[1].href, "https://example.com/issues/12");
  assert.equal(parts[3].href, "https://example.com/issues/7");
  const suffixed = richTextParts("#12x", presentation);
  assert.equal(suffixed[0].href, "https://example.com/issues/12");
  assert.equal(suffixed[1].text, "x");
  // Non-numeric or a template without {id} never becomes a link.
  assert.deepEqual(Array.from(richTextParts("#abc #", presentation), (part) => part.type), ["text"]);
  assert.deepEqual(Array.from(richTextParts("#1", { issueUrlTemplate: "https://example.com/" }), (part) => part.type), ["text"]);
});

test("RichText renders anchors and emoji as React nodes only", () => {
  const { RichText } = loadInternals();
  const tree = RichText({
    text: "fix #12 :tada:",
    presentation: { showEmoji: true, issueUrlTemplate: "https://example.com/issues/{id}" },
  });
  const elements = collectElements(tree);
  const anchor = elements.find((element) => element.type === "a");
  assert.equal(anchor.props.href, "https://example.com/issues/12");
  assert.equal(anchor.props.target, "_blank");
  assert.equal(anchor.props.rel, "noreferrer noopener");
  assert.equal(anchor.children.join(""), "#12");
  const emoji = elements.find((element) => element.type === "span" && element.props.className === "dgg-emoji");
  assert.equal(emoji.children.join(""), "\u{1F389}");
  assert.equal(emoji.props.role, "img");
  assert.equal(RichText({ text: "", presentation: {} }), null);
});

test("signatureBadge maps git signature statuses and renders nothing for N", () => {
  const { signatureBadge, SignatureBadge } = loadInternals();
  const shape = (signature) => {
    const badge = signatureBadge(signature);
    return badge === null ? null : { status: badge.status, labelKey: badge.labelKey, tone: badge.tone, signer: badge.signer };
  };
  assert.deepEqual(shape({ status: "G", signer: "Ann", keyId: "k" }), { status: "G", labelKey: "detail.signatureVerified", tone: "good", signer: "Ann" });
  assert.equal(shape({ status: "B" }).tone, "bad");
  assert.equal(shape({ status: "U" }).labelKey, "detail.signatureUnknown");
  assert.equal(shape({ status: "X" }).labelKey, "detail.signatureExpired");
  assert.equal(shape({ status: "Y" }).labelKey, "detail.signatureExpired");
  assert.equal(shape({ status: "R" }).labelKey, "detail.signatureRevoked");
  assert.equal(shape({ status: "N" }), null);
  assert.equal(shape(null), null);
  assert.equal(signatureBadge(null), null);

  const verified = collectElements(SignatureBadge({ t: (key) => key, signature: { status: "G", signer: "Ann" } }));
  assert.ok(verified.some((element) => element.props.className === "dgg-signature dgg-signature-good"));
  assert.ok(verified.some((element) => element.props.className === "dgg-signature-signer" && element.children.join("") === "Ann"));
  assert.ok(verified.some((element) => element.children.join("") === "detail.signatureVerified"));
  assert.equal(SignatureBadge({ t: (key) => key, signature: { status: "N" } }), null);
});

test("DetailView renders the signature badge and rich subject and body", () => {
  const { DetailView } = loadInternals();
  const commit = {
    hash: "h1", abbrev: "h1", parents: [], authorName: "Ann", authorEmail: "ann@x", authorTime: 1700000000,
    committerName: "Ann", committerEmail: "ann@x", committerTime: 1700000000,
    subject: "Fix :bug: #7", body: "Body :rocket: #9", refs: [],
    signature: { status: "G", signer: "Ann", keyId: "k" },
    stats: { files: 0, insertions: 0, deletions: 0 }, files: [],
  };
  const common = {
    t: (key) => key, commit, refIndex: new Map(), branches: [], dirty: 0, dialog: null, run: null,
    copy: { state: "idle", text: "" }, sessionId: "s1", diffCache: { current: new Map() },
    onOpenDialog() {}, onCancelDialog() {}, onConfirmDialog() {}, onRunFetch() {}, onSelectCommit() {},
    onCopy() {}, onRefMenu() {}, dropDisabledReason: "",
  };
  const shown = collectElements(DetailView({
    ...common,
    presentation: { showSignature: true, showEmoji: true, issueUrlTemplate: "https://example.com/issues/{id}", graphStyle: "rounded", graphColours: [] },
  }));
  const badge = shown.find((element) => typeof element.type === "function" && element.type.name === "SignatureBadge");
  assert.ok(badge, "showSignature renders the badge");
  assert.equal(badge.props.signature.status, "G");
  const rich = shown.filter((element) => typeof element.type === "function" && element.type.name === "RichText");
  assert.deepEqual(Array.from(rich, (element) => element.props.text), ["Fix :bug: #7", "Body :rocket: #9"]);
  const rendered = rich.flatMap((element) => collectElements(element.type(element.props)));
  const links = rendered.filter((element) => element.type === "a");
  assert.deepEqual(Array.from(links, (anchor) => anchor.props.href), ["https://example.com/issues/7", "https://example.com/issues/9"]);

  // Without showSignature the badge is absent; without the template no anchors render.
  const plainView = collectElements(DetailView({ ...common, presentation: { showSignature: false, showEmoji: false, issueUrlTemplate: "", graphStyle: "rounded", graphColours: [] } }));
  assert.equal(plainView.some((element) => typeof element.type === "function" && element.type.name === "SignatureBadge"), false);
  const plainRich = plainView.filter((element) => typeof element.type === "function" && element.type.name === "RichText");
  const plainRendered = plainRich.flatMap((element) => collectElements(element.type(element.props)));
  assert.equal(plainRendered.some((element) => element.type === "a"), false);
});

// ── wave 5: containment tooltip ─────────────────────────────────────────────

test("containsSummary caps each list and counts the overflow", () => {
  const { containsSummary } = loadInternals();
  const branches = Array.from({ length: 8 }, (unused, index) => ({ name: "b" + index, isHead: index === 2 }));
  const summary = containsSummary({ inHead: true, branches, tags: ["v1", "v2"], stashes: [{ index: 0, shortName: "stash@{0}" }] }, 6);
  assert.equal(summary.inHead, true);
  assert.equal(summary.branches.length, 6);
  assert.equal(summary.branches[2].isHead, true);
  assert.equal(summary.tags.length, 2);
  assert.equal(summary.stashes.length, 1);
  assert.equal(summary.hidden, 2, "only the branch list overflows here");
  const capped = containsSummary({ inHead: false, branches, tags: ["t1", "t2"], stashes: [{ index: 0 }, { index: 1 }] }, 1);
  assert.equal(capped.branches.length, 1);
  assert.equal(capped.tags.length, 1);
  assert.equal(capped.stashes.length, 1);
  assert.equal(capped.hidden, 7 + 1 + 1);
  assert.deepEqual(plain(containsSummary(null, 6)), { inHead: false, branches: [], tags: [], stashes: [], hidden: 0 });
});

test("tooltipPosition clamps the tooltip near the pointer", () => {
  const { tooltipPosition } = loadInternals();
  assert.deepEqual(plain(tooltipPosition({ x: 20, y: 30 }, { width: 260, height: 170 }, { width: 900, height: 700 })), { left: 34, top: 48 });
  assert.deepEqual(plain(tooltipPosition({ x: 880, y: 680 }, { width: 260, height: 170 }, { width: 900, height: 700 })), { left: 634, top: 524 });
  assert.deepEqual(plain(tooltipPosition({ x: -10, y: Number.NaN }, { width: 260, height: 170 }, { width: 0, height: 0 })), { left: 6, top: 18 });
});

test("createLruCache evicts the least recently used entry", () => {
  const { createLruCache } = loadInternals();
  const cache = createLruCache(2);
  assert.equal(cache.limit(), 2);
  cache.set("a", { value: 1 });
  cache.set("b", { value: 2 });
  assert.equal(cache.get("a").value, 1, "reading refreshes recency");
  cache.set("c", { value: 3 });
  assert.equal(cache.has("b"), false, "the least recently used entry is evicted");
  assert.equal(cache.has("a"), true);
  assert.equal(cache.size(), 2);
  cache.set("a", { value: 4 });
  assert.equal(cache.get("a").value, 4, "an existing key updates in place");
  assert.equal(cache.size(), 2);
  cache.delete("a");
  assert.equal(cache.size(), 1);
  cache.clear();
  assert.equal(cache.size(), 0);
});

test("CommitTooltip renders containment, branches, tags, stashes and overflow", () => {
  const { CommitTooltip } = loadInternals();
  const t = (key, params) => (params === undefined ? key : key + JSON.stringify(params));
  const tree = CommitTooltip({
    t,
    hover: {
      hash: "h1",
      status: "ready",
      x: 12,
      y: 34,
      data: {
        inHead: true,
        branches: [{ name: "main", isHead: true }, { name: "dev", isHead: false }],
        tags: ["v1.0"],
        stashes: [{ index: 0, shortName: "stash@{0}" }],
      },
    },
  });
  assert.equal(tree.props.role, "tooltip");
  assert.equal(tree.props["aria-label"], "tooltip.label");
  assert.deepEqual(plain(tree.props.style), { position: "fixed", left: 12, top: 34 });
  const text = collectElements(tree).map((element) => element.children.join("")).join(" | ");
  assert.match(text, /tooltip\.containsHead/);
  assert.match(text, /main \(tooltip\.currentBranch\)/);
  assert.match(text, /dev/);
  assert.match(text, /tooltip\.branches/);
  assert.match(text, /tooltip\.tags/);
  assert.match(text, /v1\.0/);
  assert.match(text, /tooltip\.stashes/);
  assert.match(text, /stash@\{0\}/);

  const loading = collectElements(CommitTooltip({ t, hover: { hash: "h1", status: "loading", x: 0, y: 0 } }));
  assert.ok(loading.some((element) => element.children.join("") === "tooltip.loading"));
  const failed = collectElements(CommitTooltip({ t, hover: { hash: "h1", status: "error", error: "boom", x: 0, y: 0 } }));
  assert.match(failed.map((element) => element.children.join("")).join(" | "), /boom/);
  assert.equal(CommitTooltip({ t, hover: null }), null);

  // The "+N" line only appears when something is hidden.
  const capped = collectElements(
    CommitTooltip({
      t,
      hover: {
        hash: "h1", status: "ready", x: 0, y: 0,
        data: { inHead: false, branches: Array.from({ length: 8 }, (unused, index) => ({ name: "b" + index })), tags: [], stashes: [] },
      },
    }),
  );
  assert.ok(capped.some((element) => String(element.children.join("")).includes("tooltip.overflow")));
});

test("CommitRow starts and hides the hover tooltip from pointer and focus", () => {
  const { CommitRow } = loadInternals();
  const events = [];
  const tree = CommitRow({
    t: (key) => key,
    commit: { hash: "h1", abbrev: "h1", subject: "Sub :tada:", parents: [], refs: [] },
    row: { lane: 0, edges: [], merge: false, root: false },
    laneCount: 1,
    refIndex: new Map(),
    presentation: { graphStyle: "angular", graphColours: ["#111111"], showEmoji: true, issueUrlTemplate: "", showSignature: false },
    onHoverStart: (hash, point) => events.push({ type: "start", hash, point }),
    onHoverEnd: () => events.push({ type: "end" }),
  });
  const rich = collectElements(tree).find((element) => typeof element.type === "function" && element.type.name === "RichText");
  assert.equal(rich.props.text, "Sub :tada:");
  const lanes = collectElements(tree).find((element) => typeof element.type === "function" && element.type.name === "LaneGraph");
  assert.equal(lanes.props.style, "angular");
  assert.deepEqual(Array.from(lanes.props.colours), ["#111111"]);
  tree.props.onPointerEnter({ clientX: 40, clientY: 50 });
  tree.props.onFocus({ currentTarget: { getBoundingClientRect: () => ({ left: 5, top: 10, bottom: 48 }) } });
  tree.props.onPointerLeave();
  tree.props.onBlur();
  assert.deepEqual(Array.from(events, (event) => event.type), ["start", "start", "end", "end"]);
  assert.deepEqual(plain(events[0].point), { x: 40, y: 50 });
  assert.deepEqual(plain(events[1].point), { x: 5, y: 48 }, "keyboard focus anchors under the row");
  assert.equal(events[0].hash, "h1");
});

// ── wave 5: tab-scoped shortcuts and stable file keys ───────────────────────

test("shortcutFor recognises tab-scoped shortcuts and ignores typing targets", () => {
  const { shortcutFor, isTypingTarget } = loadInternals();
  assert.equal(shortcutFor({ key: "h", ctrlKey: true }), "head");
  assert.equal(shortcutFor({ key: "H", metaKey: true }), "head");
  assert.equal(shortcutFor({ key: "r", ctrlKey: true }), "refresh");
  assert.equal(shortcutFor({ key: "f", metaKey: true }), "find");
  assert.equal(shortcutFor({ key: "h" }), null, "a bare key is not a shortcut");
  assert.equal(shortcutFor({ key: "h", ctrlKey: true, altKey: true }), null);
  assert.equal(shortcutFor({ key: "x", ctrlKey: true }), null);
  assert.equal(shortcutFor(null), null);
  // Typing targets never trigger shortcuts, even with the modifier held.
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
    assert.equal(isTypingTarget({ tagName }), true);
    assert.equal(shortcutFor({ key: "f", ctrlKey: true }, { tagName }), null);
  }
  assert.equal(isTypingTarget({ isContentEditable: true }), true);
  assert.equal(shortcutFor({ key: "f", ctrlKey: true }, { tagName: "BUTTON" }), "find");
  assert.equal(isTypingTarget(null), false);
});

test("fileRowKey is stable by path for review state and diff caching", () => {
  const { fileRowKey } = loadInternals();
  assert.equal(fileRowKey({ path: "src/a.js" }, 3), "src/a.js");
  assert.equal(fileRowKey({ path: "src/b.js" }, 9), "src/b.js");
  assert.equal(fileRowKey({ path: "" }, 3), "file:3");
  assert.equal(fileRowKey(null, 0), "file:0");
});

test("CommitList wires the HEAD scroll target, hover callbacks and presentation", () => {
  const { CommitList, layoutGraph } = loadInternals();
  const commits = [
    { hash: "a1", abbrev: "a1", subject: "One", parents: [] },
    { hash: "b1", abbrev: "b1", subject: "Two", parents: ["a1"] },
  ];
  const value = { commits, refs: [] };
  const layout = layoutGraph(commits);
  const tree = CommitList({
    t: (key) => key,
    value,
    layout,
    refIndex: new Map(),
    presentation: { graphStyle: "angular", graphColours: [], showEmoji: true, issueUrlTemplate: "", showSignature: false },
    headHash: "b1",
    scrollHeadKey: 1,
    uncommitted: null,
    indices: [0, 1],
    activeHash: "",
    onSelect() {},
    onMenu() {},
    onRefMenu() {},
    onHoverStart() {},
    onHoverEnd() {},
  });
  const rows = collectElements(tree).filter((element) => typeof element.type === "function" && element.type.name === "CommitRow");
  assert.equal(rows.length, 2);
  const headRow = rows.find((row) => row.props.commit.hash === "b1");
  assert.ok(headRow.props.rowRef !== null && typeof headRow.props.rowRef === "object", "the HEAD row carries the scroll ref");
  assert.equal(headRow.props.presentation.graphStyle, "angular");
  assert.equal(typeof rows[0].props.onHoverStart, "function");
  assert.equal(typeof rows[0].props.onHoverEnd, "function");
});

// ── wave 6: repository selection ────────────────────────────────────────────

test("repoOptions normalizes repository discovery", () => {
  const { repoOptions } = loadInternals();
  const info = repoOptions({
    workspacePath: "/ws",
    maxDepth: 2,
    truncated: true,
    repos: [
      { path: "/ws/a", name: "a", isCurrent: true },
      { path: "/ws/b", name: "", isCurrent: false },
      { path: "", name: "ignored" },
      null,
    ],
  });
  assert.equal(info.workspacePath, "/ws");
  assert.equal(info.multiple, true);
  assert.equal(info.truncated, true);
  assert.equal(info.repos.length, 2);
  assert.equal(info.repos[1].name, "b", "a missing name falls back to the basename");
  assert.deepEqual(plain(repoOptions(null)), { workspacePath: "", repos: [], multiple: false, truncated: false });
  assert.equal(repoOptions({ repos: [{ path: "/one" }] }).multiple, false);
});

test("withRepoPath adds the selected path without mutating the body", () => {
  const { withRepoPath } = loadInternals();
  const body = { sessionId: "s1" };
  assert.equal(withRepoPath(body, ""), body, "no selection keeps the body identity");
  assert.deepEqual(plain(withRepoPath(body, "/ws/a")), { sessionId: "s1", path: "/ws/a" });
  assert.deepEqual(plain(body), { sessionId: "s1" }, "the input is not mutated");
});

test("requests carry the repository path only when one is selected", () => {
  const { graphRequest, diffRequest, diffCacheKey, compareRequest } = loadInternals();
  assert.deepEqual(plain(graphRequest({ sessionId: "s1", limit: 120 })), { sessionId: "s1", limit: 120 });
  assert.deepEqual(plain(graphRequest({ sessionId: "s1", limit: 120, path: "/ws/a" })), { sessionId: "s1", limit: 120, path: "/ws/a" });
  assert.equal(diffRequest({ sessionId: "s1", scope: "commit", hash: "h1", file: "a.js" }).path, undefined);
  assert.equal(diffRequest({ sessionId: "s1", scope: "commit", hash: "h1", file: "a.js", path: "/ws/a" }).path, "/ws/a");
  assert.equal(diffCacheKey({ sessionId: "s1", scope: "commit", hash: "h1", file: "a.js", path: "/ws/a" }), "commit|h1|a.js|@/ws/a");
  assert.equal(diffCacheKey({ sessionId: "s1", scope: "commit", hash: "h1", file: "a.js" }), "commit|h1|a.js|");
  assert.deepEqual(plain(compareRequest({ sessionId: "s1", base: "b", head: "h", path: "/ws/a" })), { sessionId: "s1", base: "b", head: "h", path: "/ws/a" });
});

test("RepoLabel becomes a select when more than one repository is discovered", () => {
  const { RepoLabel, repoOptions } = loadInternals();
  const repositories = repoOptions({
    workspacePath: "/ws",
    repos: [
      { path: "/ws/a", name: "a", isCurrent: true },
      { path: "/ws/b", name: "b", isCurrent: false },
    ],
  });
  const picked = [];
  const tree = RepoLabel({
    t: (key) => key,
    repoLabel: "repo",
    repoPath: "/ws/a",
    repositories,
    value: "/ws/b",
    onChange: (path) => picked.push(path),
  });
  assert.equal(tree.type, "select");
  assert.equal(tree.props.value, "/ws/b");
  assert.equal(tree.props["aria-label"], "repo.label");
  const options = tree.children.flat();
  assert.equal(options.length, 3, "the session default plus both repositories");
  assert.equal(options[0].props.value, "");
  assert.equal(options[1].props.value, "/ws/a");
  assert.deepEqual(options[1].children, ["a (repo.current)"]);
  tree.props.onChange({ target: { value: "/ws/b" } });
  assert.deepEqual(picked, ["/ws/b"]);

  // One repository (or a failed discovery) keeps the plain label.
  const single = RepoLabel({ t: (key) => key, repoLabel: "repo", repoPath: "/ws", repositories: repoOptions({ repos: [{ path: "/ws", name: "ws" }] }) });
  assert.equal(single.type, "span");
  assert.deepEqual(single.children, ["repo"]);
  assert.equal(RepoLabel({ t: (key) => key, repoLabel: "repo", repositories: null }).type, "span");
});

// ── wave 6: review marks ────────────────────────────────────────────────────

test("reviewRequest builds read, toggle and clear bodies", () => {
  const { reviewRequest } = loadInternals();
  assert.deepEqual(plain(reviewRequest({ sessionId: "s1", action: "read", kind: "commit", base: "h", head: "h" })), {
    sessionId: "s1", action: "read", kind: "commit", base: "h", head: "h",
  });
  assert.deepEqual(plain(reviewRequest({ sessionId: "s1", action: "toggle", kind: "compare", base: "b", head: "h", file: "a.js" })), {
    sessionId: "s1", action: "toggle", kind: "compare", base: "b", head: "h", file: "a.js",
  });
  assert.equal(reviewRequest({ sessionId: "s1", action: "clear", kind: "commit", base: "h", head: "h" }).file, undefined);
  assert.equal(reviewRequest({ sessionId: "s1", action: "bogus" }).action, "read", "an unknown action falls back to read");
  assert.equal(reviewRequest({ sessionId: "s1", kind: "bogus" }).kind, "commit");
});

test("reviewStateOf and toggleReviewFile keep the host total authoritative", () => {
  const { reviewStateOf, toggleReviewFile, unreviewedPaths, isUnavailableError } = loadInternals();
  const state = reviewStateOf({ files: { "a.js": 12, "": 4, "b.js": "x" }, total: 8, reviewed: 2 });
  assert.deepEqual(plain(Object.keys(state.files)), ["a.js", "b.js"]);
  assert.equal(state.files["a.js"], 12);
  assert.equal(state.files["b.js"], 0);
  assert.equal(state.total, 8);
  assert.equal(state.reviewed, 2);

  const added = toggleReviewFile({ files: {}, total: 8, reviewed: 0 }, "a.js", 99);
  assert.deepEqual(plain(Object.keys(added.files)), ["a.js"]);
  assert.equal(added.files["a.js"], 99);
  assert.equal(added.reviewed, 1);
  assert.equal(added.total, 8);
  const removed = toggleReviewFile(added, "a.js", 100);
  assert.equal(removed.reviewed, 0);
  assert.equal(removed.total, 8);

  assert.deepEqual(plain(unreviewedPaths([{ path: "a.js" }, { path: "b.js" }, null, { path: "a.js" }], { "a.js": 1 })), ["b.js"]);
  assert.deepEqual(plain(unreviewedPaths(null, null)), []);
  assert.equal(isUnavailableError({ code: "UNAVAILABLE" }), true);
  assert.equal(isUnavailableError(new Error("boom")), false);
  assert.equal(isUnavailableError(null), false);
});

test("ReviewCheckbox toggles through its change handler", () => {
  const { ReviewCheckbox } = loadInternals();
  const toggled = [];
  const tree = ReviewCheckbox({ t: (key) => key, reviewed: true, path: "a.js", onToggle: (path) => toggled.push(path) });
  const input = collectElements(tree).find((element) => element.props.type === "checkbox");
  assert.equal(input.props.checked, true);
  assert.equal(input.props["aria-label"], "review.toggle a.js");
  input.props.onChange();
  assert.deepEqual(toggled, ["a.js"]);
  const unchecked = collectElements(ReviewCheckbox({ t: (key) => key, reviewed: false, path: "b.js", onToggle() {} })).find((element) => element.props.type === "checkbox");
  assert.equal(unchecked.props.checked, false);
});

test("ReviewBar shows progress and mark-all/clear with correct disabling", () => {
  const { ReviewBar } = loadInternals();
  const files = [{ path: "a.js" }, { path: "b.js" }];
  const marked = [];
  let cleared = 0;
  const tree = ReviewBar({
    t: (key) => key,
    review: { status: "ready", files: { "a.js": 1 }, total: 2, reviewed: 1 },
    files,
    onMarkAll: (list) => marked.push(list),
    onClearReviews: () => { cleared += 1; },
  });
  const elements = collectElements(tree);
  const progress = elements.find((element) => String(element.props.className || "").includes("dgg-review-progress"));
  assert.deepEqual(progress.children, ["review.progress"]);
  const buttons = elements.filter((element) => element.type === "button");
  assert.deepEqual(Array.from(buttons, (button) => button.children.join("")), ["review.markAll", "review.clear"]);
  assert.equal(buttons[0].props.disabled, false);
  assert.equal(buttons[1].props.disabled, false);
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.equal(marked[0], files);
  assert.equal(cleared, 1);

  const complete = collectElements(ReviewBar({ t: (key) => key, review: { status: "ready", files: { "a.js": 1, "b.js": 2 }, total: 2, reviewed: 2 }, files, onMarkAll() {}, onClearReviews() {} }));
  const completeButtons = complete.filter((element) => element.type === "button");
  assert.equal(completeButtons[0].props.disabled, true);
  const empty = collectElements(ReviewBar({ t: (key) => key, review: { status: "ready", files: {}, total: 2, reviewed: 0 }, files, onMarkAll() {}, onClearReviews() {} }));
  assert.equal(empty.filter((element) => element.type === "button")[1].props.disabled, true);
  for (const status of ["loading", "unavailable", "error", "idle"]) {
    assert.equal(ReviewBar({ t: (key) => key, review: { status }, files, onMarkAll() {}, onClearReviews() {} }), null);
  }
  assert.equal(ReviewBar({ t: (key) => key, review: null, files, onMarkAll() {}, onClearReviews() {} }), null);
});

test("FileRow dims reviewed rows and keeps the review identity separate from diffs", () => {
  const { FileRow } = loadInternals();
  const file = { path: "a.js", status: "M", added: 1, removed: 1 };
  const reviewed = FileRow({ t: (key) => key, sessionId: "s1", hash: "h1", file, cache: { current: new Map() }, reviewed: true });
  assert.ok(reviewed.props.className.includes("dgg-file-reviewed"));
  const unreviewed = FileRow({ t: (key) => key, sessionId: "s1", hash: "h1", file, cache: { current: new Map() }, reviewed: false });
  assert.ok(unreviewed.props.className.includes("dgg-file-reviewable"));
  const plainRow = FileRow({ t: (key) => key, sessionId: "s1", hash: "h1", file, cache: { current: new Map() } });
  assert.equal(plainRow.props.className, "dgg-file", "without review state the row is unchanged");
});

test("DetailView renders the review bar and per-file checkboxes when review is ready", () => {
  const { DetailView } = loadInternals();
  const files = [{ path: "src/a.js", status: "M", added: 1, removed: 1 }, { path: "src/b.js", status: "A", added: 2, removed: 0 }];
  const commit = {
    hash: "h1", abbrev: "h1", parents: [], authorName: "Ann", authorEmail: "ann@x", authorTime: 1700000000,
    committerName: "Ann", committerEmail: "ann@x", committerTime: 1700000000,
    subject: "Subject", body: "", refs: [], stats: { files: 2, insertions: 3, deletions: 1 }, files,
  };
  const toggled = [];
  const markAll = [];
  let cleared = 0;
  const common = {
    t: (key) => key, commit, refIndex: new Map(), branches: [], dirty: 0, dialog: null, run: null,
    copy: { state: "idle", text: "" }, sessionId: "s1", diffCache: { current: new Map() },
    onOpenDialog() {}, onCancelDialog() {}, onConfirmDialog() {}, onRunFetch() {}, onSelectCommit() {},
    onCopy() {}, onRefMenu() {}, dropDisabledReason: "",
    presentation: { showSignature: false, showEmoji: false, issueUrlTemplate: "", graphStyle: "rounded", graphColours: [] },
    repoPath: "/ws/a",
    review: { status: "ready", files: { "src/a.js": 5 }, total: 2, reviewed: 1 },
    onToggleReviewed: (path) => toggled.push(path),
    onMarkAll: (list) => markAll.push(list),
    onClearReviews: () => { cleared += 1; },
  };
  const tree = collectElements(DetailView(common));
  const bar = tree.find((element) => typeof element.type === "function" && element.type.name === "ReviewBar");
  assert.ok(bar, "the progress bar is rendered above the file list");
  const rows = tree.filter((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.equal(rows.length, 2);
  const reviewedRow = rows.find((row) => row.props.file.path === "src/a.js");
  const unreviewedRow = rows.find((row) => row.props.file.path === "src/b.js");
  assert.equal(reviewedRow.props.reviewed, true);
  assert.equal(reviewedRow.props.repoPath, "/ws/a");
  assert.equal(unreviewedRow.props.reviewed, false);
  const leading = unreviewedRow.props.renderLeading(unreviewedRow.props.file);
  assert.equal(leading.type.name, "ReviewCheckbox");
  assert.equal(leading.props.path, "src/b.js");
  leading.props.onToggle("src/b.js");
  assert.deepEqual(toggled, ["src/b.js"]);
  bar.props.onMarkAll(files);
  bar.props.onClearReviews();
  assert.equal(markAll[0], files);
  assert.equal(cleared, 1);

  // UNAVAILABLE hides the control entirely (no bar, no checkboxes).
  const hidden = collectElements(DetailView({ ...common, review: { status: "unavailable", files: {}, total: 0, reviewed: 0 } }));
  const hiddenBar = hidden.find((element) => typeof element.type === "function" && element.type.name === "ReviewBar");
  assert.equal(hiddenBar.type(hiddenBar.props), null, "UNAVAILABLE renders no review control");
  const hiddenRows = hidden.filter((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.ok(hiddenRows.every((row) => row.props.renderLeading === undefined));
});

test("CompareView renders the review bar and checkboxes for a comparison", () => {
  const { CompareView } = loadInternals();
  const pair = { base: "b1", head: "h1" };
  const value = {
    base: "b1", head: "h1", baseAbbrev: "b1", headAbbrev: "h1",
    stats: { files: 1, insertions: 1, deletions: 0 },
    files: [{ path: "src/a.js", status: "M", added: 1, removed: 0 }],
  };
  const tree = collectElements(CompareView({
    t: (key) => key, pair, value, status: "ready", error: null, sessionId: "s1", cache: { current: new Map() },
    repoPath: "/ws/b",
    review: { status: "ready", files: {}, total: 1, reviewed: 0 },
    onToggleReviewed() {}, onMarkAll() {}, onClearReviews() {},
    onSwap() {}, onExit() {}, onRetry() {},
  }));
  assert.ok(tree.some((element) => typeof element.type === "function" && element.type.name === "ReviewBar"));
  const row = tree.find((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.equal(row.props.reviewed, false);
  assert.equal(row.props.repoPath, "/ws/b");
  assert.equal(typeof row.props.renderLeading, "function");
});

// ── wave 7: column visibility ───────────────────────────────────────────────

test("rowMetaParts honours the column visibility", () => {
  const { rowMetaParts, DEFAULT_COLUMNS } = loadInternals();
  const commit = { hash: "abcdef1234", abbrev: "abcdef1", authorName: "Ann", authorTime: 1700000000 };
  assert.deepEqual(plain(DEFAULT_COLUMNS), { author: true, date: true, hash: true });
  const all = Array.from(rowMetaParts(commit, DEFAULT_COLUMNS, "en"));
  assert.equal(all[0], "abcdef1");
  assert.equal(all[1], "Ann");
  assert.equal(all.length, 3, "hash, author and relative date are all shown");
  assert.deepEqual(Array.from(rowMetaParts(commit, { author: false }, "en")).filter((part) => part === "Ann"), []);
  assert.equal(rowMetaParts(commit, { author: false }, "en").length, 2);
  assert.equal(rowMetaParts(commit, { date: false }, "en").length, 2);
  assert.deepEqual(Array.from(rowMetaParts(commit, { hash: false }, "en")), ["Ann", rowMetaParts(commit, {}, "en")[2]]);
  assert.deepEqual(Array.from(rowMetaParts(commit, { author: false, date: false, hash: false }, "en")), []);
  // The nested-object visibility form still works, and missing commit fields are skipped.
  assert.deepEqual(Array.from(rowMetaParts({ hash: "0123456789" }, { author: true, date: true, hash: true }, "en")), ["0123456"]);
  assert.deepEqual(Array.from(rowMetaParts(null, null, "en")), []);
});

test("Toolbar exposes the three column visibility checkboxes", () => {
  const { Toolbar } = loadInternals();
  const toggled = [];
  const props = {
    t: (key) => key,
    repoLabel: "repo",
    repoPath: "/tmp/repo",
    branchLabel: "main",
    dirty: 0,
    menuOpen: true,
    order: "date",
    columns: { author: true, date: false, hash: true },
    onToggleColumn: (key) => toggled.push(key),
    onRefresh() {}, onToggleFind() {}, onToggleFilter() {}, onOrderChange() {},
    onToggleMenu() {}, onCloseMenu() {}, onFetch() {}, onOpenRemotes() {}, onBack() {},
  };
  const tree = Toolbar(props);
  const labels = collectElements(tree).filter((element) => element.type === "label" && String(element.props.className || "").includes("dgg-menu-check"));
  assert.equal(labels.length, 3, "show author / show date / show hash");
  const boxes = collectElements(tree).filter((element) => element.props.type === "checkbox");
  assert.equal(boxes.length, 3);
  assert.deepEqual(Array.from(boxes, (box) => box.props.checked), [true, false, true]);
  boxes.forEach((box) => box.props.onChange());
  assert.deepEqual(toggled, ["author", "date", "hash"]);
});

test("CommitRow renders the five table cells and honours hidden columns", () => {
  const { CommitRow } = loadInternals();
  const commit = { hash: "h1", abbrev: "h1", subject: "Subject", parents: [], refs: ["main"], authorName: "Ann", authorTime: 1700000000 };
  const render = (visibility) => collectElements(CommitRow({
    t: (key) => key,
    commit,
    row: { lane: 0, edges: [] },
    laneCount: 1,
    refIndex: new Map(),
    metaVisibility: visibility,
  }));
  const cellsOf = (elements) => elements
    .filter((element) => String(element.props.className || "").split(" ").includes("dgg-cell"))
    .map((element) => (String(element.props.className || "").match(/dgg-cell-(graph|desc|date|author|commit)/) || [])[1]);
  assert.deepEqual(cellsOf(render(undefined)), ["graph", "desc", "date", "author", "commit"], "single-line row in header order");
  assert.deepEqual(cellsOf(render({ date: false })), ["graph", "desc", "author", "commit"]);
  assert.deepEqual(cellsOf(render({ author: false, hash: false })), ["graph", "desc", "date"]);
  const all = render(undefined);
  assert.equal(richTextOf(all.find((element) => String(element.props.className || "").includes("dgg-cell-author"))), "Ann");
  const commitCell = all.find((element) => String(element.props.className || "").includes("dgg-cell-commit"));
  assert.equal(collectElements(commitCell).filter((element) => String(element.props.className || "").includes("dgg-cell-text")).map((element) => element.children.join("")).join(""), "h1", "the hash sits in an inner ellipsizing text box");
  const desc = all.find((element) => String(element.props.className || "").includes("dgg-cell-desc"));
  const subject = collectElements(desc).find((element) => String(element.props.className || "").includes("dgg-subject"));
  assert.match(subject.props.className, /dgg-cell-text/, "the subject ellipsizes inside the description cell");
  assert.equal(subject.props.title, "Subject");
  assert.match(String(desc.props.className), /dgg-cell-desc/);
  // The chips live inline before the subject.
  const chips = collectElements(desc).find((element) => String(element.props.className || "").includes("dgg-chips-inline"));
  assert.ok(chips);
  assert.match(SOURCE, /\.dgg-cell-desc\{[^}]*min-width:80px/);
  assert.match(SOURCE, /\.dgg-cell-text\{[^}]*text-overflow:ellipsis/);
});

// ── wave 7: file tree ───────────────────────────────────────────────────────

test("buildFileTree nests directories first, compacts chains and counts files", () => {
  const { buildFileTree } = loadInternals();
  const tree = buildFileTree([
    { path: "src/a.js" }, { path: "src/b.js" }, { path: "docs/readme.md" }, { path: "root.txt" },
  ]);
  assert.equal(tree.fileCount, 4);
  assert.deepEqual(Array.from(tree.nodes, (node) => node.type + ":" + node.name), ["dir:docs", "dir:src", "file:root.txt"]);
  const src = tree.nodes[1];
  assert.deepEqual(Array.from(src.children, (node) => node.name), ["a.js", "b.js"]);
  assert.deepEqual(Array.from(tree.nodes[0].children, (node) => node.name), ["readme.md"]);

  const compacted = buildFileTree([{ path: "a/b/c/x.js" }, { path: "a/b/c/y.js" }, { path: "a/d.js" }]);
  assert.equal(compacted.nodes.length, 1);
  const a = compacted.nodes[0];
  assert.equal(a.name, "a");
  assert.deepEqual(Array.from(a.children, (node) => node.type + ":" + node.name), ["dir:b/c", "file:d.js"]);
  assert.equal(a.children[0].path, "a/b/c");
  assert.deepEqual(Array.from(a.children[0].children, (node) => node.name), ["x.js", "y.js"]);
  assert.equal(a.children[1].file.path, "a/d.js");

  assert.deepEqual(plain(buildFileTree(null)), { nodes: [], fileCount: 0 });
  assert.deepEqual(plain(buildFileTree([{ path: "" }, null])), { nodes: [], fileCount: 0 });
  const duplicates = buildFileTree([{ path: "a.js" }, { path: "a.js" }]);
  assert.equal(duplicates.fileCount, 1, "duplicate paths collapse");
  assert.equal(duplicates.nodes.length, 1);
});

test("FileTree renders collapsible directories and delegates file rows", () => {
  const { FileTree } = loadInternals();
  const nodes = [
    { type: "dir", name: "src", path: "src", children: [
      { type: "file", name: "a.js", path: "src/a.js", file: { path: "src/a.js" } },
    ] },
    { type: "file", name: "root.txt", path: "root.txt", file: { path: "root.txt" } },
  ];
  const rendered = [];
  const tree = FileTree({ t: (key) => key, nodes, renderFile: (file, path) => { rendered.push(path); return file.path; } });
  const elements = collectElements(tree);
  const dirButton = elements.find((element) => String(element.props.className || "").includes("dgg-tree-dir-head"));
  assert.equal(dirButton.props["aria-expanded"], true, "directories start expanded");
  assert.equal(dirButton.props["aria-label"], "tree.toggle src");
  assert.equal(elements.some((element) => String(element.props.className || "").includes("dgg-tree-children")), true);
  assert.deepEqual(rendered, ["src/a.js", "root.txt"]);
});

test("FileViewToggle switches between flat and tree", () => {
  const { FileViewToggle } = loadInternals();
  const changes = [];
  const tree = FileViewToggle({ t: (key) => key, value: "flat", onChange: (mode) => changes.push(mode) });
  const buttons = collectElements(tree).filter((element) => element.type === "button");
  assert.deepEqual(Array.from(buttons, (button) => button.children.join("")), ["tree.flat", "tree.tree"]);
  assert.equal(buttons[0].props["aria-pressed"], true);
  buttons[1].props.onClick();
  assert.deepEqual(changes, ["tree"]);
  const toggled = FileViewToggle({ t: (key) => key, value: "tree", onChange() {} });
  assert.equal(collectElements(toggled).filter((element) => element.type === "button")[1].props["aria-pressed"], true);
});

// ── wave 7: stash / arrow navigation ───────────────────────────────────────

test("nextIndex and neighbourHash move through the displayed order", () => {
  const { nextIndex, neighbourHash } = loadInternals();
  assert.equal(nextIndex(0, -1, 1), -1);
  assert.equal(nextIndex(3, -1, 1), 0);
  assert.equal(nextIndex(3, -1, -1), 2);
  assert.equal(nextIndex(3, 2, 1), 0, "stash navigation cycles");
  assert.equal(nextIndex(3, 0, -1), 2);
  assert.equal(nextIndex(3, 1, 1), 2);

  const commits = [{ hash: "a" }, { hash: "b" }, { hash: "c" }];
  assert.equal(neighbourHash(commits, [0, 1, 2], "b", 1), "c");
  assert.equal(neighbourHash(commits, [0, 1, 2], "b", -1), "a");
  assert.equal(neighbourHash(commits, [0, 1, 2], "a", -1), "", "no wrap above the first commit");
  assert.equal(neighbourHash(commits, [0, 1, 2], "c", 1), "", "no wrap below the last commit");
  assert.equal(neighbourHash(commits, [2, 0], "a", -1), "c", "displayed order is honoured");
  assert.equal(neighbourHash(commits, [0], "a", 1), "");
  assert.equal(neighbourHash(commits, [0, 1, 2], "zzz", 1), "");
});

test("stashHashesIn lists stash-bearing commits in display order", () => {
  const { stashHashesIn } = loadInternals();
  const commits = [{ hash: "a1" }, { hash: "b1" }, { hash: "c1" }];
  const refs = [
    { name: "refs/stash@{0}", shortName: "stash@{0}", type: "stash", hash: "b1" },
    { name: "refs/stash@{1}", shortName: "stash@{1}", type: "stash", hash: "b1" },
    { name: "refs/heads/main", shortName: "main", type: "branch", hash: "c1" },
    { name: "refs/stash@{2}", shortName: "stash@{2}", type: "stash", hash: "a1" },
  ];
  assert.deepEqual(Array.from(stashHashesIn(commits, [0, 1, 2], refs)), ["a1", "b1"]);
  assert.deepEqual(Array.from(stashHashesIn(commits, [2], refs)), []);
  assert.deepEqual(Array.from(stashHashesIn(commits, null, refs)), []);
  assert.deepEqual(Array.from(stashHashesIn(commits, [0, 1, 2], null)), []);
});

test("shortcutFor maps Ctrl/Cmd+S to the stash navigation", () => {
  const { shortcutFor } = loadInternals();
  assert.equal(shortcutFor({ key: "s", ctrlKey: true }), "stash-next");
  assert.equal(shortcutFor({ key: "S", metaKey: true }), "stash-next");
  assert.equal(shortcutFor({ key: "s", ctrlKey: true, shiftKey: true }), "stash-prev");
  assert.equal(shortcutFor({ key: "s", metaKey: true, shiftKey: true }), "stash-prev");
  assert.equal(shortcutFor({ key: "s" }), null);
  assert.equal(shortcutFor({ key: "s", ctrlKey: true }, { tagName: "INPUT" }), null, "typing targets stay guarded");
});

// ── wave 7: multi-remote push ───────────────────────────────────────────────

test("multiRemotePushItem only appears for branches and honours remotes/busy", () => {
  const { multiRemotePushItem } = loadInternals();
  const chip = { label: "dev", kind: "branch", isHead: false };
  const item = multiRemotePushItem(chip, { hasRemotes: true, busy: false })[0];
  assert.equal(item.kind, "pushToMultipleRemotes");
  assert.equal(item.labelKey, "action.pushToMultipleRemotes");
  assert.equal(item.after, "push-branch");
  assert.equal(multiRemotePushItem({ label: "v1", kind: "tag" }, { hasRemotes: true })[0], undefined);
  const gated = multiRemotePushItem(chip, { hasRemotes: false, busy: false })[0];
  assert.equal(gated.disabled, true);
  assert.equal(gated.reasonKey, "menu.noRemotes");
  const busy = multiRemotePushItem(chip, { hasRemotes: true, busy: true })[0];
  assert.equal(busy.disabled, true);
  assert.equal(busy.reasonKey, "menu.busy");
});

test("pushToMultipleRemotes arguments and dialog shape", () => {
  const { actionArguments, actionDialogSpec } = loadInternals();
  const args = actionArguments("pushToMultipleRemotes", { ref: ["origin", "backup"], extra: "dev" });
  assert.deepEqual(plain(args), { branch: "dev", remotes: ["origin", "backup"] });
  assert.deepEqual(plain(actionArguments("pushToMultipleRemotes", { ref: ["origin", ""], extra: "dev" })), { branch: "dev", remotes: ["origin"] });
  assert.deepEqual(plain(actionArguments("pushToMultipleRemotes", { ref: null, extra: "" })), {});
  const spec = actionDialogSpec("pushToMultipleRemotes", { remotes: ["origin", "backup"] });
  assert.equal(spec.remotesMany, true);
  assert.equal(spec.needs, "remote");
  assert.deepEqual(Array.from(spec.options, (option) => option.name), ["origin", "backup"]);
  assert.equal(spec.checks.length, 0, "no force checkbox in this dialog");
});

test("ActionDialog renders a remote checkbox per remote and submits the picks plus branch", () => {
  const { ActionDialog } = loadInternals();
  const confirmed = [];
  const dialog = {
    kind: "pushToMultipleRemotes",
    needs: "remote",
    options: [{ name: "origin" }, { name: "backup" }],
    checks: [],
    choices: [],
    fields: [],
    remotesMany: true,
    requestedRef: "dev",
    warnings: [],
    modeWarnings: {},
    checkWarnings: {},
    destructive: false,
    dirtySensitive: false,
  };
  const tree = ActionDialog({ t: (key) => key, dialog, dirty: 0, running: false, onCancel() {}, onConfirm: (...args) => confirmed.push(args) });
  const note = collectElements(tree).find((element) => String(element.props.className || "").includes("dgg-dialog-note"));
  assert.equal(note.children.join(""), "action.branch: dev");
  const boxes = collectElements(tree).filter((element) => element.props.type === "checkbox");
  assert.equal(boxes.length, 2, "one checkbox per remote, none for force");
  assert.deepEqual(Array.from(boxes, (box) => box.props.checked), [true, true], "all remotes start selected");
  assert.equal(boxes[0].props["aria-label"], "action.remote origin");
  // All remotes are preselected; the fake-React harness cannot re-render after a
  // deselect, so the submitted array is the initial selection.
  const run = collectElements(tree).find((element) => element.type === "button" && element.children.join("") === "action.run");
  run.props.onClick();
  assert.deepEqual(plain(confirmed[0]), ["", ["origin", "backup"], "dev"]);

  // With every remote deselected the run button is disabled.
  const empty = ActionDialog({
    t: (key) => key,
    dialog: { ...dialog, options: [] },
    dirty: 0,
    running: false,
    onCancel() {},
    onConfirm() {},
  });
  const emptyRun = collectElements(empty).find((element) => element.type === "button" && element.children.join("") === "action.run");
  assert.equal(emptyRun.props.disabled, true);
});

// ── wave 8: full-history search ─────────────────────────────────────────────

test("in-page find mode filters locally and never requests the search route", () => {
  const calls = [];
  const { findModeOf, filterCommits, FIND_SCOPE_PAGE, FIND_SCOPE_ALL, graphRequest } = loadInternals((url) => {
    calls.push(String(url));
    throw new Error("in-page find must not fetch");
  });
  const commits = [{ hash: "aaaa1111", abbrev: "aaaa111", subject: "Fix crash", authorName: "Alice", refs: ["main"] }];
  assert.equal(findModeOf(FIND_SCOPE_PAGE, "fix"), "page", "the default scope keeps in-page matching");
  assert.equal(findModeOf(undefined, "fix"), "page");
  assert.deepEqual(Array.from(filterCommits(commits, "fix").indices), [0]);
  assert.deepEqual(calls, [], "in-page matching performs no fetch");
  assert.equal(findModeOf(FIND_SCOPE_ALL, ""), "idle");
  assert.equal(findModeOf(FIND_SCOPE_ALL, "   "), "idle");
  assert.equal(findModeOf(FIND_SCOPE_ALL, "  fix  "), "search");
  // The graph request is untouched by the new scope.
  assert.equal(JSON.stringify(graphRequest({ sessionId: "s", limit: 120 })), JSON.stringify({ sessionId: "s", limit: 120 }));
});

test("searchRequest builds the exact contract body and only adds a path when selected", () => {
  const { searchRequest, SEARCH_LIMIT } = loadInternals();
  assert.equal(SEARCH_LIMIT, 50);
  const body = JSON.stringify(searchRequest({ sessionId: "session-1", query: "  fix bug  ", offset: 0 }));
  assert.equal(body, JSON.stringify({ query: "fix bug", scope: "all", limit: 50, offset: 0, sessionId: "session-1" }));
  assert.deepEqual(plain(searchRequest({ sessionId: "s", query: "x", offset: 50 })), {
    query: "x",
    scope: "all",
    limit: 50,
    offset: 50,
    sessionId: "s",
  });
  assert.equal("path" in searchRequest({ sessionId: "s", query: "x" }), false, "no path key without a repository override");
  assert.equal(plain(searchRequest({ sessionId: "s", query: "x", path: "/repo" })).path, "/repo");
  assert.equal(plain(searchRequest({ sessionId: "s", query: "x", offset: -9 })).offset, 0, "negative offsets clamp to 0");
});

test("loadSearchPage posts the search body and normalizes the contract commit shape", async () => {
  const calls = [];
  const response = {
    isRepo: true,
    query: "fix",
    scope: "all",
    commits: [
      {
        hash: "abc1234def5678901234567890123456789012",
        parents: ["p1"],
        author: { name: "Alice", email: "alice@x", date: 1700000000 },
        committer: { name: "Carol", email: "carol@x", date: "2023-11-14T22:13:20Z" },
        subject: "Fix crash",
        refs: [
          { type: "branch", name: "refs/heads/main" },
          { type: "tag", name: "v1.0" },
          { type: "remote", name: "origin/main" },
        ],
      },
    ],
    offset: 0,
    limit: 50,
    hasMore: true,
    scanned: 20000,
    capped: true,
  };
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { status: 200, json: async () => ({ ok: true, value: response }) };
  };
  const { loadSearchPage } = loadInternals(fetchImpl);
  const page = await loadSearchPage({ sessionId: "session-1", query: "  fix  ", offset: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "api/dsh-git-graph/search");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["content-type"], "application/json");
  assert.equal(calls[0].init.body, JSON.stringify({ query: "fix", scope: "all", limit: 50, offset: 0, sessionId: "session-1" }));
  assert.deepEqual(plain(page.commits[0]), {
    hash: "abc1234def5678901234567890123456789012",
    abbrev: "abc1234",
    parents: ["p1"],
    authorName: "Alice",
    authorEmail: "alice@x",
    authorTime: 1700000000,
    committerName: "Carol",
    committerEmail: "carol@x",
    committerTime: 1700000000,
    subject: "Fix crash",
    refs: ["main", "tag: v1.0", "origin/main"],
  });
  assert.equal(page.hasMore, true);
  assert.equal(page.capped, true);
  assert.equal(page.scanned, 20000);
  assert.equal(page.nextOffset, 1);

  // A selected repository travels as a path member after sessionId.
  await loadSearchPage({ sessionId: "s", query: "fix", path: "/repo" });
  assert.equal(calls[1].init.body, JSON.stringify({ query: "fix", scope: "all", limit: 50, offset: 0, sessionId: "s", path: "/repo" }));
});

test("loadSearchPage rejects with the host error envelope", async () => {
  const fetchImpl = async () => ({
    status: 200,
    json: async () => ({ ok: false, error: { code: "BAD_REQUEST", message: "query is required" } }),
  });
  const { loadSearchPage } = loadInternals(fetchImpl);
  await assert.rejects(
    () => loadSearchPage({ sessionId: "s", query: "" }),
    (error) => error.message === "query is required" && error.code === "BAD_REQUEST",
  );
});

test("SEARCH_DEBOUNCE_MS waits at least 250 ms and collapses rapid input", () => {
  const { createDebouncer, SEARCH_DEBOUNCE_MS } = loadInternals();
  assert.ok(SEARCH_DEBOUNCE_MS >= 250, "the contract requires a debounce of at least 250 ms");
  const clock = (() => {
    let nextId = 1;
    const timers = new Map();
    return {
      setTimeout(callback, delay) {
        const id = nextId;
        nextId += 1;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
      runAll() {
        const pending = Array.from(timers.values());
        timers.clear();
        for (const timer of pending) timer.callback();
      },
      delays() {
        return Array.from(timers.values(), (timer) => timer.delay);
      },
    };
  })();
  const debouncer = createDebouncer(SEARCH_DEBOUNCE_MS, clock);
  const calls = [];
  debouncer.schedule(() => calls.push("first"));
  debouncer.schedule(() => calls.push("second"));
  assert.deepEqual(calls, [], "nothing fires before the debounce elapses");
  assert.deepEqual(clock.delays(), [SEARCH_DEBOUNCE_MS], "the superseded timer is cleared");
  assert.equal(debouncer.pending(), true);
  clock.runAll();
  assert.deepEqual(calls, ["second"], "only the trailing input fires");
  assert.equal(debouncer.pending(), false);
  debouncer.schedule(() => calls.push("third"));
  debouncer.cancel();
  clock.runAll();
  assert.deepEqual(calls, ["second"], "cancel drops the pending callback");
  assert.equal(debouncer.delay(), SEARCH_DEBOUNCE_MS);
});

test("search pagination appends pages, dedupes and follows the response offset", () => {
  const { searchStateFrom, appendSearchPage } = loadInternals();
  const commit = (hash) => ({
    hash,
    parents: [],
    author: { name: "A", email: "a@x", date: 1 },
    committer: { name: "A", email: "a@x", date: 1 },
    subject: hash,
    refs: [],
  });
  const first = searchStateFrom({
    isRepo: true,
    commits: [commit("c1"), commit("c2")],
    offset: 0,
    limit: 50,
    hasMore: true,
    scanned: 100,
    capped: false,
  });
  assert.equal(first.status, "ready");
  assert.equal(first.count, 2);
  assert.equal(first.nextOffset, 2);
  assert.equal(first.loadingMore, false);
  assert.deepEqual(Array.from(first.commits, (entry) => entry.hash), ["c1", "c2"]);

  const second = appendSearchPage(first, {
    isRepo: true,
    commits: [commit("c2"), commit("c3"), commit("c4")],
    offset: 2,
    limit: 50,
    hasMore: false,
    scanned: 200,
    capped: true,
  });
  assert.deepEqual(Array.from(second.commits, (entry) => entry.hash), ["c1", "c2", "c3", "c4"], "overlapping rows are dropped");
  assert.equal(second.count, 4);
  assert.equal(second.nextOffset, 5);
  assert.equal(second.hasMore, false);
  assert.equal(second.capped, true);

  const third = appendSearchPage(second, { commits: [], offset: 5, limit: 50, hasMore: true, capped: false, scanned: 0 });
  assert.equal(third.count, 4);
  assert.equal(third.capped, true, "the scan-limit notice stays visible across pages");
  assert.equal(third.hasMore, true);
});

test("FindBar toggles the scope and keeps the in-page counter and navigation", () => {
  const { FindBar, FIND_SCOPE_PAGE, FIND_SCOPE_ALL } = loadInternals();
  const scopes = [];
  const page = collectElements(
    FindBar({
      t: (key) => key,
      scope: FIND_SCOPE_PAGE,
      query: "abc",
      total: 3,
      activeIndex: 1,
      onQuery() {},
      onScope: (scope) => scopes.push(scope),
      onNext() {},
      onPrev() {},
      onClose() {},
    }),
  );
  const radios = page.filter((element) => element.type === "input" && element.props.type === "radio");
  assert.equal(radios.length, 2);
  assert.deepEqual(radios.map((radio) => radio.props.checked), [true, false]);
  radios[1].props.onChange();
  assert.deepEqual(scopes, [FIND_SCOPE_ALL]);
  assert.ok(page.some((element) => element.props.className === "dgg-find-count"), "in-page counter stays");
  assert.deepEqual(
    page.filter((element) => element.type === "button").map((button) => button.props["aria-label"]),
    ["find.prev", "find.next", "find.close"],
    "in-page navigation stays",
  );

  const all = collectElements(
    FindBar({
      t: (key) => key,
      scope: FIND_SCOPE_ALL,
      query: "abc",
      total: 3,
      activeIndex: 1,
      onQuery() {},
      onScope() {},
      onNext() {},
      onPrev() {},
      onClose() {},
    }),
  );
  assert.deepEqual(
    all.filter((element) => element.type === "input" && element.props.type === "radio").map((radio) => radio.props.checked),
    [false, true],
  );
  assert.equal(all.some((element) => element.props.className === "dgg-find-count"), false, "full-history mode has no in-page counter");
  assert.deepEqual(all.filter((element) => element.type === "button").map((button) => button.props["aria-label"]), ["find.close"]);
});

test("SearchResults renders the count, capped notice, rows, load more and errors", () => {
  const { records } = applied();
  const zh = records.locales[0].dictionaries.zh;
  const t = (key, params) => {
    let text = typeof zh[key] === "string" ? zh[key] : key;
    for (const [name, value] of Object.entries(params ?? {})) text = text.split("{" + name + "}").join(String(value));
    return text;
  };
  const { SearchResults } = loadInternals();
  const commits = [
    { hash: "h1", abbrev: "h1", subject: "One", parents: [] },
    { hash: "h2", abbrev: "h2", subject: "Two", parents: ["h1"] },
  ];
  let loaded = 0;
  let retried = 0;
  const search = {
    status: "ready",
    error: "",
    commits,
    count: 2,
    hasMore: true,
    capped: true,
    loadingMore: false,
  };
  const tree = SearchResults({
    t,
    search,
    refIndex: new Map(),
    selectedHash: "",
    onSelect() {},
    onMenu() {},
    onRefMenu() {},
    onLoadMore: () => {
      loaded += 1;
    },
    onRetry: () => {
      retried += 1;
    },
  });
  const elements = collectElements(tree);
  const text = elements.map((element) => element.children.join("")).join(" | ");
  assert.match(text, /共 2 个结果/, "result count");
  assert.ok(elements.some((element) => element.children.join("") === "仅扫描最近 20000 个提交"), "capped notice");
  const list = elements.find((element) => typeof element.type === "function" && element.type.name === "CommitList");
  assert.ok(list, "results render through the existing commit list");
  assert.equal(list.props.value.commits.length, 2);
  assert.equal(list.props.canLoadMore, true, "hasMore enables the shared load-more footer");
  const listElements = collectElements(list.type(list.props));
  const more = listElements.find((element) => element.type === "button" && element.children.join("") === zh["toolbar.loadMore"]);
  assert.ok(more, "the load-more control is the shared 加载更多 button");
  more.props.onClick();
  assert.equal(loaded, 1);
  assert.equal(retried, 0);

  const uncapped = collectElements(SearchResults({ t, search: { ...search, capped: false }, onLoadMore() {}, onRetry() {} }));
  assert.equal(uncapped.some((element) => element.children.join("") === "仅扫描最近 20000 个提交"), false);

  const failed = collectElements(
    SearchResults({
      t,
      search: { status: "error", error: "fatal: bad revision", commits: [], count: 0, hasMore: false, capped: false, loadingMore: false },
      onRetry: () => {
        retried += 1;
      },
    }),
  );
  const alert = failed.find((element) => element.props.role === "alert");
  assert.equal(alert.children.join(""), "全量搜索失败: fatal: bad revision", "inline error message");
  const retry = failed.find((element) => element.type === "button" && element.children.join("") === zh["state.retry"]);
  retry.props.onClick();
  assert.equal(retried, 1);

  const loading = collectElements(
    SearchResults({
      t,
      search: { status: "loading", commits: [], count: 0, hasMore: false, capped: false, loadingMore: false },
      onLoadMore() {},
      onRetry() {},
    }),
  );
  assert.ok(loading.some((element) => element.children.join("") === "正在搜索全部历史…"));
});

// ── wave 8: custom branch glob patterns ─────────────────────────────────────

test("compileGlob supports the documented glob grammar", () => {
  const { compileGlob } = loadInternals();
  const cases = [
    ["*", "main", true],
    ["*", "origin/main", false],
    ["feature/*", "feature/x", true],
    ["feature/*", "feature/x/y", false],
    ["feature/**", "feature/x/y", true],
    ["feature/**", "feature/", true],
    ["?", "a", true],
    ["?", "ab", false],
    ["?", "/", false],
    ["[abc]*", "bug", true],
    ["[abc]*", "dev", false],
    ["[!abc]*", "dev", true],
    ["[!abc]*", "bug", false],
    ["release-[0-9]", "release-1", true],
    ["release-[0-9]", "release-x", false],
    ["!feature/*", "main", true],
    ["!feature/*", "feature/x", false],
    ["**/main", "origin/main", true],
    ["main", "main", true],
    ["main", "main2", false],
    ["v1.0", "v1.0", true],
    ["v1.0", "v1x0", false],
  ];
  for (const [pattern, subject, expected] of cases) {
    const matcher = compileGlob(pattern);
    assert.equal(matcher.ok, true, "pattern should compile: " + pattern);
    assert.equal(matcher.test(subject), expected, pattern + " vs " + subject);
  }
  assert.equal(compileGlob("!feature/*").negated, true);
  assert.equal(compileGlob("feature/*").negated, false);
});

test("invalid glob patterns are rejected inline and never applied", () => {
  const { compileGlob, parseGlobInput, branchFilterUnion, branchFilterOptions, BranchFilterBar } = loadInternals();
  assert.deepEqual(plain(compileGlob("[abc")), { ok: false, errorKey: "filter.globInvalid" });
  assert.deepEqual(plain(compileGlob("")), { ok: false, errorKey: "filter.globEmpty" });
  assert.deepEqual(plain(compileGlob("   ")), { ok: false, errorKey: "filter.globEmpty" });
  assert.deepEqual(plain(compileGlob("!")), { ok: false, errorKey: "filter.globEmpty" });

  const parsed = parseGlobInput("feature/*, [abc");
  assert.equal(parsed.errorKey, "filter.globInvalid", "the first invalid pattern is reported");
  assert.deepEqual(Array.from(parsed.patterns), ["feature/*", "[abc"]);
  assert.equal(parsed.matchers.length, 1, "only valid patterns are compiled");

  const options = branchFilterOptions([
    { name: "refs/heads/main", shortName: "main", type: "branch" },
    { name: "refs/heads/dev", shortName: "dev", type: "branch" },
  ]);
  assert.deepEqual(Array.from(branchFilterUnion(["main"], ["[abc"], options)), ["main"], "invalid patterns never change the selection");

  const changed = [];
  const elements = collectElements(
    BranchFilterBar({
      t: (key) => key,
      options,
      selection: null,
      globText: "feature/*, [abc",
      globError: parsed.errorKey,
      onGlob: (value) => changed.push(value),
      onToggle() {},
      onReset() {},
      onClose() {},
    }),
  );
  const input = elements.find((element) => element.type === "input" && element.props.type === "text");
  assert.ok(input, "the glob input is rendered");
  assert.equal(input.props.value, "feature/*, [abc");
  assert.equal(input.props.placeholder, "filter.globPlaceholder");
  input.props.onChange({ target: { value: "feature/*" } });
  assert.deepEqual(changed, ["feature/*"]);
  const error = elements.find((element) => String(element.props.className || "").includes("dgg-glob-error"));
  assert.equal(error.children.join(""), "filter.globInvalid", "the inline message is localized");
  assert.equal(error.props.role, "alert");
});

test("branch globs follow the documented filter semantics", () => {
  const {
    branchFilterOptions,
    branchFilterState,
    branchFilterUnion,
    branchRequestValue,
    branchRequestKey,
    NO_MATCH_BRANCH_KEY,
  } = loadInternals();
  const options = branchFilterOptions([
    { name: "refs/heads/main", shortName: "main", type: "branch", head: true },
    { name: "refs/heads/dev", shortName: "dev", type: "branch" },
    { name: "refs/heads/feature/a", shortName: "feature/a", type: "branch" },
    { name: "refs/heads/feature/b", shortName: "feature/b", type: "branch" },
    { name: "refs/heads/release/1", shortName: "release/1", type: "branch" },
  ]);
  const allNames = Array.from(options, (option) => option.name);
  const stateOf = (selection, patterns) => {
    const state = branchFilterState(selection, patterns, options);
    return { union: Array.from(state.union), noMatch: state.noMatch };
  };
  const requestOf = (selection, patterns) => branchRequestValue(branchFilterState(selection, patterns, options).union, options);

  // 1. No valid glob: exactly the previous behavior (null = every branch).
  assert.deepEqual(stateOf(null, []), { union: allNames, noMatch: false });
  assert.equal(requestOf(null, []), null);
  assert.deepEqual(Array.from(requestOf(["main", "dev"], [])), ["main", "dev"]);
  assert.deepEqual(Array.from(branchFilterUnion(["main", "dev"], [], options)), ["main", "dev"]);
  assert.deepEqual(Array.from(branchFilterUnion(["main", "dev"], null, options)), ["main", "dev"]);
  // An invalid pattern is not a valid glob: the request stays unchanged.
  assert.deepEqual(stateOf(null, ["[abc"]), { union: allNames, noMatch: false });
  assert.equal(requestOf(null, ["[abc"]), null);
  assert.deepEqual(Array.from(requestOf(["main"], ["[abc"])), ["main"]);

  // 2. Valid glob + implicit “all”: only the glob-matched branches remain.
  assert.deepEqual(stateOf(null, ["feature/*"]), { union: ["feature/a", "feature/b"], noMatch: false });
  assert.deepEqual(Array.from(requestOf(null, ["feature/*"])), ["feature/a", "feature/b"], "glob + all filters, it does not union with every branch");
  assert.equal(requestOf(null, ["feature/*"]).includes("main"), false);

  // (b) A negated glob + implicit “all”: everything except the matching branches.
  assert.deepEqual(stateOf(null, ["!feature/*"]), { union: ["main", "dev", "release/1"], noMatch: false });
  assert.deepEqual(Array.from(requestOf(null, ["!feature/*"])), ["main", "dev", "release/1"]);

  // 3. Valid glob + explicit selection: union = selected ∪ glob-matched.
  assert.deepEqual(stateOf(["main"], ["feature/*", "release/?"]), {
    union: ["main", "feature/a", "feature/b", "release/1"],
    noMatch: false,
  });
  assert.deepEqual(Array.from(requestOf(["main"], ["feature/*", "release/?"])), ["main", "feature/a", "feature/b", "release/1"]);
  // An explicit empty selection means “nothing selected”; globs still add matches.
  assert.deepEqual(stateOf([], ["feature/**"]), { union: ["feature/a", "feature/b"], noMatch: false });

  // The first graph page has not arrived yet: globs cannot be evaluated, so the
  // request stays unfiltered and the next render decides.
  assert.deepEqual(Array.from(branchFilterState(null, ["feature/*"], []).union), []);
  assert.equal(branchFilterState(null, ["feature/*"], []).noMatch, false);

  // Key semantics: "" = all branches, names = filtered, sentinel = suppressed.
  assert.equal(branchRequestKey(null, false), "");
  assert.equal(branchRequestKey(["main"], false), "main");
  assert.equal(branchRequestKey(null, true), NO_MATCH_BRANCH_KEY);
  assert.notEqual(NO_MATCH_BRANCH_KEY, "");
});

test("a zero-match glob suppresses the request and shows a localized empty state", () => {
  const {
    branchFilterOptions,
    branchFilterState,
    branchRequestValue,
    branchRequestKey,
    NO_MATCH_BRANCH_KEY,
    NoGlobMatchState,
  } = loadInternals();
  const options = branchFilterOptions([
    { name: "refs/heads/main", shortName: "main", type: "branch", head: true },
    { name: "refs/heads/dev", shortName: "dev", type: "branch" },
  ]);
  const state = branchFilterState(null, ["hotfix/*"], options);
  assert.equal(state.noMatch, true);
  assert.deepEqual(Array.from(state.union), []);
  // Without the guard the request value would be null, i.e. “every branch”.
  assert.equal(branchRequestValue(state.union, options), null);
  // …so the effect key carries the sentinel instead of the all-branches key.
  assert.equal(branchRequestKey(branchRequestValue(state.union, options), state.noMatch), NO_MATCH_BRANCH_KEY);
  // The graph effect skips the request when that sentinel is the dependency key.
  assert.match(SOURCE, /if \(branchKey === NO_MATCH_BRANCH_KEY\) return undefined;/, "the graph effect must not fetch on noMatch");

  // A subset selection is still honoured: selected ∪ (glob matches = none).
  const subset = branchFilterState(["main"], ["hotfix/*"], options);
  assert.equal(subset.noMatch, false);
  assert.deepEqual(Array.from(subset.union), ["main"]);

  // The empty state is localized (zh + en both present, zh text is the contract's).
  const { records } = applied();
  const { zh, en } = records.locales[0].dictionaries;
  assert.equal(zh["filter.noGlobMatch"], "没有分支匹配该 glob");
  assert.ok(typeof en["filter.noGlobMatch"] === "string" && en["filter.noGlobMatch"].trim() !== "");
  assert.ok(typeof zh["filter.noGlobMatchHint"] === "string" && zh["filter.noGlobMatchHint"].trim() !== "");
  assert.ok(typeof en["filter.noGlobMatchHint"] === "string" && en["filter.noGlobMatchHint"].trim() !== "");
  const t = (key) => zh[key] ?? key;
  const elements = collectElements(NoGlobMatchState({ t }));
  assert.ok(elements.some((element) => element.children.join("") === "没有分支匹配该 glob"));
  assert.ok(elements.some((element) => element.children.join("") === zh["filter.noGlobMatchHint"]));
});

test("no glob keeps the graph request byte-identical and invalid globs keep the previous request", () => {
  const { branchFilterOptions, branchFilterState, branchRequestValue, graphRequest } = loadInternals();
  const options = branchFilterOptions([
    { name: "refs/heads/main", shortName: "main", type: "branch", head: true },
    { name: "refs/heads/dev", shortName: "dev", type: "branch" },
  ]);
  const requestFor = (selection, patterns) => {
    const state = branchFilterState(selection, patterns, options);
    const branches = branchRequestValue(state.union, options);
    return graphRequest({ sessionId: "session-1", limit: 120, branches });
  };
  const today = JSON.stringify({ sessionId: "session-1", limit: 120 });
  assert.equal(JSON.stringify(requestFor(null, [])), today);
  assert.equal(JSON.stringify(requestFor(null, null)), today);
  assert.equal(JSON.stringify(requestFor(["main", "dev"], [])), today, "a full selection stays unfiltered");
  // An invalid glob is never applied: same body as the matching no-glob case.
  assert.equal(JSON.stringify(requestFor(null, ["[abc"])), JSON.stringify(requestFor(null, [])));
  assert.equal(JSON.stringify(requestFor(["main"], ["[abc"])), JSON.stringify(requestFor(["main"], [])));
  assert.equal(JSON.stringify(requestFor(["main"], ["[abc"])), JSON.stringify({ sessionId: "session-1", limit: 120, branches: ["main"] }));
});

test("globPrefillText reads customBranchGlobPatterns once and drops invalid entries", () => {
  const { globPrefillText, presentationOf } = loadInternals();
  assert.equal(globPrefillText(null), "");
  assert.equal(globPrefillText({}), "");
  assert.equal(
    globPrefillText({ customBranchGlobPatterns: [" feature/* ", "release/**", 7, "", "[bad"] }),
    "feature/*, release/**",
    "invalid patterns are not pre-filled",
  );
  // The host sends objects `[{ name, glob }]`; both shapes are accepted.
  assert.equal(
    globPrefillText({ customBranchGlobPatterns: [{ name: "feature", glob: "feature/*" }, { name: "release", glob: " release/** " }, { name: "bad", glob: "[abc" }, null] }),
    "feature/*, release/**",
    "object patterns use their glob; invalid globs are still dropped",
  );
  assert.deepEqual(
    Array.from(presentationOf({ presentation: { customBranchGlobPatterns: ["feature/*", "", 5] } }).customBranchGlobPatterns),
    ["feature/*"],
  );
});

// ── wave 8-B: working-tree comparison ──────────────────────────────────────

test("compareRequest builds the working-tree comparison body exactly", () => {
  const { compareRequest } = loadInternals();
  const working = compareRequest({ sessionId: "s1", base: "b1", working: true });
  assert.deepEqual(plain(working), { sessionId: "s1", base: "b1", working: true });
  assert.equal("head" in working, false, "the working form never sends a head");
  assert.equal("head" in compareRequest({ sessionId: "s1", base: "b1", working: true, head: "ignored" }), false);
  assert.deepEqual(plain(compareRequest({ sessionId: "s1", base: "b1", working: true, path: "/repo" })), {
    sessionId: "s1",
    base: "b1",
    working: true,
    path: "/repo",
  });
  // The classic two-commit body is unchanged.
  assert.deepEqual(plain(compareRequest({ sessionId: "s1", base: "b1", head: "h1" })), { sessionId: "s1", base: "b1", head: "h1" });
  assert.equal("working" in compareRequest({ sessionId: "s1", base: "b1", head: "h1" }), false);
});

test("diffRequest and diffCacheKey carry the working scope with the base hash", () => {
  const { diffRequest, diffCacheKey } = loadInternals();
  assert.deepEqual(plain(diffRequest({ sessionId: "s1", scope: "working", hash: "b1", file: "a.txt", status: "M" })), {
    sessionId: "s1",
    scope: "working",
    file: "a.txt",
    hash: "b1",
    status: "M",
  });
  assert.deepEqual(plain(diffRequest({ sessionId: "s1", scope: "working", hash: "b1", file: "new.txt", oldPath: "old.txt" })), {
    sessionId: "s1",
    scope: "working",
    file: "new.txt",
    hash: "b1",
    oldPath: "old.txt",
  });
  assert.equal("base" in diffRequest({ scope: "working", hash: "b1", file: "a.txt" }), false);
  assert.equal(diffCacheKey({ scope: "working", hash: "b1", file: "a.txt" }), "working|b1|a.txt|");
  assert.equal(diffCacheKey({ scope: "working", hash: "b1", file: "a.txt", path: "/repo" }), "working|b1|a.txt|@/repo");
});

test("CompareView renders the working-tree form without a head hash or swap", () => {
  const { CompareView } = loadInternals();
  const calls = [];
  const tree = CompareView({
    t: (key) => key,
    pair: { base: "base-short", head: null, working: true },
    value: {
      working: true,
      head: null,
      base: "basefullhash",
      baseAbbrev: "baseful",
      stats: { files: 1, insertions: 2, deletions: 1 },
      files: [{ status: "M", path: "a.txt", added: 2, removed: 1 }],
    },
    status: "ready",
    error: null,
    sessionId: "s1",
    cache: { current: new Map() },
    onSwap: () => calls.push("swap"),
    onExit: () => calls.push("exit"),
    onRetry: () => calls.push("retry"),
  });
  const elements = collectElements(tree);
  const text = elements.map((element) => element.children.join("")).join(" | ");
  assert.match(text, /compare\.workingTitle/, "the working form has its own title");
  assert.ok(elements.some((element) => element.children.join("") === "compare.workingTree"), "the right-hand side is labelled 工作区");
  assert.equal(
    elements.some((element) => element.type === "button" && element.props["aria-label"] === "compare.swap"),
    false,
    "there is nothing to swap in the working form",
  );
  assert.ok(elements.some((element) => element.children.join("") === "baseful"), "the commit side keeps its abbrev");
  const rows = elements.filter((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].props.scope, "working", "file diffs use the working scope");
  assert.equal(rows[0].props.hash, "basefullhash", "the working diff is keyed by the resolved base commit");
  assert.equal(rows[0].props.base, undefined);
  assert.equal(rows[0].props.head, undefined);
  const exit = elements.find((element) => element.type === "button" && element.children.join("") === "compare.exit");
  exit.props.onClick();
  assert.deepEqual(calls, ["exit"]);

  // Error and empty states keep working.
  const failed = collectElements(CompareView({ t: (key) => key, pair: { base: "b", working: true }, value: null, status: "error", error: "fatal: boom", onRetry() {} }));
  const errorState = failed.find((element) => typeof element.type === "function" && element.type.name === "ErrorState");
  assert.equal(errorState.props.message, "fatal: boom");
  const empty = collectElements(CompareView({ t: (key) => key, pair: { base: "b", working: true }, value: { working: true, files: [], stats: { files: 0, insertions: 0, deletions: 0 } }, status: "ready" }));
  assert.ok(empty.some((element) => element.children.join("") === "compare.empty"));
});

test("commitActionItems offers the working-tree comparison next to compare", () => {
  const { commitActionItems, commitMenuItems, insertMenuItems } = loadInternals();
  const commit = { hash: "h2", parents: ["h1"] };
  const items = commitActionItems(commit, { headHash: "h3", commits: [{ hash: "h3", parents: ["h2"] }, { hash: "h2", parents: ["h1"] }] });
  const compareWorking = items.find((item) => item.kind === "compareWorking");
  assert.ok(compareWorking, "the working-tree comparison item exists");
  assert.equal(compareWorking.id, "compare-working");
  assert.equal(compareWorking.labelKey, "menu.compareWorking");
  assert.equal(compareWorking.after, "compare");
  assert.equal(compareWorking.disabled, undefined);
  const busy = commitActionItems(commit, { busy: true }).find((item) => item.kind === "compareWorking");
  assert.equal(busy.disabled, true);
  assert.equal(busy.reasonKey, "menu.busy");
  const empty = commitActionItems(null, {}).find((item) => item.kind === "compareWorking");
  assert.equal(empty.disabled, true);

  // It lands directly after the existing “compare” item when that is offered.
  const base = commitMenuItems(commit, { baseHash: "h3", baseAbbrev: "h3", commits: [{ hash: "h3", parents: ["h2"] }, { hash: "h2", parents: ["h1"] }] });
  const merged = insertMenuItems(base, items);
  const ids = merged.map((item) => item.id);
  assert.equal(ids.indexOf("compare-working"), ids.indexOf("compare") + 1);
});

test("working-tree comparison wiring reaches /compare and the working diff scope", () => {
  // The harness does not render GitGraphBody, so the effect wiring is pinned at the
  // source level; the request bodies themselves are covered by compareRequest /
  // diffRequest above.
  assert.match(SOURCE, /if \(item\.kind === "compareWorking"\) \{\s*enterWorkingCompare\(target\.hash\);/);
  assert.match(SOURCE, /setCompare\(\{ base, head: null, working: true \}\)/);
  assert.match(SOURCE, /compareRequest\(\{ sessionId, base: compare\.base, head: compare\.head, working, path: selectedRepo \}\)/);
  assert.match(SOURCE, /scope: working \? "working" : "compare"/);
  assert.match(SOURCE, /onCompareWorking: headHash === "" \? undefined : \(\) => enterWorkingCompare\(headHash\)/);
  // The host has no working-tree review form, so the review scope is suppressed
  // (the reserved key is covered by reviewKey("working", …)).
  assert.match(SOURCE, /compare\.working === true\s*\n\s*\? null/);
});

test("UncommittedView offers compare-with-HEAD and disables it without a HEAD", () => {
  const { UncommittedView } = loadInternals();
  const value = { staged: [{ status: "M", path: "a.txt" }], unstaged: [], untracked: [] };
  const common = {
    t: (key) => key,
    value,
    sessionId: "s1",
    cache: { current: new Map() },
    dialog: null,
    dirty: 1,
    running: false,
    onStash() {},
    onStashUntracked() {},
    onClean() {},
    onReset() {},
    onDiscard() {},
    onCancelDialog() {},
    onConfirmDialog() {},
  };
  let compared = 0;
  const tree = collectElements(UncommittedView({ ...common, onCompareWorking: () => { compared += 1; } }));
  const button = tree.find((element) => element.type === "button" && element.children.join("") === "uncommitted.compareWorking");
  assert.ok(button, "the compare-with-HEAD control is present");
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  assert.equal(compared, 1);
  const noHead = collectElements(UncommittedView({ ...common, onCompareWorking: undefined }));
  const disabled = noHead.find((element) => element.type === "button" && element.children.join("") === "uncommitted.compareWorking");
  assert.equal(disabled.props.disabled, true, "a repository without HEAD cannot compare");
});

test("reviewKey reserves a distinct working-comparison scope", () => {
  const { reviewKey } = loadInternals();
  assert.equal(reviewKey("working", "abc1234", ""), "working|abc1234|abc1234");
  assert.equal(reviewKey("working", "abc1234", "ignored"), "working|abc1234|ignored");
  assert.equal(reviewKey("compare", "a", "b"), "compare|a|b");
  assert.equal(reviewKey("commit", "a", "a"), "commit|a|a");
  assert.notEqual(reviewKey("working", "a", ""), reviewKey("compare", "a", ""));
});

// ── wave 8-B: configurable shortcuts ───────────────────────────────────────

test("matchShortcut follows the platform-modifier rules exactly", () => {
  const { matchShortcut } = loadInternals();
  const descriptor = (over) => ({ key: "f", ctrl: false, meta: false, alt: false, shift: false, ...over });
  const event = (over) => ({ key: "f", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over });
  const cases = [
    [descriptor({ ctrl: true, meta: true }), event({ ctrlKey: true }), true, "ctrl+meta accepts Ctrl"],
    [descriptor({ ctrl: true, meta: true }), event({ metaKey: true }), true, "ctrl+meta accepts Cmd"],
    [descriptor({ ctrl: true, meta: true }), event({ ctrlKey: true, metaKey: true }), true],
    [descriptor({ ctrl: true, meta: true }), event({}), false, "ctrl+meta still needs one modifier"],
    [descriptor({ ctrl: true }), event({ ctrlKey: true }), true],
    [descriptor({ ctrl: true }), event({ metaKey: true }), false, "ctrl-only on mac must not fire"],
    [descriptor({ ctrl: true }), event({ ctrlKey: true, metaKey: true }), false, "the other modifier must be released"],
    [descriptor({ meta: true }), event({ metaKey: true }), true],
    [descriptor({ meta: true }), event({ ctrlKey: true }), false],
    [descriptor({ alt: true }), event({ altKey: true }), true],
    [descriptor({ alt: true }), event({ altKey: true, ctrlKey: true }), false, "undeclared ctrl must be released"],
    [descriptor({ shift: true }), event({ shiftKey: true }), true],
    [descriptor({ shift: false }), event({ shiftKey: true }), false, "extra Shift must not match"],
    [descriptor({ key: "F" }), event({ key: "f" }), true, "key comparison is case-insensitive"],
    [descriptor({ key: "f" }), event({ key: "g" }), false],
    [descriptor({ key: "" }), event({}), false, "UNASSIGNED never matches"],
  ];
  for (const [shortcut, keyEvent, expected, reason] of cases) {
    assert.equal(matchShortcut(shortcut, keyEvent), expected, reason || JSON.stringify({ shortcut, keyEvent }));
  }
  assert.equal(matchShortcut(null, event({})), false);
  assert.equal(matchShortcut(descriptor({}), null), false);
});

test("shortcutsOf resolves presentation shortcuts with per-action fallbacks", () => {
  const { presentationOf, shortcutsOf, normalizeShortcut, DEFAULT_SHORTCUTS, UNASSIGNED_SHORTCUT } = loadInternals();
  assert.deepEqual(plain(shortcutsOf(null)), {
    find: { ...DEFAULT_SHORTCUTS.find },
    refresh: { ...DEFAULT_SHORTCUTS.refresh },
    scrollToHead: { ...DEFAULT_SHORTCUTS.scrollToHead },
    scrollToStash: { ...DEFAULT_SHORTCUTS.scrollToStash },
    stashPrevious: { ...DEFAULT_SHORTCUTS.scrollToStash, shift: true },
  });
  const resolved = shortcutsOf({
    shortcuts: {
      find: { key: "g", ctrl: true, meta: false, alt: false, shift: false },
      refresh: { key: 7 },
      scrollToHead: { key: "" },
    },
  });
  assert.deepEqual(plain(resolved.find), { key: "g", ctrl: true, meta: false, alt: false, shift: false });
  assert.deepEqual(plain(resolved.refresh), plain(DEFAULT_SHORTCUTS.refresh), "malformed entries fall back");
  assert.deepEqual(plain(resolved.scrollToHead), plain(UNASSIGNED_SHORTCUT), "key:\"\" is a deliberate UNASSIGNED");
  assert.deepEqual(plain(resolved.scrollToStash), plain(DEFAULT_SHORTCUTS.scrollToStash), "missing entries fall back");
  assert.deepEqual(plain(resolved.stashPrevious), { ...DEFAULT_SHORTCUTS.scrollToStash, shift: true }, "previous-stash derives Shift");
  assert.equal(resolved.stashPrevious.key, resolved.scrollToStash.key, "remapping scrollToStash remaps the previous-stash shortcut");
  assert.deepEqual(plain(normalizeShortcut({ key: 5 }, DEFAULT_SHORTCUTS.find)), plain(DEFAULT_SHORTCUTS.find));
  assert.deepEqual(plain(normalizeShortcut({ key: "" }, DEFAULT_SHORTCUTS.find)), plain(UNASSIGNED_SHORTCUT));

  const presentation = presentationOf({
    presentation: {
      shortcuts: { find: { key: "g", ctrl: true, meta: false, alt: false, shift: false } },
      globalShortcuts: true,
    },
  });
  assert.equal(presentation.shortcuts.find.key, "g");
  assert.equal(presentation.shortcuts.refresh.key, "r", "unmentioned shortcuts keep the fallback");
  assert.equal(presentation.globalShortcuts, true);
  assert.equal(presentationOf({ presentation: {} }).globalShortcuts, false, "global scope defaults off");
  assert.equal(presentationOf(null).globalShortcuts, false);
});

test("shortcutFor honours remapped, CMD-only, ALT and UNASSIGNED bindings", () => {
  const { shortcutFor, shortcutsOf } = loadInternals();
  const shortcuts = shortcutsOf({
    shortcuts: {
      find: { key: "g", ctrl: true },
      refresh: { key: "r", meta: true },
      scrollToHead: { key: "y", ctrl: true, shift: true },
      scrollToStash: { key: "z", ctrl: true, alt: true },
    },
  });
  assert.equal(shortcutFor({ key: "g", ctrlKey: true }, null, shortcuts), "find");
  assert.equal(shortcutFor({ key: "G", ctrlKey: true }, null, shortcuts), "find", "keys are case-insensitive");
  assert.equal(shortcutFor({ key: "g", metaKey: true }, null, shortcuts), null, "ctrl-only binding rejects Cmd");
  assert.equal(shortcutFor({ key: "g", ctrlKey: true, shiftKey: true }, null, shortcuts), null, "extra Shift must not match");
  assert.equal(shortcutFor({ key: "r", metaKey: true }, null, shortcuts), "refresh", "CMD-only binding works on mac");
  assert.equal(shortcutFor({ key: "r", ctrlKey: true }, null, shortcuts), null, "CMD-only binding rejects Ctrl");
  assert.equal(shortcutFor({ key: "y", ctrlKey: true, shiftKey: true }, null, shortcuts), "head");
  assert.equal(shortcutFor({ key: "y", ctrlKey: true }, null, shortcuts), null);
  assert.equal(shortcutFor({ key: "z", ctrlKey: true, altKey: true }, null, shortcuts), "stash-next", "ALT combo");
  assert.equal(shortcutFor({ key: "z", ctrlKey: true, metaKey: true, altKey: true }, null, shortcuts), null, "both platform modifiers are rejected by a ctrl-only binding");
  assert.equal(shortcutFor({ key: "z", ctrlKey: true, altKey: true, shiftKey: true }, null, shortcuts), "stash-prev", "previous-stash follows the remapped key + Shift");

  // UNASSIGNED removes both stash directions while the other fallbacks stay usable.
  const noStash = shortcutsOf({ shortcuts: { scrollToStash: { key: "" } } });
  assert.equal(shortcutFor({ key: "s", ctrlKey: true }, null, noStash), null);
  assert.equal(shortcutFor({ key: "s", ctrlKey: true, shiftKey: true }, null, noStash), null);
  assert.equal(shortcutFor({ key: "f", ctrlKey: true }, null, noStash), "find", "missing entries keep the fallback");
  // The default map stays exactly today's behavior when no shortcuts are provided.
  assert.equal(shortcutFor({ key: "f", ctrlKey: true }), "find");
  assert.equal(shortcutFor({ key: "s", metaKey: true, shiftKey: true }), "stash-prev");
  assert.equal(shortcutFor({ key: "f", ctrlKey: true }, { tagName: "INPUT" }), null, "typing targets stay guarded");
});

// ── wave 8-B: Ctrl/Cmd + Up/Down parent/child navigation ───────────────────

test("parentHash, childHash and detailArrowHash implement parent/child navigation", () => {
  const { parentHash, childHash, detailArrowHash } = loadInternals();
  const merge = { hash: "m", parents: ["p1", "p2"] };
  assert.equal(parentHash(merge, false), "p1", "Ctrl/Cmd+Down opens the first parent");
  assert.equal(parentHash(merge, true), "p2", "Shift follows the next parent at a merge");
  assert.equal(parentHash({ hash: "a", parents: ["p"] }, true), "p");
  assert.equal(parentHash({ hash: "root", parents: [] }), "");
  assert.equal(parentHash(null), "");
  assert.equal(parentHash({ hash: "x", parents: "nope" }), "");

  const commits = [
    { hash: "direct", parents: ["m"] },
    { hash: "merged", parents: ["x", "m"] },
    { hash: "later", parents: ["direct"] },
  ];
  assert.equal(childHash(commits, "m", false), "direct", "prefer the first-parent (same branch) child");
  assert.equal(childHash(commits, "m", true), "merged", "Shift opens the next child in order");
  assert.equal(childHash(commits, "direct", false), "later");
  assert.equal(childHash(commits, "nobody"), "");
  assert.equal(childHash(null, "m"), "");
  assert.equal(childHash(commits, ""), "");

  const detail = { hash: "m", parents: ["p1", "p2"] };
  assert.equal(detailArrowHash({ key: "ArrowDown", ctrlKey: true }, detail, commits), "p1");
  assert.equal(detailArrowHash({ key: "ArrowDown", metaKey: true, shiftKey: true }, detail, commits), "p2");
  assert.equal(detailArrowHash({ key: "ArrowUp", ctrlKey: true }, detail, commits), "direct", "Ctrl/Cmd+Up opens the first child");
  assert.equal(detailArrowHash({ key: "ArrowUp", metaKey: true }, detail, commits), "direct");
  assert.equal(detailArrowHash({ key: "ArrowDown" }, detail, commits), "", "a bare arrow is not parent navigation");
  assert.equal(detailArrowHash({ key: "ArrowDown", ctrlKey: true, altKey: true }, detail, commits), "");
  assert.equal(detailArrowHash({ key: "ArrowLeft", ctrlKey: true }, detail, commits), "");
  assert.equal(detailArrowHash({ key: "ArrowDown", ctrlKey: true }, null, commits), "");
  assert.equal(detailArrowHash(null, detail, commits), "");
});

// ── wave 8-B: opt-in global shortcut scope ─────────────────────────────────

/** Minimal document stand-in that records capture-phase listeners. */
function createFakeDocument() {
  const listeners = [];
  return {
    activeElement: null,
    listeners,
    addEventListener(type, listener, capture) {
      listeners.push({ type, listener, capture });
    },
    removeEventListener(type, listener, capture) {
      const index = listeners.findIndex((entry) => entry.type === type && entry.listener === listener && entry.capture === capture);
      if (index !== -1) listeners.splice(index, 1);
    },
  };
}

test("global shortcut registry lets only the last mounted panel handle an event", () => {
  const { registerGlobalShortcutPanel, activeGlobalShortcutPanel, dispatchGlobalShortcut } = loadInternals();
  const calls = [];
  const disposeFirst = registerGlobalShortcutPanel((event) => {
    calls.push("first:" + event.key);
    return false;
  });
  const disposeSecond = registerGlobalShortcutPanel((event) => {
    calls.push("second:" + event.key);
    return true;
  });
  assert.equal(typeof activeGlobalShortcutPanel().handler, "function");
  assert.equal(dispatchGlobalShortcut({ key: "x", target: null }), true, "the last panel handles the event");
  assert.deepEqual(calls, ["second:x"], "only one mounted instance may handle an event");
  disposeSecond();
  assert.equal(dispatchGlobalShortcut({ key: "y", target: null }), false, "the next panel becomes active");
  assert.deepEqual(calls, ["second:x", "first:y"]);
  disposeFirst();
  assert.equal(activeGlobalShortcutPanel(), null);
  assert.equal(dispatchGlobalShortcut({ key: "z", target: null }), false);
  // Editable targets are ignored without a modifier, allowed with one.
  const seen = [];
  const dispose = registerGlobalShortcutPanel((event) => {
    seen.push(event.key);
    return true;
  });
  assert.equal(dispatchGlobalShortcut({ key: "Escape", target: { tagName: "INPUT" } }), false);
  assert.equal(dispatchGlobalShortcut({ key: "f", ctrlKey: true, target: { tagName: "INPUT" } }), true);
  assert.deepEqual(seen, ["f"]);
  dispose();
});

test("global shortcut listener is capture-phase, reference counted and cleanly removed", () => {
  const { installGlobalShortcutListener } = loadInternals();
  const doc = createFakeDocument();
  const dispatched = [];
  const dispatch = (event) => {
    dispatched.push(event.key);
    return event.key === "f";
  };
  const disposeFirst = installGlobalShortcutListener(doc, dispatch);
  assert.equal(doc.listeners.length, 1);
  assert.equal(doc.listeners[0].type, "keydown");
  assert.equal(doc.listeners[0].capture, true, "the global listener runs in the capture phase");
  const disposeSecond = installGlobalShortcutListener(doc, dispatch);
  assert.equal(doc.listeners.length, 1, "the document listener is shared and reference counted");

  const handled = {
    key: "f",
    prevented: 0,
    stopped: 0,
    preventDefault() { this.prevented += 1; },
    stopPropagation() { this.stopped += 1; },
  };
  doc.listeners[0].listener(handled);
  assert.equal(handled.prevented, 1, "handled keys preventDefault");
  assert.equal(handled.stopped, 1, "handled keys stopPropagation");
  const ignored = {
    key: "x",
    prevented: 0,
    stopped: 0,
    preventDefault() { this.prevented += 1; },
    stopPropagation() { this.stopped += 1; },
  };
  doc.listeners[0].listener(ignored);
  assert.equal(ignored.prevented, 0, "unhandled keys are left alone");
  assert.equal(ignored.stopped, 0);
  assert.deepEqual(dispatched, ["f", "x"]);

  disposeFirst();
  assert.equal(doc.listeners.length, 1, "the listener survives while another panel is registered");
  disposeSecond();
  assert.equal(doc.listeners.length, 0, "the listener is always removed on unmount");
  // Disposing twice is harmless and does not underflow the reference count.
  disposeSecond();
  assert.equal(doc.listeners.length, 0);
  // A null document (server-side evaluation) is a no-op.
  assert.equal(typeof installGlobalShortcutListener(null, dispatch), "function");
});

test("global shortcuts stay opt-in and the document listener is wired defensively", () => {
  const { presentationOf } = loadInternals();
  assert.equal(presentationOf({ presentation: {} }).globalShortcuts, false);
  assert.equal(presentationOf({ presentation: { globalShortcuts: "yes" } }).globalShortcuts, false, "only a real true enables it");
  assert.equal(presentationOf({ presentation: { globalShortcuts: true } }).globalShortcuts, true);
  // The body attaches the shared document listener only behind that flag and always
  // disposes both the panel registration and the listener.
  assert.match(SOURCE, /if \(globalShortcutsEnabled !== true\) return undefined;/);
  assert.match(SOURCE, /registerGlobalShortcutPanel\(\(event\) => \{/);
  assert.match(SOURCE, /installGlobalShortcutListener\(doc, dispatchGlobalShortcut\)/);
  assert.match(SOURCE, /disposePanel\(\);\s*disposeListener\(\);/);
});

// ── wave 8-C: presentation-driven rendering ────────────────────────────────

test("dateType and dateFormat drive the row and detail timestamps", () => {
  const { formatCommitDate, rowMetaParts, personLine, absoluteTime, relativeTime, DetailView } = loadInternals();
  const seconds = 1700000000;
  const pad = (value) => String(value).padStart(2, "0");
  const isoParts = (value) => {
    const date = new Date(value * 1000);
    const day = date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    return { day, dateTime: day + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) };
  };
  const iso = isoParts(seconds);
  assert.equal(formatCommitDate(seconds, { dateFormat: "ISO Date Only" }, "en"), iso.day);
  assert.equal(formatCommitDate(seconds, { dateFormat: "ISO Date & Time" }, "en"), iso.dateTime);
  assert.equal(formatCommitDate(seconds, { dateFormat: "Relative" }, "en"), relativeTime(seconds, "en"), "Relative reuses the existing formatter");
  assert.notEqual(formatCommitDate(seconds, { dateFormat: "Date Only" }, "en"), formatCommitDate(seconds, { dateFormat: "Date & Time" }, "en"));
  assert.equal(formatCommitDate(seconds, { dateFormat: "ISO Date & Time" }, "en"), iso.dateTime, "ISO stays on local-time components");
  assert.equal(formatCommitDate(seconds, { dateFormat: "bogus" }, "en"), "", "malformed format keeps the legacy path");
  assert.equal(formatCommitDate(seconds, {}, "en"), "");

  // dateType selects the row's timestamp; dateFormat is applied to it.
  const commit = { abbrev: "abc1234", authorName: "Ann", authorTime: seconds, committerTime: seconds + 86_400 };
  const authorSeconds = isoParts(seconds).day;
  assert.equal(rowMetaParts(commit, undefined, "en", { dateType: "Author Date", dateFormat: "ISO Date Only" })[2], authorSeconds);
  assert.equal(rowMetaParts(commit, undefined, "en", { dateType: "Commit Date", dateFormat: "ISO Date Only" })[2], isoParts(seconds + 86_400).day);
  // Missing presentation keeps today's relative row date.
  assert.equal(rowMetaParts(commit, undefined, "en")[2], relativeTime(seconds, "en"));

  // Details: configured formats replace the legacy absolute (relative) pair.
  assert.equal(personLine("Ann", "ann@x", seconds, "en", { dateFormat: "ISO Date & Time" }), "Ann <ann@x> · " + iso.dateTime);
  assert.equal(
    personLine("Ann", "ann@x", seconds, "en"),
    "Ann <ann@x> · " + absoluteTime(seconds, "en") + " (" + relativeTime(seconds, "en") + ")",
    "missing dateFormat keeps the legacy detail line",
  );

  const detailCommit = {
    hash: "h1", abbrev: "h1", parents: [], authorName: "Ann", authorEmail: "ann@x", authorTime: seconds,
    committerName: "Bob", committerEmail: "bob@x", committerTime: seconds, subject: "Fix", body: "", refs: [],
    stats: { files: 0, insertions: 0, deletions: 0 }, files: [],
  };
  const common = {
    t: (key) => key, commit: detailCommit, refIndex: new Map(), branches: [], dirty: 0, dialog: null, run: null,
    copy: { state: "idle", text: "" }, sessionId: "s1", diffCache: { current: new Map() },
    onOpenDialog() {}, onCancelDialog() {}, onConfirmDialog() {}, onRunFetch() {}, onSelectCommit() {},
    onCopy() {}, onRefMenu() {}, dropDisabledReason: "",
  };
  const presented = collectElements(DetailView({ ...common, presentation: { dateFormat: "ISO Date Only" } }));
  const presentedText = presented.map((element) => element.children.join("")).join(" | ");
  assert.match(presentedText, new RegExp(iso.day.replace(/-/g, "\\-")), "the detail shows the configured ISO date");
  const legacy = collectElements(DetailView({ ...common, presentation: undefined }));
  const legacyText = legacy.map((element) => element.children.join("")).join(" | ");
  assert.ok(legacyText.includes(relativeTime(seconds, "en")), "without presentation the legacy absolute + relative is kept");
});

test("columnVisibility seeds the default columns and malformed values stay visible", () => {
  const { columnsOf, Toolbar } = loadInternals();
  assert.deepEqual(plain(columnsOf({ columnVisibility: { Date: false, Author: true, Commit: false } })), {
    author: true,
    date: false,
    hash: false,
  });
  assert.deepEqual(plain(columnsOf(null)), { author: true, date: true, hash: true });
  assert.deepEqual(plain(columnsOf({ columnVisibility: { Date: "no", Author: 0, Commit: null } })), { author: true, date: true, hash: true });
  assert.deepEqual(plain(columnsOf({ columnVisibility: { Date: false, Author: true, Commit: true } })), { author: true, date: false, hash: true });
  // The toolbar checkboxes render the seeded visibility.
  const tree = collectElements(
    Toolbar({
      t: (key) => key,
      repoLabel: "repo",
      repoPath: "/repo",
      branchLabel: "main",
      dirty: 0,
      busy: false,
      backVisible: false,
      menuOpen: true,
      running: false,
      order: "date",
      findOpen: false,
      filterOpen: false,
      columns: columnsOf({ columnVisibility: { Date: false, Author: true, Commit: false } }),
      onToggleColumn() {}, onRefresh() {}, onToggleMenu() {}, onCloseMenu() {}, onFetch() {},
      onOpenRemotes() {}, onBack() {}, onToggleFind() {}, onToggleFilter() {}, onOrderChange() {},
    }),
  );
  const boxes = tree.filter((element) => element.props.type === "checkbox");
  assert.deepEqual(Array.from(boxes, (box) => box.props.checked), [true, false, false], "Author on, Date/Commit off");
  // Body wiring: the graph's presentation seeds the state exactly once.
  assert.match(SOURCE, /setColumns\(columnsOf\(presentation\)\)/);
  assert.match(SOURCE, /columnsInitialized\.current/);
});

test("fileViewType and compactFolders seed the file view and tree compaction", () => {
  const { fileViewOf, compactFoldersOf, buildFileTree, CompareView } = loadInternals();
  assert.equal(fileViewOf({ fileViewType: "tree" }), "tree");
  assert.equal(fileViewOf({ fileViewType: "flat" }), "flat");
  assert.equal(fileViewOf({ fileViewType: "bogus" }), "flat");
  assert.equal(fileViewOf(null), "flat");
  assert.equal(compactFoldersOf({ compactFolders: false }), false);
  assert.equal(compactFoldersOf({}), true);
  const files = [{ path: "a/b/c/x.js" }, { path: "a/b/c/y.js" }];
  assert.deepEqual(Array.from(buildFileTree(files).nodes, (node) => node.name), ["a/b/c"], "default compacts");
  const expanded = buildFileTree(files, { compact: false });
  assert.deepEqual(Array.from(expanded.nodes, (node) => node.name), ["a"]);
  assert.deepEqual(Array.from(expanded.nodes[0].children, (node) => node.name), ["b"]);
  assert.deepEqual(Array.from(expanded.nodes[0].children[0].children, (node) => node.name), ["c"]);

  const value = {
    base: "b1",
    head: "h1",
    baseAbbrev: "b1",
    headAbbrev: "h1",
    stats: { files: 1, insertions: 1, deletions: 0 },
    files: [{ status: "M", path: "a/b/c/x.js", added: 1, removed: 0 }],
  };
  const common = {
    t: (key) => key,
    pair: { base: "b1", head: "h1" },
    value,
    status: "ready",
    error: null,
    sessionId: "s1",
    cache: { current: new Map() },
    onExit() {}, onSwap() {}, onRetry() {},
  };
  const tree = collectElements(CompareView({ ...common, presentation: { fileViewType: "tree", compactFolders: false } }));
  const fileTree = tree.find((element) => typeof element.type === "function" && element.type.name === "FileTree");
  assert.ok(fileTree, "File Tree is the seeded default");
  assert.deepEqual(Array.from(fileTree.props.nodes, (node) => node.name), ["a"], "compactFolders:false expands the chain");
  const flat = collectElements(CompareView({ ...common }));
  assert.equal(flat.some((element) => typeof element.type === "function" && element.type.name === "FileTree"), false, "missing presentation stays flat");
  assert.ok(flat.some((element) => String(element.props.className || "").includes("dgg-files")));
  // DetailView uses the same helpers.
  assert.match(SOURCE, /fileViewOf\(settings\)/);
  assert.match(SOURCE, /buildFileTree\(files, \{ compact: compactFolders \}\)/);
});

test("autoCenterDetails scrolls the detail into view only when enabled", () => {
  const { autoCenterDetailsOf, scrollDetailIntoView } = loadInternals();
  assert.equal(autoCenterDetailsOf({ autoCenterDetails: true }), true);
  assert.equal(autoCenterDetailsOf({}), false);
  assert.equal(autoCenterDetailsOf(null), false);
  const calls = [];
  const node = { scrollIntoView: (options) => calls.push(options) };
  assert.equal(scrollDetailIntoView(node, true), true);
  assert.deepEqual(plain(calls), [{ block: "nearest" }]);
  assert.equal(scrollDetailIntoView(node, false), false);
  assert.equal(scrollDetailIntoView(null, true), false);
  assert.equal(scrollDetailIntoView({}, true), false);
  assert.match(SOURCE, /scrollDetailIntoView\(rootRef\.current, autoCenter\)/);
  assert.match(SOURCE, /autoCenterDetailsOf\(settings\)/);
});

test("reference labels reorder tags to the right and merge local/remote chips", () => {
  const { refLabelConfig, layoutRefChips, combineLocalAndRemoteChips, RefChips, CommitRow, DetailView } = loadInternals();
  const rawRefs = ["HEAD", "main", "origin/main", "tag: v1.0", "origin/release"];
  const normal = layoutRefChips(rawRefs, new Map(), 10, {});
  assert.deepEqual(Array.from(normal.chips, (chip) => chip.kind + ":" + chip.label), [
    "head:HEAD",
    "branch:main",
    "remote:origin/main",
    "tag:v1.0",
    "remote:origin/release",
  ]);
  assert.equal(normal.tagsOnRight, false);

  const combined = layoutRefChips(rawRefs, new Map(), 10, { combineLocalAndRemoteBranchLabels: true });
  assert.deepEqual(Array.from(combined.chips, (chip) => chip.label), ["HEAD", "main (origin/main)", "v1.0", "origin/release"]);
  assert.deepEqual(Array.from(combined.chips[1].combined), ["origin/main"]);
  assert.equal(combineLocalAndRemoteChips([{ key: "x", label: "main", kind: "branch" }]).length, 1, "nothing to merge stays untouched");

  const leftRight = layoutRefChips(rawRefs, new Map(), 10, { referenceLabelAlignment: "Branches (on the left) & Tags (on the right)" });
  assert.equal(leftRight.tagsOnRight, true);
  assert.equal(leftRight.alignedToGraph, false);
  assert.equal(leftRight.chips[leftRight.chips.length - 1].kind, "tag", "tags move to the end");
  const graphAligned = layoutRefChips(rawRefs, new Map(), 10, { referenceLabelAlignment: "Branches (aligned to the graph) & Tags (on the right)" });
  assert.equal(graphAligned.alignedToGraph, true);
  assert.equal(graphAligned.tagsOnRight, true);
  assert.equal(refLabelConfig({ referenceLabelAlignment: "bogus" }).alignment, "Normal", "unknown alignment falls back");

  // RefChips renders the tag cluster in its right-hand group and the graph inset class.
  const chips = [{ key: "b", label: "main", kind: "branch" }, { key: "t", label: "v1", kind: "tag" }];
  const rendered = collectElements(RefChips({ t: (key) => key, chips, tagsOnRight: true, alignedToGraph: true }));
  const container = rendered.find((element) => element.type === "span");
  assert.match(container.props.className, /dgg-chips-aligned/);
  const right = rendered.find((element) => element.props.className === "dgg-chips-right");
  assert.ok(right, "the tag cluster gets its own right-aligned group");
  assert.ok(right.children.flat().some((child) => String(child.props.className || "").includes("dgg-chip-tag")));
  const normalRendered = collectElements(RefChips({ t: (key) => key, chips }));
  assert.equal(normalRendered.some((element) => element.props.className === "dgg-chips-right"), false);

  // Commit rows and the detail pane receive the same layout.
  const row = CommitRow({
    t: (key) => key,
    commit: { hash: "h1", abbrev: "h1", subject: "S", parents: [], refs: rawRefs, authorName: "Ann", authorTime: 1700000000 },
    row: { lane: 0, edges: [] },
    laneCount: 1,
    refIndex: new Map(),
    presentation: { referenceLabelAlignment: "Branches (on the left) & Tags (on the right)", combineLocalAndRemoteBranchLabels: true },
  });
  const refChips = collectElements(row).find((element) => typeof element.type === "function" && element.type.name === "RefChips");
  assert.equal(refChips.props.tagsOnRight, undefined, "list rows render their chips inline before the subject");
  assert.deepEqual(Array.from(refChips.props.chips, (chip) => chip.label), ["HEAD", "main (origin/main)", "origin/release", "v1.0"], "branches first, tags last");

  const detailCommit = {
    hash: "h1", abbrev: "h1", parents: [], authorName: "Ann", authorEmail: "ann@x", authorTime: 1700000000,
    committerName: "Ann", committerEmail: "ann@x", committerTime: 1700000000, subject: "S", body: "", refs: rawRefs,
    stats: { files: 0, insertions: 0, deletions: 0 }, files: [],
  };
  const detail = collectElements(DetailView({
    t: (key) => key, commit: detailCommit, refIndex: new Map(), branches: [], dirty: 0, dialog: null, run: null,
    copy: { state: "idle", text: "" }, sessionId: "s1", diffCache: { current: new Map() },
    onOpenDialog() {}, onCancelDialog() {}, onConfirmDialog() {}, onRunFetch() {}, onSelectCommit() {},
    onCopy() {}, onRefMenu() {}, dropDisabledReason: "",
    presentation: { referenceLabelAlignment: "Branches (on the left) & Tags (on the right)", combineLocalAndRemoteBranchLabels: true },
  }));
  const detailChips = detail.find((element) => typeof element.type === "function" && element.type.name === "RefChips");
  assert.equal(detailChips.props.tagsOnRight, true);
  assert.deepEqual(Array.from(detailChips.props.chips, (chip) => chip.label), ["HEAD", "main (origin/main)", "origin/release", "v1.0"], "branches first, tags last");
});

test("muteMergeCommits and muteNonAncestors de-emphasize without filtering", () => {
  const { nonAncestorHashes, CommitRow, CommitList, layoutGraph, filterCommits } = loadInternals();
  const commits = [
    { hash: "head", abbrev: "head", subject: "Head", parents: ["parent"], refs: [] },
    { hash: "parent", abbrev: "parent", subject: "Parent", parents: ["root"], refs: [] },
    { hash: "root", abbrev: "root", subject: "Root", parents: [], refs: [] },
    { hash: "side", abbrev: "side", subject: "Side", parents: [], refs: [] },
  ];
  const muted = nonAncestorHashes(commits, "head");
  assert.deepEqual(Array.from(muted), ["side"]);
  assert.deepEqual(Array.from(nonAncestorHashes(commits, "missing")), [], "an unresolvable HEAD mutes nothing");
  assert.deepEqual(Array.from(nonAncestorHashes(commits, "")), []);
  assert.deepEqual(Array.from(nonAncestorHashes([{ hash: "a", parents: ["a"] }], "a")), [], "cycles are safe");

  const t = (key) => key;
  const merge = { hash: "m", abbrev: "m", subject: "Merge", parents: ["a", "b"], refs: [], authorName: "Ann", authorTime: 1700000000 };
  const mergeRow = CommitRow({
    t, commit: merge, row: { lane: 0, edges: [] }, laneCount: 1, refIndex: new Map(),
    presentation: { muteMergeCommits: true },
  });
  assert.match(mergeRow.props.className, /dgg-row-muted/);
  assert.match(mergeRow.props["aria-label"], /mute\.mergeCommit/);
  assert.equal(typeof mergeRow.props.onClick, "function", "a muted row stays selectable");
  const normalRow = CommitRow({
    t, commit: { ...merge, parents: ["a"] }, row: { lane: 0, edges: [] }, laneCount: 1, refIndex: new Map(),
    presentation: { muteMergeCommits: true },
  });
  assert.equal(/dgg-row-muted/.test(normalRow.props.className), false);

  const ancestorRow = CommitRow({
    t, commit: { ...commits[3] }, row: { lane: 0, edges: [] }, laneCount: 1, refIndex: new Map(),
    presentation: {}, mutedHashes: muted,
  });
  assert.match(ancestorRow.props.className, /dgg-row-muted/);
  assert.match(ancestorRow.props["aria-label"], /mute\.nonAncestor/);
  const rowForHead = CommitRow({
    t, commit: { ...commits[0] }, row: { lane: 0, edges: [] }, laneCount: 1, refIndex: new Map(),
    presentation: {}, mutedHashes: muted,
  });
  assert.equal(/dgg-row-muted/.test(rowForHead.props.className), false);

  // The list still renders every commit and find still matches muted rows.
  const layout = layoutGraph(commits);
  const list = collectElements(CommitList({
    t, value: { commits }, layout, refIndex: new Map(), presentation: { muteMergeCommits: true }, mutedHashes: muted,
    uncommitted: null, indices: [0, 1, 2, 3], activeHash: "",
    onSelect() {}, onMenu() {}, onRefMenu() {}, onLoadMore() {}, canLoadMore: false, loadingMore: false,
  }));
  const rows = list.filter((element) => typeof element.type === "function" && element.type.name === "CommitRow");
  assert.equal(rows.length, 4, "muting never hides rows");
  assert.equal(rows.find((element) => element.props.commit.hash === "side").props.mutedHashes, muted, "the list forwards the muted set");
  assert.equal(filterCommits(commits, "side").matches, 1, "find ignores muting");
});

test("custom emojiMappings override and extend the built-in shortcodes", () => {
  const { emojiTable, sanitizeEmojiMappings, richTextParts, RichText } = loadInternals();
  const presentation = {
    showEmoji: true,
    emojiMappings: {
      smile: "XX",
      party_parrot: "🦜",
      bad: 7,
      " ": "z",
      toolong: "y".repeat(80),
    },
  };
  presentation.emojiMappings["x".repeat(80)] = "oversized-shortcode";
  const table = emojiTable(presentation);
  assert.equal(table.smile, "XX", "custom mappings override built-ins");
  assert.equal(table.party_parrot, "🦜", "new shortcodes are added");
  assert.equal(table.bug, "🐛", "built-ins remain");
  assert.equal(table.bad, undefined, "non-string glyphs are dropped");
  assert.equal(table.toolong, undefined, "oversized glyphs are dropped");
  assert.equal(table["x".repeat(80)], undefined, "oversized shortcodes are dropped");
  assert.deepEqual(plain(sanitizeEmojiMappings([
    { shortcode: ":wave:", emoji: "👋" },
    { shortcode: "x".repeat(80), emoji: "y" },
    { shortcode: "ok", emoji: 5 },
    null,
  ])), { wave: "👋" }, "the host's array shape is accepted and sanitized");

  const parts = richTextParts("Party :party_parrot: :smile:", presentation);
  assert.deepEqual(Array.from(parts, (part) => part.type + ":" + part.text), ["text:Party ", "emoji:🦜", "text: ", "emoji:XX"]);
  const rendered = collectElements(RichText({ text: ":party_parrot:", presentation }));
  assert.ok(rendered.some((element) => element.children.join("") === "🦜"), "the custom glyph reaches the DOM nodes");
  assert.equal(richTextParts(":smile:", {}).length, 1, "built-ins still work without custom mappings");
});

test("missing presentation keeps every pre-wave-8 default", () => {
  const {
    presentationOf, columnsOf, fileViewOf, compactFoldersOf, autoCenterDetailsOf, refLabelConfig,
    emojiTable, rowMetaParts, relativeTime, layoutRefChips,
  } = loadInternals();
  const defaults = presentationOf(null);
  assert.equal(defaults.dateType, "Author Date");
  assert.equal(defaults.dateFormat, "");
  assert.deepEqual(plain(columnsOf(defaults)), { author: true, date: true, hash: true });
  assert.equal(fileViewOf(defaults), "flat");
  assert.equal(compactFoldersOf(defaults), true);
  assert.equal(autoCenterDetailsOf(defaults), false);
  assert.equal(refLabelConfig(defaults).combine, false);
  assert.equal(refLabelConfig(defaults).tagsOnRight, false);
  assert.equal(refLabelConfig(defaults).alignment, "Normal");
  assert.equal(defaults.muteMergeCommits, false);
  assert.equal(defaults.muteNonAncestors, false);
  assert.deepEqual(plain(defaults.emojiMappings), {});
  assert.equal(emojiTable(defaults).smile, "😄");
  const commit = { abbrev: "a1", authorName: "Ann", authorTime: 1700000000 };
  assert.equal(rowMetaParts(commit, undefined, "en", defaults)[2], relativeTime(1700000000, "en"), "the row date stays relative");
  assert.deepEqual(
    Array.from(layoutRefChips(["main", "origin/main"], new Map(), 10, defaults).chips, (chip) => chip.label),
    ["main", "origin/main"],
    "no combine and no reordering by default",
  );
  // Malformed presentation values normalize to those same defaults.
  const hostile = presentationOf({
    presentation: {
      dateFormat: 7,
      dateType: "Weird",
      columnVisibility: "no",
      fileViewType: "Tree-ish",
      compactFolders: "yes",
      autoCenterDetails: "yes",
      referenceLabelAlignment: "Sideways",
      combineLocalAndRemoteBranchLabels: "yes",
      muteMergeCommits: "yes",
      muteNonAncestors: 1,
      emojiMappings: "nope",
    },
  });
  assert.equal(hostile.dateFormat, "");
  assert.equal(hostile.dateType, "Author Date");
  assert.deepEqual(plain(hostile.columnVisibility), { Date: true, Author: true, Commit: true });
  assert.equal(hostile.fileViewType, "");
  assert.equal(hostile.compactFolders, true, "only an explicit false disables compaction");
  assert.equal(hostile.autoCenterDetails, false);
  assert.equal(hostile.referenceLabelAlignment, "Normal");
  assert.equal(hostile.combineLocalAndRemoteBranchLabels, false);
  assert.equal(hostile.muteMergeCommits, false);
  assert.equal(hostile.muteNonAncestors, false);
  assert.deepEqual(plain(hostile.emojiMappings), {});
});

// ── wave 8-C part 2: markdown / dialogs / menus / a11y / repos / pagination ──

/** Plain text of a fake-React tree (elements recurse through their children). */
function richTextOf(node) {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(richTextOf).join("");
  if (typeof node === "object" && Array.isArray(node.children)) return richTextOf(node.children);
  return "";
}

test("markdown subset renders bold/italic/code and composes with emoji and issue links", () => {
  const { richTextParts, RichText, TagDetails, DetailView } = loadInternals();
  const presentation = { markdown: true, showEmoji: true, issueUrlTemplate: "https://issues/{id}" };
  const tree = RichText({ text: "**bold** *italic* _also_ ***both*** `code *not*` :bug: #7", presentation });
  const elements = collectElements(tree);
  const tags = elements.filter((element) => typeof element.type === "string").map((element) => element.type);
  assert.deepEqual(tags, ["strong", "em", "em", "strong", "em", "code", "span", "a"], "bold, italic, italic, bold-italic, code, emoji, issue");
  assert.equal(richTextOf(tree), "bold italic also both code *not* 🐛 #7", "markers are removed, code content stays literal");
  const link = elements.find((element) => element.type === "a");
  assert.equal(link.props.href, "https://issues/7");
  const emoji = elements.find((element) => element.type === "span");
  assert.equal(emoji.props["aria-label"], ":bug:");

  // Unmatched markers stay literal.
  const literal = richTextParts("**open and *half", { markdown: true });
  assert.deepEqual(Array.from(literal, (part) => part.type + ":" + part.text), ["text:**open and *half"]);
  assert.deepEqual(Array.from(richTextParts("***", { markdown: true }), (part) => part.text), ["***"]);

  // markdown:false keeps exactly today's text handling (emoji still processed).
  const plain = richTextParts("**bold** :bug:", { showEmoji: true });
  assert.equal(plain.map((part) => part.text).join(""), "**bold** 🐛");

  // Tag messages use markdown only when enabled; otherwise they stay literal.
  const message = "**bold** :tada:";
  const tag = collectElements(TagDetails({
    t: (key) => key, name: "v1", status: "ready",
    value: { annotated: false, message }, presentation: { markdown: true, showEmoji: true }, onClose() {},
  }));
  const tagRich = tag.filter((element) => typeof element.type === "function" && element.type.name === "RichText");
  assert.equal(tagRich.length, 1);
  assert.ok(collectElements(tagRich[0].type(tagRich[0].props)).some((element) => element.type === "strong"));
  const plainTag = collectElements(TagDetails({ t: (key) => key, name: "v1", status: "ready", value: { annotated: false, message }, onClose() {} }));
  const pre = plainTag.find((element) => String(element.props.className || "") === "dgg-body");
  assert.equal(richTextOf(pre), message, "without markdown the tag message is literal text");

  // Commit subject/body flow through the same renderer.
  const commit = {
    hash: "h1", abbrev: "h1", parents: [], authorName: "Ann", authorEmail: "ann@x", authorTime: 1700000000,
    committerName: "Ann", committerEmail: "ann@x", committerTime: 1700000000,
    subject: "**Shipped**", body: "_Body_", refs: [], stats: { files: 0, insertions: 0, deletions: 0 }, files: [],
  };
  const detail = collectElements(DetailView({
    t: (key) => key, commit, refIndex: new Map(), branches: [], dirty: 0, dialog: null, run: null,
    copy: { state: "idle", text: "" }, sessionId: "s1", diffCache: { current: new Map() },
    onOpenDialog() {}, onCancelDialog() {}, onConfirmDialog() {}, onRunFetch() {}, onSelectCommit() {},
    onCopy() {}, onRefMenu() {}, dropDisabledReason: "",
    presentation: { markdown: true, showEmoji: false },
  }));
  const detailRich = detail.filter((element) => typeof element.type === "function" && element.type.name === "RichText");
  const detailRendered = detailRich.flatMap((element) => collectElements(element.type(element.props)));
  assert.ok(detailRendered.some((element) => element.type === "strong"));
  assert.ok(detailRendered.some((element) => element.type === "em"));
});

test("dialogDefaults seed all nine dialog options and stay overridable", () => {
  const { sanitizeDialogDefaults, dialogDefaultsFor, actionDialogSpec, ActionDialog } = loadInternals();
  const raw = {
    applyStash: { reinstateIndex: true },
    popStash: { reinstateIndex: true },
    merge: { noCommit: true, noFastForward: true, squashCommits: true },
    pullBranch: { noFastForward: true },
    resetCurrentBranchToCommit: { mode: "Hard" },
    resetUncommittedChanges: { mode: "Mixed" },
    stashUncommittedChanges: { includeUntracked: true },
    unknownGroup: { anything: true },
  };
  const sanitized = sanitizeDialogDefaults(raw);
  assert.deepEqual(plain(sanitized), {
    applyStash: { reinstateIndex: true },
    popStash: { reinstateIndex: true },
    merge: { noCommit: true, noFastForward: true, squashCommits: true },
    pullBranch: { noFastForward: true },
    resetCurrentBranchToCommit: { mode: "hard" },
    resetUncommittedChanges: { mode: "mixed" },
    stashUncommittedChanges: { includeUntracked: true },
  });
  assert.deepEqual(plain(sanitizeDialogDefaults({ merge: { noCommit: "yes" }, resetCurrentBranchToCommit: { mode: "bogus" } })), {}, "malformed entries fall back");
  assert.deepEqual(plain(sanitizeDialogDefaults(null)), {});

  assert.deepEqual(plain(dialogDefaultsFor("merge", sanitized)), { flags: { noCommit: true, noFastForward: true, squash: true }, mode: "" });
  assert.deepEqual(plain(dialogDefaultsFor("pullBranch", sanitized)), { flags: { noFastForward: true }, mode: "" });
  assert.deepEqual(plain(dialogDefaultsFor("resetToCommit", sanitized)), { flags: {}, mode: "hard" });
  assert.deepEqual(plain(dialogDefaultsFor("resetUncommitted", sanitized)), { flags: {}, mode: "mixed" });
  assert.deepEqual(plain(dialogDefaultsFor("stashApply", sanitized)), { flags: { reinstateIndex: true }, mode: "" });
  assert.deepEqual(plain(dialogDefaultsFor("stashPop", sanitized)), { flags: { reinstateIndex: true }, mode: "" });
  assert.deepEqual(plain(dialogDefaultsFor("stashUncommitted", sanitized)), { flags: { includeUntracked: true }, mode: "" });
  assert.deepEqual(plain(dialogDefaultsFor("stashPush", sanitized)), { flags: { includeUntracked: true }, mode: "" });
  assert.deepEqual(plain(dialogDefaultsFor("merge", {})), { flags: {}, mode: "" }, "today's defaults when absent");

  const mergeSpec = actionDialogSpec("merge", { dialogDefaults: sanitized });
  assert.deepEqual(plain(mergeSpec.defaults), { flags: { noCommit: true, noFastForward: true, squash: true }, mode: "" }, "the spec carries the defaults");
  const mergeDialog = { kind: "merge", hash: "h", requestedRef: "", preview: null, dirtySensitive: false, ...mergeSpec };
  const mergeTree = collectElements(ActionDialog({ t: (key) => key, dialog: mergeDialog, dirty: 0, running: false, onCancel() {}, onConfirm() {} }));
  const boxes = mergeTree.filter((element) => element.props.type === "checkbox");
  assert.deepEqual(Array.from(boxes, (box) => box.props.checked), [true, true, true], "No-FF / no-commit / squash pre-checked");
  assert.ok(boxes.every((box) => typeof box.props.onChange === "function"), "the reader can still override each flag");

  const resetSpec = actionDialogSpec("resetToCommit", { dialogDefaults: sanitized });
  const resetTree = collectElements(ActionDialog({
    t: (key) => key,
    dialog: { kind: "resetToCommit", hash: "h", requestedRef: "", preview: null, ...resetSpec },
    dirty: 0, running: false, onCancel() {}, onConfirm() {},
  }));
  const select = resetTree.find((element) => element.type === "select");
  assert.equal(select.props.value, "hard", "the configured reset mode is preselected");
  const optionValues = resetTree.filter((element) => element.type === "option").map((element) => element.props.value);
  assert.deepEqual(optionValues, ["soft", "mixed", "hard"]);

  // Submit still reads the (overridable) dialog state; the initial values are the defaults.
  const confirmed = [];
  const tree2 = collectElements(ActionDialog({
    t: (key) => key,
    dialog: { kind: "merge", hash: "h", requestedRef: "", preview: null, dirtySensitive: false, ...actionDialogSpec("merge", { dialogDefaults: sanitized }) },
    dirty: 0, running: false, onCancel() {}, onConfirm: (...args) => confirmed.push(args),
  }));
  const run = tree2.find((element) => element.type === "button" && element.children.join("") === "action.run");
  run.props.onClick();
  assert.deepEqual(plain(confirmed[0])[3], { noFastForward: true, noCommit: true, squash: true }, "the seeded flags are submitted and can be toggled");
});

test("contextMenuVisibility hides normalized ids while keeping menus usable", () => {
  const {
    sanitizeContextMenuVisibility, hiddenMenuIds, normalizeMenuId, visibleMenuItems,
    commitMenuItems, commitActionItems, insertMenuItems,
  } = loadInternals();
  const sanitized = sanitizeContextMenuVisibility({
    commit: { cherryPick: false, renameBranch: true, weird: "no" },
    branch: { deleteBranch: false },
    bad: 5,
  });
  assert.deepEqual(plain(sanitized), { commit: { cherryPick: false, renameBranch: true }, branch: { deleteBranch: false } });
  assert.equal(normalizeMenuId("cherry-pick"), "cherrypick");
  assert.equal(normalizeMenuId("cherryPick"), "cherrypick");
  assert.deepEqual(Array.from(hiddenMenuIds(sanitized)).sort(), ["cherrypick", "deletebranch"]);

  const items = [
    { id: "cherry-pick", kind: "cherryPick" },
    { id: "copy-hash", kind: "copyHash" },
    { id: "delete-branch", kind: "deleteBranch" },
  ];
  assert.deepEqual(Array.from(visibleMenuItems(items, sanitized), (item) => item.id), ["copy-hash", "delete-branch"], "camelCase kebab-case match; the delete guardrail stays");
  assert.equal(visibleMenuItems(items, { commit: { cherryPick: true } }).length, 3, "true is visible");
  assert.equal(visibleMenuItems(items, {}).length, 3, "absent is visible");
  assert.equal(visibleMenuItems(items, { anywhere: { notAnAction: false } }).length, 3, "unknown ids are ignored");
  const only = [{ id: "copy-hash", kind: "copyHash" }];
  assert.equal(visibleMenuItems(only, { commit: { copyHash: false } }).length, 1, "never remove the only entry");

  const blankCommit = { hash: "h1", parents: [] };
  const all = insertMenuItems(commitMenuItems(blankCommit, {}), commitActionItems(blankCommit, {}));
  const filtered = visibleMenuItems(all, { commit: { cherryPick: false } });
  assert.equal(filtered.some((item) => item.kind === "cherryPick"), false);
  assert.ok(filtered.length > 1, "the rest of the menu survives");

  assert.equal((SOURCE.match(/visibleMenuItems\(/g) || []).length >= 3, true, "the memo, commit menu and ref menu all filter");
  assert.match(SOURCE, /presentation\.contextMenuVisibility/);
});

test("enhancedAccessibility adds explicit per-file change indicators", () => {
  const { FileRow, DetailView, CompareView, fileStatusKey } = loadInternals();
  assert.equal(fileStatusKey("A"), "file.status.A");
  assert.equal(fileStatusKey("M"), "file.status.M");
  assert.equal(fileStatusKey("D"), "file.status.D");
  assert.equal(fileStatusKey("R"), "file.status.R");
  assert.equal(fileStatusKey("C"), "file.status.C");
  assert.equal(fileStatusKey("T"), "file.status.T");
  assert.equal(fileStatusKey("U"), "file.status.U");
  assert.equal(fileStatusKey("Z"), "file.status.other");
  const file = { status: "M", path: "a.txt", added: 1, removed: 0 };
  const enhanced = collectElements(FileRow({ t: (key) => key, file, cache: { current: new Map() }, enhancedAccessibility: true }));
  const label = enhanced.find((element) => String(element.props.className || "").includes("dgg-st-text"));
  assert.equal(label.children.join(""), "file.status.M", "explicit textual indicator");
  const letter = enhanced.find((element) => String(element.props.className || "").includes("dgg-st dgg-st-M"));
  assert.equal(letter.props["aria-hidden"], undefined, "the letter is exposed when enhanced");
  const plain = collectElements(FileRow({ t: (key) => key, file, cache: { current: new Map() } }));
  assert.equal(plain.some((element) => String(element.props.className || "").includes("dgg-st-text")), false);
  assert.equal(plain.find((element) => String(element.props.className || "").includes("dgg-st dgg-st-M")).props["aria-hidden"], "true");

  const commit = {
    hash: "h1", abbrev: "h1", parents: [], authorName: "Ann", authorEmail: "ann@x", authorTime: 1700000000,
    committerName: "Ann", committerEmail: "ann@x", committerTime: 1700000000, subject: "S", body: "", refs: [],
    stats: { files: 1, insertions: 1, deletions: 0 }, files: [file],
  };
  const detail = collectElements(DetailView({
    t: (key) => key, commit, refIndex: new Map(), branches: [], dirty: 0, dialog: null, run: null,
    copy: { state: "idle", text: "" }, sessionId: "s1", diffCache: { current: new Map() },
    onOpenDialog() {}, onCancelDialog() {}, onConfirmDialog() {}, onRunFetch() {}, onSelectCommit() {},
    onCopy() {}, onRefMenu() {}, dropDisabledReason: "",
    presentation: { enhancedAccessibility: true },
  }));
  const detailFileRow = detail.find((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.equal(detailFileRow.props.enhancedAccessibility, true);
  const compare = collectElements(CompareView({
    t: (key) => key, pair: { base: "b", head: "h" },
    value: { base: "b", head: "h", baseAbbrev: "b", headAbbrev: "h", stats: { files: 1, insertions: 1, deletions: 0 }, files: [file] },
    status: "ready", error: null, sessionId: "s1", cache: { current: new Map() },
    presentation: { enhancedAccessibility: true }, onExit() {}, onSwap() {}, onRetry() {},
  }));
  const compareFileRow = compare.find((element) => typeof element.type === "function" && element.type.name === "FileRow");
  assert.equal(compareFileRow.props.enhancedAccessibility, true);
  assert.match(SOURCE, /"data-dgg-enhanced-accessibility": presentation\.enhancedAccessibility === true/);
  assert.match(SOURCE, /"aria-live": "polite"/, "completed actions keep the polite live region");
});

test("repositoryDropdownOrder sorts the repository select", () => {
  const { orderedRepositories, RepoLabel } = loadInternals();
  const repos = [
    { path: "/ws/b", name: "b", isCurrent: false },
    { path: "/ws/a", name: "z", isCurrent: true },
    { path: "/x/c", name: "a", isCurrent: false },
  ];
  assert.deepEqual(Array.from(orderedRepositories(repos, "Full Path"), (repo) => repo.path), ["/ws/a", "/ws/b", "/x/c"]);
  assert.deepEqual(Array.from(orderedRepositories(repos, "Name"), (repo) => repo.path), ["/x/c", "/ws/b", "/ws/a"]);
  assert.deepEqual(Array.from(orderedRepositories(repos, "Workspace Full Path"), (repo) => repo.path), ["/ws/a", "/ws/b", "/x/c"]);
  assert.deepEqual(Array.from(orderedRepositories(repos, ""), (repo) => repo.path), ["/ws/b", "/ws/a", "/x/c"], "absent keeps today's order");
  assert.deepEqual(Array.from(orderedRepositories(repos, "bogus"), (repo) => repo.path), ["/ws/b", "/ws/a", "/x/c"], "malformed keeps today's order");
  assert.notEqual(orderedRepositories(repos, "Full Path"), repos, "returns a new array");
  assert.deepEqual(Array.from(repos, (repo) => repo.path), ["/ws/b", "/ws/a", "/x/c"], "input order is not mutated");

  const optionPaths = (order) => {
    const tree = collectElements(RepoLabel({
      t: (key) => key, repoLabel: "repo", repoPath: "/ws/a",
      repositories: { multiple: true, repos, truncated: false }, value: "", order, onChange() {},
    }));
    return tree.filter((element) => element.type === "option").map((element) => element.props.value).slice(1);
  };
  assert.deepEqual(optionPaths("Name"), ["/x/c", "/ws/b", "/ws/a"]);
  assert.deepEqual(optionPaths("Full Path"), ["/ws/a", "/ws/b", "/x/c"]);
  assert.deepEqual(optionPaths(""), ["/ws/b", "/ws/a", "/x/c"]);
  assert.match(SOURCE, /repoOrder: presentation\.repositoryDropdownOrder/);
});

test("pagination settings drive the initial load, load-more step and auto-load", () => {
  const { paginationOf, presentationOf, shouldAutoLoad, graphRequest } = loadInternals();
  assert.deepEqual(plain(paginationOf({})), { initial: 120, step: 120, auto: false });
  assert.deepEqual(plain(paginationOf({ initialLoad: 500, loadMore: 250, loadMoreAutomatically: true })), { initial: 500, step: 250, auto: true });
  assert.deepEqual(plain(paginationOf({ initialLoad: 5000, loadMore: -3 })), { initial: 2000, step: 120, auto: false }, "clamped to 1–2000 and fallback step");
  assert.deepEqual(plain(paginationOf({ initialLoad: 1.5, loadMore: "80" })), { initial: 120, step: 120, auto: false }, "non-integers fall back");

  const pres = presentationOf({ presentation: { initialLoad: 500, loadMore: 250, loadMoreAutomatically: true } });
  assert.equal(pres.initialLoad, 500);
  assert.equal(pres.loadMore, 250);
  assert.equal(pres.loadMoreAutomatically, true);
  assert.equal(JSON.stringify(graphRequest({ sessionId: "s", limit: paginationOf(pres).initial })), JSON.stringify({ sessionId: "s", limit: 500 }));
  assert.equal(paginationOf(pres).step, 250);

  assert.equal(shouldAutoLoad(0, 1000, 800, true, false), false, "disabled");
  assert.equal(shouldAutoLoad(0, 1000, 800, false, true), false, "nothing more to load");
  assert.equal(shouldAutoLoad(0, 1000, 800, true, true), false, "far from the bottom");
  assert.equal(shouldAutoLoad(260, 1000, 800, true, true), true, "within the threshold");
  assert.equal(shouldAutoLoad(0, 600, 800, true, true), true, "content shorter than the viewport still loads");
  assert.equal(shouldAutoLoad(0, 1000, 0, true, true), false, "no visible height");
  assert.equal(shouldAutoLoad(Number.NaN, Number.NaN, Number.NaN, true, true), false);
  assert.match(SOURCE, /paginationOf\(presentation\)/);
  assert.match(SOURCE, /setLimit\(pagination\.initial\)/);
  assert.match(SOURCE, /current \+ pagination\.step/);
  assert.match(SOURCE, /onScroll: handleMainScroll/);
});

test("missing presentation keeps the part-2 defaults", () => {
  const {
    presentationOf, richTextParts, dialogDefaultsFor, sanitizeDialogDefaults, visibleMenuItems,
    orderedRepositories, paginationOf, FileRow, fileStatusKey,
  } = loadInternals();
  const defaults = presentationOf(null);
  assert.equal(defaults.markdown, false);
  assert.equal(defaults.enhancedAccessibility, false);
  assert.equal(defaults.repositoryDropdownOrder, "");
  assert.equal(defaults.initialLoad, 0);
  assert.equal(defaults.loadMore, 0);
  assert.equal(defaults.loadMoreAutomatically, false);
  assert.deepEqual(plain(defaults.dialogDefaults), {});
  assert.deepEqual(plain(defaults.contextMenuVisibility), {});
  assert.deepEqual(Array.from(richTextParts("**x**", defaults), (part) => part.type + ":" + part.text), ["text:**x**"], "no markdown without the setting");
  assert.deepEqual(plain(dialogDefaultsFor("merge", defaults.dialogDefaults)), { flags: {}, mode: "" });
  assert.deepEqual(plain(sanitizeDialogDefaults(defaults.dialogDefaults)), {});
  const items = [{ id: "copy-hash", kind: "copyHash" }];
  assert.equal(visibleMenuItems(items, defaults.contextMenuVisibility).length, 1);
  assert.equal(orderedRepositories([{ path: "/b", name: "b" }, { path: "/a", name: "a" }], defaults.repositoryDropdownOrder)[0].path, "/b");
  assert.deepEqual(plain(paginationOf(defaults)), { initial: 120, step: 120, auto: false });
  const plainFile = collectElements(FileRow({ t: (key) => key, file: { status: "A", path: "a.txt" }, cache: { current: new Map() } }));
  assert.equal(plainFile.some((element) => String(element.props.className || "").includes("dgg-st-text")), false);
  assert.equal(fileStatusKey("A"), "file.status.A");
});

// ── wave 9: column widths, avatars, archive export ─────────────────────────

/** In-memory Storage stand-in for the persisted column widths. */
function createFakeStorage(initial) {
  const data = new Map(Object.entries(initial ?? {}));
  return {
    data,
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

test("column width helpers clamp, resize, reset and serialize", () => {
  const {
    COLUMN_WIDTH_DEFAULTS, COLUMN_WIDTH_RANGES, COLUMN_WIDTH_STORAGE_KEY,
    clampColumnWidth, applyColumnResize, resetColumnWidth, columnWidthVars,
    normalizeColumnWidths, readStoredColumnWidths, writeStoredColumnWidths,
  } = loadInternals();
  assert.deepEqual(plain(COLUMN_WIDTH_DEFAULTS), { date: 140, author: 100, commit: 76 });
  assert.deepEqual(plain(COLUMN_WIDTH_RANGES), { date: [48, 200], author: [64, 260], commit: [64, 220] });
  assert.equal(COLUMN_WIDTH_STORAGE_KEY, "dsh-git-graph:column-widths:v1");

  assert.equal(clampColumnWidth("date", 10), 48);
  assert.equal(clampColumnWidth("date", 500), 200);
  assert.equal(clampColumnWidth("author", 32), 64);
  assert.equal(clampColumnWidth("author", 999), 260);
  assert.equal(clampColumnWidth("commit", 10), 64);
  assert.equal(clampColumnWidth("commit", 999), 220);
  assert.equal(clampColumnWidth("commit", 100), 100);
  assert.equal(clampColumnWidth("commit", 77.6), 78, "rounded");
  assert.equal(clampColumnWidth("bogus", 100), 0);
  assert.equal(clampColumnWidth("date", Number.NaN), 140, "invalid px falls back to the default");

  assert.deepEqual(plain(applyColumnResize(COLUMN_WIDTH_DEFAULTS, "date", 50)), { date: 190, author: 100, commit: 76 });
  assert.deepEqual(plain(applyColumnResize(COLUMN_WIDTH_DEFAULTS, "commit", -100)), { date: 140, author: 100, commit: 64 }, "clamped low");
  assert.deepEqual(plain(applyColumnResize(COLUMN_WIDTH_DEFAULTS, "author", 1000)), { date: 140, author: 260, commit: 76 }, "clamped high");
  assert.deepEqual(plain(applyColumnResize(COLUMN_WIDTH_DEFAULTS, "bogus", 50)), plain(COLUMN_WIDTH_DEFAULTS));
  assert.deepEqual(plain(applyColumnResize(COLUMN_WIDTH_DEFAULTS, "date", Number.NaN)), plain(COLUMN_WIDTH_DEFAULTS));
  assert.deepEqual(plain(resetColumnWidth({ date: 123, author: 200, commit: 100 }, "author")), { date: 123, author: 100, commit: 100 });
  assert.deepEqual(plain(normalizeColumnWidths({ date: 10, author: 999999, foo: 1 })), { date: 48, author: 260, commit: 76 });
  const { graphWidthVar } = loadInternals();
  assert.deepEqual(plain(graphWidthVar(1)), { "--dgg-graph-w": "40px" });
  assert.deepEqual(plain(graphWidthVar(3)), { "--dgg-graph-w": "44px" });
  assert.deepEqual(plain(graphWidthVar(99)), { "--dgg-graph-w": "198px" }, "lanes are capped at MAX_LANES");
  assert.deepEqual(plain(graphWidthVar(0)), { "--dgg-graph-w": "40px" });
  assert.deepEqual(plain(columnWidthVars({ date: 100, author: 140, commit: 80 })), {
    "--dgg-col-date": "100px",
    "--dgg-col-author": "140px",
    "--dgg-col-commit": "80px",
  });

  // Storage: missing/unreadable/foreign data falls back to the defaults.
  assert.deepEqual(plain(readStoredColumnWidths(null)), plain(COLUMN_WIDTH_DEFAULTS));
  assert.deepEqual(plain(readStoredColumnWidths(createFakeStorage())), plain(COLUMN_WIDTH_DEFAULTS));
  assert.deepEqual(plain(readStoredColumnWidths(createFakeStorage({ [COLUMN_WIDTH_STORAGE_KEY]: "not json" }))), plain(COLUMN_WIDTH_DEFAULTS));
  assert.deepEqual(plain(readStoredColumnWidths(createFakeStorage({ [COLUMN_WIDTH_STORAGE_KEY]: "[]" }))), plain(COLUMN_WIDTH_DEFAULTS));
  assert.deepEqual(plain(readStoredColumnWidths(createFakeStorage({ [COLUMN_WIDTH_STORAGE_KEY]: JSON.stringify({ foreign: 10 }) }))), plain(COLUMN_WIDTH_DEFAULTS));
  assert.deepEqual(
    plain(readStoredColumnWidths(createFakeStorage({ [COLUMN_WIDTH_STORAGE_KEY]: JSON.stringify({ date: 5, author: 500, commit: 100, extra: 2 }) }))),
    { date: 48, author: 260, commit: 100 },
    "stored values are clamped; known columns only",
  );
  const throwing = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
  };
  assert.deepEqual(plain(readStoredColumnWidths(throwing)), plain(COLUMN_WIDTH_DEFAULTS));
  assert.equal(writeStoredColumnWidths(throwing, COLUMN_WIDTH_DEFAULTS), false);

  // Round trip.
  const storage = createFakeStorage();
  assert.equal(writeStoredColumnWidths(storage, { date: 120, author: 150, commit: 90 }), true);
  assert.deepEqual(plain(readStoredColumnWidths(storage)), { date: 120, author: 150, commit: 90 });
  assert.deepEqual(JSON.parse(storage.data.get(COLUMN_WIDTH_STORAGE_KEY)), { date: 120, author: 150, commit: 90 });
});

test("data columns are dropped from the right until the description fits", () => {
  const { fittingColumns, DESC_MIN_WIDTH, DATE_COMPACT_WIDTH, ROW_HORIZONTAL_PADDING } = loadInternals();
  assert.deepEqual({ DESC_MIN_WIDTH, DATE_COMPACT_WIDTH, ROW_HORIZONTAL_PADDING }, { DESC_MIN_WIDTH: 150, DATE_COMPACT_WIDTH: 124, ROW_HORIZONTAL_PADDING: 20 });
  const all = { author: true, date: true, hash: true };
  const widths = { date: 140, author: 100, commit: 76 };
  const graph = 40;
  // Unknown width keeps every column (first paint, tests, SSR).
  assert.deepEqual(plain(fittingColumns(all, 0, widths, graph)), all);
  assert.deepEqual(plain(fittingColumns(all, undefined, widths, graph)), all);
  // All five columns need 40 + 20 + 150 + 316 = 526px.
  assert.deepEqual(plain(fittingColumns(all, 526, widths, graph)), all);
  assert.deepEqual(plain(fittingColumns(all, 525, widths, graph)), { author: true, date: true, hash: false }, "commit goes first");
  // Date + author need 40 + 20 + 150 + 240 = 450px.
  assert.deepEqual(plain(fittingColumns(all, 450, widths, graph)), { author: true, date: true, hash: false });
  assert.deepEqual(plain(fittingColumns(all, 449, widths, graph)), { author: false, date: true, hash: false }, "then the author");
  // The compact date fits down to 40 + 20 + 150 + 124 = 334px.
  assert.deepEqual(plain(fittingColumns(all, 334, widths, graph)), { author: false, date: true, hash: false });
  assert.deepEqual(plain(fittingColumns(all, 333, widths, graph)), { author: false, date: false, hash: false }, "below that only graph + description remain");
  assert.deepEqual(plain(fittingColumns(all, 900, widths, graph)), all);
  // The actual (dragged) widths and the graph width matter, not fixed thresholds.
  assert.deepEqual(plain(fittingColumns(all, 526, { date: 200, author: 100, commit: 76 }, graph)), { author: true, date: true, hash: false }, "a wide date column hides the commit earlier");
  assert.deepEqual(plain(fittingColumns(all, 526, widths, 60)), { author: true, date: true, hash: false }, "more lanes hide the commit earlier");
  // The user's own toggles still win.
  assert.deepEqual(plain(fittingColumns({ author: false, date: true, hash: true }, 900, widths, graph)), { author: false, date: true, hash: true });
  assert.deepEqual(plain(fittingColumns({ author: true, date: true, hash: false }, 450, widths, graph)), { author: true, date: true, hash: false });
  assert.deepEqual(plain(fittingColumns(null, 900, widths, graph)), all, "missing columns fall back to the defaults");
  const input = { author: true, date: true, hash: true };
  assert.notEqual(fittingColumns(input, 900, widths, graph), input, "a new object is returned");
  // Wiring: the measured width + real column widths + graph width feed the header and both lists.
  assert.match(SOURCE, /const visibleColumns = fittingColumns\(columns, paneWidth, columnWidths, graphCellWidth\);/);
  assert.match(SOURCE, /columns: visibleColumns,\n\s*onResizeStart: startColumnResize,/);
  assert.equal(SOURCE.split("metaVisibility: visibleColumns,").length - 1, 2, "search results and the commit list both use the responsive visibility");
});

test("the date-only stage uses a compact date column", () => {
  const { isDateOnlyLayout } = loadInternals();
  assert.equal(isDateOnlyLayout({ author: false, date: true, hash: false }), true);
  assert.equal(isDateOnlyLayout({ author: true, date: true, hash: false }), false);
  assert.equal(isDateOnlyLayout({ author: false, date: false, hash: false }), false);
  assert.equal(isDateOnlyLayout(null), false, "defaults keep every column visible");
  // Wiring + compact styles: the list gets a stage class, the date column is
  // capped at 112px, chips are capped lower and the uncommitted counts fold away.
  assert.match(SOURCE, /className: "dgg-listwrap" \+ \(isDateOnlyLayout\(visibleColumns\) \? " dgg-date-only" : ""\)/);
  assert.match(SOURCE, /\.dgg-date-only \.dgg-cell-date\{flex-basis:min\(var\(--dgg-col-date, 140px\), 124px\);font-size:10\.5px\}/);
  assert.match(SOURCE, /\.dgg-date-only \.dgg-chips-inline\{max-width:52%\}/);
  assert.match(SOURCE, /\.dgg-date-only \.dgg-uncommitted-counts\{display:none\}/);
});
test("column header renders draggable handles and the list applies CSS variables", () => {
  // Exact class tokens (not a prefix regex): a header cell using `dgg-cell-description`
  // while rows use `dgg-cell-desc` silently broke the flexible description column and
  // pushed every fixed column header to the wrong x.
  const cellToken = (className) => ["graph", "desc", "date", "author", "commit"].find((name) => String(className || "").split(" ").includes("dgg-cell-" + name));
  const { ColumnHeader, columnWidthVars, COLUMN_WIDTH_DEFAULTS, GitGraphBody } = loadInternals();
  const events = [];
  const header = collectElements(ColumnHeader({
    t: (key) => key,
    columns: { date: true, author: true, hash: true },
    onResizeStart: (column) => events.push(["start", column]),
    onResizeMove: (column, delta) => events.push(["move", column, delta]),
    onResizeEnd: (column) => events.push(["end", column]),
    onReset: (column) => events.push(["reset", column]),
  }));
  const handles = header.filter((element) => String(element.props.className || "").includes("dgg-colhead-handle"));
  assert.equal(handles.length, 3, "handles only on Date/Author/Commit");
  const headerCells = header.filter((element) => String(element.props.className || "").split(" ").includes("dgg-cell"));
  assert.deepEqual(headerCells.map((element) => cellToken(element.props.className)), ["graph", "desc", "date", "author", "commit"]);
  const labelTexts = headerCells.map((element) => collectElements(element).filter((child) => String(child.props.className || "").includes("dgg-colhead-label")).map((child) => child.children.join("")).join(""));
  assert.deepEqual(labelTexts, ["column.graph", "column.description", "column.date", "column.author", "column.commit"]);
  const cellsWithHandles = headerCells.filter((element) => collectElements(element).some((child) => String(child.props.className || "").includes("dgg-colhead-handle"))).length;
  assert.equal(cellsWithHandles, 3, "the graph/description cells have no resize handle");
  assert.equal(handles[0].props.role, "separator");
  assert.equal(handles[0].props["aria-orientation"], "vertical");
  assert.equal(handles[0].props["aria-label"], "column.resize: column.date");
  assert.equal(typeof handles[0].props.onPointerDown, "function");
  assert.equal(typeof handles[0].props.onPointerMove, "function");
  assert.equal(typeof handles[0].props.onPointerUp, "function");
  handles[1].props.onDoubleClick();
  assert.deepEqual(events.at(-1), ["reset", "author"]);
  // Pointer capture is requested on pointer-down and released on pointer-up.
  const capture = [];
  handles[0].props.onPointerDown({
    preventDefault() {},
    currentTarget: { setPointerCapture: (id) => capture.push(["set", id]) },
    pointerId: 7,
    clientX: 100,
  });
  assert.deepEqual(capture, [["set", 7]]);
  assert.deepEqual(events.at(-1), ["start", "date"]);
  handles[0].props.onPointerMove({ clientX: 130 });
  assert.deepEqual(events.at(-1), ["move", "date", 30]);
  handles[0].props.onPointerUp({ currentTarget: { releasePointerCapture: (id) => capture.push(["release", id]) } });
  assert.deepEqual(capture.at(-1), ["release", 7]);
  assert.deepEqual(events.at(-1), ["end", "date"]);
  // Hidden columns remove both the header cell and its handle; Graph/Description stay.
  const hidden = collectElements(ColumnHeader({ t: (key) => key, columns: { date: true, author: false, hash: false } }));
  assert.equal(hidden.filter((element) => String(element.props.className || "").includes("dgg-colhead-handle")).length, 1);
  assert.deepEqual(hidden.filter((element) => String(element.props.className || "").split(" ").includes("dgg-cell")).map((element) => cellToken(element.props.className)), ["graph", "desc", "date"]);
  const noColumns = collectElements(ColumnHeader({ t: (key) => key, columns: { date: false, author: false, hash: false } }));
  assert.equal(noColumns.filter((element) => String(element.props.className || "").includes("dgg-colhead-handle")).length, 0);
  assert.deepEqual(noColumns.filter((element) => String(element.props.className || "").split(" ").includes("dgg-cell")).map((element) => cellToken(element.props.className)), ["graph", "desc"]);

  // The list container carries the CSS variables that header and rows share.
  const graphValue = {
    isRepo: true,
    repoPath: "/tmp/repo",
    workspacePath: "/tmp/repo",
    head: { branch: "main", hash: "h1", detached: false },
    refs: [{ name: "refs/heads/main", shortName: "main", hash: "h1", head: true }],
    commits: [
      { hash: "h1", parents: [], abbrev: "h1", authorName: "A", authorEmail: "a@e", authorTime: 1, committerName: "A", committerEmail: "a@e", committerTime: 1, subject: "one", refs: [] },
    ],
    presentation: {},
  };
  const react = createFakeReact({ states: [{ status: "ready", value: graphValue, error: null }] });
  const { GitGraphBody: Body } = loadInternals(undefined, react);
  const body = collectElements(Body({ sessionId: "session-1", t: (key) => key }));
  const listwrap = body.find((element) => String(element.props.className || "").includes("dgg-listwrap"));
  assert.deepEqual(plain(listwrap.props.style), { ...columnWidthVars(COLUMN_WIDTH_DEFAULTS), "--dgg-graph-w": "40px" }, "the list container carries the column and graph widths");
  const commitList = body.find((element) => typeof element.type === "function" && element.type.name === "CommitList");
  assert.ok(commitList, "the body renders the commit list");
  const listElements = collectElements(commitList.type(commitList.props));
  const list = listElements.find((element) => String(element.props.className || "").includes("dgg-list"));
  assert.equal(list.props.style["--dgg-graph-w"], "40px", "rows share the same graph cell width");
  const rowElements = collectElements(list).filter((element) => typeof element.type === "function" && element.type.name === "CommitRow");
  assert.equal(rowElements.length, 1, "the list renders its commit row");
  const rowCells = collectElements(rowElements[0].type(rowElements[0].props)).filter((element) => String(element.props.className || "").split(" ").includes("dgg-cell"));
  assert.deepEqual(rowCells.map((element) => cellToken(element.props.className)), ["graph", "desc", "date", "author", "commit"]);
  const headerInBody = body.find((element) => typeof element.type === "function" && element.type.name === "ColumnHeader");
  assert.ok(headerInBody, "the list renders the header");
  // The header and the rows must use the exact same cell classes, in the same order —
  // that is what makes the fixed columns line up without any manual offsets.
  const headerCellsInBody = collectElements(headerInBody.type(headerInBody.props)).filter((element) => String(element.props.className || "").split(" ").includes("dgg-cell"));
  assert.deepEqual(headerCellsInBody.map((element) => cellToken(element.props.className)), rowCells.map((element) => cellToken(element.props.className)), "header and row cells agree on every column class");
  assert.equal(typeof headerInBody.props.onResizeMove, "function");
  assert.match(SOURCE, /touch-action:none/);
  assert.match(SOURCE, /columnWidthVars\(columnWidths\)/);
  assert.match(SOURCE, /\.dgg-colhead\{[^}]*position:sticky/, "the header sticks to the top of the scrolling list");
  assert.match(SOURCE, /readStoredColumnWidths\(safeClientStorage\(\)\)/);
  assert.match(SOURCE, /writeStoredColumnWidths\(safeClientStorage\(\), columnWidthsRef\.current\)/);
});

test("avatars render when enabled and fall back to initialed circles", () => {
  const { Avatar, CommitRow, DetailView, avatarInitials, avatarHue, presentationOf } = loadInternals();
  assert.equal(avatarInitials("Ann Lee", "ann@x"), "AL");
  assert.equal(avatarInitials("ann", "ann@x"), "A", "a single-word name uses one letter");
  assert.equal(avatarInitials("", "alice@x"), "A");
  assert.equal(avatarInitials("", ""), "?");
  assert.equal(avatarHue("Ann@X"), avatarHue("ann@x"), "hue is deterministic and case-insensitive");
  assert.ok(avatarHue("ann@x") >= 0 && avatarHue("ann@x") < 360);
  assert.notEqual(avatarHue("ann@x"), avatarHue("bob@x"));

  const img = Avatar({ name: "Ann Lee", email: "ann@x", url: "https://secure.gravatar.com/avatar/x?s=64&d=identicon", size: 22 });
  assert.equal(img.type, "img");
  assert.equal(img.props.className, "dgg-avatar dgg-avatar-img");
  assert.equal(img.props.src, "https://secure.gravatar.com/avatar/x?s=64&d=identicon");
  assert.equal(img.props.alt, "AL");
  assert.equal(img.props.referrerPolicy, "no-referrer");
  assert.equal(img.props.loading, "lazy");
  assert.equal(img.props.width, 22);
  assert.equal(img.props.height, 22);
  assert.equal(typeof img.props.onError, "function");

  const fallback = Avatar({ name: "Ann Lee", email: "ann@x", url: "", size: 24 });
  assert.equal(fallback.type, "span");
  assert.equal(fallback.props.className, "dgg-avatar dgg-avatar-fallback");
  assert.equal(fallback.props.role, "img");
  assert.equal(fallback.props["aria-label"], "AL");
  assert.equal(fallback.children.join(""), "AL");
  assert.match(fallback.props.style.filter, /^hue-rotate\(\d+deg\)$/);
  assert.equal(fallback.props.style.width, "24px");

  const react = createFakeReact({ states: [true] });
  const failedAvatar = loadInternals(undefined, react).Avatar;
  const failed = failedAvatar({ name: "Ann Lee", email: "ann@x", url: "https://example.test/a.png" });
  assert.equal(failed.type, "span", "onError falls back to the initials circle");
  assert.equal(failed.children.join(""), "AL");

  const commit = { hash: "h1", abbrev: "h1", subject: "S", parents: [], refs: [], authorName: "Ann Lee", authorEmail: "ann@x", authorAvatar: "https://example.test/a.png", authorTime: 1700000000 };
  const withAvatar = collectElements(CommitRow({ t: (key) => key, commit, row: { lane: 0, edges: [] }, laneCount: 1, refIndex: new Map(), presentation: { avatars: true } }));
  const avatarElement = withAvatar.find((element) => typeof element.type === "function" && element.type.name === "Avatar");
  assert.ok(avatarElement, "the commit row shows an avatar when enabled");
  assert.equal(avatarElement.props.url, "https://example.test/a.png");
  assert.equal(avatarElement.props.email, "ann@x");
  assert.equal(avatarElement.props.size, 20, "the row avatar sits in the Author cell");
  const withoutAvatar = collectElements(CommitRow({ t: (key) => key, commit, row: { lane: 0, edges: [] }, laneCount: 1, refIndex: new Map(), presentation: { avatars: false } }));
  assert.equal(withoutAvatar.some((element) => typeof element.type === "function" && element.type.name === "Avatar"), false, "disabled keeps today's markup");

  const detailCommit = {
    hash: "h1", abbrev: "h1", parents: [], authorName: "Ann Lee", authorEmail: "ann@x", authorTime: 1700000000,
    authorAvatar: "https://example.test/a.png", committerName: "Ann Lee", committerEmail: "ann@x", committerTime: 1700000000,
    subject: "S", body: "", refs: [], stats: { files: 0, insertions: 0, deletions: 0 }, files: [],
  };
  const common = {
    t: (key) => key, commit: detailCommit, refIndex: new Map(), branches: [], dirty: 0, dialog: null, run: null,
    copy: { state: "idle", text: "" }, sessionId: "s1", diffCache: { current: new Map() },
    onOpenDialog() {}, onCancelDialog() {}, onConfirmDialog() {}, onRunFetch() {}, onSelectCommit() {},
    onCopy() {}, onRefMenu() {}, dropDisabledReason: "",
  };
  const detail = collectElements(DetailView({ ...common, presentation: { avatars: true } }));
  assert.ok(detail.some((element) => typeof element.type === "function" && element.type.name === "Avatar"), "the detail header shows an avatar");
  const plainDetail = collectElements(DetailView({ ...common, presentation: { avatars: false } }));
  assert.equal(plainDetail.some((element) => typeof element.type === "function" && element.type.name === "Avatar"), false);

  assert.equal(presentationOf(null).avatars, false);
  assert.equal(presentationOf({ presentation: { avatars: true } }).avatars, true);
});

test("archive request, dialog result, errors and menu wiring", () => {
  const { archiveRequest, formatBytes, ArchiveDialog, archiveRefItem } = loadInternals();
  assert.equal(JSON.stringify(archiveRequest({ sessionId: "s1", ref: "h1", format: "zip" })), JSON.stringify({ sessionId: "s1", ref: "h1", format: "zip" }));
  assert.equal(JSON.stringify(archiveRequest({ sessionId: "s1", ref: " main ", format: "tar.gz" })), JSON.stringify({ sessionId: "s1", ref: "main", format: "tar.gz" }));
  assert.deepEqual(plain(archiveRequest({ sessionId: "s1", ref: "h1", format: "zip", path: "/repo" })), { sessionId: "s1", ref: "h1", format: "zip", path: "/repo" });
  assert.equal(archiveRequest({ sessionId: "s1", ref: "h1", format: "rar" }).format, "zip", "unknown formats fall back to zip");
  assert.equal(archiveRequest(null).ref, "");

  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1023), "1023 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
  assert.equal(formatBytes(10 * 1024 * 1024), "10 MB");
  assert.equal(formatBytes(Number.NaN), "");
  assert.equal(formatBytes(-1), "");

  const idle = collectElements(ArchiveDialog({
    t: (key) => key,
    archive: { status: "idle", ref: "main", format: "zip", value: null, error: "" },
    onConfirm: () => {}, onCancel: () => {}, onCopy: () => {},
  }));
  const select = idle.find((element) => element.type === "select");
  assert.equal(select.props.value, "zip");
  assert.deepEqual(idle.filter((element) => element.type === "option").map((element) => element.props.value), ["zip", "tar.gz"]);
  assert.ok(idle.some((element) => element.children.join("") === "archive.confirm"));
  assert.ok(idle.some((element) => element.children.join("") === "action.cancel"));

  const confirmed = [];
  const cancels = [];
  const interactive = collectElements(ArchiveDialog({
    t: (key) => key,
    archive: { status: "idle", ref: "main", format: "zip", value: null, error: "" },
    onConfirm: (format) => confirmed.push(format), onCancel: () => cancels.push(true), onCopy: () => {},
  }));
  interactive.find((element) => element.type === "button" && element.children.join("") === "archive.confirm").props.onClick();
  interactive.find((element) => element.type === "button" && element.children.join("") === "action.cancel").props.onClick();
  assert.deepEqual(confirmed, ["zip"]);
  assert.equal(cancels.length, 1);

  // A tar.gz choice is submitted when the reader selected it.
  const react = createFakeReact({ states: ["tar.gz"] });
  const TarDialog = loadInternals(undefined, react).ArchiveDialog;
  const tarConfirmed = [];
  const tar = collectElements(TarDialog({
    t: (key) => key,
    archive: { status: "idle", ref: "main", format: "zip", value: null, error: "" },
    onConfirm: (format) => tarConfirmed.push(format), onCancel: () => {}, onCopy: () => {},
  }));
  assert.equal(tar.find((element) => element.type === "select").props.value, "tar.gz");
  tar.find((element) => element.type === "button" && element.children.join("") === "archive.confirm").props.onClick();
  assert.deepEqual(tarConfirmed, ["tar.gz"]);

  // Result state: workspace-relative path, human-readable size and copy control.
  const copies = [];
  const ready = collectElements(ArchiveDialog({
    t: (key) => key,
    archive: { status: "ready", ref: "main", format: "zip", value: { path: ".dsh-git-graph/archives/repo-main-20261021-120000.zip", name: "repo-main.zip", bytes: 1536, format: "zip", ref: "main" }, error: "" },
    onConfirm: () => {}, onCancel: () => {}, onCopy: (text) => copies.push(text),
  }));
  const readyText = ready.map((element) => element.children.join("")).join(" | ");
  assert.match(readyText, /\.dsh-git-graph\/archives\/repo-main-20261021-120000\.zip/);
  assert.match(readyText, /1\.5 KB/);
  assert.equal(ready.some((element) => element.props.role === "alert"), false);
  ready.find((element) => element.type === "button" && element.children.join("") === "archive.copy").props.onClick();
  assert.deepEqual(copies, [".dsh-git-graph/archives/repo-main-20261021-120000.zip"]);

  // A non-repository answer surfaces the explanatory hint instead of a result.
  const notRepo = collectElements(ArchiveDialog({
    t: (key) => key,
    archive: { status: "ready", ref: "main", format: "zip", value: { isRepo: false }, error: "" },
    onConfirm: () => {}, onCancel: () => {}, onCopy: () => {},
  }));
  assert.ok(notRepo.some((element) => element.children.join("") === "archive.notRepo"));
  assert.equal(notRepo.some((element) => String(element.props.className || "").includes("dgg-archive-result")), false);

  // Error state is inline and hides the result.
  const failed = collectElements(ArchiveDialog({
    t: (key) => key,
    archive: { status: "error", ref: "main", format: "zip", value: null, error: "fatal: bad revision" },
    onConfirm: () => {}, onCancel: () => {}, onCopy: () => {},
  }));
  const alert = failed.find((element) => element.props.role === "alert");
  assert.match(alert.children.join(""), /archive\.failed.*fatal: bad revision/);
  assert.equal(failed.some((element) => String(element.props.className || "").includes("dgg-archive-result")), false);

  // Ref menus: branch/tag/remote offer it, stash/HEAD do not; busy disables it.
  assert.equal(archiveRefItem({ label: "main", kind: "branch" }, {}).length, 1);
  assert.equal(archiveRefItem({ label: "v1", kind: "tag" }, {}).length, 1);
  assert.equal(archiveRefItem({ label: "origin/main", kind: "remote" }, {}).length, 1);
  assert.deepEqual(Array.from(archiveRefItem({ label: "stash@{0}", kind: "stash" }, {})), []);
  assert.deepEqual(Array.from(archiveRefItem({ label: "HEAD", kind: "head" }, {})), []);
  assert.equal(archiveRefItem({ label: "main", kind: "branch" }, { busy: true })[0].disabled, true);

  assert.match(SOURCE, /postJson\("archive", archiveRequest\(\{ sessionId, ref: target, format, path: selectedRepo \}\), controller\.signal\)/);
  assert.match(SOURCE, /openArchiveDialog\(target\.hash\)/);
  assert.match(SOURCE, /openArchiveDialog\(label\)/);
  assert.match(SOURCE, /h\(ArchiveDialog, \{/);
});

test("missing presentation keeps the wave-9 defaults", () => {
  const { presentationOf, readStoredColumnWidths, CommitRow, COLUMN_WIDTH_DEFAULTS } = loadInternals();
  const defaults = presentationOf(null);
  assert.equal(defaults.avatars, false);
  assert.deepEqual(plain(readStoredColumnWidths(null)), plain(COLUMN_WIDTH_DEFAULTS));
  const commit = { hash: "h1", abbrev: "h1", subject: "S", parents: [], refs: [], authorName: "Ann", authorEmail: "ann@x", authorTime: 1700000000 };
  const row = collectElements(CommitRow({ t: (key) => key, commit, row: { lane: 0, edges: [] }, laneCount: 1, refIndex: new Map() }));
  assert.equal(row.some((element) => typeof element.type === "function" && element.type.name === "Avatar"), false, "no avatar without the presentation flag");
});

// ── wave 9-B: PR dialog, review management, repository config ──────────────

/** Interpolating translate stub for parameterised labels. */
function tParams(key, params) {
  if (params === undefined) return key;
  return key + "(" + Object.entries(params).map(([name, value]) => name + "=" + String(value)).join(",") + ")";
}

test("PR request body and URL helpers", () => {
  const { prRequest, prValueOf, prUrlChoices, openExternalUrl } = loadInternals();
  assert.equal(JSON.stringify(prRequest({ sessionId: "s1" })), JSON.stringify({ sessionId: "s1" }));
  assert.equal(JSON.stringify(prRequest({ sessionId: "s1", path: "/repo" })), JSON.stringify({ sessionId: "s1", path: "/repo" }));
  assert.deepEqual(plain(prRequest({ sessionId: "s1", branch: "feat", base: "main", path: "/repo" })), {
    sessionId: "s1",
    branch: "feat",
    base: "main",
    path: "/repo",
  });
  assert.deepEqual(plain(prRequest(null)), {}, "no body members without a session");

  const value = {
    isRepo: true,
    remote: { name: "origin", url: "git@github.com:a/b.git", provider: "github", owner: "a", repo: "b", webUrl: "https://github.com/a/b" },
    branch: "feat",
    base: "main",
    url: "https://github.com/a/b/compare/main...feat?expand=1",
    custom: [{ name: "codeberg", url: "https://codeberg.org/a/b/compare/main...feat" }, { name: "", url: "ignored" }, null],
  };
  const normalized = prValueOf(value);
  assert.equal(normalized.isRepo, true);
  assert.equal(normalized.provider, "github");
  assert.equal(normalized.branch, "feat");
  assert.equal(normalized.base, "main");
  assert.equal(normalized.url, value.url);
  assert.equal(normalized.remoteName, "origin");
  assert.deepEqual(plain(normalized.custom), [{ name: "codeberg", url: "https://codeberg.org/a/b/compare/main...feat" }]);
  assert.equal(prValueOf(null).provider, "unknown");
  assert.deepEqual(Array.from(prUrlChoices(value), (choice) => choice.id + ":" + choice.name), ["default:github", "custom-0:codeberg"]);
  assert.deepEqual(Array.from(prUrlChoices(null)), []);
  assert.deepEqual(Array.from(prUrlChoices({ custom: [{ name: "x", url: "u" }] }), (choice) => choice.id), ["custom-0"], "custom-only responses still offer a URL");
  assert.deepEqual(Array.from(prUrlChoices({ url: "" })), []);

  const calls = [];
  assert.equal(openExternalUrl("https://example.test/pr", { open: (url, target, features) => calls.push([url, target, features]) }), true);
  assert.deepEqual(calls, [["https://example.test/pr", "_blank", "noopener,noreferrer"]]);
  assert.equal(openExternalUrl("", { open() {} }), false);
  assert.equal(openExternalUrl("https://example.test", null), false);
  assert.equal(openExternalUrl("https://example.test", {}), false);
  assert.equal(openExternalUrl("https://example.test", { open() { throw new Error("blocked"); } }), false, "a blocked popup is tolerated");
});

test("PullRequestDialog shows provider, base←branch, URL choices and copy/open", () => {
  const { PullRequestDialog } = loadInternals();
  const value = {
    isRepo: true,
    remote: { provider: "github" },
    branch: "feat",
    base: "main",
    url: "https://github.com/a/b/compare/main...feat?expand=1",
    custom: [{ name: "codeberg", url: "https://codeberg.org/x" }],
  };
  const copies = [];
  const opens = [];
  const tree = collectElements(PullRequestDialog({
    t: tParams,
    state: { status: "ready", value, error: "" },
    onClose() {},
    onRetry() {},
    onCopy: (url) => copies.push(url),
    onOpen: (url) => opens.push(url),
  }));
  const text = tree.map((element) => element.children.join("")).join(" | ");
  assert.match(text, /pr\.provider/);
  assert.match(text, /github/);
  assert.match(text, /main ← feat/);
  const code = tree.find((element) => String(element.props.className || "").includes("dgg-pr-url"));
  assert.equal(code.children.join(""), value.url);
  const options = collectElements(tree.find((element) => element.type === "select")).filter((element) => element.type === "option");
  assert.deepEqual(Array.from(options, (option) => option.props.value), ["default", "custom-0"], "custom providers are listed as choices");
  assert.deepEqual(Array.from(options, (option) => option.children.join("")), ["github", "codeberg"]);
  tree.find((element) => element.type === "button" && element.children.join("") === "pr.copy").props.onClick();
  tree.find((element) => element.type === "button" && element.children.join("") === "pr.open").props.onClick();
  assert.deepEqual(copies, [value.url]);
  assert.deepEqual(opens, [value.url]);

  // Inline errors (no remote / detached HEAD) and loading.
  const failed = collectElements(PullRequestDialog({ t: tParams, state: { status: "error", value: null, error: "no remote is configured" }, onClose() {}, onRetry() {}, onCopy() {}, onOpen() {} }));
  const alert = failed.find((element) => element.props.role === "alert");
  assert.match(alert.children.join(""), /pr\.failed: no remote is configured/);
  const loading = collectElements(PullRequestDialog({ t: tParams, state: { status: "loading", value: null, error: "" } }));
  assert.ok(loading.some((element) => String(element.props.className || "").includes("dgg-inline-status")));
  const empty = collectElements(PullRequestDialog({ t: tParams, state: { status: "ready", value: { isRepo: true, remote: { provider: "unknown" }, branch: "", base: "", url: "", custom: [] }, error: "" } }));
  assert.ok(empty.some((element) => element.children.join("") === "pr.noUrl"));
});

test("review-management request bodies and scope normalization", () => {
  const { reviewScopesRequest, reviewEndRequest, reviewEndAllRequest, reviewScopeLabel, normalizeReviewScopes } = loadInternals();
  assert.equal(JSON.stringify(reviewScopesRequest()), JSON.stringify({ action: "scopes" }));
  assert.equal(JSON.stringify(reviewEndAllRequest()), JSON.stringify({ action: "end", all: true }));
  const end = reviewEndRequest([
    { sessionId: "s1", kind: "compare", base: "b1", head: "h1", repoPath: "/repo", reviewed: 2, total: 5, extra: 1 },
    null,
  ]);
  assert.equal(JSON.stringify(end), JSON.stringify({ action: "end", scopes: [{ sessionId: "s1", kind: "compare", base: "b1", head: "h1" }] }));
  assert.deepEqual(plain(reviewEndRequest(null)), { action: "end", scopes: [] });

  assert.equal(reviewScopeLabel({ kind: "commit", base: "abcdef123", head: "abcdef123" }), "abcdef1");
  assert.equal(reviewScopeLabel({ kind: "compare", base: "aaaaaaaaaa", head: "bbbbbbbbbb" }), "aaaaaaa..bbbbbbb");
  assert.equal(reviewScopeLabel({ kind: "commit", base: "", head: "" }), "");

  const normalized = normalizeReviewScopes({
    scopes: [
      { sessionId: "s1", repoPath: "/repo/a", kind: "commit", base: "aaaaaaa1", head: "aaaaaaa1", reviewed: 2, total: 5, updatedAt: 1 },
      { sessionId: "s1", repoPath: "/repo/b", kind: "compare", base: "bbbbbbb1", head: "bbbbbbb2", reviewed: 1, total: null },
      { sessionId: "s2", repoPath: "/repo/a", kind: "compare", base: "c", head: "d", reviewed: 0, total: 0 },
      null,
    ],
  });
  assert.equal(normalized.count, 3);
  assert.deepEqual(Array.from(normalized.groups, (group) => group.repoPath), ["/repo/a", "/repo/b"]);
  assert.equal(normalized.groups[0].items.length, 2);
  assert.equal(normalized.groups[1].items[0].total, null);
  assert.equal(normalized.items[1].kind, "compare");
  assert.deepEqual(plain(normalizeReviewScopes(null)), { items: [], groups: [], count: 0 });
});

test("ReviewManagerPanel groups scopes and gates end-all behind a confirmation", () => {
  const { ReviewManagerPanel } = loadInternals();
  const scopesValue = {
    scopes: [
      { sessionId: "s1", repoPath: "/repo/a", kind: "commit", base: "aaaaaaa1", head: "aaaaaaa1", reviewed: 2, total: 5 },
      { sessionId: "s1", repoPath: "/repo/a", kind: "compare", base: "bbbbbbb1", head: "bbbbbbb2", reviewed: 1, total: null },
      { sessionId: "s2", repoPath: "/repo/b", kind: "commit", base: "ccccccc1", head: "ccccccc1", reviewed: 0, total: 0 },
    ],
  };
  const ended = [];
  const counts = { prompted: 0, cancelled: 0, endedAll: 0, refreshed: 0 };
  const render = (confirmingAll) => collectElements(ReviewManagerPanel({
    t: tParams,
    state: { status: "ready", value: scopesValue, error: "" },
    confirmingAll,
    onClose() {},
    onRefresh: () => { counts.refreshed += 1; },
    onPromptEndAll: () => { counts.prompted += 1; },
    onCancelEndAll: () => { counts.cancelled += 1; },
    onEndAll: () => { counts.endedAll += 1; },
    onEndScope: (scope) => ended.push(scope),
  }));
  const tree = render(false);
  const rows = tree.filter((element) => String(element.props.className || "").includes("dgg-scope-row"));
  assert.equal(rows.length, 3);
  assert.ok(tree.some((element) => element.children.join("") === "review.managerTitle"));
  assert.ok(tree.some((element) => element.children.join("") === "/repo/a"), "scopes are grouped by repository");
  assert.ok(tree.some((element) => String(element.children.join("")).includes("review.progress(reviewed=2,total=5)")));
  const endButtons = tree.filter((element) => element.type === "button" && element.children.join("") === "review.end");
  assert.equal(endButtons.length, 3);
  endButtons[0].props.onClick();
  assert.equal(ended.length, 1);
  assert.equal(ended[0].kind, "commit");
  tree.find((element) => element.type === "button" && element.children.join("") === "review.endAll").props.onClick();
  assert.equal(counts.prompted, 1);
  const confirming = render(true);
  assert.ok(confirming.some((element) => element.children.join("") === "review.endAllConfirm"));
  confirming.find((element) => element.type === "button" && element.children.join("") === "review.endAll").props.onClick();
  assert.equal(counts.endedAll, 1);
  confirming.find((element) => element.type === "button" && element.children.join("") === "action.cancel").props.onClick();
  assert.equal(counts.cancelled, 1);

  const empty = collectElements(ReviewManagerPanel({ t: tParams, state: { status: "ready", value: { scopes: [] }, error: "" } }));
  assert.ok(empty.some((element) => element.children.join("") === "review.noScopes"));
  const unavailable = collectElements(ReviewManagerPanel({ t: tParams, state: { status: "unavailable", value: null, error: "" } }));
  assert.ok(unavailable.some((element) => element.children.join("") === "review.unavailable"));
  let retried = 0;
  const failed = collectElements(ReviewManagerPanel({ t: tParams, state: { status: "error", value: null, error: "boom" }, onRefresh: () => { retried += 1; } }));
  assert.match(failed.find((element) => element.props.role === "alert").children.join(""), /review\.failed: boom/);
  failed.find((element) => element.type === "button" && element.children.join("") === "state.retry").props.onClick();
  assert.equal(retried, 1);
  const unknownRepo = collectElements(ReviewManagerPanel({ t: tParams, state: { status: "ready", value: { scopes: [{ sessionId: "s", kind: "commit", base: "a", head: "a", reviewed: 1, total: 2 }] }, error: "" } }));
  assert.ok(unknownRepo.some((element) => element.children.join("") === "review.unknownRepo"));
});

test("repository-config request bodies, values and conflict labels", () => {
  const { repoConfigRequest, repoConfigValueOf, conflictLabel } = loadInternals();
  assert.equal(JSON.stringify(repoConfigRequest({ sessionId: "s1", action: "status" })), JSON.stringify({ sessionId: "s1", action: "status" }));
  assert.equal(JSON.stringify(repoConfigRequest({ sessionId: "s1", action: "export" })), JSON.stringify({ sessionId: "s1", action: "export" }));
  assert.equal(JSON.stringify(repoConfigRequest({ sessionId: "s1", action: "import" })), JSON.stringify({ sessionId: "s1", action: "import" }));
  assert.equal(JSON.stringify(repoConfigRequest({ sessionId: "s1", action: "clear" })), JSON.stringify({ sessionId: "s1", action: "clear" }));
  assert.equal(JSON.stringify(repoConfigRequest({ sessionId: "s1", action: "clear", path: "/repo" })), JSON.stringify({ sessionId: "s1", action: "clear", path: "/repo" }));
  assert.equal(repoConfigRequest({ sessionId: "s1", action: "bogus" }).action, "status", "unknown actions fall back to status");

  const value = repoConfigValueOf({
    isRepo: true,
    present: true,
    valid: false,
    path: "/repo/.gitgraph.json",
    keys: ["a", "b", ""],
    error: "bad file",
    overrides: { a: 1 },
    unknown: ["x", ""],
    invalid: [{ key: "k", reason: "r" }, "s", null],
    applied: 2,
    bytes: 10,
  });
  assert.equal(value.present, true);
  assert.equal(value.valid, false);
  assert.equal(value.path, "/repo/.gitgraph.json");
  assert.deepEqual(Array.from(value.keys), ["a", "b"]);
  assert.deepEqual(Array.from(value.unknown), ["x"]);
  assert.equal(value.invalid.length, 2);
  assert.equal(value.applied, 2);
  assert.equal(value.bytes, 10);
  assert.equal(value.keyCount, 2);
  const numericKeys = repoConfigValueOf({ keys: 7, applied: 3 });
  assert.deepEqual(Array.from(numericKeys.keys), []);
  assert.equal(numericKeys.keyCount, 7, "an export count is accepted as the key count");
  assert.equal(numericKeys.applied, 3);
  assert.deepEqual(plain(repoConfigValueOf(null)), {
    isRepo: true, present: false, valid: true, path: "", keys: [], keyCount: 0, unknown: [], invalid: [], applied: 0, error: "", overrides: {}, bytes: null,
  });
  assert.equal(conflictLabel({ key: "k", reason: "r" }), "k: r");
  assert.equal(conflictLabel({ setting: "k", message: "m" }), "k: m");
  assert.equal(conflictLabel("plain"), "plain");
  assert.equal(conflictLabel({}), "{}");
});

test("RepoConfigPanel renders status, export/import conflicts and the clear confirmation", () => {
  const { RepoConfigPanel } = loadInternals();
  const actions = [];
  const render = (state, confirmingClear) => collectElements(RepoConfigPanel({
    t: tParams,
    state,
    confirmingClear,
    onClose() {},
    onRefresh() {},
    onAction: (action) => actions.push(action),
    onPromptClear() {},
    onCancelClear() {},
    onClear: () => actions.push("clear"),
  }));
  const textOfTree = (elements) => elements.map((element) => element.children.join("")).join(" | ");

  const statusTree = render({ status: "ready", action: "status", value: { isRepo: true, present: true, valid: true, path: "/repo/.gitgraph.json", keys: ["a", "b"], overrides: { a: 1 } }, error: "" }, false);
  const statusText = textOfTree(statusTree);
  assert.match(statusText, /repoconfig\.present/);
  assert.match(statusText, /repoconfig\.pathLabel: \/repo\/\.gitgraph\.json/);
  assert.match(statusText, /repoconfig\.keys\(count=2\)/);
  statusTree.find((element) => element.type === "button" && element.children.join("") === "repoconfig.export").props.onClick();
  statusTree.find((element) => element.type === "button" && element.children.join("") === "repoconfig.import").props.onClick();
  statusTree.find((element) => element.type === "button" && element.children.join("") === "repoconfig.clear").props.onClick();
  assert.deepEqual(actions, ["export", "import"]);

  const absent = textOfTree(render({ status: "ready", action: "status", value: { isRepo: true, present: false, valid: true, path: "", keys: [] }, error: "" }, false));
  assert.match(absent, /repoconfig\.absent/);

  const exported = textOfTree(render({ status: "ready", action: "export", value: { isRepo: true, present: true, valid: true, path: "/repo/.gitgraph.json", keys: ["a"], bytes: 10 }, error: "" }, false));
  assert.match(exported, /repoconfig\.exported\(path=\/repo\/\.gitgraph\.json,count=1\)/);

  const importTree = render({
    status: "ready",
    action: "import",
    value: { isRepo: true, applied: 2, keys: ["a", "b"], unknown: ["x", "y"], invalid: [{ key: "k", reason: "r" }] },
    error: "",
  }, false);
  const importText = textOfTree(importTree);
  assert.match(importText, /repoconfig\.imported\(applied=2\)/);
  assert.match(importText, /repoconfig\.unknown\(count=2\) — x, y/);
  assert.match(importText, /repoconfig\.invalid\(count=1\) — k: r/);
  assert.ok(importTree.some((element) => String(element.props.className || "").includes("dgg-repoconfig-conflict")));

  const confirming = render({ status: "ready", action: "status", value: { isRepo: true, present: true, valid: true, path: "p", keys: [] }, error: "" }, true);
  assert.ok(confirming.some((element) => element.children.join("") === "repoconfig.clearConfirm"));
  confirming.find((element) => element.type === "button" && element.children.join("") === "repoconfig.clear").props.onClick();
  assert.equal(actions.at(-1), "clear");
  const promptOnly = render({ status: "ready", action: "status", value: { isRepo: true, present: true, valid: true, path: "p", keys: [] }, error: "" }, false);
  assert.equal(promptOnly.some((element) => element.children.join("") === "repoconfig.clearConfirm"), false);

  const failed = render({ status: "error", action: "status", value: null, error: "boom" }, false);
  assert.match(failed.find((element) => element.props.role === "alert").children.join(""), /repoconfig\.failed: boom/);
  const loading = render({ status: "loading", action: "status", value: null, error: "" }, false);
  assert.ok(loading.some((element) => String(element.props.className || "").includes("dgg-inline-status")));
});

test("PR, review-management and repo-config wiring drives the routes and refresh", () => {
  assert.match(SOURCE, /postJson\("pr", prRequest\(\{ sessionId, path: selectedRepo \}\), controller\.signal\)/);
  assert.match(SOURCE, /postJson\("review", reviewScopesRequest\(\), controller\.signal\)/);
  assert.match(SOURCE, /postJson\("review", reviewEndRequest\(\[scope\]\)\)/);
  assert.match(SOURCE, /postJson\("review", reviewEndAllRequest\(\)\)/);
  assert.match(SOURCE, /postJson\("repoconfig", repoConfigRequest\(\{ sessionId, action: chosen, path: selectedRepo \}\), controller\.signal\)/);
  assert.match(SOURCE, /if \(chosen === "import"\) refresh\(\);/);
  assert.match(SOURCE, /onOpen: \(url\) => openExternalUrl\(url\)/);
  assert.match(SOURCE, /t\("menu\.pr"\)/);
  assert.match(SOURCE, /t\("menu\.reviewManager"\)/);
  assert.match(SOURCE, /t\("menu\.repoConfig"\)/);
  assert.match(SOURCE, /disabled: running === true \|\| hasRemotes !== true/);
  assert.match(SOURCE, /h\(PullRequestDialog, \{/);
  assert.match(SOURCE, /h\(ReviewManagerPanel, \{/);
  assert.match(SOURCE, /h\(RepoConfigPanel, \{/);

  // The toolbar menu reflects the remote availability.
  const { Toolbar } = loadInternals();
  const props = {
    t: (key) => key, menuOpen: true, columns: {}, order: "date", findOpen: false, filterOpen: false,
    onRefresh() {}, onToggleFind() {}, onToggleFilter() {}, onOrderChange() {}, onToggleColumn() {},
    onToggleMenu() {}, onCloseMenu() {}, onFetch() {}, onOpenRemotes() {}, onBack() {},
    onOpenPr() {}, onOpenReviewManager() {}, onOpenRepoConfig() {},
  };
  const withoutRemote = collectElements(Toolbar({ ...props, hasRemotes: false }));
  const prItem = withoutRemote.find((element) => element.type === "button" && element.children.join("") === "menu.pr");
  assert.equal(prItem.props.disabled, true);
  assert.equal(prItem.props.title, "pr.noRemote");
  const withRemote = collectElements(Toolbar({ ...props, hasRemotes: true }));
  const enabledPr = withRemote.find((element) => element.type === "button" && element.children.join("") === "menu.pr");
  assert.equal(enabledPr.props.disabled, false);
  assert.ok(withRemote.some((element) => element.type === "button" && element.children.join("") === "menu.reviewManager"));
  assert.ok(withRemote.some((element) => element.type === "button" && element.children.join("") === "menu.repoConfig"));
});

test("ReviewManagerPanel explains an outdated host when scopes are unsupported", () => {
  const { ReviewManagerPanel } = loadInternals();
  const tree = collectElements(ReviewManagerPanel({
    t: (key) => key,
    state: { status: "error", value: null, error: 'invalid review action: "scopes"', code: "BAD_REQUEST" },
    onRefresh() {},
  }));
  assert.ok(tree.some((element) => element.children.join("") === "review.staleHost"), "the restart hint replaces the raw error");
  const text = tree.map((element) => element.children.join("")).join(" | ");
  assert.equal(text.includes('invalid review action: "scopes"'), false, "the raw host error is not shown");
  assert.equal(tree.some((element) => element.props.role === "alert"), false);
  // A different BAD_REQUEST still shows the normal inline error.
  const other = collectElements(ReviewManagerPanel({ t: (key) => key, state: { status: "error", value: null, error: "bad thing", code: "BAD_REQUEST" }, onRefresh() {} }));
  assert.ok(other.some((element) => element.props.role === "alert"));
});
