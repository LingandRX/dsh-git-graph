/**
 * Dependency-free Git data layer for `dsh-git-graph`.
 *
 * The module never spawns a shell: every command is an argument vector passed to
 * `child_process.execFile`. The runner is injectable so the parsing can be tested
 * without touching a repository, and the API object is built from that runner so the
 * HTTP routes and the `git_graph` agent tool share exactly one implementation.
 *
 * @module dsh-git-graph/git
 */

import { execFile } from "node:child_process";

/** Default number of commits in one graph page. */
export const DEFAULT_MAX_COMMITS = 400;

/** Hard upper bound accepted for a graph page. */
export const MAX_COMMITS_LIMIT = 2000;

/** Byte cap for commit bodies and action output. */
export const MAX_DETAIL_BYTES = 8 * 1024;

/** Byte cap for one rendered diff. */
export const MAX_DIFF_BYTES = 300 * 1024;

/** Byte cap for an error message lifted out of git stderr. */
const MAX_ERROR_BYTES = 4 * 1024;

/** Composite child-process output cap; a larger diff is reported as truncated. */
const RUNNER_MAX_BUFFER = 16 * 1024 * 1024;

/** Default command timeout. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Field separator `%x1f` used by every custom `--format`. */
const FIELD = "\u001f";

/** NUL record separator used with `-z` and `%00`. */
const NUL = "\u0000";

/** `git log` record format: subject is the final field so it may contain `%x1f`. */
const LOG_FORMAT = `%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%s`;

/** `git show -s` metadata format: body is the final field. */
const SHOW_FORMAT = `%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%s%x1f%b`;

/** `git for-each-ref` format. */
const REF_FORMAT = "%(refname)%00%(objectname)%00%(HEAD)%00%(upstream:short)";

/** The only git references accepted as user input. */
const REF_PATTERN = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;

/**
 * Error raised by the Git layer.
 *
 * `code` is one of `BAD_REQUEST`, `NOT_A_REPO`, `GIT_FAILED`, which is exactly what
 * the HTTP envelope exposes and what callers may translate.
 */
export class GitGraphError extends Error {
  /**
   * @param {string} code - machine-readable error code.
   * @param {string} message - human-readable message (git stderr when available).
   * @param {{ stdout?: string, stderr?: string }} [details] - raw command output.
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "GitGraphError";
    this.code = code;
    this.stdout = typeof details.stdout === "string" ? details.stdout : "";
    this.stderr = typeof details.stderr === "string" ? details.stderr : "";
  }
}

/**
 * Create a `run(argv, options)` function backed by `child_process.execFile`.
 *
 * Global hardening flags are prepended to every invocation (`--no-pager`, colors
 * disabled through config, deterministic path quoting) and the child environment
 * disables interactive credential prompts and locale-dependent output.
 *
 * @param {object} [options] - runner options.
 * @param {Function} [options.execFileImpl] - `execFile`-compatible implementation (injectable for tests).
 * @param {number} [options.timeoutMs] - per-command timeout in milliseconds.
 * @returns {(argv: string[], options?: { cwd?: string, timeoutMs?: number, maxBuffer?: number }) => Promise<{ stdout: string, stderr: string, code: number | null, signal: string | null, error: unknown, overflowed: boolean }>} the runner.
 */
export function createGitRunner({ execFileImpl = execFile, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof execFileImpl !== "function") throw new TypeError("createGitRunner: execFileImpl must be a function");
  const defaultTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;

  return function run(argv, options = {}) {
    const parts = Array.isArray(argv) ? argv.map((part) => String(part)) : [];
    const fullArgv = ["--no-pager", "-c", "color.ui=false", "-c", "core.quotepath=false", ...parts];
    const cwd = typeof options.cwd === "string" && options.cwd.length > 0 ? options.cwd : process.cwd();
    const execOptions = {
      cwd,
      encoding: "utf8",
      timeout: Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : defaultTimeout,
      maxBuffer: Number.isFinite(options.maxBuffer) && options.maxBuffer > 0 ? options.maxBuffer : RUNNER_MAX_BUFFER,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
        LC_ALL: "C",
        LANG: "C",
      },
    };

    return new Promise((resolve) => {
      let settled = false;
      const settle = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const callback = (error, stdout, stderr) => settle(normalizeResult(error, stdout, stderr));

      try {
        const returned = execFileImpl("git", fullArgv, execOptions, callback);
        /* An injected implementation may be promise-based instead of callback-based. */
        if (returned !== null && typeof returned === "object" && typeof returned.then === "function") {
          returned.then(
            (value) => {
              if (value !== null && typeof value === "object" && (typeof value.stdout === "string" || typeof value.stderr === "string" || typeof value.code === "number")) {
                settle({
                  stdout: toText(value.stdout),
                  stderr: toText(value.stderr),
                  code: Number.isInteger(value.code) ? value.code : 0,
                  signal: typeof value.signal === "string" ? value.signal : null,
                  error: undefined,
                  overflowed: value.overflowed === true,
                });
                return;
              }
              settle({ stdout: "", stderr: "", code: 0, signal: null, error: undefined, overflowed: false });
            },
            (error) => settle(normalizeResult(error, error?.stdout, error?.stderr)),
          );
        }
      } catch (error) {
        settle(normalizeResult(error));
      }
    });
  };
}

/**
 * Coerce one child-process stream to text.
 * @param {unknown} value - stdout/stderr chunk or buffer.
 * @returns {string} the text.
 */
function toText(value) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
  return "";
}

/**
 * Translate one node child-process callback into the stable runner result.
 * @param {unknown} error - callback error, if any.
 * @param {unknown} stdout - raw stdout.
 * @param {unknown} stderr - raw stderr.
 * @returns {{ stdout: string, stderr: string, code: number | null, signal: string | null, error: unknown, overflowed: boolean }} normalized result.
 */
function normalizeResult(error, stdout, stderr) {
  const out = toText(stdout);
  const err = toText(stderr);
  if (error === null || error === undefined) {
    return { stdout: out, stderr: err, code: 0, signal: null, error: undefined, overflowed: false };
  }
  const code = typeof error.code === "number" ? error.code : null;
  return {
    stdout: out,
    stderr: err,
    code,
    signal: typeof error.signal === "string" ? error.signal : null,
    error,
    overflowed: error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
  };
}

/**
 * Test a user-supplied git reference (branch, tag, remote or object name).
 *
 * Rejects everything a shell-minded caller might smuggle into an argv slot: leading
 * dashes, whitespace/control characters, `..`, `@{`, empty path segments, `.lock`
 * suffixes and trailing dots. Legitimate hashes and `feature/x` style names pass.
 *
 * @param {unknown} value - candidate reference.
 * @returns {boolean} whether the value is safe to pass as one git argument.
 */
export function isValidRefName(value) {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 1024) return false;
  if (value.startsWith("-") || value.startsWith("/")) return false;
  if (!REF_PATTERN.test(value)) return false;
  if (value.includes("..") || value.includes("@{") || value.includes("//")) return false;
  if (value.endsWith(".lock") || value.endsWith("/") || value.endsWith(".")) return false;
  if (value === "." || value === "..") return false;
  return true;
}

/**
 * Test a repository-relative file path used as a diff pathspec.
 * @param {unknown} value - candidate path.
 * @returns {boolean} whether the value is a plausible repository-relative path.
 */
export function isValidRepoPath(value) {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 4096) return false;
  if (value.startsWith("-")) return false;
  if (value.includes(NUL) || value.includes("\n") || value.includes("\r")) return false;
  return true;
}

/**
 * Split text into at most `count` fields, keeping the remainder intact.
 *
 * Using the last field as the remainder keeps commit subjects and bodies (which may
 * themselves contain `%x1f`) intact even though earlier metadata fields cannot.
 *
 * @param {string} text - input text.
 * @param {string} separator - field separator.
 * @param {number} count - maximum number of fields.
 * @returns {string[]} the fields.
 */
function splitFields(text, separator, count) {
  const fields = [];
  let cursor = 0;
  while (fields.length < count - 1) {
    const next = text.indexOf(separator, cursor);
    if (next === -1) break;
    fields.push(text.slice(cursor, next));
    cursor = next + separator.length;
  }
  fields.push(text.slice(cursor));
  return fields;
}

/**
 * Cap one string at a byte budget, preferring a line boundary.
 * @param {unknown} value - input text.
 * @param {number} maxBytes - maximum UTF-8 byte length.
 * @returns {{ text: string, truncated: boolean }} the capped text.
 */
function capText(value, maxBytes) {
  const text = typeof value === "string" ? value : toText(value);
  const buffer = Buffer.from(text, "utf8");
  if (buffer.length <= maxBytes) return { text, truncated: false };
  let capped = buffer.subarray(0, maxBytes).toString("utf8");
  if (capped.endsWith("\uFFFD")) capped = capped.slice(0, -1);
  const lineEnd = capped.lastIndexOf("\n");
  if (lineEnd > 0) capped = capped.slice(0, lineEnd + 1);
  return { text: capped, truncated: true };
}

/**
 * Collapse stdout and stderr into one human-readable block.
 * @param {{ stdout?: string, stderr?: string }} result - command result.
 * @returns {string} combined output.
 */
function combineOutput(result) {
  const parts = [];
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  if (stdout.length > 0) parts.push(stdout);
  if (stderr.length > 0 && stderr !== stdout) parts.push(stderr);
  return parts.join("\n");
}

/**
 * Interpret `%D` decorations as the stable chip strings the UI renders.
 *
 * `HEAD -> main` becomes `HEAD` plus `main`, `tag: v1.0` is preserved verbatim and
 * remote/branch names are left untouched.
 *
 * @param {string} decorations - raw `%D` output.
 * @returns {string[]} decoration chips.
 */
function parseDecorations(decorations) {
  const chips = [];
  for (const raw of String(decorations ?? "").split(",")) {
    const token = raw.trim();
    if (token.length === 0) continue;
    if (token === "HEAD") chips.push("HEAD");
    else if (token.startsWith("HEAD -> ")) {
      chips.push("HEAD");
      const target = token.slice("HEAD -> ".length).trim();
      if (target.length > 0) chips.push(target);
    } else chips.push(token);
  }
  return chips;
}

/**
 * Count changed entries in `git status --porcelain=v1 -z` output.
 * Rename/copy entries carry a second path token which must not be double counted.
 * @param {string} text - NUL-separated porcelain output.
 * @returns {number} number of changed entries.
 */
function countStatusEntries(text) {
  if (typeof text !== "string" || text.length === 0) return 0;
  const tokens = text.split(NUL);
  let count = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length === 0) continue;
    count += 1;
    if (token.length >= 2) {
      const indexStatus = token[0];
      const worktreeStatus = token[1];
      if ((indexStatus === "R" || indexStatus === "C" || worktreeStatus === "R" || worktreeStatus === "C") && index + 1 < tokens.length) {
        index += 1;
      }
    }
  }
  return count;
}

/**
 * Parse `git diff-tree --name-status -z` output.
 * @param {string} text - raw output.
 * @returns {Array<{ status: string, path: string, oldPath: string | null }>} file entries.
 */
function parseNameStatus(text) {
  const tokens = text.split(NUL);
  const files = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.length === 0) {
      index += 1;
      continue;
    }
    const status = token[0];
    if (status === "R" || status === "C") {
      const oldPath = tokens[index + 1] ?? "";
      const filePath = tokens[index + 2] ?? "";
      files.push({ status, path: filePath, oldPath: oldPath.length > 0 ? oldPath : null });
      index += 3;
      continue;
    }
    files.push({ status, path: tokens[index + 1] ?? "", oldPath: null });
    index += 2;
  }
  return files;
}

/**
 * Parse `git diff-tree --numstat -z` output into a path-keyed count map.
 *
 * With `-z` a rename record is `<added>\t<removed>\t\0<old>\0<new>\0`, so an empty
 * path field is completed from the next two tokens.
 *
 * @param {string} text - raw output.
 * @returns {Map<string, { added: number, removed: number, binary: boolean }>} counts keyed by the new path.
 */
function parseNumstat(text) {
  const tokens = text.split(NUL);
  const counts = new Map();
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.length === 0) {
      index += 1;
      continue;
    }
    const parts = token.split("\t");
    if (parts.length < 2) {
      index += 1;
      continue;
    }
    const addedRaw = parts[0];
    const removedRaw = parts[1];
    let filePath = parts.length > 2 ? parts.slice(2).join("\t") : "";
    index += 1;
    if (filePath.length === 0) {
      const newPath = tokens[index + 1] ?? "";
      index += 2;
      filePath = newPath;
    }
    if (filePath.length === 0) continue;
    const binary = addedRaw === "-" || removedRaw === "-";
    counts.set(filePath, {
      added: binary ? 0 : Number.parseInt(addedRaw, 10) || 0,
      removed: binary ? 0 : Number.parseInt(removedRaw, 10) || 0,
      binary,
    });
  }
  return counts;
}

/**
 * Shorten a 40-character object name for messages.
 * @param {string} value - hash or ref.
 * @returns {string} 7-character hash or the unchanged ref.
 */
function shortRef(value) {
  return /^[0-9a-f]{40}$/i.test(value) ? value.slice(0, 7) : value;
}

/**
 * Build the git API around one runner.
 *
 * Every exported method is read-only except {@link performAction}, which runs one of
 * the explicit mutation verbs in the contract. All commands are argv arrays; no text
 * from a caller ever reaches a shell.
 *
 * @param {(argv: string[], options?: { cwd?: string, timeoutMs?: number, maxBuffer?: number }) => Promise<{ stdout: string, stderr: string, code: number | null, error?: unknown, overflowed?: boolean }>} run - command runner.
 * @returns {{ detectRepo: Function, readGraph: Function, readCommit: Function, readDiff: Function, listBranches: Function, performAction: Function }} the API.
 */
export function createGitApi(run) {
  if (typeof run !== "function") throw new TypeError("createGitApi: run must be a function");

  /**
   * Run one git command and normalize failures to a result instead of throwing.
   * @param {string} cwd - working directory.
   * @param {string[]} argv - git arguments (without global flags).
   * @param {{ maxBuffer?: number, timeoutMs?: number }} [options] - runner overrides.
   * @returns {Promise<{ stdout: string, stderr: string, code: number | null, error?: unknown, overflowed: boolean }>} result.
   */
  async function git(cwd, argv, options = {}) {
    let result;
    try {
      result = await run(argv, { cwd, ...options });
    } catch (error) {
      return { stdout: "", stderr: typeof error?.message === "string" ? error.message : String(error), code: null, error, overflowed: false };
    }
    if (result === null || typeof result !== "object") {
      return { stdout: "", stderr: "", code: null, error: undefined, overflowed: false };
    }
    return {
      stdout: toText(result.stdout),
      stderr: toText(result.stderr),
      code: typeof result.code === "number" ? result.code : result.code === null ? null : 0,
      error: result.error,
      overflowed: result.overflowed === true,
    };
  }

  /**
   * Detect the containing repository of a directory.
   * @param {string} cwd - absolute directory to inspect.
   * @returns {Promise<{ isRepo: boolean, repoPath: string | null, error?: string, message?: string }>} detection result.
   */
  async function detectRepo(cwd) {
    if (typeof cwd !== "string" || cwd.length === 0) {
      return { isRepo: false, repoPath: null, error: "NOT_A_REPO", message: "no working directory was supplied" };
    }
    const result = await git(cwd, ["rev-parse", "--show-toplevel"]);
    const toplevel = result.stdout.trim();
    if (result.code !== 0 || toplevel.length === 0) {
      const detail = result.stderr.trim() || result.stdout.trim();
      return {
        isRepo: false,
        repoPath: null,
        error: "NOT_A_REPO",
        message: detail.length > 0 ? capText(detail, MAX_ERROR_BYTES).text : `${cwd} is not a git repository`,
      };
    }
    return { isRepo: true, repoPath: toplevel };
  }

  /**
   * Read HEAD identity.
   * @param {string} repoPath - repository root.
   * @returns {Promise<{ branch: string | null, hash: string | null, detached: boolean }>} HEAD state.
   */
  async function readHead(repoPath) {
    const hashResult = await git(repoPath, ["rev-parse", "HEAD"]);
    const hash = hashResult.code === 0 ? hashResult.stdout.trim() || null : null;
    const branchResult = await git(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
    let branch = branchResult.code === 0 ? branchResult.stdout.trim() : "";
    if (branch.length === 0) {
      const symbolic = await git(repoPath, ["symbolic-ref", "--short", "-q", "HEAD"]);
      branch = symbolic.code === 0 ? symbolic.stdout.trim() : "";
    }
    const detached = branch.length === 0 || branch === "HEAD";
    return { branch: detached ? null : branch, hash, detached };
  }

  /**
   * Read refs under `refs/heads`, `refs/remotes` and `refs/tags`.
   * @param {string} repoPath - repository root.
   * @param {boolean} showRemoteBranches - include `refs/remotes/*`.
   * @returns {Promise<Array<{ name: string, shortName: string, type: string, hash: string, head: boolean, upstream: string | null }>>} refs.
   */
  async function readRefs(repoPath, showRemoteBranches) {
    const result = await git(repoPath, ["for-each-ref", `--format=${REF_FORMAT}`, "refs/heads", "refs/remotes", "refs/tags"]);
    if (result.code !== 0) return [];
    const refs = [];
    for (const line of result.stdout.split("\n")) {
      if (line.length === 0) continue;
      const fields = line.split(NUL);
      if (fields.length < 2) continue;
      const name = fields[0];
      const hash = fields[1];
      const isHead = (fields[2] ?? "").trim() === "*";
      const upstream = (fields[3] ?? "").trim();
      let type;
      let shortName;
      if (name.startsWith("refs/heads/")) {
        type = "branch";
        shortName = name.slice("refs/heads/".length);
      } else if (name.startsWith("refs/remotes/")) {
        if (!showRemoteBranches) continue;
        type = "remote";
        shortName = name.slice("refs/remotes/".length);
      } else if (name.startsWith("refs/tags/")) {
        type = "tag";
        shortName = name.slice("refs/tags/".length);
      } else continue;
      refs.push({ name, shortName, type, hash, head: isHead, upstream: upstream.length > 0 ? upstream : null });
    }
    return refs;
  }

  /**
   * Read one page of the graph.
   * @param {string} cwd - workspace directory (a session cwd or a request override).
   * @param {{ maxCommits?: number, showRemoteBranches?: boolean }} [options] - page options.
   * @returns {Promise<object>} graph value documented in CONTRACT.md.
   */
  async function readGraph(cwd, options = {}) {
    const workspacePath = typeof cwd === "string" ? cwd : "";
    const requested = Number.isSafeInteger(options.maxCommits) && options.maxCommits > 0 ? options.maxCommits : DEFAULT_MAX_COMMITS;
    const maxCommits = Math.min(requested, MAX_COMMITS_LIMIT);
    const showRemoteBranches = options.showRemoteBranches !== false;
    const generatedAt = Date.now();
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) {
      return {
        repoPath: detection.repoPath ?? null,
        workspacePath,
        isRepo: false,
        error: "NOT_A_REPO",
        message: detection.message ?? null,
        head: null,
        status: null,
        refs: [],
        commits: [],
        truncated: false,
        generatedAt,
      };
    }
    const repoPath = detection.repoPath ?? workspacePath;

    const head = await readHead(repoPath);
    const [statusResult, refs, logResult] = await Promise.all([
      git(repoPath, ["status", "--porcelain=v1", "-z"]),
      readRefs(repoPath, showRemoteBranches),
      git(repoPath, [
        "log",
        "--date-order",
        `--max-count=${maxCommits + 1}`,
        "-z",
        `--format=${LOG_FORMAT}`,
        "--branches",
        "--tags",
        ...(showRemoteBranches ? ["--remotes"] : []),
        "HEAD",
      ]),
    ]);
    const dirty = statusResult.code === 0 ? countStatusEntries(statusResult.stdout) : 0;
    const commits = [];
    if (logResult.code === 0) {
      for (const record of logResult.stdout.split(NUL)) {
        if (record.length === 0) continue;
        const fields = splitFields(record, FIELD, 10);
        if (fields.length < 10) continue;
        const [hash, parents, authorName, authorEmail, authorTime, committerName, committerEmail, committerTime, decorations, subject] = fields;
        commits.push({
          hash,
          abbrev: hash.slice(0, 7),
          parents: parents.split(" ").filter((parent) => parent.length > 0),
          authorName,
          authorEmail,
          authorTime: Number.parseInt(authorTime, 10) || 0,
          committerName,
          committerEmail,
          committerTime: Number.parseInt(committerTime, 10) || 0,
          subject,
          refs: parseDecorations(decorations),
        });
      }
    }
    const truncated = commits.length > maxCommits;
    return {
      repoPath,
      workspacePath,
      isRepo: true,
      head,
      status: { branch: head.branch, detached: head.detached, dirty },
      refs,
      commits: commits.slice(0, maxCommits),
      truncated,
      generatedAt,
    };
  }

  /**
   * Read one commit with metadata, stats and its file list.
   *
   * For a merge commit the file list is the change the merge introduced relative to
   * its first parent, matching how `git diff-tree <parent> <merge>` reports it.
   *
   * @param {string} cwd - workspace directory.
   * @param {string} hash - commit hash or ref.
   * @returns {Promise<object>} commit detail value documented in CONTRACT.md.
   * @throws {GitGraphError} `BAD_REQUEST`, `NOT_A_REPO` or `GIT_FAILED`.
   */
  async function readCommit(cwd, hash) {
    if (!isValidRefName(hash)) throw new GitGraphError("BAD_REQUEST", `invalid commit hash or ref: ${JSON.stringify(hash)}`);
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) throw new GitGraphError("NOT_A_REPO", `not a git repository: ${cwd}`);
    const repoPath = detection.repoPath ?? cwd;

    const metaResult = await git(repoPath, ["show", "-s", `--format=${SHOW_FORMAT}`, hash]);
    if (metaResult.code !== 0) throw gitFailure("show", metaResult);

    const text = metaResult.stdout.replace(/\r?\n$/, "");
    const fields = splitFields(text, FIELD, 11);
    if (fields.length < 11) throw new GitGraphError("GIT_FAILED", `could not parse commit metadata for ${hash}`);
    const [fullHash, parentField, authorName, authorEmail, authorTime, committerName, committerEmail, committerTime, decorations, subject, body] = fields;
    const parents = parentField.split(" ").filter((parent) => parent.length > 0);

    /*
     * A merge commit introduces its changes relative to its FIRST parent; a bare
     * `diff-tree <merge>` prints nothing. The non-merge argv stays byte-identical
     * (`--root` still covers the root commit).
     */
    const firstParent = parents.length > 1 ? parents[0] : null;
    const diffTreeFlags = firstParent === null ? ["--root", "--no-commit-id", "-r", "-M"] : ["--no-commit-id", "-r", "-M"];
    const diffTreeRevisions = firstParent === null ? [hash] : [firstParent, hash];
    const [nameStatusResult, numstatResult] = await Promise.all([
      git(repoPath, ["diff-tree", ...diffTreeFlags, "--name-status", "-z", ...diffTreeRevisions]),
      git(repoPath, ["diff-tree", ...diffTreeFlags, "--numstat", "-z", ...diffTreeRevisions]),
    ]);

    const numstat = numstatResult.code === 0 ? parseNumstat(numstatResult.stdout) : new Map();
    const files = nameStatusResult.code === 0 ? parseNameStatus(nameStatusResult.stdout) : [];
    let insertions = 0;
    let deletions = 0;
    for (const file of files) {
      const counts = numstat.get(file.path) ?? (file.oldPath !== null ? numstat.get(file.oldPath) : undefined);
      file.added = counts?.added ?? 0;
      file.removed = counts?.removed ?? 0;
      file.binary = counts?.binary ?? false;
      insertions += file.added;
      deletions += file.removed;
    }

    return {
      hash: fullHash,
      abbrev: fullHash.slice(0, 7),
      parents,
      authorName,
      authorEmail,
      authorTime: Number.parseInt(authorTime, 10) || 0,
      committerName,
      committerEmail,
      committerTime: Number.parseInt(committerTime, 10) || 0,
      subject,
      body: capText(body, MAX_DETAIL_BYTES).text,
      refs: parseDecorations(decorations),
      stats: { files: files.length, insertions, deletions },
      files,
    };
  }

  /**
   * Render the patch of one file in one commit.
   *
   * A merge commit is diffed against its first parent (see {@link readCommit}), so a
   * file row from the merge detail always opens a real patch.
   *
   * @param {string} cwd - workspace directory.
   * @param {{ hash?: string, path?: string, file?: string, oldPath?: string | null, status?: string }} input - diff request.
   * @returns {Promise<{ patch: string, truncated: boolean, binary: boolean }>} diff value.
   * @throws {GitGraphError} `BAD_REQUEST`, `NOT_A_REPO` or `GIT_FAILED`.
   */
  async function readDiff(cwd, input = {}) {
    const hash = input.hash;
    const filePath = input.file ?? input.path;
    const oldPath = input.oldPath;
    if (!isValidRefName(hash)) throw new GitGraphError("BAD_REQUEST", `invalid commit hash or ref: ${JSON.stringify(hash)}`);
    if (!isValidRepoPath(filePath)) throw new GitGraphError("BAD_REQUEST", `invalid file path: ${JSON.stringify(filePath)}`);
    if (oldPath !== undefined && oldPath !== null && oldPath !== "" && !isValidRepoPath(oldPath)) {
      throw new GitGraphError("BAD_REQUEST", `invalid old file path: ${JSON.stringify(oldPath)}`);
    }
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) throw new GitGraphError("NOT_A_REPO", `not a git repository: ${cwd}`);
    const repoPath = detection.repoPath ?? cwd;

    /*
     * A merge commit is diffed against its first parent: plain `git show <merge>`
     * only prints a combined diff, so a file row taken from the first-parent file
     * list could otherwise open an empty patch. Non-merge commits keep using
     * `git show <hash> -- <file>`.
     */
    const parentsResult = await git(repoPath, ["rev-list", "--parents", "-n", "1", hash]);
    if (parentsResult.code !== 0) throw gitFailure("rev-list", parentsResult);
    const parentTokens = parentsResult.stdout.trim().split(/\s+/).filter((token) => token.length > 0);
    const firstParent = parentTokens.length > 2 ? parentTokens[1] : null;
    const argv =
      firstParent === null
        ? ["show", "--format=", "--find-renames", "--no-ext-diff", "--patch", "--no-color", hash, "--", filePath]
        : ["diff", "--find-renames", "--no-ext-diff", "--patch", "--no-color", firstParent, hash, "--", filePath];
    if (typeof oldPath === "string" && oldPath.length > 0) argv.push(oldPath);
    const result = await git(repoPath, argv);
    if (result.code !== 0) throw gitFailure(firstParent === null ? "show" : "diff", result);

    const patch = result.stdout;
    const binary = /^Binary files .* differ$/m.test(patch) || /^GIT binary patch$/m.test(patch) || patch.includes("GIT binary patch");
    const capped = binary ? { text: "", truncated: false } : capText(patch, MAX_DIFF_BYTES);
    return { patch: capped.text, truncated: capped.truncated || result.overflowed, binary };
  }

  /**
   * List local branches.
   * @param {string} cwd - workspace directory.
   * @returns {Promise<{ isRepo: boolean, error?: string, current: string | null, detached: boolean, branches: Array<{ name: string, shortName: string, hash: string, current: boolean, upstream: string | null }> }>} branch list.
   */
  async function listBranches(cwd) {
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) {
      return { isRepo: false, error: "NOT_A_REPO", current: null, detached: false, branches: [] };
    }
    const repoPath = detection.repoPath ?? cwd;
    const [head, refs] = await Promise.all([readHead(repoPath), readRefs(repoPath, false)]);
    const branches = refs
      .filter((ref) => ref.type === "branch")
      .map((ref) => ({
        name: ref.name,
        shortName: ref.shortName,
        hash: ref.hash,
        current: head.branch !== null && ref.shortName === head.branch,
        upstream: ref.upstream,
      }));
    return { isRepo: true, current: head.branch, detached: head.detached, branches };
  }

  /**
   * Run one explicit repository mutation.
   *
   * Supported actions and arguments match CONTRACT.md exactly. Every ref-like
   * argument is validated before it is placed in the argv array.
   *
   * @param {string} cwd - workspace directory.
   * @param {string} action - one of checkoutBranch, checkoutCommit, createBranch, deleteBranch, cherryPick, revertCommit, createTag, deleteTag, fetch.
   * @param {object} [args] - action arguments.
   * @returns {Promise<{ message: string, output: string }>} success description and combined output.
   * @throws {GitGraphError} `BAD_REQUEST`, `NOT_A_REPO` or `GIT_FAILED`.
   */
  async function performAction(cwd, action, args = {}) {
    if (typeof action !== "string" || action.length === 0) throw new GitGraphError("BAD_REQUEST", "action is required");
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) throw new GitGraphError("NOT_A_REPO", `not a git repository: ${cwd}`);
    const repoPath = detection.repoPath ?? cwd;

    let argv;
    let fallback = null;
    let message;
    switch (action) {
      case "checkoutBranch": {
        const branch = requireRefArg(args, "branch");
        argv = ["switch", branch];
        fallback = ["checkout", branch];
        message = `Checked out branch "${branch}".`;
        break;
      }
      case "checkoutCommit": {
        const hash = requireRefArg(args, "hash");
        argv = ["switch", "--detach", hash];
        message = `Checked out ${shortRef(hash)} (detached HEAD).`;
        break;
      }
      case "createBranch": {
        const branchName = requireRefArg(args, "name");
        const startPoint = requireRefArg(args, "startPoint");
        argv = ["branch", branchName, startPoint];
        message = `Created branch "${branchName}" at ${shortRef(startPoint)}.`;
        break;
      }
      case "deleteBranch": {
        const branchName = requireRefArg(args, "name");
        argv = ["branch", args?.force === true ? "-D" : "-d", branchName];
        message = `Deleted branch "${branchName}".`;
        break;
      }
      case "cherryPick": {
        const hash = requireRefArg(args, "hash");
        argv = ["cherry-pick", hash];
        message = `Cherry-picked ${shortRef(hash)}.`;
        break;
      }
      case "revertCommit":
      /* The Web client uses the shorter verb `revert`; both map to the same command. */
      case "revert": {
        const hash = requireRefArg(args, "hash");
        argv = ["revert", "--no-edit", hash];
        message = `Reverted ${shortRef(hash)}.`;
        break;
      }
      case "createTag": {
        const tagName = requireRefArg(args, "name");
        const hash = requireRefArg(args, "hash");
        argv = ["tag", tagName, hash];
        message = `Created tag "${tagName}" at ${shortRef(hash)}.`;
        break;
      }
      case "deleteTag": {
        const tagName = requireRefArg(args, "name");
        argv = ["tag", "-d", tagName];
        message = `Deleted tag "${tagName}".`;
        break;
      }
      case "fetch": {
        const remote = args?.remote;
        if (remote !== undefined && remote !== null && remote !== "") requireRefArg(args, "remote");
        argv = ["fetch", "--prune"];
        if (typeof remote === "string" && remote.length > 0) argv.push(remote);
        message = remote ? `Fetched from "${remote}" with --prune.` : "Fetched from all remotes with --prune.";
        break;
      }
      default:
        throw new GitGraphError("BAD_REQUEST", `unknown action: ${JSON.stringify(action)}`);
    }

    let result = await git(repoPath, argv);
    /* `git switch` is the modern verb; fall back for repositories/versions without it. */
    if (result.code !== 0 && fallback !== null) result = await git(repoPath, fallback);
    if (result.code !== 0) throw gitFailure(action, result);
    return { message, output: capText(combineOutput(result), MAX_DETAIL_BYTES).text };
  }

  return { detectRepo, readGraph, readCommit, readDiff, listBranches, performAction };
}

/**
 * Validate one required ref-like action argument.
 * @param {object} args - action arguments.
 * @param {string} key - argument name.
 * @returns {string} the validated value.
 */
function requireRefArg(args, key) {
  const value = args?.[key];
  if (typeof value !== "string" || value.length === 0) throw new GitGraphError("BAD_REQUEST", `missing required argument "${key}"`);
  if (!isValidRefName(value)) throw new GitGraphError("BAD_REQUEST", `invalid git reference for "${key}": ${JSON.stringify(value)}`);
  return value;
}

/**
 * Translate a failed git command into a `GIT_FAILED` error carrying git stderr.
 * @param {string} action - command or action label.
 * @param {{ stdout: string, stderr: string, code: number | null }} result - failed command result.
 * @returns {GitGraphError} the error.
 */
function gitFailure(action, result) {
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const detail = stderr.length > 0 ? stderr : stdout;
  const message = detail.length > 0 ? capText(detail, MAX_ERROR_BYTES).text : `git ${action} failed with exit code ${result.code}`;
  return new GitGraphError("GIT_FAILED", message, { stdout: result.stdout, stderr: result.stderr });
}

/** Default API instance backed by the real `git` binary. */
export const api = createGitApi(createGitRunner());
