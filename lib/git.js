import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_MAX_COMMITS = 400;

export const MAX_COMMITS_LIMIT = 2000;

export const MAX_DETAIL_BYTES = 8 * 1024;

export const MAX_DIFF_BYTES = 300 * 1024;

export const SEARCH_SCAN_LIMIT = 20_000;

export const SEARCH_DEFAULT_LIMIT = 50;

export const SEARCH_MAX_LIMIT = 200;

export const SEARCH_MAX_QUERY_LENGTH = 200;

export const SEARCH_SCOPES = new Set(["all", "message", "author", "ref"]);

export const ARCHIVE_FORMATS = new Map([
  ["zip", "zip"],
  ["tar.gz", "tar.gz"],
]);

const ARCHIVE_DIRECTORY = ".dsh-git-graph";

const GRAVATAR_BASE_URL = "https://secure.gravatar.com/avatar";
const GRAVATAR_SIZE = 64;

const AVATAR_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

const KNOWN_PR_HOSTS = new Map([
  ["github.com", "github"],
  ["gitlab.com", "gitlab"],
  ["bitbucket.org", "bitbucket"],
]);

const MAX_ERROR_BYTES = 4 * 1024;

const RUNNER_MAX_BUFFER = 16 * 1024 * 1024;

const DEFAULT_TIMEOUT_MS = 30_000;

const FIELD = "\u001f";

const NUL = "\u0000";

/* Subject stays last: it may contain the field separator. */
const LOG_FORMAT = `%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%s`;

/* %an/%ae ignore .mailmap; %aN/%aE honour it. */
const LOG_FORMAT_MAILMAP = `%H%x1f%P%x1f%aN%x1f%aE%x1f%at%x1f%cN%x1f%cE%x1f%ct%x1f%D%x1f%s`;

const SEARCH_LOG_FORMAT = `${LOG_FORMAT}%x1f%b`;

const SEARCH_LOG_FORMAT_MAILMAP = `${LOG_FORMAT_MAILMAP}%x1f%b`;

const SHOW_FORMAT = `%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%G?%x1f%GS%x1f%GK%x1f%s%x1f%b`;

const SIGNATURE_STATUSES = new Set(["G", "B", "U", "X", "Y", "R", "N"]);

const REF_FORMAT = "%(refname)%00%(objectname)%00%(HEAD)%00%(upstream:short)";

const REF_PATTERN = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;

const DIFF_SCOPES = new Set(["commit", "staged", "unstaged", "compare", "working"]);

const GRAPH_ORDER_FLAGS = {
  date: "--date-order",
  "author-date": "--author-date-order",
  topo: "--topo-order",
};

const MAX_BRANCH_FILTERS = 100;

const RESET_MODES = ["soft", "mixed", "hard"];

const RESET_UNCOMMITTED_MODES = ["mixed", "hard"];

const STASH_FORMAT = "%gd%x1f%H%x1f%gs%x1f%an%x1f%at";

const MAX_PUSH_REMOTES = 10;

export class GitGraphError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "GitGraphError";
    this.code = code;
    this.stdout = typeof details.stdout === "string" ? details.stdout : "";
    this.stderr = typeof details.stderr === "string" ? details.stderr : "";
  }
}

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
        /* An injected implementation may be promise-based. */
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

function toText(value) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
  return "";
}

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

export function isValidRepoPath(value) {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 4096) return false;
  if (value.startsWith("-")) return false;
  if (value.includes(NUL) || value.includes("\n") || value.includes("\r")) return false;
  return true;
}

export function md5Hex(value) {
  return createHash("md5").update(String(value), "utf8").digest("hex");
}

export function avatarUrl(email) {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0 || !AVATAR_EMAIL_PATTERN.test(normalized)) return null;
  return `${GRAVATAR_BASE_URL}/${md5Hex(normalized)}?s=${GRAVATAR_SIZE}&d=identicon`;
}

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

function sanitizeArchiveSegment(value) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");
  return slug.length > 0 ? slug : "archive";
}

function archiveTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

function parseRemoteUrl(rawUrl) {
  const parsed = { provider: "unknown", owner: null, repo: null, webUrl: null, hostRootUrl: "" };
  const raw = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (raw.length === 0) return parsed;

  let protocol = "";
  let host = "";
  let hostOrigin = "";
  let pathname = "";
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(raw);
  if (scheme !== null) {
    protocol = scheme[1].toLowerCase();
    let url;
    try {
      url = new URL(raw);
    } catch {
      return parsed;
    }
    host = url.hostname.toLowerCase();
    hostOrigin = url.origin;
    pathname = url.pathname;
  } else {
    const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(raw);
    if (scp === null) return parsed;
    protocol = "ssh";
    host = scp[1].toLowerCase();
    hostOrigin = `https://${host}`;
    pathname = scp[2];
  }
  host = host.replace(/^www\./, "");
  pathname = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (pathname.toLowerCase().endsWith(".git")) pathname = pathname.slice(0, -4);
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return parsed;

  const knownProvider = KNOWN_PR_HOSTS.get(host);
  if (knownProvider !== undefined && segments.length >= 2) {
    parsed.provider = knownProvider;
    parsed.owner = knownProvider === "gitlab" ? segments.slice(0, -1).join("/") : segments[0];
    parsed.repo = knownProvider === "gitlab" ? segments[segments.length - 1] : segments[1];
    parsed.webUrl = `https://${host}/${knownProvider === "gitlab" ? segments.join("/") : `${parsed.owner}/${parsed.repo}`}`;
    parsed.hostRootUrl = `https://${host}`;
    return parsed;
  }

  parsed.owner = segments.length >= 2 ? segments[0] : null;
  parsed.repo = segments.length >= 2 ? segments[segments.length - 1] : segments[0];
  if (protocol === "https" || protocol === "http") {
    parsed.provider = "other";
    parsed.webUrl = `${hostOrigin}/${pathname}`;
    parsed.hostRootUrl = hostOrigin;
  }
  return parsed;
}

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

function combineOutput(result) {
  const parts = [];
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  if (stdout.length > 0) parts.push(stdout);
  if (stderr.length > 0 && stderr !== stdout) parts.push(stderr);
  return parts.join("\n");
}

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

function decorationVisible(chip, { showTags, showRemoteBranches, showRemoteHeads, remoteNames, remoteHeadNames }) {
  if (!showTags && chip.startsWith("tag: ")) return false;
  if (!showRemoteBranches && remoteNames.has(chip)) return false;
  if (!showRemoteHeads && remoteHeadNames.has(chip)) return false;
  return true;
}

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

function countStatusEntries(text) {
  return parseStatusEntries(text).length;
}

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

const UNTRACKED_PROBE_CHUNK = 64 * 1024;

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
    if (!binary && lastByte !== 10) added += 1;
    return { added: binary ? 0 : added, binary };
  } catch {
    return { added: 0, binary: false };
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch {
    }
  }
}

function shortRef(value) {
  return /^[0-9a-f]{40}$/i.test(value) ? value.slice(0, 7) : value;
}

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

function resolveGraphOrderFlag(value) {
  if (value === undefined || value === null || value === "") return GRAPH_ORDER_FLAGS.date;
  if (typeof value === "string" && Object.hasOwn(GRAPH_ORDER_FLAGS, value)) return GRAPH_ORDER_FLAGS[value];
  throw new GitGraphError("BAD_REQUEST", `invalid order: ${JSON.stringify(value)}; expected date, author-date or topo`);
}

function requireEnumArg(args, key, allowed) {
  const value = args?.[key];
  if (typeof value !== "string" || value.length === 0) throw new GitGraphError("BAD_REQUEST", `missing required argument "${key}"`);
  if (!allowed.includes(value)) {
    throw new GitGraphError("BAD_REQUEST", `invalid ${key}: ${JSON.stringify(value)}; expected ${allowed.join(" or ")}`);
  }
  return value;
}

function requireIndexArg(args, key) {
  const value = args?.[key];
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new GitGraphError("BAD_REQUEST", `invalid stash index for "${key}": ${JSON.stringify(value)}; expected an integer >= 0`);
  }
  return value;
}

function optionalRefArg(args, key) {
  const value = args?.[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !isValidRefName(value)) {
    throw new GitGraphError("BAD_REQUEST", `invalid git reference for "${key}": ${JSON.stringify(value)}`);
  }
  return value;
}

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

function optionalTextArg(args, key) {
  const value = args?.[key];
  if (value === undefined || value === null || value === "") return undefined;
  return requireTextArg(args, key, { allowLeadingDash: true });
}

function requirePathArg(args, key) {
  const value = args?.[key];
  if (typeof value !== "string" || value.length === 0) throw new GitGraphError("BAD_REQUEST", `missing required argument "${key}"`);
  if (!isValidRepoPath(value)) throw new GitGraphError("BAD_REQUEST", `invalid repository path for "${key}": ${JSON.stringify(value)}`);
  return value;
}

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

function describePushFailure(result) {
  const detail = [result.stderr, result.stdout]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .find((part) => part.length > 0);
  if (detail === undefined) return `exit ${result.code === null ? "unknown" : result.code}`;
  const collapsed = capText(detail.replace(/\s+/g, " "), 300).text;
  return collapsed.length > 0 ? collapsed : `exit ${result.code}`;
}

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

export function createGitApi(run) {
  if (typeof run !== "function") throw new TypeError("createGitApi: run must be a function");

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
    const fetchAvatars = options.fetchAvatars === true;
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
    /* Empty filter means the default walk; stashes never join it. */
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
        if (fetchAvatars) {
          parsed.commit.authorAvatar = avatarUrl(parsed.commit.authorEmail);
          parsed.commit.committerAvatar = avatarUrl(parsed.commit.committerEmail);
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

  async function readStashEntries(repoPath) {
    const result = await git(repoPath, ["stash", "list", `--format=${STASH_FORMAT}`]);
    if (result.code !== 0) return [];
    return parseStashList(result.stdout);
  }

  async function readStashes(cwd) {
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) {
      return { isRepo: false, error: "NOT_A_REPO", message: detection.message ?? null, stashes: [] };
    }
    const stashes = await readStashEntries(detection.repoPath ?? cwd);
    return { isRepo: true, stashes };
  }

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

  async function readRemotes(cwd) {
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) {
      return { isRepo: false, error: "NOT_A_REPO", message: detection.message ?? null, remotes: [] };
    }
    const result = await git(detection.repoPath ?? cwd, ["remote", "-v"]);
    if (result.code !== 0) throw gitFailure("remote", result);
    return { isRepo: true, remotes: parseRemoteList(result.stdout) };
  }

  async function archive(cwd, options = {}) {
    const rawFormat = options.format;
    const format = rawFormat === undefined || rawFormat === null || rawFormat === "" ? "zip" : rawFormat;
    if (typeof format !== "string" || !ARCHIVE_FORMATS.has(format)) {
      throw new GitGraphError("BAD_REQUEST", `invalid archive format: ${JSON.stringify(rawFormat)}; expected zip or tar.gz`);
    }
    const ref = options.ref;
    if (typeof ref !== "string" || ref.length === 0) throw new GitGraphError("BAD_REQUEST", "ref is required");
    if (!isValidRefName(ref)) throw new GitGraphError("BAD_REQUEST", `invalid ref: ${JSON.stringify(ref)}`);

    const detection = await detectRepo(cwd);
    if (!detection.isRepo) return { isRepo: false };
    const repoPath = detection.repoPath ?? cwd;

    const resolvedResult = await git(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`]);
    if (resolvedResult.code !== 0 || resolvedResult.stdout.trim().length === 0) throw gitFailure("rev-parse", resolvedResult);
    const hash = resolvedResult.stdout.trim();

    const workspacePath =
      typeof options.workspacePath === "string" && options.workspacePath.length > 0
        ? path.resolve(options.workspacePath)
        : path.resolve(typeof cwd === "string" && cwd.length > 0 ? cwd : repoPath);
    const workspaceReal = realPathOrSelf(workspacePath);
    /* Resolve the directory before creating it: a symlink must not escape. */
    const archiveRoot = path.join(workspacePath, ARCHIVE_DIRECTORY);
    const archiveRootReal = realPathOrSelf(archiveRoot);
    if (!isPathInside(workspaceReal, archiveRootReal)) {
      throw new GitGraphError("OUTSIDE_WORKSPACE", `refusing to write the archive outside the session workspace ${workspacePath}`);
    }
    const archiveDir = path.join(archiveRootReal, "archives");
    try {
      fs.mkdirSync(archiveDir, { recursive: true });
    } catch (error) {
      throw new GitGraphError("GIT_FAILED", `could not create the archive directory: ${error instanceof Error ? error.message : String(error)}`);
    }
    const archiveDirReal = realPathOrSelf(archiveDir);
    if (!isPathInside(workspaceReal, archiveDirReal)) {
      throw new GitGraphError("OUTSIDE_WORKSPACE", `refusing to write the archive outside the session workspace ${workspacePath}`);
    }

    const repoBase = sanitizeArchiveSegment(path.basename(repoPath));
    const refSlug = sanitizeArchiveSegment(ref);
    const extension = ARCHIVE_FORMATS.get(format);
    const baseName = `${repoBase}-${refSlug}-${archiveTimestamp()}`;
    let name = `${baseName}.${extension}`;
    let attempt = 2;
    while (fs.existsSync(path.join(archiveDirReal, name))) {
      name = `${baseName}-${attempt}.${extension}`;
      attempt += 1;
      if (attempt > 10_000) throw new GitGraphError("GIT_FAILED", "could not allocate a unique archive file name");
    }
    const absolutePath = path.join(archiveDirReal, name);

    const result = await git(repoPath, ["archive", `--format=${format}`, `--prefix=${path.basename(repoPath)}/`, "-o", absolutePath, hash]);
    if (result.code !== 0) {
      try {
        fs.rmSync(absolutePath, { force: true });
      } catch {
      }
      throw gitFailure("archive", result);
    }
    let bytes = 0;
    try {
      bytes = fs.statSync(absolutePath).size;
    } catch {
      bytes = 0;
    }
    return {
      isRepo: true,
      path: path.relative(workspaceReal, absolutePath),
      format,
      ref,
      name,
      bytes,
    };
  }

  async function readPullRequest(cwd, options = {}) {
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) return { isRepo: false };
    const repoPath = detection.repoPath ?? cwd;

    /* git remote sorts alphabetically; .git/config holds the real order. */
    const configNamesResult = await git(repoPath, ["config", "--get-regexp", "^remote\\..*\\.url$"]);
    const configuredNames = [];
    if (configNamesResult.code === 0) {
      for (const line of configNamesResult.stdout.split("\n")) {
        const match = /^remote\.(.+)\.url\s/.exec(line);
        if (match !== null && !configuredNames.includes(match[1])) configuredNames.push(match[1]);
      }
    }
    let remoteNames = configuredNames;
    if (remoteNames.length === 0) {
      const remoteNamesResult = await git(repoPath, ["remote"]);
      if (remoteNamesResult.code !== 0) throw gitFailure("remote", remoteNamesResult);
      remoteNames = remoteNamesResult.stdout
        .split("\n")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    }
    if (remoteNames.length === 0) throw new GitGraphError("BAD_REQUEST", "no remote is configured");
    const remoteName = remoteNames.includes("origin") ? "origin" : remoteNames[0];
    const remoteUrlResult = await git(repoPath, ["remote", "get-url", remoteName]);
    if (remoteUrlResult.code !== 0) throw gitFailure("remote", remoteUrlResult);
    const remoteUrl = remoteUrlResult.stdout.trim();
    const parsedRemote = parseRemoteUrl(remoteUrl);

    const requestedBranch = options.branch;
    let branch;
    if (requestedBranch !== undefined && requestedBranch !== null && requestedBranch !== "") {
      if (typeof requestedBranch !== "string" || !isValidRefName(requestedBranch)) {
        throw new GitGraphError("BAD_REQUEST", `invalid branch: ${JSON.stringify(requestedBranch)}`);
      }
      branch = requestedBranch;
    } else {
      const head = await readHead(repoPath);
      if (head.detached || head.branch === null) {
        throw new GitGraphError("BAD_REQUEST", "cannot create a pull request from a detached HEAD");
      }
      branch = head.branch;
    }

    const requestedBase = options.base;
    let base;
    if (requestedBase !== undefined && requestedBase !== null && requestedBase !== "") {
      if (typeof requestedBase !== "string" || !isValidRefName(requestedBase)) {
        throw new GitGraphError("BAD_REQUEST", `invalid base: ${JSON.stringify(requestedBase)}`);
      }
      base = requestedBase;
    } else {
      const headRefs = [...new Set([`refs/remotes/${remoteName}/HEAD`, "refs/remotes/origin/HEAD"])];
      for (const headRef of headRefs) {
        const symbolic = await git(repoPath, ["symbolic-ref", "--quiet", "--short", headRef]);
        if (symbolic.code !== 0) continue;
        const target = symbolic.stdout.trim();
        const slash = target.indexOf("/");
        if (slash > 0 && slash < target.length - 1) {
          base = target.slice(slash + 1);
          break;
        }
      }
      if (base === undefined) {
        const mainResult = await git(repoPath, ["rev-parse", "--verify", "--quiet", "refs/heads/main^{commit}"]);
        if (mainResult.code === 0) base = "main";
        else {
          const masterResult = await git(repoPath, ["rev-parse", "--verify", "--quiet", "refs/heads/master^{commit}"]);
          base = masterResult.code === 0 ? "master" : "main";
        }
      }
    }

    const remote = {
      name: remoteName,
      url: remoteUrl,
      provider: parsedRemote.provider,
      owner: parsedRemote.owner,
      repo: parsedRemote.repo,
      webUrl: parsedRemote.webUrl,
    };

    let url = null;
    if (parsedRemote.provider === "github" && parsedRemote.owner !== null && parsedRemote.repo !== null) {
      url = `https://github.com/${parsedRemote.owner}/${parsedRemote.repo}/compare/${base}...${branch}?expand=1`;
    } else if (parsedRemote.provider === "gitlab" && parsedRemote.owner !== null && parsedRemote.repo !== null) {
      url = `https://gitlab.com/${parsedRemote.owner}/${parsedRemote.repo}/-/merge_requests/new?merge_request[source_branch]=${branch}&merge_request[target_branch]=${base}`;
    } else if (parsedRemote.provider === "bitbucket" && parsedRemote.owner !== null && parsedRemote.repo !== null) {
      url = `https://bitbucket.org/${parsedRemote.owner}/${parsedRemote.repo}/pull-requests/new?source=${branch}&dest=${base}`;
    }

    const custom = [];
    const providers = Array.isArray(options.customProviders) ? options.customProviders : [];
    for (const provider of providers) {
      if (provider === null || typeof provider !== "object") continue;
      const name = typeof provider.name === "string" ? provider.name.trim() : "";
      const templateUrl = typeof provider.templateUrl === "string" ? provider.templateUrl.trim() : "";
      if (name.length === 0 || templateUrl.length === 0) continue;
      const templateValues = [
        parsedRemote.hostRootUrl,
        parsedRemote.owner ?? "",
        parsedRemote.repo ?? "",
        branch,
        parsedRemote.owner ?? "",
        parsedRemote.repo ?? "",
        "",
        base,
      ];
      const customUrl = templateUrl.replace(/\$([1-8])/g, (_match, index) => templateValues[Number.parseInt(index, 10) - 1]);
      custom.push({ name, url: customUrl });
    }

    return { isRepo: true, remote, branch, base, url, custom };
  }

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
      /* refs/stash carries no index; recover selectors from the reflog. */
      const entries = await readStashEntries(repoPath);
      for (const entry of entries) {
        const contained =
          entry.hash === commit ? true : (await git(repoPath, ["merge-base", "--is-ancestor", commit, entry.hash])).code === 0;
        if (contained) stashes.push({ index: entry.index, shortName: `stash@{${entry.index}}` });
      }
    }

    return { hash: commit, shortHash: commit.slice(0, 7), inHead, branches, tags, stashes, generatedAt: Date.now() };
  }

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

  async function readCommit(cwd, hash, options = {}) {
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

    const value = {
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
    if (options.fetchAvatars === true) {
      value.authorAvatar = avatarUrl(authorEmail);
      value.committerAvatar = avatarUrl(committerEmail);
    }
    return value;
  }

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
      /* A bare diff-tree prints nothing for a merge; use its first parent. */
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
      const trackedResult = await git(repoPath, ["ls-files", "--error-unmatch", "--", filePath]);
      let tracked = trackedResult.code === 0;
      if (!tracked) {
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
    /* `git diff --no-index` exits 1 when the paths differ: success here. */
    if (noIndex && result.code === 1) result = { ...result, code: 0 };
    if (result.code !== 0) throw gitFailure(commandLabel, result);

    const patch = result.stdout;
    const binary = /^Binary files .* differ$/m.test(patch) || /^GIT binary patch$/m.test(patch) || patch.includes("GIT binary patch");
    const capped = binary ? { text: "", truncated: false } : capText(patch, MAX_DIFF_BYTES);
    return { patch: capped.text, truncated: capped.truncated || result.overflowed, binary };
  }

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

  async function compareWorkingTree(repoPath, base) {
    const baseResult = await git(repoPath, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
    if (baseResult.code !== 0 || baseResult.stdout.trim().length === 0) {
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

  async function performAction(cwd, action, args = {}) {
    if (typeof action !== "string" || action.length === 0) throw new GitGraphError("BAD_REQUEST", "action is required");
    const detection = await detectRepo(cwd);
    if (!detection.isRepo) throw new GitGraphError("NOT_A_REPO", `not a git repository: ${cwd}`);
    const repoPath = detection.repoPath ?? cwd;

    let argv;
    let fallback = null;
    let message;
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
        argv = ["fetch", remote, `${branch}:${local}`];
        message = `Fetched "${remote}/${branch}" into "${local}".`;
        break;
      }
      case "mergeCommit":
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
        /* Rebasing HEAD would leave this child behind on the other ref. */
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
    /* `git switch` is newer; fall back for older repositories/versions. */
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
    archive,
    readPullRequest,
    performAction,
  };
}

function requireRefArg(args, key) {
  const value = args?.[key];
  if (typeof value !== "string" || value.length === 0) throw new GitGraphError("BAD_REQUEST", `missing required argument "${key}"`);
  if (!isValidRefName(value)) throw new GitGraphError("BAD_REQUEST", `invalid git reference for "${key}": ${JSON.stringify(value)}`);
  return value;
}

function gitFailure(action, result) {
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const detail = stderr.length > 0 ? stderr : stdout;
  const message = detail.length > 0 ? capText(detail, MAX_ERROR_BYTES).text : `git ${action} failed with exit code ${result.code}`;
  return new GitGraphError("GIT_FAILED", message, { stdout: result.stdout, stderr: result.stderr });
}

export const api = createGitApi(createGitRunner());
