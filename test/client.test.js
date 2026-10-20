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
  "common.refresh",
  "common.close",
];

/**
 * A minimal React stand-in: only `createElement` ever runs at load time, and no
 * hook is executed because the smoke test never renders a component tree.
 */
function createFakeReact() {
  return {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children };
    },
    Fragment: Symbol.for("react.fragment"),
    useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
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
function loadModule(source = SOURCE, fetchImpl) {
  const definition = loadDefinition(source, fetchImpl);
  const fakeReact = createFakeReact();
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
 * @returns the internal helpers and views the tests exercise directly.
 */
function loadInternals() {
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
        "fileRowKey, RichText, SignatureBadge, CommitTooltip, RepoLabel }",
    ),
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
  assert.equal(buttons[0].children.join(""), "main");
  assert.match(buttons[0].props.className, /dgg-chip-branch/);
  assert.match(buttons[0].props.className, /dgg-chip-head/, "the current branch keeps the head accent");
  assert.equal(buttons[0].props.title, "action.checkoutBranch: main");
  assert.equal(spans.length, 1, "HEAD must remain a non-actionable chip");
  assert.equal(spans[0].children.join(""), "HEAD");
  assert.match(spans[0].props.className, /dgg-chip-head/);

  // Without a pick handler (the master list) both chips are inert spans.
  const inert = collectElements(RefChips({ chips, t: (key) => key }));
  assert.equal(inert.filter((element) => element.type === "button").length, 0);
  assert.equal(inert.filter((element) => element.type === "span" && "title" in element.props).length, 2);
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
  assert.equal(buttons[0].children.join(""), "main");
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
  const tagSpan = spans.find((element) => element.children.join("") === "v1.0");
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
  const headSpan = spans.find((element) => element.children.join("") === "HEAD");
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
  const boxes = all.filter((element) => element.type === "input");
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
  assert.deepEqual(subset.filter((element) => element.type === "input").map((box) => box.props.checked), [false, true]);

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
  assert.deepEqual(Array.from(items, (item) => item.id), ["merge", "rebase", "drop-commit", "reset-commit"]);
  assert.deepEqual(Array.from(items, (item) => item.kind), ["merge", "rebase", "dropCommit", "resetToCommit"]);
  assert.deepEqual(Array.from(items, (item) => item.labelKey), ["action.merge", "action.rebase", "action.dropCommit", "action.resetToCommit"]);
  assert.equal(items[0].after, "create-branch");
  assert.equal(items[3].after, "drop-commit");
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
  const { presentationOf } = loadInternals();
  const defaults = presentationOf(null);
  assert.deepEqual(plain(defaults), {
    graphStyle: "rounded",
    graphColours: [],
    showSignature: false,
    showEmoji: true,
    issueUrlTemplate: "",
  });
  const configured = presentationOf({
    presentation: {
      graphStyle: "angular",
      graphColours: ["#111", "", 7, "#222"],
      showSignature: true,
      showEmoji: false,
      issueUrlTemplate: "https://example.com/issues/{id}",
      useMailmap: true,
    },
  });
  assert.deepEqual(plain(configured), {
    graphStyle: "angular",
    graphColours: ["#111", "#222"],
    showSignature: true,
    showEmoji: false,
    issueUrlTemplate: "https://example.com/issues/{id}",
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
