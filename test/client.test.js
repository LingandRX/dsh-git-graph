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
        "UncommittedView, CompareView }",
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
