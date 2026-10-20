/**
 * `dsh-git-graph` host half.
 *
 * Registers twelve authenticated POST Fetch routes used by the Web client and the
 * read-only `git_graph` agent tool. Every consumer goes through the single git API
 * built here, so route and tool behavior cannot drift. All services are optional:
 * each registration lives inside `ctx.inject`, so the plugin still loads in a profile
 * that provides neither `connection`, `tools` nor `storageDomain`.
 *
 * @module dsh-git-graph
 */

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_MAX_COMMITS,
  GitGraphError,
  MAX_COMMITS_LIMIT,
  createGitApi,
  createGitRunner,
  isValidRefName,
  isValidRepoPath,
} from "./git.js";

/** Stable Cordis plugin identity (matches the package name). */
export const name = "dsh-git-graph";

/** Prefix shared by the client-facing Fetch routes. */
export const ROUTE_PREFIX = "/api/dsh-git-graph";

/** Largest graph page the HTTP route accepts. */
const ROUTE_MAX_COMMITS_LIMIT = MAX_COMMITS_LIMIT;

/** Largest graph page the agent tool accepts (contract maximum). */
const TOOL_MAX_COMMITS_LIMIT = 500;

/** Number of commits rendered as text by the tool's `log` summary. */
const TOOL_LOG_LINES = 100;

/** Diff scopes the `diff` route forwards to the git API. */
const DIFF_SCOPES = new Set(["commit", "staged", "unstaged", "compare"]);

/** Fields copied from one action request body into the git action arguments. */
const ACTION_FIELDS = {
  checkoutBranch: ["branch"],
  checkoutCommit: ["hash"],
  createBranch: ["name", "startPoint"],
  deleteBranch: ["name", "force"],
  renameBranch: ["name", "newName"],
  cherryPick: ["hash"],
  revertCommit: ["hash"],
  /* Alias used by the Web client's action menu; the contract name is revertCommit. */
  revert: ["hash"],
  createTag: ["name", "hash"],
  deleteTag: ["name"],
  fetch: ["remote"],
  fetchIntoLocalBranch: ["remote", "branch", "local"],
  merge: ["hash", "noFastForward", "noCommit", "squash"],
  mergeCommit: ["hash"],
  resetToCommit: ["hash", "mode"],
  pullBranch: ["remote", "branch", "noFastForward", "rebase"],
  pushBranch: ["remote", "branch", "setUpstream", "force"],
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

/** Read a raw config value, tolerating a live schemastery field wrapper. */
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

/**
 * Normalize the plugin's raw configuration.
 *
 * There is no exported `Config` schema, so every value is read defensively: an empty
 * or non-string `repoPath` means "use the session workspace", `maxCommits` must be a
 * finite positive integer, and `showRemoteBranches` defaults to true.
 *
 * @param {unknown} raw - the `apply` configuration (may be undefined or partial).
 * @returns {{ repoPath: string, maxCommits: number, showRemoteBranches: boolean }} normalized config.
 */
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

/** Accepted `graphStyle` values; anything else falls back to `rounded`. */
const GRAPH_STYLES = new Set(["rounded", "angular"]);

/**
 * Conservative validator for one config-supplied CSS colour.
 *
 * Colours are forwarded to the client and used in CSS, so only plain hex, CSS colour
 * names, `rgb()/rgba()/hsl()/hsla()` numbers and `var(--token)` references pass.
 * Anything else (semicolons, braces, `url()`, etc.) is dropped.
 */
const CSS_COLOUR_PATTERN = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|var\(--[A-Za-z0-9-_.]+\)|(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s]+\))$/;

/** Caps for forwarded presentation config. */
const MAX_GRAPH_COLOURS = 64;
const MAX_ISSUE_URL_TEMPLATE = 2048;

/**
 * Normalize the presentation keys forwarded to the client.
 *
 * Kept separate from {@link normalizeConfig} so that exported function's shape stays
 * stable: the six keys are read defensively here and only ever appear as the graph
 * value's `presentation` member.
 *
 * @param {unknown} raw - the `apply` configuration (may be undefined or partial).
 * @returns {{ graphStyle: "rounded" | "angular", graphColours: string[], showSignature: boolean, showEmoji: boolean, issueUrlTemplate: string, useMailmap: boolean }} presentation value.
 */
function normalizePresentation(raw) {
  const source = raw !== null && typeof raw === "object" ? raw : {};
  const styleValue = readConfigValue(source, "graphStyle");
  const coloursValue = readConfigValue(source, "graphColours");
  const showSignatureValue = readConfigValue(source, "showSignature");
  const showEmojiValue = readConfigValue(source, "showEmoji");
  const issueValue = readConfigValue(source, "issueUrlTemplate");
  const mailmapValue = readConfigValue(source, "useMailmap");

  const graphColours = [];
  if (Array.isArray(coloursValue)) {
    for (const entry of coloursValue) {
      if (typeof entry !== "string") continue;
      const colour = entry.trim();
      if (colour.length === 0 || colour.length > 64 || !CSS_COLOUR_PATTERN.test(colour)) continue;
      if (!graphColours.includes(colour)) graphColours.push(colour);
      if (graphColours.length >= MAX_GRAPH_COLOURS) break;
    }
  }

  const issueUrlTemplate =
    typeof issueValue === "string" &&
    issueValue.trim().length > 0 &&
    issueValue.length <= MAX_ISSUE_URL_TEMPLATE &&
    !issueValue.includes("\u0000") &&
    !issueValue.includes("\n") &&
    !issueValue.includes("\r")
      ? issueValue.trim()
      : "";

  return {
    graphStyle: typeof styleValue === "string" && GRAPH_STYLES.has(styleValue) ? styleValue : "rounded",
    graphColours,
    showSignature: showSignatureValue === undefined || showSignatureValue === null ? false : Boolean(showSignatureValue),
    showEmoji: showEmojiValue === undefined || showEmojiValue === null ? true : Boolean(showEmojiValue),
    issueUrlTemplate,
    useMailmap: mailmapValue === undefined || mailmapValue === null ? false : Boolean(mailmapValue),
  };
}

/* ------------------------------------------------------------------------- */
/* TODO-18: repository discovery and the workspace path fence                 */
/* ------------------------------------------------------------------------- */

/** Directory names repository discovery never enters. */
const REPO_SEARCH_SKIP = new Set(["node_modules", ".git", "dist", "build"]);

/** Hard discovery caps (contract H1). */
const REPO_SEARCH_MAX_DIRECTORIES = 2000;
const REPO_SEARCH_MAX_REPOSITORIES = 50;
const REPO_SEARCH_MAX_DEPTH = 8;

/** Default discovery depth when the config key is absent/invalid. */
const REPO_SEARCH_DEFAULT_DEPTH = 1;

/** Real path when it exists, otherwise the absolute normalized path. */
function realPathOrSelf(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

/** True when `childReal` is `parentReal` or lies below it (both already resolved). */
function isPathInside(parentReal, childReal) {
  const relative = path.relative(parentReal, childReal);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** A directory is a repository root when it has a `.git` file or directory. */
function isRepoRoot(directory) {
  try {
    return fs.existsSync(path.join(directory, ".git"));
  } catch {
    return false;
  }
}

/** Normalize a discovery depth (config or request) to a safe non-negative integer. */
function normalizeSearchDepth(value, fallback) {
  if (!Number.isSafeInteger(value) || value < 0) return fallback;
  return Math.min(value, REPO_SEARCH_MAX_DEPTH);
}

/**
 * Walk one workspace root for nested Git repositories.
 *
 * Breadth-first, `maxDepth` directory levels below the root; `node_modules`, `.git`,
 * `dist` and `build` are skipped and a discovered repository is never descended into.
 * The walk is capped and reports `truncated` when a cap stopped it. The session's own
 * repository (when known) is always present and marked `isCurrent` by real path.
 *
 * @param {string} root - workspace root to walk.
 * @param {number} maxDepth - directory depth below the root.
 * @param {string | null} currentRepoPath - session repository root, or null.
 * @returns {{ repos: Array<{ path: string, name: string, isCurrent: boolean }>, truncated: boolean }} discovery result.
 */
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
    /* A workspace that is itself a repository: include it and do not descend. */
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
    /* The session's own repository is always reported, even when outside the walk. */
    repos.unshift({ path: currentReal, name: path.basename(currentReal) || currentReal, isCurrent: true });
  }
  for (const repo of repos) repo.isCurrent = currentReal !== null && repo.path === currentReal;
  return { repos, truncated };
}

/* ------------------------------------------------------------------------- */
/* TODO-19: code-review marks                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Storage domain name.
 *
 * The real store validates unit names against `/^[a-z][a-z0-9_]*$/`, so the
 * contract's hyphenated `dsh-git-graph` spelling would be rejected by the medium;
 * `dsh_git_graph` is the same domain identity in the legal alphabet.
 */
const REVIEW_DOMAIN_NAME = "dsh_git_graph";

/** Domain collection holding one record per session id. */
const REVIEW_COLLECTION = "reviews";

/** Marks are dropped when their entry's `updatedAt` is older than this. */
const REVIEW_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Maximum review entries kept per session (oldest dropped first). */
const REVIEW_MAX_ENTRIES = 200;

/** Review request literals. */
const REVIEW_ACTIONS = new Set(["read", "toggle", "clear"]);
const REVIEW_KINDS = new Set(["commit", "compare"]);

/**
 * Validate/filter a stored review record at the durable boundary.
 *
 * The domain's value schema is a plain `parse` object so no storage/zod package has
 * to be imported by the host half (node: builtins only): invalid entries are dropped
 * instead of poisoning the whole record.
 *
 * @param {unknown} value - stored record.
 * @returns {{ entries: Array<{ kind: "commit" | "compare", base: string, head: string, files: Record<string, number>, updatedAt: number }> }} normalized record.
 */
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
    entries.push({ kind: raw.kind, base: raw.base, head: raw.head, files, updatedAt: raw.updatedAt });
  }
  return { entries };
}

/**
 * Drop entries older than the retention window and cap the list at the newest 200.
 * @param {Array<object>} entries - stored entries.
 * @param {number} now - current epoch milliseconds.
 * @returns {{ entries: Array<object>, pruned: boolean }} the surviving entries and whether a write-back is needed.
 */
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

/**
 * Domain declaration for the review store. Hand-built (instead of `defineDomain`) so
 * the plugin keeps its "node: builtins only" import rule; `open` only consumes the
 * name, version, tables and each table's `valueSchema.parse`.
 */
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

/** Read a Cordis service without throwing when it is absent. */
function getService(ctx, serviceName) {
  if (ctx === null || typeof ctx !== "object" || typeof ctx.get !== "function") return undefined;
  try {
    return ctx.get(serviceName);
  } catch {
    return undefined;
  }
}

/** The deployment-wide fallback directory. */
function fallbackDirectory(ctx) {
  const workingDirectory = getService(ctx, "workingDirectory");
  const directory = workingDirectory?.defaultDirectory;
  if (typeof directory === "string" && directory.length > 0) return directory;
  return process.cwd();
}

/** Resolve the directory recorded on one session, when the session is known. */
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

/**
 * Resolve the repository directory for one request or tool call.
 *
 * Order: the session's working directory, else `workingDirectory.defaultDirectory`,
 * then the request's `path` (absolute as-is, relative joined onto that base), and
 * finally a non-empty `repoPath` configuration override.
 *
 * Every resolved path is fenced to the session workspace using real paths, so `..`
 * and symlink escapes are both refused with `OUTSIDE_WORKSPACE`. The `repoPath`
 * configuration override is the operator's explicit choice and is exempt.
 *
 * @param {object} ctx - Cordis context carrying `sessions`/`workingDirectory` when present.
 * @param {string} [sessionId] - browser session id.
 * @param {string} [requestedPath] - request/tool path override.
 * @param {{ repoPath?: string }} [options] - normalized plugin config.
 * @returns {{ cwd: string, workspace: string }} resolved repository candidate and workspace base.
 * @throws {GitGraphError} `OUTSIDE_WORKSPACE` when a non-exempt path escapes the workspace.
 */
export function resolveCwd(ctx, sessionId, requestedPath, options = {}) {
  const fallback = fallbackDirectory(ctx);
  const workspace = sessionDirectory(ctx, sessionId) ?? fallback;
  let cwd = workspace;
  if (typeof requestedPath === "string" && requestedPath.length > 0) {
    cwd = path.isAbsolute(requestedPath) ? path.normalize(requestedPath) : path.resolve(workspace, requestedPath);
  }
  const repoPath = typeof options.repoPath === "string" ? options.repoPath : "";
  if (repoPath.length > 0) {
    /* Operator-pinned repository: explicitly exempt from the workspace fence. */
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

/** Normalize a graph page size. */
function normalizeLimit(value, fallback, maximum) {
  if (!Number.isSafeInteger(value) || value < 1) return fallback;
  return Math.min(value, maximum);
}

/** Build the `BAD_REQUEST` envelope payload. */
function badRequest(message) {
  return new GitGraphError("BAD_REQUEST", message);
}

/** Map an unknown failure to the wire error payload. */
function errorPayload(error) {
  if (error instanceof GitGraphError) {
    // Carry git's own output so the UI can show the raw stderr behind a disclosure
    // instead of only the one-line summary.
    const detail = [error.stderr, error.stdout].map((part) => (typeof part === "string" ? part.trim() : "")).filter((part) => part !== "").join("\n");
    return { code: error.code, message: error.message, ...(detail === "" ? {} : { output: detail }) };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { code: "INTERNAL", message };
}

/** Read a JSON object request body without throwing. */
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

/**
 * Graph route: always succeeds with `{ isRepo: false }` outside a repository.
 *
 * `branches` and `order` are optional request-only filters forwarded to the git API;
 * they never change the returned value shape. The git API validates both (unsafe or
 * unknown branch refs and unknown orderings become `BAD_REQUEST`).
 *
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} graph value with the workspace path filled in.
 */
async function handleGraph(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const limit = normalizeLimit(body.limit, deps.config.maxCommits, ROUTE_MAX_COMMITS_LIMIT);
  const value = await deps.git.readGraph(resolved.cwd, {
    maxCommits: limit,
    showRemoteBranches: deps.config.showRemoteBranches,
    branches: body.branches,
    order: body.order,
    showStashes: deps.config.showStashes,
    useMailmap: deps.config.presentation.useMailmap,
  });
  /* `presentation` is the single new graph-response key; it is request-independent. */
  return { ...value, workspacePath: resolved.workspace, presentation: deps.config.presentation };
}

/**
 * Commit route.
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} commit detail value.
 */
async function handleCommit(deps, body) {
  const hash = body.hash;
  if (typeof hash !== "string" || hash.length === 0) throw badRequest("hash is required");
  if (!isValidRefName(hash)) throw badRequest(`invalid hash: ${JSON.stringify(hash)}`);
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readCommit(resolved.cwd, hash);
}

/**
 * Diff route.
 *
 * `scope` selects the comparison: omitted/`"commit"` (hash required), `"staged"`,
 * `"unstaged"`, or `"compare"` (base + head required). The git API performs the
 * validation for the ref values; this route only rejects missing required fields and
 * unknown scopes, so the wire errors stay `BAD_REQUEST`.
 *
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} diff value.
 */
async function handleDiff(deps, body) {
  const scope = body.scope === undefined || body.scope === null || body.scope === "" ? "commit" : body.scope;
  if (!DIFF_SCOPES.has(scope)) throw badRequest(`invalid scope: ${JSON.stringify(scope)}`);
  const file = body.file;
  if (typeof file !== "string" || file.length === 0) throw badRequest("file is required");
  if (scope === "commit" && (typeof body.hash !== "string" || body.hash.length === 0)) throw badRequest("hash is required");
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

/**
 * Uncommitted-changes route: always succeeds with `{ isRepo: false }` outside a repo.
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} uncommitted value with the workspace path filled in.
 */
async function handleUncommitted(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const value = await deps.git.readUncommitted(resolved.cwd);
  return { ...value, workspacePath: resolved.workspace };
}

/**
 * Commit-comparison route.
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} comparison value.
 */
async function handleCompare(deps, body) {
  const base = body.base;
  const head = body.head;
  if (typeof base !== "string" || base.length === 0) throw badRequest("base is required");
  if (typeof head !== "string" || head.length === 0) throw badRequest("head is required");
  if (!isValidRefName(base)) throw badRequest(`invalid base: ${JSON.stringify(base)}`);
  if (!isValidRefName(head)) throw badRequest(`invalid head: ${JSON.stringify(head)}`);
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.compareCommits(resolved.cwd, { base, head });
}

/**
 * Contains route: where one commit is reachable from (HEAD, branches, tags, stashes).
 *
 * Exactly one hash per request; an array is rejected with `BAD_REQUEST` because the
 * client caches per hash.
 *
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} contains value.
 */
async function handleContains(deps, body) {
  const hash = body.hash;
  if (Array.isArray(hash)) throw badRequest("hash must be a single ref, not an array");
  if (typeof hash !== "string" || hash.length === 0) throw badRequest("hash is required");
  if (!isValidRefName(hash)) throw badRequest(`invalid hash: ${JSON.stringify(hash)}`);
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readContains(resolved.cwd, hash);
}

/**
 * Stash-list route.
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} stashes value.
 */
async function handleStashes(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readStashes(resolved.cwd);
}

/**
 * Tag-detail route for one tag.
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} tag value.
 */
async function handleTag(deps, body) {
  const tagName = body.name;
  if (typeof tagName !== "string" || tagName.length === 0) throw badRequest("name is required");
  if (!isValidRefName(tagName)) throw badRequest(`invalid tag name: ${JSON.stringify(tagName)}`);
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readTag(resolved.cwd, tagName);
}

/**
 * Remote-list route.
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} remotes value.
 */
async function handleRemotes(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readRemotes(resolved.cwd);
}

/**
 * Repository-discovery route (TODO-18).
 *
 * Walks the workspace root for nested repositories; the session's own repository is
 * always included and flagged `isCurrent`. An empty result is a success, not an error.
 *
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<{ workspacePath: string, maxDepth: number, repos: Array<{ path: string, name: string, isCurrent: boolean }>, truncated?: true }>} discovery value.
 */
async function handleRepos(deps, body) {
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  const maxDepth = normalizeSearchDepth(body.maxDepth, deps.config.maxDepthOfRepoSearch);
  /* The session repository is the repository containing the session workspace. */
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

/**
 * Resolve the open review table, or null when `storageDomain` is absent/failed.
 * @param {{ reviewState?: object }} deps - plugin dependencies.
 * @returns {Promise<object | null>} table handle or null.
 */
async function reviewTableFor(deps) {
  const state = deps.reviewState;
  if (state === null || state === undefined) return null;
  if (state.table !== null) return state.table;
  if (state.pending !== null) return state.pending;
  return null;
}

/**
 * Authoritative file count for one review key, from the commit/compare file list.
 * @param {{ git: object }} deps - plugin dependencies.
 * @param {string} cwd - repository directory.
 * @param {"commit" | "compare"} kind - review kind.
 * @param {string} base - base commit.
 * @param {string} head - head commit (equals base for commit kind).
 * @returns {Promise<number>} the file count.
 */
async function reviewTotal(deps, cwd, kind, base, head) {
  if (kind === "commit") return (await deps.git.readCommit(cwd, base)).stats.files;
  return (await deps.git.compareCommits(cwd, { base, head })).stats.files;
}

/**
 * Code-review marks route (TODO-19).
 *
 * Storage is keyed by session id; entries are keyed by `(kind, base, head)` and carry
 * `files: { path: reviewedAt }`. Expired entries are pruned (and lazily written back)
 * on every request, and the per-session list is capped at the newest 200 entries.
 *
 * @param {{ ctx: object, config: object, git: object, reviewState: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<{ files: Record<string, number>, total: number, reviewed: number }>} review value.
 * @throws {GitGraphError} `BAD_REQUEST`, `OUTSIDE_WORKSPACE`, `NOT_A_REPO`, `GIT_FAILED` or `UNAVAILABLE`.
 */
async function handleReview(deps, body) {
  const action = body.action;
  if (typeof action !== "string" || !REVIEW_ACTIONS.has(action)) throw badRequest(`invalid review action: ${JSON.stringify(action)}`);
  const kind = body.kind;
  if (typeof kind !== "string" || !REVIEW_KINDS.has(kind)) throw badRequest(`invalid review kind: ${JSON.stringify(kind)}`);
  const base = body.base;
  const head = body.head;
  if (typeof base !== "string" || base.length === 0) throw badRequest("base is required");
  if (typeof head !== "string" || head.length === 0) throw badRequest("head is required");
  if (!isValidRefName(base)) throw badRequest(`invalid base: ${JSON.stringify(base)}`);
  if (!isValidRefName(head)) throw badRequest(`invalid head: ${JSON.stringify(head)}`);
  if (kind === "commit" && base !== head) throw badRequest("commit reviews require base === head");
  let file;
  if (action === "toggle") {
    if (typeof body.file !== "string" || body.file.length === 0) throw badRequest("file is required");
    if (!isValidRepoPath(body.file)) throw badRequest(`invalid file: ${JSON.stringify(body.file)}`);
    file = body.file;
  }
  const sessionKey = typeof body.sessionId === "string" && body.sessionId.length > 0 ? body.sessionId : "default";
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);

  const table = await reviewTableFor(deps);
  if (table === null) {
    throw new GitGraphError("UNAVAILABLE", "review storage is unavailable: the storageDomain service is not active");
  }

  const now = Date.now();
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

  const index = entries.findIndex(matches);
  const current = index === -1 ? { kind, base, head, files: {}, updatedAt: now } : entries[index];
  const files = { ...current.files };
  if (Object.hasOwn(files, file)) delete files[file];
  else files[file] = now;
  const nextEntries = entries.filter((_entry, position) => position !== index);
  nextEntries.push({ kind, base, head, files, updatedAt: now });
  const capped = pruneReviewEntries(nextEntries, now);
  await table.put(sessionKey, { entries: capped.entries });
  return { files, total, reviewed: Object.keys(files).length };
}

/**
 * Action route.
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} `{ message, output }` on success.
 */
async function handleAction(deps, body) {
  const action = body.action;
  if (typeof action !== "string" || action.length === 0) throw badRequest("action is required");
  const fields = ACTION_FIELDS[action];
  if (fields === undefined) throw badRequest(`unknown action: ${JSON.stringify(action)}`);
  const args = {};
  for (const field of fields) {
    if (body[field] !== undefined) args[field] = body[field];
  }
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.performAction(resolved.cwd, action, args);
}

/** Fetch-route table shared by registration and documentation. */
const ROUTES = [
  { route: `${ROUTE_PREFIX}/graph`, handler: handleGraph },
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
];

/** Build one Fetch handler that always answers HTTP 200 with an envelope. */
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

/** Format one epoch-seconds value as ISO text for the tool renderer. */
function formatTime(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "unknown";
  return new Date(seconds * 1000).toISOString();
}

/** Human summary of a graph value for the `log` tool action. */
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

/** Human summary of a commit value for the `show` tool action. */
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

/** Human summary of a diff value for the `diff` tool action. */
function renderDiff(value) {
  if (value?.binary === true) return "(binary file: there is no textual diff)";
  const patch = typeof value?.patch === "string" ? value.patch : "";
  if (patch.length === 0) return "(no textual changes)";
  return value?.truncated === true ? `${patch}\n\n(truncated; the diff is larger than the display limit)` : patch;
}

/** Human summary of a branch list for the `branches` tool action. */
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

/** Human summary of a status value for the `status` action. */
function renderStatus(value) {
  const head = value?.head;
  const branch = head?.branch ?? (head?.detached === true ? "detached HEAD" : "unknown");
  const dirty = value?.status?.dirty ?? 0;
  const lines = [`Branch: ${branch}`, `Working tree: ${dirty > 0 ? `${dirty} uncommitted change${dirty === 1 ? "" : "s"}` : "clean"}`];
  if (typeof head?.hash === "string" && head.hash.length > 0) lines.push(`HEAD: ${head.hash}`);
  return lines.join("\n");
}

/** Render one tool value as text; unknown shapes fall back to JSON. */
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

/**
 * Resolve the tool call's enforced working directory.
 *
 * `exec.agent.session` is the calling agent's session; `workingDirectory.get` is
 * preferred, then the session header's cwd, then the deployment fallback. A non-empty
 * `repoPath` configuration still overrides everything, exactly like the routes.
 */
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

/**
 * Build the read-only `git_graph` tool definition.
 *
 * The tool shares `deps.git` with the routes and never calls `performAction`, so it
 * cannot mutate the repository.
 *
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @returns {object} tool definition accepted by `tools.register`.
 */
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

/**
 * Register the plugin: ten Fetch routes and the `git_graph` tool, each behind an
 * optional service injection so the plugin loads in any profile shape.
 *
 * @param {object} ctx - Cordis plugin context.
 * @param {unknown} [config] - raw plugin configuration (`repoPath`, `maxCommits`, `showRemoteBranches`).
 */
export function apply(ctx, config) {
  const normalized = normalizeConfig(config);
  /*
   * `showStashes` is a wave-4 config key read separately: `normalizeConfig` keeps its
   * long-standing three-key shape, and the value is only an internal graph option.
   */
  const rawConfig = config !== null && typeof config === "object" ? config : {};
  const showStashesValue = readConfigValue(rawConfig, "showStashes");
  const showStashes = showStashesValue === undefined || showStashesValue === null ? true : Boolean(showStashesValue);
  /* The six presentation keys are read separately; normalizeConfig keeps its shape. */
  const presentation = normalizePresentation(rawConfig);
  /* TODO-18 config key, also read separately for the same reason. */
  const maxDepthValue = readConfigValue(rawConfig, "maxDepthOfRepoSearch");
  const maxDepthOfRepoSearch =
    Number.isSafeInteger(maxDepthValue) && maxDepthValue >= 0 ? Math.min(maxDepthValue, REPO_SEARCH_MAX_DEPTH) : REPO_SEARCH_DEFAULT_DEPTH;
  /** Review store readiness: resolved table handle, in-flight open, or null. */
  const reviewState = { table: null, pending: null, failed: false };
  const deps = {
    ctx,
    config: { ...normalized, showStashes, presentation, maxDepthOfRepoSearch },
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

  /*
   * TODO-19 review marks. The domain is opened lazily inside this optional injection;
   * a profile without `storageDomain` (or with a failing backend) keeps every route
   * working and answers /review with UNAVAILABLE instead of throwing.
   */
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
