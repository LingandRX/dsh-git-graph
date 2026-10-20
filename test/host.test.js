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

import { createGitApi, createGitRunner, isValidRefName } from "../lib/git.js";
import { apply, name as pluginName, normalizeConfig } from "../lib/index.js";

const FIELD = "\u001f";
const NUL = "\u0000";
const GRAPH_PATH = "/api/dsh-git-graph/graph";
const COMMIT_PATH = "/api/dsh-git-graph/commit";
const DIFF_PATH = "/api/dsh-git-graph/diff";
const ACTION_PATH = "/api/dsh-git-graph/action";
const UNCOMMITTED_PATH = "/api/dsh-git-graph/uncommitted";
const COMPARE_PATH = "/api/dsh-git-graph/compare";
const STASHES_PATH = "/api/dsh-git-graph/stashes";
const TAG_PATH = "/api/dsh-git-graph/tag";
const REMOTES_PATH = "/api/dsh-git-graph/remotes";
const CONTAINS_PATH = "/api/dsh-git-graph/contains";

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
function createHost({ config, defaultDirectory, includeConnection = true, includeTools = true } = {}) {
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
  assert.equal(first.routes.size, 10);
  assert.equal(second.routes.size, 10);
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

test("apply registers exactly the ten POST Fetch routes", () => {
  const routes = [...host.routes.keys()].sort();
  assert.deepEqual(
    routes,
    [ACTION_PATH, COMMIT_PATH, COMPARE_PATH, CONTAINS_PATH, DIFF_PATH, GRAPH_PATH, REMOTES_PATH, STASHES_PATH, TAG_PATH, UNCOMMITTED_PATH].sort(),
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
  assert.equal(noTools.routes.size, 10);
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

test("graph presentation defaults, overrides and invalid fallbacks", async () => {
  const dir = createScratchRepo("presentation");
  writeFile(path.join(dir, "a.txt"), "a\n");
  commitAll(dir, "A");
  const defaults = {
    graphStyle: "rounded",
    graphColours: [],
    showSignature: false,
    showEmoji: true,
    issueUrlTemplate: "",
    useMailmap: false,
  };

  const defaultHost = createHost({ config: undefined, defaultDirectory: dir });
  try {
    const graph = await post(defaultHost, GRAPH_PATH, {});
    assert.equal(graph.ok, true);
    assert.deepEqual(graph.value.presentation, defaults);
    assert.equal(Object.keys(graph.value.presentation).length, 6);
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
    },
    defaultDirectory: dir,
  });
  try {
    const graph = await post(customHost, GRAPH_PATH, {});
    assert.deepEqual(graph.value.presentation, {
      graphStyle: "angular",
      graphColours: ["#ff0000", "red", "var(--brand)", "rgb(1, 2, 3)"],
      showSignature: true,
      showEmoji: false,
      issueUrlTemplate: "https://example.com/issues/{id}",
      useMailmap: true,
    });
  } finally {
    customHost.dispose();
  }

  const invalidHost = createHost({
    config: { graphStyle: "triangular", graphColours: "#fff", showSignature: "yes", showEmoji: 0, issueUrlTemplate: 42, useMailmap: "1" },
    defaultDirectory: dir,
  });
  try {
    const graph = await post(invalidHost, GRAPH_PATH, {});
    assert.deepEqual(graph.value.presentation, {
      graphStyle: "rounded",
      graphColours: [],
      showSignature: true,
      showEmoji: false,
      issueUrlTemplate: "",
      useMailmap: true,
    });
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
