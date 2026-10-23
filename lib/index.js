import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_MAX_COMMITS,
  GitGraphError,
  MAX_COMMITS_LIMIT,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
  SEARCH_MAX_QUERY_LENGTH,
  SEARCH_SCOPES,
  createGitApi,
  createGitRunner,
  isValidRefName,
  isValidRepoPath,
} from "./git.js";
import { CANONICAL_KEYS, SETTINGS, normalizeSettings } from "./settings.js";

export const name = "dsh-git-graph";

export const ROUTE_PREFIX = "/api/dsh-git-graph";

const ROUTE_MAX_COMMITS_LIMIT = MAX_COMMITS_LIMIT;

const TOOL_MAX_COMMITS_LIMIT = 500;

const TOOL_LOG_LINES = 100;

const DIFF_SCOPES = new Set(["commit", "staged", "unstaged", "compare", "working"]);

const ACTION_FIELDS = {
  checkoutBranch: ["branch"],
  checkoutCommit: ["hash"],
  createBranch: ["name", "startPoint"],
  deleteBranch: ["name", "force"],
  renameBranch: ["name", "newName"],
  cherryPick: ["hash"],
  revertCommit: ["hash"],
  /* Web client menu alias for revertCommit. */
  revert: ["hash"],
  createTag: ["name", "hash"],
  deleteTag: ["name"],
  fetch: ["remote", "prune", "pruneTags"],
  fetchIntoLocalBranch: ["remote", "branch", "local"],
  merge: ["hash", "noFastForward", "noCommit", "squash"],
  mergeCommit: ["hash"],
  resetToCommit: ["hash", "mode"],
  pullBranch: ["remote", "branch", "noFastForward", "rebase"],
  pushBranch: ["remote", "branch", "setUpstream", "force"],
  pushToMultipleRemotes: ["branch", "remotes"],
  rebase: ["onto"],
  dropCommit: ["hash"],
  pushTag: ["name", "remote"],
  stashPush: ["includeUntracked", "message"],
  stashUncommitted: ["includeUntracked"],
  stashApply: ["index", "reinstateIndex"],
  stashPop: ["index", "reinstateIndex"],
  stashDrop: ["index"],
  branchFromStash: ["index", "name"],
  cleanUntracked: ["dryRun"],
  resetUncommitted: ["mode"],
  resetFileToRevision: ["path", "hash"],
  addRemote: ["name", "url"],
  editRemote: ["name", "url"],
  deleteRemote: ["name"],
  pruneRemote: ["name"],
};

function readConfigValue(source, key) {
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

/** Reads the host-level config defensively. */
export function normalizeConfig(raw) {
  const source = raw !== null && typeof raw === "object" ? raw : {};
  const repoPathValue = readConfigValue(source, "repoPath");
  const maxCommitsValue = readConfigValue(source, "maxCommits");
  const showRemoteValue = readConfigValue(source, "showRemoteBranches");
  const maxCommits =
    Number.isSafeInteger(maxCommitsValue) && maxCommitsValue > 0 ? Math.min(maxCommitsValue, MAX_COMMITS_LIMIT) : DEFAULT_MAX_COMMITS;
  return {
    repoPath: typeof repoPathValue === "string" && repoPathValue.trim().length > 0 ? repoPathValue.trim() : "",
    maxCommits,
    showRemoteBranches: showRemoteValue === undefined || showRemoteValue === null ? true : Boolean(showRemoteValue),
  };
}

const CONFIGURED_ORDERS = new Set(["date", "author-date", "topo"]);

const INITIAL_LOAD_DEFAULT = (() => {
  const setting = SETTINGS.find((entry) => entry.key === "repository.commits.initialLoad");
  return setting !== undefined && Number.isSafeInteger(setting.default) && setting.default > 0 ? setting.default : DEFAULT_MAX_COMMITS;
})();

/** Contract §6 repository-local overrides. */
const REPO_CONFIG_FILE = ".gitgraph.json";
const REPO_CONFIG_MAX_BYTES = 128 * 1024;
const REPO_CONFIG_VERSION = 1;
const REPO_CONFIG_ACTIONS = new Set(["status", "export", "import", "clear"]);

const REVIEW_SCOPES_LIMIT = 100;

const SETTING_DEFAULTS = new Map(SETTINGS.map((setting) => [setting.key, setting.default]));

const SETTING_KEYS = new Set(SETTINGS.map((setting) => setting.key));

function normalizeConfiguredPageSize(value) {
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return Math.min(value, ROUTE_MAX_COMMITS_LIMIT);
}

/** Canonical key wins over the legacy key. */
function resolveLegacyBoolean(raw, canonicalKey, legacyKey, settingsValue) {
  if (readConfigValue(raw, canonicalKey) !== undefined) return settingsValue;
  const legacy = readConfigValue(raw, legacyKey);
  if (legacy === undefined || legacy === null) return settingsValue;
  return typeof legacy === "boolean" ? legacy : Boolean(legacy);
}

function normalizePresentation(raw) {
  return normalizeSettings(raw).presentation;
}

/** Single derivation for apply and the repo-override path. */
function deriveRuntimeConfig(hostConfig, rawConfig, settings) {
  const values = settings.values;
  const fetchAvatars = values["repository.commits.fetchAvatars"] === true;
  const presentation = { ...normalizePresentation(rawConfig), avatars: fetchAvatars };
  const customPullRequestProviders = Array.isArray(values.customPullRequestProviders) ? values.customPullRequestProviders : [];

  /* Legacy host keys stay honoured. */
  const showRemoteBranches = resolveLegacyBoolean(
    rawConfig,
    "repository.showRemoteBranches",
    "showRemoteBranches",
    values["repository.showRemoteBranches"] === true,
  );
  const showStashes = resolveLegacyBoolean(rawConfig, "repository.showStashes", "showStashes", values["repository.showStashes"] === true);

  /* Page default: host maxCommits, then the initialLoad setting. */
  const configuredMax = normalizeConfiguredPageSize(readConfigValue(rawConfig, "maxCommits"));
  const initialLoad = normalizeConfiguredPageSize(values["repository.commits.initialLoad"]) ?? INITIAL_LOAD_DEFAULT;
  const maxCommits = configuredMax ?? initialLoad ?? hostConfig.maxCommits;

  const configuredOrder = values["repository.commits.order"];
  const defaultOrder = CONFIGURED_ORDERS.has(configuredOrder) ? configuredOrder : undefined;

  return {
    ...hostConfig,
    showRemoteBranches,
    maxCommits,
    showStashes,
    showTags: values["repository.showTags"] === true,
    showRemoteHeads: values["repository.showRemoteHeads"] === true,
    onlyFollowFirstParent: values["repository.onlyFollowFirstParent"] === true,
    includeCommitsMentionedByReflogs: values["repository.includeCommitsMentionedByReflogs"] === true,
    showCommitsOnlyReferencedByTags: values["repository.showCommitsOnlyReferencedByTags"] === true,
    useMailmap: values["repository.useMailmap"] === true,
    showUntrackedFiles: values["repository.showUntrackedFiles"] === true,
    fetchAndPrune: values["repository.fetchAndPrune"] === true,
    fetchAndPruneTags: values["repository.fetchAndPruneTags"] === true,
    fetchAvatars,
    customPullRequestProviders,
    defaultOrder,
    presentation,
    /* Repo-config export needs the effective values. */
    values,
  };
}

function jsonEqual(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => jsonEqual(entry, right[index]));
  }
  if (left !== null && right !== null && typeof left === "object" && typeof right === "object") {
    const leftKeys = Object.keys(left);
    if (leftKeys.length !== Object.keys(right).length) return false;
    return leftKeys.every((key) => Object.hasOwn(right, key) && jsonEqual(left[key], right[key]));
  }
  return false;
}

/** Reads `.gitgraph.json`; failures are reported, not thrown. */
function readRepoConfigFile(filePath) {
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return { present: false, valid: false, settings: {}, error: null, bytes: 0 };
  }
  if (!stats.isFile()) return { present: true, valid: false, settings: {}, error: "not a regular file", bytes: 0 };
  if (stats.size > REPO_CONFIG_MAX_BYTES) {
    return {
      present: true,
      valid: false,
      settings: {},
      error: `file is larger than ${REPO_CONFIG_MAX_BYTES / 1024} KiB (${REPO_CONFIG_MAX_BYTES} bytes)`,
      bytes: stats.size,
    };
  }
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return { present: true, valid: false, settings: {}, error: `could not read the file (${error instanceof Error ? error.message : String(error)})`, bytes: stats.size };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { present: true, valid: false, settings: {}, error: `invalid JSON (${error instanceof Error ? error.message : String(error)})`, bytes: stats.size };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { present: true, valid: false, settings: {}, error: "expected a JSON object", bytes: stats.size };
  }
  if (parsed.version !== REPO_CONFIG_VERSION) {
    return { present: true, valid: false, settings: {}, error: `unsupported version ${JSON.stringify(parsed.version)}`, bytes: stats.size };
  }
  if (parsed.settings === null || typeof parsed.settings !== "object" || Array.isArray(parsed.settings)) {
    return { present: true, valid: false, settings: {}, error: "settings must be an object", bytes: stats.size };
  }
  return { present: true, valid: true, settings: parsed.settings, error: null, bytes: stats.size };
}

function mergeRepoSettings(baseRaw, repoSettings) {
  const merged = { ...(baseRaw !== null && typeof baseRaw === "object" ? baseRaw : {}) };
  for (const [key, value] of Object.entries(repoSettings)) {
    if (key === "repoPath" || key === "maxCommits") continue;
    merged[key] = value;
  }
  return merged;
}

/** Caches by mtime so file edits apply without a restart. */
async function requestConfig(deps, cwd) {
  const base = deps.config;
  const cache = deps.repoConfigCache;
  if (!(cache instanceof Map)) return base;
  let detection;
  try {
    detection = await deps.git.detectRepo(cwd);
  } catch {
    return base;
  }
  if (!detection.isRepo || typeof detection.repoPath !== "string" || detection.repoPath.length === 0) return base;
  const repoPath = detection.repoPath;
  const filePath = path.join(repoPath, REPO_CONFIG_FILE);
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    cache.delete(repoPath);
    return { ...base, runtimeRepoPath: repoPath };
  }
  const cached = cache.get(repoPath);
  if (cached !== undefined && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return cached.runtime.runtimeRepoPath ? cached.runtime : { ...cached.runtime, runtimeRepoPath: repoPath };
  }
  const file = readRepoConfigFile(filePath);
  let runtime = { ...base, runtimeRepoPath: repoPath };
  if (file.valid) {
    const mergedRaw = mergeRepoSettings(deps.rawConfig, file.settings);
    runtime = {
      ...deriveRuntimeConfig(deps.hostConfig, mergedRaw, normalizeSettings(mergedRaw)),
      maxDepthOfRepoSearch: base.maxDepthOfRepoSearch,
      runtimeRepoPath: repoPath,
    };
  }
  cache.set(repoPath, {
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    runtime,
    settings: file.valid ? file.settings : {},
    valid: file.valid,
    error: file.error,
  });
  return runtime;
}

const REPO_SEARCH_SKIP = new Set(["node_modules", ".git", "dist", "build"]);

const REPO_SEARCH_MAX_DIRECTORIES = 2000;
const REPO_SEARCH_MAX_REPOSITORIES = 50;
const REPO_SEARCH_MAX_DEPTH = 8;

const REPO_SEARCH_DEFAULT_DEPTH = 1;

function realPathOrSelf(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

function isPathInside(parentReal, childReal) {
  const relative = path.relative(parentReal, childReal);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isRepoRoot(directory) {
  try {
    return fs.existsSync(path.join(directory, ".git"));
  } catch {
    return false;
  }
}

function normalizeSearchDepth(value, fallback) {
  if (!Number.isSafeInteger(value) || value < 0) return fallback;
  return Math.min(value, REPO_SEARCH_MAX_DEPTH);
}

function discoverRepos(root, maxDepth, currentRepoPath) {
  const rootPath = path.resolve(root);
  const currentReal = currentRepoPath === null ? null : realPathOrSelf(currentRepoPath);
  const repos = [];
  const seen = new Set();
  let visited = 0;
  let truncated = false;

  const addRepo = (directory) => {
    const real = realPathOrSelf(directory);
    if (seen.has(real)) return;
    if (repos.length >= REPO_SEARCH_MAX_REPOSITORIES) {
      truncated = true;
      return;
    }
    seen.add(real);
    repos.push({ path: real, name: path.basename(real) || real, isCurrent: false });
    if (repos.length >= REPO_SEARCH_MAX_REPOSITORIES) truncated = true;
  };

  if (isRepoRoot(rootPath)) {
    /* A repo workspace is included, never descended. */
    addRepo(rootPath);
  } else {
    let level = [rootPath];
    for (let depth = 0; depth <= maxDepth && level.length > 0 && !truncated; depth += 1) {
      const nextLevel = [];
      for (const directory of level) {
        if (visited >= REPO_SEARCH_MAX_DIRECTORIES) {
          truncated = true;
          break;
        }
        visited += 1;
        let entries;
        try {
          entries = fs.readdirSync(directory, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          if (REPO_SEARCH_SKIP.has(entry.name)) continue;
          if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
          const child = path.join(directory, entry.name);
          let stats;
          try {
            stats = fs.statSync(child);
          } catch {
            continue;
          }
          if (!stats.isDirectory()) continue;
          visited += 1;
          if (visited > REPO_SEARCH_MAX_DIRECTORIES) {
            truncated = true;
            break;
          }
          if (isRepoRoot(child)) {
            addRepo(child);
            continue;
          }
          if (depth + 1 < maxDepth) nextLevel.push(child);
        }
        if (truncated) break;
      }
      level = nextLevel;
    }
  }

  if (currentReal !== null && !seen.has(currentReal)) {
    /* The session repo is always reported. */
    repos.unshift({ path: currentReal, name: path.basename(currentReal) || currentReal, isCurrent: true });
  }
  for (const repo of repos) repo.isCurrent = currentReal !== null && repo.path === currentReal;
  return { repos, truncated };
}

/* Underscored: the storage medium rejects the hyphenated name. */
const REVIEW_DOMAIN_NAME = "dsh_git_graph";

const REVIEW_COLLECTION = "reviews";

const REVIEW_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const REVIEW_MAX_ENTRIES = 200;

const REVIEW_ACTIONS = new Set(["read", "toggle", "clear", "scopes", "end"]);
const REVIEW_KINDS = new Set(["commit", "compare"]);

function normalizeStoredReviewRecord(value) {
  const entries = [];
  const rawEntries = value !== null && typeof value === "object" && Array.isArray(value.entries) ? value.entries : [];
  for (const raw of rawEntries) {
    if (raw === null || typeof raw !== "object") continue;
    if (raw.kind !== "commit" && raw.kind !== "compare") continue;
    if (typeof raw.base !== "string" || raw.base.length === 0) continue;
    if (typeof raw.head !== "string" || raw.head.length === 0) continue;
    if (!Number.isFinite(raw.updatedAt)) continue;
    const files = {};
    if (raw.files !== null && typeof raw.files === "object" && !Array.isArray(raw.files)) {
      for (const [file, reviewedAt] of Object.entries(raw.files)) {
        if (typeof file === "string" && file.length > 0 && Number.isFinite(reviewedAt)) files[file] = reviewedAt;
      }
    }
    /* Older entries have no repoPath. */
    const repoPath = typeof raw.repoPath === "string" && raw.repoPath.length > 0 ? raw.repoPath : null;
    entries.push({ kind: raw.kind, base: raw.base, head: raw.head, repoPath, files, updatedAt: raw.updatedAt });
  }
  return { entries };
}

function pruneReviewEntries(entries, now) {
  const fresh = entries.filter((entry) => now - entry.updatedAt <= REVIEW_RETENTION_MS);
  let kept = fresh;
  let pruned = fresh.length !== entries.length;
  if (kept.length > REVIEW_MAX_ENTRIES) {
    const sorted = [...kept].sort((left, right) => left.updatedAt - right.updatedAt);
    kept = sorted.slice(sorted.length - REVIEW_MAX_ENTRIES);
    pruned = true;
  }
  return { entries: kept, pruned };
}

/* Hand-built to keep the "node: builtins only" import rule. */
const REVIEW_DOMAIN_SPEC = {
  name: REVIEW_DOMAIN_NAME,
  version: 1,
  tables: {
    [REVIEW_COLLECTION]: {
      valueSchema: {
        parse(value) {
          return normalizeStoredReviewRecord(value);
        },
      },
    },
  },
};

function getService(ctx, serviceName) {
  if (ctx === null || typeof ctx !== "object" || typeof ctx.get !== "function") return undefined;
  try {
    return ctx.get(serviceName);
  } catch {
    return undefined;
  }
}

function fallbackDirectory(ctx) {
  const workingDirectory = getService(ctx, "workingDirectory");
  const directory = workingDirectory?.defaultDirectory;
  if (typeof directory === "string" && directory.length > 0) return directory;
  return process.cwd();
}

function sessionDirectory(ctx, sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) return undefined;
  const sessions = getService(ctx, "sessions");
  if (sessions === undefined || sessions === null || typeof sessions.get !== "function") return undefined;
  let session;
  try {
    session = sessions.get(sessionId);
  } catch {
    return undefined;
  }
  if (session === null || typeof session !== "object") return undefined;
  const workingDirectory = getService(ctx, "workingDirectory");
  let directory;
  try {
    directory = workingDirectory?.get?.(session);
  } catch {
    directory = undefined;
  }
  if (typeof directory !== "string" || directory.length === 0) {
    const header = session.header;
    directory = typeof header?.cwd === "string" ? header.cwd : undefined;
  }
  return typeof directory === "string" && directory.length > 0 ? directory : undefined;
}

/** Resolves the request directory and fences it to the workspace. */
export function resolveCwd(ctx, sessionId, requestedPath, options = {}) {
  const fallback = fallbackDirectory(ctx);
  const workspace = sessionDirectory(ctx, sessionId) ?? fallback;
  let cwd = workspace;
  if (typeof requestedPath === "string" && requestedPath.length > 0) {
    cwd = path.isAbsolute(requestedPath) ? path.normalize(requestedPath) : path.resolve(workspace, requestedPath);
  }
  const repoPath = typeof options.repoPath === "string" ? options.repoPath : "";
  if (repoPath.length > 0) {
    /* repoPath is exempt from the fence. */
    cwd = path.isAbsolute(repoPath) ? path.normalize(repoPath) : path.resolve(workspace, repoPath);
    return { cwd, workspace };
  }
  const workspaceReal = realPathOrSelf(workspace);
  const cwdReal = realPathOrSelf(cwd);
  if (!isPathInside(workspaceReal, cwdReal)) {
    throw new GitGraphError(
      "OUTSIDE_WORKSPACE",
      `refusing path ${cwd}: it resolves outside the session workspace ${workspace} (the repoPath config override is exempt from this check)`,
    );
  }
  return { cwd, workspace };
}

function normalizeLimit(value, fallback, maximum) {
  if (!Number.isSafeInteger(value) || value < 1) return fallback;
  return Math.min(value, maximum);
}

function badRequest(message) {
  return new GitGraphError("BAD_REQUEST", message);
}

function errorPayload(error) {
  if (error instanceof GitGraphError) {
    // Keep git's own stderr so the UI can show the raw output.
    const detail = [error.stderr, error.stdout].map((part) => (typeof part === "string" ? part.trim() : "")).filter((part) => part !== "").join("\n");
    return { code: error.code, message: error.message, ...(detail === "" ? {} : { output: detail }) };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { code: "INTERNAL", message };
}

async function readRequestBody(request) {
  if (request === null || typeof request !== "object" || typeof request.text !== "function") return undefined;
  let raw;
  try {
    raw = await request.text();
  } catch {
    return undefined;
  }
  if (typeof raw !== "string" || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function handleGraph(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const config = await requestConfig(deps, resolved.cwd);
  const limit = normalizeLimit(body.limit, config.maxCommits, ROUTE_MAX_COMMITS_LIMIT);
  const order = body.order === undefined || body.order === null || body.order === "" ? config.defaultOrder : body.order;
  const value = await deps.git.readGraph(resolved.cwd, {
    repoPath: config.runtimeRepoPath,
    maxCommits: limit,
    showRemoteBranches: config.showRemoteBranches,
    showRemoteHeads: config.showRemoteHeads,
    showTags: config.showTags,
    showCommitsOnlyReferencedByTags: config.showCommitsOnlyReferencedByTags,
    firstParent: config.onlyFollowFirstParent,
    includeReflogCommits: config.includeCommitsMentionedByReflogs,
    branches: body.branches,
    order,
    showStashes: config.showStashes,
    useMailmap: config.useMailmap,
    fetchAvatars: config.fetchAvatars,
  });
  return { ...value, workspacePath: resolved.workspace, presentation: config.presentation };
}

function normalizeSearchLimit(value) {
  if (value === undefined || value === null) return SEARCH_DEFAULT_LIMIT;
  if (!Number.isSafeInteger(value) || value < 1 || value > SEARCH_MAX_LIMIT) {
    throw badRequest(`invalid limit: ${JSON.stringify(value)}; expected an integer between 1 and ${SEARCH_MAX_LIMIT}`);
  }
  return value;
}

function normalizeSearchOffset(value) {
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw badRequest(`invalid offset: ${JSON.stringify(value)}; expected an integer >= 0`);
  }
  return value;
}

async function handleSearch(deps, body) {
  const rawQuery = body.query;
  if (typeof rawQuery !== "string" || rawQuery.trim().length === 0) throw badRequest("query is required");
  const query = rawQuery.trim();
  if (query.length > SEARCH_MAX_QUERY_LENGTH) {
    throw badRequest(`invalid query: must be at most ${SEARCH_MAX_QUERY_LENGTH} characters`);
  }
  const rawScope = body.scope;
  const scope = rawScope === undefined || rawScope === null || rawScope === "" ? "all" : rawScope;
  if (typeof scope !== "string" || !SEARCH_SCOPES.has(scope)) {
    throw badRequest(`invalid scope: ${JSON.stringify(rawScope)}; expected all, message, author or ref`);
  }
  const limit = normalizeSearchLimit(body.limit);
  const offset = normalizeSearchOffset(body.offset);
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const config = await requestConfig(deps, resolved.cwd);
  return deps.git.searchCommits(resolved.cwd, {
    repoPath: config.runtimeRepoPath,
    query,
    scope,
    limit,
    offset,
    useMailmap: config.useMailmap,
  });
}

async function handleCommit(deps, body) {
  const hash = body.hash;
  if (typeof hash !== "string" || hash.length === 0) throw badRequest("hash is required");
  if (!isValidRefName(hash)) throw badRequest(`invalid hash: ${JSON.stringify(hash)}`);
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const config = await requestConfig(deps, resolved.cwd);
  return deps.git.readCommit(resolved.cwd, hash, { repoPath: config.runtimeRepoPath, fetchAvatars: config.fetchAvatars });
}

async function handleDiff(deps, body) {
  const scope = body.scope === undefined || body.scope === null || body.scope === "" ? "commit" : body.scope;
  if (!DIFF_SCOPES.has(scope)) throw badRequest(`invalid scope: ${JSON.stringify(scope)}`);
  const file = body.file;
  if (typeof file !== "string" || file.length === 0) throw badRequest("file is required");
  if ((scope === "commit" || scope === "working") && (typeof body.hash !== "string" || body.hash.length === 0)) {
    throw badRequest("hash is required");
  }
  if (scope === "compare") {
    if (typeof body.base !== "string" || body.base.length === 0) throw badRequest("base is required");
    if (typeof body.head !== "string" || body.head.length === 0) throw badRequest("head is required");
  }
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readDiff(resolved.cwd, {
    scope,
    hash: body.hash,
    base: body.base,
    head: body.head,
    path: file,
    oldPath: typeof body.oldPath === "string" && body.oldPath.length > 0 ? body.oldPath : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
  });
}

async function handleUncommitted(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const config = await requestConfig(deps, resolved.cwd);
  const value = await deps.git.readUncommitted(resolved.cwd, {
    repoPath: config.runtimeRepoPath,
    includeUntracked: config.showUntrackedFiles !== false,
  });
  return { ...value, workspacePath: resolved.workspace };
}

async function handleCompare(deps, body) {
  const base = body.base;
  if (typeof base !== "string" || base.length === 0) throw badRequest("base is required");
  if (!isValidRefName(base)) throw badRequest(`invalid base: ${JSON.stringify(base)}`);
  if (body.working !== undefined && body.working !== null && typeof body.working !== "boolean") {
    throw badRequest("working must be a boolean");
  }
  const working = body.working === true;
  const head = body.head;
  if (!working) {
    if (typeof head !== "string" || head.length === 0) throw badRequest("head is required");
    if (!isValidRefName(head)) throw badRequest(`invalid head: ${JSON.stringify(head)}`);
  }
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.compareCommits(resolved.cwd, working ? { base, working: true } : { base, head });
}

/** Array rejected: the client caches per hash. */
async function handleContains(deps, body) {
  const hash = body.hash;
  if (Array.isArray(hash)) throw badRequest("hash must be a single ref, not an array");
  if (typeof hash !== "string" || hash.length === 0) throw badRequest("hash is required");
  if (!isValidRefName(hash)) throw badRequest(`invalid hash: ${JSON.stringify(hash)}`);
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readContains(resolved.cwd, hash);
}

async function handleStashes(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readStashes(resolved.cwd);
}

async function handleTag(deps, body) {
  const tagName = body.name;
  if (typeof tagName !== "string" || tagName.length === 0) throw badRequest("name is required");
  if (!isValidRefName(tagName)) throw badRequest(`invalid tag name: ${JSON.stringify(tagName)}`);
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readTag(resolved.cwd, tagName);
}

async function handleRemotes(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readRemotes(resolved.cwd);
}

async function handleRepos(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const maxDepth = normalizeSearchDepth(body.maxDepth, deps.config.maxDepthOfRepoSearch);
  const detection = await deps.git.detectRepo(resolved.workspace);
  const sessionRepo = detection.isRepo ? detection.repoPath : null;
  const discovered = discoverRepos(resolved.cwd, maxDepth, sessionRepo);
  return {
    workspacePath: resolved.cwd,
    maxDepth,
    repos: discovered.repos,
    ...(discovered.truncated ? { truncated: true } : {}),
  };
}

async function reviewTableFor(deps) {
  const state = deps.reviewState;
  if (state === null || state === undefined) return null;
  if (state.table !== null) return state.table;
  if (state.pending !== null) return state.pending;
  return null;
}

async function reviewTotal(deps, cwd, kind, base, head) {
  if (kind === "commit") return (await deps.git.readCommit(cwd, base)).stats.files;
  return (await deps.git.compareCommits(cwd, { base, head })).stats.files;
}

function reviewSessionKeys(table) {
  try {
    const keys = table.keys();
    return Array.isArray(keys) ? [...keys] : Array.from(keys ?? []);
  } catch {
    return [];
  }
}

async function reviewScopeRows(deps, table, now) {
  const rows = [];
  for (const sessionId of reviewSessionKeys(table)) {
    const normalized = normalizeStoredReviewRecord(table.get(sessionId));
    const pruned = pruneReviewEntries(normalized.entries, now);
    if (pruned.pruned) await table.put(sessionId, { entries: pruned.entries });
    for (const entry of pruned.entries) {
      let total = null;
      if (entry.repoPath !== null) {
        try {
          total = await reviewTotal(deps, entry.repoPath, entry.kind, entry.base, entry.head);
        } catch {
          /* A deleted/moved repo or commit must not break the listing. */
          total = null;
        }
      }
      rows.push({
        sessionId,
        repoPath: entry.repoPath,
        kind: entry.kind,
        base: entry.base,
        head: entry.head,
        reviewed: Object.keys(entry.files).length,
        total,
        updatedAt: entry.updatedAt,
      });
    }
  }
  rows.sort((left, right) => right.updatedAt - left.updatedAt);
  return rows.slice(0, REVIEW_SCOPES_LIMIT);
}

async function endReviewScopes(table, body, now) {
  const all = body.all === true;
  const requests = [];
  if (!all) {
    if (!Array.isArray(body.scopes)) throw badRequest("scopes must be an array of review scopes");
    for (const scope of body.scopes) {
      if (scope === null || typeof scope !== "object" || Array.isArray(scope)) throw badRequest("invalid review scope");
      if (typeof scope.sessionId !== "string" || scope.sessionId.length === 0) throw badRequest("review scope sessionId is required");
      if (typeof scope.kind !== "string" || !REVIEW_KINDS.has(scope.kind)) {
        throw badRequest(`invalid review kind: ${JSON.stringify(scope.kind)}`);
      }
      if (typeof scope.base !== "string" || !isValidRefName(scope.base)) {
        throw badRequest(`invalid review base: ${JSON.stringify(scope.base)}`);
      }
      if (typeof scope.head !== "string" || !isValidRefName(scope.head)) {
        throw badRequest(`invalid review head: ${JSON.stringify(scope.head)}`);
      }
      requests.push({ sessionId: scope.sessionId, kind: scope.kind, base: scope.base, head: scope.head });
    }
  }

  let ended = 0;
  for (const sessionId of reviewSessionKeys(table)) {
    const normalized = normalizeStoredReviewRecord(table.get(sessionId));
    const pruned = pruneReviewEntries(normalized.entries, now);
    let entries = pruned.entries;
    let changed = pruned.pruned;
    if (all) {
      ended += entries.length;
      entries = [];
      changed = true;
    } else {
      const wanted = requests.filter((scope) => scope.sessionId === sessionId);
      if (wanted.length > 0) {
        const remaining = entries.filter(
          (entry) => !wanted.some((scope) => scope.kind === entry.kind && scope.base === entry.base && scope.head === entry.head),
        );
        ended += entries.length - remaining.length;
        if (remaining.length !== entries.length) changed = true;
        entries = remaining;
      }
    }
    if (changed) await table.put(sessionId, { entries });
  }
  return { ended };
}

async function handleReview(deps, body) {
  const action = body.action;
  if (typeof action !== "string" || !REVIEW_ACTIONS.has(action)) throw badRequest(`invalid review action: ${JSON.stringify(action)}`);

  let kind;
  let base;
  let head;
  let file;
  if (action !== "scopes" && action !== "end") {
    kind = body.kind;
    if (typeof kind !== "string" || !REVIEW_KINDS.has(kind)) throw badRequest(`invalid review kind: ${JSON.stringify(kind)}`);
    base = body.base;
    head = body.head;
    if (typeof base !== "string" || base.length === 0) throw badRequest("base is required");
    if (typeof head !== "string" || head.length === 0) throw badRequest("head is required");
    if (!isValidRefName(base)) throw badRequest(`invalid base: ${JSON.stringify(base)}`);
    if (!isValidRefName(head)) throw badRequest(`invalid head: ${JSON.stringify(head)}`);
    if (kind === "commit" && base !== head) throw badRequest("commit reviews require base === head");
    if (action === "toggle") {
      if (typeof body.file !== "string" || body.file.length === 0) throw badRequest("file is required");
      if (!isValidRepoPath(body.file)) throw badRequest(`invalid file: ${JSON.stringify(body.file)}`);
      file = body.file;
    }
  }

  /* Fence before storage so OUTSIDE_WORKSPACE still wins. */
  const sessionKey = typeof body.sessionId === "string" && body.sessionId.length > 0 ? body.sessionId : "default";
  const resolved = action === "scopes" || action === "end" ? null : resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);

  const table = await reviewTableFor(deps);
  if (table === null) {
    throw new GitGraphError("UNAVAILABLE", "review storage is unavailable: the storageDomain service is not active");
  }
  const now = Date.now();

  if (action === "scopes") return { scopes: await reviewScopeRows(deps, table, now) };
  if (action === "end") return endReviewScopes(table, body, now);

  const normalized = normalizeStoredReviewRecord(table.get(sessionKey));
  const pruned = pruneReviewEntries(normalized.entries, now);
  if (pruned.pruned) await table.put(sessionKey, { entries: pruned.entries });
  const entries = pruned.entries;
  const matches = (entry) => entry.kind === kind && entry.base === base && entry.head === head;

  if (action === "clear") {
    const remaining = entries.filter((entry) => !matches(entry));
    if (remaining.length !== entries.length) await table.put(sessionKey, { entries: remaining });
    return { files: {}, total: 0, reviewed: 0 };
  }

  const total = await reviewTotal(deps, resolved.cwd, kind, base, head);
  if (action === "read") {
    const entry = entries.find(matches);
    const files = entry === undefined ? {} : { ...entry.files };
    return { files, total, reviewed: Object.keys(files).length };
  }

  /* Record the repo root for cross-workspace listing. */
  const detection = await deps.git.detectRepo(resolved.cwd);
  const repoPath = detection.isRepo && typeof detection.repoPath === "string" && detection.repoPath.length > 0 ? detection.repoPath : null;
  const index = entries.findIndex(matches);
  const current = index === -1 ? { kind, base, head, repoPath, files: {}, updatedAt: now } : entries[index];
  const files = { ...current.files };
  if (Object.hasOwn(files, file)) delete files[file];
  else files[file] = now;
  const nextEntries = entries.filter((_entry, position) => position !== index);
  nextEntries.push({ kind, base, head, repoPath, files, updatedAt: now });
  const capped = pruneReviewEntries(nextEntries, now);
  await table.put(sessionKey, { entries: capped.entries });
  return { files, total, reviewed: Object.keys(files).length };
}

async function handleAction(deps, body) {
  const action = body.action;
  if (typeof action !== "string" || action.length === 0) throw badRequest("action is required");
  const fields = ACTION_FIELDS[action];
  if (fields === undefined) throw badRequest(`unknown action: ${JSON.stringify(action)}`);
  const args = {};
  for (const field of fields) {
    if (body[field] !== undefined) args[field] = body[field];
  }
  /* Pruning is opt-in; the settings supply the defaults. */
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const config = await requestConfig(deps, resolved.cwd);
  if (action === "fetch") {
    if (args.prune === undefined) args.prune = config.fetchAndPrune;
    if (args.pruneTags === undefined) args.pruneTags = config.fetchAndPruneTags;
  }
  return deps.git.performAction(resolved.cwd, action, args);
}

async function handleArchive(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.archive(resolved.cwd, {
    ref: body.ref,
    format: body.format,
    workspacePath: resolved.workspace,
  });
}

async function handlePr(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const config = await requestConfig(deps, resolved.cwd);
  return deps.git.readPullRequest(resolved.cwd, {
    branch: body.branch,
    base: body.base,
    customProviders: config.customPullRequestProviders,
  });
}

async function handleRepoConfig(deps, body) {
  const action = body.action;
  if (typeof action !== "string" || !REPO_CONFIG_ACTIONS.has(action)) {
    throw badRequest(`invalid repository config action: ${JSON.stringify(action)}`);
  }
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const detection = await deps.git.detectRepo(resolved.cwd);
  if (!detection.isRepo || typeof detection.repoPath !== "string" || detection.repoPath.length === 0) return { isRepo: false };
  const repoPath = detection.repoPath;
  const filePath = path.join(repoPath, REPO_CONFIG_FILE);
  const relativePath = path.relative(resolved.workspace, filePath) || REPO_CONFIG_FILE;

  if (action === "status") {
    const file = readRepoConfigFile(filePath);
    return {
      isRepo: true,
      present: file.present,
      path: relativePath,
      valid: file.valid,
      keys: file.valid ? Object.keys(file.settings) : [],
      overrides: file.valid ? { ...file.settings } : {},
      ...(file.error === null ? {} : { error: file.error }),
    };
  }

  if (action === "export") {
    const config = await requestConfig(deps, repoPath);
    const values = config.values !== null && typeof config.values === "object" ? config.values : {};
    const settings = {};
    for (const key of CANONICAL_KEYS) {
      if (!Object.hasOwn(values, key)) continue;
      if (!jsonEqual(values[key], SETTING_DEFAULTS.get(key))) settings[key] = values[key];
    }
    const text = `${JSON.stringify({ version: REPO_CONFIG_VERSION, exportedAt: new Date().toISOString(), settings }, null, 2)}\n`;
    const bytes = Buffer.byteLength(text, "utf8");
    if (bytes > REPO_CONFIG_MAX_BYTES) throw badRequest("repository config export is too large");
    try {
      fs.writeFileSync(filePath, text, "utf8");
    } catch (error) {
      throw new GitGraphError("GIT_FAILED", `could not write ${REPO_CONFIG_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
    deps.repoConfigCache?.delete(repoPath);
    return { isRepo: true, path: relativePath, keys: Object.keys(settings), bytes };
  }

  if (action === "clear") {
    const existed = fs.existsSync(filePath);
    try {
      fs.rmSync(filePath, { force: true });
    } catch (error) {
      throw new GitGraphError("GIT_FAILED", `could not remove ${REPO_CONFIG_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    }
    deps.repoConfigCache?.delete(repoPath);
    return { isRepo: true, cleared: existed && !fs.existsSync(filePath), path: relativePath };
  }

  /* Remaining action: import. */
  const file = readRepoConfigFile(filePath);
  if (!file.present) throw badRequest(`no repository config file at ${JSON.stringify(relativePath)}`);
  if (!file.valid) throw badRequest(`invalid repository config file: ${file.error}`);
  const report = normalizeSettings(file.settings);
  const fileKeys = Object.keys(file.settings);
  const hostKeys = fileKeys.filter((key) => key === "repoPath" || key === "maxCommits");
  const unknown = [...report.unknown];
  for (const key of hostKeys) if (!unknown.includes(key)) unknown.push(key);
  const applied = fileKeys.filter((key) => SETTING_KEYS.has(key)).length;
  deps.repoConfigCache?.delete(repoPath);
  return { isRepo: true, applied, keys: fileKeys, unknown, invalid: report.invalid };
}

const ROUTES = [
  { route: `${ROUTE_PREFIX}/graph`, handler: handleGraph },
  { route: `${ROUTE_PREFIX}/search`, handler: handleSearch },
  { route: `${ROUTE_PREFIX}/commit`, handler: handleCommit },
  { route: `${ROUTE_PREFIX}/diff`, handler: handleDiff },
  { route: `${ROUTE_PREFIX}/action`, handler: handleAction },
  { route: `${ROUTE_PREFIX}/uncommitted`, handler: handleUncommitted },
  { route: `${ROUTE_PREFIX}/compare`, handler: handleCompare },
  { route: `${ROUTE_PREFIX}/stashes`, handler: handleStashes },
  { route: `${ROUTE_PREFIX}/tag`, handler: handleTag },
  { route: `${ROUTE_PREFIX}/remotes`, handler: handleRemotes },
  { route: `${ROUTE_PREFIX}/contains`, handler: handleContains },
  { route: `${ROUTE_PREFIX}/repos`, handler: handleRepos },
  { route: `${ROUTE_PREFIX}/review`, handler: handleReview },
  { route: `${ROUTE_PREFIX}/archive`, handler: handleArchive },
  { route: `${ROUTE_PREFIX}/pr`, handler: handlePr },
  { route: `${ROUTE_PREFIX}/repoconfig`, handler: handleRepoConfig },
];

function routeFetch(handler, deps) {
  return async function fetchRoute(request) {
    const body = await readRequestBody(request);
    if (body === undefined) {
      return Response.json({ ok: false, error: { code: "BAD_REQUEST", message: "request body must be a JSON object" } });
    }
    try {
      return Response.json({ ok: true, value: await handler(deps, body) });
    } catch (error) {
      return Response.json({ ok: false, error: errorPayload(error) });
    }
  };
}

function formatTime(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "unknown";
  return new Date(seconds * 1000).toISOString();
}

function renderLog(value) {
  const lines = [];
  const repoPath = typeof value?.repoPath === "string" ? value.repoPath : "";
  const head = value?.head;
  const branch = head?.branch ?? (head?.detached === true ? "detached HEAD" : "unknown");
  const dirty = value?.status?.dirty ?? 0;
  lines.push(`Repository: ${repoPath || "(unknown)"}`);
  lines.push(`Branch: ${branch}${dirty > 0 ? ` (${dirty} uncommitted change${dirty === 1 ? "" : "s"})` : " (clean)"}`);
  if (typeof head?.hash === "string" && head.hash.length > 0) lines.push(`HEAD: ${head.hash.slice(0, 7)}`);
  const commits = Array.isArray(value?.commits) ? value.commits : [];
  lines.push("");
  for (const commit of commits.slice(0, TOOL_LOG_LINES)) {
    const refs = Array.isArray(commit?.refs) && commit.refs.length > 0 ? ` (${commit.refs.join(", ")})` : "";
    lines.push(`${commit?.abbrev ?? ""} ${commit?.subject ?? ""}${refs}`);
  }
  if (commits.length > TOOL_LOG_LINES) lines.push(`… ${commits.length - TOOL_LOG_LINES} more commit(s) not shown`);
  if (value?.truncated === true) lines.push(`(truncated at ${commits.length} commits; pass a larger limit for more)`);
  return lines.join("\n");
}

function renderShow(value) {
  const lines = [];
  lines.push(`commit ${value?.hash ?? "(unknown)"}`);
  lines.push(`Author:    ${value?.authorName ?? "unknown"} <${value?.authorEmail ?? ""}>`);
  lines.push(`Date:      ${formatTime(value?.authorTime)}`);
  if (value?.committerName !== undefined && value.committerName !== value.authorName) {
    lines.push(`Committer: ${value.committerName} <${value?.committerEmail ?? ""}>`);
    lines.push(`Committed: ${formatTime(value?.committerTime)}`);
  }
  if (Array.isArray(value?.refs) && value.refs.length > 0) lines.push(`Refs:      ${value.refs.join(", ")}`);
  if (Array.isArray(value?.parents) && value.parents.length > 0) lines.push(`Parents:   ${value.parents.join(" ")}`);
  lines.push("");
  lines.push(`    ${value?.subject ?? ""}`);
  const body = typeof value?.body === "string" ? value.body.trim() : "";
  if (body.length > 0) {
    for (const line of body.split("\n")) lines.push(`    ${line}`);
  }
  const stats = value?.stats ?? { files: 0, insertions: 0, deletions: 0 };
  lines.push("");
  lines.push(`${stats.files} file(s) changed, ${stats.insertions} insertion(s)(+), ${stats.deletions} deletion(s)(-)`);
  const files = Array.isArray(value?.files) ? value.files : [];
  for (const file of files) {
    const oldPath = typeof file?.oldPath === "string" && file.oldPath.length > 0 ? ` (from ${file.oldPath})` : "";
    const binary = file?.binary === true ? " [binary]" : "";
    lines.push(`${file?.status ?? "?"} ${file?.path ?? "?"}${oldPath} +${file?.added ?? 0} -${file?.removed ?? 0}${binary}`);
  }
  if (files.length === 0) lines.push("(no file changes)");
  return lines.join("\n");
}

function renderDiff(value) {
  if (value?.binary === true) return "(binary file: there is no textual diff)";
  const patch = typeof value?.patch === "string" ? value.patch : "";
  if (patch.length === 0) return "(no textual changes)";
  return value?.truncated === true ? `${patch}\n\n(truncated; the diff is larger than the display limit)` : patch;
}

function renderBranches(value) {
  const lines = [value?.detached === true ? "Current: detached HEAD" : `Current: ${value?.current ?? "(unknown)"}`];
  const branches = Array.isArray(value?.branches) ? value.branches : [];
  for (const branch of branches) {
    const upstream = typeof branch?.upstream === "string" && branch.upstream.length > 0 ? ` -> ${branch.upstream}` : "";
    lines.push(`${branch?.current === true ? "*" : " "} ${branch?.shortName ?? "?"}${upstream} (${String(branch?.hash ?? "").slice(0, 7)})`);
  }
  if (branches.length === 0) lines.push("(no local branches)");
  return lines.join("\n");
}

function renderStatus(value) {
  const head = value?.head;
  const branch = head?.branch ?? (head?.detached === true ? "detached HEAD" : "unknown");
  const dirty = value?.status?.dirty ?? 0;
  const lines = [`Branch: ${branch}`, `Working tree: ${dirty > 0 ? `${dirty} uncommitted change${dirty === 1 ? "" : "s"}` : "clean"}`];
  if (typeof head?.hash === "string" && head.hash.length > 0) lines.push(`HEAD: ${head.hash}`);
  return lines.join("\n");
}

function renderToolText(args, value) {
  try {
    switch (args?.action) {
      case "log":
        return renderLog(value);
      case "show":
        return renderShow(value);
      case "diff":
        return renderDiff(value);
      case "branches":
        return renderBranches(value);
      case "status":
        return renderStatus(value);
      default:
        return JSON.stringify(value ?? null, null, 2);
    }
  } catch (error) {
    return `git_graph: could not render the result (${error instanceof Error ? error.message : String(error)})`;
  }
}

function toolCwd(ctx, exec, config) {
  const agent = exec?.agent;
  const session = agent?.session;
  let workspace;
  if (session !== null && typeof session === "object") {
    const workingDirectory = getService(ctx, "workingDirectory");
    try {
      workspace = workingDirectory?.get?.(session);
    } catch {
      workspace = undefined;
    }
    if (typeof workspace !== "string" || workspace.length === 0) {
      workspace = typeof session.header?.cwd === "string" ? session.header.cwd : undefined;
    }
  }
  if (typeof workspace !== "string" || workspace.length === 0) workspace = fallbackDirectory(ctx);
  if (config.repoPath.length > 0) {
    return path.isAbsolute(config.repoPath) ? path.normalize(config.repoPath) : path.resolve(workspace, config.repoPath);
  }
  return workspace;
}

/** Read-only: never calls performAction. */
function createGitGraphTool(deps) {
  async function execute(args, exec) {
    const action = args?.action;
    const cwd = toolCwd(deps.ctx, exec, deps.config);
    const notRepo = () => new Error(`the current session workspace is not a Git repository: ${cwd}`);
    switch (action) {
      case "log": {
        const limit = normalizeLimit(args?.limit, deps.config.maxCommits, TOOL_MAX_COMMITS_LIMIT);
        const value = await deps.git.readGraph(cwd, { maxCommits: limit, showRemoteBranches: deps.config.showRemoteBranches });
        if (value.isRepo === false) throw notRepo();
        return { action, ...value };
      }
      case "status": {
        const value = await deps.git.readGraph(cwd, { maxCommits: 1, showRemoteBranches: deps.config.showRemoteBranches });
        if (value.isRepo === false) throw notRepo();
        return {
          action,
          repoPath: value.repoPath,
          workspacePath: value.workspacePath,
          isRepo: true,
          head: value.head,
          status: value.status,
        };
      }
      case "branches": {
        const value = await deps.git.listBranches(cwd);
        if (value.isRepo === false) throw notRepo();
        return { action, ...value };
      }
      case "show": {
        if (typeof args?.commit !== "string" || args.commit.length === 0) throw new Error("git_graph show requires a `commit`");
        return { action, ...(await deps.git.readCommit(cwd, args.commit)) };
      }
      case "diff": {
        if (typeof args?.commit !== "string" || args.commit.length === 0) throw new Error("git_graph diff requires a `commit`");
        if (typeof args?.file !== "string" || args.file.length === 0) throw new Error("git_graph diff requires a `file`");
        return { action, ...(await deps.git.readDiff(cwd, { hash: args.commit, path: args.file })) };
      }
      default:
        throw new Error(`unknown git_graph action ${JSON.stringify(action)}; expected log, show, diff, branches or status`);
    }
  }

  return {
    name: "git_graph",
    description:
      "Read the Git commit graph, commits, file diffs, branches and working-tree status of the current session workspace. Read-only: it never checks out, commits, or otherwise modifies the repository.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["log", "show", "diff", "branches", "status"] },
        commit: { type: "string" },
        file: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
      },
      required: ["action"],
      additionalProperties: false,
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (args, value) => [{ type: "text", text: renderToolText(args, value) }],
    },
    execute,
  };
}

export function apply(ctx, config) {
  const rawConfig = config !== null && typeof config === "object" ? config : {};
  /* repoPath and maxCommits stay host-level keys. */
  const normalized = normalizeConfig(config);
  const settings = normalizeSettings(rawConfig);
  const runtime = deriveRuntimeConfig(normalized, rawConfig, settings);

  const maxDepthValue = readConfigValue(rawConfig, "maxDepthOfRepoSearch");
  const maxDepthOfRepoSearch =
    Number.isSafeInteger(maxDepthValue) && maxDepthValue >= 0 ? Math.min(maxDepthValue, REPO_SEARCH_MAX_DEPTH) : REPO_SEARCH_DEFAULT_DEPTH;
  const reviewState = { table: null, pending: null, failed: false };
  const deps = {
    ctx,
    rawConfig,
    hostConfig: normalized,
    config: { ...runtime, maxDepthOfRepoSearch },
    repoConfigCache: new Map(),
    git: createGitApi(createGitRunner()),
    reviewState,
  };
  const logger = ctx?.logger;
  const warn = (message) => {
    try {
      logger?.warn?.(message);
    } catch {
      /* logging must never break plugin loading */
    }
  };

  ctx.inject(["connection"], (connectionCtx) => {
    connectionCtx.effect(() => {
      const disposers = [];
      for (const { route, handler } of ROUTES) {
        try {
          disposers.push(
            connectionCtx.connection.fetch.register({
              path: route,
              methods: ["POST"],
              requestBody: "buffered",
              fetch: routeFetch(handler, deps),
            }),
          );
        } catch (error) {
          warn(`dsh-git-graph: could not register ${route} (${error instanceof Error ? error.message : String(error)})`);
        }
      }
      return () => {
        for (const dispose of disposers) {
          try {
            if (typeof dispose === "function") dispose();
          } catch {
            /* a failing disposer must not block the others */
          }
        }
      };
    }, "dsh-git-graph: POST Fetch routes");
  });

  ctx.inject(["tools"], (toolCtx) => {
    toolCtx.effect(() => toolCtx.tools.register(createGitGraphTool(deps)), "dsh-git-graph: git_graph tool");
  });

  /* Opened lazily: a missing storageDomain keeps the routes working. */
  ctx.inject(["storageDomain"], (storageCtx) => {
    let domain = null;
    let disposed = false;
    const opening = (async () => {
      domain = await storageCtx.storageDomain.open(REVIEW_DOMAIN_SPEC);
      if (disposed) {
        await domain.close();
        return null;
      }
      const table = domain.table(REVIEW_COLLECTION);
      reviewState.table = table;
      return table;
    })().catch((error) => {
      reviewState.failed = true;
      warn(`dsh-git-graph: review storage unavailable (${error instanceof Error ? error.message : String(error)})`);
      return null;
    });
    reviewState.pending = opening;
    storageCtx.effect(() => () => {
      disposed = true;
      reviewState.table = null;
      if (domain !== null) Promise.resolve(domain.close()).catch(() => {});
    });
  });
}
