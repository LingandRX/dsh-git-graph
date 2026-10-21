/**
 * Host-half tests for dsh-git-graph.
 *
 * Every repository used here is created under `os.tmpdir()` and removed afterwards;
 * the workspace itself is never used as a test repository. The suite exercises the
 * git layer directly, the four Fetch routes and the `git_graph` tool definition
 * through a fake Cordis context, including the error envelopes. Wave-2 coverage adds
 * uncommitted worktree state, diff scopes and commit comparison.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { SEARCH_SCAN_LIMIT, avatarUrl, createGitApi, createGitRunner, isValidRefName, md5Hex } from "../lib/git.js";
import { apply, name as pluginName, normalizeConfig } from "../lib/index.js";

const FIELD = "\u001f";
const NUL = "\u0000";
const GRAPH_PATH = "/api/dsh-git-graph/graph";
const SEARCH_PATH = "/api/dsh-git-graph/search";
const COMMIT_PATH = "/api/dsh-git-graph/commit";
const DIFF_PATH = "/api/dsh-git-graph/diff";
const ACTION_PATH = "/api/dsh-git-graph/action";
const UNCOMMITTED_PATH = "/api/dsh-git-graph/uncommitted";
const COMPARE_PATH = "/api/dsh-git-graph/compare";
const STASHES_PATH = "/api/dsh-git-graph/stashes";
const TAG_PATH = "/api/dsh-git-graph/tag";
const REMOTES_PATH = "/api/dsh-git-graph/remotes";
const CONTAINS_PATH = "/api/dsh-git-graph/contains";
const REPOS_PATH = "/api/dsh-git-graph/repos";
const REVIEW_PATH = "/api/dsh-git-graph/review";
const ARCHIVE_PATH = "/api/dsh-git-graph/archive";
const PR_PATH = "/api/dsh-git-graph/pr";
const REPOCONFIG_PATH = "/api/dsh-git-graph/repoconfig";

/** Filesystem and git fixtures shared by the suite. */
const fixture = {
  root: "",
  repo: "",
  empty: "",
  emptyRepo: "",
  remote: "",
  env: undefined,
  clock: 1_700_100_000,
  commits: {},
};

/** Running `git` in a fixture repository. */
function runGit(args, cwd, extraEnv = {}, allowFailure = false) {
  try {
    return execFileSync("git", args, {
      cwd,
      env: { ...fixture.env, ...extraEnv },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (allowFailure) return "";
    const stderr = error?.stderr === undefined ? "" : String(error.stderr);
    throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${stderr || error?.message}`);
  }
}

/** Timestamp environment for one deterministic commit. */
function nextDates() {
  fixture.clock += 60;
  return {
    GIT_AUTHOR_DATE: `${fixture.clock} +0000`,
    GIT_COMMITTER_DATE: `${fixture.clock} +0000`,
  };
}

/** Write one file, creating parent directories. */
function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

/** Stage everything and commit; returns the new commit hash. */
function commitAll(cwd, message, body) {
  runGit(["add", "-A"], cwd);
  const args = ["commit", "-q", "-m", message];
  if (typeof body === "string" && body.length > 0) args.push("-m", body);
  runGit(args, cwd, nextDates());
  return runGit(["rev-parse", "HEAD"], cwd).trim();
}

/** Create one additional repository fixture under the shared temporary root. */
function createScratchRepo(name) {
  const directory = path.join(fixture.root, name);
  fs.mkdirSync(directory);
  runGit(["init", "-q", "-b", "main"], directory);
  return directory;
}

/** Fixed ISO timestamp accepted by git's date environment variables. */
function gitDate(seconds) {
  return new Date(seconds * 1000).toISOString().replace(/\.\d+Z$/, "+00:00");
}

/** Stage everything and commit at an explicit timestamp; returns the new commit hash. */
function commitAt(cwd, seconds, message) {
  runGit(["add", "-A"], cwd);
  const date = gitDate(seconds);
  runGit(["commit", "-q", "-m", message], cwd, { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  return runGit(["rev-parse", "HEAD"], cwd).trim();
}

/**
 * Import a linear history of `count` empty commits in a single `git fast-import` call.
 * The settings tests need a few hundred commits without paying one process per commit.
 */
function importLinearHistory(cwd, count) {
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const when = 1_700_100_000 + index;
    const message = `imported commit ${index}`;
    records.push(
      "commit refs/heads/main",
      `author Graph Test <graph@example.com> ${when} +0000`,
      `committer Graph Test <graph@example.com> ${when} +0000`,
      `data ${Buffer.byteLength(message, "utf8")}`,
      message,
      "",
    );
  }
  execFileSync("git", ["fast-import", "--quiet", "--force"], {
    cwd,
    env: fixture.env,
    input: `${records.join("\n")}\n`,
    stdio: ["pipe", "ignore", "pipe"],
  });
}

/** Create one bare remote repository under the shared temporary root. */
function createBareRemote(name) {
  const remotePath = path.join(fixture.root, name);
  runGit(["init", "-q", "--bare", "-b", "main", remotePath], fixture.root);
  return remotePath;
}

/** Clone one bare remote into the shared temporary root. */
function cloneFromRemote(remotePath, name) {
  const target = path.join(fixture.root, name);
  runGit(["clone", "-q", remotePath, target], fixture.root);
  return target;
}

/** Current HEAD hash of a repository. */
function headOf(cwd) {
  return runGit(["rev-parse", "HEAD"], cwd).trim();
}

/** File content as UTF-8 text. */
function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/** Parent hashes of one revision. */
function parentsOf(cwd, revision = "HEAD") {
  return runGit(["log", "-1", "--format=%P", revision], cwd)
    .trim()
    .split(/\s+/)
    .filter((parent) => parent.length > 0);
}

/** Build one commit message fixture repository with branches, a merge, rename, binary and a large file. */
function buildFixtureRepository() {
  fixture.root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-git-graph-test-"));
  fixture.repo = path.join(fixture.root, "repo");
  fixture.empty = path.join(fixture.root, "empty");
  fixture.emptyRepo = path.join(fixture.root, "empty-repo");
  fixture.remote = path.join(fixture.root, "remote.git");
  fs.mkdirSync(fixture.repo);
  fs.mkdirSync(fixture.empty);
  fs.mkdirSync(fixture.emptyRepo);
  const emptyConfig = path.join(fixture.root, "gitconfig");
  fs.writeFileSync(emptyConfig, "");

  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_COMMON_DIR", "GIT_ALTERNATE_OBJECT_DIRECTORIES"]) {
    delete env[key];
  }
  fixture.env = {
    ...env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_AUTHOR_NAME: "Graph Test",
    GIT_AUTHOR_EMAIL: "graph@example.com",
    GIT_COMMITTER_NAME: "Graph Test",
    GIT_COMMITTER_EMAIL: "graph@example.com",
  };

  const repo = fixture.repo;
  runGit(["init", "-q", "-b", "main"], repo);
  runGit(["init", "-q", "-b", "main"], fixture.emptyRepo);

  writeFile(path.join(repo, "README.md"), "# fixture\n");
  writeFile(path.join(repo, "src", "a.txt"), "one\ntwo\n");
  fixture.commits.root = commitAll(repo, "Initial commit");

  writeFile(path.join(repo, "src", "a.txt"), "one\ntwo\nthree\n");
  writeFile(path.join(repo, "notes.txt"), "notes\n");
  fixture.commits.second = commitAll(repo, "Add notes and extend a", "Extended src/a.txt with a third line.");
  runGit(["tag", "v1.0"], repo);

  runGit(["switch", "-q", "-c", "feature"], repo);
  writeFile(path.join(repo, "feature.txt"), "feature\n");
  fixture.commits.feature = commitAll(repo, "Feature work");

  runGit(["switch", "-q", "main"], repo);
  writeFile(path.join(repo, "main.txt"), "main\n");
  fixture.commits.main = commitAll(repo, "Main work");

  runGit(["merge", "--no-ff", "-q", "feature", "-m", "Merge feature"], repo, nextDates());
  fixture.commits.merge = runGit(["rev-parse", "HEAD"], repo).trim();

  runGit(["mv", "src/a.txt", "src/renamed.txt"], repo);
  fixture.commits.rename = commitAll(repo, "Rename a to renamed");

  writeFile(path.join(repo, "docs", "bin.dat"), Buffer.from([0, 1, 2, 3, 0, 255, 254, 10]));
  fixture.commits.binary = commitAll(repo, "Add binary asset");

  runGit(["rm", "-q", "main.txt"], repo);
  fixture.commits.deleted = commitAll(repo, "Remove main file");

  const lines = [];
  for (let index = 0; index < 12_000; index += 1) lines.push(`line ${index}: ${"x".repeat(30)}`);
  writeFile(path.join(repo, "docs", "large.txt"), `${lines.join("\n")}\n`);
  fixture.commits.large = commitAll(repo, "Add large file");

  runGit(["init", "-q", "--bare", fixture.remote], fixture.root);
  runGit(["remote", "add", "origin", fixture.remote], repo);
  runGit(["push", "-q", "-u", "origin", "main"], repo);
  runGit(["push", "-q", "origin", "feature"], repo);

  fixture.commits.head = runGit(["rev-parse", "HEAD"], repo).trim();
}

/** Create a fake Cordis context exposing only `ctx.get`, `ctx.effect` and `ctx.inject`. */
function createFakeContext(services) {
  const disposers = [];
  const context = {
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    get(serviceName) {
      return services[serviceName];
    },
    effect(build) {
      const dispose = build();
      if (typeof dispose === "function") disposers.push(dispose);
      return dispose;
    },
    inject(dependencies, callback) {
      if (!dependencies.every((dependency) => services[dependency] !== undefined)) return;
      const scope = Object.create(context);
      for (const dependency of dependencies) scope[dependency] = services[dependency];
      callback(scope);
    },
  };
  return {
    ctx: context,
    dispose() {
      for (const disposer of disposers.splice(0)) {
        try {
          disposer();
        } catch {
          /* disposers are best effort in a fake host */
        }
      }
    },
  };
}

/** Apply the plugin to a fake host and capture registrations. */
function createHost({ config, defaultDirectory, includeConnection = true, includeTools = true, storageDomain } = {}) {
  const routes = new Map();
  const tools = [];
  const sessions = new Map();
  const services = {
    sessions: {
      get(sessionId) {
        return sessions.get(sessionId);
      },
    },
    workingDirectory: {
      defaultDirectory: defaultDirectory ?? fixture.repo,
      get(session) {
        return session?.header?.cwd;
      },
    },
  };
  if (storageDomain !== undefined) services.storageDomain = storageDomain;
  if (includeConnection) {
    services.connection = {
      fetch: {
        register(route) {
          assert.equal(routes.has(route.path), false, `duplicate route ${route.path}`);
          routes.set(route.path, route);
          return () => routes.delete(route.path);
        },
      },
    };
  }
  if (includeTools) {
    services.tools = {
      register(definition) {
        tools.push(definition);
        return () => {
          const index = tools.indexOf(definition);
          if (index >= 0) tools.splice(index, 1);
        };
      },
    };
  }
  const fake = createFakeContext(services);
  apply(fake.ctx, config);
  return { ...fake, routes, tools, sessions, services };
}

/** In-memory stand-in for the Host `storageDomain` service (one domain, one table). */
function createFakeStorageDomain() {
  const records = new Map();
  const opened = [];
  const domain = {
    name: "dsh_git_graph",
    table(name) {
      assert.equal(name, "reviews");
      return {
        get(key) {
          return records.get(key);
        },
        async put(key, value) {
          records.set(key, JSON.parse(JSON.stringify(value)));
        },
        async delete(key) {
          return records.delete(key);
        },
        keys() {
          return [...records.keys()];
        },
      };
    },
    async close() {},
  };
  return {
    records,
    opened,
    service: {
      async open(spec) {
        opened.push(spec);
        return domain;
      },
    },
  };
}

/** POST one JSON body to a registered route and decode its envelope. */
async function post(host, routePath, body, { rawBody } = {}) {
  const route = host.routes.get(routePath);
  assert.ok(route !== undefined, `route ${routePath} is registered`);
  assert.deepEqual(route.methods, ["POST"]);
  assert.equal(route.requestBody, "buffered");
  assert.equal(typeof route.fetch, "function");
  const request = new Request(`http://127.0.0.1:3080${routePath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(rawBody !== undefined ? { body: rawBody } : {}),
    ...(rawBody === undefined ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const response = await route.fetch(request);
  assert.equal(response.status, 200, "every route answers HTTP 200 with an envelope");
  return response.json();
}

/** POST without any request body (an empty body is an empty options object). */
async function postEmpty(host, routePath) {
  const route = host.routes.get(routePath);
  assert.ok(route !== undefined, `route ${routePath} is registered`);
  const request = new Request(`http://127.0.0.1:3080${routePath}`, { method: "POST" });
  const response = await route.fetch(request);
  assert.equal(response.status, 200);
  return response.json();
}

let api;
let host;

before(() => {
  buildFixtureRepository();
  api = createGitApi(createGitRunner({ timeoutMs: 20_000 }));
  host = createHost({ config: undefined, defaultDirectory: fixture.repo });
});

after(() => {
  fixture.root && fs.rmSync(fixture.root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Runner, validation and parsing units
// ---------------------------------------------------------------------------

test("createGitRunner invokes execFile with hardened argv and environment", async () => {
  let captured;
  const run = createGitRunner({
    timeoutMs: 1234,
    execFileImpl(file, argv, options, callback) {
      captured = { file, argv, options };
      callback(null, "ok-out", "");
    },
  });
  const result = await run(["rev-parse", "--show-toplevel"], { cwd: fixture.repo });
  assert.deepEqual(result, { stdout: "ok-out", stderr: "", code: 0, signal: null, error: undefined, overflowed: false });
  assert.equal(captured.file, "git");
  assert.deepEqual(captured.argv.slice(0, 5), ["--no-pager", "-c", "color.ui=false", "-c", "core.quotepath=false"]);
  assert.deepEqual(captured.argv.slice(5), ["rev-parse", "--show-toplevel"]);
  assert.equal(captured.options.cwd, fixture.repo);
  assert.equal(captured.options.timeout, 1234);
  assert.equal(captured.options.env.GIT_TERMINAL_PROMPT, "0");
  assert.equal(captured.options.env.LC_ALL, "C");
  assert.equal(captured.options.shell, undefined);
  assert.equal(captured.options.windowsHide, true);
});

test("createGitRunner normalizes a failed command without throwing", async () => {
  const run = createGitRunner({
    execFileImpl(_file, _argv, _options, callback) {
      const error = Object.assign(new Error("boom"), { code: 128, stderr: "fatal: nope" });
      callback(error, "", "fatal: nope");
    },
  });
  const result = await run(["status"]);
  assert.equal(result.code, 128);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "fatal: nope");
  assert.equal(result.overflowed, false);
});

test("isValidRefName accepts real refs and rejects injection shapes", () => {
  for (const good of ["main", "feature/x", "v1.0", "HEAD", "a".repeat(40), "origin/main", "release-1.2"]) {
    assert.equal(isValidRefName(good), true, good);
  }
  for (const bad of ["", "-rf", "--force", "a..b", "a@{1}", "a b", "refs/heads/", "x.lock", "x.", "a//b", "a\nb", ".", "..", "/abs", 42, null]) {
    assert.equal(isValidRefName(bad), false, String(bad));
  }
});

test("createGitApi parses NUL/0x1f records, keeps subjects intact and honors the page limit", async () => {
  const hashA = "a".repeat(40);
  const hashB = "b".repeat(40);
  const hashC = "c".repeat(40);
  const record = (hash, parents, subject, decorations) =>
    [hash, parents, "Graph Test", "graph@example.com", "1700000100", "Graph Test", "graph@example.com", "1700000100", decorations, subject].join(FIELD);
  const records = [
    record(hashC, hashB, "third"),
    record(hashB, hashA, "weird\u001fsubject"),
    record(hashA, "", "root"),
  ];
  const calls = [];
  const fakeRun = async (argv) => {
    calls.push(argv);
    const ok = (stdout) => ({ stdout, stderr: "", code: 0 });
    switch (argv[0]) {
      case "rev-parse":
        if (argv[1] === "--show-toplevel") return ok("/fake/repo\n");
        if (argv[1] === "--abbrev-ref") return ok("main\n");
        return ok(`${hashA}\n`);
      case "status":
        return ok(`RM new.txt${NUL}old.txt${NUL}?? untracked${NUL}`);
      case "for-each-ref":
        return ok(
          `refs/heads/main${NUL}${hashA}${NUL}*${NUL}origin/main\n` +
            `refs/remotes/origin/main${NUL}${hashA}${NUL} ${NUL}\n` +
            `refs/tags/v1.0${NUL}${hashB}${NUL} ${NUL}\n`,
        );
      case "log":
        return ok(`${records.join(NUL)}${NUL}`);
      default:
        return ok("");
    }
  };
  const fakeApi = createGitApi(fakeRun);
  const graph = await fakeApi.readGraph("/fake/repo", { maxCommits: 2 });
  assert.equal(graph.isRepo, true);
  assert.equal(graph.repoPath, "/fake/repo");
  assert.equal(graph.head.branch, "main");
  assert.equal(graph.head.detached, false);
  assert.equal(graph.status.dirty, 2, "a rename counts once and an untracked file counts once");
  assert.equal(graph.commits.length, 2);
  assert.equal(graph.truncated, true);
  assert.equal(graph.commits[1].subject, "weird\u001fsubject", "a 0x1f inside the subject survives parsing");
  assert.deepEqual(graph.commits[0].refs, []);
  assert.deepEqual(graph.commits[1].refs, []);
  assert.deepEqual(graph.commits[2], undefined);
  assert.deepEqual(graph.refs.map((ref) => ref.name), ["refs/heads/main", "refs/remotes/origin/main", "refs/tags/v1.0"]);
  assert.equal(graph.refs[0].head, true);
  assert.equal(graph.refs[0].upstream, "origin/main");

  const logCall = calls.find((argv) => argv[0] === "log");
  assert.ok(logCall.includes("--max-count=3"), "asks for limit+1 records to detect truncation");
  assert.ok(logCall.includes("--remotes"));
  assert.equal(logCall[logCall.length - 1], "HEAD");

  calls.length = 0;
  const localOnly = await fakeApi.readGraph("/fake/repo", { maxCommits: 2, showRemoteBranches: false });
  assert.deepEqual(localOnly.refs.map((ref) => ref.name), ["refs/heads/main", "refs/tags/v1.0"]);
  const localLog = calls.find((argv) => argv[0] === "log");
  assert.equal(localLog.includes("--remotes"), false);
});

test("revert and revertCommit both reach git revert --no-edit", async () => {
  const hash = "a".repeat(40);
  const calls = [];
  const fakeApi = createGitApi(async (argv) => {
    calls.push([...argv]);
    if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel") return { stdout: "/fake/repo\n", stderr: "", code: 0 };
    return { stdout: "", stderr: "", code: 0 };
  });
  const canonical = await fakeApi.performAction("/fake/repo", "revertCommit", { hash });
  const alias = await fakeApi.performAction("/fake/repo", "revert", { hash });
  assert.deepEqual(
    calls.filter((argv) => argv[0] === "revert"),
    [
      ["revert", "--no-edit", hash],
      ["revert", "--no-edit", hash],
    ],
  );
  assert.equal(canonical.message, alias.message);
  assert.match(canonical.message, /Reverted/);
});

test("detectRepo reports NOT_A_REPO for a plain directory", async () => {
  const detection = await api.detectRepo(fixture.empty);
  assert.equal(detection.isRepo, false);
  assert.equal(detection.error, "NOT_A_REPO");
  assert.equal(typeof detection.message, "string");
});

// ---------------------------------------------------------------------------
// Read-only git API against a real repository
// ---------------------------------------------------------------------------

test("readGraph returns the contract graph value", async () => {
  const graph = await api.readGraph(fixture.repo, { maxCommits: 50 });
  assert.equal(graph.isRepo, true);
  assert.equal(graph.error, undefined);
  assert.equal(graph.repoPath, fs.realpathSync(fixture.repo));
  assert.equal(graph.workspacePath, fixture.repo);
  assert.equal(graph.head.branch, "main");
  assert.equal(graph.head.hash, fixture.commits.head);
  assert.equal(graph.head.detached, false);
  assert.deepEqual(graph.status, { branch: "main", detached: false, dirty: 0 });
  assert.equal(graph.truncated, false);
  assert.equal(Number.isSafeInteger(graph.generatedAt), true);
  assert.ok(graph.commits.length >= 9);
  assert.equal(graph.commits[0].hash, fixture.commits.head);

  const commit = graph.commits[0];
  assert.equal(commit.abbrev, fixture.commits.head.slice(0, 7));
  assert.deepEqual(commit.parents, [fixture.commits.deleted]);
  assert.equal(commit.authorName, "Graph Test");
  assert.equal(commit.authorEmail, "graph@example.com");
  assert.equal(Number.isSafeInteger(commit.authorTime), true);
  assert.equal(commit.committerName, "Graph Test");
  assert.equal(commit.committerEmail, "graph@example.com");
  assert.equal(Number.isSafeInteger(commit.committerTime), true);
  assert.equal(commit.subject, "Add large file");
  assert.ok(commit.refs.includes("HEAD"));
  assert.ok(commit.refs.includes("main"));

  const tagRef = graph.refs.find((ref) => ref.name === "refs/tags/v1.0");
  assert.equal(tagRef.type, "tag");
  assert.equal(tagRef.shortName, "v1.0");
  const mainRef = graph.refs.find((ref) => ref.name === "refs/heads/main");
  assert.equal(mainRef.type, "branch");
  assert.equal(mainRef.head, true);
  assert.equal(mainRef.upstream, "origin/main");
  const remoteRefs = graph.refs.filter((ref) => ref.type === "remote");
  assert.ok(remoteRefs.some((ref) => ref.shortName === "origin/main"));
});

test("readGraph pages the log and reports truncation", async () => {
  const graph = await api.readGraph(fixture.repo, { maxCommits: 2 });
  assert.equal(graph.commits.length, 2);
  assert.equal(graph.truncated, true);
  const full = await api.readGraph(fixture.repo, { maxCommits: 100 });
  assert.equal(full.truncated, false);
});

test("readGraph honors showRemoteBranches and reports dirty files", async () => {
  const withoutRemotes = await api.readGraph(fixture.repo, { maxCommits: 50, showRemoteBranches: false });
  assert.equal(withoutRemotes.refs.some((ref) => ref.type === "remote"), false);

  const dirtyFile = path.join(fixture.repo, "dirty.txt");
  writeFile(dirtyFile, "dirty\n");
  try {
    const dirty = await api.readGraph(fixture.repo, { maxCommits: 5 });
    assert.equal(dirty.status.dirty, 1);
  } finally {
    fs.rmSync(dirtyFile, { force: true });
  }
  const clean = await api.readGraph(fixture.repo, { maxCommits: 5 });
  assert.equal(clean.status.dirty, 0);
});

test("readGraph outside a repository is a successful NOT_A_REPO value", async () => {
  const graph = await api.readGraph(fixture.empty, { maxCommits: 5 });
  assert.equal(graph.isRepo, false);
  assert.equal(graph.error, "NOT_A_REPO");
  assert.deepEqual(graph.commits, []);
  assert.deepEqual(graph.refs, []);
  assert.equal(graph.truncated, false);
});

test("readGraph survives an initialized repository without commits", async () => {
  const graph = await api.readGraph(fixture.emptyRepo, { maxCommits: 5 });
  assert.equal(graph.isRepo, true);
  assert.equal(graph.head.branch, "main");
  assert.equal(graph.head.hash, null);
  assert.equal(graph.head.detached, false);
  assert.deepEqual(graph.commits, []);
  assert.deepEqual(graph.refs, []);
  assert.equal(graph.truncated, false);
  const branches = await api.listBranches(fixture.emptyRepo);
  assert.deepEqual(branches, { isRepo: true, current: "main", detached: false, branches: [] });
});

test("readCommit returns metadata, stats and status-letter file entries", async () => {
  const detail = await api.readCommit(fixture.repo, fixture.commits.second);
  assert.equal(detail.hash, fixture.commits.second);
  assert.equal(detail.abbrev, fixture.commits.second.slice(0, 7));
  assert.equal(detail.subject, "Add notes and extend a");
  assert.match(detail.body, /Extended src\/a\.txt/);
  assert.deepEqual(detail.parents, [fixture.commits.root]);
  assert.deepEqual(detail.refs, ["tag: v1.0"]);
  assert.deepEqual(detail.stats, { files: 2, insertions: 2, deletions: 0 });
  const modified = detail.files.find((file) => file.path === "src/a.txt");
  assert.deepEqual(modified, { status: "M", path: "src/a.txt", oldPath: null, added: 1, removed: 0, binary: false });
  const added = detail.files.find((file) => file.path === "notes.txt");
  assert.equal(added.status, "A");
  assert.equal(added.added, 1);
});

test("readCommit handles root, rename, deletion and binary commits", async () => {
  const root = await api.readCommit(fixture.repo, fixture.commits.root);
  assert.deepEqual(root.parents, []);
  assert.deepEqual(root.stats, { files: 2, insertions: 3, deletions: 0 });
  assert.deepEqual(
    root.files.map((file) => [file.status, file.path]),
    [
      ["A", "README.md"],
      ["A", "src/a.txt"],
    ],
  );

  const rename = await api.readCommit(fixture.repo, fixture.commits.rename);
  const renamed = rename.files.find((file) => file.status === "R");
  assert.equal(renamed.path, "src/renamed.txt");
  assert.equal(renamed.oldPath, "src/a.txt");

  const deleted = await api.readCommit(fixture.repo, fixture.commits.deleted);
  const removed = deleted.files.find((file) => file.status === "D");
  assert.equal(removed.path, "main.txt");
  assert.equal(removed.added, 0);
  assert.equal(removed.removed, 1);

  const binary = await api.readCommit(fixture.repo, fixture.commits.binary);
  const binaryFile = binary.files.find((file) => file.path === "docs/bin.dat");
  assert.equal(binaryFile.binary, true);
  assert.equal(binaryFile.added, 0);
});

test("readCommit and readDiff use the first parent for merge commits", async () => {
  const merge = await api.readCommit(fixture.repo, fixture.commits.merge);
  assert.deepEqual(merge.parents, [fixture.commits.main, fixture.commits.feature]);
  assert.ok(merge.files.length > 0, "a merge reports the files it introduced relative to its first parent");
  const feature = merge.files.find((file) => file.path === "feature.txt");
  assert.deepEqual(feature, { status: "A", path: "feature.txt", oldPath: null, added: 1, removed: 0, binary: false });
  assert.equal(merge.stats.files, merge.files.length);
  assert.ok(merge.stats.insertions >= 1);
  assert.equal(
    merge.stats.insertions,
    merge.files.reduce((total, file) => total + file.added, 0),
  );
  assert.equal(
    merge.stats.deletions,
    merge.files.reduce((total, file) => total + file.removed, 0),
  );

  const diff = await api.readDiff(fixture.repo, { hash: fixture.commits.merge, path: "feature.txt" });
  assert.equal(diff.binary, false);
  assert.equal(diff.truncated, false);
  assert.match(diff.patch, /^\+\+\+ b\/feature\.txt$/m);
  assert.match(diff.patch, /^\+feature$/m);

  /* The non-merge path is unchanged: a plain commit reports only its own change set. */
  const second = await api.readCommit(fixture.repo, fixture.commits.second);
  assert.equal(second.files.length, 2);
  assert.equal(second.stats.files, 2);
});

test("readCommit validates refs and surfaces git failures", async () => {
  await assert.rejects(api.readCommit(fixture.repo, "-n1"), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readCommit(fixture.repo, "a..b"), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readCommit(fixture.empty, fixture.commits.head), (error) => error.code === "NOT_A_REPO");
  await assert.rejects(api.readCommit(fixture.repo, "deadbeef".repeat(5)), (error) => error.code === "GIT_FAILED");
});

test("readDiff renders text, rename and binary patches and caps huge output", async () => {
  const text = await api.readDiff(fixture.repo, { hash: fixture.commits.second, path: "src/a.txt" });
  assert.equal(text.binary, false);
  assert.equal(text.truncated, false);
  assert.match(text.patch, /^diff --git a\/src\/a\.txt b\/src\/a\.txt/);
  assert.match(text.patch, /^\+three$/m);

  const rename = await api.readDiff(fixture.repo, { hash: fixture.commits.rename, path: "src/renamed.txt", oldPath: "src/a.txt" });
  assert.match(rename.patch, /^rename from src\/a\.txt$/m);
  assert.match(rename.patch, /^rename to src\/renamed\.txt$/m);

  const binary = await api.readDiff(fixture.repo, { hash: fixture.commits.binary, path: "docs/bin.dat" });
  assert.deepEqual(binary, { patch: "", truncated: false, binary: true });

  const large = await api.readDiff(fixture.repo, { hash: fixture.commits.large, path: "docs/large.txt" });
  assert.equal(large.binary, false);
  assert.equal(large.truncated, true);
  assert.ok(Buffer.byteLength(large.patch, "utf8") <= 300 * 1024);
  assert.match(large.patch, /^diff --git /);
});

test("readDiff validates its pathspec arguments", async () => {
  await assert.rejects(api.readDiff(fixture.repo, { hash: "", path: "a.txt" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(fixture.repo, { hash: fixture.commits.head, path: "" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(fixture.repo, { hash: fixture.commits.head, path: "-rf" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(fixture.empty, { hash: fixture.commits.head, path: "a.txt" }), (error) => error.code === "NOT_A_REPO");
});

test("listBranches returns current branch, hashes and upstream", async () => {
  const branches = await api.listBranches(fixture.repo);
  assert.equal(branches.isRepo, true);
  assert.equal(branches.current, "main");
  assert.equal(branches.detached, false);
  const main = branches.branches.find((branch) => branch.shortName === "main");
  assert.equal(main.current, true);
  assert.equal(main.hash, fixture.commits.head);
  assert.equal(main.upstream, "origin/main");
  assert.ok(branches.branches.some((branch) => branch.shortName === "feature"));
  const notRepo = await api.listBranches(fixture.empty);
  assert.equal(notRepo.isRepo, false);
  assert.equal(notRepo.error, "NOT_A_REPO");
  assert.deepEqual(notRepo.branches, []);
});

// ---------------------------------------------------------------------------
// Plugin loadability and route registration
// ---------------------------------------------------------------------------

test("apply is defensive: no services, no config, repeated application", () => {
  assert.equal(pluginName, "dsh-git-graph");
  assert.doesNotThrow(() => apply({ ...createFakeContext({}).ctx }, undefined));
  assert.doesNotThrow(() => apply(createFakeContext({}).ctx, { repoPath: 7, maxCommits: "x", showRemoteBranches: "yes" }));
  const first = createHost({ config: undefined });
  const second = createHost({ config: undefined });
  assert.equal(first.routes.size, 16);
  assert.equal(second.routes.size, 16);
  first.dispose();
  assert.equal(first.routes.size, 0, "route disposers unregister the routes");
});

test("normalizeConfig reads raw values defensively", () => {
  assert.deepEqual(normalizeConfig(undefined), { repoPath: "", maxCommits: 400, showRemoteBranches: true });
  assert.deepEqual(normalizeConfig({}), { repoPath: "", maxCommits: 400, showRemoteBranches: true });
  assert.deepEqual(normalizeConfig({ repoPath: "  ", maxCommits: -5, showRemoteBranches: false }), {
    repoPath: "",
    maxCommits: 400,
    showRemoteBranches: false,
  });
  assert.deepEqual(normalizeConfig({ repoPath: "/srv/repo", maxCommits: 25 }), { repoPath: "/srv/repo", maxCommits: 25, showRemoteBranches: true });
  assert.equal(normalizeConfig({ maxCommits: 999_999 }).maxCommits, 2000);
  assert.equal(normalizeConfig({ maxCommits: 12.5 }).maxCommits, 400);
  assert.equal(normalizeConfig({ maxCommits: "10" }).maxCommits, 400);
});

test("apply registers exactly the sixteen POST Fetch routes", () => {
  const routes = [...host.routes.keys()].sort();
  assert.deepEqual(
    routes,
    [ACTION_PATH, ARCHIVE_PATH, COMMIT_PATH, COMPARE_PATH, CONTAINS_PATH, DIFF_PATH, GRAPH_PATH, PR_PATH, REMOTES_PATH, REPOCONFIG_PATH, REPOS_PATH, REVIEW_PATH, SEARCH_PATH, STASHES_PATH, TAG_PATH, UNCOMMITTED_PATH].sort(),
  );
  for (const route of host.routes.values()) {
    assert.deepEqual(route.methods, ["POST"]);
    assert.equal(route.requestBody, "buffered");
    assert.equal(typeof route.fetch, "function");
    assert.equal(route.path.startsWith("/api/dsh-git-graph/"), true);
  }
  assert.equal(host.tools.length, 1);
});

test("exposes no service when connection/tools are missing", () => {
  const noConnection = createHost({ includeConnection: false });
  assert.equal(noConnection.routes.size, 0);
  assert.equal(noConnection.tools.length, 1);
  const noTools = createHost({ includeTools: false });
  assert.equal(noTools.routes.size, 16);
  assert.equal(noTools.tools.length, 0);
});

// ---------------------------------------------------------------------------
// Fetch routes
// ---------------------------------------------------------------------------

test("graph route answers with the repo graph and resolved workspace", async () => {
  const envelope = await post(host, GRAPH_PATH, {});
  assert.equal(envelope.ok, true);
  assert.equal(envelope.value.isRepo, true);
  assert.equal(envelope.value.repoPath, fs.realpathSync(fixture.repo));
  assert.equal(envelope.value.workspacePath, fixture.repo);
  assert.equal(envelope.value.head.branch, "main");
  assert.equal(envelope.error, undefined);
});

test("graph route resolves session cwd, relative paths and repoPath override", async () => {
  const viaSession = createHost({ config: undefined, defaultDirectory: fixture.empty });
  viaSession.sessions.set("session-1", { header: { cwd: fixture.repo } });
  const sessionEnvelope = await post(viaSession, GRAPH_PATH, { sessionId: "session-1" });
  assert.equal(sessionEnvelope.ok, true);
  assert.equal(sessionEnvelope.value.isRepo, true);
  assert.equal(sessionEnvelope.value.workspacePath, fixture.repo);
  viaSession.dispose();

  const viaRelative = createHost({ config: undefined, defaultDirectory: fixture.root });
  const relativeEnvelope = await post(viaRelative, GRAPH_PATH, { path: "repo" });
  assert.equal(relativeEnvelope.ok, true);
  assert.equal(relativeEnvelope.value.isRepo, true);
  assert.equal(relativeEnvelope.value.workspacePath, fixture.root);
  viaRelative.dispose();

  const viaConfig = createHost({ config: { repoPath: fixture.repo }, defaultDirectory: fixture.empty });
  const configEnvelope = await post(viaConfig, GRAPH_PATH, { path: fixture.empty });
  assert.equal(configEnvelope.ok, true);
  assert.equal(configEnvelope.value.isRepo, true, "repoPath overrides the requested path");
  assert.equal(configEnvelope.value.repoPath, fs.realpathSync(fixture.repo));
  viaConfig.dispose();

  const unknownSession = createHost({ config: undefined, defaultDirectory: fixture.repo });
  const unknownEnvelope = await post(unknownSession, GRAPH_PATH, { sessionId: "missing" });
  assert.equal(unknownEnvelope.ok, true);
  assert.equal(unknownEnvelope.value.isRepo, true);
  unknownSession.dispose();
});

test("graph route honors limit and empty/malformed bodies", async () => {
  const limited = await post(host, GRAPH_PATH, { limit: 2 });
  assert.equal(limited.ok, true);
  assert.equal(limited.value.commits.length, 2);
  assert.equal(limited.value.truncated, true);

  const empty = await postEmpty(host, GRAPH_PATH);
  assert.equal(empty.ok, true);
  assert.equal(empty.value.isRepo, true);

  const malformed = await post(host, GRAPH_PATH, undefined, { rawBody: "{not json" });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.code, "BAD_REQUEST");

  const notAnObject = await post(host, GRAPH_PATH, undefined, { rawBody: "[1,2,3]" });
  assert.equal(notAnObject.ok, false);
  assert.equal(notAnObject.error.code, "BAD_REQUEST");
});

test("graph route reports NOT_A_REPO as a successful value", async () => {
  const outside = createHost({ config: undefined, defaultDirectory: fixture.empty });
  const envelope = await post(outside, GRAPH_PATH, {});
  assert.equal(envelope.ok, true);
  assert.equal(envelope.value.isRepo, false);
  assert.equal(envelope.value.error, "NOT_A_REPO");
  assert.equal(envelope.value.workspacePath, fixture.empty);
  outside.dispose();
});

test("commit route returns detail, BAD_REQUEST and NOT_A_REPO envelopes", async () => {
  const ok = await post(host, COMMIT_PATH, { hash: fixture.commits.rename });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.hash, fixture.commits.rename);
  assert.equal(ok.value.files.some((file) => file.status === "R" && file.oldPath === "src/a.txt"), true);

  const missing = await post(host, COMMIT_PATH, {});
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, "BAD_REQUEST");

  const badRef = await post(host, COMMIT_PATH, { hash: "x; rm -rf /" });
  assert.equal(badRef.ok, false);
  assert.equal(badRef.error.code, "BAD_REQUEST");

  const unknown = await post(host, COMMIT_PATH, { hash: "deadbeef".repeat(5) });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.code, "GIT_FAILED");

  const outside = createHost({ config: undefined, defaultDirectory: fixture.empty });
  const notRepo = await post(outside, COMMIT_PATH, { hash: fixture.commits.head });
  assert.equal(notRepo.ok, false);
  assert.equal(notRepo.error.code, "NOT_A_REPO");
  outside.dispose();
});

test("diff route returns patches and validates arguments", async () => {
  const ok = await post(host, DIFF_PATH, { hash: fixture.commits.second, file: "src/a.txt" });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.binary, false);
  assert.equal(ok.value.truncated, false);
  assert.match(ok.value.patch, /^\+three$/m);

  const rename = await post(host, DIFF_PATH, { hash: fixture.commits.rename, file: "src/renamed.txt", oldPath: "src/a.txt" });
  assert.equal(rename.ok, true);
  assert.match(rename.value.patch, /^rename from src\/a\.txt$/m);

  const missingFile = await post(host, DIFF_PATH, { hash: fixture.commits.second });
  assert.equal(missingFile.ok, false);
  assert.equal(missingFile.error.code, "BAD_REQUEST");

  const badFile = await post(host, DIFF_PATH, { hash: fixture.commits.second, file: "--upload-pack=evil" });
  assert.equal(badFile.ok, false);
  assert.equal(badFile.error.code, "BAD_REQUEST");
});

test("action route performs a tag round trip and reports errors", async () => {
  const created = await post(host, ACTION_PATH, { action: "createTag", name: "route-tag", hash: fixture.commits.head });
  assert.equal(created.ok, true);
  assert.equal(typeof created.value.message, "string");
  assert.equal(typeof created.value.output, "string");
  assert.equal(runGit(["tag", "--list", "route-tag"], fixture.repo).trim(), "route-tag");

  const deleted = await post(host, ACTION_PATH, { action: "deleteTag", name: "route-tag" });
  assert.equal(deleted.ok, true);
  assert.equal(runGit(["tag", "--list", "route-tag"], fixture.repo).trim(), "");

  const duplicate = await post(host, ACTION_PATH, { action: "createTag", name: "v1.0", hash: fixture.commits.head });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "GIT_FAILED");
  assert.match(duplicate.error.message, /already exists/);

  const missingAction = await post(host, ACTION_PATH, {});
  assert.equal(missingAction.ok, false);
  assert.equal(missingAction.error.code, "BAD_REQUEST");

  const unknownAction = await post(host, ACTION_PATH, { action: "explode" });
  assert.equal(unknownAction.ok, false);
  assert.equal(unknownAction.error.code, "BAD_REQUEST");

  const missingBranch = await post(host, ACTION_PATH, { action: "checkoutBranch" });
  assert.equal(missingBranch.ok, false);
  assert.equal(missingBranch.error.code, "BAD_REQUEST");

  const injectedBranch = await post(host, ACTION_PATH, { action: "checkoutBranch", branch: "-f" });
  assert.equal(injectedBranch.ok, false);
  assert.equal(injectedBranch.error.code, "BAD_REQUEST");
});

// ---------------------------------------------------------------------------
// git_graph tool
// ---------------------------------------------------------------------------

test("git_graph tool definition matches the contract schema", () => {
  const tool = host.tools[0];
  assert.equal(tool.name, "git_graph");
  assert.equal(typeof tool.description, "string");
  assert.match(tool.description, /Git/);
  assert.match(tool.description, /read-only/i);
  assert.deepEqual(tool.parameters, {
    type: "object",
    properties: {
      action: { type: "string", enum: ["log", "show", "diff", "branches", "status"] },
      commit: { type: "string" },
      file: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 500 },
    },
    required: ["action"],
    additionalProperties: false,
  });
  assert.deepEqual(tool.output.schema, { type: "object", additionalProperties: true });
  assert.equal(typeof tool.output.render, "function");
  assert.equal(typeof tool.execute, "function");
});

test("git_graph log/status/branches share the route git API and render text", async () => {
  const tool = host.tools[0];
  const session = { header: { cwd: fixture.repo } };
  const exec = { agent: { session } };

  const log = await tool.execute({ action: "log", limit: 5 }, exec);
  assert.equal(log.action, "log");
  assert.equal(log.isRepo, true);
  assert.equal(log.repoPath, fs.realpathSync(fixture.repo));
  assert.equal(log.commits.length, 5);
  const logText = tool.output.render({ action: "log" }, log);
  assert.ok(Array.isArray(logText));
  assert.equal(logText[0].type, "text");
  assert.match(logText[0].text, /Branch: main/);
  assert.match(logText[0].text, /Add large file/);

  const status = await tool.execute({ action: "status" }, exec);
  assert.equal(status.action, "status");
  assert.equal(status.status.branch, "main");
  assert.equal(status.status.dirty, 0);
  assert.match(tool.output.render({ action: "status" }, status)[0].text, /Working tree: clean/);

  const branches = await tool.execute({ action: "branches" }, exec);
  assert.equal(branches.action, "branches");
  assert.equal(branches.current, "main");
  const branchesText = tool.output.render({ action: "branches" }, branches)[0].text;
  assert.match(branchesText, /Current: main/);
  assert.match(branchesText, /feature/);
});

test("git_graph show and diff return contract values and human summaries", async () => {
  const tool = host.tools[0];
  const exec = { agent: { session: { header: { cwd: fixture.repo } } } };

  const show = await tool.execute({ action: "show", commit: fixture.commits.rename }, exec);
  assert.equal(show.action, "show");
  assert.equal(show.hash, fixture.commits.rename);
  assert.equal(show.files.some((file) => file.status === "R"), true);
  const showText = tool.output.render({ action: "show" }, show)[0].text;
  assert.match(showText, /commit /);
  assert.match(showText, /R src\/renamed\.txt \(from src\/a\.txt\)/);

  const diff = await tool.execute({ action: "diff", commit: fixture.commits.second, file: "src/a.txt" }, exec);
  assert.equal(diff.action, "diff");
  assert.match(diff.patch, /^\+three$/m);
  const diffText = tool.output.render({ action: "diff" }, diff)[0].text;
  assert.match(diffText, /diff --git/);

  const binaryDiff = await tool.execute({ action: "diff", commit: fixture.commits.binary, file: "docs/bin.dat" }, exec);
  assert.match(tool.output.render({ action: "diff" }, binaryDiff)[0].text, /binary file/);
});

test("git_graph is read-only and throws clear errors", async () => {
  const tool = host.tools[0];
  const exec = { agent: { session: { header: { cwd: fixture.repo } } } };
  const beforeHead = runGit(["rev-parse", "HEAD"], fixture.repo).trim();
  const beforeStatus = runGit(["status", "--porcelain=v1", "-z"], fixture.repo);

  await tool.execute({ action: "log", limit: 3 }, exec);
  await tool.execute({ action: "show", commit: beforeHead }, exec);
  await tool.execute({ action: "diff", commit: beforeHead, file: "docs/large.txt" }, exec);
  await tool.execute({ action: "branches" }, exec);
  await tool.execute({ action: "status" }, exec);

  assert.equal(runGit(["rev-parse", "HEAD"], fixture.repo).trim(), beforeHead);
  assert.equal(runGit(["status", "--porcelain=v1", "-z"], fixture.repo), beforeStatus);

  await assert.rejects(tool.execute({ action: "show" }, exec), /requires a `commit`/);
  await assert.rejects(tool.execute({ action: "diff", commit: beforeHead }, exec), /requires a `file`/);
  await assert.rejects(tool.execute({ action: "explode" }, exec), /unknown git_graph action/);

  const outside = createHost({ config: undefined, defaultDirectory: fixture.empty });
  await assert.rejects(outside.tools[0].execute({ action: "log" }, { agent: { session: { header: { cwd: fixture.empty } } } }), /not a Git repository/);
  outside.dispose();
});

// ---------------------------------------------------------------------------
// Mutating actions (ordered last so the read-only expectations above stay stable)
// ---------------------------------------------------------------------------

test("performAction covers branches, checkout and tags", async () => {
  const feature = await api.performAction(fixture.repo, "createBranch", { name: "action-branch", startPoint: fixture.commits.head });
  assert.match(feature.message, /Created branch "action-branch"/);
  assert.equal(runGit(["branch", "--list", "action-branch"], fixture.repo).trim().length > 0, true);

  const checkout = await api.performAction(fixture.repo, "checkoutBranch", { branch: "action-branch" });
  assert.match(checkout.message, /Checked out branch "action-branch"/);
  assert.equal(runGit(["rev-parse", "--abbrev-ref", "HEAD"], fixture.repo).trim(), "action-branch");

  const back = await api.performAction(fixture.repo, "checkoutBranch", { branch: "main" });
  assert.match(back.message, /Checked out branch "main"/);
  assert.equal(runGit(["rev-parse", "--abbrev-ref", "HEAD"], fixture.repo).trim(), "main");

  const deleted = await api.performAction(fixture.repo, "deleteBranch", { name: "action-branch" });
  assert.match(deleted.message, /Deleted branch "action-branch"/);
  assert.equal(runGit(["branch", "--list", "action-branch"], fixture.repo).trim(), "");

  const detached = await api.performAction(fixture.repo, "checkoutCommit", { hash: fixture.commits.head });
  assert.match(detached.message, /detached HEAD/);
  assert.equal(runGit(["rev-parse", "--abbrev-ref", "HEAD"], fixture.repo).trim(), "HEAD");
  const detachedGraph = await api.readGraph(fixture.repo, { maxCommits: 2 });
  assert.equal(detachedGraph.head.detached, true);
  assert.equal(detachedGraph.head.branch, null);
  assert.equal(detachedGraph.head.hash, fixture.commits.head);
  await api.performAction(fixture.repo, "checkoutBranch", { branch: "main" });

  const tag = await api.performAction(fixture.repo, "createTag", { name: "action-tag", hash: fixture.commits.second });
  assert.match(tag.message, /Created tag "action-tag"/);
  assert.equal(runGit(["tag", "--list", "action-tag"], fixture.repo).trim(), "action-tag");
  const tagDelete = await api.performAction(fixture.repo, "deleteTag", { name: "action-tag" });
  assert.match(tagDelete.message, /Deleted tag "action-tag"/);
});

test("performAction covers cherry-pick, revert, force delete and fetch", async () => {
  runGit(["switch", "-q", "-c", "cherry-src", "main"], fixture.repo);
  writeFile(path.join(fixture.repo, "cherry.txt"), "cherry\n");
  const cherryHash = commitAll(fixture.repo, "Cherry work");
  runGit(["switch", "-q", "main"], fixture.repo);

  const picked = await api.performAction(fixture.repo, "cherryPick", { hash: cherryHash });
  assert.match(picked.message, /Cherry-picked/);
  assert.equal(runGit(["log", "-1", "--format=%s"], fixture.repo).trim(), "Cherry work");
  const pickedHash = runGit(["rev-parse", "HEAD"], fixture.repo).trim();

  const reverted = await api.performAction(fixture.repo, "revertCommit", { hash: pickedHash });
  assert.match(reverted.message, /Reverted/);
  assert.match(runGit(["log", "-1", "--format=%s"], fixture.repo), /^Revert /);
  const revertHash = runGit(["rev-parse", "HEAD"], fixture.repo).trim();
  /* The Web client names the action `revert`; the host accepts both spellings. */
  const reReverted = await api.performAction(fixture.repo, "revert", { hash: revertHash });
  assert.match(reReverted.message, /Reverted/);
  assert.match(runGit(["log", "-1", "--format=%s"], fixture.repo), /^(Revert|Reapply) /);

  await assert.rejects(api.performAction(fixture.repo, "deleteBranch", { name: "cherry-src" }), (error) => error.code === "GIT_FAILED");
  const forced = await api.performAction(fixture.repo, "deleteBranch", { name: "cherry-src", force: true });
  assert.match(forced.message, /Deleted branch "cherry-src"/);
  assert.equal(runGit(["branch", "--list", "cherry-src"], fixture.repo).trim(), "");

  const fetched = await api.performAction(fixture.repo, "fetch", { remote: "origin" });
  assert.match(fetched.message, /Fetched from "origin"/);
  const fetchedAll = await api.performAction(fixture.repo, "fetch", {});
  assert.match(fetchedAll.message, /all remotes/);
});

test("performAction rejects unknown actions, missing args and unsafe refs", async () => {
  const cases = [
    ["explode", {}],
    ["checkoutBranch", {}],
    ["checkoutBranch", { branch: "-f" }],
    ["checkoutBranch", { branch: "a..b" }],
    ["checkoutBranch", { branch: "bad@{1}" }],
    ["checkoutBranch", { branch: "a b" }],
    ["checkoutCommit", { hash: "x; touch /tmp/pwned" }],
    ["createBranch", { name: "ok-name" }],
    ["createBranch", { name: "bad.lock", startPoint: "main" }],
    ["createTag", { name: "ok-tag" }],
    ["deleteTag", {}],
    ["fetch", { remote: "--upload-pack=evil" }],
  ];
  for (const [action, args] of cases) {
    await assert.rejects(api.performAction(fixture.repo, action, args), (error) => error.code === "BAD_REQUEST", `${action} ${JSON.stringify(args)}`);
  }
  await assert.rejects(api.performAction(fixture.empty, "fetch", {}), (error) => error.code === "NOT_A_REPO");
  await assert.rejects(api.performAction(fixture.repo, "", {}), (error) => error.code === "BAD_REQUEST");
});

// ── TODO-2: a failed action carries git's own output for the UI disclosure ────

test("action route forwards git stderr as `output` on a failed action", async () => {
  // Isolate this case: later assertions read the branch list, so start from a
  // branch that only exists here.
  // Deleting an unmerged branch is refused by git: the envelope must keep the
  // summary in `message` AND the raw stderr in `output`, which the client shows
  // behind its "show output" disclosure.
  runGit(["branch", "unmerged-topic", fixture.commits.root], fixture.repo);
  writeFile(path.join(fixture.repo, "topic-only.txt"), "topic\n");
  runGit(["checkout", "-q", "unmerged-topic"], fixture.repo);
  runGit(["add", "-A"], fixture.repo);
  runGit(["commit", "-q", "-m", "topic commit"], fixture.repo);
  runGit(["switch", "-q", "main"], fixture.repo);

  const refused = await post(host, ACTION_PATH, { action: "deleteBranch", name: "unmerged-topic" });
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, "GIT_FAILED");
  assert.match(refused.error.message, /not fully merged/);
  assert.equal(typeof refused.error.output, "string");
  assert.match(refused.error.output, /not fully merged/);

  // A successful action keeps `output` as a (possibly empty) string, not an error.
  const succeeded = await post(host, ACTION_PATH, { action: "deleteBranch", name: "unmerged-topic", force: true });
  assert.equal(succeeded.ok, true);
  assert.equal(typeof succeeded.value.output, "string");
  assert.equal(runGit(["branch", "--list", "unmerged-topic"], fixture.repo).trim(), "");
});

test("BAD_REQUEST failures carry no git output", async () => {
  const bad = await post(host, ACTION_PATH, { action: "deleteBranch" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, "BAD_REQUEST");
  assert.equal(bad.error.output, undefined);
});

// ---------------------------------------------------------------------------
// Wave 2: uncommitted state, diff scopes and commit comparison
// ---------------------------------------------------------------------------

test("readUncommitted splits staged, unstaged and untracked entries", async () => {
  const dir = createScratchRepo("uncommitted-state");
  writeFile(path.join(dir, "keep.txt"), "keep\n");
  writeFile(path.join(dir, "keep-deleted.txt"), "keep deleted\n");
  writeFile(path.join(dir, "del-staged.txt"), "delete me\n");
  writeFile(path.join(dir, "rename-me.txt"), "rename me\n");
  writeFile(path.join(dir, "mm.txt"), "mm\n");
  const base = commitAll(dir, "base");

  // staged only
  writeFile(path.join(dir, "staged-only.txt"), "staged\n");
  runGit(["add", "staged-only.txt"], dir);
  // unstaged modification
  writeFile(path.join(dir, "keep.txt"), "keep changed\n");
  // unstaged deletion
  fs.rmSync(path.join(dir, "keep-deleted.txt"));
  // untracked
  writeFile(path.join(dir, "untracked.md"), "untracked\n");
  // staged, then modified again: one record in BOTH buckets, each with its own letter
  writeFile(path.join(dir, "both.txt"), "both staged\n");
  runGit(["add", "both.txt"], dir);
  writeFile(path.join(dir, "both.txt"), "both staged and changed\n");
  // tracked file modified, staged, then modified again: `MM` (M staged AND M unstaged)
  writeFile(path.join(dir, "mm.txt"), "mm staged\n");
  runGit(["add", "mm.txt"], dir);
  writeFile(path.join(dir, "mm.txt"), "mm staged and changed\n");
  // staged rename and staged deletion
  runGit(["mv", "rename-me.txt", "renamed.txt"], dir);
  runGit(["rm", "-q", "del-staged.txt"], dir);

  const value = await api.readUncommitted(dir);
  assert.equal(value.isRepo, true);
  assert.equal(value.repoPath, fs.realpathSync(dir));
  assert.deepEqual(value.head, { branch: "main", hash: base, detached: false });

  const stagedByPath = new Map(value.staged.map((entry) => [entry.path, entry]));
  const unstagedByPath = new Map(value.unstaged.map((entry) => [entry.path, entry]));
  const untrackedByPath = new Map(value.untracked.map((entry) => [entry.path, entry]));

  assert.deepEqual(stagedByPath.get("staged-only.txt"), { status: "A", path: "staged-only.txt", oldPath: null });
  assert.deepEqual(stagedByPath.get("both.txt"), { status: "A", path: "both.txt", oldPath: null });
  assert.deepEqual(stagedByPath.get("renamed.txt"), { status: "R", path: "renamed.txt", oldPath: "rename-me.txt" });
  assert.deepEqual(stagedByPath.get("del-staged.txt"), { status: "D", path: "del-staged.txt", oldPath: null });
  assert.deepEqual(stagedByPath.get("mm.txt"), { status: "M", path: "mm.txt", oldPath: null });

  assert.deepEqual(unstagedByPath.get("keep.txt"), { status: "M", path: "keep.txt", oldPath: null });
  assert.deepEqual(unstagedByPath.get("keep-deleted.txt"), { status: "D", path: "keep-deleted.txt", oldPath: null });
  assert.deepEqual(unstagedByPath.get("both.txt"), { status: "M", path: "both.txt", oldPath: null });
  assert.deepEqual(unstagedByPath.get("mm.txt"), { status: "M", path: "mm.txt", oldPath: null });
  assert.equal(unstagedByPath.has("staged-only.txt"), false);

  assert.deepEqual(untrackedByPath.get("untracked.md"), { status: "A", path: "untracked.md", oldPath: null });

  assert.deepEqual(value.counts, { staged: 5, unstaged: 4, untracked: 1 });
  assert.equal(value.counts.staged, value.staged.length);
  assert.equal(value.counts.unstaged, value.unstaged.length);
  assert.equal(value.counts.untracked, value.untracked.length);
});

test("readUncommitted reports NOT_A_REPO and handles an unborn repository", async () => {
  const outside = await api.readUncommitted(fixture.empty);
  assert.equal(outside.isRepo, false);
  assert.equal(outside.error, "NOT_A_REPO");
  assert.equal(typeof outside.message, "string");
  assert.deepEqual([outside.staged, outside.unstaged, outside.untracked], [[], [], []]);
  assert.deepEqual(outside.counts, { staged: 0, unstaged: 0, untracked: 0 });

  const dir = createScratchRepo("uncommitted-unborn");
  writeFile(path.join(dir, "first.txt"), "first\n");
  runGit(["add", "first.txt"], dir);
  writeFile(path.join(dir, "loose.txt"), "loose\n");
  const value = await api.readUncommitted(dir);
  assert.equal(value.isRepo, true);
  assert.equal(value.head.branch, "main");
  assert.equal(value.head.hash, null);
  assert.deepEqual(value.staged, [{ status: "A", path: "first.txt", oldPath: null }]);
  assert.deepEqual(value.untracked, [{ status: "A", path: "loose.txt", oldPath: null }]);
  assert.deepEqual(value.counts, { staged: 1, unstaged: 0, untracked: 1 });
});

test("readDiff scopes produce different patches for the same path", async () => {
  const dir = createScratchRepo("diff-scopes");
  writeFile(path.join(dir, "scope.txt"), "one\ntwo\n");
  const base = commitAll(dir, "base");
  writeFile(path.join(dir, "scope.txt"), "one\ntwo\nthree\n");
  runGit(["add", "scope.txt"], dir);
  writeFile(path.join(dir, "scope.txt"), "one\ntwo\nthree\nfour\n");

  const staged = await api.readDiff(dir, { scope: "staged", path: "scope.txt" });
  const unstaged = await api.readDiff(dir, { scope: "unstaged", path: "scope.txt" });
  const committed = await api.readDiff(dir, { scope: "commit", hash: base, path: "scope.txt" });
  const defaulted = await api.readDiff(dir, { hash: base, path: "scope.txt" });

  assert.equal(staged.binary, false);
  assert.match(staged.patch, /^\+three$/m);
  assert.equal(staged.patch.includes("+four"), false);
  assert.match(unstaged.patch, /^\+four$/m);
  assert.equal(unstaged.patch.includes("+three"), false);
  assert.match(committed.patch, /^\+one$/m);
  assert.equal(committed.patch.includes("+three"), false);
  assert.notEqual(staged.patch, unstaged.patch);
  assert.equal(committed.patch, defaulted.patch, "an omitted scope keeps commit behavior");
});

test("readDiff compare scope diffs two commits and validates its endpoints", async () => {
  const dir = createScratchRepo("diff-compare");
  writeFile(path.join(dir, "move-me.txt"), "alpha\nbeta\ngamma\ndelta\nepsilon\n");
  writeFile(path.join(dir, "change.txt"), "a\n");
  const base = commitAll(dir, "base");
  runGit(["mv", "move-me.txt", "moved.txt"], dir);
  writeFile(path.join(dir, "change.txt"), "a\nb\n");
  const head = commitAll(dir, "head");

  const rename = await api.readDiff(dir, { scope: "compare", base, head, path: "moved.txt", oldPath: "move-me.txt" });
  assert.equal(rename.binary, false);
  assert.match(rename.patch, /^rename from move-me\.txt$/m);
  assert.match(rename.patch, /^rename to moved\.txt$/m);
  const change = await api.readDiff(dir, { scope: "compare", base, head, path: "change.txt" });
  assert.match(change.patch, /^\+b$/m);

  await assert.rejects(api.readDiff(dir, { scope: "bogus", path: "change.txt" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(dir, { scope: "compare", head, path: "change.txt" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(dir, { scope: "compare", base, path: "change.txt" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(dir, { scope: "compare", base: "-x", head, path: "change.txt" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(dir, { scope: "staged", path: "-x" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(dir, { path: "change.txt" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(fixture.empty, { scope: "unstaged", path: "x.txt" }), (error) => error.code === "NOT_A_REPO");
});

test("compareCommits reports tree-to-tree files, stats and abbreviations", async () => {
  const dir = createScratchRepo("compare-api");
  writeFile(path.join(dir, "a.txt"), "one\ntwo\n");
  writeFile(path.join(dir, "move-me.txt"), "alpha\nbeta\ngamma\ndelta\nepsilon\n");
  writeFile(path.join(dir, "bin.dat"), Buffer.from([0, 1, 2, 3]));
  writeFile(path.join(dir, "gone.txt"), "gone\n");
  const base = commitAll(dir, "base");
  writeFile(path.join(dir, "a.txt"), "one\ntwo\nthree\n");
  runGit(["mv", "move-me.txt", "moved.txt"], dir);
  writeFile(path.join(dir, "bin.dat"), Buffer.from([0, 9, 2, 3, 4]));
  runGit(["rm", "-q", "gone.txt"], dir);
  const head = commitAll(dir, "head");

  const value = await api.compareCommits(dir, { base, head });
  assert.equal(value.base, base);
  assert.equal(value.head, head);
  assert.equal(value.baseAbbrev, base.slice(0, 7));
  assert.equal(value.headAbbrev, head.slice(0, 7));
  assert.equal(value.stats.files, value.files.length);
  assert.equal(
    value.stats.insertions,
    value.files.reduce((total, file) => total + file.added, 0),
  );
  assert.equal(
    value.stats.deletions,
    value.files.reduce((total, file) => total + file.removed, 0),
  );

  const modified = value.files.find((file) => file.path === "a.txt");
  assert.deepEqual(modified, { status: "M", path: "a.txt", oldPath: null, added: 1, removed: 0, binary: false });
  const moved = value.files.find((file) => file.path === "moved.txt");
  assert.equal(moved.status, "R");
  assert.equal(moved.oldPath, "move-me.txt");
  const binary = value.files.find((file) => file.path === "bin.dat");
  assert.equal(binary.binary, true);
  assert.equal(binary.added, 0);
  assert.equal(binary.removed, 0);
  const deleted = value.files.find((file) => file.path === "gone.txt");
  assert.equal(deleted.status, "D");
  assert.equal(deleted.removed, 1);

  const identical = await api.compareCommits(dir, { base: head, head });
  assert.deepEqual(identical.files, []);
  assert.deepEqual(identical.stats, { files: 0, insertions: 0, deletions: 0 });
  assert.equal(identical.baseAbbrev, head.slice(0, 7));
  assert.equal(identical.headAbbrev, head.slice(0, 7));
});

test("compareCommits validates refs and reports git failures", async () => {
  const dir = createScratchRepo("compare-errors");
  writeFile(path.join(dir, "a.txt"), "a\n");
  const base = commitAll(dir, "base");

  await assert.rejects(api.compareCommits(dir, {}), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.compareCommits(dir, { base }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.compareCommits(dir, { head: base }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.compareCommits(dir, { base: "-rf", head: base }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.compareCommits(dir, { base, head: "a..b" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.compareCommits(dir, { base, head: "does-not-exist" }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.compareCommits(fixture.empty, { base, head: base }), (error) => error.code === "NOT_A_REPO");
});

test("uncommitted and compare routes return values and BAD_REQUEST envelopes", async () => {
  const dir = createScratchRepo("route-uncommitted");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  const base = commitAll(dir, "base");
  writeFile(path.join(dir, "other.txt"), "other\n");
  const head = commitAll(dir, "second");
  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\n");
  runGit(["add", "tracked.txt"], dir);
  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\nthree\n");
  writeFile(path.join(dir, "new.txt"), "new\n");

  const scratchHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const uncommitted = await post(scratchHost, UNCOMMITTED_PATH, {});
    assert.equal(uncommitted.ok, true);
    assert.equal(uncommitted.value.isRepo, true);
    assert.equal(uncommitted.value.repoPath, fs.realpathSync(dir));
    assert.equal(uncommitted.value.workspacePath, dir);
    assert.equal(uncommitted.value.head.hash, head);
    assert.deepEqual(uncommitted.value.staged, [{ status: "M", path: "tracked.txt", oldPath: null }]);
    assert.deepEqual(uncommitted.value.unstaged, [{ status: "M", path: "tracked.txt", oldPath: null }]);
    assert.deepEqual(uncommitted.value.untracked, [{ status: "A", path: "new.txt", oldPath: null }]);
    assert.deepEqual(uncommitted.value.counts, { staged: 1, unstaged: 1, untracked: 1 });

    const staged = await post(scratchHost, DIFF_PATH, { scope: "staged", file: "tracked.txt" });
    assert.equal(staged.ok, true);
    assert.match(staged.value.patch, /^\+two$/m);
    assert.equal(staged.value.patch.includes("+three"), false);
    const unstaged = await post(scratchHost, DIFF_PATH, { scope: "unstaged", file: "tracked.txt" });
    assert.equal(unstaged.ok, true);
    assert.match(unstaged.value.patch, /^\+three$/m);

    const missingHash = await post(scratchHost, DIFF_PATH, { file: "tracked.txt" });
    assert.equal(missingHash.ok, false);
    assert.equal(missingHash.error.code, "BAD_REQUEST");
    const badScope = await post(scratchHost, DIFF_PATH, { scope: "bogus", file: "tracked.txt" });
    assert.equal(badScope.ok, false);
    assert.equal(badScope.error.code, "BAD_REQUEST");
    const missingCompareEnd = await post(scratchHost, DIFF_PATH, { scope: "compare", base, file: "tracked.txt" });
    assert.equal(missingCompareEnd.ok, false);
    assert.equal(missingCompareEnd.error.code, "BAD_REQUEST");

    const compare = await post(scratchHost, COMPARE_PATH, { base, head });
    assert.equal(compare.ok, true);
    assert.equal(compare.value.baseAbbrev, base.slice(0, 7));
    assert.equal(compare.value.headAbbrev, head.slice(0, 7));
    assert.deepEqual(compare.value.files, [{ status: "A", path: "other.txt", oldPath: null, added: 1, removed: 0, binary: false }]);
    assert.deepEqual(compare.value.stats, { files: 1, insertions: 1, deletions: 0 });

    const compareMissing = await post(scratchHost, COMPARE_PATH, { base });
    assert.equal(compareMissing.ok, false);
    assert.equal(compareMissing.error.code, "BAD_REQUEST");
    const compareUnsafe = await post(scratchHost, COMPARE_PATH, { base: "-rf", head });
    assert.equal(compareUnsafe.ok, false);
    assert.equal(compareUnsafe.error.code, "BAD_REQUEST");
    const compareUnknown = await post(scratchHost, COMPARE_PATH, { base, head: "missing-ref" });
    assert.equal(compareUnknown.ok, false);
    assert.equal(compareUnknown.error.code, "GIT_FAILED");
    assert.equal(typeof compareUnknown.error.message, "string");

    const outside = createHost({ config: undefined, defaultDirectory: fixture.empty });
    try {
      const notRepo = await post(outside, UNCOMMITTED_PATH, {});
      assert.equal(notRepo.ok, true);
      assert.equal(notRepo.value.isRepo, false);
      assert.equal(notRepo.value.error, "NOT_A_REPO");
    } finally {
      outside.dispose();
    }
  } finally {
    scratchHost.dispose();
  }
});

test("git_graph still exposes exactly five read-only actions and never mutates", async () => {
  const tool = host.tools[0];
  assert.equal(tool.name, "git_graph");
  assert.deepEqual(tool.parameters.properties.action.enum, ["log", "show", "diff", "branches", "status"]);
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ["action", "commit", "file", "limit"]);
  assert.equal("scope" in tool.parameters.properties, false);
  assert.equal("base" in tool.parameters.properties, false);
  assert.equal("head" in tool.parameters.properties, false);
  assert.deepEqual(tool.parameters.required, ["action"]);
  assert.equal(tool.parameters.additionalProperties, false);

  const beforeHead = runGit(["rev-parse", "HEAD"], fixture.repo).trim();
  const beforeStatus = runGit(["status", "--porcelain=v1", "-z"], fixture.repo);
  const exec = { agent: { session: { header: { cwd: fixture.repo } } } };
  await tool.execute({ action: "log", limit: 3 }, exec);
  await tool.execute({ action: "show", commit: beforeHead }, exec);
  await tool.execute({ action: "diff", commit: beforeHead, file: "docs/large.txt" }, exec);
  await tool.execute({ action: "branches" }, exec);
  await tool.execute({ action: "status" }, exec);
  assert.equal(runGit(["rev-parse", "HEAD"], fixture.repo).trim(), beforeHead);
  assert.equal(runGit(["status", "--porcelain=v1", "-z"], fixture.repo), beforeStatus);
});

// ---------------------------------------------------------------------------
// Wave 3: renameBranch action and graph branch/order filters
// ---------------------------------------------------------------------------

test("performAction renameBranch renames a local branch and the route forwards it", async () => {
  const dir = createScratchRepo("rename-branch");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");
  runGit(["branch", "old-name"], dir);

  const renamed = await api.performAction(dir, "renameBranch", { name: "old-name", newName: "new-name" });
  assert.equal(renamed.message, 'Renamed branch "old-name" to "new-name".');
  assert.equal(typeof renamed.output, "string");
  const branchList = runGit(["branch", "--list"], dir);
  assert.match(branchList, /new-name/);
  assert.equal(branchList.includes("old-name"), false);

  const routeHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const viaRoute = await post(routeHost, ACTION_PATH, { action: "renameBranch", name: "new-name", newName: "route-name" });
    assert.equal(viaRoute.ok, true);
    assert.equal(viaRoute.value.message, 'Renamed branch "new-name" to "route-name".');
    assert.match(runGit(["branch", "--list"], dir), /route-name/);
  } finally {
    routeHost.dispose();
  }
});

test("renameBranch validates both names and reports a collision as GIT_FAILED", async () => {
  const dir = createScratchRepo("rename-branch-errors");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");
  runGit(["branch", "source"], dir);
  runGit(["branch", "taken"], dir);

  const badRequests = [
    {},
    { name: "source" },
    { newName: "only-new" },
    { name: "-bad", newName: "fine" },
    { name: "source", newName: "bad name" },
    { name: "source", newName: "a..b" },
    { name: "source", newName: "bad@{1}" },
    { name: "source", newName: "x.lock" },
    { name: "source", newName: "trailing/" },
    { name: "source", newName: 42 },
  ];
  for (const args of badRequests) {
    await assert.rejects(api.performAction(dir, "renameBranch", args), (error) => error.code === "BAD_REQUEST", JSON.stringify(args));
  }
  await assert.rejects(api.performAction(dir, "renameBranch", { name: "source", newName: "taken" }), (error) => error.code === "GIT_FAILED");

  const routeHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const missing = await post(routeHost, ACTION_PATH, { action: "renameBranch", name: "source" });
    assert.equal(missing.ok, false);
    assert.equal(missing.error.code, "BAD_REQUEST");
    const unsafe = await post(routeHost, ACTION_PATH, { action: "renameBranch", name: "source", newName: "-x" });
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.error.code, "BAD_REQUEST");
    const collision = await post(routeHost, ACTION_PATH, { action: "renameBranch", name: "source", newName: "taken" });
    assert.equal(collision.ok, false);
    assert.equal(collision.error.code, "GIT_FAILED");
    assert.equal(typeof collision.error.output, "string");
  } finally {
    routeHost.dispose();
  }
});

test("readGraph branches filter restricts the walk and omitted/[] equal the default", async () => {
  const dir = createScratchRepo("graph-branches");
  writeFile(path.join(dir, "root.txt"), "root\n");
  commitAll(dir, "root");
  runGit(["switch", "-q", "-c", "feature"], dir);
  writeFile(path.join(dir, "feature.txt"), "feature\n");
  commitAll(dir, "feature only");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "main.txt"), "main\n");
  commitAll(dir, "main only");
  runGit(["tag", "v1"], dir);

  const strip = (value) => ({ ...value, generatedAt: 0 });
  const full = await api.readGraph(dir, { maxCommits: 50 });
  const explicitEmpty = await api.readGraph(dir, { maxCommits: 50, branches: [] });
  assert.deepEqual(strip(explicitEmpty), strip(full), "branches: [] keeps the default walk byte-for-byte");

  const mainOnly = await api.readGraph(dir, { maxCommits: 50, branches: ["main"] });
  assert.deepEqual(
    mainOnly.commits.map((commit) => commit.subject),
    ["main only", "root"],
  );
  assert.equal(mainOnly.commits.some((commit) => commit.subject === "feature only"), false);
  assert.ok(mainOnly.refs.some((ref) => ref.shortName === "feature"), "refs stay complete; only the walk is filtered");

  const both = await api.readGraph(dir, { maxCommits: 50, branches: ["main", "feature"] });
  assert.deepEqual(
    both.commits.map((commit) => commit.subject).sort(),
    ["feature only", "main only", "root"],
  );

  const byTag = await api.readGraph(dir, { maxCommits: 50, branches: ["v1"] });
  assert.deepEqual(
    byTag.commits.map((commit) => commit.subject),
    ["main only", "root"],
  );
  const byHash = await api.readGraph(dir, { maxCommits: 50, branches: [runGit(["rev-parse", "HEAD"], dir).trim()] });
  assert.deepEqual(
    byHash.commits.map((commit) => commit.subject),
    ["main only", "root"],
  );

  await assert.rejects(api.readGraph(dir, { branches: ["does-not-exist"] }), (error) => error.code === "BAD_REQUEST" && /does-not-exist/.test(error.message));
  await assert.rejects(api.readGraph(dir, { branches: ["-bad"] }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readGraph(dir, { branches: "main" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readGraph(dir, { branches: [42] }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(
    api.readGraph(dir, { branches: Array.from({ length: 101 }, (_, index) => `branch-${index}`) }),
    (error) => error.code === "BAD_REQUEST" && /too many/.test(error.message),
  );
});

test("readGraph maps order values to the right git log flag", async () => {
  const calls = [];
  const fakeRun = async (argv) => {
    calls.push([...argv]);
    const ok = (stdout) => ({ stdout, stderr: "", code: 0 });
    switch (argv[0]) {
      case "rev-parse":
        if (argv[1] === "--show-toplevel") return ok("/fake/repo\n");
        if (argv[1] === "--abbrev-ref") return ok("main\n");
        return ok(`${"a".repeat(40)}\n`);
      case "status":
        return ok("");
      case "for-each-ref":
        return ok("");
      case "log":
        return ok("");
      default:
        return ok("");
    }
  };
  const fakeApi = createGitApi(fakeRun);

  for (const [order, flag] of [
    ["date", "--date-order"],
    ["author-date", "--author-date-order"],
    ["topo", "--topo-order"],
  ]) {
    calls.length = 0;
    await fakeApi.readGraph("/fake/repo", { maxCommits: 2, order });
    const logCall = calls.find((argv) => argv[0] === "log");
    assert.ok(logCall !== undefined, `log ran for order ${order}`);
    assert.equal(logCall[1], flag);
    assert.ok(logCall.includes("--max-count=3"));
    assert.ok(logCall.includes("--branches"));
    assert.ok(logCall.includes("--tags"));
    assert.equal(logCall[logCall.length - 1], "HEAD");
  }

  calls.length = 0;
  await fakeApi.readGraph("/fake/repo", { maxCommits: 2 });
  assert.equal(calls.find((argv) => argv[0] === "log")[1], "--date-order", "date is the default");

  calls.length = 0;
  await fakeApi.readGraph("/fake/repo", { maxCommits: 2, branches: ["main", "origin/main"] });
  const filteredLog = calls.find((argv) => argv[0] === "log");
  assert.equal(filteredLog.includes("--branches"), false);
  assert.equal(filteredLog.includes("--tags"), false);
  assert.equal(filteredLog.includes("--remotes"), false);
  assert.deepEqual(filteredLog.slice(-2), ["main", "origin/main"]);
  const verifies = calls.filter((argv) => argv[0] === "rev-parse" && argv[1] === "--verify");
  assert.equal(verifies.length, 2, "each filter is existence-checked");

  await assert.rejects(fakeApi.readGraph("/fake/repo", { order: "sideways" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(fakeApi.readGraph("/fake/repo", { order: 42 }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(fakeApi.readGraph("/fake/repo", { branches: ["main", "bad ref"] }), (error) => error.code === "BAD_REQUEST");
});

test("readGraph topo order groups a branch line while date order interleaves it", async () => {
  const dir = createScratchRepo("graph-order");
  writeFile(path.join(dir, "root.txt"), "root\n");
  commitAt(dir, 1_700_000_100, "root");
  runGit(["switch", "-q", "-c", "feature"], dir);
  writeFile(path.join(dir, "f1.txt"), "f1\n");
  commitAt(dir, 1_700_000_300, "feature one");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "m1.txt"), "m1\n");
  commitAt(dir, 1_700_000_200, "main one");
  runGit(["switch", "-q", "feature"], dir);
  writeFile(path.join(dir, "f2.txt"), "f2\n");
  commitAt(dir, 1_700_000_500, "feature two");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "m2.txt"), "m2\n");
  commitAt(dir, 1_700_000_400, "main two");
  const mergeDate = gitDate(1_700_000_600);
  runGit(["merge", "-q", "--no-ff", "feature", "-m", "merge feature"], dir, { GIT_AUTHOR_DATE: mergeDate, GIT_COMMITTER_DATE: mergeDate });

  const dateGraph = await api.readGraph(dir, { maxCommits: 50, order: "date" });
  const topoGraph = await api.readGraph(dir, { maxCommits: 50, order: "topo" });
  const dateSubjects = dateGraph.commits.map((commit) => commit.subject);
  const topoSubjects = topoGraph.commits.map((commit) => commit.subject);

  assert.deepEqual(dateSubjects, ["merge feature", "feature two", "main two", "feature one", "main one", "root"]);
  assert.notDeepEqual(dateSubjects, topoSubjects, "--topo-order changes the observable order");
  assert.equal(Math.abs(topoSubjects.indexOf("feature two") - topoSubjects.indexOf("feature one")), 1, "topo keeps the feature line together");
  assert.equal(Math.abs(topoSubjects.indexOf("main two") - topoSubjects.indexOf("main one")), 1, "topo keeps the main line together");
  assert.equal(topoSubjects[0], "merge feature");
  assert.equal(topoSubjects[topoSubjects.length - 1], "root");
});

test("graph route forwards branches and order without changing the wire shape", async () => {
  const dir = createScratchRepo("graph-route-filters");
  writeFile(path.join(dir, "root.txt"), "root\n");
  commitAll(dir, "root");
  runGit(["switch", "-q", "-c", "feature"], dir);
  writeFile(path.join(dir, "feature.txt"), "feature\n");
  commitAll(dir, "feature only");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "main.txt"), "main\n");
  commitAll(dir, "main only");

  const filterHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const filtered = await post(filterHost, GRAPH_PATH, { branches: ["main"], order: "topo" });
    assert.equal(filtered.ok, true);
    assert.deepEqual(
      filtered.value.commits.map((commit) => commit.subject),
      ["main only", "root"],
    );
    assert.equal("branches" in filtered.value, false, "filters are request-only");
    assert.equal("order" in filtered.value, false, "filters are request-only");

    const full = await post(filterHost, GRAPH_PATH, {});
    assert.equal(full.ok, true);
    assert.ok(full.value.commits.some((commit) => commit.subject === "feature only"));

    const empty = await post(filterHost, GRAPH_PATH, { branches: [] });
    assert.equal(empty.ok, true);
    assert.equal(empty.value.commits.length, full.value.commits.length);

    const badOrder = await post(filterHost, GRAPH_PATH, { order: "sideways" });
    assert.equal(badOrder.ok, false);
    assert.equal(badOrder.error.code, "BAD_REQUEST");

    const unknownBranch = await post(filterHost, GRAPH_PATH, { branches: ["nope"] });
    assert.equal(unknownBranch.ok, false);
    assert.equal(unknownBranch.error.code, "BAD_REQUEST");
    assert.match(unknownBranch.error.message, /nope/);

    const badShape = await post(filterHost, GRAPH_PATH, { branches: "main" });
    assert.equal(badShape.ok, false);
    assert.equal(badShape.error.code, "BAD_REQUEST");
  } finally {
    filterHost.dispose();
  }
});

test("git_graph tool shape stays untouched by graph filters and ordering", async () => {
  const tool = host.tools[0];
  assert.equal(tool.name, "git_graph");
  assert.deepEqual(tool.parameters.properties.action.enum, ["log", "show", "diff", "branches", "status"]);
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ["action", "commit", "file", "limit"]);
  assert.equal("branches" in tool.parameters.properties, false);
  assert.equal("order" in tool.parameters.properties, false);
  assert.deepEqual(tool.parameters.required, ["action"]);
  assert.equal(tool.parameters.additionalProperties, false);

  const exec = { agent: { session: { header: { cwd: fixture.repo } } } };
  const log = await tool.execute({ action: "log", limit: 5 }, exec);
  assert.equal(log.action, "log");
  assert.equal(log.isRepo, true);
  assert.equal(log.commits.length, 5);
  const branches = await tool.execute({ action: "branches" }, exec);
  assert.equal(branches.action, "branches");
});

// ---------------------------------------------------------------------------
// Wave 4: extended action table (merge / reset / pull / push / rebase)
// ---------------------------------------------------------------------------

test("merge and mergeCommit run the expected merge shapes", async () => {
  const dir = createScratchRepo("merge-actions");
  writeFile(path.join(dir, "root.txt"), "root\n");
  const root = commitAll(dir, "root");
  runGit(["switch", "-q", "-c", "topic"], dir);
  writeFile(path.join(dir, "topic.txt"), "topic\n");
  const topic = commitAll(dir, "topic commit");
  runGit(["switch", "-q", "main"], dir);

  // Default merge fast-forwards when main is the topic's base.
  const fastForward = await api.performAction(dir, "merge", { hash: "topic" });
  assert.equal(fastForward.message, "Merged topic.");
  assert.equal(headOf(dir), topic);
  runGit(["reset", "-q", "--hard", root], dir);

  // Diverge main so the remaining shapes need a real merge.
  writeFile(path.join(dir, "main.txt"), "main\n");
  const mainCommit = commitAll(dir, "main commit");

  const merged = await api.performAction(dir, "merge", { hash: "topic" });
  assert.equal(merged.message, "Merged topic.");
  assert.equal(parentsOf(dir).length, 2);
  runGit(["reset", "-q", "--hard", mainCommit], dir);

  // --no-ff is explicit (and still yields a merge commit).
  const noFastForward = await api.performAction(dir, "merge", { hash: "topic", noFastForward: true });
  assert.equal(noFastForward.message, "Merged topic.");
  assert.equal(parentsOf(dir).length, 2);
  runGit(["reset", "-q", "--hard", mainCommit], dir);

  // mergeCommit is the alias with no extra flags.
  const alias = await api.performAction(dir, "mergeCommit", { hash: "topic" });
  assert.equal(alias.message, "Merged topic.");
  assert.equal(parentsOf(dir).length, 2);
  runGit(["reset", "-q", "--hard", mainCommit], dir);

  // --no-commit stages the merge and leaves HEAD untouched.
  const staged = await api.performAction(dir, "merge", { hash: "topic", noCommit: true });
  assert.equal(staged.message, "Merged topic.");
  assert.equal(headOf(dir), mainCommit);
  assert.ok((await api.readUncommitted(dir)).staged.length > 0);
  runGit(["merge", "--abort"], dir);
  runGit(["reset", "-q", "--hard", mainCommit], dir);

  // --squash also leaves HEAD untouched.
  const squashed = await api.performAction(dir, "merge", { hash: "topic", squash: true });
  assert.equal(squashed.message, "Merged topic.");
  assert.equal(headOf(dir), mainCommit);
  runGit(["reset", "-q", "--hard", mainCommit], dir);
  runGit(["clean", "-qfd"], dir);

  await assert.rejects(api.performAction(dir, "merge", {}), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "merge", { hash: "-x" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "merge", { hash: "no-such-ref" }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.performAction(dir, "mergeCommit", {}), (error) => error.code === "BAD_REQUEST");
});

test("resetToCommit supports soft, mixed and hard modes", async () => {
  for (const mode of ["soft", "mixed", "hard"]) {
    const dir = createScratchRepo(`reset-${mode}`);
    writeFile(path.join(dir, "a.txt"), "a\n");
    writeFile(path.join(dir, "b.txt"), "b1\n");
    writeFile(path.join(dir, "c.txt"), "c1\n");
    const first = commitAll(dir, "first");
    writeFile(path.join(dir, "b.txt"), "b2\n");
    commitAll(dir, "second");
    writeFile(path.join(dir, "c.txt"), "c2\n");
    commitAll(dir, "third");

    const reset = await api.performAction(dir, "resetToCommit", { hash: first, mode });
    assert.match(reset.message, new RegExp(`Reset \\(${mode}\\)`));
    assert.equal(headOf(dir), first);
    const state = await api.readUncommitted(dir);
    if (mode === "soft") {
      assert.ok(state.counts.staged >= 2, "soft reset stages the removed commits' changes");
      assert.equal(state.counts.unstaged, 0);
    } else if (mode === "mixed") {
      assert.equal(state.counts.staged, 0);
      assert.ok(state.counts.unstaged >= 2, "mixed reset leaves the changes unstaged");
    } else {
      assert.deepEqual(state.counts, { staged: 0, unstaged: 0, untracked: 0 });
    }
  }

  const dir = createScratchRepo("reset-errors");
  writeFile(path.join(dir, "a.txt"), "a\n");
  const first = commitAll(dir, "first");
  await assert.rejects(api.performAction(dir, "resetToCommit", { hash: first, mode: "merge" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "resetToCommit", { hash: first }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "resetToCommit", { mode: "hard" }), (error) => error.code === "BAD_REQUEST");
});

test("pullBranch fast-forwards, merges and rebases from a local bare remote", async () => {
  const source = createScratchRepo("pull-source");
  writeFile(path.join(source, "a.txt"), "a\n");
  commitAll(source, "A");
  const bare = createBareRemote("pull-remote.git");
  runGit(["remote", "add", "origin", bare], source);
  runGit(["push", "-q", "-u", "origin", "main"], source);
  const work = cloneFromRemote(bare, "pull-work");

  writeFile(path.join(source, "b.txt"), "b\n");
  const sourceB = commitAll(source, "B");
  runGit(["push", "-q"], source);
  const fastForwarded = await api.performAction(work, "pullBranch", { remote: "origin", branch: "main" });
  assert.equal(fastForwarded.message, "Pulled origin main.");
  assert.equal(headOf(work), sourceB);

  writeFile(path.join(source, "s.txt"), "s\n");
  commitAll(source, "S");
  runGit(["push", "-q"], source);
  writeFile(path.join(work, "w.txt"), "w\n");
  commitAll(work, "W");
  const merged = await api.performAction(work, "pullBranch", { remote: "origin", branch: "main", noFastForward: true });
  assert.equal(merged.message, "Pulled origin main.");
  assert.equal(parentsOf(work).length, 2);

  const rebaseWork = cloneFromRemote(bare, "pull-work-rebase");
  writeFile(path.join(source, "s2.txt"), "s2\n");
  commitAll(source, "S2");
  runGit(["push", "-q"], source);
  writeFile(path.join(rebaseWork, "w2.txt"), "w2\n");
  commitAll(rebaseWork, "W2");
  const rebased = await api.performAction(rebaseWork, "pullBranch", { remote: "origin", branch: "main", rebase: true });
  assert.equal(rebased.message, "Pulled origin main.");
  assert.equal(parentsOf(rebaseWork).length, 1, "rebase keeps linear history");
  assert.match(runGit(["log", "--format=%s", "-2"], rebaseWork), /^W2[\s\S]*S2/m);

  await assert.rejects(
    api.performAction(work, "pullBranch", { remote: "origin", branch: "main", rebase: true, noFastForward: true }),
    (error) => error.code === "BAD_REQUEST",
  );
  await assert.rejects(api.performAction(work, "pullBranch", { branch: "main" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(work, "pullBranch", { remote: "-x", branch: "main" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(work, "pullBranch", { remote: "no-such-remote", branch: "main" }), (error) => error.code === "GIT_FAILED");
});

test("pushBranch pushes, sets upstream and only forces with a lease", async () => {
  const source = createScratchRepo("push-source");
  writeFile(path.join(source, "a.txt"), "a\n");
  commitAll(source, "A");
  const bare = createBareRemote("push-remote.git");
  runGit(["remote", "add", "origin", bare], source);
  runGit(["push", "-q", "-u", "origin", "main"], source);
  const work = cloneFromRemote(bare, "push-work");

  writeFile(path.join(work, "b.txt"), "b\n");
  commitAll(work, "B");
  const pushed = await api.performAction(work, "pushBranch", { remote: "origin", branch: "main" });
  assert.equal(pushed.message, "Pushed origin main.");
  assert.equal(runGit(["rev-parse", "main"], bare).trim(), headOf(work));

  runGit(["switch", "-q", "-c", "feature"], work);
  writeFile(path.join(work, "f.txt"), "f\n");
  commitAll(work, "F");
  const upstream = await api.performAction(work, "pushBranch", { remote: "origin", branch: "feature", setUpstream: true });
  assert.equal(upstream.message, "Pushed origin feature.");
  assert.equal(runGit(["rev-parse", "--abbrev-ref", "feature@{upstream}"], work).trim(), "origin/feature");

  // force means --force-with-lease: amend a pushed commit while the remote is unchanged.
  runGit(["switch", "-q", "main"], work);
  runGit(["commit", "--amend", "-q", "-m", "B amended"], work);
  const amended = headOf(work);
  const forced = await api.performAction(work, "pushBranch", { remote: "origin", branch: "main", force: true });
  assert.equal(forced.message, "Pushed origin main.");
  assert.equal(runGit(["rev-parse", "main"], bare).trim(), amended);

  // A stale lease (remote moved without a fetch) is refused by git.
  runGit(["fetch", "-q", "origin"], source);
  runGit(["reset", "-q", "--hard", "origin/main"], source);
  writeFile(path.join(source, "s.txt"), "s\n");
  commitAll(source, "S");
  runGit(["push", "-q", "origin", "main"], source);
  writeFile(path.join(work, "c.txt"), "c\n");
  commitAll(work, "C");
  await assert.rejects(api.performAction(work, "pushBranch", { remote: "origin", branch: "main", force: true }), (error) => error.code === "GIT_FAILED");

  await assert.rejects(api.performAction(work, "pushBranch", { branch: "main" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(work, "pushBranch", { remote: "-x", branch: "main" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(work, "pushBranch", { remote: "no-such-remote", branch: "main" }), (error) => error.code === "GIT_FAILED");
});

test("rebase rebases the current branch onto the given ref", async () => {
  const dir = createScratchRepo("rebase-action");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");
  runGit(["switch", "-q", "-c", "feature"], dir);
  writeFile(path.join(dir, "f.txt"), "f\n");
  commitAll(dir, "F");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "m.txt"), "m\n");
  commitAll(dir, "M");
  runGit(["switch", "-q", "feature"], dir);

  const rebased = await api.performAction(dir, "rebase", { onto: "main" });
  assert.equal(rebased.message, "Rebased onto main.");
  assert.deepEqual(runGit(["log", "--format=%s", "-3"], dir).trim().split("\n"), ["F", "M", "A"]);

  await assert.rejects(api.performAction(dir, "rebase", {}), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "rebase", { onto: "-x" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "rebase", { onto: "no-such-ref" }), (error) => error.code === "GIT_FAILED");
});

test("dropCommit refuses HEAD/foreign children and drops a middle commit", async () => {
  const dir = createScratchRepo("drop-commit");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");
  writeFile(path.join(dir, "b.txt"), "b\n");
  const b = commitAll(dir, "B");
  writeFile(path.join(dir, "c.txt"), "c\n");
  commitAll(dir, "C");
  writeFile(path.join(dir, "d.txt"), "d\n");
  commitAll(dir, "D");

  // A child reachable from another ref (not rewritten by this rebase) is refused.
  runGit(["branch", "other", b], dir);
  runGit(["switch", "-q", "other"], dir);
  writeFile(path.join(dir, "e.txt"), "e\n");
  commitAll(dir, "E");
  runGit(["switch", "-q", "main"], dir);
  await assert.rejects(
    api.performAction(dir, "dropCommit", { hash: b }),
    (error) => error.code === "BAD_REQUEST" && /children/.test(error.message),
  );

  // Without the other ref the middle commit is droppable.
  runGit(["branch", "-D", "other"], dir);
  const dropped = await api.performAction(dir, "dropCommit", { hash: b });
  assert.match(dropped.message, /Dropped commit/);
  assert.deepEqual(runGit(["log", "--format=%s"], dir).trim().split("\n").sort(), ["A", "C", "D"]);
  assert.equal(runGit(["rev-list", "HEAD"], dir).includes(b), false);

  const current = headOf(dir);
  await assert.rejects(api.performAction(dir, "dropCommit", { hash: current }), (error) => error.code === "BAD_REQUEST" && /HEAD/.test(error.message));
  await assert.rejects(api.performAction(dir, "dropCommit", { hash: "deadbeef".repeat(5) }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.performAction(dir, "dropCommit", {}), (error) => error.code === "BAD_REQUEST");
});

test("pushTag pushes a tag to a remote", async () => {
  const dir = createScratchRepo("push-tag");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");
  const bare = createBareRemote("tag-remote.git");
  runGit(["remote", "add", "origin", bare], dir);
  runGit(["tag", "v1"], dir);

  const pushed = await api.performAction(dir, "pushTag", { name: "v1", remote: "origin" });
  assert.equal(pushed.message, 'Pushed tag "v1" to "origin".');
  assert.match(runGit(["ls-remote", "--tags", bare], fixture.root), /refs\/tags\/v1$/m);

  await assert.rejects(api.performAction(dir, "pushTag", {}), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "pushTag", { name: "-x", remote: "origin" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "pushTag", { name: "no-such-tag", remote: "origin" }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.performAction(dir, "pushTag", { name: "v1", remote: "no-such-remote" }), (error) => error.code === "GIT_FAILED");
});

test("stash actions run the full create/apply/pop/drop/branch sequence", async () => {
  const dir = createScratchRepo("stash-actions");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  commitAll(dir, "base");
  writeFile(path.join(dir, "tracked.txt"), "two\n");
  writeFile(path.join(dir, "untracked.txt"), "u\n");

  const created = await api.performAction(dir, "stashPush", { includeUntracked: true, message: "wip one" });
  assert.match(created.message, /Stashed changes including untracked files/);
  const listed = await api.readStashes(dir);
  assert.equal(listed.isRepo, true);
  assert.equal(listed.stashes.length, 1);
  assert.deepEqual(Object.keys(listed.stashes[0]).sort(), ["author", "hash", "index", "message", "time"]);
  assert.equal(listed.stashes[0].index, 0);
  assert.match(listed.stashes[0].hash, /^[0-9a-f]{40}$/);
  assert.match(listed.stashes[0].message, /wip one/);
  assert.equal(typeof listed.stashes[0].author, "string");
  assert.equal(Number.isSafeInteger(listed.stashes[0].time), true);
  assert.deepEqual((await api.readUncommitted(dir)).counts, { staged: 0, unstaged: 0, untracked: 0 });

  const applied = await api.performAction(dir, "stashApply", { index: 0 });
  assert.equal(applied.message, "Applied stash@{0}.");
  assert.equal(readText(path.join(dir, "tracked.txt")), "two\n");
  assert.equal(fs.existsSync(path.join(dir, "untracked.txt")), true);
  assert.equal((await api.readStashes(dir)).stashes.length, 1, "apply keeps the stash");

  runGit(["reset", "-q", "--hard"], dir);
  runGit(["clean", "-qfd"], dir);
  const popped = await api.performAction(dir, "stashPop", { index: 0 });
  assert.equal(popped.message, "Popped stash@{0}.");
  assert.equal((await api.readStashes(dir)).stashes.length, 0);
  assert.equal(readText(path.join(dir, "tracked.txt")), "two\n");

  // --index restores the staged state as well.
  runGit(["reset", "-q", "--hard"], dir);
  runGit(["clean", "-qfd"], dir);
  writeFile(path.join(dir, "tracked.txt"), "three\n");
  runGit(["add", "tracked.txt"], dir);
  await api.performAction(dir, "stashPush", { message: "indexed" });
  const reinstated = await api.performAction(dir, "stashApply", { index: 0, reinstateIndex: true });
  assert.equal(reinstated.message, "Applied stash@{0}.");
  assert.ok((await api.readUncommitted(dir)).counts.staged > 0);
  runGit(["reset", "-q", "--hard"], dir);
  await api.performAction(dir, "stashDrop", { index: 0 });
  assert.equal((await api.readStashes(dir)).stashes.length, 0);

  writeFile(path.join(dir, "tracked.txt"), "four\n");
  await api.performAction(dir, "stashPush", {});
  const dropped = await api.performAction(dir, "stashDrop", { index: 0 });
  assert.equal(dropped.message, "Dropped stash@{0}.");
  assert.equal((await api.readStashes(dir)).stashes.length, 0);

  // git stash branch checks the new branch out and drops the stash.
  writeFile(path.join(dir, "tracked.txt"), "five\n");
  await api.performAction(dir, "stashPush", {});
  const branched = await api.performAction(dir, "branchFromStash", { index: 0, name: "from-stash" });
  assert.equal(branched.message, 'Created branch "from-stash" from stash@{0}.');
  assert.equal((await api.readStashes(dir)).stashes.length, 0);
  assert.equal(runGit(["rev-parse", "--abbrev-ref", "HEAD"], dir).trim(), "from-stash");
  runGit(["switch", "-q", "main"], dir);

  writeFile(path.join(dir, "tracked.txt"), "six\n");
  const aliasStash = await api.performAction(dir, "stashUncommitted", { includeUntracked: true });
  assert.match(aliasStash.message, /Stashed changes/);
  assert.equal((await api.readStashes(dir)).stashes.length, 1);

  await assert.rejects(api.performAction(dir, "stashApply", { index: "0" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "stashPop", { index: -1 }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "stashDrop", { index: 99 }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.performAction(dir, "branchFromStash", { index: 0 }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "stashPush", { message: "bad\nmessage" }), (error) => error.code === "BAD_REQUEST");
});

test("cleanUntracked defaults to a dry run and removes untracked files only when real", async () => {
  const dir = createScratchRepo("clean-untracked");
  writeFile(path.join(dir, "tracked.txt"), "t\n");
  commitAll(dir, "base");
  writeFile(path.join(dir, "loose.txt"), "l\n");
  fs.mkdirSync(path.join(dir, "dir"));
  writeFile(path.join(dir, "dir", "deep.txt"), "d\n");

  const dry = await api.performAction(dir, "cleanUntracked", { dryRun: true });
  assert.match(dry.message, /Dry run/);
  assert.match(dry.output, /Would remove/);
  assert.equal(fs.existsSync(path.join(dir, "loose.txt")), true);
  assert.equal(fs.existsSync(path.join(dir, "dir", "deep.txt")), true);

  const defaultDry = await api.performAction(dir, "cleanUntracked", {});
  assert.match(defaultDry.message, /Dry run/);
  assert.equal(fs.existsSync(path.join(dir, "loose.txt")), true);

  const real = await api.performAction(dir, "cleanUntracked", { dryRun: false });
  assert.match(real.message, /Removed 2 untracked path/);
  assert.match(real.output, /Removing/);
  assert.equal(fs.existsSync(path.join(dir, "loose.txt")), false);
  assert.equal(fs.existsSync(path.join(dir, "dir")), false);
});

test("resetUncommitted supports mixed and hard only", async () => {
  const dir = createScratchRepo("reset-uncommitted");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  commitAll(dir, "base");

  writeFile(path.join(dir, "tracked.txt"), "two\n");
  runGit(["add", "tracked.txt"], dir);
  const mixed = await api.performAction(dir, "resetUncommitted", { mode: "mixed" });
  assert.match(mixed.message, /Reset uncommitted changes \(mixed\)/);
  const mixedState = await api.readUncommitted(dir);
  assert.equal(mixedState.counts.staged, 0);
  assert.equal(mixedState.counts.unstaged, 1);

  runGit(["add", "tracked.txt"], dir);
  writeFile(path.join(dir, "tracked.txt"), "three\n");
  const hard = await api.performAction(dir, "resetUncommitted", { mode: "hard" });
  assert.match(hard.message, /Reset uncommitted changes \(hard\); 0 path/);
  assert.deepEqual((await api.readUncommitted(dir)).counts, { staged: 0, unstaged: 0, untracked: 0 });

  await assert.rejects(api.performAction(dir, "resetUncommitted", { mode: "soft" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "resetUncommitted", {}), (error) => error.code === "BAD_REQUEST");
});

test("resetFileToRevision restores one file from a revision", async () => {
  const dir = createScratchRepo("reset-file");
  writeFile(path.join(dir, "file.txt"), "one\n");
  const first = commitAll(dir, "first");
  writeFile(path.join(dir, "file.txt"), "two\n");
  commitAll(dir, "second");
  writeFile(path.join(dir, "file.txt"), "three\n");

  const restored = await api.performAction(dir, "resetFileToRevision", { path: "file.txt", hash: first });
  assert.match(restored.message, /Restored "file\.txt" from /);
  assert.equal(readText(path.join(dir, "file.txt")), "one\n");
  assert.equal((await api.readUncommitted(dir)).counts.staged, 1, "checkout from a revision stages the restored content");

  await assert.rejects(api.performAction(dir, "resetFileToRevision", { hash: first }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "resetFileToRevision", { path: "-x", hash: first }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "resetFileToRevision", { path: "file.txt" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "resetFileToRevision", { path: "file.txt", hash: "deadbeef".repeat(5) }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.performAction(dir, "resetFileToRevision", { path: "missing.txt", hash: first }), (error) => error.code === "GIT_FAILED");
});

test("addRemote/editRemote/pruneRemote/deleteRemote manage remotes", async () => {
  const dir = createScratchRepo("remotes-actions");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");
  const bareA = createBareRemote("remote-a.git");
  const bareB = createBareRemote("remote-b.git");

  const added = await api.performAction(dir, "addRemote", { name: "upstream", url: bareA });
  assert.equal(added.message, 'Added remote "upstream".');
  assert.deepEqual((await api.readRemotes(dir)).remotes, [{ name: "upstream", fetchUrl: bareA, pushUrl: bareA }]);

  await assert.rejects(api.performAction(dir, "addRemote", { name: "upstream", url: bareB }), (error) => error.code === "GIT_FAILED");

  const edited = await api.performAction(dir, "editRemote", { name: "upstream", url: bareB });
  assert.equal(edited.message, 'Updated remote "upstream".');
  assert.deepEqual((await api.readRemotes(dir)).remotes, [{ name: "upstream", fetchUrl: bareB, pushUrl: bareB }]);

  const pruned = await api.performAction(dir, "pruneRemote", { name: "upstream" });
  assert.equal(pruned.message, 'Pruned remote "upstream".');

  const deleted = await api.performAction(dir, "deleteRemote", { name: "upstream" });
  assert.equal(deleted.message, 'Removed remote "upstream".');
  assert.deepEqual(await api.readRemotes(dir), { isRepo: true, remotes: [] });

  await assert.rejects(api.performAction(dir, "addRemote", {}), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "addRemote", { name: "-x", url: bareA }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "addRemote", { name: "ok", url: "-x" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(dir, "editRemote", { name: "nope", url: bareA }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.performAction(dir, "deleteRemote", { name: "nope" }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.performAction(dir, "pruneRemote", { name: "nope" }), (error) => error.code === "GIT_FAILED");
  assert.equal((await api.readRemotes(fixture.empty)).isRepo, false);
});

test("action argv stays shell-free and only forces with a lease", async () => {
  const calls = [];
  const fakeApi = createGitApi(async (argv) => {
    calls.push([...argv]);
    if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel") return { stdout: "/fake/repo\n", stderr: "", code: 0 };
    return { stdout: "", stderr: "", code: 0 };
  });

  await fakeApi.performAction("/fake/repo", "pushBranch", { remote: "origin", branch: "main", force: true, setUpstream: true });
  assert.deepEqual(
    calls.find((argv) => argv[0] === "push"),
    ["push", "-u", "--force-with-lease", "origin", "main"],
  );
  assert.equal(calls.some((argv) => argv.includes("--force") && !argv.includes("--force-with-lease")), false, "bare --force is never emitted");

  await fakeApi.performAction("/fake/repo", "pullBranch", { remote: "origin", branch: "main", noFastForward: true });
  assert.deepEqual(calls.filter((argv) => argv[0] === "pull").pop(), ["pull", "--no-ff", "origin", "main"]);
  await fakeApi.performAction("/fake/repo", "pullBranch", { remote: "origin", branch: "main", rebase: true });
  assert.deepEqual(calls.filter((argv) => argv[0] === "pull").pop(), ["pull", "--rebase", "origin", "main"]);

  await fakeApi.performAction("/fake/repo", "cleanUntracked", {});
  assert.deepEqual(calls.filter((argv) => argv[0] === "clean").pop(), ["clean", "-fd", "-n"]);
  await fakeApi.performAction("/fake/repo", "cleanUntracked", { dryRun: false });
  assert.deepEqual(calls.filter((argv) => argv[0] === "clean").pop(), ["clean", "-fd"]);

  await fakeApi.performAction("/fake/repo", "merge", { hash: "main", noFastForward: true, noCommit: true, squash: true });
  assert.deepEqual(calls.find((argv) => argv[0] === "merge"), ["merge", "--no-ff", "--squash", "--no-commit", "main"]);

  await fakeApi.performAction("/fake/repo", "rebase", { onto: "main" });
  assert.deepEqual(calls.filter((argv) => argv[0] === "rebase").pop(), ["rebase", "main"]);

  await fakeApi.performAction("/fake/repo", "stashDrop", { index: 3 });
  assert.deepEqual(calls.filter((argv) => argv[0] === "stash").pop(), ["stash", "drop", "stash@{3}"]);

  const before = calls.length;
  await assert.rejects(fakeApi.performAction("/fake/repo", "stashDrop", { index: "0" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(fakeApi.performAction("/fake/repo", "stashApply", { index: 1.5 }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(fakeApi.performAction("/fake/repo", "pushBranch", { branch: "main" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(fakeApi.performAction("/fake/repo", "resetToCommit", { hash: "main", mode: "soft-ish" }), (error) => error.code === "BAD_REQUEST");
  assert.equal(
    calls.slice(before).some((argv) => argv[0] === "stash" || argv[0] === "push"),
    false,
    "invalid arguments never spawn git",
  );
});

test("stashes, tag and remotes routes return their contract shapes", async () => {
  const dir = createScratchRepo("wave4-routes");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");
  runGit(["tag", "v-light"], dir);
  runGit(["tag", "-a", "v-annotated", "-m", "release notes"], dir, nextDates());
  const bare = createBareRemote("route-remote.git");
  runGit(["remote", "add", "origin", bare], dir);
  writeFile(path.join(dir, "a.txt"), "changed\n");
  await api.performAction(dir, "stashPush", { message: "route stash" });

  const waveHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const stashes = await post(waveHost, STASHES_PATH, {});
    assert.equal(stashes.ok, true);
    assert.equal(stashes.value.isRepo, true);
    assert.equal(stashes.value.stashes.length, 1);
    assert.deepEqual(Object.keys(stashes.value.stashes[0]).sort(), ["author", "hash", "index", "message", "time"]);

    const light = await post(waveHost, TAG_PATH, { name: "v-light" });
    assert.equal(light.ok, true);
    assert.deepEqual(light.value, { name: "v-light", annotated: false, tagger: null, message: "A" });

    const annotated = await post(waveHost, TAG_PATH, { name: "v-annotated" });
    assert.equal(annotated.ok, true);
    assert.equal(annotated.value.annotated, true);
    assert.equal(annotated.value.message, "release notes");
    assert.deepEqual(Object.keys(annotated.value.tagger).sort(), ["email", "name", "time"]);
    assert.equal(annotated.value.tagger.name, "Graph Test");

    const notTag = await post(waveHost, TAG_PATH, { name: "main" });
    assert.equal(notTag.ok, false);
    assert.equal(notTag.error.code, "BAD_REQUEST");
    const missingTag = await post(waveHost, TAG_PATH, {});
    assert.equal(missingTag.ok, false);
    assert.equal(missingTag.error.code, "BAD_REQUEST");

    const remotes = await post(waveHost, REMOTES_PATH, {});
    assert.equal(remotes.ok, true);
    assert.deepEqual(remotes.value, { isRepo: true, remotes: [{ name: "origin", fetchUrl: bare, pushUrl: bare }] });
  } finally {
    waveHost.dispose();
  }

  const outside = createHost({ config: undefined, defaultDirectory: fixture.empty });
  try {
    const stashes = await post(outside, STASHES_PATH, {});
    assert.equal(stashes.ok, true);
    assert.equal(stashes.value.isRepo, false);
    assert.deepEqual(stashes.value.stashes, []);
    const remotes = await post(outside, REMOTES_PATH, {});
    assert.equal(remotes.ok, true);
    assert.equal(remotes.value.isRepo, false);
    const tag = await post(outside, TAG_PATH, { name: "v1" });
    assert.equal(tag.ok, false);
    assert.equal(tag.error.code, "NOT_A_REPO");
  } finally {
    outside.dispose();
  }
});

test("graph reports stash chips when showStashes is on and omits them when off", async () => {
  const dir = createScratchRepo("graph-stashes");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");
  writeFile(path.join(dir, "a.txt"), "changed\n");
  await api.performAction(dir, "stashPush", { message: "chip stash" });

  const onHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const graph = await post(onHost, GRAPH_PATH, {});
    assert.equal(graph.ok, true);
    assert.equal(Array.isArray(graph.value.stashes), true);
    assert.equal(graph.value.stashes.length, 1);
    assert.deepEqual(Object.keys(graph.value.stashes[0]).sort(), ["hash", "index", "message"]);
    const chip = graph.value.refs.find((ref) => ref.type === "stash");
    assert.deepEqual(chip, {
      name: "refs/stash@{0}",
      shortName: "stash@{0}",
      type: "stash",
      hash: graph.value.stashes[0].hash,
      head: false,
      upstream: null,
    });
    assert.equal(graph.value.commits.some((commit) => commit.hash === chip.hash), false, "stash commits stay out of the walk");
    assert.equal(graph.value.commits.length, 1);
  } finally {
    onHost.dispose();
  }

  const offHost = createHost({ config: { showStashes: false }, defaultDirectory: dir });
  try {
    const graph = await post(offHost, GRAPH_PATH, {});
    assert.equal(graph.ok, true);
    assert.equal("stashes" in graph.value, false);
    assert.equal(graph.value.refs.some((ref) => ref.type === "stash"), false);
  } finally {
    offHost.dispose();
  }
});

test("git_graph keeps five actions and rejects wave-4 verbs", async () => {
  const tool = host.tools[0];
  assert.equal(tool.name, "git_graph");
  assert.deepEqual(tool.parameters.properties.action.enum, ["log", "show", "diff", "branches", "status"]);
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ["action", "commit", "file", "limit"]);
  assert.deepEqual(tool.parameters.required, ["action"]);
  assert.equal(tool.parameters.additionalProperties, false);

  const exec = { agent: { session: { header: { cwd: fixture.repo } } } };
  await assert.rejects(tool.execute({ action: "stashPush" }, exec), /unknown git_graph action/);
  await assert.rejects(tool.execute({ action: "pushBranch" }, exec), /unknown git_graph action/);
  const branches = await tool.execute({ action: "branches" }, exec);
  assert.equal(branches.action, "branches");
});

// ---------------------------------------------------------------------------
// Wave 5: fetchIntoLocalBranch, /contains, signature status, presentation config
// ---------------------------------------------------------------------------

test("fetchIntoLocalBranch updates a local branch without switching to it", async () => {
  const source = createScratchRepo("fetchlocal-source");
  writeFile(path.join(source, "a.txt"), "a\n");
  const sourceA = commitAll(source, "A");
  const bare = createBareRemote("fetchlocal-remote.git");
  runGit(["remote", "add", "origin", bare], source);
  runGit(["push", "-q", "-u", "origin", "main"], source);
  const work = cloneFromRemote(bare, "fetchlocal-work");
  const workHead = headOf(work);

  writeFile(path.join(source, "b.txt"), "b\n");
  const remoteB = commitAll(source, "B");
  runGit(["push", "-q"], source);

  const fetched = await api.performAction(work, "fetchIntoLocalBranch", { remote: "origin", branch: "main", local: "synced" });
  assert.equal(fetched.message, 'Fetched "origin/main" into "synced".');
  assert.equal(runGit(["rev-parse", "synced"], work).trim(), remoteB);
  assert.equal(headOf(work), workHead, "HEAD did not move");
  assert.equal(runGit(["rev-parse", "--abbrev-ref", "HEAD"], work).trim(), "main");

  // A non-fast-forward update of a local branch is refused by git (no --force, no "+").
  runGit(["branch", "behind", remoteB], work);
  runGit(["reset", "-q", "--hard", sourceA], source);
  runGit(["push", "-q", "--force", "origin", "main"], source);
  await assert.rejects(
    api.performAction(work, "fetchIntoLocalBranch", { remote: "origin", branch: "main", local: "behind" }),
    (error) => error.code === "GIT_FAILED" && /non-fast-forward|rejected/i.test(error.message),
  );
  assert.equal(runGit(["rev-parse", "behind"], work).trim(), remoteB, "the refused update left the branch untouched");

  await assert.rejects(api.performAction(work, "fetchIntoLocalBranch", {}), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(work, "fetchIntoLocalBranch", { remote: "-x", branch: "main", local: "x" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(work, "fetchIntoLocalBranch", { remote: "origin", branch: "a..b", local: "x" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.performAction(work, "fetchIntoLocalBranch", { remote: "origin", branch: "main", local: "x.lock" }), (error) => error.code === "BAD_REQUEST");

  const routeHost = createHost({ config: undefined, defaultDirectory: work });
  try {
    const viaRoute = await post(routeHost, ACTION_PATH, { action: "fetchIntoLocalBranch", remote: "origin", branch: "main", local: "route-synced" });
    assert.equal(viaRoute.ok, true);
    assert.equal(viaRoute.value.message, 'Fetched "origin/main" into "route-synced".');
    assert.equal(runGit(["rev-parse", "route-synced"], work).trim(), sourceA);

    const refused = await post(routeHost, ACTION_PATH, { action: "fetchIntoLocalBranch", remote: "origin", branch: "main", local: "behind" });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "GIT_FAILED");
    assert.equal(typeof refused.error.output, "string");
    assert.match(refused.error.output, /non-fast-forward|rejected/i);
  } finally {
    routeHost.dispose();
  }
});

test("readContains reports HEAD, branches, remotes, tags and stashes", async () => {
  const dir = createScratchRepo("contains");
  writeFile(path.join(dir, "a.txt"), "a\n");
  const a = commitAll(dir, "A");
  runGit(["tag", "vA"], dir);
  runGit(["switch", "-q", "-c", "feature"], dir);
  writeFile(path.join(dir, "f.txt"), "f\n");
  const f = commitAll(dir, "F");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "b.txt"), "b\n");
  const b = commitAll(dir, "B");
  const bare = createBareRemote("contains-remote.git");
  runGit(["remote", "add", "origin", bare], dir);
  runGit(["push", "-q", "-u", "origin", "main"], dir);

  const inHead = await api.readContains(dir, b);
  assert.equal(inHead.hash, b);
  assert.equal(inHead.shortHash, b.slice(0, 7));
  assert.equal(inHead.inHead, true);
  assert.deepEqual(inHead.branches, [
    { name: "main", isHead: true },
    { name: "origin/main", isHead: false },
  ]);
  assert.deepEqual(inHead.tags, []);
  assert.deepEqual(inHead.stashes, []);
  assert.equal(Number.isSafeInteger(inHead.generatedAt), true);

  const parent = await api.readContains(dir, a);
  assert.equal(parent.inHead, true);
  assert.deepEqual(
    parent.branches.map((branch) => branch.name).sort(),
    ["feature", "main", "origin/main"],
  );
  assert.deepEqual(parent.branches.find((branch) => branch.name === "feature"), { name: "feature", isHead: false });
  assert.deepEqual(parent.tags, ["vA"]);

  const onlyOnBranch = await api.readContains(dir, f);
  assert.equal(onlyOnBranch.inHead, false);
  assert.deepEqual(onlyOnBranch.branches, [{ name: "feature", isHead: false }]);
  assert.deepEqual(onlyOnBranch.tags, []);

  // Resolves a ref name, not just full hashes.
  const byName = await api.readContains(dir, "feature");
  assert.equal(byName.hash, f);
  assert.equal(byName.inHead, false);

  // A stash containing the commit is reported via refs/stash (resolved to its selector).
  writeFile(path.join(dir, "a.txt"), "stashed change\n");
  await api.performAction(dir, "stashPush", { message: "contains stash" });
  const stashContained = await api.readContains(dir, a);
  assert.deepEqual(stashContained.stashes, [{ index: 0, shortName: "stash@{0}" }]);
  assert.equal(stashContained.inHead, true);

  await assert.rejects(api.readContains(dir, {}), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readContains(dir, "-x"), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readContains(dir, "deadbeef".repeat(5)), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.readContains(fixture.empty, a), (error) => error.code === "NOT_A_REPO");

  const routeHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const viaRoute = await post(routeHost, CONTAINS_PATH, { hash: a });
    assert.equal(viaRoute.ok, true);
    assert.deepEqual(Object.keys(viaRoute.value).sort(), ["branches", "generatedAt", "hash", "inHead", "shortHash", "stashes", "tags"]);
    assert.deepEqual(viaRoute.value.tags, ["vA"]);
    const asArray = await post(routeHost, CONTAINS_PATH, { hash: [a] });
    assert.equal(asArray.ok, false);
    assert.equal(asArray.error.code, "BAD_REQUEST");
    const missing = await post(routeHost, CONTAINS_PATH, {});
    assert.equal(missing.ok, false);
    assert.equal(missing.error.code, "BAD_REQUEST");
  } finally {
    routeHost.dispose();
  }
});

test("readCommit reports signature status without an extra git process", async () => {
  const dir = createScratchRepo("signature");
  writeFile(path.join(dir, "a.txt"), "a\n");
  const head = commitAll(dir, "unsigned commit");

  const detail = await api.readCommit(dir, head);
  /* No gpg in this environment: only the unsigned shape can be asserted. A signed
   * commit (status G/B/U/X/Y/R) is documented but untested here. */
  assert.deepEqual(detail.signature, { status: "N", signer: null, keyId: null });
  assert.deepEqual(Object.keys(detail.signature).sort(), ["keyId", "signer", "status"]);

  // The graph page does no signature work and its commits carry no signature key.
  const graph = await api.readGraph(dir, { maxCommits: 5 });
  assert.equal("signature" in graph.commits[0], false);

  const routeHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const viaRoute = await post(routeHost, COMMIT_PATH, { hash: head });
    assert.equal(viaRoute.ok, true);
    assert.deepEqual(viaRoute.value.signature, { status: "N", signer: null, keyId: null });
    const notRepo = createHost({ config: undefined, defaultDirectory: fixture.empty });
    try {
      const failed = await post(notRepo, COMMIT_PATH, { hash: head });
      assert.equal(failed.ok, false);
      assert.equal(failed.error.code, "NOT_A_REPO");
    } finally {
      notRepo.dispose();
    }
  } finally {
    routeHost.dispose();
  }
});

test("graph presentation forwards all 30 settings keys", async () => {
  const dir = createScratchRepo("presentation");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");

  const defaults = {
    graphStyle: "rounded",
    graphColours: [
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
    ],
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
      find: { key: "f", ctrl: true, meta: true, alt: false, shift: false },
      refresh: { key: "r", ctrl: true, meta: true, alt: false, shift: false },
      scrollToHead: { key: "h", ctrl: true, meta: true, alt: false, shift: false },
      scrollToStash: { key: "s", ctrl: true, meta: true, alt: false, shift: false },
    },
    globalShortcuts: false,
    enhancedAccessibility: false,
    repositoryDropdownOrder: "Workspace Full Path",
    fileEncoding: "utf8",
    initialLoad: 300,
    loadMore: 100,
    loadMoreAutomatically: true,
    avatars: false,
  };
  const expectedKeys = Object.keys(defaults);
  assert.equal(expectedKeys.length, 30);

  const defaultHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const graph = await post(defaultHost, GRAPH_PATH, {});
    assert.equal(graph.ok, true);
    assert.deepEqual(graph.value.presentation, defaults);
    assert.deepEqual(Object.keys(graph.value.presentation), expectedKeys, "presentation uses the contract key order");
  } finally {
    defaultHost.dispose();
  }

  const customHost = createHost({
    config: {
      graphStyle: "angular",
      graphColours: ["#ff0000", "red", "var(--brand)", "rgb(1, 2, 3)", "bad;color", "", 42, "url(x)"],
      showSignature: true,
      showEmoji: false,
      issueUrlTemplate: "https://example.com/issues/{id}",
      useMailmap: true,
      dateType: "Commit Date",
      dateFormat: "Relative",
      defaultColumnVisibility: { Date: false, Author: true, Commit: true },
      "commitDetailsView.fileView.type": "File List",
      "commitDetailsView.fileView.fileTree.compactFolders": false,
      "commitDetailsView.autoCenter": false,
      markdown: false,
      "repository.commits.mute.mergeCommits": false,
      "repository.commits.mute.commitsThatAreNotAncestorsOfHead": true,
      customEmojiShortcodeMappings: [{ shortcode: "party", emoji: "🎉" }],
      customBranchGlobPatterns: [{ name: "Release", glob: "release/*" }],
      globalShortcuts: true,
      enhancedAccessibility: true,
      repositoryDropdownOrder: "Name",
    },
    defaultDirectory: dir,
  });
  try {
    const presentation = (await post(customHost, GRAPH_PATH, {})).value.presentation;
    assert.deepEqual(Object.keys(presentation), expectedKeys);
    assert.deepEqual(presentation, {
      ...defaults,
      graphStyle: "angular",
      graphColours: ["#ff0000", "red", "var(--brand)", "rgb(1, 2, 3)"],
      showSignature: true,
      showEmoji: false,
      issueUrlTemplate: "https://example.com/issues/{id}",
      useMailmap: true,
      dateType: "Commit Date",
      dateFormat: "Relative",
      columnVisibility: { Date: false, Author: true, Commit: true },
      fileViewType: "File List",
      compactFolders: false,
      autoCenterDetails: false,
      markdown: false,
      muteMergeCommits: false,
      muteNonAncestors: true,
      emojiMappings: [{ shortcode: "party", emoji: "🎉" }],
      customBranchGlobPatterns: [{ name: "Release", glob: "release/*" }],
      globalShortcuts: true,
      enhancedAccessibility: true,
      repositoryDropdownOrder: "Name",
    });
  } finally {
    customHost.dispose();
  }

  const invalidHost = createHost({
    config: {
      graphStyle: "triangular",
      graphColours: "#fff",
      showSignature: {},
      showEmoji: {},
      issueUrlTemplate: 42,
      useMailmap: {},
      dateType: "Nonsense",
      dateFormat: 7,
      "commitDetailsView.fileView.type": "Nonsense",
      globalShortcuts: {},
      repositoryDropdownOrder: "Nonsense",
      "repository.commits.fetchAvatars": 7,
    },
    defaultDirectory: dir,
  });
  try {
    const presentation = (await post(invalidHost, GRAPH_PATH, {})).value.presentation;
    assert.deepEqual(presentation, defaults, "invalid values fall back to the documented defaults");
  } finally {
    invalidHost.dispose();
  }

  const outside = createHost({ config: undefined, defaultDirectory: fixture.empty });
  try {
    const graph = await post(outside, GRAPH_PATH, {});
    assert.deepEqual(graph.value.presentation, defaults, "every graph response carries presentation");
  } finally {
    outside.dispose();
  }
});

test("useMailmap changes the commit walk argv and the reported author", async () => {
  const calls = [];
  const fakeRun = async (argv) => {
    calls.push([...argv]);
    const ok = (stdout) => ({ stdout, stderr: "", code: 0 });
    if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel") return ok("/fake/repo\n");
    if (argv[0] === "rev-parse" && argv[1] === "--abbrev-ref") return ok("main\n");
    if (argv[0] === "rev-parse") return ok(`${"a".repeat(40)}\n`);
    if (argv[0] === "status") return ok("");
    if (argv[0] === "for-each-ref") return ok("");
    return ok("");
  };
  const fakeApi = createGitApi(fakeRun);

  await fakeApi.readGraph("/fake/repo", { maxCommits: 2 });
  let logCall = calls.filter((argv) => argv[0] === "log").pop();
  assert.equal(logCall.includes("--use-mailmap"), false);
  assert.ok(logCall.some((argv) => argv.startsWith("--format=") && argv.includes("%an")));

  calls.length = 0;
  await fakeApi.readGraph("/fake/repo", { maxCommits: 2, useMailmap: true });
  logCall = calls.filter((argv) => argv[0] === "log").pop();
  assert.equal(logCall[1], "--use-mailmap");
  const format = logCall.find((argv) => argv.startsWith("--format="));
  assert.ok(format.includes("%aN") && format.includes("%aE") && format.includes("%cN") && format.includes("%cE"));
  assert.equal(format.includes("%an"), false);

  // Real repository: mailmap-aware placeholders make the config observable.
  const dir = createScratchRepo("mailmap");
  writeFile(path.join(dir, ".mailmap"), "Canonical Name <canonical@example.com> Graph Test <graph@example.com>\n");
  writeFile(path.join(dir, "a.txt"), "a\n");
  const head = commitAll(dir, "A");

  const plain = await api.readGraph(dir, { maxCommits: 5 });
  assert.equal(plain.commits[0].authorName, "Graph Test");
  const mapped = await api.readGraph(dir, { maxCommits: 5, useMailmap: true });
  assert.equal(mapped.commits[0].authorName, "Canonical Name");
  assert.equal(mapped.commits[0].authorEmail, "canonical@example.com");
  assert.equal(mapped.commits[0].hash, head);

  const mailmapHost = createHost({ config: { useMailmap: true }, defaultDirectory: dir });
  try {
    const graph = await post(mailmapHost, GRAPH_PATH, {});
    assert.equal(graph.ok, true);
    assert.equal(graph.value.presentation.useMailmap, true);
    assert.equal(graph.value.commits[0].authorName, "Canonical Name");
  } finally {
    mailmapHost.dispose();
  }

  const canonicalHost = createHost({ config: { "repository.useMailmap": true }, defaultDirectory: dir });
  try {
    const graph = await post(canonicalHost, GRAPH_PATH, {});
    assert.equal(graph.value.commits[0].authorName, "Canonical Name", "the canonical setting is wired");
    assert.equal(graph.value.presentation.useMailmap, true);
  } finally {
    canonicalHost.dispose();
  }

  const invalidHost = createHost({ config: { "repository.useMailmap": 7 }, defaultDirectory: dir });
  try {
    const graph = await post(invalidHost, GRAPH_PATH, {});
    assert.equal(graph.value.commits[0].authorName, "Graph Test", "an invalid value falls back to the default");
  } finally {
    invalidHost.dispose();
  }
});

test("git_graph stays five read-only actions with no presentation payload", async () => {
  const tool = host.tools[0];
  assert.deepEqual(tool.parameters.properties.action.enum, ["log", "show", "diff", "branches", "status"]);
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ["action", "commit", "file", "limit"]);
  const exec = { agent: { session: { header: { cwd: fixture.repo } } } };
  const log = await tool.execute({ action: "log", limit: 3 }, exec);
  assert.equal(log.action, "log");
  assert.equal("presentation" in log, false);
  assert.equal("signature" in (log.commits[0] ?? {}), false);
  await assert.rejects(tool.execute({ action: "contains" }, exec), /unknown git_graph action/);
});

// ---------------------------------------------------------------------------
// Wave 6: repo discovery, workspace path fence, review marks
// ---------------------------------------------------------------------------

test("repos route discovers nested repositories within the depth limit", async () => {
  const workspace = path.join(fixture.root, "repos-workspace");
  fs.mkdirSync(workspace);
  const makeRepo = (relative) => {
    const directory = path.join(workspace, relative);
    fs.mkdirSync(directory, { recursive: true });
    runGit(["init", "-q", "-b", "main"], directory);
    return fs.realpathSync(directory);
  };
  const repoA = makeRepo("repo-a");
  const repoB = makeRepo("repo-b");
  const nested = makeRepo(path.join("group", "repo-c"));
  makeRepo(path.join("node_modules", "pkg"));
  makeRepo(path.join("build", "artifact"));

  const depthOneHost = createHost({ config: undefined, defaultDirectory: workspace });
  try {
    const depthOne = await post(depthOneHost, REPOS_PATH, {});
    assert.equal(depthOne.ok, true);
    assert.equal(depthOne.value.workspacePath, workspace);
    assert.equal(depthOne.value.maxDepth, 1);
    assert.deepEqual(
      depthOne.value.repos.map((repo) => repo.path).sort(),
      [repoA, repoB].sort(),
      "node_modules/build repos and grandchildren are not reported at depth 1",
    );
    assert.equal(depthOne.value.repos.every((repo) => repo.isCurrent === false), true);
    assert.equal("truncated" in depthOne.value, false);
  } finally {
    depthOneHost.dispose();
  }

  const depthTwoHost = createHost({ config: undefined, defaultDirectory: workspace });
  try {
    const depthTwo = await post(depthTwoHost, REPOS_PATH, { maxDepth: 2 });
    assert.equal(depthTwo.value.maxDepth, 2);
    assert.deepEqual(
      depthTwo.value.repos.map((repo) => repo.path).sort(),
      [repoA, repoB, nested].sort(),
    );
  } finally {
    depthTwoHost.dispose();
  }

  const configDepthHost = createHost({ config: { maxDepthOfRepoSearch: 2 }, defaultDirectory: workspace });
  try {
    const viaConfig = await post(configDepthHost, REPOS_PATH, {});
    assert.equal(viaConfig.value.maxDepth, 2);
    assert.equal(viaConfig.value.repos.length, 3);
  } finally {
    configDepthHost.dispose();
  }
});

test("repos route marks the session repository current and accepts empty workspaces", async () => {
  const dir = createScratchRepo("repos-single");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");
  const singleHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const value = await post(singleHost, REPOS_PATH, {});
    assert.equal(value.ok, true);
    assert.equal(value.value.maxDepth, 1);
    assert.deepEqual(value.value.repos, [{ path: fs.realpathSync(dir), name: path.basename(dir), isCurrent: true }]);
  } finally {
    singleHost.dispose();
  }

  const emptyWorkspace = path.join(fixture.root, "repos-empty");
  fs.mkdirSync(emptyWorkspace);
  const emptyHost = createHost({ config: undefined, defaultDirectory: emptyWorkspace });
  try {
    const value = await post(emptyHost, REPOS_PATH, {});
    assert.equal(value.ok, true, "an empty workspace is a normal state");
    assert.deepEqual(value.value.repos, []);
    assert.equal("truncated" in value.value, false);
  } finally {
    emptyHost.dispose();
  }
});

test("repos discovery caps repositories and directories with truncated:true", async () => {
  const capped = path.join(fixture.root, "repos-capped");
  fs.mkdirSync(capped);
  for (let index = 0; index < 51; index += 1) {
    fs.mkdirSync(path.join(capped, `repo-${String(index).padStart(2, "0")}`, ".git"), { recursive: true });
  }
  const cappedHost = createHost({ config: undefined, defaultDirectory: capped });
  try {
    const value = await post(cappedHost, REPOS_PATH, {});
    assert.equal(value.ok, true);
    assert.equal(value.value.repos.length, 50);
    assert.equal(value.value.truncated, true);
  } finally {
    cappedHost.dispose();
  }

  const wide = path.join(fixture.root, "repos-wide");
  fs.mkdirSync(wide);
  for (let index = 0; index < 2001; index += 1) fs.mkdirSync(path.join(wide, `d-${index}`));
  const wideHost = createHost({ config: undefined, defaultDirectory: wide });
  try {
    const value = await post(wideHost, REPOS_PATH, {});
    assert.equal(value.ok, true);
    assert.deepEqual(value.value.repos, []);
    assert.equal(value.value.truncated, true, "the directory cap reports truncation");
  } finally {
    wideHost.dispose();
  }
});

test("every path-taking route refuses paths outside the session workspace", async () => {
  const workspace = path.join(fixture.root, "whitelist-workspace");
  fs.mkdirSync(workspace);
  const repo = path.join(workspace, "repo");
  fs.mkdirSync(repo);
  runGit(["init", "-q", "-b", "main"], repo);
  writeFile(path.join(repo, "a.txt"), "a\n");
  commitAll(repo, "A");
  const outside = path.join(fixture.root, "whitelist-outside");
  fs.mkdirSync(outside);

  const host = createHost({ config: undefined, defaultDirectory: workspace });
  try {
    const cases = [
      [GRAPH_PATH, {}],
      [COMMIT_PATH, { hash: "HEAD" }],
      [DIFF_PATH, { hash: "HEAD", file: "a.txt" }],
      [ACTION_PATH, { action: "fetch" }],
      [UNCOMMITTED_PATH, {}],
      [COMPARE_PATH, { base: "HEAD", head: "HEAD" }],
      [STASHES_PATH, {}],
      [TAG_PATH, { name: "v1" }],
      [REMOTES_PATH, {}],
      [CONTAINS_PATH, { hash: "HEAD" }],
      [REPOS_PATH, {}],
      [REVIEW_PATH, { action: "read", kind: "commit", base: "HEAD", head: "HEAD" }],
    ];
    for (const [routePath, body] of cases) {
      const envelope = await post(host, routePath, { ...body, path: outside });
      assert.equal(envelope.ok, false, routePath);
      assert.equal(envelope.error.code, "OUTSIDE_WORKSPACE", routePath);
      assert.equal(envelope.error.message.includes(outside), true, `${routePath} names the refused path`);
    }

    const inside = await post(host, GRAPH_PATH, { path: "repo" });
    assert.equal(inside.ok, true, "a path inside the workspace is accepted");
    assert.equal(inside.value.isRepo, true);

    const dotDot = await post(host, GRAPH_PATH, { path: "../whitelist-outside" });
    assert.equal(dotDot.ok, false);
    assert.equal(dotDot.error.code, "OUTSIDE_WORKSPACE", "'..' escapes are refused");

    const link = path.join(workspace, "escape-link");
    fs.symlinkSync(outside, link, "dir");
    const symlinkEnvelope = await post(host, GRAPH_PATH, { path: "escape-link" });
    assert.equal(symlinkEnvelope.ok, false);
    assert.equal(symlinkEnvelope.error.code, "OUTSIDE_WORKSPACE", "symlink escapes are refused");

    const pinnedRepo = createScratchRepo("whitelist-pinned");
    writeFile(path.join(pinnedRepo, "a.txt"), "a\n");
    commitAll(pinnedRepo, "A");
    const pinnedHost = createHost({ config: { repoPath: pinnedRepo }, defaultDirectory: workspace });
    try {
      const pinned = await post(pinnedHost, GRAPH_PATH, {});
      assert.equal(pinned.ok, true, "the repoPath config override is exempt from the fence");
      assert.equal(pinned.value.isRepo, true);
      assert.equal(pinned.value.repoPath, fs.realpathSync(pinnedRepo));
    } finally {
      pinnedHost.dispose();
    }
  } finally {
    host.dispose();
  }
});

test("review marks read/toggle/clear with authoritative totals", async () => {
  const dir = createScratchRepo("review-marks");
  writeFile(path.join(dir, "one.txt"), "1\n");
  writeFile(path.join(dir, "two.txt"), "2\n");
  const base = commitAll(dir, "base");
  writeFile(path.join(dir, "one.txt"), "1 changed\n");
  writeFile(path.join(dir, "two.txt"), "2 changed\n");
  const head = commitAll(dir, "head");
  const storage = createFakeStorageDomain();
  const host = createHost({ config: undefined, defaultDirectory: dir, storageDomain: storage.service });
  try {
    assert.equal(storage.opened.length, 1, "the domain is opened once through storageDomain");
    assert.equal(storage.opened[0].name, "dsh_git_graph");
    assert.deepEqual(Object.keys(storage.opened[0].tables), ["reviews"]);

    const read = await post(host, REVIEW_PATH, { sessionId: "s1", action: "read", kind: "commit", base: head, head });
    assert.equal(read.ok, true);
    assert.deepEqual(read.value, { files: {}, total: 2, reviewed: 0 });

    const toggled = await post(host, REVIEW_PATH, { sessionId: "s1", action: "toggle", kind: "commit", base: head, head, file: "one.txt" });
    assert.equal(toggled.ok, true);
    assert.equal(toggled.value.total, 2, "total is the commit file count");
    assert.equal(toggled.value.reviewed, 1);
    assert.equal(typeof toggled.value.files["one.txt"], "number");

    const readAgain = await post(host, REVIEW_PATH, { sessionId: "s1", action: "read", kind: "commit", base: head, head });
    assert.equal(readAgain.value.reviewed, 1);
    assert.equal("one.txt" in readAgain.value.files, true);

    const untoggled = await post(host, REVIEW_PATH, { sessionId: "s1", action: "toggle", kind: "commit", base: head, head, file: "one.txt" });
    assert.equal(untoggled.value.reviewed, 0);
    assert.deepEqual(untoggled.value.files, {});

    const compareToggle = await post(host, REVIEW_PATH, { sessionId: "s1", action: "toggle", kind: "compare", base, head, file: "one.txt" });
    assert.equal(compareToggle.value.total, 2, "total is the compare file count");
    assert.equal(compareToggle.value.reviewed, 1);
    const compareRead = await post(host, REVIEW_PATH, { sessionId: "s1", action: "read", kind: "compare", base, head });
    assert.equal(compareRead.value.total, 2);
    assert.equal(compareRead.value.reviewed, 1);

    const cleared = await post(host, REVIEW_PATH, { sessionId: "s1", action: "clear", kind: "commit", base: head, head });
    assert.deepEqual(cleared.value, { files: {}, total: 0, reviewed: 0 });
    const afterClear = await post(host, REVIEW_PATH, { sessionId: "s1", action: "read", kind: "commit", base: head, head });
    assert.deepEqual(afterClear.value.files, {});
    assert.equal(afterClear.value.total, 2, "total stays authoritative after clear");
    assert.equal(storage.records.get("s1").entries.length, 1, "only the compare entry remains");
  } finally {
    host.dispose();
  }
});

test("review storage prunes entries older than 90 days and caps at 200", async () => {
  const dir = createScratchRepo("review-prune");
  writeFile(path.join(dir, "a.txt"), "a\n");
  const head = commitAll(dir, "A");
  const now = Date.now();
  const hex = (value) => value.toString(16).padStart(40, "0");

  const storage = createFakeStorageDomain();
  storage.records.set("s2", {
    entries: [
      { kind: "compare", base: "a".repeat(40), head: "b".repeat(40), files: {}, updatedAt: now - 91 * 24 * 60 * 60 * 1000 },
      { kind: "compare", base: "c".repeat(40), head: "d".repeat(40), files: {}, updatedAt: now - 1000 },
    ],
  });
  const pruneHost = createHost({ config: undefined, defaultDirectory: dir, storageDomain: storage.service });
  try {
    const read = await post(pruneHost, REVIEW_PATH, { sessionId: "s2", action: "read", kind: "commit", base: head, head });
    assert.equal(read.ok, true);
    const stored = storage.records.get("s2");
    assert.equal(stored.entries.length, 1, "the expired entry is dropped on read");
    assert.equal(stored.entries[0].base, "c".repeat(40));
  } finally {
    pruneHost.dispose();
  }

  const capStorage = createFakeStorageDomain();
  const seeded = [];
  for (let index = 0; index < 200; index += 1) {
    seeded.push({ kind: "compare", base: hex(index), head: hex(index + 1), files: {}, updatedAt: now - (200 - index) * 1000 });
  }
  capStorage.records.set("s3", { entries: seeded });
  const capHost = createHost({ config: undefined, defaultDirectory: dir, storageDomain: capStorage.service });
  try {
    const toggled = await post(capHost, REVIEW_PATH, {
      sessionId: "s3",
      action: "toggle",
      kind: "commit",
      base: head,
      head,
      file: "a.txt",
    });
    assert.equal(toggled.ok, true);
    const stored = capStorage.records.get("s3");
    assert.equal(stored.entries.length, 200, "the per-session cap keeps the newest 200 entries");
    assert.equal(stored.entries.some((entry) => entry.base === hex(0)), false, "the oldest entry is dropped");
    assert.equal(stored.entries.some((entry) => entry.kind === "commit"), true, "the new entry is kept");
  } finally {
    capHost.dispose();
  }
});

test("review route returns UNAVAILABLE without storageDomain and BAD_REQUEST for invalid input", async () => {
  const dir = createScratchRepo("review-errors");
  writeFile(path.join(dir, "a.txt"), "a\n");
  const head = commitAll(dir, "A");

  const noStorageHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const unavailable = await post(noStorageHost, REVIEW_PATH, { sessionId: "s0", action: "read", kind: "commit", base: head, head });
    assert.equal(unavailable.ok, false);
    assert.equal(unavailable.error.code, "UNAVAILABLE");
    const badAction = await post(noStorageHost, REVIEW_PATH, { action: "explode", kind: "commit", base: head, head });
    assert.equal(badAction.error.code, "BAD_REQUEST", "validation wins over storage availability");
  } finally {
    noStorageHost.dispose();
  }

  const storage = createFakeStorageDomain();
  const host = createHost({ config: undefined, defaultDirectory: dir, storageDomain: storage.service });
  try {
    assert.equal((await post(host, REVIEW_PATH, { action: "read", kind: "review", base: head, head })).error.code, "BAD_REQUEST");
    assert.equal((await post(host, REVIEW_PATH, { action: "read", kind: "commit", base: "-x", head: "-x" })).error.code, "BAD_REQUEST");
    assert.equal((await post(host, REVIEW_PATH, { action: "read", kind: "commit", base: "HEAD", head })).error.code, "BAD_REQUEST");
    assert.equal((await post(host, REVIEW_PATH, { action: "toggle", kind: "commit", base: head, head })).error.code, "BAD_REQUEST");
    assert.equal((await post(host, REVIEW_PATH, { action: "toggle", kind: "commit", base: head, head, file: "-x" })).error.code, "BAD_REQUEST");
    assert.equal((await post(host, REVIEW_PATH, { action: "read", kind: "commit" })).error.code, "BAD_REQUEST");
    const read = await post(host, REVIEW_PATH, { action: "read", kind: "commit", base: head, head });
    assert.equal(read.value.total, 1);
  } finally {
    host.dispose();
  }
});

test("git_graph still exposes only five read-only actions after wave 6", async () => {
  const tool = host.tools[0];
  assert.deepEqual(tool.parameters.properties.action.enum, ["log", "show", "diff", "branches", "status"]);
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ["action", "commit", "file", "limit"]);
  const exec = { agent: { session: { header: { cwd: fixture.repo } } } };
  await assert.rejects(tool.execute({ action: "review" }, exec), /unknown git_graph action/);
  await assert.rejects(tool.execute({ action: "repos" }, exec), /unknown git_graph action/);
  const log = await tool.execute({ action: "log", limit: 2 }, exec);
  assert.equal(log.action, "log");
});

// ---------------------------------------------------------------------------
// Wave 7: push to multiple remotes
// ---------------------------------------------------------------------------

test("pushToMultipleRemotes pushes a branch to every remote and reports partial failures", async () => {
  const dir = createScratchRepo("multi-push");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");
  runGit(["switch", "-q", "-c", "release"], dir);
  const releaseHash = headOf(dir);
  const bareOne = createBareRemote("multi-push-one.git");
  const bareTwo = createBareRemote("multi-push-two.git");
  runGit(["remote", "add", "one", bareOne], dir);
  runGit(["remote", "add", "two", bareTwo], dir);

  // Both remotes receive the branch.
  const both = await api.performAction(dir, "pushToMultipleRemotes", { branch: "release", remotes: ["one", "two"] });
  assert.equal(both.message, "pushed 2/2 remotes");
  assert.deepEqual(both.output.split("\n"), ["one: ok", "two: ok"]);
  assert.equal(runGit(["rev-parse", "release"], bareOne).trim(), releaseHash);
  assert.equal(runGit(["rev-parse", "release"], bareTwo).trim(), releaseHash);

  // A failing remote is reported without stopping the remaining ones.
  runGit(["remote", "add", "broken", path.join(fixture.root, "multi-push-missing.git")], dir);
  const partial = await api.performAction(dir, "pushToMultipleRemotes", { branch: "release", remotes: ["one", "broken", "two"] });
  assert.equal(partial.message, "pushed 2/3 remotes");
  const partialLines = partial.output.split("\n");
  assert.equal(partialLines.length, 3);
  assert.equal(partialLines[0], "one: ok");
  assert.match(partialLines[1], /^broken: failed \(/);
  assert.equal(partialLines[2], "two: ok", "the remote after the failure is still pushed");

  // Zero successes is a failed action with every per-remote line in the error output.
  runGit(["remote", "add", "broken2", path.join(fixture.root, "multi-push-missing-two.git")], dir);
  await assert.rejects(api.performAction(dir, "pushToMultipleRemotes", { branch: "release", remotes: ["broken", "broken2"] }), (error) => {
    assert.equal(error.code, "GIT_FAILED");
    assert.equal(error.message, "pushed 0/2 remotes");
    const failureLines = error.stderr.split("\n");
    assert.equal(failureLines.length, 2);
    assert.match(failureLines[0], /^broken: failed \(/);
    assert.match(failureLines[1], /^broken2: failed \(/);
    return true;
  });

  const routeHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const viaRoute = await post(routeHost, ACTION_PATH, { action: "pushToMultipleRemotes", branch: "release", remotes: ["one", "broken"] });
    assert.equal(viaRoute.ok, true);
    assert.equal(viaRoute.value.message, "pushed 1/2 remotes");
    assert.match(viaRoute.value.output, /^one: ok$/m);
    assert.match(viaRoute.value.output, /^broken: failed \(/m);

    const allFailed = await post(routeHost, ACTION_PATH, { action: "pushToMultipleRemotes", branch: "release", remotes: ["broken", "broken2"] });
    assert.equal(allFailed.ok, false);
    assert.equal(allFailed.error.code, "GIT_FAILED");
    assert.equal(allFailed.error.message, "pushed 0/2 remotes");
    assert.equal(typeof allFailed.error.output, "string");
    assert.match(allFailed.error.output, /^broken: failed \(/m);
    assert.match(allFailed.error.output, /^broken2: failed \(/m);
  } finally {
    routeHost.dispose();
  }

  const badRequests = [
    { branch: "release" },
    { remotes: ["one"] },
    { branch: "release", remotes: [] },
    { branch: "release", remotes: "one" },
    { branch: "release", remotes: ["one", "-bad"] },
    { branch: "release", remotes: ["one", "a..b"] },
    { branch: "release", remotes: [42] },
    { branch: "-bad", remotes: ["one"] },
    { branch: "release", remotes: Array.from({ length: 11 }, (_, index) => `remote-${index}`) },
  ];
  for (const args of badRequests) {
    await assert.rejects(api.performAction(dir, "pushToMultipleRemotes", args), (error) => error.code === "BAD_REQUEST", JSON.stringify(args));
  }
  await assert.rejects(api.performAction(fixture.empty, "pushToMultipleRemotes", { branch: "main", remotes: ["one"] }), (error) => error.code === "NOT_A_REPO");
});

test("git_graph stays five read-only actions after multi-remote push", async () => {
  const tool = host.tools[0];
  assert.deepEqual(tool.parameters.properties.action.enum, ["log", "show", "diff", "branches", "status"]);
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ["action", "commit", "file", "limit"]);
  const exec = { agent: { session: { header: { cwd: fixture.repo } } } };
  await assert.rejects(tool.execute({ action: "pushToMultipleRemotes" }, exec), /unknown git_graph action/);
  const log = await tool.execute({ action: "log", limit: 2 }, exec);
  assert.equal(log.action, "log");
});


// ---------------------------------------------------------------------------
// Wave 8: full-history search and working-tree comparison
// ---------------------------------------------------------------------------

test("searchCommits matches message, author, short hash and ref facets", async () => {
  const dir = createScratchRepo("search-facets");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "Root commit for search");
  writeFile(path.join(dir, "b.txt"), "b\n");
  const target = commitAll(dir, "Alpha subject with marker", "Body mentions the Lobster bisque.");
  runGit(["branch", "wave-search-ref"], dir);
  runGit(["tag", "search-tag-v1"], dir);
  writeFile(path.join(dir, "c.txt"), "c\n");
  commitAll(dir, "Third unrelated commit");

  const hashes = (value) => value.commits.map((commit) => commit.hash);

  const byBody = await api.searchCommits(dir, { query: "lobster", scope: "message" });
  assert.equal(byBody.isRepo, true);
  assert.equal(byBody.query, "lobster");
  assert.equal(byBody.scope, "message");
  assert.deepEqual(hashes(byBody), [target], "the message scope searches the commit body");

  const bySubject = await api.searchCommits(dir, { query: "ALPHA SUBJECT", scope: "message" });
  assert.deepEqual(hashes(bySubject), [target], "matching is case-insensitive");

  const byAuthorEmail = await api.searchCommits(dir, { query: "graph@example.com", scope: "author" });
  assert.equal(byAuthorEmail.commits.length, 3);
  const byAuthorName = await api.searchCommits(dir, { query: "graph test", scope: "author" });
  assert.equal(byAuthorName.commits.length, 3);

  const bodyIsNotAuthor = await api.searchCommits(dir, { query: "lobster", scope: "author" });
  assert.deepEqual(bodyIsNotAuthor.commits, [], "the author scope ignores the message");
  const bodyIsNotRef = await api.searchCommits(dir, { query: "lobster", scope: "ref" });
  assert.deepEqual(bodyIsNotRef.commits, [], "the ref scope ignores the message");

  const byHash = await api.searchCommits(dir, { query: target.slice(0, 7), scope: "all" });
  assert.deepEqual(hashes(byHash), [target], "all searches the short hash");
  assert.equal(byHash.commits[0].abbrev, target.slice(0, 7));

  const byBranchRef = await api.searchCommits(dir, { query: "wave-search-ref", scope: "ref" });
  assert.deepEqual(hashes(byBranchRef), [target]);
  const byTagRef = await api.searchCommits(dir, { query: "search-tag-v1", scope: "ref" });
  assert.deepEqual(hashes(byTagRef), [target]);
  const refIsNotMessage = await api.searchCommits(dir, { query: "wave-search-ref", scope: "message" });
  assert.deepEqual(refIsNotMessage.commits, []);

  const allDefaulted = await api.searchCommits(dir, { query: "lobster" });
  assert.equal(allDefaulted.scope, "all", "the scope defaults to all");
  assert.deepEqual(hashes(allDefaulted), [target]);

  /* A search hit must be the exact graph row shape so existing row components render it. */
  const graph = await api.readGraph(dir, { maxCommits: 50 });
  const row = graph.commits.find((commit) => commit.hash === target);
  assert.deepEqual(allDefaulted.commits[0], row);
  assert.deepEqual(Object.keys(allDefaulted.commits[0]).sort(), Object.keys(row).sort());

  const none = await api.searchCommits(dir, { query: "no-such-token-anywhere" });
  assert.deepEqual(none.commits, []);
  assert.equal(none.hasMore, false);
  assert.equal(none.scanned, 3);
  assert.equal(none.capped, false);
});

test("searchCommits paginates with offset/limit and reports hasMore", async () => {
  const dir = createScratchRepo("search-pages");
  const hashes = [];
  for (let index = 0; index < 5; index += 1) {
    writeFile(path.join(dir, `file-${index}.txt`), `${index}\n`);
    hashes.push(commitAll(dir, `shared token commit ${index}`));
  }

  const first = await api.searchCommits(dir, { query: "shared token", limit: 2 });
  assert.deepEqual(first.commits.map((commit) => commit.hash), [hashes[4], hashes[3]]);
  assert.equal(first.offset, 0);
  assert.equal(first.limit, 2);
  assert.equal(first.hasMore, true);
  assert.equal(first.scanned, 5);
  assert.equal(first.capped, false);

  const second = await api.searchCommits(dir, { query: "shared token", limit: 2, offset: 2 });
  assert.deepEqual(second.commits.map((commit) => commit.hash), [hashes[2], hashes[1]]);
  assert.equal(second.offset, 2);
  assert.equal(second.hasMore, true);

  const last = await api.searchCommits(dir, { query: "shared token", limit: 2, offset: 4 });
  assert.deepEqual(last.commits.map((commit) => commit.hash), [hashes[0]]);
  assert.equal(last.hasMore, false);

  const beyond = await api.searchCommits(dir, { query: "shared token", limit: 2, offset: 10 });
  assert.deepEqual(beyond.commits, []);
  assert.equal(beyond.hasMore, false);
});

test("searchCommits scans at most SEARCH_SCAN_LIMIT commits and marks capped", async () => {
  const hash = "a".repeat(40);
  const record = [
    hash,
    "",
    "Graph Test",
    "graph@example.com",
    "1700000100",
    "Graph Test",
    "graph@example.com",
    "1700000100",
    "HEAD -> main, tag: v1",
    "needle subject",
    "needle body",
  ].join(FIELD);
  const records = new Array(SEARCH_SCAN_LIMIT).fill(record);
  const calls = [];
  const fakeApi = createGitApi(async (argv) => {
    calls.push([...argv]);
    if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel") return { stdout: "/fake/repo\n", stderr: "", code: 0 };
    if (argv[0] === "log") return { stdout: `${records.join(NUL)}${NUL}`, stderr: "", code: 0 };
    return { stdout: "", stderr: "", code: 0 };
  });

  const value = await fakeApi.searchCommits("/fake/repo", { query: "needle", limit: 2 });
  assert.equal(value.isRepo, true);
  assert.equal(value.scanned, SEARCH_SCAN_LIMIT);
  assert.equal(value.capped, true, "hitting the scan limit is reported");
  assert.equal(value.commits.length, 2);
  assert.equal(value.hasMore, true);
  assert.equal(value.commits[0].abbrev, hash.slice(0, 7));
  assert.deepEqual(value.commits[0].refs, ["HEAD", "main", "tag: v1"]);

  const logCall = calls.find((argv) => argv[0] === "log");
  assert.deepEqual(logCall.slice(0, 2), ["log", "--all"]);
  assert.ok(logCall.includes("--date-order"));
  assert.equal(logCall[logCall.indexOf("-n") + 1], String(SEARCH_SCAN_LIMIT));
  assert.equal(logCall.includes("--use-mailmap"), false);
  const format = logCall.find((argument) => argument.startsWith("--format="));
  assert.ok(format.includes("%H"));
  assert.ok(format.includes("%b"), "the search format carries the body");

  calls.length = 0;
  await fakeApi.searchCommits("/fake/repo", { query: "needle", limit: 1, useMailmap: true });
  const mailmapLog = calls.find((argv) => argv[0] === "log");
  assert.ok(mailmapLog.includes("--use-mailmap"));
  assert.ok(mailmapLog.find((argument) => argument.startsWith("--format=")).includes("%aN"));
});

test("searchCommits outside a repository succeeds and validates every request field", async () => {
  const outside = await api.searchCommits(fixture.empty, { query: "  orphan  " });
  assert.deepEqual(outside, {
    isRepo: false,
    query: "orphan",
    scope: "all",
    commits: [],
    offset: 0,
    limit: 50,
    hasMore: false,
    scanned: 0,
    capped: false,
  });

  const badRequests = [
    [{}, /query/],
    [{ query: "" }, /query/],
    [{ query: "   " }, /query/],
    [{ query: "x".repeat(201) }, /query/],
    [{ query: 42 }, /query/],
    [{ query: "x", scope: "subject" }, /scope/],
    [{ query: "x", scope: 7 }, /scope/],
    [{ query: "x", limit: 0 }, /limit/],
    [{ query: "x", limit: 201 }, /limit/],
    [{ query: "x", limit: "10" }, /limit/],
    [{ query: "x", limit: 1.5 }, /limit/],
    [{ query: "x", offset: -1 }, /offset/],
    [{ query: "x", offset: "0" }, /offset/],
    [{ query: "x", offset: 1.5 }, /offset/],
  ];
  for (const [options, pattern] of badRequests) {
    await assert.rejects(
      api.searchCommits(fixture.empty, options),
      (error) => error.code === "BAD_REQUEST" && pattern.test(error.message),
      JSON.stringify(options),
    );
  }

  const atLimit = await api.searchCommits(fixture.empty, { query: "x".repeat(200) });
  assert.equal(atLimit.query.length, 200);
});

test("search route returns the contract value and validation envelopes", async () => {
  const dir = createScratchRepo("route-search");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "Route root");
  writeFile(path.join(dir, "b.txt"), "b\n");
  const first = commitAll(dir, "Route needle one");
  writeFile(path.join(dir, "c.txt"), "c\n");
  const second = commitAll(dir, "Route needle two", "Body needle two.");
  runGit(["branch", "route-search-branch"], dir);

  const scratchHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const envelope = await post(scratchHost, SEARCH_PATH, { query: "  needle  " });
    assert.equal(envelope.ok, true);
    assert.equal(envelope.value.isRepo, true);
    assert.equal(envelope.value.query, "needle", "the route trims the query");
    assert.equal(envelope.value.scope, "all");
    assert.equal(envelope.value.limit, 50);
    assert.equal(envelope.value.offset, 0);
    assert.equal(envelope.value.hasMore, false);
    assert.equal(envelope.value.capped, false);
    assert.equal(envelope.value.scanned, 3);
    assert.deepEqual(envelope.value.commits.map((commit) => commit.hash), [second, first]);

    const page = await post(scratchHost, SEARCH_PATH, { query: "route needle", limit: 1 });
    assert.equal(page.ok, true);
    assert.deepEqual(page.value.commits.map((commit) => commit.hash), [second]);
    assert.equal(page.value.hasMore, true);
    const secondPage = await post(scratchHost, SEARCH_PATH, { query: "route needle", limit: 1, offset: 1 });
    assert.deepEqual(secondPage.value.commits.map((commit) => commit.hash), [first]);
    assert.equal(secondPage.value.hasMore, false);

    const byAuthor = await post(scratchHost, SEARCH_PATH, { query: "graph@example.com", scope: "author" });
    assert.equal(byAuthor.value.commits.length, 3);

    const badRequests = [
      [{}, /query/],
      [{ query: "  " }, /query/],
      [{ query: "x".repeat(201) }, /query/],
      [{ query: "x", scope: "subject" }, /scope/],
      [{ query: "x", limit: 0 }, /limit/],
      [{ query: "x", limit: 201 }, /limit/],
      [{ query: "x", limit: "10" }, /limit/],
      [{ query: "x", offset: -1 }, /offset/],
      [{ query: "x", offset: "0" }, /offset/],
    ];
    for (const [body, pattern] of badRequests) {
      const rejected = await post(scratchHost, SEARCH_PATH, body);
      assert.equal(rejected.ok, false, JSON.stringify(body));
      assert.equal(rejected.error.code, "BAD_REQUEST", JSON.stringify(body));
      assert.match(rejected.error.message, pattern);
    }

    const outside = createHost({ config: undefined, defaultDirectory: fixture.empty });
    try {
      const notRepo = await post(outside, SEARCH_PATH, { query: "anything" });
      assert.equal(notRepo.ok, true);
      assert.equal(notRepo.value.isRepo, false);
      assert.deepEqual(notRepo.value.commits, []);
      assert.equal(notRepo.value.scanned, 0);
      assert.equal(notRepo.value.capped, false);
      assert.equal(notRepo.value.limit, 50);
    } finally {
      outside.dispose();
    }
  } finally {
    scratchHost.dispose();
  }
});

test("compareCommits working mode includes tracked, staged and untracked changes", async () => {
  const dir = createScratchRepo("compare-working");
  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\n");
  writeFile(path.join(dir, "delete-me.txt"), "gone\n");
  const base = commitAll(dir, "base");

  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\nthree\n");
  writeFile(path.join(dir, "staged.txt"), "staged\n");
  runGit(["add", "staged.txt"], dir);
  fs.rmSync(path.join(dir, "delete-me.txt"));
  writeFile(path.join(dir, "untracked.txt"), "untracked line\n");
  writeFile(path.join(dir, "untracked-empty.txt"), "");
  writeFile(path.join(dir, "untracked-bin.dat"), Buffer.from([0, 1, 2, 3]));

  const value = await api.compareCommits(dir, { base, working: true, head: "does-not-exist" });
  assert.equal(value.working, true);
  assert.equal(value.head, null, "working comparisons ignore head");
  assert.equal(value.base, base);
  assert.equal(value.baseAbbrev, base.slice(0, 7));
  assert.equal(value.stats.files, value.files.length);
  assert.equal(
    value.stats.insertions,
    value.files.reduce((total, file) => total + file.added, 0),
  );
  assert.equal(
    value.stats.deletions,
    value.files.reduce((total, file) => total + file.removed, 0),
  );

  const byPath = new Map(value.files.map((file) => [file.path, file]));
  assert.deepEqual(byPath.get("tracked.txt"), { status: "M", path: "tracked.txt", oldPath: null, added: 1, removed: 0, binary: false });
  assert.deepEqual(byPath.get("staged.txt"), { status: "A", path: "staged.txt", oldPath: null, added: 1, removed: 0, binary: false });
  assert.deepEqual(byPath.get("delete-me.txt"), { status: "D", path: "delete-me.txt", oldPath: null, added: 0, removed: 1, binary: false });
  assert.deepEqual(byPath.get("untracked.txt"), { status: "A", path: "untracked.txt", oldPath: null, added: 1, removed: 0, binary: false });
  assert.deepEqual(byPath.get("untracked-empty.txt"), { status: "A", path: "untracked-empty.txt", oldPath: null, added: 0, removed: 0, binary: false });
  assert.deepEqual(byPath.get("untracked-bin.dat"), { status: "A", path: "untracked-bin.dat", oldPath: null, added: 0, removed: 0, binary: true });

  const commitForm = await api.compareCommits(dir, { base, head: base });
  assert.deepEqual(commitForm.files, [], "the {base, head} form is unchanged");
  assert.equal(commitForm.working, undefined);

  await assert.rejects(api.compareCommits(dir, { working: true }), (error) => error.code === "BAD_REQUEST" && /base/.test(error.message));
  await assert.rejects(api.compareCommits(dir, { base, working: "yes" }), (error) => error.code === "BAD_REQUEST" && /working/.test(error.message));
  await assert.rejects(api.compareCommits(dir, { base: "-rf", working: true }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.compareCommits(dir, { base: "does-not-exist", working: true }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.compareCommits(fixture.empty, { base, working: true }), (error) => error.code === "NOT_A_REPO");
});

test("compare route forwards working:true and handles a repository without HEAD", async () => {
  const dir = createScratchRepo("route-compare-working");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  const base = commitAll(dir, "base");
  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\n");
  writeFile(path.join(dir, "untracked.txt"), "new\n");

  const scratchHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const envelope = await post(scratchHost, COMPARE_PATH, { base, working: true });
    assert.equal(envelope.ok, true);
    assert.equal(envelope.value.working, true);
    assert.equal(envelope.value.head, null);
    assert.equal(envelope.value.base, base);
    assert.equal(envelope.value.baseAbbrev, base.slice(0, 7));
    const byPath = new Map(envelope.value.files.map((file) => [file.path, file]));
    assert.equal(byPath.get("tracked.txt").status, "M");
    assert.deepEqual(byPath.get("untracked.txt"), {
      status: "A",
      path: "untracked.txt",
      oldPath: null,
      added: 1,
      removed: 0,
      binary: false,
    });
    assert.equal(envelope.value.stats.files, envelope.value.files.length);

    const commitForm = await post(scratchHost, COMPARE_PATH, { base, head: base });
    assert.equal(commitForm.ok, true);
    assert.equal(commitForm.value.working, undefined);
    assert.deepEqual(commitForm.value.files, []);

    const missingBase = await post(scratchHost, COMPARE_PATH, { working: true });
    assert.equal(missingBase.ok, false);
    assert.equal(missingBase.error.code, "BAD_REQUEST");
    assert.match(missingBase.error.message, /base/);
    const badWorking = await post(scratchHost, COMPARE_PATH, { base, working: "yes" });
    assert.equal(badWorking.ok, false);
    assert.equal(badWorking.error.code, "BAD_REQUEST");
    assert.match(badWorking.error.message, /working/);
    const unsafeBase = await post(scratchHost, COMPARE_PATH, { base: "-rf", working: true });
    assert.equal(unsafeBase.ok, false);
    assert.equal(unsafeBase.error.code, "BAD_REQUEST");
  } finally {
    scratchHost.dispose();
  }

  const unborn = createScratchRepo("route-compare-unborn");
  writeFile(path.join(unborn, "loose.txt"), "loose\n");
  const unbornHost = createHost({ config: undefined, defaultDirectory: unborn });
  try {
    const envelope = await post(unbornHost, COMPARE_PATH, { base: "HEAD", working: true });
    assert.equal(envelope.ok, true);
    assert.deepEqual(envelope.value, {
      working: true,
      head: null,
      base: null,
      baseAbbrev: null,
      stats: { files: 0, insertions: 0, deletions: 0 },
      files: [],
    });
    const apiValue = await api.compareCommits(unborn, { base: "HEAD", working: true });
    assert.deepEqual(apiValue, envelope.value);
  } finally {
    unbornHost.dispose();
  }
});

test("readDiff working scope diffs against the commit and renders untracked additions", async () => {
  const dir = createScratchRepo("diff-working");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  writeFile(path.join(dir, "remove-me.txt"), "gone\n");
  const base = commitAll(dir, "base");
  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\n");
  runGit(["rm", "-q", "remove-me.txt"], dir);
  writeFile(path.join(dir, "untracked.txt"), "alpha\nbeta\n");
  writeFile(path.join(dir, "empty.txt"), "");
  writeFile(path.join(dir, "bin.dat"), Buffer.from([0, 1, 2, 3]));

  const tracked = await api.readDiff(dir, { scope: "working", hash: base, path: "tracked.txt" });
  assert.equal(tracked.binary, false);
  assert.equal(tracked.truncated, false);
  assert.match(tracked.patch, /^\+two$/m);

  const untracked = await api.readDiff(dir, { scope: "working", hash: base, path: "untracked.txt" });
  assert.equal(untracked.binary, false);
  assert.match(untracked.patch, /^new file mode 100644$/m);
  assert.match(untracked.patch, /^\+alpha$/m);
  assert.match(untracked.patch, /^\+beta$/m);

  const empty = await api.readDiff(dir, { scope: "working", hash: base, path: "empty.txt" });
  assert.equal(empty.binary, false);
  assert.match(empty.patch, /^diff --git /m);
  assert.equal(/^@@/m.test(empty.patch), false, "an empty untracked file keeps zero hunks");

  const deleted = await api.readDiff(dir, { scope: "working", hash: base, path: "remove-me.txt" });
  assert.equal(deleted.binary, false);
  assert.match(deleted.patch, /^deleted file mode 100644$/m);
  assert.match(deleted.patch, /^-gone$/m);

  const binary = await api.readDiff(dir, { scope: "working", hash: base, path: "bin.dat" });
  assert.equal(binary.binary, true);
  assert.equal(binary.patch, "");

  await assert.rejects(api.readDiff(dir, { scope: "working", path: "tracked.txt" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(api.readDiff(dir, { scope: "working", hash: "does-not-exist", path: "tracked.txt" }), (error) => error.code === "GIT_FAILED");
  await assert.rejects(api.readDiff(fixture.empty, { scope: "working", hash: base, path: "tracked.txt" }), (error) => error.code === "NOT_A_REPO");
});

test("diff route accepts the working scope and requires its hash", async () => {
  const dir = createScratchRepo("route-diff-working");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  const base = commitAll(dir, "base");
  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\n");
  writeFile(path.join(dir, "untracked.txt"), "route new\n");

  const scratchHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const tracked = await post(scratchHost, DIFF_PATH, { scope: "working", hash: base, file: "tracked.txt" });
    assert.equal(tracked.ok, true);
    assert.match(tracked.value.patch, /^\+two$/m);

    const untracked = await post(scratchHost, DIFF_PATH, { scope: "working", hash: base, file: "untracked.txt" });
    assert.equal(untracked.ok, true);
    assert.match(untracked.value.patch, /^\+route new$/m);

    const missingHash = await post(scratchHost, DIFF_PATH, { scope: "working", file: "tracked.txt" });
    assert.equal(missingHash.ok, false);
    assert.equal(missingHash.error.code, "BAD_REQUEST");
    assert.match(missingHash.error.message, /hash/);
  } finally {
    scratchHost.dispose();
  }
});


// ---------------------------------------------------------------------------
// Wave 8-B: settings module wired into the host
// ---------------------------------------------------------------------------

test("graph settings: order default, initialLoad page size and maxCommits precedence", async () => {
  const dir = createScratchRepo("settings-order");
  writeFile(path.join(dir, "root.txt"), "root\n");
  commitAt(dir, 1_700_000_100, "root");
  runGit(["switch", "-q", "-c", "feature"], dir);
  writeFile(path.join(dir, "f1.txt"), "f1\n");
  commitAt(dir, 1_700_000_300, "feature one");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "m1.txt"), "m1\n");
  commitAt(dir, 1_700_000_200, "main one");
  runGit(["switch", "-q", "feature"], dir);
  writeFile(path.join(dir, "f2.txt"), "f2\n");
  commitAt(dir, 1_700_000_500, "feature two");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "m2.txt"), "m2\n");
  commitAt(dir, 1_700_000_400, "main two");
  const mergeDate = gitDate(1_700_000_600);
  runGit(["merge", "-q", "--no-ff", "feature", "-m", "merge feature"], dir, {
    GIT_AUTHOR_DATE: mergeDate,
    GIT_COMMITTER_DATE: mergeDate,
  });

  const subjects = (value) => value.commits.map((commit) => commit.subject);
  const dateSubjects = subjects(await api.readGraph(dir, { maxCommits: 50, order: "date" }));
  const topoSubjects = subjects(await api.readGraph(dir, { maxCommits: 50, order: "topo" }));
  assert.notDeepEqual(dateSubjects, topoSubjects, "the fixture distinguishes date and topo order");

  const topoHost = createHost({ config: { "repository.commits.order": "topo" }, defaultDirectory: dir });
  try {
    assert.deepEqual(subjects((await post(topoHost, GRAPH_PATH, {})).value), topoSubjects, "the configured order is the default");
    assert.deepEqual(subjects((await post(topoHost, GRAPH_PATH, { order: "date" })).value), dateSubjects, "a request order still wins");
  } finally {
    topoHost.dispose();
  }

  const legacyOrderHost = createHost({ config: { commitOrdering: "topo" }, defaultDirectory: dir });
  try {
    assert.deepEqual(subjects((await post(legacyOrderHost, GRAPH_PATH, {})).value), topoSubjects, "the legacy flat alias folds in");
  } finally {
    legacyOrderHost.dispose();
  }

  const invalidOrderHost = createHost({ config: { "repository.commits.order": "sideways" }, defaultDirectory: dir });
  try {
    assert.deepEqual(subjects((await post(invalidOrderHost, GRAPH_PATH, {})).value), dateSubjects, "an unknown configured order falls back to date");
  } finally {
    invalidOrderHost.dispose();
  }

  /* 305 commits make the initialLoad default (300) observable. */
  const pageDir = createScratchRepo("settings-initial-load");
  importLinearHistory(pageDir, 305);
  const pageOf = async (config, body = {}) => {
    const pageHost = createHost({ config, defaultDirectory: pageDir });
    try {
      return (await post(pageHost, GRAPH_PATH, body)).value;
    } finally {
      pageHost.dispose();
    }
  };
  const defaultPage = await pageOf(undefined);
  assert.equal(defaultPage.commits.length, 300, "repository.commits.initialLoad defaults to 300");
  assert.equal(defaultPage.truncated, true);
  const configuredPage = await pageOf({ "repository.commits.initialLoad": 12 });
  assert.equal(configuredPage.commits.length, 12);
  const invalidPage = await pageOf({ "repository.commits.initialLoad": "many" });
  assert.equal(invalidPage.commits.length, 300, "an invalid initialLoad falls back to its default");
  const nonPositivePage = await pageOf({ "repository.commits.initialLoad": 0 });
  assert.equal(nonPositivePage.commits.length, 300, "a non-positive initialLoad falls back to its default");
  const legacyMax = await pageOf({ maxCommits: 4, "repository.commits.initialLoad": 12 });
  assert.equal(legacyMax.commits.length, 4, "the legacy maxCommits host key keeps precedence");
  const requestLimit = await pageOf({ "repository.commits.initialLoad": 12 }, { limit: 5 });
  assert.equal(requestLimit.commits.length, 5, "a request limit overrides the configured default");
});

test("graph settings: showTags, tag-only history and reflog commits", async () => {
  const dir = createScratchRepo("settings-refs");
  writeFile(path.join(dir, "root.txt"), "root\n");
  commitAll(dir, "root");
  runGit(["switch", "-q", "-c", "tag-only"], dir);
  writeFile(path.join(dir, "tag.txt"), "tag\n");
  commitAll(dir, "tag only commit");
  runGit(["tag", "v-tag-only"], dir);
  runGit(["switch", "-q", "main"], dir);
  runGit(["branch", "-q", "-D", "tag-only"], dir);
  runGit(["switch", "-q", "-c", "reflog-only"], dir);
  writeFile(path.join(dir, "reflog.txt"), "reflog\n");
  commitAll(dir, "reflog only commit");
  runGit(["switch", "-q", "main"], dir);
  runGit(["branch", "-q", "-D", "reflog-only"], dir);

  const graphOf = async (config) => {
    const graphHost = createHost({ config, defaultDirectory: dir });
    try {
      return (await post(graphHost, GRAPH_PATH, {})).value;
    } finally {
      graphHost.dispose();
    }
  };

  const defaultGraph = await graphOf(undefined);
  assert.ok(defaultGraph.commits.some((commit) => commit.subject === "tag only commit"), "tags are walked by default");
  assert.equal(defaultGraph.commits.some((commit) => commit.subject === "reflog only commit"), false, "reflog-only commits are off by default");
  assert.ok(defaultGraph.refs.some((ref) => ref.type === "tag" && ref.shortName === "v-tag-only"));
  assert.ok(defaultGraph.commits.some((commit) => commit.refs.includes("tag: v-tag-only")));

  const noTags = await graphOf({ "repository.showTags": false });
  assert.equal(noTags.commits.some((commit) => commit.subject === "tag only commit"), false, "showTags:false drops the tag walk");
  assert.equal(noTags.refs.some((ref) => ref.type === "tag"), false);
  assert.equal(noTags.commits.some((commit) => commit.refs.some((chip) => chip.startsWith("tag: "))), false);
  const legacyNoTags = await graphOf({ showTags: false });
  assert.equal(legacyNoTags.commits.some((commit) => commit.subject === "tag only commit"), false, "the legacy flat alias folds in");

  const tagsOnlyReferenced = await graphOf({ "repository.showCommitsOnlyReferencedByTags": false });
  assert.equal(tagsOnlyReferenced.commits.some((commit) => commit.subject === "tag only commit"), false);
  assert.ok(tagsOnlyReferenced.refs.some((ref) => ref.type === "tag"), "tag refs stay when only the tag walk is disabled");

  const reflog = await graphOf({ "repository.includeCommitsMentionedByReflogs": true });
  assert.ok(reflog.commits.some((commit) => commit.subject === "reflog only commit"), "the reflog setting adds reflog-only commits");
  assert.ok(reflog.commits.some((commit) => commit.subject === "tag only commit"), "tags stay walked too");

  const invalid = await graphOf({
    "repository.showTags": 7,
    "repository.showCommitsOnlyReferencedByTags": 7,
    "repository.includeCommitsMentionedByReflogs": 7,
  });
  assert.deepEqual(invalid.commits.map((commit) => commit.subject), defaultGraph.commits.map((commit) => commit.subject));
  assert.deepEqual(invalid.refs, defaultGraph.refs);
});

test("graph settings: onlyFollowFirstParent, showRemoteBranches and showRemoteHeads", async () => {
  const dir = createScratchRepo("settings-first-parent");
  writeFile(path.join(dir, "base.txt"), "base\n");
  commitAll(dir, "base");
  runGit(["switch", "-q", "-c", "feature"], dir);
  writeFile(path.join(dir, "feature.txt"), "feature\n");
  commitAll(dir, "feature commit");
  runGit(["switch", "-q", "main"], dir);
  writeFile(path.join(dir, "main.txt"), "main\n");
  commitAll(dir, "main commit");
  runGit(["merge", "-q", "--no-ff", "feature", "-m", "merge feature"], dir, nextDates());
  /* Deleting the side branch makes the merge's second parent the only path to it. */
  runGit(["branch", "-q", "-D", "feature"], dir);

  const graphOf = async (config, repo = dir) => {
    const graphHost = createHost({ config, defaultDirectory: repo });
    try {
      return (await post(graphHost, GRAPH_PATH, {})).value;
    } finally {
      graphHost.dispose();
    }
  };

  const full = await graphOf(undefined);
  assert.ok(full.commits.some((commit) => commit.subject === "feature commit"));
  const firstParent = await graphOf({ "repository.onlyFollowFirstParent": true });
  assert.equal(firstParent.commits.some((commit) => commit.subject === "feature commit"), false, "--first-parent hides side-branch commits");
  assert.ok(firstParent.commits.some((commit) => commit.subject === "merge feature"));
  assert.ok(firstParent.commits.some((commit) => commit.subject === "main commit"));
  assert.ok(firstParent.commits.some((commit) => commit.subject === "base"));
  const invalidFirstParent = await graphOf({ "repository.onlyFollowFirstParent": 7 });
  assert.deepEqual(invalidFirstParent.commits.map((commit) => commit.subject), full.commits.map((commit) => commit.subject));

  /* A clone carries refs/remotes/origin/HEAD, so both remote settings are observable. */
  const source = createScratchRepo("settings-remote-source");
  writeFile(path.join(source, "a.txt"), "a\n");
  commitAll(source, "remote base");
  const bare = createBareRemote("settings-remote.git");
  runGit(["remote", "add", "origin", bare], source);
  runGit(["push", "-q", "-u", "origin", "main"], source);
  const work = cloneFromRemote(bare, "settings-remote-work");

  const remoteRefs = (value) => value.refs.filter((ref) => ref.type === "remote");
  const remoteHeadChips = (value) => value.commits.flatMap((commit) => commit.refs).filter((chip) => /^[^/]+\/HEAD$/.test(chip));

  const remoteGraph = await graphOf(undefined, work);
  assert.ok(remoteRefs(remoteGraph).some((ref) => ref.shortName === "origin/main"));
  assert.ok(remoteRefs(remoteGraph).some((ref) => ref.shortName === "origin/HEAD"));
  assert.ok(remoteHeadChips(remoteGraph).length > 0, "the remote HEAD chip is shown by default");

  const withoutRemoteBranches = await graphOf({ "repository.showRemoteBranches": false }, work);
  assert.equal(withoutRemoteBranches.refs.some((ref) => ref.type === "remote"), false);
  assert.equal(withoutRemoteBranches.commits.some((commit) => commit.refs.some((chip) => chip.includes("origin/"))), false);
  const legacyWithoutRemotes = await graphOf({ showRemoteBranches: false }, work);
  assert.equal(legacyWithoutRemotes.refs.some((ref) => ref.type === "remote"), false, "the legacy host key still works");

  const withoutRemoteHeads = await graphOf({ "repository.showRemoteHeads": false }, work);
  assert.equal(remoteRefs(withoutRemoteHeads).some((ref) => ref.shortName.endsWith("/HEAD")), false);
  assert.ok(remoteRefs(withoutRemoteHeads).some((ref) => ref.shortName === "origin/main"), "other remote branches stay");
  assert.equal(remoteHeadChips(withoutRemoteHeads).length, 0, "remote HEAD decoration chips are filtered too");

  const invalidRemote = await graphOf({ "repository.showRemoteBranches": 7, "repository.showRemoteHeads": 7 }, work);
  assert.ok(remoteRefs(invalidRemote).some((ref) => ref.shortName === "origin/HEAD"), "invalid values fall back to defaults");
});

test("graph settings: showStashes canonical key", async () => {
  const dir = createScratchRepo("settings-stash");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  commitAll(dir, "base");
  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\n");
  runGit(["stash", "push", "-q", "-m", "settings stash"], dir);

  const graphOf = async (config) => {
    const graphHost = createHost({ config, defaultDirectory: dir });
    try {
      return (await post(graphHost, GRAPH_PATH, {})).value;
    } finally {
      graphHost.dispose();
    }
  };

  const shown = await graphOf(undefined);
  assert.equal(shown.stashes.length, 1);
  assert.ok(shown.refs.some((ref) => ref.type === "stash" && ref.shortName === "stash@{0}"));

  const hidden = await graphOf({ "repository.showStashes": false });
  assert.equal("stashes" in hidden, false);
  assert.equal(hidden.refs.some((ref) => ref.type === "stash"), false);

  const invalid = await graphOf({ "repository.showStashes": 7 });
  assert.equal(invalid.stashes.length, 1, "an invalid value falls back to true");
});

test("uncommitted settings: repository.showUntrackedFiles", async () => {
  const dir = createScratchRepo("settings-untracked");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  commitAll(dir, "base");
  writeFile(path.join(dir, "tracked.txt"), "one\ntwo\n");
  runGit(["add", "tracked.txt"], dir);
  writeFile(path.join(dir, "untracked.txt"), "new\n");

  const full = await api.readUncommitted(dir);
  assert.equal(full.counts.untracked, 1);
  const without = await api.readUncommitted(dir, { includeUntracked: false });
  assert.deepEqual(without.untracked, []);
  assert.equal(without.counts.untracked, 0);
  assert.equal(without.counts.staged, 1, "staged entries stay");

  const uncommittedOf = async (config) => {
    const uncommittedHost = createHost({ config, defaultDirectory: dir });
    try {
      return (await post(uncommittedHost, UNCOMMITTED_PATH, {})).value;
    } finally {
      uncommittedHost.dispose();
    }
  };
  assert.deepEqual((await uncommittedOf(undefined)).untracked, [{ status: "A", path: "untracked.txt", oldPath: null }]);
  const hidden = await uncommittedOf({ "repository.showUntrackedFiles": false });
  assert.deepEqual(hidden.untracked, []);
  assert.equal(hidden.counts.untracked, 0);
  assert.equal(hidden.counts.staged, 1);
  const legacyHidden = await uncommittedOf({ showUntrackedFiles: false });
  assert.deepEqual(legacyHidden.untracked, [], "the legacy flat alias folds in");
  const invalid = await uncommittedOf({ "repository.showUntrackedFiles": 7 });
  assert.equal(invalid.counts.untracked, 1, "an invalid value falls back to true");
});

test("fetch action prune flags are opt-in and never default to on", async () => {
  const calls = [];
  const fakeApi = createGitApi(async (argv) => {
    calls.push([...argv]);
    if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel") return { stdout: "/fake/repo\n", stderr: "", code: 0 };
    return { stdout: "", stderr: "", code: 0 };
  });
  const lastFetch = () => calls.filter((argv) => argv[0] === "fetch").pop();

  const plain = await fakeApi.performAction("/fake/repo", "fetch", {});
  assert.deepEqual(lastFetch(), ["fetch"]);
  assert.equal(plain.message, "Fetched from all remotes.");
  await fakeApi.performAction("/fake/repo", "fetch", { remote: "origin" });
  assert.deepEqual(lastFetch(), ["fetch", "origin"]);
  await fakeApi.performAction("/fake/repo", "fetch", { prune: true });
  assert.deepEqual(lastFetch(), ["fetch", "--prune"]);
  await fakeApi.performAction("/fake/repo", "fetch", { pruneTags: true });
  assert.deepEqual(lastFetch(), ["fetch", "--prune-tags"]);
  const both = await fakeApi.performAction("/fake/repo", "fetch", { remote: "origin", prune: true, pruneTags: true });
  assert.deepEqual(lastFetch(), ["fetch", "--prune", "--prune-tags", "origin"]);
  assert.equal(both.message, 'Fetched from "origin" with --prune --prune-tags.');
  await fakeApi.performAction("/fake/repo", "fetch", { prune: "true", pruneTags: 1 });
  assert.deepEqual(lastFetch(), ["fetch"], "only strict booleans opt in");
  await assert.rejects(fakeApi.performAction("/fake/repo", "fetch", { remote: "-x" }), (error) => error.code === "BAD_REQUEST");
  await assert.rejects(fakeApi.performAction("/fake/repo", "fetch", { remote: "a..b" }), (error) => error.code === "BAD_REQUEST");
});

test("fetch route applies fetchAndPrune settings and explicit overrides", async () => {
  const dir = createScratchRepo("settings-fetch");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");
  const bare = createBareRemote("settings-fetch.git");
  runGit(["remote", "add", "origin", bare], dir);
  runGit(["push", "-q", "-u", "origin", "main"], dir);

  const fetchMessage = async (config, body = {}) => {
    const fetchHost = createHost({ config, defaultDirectory: dir });
    try {
      const envelope = await post(fetchHost, ACTION_PATH, { action: "fetch", ...body });
      assert.equal(envelope.ok, true, JSON.stringify(envelope.error));
      return envelope.value.message;
    } finally {
      fetchHost.dispose();
    }
  };

  assert.equal(await fetchMessage(undefined), "Fetched from all remotes.");
  assert.match(await fetchMessage({ "repository.fetchAndPrune": true }), /with --prune\.$/);
  assert.equal(
    await fetchMessage({ "repository.fetchAndPrune": true }, { prune: false }),
    "Fetched from all remotes.",
    "an explicit false overrides the configured default",
  );
  assert.equal(await fetchMessage(undefined, { prune: true }), "Fetched from all remotes with --prune.");
  assert.match(await fetchMessage({ "repository.fetchAndPrune": true, "repository.fetchAndPruneTags": true }), /with --prune --prune-tags\.$/);
  assert.match(
    await fetchMessage({ "repository.fetchAndPrune": true, "repository.fetchAndPruneTags": true }, { pruneTags: false }),
    /with --prune\.$/,
  );
  assert.equal(
    await fetchMessage({ "repository.fetchAndPrune": 7, "repository.fetchAndPruneTags": 7 }),
    "Fetched from all remotes.",
    "invalid values fall back to false",
  );
  assert.match(await fetchMessage({ fetchAndPrune: true }), /with --prune\.$/, "the legacy flat alias folds in");
});

test("readGraph maps the repository settings onto the git log argv", async () => {
  const calls = [];
  const fakeRun = async (argv) => {
    calls.push([...argv]);
    const ok = (stdout) => ({ stdout, stderr: "", code: 0 });
    if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel") return ok("/fake/repo\n");
    if (argv[0] === "rev-parse" && argv[1] === "--abbrev-ref") return ok("main\n");
    if (argv[0] === "rev-parse") return ok(`${"a".repeat(40)}\n`);
    return ok("");
  };
  const fakeApi = createGitApi(fakeRun);
  const logCall = () => calls.filter((argv) => argv[0] === "log").pop();

  await fakeApi.readGraph("/fake/repo", { maxCommits: 2 });
  assert.equal(logCall().includes("--first-parent"), false);
  assert.equal(logCall().includes("--reflog"), false);
  assert.ok(logCall().includes("--tags"));
  assert.ok(logCall().includes("--remotes"));

  await fakeApi.readGraph("/fake/repo", { maxCommits: 2, firstParent: true, includeReflogCommits: true });
  assert.ok(logCall().includes("--first-parent"));
  assert.ok(logCall().includes("--reflog"));

  await fakeApi.readGraph("/fake/repo", { maxCommits: 2, showTags: false });
  assert.equal(logCall().includes("--tags"), false);
  await fakeApi.readGraph("/fake/repo", { maxCommits: 2, showCommitsOnlyReferencedByTags: false });
  assert.equal(logCall().includes("--tags"), false);
  await fakeApi.readGraph("/fake/repo", { maxCommits: 2, showRemoteBranches: false });
  assert.equal(logCall().includes("--remotes"), false);
});


// ---------------------------------------------------------------------------
// Wave 9: archive export, avatars and pull-request creation
// ---------------------------------------------------------------------------

test("archive exports zip and tar.gz archives into the workspace", async () => {
  const dir = createScratchRepo("archive-export");
  writeFile(path.join(dir, "src", "main.txt"), "hello\n");
  writeFile(path.join(dir, "README.md"), "# archive\n");
  const head = commitAll(dir, "archive base");

  const archiveHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const zip = await post(archiveHost, ARCHIVE_PATH, { ref: "HEAD" });
    assert.equal(zip.ok, true);
    assert.equal(zip.value.isRepo, true);
    assert.equal(zip.value.format, "zip");
    assert.equal(zip.value.ref, "HEAD");
    assert.equal(zip.value.path.startsWith(".dsh-git-graph/archives/"), true);
    assert.match(zip.value.name, /^archive-export-head-\d{8}-\d{6}\.zip$/);
    const zipPath = path.join(dir, zip.value.path);
    assert.equal(fs.existsSync(zipPath), true);
    assert.deepEqual([...fs.readFileSync(zipPath).subarray(0, 2)], [0x50, 0x4b], "zip magic is PK");
    assert.equal(zip.value.bytes, fs.statSync(zipPath).size);
    assert.ok(zip.value.bytes > 0);

    const tarball = await post(archiveHost, ARCHIVE_PATH, { ref: head, format: "tar.gz" });
    assert.equal(tarball.ok, true);
    assert.equal(tarball.value.ref, head);
    assert.equal(tarball.value.format, "tar.gz");
    assert.match(tarball.value.name, /\.tar\.gz$/);
    const tarPath = path.join(dir, tarball.value.path);
    assert.equal(fs.existsSync(tarPath), true);
    assert.deepEqual([...fs.readFileSync(tarPath).subarray(0, 2)], [0x1f, 0x8b], "gzip magic");

    /* The git API itself defaults the target workspace to `cwd`. */
    const direct = await api.archive(dir, { ref: "HEAD", format: "zip" });
    assert.equal(direct.isRepo, true);
    assert.equal(direct.format, "zip");
    assert.equal(fs.existsSync(path.join(dir, direct.path)), true);
    assert.equal(direct.path.startsWith(".dsh-git-graph/archives/"), true);

    const second = await post(archiveHost, ARCHIVE_PATH, { ref: "HEAD" });
    assert.equal(second.ok, true);
    assert.notEqual(second.value.name, zip.value.name, "the same ref/format gets a unique name");
    assert.notEqual(second.value.path, direct.path);
    assert.equal(fs.existsSync(path.join(dir, second.value.path)), true);
  } finally {
    archiveHost.dispose();
  }
});

test("archive validates its request, handles non-repo and stays inside the workspace fence", async () => {
  const dir = createScratchRepo("archive-errors");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");

  const archiveHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const badRequests = [
      [{}, "BAD_REQUEST"],
      [{ ref: "" }, "BAD_REQUEST"],
      [{ ref: "-rf" }, "BAD_REQUEST"],
      [{ ref: "HEAD", format: "rar" }, "BAD_REQUEST"],
      [{ ref: "HEAD", format: 42 }, "BAD_REQUEST"],
      [{ ref: "does-not-exist" }, "GIT_FAILED"],
    ];
    for (const [body, code] of badRequests) {
      const envelope = await post(archiveHost, ARCHIVE_PATH, body);
      assert.equal(envelope.ok, false, JSON.stringify(body));
      assert.equal(envelope.error.code, code, JSON.stringify(body));
      if (code === "GIT_FAILED") assert.equal(typeof envelope.error.message, "string");
    }

    const outsidePath = await post(archiveHost, ARCHIVE_PATH, { ref: "HEAD", path: fixture.empty });
    assert.equal(outsidePath.ok, false);
    assert.equal(outsidePath.error.code, "OUTSIDE_WORKSPACE");
  } finally {
    archiveHost.dispose();
  }

  const nonRepoHost = createHost({ config: undefined, defaultDirectory: fixture.empty });
  try {
    const envelope = await post(nonRepoHost, ARCHIVE_PATH, { ref: "HEAD" });
    assert.equal(envelope.ok, true);
    assert.equal(envelope.value.isRepo, false);
  } finally {
    nonRepoHost.dispose();
  }

  /* A repository selected through `path` still exports into the session workspace root. */
  const workspaceRoot = path.join(fixture.root, "archive-workspace");
  fs.mkdirSync(workspaceRoot);
  const nestedRepo = path.join(workspaceRoot, "nested");
  fs.mkdirSync(nestedRepo);
  runGit(["init", "-q", "-b", "main"], nestedRepo);
  writeFile(path.join(nestedRepo, "a.txt"), "a\n");
  runGit(["add", "-A"], nestedRepo);
  runGit(["commit", "-q", "-m", "base"], nestedRepo, nextDates());
  const workspaceHost = createHost({ config: undefined, defaultDirectory: workspaceRoot });
  try {
    const envelope = await post(workspaceHost, ARCHIVE_PATH, { ref: "HEAD", path: "nested" });
    assert.equal(envelope.ok, true);
    assert.equal(envelope.value.isRepo, true);
    assert.equal(envelope.value.path.startsWith(".dsh-git-graph/archives/"), true);
    assert.equal(fs.existsSync(path.join(workspaceRoot, envelope.value.path)), true, "the archive lands in the workspace root");
  } finally {
    workspaceHost.dispose();
  }

  /* A symlinked .dsh-git-graph directory must not move the archive outside the workspace. */
  const symlinkRepo = createScratchRepo("archive-symlink");
  writeFile(path.join(symlinkRepo, "a.txt"), "a\n");
  commitAll(symlinkRepo, "base");
  const outsideDir = path.join(fixture.root, "archive-outside");
  fs.mkdirSync(outsideDir);
  fs.symlinkSync(outsideDir, path.join(symlinkRepo, ".dsh-git-graph"), "dir");
  const symlinkHost = createHost({ config: undefined, defaultDirectory: symlinkRepo });
  try {
    const envelope = await post(symlinkHost, ARCHIVE_PATH, { ref: "HEAD" });
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, "OUTSIDE_WORKSPACE");
    assert.deepEqual(fs.readdirSync(outsideDir), [], "nothing is written outside the workspace");
  } finally {
    symlinkHost.dispose();
  }
});

test("avatars follow repository.commits.fetchAvatars and use Gravatar md5 URLs", async () => {
  assert.equal(md5Hex("test@example.com"), "55502f40dc8b7c769880b10874abc9d0");
  assert.equal(
    avatarUrl(" Test@Example.COM "),
    "https://secure.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?s=64&d=identicon",
  );
  for (const empty of ["", "   ", null, undefined, 42, "not-an-email", "a@b@c"]) {
    assert.equal(avatarUrl(empty), null, JSON.stringify(empty));
  }

  const dir = createScratchRepo("avatars");
  writeFile(path.join(dir, "a.txt"), "a\n");
  const head = commitAll(dir, "A");
  const expected = avatarUrl("graph@example.com");
  const avatarHost = createHost({ config: undefined, defaultDirectory: dir });
  const enabledHost = createHost({ config: { "repository.commits.fetchAvatars": true }, defaultDirectory: dir });
  try {
    const disabled = await post(avatarHost, GRAPH_PATH, {});
    assert.equal(disabled.value.presentation.avatars, false);
    assert.equal("authorAvatar" in disabled.value.commits[0], false, "disabled adds no graph fields");
    assert.equal("committerAvatar" in disabled.value.commits[0], false);
    const disabledCommit = await post(avatarHost, COMMIT_PATH, { hash: head });
    assert.equal("authorAvatar" in disabledCommit.value, false);
    assert.equal("committerAvatar" in disabledCommit.value, false);

    const enabled = await post(enabledHost, GRAPH_PATH, {});
    assert.equal(enabled.value.presentation.avatars, true);
    assert.equal(enabled.value.commits[0].authorAvatar, expected);
    assert.equal(enabled.value.commits[0].committerAvatar, expected);
    const commitDetail = await post(enabledHost, COMMIT_PATH, { hash: head });
    assert.equal(commitDetail.value.authorAvatar, expected);
    assert.equal(commitDetail.value.committerAvatar, expected);

    const legacyHost = createHost({ config: { fetchAvatars: true }, defaultDirectory: dir });
    try {
      const legacy = await post(legacyHost, GRAPH_PATH, {});
      assert.equal(legacy.value.commits[0].authorAvatar, expected, "the legacy flat alias folds in");
      assert.equal(legacy.value.presentation.avatars, true);
    } finally {
      legacyHost.dispose();
    }

    const invalidHost = createHost({ config: { "repository.commits.fetchAvatars": 7 }, defaultDirectory: dir });
    try {
      const invalid = await post(invalidHost, GRAPH_PATH, {});
      assert.equal(invalid.value.presentation.avatars, false);
      assert.equal("authorAvatar" in invalid.value.commits[0], false, "an invalid value keeps avatars off");
    } finally {
      invalidHost.dispose();
    }
  } finally {
    avatarHost.dispose();
    enabledHost.dispose();
  }
});

test("pr route builds github URLs from https and ssh remotes", async () => {
  const dir = createScratchRepo("pr-github");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");
  runGit(["remote", "add", "origin", "https://github.com/acme/widget.git"], dir);

  const prHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const value = (await post(prHost, PR_PATH, {})).value;
    assert.equal(value.isRepo, true);
    assert.deepEqual(value.remote, {
      name: "origin",
      url: "https://github.com/acme/widget.git",
      provider: "github",
      owner: "acme",
      repo: "widget",
      webUrl: "https://github.com/acme/widget",
    });
    assert.equal(value.branch, "main");
    assert.equal(value.base, "main");
    assert.equal(value.url, "https://github.com/acme/widget/compare/main...main?expand=1");
    assert.deepEqual(value.custom, []);

    const overridden = (await post(prHost, PR_PATH, { branch: "feature/add", base: "develop" })).value;
    assert.equal(overridden.url, "https://github.com/acme/widget/compare/develop...feature/add?expand=1");

    runGit(["remote", "set-url", "origin", "git@github.com:acme/widget.git"], dir);
    const scp = (await post(prHost, PR_PATH, {})).value;
    assert.equal(scp.remote.provider, "github");
    assert.equal(scp.remote.url, "git@github.com:acme/widget.git");
    assert.equal(scp.url, "https://github.com/acme/widget/compare/main...main?expand=1");

    runGit(["remote", "set-url", "origin", "ssh://git@github.com/acme/widget.git"], dir);
    const sshScheme = (await post(prHost, PR_PATH, {})).value;
    assert.equal(sshScheme.remote.provider, "github");
    assert.equal(sshScheme.url, "https://github.com/acme/widget/compare/main...main?expand=1");

    for (const bad of [{ branch: "-x" }, { branch: 42 }, { base: "a..b" }]) {
      const rejected = await post(prHost, PR_PATH, bad);
      assert.equal(rejected.ok, false, JSON.stringify(bad));
      assert.equal(rejected.error.code, "BAD_REQUEST", JSON.stringify(bad));
    }
  } finally {
    prHost.dispose();
  }
});

test("pr route recognizes gitlab subgroups, bitbucket, other and unknown remotes", async () => {
  const remoteValue = async (name, remoteUrl) => {
    const dir = createScratchRepo(name);
    writeFile(path.join(dir, "a.txt"), "a\n");
    commitAll(dir, "base");
    runGit(["remote", "add", "origin", remoteUrl], dir);
    const providerHost = createHost({ config: undefined, defaultDirectory: dir });
    try {
      return (await post(providerHost, PR_PATH, {})).value;
    } finally {
      providerHost.dispose();
    }
  };

  const gitlab = await remoteValue("pr-gitlab", "https://gitlab.com/group/sub/project.git");
  assert.equal(gitlab.remote.provider, "gitlab");
  assert.equal(gitlab.remote.owner, "group/sub");
  assert.equal(gitlab.remote.repo, "project");
  assert.equal(gitlab.remote.webUrl, "https://gitlab.com/group/sub/project");
  assert.equal(
    gitlab.url,
    "https://gitlab.com/group/sub/project/-/merge_requests/new?merge_request[source_branch]=main&merge_request[target_branch]=main",
  );

  const gitlabSsh = await remoteValue("pr-gitlab-ssh", "git@gitlab.com:group/sub/project.git");
  assert.equal(gitlabSsh.remote.provider, "gitlab");
  assert.equal(gitlabSsh.remote.owner, "group/sub");
  assert.equal(gitlabSsh.remote.repo, "project");

  const bitbucket = await remoteValue("pr-bitbucket", "https://bitbucket.org/acme/widget.git");
  assert.equal(bitbucket.remote.provider, "bitbucket");
  assert.equal(bitbucket.remote.webUrl, "https://bitbucket.org/acme/widget");
  assert.equal(bitbucket.url, "https://bitbucket.org/acme/widget/pull-requests/new?source=main&dest=main");

  const other = await remoteValue("pr-other", "https://git.example.com/acme/widget.git");
  assert.equal(other.remote.provider, "other");
  assert.equal(other.remote.owner, "acme");
  assert.equal(other.remote.repo, "widget");
  assert.equal(other.remote.webUrl, "https://git.example.com/acme/widget");
  assert.equal(other.url, null, "no built-in URL for an unrecognized provider");

  const unknown = await remoteValue("pr-unknown", "git@example.com:acme/widget.git");
  assert.equal(unknown.remote.provider, "unknown");
  assert.equal(unknown.remote.webUrl, null);
  assert.equal(unknown.url, null);

  /* origin is preferred; the first configured remote is the fallback. */
  const selectionDir = createScratchRepo("pr-selection");
  writeFile(path.join(selectionDir, "a.txt"), "a\n");
  commitAll(selectionDir, "base");
  runGit(["remote", "add", "upstream", "https://github.com/up/acme.git"], selectionDir);
  const selectionHost = createHost({ config: undefined, defaultDirectory: selectionDir });
  try {
    const fallback = (await post(selectionHost, PR_PATH, {})).value;
    assert.equal(fallback.remote.name, "upstream");
    runGit(["remote", "add", "origin", "https://github.com/acme/widget.git"], selectionDir);
    const preferred = (await post(selectionHost, PR_PATH, {})).value;
    assert.equal(preferred.remote.name, "origin");
  } finally {
    selectionHost.dispose();
  }
});

test("pr route resolves the base from origin/HEAD, main or master and rejects edge cases", async () => {
  const remoteHeadDir = createScratchRepo("pr-base-remote-head");
  writeFile(path.join(remoteHeadDir, "a.txt"), "a\n");
  const remoteHeadCommit = commitAll(remoteHeadDir, "base");
  runGit(["remote", "add", "origin", "https://github.com/acme/widget.git"], remoteHeadDir);
  runGit(["update-ref", "refs/remotes/origin/release", remoteHeadCommit], remoteHeadDir);
  runGit(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/release"], remoteHeadDir);
  const remoteHeadHost = createHost({ config: undefined, defaultDirectory: remoteHeadDir });
  try {
    const value = (await post(remoteHeadHost, PR_PATH, {})).value;
    assert.equal(value.base, "release", "origin/HEAD wins over the local main branch");
    assert.equal(value.url, "https://github.com/acme/widget/compare/release...main?expand=1");
  } finally {
    remoteHeadHost.dispose();
  }

  const masterDir = createScratchRepo("pr-base-master");
  writeFile(path.join(masterDir, "a.txt"), "a\n");
  commitAll(masterDir, "base");
  runGit(["branch", "-m", "main", "master"], masterDir);
  runGit(["remote", "add", "origin", "https://github.com/acme/widget.git"], masterDir);
  const masterHost = createHost({ config: undefined, defaultDirectory: masterDir });
  try {
    const value = (await post(masterHost, PR_PATH, {})).value;
    assert.equal(value.base, "master", "master is the fallback when main does not exist");
  } finally {
    masterHost.dispose();
  }

  const detachedDir = createScratchRepo("pr-detached");
  writeFile(path.join(detachedDir, "a.txt"), "a\n");
  commitAll(detachedDir, "base");
  runGit(["remote", "add", "origin", "https://github.com/acme/widget.git"], detachedDir);
  runGit(["checkout", "-q", "--detach", "HEAD"], detachedDir);
  const detachedHost = createHost({ config: undefined, defaultDirectory: detachedDir });
  try {
    const rejected = await post(detachedHost, PR_PATH, {});
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "BAD_REQUEST");
    assert.match(rejected.error.message, /detached HEAD/);
    const explicit = await post(detachedHost, PR_PATH, { branch: "detached-fix" });
    assert.equal(explicit.ok, true, "an explicit branch still works from a detached HEAD");
  } finally {
    detachedHost.dispose();
  }

  const noRemoteDir = createScratchRepo("pr-no-remote");
  writeFile(path.join(noRemoteDir, "a.txt"), "a\n");
  commitAll(noRemoteDir, "base");
  const noRemoteHost = createHost({ config: undefined, defaultDirectory: noRemoteDir });
  try {
    const rejected = await post(noRemoteHost, PR_PATH, {});
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "BAD_REQUEST");
    assert.match(rejected.error.message, /no remote/);
  } finally {
    noRemoteHost.dispose();
  }

  const outsideHost = createHost({ config: undefined, defaultDirectory: fixture.empty });
  try {
    const envelope = await post(outsideHost, PR_PATH, {});
    assert.equal(envelope.ok, true);
    assert.equal(envelope.value.isRepo, false);
  } finally {
    outsideHost.dispose();
  }
});

test("pr route renders custom provider templates with upstream variable semantics", async () => {
  const dir = createScratchRepo("pr-custom");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");
  runGit(["remote", "add", "origin", "https://github.com/acme/widget.git"], dir);

  const templateUrl = "$1/$2/$3/compare/$4?dest=$5/$6&db=$8&project=$7&literal=$9";
  const customHost = createHost({
    config: {
      customPullRequestProviders: [
        { name: "Gitea", templateUrl },
        { name: "Missing template" },
        { name: "", templateUrl: "https://ignored.example" },
        { name: "Broken", templateUrl: 42 },
      ],
    },
    defaultDirectory: dir,
  });
  try {
    const value = (await post(customHost, PR_PATH, { branch: "feature/x", base: "develop" })).value;
    assert.deepEqual(value.custom, [
      {
        name: "Gitea",
        url: "https://github.com/acme/widget/compare/feature/x?dest=acme/widget&db=develop&project=&literal=$9",
      },
    ]);
    const defaulted = (await post(customHost, PR_PATH, {})).value;
    assert.equal(defaulted.custom.length, 1);
    assert.match(defaulted.custom[0].url, /compare\/main\?dest=acme\/widget&db=main&project=&literal=\$9$/);
  } finally {
    customHost.dispose();
  }
});


// ---------------------------------------------------------------------------
// Wave 9-B: cross-workspace review management and repository config
// ---------------------------------------------------------------------------

test("review scopes list every session and end removes scopes", async () => {
  const repoA = createScratchRepo("review-scope-a");
  writeFile(path.join(repoA, "a.txt"), "a\n");
  const headA = commitAll(repoA, "A");
  const repoB = createScratchRepo("review-scope-b");
  writeFile(path.join(repoB, "b.txt"), "b\n");
  const headB = commitAll(repoB, "B");
  const realA = fs.realpathSync(repoA);
  const realB = fs.realpathSync(repoB);

  const storage = createFakeStorageDomain();
  const host = createHost({ config: undefined, defaultDirectory: fixture.root, storageDomain: storage.service });
  try {
    const toggledA = await post(host, REVIEW_PATH, {
      sessionId: "s1",
      path: "review-scope-a",
      action: "toggle",
      kind: "commit",
      base: headA,
      head: headA,
      file: "a.txt",
    });
    assert.equal(toggledA.ok, true);
    const toggledB = await post(host, REVIEW_PATH, {
      sessionId: "s2",
      path: "review-scope-b",
      action: "toggle",
      kind: "commit",
      base: headB,
      head: headB,
      file: "b.txt",
    });
    assert.equal(toggledB.ok, true);

    /* New entries record the resolved repository root. */
    assert.equal(storage.records.get("s1").entries[0].repoPath, realA);
    assert.equal(storage.records.get("s2").entries[0].repoPath, realB);

    const scopes = await post(host, REVIEW_PATH, { action: "scopes" });
    assert.equal(scopes.ok, true);
    assert.equal(scopes.value.scopes.length, 2);
    const bySession = new Map(scopes.value.scopes.map((row) => [row.sessionId, row]));
    assert.deepEqual(bySession.get("s1"), {
      sessionId: "s1",
      repoPath: realA,
      kind: "commit",
      base: headA,
      head: headA,
      reviewed: 1,
      total: 1,
      updatedAt: bySession.get("s1").updatedAt,
    });
    assert.deepEqual(bySession.get("s2"), {
      sessionId: "s2",
      repoPath: realB,
      kind: "commit",
      base: headB,
      head: headB,
      reviewed: 1,
      total: 1,
      updatedAt: bySession.get("s2").updatedAt,
    });
    assert.ok(scopes.value.scopes[0].updatedAt >= scopes.value.scopes[1].updatedAt, "newest first");

    /* A repository that no longer exists keeps its row with total:null. */
    fs.rmSync(repoB, { recursive: true, force: true });
    const afterDelete = await post(host, REVIEW_PATH, { action: "scopes" });
    const rowB = afterDelete.value.scopes.find((row) => row.sessionId === "s2");
    assert.equal(rowB.repoPath, realB);
    assert.equal(rowB.total, null, "a deleted repository cannot compute a total");
    assert.equal(rowB.reviewed, 1);
    assert.equal(afterDelete.value.scopes.length, 2);

    /* Legacy entries without repoPath stay readable with repoPath:null. */
    storage.records.set("legacy", {
      entries: [{ kind: "commit", base: headA, head: headA, files: { "a.txt": Date.now() }, updatedAt: Date.now() }],
    });
    const legacyScopes = await post(host, REVIEW_PATH, { action: "scopes" });
    const legacyRow = legacyScopes.value.scopes.find((row) => row.sessionId === "legacy");
    assert.equal(legacyRow.repoPath, null);
    assert.equal(legacyRow.total, null);
    assert.equal(legacyRow.reviewed, 1);
    const legacyRead = await post(host, REVIEW_PATH, {
      sessionId: "legacy",
      path: "review-scope-a",
      action: "read",
      kind: "commit",
      base: headA,
      head: headA,
    });
    assert.equal(legacyRead.ok, true);
    assert.equal(legacyRead.value.reviewed, 1, "old entries are still readable");

    /* End by scope removes exactly the named entry. */
    const ended = await post(host, REVIEW_PATH, {
      action: "end",
      scopes: [{ sessionId: "s1", kind: "commit", base: headA, head: headA }],
    });
    assert.deepEqual(ended.value, { ended: 1 });
    const afterEnd = await post(host, REVIEW_PATH, { action: "scopes" });
    assert.equal(afterEnd.value.scopes.some((row) => row.sessionId === "s1"), false);
    assert.equal(afterEnd.value.scopes.some((row) => row.sessionId === "s2"), true);

    /* End all clears every remaining session. */
    const endedAll = await post(host, REVIEW_PATH, { action: "end", all: true });
    assert.deepEqual(endedAll.value, { ended: 2 });
    assert.deepEqual((await post(host, REVIEW_PATH, { action: "scopes" })).value.scopes, []);

    const badEnd = await post(host, REVIEW_PATH, { action: "end" });
    assert.equal(badEnd.ok, false);
    assert.equal(badEnd.error.code, "BAD_REQUEST");
    const badScope = await post(host, REVIEW_PATH, { action: "end", scopes: [{ sessionId: "s1", kind: "commit" }] });
    assert.equal(badScope.ok, false);
    assert.equal(badScope.error.code, "BAD_REQUEST");
  } finally {
    host.dispose();
  }
});

test("repository config export, import and clear drive the effective settings", async () => {
  const dir = createScratchRepo("repo-config");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");
  const filePath = path.join(dir, ".gitgraph.json");
  const host = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const initial = await post(host, REPOCONFIG_PATH, { action: "status" });
    assert.equal(initial.ok, true);
    assert.equal(initial.value.isRepo, true);
    assert.equal(initial.value.present, false);
    assert.equal(initial.value.valid, false);
    assert.equal(initial.value.path, ".gitgraph.json");
    assert.deepEqual(initial.value.keys, []);
    assert.deepEqual(initial.value.overrides, {});

    /* Export with no non-default settings writes an empty settings object. */
    const exported = await post(host, REPOCONFIG_PATH, { action: "export" });
    assert.equal(exported.ok, true);
    assert.equal(exported.value.path, ".gitgraph.json");
    assert.deepEqual(exported.value.keys, []);
    assert.ok(exported.value.bytes > 0);
    const exportedFile = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.equal(exportedFile.version, 1);
    assert.equal(typeof exportedFile.exportedAt, "string");
    assert.deepEqual(exportedFile.settings, {});

    /* Edit the file: a valid override must change the effective settings. */
    const overrides = { "repository.commits.initialLoad": 50, "graph.style": "angular" };
    fs.writeFileSync(
      filePath,
      `${JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), settings: overrides }, null, 2)}\n`,
    );
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(filePath, future, future);

    const status = await post(host, REPOCONFIG_PATH, { action: "status" });
    assert.equal(status.value.present, true);
    assert.equal(status.value.valid, true);
    assert.deepEqual(status.value.keys, ["repository.commits.initialLoad", "graph.style"]);
    assert.deepEqual(status.value.overrides, overrides);

    const imported = await post(host, REPOCONFIG_PATH, { action: "import" });
    assert.equal(imported.ok, true);
    assert.deepEqual(imported.value.keys, ["repository.commits.initialLoad", "graph.style"]);
    assert.equal(imported.value.applied, 2);
    assert.deepEqual(imported.value.unknown, []);
    assert.deepEqual(imported.value.invalid, []);

    /* 60 commits make the override (initialLoad 50) observable. */
    importLinearHistory(dir, 60);
    const graph = await post(host, GRAPH_PATH, {});
    assert.equal(graph.ok, true);
    assert.equal(graph.value.commits.length, 50, "the repository initialLoad override applies");
    assert.equal(graph.value.truncated, true);
    assert.equal(graph.value.presentation.graphStyle, "angular", "the repository graph.style override applies");
    const requestLimit = await post(host, GRAPH_PATH, { limit: 5 });
    assert.equal(requestLimit.value.commits.length, 5, "a request limit still wins");

    /* Clear removes the file and restores the plugin defaults. */
    const cleared = await post(host, REPOCONFIG_PATH, { action: "clear" });
    assert.equal(cleared.ok, true);
    assert.equal(cleared.value.cleared, true);
    assert.equal(fs.existsSync(filePath), false);
    const afterClear = await post(host, GRAPH_PATH, {});
    assert.equal(afterClear.value.commits.length, 60, "no override: 60 < the default page size");
    assert.equal(afterClear.value.presentation.graphStyle, "rounded");

    /* Import reports unknown and invalid settings without applying them blindly. */
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: { "not.a.setting": 1, "repository.showTags": "not-a-boolean", "repository.commits.initialLoad": 7 },
        },
        null,
        2,
      )}\n`,
    );
    const reported = await post(host, REPOCONFIG_PATH, { action: "import" });
    assert.equal(reported.ok, true);
    assert.equal(reported.value.applied, 2);
    assert.deepEqual(reported.value.unknown, ["not.a.setting"]);
    assert.equal(reported.value.invalid.some((entry) => entry.key === "repository.showTags"), true);
    const reportedGraph = await post(host, GRAPH_PATH, {});
    assert.equal(reportedGraph.value.commits.length, 7, "the valid part of the file still applies");

    await post(host, REPOCONFIG_PATH, { action: "clear" });
    const missingImport = await post(host, REPOCONFIG_PATH, { action: "import" });
    assert.equal(missingImport.ok, false);
    assert.equal(missingImport.error.code, "BAD_REQUEST");
  } finally {
    host.dispose();
  }

  /* Export also captures non-default settings from the plugin configuration. */
  const configuredDir = createScratchRepo("repo-config-base");
  writeFile(path.join(configuredDir, "a.txt"), "a\n");
  commitAll(configuredDir, "base");
  const configuredHost = createHost({ config: { "graph.style": "angular" }, defaultDirectory: configuredDir });
  try {
    const configuredExport = await post(configuredHost, REPOCONFIG_PATH, { action: "export" });
    assert.deepEqual(configuredExport.value.keys, ["graph.style"]);
    const configuredFile = JSON.parse(fs.readFileSync(path.join(configuredDir, ".gitgraph.json"), "utf8"));
    assert.deepEqual(configuredFile.settings, { "graph.style": "angular" });
  } finally {
    configuredHost.dispose();
  }
});

test("repository config overrides reach uncommitted and fetch defaults", async () => {
  const dir = createScratchRepo("repo-config-behaviour");
  writeFile(path.join(dir, "tracked.txt"), "one\n");
  commitAll(dir, "base");
  writeFile(path.join(dir, "untracked.txt"), "new\n");
  const bare = createBareRemote("repo-config-behaviour.git");
  runGit(["remote", "add", "origin", bare], dir);
  runGit(["push", "-q", "-u", "origin", "main"], dir);
  const filePath = path.join(dir, ".gitgraph.json");
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), settings: { "repository.showUntrackedFiles": false, "repository.fetchAndPrune": true } },
      null,
      2,
    )}\n`,
  );
  const future = new Date(Date.now() + 2000);
  fs.utimesSync(filePath, future, future);

  const host = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const uncommitted = await post(host, UNCOMMITTED_PATH, {});
    assert.equal(uncommitted.ok, true);
    assert.deepEqual(uncommitted.value.untracked, [], "showUntrackedFiles override applies to /uncommitted");
    assert.equal(uncommitted.value.counts.untracked, 0);

    const fetched = await post(host, ACTION_PATH, { action: "fetch" });
    assert.equal(fetched.ok, true);
    assert.match(fetched.value.message, /with --prune\.$/, "fetchAndPrune override applies to /action fetch");

    await post(host, REPOCONFIG_PATH, { action: "clear" });
    const restoredUncommitted = await post(host, UNCOMMITTED_PATH, {});
    assert.equal(restoredUncommitted.value.counts.untracked, 1);
    const restoredFetch = await post(host, ACTION_PATH, { action: "fetch" });
    assert.equal(restoredFetch.value.message, "Fetched from all remotes.");
  } finally {
    host.dispose();
  }
});

test("repository config rejects invalid JSON and oversized files without crashing", async () => {
  const dir = createScratchRepo("repo-config-invalid");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "base");
  const filePath = path.join(dir, ".gitgraph.json");
  const host = createHost({ config: undefined, defaultDirectory: dir });
  try {
    fs.writeFileSync(filePath, "{not json", "utf8");
    const invalidStatus = await post(host, REPOCONFIG_PATH, { action: "status" });
    assert.equal(invalidStatus.ok, true);
    assert.equal(invalidStatus.value.present, true);
    assert.equal(invalidStatus.value.valid, false);
    assert.deepEqual(invalidStatus.value.keys, []);
    assert.match(invalidStatus.value.error, /invalid JSON/);
    const invalidImport = await post(host, REPOCONFIG_PATH, { action: "import" });
    assert.equal(invalidImport.ok, false);
    assert.equal(invalidImport.error.code, "BAD_REQUEST");
    const graphDespite = await post(host, GRAPH_PATH, {});
    assert.equal(graphDespite.ok, true, "an invalid file never breaks requests");
    assert.equal(graphDespite.value.presentation.graphStyle, "rounded");

    fs.writeFileSync(filePath, "x".repeat(140_000), "utf8");
    const oversizedStatus = await post(host, REPOCONFIG_PATH, { action: "status" });
    assert.equal(oversizedStatus.value.present, true);
    assert.equal(oversizedStatus.value.valid, false);
    assert.match(oversizedStatus.value.error, /larger than/);
    const oversizedImport = await post(host, REPOCONFIG_PATH, { action: "import" });
    assert.equal(oversizedImport.ok, false);
    assert.equal(oversizedImport.error.code, "BAD_REQUEST");
    const graphStillWorks = await post(host, GRAPH_PATH, {});
    assert.equal(graphStillWorks.ok, true);

    /* Export recovers an invalid file with a valid empty-settings document. */
    const recovered = await post(host, REPOCONFIG_PATH, { action: "export" });
    assert.equal(recovered.ok, true);
    const recoveredFile = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.deepEqual(recoveredFile.settings, {});
  } finally {
    host.dispose();
  }
});
