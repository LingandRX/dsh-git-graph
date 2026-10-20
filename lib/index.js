/**
 * `dsh-git-graph` host half.
 *
 * Registers four authenticated POST Fetch routes used by the Web client and the
 * read-only `git_graph` agent tool. Every consumer goes through the single git API
 * built here, so route and tool behavior cannot drift. All services are optional:
 * each registration lives inside `ctx.inject`, so the plugin still loads in a profile
 * that provides neither `connection` nor `tools`.
 *
 * @module dsh-git-graph
 */

import path from "node:path";

import {
  DEFAULT_MAX_COMMITS,
  GitGraphError,
  MAX_COMMITS_LIMIT,
  createGitApi,
  createGitRunner,
  isValidRefName,
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

/** Fields copied from one action request body into the git action arguments. */
const ACTION_FIELDS = {
  checkoutBranch: ["branch"],
  checkoutCommit: ["hash"],
  createBranch: ["name", "startPoint"],
  deleteBranch: ["name", "force"],
  cherryPick: ["hash"],
  revertCommit: ["hash"],
  /* Alias used by the Web client's action menu; the contract name is revertCommit. */
  revert: ["hash"],
  createTag: ["name", "hash"],
  deleteTag: ["name"],
  fetch: ["remote"],
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
 * @param {object} ctx - Cordis context carrying `sessions`/`workingDirectory` when present.
 * @param {string} [sessionId] - browser session id.
 * @param {string} [requestedPath] - request/tool path override.
 * @param {{ repoPath?: string }} [options] - normalized plugin config.
 * @returns {{ cwd: string, workspace: string }} resolved repository candidate and workspace base.
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
    cwd = path.isAbsolute(repoPath) ? path.normalize(repoPath) : path.resolve(workspace, repoPath);
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
  if (error instanceof GitGraphError) return { code: error.code, message: error.message };
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
  });
  return { ...value, workspacePath: resolved.workspace };
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
 * @param {{ ctx: object, config: object, git: object }} deps - plugin dependencies.
 * @param {object} body - decoded request body.
 * @returns {Promise<object>} diff value.
 */
async function handleDiff(deps, body) {
  const hash = body.hash;
  const file = body.file;
  if (typeof hash !== "string" || hash.length === 0) throw badRequest("hash is required");
  if (typeof file !== "string" || file.length === 0) throw badRequest("file is required");
  const resolved = resolveCwd(deps.ctx, body.sessionId, body.path, deps.config);
  return deps.git.readDiff(resolved.cwd, {
    hash,
    path: file,
    oldPath: typeof body.oldPath === "string" && body.oldPath.length > 0 ? body.oldPath : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
  });
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
 * Register the plugin: four Fetch routes and the `git_graph` tool, each behind an
 * optional service injection so the plugin loads in any profile shape.
 *
 * @param {object} ctx - Cordis plugin context.
 * @param {unknown} [config] - raw plugin configuration (`repoPath`, `maxCommits`, `showRemoteBranches`).
 */
export function apply(ctx, config) {
  const normalized = normalizeConfig(config);
  const deps = { ctx, config: normalized, git: createGitApi(createGitRunner()) };
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
}
