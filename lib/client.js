window.__ModuleLoader__.load({
  id: "dsh-git-graph",
  factory(require) {
    "use strict";

    const React = require("react");
    const h = React.createElement;

    // ── identities ────────────────────────────────────────────────────────
    /** Tab type identity: also the key of its pane body registration. */
    const TAB_ID = "dsh-git-graph";
    /** Right-sidebar tab discriminator opened from the guide page. */
    const TAB_KIND = "git-graph";
    /** Locale namespace shared by the type, its guide card and its body. */
    const LOCALE_NS = "dshGitGraph";
    /** Ascending position among the right sidebar guide entries. */
    const GUIDE_ORDER = 40;
    /** Relative API prefix (no leading slash), served by the plugin's host half. */
    const API_PREFIX = "api/dsh-git-graph/";

    // ── graph geometry ────────────────────────────────────────────────────
    const MAX_LANES = 14;
    const LANE_WIDTH = 14;
    const ROW_HEIGHT = 38;
    const PAGE_SIZE = 120;
    const PAGE_MAX = 500;
    const MAX_ROW_CHIPS = 4;
    const MAX_DIFF_LINES = 1500;

    /**
     * Artwork palette for the commit lanes and status glyphs. Every other color
     * in this file comes from a `--dsw-alias-*` theme token.
     */
    const LANE_COLORS = [
      "#5B8CFF", "#F0A44B", "#4EC9B0", "#E06C9F", "#B18CFF", "#6CCB5F", "#F4873E",
      "#58A6FF", "#D2A8FF", "#FF7B72", "#7EE787", "#E3B341", "#8FB4FF", "#56D4DD",
    ];

    /** Simplified Chinese copy for every visible string in the tab. */
    const zh = {
      "tab.title": "Git 图谱",
      "tab.description": "浏览当前工作区的提交、分支、标签与差异",
      "toolbar.refresh": "刷新图谱",
      "toolbar.fetch": "获取远程更新",
      "toolbar.back": "返回提交列表",
      "toolbar.copyHash": "复制提交哈希",
      "toolbar.copied": "已复制",
      "toolbar.copyFailed": "复制失败",
      "toolbar.repository": "仓库",
      "toolbar.branch": "分支",
      "toolbar.detached": "分离 HEAD",
      "toolbar.dirty": "{count} 个文件有改动",
      "toolbar.loadMore": "加载更多",
      "toolbar.more": "更多操作",
      "state.loading": "正在读取 Git 图谱…",
      "state.notRepo": "当前工作区不是 Git 仓库",
      "state.notRepoHint": "在会话工作区初始化仓库（git init）后即可查看提交图谱。",
      "state.error": "加载 Git 图谱失败",
      "state.retry": "重试",
      "state.empty": "这个仓库还没有提交",
      "detail.author": "作者",
      "detail.committer": "提交者",
      "detail.parents": "父提交",
      "detail.hash": "提交哈希",
      "detail.committed": "提交时间",
      "detail.stats": "{files} 个文件，+{insertions} −{deletions}",
      "detail.files": "改动文件",
      "detail.noFiles": "此提交没有文件改动",
      "detail.diff": "差异内容",
      "detail.binary": "二进制文件，无法显示文本差异",
      "detail.truncated": "差异内容过长，已截断",
      "detail.showingDiff": "查看差异",
      "detail.hideDiff": "收起差异",
      "action.checkoutBranch": "检出分支",
      "action.checkoutCommit": "检出此提交（分离 HEAD）",
      "action.createBranch": "在此新建分支",
      "action.cherryPick": "拣选此提交",
      "action.revert": "还原此提交",
      "action.createTag": "在此新建标签",
      "action.deleteTag": "删除标签",
      "action.deleteBranch": "删除分支",
      "action.forceDeleteBranch": "强制删除（分支未合并）",
      "action.notMerged": "该分支尚未合并，删除会丢失提交。",
      "action.output": "查看输出",
      "action.hideOutput": "收起输出",
      "action.fetch": "获取远程更新",
      "action.confirm": "确认执行「{action}」？",
      "action.cancel": "取消",
      "action.run": "执行",
      "action.running": "正在执行…",
      "action.branchName": "分支名称",
      "action.tagName": "标签名称",
      "action.noTarget": "暂无可选目标",
      "action.success": "操作成功",
      "action.failed": "操作失败：{message}",
      "action.cleanWorktreeWarning": "工作区有未提交的改动，此操作可能失败或覆盖这些改动。",
      "common.refresh": "刷新",
      "common.close": "关闭",
    };

    /** English copy for every visible string in the tab. */
    const en = {
      "tab.title": "Git Graph",
      "tab.description": "Browse commits, branches, tags and diffs of the session workspace",
      "toolbar.refresh": "Refresh graph",
      "toolbar.fetch": "Fetch remote updates",
      "toolbar.back": "Back to commit list",
      "toolbar.copyHash": "Copy commit hash",
      "toolbar.copied": "Copied",
      "toolbar.copyFailed": "Copy failed",
      "toolbar.repository": "Repository",
      "toolbar.branch": "Branch",
      "toolbar.detached": "detached HEAD",
      "toolbar.dirty": "{count} changed file(s)",
      "toolbar.loadMore": "Load more",
      "toolbar.more": "More actions",
      "state.loading": "Reading the Git graph…",
      "state.notRepo": "The current workspace is not a Git repository",
      "state.notRepoHint": "Initialize a repository (git init) in the session workspace to browse its commit graph.",
      "state.error": "Could not load the Git graph",
      "state.retry": "Retry",
      "state.empty": "This repository has no commits yet",
      "detail.author": "Author",
      "detail.committer": "Committer",
      "detail.parents": "Parents",
      "detail.hash": "Commit hash",
      "detail.committed": "Committed",
      "detail.stats": "{files} file(s), +{insertions} −{deletions}",
      "detail.files": "Changed files",
      "detail.noFiles": "This commit changed no files",
      "detail.diff": "Diff",
      "detail.binary": "Binary file; no text diff to display",
      "detail.truncated": "The diff is too long and was truncated",
      "detail.showingDiff": "Show diff",
      "detail.hideDiff": "Hide diff",
      "action.checkoutBranch": "Checkout branch",
      "action.checkoutCommit": "Checkout this commit (detached HEAD)",
      "action.createBranch": "Create branch here",
      "action.cherryPick": "Cherry-pick this commit",
      "action.revert": "Revert this commit",
      "action.createTag": "Create tag here",
      "action.deleteTag": "Delete tag",
      "action.deleteBranch": "Delete branch",
      "action.forceDeleteBranch": "Force delete (branch is not merged)",
      "action.notMerged": "This branch is not merged; deleting it discards its commits.",
      "action.output": "Show output",
      "action.hideOutput": "Hide output",
      "action.fetch": "Fetch remote updates",
      "action.confirm": "Run “{action}”?",
      "action.cancel": "Cancel",
      "action.run": "Run",
      "action.running": "Running…",
      "action.branchName": "Branch name",
      "action.tagName": "Tag name",
      "action.noTarget": "No target available",
      "action.success": "Done",
      "action.failed": "Action failed: {message}",
      "action.cleanWorktreeWarning": "The worktree has uncommitted changes; this action may fail or overwrite them.",
      "common.refresh": "Refresh",
      "common.close": "Close",
    };

    /** Style sheet rendered by the body component, so unmounting the tab removes it. */
    const CSS = `
.dgg-root{display:flex;flex-direction:column;flex:auto;height:100%;min-height:0;box-sizing:border-box;position:relative;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:12px;font-family:inherit}
.dgg-root *,.dgg-root *::before,.dgg-root *::after{box-sizing:border-box}
.dgg-toolbar{display:flex;align-items:center;gap:6px;min-height:36px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;min-width:0}
.dgg-toolbar-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:none;color:var(--dsw-alias-label-secondary)}
.dgg-repo{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dgg-branch{display:inline-flex;align-items:center;gap:3px;flex:none;max-width:42%;min-width:0;padding:0 6px;height:20px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:10.5px}
.dgg-branch svg{flex:none}
.dgg-branch-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgg-dirty{flex:none;color:var(--dsw-alias-state-warn-label);font-size:10.5px;font-variant-numeric:tabular-nums;cursor:default}
.dgg-icon-btn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dgg-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dgg-icon-btn:focus-visible,.dgg-row:focus-visible,.dgg-btn:focus-visible,.dgg-file-head:focus-visible,.dgg-chip-btn:focus-visible,.dgg-menu-item:focus-visible,.dgg-input:focus-visible,.dgg-select:focus-visible,.dgg-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
@keyframes dgg-rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.dgg-spinning svg{animation:dgg-rotate 900ms linear infinite}
.dgg-menu-wrap{position:relative;flex:none}
.dgg-menu{position:absolute;top:26px;right:0;z-index:20;min-width:150px;padding:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay)}
.dgg-menu-item{display:block;width:100%;padding:6px 8px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;text-align:left;cursor:pointer}
.dgg-menu-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dgg-menu-item:disabled{opacity:.5;cursor:default}
.dgg-live{flex:none}
.dgg-feedback{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:11px;overflow-wrap:anywhere;flex-wrap:wrap}
.dgg-feedback-running{color:var(--dsw-alias-label-secondary)}
.dgg-feedback-success{color:var(--dsw-alias-state-success-primary)}
.dgg-feedback-error{color:var(--dsw-alias-state-error-primary)}
.dgg-feedback-text{flex:1 1 auto;min-width:0}
.dgg-feedback .dgg-btn{flex:none;font-size:10.5px;padding:1px 7px}
.dgg-output{margin:0;max-height:180px;overflow:auto;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.dgg-main{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column}
.dgg-listwrap{display:flex;flex-direction:column;min-height:100%}
.dgg-banner{display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-state-error-primary);font-size:11px;overflow-wrap:anywhere}
.dgg-list{display:flex;flex-direction:column;flex:1 1 auto}
.dgg-row{display:flex;align-items:center;gap:6px;width:100%;min-height:38px;padding:0 8px 0 0;border:none;border-bottom:1px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}
.dgg-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dgg-graph{flex:none;display:block}
.dgg-rowtext{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto;padding:4px 0}
.dgg-subject{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.35;color:var(--dsw-alias-label-primary)}
.dgg-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:1.35;color:var(--dsw-alias-label-tertiary)}
.dgg-chips{display:flex;flex-wrap:wrap;gap:3px;margin-top:1px;min-width:0}
.dgg-chip{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 5px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1.5;vertical-align:bottom}
.dgg-chip-btn{font:inherit;font-size:9.5px;cursor:pointer;padding:0 5px}
.dgg-chip-branch{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dgg-chip-remote{border-style:dashed;color:var(--dsw-alias-label-tertiary)}
.dgg-chip-tag{border-color:var(--dsw-alias-state-warn-secondary);background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}
.dgg-chip-head{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.dgg-load-more{display:flex;justify-content:center;padding:8px;flex:none}
.dgg-btn{font:inherit;font-size:11px;line-height:1.4;padding:3px 9px;border-radius:6px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer}
.dgg-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dgg-btn:disabled{opacity:.5;cursor:default}
.dgg-btn-primary{background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}
.dgg-btn-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dgg-btn-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.dgg-state{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 18px;text-align:center;color:var(--dsw-alias-label-secondary)}
.dgg-state-title{margin:0;font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dgg-state-text{margin:0;font-size:11px}
.dgg-state-detail{margin:0;max-width:100%;overflow-wrap:anywhere;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dgg-state-path{margin:0;max-width:100%;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.dgg-spinner{display:inline-block;width:16px;height:16px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:dgg-rotate 800ms linear infinite;flex:none}
.dgg-detail{display:flex;flex-direction:column;gap:10px;padding:10px 10px 20px}
.dgg-subject-lg{margin:0;font-size:13px;font-weight:600;line-height:1.45;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}
.dgg-kv{display:grid;grid-template-columns:minmax(52px,auto) minmax(0,1fr);gap:3px 8px;font-size:11px;align-items:start}
.dgg-k{color:var(--dsw-alias-label-tertiary)}
.dgg-v{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;min-width:0}
.dgg-inline{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.dgg-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dgg-link{padding:0;border:none;background:transparent;color:var(--dsw-alias-link);font:inherit;font-size:10.5px;cursor:pointer}
.dgg-link:hover{text-decoration:underline}
.dgg-stats{font-size:11px;color:var(--dsw-alias-label-secondary)}
.dgg-section{display:flex;flex-direction:column;gap:6px}
.dgg-section-title{margin:0;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.dgg-actions{display:flex;flex-wrap:wrap;gap:4px}
.dgg-hint{margin:0;font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.dgg-body{margin:0;max-height:180px;overflow:auto;padding:6px 8px;border-radius:6px;background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.dgg-dialog{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.dgg-dialog-title{margin:0;font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.dgg-dialog-warning{margin:0;font-size:10.5px;color:var(--dsw-alias-state-warn-label);overflow-wrap:anywhere}
.dgg-field{display:flex;flex-direction:column;gap:3px}
.dgg-field-label{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.dgg-input,.dgg-select{width:100%;padding:3px 6px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px}
.dgg-dialog-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dgg-inline-status{font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.dgg-files{display:flex;flex-direction:column;gap:4px}
.dgg-group{display:flex;flex-direction:column;gap:4px}
.dgg-group-title{margin:0;font-size:10px;font-weight:600;color:var(--dsw-alias-label-tertiary);letter-spacing:.04em}
.dgg-file{border:1px solid var(--dsw-alias-border-l2);border-radius:6px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.dgg-file-head{display:flex;align-items:center;gap:6px;width:100%;padding:4px 6px;border:none;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}
.dgg-file-head:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dgg-st{flex:none;display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:4px;font-size:9.5px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.dgg-st-A{color:var(--dsw-alias-state-success-primary)}
.dgg-st-D{color:var(--dsw-alias-state-error-primary)}
.dgg-st-M{color:var(--dsw-alias-state-warn-label)}
.dgg-st-T{color:var(--dsw-alias-state-warn-label)}
.dgg-st-R{color:var(--dsw-alias-brand-primary)}
.dgg-st-C{color:var(--dsw-alias-brand-primary)}
.dgg-st-U{color:var(--dsw-alias-state-error-primary)}
.dgg-file-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-primary)}
.dgg-file-old{flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.dgg-file-counts{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dgg-file-toggle{flex:none;width:10px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:10px}
.dgg-diff{margin:0;padding:6px 8px;max-height:340px;overflow:auto;background:var(--dsw-alias-markdown-code-block);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;line-height:1.45}
.dgg-diff-line{display:block;white-space:pre}
.dgg-diff-add{color:var(--dsw-alias-state-success-primary)}
.dgg-diff-del{color:var(--dsw-alias-state-error-primary)}
.dgg-diff-hunk{color:var(--dsw-alias-state-business-primary)}
.dgg-diff-meta{color:var(--dsw-alias-label-tertiary)}
.dgg-diff-note{padding:0 8px 6px;margin:0}
`;

    // ── small value helpers ───────────────────────────────────────────────

    /**
     * Last path segment of a repository path.
     * @param pathValue - POSIX or Windows style path.
     * @returns the folder name, or an empty string.
     */
    function basename(pathValue) {
      if (typeof pathValue !== "string") return "";
      const trimmed = pathValue.replace(/[\\/]+$/, "");
      if (trimmed === "") return "";
      const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
      return index === -1 ? trimmed : trimmed.slice(index + 1);
    }

    /**
     * Whether a value behaves like a `Map`.
     * @param value - candidate.
     * @returns true when `get`/`set`/`has` are available.
     */
    function isMapLike(value) {
      return value !== null && typeof value === "object" && typeof value.get === "function" && typeof value.set === "function" && typeof value.has === "function";
    }

    /**
     * Best human message for an unknown thrown value.
     * @param error - thrown value.
     * @returns a non-empty message.
     */
    function messageOf(error) {
      if (error !== null && typeof error === "object" && typeof error.message === "string" && error.message !== "") return error.message;
      const text = String(error);
      return text === "" ? "Error" : text;
    }

    /**
     * Whether a rejected request was cancelled on purpose.
     * @param error - thrown value.
     * @returns true for an abort.
     */
    function isAbort(error) {
      return error !== null && typeof error === "object" && error.name === "AbortError";
    }

    /**
     * The language the page is rendered in, when the document declares one.
     * @returns a BCP 47 language tag or undefined.
     */
    function currentLanguage() {
      try {
        if (typeof document !== "undefined" && document.documentElement !== null) {
          const lang = document.documentElement.lang;
          if (typeof lang === "string" && lang !== "") return lang;
        }
      } catch {}
      return undefined;
    }

    /**
     * Absolute, locale-aware timestamp.
     * @param seconds - Unix seconds, as the host reports them.
     * @param lang - BCP 47 tag.
     * @returns a formatted date.
     */
    function absoluteTime(seconds, lang) {
      if (!Number.isFinite(seconds)) return "";
      const date = new Date(seconds * 1000);
      try {
        return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(date);
      } catch {
        return date.toISOString().replace("T", " ").slice(0, 16);
      }
    }

    /**
     * Relative time such as “3 days ago”, through `Intl.RelativeTimeFormat`.
     * @param seconds - Unix seconds, as the host reports them.
     * @param lang - BCP 47 tag.
     * @returns a formatted relative time.
     */
    function relativeTime(seconds, lang) {
      if (!Number.isFinite(seconds)) return "";
      const delta = seconds * 1000 - Date.now();
      try {
        const formatter = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
        const magnitude = Math.abs(delta);
        if (magnitude < 60_000) return formatter.format(Math.round(delta / 1000), "second");
        if (magnitude < 3_600_000) return formatter.format(Math.round(delta / 60_000), "minute");
        if (magnitude < 86_400_000) return formatter.format(Math.round(delta / 3_600_000), "hour");
        if (magnitude < 2_592_000_000) return formatter.format(Math.round(delta / 86_400_000), "day");
        if (magnitude < 31_536_000_000) return formatter.format(Math.round(delta / 2_592_000_000), "month");
        return formatter.format(Math.round(delta / 31_536_000_000), "year");
      } catch {
        const date = new Date(seconds * 1000);
        return date.toISOString().slice(0, 10);
      }
    }

    /**
     * Name, e-mail and both timestamps of one person on a commit.
     * @param name - display name.
     * @param email - address.
     * @param seconds - Unix seconds.
     * @param lang - BCP 47 tag.
     * @returns one readable line.
     */
    function personLine(name, email, seconds, lang) {
      const who = typeof name === "string" && name !== "" ? name : "";
      const mail = typeof email === "string" && email !== "" ? " <" + email + ">" : "";
      const when = Number.isFinite(seconds) ? absoluteTime(seconds, lang) + " (" + relativeTime(seconds, lang) + ")" : "";
      return [who + mail, when].filter((part) => part !== "").join(" · ");
    }

    /**
     * HTTP POST to the plugin's host routes; the envelope is unwrapped.
     * @param path - route name below `api/dsh-git-graph/`.
     * @param payload - JSON request body.
     * @param signal - cancellation signal.
     * @returns the `value` member of the host envelope.
     */
    async function postJson(path, payload, signal) {
      const response = await fetch(API_PREFIX + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (body === null || typeof body !== "object") throw new Error("HTTP " + response.status);
      if (body.ok === false) {
        const failure = body.error;
        const message = failure !== null && typeof failure === "object" && typeof failure.message === "string" && failure.message !== ""
          ? failure.message
          : failure !== null && typeof failure === "object" && typeof failure.code === "string" && failure.code !== "" ? failure.code : "HTTP " + response.status;
        const error = new Error(message);
        // Keep the host's extra detail (git's own stderr for a failed action) on the
        // rejection so callers can disclose it without re-parsing the envelope.
        if (failure !== null && typeof failure === "object" && typeof failure.output === "string" && failure.output !== "") error.output = failure.output;
        throw error;
      }
      return body.value === undefined ? null : body.value;
    }

    // ── graph layout (pure, no React) ─────────────────────────────────────

    /**
     * Deterministic lane layout for a newest-first commit page.
     *
     * A lane is a pending parent hash: the commit that lane is waiting to draw
     * next. Each row records the commit's own lane, its merge/root character and
     * the line segments within that row (`fromY`/`toY` are 0 = top, 0.5 = node,
     * 1 = bottom). Lanes are capped at `MAX_LANES`; beyond the cap extra branches
     * share the last lane instead of growing the SVG.
     * @param commits - commit records with `hash` and `parents`.
     * @param maxLanes - optional lane cap.
     * @returns `{ rows, laneCount }`, one row per input commit in order.
     */
    function layoutGraph(commits, maxLanes) {
      const cap = Number.isFinite(maxLanes) && maxLanes > 0 ? Math.min(Math.floor(maxLanes), MAX_LANES) : MAX_LANES;
      const list = Array.isArray(commits) ? commits : [];
      const present = new Set();
      for (const commit of list) {
        if (commit !== null && typeof commit === "object" && typeof commit.hash === "string" && commit.hash !== "") present.add(commit.hash);
      }
      /** Pending parent hash per lane index, `null` for free lanes. */
      const lanes = [];
      const rows = [];
      let laneCount = 1;

      for (const commit of list) {
        const record = commit !== null && typeof commit === "object" ? commit : {};
        const hash = typeof record.hash === "string" ? record.hash : "";
        const parents = [];
        if (Array.isArray(record.parents)) {
          for (const parent of record.parents) {
            if (typeof parent === "string" && parent !== "" && parent !== hash && present.has(parent) && !parents.includes(parent)) parents.push(parent);
          }
        }

        const before = lanes.slice();
        let lane = hash === "" ? 0 : lanes.indexOf(hash);
        if (hash !== "" && lane === -1) {
          lane = lanes.indexOf(null);
          if (lane === -1) lane = lanes.length;
          if (lane >= cap) lane = cap - 1;
        }

        const edges = [];
        // Lanes that keep going straight through this row.
        for (let index = 0; index < before.length && index < cap; index += 1) {
          const pending = before[index];
          if (pending === null || pending === undefined) continue;
          if (pending === hash && hash !== "") continue;
          edges.push({ fromLane: index, fromY: 0, toLane: index, toY: 1 });
        }
        // Lanes that were waiting for this commit merge into its node.
        if (hash !== "") {
          for (let index = 0; index < before.length; index += 1) {
            if (before[index] !== hash) continue;
            if (index < cap) edges.push({ fromLane: index, fromY: 0, toLane: lane, toY: 0.5 });
            if (index !== lane) lanes[index] = null;
          }
        }

        const parentLanes = [];
        if (parents.length > 0) {
          lanes[lane] = parents[0];
          parentLanes.push(lane);
          for (let index = 1; index < parents.length; index += 1) {
            let slot = -1;
            for (let probe = 0; probe < cap; probe += 1) {
              if (lanes[probe] === null || lanes[probe] === undefined) {
                slot = probe;
                break;
              }
            }
            if (slot === -1) slot = lanes.length < cap ? lanes.length : cap - 1;
            lanes[slot] = parents[index];
            parentLanes.push(slot);
          }
          for (const parentLane of parentLanes) {
            edges.push({ fromLane: lane, fromY: 0.5, toLane: parentLane, toY: 1, colorLane: parentLane });
          }
        } else {
          lanes[lane] = null;
        }

        while (lanes.length > 0 && (lanes[lanes.length - 1] === null || lanes[lanes.length - 1] === undefined)) lanes.pop();

        laneCount = Math.max(laneCount, Math.min(before.length, cap), lane + 1);
        for (const parentLane of parentLanes) laneCount = Math.max(laneCount, parentLane + 1);
        laneCount = Math.min(laneCount, cap);

        rows.push({
          hash,
          lane,
          edges,
          merge: parents.length > 1,
          root: parents.length === 0,
        });
      }

      return { rows, laneCount: Math.max(1, Math.min(laneCount, cap)) };
    }

    /**
     * Color of a lane from the artwork palette.
     * @param lane - lane index.
     * @returns a CSS color.
     */
    function laneColor(lane) {
      const index = Number.isFinite(lane) ? Math.abs(Math.floor(lane)) : 0;
      return LANE_COLORS[index % LANE_COLORS.length];
    }

    /**
     * Straight or bezier path between two lane points.
     * @param x1 - start x.
     * @param y1 - start y.
     * @param x2 - end x.
     * @param y2 - end y.
     * @returns an SVG path data string.
     */
    function lanePath(x1, y1, x2, y2) {
      if (x1 === x2) return "M" + x1 + " " + y1 + " L" + x2 + " " + y2;
      const middle = (y1 + y2) / 2;
      return "M" + x1 + " " + y1 + " C" + x1 + " " + middle + ", " + x2 + " " + middle + ", " + x2 + " " + y2;
    }

    // ── ref chips ─────────────────────────────────────────────────────────

    /**
     * Classify one `%D` ref decoration into a chip.
     *
     * `kind` is what the ref *is* (branch, remote or tag), which is what decides
     * whether the chip is actionable; `isHead` is only the `HEAD` decoration's
     * accent, so the current branch stays a clickable branch chip. The host lists
     * `HEAD` and the branch it points at as two separate decorations, and a known
     * branch whose `head` flag is set must therefore keep `kind: "branch"`.
     * @param raw - decoration such as `main`, `origin/main`, `HEAD -> main` or `tag: v1`.
     * @param refIndex - short and full ref names mapped to their host record.
     * @returns a chip descriptor `{ label, kind, isHead, refName? }`.
     */
    function classifyRef(raw, refIndex) {
      if (raw === "HEAD") return { label: "HEAD", kind: "head", isHead: true };
      if (raw.startsWith("HEAD -> ")) return { label: raw.slice(8), kind: "head", isHead: true };
      const arrow = raw.indexOf("HEAD -> ");
      if (arrow !== -1) return { label: raw.slice(arrow + 8), kind: "head", isHead: true };
      if (raw.startsWith("tag: ")) return { label: raw.slice(5), kind: "tag", isHead: false };
      const known = isMapLike(refIndex) ? refIndex.get(raw) : undefined;
      if (known !== undefined) {
        const kind = known.kind === "tag" || known.kind === "remote" ? known.kind : "branch";
        const chip = { label: typeof known.label === "string" && known.label !== "" ? known.label : raw, kind, isHead: known.head === true };
        if (typeof known.name === "string" && known.name !== "") chip.refName = known.name;
        return chip;
      }
      if (raw.includes("/")) return { label: raw, kind: "remote", isHead: false };
      return { label: raw, kind: "branch", isHead: false };
    }

    /**
     * Classify a host ref record as a branch, remote or tag.
     * @param ref - ref record from the graph value.
     * @returns the chip kind.
     */
    function refKind(ref) {
      const type = ref !== null && typeof ref === "object" && typeof ref.type === "string" ? ref.type : "";
      const name = ref !== null && typeof ref === "object" && typeof ref.name === "string" ? ref.name : "";
      if (type === "tag" || name.startsWith("refs/tags/")) return "tag";
      if (type === "remote" || name.startsWith("refs/remotes/")) return "remote";
      return "branch";
    }

    /**
     * Chips for one commit's ref decorations.
     * @param rawRefs - decorations from the graph value.
     * @param refIndex - host ref index.
     * @param limit - maximum chips to show.
     * @returns chip descriptors with stable keys.
     */
    function classifyRefs(rawRefs, refIndex, limit) {
      const list = Array.isArray(rawRefs) ? rawRefs : [];
      const max = Number.isFinite(limit) ? limit : MAX_ROW_CHIPS;
      const chips = [];
      for (let index = 0; index < list.length && chips.length < max; index += 1) {
        const raw = list[index];
        if (typeof raw !== "string" || raw === "") continue;
        const chip = classifyRef(raw, refIndex);
        chip.key = raw + "#" + index;
        chips.push(chip);
      }
      return chips;
    }

    // ── action helpers (pure) ─────────────────────────────────────────────

    /**
     * Which choices one action dialog needs, and how it is presented.
     *
     * Kept pure so the branch-deletion rules (never offer the checked-out branch,
     * never warn about a dirty worktree when the action does not touch it) are
     * testable without a React render.
     * @param kind - action discriminator.
     * @param choices - `{ branches, tags, currentBranch }` for the open commit.
     * @returns `{ needs, options, destructive, dirtySensitive }`.
     */
    function actionDialogSpec(kind, choices) {
      const branches = Array.isArray(choices?.branches) ? choices.branches : [];
      const tags = Array.isArray(choices?.tags) ? choices.tags : [];
      const currentBranch = typeof choices?.currentBranch === "string" ? choices.currentBranch : "";
      const options =
        kind === "checkoutBranch" ? branches
          : kind === "deleteBranch" ? branches.filter((branch) => branch.name !== currentBranch)
            : kind === "deleteTag" ? tags : [];
      const needs =
        kind === "createBranch" || kind === "createTag" ? "name"
          : kind === "checkoutBranch" || kind === "deleteBranch" ? "branch"
            : kind === "deleteTag" ? "tag" : null;
      const destructive =
        kind === "checkoutBranch" || kind === "checkoutCommit" || kind === "cherryPick" ||
        kind === "revert" || kind === "deleteTag" || kind === "deleteBranch";
      return {
        needs,
        options,
        destructive,
        dirtySensitive: kind !== "createBranch" && kind !== "createTag" && kind !== "deleteTag" && kind !== "deleteBranch",
      };
    }

    /**
     * Build the request arguments a confirmed dialog submits.
     * @param kind - action discriminator.
     * @param input - `{ name, ref, hash }` as entered in the dialog.
     * @returns the argument object for the `action` route.
     */
    function actionArguments(kind, input) {
      const name = typeof input?.name === "string" ? input.name : "";
      const ref = typeof input?.ref === "string" ? input.ref : "";
      const hash = typeof input?.hash === "string" ? input.hash : "";
      if (kind === "checkoutBranch") return { branch: ref };
      if (kind === "deleteTag") return { name: ref };
      // A first delete attempt is always non-forcing; the UI escalates only after
      // git refuses an unmerged branch.
      if (kind === "deleteBranch") return { name: ref, force: false };
      if (kind === "createBranch") return { name, startPoint: hash };
      if (kind === "createTag") return { name, hash };
      return { hash };
    }

    /**
     * Whether a failed delete means "not merged", which the UI turns into an
     * explicit force-delete offer instead of a dead end.
     * @param kind - action discriminator.
     * @param message - failure summary and/or git output.
     * @returns true when force delete is the remedy.
     */
    function isUnmergedRefusal(kind, message) {
      if (kind !== "deleteBranch") return false;
      return /not fully merged|未合并|is not merged/i.test(typeof message === "string" ? message : "");
    }

    // ── file and diff helpers ─────────────────────────────────────────────

    /**
     * Group commit files by their one-letter status.
     * @param files - host file records.
     * @returns sorted `[status, files]` pairs.
     */
    function groupFiles(files) {
      const groups = new Map();
      for (const file of Array.isArray(files) ? files : []) {
        if (file === null || typeof file !== "object") continue;
        const rawStatus = typeof file.status === "string" && file.status !== "" ? file.status.slice(0, 1).toUpperCase() : "M";
        if (!groups.has(rawStatus)) groups.set(rawStatus, []);
        groups.get(rawStatus).push(file);
      }
      return Array.from(groups.entries()).sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
    }

    /**
     * One-letter status of a file, normalized.
     * @param file - host file record.
     * @returns an uppercase letter.
     */
    function fileStatus(file) {
      return file !== null && typeof file === "object" && typeof file.status === "string" && file.status !== ""
        ? file.status.slice(0, 1).toUpperCase()
        : "M";
    }

    /**
     * CSS class for one patch line.
     * @param line - one line of a unified diff.
     * @returns the class name, or an empty string.
     */
    function diffLineClass(line) {
      if (line.startsWith("@@")) return "dgg-diff-hunk";
      if (
        line.startsWith("+++") ||
        line.startsWith("---") ||
        line.startsWith("diff --git") ||
        line.startsWith("index ") ||
        line.startsWith("new file") ||
        line.startsWith("deleted file") ||
        line.startsWith("old mode") ||
        line.startsWith("new mode") ||
        line.startsWith("similarity index") ||
        line.startsWith("rename ") ||
        line.startsWith("Binary files")
      ) {
        return "dgg-diff-meta";
      }
      if (line.startsWith("+")) return "dgg-diff-add";
      if (line.startsWith("-")) return "dgg-diff-del";
      return "";
    }

    // ── artwork ───────────────────────────────────────────────────────────

    /**
     * The tab's glyph: a trunk with two commits and one branch.
     * @param props - rendered size and class from the guide card or title bar.
     * @returns a 16-unit SVG.
     */
    function GitGraphIcon({ size = 16, className } = {}) {
      const pixel = Number.isFinite(size) && size > 0 ? size : 16;
      return h(
        "svg",
        { width: pixel, height: pixel, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", className, focusable: "false" },
        h("path", { d: "M5 2V14", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" }),
        h("path", { d: "M5 9C5 11.5 11 12 11 9V4", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" }),
        h("circle", { cx: 5, cy: 5, r: 1.9, fill: "currentColor" }),
        h("circle", { cx: 5, cy: 12, r: 1.9, fill: "currentColor" }),
        h("circle", { cx: 11, cy: 4, r: 1.9, fill: "currentColor" }),
      );
    }

    /**
     * Left arrow used by the detail view's back control.
     * @param props - rendered size.
     * @returns a 14-unit SVG.
     */
    function BackIcon({ size = 14 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("path", { d: "M10 3L5 8L10 13", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    /**
     * Circular arrow used by the refresh control.
     * @param props - rendered size.
     * @returns a 14-unit SVG.
     */
    function RefreshIcon({ size = 14 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("path", { d: "M13 8A5 5 0 1 1 11.5 4.4", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
        h("path", { d: "M12.6 2V5.2H9.4", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    /**
     * Three dots used by the overflow menu trigger.
     * @param props - rendered size.
     * @returns a 14-unit SVG.
     */
    function MoreIcon({ size = 14 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", focusable: "false" },
        h("circle", { cx: 3, cy: 8, r: 1.2 }),
        h("circle", { cx: 8, cy: 8, r: 1.2 }),
        h("circle", { cx: 13, cy: 8, r: 1.2 }),
      );
    }

    /**
     * Small branch glyph drawn before the current branch name.
     * @param props - rendered size.
     * @returns a 12-unit SVG.
     */
    function BranchIcon({ size = 12 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("path", { d: "M4 3V13", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
        h("path", { d: "M4 7C4 9.5 10 10 10 7V4", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
        h("circle", { cx: 4, cy: 3, r: 1.6, fill: "currentColor" }),
        h("circle", { cx: 10, cy: 3, r: 1.6, fill: "currentColor" }),
      );
    }

    /** Centered indeterminate progress indicator. */
    function Spinner() {
      return h("span", { className: "dgg-spinner", "aria-hidden": "true" });
    }

    // ── presentational components ─────────────────────────────────────────

    /**
     * One row's lane graph.
     * @param props - layout row and the page's lane count.
     * @returns a decorative SVG.
     */
    function LaneGraph({ row, laneCount } = {}) {
      const lanes = Number.isFinite(laneCount) && laneCount > 0 ? Math.min(Math.floor(laneCount), MAX_LANES) : 1;
      const width = lanes * LANE_WIDTH + 2;
      const centerX = (lane) => Math.min(Math.max(lane, 0), lanes - 1) * LANE_WIDTH + LANE_WIDTH / 2 + 1;
      const record = row !== null && typeof row === "object" ? row : { lane: 0, edges: [], merge: false, root: false };
      const edges = Array.isArray(record.edges) ? record.edges : [];
      const children = edges.map((edge, index) => {
        const colorLane = Number.isFinite(edge.colorLane) ? edge.colorLane : edge.fromY === 1 ? edge.toLane : edge.fromLane;
        return h("path", {
          key: "edge" + index,
          d: lanePath(centerX(edge.fromLane), Number(edge.fromY) * ROW_HEIGHT, centerX(edge.toLane), Number(edge.toY) * ROW_HEIGHT),
          stroke: laneColor(colorLane),
          strokeWidth: 2,
          strokeLinecap: "round",
          fill: "none",
        });
      });
      const node = Math.min(Math.max(Number.isFinite(record.lane) ? record.lane : 0, 0), lanes - 1);
      children.push(
        h("circle", {
          key: "node",
          cx: centerX(node),
          cy: ROW_HEIGHT / 2,
          r: record.merge ? 3 : 3.5,
          fill: record.root ? "var(--dsw-alias-bg-base)" : laneColor(node),
          stroke: record.root ? laneColor(node) : record.merge ? "var(--dsw-alias-bg-base)" : "none",
          strokeWidth: record.root ? 1.5 : 1.5,
        }),
      );
      if (record.merge) {
        children.push(
          h("circle", { key: "ring", cx: centerX(node), cy: ROW_HEIGHT / 2, r: 5, fill: "none", stroke: laneColor(node), strokeWidth: 1.2 }),
        );
      }
      return h(
        "svg",
        { className: "dgg-graph", width, height: ROW_HEIGHT, viewBox: "0 0 " + width + " " + ROW_HEIGHT, "aria-hidden": "true", focusable: "false" },
        children,
      );
    }

    /**
     * Branch, tag, remote and HEAD chips.
     * @param props - chips, translate function and optional pick handler.
     * @returns a chip row.
     */
    function RefChips({ chips, t, onPick } = {}) {
      const list = Array.isArray(chips) ? chips : [];
      const pickable = typeof onPick === "function";
      return h(
        "span",
        { className: "dgg-chips" },
        list.map((chip) => {
          // A branch at HEAD stays a branch chip (actionable); `isHead` only adds ink.
          const className = "dgg-chip dgg-chip-" + chip.kind + (chip.isHead === true && chip.kind === "branch" ? " dgg-chip-head" : "");
          const interactive = pickable && chip.kind === "branch";
          if (interactive) {
            return h(
              "button",
              {
                key: chip.key,
                type: "button",
                className: className + " dgg-chip-btn",
                title: t("action.checkoutBranch") + ": " + chip.label,
                onClick: (event) => {
                  event.stopPropagation();
                  onPick(chip);
                },
              },
              chip.label,
            );
          }
          return h("span", { key: chip.key, className, title: chip.label }, chip.label);
        }),
      );
    }

    /**
     * One commit row in the master list.
     * @param props - commit, its layout row, ref index and selection callback.
     * @returns a focusable row button.
     */
    function CommitRow({ t, commit, row, laneCount, refIndex, onSelect } = {}) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const hash = typeof record.hash === "string" ? record.hash : "";
      const abbrev = typeof record.abbrev === "string" && record.abbrev !== "" ? record.abbrev : hash.slice(0, 7);
      const subject = typeof record.subject === "string" && record.subject !== "" ? record.subject : abbrev;
      const author = typeof record.authorName === "string" ? record.authorName : "";
      const chips = classifyRefs(record.refs, refIndex, MAX_ROW_CHIPS);
      return h(
        "button",
        {
          type: "button",
          className: "dgg-row",
          "aria-label": subject + " " + abbrev,
          onClick: () => onSelect(hash),
        },
        h(LaneGraph, { row, laneCount }),
        h(
          "span",
          { className: "dgg-rowtext" },
          h("span", { className: "dgg-subject" }, subject),
          h("span", { className: "dgg-meta" }, [abbrev, author, relativeTime(record.authorTime, currentLanguage())].filter((part) => part !== "").join(" · ")),
          chips.length > 0 ? h(RefChips, { chips, t }) : null,
        ),
      );
    }

    /**
     * The commit master list plus its load-more footer.
     * @param props - graph value, layout, ref index and callbacks.
     * @returns the list.
     */
    function CommitList({ t, value, layout, refIndex, onSelect, onLoadMore, canLoadMore, loadingMore } = {}) {
      const commits = value !== null && typeof value === "object" && Array.isArray(value.commits) ? value.commits : [];
      const rows = layout !== null && typeof layout === "object" && Array.isArray(layout.rows) ? layout.rows : [];
      const laneCount = layout !== null && typeof layout === "object" ? layout.laneCount : 1;
      return h(
        "div",
        { className: "dgg-list" },
        commits.map((commit, index) =>
          h(CommitRow, {
            key: typeof commit.hash === "string" ? commit.hash + ":" + index : "commit:" + index,
            t,
            commit,
            row: rows[index],
            laneCount,
            refIndex,
            onSelect,
          }),
        ),
        canLoadMore
          ? h(
              "div",
              { className: "dgg-load-more" },
              h("button", { type: "button", className: "dgg-btn", disabled: loadingMore === true, onClick: onLoadMore }, loadingMore === true ? t("state.loading") : t("toolbar.loadMore")),
            )
          : null,
      );
    }

    /**
     * Loading state with the shared spinner.
     * @param props - translate function and optional label.
     * @returns a centered state block.
     */
    function LoadingState({ t, label } = {}) {
      return h(
        "div",
        { className: "dgg-state" },
        h(Spinner),
        h("p", { className: "dgg-state-text" }, typeof label === "string" && label !== "" ? label : t("state.loading")),
      );
    }

    /**
     * Error state with a retry control.
     * @param props - translate function, detail message and retry callback.
     * @returns a centered state block.
     */
    function ErrorState({ t, message, onRetry } = {}) {
      return h(
        "div",
        { className: "dgg-state" },
        h("p", { className: "dgg-state-title" }, t("state.error")),
        typeof message === "string" && message !== "" ? h("p", { className: "dgg-state-detail" }, message) : null,
        h("button", { type: "button", className: "dgg-btn", onClick: onRetry }, t("state.retry")),
      );
    }

    /**
     * Empty state for a workspace that is not a Git repository.
     * @param props - translate function, workspace path and retry callback.
     * @returns a centered state block.
     */
    function NotRepoState({ t, pathValue, onRetry } = {}) {
      return h(
        "div",
        { className: "dgg-state" },
        h("p", { className: "dgg-state-title" }, t("state.notRepo")),
        typeof pathValue === "string" && pathValue !== "" ? h("p", { className: "dgg-state-path" }, pathValue) : null,
        h("p", { className: "dgg-state-detail" }, t("state.notRepoHint")),
        h("button", { type: "button", className: "dgg-btn", onClick: onRetry }, t("state.retry")),
      );
    }

    /**
     * Empty state for an initialized repository without commits.
     * @param props - translate function and retry callback.
     * @returns a centered state block.
     */
    function EmptyState({ t, onRetry } = {}) {
      return h(
        "div",
        { className: "dgg-state" },
        h(GitGraphIcon, { size: 22 }),
        h("p", { className: "dgg-state-title" }, t("state.empty")),
        h("button", { type: "button", className: "dgg-btn", onClick: onRetry }, t("state.retry")),
      );
    }

    /**
     * Toolbar: repository, branch, dirty count, refresh and the overflow menu.
     * @param props - header values and callbacks.
     * @returns the toolbar strip.
     */
    function Toolbar(props) {
      const { t, repoLabel, repoPath, branchLabel, dirty, busy, backVisible, menuOpen, running, onRefresh, onToggleMenu, onCloseMenu, onFetch, onBack } = props;
      return h(
        "div",
        { className: "dgg-toolbar" },
        backVisible === true
          ? h("button", { type: "button", className: "dgg-icon-btn", title: t("toolbar.back"), "aria-label": t("toolbar.back"), onClick: onBack }, h(BackIcon))
          : h("span", { className: "dgg-toolbar-icon" }, h(GitGraphIcon, { size: 16 })),
        h("span", { className: "dgg-repo", title: typeof repoPath === "string" && repoPath !== "" ? repoPath : t("tab.title") }, typeof repoLabel === "string" && repoLabel !== "" ? repoLabel : t("tab.title")),
        typeof branchLabel === "string" && branchLabel !== ""
          ? h("span", { className: "dgg-branch", title: t("toolbar.branch") + ": " + branchLabel }, h(BranchIcon), h("span", { className: "dgg-branch-label" }, branchLabel))
          : null,
        Number.isFinite(dirty) && dirty > 0
          ? h("span", { className: "dgg-dirty", title: t("toolbar.dirty", { count: dirty }), "aria-label": t("toolbar.dirty", { count: dirty }) }, "●" + dirty)
          : null,
        h("button", { type: "button", className: "dgg-icon-btn" + (busy === true ? " dgg-spinning" : ""), title: t("toolbar.refresh"), "aria-label": t("toolbar.refresh"), onClick: onRefresh }, h(RefreshIcon)),
        h(
          "div",
          {
            className: "dgg-menu-wrap",
            onBlur: (event) => {
              const next = event.relatedTarget;
              if (next === null || !event.currentTarget.contains(next)) onCloseMenu();
            },
          },
          h(
            "button",
            {
              type: "button",
              className: "dgg-icon-btn",
              title: t("toolbar.more"),
              "aria-label": t("toolbar.more"),
              "aria-expanded": menuOpen === true,
              onClick: onToggleMenu,
            },
            h(MoreIcon),
          ),
          menuOpen === true
            ? h(
                "div",
                { className: "dgg-menu", role: "group", "aria-label": t("toolbar.more") },
                h("button", { type: "button", className: "dgg-menu-item", disabled: running === true, onClick: onFetch }, t("toolbar.fetch")),
              )
            : null,
        ),
      );
    }

    /**
     * Two-step confirmation row for one repository action.
     * @param props - dialog descriptor, worktree dirtiness and callbacks.
     * @returns the inline confirmation panel.
     */
    function ActionDialog({ t, dialog, dirty, running, onCancel, onConfirm } = {}) {
      const spec = dialog !== null && typeof dialog === "object" ? dialog : { kind: "fetch", needs: null, options: [] };
      const options = Array.isArray(spec.options) ? spec.options : [];
      const requested = typeof spec.requestedRef === "string" && options.some((option) => option.name === spec.requestedRef) ? spec.requestedRef : options.length > 0 ? options[0].name : "";
      const [name, setName] = React.useState("");
      const [ref, setRef] = React.useState(requested);
      const needsName = spec.needs === "name";
      const needsRef = spec.needs === "branch" || spec.needs === "tag";
      const label = t("action." + spec.kind);
      const ready = running !== true && (!needsName || name.trim() !== "") && (!needsRef || ref !== "");
      const warning = spec.dirtySensitive === true && Number.isFinite(dirty) && dirty > 0 ? t("action.cleanWorktreeWarning") : null;
      const fieldLabel = spec.kind === "createTag" ? t("action.tagName") : needsRef && spec.needs === "tag" ? t("action.tagName") : t("action.branchName");
      return h(
        "div",
        { className: "dgg-dialog", role: "group", "aria-label": t("action.confirm", { action: label }) },
        h("p", { className: "dgg-dialog-title" }, t("action.confirm", { action: label })),
        warning !== null ? h("p", { className: "dgg-dialog-warning" }, warning) : null,
        needsName
          ? h(
              "label",
              { className: "dgg-field" },
              h("span", { className: "dgg-field-label" }, fieldLabel),
              h("input", {
                className: "dgg-input",
                type: "text",
                value: name,
                autoFocus: true,
                spellCheck: false,
                autoComplete: "off",
                "aria-label": fieldLabel,
                onChange: (event) => setName(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === "Enter" && ready) onConfirm(name.trim(), ref);
                  if (event.key === "Escape") onCancel();
                },
              }),
            )
          : null,
        needsRef
          ? h(
              "label",
              { className: "dgg-field" },
              h("span", { className: "dgg-field-label" }, fieldLabel),
              h(
                "select",
                { className: "dgg-select", value: ref, "aria-label": fieldLabel, onChange: (event) => setRef(event.target.value) },
                options.length === 0
                  ? h("option", { value: "" }, t("action.noTarget"))
                  : options.map((option) => h("option", { key: option.name, value: option.name }, option.name)),
              ),
            )
          : null,
        h(
          "div",
          { className: "dgg-dialog-actions" },
          h(
            "button",
            {
              type: "button",
              className: "dgg-btn" + (spec.destructive === true ? " dgg-btn-danger" : " dgg-btn-primary"),
              disabled: !ready,
              onClick: () => onConfirm(name.trim(), ref),
            },
            t("action.run"),
          ),
          h("button", { type: "button", className: "dgg-btn", onClick: onCancel }, t("action.cancel")),
          running === true ? h("span", { className: "dgg-inline-status" }, t("action.running")) : null,
        ),
      );
    }

    /**
     * One changed file with a lazily loaded, expandable diff.
     * @param props - session, commit hash, file record and the shared diff cache.
     * @returns the file row and its diff.
     */
    function FileRow({ t, sessionId, hash, file, cache } = {}) {
      const record = file !== null && typeof file === "object" ? file : {};
      const filePath = typeof record.path === "string" ? record.path : "";
      const status = fileStatus(record);
      const [expanded, setExpanded] = React.useState(false);
      const [state, setState] = React.useState({ status: "idle", value: null, error: null });
      React.useEffect(() => {
        if (!expanded) return undefined;
        const store = cache !== null && typeof cache === "object" ? cache : null;
        const key = hash + "::" + filePath;
        if (store !== null && isMapLike(store.current) && store.current.has(key)) {
          setState({ status: "ready", value: store.current.get(key), error: null });
          return undefined;
        }
        const controller = new AbortController();
        let active = true;
        setState({ status: "loading", value: null, error: null });
        postJson(
          "diff",
          {
            sessionId,
            hash,
            file: filePath,
            oldPath: typeof record.oldPath === "string" && record.oldPath !== "" ? record.oldPath : undefined,
            status,
          },
          controller.signal,
        ).then(
          (value) => {
            if (!active) return;
            if (store !== null && isMapLike(store.current)) store.current.set(key, value);
            setState({ status: "ready", value, error: null });
          },
          (error) => {
            if (!active || isAbort(error)) return;
            setState({ status: "error", value: null, error: messageOf(error) });
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [expanded, sessionId, hash, filePath, record.oldPath, status, cache]);

      const added = Number.isFinite(record.added) ? record.added : null;
      const removed = Number.isFinite(record.removed) ? record.removed : null;
      const counts = [added === null ? "" : "+" + added, removed === null ? "" : "−" + removed].filter((part) => part !== "").join(" ");
      const toggleLabel = (expanded ? t("detail.hideDiff") : t("detail.showingDiff")) + " " + filePath;

      return h(
        "div",
        { className: "dgg-file" },
        h(
          "button",
          {
            type: "button",
            className: "dgg-file-head",
            "aria-expanded": expanded,
            "aria-label": toggleLabel,
            onClick: () => setExpanded((value) => !value),
          },
          h("span", { className: "dgg-st dgg-st-" + status, "aria-hidden": "true" }, status),
          h("span", { className: "dgg-file-path", title: filePath }, filePath),
          typeof record.oldPath === "string" && record.oldPath !== "" ? h("span", { className: "dgg-file-old", title: record.oldPath }, "← " + record.oldPath) : null,
          h("span", { className: "dgg-file-counts" }, counts),
          h("span", { className: "dgg-file-toggle", "aria-hidden": "true" }, expanded ? "▾" : "▸"),
        ),
        expanded ? renderDiff(t, record, state) : null,
      );
    }

    /**
     * Diff body of one expanded file row.
     * @param t - translate function.
     * @param file - host file record.
     * @param state - request state for that file.
     * @returns loading, error, binary, truncated or the patch.
     */
    function renderDiff(t, file, state) {
      // `idle` is the first frame after expanding, before the request effect runs.
      if (state.status === "loading" || state.status === "idle") {
        return h("div", { className: "dgg-diff dgg-diff-note" }, h(Spinner));
      }
      if (state.status === "error") {
        return h("p", { className: "dgg-hint dgg-diff-note" }, t("state.error") + (typeof state.error === "string" && state.error !== "" ? ": " + state.error : ""));
      }
      const value = state.value;
      if (value === null || typeof value !== "object") return h("p", { className: "dgg-hint dgg-diff-note" }, t("detail.binary"));
      if (value.binary === true) return h("p", { className: "dgg-hint dgg-diff-note" }, t("detail.binary"));
      const patch = typeof value.patch === "string" ? value.patch : "";
      if (patch === "") return h("p", { className: "dgg-hint dgg-diff-note" }, file.binary === true ? t("detail.binary") : t("detail.noFiles"));
      const lines = patch.split("\n");
      while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
      const shown = lines.slice(0, MAX_DIFF_LINES);
      return h(
        React.Fragment,
        null,
        h(
          "pre",
          { className: "dgg-diff", "aria-label": t("detail.diff") + " " + (typeof file.path === "string" ? file.path : "") },
          shown.map((line, index) => {
            const className = diffLineClass(line);
            return h("span", { key: index, className: "dgg-diff-line" + (className === "" ? "" : " " + className) }, line === "" ? " " : line);
          }),
        ),
        value.truncated === true || lines.length > MAX_DIFF_LINES
          ? h("p", { className: "dgg-hint dgg-diff-note" }, t("detail.truncated"))
          : null,
      );
    }

    /**
     * Detail view: metadata, refs, stats, actions and the changed files.
     * @param props - commit detail value, refs, dialog state and callbacks.
     * @returns the detail pane.
     */
    function DetailView(props) {
      const { t, commit, refIndex, branches, dirty, dialog, run, copy, sessionId, onOpenDialog, onCancelDialog, onConfirmDialog, onRunFetch, onSelectCommit, onCopy, diffCache } = props;
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const hash = typeof record.hash === "string" ? record.hash : "";
      const abbrev = typeof record.abbrev === "string" && record.abbrev !== "" ? record.abbrev : hash.slice(0, 7);
      const lang = currentLanguage();
      const refs = classifyRefs(record.refs, refIndex, 12);
      const parents = Array.isArray(record.parents) ? record.parents.filter((parent) => typeof parent === "string" && parent !== "") : [];
      const files = Array.isArray(record.files) ? record.files : [];
      const groups = groupFiles(files);
      const stats = record.stats !== null && typeof record.stats === "object" ? record.stats : null;
      const fileCount = stats !== null && Number.isFinite(stats.files) ? stats.files : files.length;
      const insertions = stats !== null && Number.isFinite(stats.insertions) ? stats.insertions : 0;
      const deletions = stats !== null && Number.isFinite(stats.deletions) ? stats.deletions : 0;
      const running = run !== null && typeof run === "object" && run.phase === "running";
      const copyLabel = copy !== null && typeof copy === "object" && copy.text === hash ? (copy.state === "copied" ? t("toolbar.copied") : copy.state === "failed" ? t("toolbar.copyFailed") : t("toolbar.copyHash")) : t("toolbar.copyHash");
      const actions = ["checkoutBranch", "checkoutCommit", "createBranch", "deleteBranch", "cherryPick", "revert", "createTag", "deleteTag", "fetch"];

      return h(
        "div",
        { className: "dgg-detail" },
        h("h2", { className: "dgg-subject-lg" }, typeof record.subject === "string" && record.subject !== "" ? record.subject : abbrev),
        typeof record.body === "string" && record.body.trim() !== "" ? h("pre", { className: "dgg-body" }, record.body) : null,
        h(
          "div",
          { className: "dgg-kv" },
          h("span", { className: "dgg-k" }, t("detail.author")),
          h("span", { className: "dgg-v" }, personLine(record.authorName, record.authorEmail, record.authorTime, lang)),
          h("span", { className: "dgg-k" }, t("detail.committer")),
          h("span", { className: "dgg-v" }, personLine(record.committerName, record.committerEmail, record.committerTime, lang)),
          h("span", { className: "dgg-k" }, t("detail.hash")),
          h(
            "span",
            { className: "dgg-v dgg-inline" },
            h("code", { className: "dgg-code", title: t("detail.hash") + ": " + hash }, abbrev),
            h("button", { type: "button", className: "dgg-link", onClick: () => onCopy(hash) }, copyLabel),
          ),
          h("span", { className: "dgg-k" }, t("detail.parents")),
          h(
            "span",
            { className: "dgg-v dgg-inline" },
            parents.length === 0
              ? "—"
              : parents.map((parent) =>
                  h("button", { key: parent, type: "button", className: "dgg-link dgg-code", title: parent, onClick: () => onSelectCommit(parent) }, parent.slice(0, 7)),
                ),
          ),
        ),
        refs.length > 0
          ? h(RefChips, {
              chips: refs,
              t,
              onPick: (chip) => onOpenDialog("checkoutBranch", chip.label),
            })
          : null,
        h("div", { className: "dgg-stats" }, t("detail.stats", { files: fileCount, insertions, deletions })),
        h(
          "div",
          { className: "dgg-section" },
          h("div", { className: "dgg-actions" },
            actions.map((kind) =>
              h(
                "button",
                {
                  key: kind,
                  type: "button",
                  className: "dgg-btn",
                  disabled: running === true,
                  onClick: () => (kind === "fetch" ? onRunFetch() : onOpenDialog(kind)),
                },
                t("action." + kind),
              ),
            ),
          ),
          dialog !== null && typeof dialog === "object"
            ? h(ActionDialog, {
                key: dialog.kind + "|" + (dialog.requestedRef || "") + "|" + (dialog.hash || ""),
                t,
                dialog,
                dirty,
                running: running === true,
                onCancel: onCancelDialog,
                onConfirm: onConfirmDialog,
              })
            : null,
        ),
        h(
          "div",
          { className: "dgg-section" },
          h("h3", { className: "dgg-section-title" }, t("detail.files")),
          groups.length === 0
            ? h("p", { className: "dgg-hint" }, t("detail.noFiles"))
            : h(
                "div",
                { className: "dgg-files" },
                groups.map(([status, group]) =>
                  h(
                    "div",
                    { className: "dgg-group", key: status },
                    h("h4", { className: "dgg-group-title", title: status }, status),
                    group.map((file, index) =>
                      h(FileRow, {
                        key: (typeof file.path === "string" ? file.path : "file") + "#" + index,
                        t,
                        sessionId,
                        hash,
                        file,
                        cache: diffCache,
                      }),
                    ),
                  ),
                ),
              ),
        ),
      );
    }

    /**
     * The whole tab body: toolbar, master list, detail view and inline actions.
     * @param props - session id, translate function and the slot's standard props.
     * @returns the tab content.
     */
    function GitGraphBody(props) {
      const t = props !== null && typeof props === "object" && typeof props.t === "function" ? props.t : (key) => key;
      const sessionId = props !== null && typeof props === "object" && typeof props.sessionId === "string" ? props.sessionId : undefined;

      const [graph, setGraph] = React.useState({ status: "loading", value: null, error: null });
      const [reloadKey, setReloadKey] = React.useState(0);
      const [limit, setLimit] = React.useState(PAGE_SIZE);
      const [selected, setSelected] = React.useState(null);
      const [detail, setDetail] = React.useState({ status: "idle", value: null, error: null });
      const [menuOpen, setMenuOpen] = React.useState(false);
      const [dialog, setDialog] = React.useState(null);
      const [run, setRun] = React.useState(null);
      /** Branch awaiting a force-delete decision after a not-merged refusal. */
      const forceRef = React.useRef(null);
      const [copy, setCopy] = React.useState({ state: "idle", text: "" });
      const actionController = React.useRef(null);
      const diffCache = React.useRef(new Map());

      // The graph page: aborted when the session, the page size or a refresh supersedes it.
      React.useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setGraph((previous) => ({
          status: previous.value === null ? "loading" : "refreshing",
          value: previous.value,
          error: null,
        }));
        postJson("graph", { sessionId, limit }, controller.signal).then(
          (value) => {
            if (active) setGraph({ status: "ready", value, error: null });
          },
          (error) => {
            if (!active || isAbort(error)) return;
            setGraph((previous) => ({ status: "error", value: previous.value, error: messageOf(error) }));
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [sessionId, limit, reloadKey]);

      // The selected commit's detail, kept visible while a refresh is in flight.
      React.useEffect(() => {
        if (selected === null || typeof selected.hash !== "string" || selected.hash === "") {
          setDetail({ status: "idle", value: null, error: null });
          return undefined;
        }
        const controller = new AbortController();
        let active = true;
        setDetail((previous) => {
          const reusable = previous.value !== null && typeof previous.value === "object" && previous.value.hash === selected.hash;
          return { status: reusable ? "refreshing" : "loading", value: reusable ? previous.value : null, error: null };
        });
        postJson("commit", { sessionId, hash: selected.hash }, controller.signal).then(
          (value) => {
            if (active) setDetail({ status: "ready", value, error: null });
          },
          (error) => {
            if (!active || isAbort(error)) return;
            setDetail((previous) => ({ status: "error", value: previous.value, error: messageOf(error) }));
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [sessionId, selected, reloadKey]);

      // Abort a running repository action when the tab unmounts.
      React.useEffect(
        () => () => {
          const controller = actionController.current;
          if (controller !== null && typeof controller.abort === "function") controller.abort();
        },
        [],
      );

      // Clear the transient “copied”/“copy failed” feedback.
      React.useEffect(() => {
        if (copy.state === "idle") return undefined;
        const timer = setTimeout(() => setCopy({ state: "idle", text: "" }), 1800);
        return () => clearTimeout(timer);
      }, [copy.state, copy.text]);

      const value = graph.value;
      const refIndex = React.useMemo(() => {
        const index = new Map();
        const refs = value !== null && typeof value === "object" && Array.isArray(value.refs) ? value.refs : [];
        for (const ref of refs) {
          if (ref === null || typeof ref !== "object") continue;
          const fullName = typeof ref.name === "string" ? ref.name : "";
          const shortName = typeof ref.shortName === "string" && ref.shortName !== "" ? ref.shortName : fullName.replace(/^refs\/(heads|remotes|tags)\//, "");
          const entry = {
            label: shortName,
            kind: refKind(ref),
            name: fullName,
            head: ref.head === true,
          };
          if (fullName !== "") index.set(fullName, entry);
          if (shortName !== "") index.set(shortName, entry);
        }
        return index;
      }, [value]);

      const branches = React.useMemo(() => {
        const refs = value !== null && typeof value === "object" && Array.isArray(value.refs) ? value.refs : [];
        const local = [];
        const remote = [];
        for (const ref of refs) {
          if (ref === null || typeof ref !== "object" || typeof ref.shortName !== "string" || ref.shortName === "") continue;
          const kind = refKind(ref);
          if (kind === "branch") local.push({ name: ref.shortName });
          else if (kind === "remote" && ref.head !== true) remote.push({ name: ref.shortName });
        }
        return local.length > 0 ? local : remote;
      }, [value]);

      const tags = React.useMemo(() => {
        const refs = value !== null && typeof value === "object" && Array.isArray(value.refs) ? value.refs : [];
        const result = [];
        for (const ref of refs) {
          if (ref === null || typeof ref !== "object" || refKind(ref) !== "tag") continue;
          const name = typeof ref.shortName === "string" && ref.shortName !== "" ? ref.shortName : typeof ref.name === "string" ? ref.name.replace(/^refs\/tags\//, "") : "";
          if (name !== "") result.push({ name });
        }
        return result;
      }, [value]);

      const commits = React.useMemo(() => (value !== null && typeof value === "object" && Array.isArray(value.commits) ? value.commits : []), [value]);
      const layout = React.useMemo(() => layoutGraph(commits), [commits]);

      const dirty = value !== null && typeof value === "object" && value.status !== null && typeof value.status === "object" && Number.isFinite(value.status.dirty) ? value.status.dirty : 0;
      const head = value !== null && typeof value === "object" && value.head !== null && typeof value.head === "object" ? value.head : null;
      const branchLabel = head === null
        ? ""
        : head.detached === true
          ? t("toolbar.detached")
          : typeof head.branch === "string" && head.branch !== ""
            ? head.branch
            : "";
      const repoLabel = value !== null && typeof value === "object" ? basename(value.repoPath) : "";
      const repoPath = value !== null && typeof value === "object" && typeof value.repoPath === "string" ? value.repoPath : "";

      /** The branch HEAD is on, excluded from the delete-branch choices. */
      const currentBranch = head !== null && head.detached !== true && typeof head.branch === "string" ? head.branch : "";

      function refresh() {
        setReloadKey((key) => key + 1);
      }

      function openDialog(kind, requestedRef) {
        const hash = selected !== null && typeof selected.hash === "string" ? selected.hash : "";
        setMenuOpen(false);
        forceRef.current = null;
        setDialog({
          kind,
          hash,
          ...actionDialogSpec(kind, { branches, tags, currentBranch }),
          requestedRef: typeof requestedRef === "string" ? requestedRef : "",
        });
      }

      /**
       * Run one confirmed action.
       *
       * A failure keeps both the human message and git's own output: the latter is
       * shown behind a disclosure so the raw stderr is never lost (TODO-2).
       * @param kind - action discriminator.
       * @param args - action arguments.
       */
      function runAction(kind, args, signal) {
        setRun({ kind, phase: "running", message: "", detail: "", expanded: false });
        postJson("action", Object.assign({ sessionId, action: kind }, args), signal).then(
          (result) => {
            const record = result !== null && typeof result === "object" ? result : {};
            const message = typeof record.message === "string" && record.message !== "" ? record.message : "";
            const detail = typeof record.output === "string" ? record.output.trim() : "";
            setRun({ kind, phase: "success", message: t("action.success") + (message === "" ? "" : " · " + message), detail, expanded: false });
            refresh();
          },
          (error) => {
            if (isAbort(error)) return;
            // A not-merged branch is a distinct, recoverable outcome: offer force delete.
            const details = error !== null && typeof error === "object" ? error : {};
            const gitOutput = typeof details.output === "string" ? details.output.trim() : "";
            const reason = messageOf(error);
            const notMerged = isUnmergedRefusal(kind, reason + " " + gitOutput);
            setRun({
              kind,
              phase: "error",
              message: notMerged ? t("action.notMerged") + " " + reason : t("action.failed", { message: reason }),
              detail: gitOutput === "" ? reason : gitOutput,
              expanded: false,
              forceRef: notMerged && typeof forceRef.current === "string" ? forceRef.current : null,
            });
          },
        );
      }

      function startAction(kind, args) {
        const controller = new AbortController();
        const previous = actionController.current;
        if (previous !== null && typeof previous.abort === "function") previous.abort();
        actionController.current = controller;
        runAction(kind, args === undefined ? {} : args, controller.signal);
      }

      function confirmDialog(name, ref) {
        if (dialog === null || typeof dialog !== "object") return;
        const kind = dialog.kind;
        if (kind === "deleteBranch") forceRef.current = ref;
        const args = actionArguments(kind, { name, ref, hash: dialog.hash });
        setDialog(null);
        startAction(kind, args);
      }

      function handleCopy(text) {
        if (typeof text !== "string" || text === "") return;
        const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
        if (clipboard === undefined || clipboard === null || typeof clipboard.writeText !== "function") {
          setCopy({ state: "failed", text });
          return;
        }
        try {
          Promise.resolve(clipboard.writeText(text)).then(
            () => setCopy({ state: "copied", text }),
            () => setCopy({ state: "failed", text }),
          );
        } catch {
          setCopy({ state: "failed", text });
        }
      }

      function handleRootKeyDown(event) {
        if (event.key !== "Escape") return;
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        if (dialog !== null) {
          setDialog(null);
          return;
        }
        if (selected !== null) setSelected(null);
      }

      function selectCommit(hash) {
        if (typeof hash !== "string" || hash === "") return;
        setRun(null);
        setDialog(null);
        setMenuOpen(false);
        setSelected({ hash });
      }

      const running = run !== null && typeof run === "object" && run.phase === "running";
      const busy = graph.status === "refreshing" || running;
      const backVisible = selected !== null;

      let content;
      if (selected === null) {
        if (value === null) {
          content = graph.status === "error" ? h(ErrorState, { t, message: graph.error, onRetry: refresh }) : h(LoadingState, { t });
        } else if (value.isRepo === false) {
          content = h(NotRepoState, {
            t,
            pathValue: typeof value.workspacePath === "string" && value.workspacePath !== "" ? value.workspacePath : repoPath,
            onRetry: refresh,
          });
        } else if (commits.length === 0) {
          content = h(EmptyState, { t, onRetry: refresh });
        } else {
          content = h(
            "div",
            { className: "dgg-listwrap" },
            graph.status === "error"
              ? h(
                  "div",
                  { className: "dgg-banner" },
                  h("span", null, t("state.error") + (typeof graph.error === "string" && graph.error !== "" ? ": " + graph.error : "")),
                  h("button", { type: "button", className: "dgg-btn", onClick: refresh }, t("state.retry")),
                )
              : null,
            h(CommitList, {
              t,
              value,
              layout,
              refIndex,
              onSelect: selectCommit,
              onLoadMore: () => setLimit((current) => Math.min(current + PAGE_SIZE, PAGE_MAX)),
              canLoadMore: value.truncated === true && commits.length < PAGE_MAX && limit < PAGE_MAX,
              loadingMore: graph.status === "refreshing",
            }),
          );
        }
      } else if (detail.value !== null) {
        content = h(DetailView, {
          t,
          commit: detail.value,
          refIndex,
          branches,
          dirty,
          dialog,
          run,
          copy,
          sessionId,
          diffCache,
          onOpenDialog: openDialog,
          onCancelDialog: () => setDialog(null),
          onConfirmDialog: confirmDialog,
          onRunFetch: () => startAction("fetch", {}),
          onSelectCommit: selectCommit,
          onCopy: handleCopy,
        });
      } else if (detail.status === "error") {
        content = h(ErrorState, { t, message: detail.error, onRetry: refresh });
      } else {
        content = h(LoadingState, { t });
      }

      return h(
        "div",
        { className: "dgg-root", onKeyDown: handleRootKeyDown },
        h("style", { key: "dgg-style" }, CSS),
        h(Toolbar, {
          t,
          repoLabel,
          repoPath,
          branchLabel,
          dirty,
          busy,
          backVisible,
          menuOpen,
          running,
          onRefresh: refresh,
          onToggleMenu: () => setMenuOpen((open) => !open),
          onCloseMenu: () => setMenuOpen(false),
          onFetch: () => {
            setMenuOpen(false);
            startAction("fetch", {});
          },
          onBack: () => {
            setDialog(null);
            setMenuOpen(false);
            setSelected(null);
          },
        }),
        h(
          "div",
          { className: "dgg-live", role: "status", "aria-live": "polite" },
          run !== null && typeof run === "object"
            ? h(
                "div",
                { className: "dgg-feedback dgg-feedback-" + run.phase },
                run.phase === "running" ? h(Spinner) : null,
                h("span", { className: "dgg-feedback-text" }, run.phase === "running" ? t("action.running") + " " + t("action." + run.kind) : run.message),
                run.phase !== "running" && typeof run.detail === "string" && run.detail !== ""
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "dgg-link",
                        "aria-expanded": run.expanded === true,
                        onClick: () => setRun((previous) => (previous === null ? previous : { ...previous, expanded: !previous.expanded })),
                      },
                      run.expanded === true ? t("action.hideOutput") : t("action.output"),
                    )
                  : null,
                run.forceRef !== undefined && run.forceRef !== null && typeof run.forceRef === "string" && run.phase === "error"
                  ? h(
                      "button",
                      {
                        type: "button",
                        className: "dgg-btn dgg-btn-danger",
                        disabled: running,
                        onClick: () => {
                          const target = run.forceRef;
                          forceRef.current = null;
                          startAction("deleteBranch", { name: target, force: true });
                        },
                      },
                      t("action.forceDeleteBranch"),
                    )
                  : null,
              )
            : null,
          run !== null && typeof run === "object" && run.expanded === true && typeof run.detail === "string" && run.detail !== ""
            ? h("pre", { className: "dgg-output" }, run.detail)
            : null,
        ),
        h("div", { className: "dgg-main" }, content),
      );
    }

    /** Services required by the tab type, its guide card and its body. */
    const inject = ["slots", "locale", "sidebarRight", "sidebarRightTabs"];

    /**
     * Register the locale dictionaries, the `git-graph` tab type with its guide
     * entry, and the pane body keyed by the type's own id.
     * @param ctx - client root context with slots, locale and a right sidebar.
     */
    function apply(ctx) {
      const t = ctx.locale.bind(LOCALE_NS);
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), "dsh-git-graph.copy");
      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            title: () => t("tab.title"),
            guide: [
              {
                id: "open",
                order: GUIDE_ORDER,
                title: () => t("tab.title"),
                description: () => t("tab.description"),
                icon: GitGraphIcon,
              },
            ],
          }),
        "dsh-git-graph.type",
      );
      ctx.effect(
        () =>
          ctx.slots.inject("sidebar.right.pane.tab", () =>
            ctx.slots.register(
              {
                name: "sidebar.right.pane.tab",
                key: TAB_ID,
                locale: LOCALE_NS,
                inject: (sessionId) => ({ sessionId }),
              },
              GitGraphBody,
            ),
          ),
        "dsh-git-graph.body",
      );
    }

    return { apply, inject };
  },
});
