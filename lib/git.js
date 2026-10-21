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
import fs from "node:fs";
import path from "node:path";

/** Default number of commits in one graph page. */
export const DEFAULT_MAX_COMMITS = 400;

/** Hard upper bound accepted for a graph page. */
export const MAX_COMMITS_LIMIT = 2000;

/** Byte cap for commit bodies and action output. */
export const MAX_DETAIL_BYTES = 8 * 1024;

/** Byte cap for one rendered diff. */
export const MAX_DIFF_BYTES = 300 * 1024;

/** Maximum number of commits one full-history search examines (one git call). */
export const SEARCH_SCAN_LIMIT = 20_000;

/** Default page size of one full-history search. */
export const SEARCH_DEFAULT_LIMIT = 50;

/** Hard upper bound accepted for one search page. */
export const SEARCH_MAX_LIMIT = 200;

/** Longest accepted search query, measured after trimming. */
export const SEARCH_MAX_QUERY_LENGTH = 200;

/** Search scopes accepted by `searchCommits`; each names the facet that is matched. */
export const SEARCH_SCOPES = new Set(["all", "message", "author", "ref"]);

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

/**
 * Mailmap-aware `git log` format used when `useMailmap` is on.
 *
 * `%an`/`%ae` are the raw values and ignore `.mailmap` even with `--use-mailmap`;
 * `%aN`/`%aE` (and `%cN`/`%cE`) are the placeholders that honour it.
 */
const LOG_FORMAT_MAILMAP = `%H%x1f%P%x1f%aN%x1f%aE%x1f%at%x1f%cN%x1f%cE%x1f%ct%x1f%D%x1f%s`;

/**
 * Full-history search record format: the graph fields plus the raw commit body.
 *
 * The body is appended as the last field because {@link splitFields} keeps the
 * remainder intact, so a body containing `%x1f` cannot break the metadata fields.
 */
const SEARCH_LOG_FORMAT = `${LOG_FORMAT}%x1f%b`;

/** Mailmap-aware search record format (see {@link LOG_FORMAT_MAILMAP}). */
const SEARCH_LOG_FORMAT_MAILMAP = `${LOG_FORMAT_MAILMAP}%x1f%b`;

/** `git show -s` metadata format: signature fields then subject, body last. */
const SHOW_FORMAT = `%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%G?%x1f%GS%x1f%GK%x1f%s%x1f%b`;

/** Signature statuses `git show %G?` can report (`N` means unsigned). */
const SIGNATURE_STATUSES = new Set(["G", "B", "U", "X", "Y", "R", "N"]);

/** `git for-each-ref` format. */
const REF_FORMAT = "%(refname)%00%(objectname)%00%(HEAD)%00%(upstream:short)";

/** The only git references accepted as user input. */
const REF_PATTERN = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;

/** Diff scopes accepted by the API's `readDiff`. */
const DIFF_SCOPES = new Set(["commit", "staged", "unstaged", "compare", "working"]);

/** Graph orderings accepted by `readGraph`, mapped to their `git log` flag. */
const GRAPH_ORDER_FLAGS = {
  date: "--date-order",
  "author-date": "--author-date-order",
  topo: "--topo-order",
};

/** Hard cap on branch filters accepted in one graph request. */
const MAX_BRANCH_FILTERS = 100;

/** Commit reset modes accepted by `resetToCommit`. */
const RESET_MODES = ["soft", "mixed", "hard"];

/** Working-tree reset modes accepted by `resetUncommitted` (never soft). */
const RESET_UNCOMMITTED_MODES = ["mixed", "hard"];

/** `git stash list` record format (selector, hash, reflog subject, author, time). */
const STASH_FORMAT = "%gd%x1f%H%x1f%gs%x1f%an%x1f%at";

/** Maximum remotes accepted by `pushToMultipleRemotes` in one request. */
const MAX_PUSH_REMOTES = 10;

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
 * Parse one NUL-delimited `git log --format=…` record into the graph commit shape.
 *
 * The graph format ends with the subject (see {@link LOG_FORMAT}); the full-history
 * search appends the raw body as one extra field (see {@link SEARCH_LOG_FORMAT}) so
 * the very same parser feeds `readGraph` rows and `searchCommits` hits.
 *
 * @param {string} record - one record without its NUL terminator.
 * @param {{ withBody?: boolean }} [options] - whether the format included `%b` as the last field.
 * @returns {{ commit: object, body: string } | null} parsed record, or null when malformed.
 */
function parseLogRecord(record, { withBody = false } = {}) {
  const fieldCount = withBody ? 11 : 10;
  const fields = splitFields(record, FIELD, fieldCount);
  if (fields.length < fieldCount) return null;
  const [hash, parents, authorName, authorEmail, authorTime, committerName, committerEmail, committerTime, decorations, subject] = fields;
  return {
    commit: {
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
    },
    body: withBody ? (fields[10] ?? "") : "",
  };
}

/**
 * Build the searchable text of one commit for one scope.
 *
 * The caller lowercases this text and the query, so matching is a case-insensitive
 * substring check over exactly the requested facet. `all` covers subject, body,
 * author name/email, the short hash and every ref chip.
 *
 * @param {object} commit - parsed graph commit.
 * @param {string} body - raw commit body (empty for the graph format).
 * @param {string} scope - one of `SEARCH_SCOPES`.
 * @returns {string} the facet text.
 */
function searchFacet(commit, body, scope) {
  switch (scope) {
    case "message":
      return `${commit.subject}\n${body}`;
    case "author":
      return `${commit.authorName}\n${commit.authorEmail}`;
    case "ref":
      return commit.refs.join("\n");
    default:
      return [commit.subject, body, commit.authorName, commit.authorEmail, commit.abbrev, ...commit.refs].join("\n");
  }
}

/**
 * Test one `%D` decoration chip against the graph settings that hide ref kinds.
 *
 * `%D` decorates with every ref that points at the commit, including refs the walk
 * itself excludes, so the chips need the same filters as the ref list: tag chips when
 * `showTags` is off, remote branch chips when `showRemoteBranches` is off, and the
 * `refs/remotes/<remote>/HEAD` pseudo-ref chips when `showRemoteHeads` is off.
 *
 * @param {string} chip - one decoration chip produced by {@link parseDecorations}.
 * @param {{ showTags: boolean, showRemoteBranches: boolean, showRemoteHeads: boolean, remoteNames: Set<string>, remoteHeadNames: Set<string> }} options - visibility flags and remote label sets.
 * @returns {boolean} whether the chip stays visible.
 */
function decorationVisible(chip, { showTags, showRemoteBranches, showRemoteHeads, remoteNames, remoteHeadNames }) {
  if (!showTags && chip.startsWith("tag: ")) return false;
  if (!showRemoteBranches && remoteNames.has(chip)) return false;
  if (!showRemoteHeads && remoteHeadNames.has(chip)) return false;
  return true;
}

/**
 * Parse `git status --porcelain=v1 -z` output into per-record X/Y entries.
 *
 * With `-z` a rename/copy record is `XY <new path>\0<old path>\0`; every other record
 * is `XY <path>\0`. `X` is the index (staged) letter and `Y` the worktree (unstaged)
 * letter, so one record can describe both a staged and an unstaged change.
 *
 * @param {string} text - NUL-separated porcelain output.
 * @returns {Array<{ x: string, y: string, path: string, oldPath: string | null }>} status records.
 */
function parseStatusEntries(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  const tokens = text.split(NUL);
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length < 3) continue;
    const x = token[0];
    const y = token[1];
    const filePath = token.slice(3);
    let oldPath = null;
    if (x === "R" || x === "C" || y === "R" || y === "C") {
      const next = tokens[index + 1];
      if (typeof next === "string" && next.length > 0) {
        oldPath = next;
        index += 1;
      }
    }
    entries.push({ x, y, path: filePath, oldPath });
  }
  return entries;
}

/**
 * Count changed entries in `git status --porcelain=v1 -z` output.
 * Rename/copy entries carry a second path token which must not be double counted.
 * @param {string} text - NUL-separated porcelain output.
 * @returns {number} number of changed entries.
 */
function countStatusEntries(text) {
  return parseStatusEntries(text).length;
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
 * Merge `--numstat` line counts into a `--name-status` file list.
 *
 * A rename record is keyed by its new path, so the old path is the fallback lookup.
 * Mutates each file entry (added/removed/binary) and returns the aggregate counts.
 *
 * @param {Array<{ status: string, path: string, oldPath: string | null }>} files - name/status entries.
 * @param {Map<string, { added: number, removed: number, binary: boolean }>} numstat - counts by path.
 * @returns {{ insertions: number, deletions: number }} total added and removed lines.
 */
function applyNumstat(files, numstat) {
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
  return { insertions, deletions };
}

/** Read size for one untracked-file binary/line-count probe. */
const UNTRACKED_PROBE_CHUNK = 64 * 1024;

/**
 * Probe one untracked file for binary content and its line count.
 *
 * The file is read in chunks (never fully buffered) and treated as binary as soon as
 * a NUL byte appears, mirroring what git's numstat reports for new files. A symlink
 * counts as its one-line target path, exactly like a blob containing it.
 *
 * @param {string} absolutePath - file inside the repository worktree.
 * @returns {{ added: number, binary: boolean }} line count (0 for binary) and the binary flag.
 */
function probeUntrackedFile(absolutePath) {
  let stats;
  try {
    stats = fs.lstatSync(absolutePath);
  } catch {
    return { added: 0, binary: false };
  }
  if (stats.isSymbolicLink()) return { added: 1, binary: false };
  if (!stats.isFile()) return { added: 0, binary: false };
  let descriptor;
  try {
    descriptor = fs.openSync(absolutePath, "r");
  } catch {
    return { added: 0, binary: false };
  }
  try {
    const buffer = Buffer.allocUnsafe(UNTRACKED_PROBE_CHUNK);
    let added = 0;
    let binary = false;
    let bytes = 0;
    let lastByte = -1;
    for (;;) {
      const read = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (read <= 0) break;
      bytes += read;
      lastByte = buffer[read - 1];
      for (let index = 0; index < read; index += 1) {
        const byte = buffer[index];
        if (byte === 0) binary = true;
        else if (byte === 10) added += 1;
      }
    }
    if (bytes === 0) return { added: 0, binary: false };
    /* A final line without a trailing newline still counts as one added line. */
    if (!binary && lastByte !== 10) added += 1;
    return { added: binary ? 0 : added, binary };
  } catch {
    return { added: 0, binary: false };
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch {
      /* the probe is best effort */
    }
  }
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
 * Normalize the optional `branches` graph filter.
 *
 * `undefined`/`null`/`[]` all mean "no filter" and return `null`, so the caller keeps
 * today's revision walk byte-for-byte. A non-empty filter is syntax-validated here;
 * existence is checked by the caller once the repository is known.
 *
 * @param {unknown} value - raw `branches` option.
 * @returns {string[] | null} validated ref names, or null for "every ref".
 * @throws {GitGraphError} `BAD_REQUEST` for a non-array, too many entries or an unsafe ref.
 */
function normalizeBranchFilters(value) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new GitGraphError("BAD_REQUEST", "branches must be an array of ref names");
  if (value.length === 0) return null;
  if (value.length > MAX_BRANCH_FILTERS) {
    throw new GitGraphError("BAD_REQUEST", `too many branch filters (max ${MAX_BRANCH_FILTERS})`);
  }
  const filters = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !isValidRefName(entry)) {
      throw new GitGraphError("BAD_REQUEST", `invalid branch filter: ${JSON.stringify(entry)}`);
    }
    filters.push(entry);
  }
  return filters;
}

/**
 * Validate and normalize one full-history search request.
 *
 * The query is trimmed and limited to {@link SEARCH_MAX_QUERY_LENGTH} characters,
 * `scope` must be one of {@link SEARCH_SCOPES} (default `all`), `limit` is an integer
 * in `1..SEARCH_MAX_LIMIT` (default 50) and `offset` an integer `>= 0` (default 0).
 *
 * @param {unknown} options - raw request options.
 * @returns {{ query: string, scope: string, limit: number, offset: number }} normalized request.
 * @throws {GitGraphError} `BAD_REQUEST` naming the first invalid field.
 */
function normalizeSearchRequest(options) {
  const source = options !== null && typeof options === "object" ? options : {};
  const rawQuery = source.query;
  if (typeof rawQuery !== "string" || rawQuery.trim().length === 0) throw new GitGraphError("BAD_REQUEST", "query is required");
  const query = rawQuery.trim();
  if (query.length > SEARCH_MAX_QUERY_LENGTH) {
    throw new GitGraphError("BAD_REQUEST", `invalid query: must be at most ${SEARCH_MAX_QUERY_LENGTH} characters`);
  }

  const rawScope = source.scope;
  const scope = rawScope === undefined || rawScope === null || rawScope === "" ? "all" : rawScope;
  if (typeof scope !== "string" || !SEARCH_SCOPES.has(scope)) {
    throw new GitGraphError("BAD_REQUEST", `invalid scope: ${JSON.stringify(rawScope)}; expected all, message, author or ref`);
  }

  const rawLimit = source.limit;
  let limit = SEARCH_DEFAULT_LIMIT;
  if (rawLimit !== undefined && rawLimit !== null) {
    if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > SEARCH_MAX_LIMIT) {
      throw new GitGraphError("BAD_REQUEST", `invalid limit: ${JSON.stringify(rawLimit)}; expected an integer between 1 and ${SEARCH_MAX_LIMIT}`);
    }
    limit = rawLimit;
  }

  const rawOffset = source.offset;
  let offset = 0;
  if (rawOffset !== undefined && rawOffset !== null) {
    if (!Number.isSafeInteger(rawOffset) || rawOffset < 0) {
      throw new GitGraphError("BAD_REQUEST", `invalid offset: ${JSON.stringify(rawOffset)}; expected an integer >= 0`);
    }
    offset = rawOffset;
  }

  return { query, scope, limit, offset };
}

/**
 * Map the optional graph `order` option to its `git log` flag.
 * @param {unknown} value - raw `order` option.
 * @returns {string} the flag; defaults to `--date-order`.
 * @throws {GitGraphError} `BAD_REQUEST` for an unknown ordering.
 */
function resolveGraphOrderFlag(value) {
  if (value === undefined || value === null || value === "") return GRAPH_ORDER_FLAGS.date;
  if (typeof value === "string" && Object.hasOwn(GRAPH_ORDER_FLAGS, value)) return GRAPH_ORDER_FLAGS[value];
  throw new GitGraphError("BAD_REQUEST", `invalid order: ${JSON.stringify(value)}; expected date, author-date or topo`);
}

/**
 * Read one required action argument from a literal allow-list.
 * @param {object} args - action arguments.
 * @param {string} key - argument name.
 * @param {string[]} allowed - accepted literals.
 * @returns {string} the validated value.
 * @throws {GitGraphError} `BAD_REQUEST` when missing or outside the allow-list.
 */
function requireEnumArg(args, key, allowed) {
  const value = args?.[key];
  if (typeof value !== "string" || value.length === 0) throw new GitGraphError("BAD_REQUEST", `missing required argument "${key}"`);
  if (!allowed.includes(value)) {
    throw new GitGraphError("BAD_REQUEST", `invalid ${key}: ${JSON.stringify(value)}; expected ${allowed.join(" or ")}`);
  }
  return value;
}

/**
 * Read one required stash index: an integer `>= 0`, never raw text.
 * @param {object} args - action arguments.
 * @param {string} key - argument name.
 * @returns {number} the validated index.
 * @throws {GitGraphError} `BAD_REQUEST` when missing, non-integer or negative.
 */
function requireIndexArg(args, key) {
  const value = args?.[key];
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new GitGraphError("BAD_REQUEST", `invalid stash index for "${key}": ${JSON.stringify(value)}; expected an integer >= 0`);
  }
  return value;
}

/**
 * Read one optional ref-like action argument (`undefined`/`null`/`""` means absent).
 * @param {object} args - action arguments.
 * @param {string} key - argument name.
 * @returns {string | undefined} the validated value, or undefined.
 * @throws {GitGraphError} `BAD_REQUEST` when present but unsafe.
 */
function optionalRefArg(args, key) {
  const value = args?.[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !isValidRefName(value)) {
    throw new GitGraphError("BAD_REQUEST", `invalid git reference for "${key}": ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Read one required free-text action argument (URLs, stash messages).
 *
 * Text is never shell-interpreted; it is one argv slot. NUL/CR/LF are rejected so no
 * argument can smuggle a second logical token, and a leading dash is rejected for
 * URLs because git parses options positionally.
 *
 * @param {object} args - action arguments.
 * @param {string} key - argument name.
 * @param {{ allowLeadingDash?: boolean }} [options] - allow a leading dash (stash message).
 * @returns {string} the validated text.
 * @throws {GitGraphError} `BAD_REQUEST` when missing or unsafe.
 */
function requireTextArg(args, key, { allowLeadingDash = false } = {}) {
  const value = args?.[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new GitGraphError("BAD_REQUEST", `missing required argument "${key}"`);
  if (value.length > 4096) throw new GitGraphError("BAD_REQUEST", `argument "${key}" is too long`);
  if (value.includes(NUL) || value.includes("\n") || value.includes("\r")) {
    throw new GitGraphError("BAD_REQUEST", `invalid argument "${key}": control characters are not allowed`);
  }
  if (!allowLeadingDash && value.startsWith("-")) {
    throw new GitGraphError("BAD_REQUEST", `invalid argument "${key}": must not start with "-"`);
  }
  return value;
}

/**
 * Read one optional free-text action argument.
 * @param {object} args - action arguments.
 * @param {string} key - argument name.
 * @returns {string | undefined} the validated text, or undefined.
 * @throws {GitGraphError} `BAD_REQUEST` when present but unsafe.
 */
function optionalTextArg(args, key) {
  const value = args?.[key];
  if (value === undefined || value === null || value === "") return undefined;
  return requireTextArg(args, key, { allowLeadingDash: true });
}

/**
 * Read one required repository-relative path argument.
 * @param {object} args - action arguments.
 * @param {string} key - argument name.
 * @returns {string} the validated path.
 * @throws {GitGraphError} `BAD_REQUEST` when missing or unsafe.
 */
function requirePathArg(args, key) {
  const value = args?.[key];
  if (typeof value !== "string" || value.length === 0) throw new GitGraphError("BAD_REQUEST", `missing required argument "${key}"`);
  if (!isValidRepoPath(value)) throw new GitGraphError("BAD_REQUEST", `invalid repository path for "${key}": ${JSON.stringify(value)}`);
  return value;
}

/**
 * Read a required non-empty array of remote names (checked with the ref validator).
 * @param {object} args - action arguments.
 * @param {string} key - argument name.
 * @returns {string[]} validated remote names, in request order.
 * @throws {GitGraphError} `BAD_REQUEST` when missing, empty, too long or unsafe.
 */
function requireRemoteListArg(args, key) {
  const value = args?.[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new GitGraphError("BAD_REQUEST", `"${key}" must be a non-empty array of remote names`);
  }
  if (value.length > MAX_PUSH_REMOTES) {
    throw new GitGraphError("BAD_REQUEST", `too many remotes: ${value.length} (max ${MAX_PUSH_REMOTES})`);
  }
  const remotes = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !isValidRefName(entry)) {
      throw new GitGraphError("BAD_REQUEST", `invalid remote name: ${JSON.stringify(entry)}`);
    }
    remotes.push(entry);
  }
  return remotes;
}

/**
 * One-line description of a failed push, for the per-remote output list.
 * @param {{ stdout: string, stderr: string, code: number | null }} result - failed command result.
 * @returns {string} collapsed git detail (never empty).
 */
function describePushFailure(result) {
  const detail = [result.stderr, result.stdout]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .find((part) => part.length > 0);
  if (detail === undefined) return `exit ${result.code === null ? "unknown" : result.code}`;
  const collapsed = capText(detail.replace(/\s+/g, " "), 300).text;
  return collapsed.length > 0 ? collapsed : `exit ${result.code}`;
}

/**
 * Parse `git stash list --format=<STASH_FORMAT>` output.
 * @param {string} text - newline-separated records.
 * @returns {Array<{ index: number, hash: string, message: string, author: string, time: number }>} stash entries, newest first.
 */
function parseStashList(text) {
  const entries = [];
  for (const line of String(text ?? "").split("\n")) {
    if (line.length === 0) continue;
    const fields = splitFields(line, FIELD, 5);
    if (fields.length < 5) continue;
    const [selector, hash, message, author, time] = fields;
    const match = /^stash@\{(\d+)\}$/.exec(selector);
    if (match === null) continue;
    entries.push({ index: Number.parseInt(match[1], 10), hash, message, author, time: Number.parseInt(time, 10) || 0 });
  }
  return entries;
}

/**
 * Parse one annotated tag object (`git cat-file tag`) into tagger and message.
 * @param {string} text - raw tag object.
 * @returns {{ tagger: { name: string, email: string, time: number } | null, message: string }} tag metadata.
 */
function parseTagObject(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  let tagger = null;
  let separator = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length === 0) {
      separator = index;
      break;
    }
    const match = /^tagger (.+) <([^>]*)> (\d+) [+-]\d{4}$/.exec(line);
    if (match !== null) tagger = { name: match[1], email: match[2], time: Number.parseInt(match[3], 10) || 0 };
  }
  const message = separator === -1 ? "" : lines.slice(separator + 1).join("\n").replace(/\r?\n+$/, "");
  return { tagger, message };
}

/**
 * Parse `git remote -v` output, deduping fetch/push pairs per remote name.
 * @param {string} text - tab-separated remote listing.
 * @returns {Array<{ name: string, fetchUrl: string | null, pushUrl: string | null }>} remotes in first-appearance order.
 */
function parseRemoteList(text) {
  const remotes = new Map();
  for (const line of String(text ?? "").split("\n")) {
    if (line.length === 0) continue;
    const match = /^(.+?)\t(.+) \((fetch|push)\)$/.exec(line);
    if (match === null) continue;
    const [, name, url, kind] = match;
    let entry = remotes.get(name);
    if (entry === undefined) {
      entry = { name, fetchUrl: null, pushUrl: null };
      remotes.set(name, entry);
    }
    if (kind === "fetch") entry.fetchUrl = url;
    else entry.pushUrl = url;
  }
  return [...remotes.values()];
}

/**
 * Build the git API around one runner.
 *
 * Every exported method is read-only except {@link performAction}, which runs one of
 * the explicit mutation verbs in the contract. All commands are argv arrays; no text
 * from a caller ever reaches a shell.
 *
 * @param {(argv: string[], options?: { cwd?: string, timeoutMs?: number, maxBuffer?: number }) => Promise<{ stdout: string, stderr: string, code: number | null, error?: unknown, overflowed?: boolean }>} run - command runner.
 * @returns {{ detectRepo: Function, readGraph: Function, searchCommits: Function, readCommit: Function, readUncommitted: Function, readDiff: Function, compareCommits: Function, listBranches: Function, readStashes: Function, readTag: Function, readRemotes: Function, readContains: Function, performAction: Function }} the API.
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
   * Assert that every ref in a graph filter resolves to a commit.
   *
   * `rev-parse --verify --quiet` keeps the check side-effect free and names the
   * offending ref in the `BAD_REQUEST`, instead of surfacing a generic `git log`
   * failure after the fact.
   *
   * @param {string} repoPath - repository root.
   * @param {string[]} filters - syntax-validated ref names.
   * @returns {Promise<void>} resolves when every ref is known.
   * @throws {GitGraphError} `BAD_REQUEST` naming the first unknown ref.
   */
  async function assertKnownRefs(repoPath, filters) {
    const checks = await Promise.all(
      filters.map(async (filter) => ({ filter, result: await git(repoPath, ["rev-parse", "--verify", "--quiet", `${filter}^{commit}`]) })),
    );
    for (const { filter, result } of checks) {
      if (result.code !== 0 || result.stdout.trim().length === 0) {
        throw new GitGraphError("BAD_REQUEST", `unknown branch or ref: ${JSON.stringify(filter)}`);
      }
    }
  }

  /**
   * Read one page of the graph.
   *
   * `options.branches` restricts the revision walk to those refs; omitted or an empty
   * array keeps the default walk (all branches, tags, configured remotes and HEAD).
   * `options.order` selects `--date-order` (default), `--author-date-order` or
   * `--topo-order`. `options.useMailmap` adds `--use-mailmap` and switches the walk to
   * the mailmap-aware `%aN`/`%aE`/`%cN`/`%cE` placeholders (raw `%an` ignores
   * `.mailmap` even with the flag), so the option is actually observable.
   *
   * The remaining options mirror the upstream repository settings:
   *
   * - `showTags` / `showCommitsOnlyReferencedByTags` control both the `--tags` link of
   *   the default walk and the tag refs/decoration chips;
   * - `showRemoteBranches` / `showRemoteHeads` control `--remotes` and the
   *   `refs/remotes/<remote>/HEAD` pseudo-refs;
   * - `firstParent` adds `--first-parent` to the walk;
   * - `includeReflogCommits` adds `--reflog` to the default walk;
   * - `showStashes` controls the stash refs and the `stashes` member.
   *
   * @param {string} cwd - workspace directory (a session cwd or a request override).
   * @param {{ maxCommits?: number, showRemoteBranches?: boolean, showRemoteHeads?: boolean, showTags?: boolean, showCommitsOnlyReferencedByTags?: boolean, firstParent?: boolean, includeReflogCommits?: boolean, branches?: string[], order?: string, showStashes?: boolean, useMailmap?: boolean }} [options] - page options.
   * @returns {Promise<object>} graph value documented in CONTRACT.md.
   * @throws {GitGraphError} `BAD_REQUEST` for an invalid order or an unsafe/unknown branch filter.
   */
  async function readGraph(cwd, options = {}) {
    const workspacePath = typeof cwd === "string" ? cwd : "";
    const requested = Number.isSafeInteger(options.maxCommits) && options.maxCommits > 0 ? options.maxCommits : DEFAULT_MAX_COMMITS;
    const maxCommits = Math.min(requested, MAX_COMMITS_LIMIT);
    const showRemoteBranches = options.showRemoteBranches !== false;
    const showRemoteHeads = options.showRemoteHeads !== false;
    const showTags = options.showTags !== false;
    const showStashes = options.showStashes !== false;
    const showCommitsOnlyReferencedByTags = options.showCommitsOnlyReferencedByTags !== false;
    const firstParent = options.firstParent === true;
    const includeReflogCommits = options.includeReflogCommits === true;
    const useMailmap = options.useMailmap === true;
    const orderFlag = resolveGraphOrderFlag(options.order);
    const branchFilters = normalizeBranchFilters(options.branches);
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
        ...(showStashes ? { stashes: [] } : {}),
        generatedAt,
      };
    }
    const repoPath = detection.repoPath ?? workspacePath;
    if (branchFilters !== null) await assertKnownRefs(repoPath, branchFilters);

    const head = await readHead(repoPath);
    /*
     * With no filter the revision list is the default walk. An empty array is treated
     * as "no filter" above, so its argv stays byte-identical to the pre-wave-3 one
     * unless a tag/reflog setting turns an extra walk source on.
     * Stashes never join the commit walk unless already reachable from a ref.
     */
    const includeTags = showTags && showCommitsOnlyReferencedByTags;
    const revisions =
      branchFilters === null
        ? [
            "--branches",
            ...(includeTags ? ["--tags"] : []),
            ...(includeReflogCommits ? ["--reflog"] : []),
            ...(showRemoteBranches ? ["--remotes"] : []),
            "HEAD",
          ]
        : branchFilters;
    const [statusResult, allRefs, logResult, stashEntries] = await Promise.all([
      git(repoPath, ["status", "--porcelain=v1", "-z"]),
      /* Read every ref once, then derive both the visible refs and the chip filters. */
      readRefs(repoPath, true),
      git(repoPath, [
        "log",
        ...(useMailmap ? ["--use-mailmap"] : []),
        orderFlag,
        `--max-count=${maxCommits + 1}`,
        ...(firstParent ? ["--first-parent"] : []),
        "-z",
        `--format=${useMailmap ? LOG_FORMAT_MAILMAP : LOG_FORMAT}`,
        ...revisions,
      ]),
      showStashes ? readStashEntries(repoPath) : Promise.resolve([]),
    ]);
    const remoteNames = new Set();
    const remoteHeadNames = new Set();
    const refs = [];
    for (const ref of allRefs) {
      if (ref.type === "remote") {
        remoteNames.add(ref.shortName);
        if (ref.shortName.endsWith("/HEAD")) remoteHeadNames.add(ref.shortName);
        if (!showRemoteBranches) continue;
        if (!showRemoteHeads && ref.shortName.endsWith("/HEAD")) continue;
      } else if (ref.type === "tag" && !showTags) continue;
      refs.push(ref);
    }
    if (showStashes) {
      for (const entry of stashEntries) {
        refs.push({
          name: `refs/stash@{${entry.index}}`,
          shortName: `stash@{${entry.index}}`,
          type: "stash",
          hash: entry.hash,
          head: false,
          upstream: null,
        });
      }
    }
    const dirty = statusResult.code === 0 ? countStatusEntries(statusResult.stdout) : 0;
    const commits = [];
    if (logResult.code === 0) {
      for (const record of logResult.stdout.split(NUL)) {
        if (record.length === 0) continue;
        const parsed = parseLogRecord(record);
        if (parsed === null) continue;
        if (!showTags || !showRemoteBranches || !showRemoteHeads) {
          parsed.commit.refs = parsed.commit.refs.filter((chip) =>
            decorationVisible(chip, { showTags, showRemoteBranches, showRemoteHeads, remoteNames, remoteHeadNames }),
          );
        }
        commits.push(parsed.commit);
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
      ...(showStashes ? { stashes: stashEntries.map(({ index, hash, message }) => ({ index, hash, message })) } : {}),
      generatedAt,
    };
  }

  /**
   * Search the reachable history for one case-insensitive substring.
   *
   * Exactly one `git log --all --date-order -n SEARCH_SCAN_LIMIT` call reads up to
   * 20,000 commits (plus `--use-mailmap` when configured); the facet filter, the match
   * collection and the offset/limit page are computed in JavaScript, so one keystroke
   * never spawns a process per commit or per match. The returned commit entries use the
   * same shape as `readGraph` rows, so the client can render them with existing row
   * components.
   *
   * @param {string} cwd - workspace directory.
   * @param {{ query?: string, scope?: string, limit?: number, offset?: number, useMailmap?: boolean }} [options] - search request.
   * @returns {Promise<{ isRepo: boolean, query: string, scope: string, commits: Array<object>, offset: number, limit: number, hasMore: boolean, scanned: number, capped: boolean }>} search value; outside a repository `isRepo: false` with empty results.
   * @throws {GitGraphError} `BAD_REQUEST` for an invalid query/scope/limit/offset.
   */
  async function searchCommits(cwd, options = {}) {
    const source = options !== null && typeof options === "object" ? options : {};
    const { query, scope, limit, offset } = normalizeSearchRequest(source);
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) {
      return { isRepo: false, query, scope, commits: [], offset, limit, hasMore: false, scanned: 0, capped: false };
    }
    const repoPath = detection.repoPath ?? cwd;
    const useMailmap = source.useMailmap === true;
    const result = await git(repoPath, [
      "log",
      "--all",
      ...(useMailmap ? ["--use-mailmap"] : []),
      "--date-order",
      "-n",
      String(SEARCH_SCAN_LIMIT),
      "-z",
      `--format=${useMailmap ? SEARCH_LOG_FORMAT_MAILMAP : SEARCH_LOG_FORMAT}`,
    ]);
    if (result.code !== 0) throw gitFailure("log", result);

    const needle = query.toLowerCase();
    const matches = [];
    let scanned = 0;
    for (const record of result.stdout.split(NUL)) {
      if (record.length === 0) continue;
      const parsed = parseLogRecord(record, { withBody: true });
      if (parsed === null) continue;
      scanned += 1;
      if (searchFacet(parsed.commit, parsed.body, scope).toLowerCase().includes(needle)) matches.push(parsed.commit);
    }
    return {
      isRepo: true,
      query,
      scope,
      commits: matches.slice(offset, offset + limit),
      offset,
      limit,
      hasMore: offset + limit < matches.length,
      scanned,
      capped: scanned >= SEARCH_SCAN_LIMIT,
    };
  }

  /**
   * Read `git stash list` entries for one repository root.
   * @param {string} repoPath - repository root.
   * @returns {Promise<Array<{ index: number, hash: string, message: string, author: string, time: number }>>} stash entries, newest first.
   */
  async function readStashEntries(repoPath) {
    const result = await git(repoPath, ["stash", "list", `--format=${STASH_FORMAT}`]);
    if (result.code !== 0) return [];
    return parseStashList(result.stdout);
  }

  /**
   * Read the stash list.
   * @param {string} cwd - workspace directory.
   * @returns {Promise<{ isRepo: boolean, error?: string, message?: string, stashes: Array<{ index: number, hash: string, message: string, author: string, time: number }> }>} stashes value.
   */
  async function readStashes(cwd) {
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) {
      return { isRepo: false, error: "NOT_A_REPO", message: detection.message ?? null, stashes: [] };
    }
    const stashes = await readStashEntries(detection.repoPath ?? cwd);
    return { isRepo: true, stashes };
  }

  /**
   * Read one tag, including annotated tagger metadata.
   *
   * A lightweight tag resolves to a commit: it returns `annotated: false`, a null
   * tagger and the commit subject as its message. A name that is not a tag is a
   * `BAD_REQUEST`, so the client can tell "not a tag" from a git failure.
   *
   * @param {string} cwd - workspace directory.
   * @param {string} name - tag name.
   * @returns {Promise<{ name: string, annotated: boolean, tagger: { name: string, email: string, time: number } | null, message: string }>} tag value.
   * @throws {GitGraphError} `BAD_REQUEST` for an unsafe/unknown name, `NOT_A_REPO` or `GIT_FAILED`.
   */
  async function readTag(cwd, name) {
    if (typeof name !== "string" || name.length === 0) throw new GitGraphError("BAD_REQUEST", "tag name is required");
    if (!isValidRefName(name)) throw new GitGraphError("BAD_REQUEST", `invalid tag name: ${JSON.stringify(name)}`);
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) throw new GitGraphError("NOT_A_REPO", `not a git repository: ${cwd}`);
    const repoPath = detection.repoPath ?? cwd;
    const refName = `refs/tags/${name}`;

    const existsResult = await git(repoPath, ["show-ref", "--verify", "--quiet", refName]);
    if (existsResult.code !== 0) throw new GitGraphError("BAD_REQUEST", `not a tag: ${JSON.stringify(name)}`);

    const typeResult = await git(repoPath, ["cat-file", "-t", refName]);
    const objectType = typeResult.code === 0 ? typeResult.stdout.trim() : "";
    if (objectType === "tag") {
      const tagResult = await git(repoPath, ["cat-file", "tag", refName]);
      if (tagResult.code !== 0) throw gitFailure("cat-file", tagResult);
      const parsed = parseTagObject(tagResult.stdout);
      return { name, annotated: true, tagger: parsed.tagger, message: capText(parsed.message, MAX_DETAIL_BYTES).text };
    }

    const subjectResult = await git(repoPath, ["show", "-s", "--format=%s", refName]);
    if (subjectResult.code !== 0) throw gitFailure("show", subjectResult);
    return { name, annotated: false, tagger: null, message: subjectResult.stdout.replace(/\r?\n$/, "") };
  }

  /**
   * Read configured remotes with their fetch and push URLs.
   * @param {string} cwd - workspace directory.
   * @returns {Promise<{ isRepo: boolean, error?: string, message?: string, remotes: Array<{ name: string, fetchUrl: string | null, pushUrl: string | null }> }>} remotes value.
   */
  async function readRemotes(cwd) {
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) {
      return { isRepo: false, error: "NOT_A_REPO", message: detection.message ?? null, remotes: [] };
    }
    const result = await git(detection.repoPath ?? cwd, ["remote", "-v"]);
    if (result.code !== 0) throw gitFailure("remote", result);
    return { isRepo: true, remotes: parseRemoteList(result.stdout) };
  }

  /**
   * Report where one commit is contained: HEAD, branches/remotes, tags and stashes.
   *
   * `for-each-ref --contains` is the single ref query; it reports `refs/stash` (not
   * the reflog selectors), so stash entries are resolved against the stash list only
   * when that ref is reported, keeping the common path at two git processes.
   *
   * @param {string} cwd - workspace directory.
   * @param {string} hash - commit hash or ref (one per request).
   * @returns {Promise<{ hash: string, shortHash: string, inHead: boolean, branches: Array<{ name: string, isHead: boolean }>, tags: string[], stashes: Array<{ index: number, shortName: string }>, generatedAt: number }>} contains value.
   * @throws {GitGraphError} `BAD_REQUEST`, `NOT_A_REPO` or `GIT_FAILED`.
   */
  async function readContains(cwd, hash) {
    if (typeof hash !== "string" || hash.length === 0) throw new GitGraphError("BAD_REQUEST", "hash is required");
    if (!isValidRefName(hash)) throw new GitGraphError("BAD_REQUEST", `invalid hash: ${JSON.stringify(hash)}`);
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) throw new GitGraphError("NOT_A_REPO", `not a git repository: ${cwd}`);
    const repoPath = detection.repoPath ?? cwd;

    const resolvedResult = await git(repoPath, ["rev-parse", "--verify", "--quiet", `${hash}^{commit}`]);
    if (resolvedResult.code !== 0 || resolvedResult.stdout.trim().length === 0) throw gitFailure("rev-parse", resolvedResult);
    const commit = resolvedResult.stdout.trim();

    const [head, refsResult, inHeadResult] = await Promise.all([
      readHead(repoPath),
      git(repoPath, ["for-each-ref", "--contains", commit, "--format=%(refname)"]),
      git(repoPath, ["merge-base", "--is-ancestor", commit, "HEAD"]),
    ]);
    if (refsResult.code !== 0) throw gitFailure("for-each-ref", refsResult);
    if (inHeadResult.code !== 0 && inHeadResult.code !== 1) throw gitFailure("merge-base", inHeadResult);
    const inHead = inHeadResult.code === 0;

    const branches = [];
    const tags = [];
    let stashRefReported = false;
    for (const line of refsResult.stdout.split("\n")) {
      const ref = line.trim();
      if (ref.length === 0) continue;
      if (ref.startsWith("refs/heads/")) {
        const name = ref.slice("refs/heads/".length);
        branches.push({ name, isHead: head.branch !== null && name === head.branch });
      } else if (ref.startsWith("refs/remotes/")) {
        branches.push({ name: ref.slice("refs/remotes/".length), isHead: false });
      } else if (ref.startsWith("refs/tags/")) {
        tags.push(ref.slice("refs/tags/".length));
      } else if (ref === "refs/stash") {
        stashRefReported = true;
      }
    }

    const stashes = [];
    if (stashRefReported) {
      /* `refs/stash` has no index in its refname: recover selectors from the reflog. */
      const entries = await readStashEntries(repoPath);
      for (const entry of entries) {
        const contained =
          entry.hash === commit ? true : (await git(repoPath, ["merge-base", "--is-ancestor", commit, entry.hash])).code === 0;
        if (contained) stashes.push({ index: entry.index, shortName: `stash@{${entry.index}}` });
      }
    }

    return { hash: commit, shortHash: commit.slice(0, 7), inHead, branches, tags, stashes, generatedAt: Date.now() };
  }

  /**
   * Read the index/worktree state as three buckets.
   *
   * One porcelain call covers everything; a record may appear in both `staged` and
   * `unstaged` (for example `MM`) because X and Y are independent. A `??` record is
   * reported as untracked with status `A`.
   *
   * `options.includeUntracked` (default true) maps the upstream
   * `repository.showUntrackedFiles` setting: when false the status walk ignores
   * untracked files entirely (`--untracked-files=no`), so `untracked` is empty and the
   * untracked count is 0 while staged and unstaged entries stay untouched.
   *
   * @param {string} cwd - workspace directory.
   * @param {{ includeUntracked?: boolean }} [options] - uncommitted options.
   * @returns {Promise<{ repoPath: string | null, isRepo: boolean, error?: string, message?: string, head: object | null, staged: Array<{ status: string, path: string, oldPath: string | null }>, unstaged: Array<{ status: string, path: string, oldPath: string | null }>, untracked: Array<{ status: string, path: string, oldPath: string | null }>, counts: { staged: number, unstaged: number, untracked: number } }>} uncommitted value.
   */
  async function readUncommitted(cwd, options = {}) {
    const includeUntracked = options.includeUntracked !== false;
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) {
      return {
        repoPath: detection.repoPath ?? null,
        isRepo: false,
        error: "NOT_A_REPO",
        message: detection.message ?? null,
        head: null,
        staged: [],
        unstaged: [],
        untracked: [],
        counts: { staged: 0, unstaged: 0, untracked: 0 },
      };
    }
    const repoPath = detection.repoPath ?? cwd;
    const [head, statusResult] = await Promise.all([
      readHead(repoPath),
      git(repoPath, ["status", "--porcelain=v1", "-z", `--untracked-files=${includeUntracked ? "all" : "no"}`]),
    ]);
    if (statusResult.code !== 0) throw gitFailure("status", statusResult);

    const staged = [];
    const unstaged = [];
    const untracked = [];
    for (const entry of parseStatusEntries(statusResult.stdout)) {
      const { x, y, path: filePath, oldPath } = entry;
      if (x === "?") {
        if (!includeUntracked) continue;
        untracked.push({ status: "A", path: filePath, oldPath: null });
        continue;
      }
      if (x !== " ") {
        staged.push({ status: x, path: filePath, oldPath: x === "R" || x === "C" ? oldPath : null });
      }
      if (y !== " ") {
        unstaged.push({ status: y, path: filePath, oldPath: y === "R" || y === "C" ? oldPath : null });
      }
    }

    return {
      repoPath,
      isRepo: true,
      head,
      staged,
      unstaged,
      untracked,
      counts: { staged: staged.length, unstaged: unstaged.length, untracked: untracked.length },
    };
  }

  /**
   * Read one commit with metadata, stats, signature status and its file list.
   *
   * For a merge commit the file list is the change the merge introduced relative to
   * its first parent, matching how `git diff-tree <parent> <merge>` reports it.
   *
   * The signature comes from `%G?`, `%GS` and `%GK` on the same `git show -s` call, so
   * no extra process is spawned. `N` means unsigned; `status` is null only when git
   * reports a value outside the documented set.
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
    const fields = splitFields(text, FIELD, 14);
    if (fields.length < 14) throw new GitGraphError("GIT_FAILED", `could not parse commit metadata for ${hash}`);
    const [
      fullHash,
      parentField,
      authorName,
      authorEmail,
      authorTime,
      committerName,
      committerEmail,
      committerTime,
      decorations,
      signatureStatus,
      signer,
      keyId,
      subject,
      body,
    ] = fields;
    const parents = parentField.split(" ").filter((parent) => parent.length > 0);
    const signature = {
      status: SIGNATURE_STATUSES.has(signatureStatus) ? signatureStatus : null,
      signer: signer.trim().length > 0 ? signer.trim() : null,
      keyId: keyId.trim().length > 0 ? keyId.trim() : null,
    };

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

    const { insertions, deletions } = applyNumstat(files, numstat);

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
      signature,
      stats: { files: files.length, insertions, deletions },
      files,
    };
  }

  /**
   * Render the patch of one file.
   *
   * `scope` selects the comparison:
   * - omitted or `"commit"`: the file inside one commit (`hash` required); a merge
   *   commit is diffed against its first parent (see {@link readCommit}).
   * - `"staged"`: index vs HEAD (`git diff --cached`).
   * - `"unstaged"`: worktree vs index (`git diff`).
   * - `"compare"`: `base` vs `head` tree-to-tree (`git diff -M <base> <head>`).
   * - `"working"`: `hash` vs the working tree (staged and unstaged). An untracked file
   *   has no tree entry, so it is rendered as an all-added patch via `git diff
   *   --no-index /dev/null <file>`; an empty untracked file keeps zero hunks.
   *
   * The 300 KiB cap, `truncated` and `binary` handling are identical for every scope.
   *
   * @param {string} cwd - workspace directory.
   * @param {{ hash?: string, base?: string, head?: string, scope?: string, path?: string, file?: string, oldPath?: string | null, status?: string }} input - diff request.
   * @returns {Promise<{ patch: string, truncated: boolean, binary: boolean }>} diff value.
   * @throws {GitGraphError} `BAD_REQUEST`, `NOT_A_REPO` or `GIT_FAILED`.
   */
  async function readDiff(cwd, input = {}) {
    const scope = input.scope === undefined || input.scope === null || input.scope === "" ? "commit" : input.scope;
    if (!DIFF_SCOPES.has(scope)) throw new GitGraphError("BAD_REQUEST", `invalid diff scope: ${JSON.stringify(scope)}`);
    const filePath = input.file ?? input.path;
    const oldPath = input.oldPath;
    const hash = input.hash;
    const base = input.base;
    const head = input.head;
    if (!isValidRepoPath(filePath)) throw new GitGraphError("BAD_REQUEST", `invalid file path: ${JSON.stringify(filePath)}`);
    if (oldPath !== undefined && oldPath !== null && oldPath !== "" && !isValidRepoPath(oldPath)) {
      throw new GitGraphError("BAD_REQUEST", `invalid old file path: ${JSON.stringify(oldPath)}`);
    }
    if ((scope === "commit" || scope === "working") && !isValidRefName(hash)) {
      throw new GitGraphError("BAD_REQUEST", `invalid commit hash or ref: ${JSON.stringify(hash)}`);
    }
    if (scope === "compare") {
      if (!isValidRefName(base)) throw new GitGraphError("BAD_REQUEST", `invalid base commit: ${JSON.stringify(base)}`);
      if (!isValidRefName(head)) throw new GitGraphError("BAD_REQUEST", `invalid head commit: ${JSON.stringify(head)}`);
    }
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) throw new GitGraphError("NOT_A_REPO", `not a git repository: ${cwd}`);
    const repoPath = detection.repoPath ?? cwd;

    let argv;
    let commandLabel;
    let appendOldPath = true;
    let noIndex = false;
    if (scope === "commit") {
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
      argv =
        firstParent === null
          ? ["show", "--format=", "--find-renames", "--no-ext-diff", "--patch", "--no-color", hash, "--", filePath]
          : ["diff", "--find-renames", "--no-ext-diff", "--patch", "--no-color", firstParent, hash, "--", filePath];
      commandLabel = firstParent === null ? "show" : "diff";
    } else if (scope === "staged") {
      argv = ["diff", "--cached", "--patch", "--no-color", "--", filePath];
      commandLabel = "diff";
    } else if (scope === "unstaged") {
      argv = ["diff", "--patch", "--no-color", "--", filePath];
      commandLabel = "diff";
    } else if (scope === "working") {
      const baseResult = await git(repoPath, ["rev-parse", "--verify", `${hash}^{commit}`]);
      if (baseResult.code !== 0) throw gitFailure("rev-parse", baseResult);
      const baseHash = baseResult.stdout.trim();
      /* Untracked files are in no tree, so `git diff <hash>` prints nothing for them. */
      const trackedResult = await git(repoPath, ["ls-files", "--error-unmatch", "--", filePath]);
      let tracked = trackedResult.code === 0;
      if (!tracked) {
        /* A path staged for deletion left the index but still exists in the base tree. */
        const inBaseResult = await git(repoPath, ["ls-tree", "-z", "--name-only", baseHash, "--", filePath]);
        tracked = inBaseResult.code === 0 && inBaseResult.stdout.split(NUL).includes(filePath);
      }
      if (tracked) {
        argv = ["diff", "--find-renames", "--no-ext-diff", "--patch", "--no-color", baseHash, "--", filePath];
      } else {
        appendOldPath = false;
        noIndex = true;
        argv = ["diff", "--no-index", "--patch", "--no-color", "--", "/dev/null", filePath];
      }
      commandLabel = "diff";
    } else {
      argv = ["diff", "--patch", "--no-color", "-M", base, head, "--", filePath];
      commandLabel = "diff";
    }
    if (appendOldPath && typeof oldPath === "string" && oldPath.length > 0) argv.push(oldPath);
    let result = await git(repoPath, argv);
    /* `git diff --no-index` exits 1 whenever the two paths differ: that is success here. */
    if (noIndex && result.code === 1) result = { ...result, code: 0 };
    if (result.code !== 0) throw gitFailure(commandLabel, result);

    const patch = result.stdout;
    const binary = /^Binary files .* differ$/m.test(patch) || /^GIT binary patch$/m.test(patch) || patch.includes("GIT binary patch");
    const capped = binary ? { text: "", truncated: false } : capText(patch, MAX_DIFF_BYTES);
    return { patch: capped.text, truncated: capped.truncated || result.overflowed, binary };
  }

  /**
   * Compare two commits tree-to-tree, or a commit against the working tree.
   *
   * The classic form resolves `base` and `head` to full commit hashes and diffs the two
   * trees. The working-tree form (`input.working === true`) ignores `head`, diffs the
   * tracked index/worktree against the resolved `base` commit and appends every
   * untracked file as an `A` entry carrying its probed line count (or `binary: true`).
   * A repository with no HEAD at all (fresh `git init`) yields an empty working
   * comparison instead of a failure.
   *
   * @param {string} cwd - workspace directory.
   * @param {{ base?: string, head?: string, working?: boolean }} input - the endpoints to compare.
   * @returns {Promise<object>} comparison value documented in CONTRACT.md and `docs/wave8-contract.md`.
   * @throws {GitGraphError} `BAD_REQUEST`, `NOT_A_REPO` or `GIT_FAILED`.
   */
  async function compareCommits(cwd, input = {}) {
    const base = input.base;
    const working = input.working;
    if (working !== undefined && working !== null && typeof working !== "boolean") {
      throw new GitGraphError("BAD_REQUEST", "working must be a boolean");
    }
    if (typeof base !== "string" || base.length === 0) throw new GitGraphError("BAD_REQUEST", "base is required");
    if (!isValidRefName(base)) throw new GitGraphError("BAD_REQUEST", `invalid base commit: ${JSON.stringify(base)}`);
    const head = input.head;
    if (working !== true) {
      if (typeof head !== "string" || head.length === 0) throw new GitGraphError("BAD_REQUEST", "head is required");
      if (!isValidRefName(head)) throw new GitGraphError("BAD_REQUEST", `invalid head commit: ${JSON.stringify(head)}`);
    }
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) throw new GitGraphError("NOT_A_REPO", `not a git repository: ${cwd}`);
    const repoPath = detection.repoPath ?? cwd;
    if (working === true) return compareWorkingTree(repoPath, base);

    const [baseResult, headResult] = await Promise.all([
      git(repoPath, ["rev-parse", "--verify", `${base}^{commit}`]),
      git(repoPath, ["rev-parse", "--verify", `${head}^{commit}`]),
    ]);
    if (baseResult.code !== 0) throw gitFailure("rev-parse", baseResult);
    if (headResult.code !== 0) throw gitFailure("rev-parse", headResult);
    const baseHash = baseResult.stdout.trim();
    const headHash = headResult.stdout.trim();

    const [nameStatusResult, numstatResult] = await Promise.all([
      git(repoPath, ["diff", "--name-status", "-z", "-M", baseHash, headHash]),
      git(repoPath, ["diff", "--numstat", "-z", "-M", baseHash, headHash]),
    ]);
    if (nameStatusResult.code !== 0) throw gitFailure("diff", nameStatusResult);
    if (numstatResult.code !== 0) throw gitFailure("diff", numstatResult);

    const numstat = parseNumstat(numstatResult.stdout);
    const files = parseNameStatus(nameStatusResult.stdout);
    const { insertions, deletions } = applyNumstat(files, numstat);

    return {
      base: baseHash,
      head: headHash,
      baseAbbrev: baseHash.slice(0, 7),
      headAbbrev: headHash.slice(0, 7),
      stats: { files: files.length, insertions, deletions },
      files,
    };
  }

  /**
   * Build the working-tree comparison for one resolved base commit.
   *
   * One `git diff <base>` pair covers both staged and unstaged tracked changes; one
   * `git ls-files --others` call finds untracked files, which are probed on disk so
   * the result keeps the comparison value's file shape (`status`, `path`, `oldPath`,
   * `added`, `removed`, `binary`).
   *
   * @param {string} repoPath - repository root.
   * @param {string} base - commit-ish supplied by the caller.
   * @returns {Promise<object>} working comparison value: `{ working: true, head: null, base, baseAbbrev, stats, files }`.
   * @throws {GitGraphError} `GIT_FAILED` for an unknown base outside an unborn repository.
   */
  async function compareWorkingTree(repoPath, base) {
    const baseResult = await git(repoPath, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
    if (baseResult.code !== 0 || baseResult.stdout.trim().length === 0) {
      /* An unborn HEAD has no tree to compare against: report an empty comparison. */
      const headResult = await git(repoPath, ["rev-parse", "--verify", "--quiet", "HEAD"]);
      if (headResult.code !== 0 || headResult.stdout.trim().length === 0) {
        return {
          working: true,
          head: null,
          base: null,
          baseAbbrev: null,
          stats: { files: 0, insertions: 0, deletions: 0 },
          files: [],
        };
      }
      throw gitFailure("rev-parse", baseResult);
    }
    const baseHash = baseResult.stdout.trim();

    const [nameStatusResult, numstatResult, untrackedResult] = await Promise.all([
      git(repoPath, ["diff", "--name-status", "-z", "-M", baseHash, "--"]),
      git(repoPath, ["diff", "--numstat", "-z", "-M", baseHash, "--"]),
      git(repoPath, ["ls-files", "--others", "--exclude-standard", "-z"]),
    ]);
    if (nameStatusResult.code !== 0) throw gitFailure("diff", nameStatusResult);
    if (numstatResult.code !== 0) throw gitFailure("diff", numstatResult);
    if (untrackedResult.code !== 0) throw gitFailure("ls-files", untrackedResult);

    const files = parseNameStatus(nameStatusResult.stdout);
    const { insertions, deletions } = applyNumstat(files, parseNumstat(numstatResult.stdout));
    let totalInsertions = insertions;
    let totalDeletions = deletions;
    for (const untracked of untrackedResult.stdout.split(NUL)) {
      if (untracked.length === 0) continue;
      const probe = probeUntrackedFile(path.join(repoPath, untracked));
      files.push({ status: "A", path: untracked, oldPath: null, added: probe.added, removed: 0, binary: probe.binary });
      totalInsertions += probe.added;
    }

    return {
      working: true,
      head: null,
      base: baseHash,
      baseAbbrev: baseHash.slice(0, 7),
      stats: { files: files.length, insertions: totalInsertions, deletions: totalDeletions },
      files,
    };
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
   * Supported actions and arguments match CONTRACT.md plus the wave-4 table in
   * `docs/wave4-contract.md`. Every ref-like argument is validated before it is placed
   * in the argv array; modes and stash indexes are checked against literal shapes.
   * Destructive behaviour is only ever selected by an explicit argument.
   *
   * @param {string} cwd - workspace directory.
   * @param {string} action - one of checkoutBranch, checkoutCommit, createBranch, deleteBranch, renameBranch, cherryPick, revertCommit, revert, createTag, deleteTag, fetch, fetchIntoLocalBranch, merge, mergeCommit, resetToCommit, pullBranch, pushBranch, pushToMultipleRemotes, rebase, dropCommit, pushTag, stashPush, stashUncommitted, stashApply, stashPop, stashDrop, branchFromStash, cleanUntracked, resetUncommitted, resetFileToRevision, addRemote, editRemote, deleteRemote, pruneRemote.
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
    /** Optional post-run step that completes the message (clean/reset counts). */
    let finalize = null;
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
      case "renameBranch": {
        const branchName = requireRefArg(args, "name");
        const newName = requireRefArg(args, "newName");
        argv = ["branch", "-m", branchName, newName];
        message = `Renamed branch "${branchName}" to "${newName}".`;
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
        /*
         * Upstream defaults both prune settings to false, so fetching is non-destructive
         * unless the caller (or the configured default, injected by the route) opts in.
         */
        const prune = args?.prune === true;
        const pruneTags = args?.pruneTags === true;
        const flags = [...(prune ? ["--prune"] : []), ...(pruneTags ? ["--prune-tags"] : [])];
        argv = ["fetch", ...flags];
        if (typeof remote === "string" && remote.length > 0) argv.push(remote);
        const flagText = flags.length > 0 ? ` with ${flags.join(" ")}` : "";
        message = remote ? `Fetched from "${remote}"${flagText}.` : `Fetched from all remotes${flagText}.`;
        break;
      }
      case "fetchIntoLocalBranch": {
        const remote = requireRefArg(args, "remote");
        const branch = requireRefArg(args, "branch");
        const local = requireRefArg(args, "local");
        /* No --force and no "+" prefix: a non-fast-forward update is refused by git. */
        argv = ["fetch", remote, `${branch}:${local}`];
        message = `Fetched "${remote}/${branch}" into "${local}".`;
        break;
      }
      case "mergeCommit":
      /* `mergeCommit` is `merge` with no extra flags (noCommit stays false). */
      case "merge": {
        const hash = requireRefArg(args, "hash");
        argv = ["merge"];
        if (action === "merge") {
          if (args?.noFastForward === true) argv.push("--no-ff");
          if (args?.squash === true) argv.push("--squash");
          if (args?.noCommit === true) argv.push("--no-commit");
        }
        argv.push(hash);
        message = `Merged ${shortRef(hash)}.`;
        break;
      }
      case "resetToCommit": {
        const hash = requireRefArg(args, "hash");
        const mode = requireEnumArg(args, "mode", RESET_MODES);
        argv = ["reset", `--${mode}`, hash];
        message = `Reset (${mode}) to ${shortRef(hash)}.`;
        break;
      }
      case "pullBranch": {
        const remote = optionalRefArg(args, "remote");
        const branch = optionalRefArg(args, "branch");
        if (branch !== undefined && remote === undefined) {
          throw new GitGraphError("BAD_REQUEST", "remote is required when branch is provided");
        }
        const rebaseFlag = args?.rebase === true;
        const noFastForward = args?.noFastForward === true;
        if (rebaseFlag && noFastForward) throw new GitGraphError("BAD_REQUEST", "rebase and noFastForward are mutually exclusive");
        argv = ["pull"];
        if (rebaseFlag) argv.push("--rebase");
        else if (noFastForward) argv.push("--no-ff");
        if (remote !== undefined) argv.push(remote);
        if (branch !== undefined) argv.push(branch);
        message = remote === undefined ? "Pulled the configured upstream." : `Pulled ${remote}${branch === undefined ? "" : ` ${branch}`}.`;
        break;
      }
      case "pushBranch": {
        const remote = optionalRefArg(args, "remote");
        const branch = optionalRefArg(args, "branch");
        if (branch !== undefined && remote === undefined) {
          throw new GitGraphError("BAD_REQUEST", "remote is required when branch is provided");
        }
        argv = ["push"];
        if (args?.setUpstream === true) argv.push("-u");
        /* `force` is always the lease-protected form; bare `--force` is never emitted. */
        if (args?.force === true) argv.push("--force-with-lease");
        if (remote !== undefined) argv.push(remote);
        if (branch !== undefined) argv.push(branch);
        message = remote === undefined ? "Pushed the current branch." : `Pushed ${remote}${branch === undefined ? "" : ` ${branch}`}.`;
        break;
      }
      case "pushToMultipleRemotes": {
        const branch = requireRefArg(args, "branch");
        const remotes = requireRemoteListArg(args, "remotes");
        const lines = [];
        let succeeded = 0;
        /* One push per remote; a failure is recorded and must not stop the others. */
        for (const remote of remotes) {
          const pushed = await git(repoPath, ["push", remote, branch]);
          if (pushed.code === 0) {
            succeeded += 1;
            lines.push(`${remote}: ok`);
          } else {
            lines.push(`${remote}: failed (${describePushFailure(pushed)})`);
          }
        }
        const report = capText(lines.join("\n"), MAX_DETAIL_BYTES).text;
        const summary = `pushed ${succeeded}/${remotes.length} remotes`;
        if (succeeded === 0) {
          /*
           * Zero successes is a failed action, not a 0/N success: throwing keeps the UI
           * in its failure path while the per-remote lines still ride along as `output`
           * (GitGraphError.stderr is what the envelope forwards).
           */
          throw new GitGraphError("GIT_FAILED", summary, { stderr: report });
        }
        return { message: summary, output: report };
      }
      case "rebase": {
        const onto = requireRefArg(args, "onto");
        argv = ["rebase", onto];
        message = `Rebased onto ${shortRef(onto)}.`;
        break;
      }
      case "dropCommit": {
        const hash = requireRefArg(args, "hash");
        const resolvedResult = await git(repoPath, ["rev-parse", "--verify", "--quiet", `${hash}^{commit}`]);
        const commit = resolvedResult.code === 0 ? resolvedResult.stdout.trim() : "";
        if (commit.length === 0) throw gitFailure("rev-parse", resolvedResult);
        const headResult = await git(repoPath, ["rev-parse", "--verify", "--quiet", "HEAD"]);
        const head = headResult.code === 0 ? headResult.stdout.trim() : "";
        if (head.length > 0 && head === commit) {
          throw new GitGraphError("BAD_REQUEST", `cannot drop HEAD (${shortRef(commit)}); check out a different commit first`);
        }
        const reachableResult = await git(repoPath, ["merge-base", "--is-ancestor", commit, "HEAD"]);
        if (reachableResult.code !== 0) {
          throw new GitGraphError("BAD_REQUEST", `cannot drop ${shortRef(commit)}: it is not reachable from HEAD`);
        }
        /* Refuse when a child is reachable from a ref other than the checked-out branch:
         * this rebase would rewrite HEAD's descendants but leave that other history. */
        const childrenResult = await git(repoPath, ["rev-list", "--all", "--children"]);
        let foreignChild = null;
        if (childrenResult.code === 0) {
          for (const line of childrenResult.stdout.split("\n")) {
            const tokens = line.trim().split(/\s+/).filter((token) => token.length > 0);
            if (tokens.length < 2 || tokens[0] !== commit) continue;
            for (const child of tokens.slice(1)) {
              const ancestorResult = await git(repoPath, ["merge-base", "--is-ancestor", child, "HEAD"]);
              if (ancestorResult.code !== 0) {
                foreignChild = child;
                break;
              }
            }
            if (foreignChild !== null) break;
          }
        }
        if (foreignChild !== null) {
          throw new GitGraphError(
            "BAD_REQUEST",
            `cannot drop ${shortRef(commit)}: it has children reachable from another ref (${shortRef(foreignChild)})`,
          );
        }
        argv = ["rebase", "--onto", `${hash}^`, hash];
        message = `Dropped commit ${shortRef(hash)}.`;
        break;
      }
      case "pushTag": {
        const name = requireRefArg(args, "name");
        const remote = optionalRefArg(args, "remote");
        argv = ["push"];
        if (remote !== undefined) argv.push(remote);
        argv.push(name);
        message = remote === undefined ? `Pushed tag "${name}".` : `Pushed tag "${name}" to "${remote}".`;
        break;
      }
      case "stashPush":
      case "stashUncommitted": {
        const includeUntracked = args?.includeUntracked === true;
        const stashMessage = optionalTextArg(args, "message");
        argv = ["stash", "push"];
        if (includeUntracked) argv.push("-u");
        if (stashMessage !== undefined) argv.push("-m", stashMessage);
        message = includeUntracked ? "Stashed changes including untracked files." : "Stashed changes.";
        break;
      }
      case "stashApply":
      case "stashPop": {
        const index = requireIndexArg(args, "index");
        const selector = `stash@{${index}}`;
        argv = ["stash", action === "stashPop" ? "pop" : "apply"];
        if (args?.reinstateIndex === true) argv.push("--index");
        argv.push(selector);
        message = `${action === "stashPop" ? "Popped" : "Applied"} ${selector}.`;
        break;
      }
      case "stashDrop": {
        const index = requireIndexArg(args, "index");
        const selector = `stash@{${index}}`;
        argv = ["stash", "drop", selector];
        message = `Dropped ${selector}.`;
        break;
      }
      case "branchFromStash": {
        const index = requireIndexArg(args, "index");
        const name = requireRefArg(args, "name");
        argv = ["stash", "branch", name, `stash@{${index}}`];
        message = `Created branch "${name}" from stash@{${index}}.`;
        break;
      }
      case "cleanUntracked": {
        const dryRun = args?.dryRun !== false;
        argv = ["clean", "-fd"];
        if (dryRun) argv.push("-n");
        message = dryRun ? "Dry run: no files were removed." : "Removed untracked files.";
        finalize = async (runResult) => {
          const count = runResult.stdout.split("\n").filter((line) => line.trim().length > 0).length;
          return dryRun ? `Dry run: ${count} untracked path(s) would be removed.` : `Removed ${count} untracked path(s).`;
        };
        break;
      }
      case "resetUncommitted": {
        const mode = requireEnumArg(args, "mode", RESET_UNCOMMITTED_MODES);
        argv = ["reset", `--${mode}`];
        message = `Reset uncommitted changes (${mode}).`;
        finalize = async () => {
          const statusResult = await git(repoPath, ["status", "--porcelain=v1", "-z"]);
          const dirty = statusResult.code === 0 ? countStatusEntries(statusResult.stdout) : 0;
          return `Reset uncommitted changes (${mode}); ${dirty} path(s) still modified.`;
        };
        break;
      }
      case "resetFileToRevision": {
        const filePath = requirePathArg(args, "path");
        const hash = requireRefArg(args, "hash");
        argv = ["checkout", hash, "--", filePath];
        message = `Restored "${filePath}" from ${shortRef(hash)}.`;
        break;
      }
      case "addRemote":
      case "editRemote": {
        const name = requireRefArg(args, "name");
        const url = requireTextArg(args, "url");
        argv = ["remote", action === "addRemote" ? "add" : "set-url", name, url];
        message = `${action === "addRemote" ? "Added" : "Updated"} remote "${name}".`;
        break;
      }
      case "deleteRemote": {
        const name = requireRefArg(args, "name");
        argv = ["remote", "remove", name];
        message = `Removed remote "${name}".`;
        break;
      }
      case "pruneRemote": {
        const name = requireRefArg(args, "name");
        argv = ["remote", "prune", name];
        message = `Pruned remote "${name}".`;
        break;
      }
      default:
        throw new GitGraphError("BAD_REQUEST", `unknown action: ${JSON.stringify(action)}`);
    }

    let result = await git(repoPath, argv);
    /* `git switch` is the modern verb; fall back for repositories/versions without it. */
    if (result.code !== 0 && fallback !== null) result = await git(repoPath, fallback);
    if (result.code !== 0) throw gitFailure(action, result);
    if (finalize !== null) {
      const completed = await finalize(result);
      if (typeof completed === "string" && completed.length > 0) message = completed;
    }
    return { message, output: capText(combineOutput(result), MAX_DETAIL_BYTES).text };
  }

  return {
    detectRepo,
    readGraph,
    searchCommits,
    readCommit,
    readUncommitted,
    readDiff,
    compareCommits,
    listBranches,
    readStashes,
    readTag,
    readRemotes,
    readContains,
    performAction,
  };
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
