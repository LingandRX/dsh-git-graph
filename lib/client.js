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
      "menu.label": "提交操作",
      "menu.noCommit": "此提交不可用",
      "menu.busy": "正在执行其他操作",
      "menu.mergeRevert": "合并提交无法直接还原",
      "menu.compare": "与 {base} 比较",
      "uncommitted.title": "未提交改动",
      "uncommitted.total": "{count} 个文件有改动",
      "uncommitted.counts": "已暂存 {staged} · 未暂存 {unstaged} · 未跟踪 {untracked}",
      "uncommitted.staged": "已暂存",
      "uncommitted.unstaged": "未暂存",
      "uncommitted.untracked": "未跟踪",
      "uncommitted.empty": "没有未提交的改动",
      "uncommitted.error": "读取未提交改动失败",
      "uncommitted.untrackedHint": "未跟踪的文件还没有可显示的差异",
      "compare.title": "比较提交",
      "compare.base": "基准",
      "compare.head": "对照",
      "compare.swap": "交换方向",
      "compare.exit": "退出比较",
      "compare.empty": "这两个提交没有差异",
      "compare.error": "比较提交失败",
      "compare.hint": "按住 Ctrl/⌘ 点击另一提交即可比较",
      "action.renameBranch": "重命名分支",
      "action.oldBranchName": "原分支名称",
      "action.newBranchName": "新分支名称",
      "menu.refLabel": "引用操作",
      "menu.copyName": "复制名称",
      "menu.copyRef": "复制引用",
      "menu.checkedOutBranch": "当前分支不能删除",
      "menu.noRemotes": "没有配置远程仓库",
      "menu.noRef": "此引用不可用",
      "find.label": "查找提交",
      "find.placeholder": "搜索提交、作者、哈希或引用",
      "find.counter": "第 {current} 个，共 {total} 个匹配",
      "find.noMatches": "没有匹配的提交",
      "find.prev": "上一个匹配",
      "find.next": "下一个匹配",
      "find.close": "关闭查找",
      "filter.label": "分支过滤",
      "filter.all": "全部",
      "filter.empty": "没有本地分支",
      "filter.close": "关闭分支过滤",
      "filter.current": "当前分支",
      "order.label": "提交排序",
      "order.date": "提交日期",
      "order.authorDate": "作者日期",
      "order.topo": "拓扑顺序",
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
      "menu.label": "Commit actions",
      "menu.noCommit": "This commit is unavailable",
      "menu.busy": "Another action is running",
      "menu.mergeRevert": "A merge commit cannot be reverted directly",
      "menu.compare": "Compare with {base}",
      "uncommitted.title": "Uncommitted changes",
      "uncommitted.total": "{count} changed file(s)",
      "uncommitted.counts": "Staged {staged} · Unstaged {unstaged} · Untracked {untracked}",
      "uncommitted.staged": "Staged",
      "uncommitted.unstaged": "Unstaged",
      "uncommitted.untracked": "Untracked",
      "uncommitted.empty": "No uncommitted changes",
      "uncommitted.error": "Could not read uncommitted changes",
      "uncommitted.untrackedHint": "Untracked files have no diff to show yet",
      "compare.title": "Compare commits",
      "compare.base": "Base",
      "compare.head": "Head",
      "compare.swap": "Swap sides",
      "compare.exit": "Exit comparison",
      "compare.empty": "These commits have no differences",
      "compare.error": "Could not compare the commits",
      "compare.hint": "Ctrl/⌘-click another commit to compare",
      "action.renameBranch": "Rename branch",
      "action.oldBranchName": "Current branch name",
      "action.newBranchName": "New branch name",
      "menu.refLabel": "Ref actions",
      "menu.copyName": "Copy name",
      "menu.copyRef": "Copy ref",
      "menu.checkedOutBranch": "The checked-out branch cannot be deleted",
      "menu.noRemotes": "No remotes are configured",
      "menu.noRef": "This ref is unavailable",
      "find.label": "Find commit",
      "find.placeholder": "Search subject, author, hash or ref",
      "find.counter": "{current} of {total} matches",
      "find.noMatches": "No matching commits",
      "find.prev": "Previous match",
      "find.next": "Next match",
      "find.close": "Close search",
      "filter.label": "Branch filter",
      "filter.all": "All",
      "filter.empty": "No local branches",
      "filter.close": "Close branch filter",
      "filter.current": "current",
      "order.label": "Commit order",
      "order.date": "Committer date",
      "order.authorDate": "Author date",
      "order.topo": "Topological",
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
.dgg-icon-btn-on{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}
.dgg-icon-btn:focus-visible,.dgg-row:focus-visible,.dgg-btn:focus-visible,.dgg-file-head:focus-visible,.dgg-chip-btn:focus-visible,.dgg-chip:focus-visible,.dgg-menu-item:focus-visible,.dgg-context-item:focus-visible,.dgg-find-input:focus-visible,.dgg-filter-option input:focus-visible,.dgg-menu-select:focus-visible,.dgg-input:focus-visible,.dgg-select:focus-visible,.dgg-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
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
.dgg-row-selected{background:var(--dsw-alias-interactive-bg-hover)}
.dgg-inline-dialog{flex:none;padding:8px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base)}
.dgg-row-uncommitted{background:var(--dsw-alias-bg-layer-1);border-bottom:1px dashed var(--dsw-alias-border-l3)}
.dgg-row-uncommitted:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dgg-pending{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;color:var(--dsw-alias-state-warn-label)}
.dgg-context-menu{position:fixed;z-index:60;min-width:172px;max-width:240px;overflow:auto;padding:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay)}
.dgg-context-item{position:relative}
.dgg-context-item-active{background:var(--dsw-alias-interactive-bg-hover);outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dgg-uncommitted{display:flex;flex-direction:column;gap:10px;padding:10px 10px 20px}
.dgg-compare{display:flex;flex-direction:column;gap:10px;padding:10px 10px 20px}
.dgg-compare-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dgg-compare-abbrev{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.dgg-compare .dgg-btn{font-size:10.5px;padding:1px 7px}
.dgg-compare-hint{margin:0;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.dgg-subbar{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;min-width:0;background:var(--dsw-alias-bg-layer-1)}
.dgg-findbar{flex-wrap:nowrap}
.dgg-find-input{flex:1 1 auto;min-width:0;font-size:11px;padding:2px 6px}
.dgg-find-count{flex:none;font-size:10px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dgg-find-icon{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary)}
.dgg-filterbar{display:flex;align-items:flex-start;gap:6px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;min-width:0;flex-wrap:wrap;background:var(--dsw-alias-bg-layer-1)}
.dgg-filter-title{flex:none;font-size:10.5px;color:var(--dsw-alias-label-tertiary);padding-top:2px}
.dgg-filter-options{display:flex;flex-wrap:wrap;gap:2px 10px;flex:1 1 140px;min-width:0;max-height:88px;overflow:auto}
.dgg-filter-option{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:var(--dsw-alias-label-secondary);cursor:pointer;min-width:0}
.dgg-filter-option input{margin:0;accent-color:var(--dsw-alias-brand-primary);flex:none}
.dgg-filter-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}
.dgg-filter-head{font-size:9px;color:var(--dsw-alias-label-tertiary);flex:none}
.dgg-menu-field{display:flex;flex-direction:column;gap:3px;padding:4px 6px}
.dgg-menu-field-label{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.dgg-menu-select{font-size:11px;width:100%}
.dgg-row-active{background:var(--dsw-alias-interactive-bg-active)}
.dgg-list-empty{padding:14px 10px;margin:0}
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
        kind === "renameBranch" ? "rename"
          : kind === "createBranch" || kind === "createTag" ? "name"
            : kind === "checkoutBranch" || kind === "deleteBranch" ? "branch"
              : kind === "deleteTag" ? "tag" : null;
      const destructive =
        kind === "checkoutBranch" || kind === "checkoutCommit" || kind === "cherryPick" ||
        kind === "revert" || kind === "deleteTag" || kind === "deleteBranch";
      return {
        needs,
        options,
        destructive,
        dirtySensitive:
          kind !== "createBranch" && kind !== "createTag" && kind !== "deleteTag" &&
          kind !== "deleteBranch" && kind !== "renameBranch",
      };
    }

    /**
     * Build the request arguments a confirmed dialog submits.
     * @param kind - action discriminator.
     * @param input - `{ name, ref, hash, newName }` as entered in the dialog.
     * @returns the argument object for the `action` route.
     */
    function actionArguments(kind, input) {
      const name = typeof input?.name === "string" ? input.name : "";
      const ref = typeof input?.ref === "string" ? input.ref : "";
      const hash = typeof input?.hash === "string" ? input.hash : "";
      const newName = typeof input?.newName === "string" ? input.newName : "";
      if (kind === "checkoutBranch") return { branch: ref };
      if (kind === "deleteTag") return { name: ref };
      // A first delete attempt is always non-forcing; the UI escalates only after
      // git refuses an unmerged branch.
      if (kind === "deleteBranch") return { name: ref, force: false };
      if (kind === "renameBranch") return { name, newName };
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

    // ── wave 2: commit menu, uncommitted row, comparison (pure) ────────────

    /** Estimated width of the commit context menu, for viewport clamping. */
    const MENU_WIDTH = 190;
    /** Estimated height of one context-menu item. */
    const MENU_ITEM_HEIGHT = 27;
    /** Estimated vertical chrome of the context menu. */
    const MENU_PADDING = 10;

    /** Items every commit offers, in display order, before context adjustments. */
    const COMMIT_MENU_ITEMS = [
      { id: "checkout-commit", kind: "checkoutCommit", labelKey: "action.checkoutCommit" },
      { id: "create-branch", kind: "createBranch", labelKey: "action.createBranch" },
      { id: "cherry-pick", kind: "cherryPick", labelKey: "action.cherryPick" },
      { id: "revert", kind: "revert", labelKey: "action.revert" },
      { id: "create-tag", kind: "createTag", labelKey: "action.createTag" },
      { id: "copy-hash", kind: "copyHash", labelKey: "toolbar.copyHash" },
    ];

    /**
     * Items of one commit's context menu.
     *
     * Pure so the availability rules are testable without a render: a commit
     * without a hash disables everything, a running action disables everything,
     * and `git revert` cannot take a merge commit without a mainline, so that one
     * item carries a reason instead of failing after the confirm step.
     * @param commit - commit record the menu was opened on.
     * @param context - `{ baseHash?, baseAbbrev?, busy? }`: the selected commit to
     *   compare against, and whether another action is still running.
     * @returns `[{ id, labelKey, kind, disabled?, reasonKey?, params? }]`.
     */
    function commitMenuItems(commit, context) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const hash = typeof record.hash === "string" ? record.hash : "";
      const parents = Array.isArray(record.parents) ? record.parents.filter((parent) => typeof parent === "string" && parent !== "") : [];
      const merge = parents.length > 1;
      const settings = context !== null && typeof context === "object" ? context : {};
      const baseHash = typeof settings.baseHash === "string" ? settings.baseHash : "";
      const baseAbbrev = typeof settings.baseAbbrev === "string" && settings.baseAbbrev !== "" ? settings.baseAbbrev : baseHash.slice(0, 7);
      const busy = settings.busy === true;
      const comparable = hash !== "" && baseHash !== "" && baseHash !== hash;

      const items = [];
      for (const template of COMMIT_MENU_ITEMS) {
        if (comparable && template.kind === "copyHash") {
          items.push({ id: "compare", kind: "compare", labelKey: "menu.compare", params: { base: baseAbbrev } });
        }
        items.push({ ...template });
      }

      return items.map((item) => {
        if (hash === "") return { ...item, disabled: true, reasonKey: "menu.noCommit" };
        if (busy) return { ...item, disabled: true, reasonKey: "menu.busy" };
        if (item.kind === "revert" && merge) return { ...item, disabled: true, reasonKey: "menu.mergeRevert" };
        return item;
      });
    }

    /**
     * Next active index when a key moves through a menu.
     * @param items - menu items.
     * @param index - current active index.
     * @param key - keyboard key.
     * @returns the next index, or -1 when the key does not move the menu.
     */
    function menuStep(items, index, key) {
      const list = Array.isArray(items) ? items : [];
      const enabled = [];
      for (let position = 0; position < list.length; position += 1) {
        if (list[position] !== null && typeof list[position] === "object" && list[position].disabled !== true) enabled.push(position);
      }
      if (enabled.length === 0) return -1;
      if (key === "Home") return enabled[0];
      if (key === "End") return enabled[enabled.length - 1];
      const delta = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
      if (delta === 0) return -1;
      const current = enabled.indexOf(index);
      if (current === -1) return delta > 0 ? enabled[0] : enabled[enabled.length - 1];
      return enabled[(current + delta + enabled.length) % enabled.length];
    }

    /**
     * Clamp a fixed-position menu rectangle into the viewport.
     * @param point - `{ x, y }` pointer position.
     * @param size - `{ width, height }` estimated menu size.
     * @param viewport - `{ width, height }` of the window.
     * @returns `{ left, top, maxHeight }` for the menu's inline style.
     */
    function placeMenu(point, size, viewport) {
      const margin = 4;
      const finite = (value, fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
      const x = finite(point !== null && typeof point === "object" ? point.x : undefined, 0);
      const y = finite(point !== null && typeof point === "object" ? point.y : undefined, 0);
      const width = finite(size !== null && typeof size === "object" ? size.width : undefined, 0);
      const height = finite(size !== null && typeof size === "object" ? size.height : undefined, 0);
      const viewWidth = finite(viewport !== null && typeof viewport === "object" ? viewport.width : undefined, 0);
      const viewHeight = finite(viewport !== null && typeof viewport === "object" ? viewport.height : undefined, 0);
      let left = Math.max(margin, x);
      let top = Math.max(margin, y);
      if (viewWidth > 0 && width > 0 && left + width + margin > viewWidth) left = Math.max(margin, viewWidth - width - margin);
      if (viewHeight > 0 && height > 0 && top + height + margin > viewHeight) top = Math.max(margin, viewHeight - height - margin);
      return { left, top, maxHeight: viewHeight > 0 ? Math.max(120, viewHeight - margin * 2) : 0 };
    }

    /**
     * Whether the commit a menu was opened on still exists in the page.
     * @param menu - `{ hash }` context-menu state.
     * @param commits - commits of the current page.
     * @returns true while the menu still makes sense.
     */
    function menuStillValid(menu, commits) {
      if (menu === null || typeof menu !== "object") return false;
      const hash = typeof menu.hash === "string" ? menu.hash : "";
      if (hash === "") return false;
      const list = Array.isArray(commits) ? commits : [];
      return list.some((commit) => commit !== null && typeof commit === "object" && commit.hash === hash);
    }

    /**
     * Normalize the `uncommitted` route value into display counts.
     *
     * The graph's own dirty count is the fallback: when the counts route has not
     * answered (or the host half predates it) the row still appears, just without
     * the staged/unstaged/untracked breakdown.
     * @param value - `uncommitted` route value.
     * @param fallbackTotal - dirty count from the graph value.
     * @returns `{ staged, unstaged, untracked, listed, dirty, total, visible }`.
     */
    function uncommittedSummary(value, fallbackTotal) {
      const record = value !== null && typeof value === "object" ? value : {};
      const counts = record.counts !== null && typeof record.counts === "object" ? record.counts : {};
      const count = (candidate) => (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0 ? Math.floor(candidate) : 0);
      const staged = count(counts.staged);
      const unstaged = count(counts.unstaged);
      const untracked = count(counts.untracked);
      const listed = staged + unstaged + untracked;
      const dirty = count(fallbackTotal);
      const total = listed > 0 ? listed : dirty;
      return { staged, unstaged, untracked, listed, dirty, total, visible: record.isRepo !== false && total > 0 };
    }

    /**
     * The synthetic “uncommitted changes” row shown above the graph.
     * @param summary - normalized counts from {@link uncommittedSummary}.
     * @returns a row descriptor, or null when the row is hidden.
     */
    function uncommittedRow(summary) {
      if (summary === null || typeof summary !== "object" || summary.visible !== true) return null;
      return {
        key: "uncommitted",
        total: summary.total,
        counts: { staged: summary.staged, unstaged: summary.unstaged, untracked: summary.untracked },
      };
    }

    /**
     * The master list model.
     *
     * The synthetic row is display-only: `layoutGraph` receives exactly the real
     * commits, so showing or hiding it can never move a lane (asserted in tests).
     * @param commits - real commits of the page, newest first.
     * @param summary - normalized uncommitted counts.
     * @returns `{ commits, synthetic, layout, rowCount }`.
     */
    function buildListModel(commits, summary) {
      const real = Array.isArray(commits) ? commits : [];
      const synthetic = uncommittedRow(summary);
      return {
        commits: real,
        synthetic,
        layout: layoutGraph(real),
        rowCount: real.length + (synthetic === null ? 0 : 1),
      };
    }

    /**
     * Group the `uncommitted` route value into the pane's sections.
     * @param value - `uncommitted` route value.
     * @returns `[{ id, scope, labelKey, files, hintKey? }]`, empty groups omitted.
     */
    function uncommittedGroups(value) {
      const record = value !== null && typeof value === "object" ? value : {};
      const section = (raw) => (Array.isArray(raw) ? raw.filter((file) => file !== null && typeof file === "object") : []);
      const groups = [];
      const staged = section(record.staged);
      const unstaged = section(record.unstaged);
      const untracked = section(record.untracked);
      if (staged.length > 0) groups.push({ id: "staged", scope: "staged", labelKey: "uncommitted.staged", files: staged });
      if (unstaged.length > 0) groups.push({ id: "unstaged", scope: "unstaged", labelKey: "uncommitted.unstaged", files: unstaged });
      // `git diff` cannot show untracked content; the request still uses the
      // working-tree scope, and the row explains why the patch is empty.
      if (untracked.length > 0) {
        groups.push({ id: "untracked", scope: "unstaged", labelKey: "uncommitted.untracked", files: untracked, hintKey: "uncommitted.untrackedHint" });
      }
      return groups;
    }

    /**
     * Build the `diff` route body for one file in one scope.
     *
     * The single place each scope's request shape is constructed, so the commit,
     * working-tree and comparison views cannot drift apart.
     * @param input - `{ sessionId, scope, hash, base, head, file, oldPath, status }`.
     * @returns the JSON request body.
     */
    function diffRequest(input) {
      const spec = input !== null && typeof input === "object" ? input : {};
      const scope = spec.scope === "staged" || spec.scope === "unstaged" || spec.scope === "compare" ? spec.scope : "commit";
      const request = { sessionId: spec.sessionId, scope, file: typeof spec.file === "string" ? spec.file : "" };
      if (scope === "compare") {
        request.base = typeof spec.base === "string" ? spec.base : "";
        request.head = typeof spec.head === "string" ? spec.head : "";
      } else if (scope === "commit") {
        request.hash = typeof spec.hash === "string" ? spec.hash : "";
      }
      if (typeof spec.oldPath === "string" && spec.oldPath !== "") request.oldPath = spec.oldPath;
      if (typeof spec.status === "string" && spec.status !== "") request.status = spec.status;
      return request;
    }

    /**
     * Cache key of one diff request, including its scope and comparison endpoints.
     * @param input - same shape as {@link diffRequest}.
     * @returns a stable string key.
     */
    function diffCacheKey(input) {
      const request = diffRequest(input);
      const target = request.scope === "compare" ? request.base + ".." + request.head : request.scope === "commit" ? request.hash : "";
      return [request.scope, target, request.file, request.oldPath === undefined ? "" : request.oldPath].join("|");
    }

    /**
     * Build the `compare` route body.
     * @param input - `{ sessionId, base, head }`.
     * @returns the JSON request body.
     */
    function compareRequest(input) {
      const spec = input !== null && typeof input === "object" ? input : {};
      return {
        sessionId: spec.sessionId,
        base: typeof spec.base === "string" ? spec.base : "",
        head: typeof spec.head === "string" ? spec.head : "",
      };
    }

    // ── wave 3: ref menus, find, branch filter, order (pure) ───────────────

    /** Selectable commit orders, in display order; `date` is the default. */
    const COMMIT_ORDER_OPTIONS = [
      { value: "date", labelKey: "order.date" },
      { value: "author-date", labelKey: "order.authorDate" },
      { value: "topo", labelKey: "order.topo" },
    ];

    /** The template items one ref chip kind offers, before context adjustments. */
    const REF_MENU_ITEMS = {
      branch: [
        { id: "checkout-branch", kind: "checkoutBranch", labelKey: "action.checkoutBranch" },
        { id: "rename-branch", kind: "renameBranch", labelKey: "action.renameBranch" },
        { id: "delete-branch", kind: "deleteBranch", labelKey: "action.deleteBranch" },
        { id: "copy-ref", kind: "copyRef", labelKey: "menu.copyName" },
      ],
      tag: [
        { id: "delete-tag", kind: "deleteTag", labelKey: "action.deleteTag" },
        { id: "copy-ref", kind: "copyRef", labelKey: "menu.copyName" },
      ],
      remote: [
        { id: "copy-ref", kind: "copyRef", labelKey: "menu.copyRef" },
        { id: "fetch", kind: "fetch", labelKey: "action.fetch" },
      ],
    };

    /**
     * Items of one ref chip's context menu.
     *
     * Pure so the rules are testable without a render: a branch may be checked out
     * (even when it is the current branch, which is a no-op git accepts) but never
     * deleted, a remote offers fetch only when remotes exist, and an unknown chip
     * kind (including the bare HEAD badge) offers nothing at all.
     * @param chip - classified ref chip `{ label, kind, isHead, refName? }`.
     * @param context - `{ currentBranch?, busy?, hasRemotes? }`.
     * @returns `[{ id, labelKey, kind, disabled?, reasonKey? }]`.
     */
    function refMenuItems(chip, context) {
      const record = chip !== null && typeof chip === "object" ? chip : {};
      const kind = typeof record.kind === "string" ? record.kind : "";
      const label = typeof record.label === "string" ? record.label : "";
      const templates = Object.prototype.hasOwnProperty.call(REF_MENU_ITEMS, kind) ? REF_MENU_ITEMS[kind] : null;
      if (label === "" || templates === null) return [];
      const settings = context !== null && typeof context === "object" ? context : {};
      const currentBranch = typeof settings.currentBranch === "string" ? settings.currentBranch : "";
      const busy = settings.busy === true;
      const hasRemotes = settings.hasRemotes === true;
      const checkedOut = record.isHead === true || (currentBranch !== "" && label === currentBranch);
      return templates.map((template) => {
        const item = { ...template };
        if (busy) return { ...item, disabled: true, reasonKey: "menu.busy" };
        if (item.kind === "deleteBranch" && checkedOut) return { ...item, disabled: true, reasonKey: "menu.checkedOutBranch" };
        if (item.kind === "fetch" && !hasRemotes) return { ...item, disabled: true, reasonKey: "menu.noRemotes" };
        return item;
      });
    }

    /**
     * The text a ref menu's copy item puts on the clipboard.
     * @param chip - classified ref chip.
     * @returns the full ref name for remotes, otherwise the short name.
     */
    function refCopyValue(chip) {
      const record = chip !== null && typeof chip === "object" ? chip : {};
      if (record.kind === "remote" && typeof record.refName === "string" && record.refName !== "") return record.refName;
      return typeof record.label === "string" ? record.label : "";
    }

    /**
     * Whether a ref menu still makes sense: its chip's short name remains listed.
     * @param menu - ref-menu state `{ label }`.
     * @param refs - refs of the current graph value.
     * @returns true while the ref is still present.
     */
    function refMenuStillValid(menu, refs) {
      if (menu === null || typeof menu !== "object") return false;
      const label = typeof menu.label === "string" ? menu.label : "";
      if (label === "") return false;
      const list = Array.isArray(refs) ? refs : [];
      return list.some((ref) => {
        if (ref === null || typeof ref !== "object") return false;
        const shortName = typeof ref.shortName === "string" && ref.shortName !== ""
          ? ref.shortName
          : typeof ref.name === "string" ? ref.name.replace(/^refs\/(heads|remotes|tags)\//, "") : "";
        return shortName === label;
      });
    }

    /**
     * Whether one commit matches a find needle.
     * @param commit - commit record.
     * @param needle - lower-cased needle.
     * @returns true when subject, author, hashes or ref labels contain it.
     */
    function commitMatchesQuery(commit, needle) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const fields = [];
      const push = (value) => {
        if (typeof value === "string" && value !== "") fields.push(value);
      };
      push(record.subject);
      push(record.authorName);
      push(record.authorEmail);
      push(record.hash);
      push(record.abbrev);
      if (Array.isArray(record.refs)) {
        for (const ref of record.refs) {
          if (typeof ref !== "string" || ref === "") continue;
          push(ref.startsWith("tag: ") ? ref.slice(5) : ref);
        }
      }
      return fields.some((field) => field.toLowerCase().includes(needle));
    }

    /**
     * Client-side find over the already loaded page.
     * @param commits - commits of the current page.
     * @param query - raw search text.
     * @returns `{ matches, indices }`: match count and indices into `commits`.
     */
    function filterCommits(commits, query) {
      const list = Array.isArray(commits) ? commits : [];
      const needle = typeof query === "string" ? query.trim().toLowerCase() : "";
      const indices = [];
      if (needle === "") {
        for (let index = 0; index < list.length; index += 1) indices.push(index);
        return { matches: list.length, indices };
      }
      for (let index = 0; index < list.length; index += 1) {
        if (commitMatchesQuery(list[index], needle)) indices.push(index);
      }
      return { matches: indices.length, indices };
    }

    /**
     * The next active match, wrapping in both directions.
     * @param index - current active index (may be -1/out of range).
     * @param length - number of matches.
     * @param direction - 1 for next, -1 for previous.
     * @returns the next index, or -1 when there is nothing to select.
     */
    function nextMatch(index, length, direction) {
      const total = typeof length === "number" && Number.isFinite(length) && length > 0 ? Math.floor(length) : 0;
      if (total === 0) return -1;
      const current = typeof index === "number" && Number.isFinite(index) ? Math.floor(index) : -1;
      const step = direction === -1 ? -1 : 1;
      if (current < 0 || current >= total) return step > 0 ? 0 : total - 1;
      return (current + step + total) % total;
    }

    /**
     * Local branches offered by the branch filter.
     *
     * The default is "every local branch" (today's behavior), so each option is
     * selected by default; the HEAD branch is flagged for the current-branch badge.
     * @param refs - refs of the graph value.
     * @returns `[{ name, isHead, selectedByDefault }]`.
     */
    function branchFilterOptions(refs) {
      const list = Array.isArray(refs) ? refs : [];
      const options = [];
      for (const ref of list) {
        if (ref === null || typeof ref !== "object" || refKind(ref) !== "branch") continue;
        const name = typeof ref.shortName === "string" && ref.shortName !== ""
          ? ref.shortName
          : typeof ref.name === "string" ? ref.name.replace(/^refs\/heads\//, "") : "";
        if (name === "") continue;
        options.push({ name, isHead: ref.head === true, selectedByDefault: true });
      }
      return options;
    }

    /**
     * The `branches` member to send, or null to omit it.
     *
     * Omitted means "no filter": either nothing is selected, or every branch is —
     * both are today's behavior, and the request stays byte-identical.
     * @param selection - selected branch names, or null for "all".
     * @param options - options from {@link branchFilterOptions}.
     * @returns the branch names in options order, or null.
     */
    function branchRequestValue(selection, options) {
      const list = Array.isArray(options) ? options : [];
      const names = list.map((option) => (option !== null && typeof option === "object" && typeof option.name === "string" ? option.name : "")).filter((name) => name !== "");
      if (!Array.isArray(selection) || names.length === 0) return null;
      const selected = names.filter((name) => selection.includes(name));
      if (selected.length === 0 || selected.length >= names.length) return null;
      return selected;
    }

    /**
     * Toggle one branch in the filter selection.
     * @param selection - current selected names, or null (all selected).
     * @param name - branch to toggle.
     * @param options - options from {@link branchFilterOptions}.
     * @returns the new selected names, in options order.
     */
    function toggleBranchSelection(selection, name, options) {
      const list = Array.isArray(options) ? options : [];
      const names = list.map((option) => (option !== null && typeof option === "object" && typeof option.name === "string" ? option.name : "")).filter((value) => value !== "");
      const base = Array.isArray(selection) ? selection.filter((value) => names.includes(value)) : names.slice();
      const next = base.includes(name) ? base.filter((value) => value !== name) : base.concat(name);
      return names.filter((value) => next.includes(value));
    }

    /**
     * Build the `graph` route body.
     *
     * With no filter and the default order this is exactly today's body
     * (`{ sessionId, limit }`), which the tests pin as byte-identical JSON.
     * @param input - `{ sessionId, limit, branches?, order? }`.
     * @returns the JSON request body.
     */
    function graphRequest(input) {
      const spec = input !== null && typeof input === "object" ? input : {};
      const request = { sessionId: spec.sessionId, limit: spec.limit };
      if (Array.isArray(spec.branches) && spec.branches.length > 0) {
        const branches = spec.branches.filter((branch) => typeof branch === "string" && branch !== "");
        if (branches.length > 0) request.branches = branches;
      }
      if (spec.order === "author-date" || spec.order === "topo") request.order = spec.order;
      return request;
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
     * Magnifier used by the find control.
     * @param props - rendered size.
     * @returns a 13-unit SVG.
     */
    function SearchIcon({ size = 13 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("circle", { cx: 7, cy: 7, r: 4.2, stroke: "currentColor", strokeWidth: 1.5 }),
        h("path", { d: "M10.2 10.2L13.5 13.5", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
      );
    }

    /**
     * Funnel used by the branch filter.
     * @param props - rendered size.
     * @returns a 13-unit SVG.
     */
    function FilterIcon({ size = 13 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("path", { d: "M2.5 3.5H13.5L9.5 8.2V13L6.5 11.6V8.2L2.5 3.5Z", stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round" }),
      );
    }

    /**
     * Upward chevron used by the find control.
     * @param props - rendered size.
     * @returns a 12-unit SVG.
     */
    function ChevronUpIcon({ size = 12 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("path", { d: "M4 10L8 6L12 10", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    /**
     * Downward chevron used by the find control.
     * @param props - rendered size.
     * @returns a 12-unit SVG.
     */
    function ChevronDownIcon({ size = 12 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("path", { d: "M4 6L8 10L12 6", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    /**
     * Cross used to dismiss the find and filter rows.
     * @param props - rendered size.
     * @returns a 12-unit SVG.
     */
    function CloseIcon({ size = 12 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("path", { d: "M4 4L12 12M12 4L4 12", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
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

    /**
     * Dashed square with a plus: the synthetic uncommitted-changes row.
     * @param props - rendered size.
     * @returns a 12-unit SVG.
     */
    function PendingIcon({ size = 12 } = {}) {
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" },
        h("rect", { x: 2.5, y: 2.5, width: 11, height: 11, rx: 2.5, stroke: "currentColor", strokeWidth: 1.3, strokeDasharray: "2.6 2.2" }),
        h("path", { d: "M8 5.6V10.4M5.6 8H10.4", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" }),
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
     *
     * A chip is a real button only where nesting is legal (the detail pane): its
     * click is the primary action (checkout for branches, open the ref menu
     * otherwise), right-click and Shift+F10 open the ref menu. Inside a commit row
     * the chips stay spans — the row itself is a button, so nested buttons would be
     * invalid — and right-click still reaches the ref menu.
     * @param props - chips, translate function, pick/menu handlers and whether
     *   buttons are allowed in this context.
     * @returns a chip row.
     */
    function RefChips({ chips, t, onPick, onRefMenu, buttons } = {}) {
      const list = Array.isArray(chips) ? chips : [];
      const pickable = typeof onPick === "function";
      const menuable = typeof onRefMenu === "function";
      const useButtons = buttons === true || (buttons !== false && pickable);
      const pointFromEvent = (event, element) => {
        const gesture = event !== null && typeof event === "object" ? event : {};
        if (typeof gesture.clientX === "number" && typeof gesture.clientY === "number") return { x: gesture.clientX, y: gesture.clientY };
        if (element !== null && typeof element === "object" && typeof element.getBoundingClientRect === "function") {
          const rect = element.getBoundingClientRect();
          return { x: rect.left, y: rect.bottom };
        }
        return { x: 0, y: 0 };
      };
      return h(
        "span",
        { className: "dgg-chips" },
        list.map((chip) => {
          // A branch at HEAD stays a branch chip (actionable); `isHead` only adds ink.
          const className = "dgg-chip dgg-chip-" + chip.kind + (chip.isHead === true && chip.kind === "branch" ? " dgg-chip-head" : "");
          const checkout = pickable && chip.kind === "branch";
          const menu = menuable && (chip.kind === "branch" || chip.kind === "tag" || chip.kind === "remote");
          if (useButtons && menu) {
            return h(
              "button",
              {
                key: chip.key,
                type: "button",
                className: className + " dgg-chip-btn",
                title: checkout ? t("action.checkoutBranch") + ": " + chip.label : t("menu.refLabel"),
                "aria-haspopup": "menu",
                onClick: (event) => {
                  const gesture = event !== null && typeof event === "object" ? event : {};
                  if (typeof gesture.stopPropagation === "function") gesture.stopPropagation();
                  if (checkout) {
                    onPick(chip);
                    return;
                  }
                  onRefMenu(chip, pointFromEvent(gesture, gesture.currentTarget));
                },
                onContextMenu: (event) => {
                  const gesture = event !== null && typeof event === "object" ? event : {};
                  if (typeof gesture.preventDefault === "function") gesture.preventDefault();
                  if (typeof gesture.stopPropagation === "function") gesture.stopPropagation();
                  onRefMenu(chip, pointFromEvent(gesture, gesture.currentTarget));
                },
                onKeyDown: (event) => {
                  const keyboard = event !== null && typeof event === "object" ? event : {};
                  const menuKey = keyboard.key === "ContextMenu" || (keyboard.shiftKey === true && keyboard.key === "F10");
                  if (!menuKey) return;
                  if (typeof keyboard.preventDefault === "function") keyboard.preventDefault();
                  if (typeof keyboard.stopPropagation === "function") keyboard.stopPropagation();
                  onRefMenu(chip, pointFromEvent({}, keyboard.currentTarget));
                },
              },
              chip.label,
            );
          }
          // Legacy/plain branch chip: a checkout button where buttons are allowed.
          if (checkout && useButtons) {
            return h(
              "button",
              {
                key: chip.key,
                type: "button",
                className: className + " dgg-chip-btn",
                title: t("action.checkoutBranch") + ": " + chip.label,
                onClick: (event) => {
                  if (event !== null && typeof event === "object" && typeof event.stopPropagation === "function") event.stopPropagation();
                  onPick(chip);
                },
              },
              chip.label,
            );
          }
          return h(
            "span",
            {
              key: chip.key,
              className,
              title: chip.label,
              role: menu ? "button" : undefined,
              tabIndex: menu ? 0 : undefined,
              "aria-haspopup": menu ? "menu" : undefined,
              "aria-label": menu ? t("menu.refLabel") + ": " + chip.label : undefined,
              onContextMenu: menu
                ? (event) => {
                    const gesture = event !== null && typeof event === "object" ? event : {};
                    if (typeof gesture.preventDefault === "function") gesture.preventDefault();
                    if (typeof gesture.stopPropagation === "function") gesture.stopPropagation();
                    onRefMenu(chip, pointFromEvent(gesture, gesture.currentTarget));
                  }
                : undefined,
              onKeyDown: menu
                ? (event) => {
                    const keyboard = event !== null && typeof event === "object" ? event : {};
                    const menuKey = keyboard.key === "ContextMenu" || (keyboard.shiftKey === true && keyboard.key === "F10");
                    const activate = keyboard.key === "Enter" || keyboard.key === " ";
                    if (!menuKey && !activate) return;
                    if (typeof keyboard.preventDefault === "function") keyboard.preventDefault();
                    if (typeof keyboard.stopPropagation === "function") keyboard.stopPropagation();
                    onRefMenu(chip, pointFromEvent({}, keyboard.currentTarget));
                  }
                : undefined,
            },
            chip.label,
          );
        }),
      );
    }

    /**
     * One commit row in the master list.
     *
     * `Enter`/`Space` select it, `Ctrl`/`Cmd`+click starts a comparison, and the
     * context-menu key (or Shift+F10, or right-click) opens the commit menu at the
     * pointer: the row never renders the menu itself.
     * @param props - commit, its layout row, ref index and callbacks.
     * @returns a focusable row button.
     */
    function CommitRow({ t, commit, row, laneCount, refIndex, onSelect, onMenu, onRefMenu, selected, active, rowRef } = {}) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const hash = typeof record.hash === "string" ? record.hash : "";
      const abbrev = typeof record.abbrev === "string" && record.abbrev !== "" ? record.abbrev : hash.slice(0, 7);
      const subject = typeof record.subject === "string" && record.subject !== "" ? record.subject : abbrev;
      const author = typeof record.authorName === "string" ? record.authorName : "";
      const chips = classifyRefs(record.refs, refIndex, MAX_ROW_CHIPS);
      const emitMenu = (x, y) => {
        if (typeof onMenu !== "function") return;
        onMenu({ x, y, hash, commit: record });
      };
      return h(
        "button",
        {
          type: "button",
          className: "dgg-row" + (selected === true ? " dgg-row-selected" : "") + (active === true ? " dgg-row-active" : ""),
          "aria-label": subject + " " + abbrev,
          "aria-haspopup": "menu",
          ref: rowRef,
          onClick: (event) => {
            if (typeof onSelect !== "function") return;
            const gesture = event !== null && typeof event === "object" ? event : {};
            onSelect(hash, { compare: gesture.metaKey === true || gesture.ctrlKey === true, abbrev });
          },
          onContextMenu: (event) => {
            const gesture = event !== null && typeof event === "object" ? event : {};
            if (typeof gesture.preventDefault === "function") gesture.preventDefault();
            emitMenu(typeof gesture.clientX === "number" ? gesture.clientX : 0, typeof gesture.clientY === "number" ? gesture.clientY : 0);
          },
          onKeyDown: (event) => {
            const keyboard = event !== null && typeof event === "object" ? event : {};
            const menuKey = keyboard.key === "ContextMenu" || (keyboard.shiftKey === true && keyboard.key === "F10");
            if (!menuKey) return;
            if (typeof keyboard.preventDefault === "function") keyboard.preventDefault();
            const element = keyboard.currentTarget;
            const rect = element !== null && typeof element === "object" && typeof element.getBoundingClientRect === "function" ? element.getBoundingClientRect() : null;
            emitMenu(rect === null ? 0 : rect.left + 24, rect === null ? 0 : rect.top + rect.height / 2);
          },
        },
        h(LaneGraph, { row, laneCount }),
        h(
          "span",
          { className: "dgg-rowtext" },
          h("span", { className: "dgg-subject" }, subject),
          h("span", { className: "dgg-meta" }, [abbrev, author, relativeTime(record.authorTime, currentLanguage())].filter((part) => part !== "").join(" · ")),
          chips.length > 0 ? h(RefChips, { chips, t, onRefMenu, buttons: false }) : null,
        ),
      );
    }

    /**
     * The synthetic “uncommitted changes” row above the graph.
     *
     * It is deliberately not a commit: no lanes, no layout row, dashed border, and
     * a summary of the three working-tree groups.
     * @param props - normalized summary and the selection callback.
     * @returns a focusable row button.
     */
    function UncommittedRow({ t, summary, onSelect } = {}) {
      const counts = summary !== null && typeof summary === "object" && summary.counts !== null && typeof summary.counts === "object"
        ? summary.counts
        : { staged: 0, unstaged: 0, untracked: 0 };
      const total = summary !== null && typeof summary === "object" && Number.isFinite(summary.total) ? summary.total : 0;
      const breakdown = t("uncommitted.counts", { staged: counts.staged, unstaged: counts.unstaged, untracked: counts.untracked });
      return h(
        "button",
        {
          type: "button",
          className: "dgg-row dgg-row-uncommitted",
          "aria-label": t("uncommitted.title") + " " + t("uncommitted.total", { count: total }),
          onClick: () => {
            if (typeof onSelect === "function") onSelect();
          },
        },
        h("span", { className: "dgg-pending", "aria-hidden": "true" }, h(PendingIcon)),
        h(
          "span",
          { className: "dgg-rowtext" },
          h("span", { className: "dgg-subject" }, t("uncommitted.title")),
          h("span", { className: "dgg-meta" }, breakdown),
        ),
      );
    }

    /**
     * The commit master list plus its load-more footer.
     * @param props - graph value, layout, ref index, synthetic row and callbacks.
     * @returns the list.
     */
    function CommitList({ t, value, layout, refIndex, uncommitted, selectedHash, indices, activeHash, onSelect, onSelectUncommitted, onMenu, onRefMenu, onLoadMore, canLoadMore, loadingMore } = {}) {
      const commits = value !== null && typeof value === "object" && Array.isArray(value.commits) ? value.commits : [];
      const rows = layout !== null && typeof layout === "object" && Array.isArray(layout.rows) ? layout.rows : [];
      const laneCount = layout !== null && typeof layout === "object" ? layout.laneCount : 1;
      const order = Array.isArray(indices)
        ? indices.filter((index) => Number.isInteger(index) && index >= 0 && index < commits.length)
        : commits.map((commit, index) => index);
      // The active find match is scrolled into view by the browser itself.
      const activeRef = React.useRef(null);
      React.useEffect(() => {
        const node = activeRef.current;
        if (node !== null && typeof node === "object" && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
      }, [activeHash, order.length]);
      return h(
        "div",
        { className: "dgg-list" },
        uncommitted !== null && uncommitted !== undefined ? h(UncommittedRow, { t, summary: uncommitted, onSelect: onSelectUncommitted }) : null,
        order.map((index) => {
          const commit = commits[index];
          const hash = commit !== null && typeof commit === "object" && typeof commit.hash === "string" ? commit.hash : "";
          const isActive = activeHash !== "" && hash !== "" && hash === activeHash;
          return h(CommitRow, {
            key: hash !== "" ? hash + ":" + index : "commit:" + index,
            t,
            commit,
            row: rows[index],
            laneCount,
            refIndex,
            selected: selectedHash !== "" && hash !== "" && hash === selectedHash,
            active: isActive,
            rowRef: isActive ? activeRef : undefined,
            onSelect,
            onMenu,
            onRefMenu,
          });
        }),
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
     * The commit context menu.
     *
     * Rendered inside the tab body (never `document.body`) with `position: fixed`
     * inline coordinates clamped by `placeMenu`. The active item is focused, so the
     * arrow/Home/End/Enter handler on this container receives every key.
     * @param props - menu state, items, active index and callbacks.
     * @returns the menu.
     */
    function CommitMenu({ t, menu, items, activeIndex, onActivate, onRun, onKeyDown, menuRef } = {}) {
      const itemRefs = React.useRef([]);
      React.useEffect(() => {
        const node = itemRefs.current[activeIndex];
        if (node !== null && typeof node === "object" && typeof node.focus === "function") node.focus();
      }, [activeIndex]);
      const style = menu !== null && typeof menu === "object" && menu.style !== null && typeof menu.style === "object" ? menu.style : {};
      return h(
        "div",
        {
          className: "dgg-context-menu",
          role: "menu",
          "aria-label": t("menu.label"),
          style,
          ref: menuRef,
          onKeyDown,
          onContextMenu: (event) => event.preventDefault(),
        },
        (Array.isArray(items) ? items : []).map((item, index) =>
          h(
            "button",
            {
              key: item.id,
              type: "button",
              role: "menuitem",
              tabIndex: -1,
              disabled: item.disabled === true,
              title: item.disabled === true && typeof item.reasonKey === "string" ? t(item.reasonKey) : undefined,
              className: "dgg-menu-item dgg-context-item" + (index === activeIndex ? " dgg-context-item-active" : ""),
              ref: (node) => {
                itemRefs.current[index] = node;
              },
              onMouseEnter: () => {
                if (typeof onActivate === "function") onActivate(index);
              },
              onClick: () => {
                if (typeof onRun === "function") onRun(item, index);
              },
            },
            t(item.labelKey, item.params),
          ),
        ),
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
     * The find row: query input, match counter and previous/next controls.
     * @param props - query, match state and callbacks.
     * @returns the find row.
     */
    function FindBar({ t, query, total, activeIndex, onQuery, onNext, onPrev, onClose } = {}) {
      const inputRef = React.useRef(null);
      React.useEffect(() => {
        const node = inputRef.current;
        if (node !== null && typeof node === "object" && typeof node.focus === "function") node.focus();
      }, []);
      const current = typeof total === "number" && total > 0 ? Math.max(0, Math.min(activeIndex, total - 1)) + 1 : 0;
      const matches = typeof total === "number" && total > 0 ? total : 0;
      return h(
        "div",
        { className: "dgg-subbar dgg-findbar" },
        h("span", { className: "dgg-find-icon", "aria-hidden": "true" }, h(SearchIcon)),
        h("input", {
          ref: inputRef,
          className: "dgg-input dgg-find-input",
          type: "search",
          value: typeof query === "string" ? query : "",
          placeholder: t("find.placeholder"),
          "aria-label": t("find.label"),
          spellCheck: false,
          autoComplete: "off",
          onChange: (event) => onQuery(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (event.shiftKey === true) onPrev();
              else onNext();
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              if (typeof event.stopPropagation === "function") event.stopPropagation();
              onClose();
            }
          },
        }),
        h("span", { className: "dgg-find-count", role: "status", "aria-label": t("find.counter", { current, total: matches }) }, current + "/" + matches),
        h("button", { type: "button", className: "dgg-icon-btn", title: t("find.prev"), "aria-label": t("find.prev"), disabled: matches === 0, onClick: onPrev }, h(ChevronUpIcon)),
        h("button", { type: "button", className: "dgg-icon-btn", title: t("find.next"), "aria-label": t("find.next"), disabled: matches === 0, onClick: onNext }, h(ChevronDownIcon)),
        h("button", { type: "button", className: "dgg-icon-btn", title: t("find.close"), "aria-label": t("find.close"), onClick: onClose }, h(CloseIcon)),
      );
    }

    /**
     * The branch filter row: one checkbox per local branch plus an “all” reset.
     * @param props - branch options, selection and callbacks.
     * @returns the filter row.
     */
    function BranchFilterBar({ t, options, selection, onToggle, onReset, onClose } = {}) {
      const list = Array.isArray(options) ? options : [];
      const all = selection === null || selection === undefined;
      const checked = (option) => all || (Array.isArray(selection) && selection.includes(option.name));
      return h(
        "div",
        { className: "dgg-subbar dgg-filterbar", role: "group", "aria-label": t("filter.label") },
        h("span", { className: "dgg-filter-title" }, t("filter.label")),
        list.length === 0
          ? h("span", { className: "dgg-hint" }, t("filter.empty"))
          : h(
              "div",
              { className: "dgg-filter-options" },
              list.map((option) =>
                h(
                  "label",
                  { key: option.name, className: "dgg-filter-option" },
                  h("input", {
                    type: "checkbox",
                    checked: checked(option),
                    onChange: () => {
                      if (typeof onToggle === "function") onToggle(option.name);
                    },
                  }),
                  h("span", { className: "dgg-filter-name", title: option.name }, option.name),
                  option.isHead === true ? h("span", { className: "dgg-filter-head" }, t("filter.current")) : null,
                ),
              ),
            ),
        h("button", { type: "button", className: "dgg-btn", onClick: onReset }, t("filter.all")),
        h("button", { type: "button", className: "dgg-icon-btn", title: t("filter.close"), "aria-label": t("filter.close"), onClick: onClose }, h(CloseIcon)),
      );
    }

    /**
     * Toolbar: repository, branch, dirty count, find/filter, refresh and the
     * overflow menu (fetch plus the commit order select).
     * @param props - header values, find/filter state and callbacks.
     * @returns the toolbar strip.
     */
    function Toolbar(props) {
      const { t, repoLabel, repoPath, branchLabel, dirty, busy, backVisible, menuOpen, running, order, findOpen, filterOpen, onRefresh, onToggleMenu, onCloseMenu, onFetch, onBack, onToggleFind, onToggleFilter, onOrderChange } = props;
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
        h(
          "button",
          {
            type: "button",
            className: "dgg-icon-btn" + (findOpen === true ? " dgg-icon-btn-on" : ""),
            title: t("find.label"),
            "aria-label": t("find.label"),
            "aria-pressed": findOpen === true,
            onClick: onToggleFind,
          },
          h(SearchIcon),
        ),
        h(
          "button",
          {
            type: "button",
            className: "dgg-icon-btn" + (filterOpen === true ? " dgg-icon-btn-on" : ""),
            title: t("filter.label"),
            "aria-label": t("filter.label"),
            "aria-pressed": filterOpen === true,
            onClick: onToggleFilter,
          },
          h(FilterIcon),
        ),
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
                h(
                  "label",
                  { className: "dgg-menu-field" },
                  h("span", { className: "dgg-menu-field-label" }, t("order.label")),
                  h(
                    "select",
                    { className: "dgg-select dgg-menu-select", value: typeof order === "string" ? order : "date", "aria-label": t("order.label"), onChange: (event) => onOrderChange(event.target.value) },
                    COMMIT_ORDER_OPTIONS.map((option) => h("option", { key: option.value, value: option.value }, t(option.labelKey))),
                  ),
                ),
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
      const needsRename = spec.needs === "rename";
      const [name, setName] = React.useState(needsRename && typeof spec.requestedRef === "string" ? spec.requestedRef : "");
      const [ref, setRef] = React.useState(requested);
      const [newName, setNewName] = React.useState("");
      const needsName = spec.needs === "name";
      const needsRef = spec.needs === "branch" || spec.needs === "tag";
      const label = t("action." + spec.kind);
      const renameReady = name.trim() !== "" && newName.trim() !== "" && newName.trim() !== name.trim();
      const ready = running !== true && (!needsName || name.trim() !== "") && (!needsRef || ref !== "") && (!needsRename || renameReady);
      const warning = spec.dirtySensitive === true && Number.isFinite(dirty) && dirty > 0 ? t("action.cleanWorktreeWarning") : null;
      const fieldLabel = spec.kind === "createTag" ? t("action.tagName") : needsRef && spec.needs === "tag" ? t("action.tagName") : t("action.branchName");
      return h(
        "div",
        { className: "dgg-dialog", role: "group", "aria-label": t("action.confirm", { action: label }) },
        h("p", { className: "dgg-dialog-title" }, t("action.confirm", { action: label })),
        warning !== null ? h("p", { className: "dgg-dialog-warning" }, warning) : null,
        needsRename
          ? h(
              React.Fragment,
              null,
              h(
                "label",
                { className: "dgg-field" },
                h("span", { className: "dgg-field-label" }, t("action.oldBranchName")),
                h("input", {
                  className: "dgg-input",
                  type: "text",
                  value: name,
                  autoFocus: true,
                  spellCheck: false,
                  autoComplete: "off",
                  "aria-label": t("action.oldBranchName"),
                  onChange: (event) => setName(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" && ready) onConfirm(name.trim(), ref, newName.trim());
                    if (event.key === "Escape") onCancel();
                  },
                }),
              ),
              h(
                "label",
                { className: "dgg-field" },
                h("span", { className: "dgg-field-label" }, t("action.newBranchName")),
                h("input", {
                  className: "dgg-input",
                  type: "text",
                  value: newName,
                  spellCheck: false,
                  autoComplete: "off",
                  "aria-label": t("action.newBranchName"),
                  onChange: (event) => setNewName(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" && ready) onConfirm(name.trim(), ref, newName.trim());
                    if (event.key === "Escape") onCancel();
                  },
                }),
              ),
            )
          : null,
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
                  if (event.key === "Enter" && ready) onConfirm(name.trim(), ref, newName.trim());
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
              onClick: () => onConfirm(name.trim(), ref, newName.trim()),
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
     *
     * The same row serves all three diff scopes: a commit's files (`commit`), the
     * working tree (`staged`/`unstaged`) and a two-commit comparison (`compare`).
     * @param props - session, scope, file record and the shared diff cache.
     * @returns the file row and its diff.
     */
    function FileRow({ t, sessionId, hash, file, cache, scope = "commit", base, head, emptyHintKey } = {}) {
      const record = file !== null && typeof file === "object" ? file : {};
      const filePath = typeof record.path === "string" ? record.path : "";
      const oldPath = typeof record.oldPath === "string" && record.oldPath !== "" ? record.oldPath : undefined;
      const status = fileStatus(record);
      const [expanded, setExpanded] = React.useState(false);
      const [state, setState] = React.useState({ status: "idle", value: null, error: null });
      React.useEffect(() => {
        if (!expanded) return undefined;
        const store = cache !== null && typeof cache === "object" ? cache : null;
        const key = diffCacheKey({ scope, hash, base, head, file: filePath, oldPath });
        if (store !== null && isMapLike(store.current) && store.current.has(key)) {
          setState({ status: "ready", value: store.current.get(key), error: null });
          return undefined;
        }
        const controller = new AbortController();
        let active = true;
        setState({ status: "loading", value: null, error: null });
        postJson(
          "diff",
          diffRequest({ sessionId, scope, hash, base, head, file: filePath, oldPath, status }),
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
      }, [expanded, sessionId, scope, hash, base, head, filePath, oldPath, status, cache]);

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
        expanded ? renderDiff(t, record, state, emptyHintKey) : null,
      );
    }

    /**
     * Diff body of one expanded file row.
     * @param t - translate function.
     * @param file - host file record.
     * @param state - request state for that file.
     * @param emptyHintKey - locale key shown instead of the empty-diff note.
     * @returns loading, error, binary, truncated or the patch.
     */
    function renderDiff(t, file, state, emptyHintKey) {
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
      if (patch === "") {
        const emptyKey = typeof emptyHintKey === "string" && emptyHintKey !== "" ? emptyHintKey : "detail.noFiles";
        return h("p", { className: "dgg-hint dgg-diff-note" }, file.binary === true ? t("detail.binary") : t(emptyKey));
      }
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
     * Pane for the synthetic uncommitted row: staged / unstaged / untracked files.
     * @param props - `uncommitted` route value, session and shared diff cache.
     * @returns the grouped, expandable file list.
     */
    function UncommittedView({ t, value, sessionId, cache } = {}) {
      const groups = uncommittedGroups(value);
      const summary = uncommittedSummary(value);
      return h(
        "div",
        { className: "dgg-uncommitted" },
        h("h2", { className: "dgg-subject-lg" }, t("uncommitted.title")),
        h(
          "div",
          { className: "dgg-stats" },
          t("uncommitted.counts", { staged: summary.staged, unstaged: summary.unstaged, untracked: summary.untracked }),
        ),
        groups.length === 0
          ? h("p", { className: "dgg-hint" }, t("uncommitted.empty"))
          : groups.map((group) =>
              h(
                "div",
                { className: "dgg-section", key: group.id },
                h("h3", { className: "dgg-section-title" }, t(group.labelKey) + " (" + group.files.length + ")"),
                h(
                  "div",
                  { className: "dgg-files" },
                  group.files.map((file, index) =>
                    h(FileRow, {
                      key: (typeof file.path === "string" ? file.path : "file") + "#" + index,
                      t,
                      sessionId,
                      file,
                      scope: group.scope,
                      cache,
                      emptyHintKey: group.hintKey,
                    }),
                  ),
                ),
              ),
            ),
      );
    }

    /**
     * Two-commit comparison: both abbreviations, a swap control and the file list.
     * @param props - comparison pair, `compare` route state, session and cache.
     * @returns the comparison pane.
     */
    function CompareView({ t, pair, value, status, error, sessionId, cache, onSwap, onExit, onRetry } = {}) {
      const spec = pair !== null && typeof pair === "object" ? pair : { base: "", head: "" };
      const record = value !== null && typeof value === "object" ? value : {};
      const baseHash = typeof spec.base === "string" ? spec.base : "";
      const headHash = typeof spec.head === "string" ? spec.head : "";
      const baseAbbrev = typeof record.baseAbbrev === "string" && record.baseAbbrev !== "" ? record.baseAbbrev : baseHash.slice(0, 7);
      const headAbbrev = typeof record.headAbbrev === "string" && record.headAbbrev !== "" ? record.headAbbrev : headHash.slice(0, 7);
      const files = Array.isArray(record.files) ? record.files : [];
      const groups = groupFiles(files);
      const stats = record.stats !== null && typeof record.stats === "object" ? record.stats : null;
      const insertions = stats !== null && Number.isFinite(stats.insertions) ? stats.insertions : 0;
      const deletions = stats !== null && Number.isFinite(stats.deletions) ? stats.deletions : 0;
      const fileCount = stats !== null && Number.isFinite(stats.files) ? stats.files : files.length;

      let body;
      if (status === "error") body = h(ErrorState, { t, message: error, onRetry });
      else if (value === null) body = h(LoadingState, { t });
      else if (groups.length === 0) body = h("p", { className: "dgg-hint" }, t("compare.empty"));
      else {
        body = h(
          "div",
          { className: "dgg-files" },
          groups.map(([statusLetter, group]) =>
            h(
              "div",
              { className: "dgg-group", key: statusLetter },
              h("h4", { className: "dgg-group-title", title: statusLetter }, statusLetter),
              group.map((file, index) =>
                h(FileRow, {
                  key: (typeof file.path === "string" ? file.path : "file") + "#" + index,
                  t,
                  sessionId,
                  file,
                  scope: "compare",
                  base: baseHash,
                  head: headHash,
                  cache,
                }),
              ),
            ),
          ),
        );
      }

      return h(
        "div",
        { className: "dgg-compare" },
        h(
          "div",
          { className: "dgg-compare-head" },
          h("span", { className: "dgg-k" }, t("compare.base")),
          h("code", { className: "dgg-compare-abbrev", title: baseHash }, baseAbbrev),
          h(
            "button",
            { type: "button", className: "dgg-btn", title: t("compare.swap"), "aria-label": t("compare.swap"), onClick: onSwap },
            "⇄",
          ),
          h("span", { className: "dgg-k" }, t("compare.head")),
          h("code", { className: "dgg-compare-abbrev", title: headHash }, headAbbrev),
          h("button", { type: "button", className: "dgg-btn", onClick: onExit }, t("compare.exit")),
        ),
        h("h2", { className: "dgg-subject-lg" }, t("compare.title")),
        h("div", { className: "dgg-stats" }, t("detail.stats", { files: fileCount, insertions, deletions })),
        body,
      );
    }

    /**
     * Detail view: metadata, refs, stats, actions and the changed files.
     * @param props - commit detail value, refs, dialog state and callbacks.
     * @returns the detail pane.
     */
    function DetailView(props) {
      const { t, commit, refIndex, branches, dirty, dialog, run, copy, sessionId, onOpenDialog, onCancelDialog, onConfirmDialog, onRunFetch, onSelectCommit, onCopy, onRefMenu, diffCache } = props;
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
              buttons: true,
              onPick: (chip) => onOpenDialog("checkoutBranch", chip.label),
              onRefMenu,
            })
          : null,
        h("div", { className: "dgg-stats" }, t("detail.stats", { files: fileCount, insertions, deletions })),
        h("p", { className: "dgg-compare-hint" }, t("compare.hint")),
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
     * The whole tab body: toolbar, master list, commit detail, uncommitted pane,
     * comparison view and the commit context menu.
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
      /** Last selected commit: the base a list-view comparison starts from. */
      const [base, setBase] = React.useState("");
      const [baseAbbrev, setBaseAbbrev] = React.useState("");
      const [detail, setDetail] = React.useState({ status: "idle", value: null, error: null });
      const [menuOpen, setMenuOpen] = React.useState(false);
      /** Open context menu: a commit's actions or a ref chip's actions. */
      const [contextMenu, setContextMenu] = React.useState(null);
      const [menuIndex, setMenuIndex] = React.useState(0);
      const [findOpen, setFindOpen] = React.useState(false);
      const [findQuery, setFindQuery] = React.useState("");
      const [findMatch, setFindMatch] = React.useState(0);
      const [filterOpen, setFilterOpen] = React.useState(false);
      /** Explicit branch selection, or null for "all branches" (today's behavior). */
      const [branchSelection, setBranchSelection] = React.useState(null);
      const [order, setOrder] = React.useState("date");
      const [dialog, setDialog] = React.useState(null);
      const [run, setRun] = React.useState(null);
      const [copy, setCopy] = React.useState({ state: "idle", text: "" });
      const [summary, setSummary] = React.useState(null);
      const [compare, setCompare] = React.useState(null);
      const [compareData, setCompareData] = React.useState({ status: "idle", value: null, error: null });
      /** Branch awaiting a force-delete decision after a not-merged refusal. */
      const forceRef = React.useRef(null);
      const actionController = React.useRef(null);
      const diffCache = React.useRef(new Map());
      const menuRef = React.useRef(null);

      const value = graph.value;
      const dirty = value !== null && typeof value === "object" && value.status !== null && typeof value.status === "object" && Number.isFinite(value.status.dirty) ? value.status.dirty : 0;
      const commits = value !== null && typeof value === "object" && Array.isArray(value.commits) ? value.commits : [];
      const pageRefs = value !== null && typeof value === "object" && Array.isArray(value.refs) ? value.refs : [];
      const running = run !== null && typeof run === "object" && run.phase === "running";

      const branchOptions = React.useMemo(() => branchFilterOptions(pageRefs), [pageRefs]);
      // `branches` is only sent for an explicit subset; null keeps today's body.
      const branchRequest = React.useMemo(() => branchRequestValue(branchSelection, branchOptions), [branchSelection, branchOptions]);
      const branchKey = branchRequest === null ? "" : branchRequest.join("\u0001");
      const find = React.useMemo(() => filterCommits(commits, findQuery), [commits, findQuery]);
      const filterActive = typeof findQuery === "string" && findQuery.trim() !== "";
      const activeMatchIndex = find.matches === 0 ? -1 : Math.min(Math.max(findMatch, 0), find.matches - 1);
      const activeHash = activeMatchIndex === -1 ? "" : (() => {
        const commit = commits[find.indices[activeMatchIndex]];
        return commit !== null && typeof commit === "object" && typeof commit.hash === "string" ? commit.hash : "";
      })();

      // The graph page: aborted when the session, the page size or a refresh supersedes it.
      React.useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setGraph((previous) => ({
          status: previous.value === null ? "loading" : "refreshing",
          value: previous.value,
          error: null,
        }));
        postJson("graph", graphRequest({ sessionId, limit, branches: branchRequest, order }), controller.signal).then(
          (next) => {
            if (active) setGraph({ status: "ready", value: next, error: null });
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
        // `branchKey`/`order` are the primitives that change the request; the memo
        // identities themselves are not dependencies, so a refresh cannot loop.
      }, [sessionId, limit, reloadKey, branchKey, order]);

      // The selected commit (or the uncommitted pane), kept visible while refreshing.
      React.useEffect(() => {
        if (selected === null) {
          setDetail({ status: "idle", value: null, error: null });
          return undefined;
        }
        const uncommitted = selected.uncommitted === true;
        const hash = typeof selected.hash === "string" ? selected.hash : "";
        if (!uncommitted && hash === "") {
          setDetail({ status: "idle", value: null, error: null });
          return undefined;
        }
        const controller = new AbortController();
        let active = true;
        setDetail((previous) => {
          const reusable = previous.value !== null && typeof previous.value === "object" &&
            (uncommitted ? !("hash" in previous.value) : previous.value.hash === hash);
          return { status: reusable ? "refreshing" : "loading", value: reusable ? previous.value : null, error: null };
        });
        postJson(uncommitted ? "uncommitted" : "commit", uncommitted ? { sessionId } : { sessionId, hash }, controller.signal).then(
          (next) => {
            if (active) setDetail({ status: "ready", value: next, error: null });
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

      // The uncommitted summary that labels and reveals the synthetic row. A repo
      // whose graph reports a dirty worktree is the trigger; a host without the
      // route fails soft and the row simply stays hidden.
      React.useEffect(() => {
        if (value === null || typeof value !== "object" || value.isRepo !== true || dirty <= 0) {
          setSummary(null);
          return undefined;
        }
        const controller = new AbortController();
        let active = true;
        postJson("uncommitted", { sessionId }, controller.signal).then(
          (next) => {
            if (active) setSummary(next);
          },
          (error) => {
            if (active && !isAbort(error)) setSummary(null);
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [sessionId, reloadKey, dirty, value]);

      // The two-commit comparison, kept visible while a refresh is in flight.
      React.useEffect(() => {
        if (compare === null) {
          setCompareData({ status: "idle", value: null, error: null });
          return undefined;
        }
        const controller = new AbortController();
        let active = true;
        setCompareData((previous) => {
          const reusable = previous.value !== null && typeof previous.value === "object" &&
            previous.value.base === compare.base && previous.value.head === compare.head;
          return { status: reusable ? "refreshing" : "loading", value: reusable ? previous.value : null, error: null };
        });
        postJson("compare", compareRequest({ sessionId, base: compare.base, head: compare.head }), controller.signal).then(
          (next) => {
            if (active) setCompareData({ status: "ready", value: next, error: null });
          },
          (error) => {
            if (!active || isAbort(error)) return;
            setCompareData((previous) => ({ status: "error", value: previous.value, error: messageOf(error) }));
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [sessionId, compare, reloadKey]);

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

      // Dismiss the commit menu on Escape, a press outside it, scrolling or resizing.
      React.useEffect(() => {
        if (contextMenu === null) return undefined;
        const win = typeof window !== "undefined" ? window : null;
        const doc = typeof document !== "undefined" ? document : null;
        /** Whether an event target is a DOM node inside this menu. */
        const inside = (target) => {
          const node = menuRef.current;
          if (node === null || typeof node !== "object" || typeof node.contains !== "function") return false;
          if (target === null || typeof target !== "object" || typeof target.nodeType !== "number") return false;
          return node.contains(target);
        };
        const close = () => setContextMenu(null);
        const onPointerDown = (event) => {
          if (!inside(event !== null && typeof event === "object" ? event.target : null)) close();
        };
        const onScroll = (event) => {
          if (!inside(event !== null && typeof event === "object" ? event.target : null)) close();
        };
        if (win !== null && typeof win.addEventListener === "function") {
          win.addEventListener("resize", close);
          win.addEventListener("scroll", onScroll, true);
        }
        if (doc !== null && typeof doc.addEventListener === "function") doc.addEventListener("pointerdown", onPointerDown, true);
        return () => {
          if (win !== null && typeof win.removeEventListener === "function") {
            win.removeEventListener("resize", close);
            win.removeEventListener("scroll", onScroll, true);
          }
          if (doc !== null && typeof doc.removeEventListener === "function") doc.removeEventListener("pointerdown", onPointerDown, true);
        };
      }, [contextMenu]);

      // A refresh can drop the commit or the ref the menu was opened on.
      React.useEffect(() => {
        if (contextMenu === null) return;
        const valid = contextMenu.type === "ref" ? refMenuStillValid(contextMenu, pageRefs) : menuStillValid(contextMenu, commits);
        if (!valid) setContextMenu(null);
      }, [contextMenu, commits, pageRefs]);

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

      const summaryCounts = React.useMemo(() => uncommittedSummary(summary, dirty), [summary, dirty]);
      const listModel = React.useMemo(() => buildListModel(commits, summaryCounts), [commits, summaryCounts]);
      const layout = listModel.layout;

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

      const selectedHash = selected !== null && typeof selected.hash === "string" ? selected.hash : "";
      const detailAbbrev = detail.value !== null && typeof detail.value === "object" && typeof detail.value.abbrev === "string" ? detail.value.abbrev : "";
      const compareBaseHash = selectedHash !== "" ? selectedHash : base;
      const compareBaseAbbrev = selectedHash !== "" ? (detailAbbrev !== "" ? detailAbbrev : selectedHash.slice(0, 7)) : baseAbbrev;
      const hasRemotes = pageRefs.some((ref) => ref !== null && typeof ref === "object" && refKind(ref) === "remote");
      const menuItems = contextMenu === null
        ? []
        : contextMenu.type === "ref"
          ? refMenuItems(contextMenu.chip, { currentBranch, busy: running, hasRemotes })
          : commitMenuItems(contextMenu.commit, { baseHash: compareBaseHash, baseAbbrev: compareBaseAbbrev, busy: running });
      const activeMenuIndex = menuItems.length === 0 ? 0 : Math.min(Math.max(menuIndex, 0), menuItems.length - 1);

      function refresh() {
        setReloadKey((key) => key + 1);
      }

      function viewportSize() {
        const win = typeof window !== "undefined" ? window : null;
        return {
          width: win !== null && Number.isFinite(win.innerWidth) ? win.innerWidth : 0,
          height: win !== null && Number.isFinite(win.innerHeight) ? win.innerHeight : 0,
        };
      }

      function openDialog(kind, requestedRef, hashOverride) {
        const hash = typeof hashOverride === "string" && hashOverride !== "" ? hashOverride : selectedHash;
        setMenuOpen(false);
        setContextMenu(null);
        forceRef.current = null;
        setDialog({
          kind,
          hash,
          ...actionDialogSpec(kind, { branches, tags, currentBranch }),
          requestedRef: typeof requestedRef === "string" ? requestedRef : "",
        });
      }

      function openCommitMenu(point) {
        if (point === null || typeof point !== "object" || typeof point.hash !== "string" || point.hash === "") return;
        const items = commitMenuItems(point.commit, { baseHash: compareBaseHash, baseAbbrev: compareBaseAbbrev, busy: running });
        const size = { width: MENU_WIDTH, height: items.length * MENU_ITEM_HEIGHT + MENU_PADDING };
        const position = placeMenu({ x: point.x, y: point.y }, size, viewportSize());
        const firstEnabled = items.findIndex((item) => item.disabled !== true);
        setDialog(null);
        setMenuOpen(false);
        setMenuIndex(firstEnabled === -1 ? 0 : firstEnabled);
        setContextMenu({
          type: "commit",
          hash: point.hash,
          commit: point.commit,
          x: point.x,
          y: point.y,
          style: { position: "fixed", left: position.left, top: position.top, maxHeight: position.maxHeight > 0 ? position.maxHeight : undefined },
        });
      }

      /**
       * Open the context menu of one ref chip.
       * @param chip - classified ref chip.
       * @param point - `{ x, y }` pointer position (or the chip's lower-left corner).
       */
      function openRefMenu(chip, point) {
        if (chip === null || typeof chip !== "object" || typeof chip.label !== "string" || chip.label === "") return;
        const items = refMenuItems(chip, { currentBranch, busy: running, hasRemotes });
        if (items.length === 0) return;
        const origin = point !== null && typeof point === "object" ? point : {};
        const size = { width: MENU_WIDTH, height: items.length * MENU_ITEM_HEIGHT + MENU_PADDING };
        const position = placeMenu({ x: origin.x, y: origin.y }, size, viewportSize());
        const firstEnabled = items.findIndex((item) => item.disabled !== true);
        setDialog(null);
        setMenuOpen(false);
        setMenuIndex(firstEnabled === -1 ? 0 : firstEnabled);
        setContextMenu({
          type: "ref",
          label: chip.label,
          chip,
          x: origin.x,
          y: origin.y,
          style: { position: "fixed", left: position.left, top: position.top, maxHeight: position.maxHeight > 0 ? position.maxHeight : undefined },
        });
      }

      function enterCompare(headHash) {
        if (typeof headHash !== "string" || headHash === "" || compareBaseHash === "" || compareBaseHash === headHash) return;
        setDialog(null);
        setRun(null);
        setContextMenu(null);
        setCompare({ base: compareBaseHash, head: headHash });
      }

      function runMenuItem(item) {
        const target = contextMenu;
        if (item === null || item === undefined || item.disabled === true) return;
        setContextMenu(null);
        if (target === null || typeof target !== "object") return;
        if (target.type === "ref") {
          // Every mutating ref item goes through the shared dialog/action path.
          if (item.kind === "copyRef") {
            handleCopy(refCopyValue(target.chip));
            return;
          }
          if (item.kind === "fetch") {
            startAction("fetch", {});
            return;
          }
          openDialog(item.kind, typeof target.label === "string" ? target.label : "");
          return;
        }
        if (typeof target.hash !== "string") return;
        if (item.kind === "copyHash") {
          handleCopy(target.hash);
          return;
        }
        if (item.kind === "compare") {
          enterCompare(target.hash);
          return;
        }
        openDialog(item.kind, "", target.hash);
      }

      function handleMenuKeyDown(event) {
        const key = event.key;
        if (key === "Tab") {
          event.preventDefault();
          return;
        }
        if (key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu(null);
          return;
        }
        if (key === "Enter" || key === " ") {
          event.preventDefault();
          runMenuItem(menuItems[activeMenuIndex]);
          return;
        }
        const next = menuStep(menuItems, activeMenuIndex, key);
        if (next !== -1) {
          event.preventDefault();
          setMenuIndex(next);
        }
      }

      /**
       * Run one confirmed action.
       *
       * A failure keeps both the human message and git's own output: the latter is
       * shown behind a disclosure so the raw stderr is never lost (TODO-2).
       * @param kind - action discriminator.
       * @param args - action arguments.
       * @param signal - cancellation signal.
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

      function confirmDialog(name, ref, newName) {
        if (dialog === null || typeof dialog !== "object") return;
        const kind = dialog.kind;
        if (kind === "deleteBranch") forceRef.current = ref;
        const args = actionArguments(kind, { name, ref, hash: dialog.hash, newName });
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

      /** Close the find row, restoring the full list. */
      function closeFind() {
        setFindOpen(false);
        setFindQuery("");
        setFindMatch(0);
      }

      /** Show the find row and return to the graph list. */
      function openFind() {
        setMenuOpen(false);
        setContextMenu(null);
        setDialog(null);
        setSelected(null);
        setCompare(null);
        setFindOpen(true);
      }

      function toggleFind() {
        if (findOpen) closeFind();
        else openFind();
      }

      function handleFindQuery(value) {
        setFindQuery(typeof value === "string" ? value : "");
        setFindMatch(0);
      }

      /**
       * Move the active find match.
       * @param direction - 1 for next, -1 for previous.
       */
      function stepMatch(direction) {
        const next = nextMatch(activeMatchIndex, find.matches, direction);
        if (next !== -1) setFindMatch(next);
      }

      /** Toggle one branch in the filter; an empty/full selection sends nothing. */
      function handleToggleBranch(name) {
        setBranchSelection((selection) => toggleBranchSelection(selection, name, branchOptions));
      }

      function resetBranchFilter() {
        setBranchSelection(null);
      }

      function handleRootKeyDown(event) {
        if (event.key !== "Escape") return;
        if (contextMenu !== null) {
          setContextMenu(null);
          return;
        }
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        if (dialog !== null) {
          setDialog(null);
          return;
        }
        if (findOpen) {
          closeFind();
          return;
        }
        if (compare !== null) {
          setCompare(null);
          return;
        }
        if (selected !== null) setSelected(null);
      }

      /**
       * Select a commit, or start a comparison when the click carried the
       * platform's compare modifier and another commit is already selected.
       * @param hash - target commit hash.
       * @param options - `{ compare }` from the row.
       */
      function selectCommit(hash, options) {
        if (typeof hash !== "string" || hash === "") return;
        const wantsCompare = options !== null && typeof options === "object" && options.compare === true;
        // Selecting a commit remembers it as the base, so a later Ctrl/Cmd+click in
        // the list compares against the commit the reader just looked at.
        const knownBase = selectedHash !== "" ? selectedHash : base;
        if (wantsCompare && knownBase !== "" && knownBase !== hash) {
          setRun(null);
          setDialog(null);
          setMenuOpen(false);
          setContextMenu(null);
          setCompare({ base: knownBase, head: hash });
          return;
        }
        setRun(null);
        setDialog(null);
        setMenuOpen(false);
        setContextMenu(null);
        setCompare(null);
        setSelected({ hash });
        setBase(hash);
        const abbrev = options !== null && typeof options === "object" && typeof options.abbrev === "string" && options.abbrev !== ""
          ? options.abbrev
          : hash.slice(0, 7);
        setBaseAbbrev(abbrev);
      }

      /** Open the synthetic uncommitted-changes pane. */
      function selectUncommitted() {
        setRun(null);
        setDialog(null);
        setMenuOpen(false);
        setContextMenu(null);
        setCompare(null);
        setSelected({ uncommitted: true });
      }

      const busy = graph.status === "refreshing" || running;
      const backVisible = selected !== null;

      let content;
      if (compare !== null) {
        content = h(CompareView, {
          t,
          pair: compare,
          value: compareData.value,
          status: compareData.status,
          error: compareData.error,
          sessionId,
          cache: diffCache,
          onSwap: () => setCompare((previous) => (previous === null ? previous : { base: previous.head, head: previous.base })),
          onExit: () => setCompare(null),
          onRetry: refresh,
        });
      } else if (selected === null) {
        if (value === null) {
          content = graph.status === "error" ? h(ErrorState, { t, message: graph.error, onRetry: refresh }) : h(LoadingState, { t });
        } else if (value.isRepo === false) {
          content = h(NotRepoState, {
            t,
            pathValue: typeof value.workspacePath === "string" && value.workspacePath !== "" ? value.workspacePath : repoPath,
            onRetry: refresh,
          });
        } else if (commits.length === 0 && listModel.synthetic === null) {
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
            filterActive === true && find.matches === 0
              ? h("p", { className: "dgg-hint dgg-list-empty" }, t("find.noMatches"))
              : null,
            dialog !== null && typeof dialog === "object"
              ? h(
                  "div",
                  { className: "dgg-inline-dialog" },
                  h(ActionDialog, {
                    key: dialog.kind + "|" + (dialog.requestedRef || "") + "|" + (dialog.hash || ""),
                    t,
                    dialog,
                    dirty,
                    running,
                    onCancel: () => setDialog(null),
                    onConfirm: confirmDialog,
                  }),
                )
              : null,
            h(CommitList, {
              t,
              value,
              layout,
              refIndex,
              uncommitted: filterActive === true ? null : listModel.synthetic,
              selectedHash: "",
              indices: find.indices,
              activeHash: filterActive === true ? activeHash : "",
              onSelect: selectCommit,
              onSelectUncommitted: selectUncommitted,
              onMenu: openCommitMenu,
              onRefMenu: openRefMenu,
              onLoadMore: () => setLimit((current) => Math.min(current + PAGE_SIZE, PAGE_MAX)),
              canLoadMore: value.truncated === true && commits.length < PAGE_MAX && limit < PAGE_MAX,
              loadingMore: graph.status === "refreshing",
            }),
          );
        }
      } else if (selected.uncommitted === true) {
        if (detail.value !== null) {
          content = h(UncommittedView, { t, value: detail.value, sessionId, cache: diffCache });
        } else if (detail.status === "error") {
          content = h(ErrorState, { t, message: detail.error, onRetry: refresh });
        } else {
          content = h(LoadingState, { t });
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
          onRefMenu: openRefMenu,
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
          order,
          findOpen,
          filterOpen,
          onRefresh: refresh,
          onToggleFind: toggleFind,
          onToggleFilter: () => {
            setMenuOpen(false);
            setContextMenu(null);
            setFilterOpen((open) => !open);
          },
          onOrderChange: (next) => setOrder(next === "author-date" || next === "topo" ? next : "date"),
          onToggleMenu: () => setMenuOpen((open) => !open),
          onCloseMenu: () => setMenuOpen(false),
          onFetch: () => {
            setMenuOpen(false);
            startAction("fetch", {});
          },
          onBack: () => {
            setDialog(null);
            setMenuOpen(false);
            setContextMenu(null);
            if (compare !== null) setCompare(null);
            else setSelected(null);
          },
        }),
        findOpen === true
          ? h(FindBar, {
              t,
              query: findQuery,
              total: filterActive === true ? find.matches : 0,
              activeIndex: filterActive === true ? activeMatchIndex : -1,
              onQuery: handleFindQuery,
              onNext: () => stepMatch(1),
              onPrev: () => stepMatch(-1),
              onClose: closeFind,
            })
          : null,
        filterOpen === true
          ? h(BranchFilterBar, {
              t,
              options: branchOptions,
              selection: branchSelection,
              onToggle: handleToggleBranch,
              onReset: resetBranchFilter,
              onClose: () => setFilterOpen(false),
            })
          : null,
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
        contextMenu !== null
          ? h(CommitMenu, {
              t,
              menu: contextMenu,
              items: menuItems,
              activeIndex: activeMenuIndex,
              menuRef,
              onActivate: setMenuIndex,
              onRun: (item) => runMenuItem(item),
              onKeyDown: handleMenuKeyDown,
            })
          : null,
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
