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
  "action.fetch",
  "action.confirm",
  "action.cancel",
  "action.running",
  "action.branchName",
  "action.tagName",
  "action.success",
  "action.failed",
  "action.cleanWorktreeWarning",
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
 * @returns `{ layoutGraph, classifyRefs, groupFiles, lanePath, RefChips }`.
 */
function loadInternals() {
  const { exported } = loadModule(
    instrument("__test: { layoutGraph, classifyRefs, groupFiles, lanePath, RefChips }"),
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
