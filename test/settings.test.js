/**
 * Tests for `lib/settings.js` — the 110-key upstream settings port.
 *
 * The suite is fixture-free: it imports the module directly, asserts the
 * catalogue shape (110 keys / 81 canonical / 29 aliases / 110-row parity table),
 * exercises alias folding, type coercion, the presentation payload, shortcut
 * parsing and the never-throw guarantee.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import {
  CANONICAL_KEYS,
  META,
  PRESENTATION_KEYS,
  SETTINGS,
  normalizeSettings,
  parseShortcut,
} from "../lib/settings.js";

/** The 29 legacy flat spellings upstream keeps as aliases, mapped to their canonical key. */
const LEGACY_ALIASES = {
  autoCenterCommitDetailsView: "commitDetailsView.autoCenter",
  combineLocalAndRemoteBranchLabels: "referenceLabels.combineLocalAndRemoteBranchLabels",
  commitDetailsViewFileTreeCompactFolders: "commitDetailsView.fileView.fileTree.compactFolders",
  commitDetailsViewLocation: "commitDetailsView.location",
  commitOrdering: "repository.commits.order",
  dateFormat: "date.format",
  dateType: "date.type",
  defaultFileViewType: "commitDetailsView.fileView.type",
  fetchAndPrune: "repository.fetchAndPrune",
  fetchAvatars: "repository.commits.fetchAvatars",
  graphColours: "graph.colours",
  graphStyle: "graph.style",
  includeCommitsMentionedByReflogs: "repository.includeCommitsMentionedByReflogs",
  initialLoadCommits: "repository.commits.initialLoad",
  loadMoreCommits: "repository.commits.loadMore",
  loadMoreCommitsAutomatically: "repository.commits.loadMoreAutomatically",
  muteCommitsThatAreNotAncestorsOfHead: "repository.commits.mute.commitsThatAreNotAncestorsOfHead",
  muteMergeCommits: "repository.commits.mute.mergeCommits",
  onlyFollowFirstParent: "repository.onlyFollowFirstParent",
  openDiffTabLocation: "openNewTabEditorGroup",
  openRepoToHead: "repository.onLoad.scrollToHead",
  referenceLabelAlignment: "referenceLabels.alignment",
  showCommitsOnlyReferencedByTags: "repository.showCommitsOnlyReferencedByTags",
  showCurrentBranchByDefault: "repository.onLoad.showCheckedOutBranch",
  showSignatureStatus: "repository.commits.showSignatureStatus",
  showTags: "repository.showTags",
  showUncommittedChanges: "repository.showUncommittedChanges",
  showUntrackedFiles: "repository.showUntrackedFiles",
  useMailmap: "repository.useMailmap",
};

/** Contract §4 presentation keys in contract order, plus the three appended pagination keys. */
const CONTRACT_PRESENTATION_KEYS = [
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
  /* Appended for the wave-8-C part 2 client pagination consumer. */
  "initialLoad",
  "loadMore",
  "loadMoreAutomatically",
];

/** Upstream v1.30.0 `graph.colours` default. */
const DEFAULT_GRAPH_COLOURS = [
  "#0085d9",
  "#d9008f",
  "#00d90a",
  "#d98500",
  "#a300d9",
  "#ff0000",
  "#00d9cc",
  "#e138e8",
  "#85d900",
  "#dc5b23",
  "#6f24d6",
  "#ffcc00",
];

/** Default shortcut record helper. */
function shortcut(key, { ctrl = false, meta = false, alt = false, shift = false } = {}) {
  return { key, ctrl, meta, alt, shift };
}

/** The complete default presentation payload. */
const DEFAULT_PRESENTATION = {
  graphStyle: "rounded",
  graphColours: DEFAULT_GRAPH_COLOURS.slice(),
  showSignature: false,
  showEmoji: true,
  issueUrlTemplate: "",
  useMailmap: false,
  dateType: "Author Date",
  dateFormat: "Date & Time",
  referenceLabelAlignment: "Normal",
  combineLocalAndRemoteBranchLabels: true,
  columnVisibility: { Date: true, Author: true, Commit: true },
  fileViewType: "File Tree",
  compactFolders: true,
  autoCenterDetails: true,
  markdown: true,
  muteMergeCommits: true,
  muteNonAncestors: false,
  emojiMappings: [],
  customBranchGlobPatterns: [],
  dialogDefaults: {
    applyStash: { reinstateIndex: false },
    merge: { noCommit: false, noFastForward: true, squashCommits: false },
    popStash: { reinstateIndex: false },
    pullBranch: { noFastForward: false },
    resetCurrentBranchToCommit: { mode: "Mixed" },
    resetUncommittedChanges: { mode: "Mixed" },
    stashUncommittedChanges: { includeUntracked: true },
  },
  contextMenuVisibility: {},
  shortcuts: {
    find: shortcut("f", { ctrl: true, meta: true }),
    refresh: shortcut("r", { ctrl: true, meta: true }),
    scrollToHead: shortcut("h", { ctrl: true, meta: true }),
    scrollToStash: shortcut("s", { ctrl: true, meta: true }),
  },
  globalShortcuts: false,
  enhancedAccessibility: false,
  repositoryDropdownOrder: "Workspace Full Path",
  fileEncoding: "utf8",
  initialLoad: 300,
  loadMore: 100,
  loadMoreAutomatically: true,
};

/** True when `value` matches a declared upstream setting type. */
function matchesType(value, type) {
  switch (type) {
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "array":
      return Array.isArray(value);
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    default:
      return false;
  }
}

/** All `invalid` keys of a result. */
function invalidKeys(result) {
  return result.invalid.map((entry) => entry.key);
}

/** True when any invalid entry for `key` matches `pattern`. */
function invalidHas(result, key, pattern) {
  return result.invalid.some((entry) => entry.key === key && pattern.test(entry.reason));
}

/* ------------------------------------------------------------------------- */
/* Catalogue shape                                                            */
/* ------------------------------------------------------------------------- */

test("declares exactly 110 unique upstream keys", () => {
  assert.equal(SETTINGS.length, 110);
  const keys = SETTINGS.map((setting) => setting.key);
  assert.equal(new Set(keys).size, 110);
  for (const key of keys) {
    assert.equal(typeof key, "string");
    assert.ok(key.length > 0);
    assert.ok(!key.startsWith("git-graph."), `key keeps the upstream prefix: ${key}`);
  }
});

test("every entry has the documented shape and a valid wiring", () => {
  const allowedFields = new Set(["key", "type", "default", "aliasOf", "wiring", "note"]);
  const allowedWiring = new Set(["mapped", "vscode-only", "out-of-scope"]);
  for (const setting of SETTINGS) {
    for (const field of Object.keys(setting)) assert.ok(allowedFields.has(field), `unexpected field ${field} on ${setting.key}`);
    assert.ok(META.types.has(setting.type), `bad type on ${setting.key}: ${setting.type}`);
    assert.ok(matchesType(setting.default, setting.type), `default does not match ${setting.type} for ${setting.key}`);
    assert.ok(allowedWiring.has(setting.wiring), `bad wiring on ${setting.key}: ${setting.wiring}`);
    assert.equal(typeof setting.note, "string");
    assert.ok(setting.note.trim().length > 0, `empty note on ${setting.key}`);
    assert.ok(!setting.note.includes("\n"), `note must be one line on ${setting.key}`);
    if (setting.wiring !== "mapped") {
      assert.ok(setting.note.trim().length > 0, `non-mapped entry without a note: ${setting.key}`);
    }
  }
});

test("the 29 legacy aliases match upstream and point at canonical keys", () => {
  const aliases = SETTINGS.filter((setting) => setting.aliasOf !== undefined);
  assert.equal(aliases.length, 29);
  assert.deepEqual(
    Object.fromEntries(aliases.map((setting) => [setting.key, setting.aliasOf])),
    LEGACY_ALIASES,
  );
  const byKey = new Map(SETTINGS.map((setting) => [setting.key, setting]));
  for (const alias of aliases) {
    const target = byKey.get(alias.aliasOf);
    assert.ok(target !== undefined, `alias target does not exist: ${alias.key} → ${alias.aliasOf}`);
    assert.equal(target.aliasOf, undefined, `alias target is itself an alias: ${alias.key} → ${alias.aliasOf}`);
    assert.equal(alias.type, target.type, `alias type differs from target: ${alias.key}`);
    assert.deepEqual(alias.default, target.default, `alias default differs from target: ${alias.key}`);
    assert.equal(alias.wiring, target.wiring, `alias wiring differs from target: ${alias.key}`);
  }
});

test("canonical keys are the 81 entries without aliasOf", () => {
  assert.equal(CANONICAL_KEYS.length, 81);
  assert.equal(new Set(CANONICAL_KEYS).size, 81);
  assert.deepEqual(
    CANONICAL_KEYS,
    SETTINGS.filter((setting) => setting.aliasOf === undefined).map((setting) => setting.key),
  );
  assert.equal(CANONICAL_KEYS.length + 29, SETTINGS.length);
});

test("wiring counts match the parity report: 72 mapped / 10 vscode-only / 28 out-of-scope", () => {
  const counts = { mapped: 0, "vscode-only": 0, "out-of-scope": 0 };
  for (const setting of SETTINGS) counts[setting.wiring] += 1;
  assert.deepEqual(counts, { mapped: 72, "vscode-only": 10, "out-of-scope": 28 });

  const canonicalCounts = { mapped: 0, "vscode-only": 0, "out-of-scope": 0 };
  for (const setting of SETTINGS) {
    if (setting.aliasOf === undefined) canonicalCounts[setting.wiring] += 1;
  }
  assert.deepEqual(canonicalCounts, { mapped: 49, "vscode-only": 8, "out-of-scope": 24 });
});

test("the wave-8-B host-wired keys are mapped and describe what happens now", () => {
  const byKey = new Map(SETTINGS.map((setting) => [setting.key, setting]));
  const wired = [
    ["repository.commits.order", /default when the request omits `order`/],
    ["repository.commits.initialLoad", /default graph page size \(300\)/],
    ["repository.commits.loadMore", /presentation\.loadMore/],
    ["repository.commits.loadMoreAutomatically", /presentation\.loadMoreAutomatically/],
    ["repository.fetchAndPrune", /--prune only when true/],
    ["repository.fetchAndPruneTags", /--prune-tags only when true/],
    ["repository.onlyFollowFirstParent", /--first-parent/],
    ["repository.includeCommitsMentionedByReflogs", /--reflog/],
    ["repository.showCommitsOnlyReferencedByTags", /--tags walk source/],
    ["repository.showRemoteHeads", /refs\/remotes\/<remote>\/HEAD/],
    ["repository.showTags", /--tags walk source/],
    ["repository.showUntrackedFiles", /--untracked-files=no/],
  ];
  for (const [key, pattern] of wired) {
    const setting = byKey.get(key);
    assert.ok(setting !== undefined, `missing setting: ${key}`);
    assert.equal(setting.wiring, "mapped", `${key} should be mapped`);
    assert.match(setting.note, pattern, `${key} note is stale: ${setting.note}`);
  }

  /* Every alias of a newly wired key inherits the wiring and says it is wired through it. */
  for (const alias of [
    "commitOrdering",
    "initialLoadCommits",
    "loadMoreCommits",
    "loadMoreCommitsAutomatically",
    "fetchAndPrune",
    "includeCommitsMentionedByReflogs",
    "onlyFollowFirstParent",
    "showCommitsOnlyReferencedByTags",
    "showTags",
    "showUntrackedFiles",
  ]) {
    const setting = byKey.get(alias);
    assert.equal(setting.wiring, "mapped", `${alias} should inherit mapped wiring`);
    assert.match(setting.note, new RegExp(`wired through ${setting.aliasOf.replaceAll(".", "\\.")}`), `${alias} note: ${setting.note}`);
  }
});

test("no mapped entry still claims it is out of scope, always shown or always pruned", () => {
  const stale = /out-of-scope|always shown|always uses --prune|not configurable|no toggle|fixed at 120/i;
  for (const setting of SETTINGS) {
    if (setting.wiring !== "mapped") continue;
    assert.doesNotMatch(setting.note, stale, `stale mapped note on ${setting.key}: ${setting.note}`);
  }
  for (const setting of SETTINGS) {
    if (setting.aliasOf === undefined) continue;
    if (setting.wiring !== "mapped") continue;
    assert.doesNotMatch(setting.note, stale, `stale mapped alias note on ${setting.key}: ${setting.note}`);
  }
});

test("enum declarations only reference canonical keys with string values", () => {
  const canonical = new Set(CANONICAL_KEYS);
  for (const [key, values] of Object.entries(META.enums)) {
    assert.ok(canonical.has(key), `enum on non-canonical key: ${key}`);
    assert.ok(Array.isArray(values) && values.length > 0, `empty enum: ${key}`);
    assert.equal(new Set(values).size, values.length, `duplicate enum entries: ${key}`);
    assert.equal(SETTINGS.find((setting) => setting.key === key).type, "string");
  }
});

test("dropdown defaults and helper catalogues are canonical", () => {
  const byKey = new Map(SETTINGS.map((setting) => [setting.key, setting]));
  assert.equal(META.shortcutSlots.length, 4);
  assert.deepEqual(META.shortcutSlots.slice(), ["find", "refresh", "scrollToHead", "scrollToStash"]);
  for (const slot of META.shortcutSlots) {
    const key = `keyboardShortcut.${slot}`;
    assert.ok(byKey.has(key), `missing shortcut setting: ${key}`);
    assert.equal(byKey.get(key).type, "string");
    assert.equal(byKey.get(key).wiring, "mapped");
  }
  for (const dotted of META.dialogDefaultKeys) {
    const key = `dialog.${dotted}`;
    const setting = byKey.get(key);
    assert.ok(setting !== undefined, `missing dialog default setting: ${key}`);
    assert.equal(setting.wiring, "mapped", `dialog default not mapped: ${key}`);
  }
  assert.deepEqual(META.extensions.slice(), ["showEmoji", "issueUrlTemplate", "globalShortcuts"]);
});

/* ------------------------------------------------------------------------- */
/* Defaults and presentation payload                                          */
/* ------------------------------------------------------------------------- */

test("normalizeSettings({}) returns defaults for all 81 canonical keys plus 3 extensions", () => {
  const result = normalizeSettings({});
  assert.equal(Object.keys(result.values).length, 84);
  for (const setting of SETTINGS) {
    if (setting.aliasOf !== undefined) continue;
    assert.deepEqual(result.values[setting.key], setting.default, `default value for ${setting.key}`);
  }
  assert.equal(result.values.showEmoji, true);
  assert.equal(result.values.issueUrlTemplate, "");
  assert.equal(result.values.globalShortcuts, false);
  assert.deepEqual(result.aliased, []);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.invalid, []);
});

test("default presentation matches the §4 keys plus appended pagination keys exactly and is JSON-serializable", () => {
  const result = normalizeSettings({});
  assert.deepEqual(PRESENTATION_KEYS, CONTRACT_PRESENTATION_KEYS);
  assert.deepEqual(Object.keys(result.presentation), CONTRACT_PRESENTATION_KEYS);
  assert.deepEqual(result.presentation, DEFAULT_PRESENTATION);
  assert.equal(result.presentation.initialLoad, 300);
  assert.equal(result.presentation.loadMore, 100);
  assert.equal(result.presentation.loadMoreAutomatically, true);
  assert.equal(result.shortcuts, result.presentation.shortcuts);
  assert.doesNotThrow(() => JSON.stringify(result.presentation));
  assert.deepEqual(JSON.parse(JSON.stringify(result.presentation)), DEFAULT_PRESENTATION);
});

test("pagination presentation values are clamped to 1-2000 and reported", () => {
  const high = normalizeSettings({ "repository.commits.initialLoad": "5000", "repository.commits.loadMore": 0 });
  assert.equal(high.values["repository.commits.initialLoad"], 5000);
  assert.equal(high.values["repository.commits.loadMore"], 0);
  assert.equal(high.presentation.initialLoad, 2000);
  assert.equal(high.presentation.loadMore, 1);
  assert.ok(invalidHas(high, "repository.commits.initialLoad", /clamped to 2000/));
  assert.ok(invalidHas(high, "repository.commits.loadMore", /clamped to 1/));

  const fractional = normalizeSettings({ "repository.commits.initialLoad": -5, "repository.commits.loadMore": 12.7 });
  assert.equal(fractional.presentation.initialLoad, 1);
  assert.equal(fractional.presentation.loadMore, 12);
  assert.ok(invalidHas(fractional, "repository.commits.loadMore", /clamped to 12/));

  const alias = normalizeSettings({ initialLoadCommits: 250, loadMoreCommits: 50 });
  assert.equal(alias.values["repository.commits.initialLoad"], 250);
  assert.equal(alias.presentation.initialLoad, 250);
  assert.equal(alias.presentation.loadMore, 50);

  const automatic = normalizeSettings({ "repository.commits.loadMoreAutomatically": "false" });
  assert.equal(automatic.values["repository.commits.loadMoreAutomatically"], false);
  assert.equal(automatic.presentation.loadMoreAutomatically, false);
});

test("wave-8-B walk/fetch settings normalize into values for the host", () => {
  const result = normalizeSettings({
    "repository.commits.order": "topo",
    "repository.fetchAndPrune": true,
    "repository.fetchAndPruneTags": false,
    "repository.onlyFollowFirstParent": true,
    "repository.includeCommitsMentionedByReflogs": true,
    "repository.showCommitsOnlyReferencedByTags": false,
    "repository.showRemoteHeads": false,
    "repository.showTags": false,
    "repository.showUntrackedFiles": false,
  });
  assert.equal(result.values["repository.commits.order"], "topo");
  assert.equal(result.values["repository.fetchAndPrune"], true);
  assert.equal(result.values["repository.fetchAndPruneTags"], false);
  assert.equal(result.values["repository.onlyFollowFirstParent"], true);
  assert.equal(result.values["repository.includeCommitsMentionedByReflogs"], true);
  assert.equal(result.values["repository.showCommitsOnlyReferencedByTags"], false);
  assert.equal(result.values["repository.showRemoteHeads"], false);
  assert.equal(result.values["repository.showTags"], false);
  assert.equal(result.values["repository.showUntrackedFiles"], false);
  assert.deepEqual(result.invalid, []);

  const aliased = normalizeSettings({ commitOrdering: "author-date", showTags: false, showUntrackedFiles: false });
  assert.equal(aliased.values["repository.commits.order"], "author-date");
  assert.equal(aliased.values["repository.showTags"], false);
  assert.equal(aliased.values["repository.showUntrackedFiles"], false);
  assert.ok(aliased.aliased.every((entry) => entry.discarded === false));

  const badOrder = normalizeSettings({ "repository.commits.order": "bogus" });
  assert.equal(badOrder.values["repository.commits.order"], "date");
  assert.ok(invalidHas(badOrder, "repository.commits.order", /expected one of/));
});

test("presentation is deterministic and independent of unknown/request keys", () => {
  const base = normalizeSettings({ graphStyle: "angular", issueUrlTemplate: "https://example.test/{id}" });
  const noisy = normalizeSettings({
    graphStyle: "angular",
    issueUrlTemplate: "https://example.test/{id}",
    repoPath: "/tmp/example",
    maxCommits: 42,
    somethingUnknown: true,
    path: "/tmp/ignored",
  });
  assert.deepEqual(base.presentation, noisy.presentation);
  assert.equal(JSON.stringify(base.presentation), JSON.stringify(noisy.presentation));
  assert.deepEqual(normalizeSettings({}).presentation, normalizeSettings({}).presentation);
});

test("extensions feed the matching presentation members", () => {
  const result = normalizeSettings({ showEmoji: false, issueUrlTemplate: "https://tracker.test/issue/{id}", globalShortcuts: true });
  assert.equal(result.presentation.showEmoji, false);
  assert.equal(result.presentation.issueUrlTemplate, "https://tracker.test/issue/{id}");
  assert.equal(result.presentation.globalShortcuts, true);
  assert.equal(result.presentation.useMailmap, false);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.invalid, []);
});

test("presentation sanitizes graph colours, column visibility, mappings and context menu", () => {
  const result = normalizeSettings({
    "graph.colours": ["#abc", "not a colour", 42, "#abc", "var(--dsw-alias-label-primary)"],
    defaultColumnVisibility: { Date: false, Author: "yes", Commit: true, Extra: true },
    customEmojiShortcodeMappings: [
      { shortcode: ":sparkles:", emoji: "✨" },
      { shortcode: "", emoji: "x" },
      { shortcode: ":ok:", emoji: 1 },
      "not-an-object",
    ],
    customBranchGlobPatterns: [
      { name: "Feature", glob: "heads/feature/*" },
      { name: "", glob: "heads/*" },
      { name: "Bad", glob: "" },
    ],
    contextMenuActionsVisibility: { branch: { checkout: false, rename: "no" }, commit: "nope" },
  });

  assert.deepEqual(result.presentation.graphColours, ["#abc", "var(--dsw-alias-label-primary)"]);
  assert.deepEqual(result.presentation.columnVisibility, { Date: false, Author: true, Commit: true });
  assert.deepEqual(result.presentation.emojiMappings, [{ shortcode: ":sparkles:", emoji: "✨" }]);
  assert.deepEqual(result.presentation.customBranchGlobPatterns, [{ name: "Feature", glob: "heads/feature/*" }]);
  assert.deepEqual(result.presentation.contextMenuVisibility, { branch: { checkout: false } });

  assert.ok(invalidHas(result, "graph.colours", /dropped invalid colour/));
  assert.ok(invalidHas(result, "defaultColumnVisibility", /Author must be boolean/));
  assert.ok(invalidHas(result, "customEmojiShortcodeMappings", /dropped/));
  assert.ok(invalidHas(result, "customBranchGlobPatterns", /dropped/));
  assert.ok(invalidHas(result, "contextMenuActionsVisibility", /rename must be boolean/));
  assert.ok(invalidHas(result, "contextMenuActionsVisibility", /non-object group/));
});

test("dialogDefaults carries only the dialog options the DSH dialogs can honour", () => {
  const result = normalizeSettings({
    "dialog.merge.noFastForward": false,
    "dialog.merge.squashCommits": true,
    "dialog.resetCurrentBranchToCommit.mode": "Hard",
    "dialog.stashUncommittedChanges.includeUntracked": false,
    "dialog.rebase.launchInteractiveRebase": true,
    "dialog.addTag.type": "Annotated",
  });
  assert.deepEqual(result.presentation.dialogDefaults, {
    applyStash: { reinstateIndex: false },
    merge: { noCommit: false, noFastForward: false, squashCommits: true },
    popStash: { reinstateIndex: false },
    pullBranch: { noFastForward: false },
    resetCurrentBranchToCommit: { mode: "Hard" },
    resetUncommittedChanges: { mode: "Mixed" },
    stashUncommittedChanges: { includeUntracked: false },
  });
  /* Unsupported dialog keys still normalize by type, but never reach dialogDefaults. */
  assert.equal(result.values["dialog.rebase.launchInteractiveRebase"], true);
  assert.equal(result.presentation.dialogDefaults.rebase, undefined);
  assert.equal(result.presentation.dialogDefaults.addTag, undefined);
});

/* ------------------------------------------------------------------------- */
/* Alias folding                                                              */
/* ------------------------------------------------------------------------- */

test("every legacy alias folds into its canonical key", () => {
  for (const [alias, canonical] of Object.entries(LEGACY_ALIASES)) {
    const aliasDefault = SETTINGS.find((setting) => setting.key === alias).default;
    const result = normalizeSettings({ [alias]: aliasDefault });
    assert.deepEqual(result.values[canonical], aliasDefault, `alias ${alias} did not fold into ${canonical}`);
    assert.deepEqual(result.aliased, [{ key: alias, canonical, discarded: false }], `aliased report for ${alias}`);
    assert.deepEqual(result.invalid, [], `unexpected invalid report for ${alias}`);
  }
});

test("canonical wins when alias and canonical are both set and differ", () => {
  const result = normalizeSettings({ graphStyle: "angular", "graph.style": "rounded" });
  assert.equal(result.values["graph.style"], "rounded");
  assert.equal(result.presentation.graphStyle, "rounded");
  assert.deepEqual(result.aliased, [{ key: "graphStyle", canonical: "graph.style", discarded: true }]);
  assert.ok(invalidHas(result, "graphStyle", /canonical key .* is set and differs/));
});

test("equal alias and canonical values fold without a conflict report", () => {
  const result = normalizeSettings({ graphStyle: "rounded", "graph.style": "rounded" });
  assert.equal(result.values["graph.style"], "rounded");
  assert.deepEqual(result.aliased, [{ key: "graphStyle", canonical: "graph.style", discarded: true }]);
  assert.deepEqual(result.invalid, []);
});

test("canonical also wins over a second alias spelling", () => {
  const result = normalizeSettings({ showSignatureStatus: true, showSignature: false, "repository.commits.showSignatureStatus": true });
  assert.equal(result.values["repository.commits.showSignatureStatus"], true);
  assert.equal(result.presentation.showSignature, true);
  assert.ok(result.aliased.every((entry) => entry.discarded === true));
  assert.ok(invalidHas(result, "showSignature", /canonical key/));
});

test("DSH compat spellings fold on their own (showRemoteBranches, showStashes, showSignature)", () => {
  assert.deepEqual(META.aliases, {
    showRemoteBranches: "repository.showRemoteBranches",
    showStashes: "repository.showStashes",
    showSignature: "repository.commits.showSignatureStatus",
  });
  const cases = [
    ["showRemoteBranches", "repository.showRemoteBranches", true],
    ["showStashes", "repository.showStashes", false],
    ["showSignature", "repository.commits.showSignatureStatus", true],
  ];
  for (const [alias, canonical, value] of cases) {
    const result = normalizeSettings({ [alias]: value });
    assert.equal(result.values[canonical], value, `${alias} did not fold into ${canonical}`);
    assert.equal(result.values[alias], undefined, `${alias} leaked into values`);
    assert.deepEqual(result.aliased, [{ key: alias, canonical, discarded: false }]);
    assert.deepEqual(result.unknown, []);
    assert.deepEqual(result.invalid, []);
  }
  assert.equal(normalizeSettings({ showRemoteBranches: false }).presentation.graphColours.length, 12);
});

test("canonical wins over DSH compat spellings when both are set and differ", () => {
  const result = normalizeSettings({
    showRemoteBranches: false,
    "repository.showRemoteBranches": true,
    showStashes: false,
    "repository.showStashes": true,
  });
  assert.equal(result.values["repository.showRemoteBranches"], true);
  assert.equal(result.values["repository.showStashes"], true);
  assert.deepEqual(result.aliased, [
    { key: "showRemoteBranches", canonical: "repository.showRemoteBranches", discarded: true },
    { key: "showStashes", canonical: "repository.showStashes", discarded: true },
  ]);
  assert.ok(invalidHas(result, "showRemoteBranches", /canonical key .* is set and differs/));
  assert.ok(invalidHas(result, "showStashes", /canonical key .* is set and differs/));
  assert.deepEqual(result.unknown, []);
});

test("equal canonical and DSH compat values fold without a conflict report", () => {
  const result = normalizeSettings({ showRemoteBranches: true, "repository.showRemoteBranches": true });
  assert.equal(result.values["repository.showRemoteBranches"], true);
  assert.deepEqual(result.aliased, [{ key: "showRemoteBranches", canonical: "repository.showRemoteBranches", discarded: true }]);
  assert.deepEqual(result.invalid, []);
});

test("the installed 11-key cordis.patch.yml config normalizes without unknown keys", () => {
  const patch = {
    repoPath: "",
    maxCommits: 400,
    showRemoteBranches: true,
    showStashes: true,
    graphStyle: "rounded",
    graphColours: DEFAULT_GRAPH_COLOURS.slice(),
    showSignature: false,
    showEmoji: true,
    issueUrlTemplate: "",
    useMailmap: false,
    maxDepthOfRepoSearch: 1,
  };
  const result = normalizeSettings(patch);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.invalid, []);

  /* Host keys stay owned by normalizeConfig: skipped, not reported as unknown. */
  assert.equal(result.values.repoPath, undefined);
  assert.equal(result.values.maxCommits, undefined);

  assert.equal(result.values["repository.showRemoteBranches"], true);
  assert.equal(result.values["repository.showStashes"], true);
  assert.equal(result.values["graph.style"], "rounded");
  assert.equal(result.values["repository.useMailmap"], false);
  assert.equal(result.values["repository.commits.showSignatureStatus"], false);
  assert.equal(result.values.showEmoji, true);
  assert.equal(result.values.issueUrlTemplate, "");
  assert.equal(result.values.maxDepthOfRepoSearch, 1);

  assert.equal(result.presentation.graphStyle, "rounded");
  assert.deepEqual(result.presentation.graphColours, DEFAULT_GRAPH_COLOURS);
  assert.equal(result.presentation.showSignature, false);
  assert.equal(result.presentation.showEmoji, true);
  assert.equal(result.presentation.issueUrlTemplate, "");
  assert.equal(result.presentation.useMailmap, false);

  assert.deepEqual(Object.fromEntries(result.aliased.map((entry) => [entry.key, entry.canonical])), {
    graphColours: "graph.colours",
    graphStyle: "graph.style",
    showSignature: "repository.commits.showSignatureStatus",
    showRemoteBranches: "repository.showRemoteBranches",
    showStashes: "repository.showStashes",
    useMailmap: "repository.useMailmap",
  });
  assert.ok(result.aliased.every((entry) => entry.discarded === false));
});

test("all alias wiring values equal their canonical wiring", () => {
  const byKey = new Map(SETTINGS.map((setting) => [setting.key, setting]));
  for (const [alias, canonical] of Object.entries(LEGACY_ALIASES)) {
    assert.equal(byKey.get(alias).wiring, byKey.get(canonical).wiring, `wiring mismatch for ${alias}`);
  }
});

/* ------------------------------------------------------------------------- */
/* Type coercion and reporting                                                */
/* ------------------------------------------------------------------------- */

test("numbers coerce from numeric strings and reject everything else", () => {
  const coerced = normalizeSettings({ "repository.commits.initialLoad": "250", "repository.commits.loadMore": 12.5 });
  assert.equal(coerced.values["repository.commits.initialLoad"], 250);
  assert.equal(coerced.values["repository.commits.loadMore"], 12.5);
  assert.ok(invalidHas(coerced, "repository.commits.initialLoad", /coerced string .* to number 250/));

  const rejected = normalizeSettings({ "repository.commits.initialLoad": "many", "repository.commits.loadMore": Number.NaN });
  assert.equal(rejected.values["repository.commits.initialLoad"], 300);
  assert.equal(rejected.values["repository.commits.loadMore"], 100);
  assert.ok(invalidHas(rejected, "repository.commits.initialLoad", /expected number/));
  assert.ok(invalidHas(rejected, "repository.commits.loadMore", /expected number/));

  const boolean = normalizeSettings({ "repository.commits.initialLoad": true });
  assert.equal(boolean.values["repository.commits.initialLoad"], 300);
  assert.ok(invalidHas(boolean, "repository.commits.initialLoad", /expected number/));
});

test("booleans accept only true/false spellings and 1/0", () => {
  assert.equal(normalizeSettings({ markdown: "false" }).values.markdown, false);
  assert.equal(normalizeSettings({ markdown: "TRUE" }).values.markdown, true);
  assert.equal(normalizeSettings({ markdown: 1 }).values.markdown, true);
  assert.equal(normalizeSettings({ markdown: 0 }).values.markdown, false);

  const truthy = normalizeSettings({ markdown: "yes" });
  assert.equal(truthy.values.markdown, true);
  assert.ok(invalidHas(truthy, "markdown", /expected boolean/));
  assert.equal(normalizeSettings({ markdown: 2 }).values.markdown, true);
  assert.equal(normalizeSettings({ markdown: [] }).values.markdown, true);
});

test("arrays are copied and invalid arrays fall back to the default", () => {
  const raw = { customBranchGlobPatterns: [{ name: "Feature", glob: "heads/feature/*" }] };
  const result = normalizeSettings(raw);
  assert.deepEqual(result.values.customBranchGlobPatterns, raw.customBranchGlobPatterns);
  assert.notEqual(result.values.customBranchGlobPatterns, raw.customBranchGlobPatterns);
  raw.customBranchGlobPatterns.push({ name: "Other", glob: "heads/other/*" });
  assert.equal(result.values.customBranchGlobPatterns.length, 1);
  assert.equal(result.presentation.customBranchGlobPatterns.length, 1);

  const rejected = normalizeSettings({ customBranchGlobPatterns: "heads/*" });
  assert.deepEqual(rejected.values.customBranchGlobPatterns, []);
  assert.deepEqual(rejected.presentation.customBranchGlobPatterns, []);
  assert.ok(invalidHas(rejected, "customBranchGlobPatterns", /expected array/));
});

test("objects are shallow-copied and invalid objects fall back to the default", () => {
  const raw = { contextMenuActionsVisibility: { branch: { checkout: false } } };
  const result = normalizeSettings(raw);
  assert.deepEqual(result.values.contextMenuActionsVisibility, raw.contextMenuActionsVisibility);
  assert.notEqual(result.values.contextMenuActionsVisibility, raw.contextMenuActionsVisibility);
  raw.contextMenuActionsVisibility.branch.checkout = true;
  assert.deepEqual(result.presentation.contextMenuVisibility, { branch: { checkout: false } });

  const rejected = normalizeSettings({ contextMenuActionsVisibility: "everything" });
  assert.deepEqual(rejected.values.contextMenuActionsVisibility, {});
  assert.deepEqual(rejected.presentation.contextMenuVisibility, {});
  assert.ok(invalidHas(rejected, "contextMenuActionsVisibility", /expected object/));
});

test("strings are not coerced from other types", () => {
  const result = normalizeSettings({ fileEncoding: 42, "date.format": ["Date & Time"] });
  assert.equal(result.values.fileEncoding, "utf8");
  assert.equal(result.presentation.fileEncoding, "utf8");
  assert.equal(result.values["date.format"], "Date & Time");
  assert.ok(invalidHas(result, "fileEncoding", /expected string/));
  assert.ok(invalidHas(result, "date.format", /expected string/));
});

test("enum-invalid strings fall back to the declared default", () => {
  const result = normalizeSettings({
    "graph.style": "square",
    "date.type": "Committer Date",
    repositoryDropdownOrder: "Path",
    "referenceLabels.alignment": "Left",
  });
  assert.equal(result.values["graph.style"], "rounded");
  assert.equal(result.values["date.type"], "Author Date");
  assert.equal(result.values.repositoryDropdownOrder, "Workspace Full Path");
  assert.equal(result.values["referenceLabels.alignment"], "Normal");
  assert.equal(result.presentation.graphStyle, "rounded");
  assert.ok(invalidHas(result, "graph.style", /expected one of/));
  assert.ok(invalidHas(result, "date.type", /expected one of/));
  assert.ok(invalidHas(result, "repositoryDropdownOrder", /expected one of/));
});

test("aliases inherit their canonical enum validation after folding", () => {
  const result = normalizeSettings({ graphStyle: "diagonal" });
  assert.equal(result.values["graph.style"], "rounded");
  assert.equal(result.presentation.graphStyle, "rounded");
  assert.ok(invalidHas(result, "graphStyle", /expected one of/));
});

test("unknown keys are reported; host keys and extensions are not", () => {
  const result = normalizeSettings({
    graphStyle: "angular",
    repoPath: "/tmp/repo",
    maxCommits: 25,
    showEmoji: false,
    customUnknownKey: 1,
    anotherUnknownKey: "x",
  });
  assert.deepEqual(result.unknown, ["customUnknownKey", "anotherUnknownKey"]);
  assert.equal(result.values.showEmoji, false);
  assert.equal(result.values.repoPath, undefined);
  assert.equal(result.values.maxCommits, undefined);
});

test("still-unsupported upstream keys normalize into values without touching presentation", () => {
  const result = normalizeSettings({
    "repository.showUncommittedChanges": false,
    "repository.sign.commits": true,
    "graph.uncommittedChanges": "Open Circle at the Checked Out Commit",
    "dialog.rebase.launchInteractiveRebase": true,
  });
  assert.equal(result.values["repository.showUncommittedChanges"], false);
  assert.equal(result.values["repository.sign.commits"], true);
  assert.equal(result.values["graph.uncommittedChanges"], "Open Circle at the Checked Out Commit");
  assert.equal(result.values["dialog.rebase.launchInteractiveRebase"], true);
  assert.deepEqual(result.invalid, []);
  assert.equal(result.presentation.dialogDefaults.rebase, undefined);
  assert.deepEqual(result.presentation, normalizeSettings({}).presentation);
});

test("issueUrlTemplate and fileEncoding are validated before forwarding", () => {
  assert.equal(normalizeSettings({ issueUrlTemplate: " https://x.test/{id} " }).presentation.issueUrlTemplate, "https://x.test/{id}");
  const newline = normalizeSettings({ issueUrlTemplate: "https://x.test/\n{id}" });
  assert.equal(newline.presentation.issueUrlTemplate, "");
  assert.ok(invalidHas(newline, "issueUrlTemplate", /control characters/));

  assert.equal(normalizeSettings({ fileEncoding: "latin1" }).presentation.fileEncoding, "latin1");
  const blank = normalizeSettings({ fileEncoding: "   " });
  assert.equal(blank.presentation.fileEncoding, "utf8");
  assert.ok(invalidHas(blank, "fileEncoding", /invalid encoding/));
});

/* ------------------------------------------------------------------------- */
/* Keyboard shortcuts                                                         */
/* ------------------------------------------------------------------------- */

test("default shortcuts resolve to CTRL/CMD + letter records", () => {
  const result = normalizeSettings({});
  assert.deepEqual(result.presentation.shortcuts, {
    find: shortcut("f", { ctrl: true, meta: true }),
    refresh: shortcut("r", { ctrl: true, meta: true }),
    scrollToHead: shortcut("h", { ctrl: true, meta: true }),
    scrollToStash: shortcut("s", { ctrl: true, meta: true }),
  });
  for (const record of Object.values(result.presentation.shortcuts)) {
    assert.deepEqual(Object.keys(record), ["key", "ctrl", "meta", "alt", "shift"]);
  }
});

test("shortcut descriptors parse CMD/CTRL/ALT/SHIFT and function keys", () => {
  assert.deepEqual(parseShortcut("CTRL/CMD + F"), { shortcut: shortcut("f", { ctrl: true, meta: true }), error: null });
  assert.deepEqual(parseShortcut("CTRL + H"), { shortcut: shortcut("h", { ctrl: true }), error: null });
  assert.deepEqual(parseShortcut("CMD + R"), { shortcut: shortcut("r", { meta: true }), error: null });
  assert.deepEqual(parseShortcut("META + 1"), { shortcut: shortcut("1", { meta: true }), error: null });
  assert.deepEqual(parseShortcut("ALT + SHIFT + F5"), { shortcut: shortcut("f5", { alt: true, shift: true }), error: null });
  assert.deepEqual(parseShortcut("shift + alt + p"), { shortcut: shortcut("p", { alt: true, shift: true }), error: null });
  assert.deepEqual(parseShortcut("CTRL/CMD+SHIFT+F12"), { shortcut: shortcut("f12", { ctrl: true, meta: true, shift: true }), error: null });
  assert.deepEqual(parseShortcut("PAGEUP"), { shortcut: shortcut("pageup"), error: null });
  assert.deepEqual(parseShortcut("UNASSIGNED"), { shortcut: shortcut(""), error: null });
  assert.deepEqual(parseShortcut("  "), { shortcut: shortcut(""), error: null });
});

test("garbage shortcut descriptors report an error instead of throwing", () => {
  for (const descriptor of ["HYPER + Q", "CTRL +", "+ F", "A + B", "CTRL + SHIFT", 42, null, {}, []]) {
    const parsed = parseShortcut(descriptor);
    assert.equal(parsed.shortcut, null, `unexpected parse for ${String(descriptor)}`);
    assert.equal(typeof parsed.error, "string");
    assert.ok(parsed.error.length > 0);
  }
});

test("an unparsable configured shortcut falls back to its default and is reported", () => {
  for (const slot of ["find", "refresh", "scrollToHead", "scrollToStash"]) {
    const key = `keyboardShortcut.${slot}`;
    const result = normalizeSettings({ [key]: "HYPER + Q" });
    assert.deepEqual(result.presentation.shortcuts[slot], DEFAULT_PRESENTATION.shortcuts[slot]);
    assert.ok(invalidHas(result, key, /unknown key token .* default/), `missing fallback report for ${key}`);
    assert.ok(result.invalid.some((entry) => entry.key === key && entry.value === "HYPER + Q"));
  }
});

test("configured shortcuts override each default", () => {
  const result = normalizeSettings({
    "keyboardShortcut.find": "ALT + SHIFT + F5",
    "keyboardShortcut.refresh": "CMD + ALT + R",
    "keyboardShortcut.scrollToHead": "SHIFT + H",
    "keyboardShortcut.scrollToStash": "CTRL + S",
  });
  assert.deepEqual(result.presentation.shortcuts, {
    find: shortcut("f5", { alt: true, shift: true }),
    refresh: shortcut("r", { meta: true, alt: true }),
    scrollToHead: shortcut("h", { shift: true }),
    scrollToStash: shortcut("s", { ctrl: true }),
  });
  assert.deepEqual(result.invalid, []);
  assert.deepEqual(result.presentation.shortcuts, result.shortcuts);
});

test("a non-string shortcut value is coerced to the default with a type report", () => {
  const result = normalizeSettings({ "keyboardShortcut.find": 42 });
  assert.deepEqual(result.presentation.shortcuts.find, DEFAULT_PRESENTATION.shortcuts.find);
  assert.ok(invalidHas(result, "keyboardShortcut.find", /expected string/));
});

/* ------------------------------------------------------------------------- */
/* Robustness                                                                 */
/* ------------------------------------------------------------------------- */

test("normalizeSettings never throws on hostile or non-object input", () => {
  const throwingProxy = new Proxy(
    {},
    {
      get() {
        throw new Error("boom");
      },
      ownKeys() {
        throw new Error("boom");
      },
      getOwnPropertyDescriptor() {
        throw new Error("boom");
      },
    },
  );
  const throwingGetter = { markdown: true };
  Object.defineProperty(throwingGetter, "graph.style", {
    enumerable: true,
    get() {
      throw new Error("boom");
    },
  });

  const inputs = [undefined, null, 42, "config", true, [], [1, 2], () => {}, Symbol("x"), Object.create(null), throwingProxy, throwingGetter];
  for (const [index, input] of inputs.entries()) {
    let result;
    assert.doesNotThrow(() => {
      result = normalizeSettings(input);
    }, `normalizeSettings threw for input #${index}`);
    assert.deepEqual(Object.keys(result.presentation), CONTRACT_PRESENTATION_KEYS);
    assert.deepEqual(result.values["graph.style"], "rounded");
  }
  assert.deepEqual(normalizeSettings(throwingProxy).presentation, DEFAULT_PRESENTATION);
});

test("schemastery-style field wrappers are unwrapped like lib/index.js does", () => {
  const result = normalizeSettings({
    "graph.style": { get: () => "angular" },
    "graph.colours": { get: () => ["#123456"] },
    showEmoji: { get: () => false },
  });
  assert.equal(result.presentation.graphStyle, "angular");
  assert.deepEqual(result.presentation.graphColours, ["#123456"]);
  assert.equal(result.presentation.showEmoji, false);
});

test("the parity document contains one row per key and the matching counts", () => {
  const document = fs.readFileSync(new URL("../docs/settings-parity.md", import.meta.url), "utf8");
  const keyTable = document.slice(document.indexOf("## Key table"));
  const rows = keyTable
    .split("\n")
    .map((line) => /^\|\s*`([^`]+)`\s*\|/.exec(line))
    .filter((match) => match !== null)
    .map((match) => match[1]);
  assert.deepEqual(rows, SETTINGS.map((setting) => setting.key));

  const mapped = SETTINGS.filter((setting) => setting.wiring === "mapped").length;
  const vscodeOnly = SETTINGS.filter((setting) => setting.wiring === "vscode-only").length;
  const outOfScope = SETTINGS.filter((setting) => setting.wiring === "out-of-scope").length;
  assert.match(document, /110 configuration keys/);
  assert.match(document, new RegExp(`mapped[^\\n]*\\b${mapped}\\b`));
  assert.match(document, new RegExp(`vscode-only[^\\n]*\\b${vscodeOnly}\\b`));
  assert.match(document, new RegExp(`out-of-scope[^\\n]*\\b${outOfScope}\\b`));
  assert.match(document, /29 (?:legacy )?aliases/);
  assert.match(document, /how this is verified/i);
  assert.match(document, /node --test/);
});
