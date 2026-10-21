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
    /** Client cap for a loaded page; matches the host's MAX_COMMITS_LIMIT. */
    const PAGE_MAX = 2000;
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
      "menu.compareWorking": "与工作区对比",
      "uncommitted.title": "未提交改动",
      "uncommitted.total": "{count} 个文件有改动",
      "uncommitted.counts": "已暂存 {staged} · 未暂存 {unstaged} · 未跟踪 {untracked}",
      "uncommitted.staged": "已暂存",
      "uncommitted.unstaged": "未暂存",
      "uncommitted.untracked": "未跟踪",
      "uncommitted.empty": "没有未提交的改动",
      "uncommitted.error": "读取未提交改动失败",
      "uncommitted.untrackedHint": "未跟踪的文件还没有可显示的差异",
      "uncommitted.compareWorking": "与 HEAD 对比",
      "compare.title": "比较提交",
      "compare.workingTitle": "工作区对比",
      "compare.workingTree": "工作区",
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
      "find.scopeLabel": "查找范围",
      "find.scopePage": "当前已加载",
      "find.scopeAll": "全部历史",
      "find.searching": "正在搜索全部历史…",
      "find.searchCount": "共 {count} 个结果",
      "find.searchCapped": "仅扫描最近 20000 个提交",
      "find.searchError": "全量搜索失败",
      "filter.label": "分支过滤",
      "filter.all": "全部",
      "filter.empty": "没有本地分支",
      "filter.close": "关闭分支过滤",
      "filter.current": "当前分支",
      "filter.globLabel": "分支 glob 模式",
      "filter.globPlaceholder": "例如 feature/*，多个用逗号分隔",
      "filter.globEmpty": "glob 模式不能为空",
      "filter.globInvalid": "glob 模式无效：方括号未闭合",
      "filter.noGlobMatch": "没有分支匹配该 glob",
      "filter.noGlobMatchHint": "清除 glob 模式即可恢复提交列表。",
      "mute.mergeCommit": "弱化：合并提交",
      "mute.nonAncestor": "弱化：不是 HEAD 的祖先",
      "file.status.A": "新增文件",
      "file.status.M": "修改文件",
      "file.status.D": "删除文件",
      "file.status.R": "重命名",
      "file.status.C": "复制",
      "file.status.T": "类型变更",
      "file.status.U": "未合并冲突",
      "file.status.other": "变更",
      "order.label": "提交排序",
      "order.date": "提交日期",
      "order.authorDate": "作者日期",
      "order.topo": "拓扑顺序",
      "action.merge": "合并到当前分支",
      "action.rebase": "变基到此提交",
      "action.dropCommit": "删除此提交",
      "action.resetToCommit": "重置当前分支",
      "action.pullBranch": "拉取",
      "action.pushBranch": "推送",
      "action.pushTag": "推送标签",
      "action.tagDetails": "标签详情",
      "action.stashApply": "应用储藏",
      "action.stashPop": "弹出储藏",
      "action.stashDrop": "删除储藏",
      "action.branchFromStash": "从储藏新建分支",
      "action.stashUncommitted": "储藏全部改动",
      "action.stashUntracked": "连同未跟踪文件储藏",
      "action.cleanUntracked": "清理未跟踪文件",
      "action.resetUncommitted": "重置未提交改动",
      "action.resetFileToRevision": "丢弃此文件的改动",
      "action.addRemote": "添加远程仓库",
      "action.editRemote": "编辑远程仓库",
      "action.deleteRemote": "删除远程仓库",
      "action.pruneRemote": "清理远程引用",
      "action.mode": "重置模式",
      "action.remote": "远程仓库",
      "action.remoteName": "远程名称",
      "action.remoteUrl": "远程地址",
      "action.cleanPreview": "将删除以下未跟踪文件：",
      "action.previewing": "正在检查未跟踪文件…",
      "action.cleanNothing": "没有可清理的未跟踪文件",
      "action.warningForcePush": "强制推送（--force-with-lease）会覆盖远程分支历史。",
      "action.warningDrop": "删除提交会改写分支历史，之后可能需要强制推送。",
      "action.warningHardReset": "硬重置会丢弃所有未提交的改动，且无法恢复。",
      "action.warningStashDrop": "删除储藏后无法恢复。",
      "action.warningClean": "清理会永久删除未跟踪文件，且无法恢复。",
      "action.warningDiscard": "这会永久丢弃该文件未提交的改动。",
      "action.warningRemoveRemote": "删除远程只影响本地配置，不会删除远端仓库。",
      "check.noFastForward": "禁止快进",
      "check.noCommit": "不自动提交",
      "check.squash": "压缩为单个提交",
      "check.force": "强制推送（with-lease）",
      "check.setUpstream": "设置上游分支",
      "check.includeUntracked": "包含未跟踪文件",
      "check.dryRun": "仅预演（dry run）",
      "check.reinstateIndex": "恢复暂存区",
      "check.rebase": "使用变基",
      "mode.soft": "软重置（保留暂存区）",
      "mode.mixed": "混合重置（保留工作区）",
      "mode.hard": "硬重置（丢弃改动）",
      "menu.dropHead": "HEAD 提交不能删除",
      "menu.dropHasChildren": "还有其他提交依赖此提交，不能删除",
      "menu.sameBranch": "不能对当前分支执行此操作",
      "detail.tagger": "标签创建者",
      "detail.tagTime": "标签时间",
      "detail.tagType": "标签类型",
      "detail.tagMessage": "标签说明",
      "detail.lightweight": "轻量标签",
      "detail.annotated": "附注标签",
      "detail.tagNoMessage": "这个标签没有说明文字",
      "remote.title": "远程仓库",
      "remote.empty": "此仓库没有配置远程仓库",
      "remote.error": "读取远程仓库失败",
      "remote.fetchUrl": "拉取地址",
      "remote.pushUrl": "推送地址",
      "remote.add": "添加远程",
      "remote.edit": "编辑",
      "remote.delete": "删除",
      "remote.prune": "清理引用",
      "remote.close": "关闭远程面板",
      "toolbar.remotes": "远程仓库",
      "tooltip.label": "提交信息",
      "tooltip.containsHead": "包含于 HEAD",
      "tooltip.notContainsHead": "不包含于 HEAD",
      "tooltip.branches": "分支",
      "tooltip.tags": "标签",
      "tooltip.stashes": "储藏",
      "tooltip.overflow": "+{count}",
      "tooltip.currentBranch": "当前",
      "tooltip.loading": "正在读取包含信息…",
      "tooltip.error": "无法读取包含信息",
      "detail.signature": "签名",
      "detail.signatureVerified": "签名有效",
      "detail.signatureBad": "签名无效",
      "detail.signatureUnknown": "签名状态未知",
      "detail.signatureExpired": "签名已过期",
      "detail.signatureRevoked": "签名已被撤销",
      "detail.signer": "签名者",
      "repo.label": "选择仓库",
      "repo.current": "当前",
      "review.progress": "已评审 {reviewed}/{total}",
      "review.markAll": "全部标记",
      "review.clear": "清除评审",
      "review.toggle": "标记为已评审",
      "review.failed": "评审状态更新失败：{message}",
      "column.showAuthor": "显示作者",
      "column.showDate": "显示日期",
      "column.showHash": "显示哈希",
      "tree.flat": "平铺",
      "tree.tree": "树形",
      "tree.view": "文件视图",
      "tree.toggle": "切换目录",
      "action.pushToMultipleRemotes": "推送到多个远程…",
      "action.branch": "分支",
      "action.remotes": "远程",
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
      "menu.compareWorking": "Compare with working tree",
      "uncommitted.title": "Uncommitted changes",
      "uncommitted.total": "{count} changed file(s)",
      "uncommitted.counts": "Staged {staged} · Unstaged {unstaged} · Untracked {untracked}",
      "uncommitted.staged": "Staged",
      "uncommitted.unstaged": "Unstaged",
      "uncommitted.untracked": "Untracked",
      "uncommitted.empty": "No uncommitted changes",
      "uncommitted.error": "Could not read uncommitted changes",
      "uncommitted.untrackedHint": "Untracked files have no diff to show yet",
      "uncommitted.compareWorking": "Compare with HEAD",
      "compare.title": "Compare commits",
      "compare.workingTitle": "Working tree comparison",
      "compare.workingTree": "Working tree",
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
      "find.scopeLabel": "Search scope",
      "find.scopePage": "Loaded page",
      "find.scopeAll": "All history",
      "find.searching": "Searching all history…",
      "find.searchCount": "{count} results",
      "find.searchCapped": "Only the most recent 20,000 commits were scanned",
      "find.searchError": "Full-history search failed",
      "filter.label": "Branch filter",
      "filter.all": "All",
      "filter.empty": "No local branches",
      "filter.close": "Close branch filter",
      "filter.current": "current",
      "filter.globLabel": "Branch glob patterns",
      "filter.globPlaceholder": "e.g. feature/*, separate multiple with commas",
      "filter.globEmpty": "A glob pattern cannot be empty",
      "filter.globInvalid": "Invalid glob pattern: unclosed bracket",
      "filter.noGlobMatch": "No branches match this glob",
      "filter.noGlobMatchHint": "Clear the glob pattern to restore the commit list.",
      "mute.mergeCommit": "Muted: merge commit",
      "mute.nonAncestor": "Muted: not an ancestor of HEAD",
      "file.status.A": "Added file",
      "file.status.M": "Modified file",
      "file.status.D": "Deleted file",
      "file.status.R": "Renamed",
      "file.status.C": "Copied",
      "file.status.T": "Type changed",
      "file.status.U": "Unmerged conflict",
      "file.status.other": "Changed",
      "order.label": "Commit order",
      "order.date": "Committer date",
      "order.authorDate": "Author date",
      "order.topo": "Topological",
      "action.merge": "Merge into current branch",
      "action.rebase": "Rebase onto this commit",
      "action.dropCommit": "Drop this commit",
      "action.resetToCommit": "Reset current branch",
      "action.pullBranch": "Pull",
      "action.pushBranch": "Push",
      "action.pushTag": "Push tag",
      "action.tagDetails": "Tag details",
      "action.stashApply": "Apply stash",
      "action.stashPop": "Pop stash",
      "action.stashDrop": "Drop stash",
      "action.branchFromStash": "Branch from stash",
      "action.stashUncommitted": "Stash all changes",
      "action.stashUntracked": "Stash including untracked",
      "action.cleanUntracked": "Clean untracked files",
      "action.resetUncommitted": "Reset uncommitted changes",
      "action.resetFileToRevision": "Discard changes in this file",
      "action.addRemote": "Add remote",
      "action.editRemote": "Edit remote",
      "action.deleteRemote": "Delete remote",
      "action.pruneRemote": "Prune remote",
      "action.mode": "Reset mode",
      "action.remote": "Remote",
      "action.remoteName": "Remote name",
      "action.remoteUrl": "Remote URL",
      "action.cleanPreview": "These untracked files would be removed:",
      "action.previewing": "Checking untracked files…",
      "action.cleanNothing": "No untracked files to clean",
      "action.warningForcePush": "Force pushing (--force-with-lease) overwrites the remote branch history.",
      "action.warningDrop": "Dropping a commit rewrites the branch history and may require a force push.",
      "action.warningHardReset": "A hard reset discards every uncommitted change and cannot be undone.",
      "action.warningStashDrop": "A dropped stash cannot be recovered.",
      "action.warningClean": "Cleaning permanently deletes untracked files and cannot be undone.",
      "action.warningDiscard": "This permanently discards the file's uncommitted changes.",
      "action.warningRemoveRemote": "Removing a remote only edits the local configuration; the remote repository is untouched.",
      "check.noFastForward": "No fast-forward",
      "check.noCommit": "Do not commit",
      "check.squash": "Squash into one commit",
      "check.force": "Force push (with lease)",
      "check.setUpstream": "Set upstream branch",
      "check.includeUntracked": "Include untracked files",
      "check.dryRun": "Dry run only",
      "check.reinstateIndex": "Reinstate the index",
      "check.rebase": "Rebase",
      "mode.soft": "Soft (keep the index)",
      "mode.mixed": "Mixed (keep the working tree)",
      "mode.hard": "Hard (discard changes)",
      "menu.dropHead": "The HEAD commit cannot be dropped",
      "menu.dropHasChildren": "Another commit depends on this one",
      "menu.sameBranch": "This action needs another branch",
      "detail.tagger": "Tagger",
      "detail.tagTime": "Tagged",
      "detail.tagType": "Tag type",
      "detail.tagMessage": "Tag message",
      "detail.lightweight": "Lightweight tag",
      "detail.annotated": "Annotated tag",
      "detail.tagNoMessage": "This tag has no message",
      "remote.title": "Remotes",
      "remote.empty": "This repository has no remotes configured",
      "remote.error": "Could not read the remotes",
      "remote.fetchUrl": "Fetch URL",
      "remote.pushUrl": "Push URL",
      "remote.add": "Add remote",
      "remote.edit": "Edit",
      "remote.delete": "Delete",
      "remote.prune": "Prune",
      "remote.close": "Close remotes",
      "toolbar.remotes": "Remotes",
      "tooltip.label": "Commit info",
      "tooltip.containsHead": "Contained in HEAD",
      "tooltip.notContainsHead": "Not contained in HEAD",
      "tooltip.branches": "Branches",
      "tooltip.tags": "Tags",
      "tooltip.stashes": "Stashes",
      "tooltip.overflow": "+{count}",
      "tooltip.currentBranch": "current",
      "tooltip.loading": "Reading containment…",
      "tooltip.error": "Could not read containment",
      "detail.signature": "Signature",
      "detail.signatureVerified": "Verified signature",
      "detail.signatureBad": "Bad signature",
      "detail.signatureUnknown": "Unknown signature status",
      "detail.signatureExpired": "Expired signature",
      "detail.signatureRevoked": "Revoked signature",
      "detail.signer": "Signer",
      "repo.label": "Select repository",
      "repo.current": "current",
      "review.progress": "Reviewed {reviewed}/{total}",
      "review.markAll": "Mark all",
      "review.clear": "Clear reviews",
      "review.toggle": "Mark as reviewed",
      "review.failed": "Could not update review state: {message}",
      "column.showAuthor": "Show author",
      "column.showDate": "Show date",
      "column.showHash": "Show hash",
      "tree.flat": "Flat",
      "tree.tree": "Tree",
      "tree.view": "File view",
      "tree.toggle": "Toggle directory",
      "action.pushToMultipleRemotes": "Push to multiple remotes…",
      "action.branch": "Branch",
      "action.remotes": "Remotes",
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
.dgg-menu-check{display:flex;align-items:center;gap:6px;padding:3px 8px;font-size:11px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dgg-menu-check input{margin:0;accent-color:var(--dsw-alias-brand-primary)}
.dgg-seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;overflow:hidden;flex:none}
.dgg-seg-btn{padding:1px 7px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;cursor:pointer}
.dgg-seg-btn.dgg-seg-on{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dgg-file-views{display:flex;align-items:center;gap:6px;justify-content:space-between;flex-wrap:wrap}
.dgg-tree{display:flex;flex-direction:column;gap:1px}
.dgg-tree-dir{display:flex;flex-direction:column;gap:1px}
.dgg-tree-dir-head{display:flex;align-items:center;gap:4px;width:100%;padding:3px 6px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;text-align:left;cursor:pointer}
.dgg-tree-dir-head:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dgg-tree-caret{color:var(--dsw-alias-label-tertiary);width:10px;flex:none}
.dgg-tree-dir-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgg-tree-children{padding-left:10px;display:flex;flex-direction:column;gap:1px}
.dgg-tree-file{min-width:0}
.dgg-dialog-note{margin:0;font-size:11px;color:var(--dsw-alias-label-secondary)}
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
.dgg-btn-blocked{opacity:.6}
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
.dgg-st-text{flex:none;font-size:9.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dgg-md-code{padding:0 3px;border-radius:3px;background:var(--dsw-alias-markdown-code-block);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px}
.dgg-md-bold{font-weight:600}
.dgg-md-italic{font-style:italic}
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
.dgg-row-muted{opacity:.55}
.dgg-chips-aligned{padding-left:2px}
.dgg-chips-right{margin-left:auto;display:inline-flex;flex-wrap:wrap;gap:3px}
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
.dgg-compare-working{font-family:inherit;color:var(--dsw-alias-label-secondary)}
.dgg-compare .dgg-btn{font-size:10.5px;padding:1px 7px}
.dgg-compare-hint{margin:0;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.dgg-subbar{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;min-width:0;background:var(--dsw-alias-bg-layer-1)}
.dgg-findbar{flex-wrap:nowrap}
.dgg-find-input{flex:1 1 auto;min-width:0;font-size:11px;padding:2px 6px}
.dgg-find-count{flex:none;font-size:10px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dgg-find-icon{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary)}
.dgg-find-scope{display:inline-flex;align-items:center;gap:2px;flex:none;padding:0 2px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px}
.dgg-scope-option{display:inline-flex;align-items:center;gap:2px;font-size:10px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap}
.dgg-scope-option input{margin:0;accent-color:var(--dsw-alias-brand-primary)}
.dgg-search{display:flex;flex-direction:column;gap:4px;flex:1 1 auto;min-height:0}
.dgg-search-count{margin:0;padding:4px 8px 0;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dgg-search-capped{margin:0;padding:0 8px;color:var(--dsw-alias-state-warn-label)}
.dgg-search-error{margin:0;padding:6px 8px}
.dgg-search .dgg-load-more{padding-top:4px}
.dgg-filterbar{display:flex;align-items:flex-start;gap:6px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;min-width:0;flex-wrap:wrap;background:var(--dsw-alias-bg-layer-1)}
.dgg-filter-title{flex:none;font-size:10.5px;color:var(--dsw-alias-label-tertiary);padding-top:2px}
.dgg-filter-options{display:flex;flex-wrap:wrap;gap:2px 10px;flex:1 1 140px;min-width:0;max-height:88px;overflow:auto}
.dgg-filter-option{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:var(--dsw-alias-label-secondary);cursor:pointer;min-width:0}
.dgg-filter-option input{margin:0;accent-color:var(--dsw-alias-brand-primary);flex:none}
.dgg-filter-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}
.dgg-filter-head{font-size:9px;color:var(--dsw-alias-label-tertiary);flex:none}
.dgg-glob-field{display:flex;align-items:center;gap:4px;flex:1 1 100%;min-width:0}
.dgg-glob-label{flex:none;font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.dgg-glob-input{flex:1 1 auto;min-width:0;font-size:10.5px;padding:2px 6px}
.dgg-glob-error{margin:0;flex:1 1 100%;font-size:10px;color:var(--dsw-alias-state-error-primary)}
.dgg-menu-field{display:flex;flex-direction:column;gap:3px;padding:4px 6px}
.dgg-menu-field-label{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.dgg-menu-select{font-size:11px;width:100%}
.dgg-chip-stash{border-style:dotted;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.dgg-row-active{background:var(--dsw-alias-interactive-bg-active)}
.dgg-tooltip{position:fixed;z-index:70;max-width:260px;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.45;pointer-events:none;display:flex;flex-direction:column;gap:3px}
.dgg-tooltip-head{margin:0;font-size:11px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dgg-tooltip-row{display:flex;gap:5px;flex-wrap:wrap;min-width:0;align-items:center}
.dgg-tooltip-key{color:var(--dsw-alias-label-tertiary);flex:none}
.dgg-tooltip-value{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;display:flex;gap:3px;flex-wrap:wrap;min-width:0}
.dgg-tooltip-branch{font-size:10px;padding:0 4px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);white-space:nowrap}
.dgg-tooltip-current{border-color:var(--dsw-alias-brand-primary)}
.dgg-tooltip-overflow{color:var(--dsw-alias-label-tertiary)}
.dgg-signature{display:inline-flex;align-items:center;gap:4px;padding:0 6px;height:18px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3);font-size:9.5px;color:var(--dsw-alias-label-secondary)}
.dgg-signature-good{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
.dgg-signature-bad{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dgg-signature-warn{border-color:var(--dsw-alias-state-warn-label);color:var(--dsw-alias-state-warn-label)}
.dgg-signature-label{color:inherit}
.dgg-signature-signer{color:var(--dsw-alias-label-tertiary);font-size:9px;overflow-wrap:anywhere}
.dgg-emoji{font-family:inherit}
.dgg-issue-link{color:var(--dsw-alias-link);text-decoration:none}
.dgg-issue-link:hover{text-decoration:underline}
.dgg-repo-input{max-width:150px;font-size:11px;height:22px;padding:0 4px;flex:none}
.dgg-review-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.dgg-review-progress{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dgg-review-head .dgg-btn{font-size:10px;padding:1px 6px}
.dgg-review-check{display:inline-flex;align-items:center;justify-content:center;flex:none;padding-left:6px;cursor:pointer}
.dgg-review-check input{margin:0;accent-color:var(--dsw-alias-brand-primary)}
.dgg-file-reviewable .dgg-file-path{font-weight:600}
.dgg-file-reviewed .dgg-file-path{font-weight:400;opacity:.55}
.dgg-file-reviewed .dgg-file-counts{opacity:.6}
.dgg-file-line{display:flex;align-items:center;gap:4px;min-width:0}
.dgg-file-line .dgg-file-head{flex:1 1 auto;min-width:0}
.dgg-checks{display:flex;flex-direction:column;gap:3px}
.dgg-check{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dgg-check input{margin:0;accent-color:var(--dsw-alias-brand-primary);flex:none}
.dgg-check-label{overflow-wrap:anywhere}
.dgg-preview{display:flex;flex-direction:column;gap:3px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);max-height:140px;overflow:auto}
.dgg-preview-title{margin:0;font-size:10.5px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.dgg-preview-list{margin:0;padding-left:16px;display:flex;flex-direction:column;gap:2px}
.dgg-preview-line{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}
.dgg-panel{display:flex;flex-direction:column;gap:6px;padding:8px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);flex:none;max-height:40%;overflow:auto}
.dgg-panel-head{display:flex;align-items:center;gap:6px;min-width:0}
.dgg-panel-title{margin:0;font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-primary);flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgg-remotes{display:flex;flex-direction:column;gap:4px}
.dgg-remote-row{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.dgg-remote-name{font-size:11px;font-weight:600;color:var(--dsw-alias-label-primary);flex:none}
.dgg-remote-url{flex:1 1 120px;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgg-remote-row .dgg-btn{font-size:10px;padding:1px 6px}
.dgg-tag-details{display:flex;flex-direction:column;gap:4px}
.dgg-file-actions{display:flex;justify-content:flex-end;padding:0 6px 4px}
.dgg-file-actions .dgg-btn{font-size:10px;padding:1px 6px}
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
     * Whether a value behaves like a Set of hashes (the muted-commit lookup).
     * @param value - candidate value.
     * @returns true for a Set-like object.
     */
    function isSetLike(value) {
      return value !== null && typeof value === "object" && typeof value.has === "function";
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
     *
     * With a configured `dateFormat` the timestamp uses that format; without one
     * (pre-wave-8 presentation) it keeps the legacy `absolute (relative)` pair.
     * @param name - display name.
     * @param email - address.
     * @param seconds - Unix seconds.
     * @param lang - BCP 47 tag.
     * @param presentation - normalized presentation settings (optional).
     * @returns one readable line.
     */
    function personLine(name, email, seconds, lang, presentation) {
      const who = typeof name === "string" && name !== "" ? name : "";
      const mail = typeof email === "string" && email !== "" ? " <" + email + ">" : "";
      let when = "";
      if (Number.isFinite(seconds)) {
        const settings = presentation !== null && typeof presentation === "object" ? presentation : {};
        when = normalizeDateFormat(settings.dateFormat) === ""
          ? absoluteTime(seconds, lang) + " (" + relativeTime(seconds, lang) + ")"
          : formatCommitDate(seconds, settings, lang);
      }
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
        // Keep the host's code and extra detail (git's own stderr for a failed action)
        // on the rejection so callers can distinguish e.g. UNAVAILABLE without
        // re-parsing the envelope.
        if (failure !== null && typeof failure === "object" && typeof failure.code === "string" && failure.code !== "") error.code = failure.code;
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
    function laneColor(lane, colours) {
      const index = Number.isFinite(lane) ? Math.abs(Math.floor(lane)) : 0;
      const palette = Array.isArray(colours) && colours.length > 0 ? colours : LANE_COLORS;
      return palette[index % palette.length];
    }

    /**
     * Straight or bezier path between two lane points.
     * @param x1 - start x.
     * @param y1 - start y.
     * @param x2 - end x.
     * @param y2 - end y.
     * @returns an SVG path data string.
     */
    function lanePath(x1, y1, x2, y2, style) {
      if (x1 === x2) return "M" + x1 + " " + y1 + " L" + x2 + " " + y2;
      const middle = (y1 + y2) / 2;
      // Angular lanes use orthogonal segments: vertical, horizontal elbow, vertical.
      if (style === "angular") return "M" + x1 + " " + y1 + " L" + x1 + " " + middle + " L" + x2 + " " + middle + " L" + x2 + " " + y2;
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
        const kind = known.kind === "tag" || known.kind === "remote" || known.kind === "stash" ? known.kind : "branch";
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
      if (type === "stash" || name.startsWith("refs/stash")) return "stash";
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

    /** Reset modes offered by the reset dialogs, in escalating severity. */
    const RESET_MODES = {
      resetToCommit: [
        { value: "soft", labelKey: "mode.soft" },
        { value: "mixed", labelKey: "mode.mixed" },
        { value: "hard", labelKey: "mode.hard" },
      ],
      resetUncommitted: [
        { value: "mixed", labelKey: "mode.mixed" },
        { value: "hard", labelKey: "mode.hard" },
      ],
    };

    /**
     * Default text fields for a dialog descriptor that predates `fields`.
     * @param kind - action discriminator.
     * @param needs - dialog shape.
     * @returns field descriptors `{ key, labelKey, prefill? }`.
     */
    function actionFields(kind, needs) {
      if (needs === "rename") {
        return [
          { key: "name", labelKey: "action.oldBranchName", prefill: "requestedRef" },
          { key: "newName", labelKey: "action.newBranchName", required: true },
        ];
      }
      if (needs === "name") return [{ key: "name", labelKey: kind === "createTag" ? "action.tagName" : "action.branchName" }];
      if (needs === "url") {
        return [
          { key: "name", labelKey: "action.remoteName", prefill: "requestedRef" },
          { key: "url", labelKey: "action.remoteUrl", prefill: "extra" },
        ];
      }
      return [];
    }

    /** Declarative boolean options, rendered as checkboxes by the one dialog. */
    const ACTION_CHECKS = {
      noFastForward: { key: "noFastForward", labelKey: "check.noFastForward" },
      noCommit: { key: "noCommit", labelKey: "check.noCommit" },
      squash: { key: "squash", labelKey: "check.squash" },
      force: { key: "force", labelKey: "check.force", warningKey: "action.warningForcePush" },
      setUpstream: { key: "setUpstream", labelKey: "check.setUpstream" },
      includeUntracked: { key: "includeUntracked", labelKey: "check.includeUntracked" },
      dryRun: { key: "dryRun", labelKey: "check.dryRun", checked: true },
      reinstateIndex: { key: "reinstateIndex", labelKey: "check.reinstateIndex" },
      rebase: { key: "rebase", labelKey: "check.rebase" },
    };

    /**
     * Presentation of every action the UI can run.
     *
     * One table drives the single dialog component, its argument builder and the
     * guardrail warnings, so no action needs bespoke UI. `options` is the dialog's
     * choice list: ref names for branch/tag/remote selects, checkbox descriptors
     * for flag dialogs.
     */
    const ACTION_UI = {
      checkoutBranch: { needs: "branch", optionSet: "branches" },
      deleteBranch: { needs: "branch", optionSet: "branchesWithoutCurrent", destructive: true },
      deleteTag: { needs: "tag", optionSet: "tags", destructive: true },
      renameBranch: {
        needs: null,
        fields: [
          { key: "name", labelKey: "action.oldBranchName", prefill: "requestedRef" },
          { key: "newName", labelKey: "action.newBranchName", required: true },
        ],
      },
      createBranch: { needs: null, fields: [{ key: "name", labelKey: "action.branchName" }] },
      createTag: { needs: null, fields: [{ key: "name", labelKey: "action.tagName" }] },
      checkoutCommit: { destructive: true },
      cherryPick: { destructive: true },
      revert: { destructive: true },
      merge: { options: ["noFastForward", "noCommit", "squash"], dirtySensitive: true },
      rebase: { dirtySensitive: true },
      dropCommit: { destructive: true, dirtySensitive: true, warnings: ["action.warningDrop"] },
      resetToCommit: { needs: "hashAndMode", modeSet: "resetToCommit", destructive: true, dirtySensitive: true, modeWarnings: { hard: "action.warningHardReset" } },
      pullBranch: { needs: "remote", optionSet: "remotes", options: ["noFastForward", "rebase"], dirtySensitive: true },
      pushBranch: { needs: "remote", optionSet: "remotes", options: ["force", "setUpstream"], dirtySensitive: false, checkWarnings: { force: "action.warningForcePush" } },
      pushTag: { needs: "remote", optionSet: "remotes", dirtySensitive: false },
      // The host action pushes each remote once and takes no force flag, so this
      // dialog deliberately offers no force option.
      pushToMultipleRemotes: { needs: "remote", optionSet: "remotes", remotesMany: true, dirtySensitive: false },
      stashApply: { options: ["reinstateIndex"] },
      stashPop: { options: ["reinstateIndex"] },
      stashDrop: { destructive: true, warnings: ["action.warningStashDrop"] },
      branchFromStash: { fields: [{ key: "name", labelKey: "action.branchName" }] },
      stashPush: { options: ["includeUntracked"], dirtySensitive: false },
      stashUncommitted: { options: ["includeUntracked"], dirtySensitive: false },
      cleanUntracked: { destructive: true, dirtySensitive: false, warnings: ["action.warningClean"], requiresPreview: true },
      resetUncommitted: { needs: "mode", modeSet: "resetUncommitted", destructive: true, dirtySensitive: false, modeWarnings: { hard: "action.warningHardReset" } },
      resetFileToRevision: { destructive: true, dirtySensitive: false, warnings: ["action.warningDiscard"] },
      addRemote: { dirtySensitive: false,
        fields: [
          { key: "name", labelKey: "action.remoteName" },
          { key: "url", labelKey: "action.remoteUrl" },
        ],
      },
      editRemote: { dirtySensitive: false,
        fields: [
          { key: "name", labelKey: "action.remoteName", prefill: "requestedRef" },
          { key: "url", labelKey: "action.remoteUrl", prefill: "extra" },
        ],
      },
      deleteRemote: { destructive: true, dirtySensitive: false, warnings: ["action.warningRemoveRemote"] },
      pruneRemote: { dirtySensitive: false },
      fetch: { dirtySensitive: false },
    };

    /** Action kind → the `dialogDefaults` group that seeds its dialog. */
    const DIALOG_DEFAULT_GROUPS = {
      stashApply: "applyStash",
      stashPop: "popStash",
      merge: "merge",
      pullBranch: "pullBranch",
      resetToCommit: "resetCurrentBranchToCommit",
      resetUncommitted: "resetUncommittedChanges",
      stashUncommitted: "stashUncommittedChanges",
      stashPush: "stashUncommittedChanges",
    };

    /** Upstream default key → the client checkbox flag it seeds. */
    const DIALOG_DEFAULT_FLAGS = {
      applyStash: { reinstateIndex: "reinstateIndex" },
      popStash: { reinstateIndex: "reinstateIndex" },
      merge: { noCommit: "noCommit", noFastForward: "noFastForward", squashCommits: "squash" },
      pullBranch: { noFastForward: "noFastForward" },
      stashUncommittedChanges: { includeUntracked: "includeUntracked" },
    };

    /**
     * The presentation-provided defaults for one action dialog.
     *
     * Absent/unknown entries stay as today (unchecked flags, first mode choice); the
     * returned flags/mode only seed the dialog state, so the user can still override
     * every one of them before submitting.
     * @param kind - action discriminator.
     * @param dialogDefaults - sanitized `presentation.dialogDefaults`.
     * @returns `{ flags: { [clientKey]: true }, mode: "" | "soft" | "mixed" | "hard" }`.
     */
    function dialogDefaultsFor(kind, dialogDefaults) {
      const groups = dialogDefaults !== null && typeof dialogDefaults === "object" ? dialogDefaults : {};
      const groupName = Object.prototype.hasOwnProperty.call(DIALOG_DEFAULT_GROUPS, kind) ? DIALOG_DEFAULT_GROUPS[kind] : "";
      const rawGroup = groupName !== "" && groups[groupName] !== null && typeof groups[groupName] === "object" ? groups[groupName] : {};
      const flags = {};
      const mapping = groupName !== "" && Object.prototype.hasOwnProperty.call(DIALOG_DEFAULT_FLAGS, groupName) ? DIALOG_DEFAULT_FLAGS[groupName] : {};
      for (const [upstreamKey, clientKey] of Object.entries(mapping)) {
        if (rawGroup[upstreamKey] === true) flags[clientKey] = true;
      }
      const mode = rawGroup.mode === "soft" || rawGroup.mode === "mixed" || rawGroup.mode === "hard" ? rawGroup.mode : "";
      return { flags, mode };
    }

    /**
     * Which choices one action dialog needs, and how it is presented.
     *
     * Kept pure so the branch-deletion rules (never offer the checked-out branch,
     * never warn about a dirty worktree when the action does not touch it) are
     * testable without a React render.
     * @param kind - action discriminator.
     * @param choices - `{ branches, tags, remotes, currentBranch }` for the open target.
     * @returns `{ needs, options, fields, choices, destructive, dirtySensitive, warnings, modeWarnings, requiresPreview }`.
     */
    function actionDialogSpec(kind, choices) {
      const settings = choices !== null && typeof choices === "object" ? choices : {};
      const branches = Array.isArray(settings.branches) ? settings.branches : [];
      const tags = Array.isArray(settings.tags) ? settings.tags : [];
      const remotes = Array.isArray(settings.remotes) ? settings.remotes : [];
      const currentBranch = typeof settings.currentBranch === "string" ? settings.currentBranch : "";
      const ui = Object.prototype.hasOwnProperty.call(ACTION_UI, kind) ? ACTION_UI[kind] : {};
      const defaults = dialogDefaultsFor(kind, settings.dialogDefaults);
      const options =
        ui.optionSet === "branches" ? branches
          : ui.optionSet === "branchesWithoutCurrent" ? branches.filter((branch) => branch.name !== currentBranch)
            : ui.optionSet === "tags" ? tags
              : ui.optionSet === "remotes" ? remotes : [];
      const checks = Array.isArray(ui.options) ? ui.options.map((key) => ACTION_CHECKS[key]).filter((check) => check !== undefined) : [];
      const destructive =
        ui.destructive === true ||
        kind === "checkoutBranch" || kind === "checkoutCommit" || kind === "cherryPick" ||
        kind === "revert" || kind === "deleteTag" || kind === "deleteBranch";
      const dirtySensitive = ui.dirtySensitive === true ||
        (kind !== "createBranch" && kind !== "createTag" && kind !== "deleteTag" &&
          kind !== "deleteBranch" && kind !== "renameBranch" && !Object.prototype.hasOwnProperty.call(ui, "dirtySensitive"));
      return {
        needs: typeof ui.needs === "string" ? ui.needs : null,
        // A dialog with a select keeps its name choices in `options`; a flag-only
        // dialog exposes its checkbox descriptors there (C2). `checks` is always the
        // checkbox list so pull/push can combine a remote select with flags.
        options: checks.length > 0 && options.length === 0
          ? checks
          : options.map((option) => (typeof option === "string" ? { name: option } : option)),
        checks,
        fields: Array.isArray(ui.fields) ? ui.fields : [],
        choices: typeof ui.modeSet === "string" ? (RESET_MODES[ui.modeSet] || []) : [],
        destructive,
        dirtySensitive,
        warnings: Array.isArray(ui.warnings) ? ui.warnings : [],
        modeWarnings: ui.modeWarnings !== null && typeof ui.modeWarnings === "object" ? ui.modeWarnings : {},
        requiresPreview: ui.requiresPreview === true,
        remotesMany: ui.remotesMany === true,
        checkWarnings: ui.checkWarnings !== null && typeof ui.checkWarnings === "object" ? ui.checkWarnings : {},
        defaults,
      };
    }

    /**
     * Build the request arguments a confirmed dialog submits.
     *
     * The only place an action body is constructed: menus, the detail row and the
     * uncommitted pane all confirm through this function.
     * @param kind - action discriminator.
     * @param input - `{ name, ref, hash, newName, extra, flags, mode, branch, tagName, path, index, remoteName }`.
     * @returns the argument object for the `action` route.
     */
    function actionArguments(kind, input) {
      const record = input !== null && typeof input === "object" ? input : {};
      const text = (value) => (typeof value === "string" ? value : "");
      const name = text(record.name);
      const ref = text(record.ref);
      const hash = text(record.hash);
      const extra = text(record.extra);
      const newName = text(record.newName) !== "" ? text(record.newName) : extra;
      const mode = text(record.mode) !== "" ? text(record.mode) : extra;
      const flags = record.flags !== null && typeof record.flags === "object" ? record.flags : {};
      const branch = text(record.branch);
      const path = text(record.path);
      const index = Number.isSafeInteger(record.index) && record.index >= 0 ? record.index : 0;
      const includeUntracked = flags.includeUntracked === true;
      const boolean = (key) => flags[key] === true;
      switch (kind) {
        case "checkoutBranch": return { branch: ref };
        case "deleteTag": return { name: ref };
        // A first delete attempt is always non-forcing; the UI escalates only after
        // git refuses an unmerged branch.
        case "deleteBranch": return { name: ref, force: false };
        case "renameBranch": return { name, newName };
        case "createBranch": return { name, startPoint: hash };
        case "createTag": return { name, hash };
        case "merge": return {
          hash,
          noFastForward: boolean("noFastForward"),
          noCommit: boolean("noCommit"),
          squash: boolean("squash"),
        };
        case "rebase": return { onto: hash };
        case "dropCommit": return { hash };
        case "resetToCommit": return { hash, mode: modeOf(mode, RESET_MODES.resetToCommit) };
        case "pullBranch": {
          const args = { remote: ref, branch, noFastForward: boolean("noFastForward"), rebase: boolean("rebase") };
          return cleanEmpty(args);
        }
        case "pushBranch": {
          const args = { remote: ref, branch, setUpstream: boolean("setUpstream"), force: boolean("force") };
          return cleanEmpty(args);
        }
        case "pushTag": return cleanEmpty({ name: text(record.tagName), remote: ref });
        case "pushToMultipleRemotes": {
          const remotes = Array.isArray(record.ref) ? record.ref.filter((remote) => typeof remote === "string" && remote !== "") : [];
          return remotes.length === 0 ? cleanEmpty({ branch: extra }) : cleanEmpty({ branch: extra, remotes });
        }
        case "stashApply": return { index, reinstateIndex: boolean("reinstateIndex") };
        case "stashPop": return { index, reinstateIndex: boolean("reinstateIndex") };
        case "stashDrop": return { index };
        case "branchFromStash": return { index, name };
        case "stashPush":
        case "stashUncommitted": return { includeUntracked };
        // The UI always previews first; a confirmed clean is the real one.
        case "cleanUntracked": return { dryRun: flags.dryRun === true };
        case "resetUncommitted": return { mode: modeOf(mode, RESET_MODES.resetUncommitted) };
        case "resetFileToRevision": return { path, hash: hash === "" ? "HEAD" : hash };
        case "addRemote": return cleanEmpty({ name, url: extra });
        case "editRemote": return cleanEmpty({ name, url: extra });
        case "fetch": return cleanEmpty({ remote: ref });
        case "deleteRemote": return { name: text(record.remoteName) };
        case "pruneRemote": return { name: text(record.remoteName) };
        default: return { hash };
      }
    }

    /**
     * One valid mode value from the dialog's choices.
     * @param value - selected mode.
     * @param choices - allowed `{ value }` descriptors.
     * @returns the selected value, or the safest (first) one.
     */
    function modeOf(value, choices) {
      const allowed = Array.isArray(choices) ? choices : [];
      return allowed.some((choice) => choice.value === value) ? value : allowed.length > 0 ? allowed[0].value : "mixed";
    }

    /**
     * Drop undefined/empty-string members from an argument object.
     * @param args - candidate arguments.
     * @returns the compacted object.
     */
    function cleanEmpty(args) {
      const result = {};
      for (const [key, value] of Object.entries(args)) {
        if (value === undefined || value === null || value === "") continue;
        if (value === false) continue;
        result[key] = value;
      }
      return result;
    }

    /**
     * Split one action's combined output into non-empty display lines.
     * @param text - combined stdout/stderr.
     * @returns trimmed, non-empty lines.
     */
    function outputLines(text) {
      if (typeof text !== "string" || text === "") return [];
      return text.split("\n").map((line) => line.trim()).filter((line) => line !== "");
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
     * working-tree, comparison and commit-vs-working-tree views cannot drift apart.
     * @param input - `{ sessionId, scope, hash, base, head, file, oldPath, status }`.
     * @returns the JSON request body.
     */
    function diffRequest(input) {
      const spec = input !== null && typeof input === "object" ? input : {};
      const scope = spec.scope === "staged" || spec.scope === "unstaged" || spec.scope === "compare" || spec.scope === "working"
        ? spec.scope
        : "commit";
      const request = { sessionId: spec.sessionId, scope, file: typeof spec.file === "string" ? spec.file : "" };
      if (scope === "compare") {
        request.base = typeof spec.base === "string" ? spec.base : "";
        request.head = typeof spec.head === "string" ? spec.head : "";
      } else if (scope === "commit" || scope === "working") {
        request.hash = typeof spec.hash === "string" ? spec.hash : "";
      }
      if (typeof spec.oldPath === "string" && spec.oldPath !== "") request.oldPath = spec.oldPath;
      if (typeof spec.status === "string" && spec.status !== "") request.status = spec.status;
      if (typeof spec.path === "string" && spec.path !== "") request.path = spec.path;
      return request;
    }

    /**
     * Cache key of one diff request, including its scope and comparison endpoints.
     *
     * `working` is keyed by its base hash: the working tree can change between
     * renders, but the expanded row re-requests only when the scope/hash changes
     * (a refresh rebuilds the component that owns the cache).
     * @param input - same shape as {@link diffRequest}.
     * @returns a stable string key.
     */
    function diffCacheKey(input) {
      const request = diffRequest(input);
      const target = request.scope === "compare"
        ? request.base + ".." + request.head
        : request.scope === "commit" || request.scope === "working"
          ? request.hash
          : "";
      const base = [request.scope, target, request.file, request.oldPath === undefined ? "" : request.oldPath].join("|");
      // A per-repository cache must not collide across repositories.
      return typeof request.path === "string" && request.path !== "" ? base + "@" + request.path : base;
    }

    /**
     * Build the `compare` route body.
     *
     * `working: true` selects the working-tree form: the tracked index/worktree and
     * the untracked files are compared against `base`, and `head` is not sent.
     * @param input - `{ sessionId, base, head, working? }`.
     * @returns the JSON request body.
     */
    function compareRequest(input) {
      const spec = input !== null && typeof input === "object" ? input : {};
      const request = {
        sessionId: spec.sessionId,
        base: typeof spec.base === "string" ? spec.base : "",
      };
      if (spec.working === true) request.working = true;
      else request.head = typeof spec.head === "string" ? spec.head : "";
      if (typeof spec.path === "string" && spec.path !== "") request.path = spec.path;
      return request;
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
          : typeof ref.name === "string" ? ref.name.replace(/^refs\/(?:heads|remotes|tags)\//, "").replace(/^refs\//, "") : "";
        return shortName === label;
      });
    }

    /** Stash chip labels look like `stash@{0}`; the index drives every stash action. */
    function stashIndex(label) {
      const match = typeof label === "string" ? /^stash@\{(\d+)\}$/.exec(label) : null;
      return match === null ? -1 : Number.parseInt(match[1], 10);
    }

    /**
     * Whether any commit of the loaded page lists `hash` as a parent.
     * @param commits - commits of the current page.
     * @param hash - candidate commit hash.
     * @returns true when another commit depends on it.
     */
    function commitHasChildren(commits, hash) {
      const needle = typeof hash === "string" ? hash : "";
      if (needle === "") return false;
      const list = Array.isArray(commits) ? commits : [];
      return list.some((commit) => {
        if (commit === null || typeof commit !== "object" || !Array.isArray(commit.parents)) return false;
        return commit.parents.includes(needle);
      });
    }

    /**
     * Insert extended menu items next to the ones they relate to.
     * @param base - the already ordered base items.
     * @param extra - items carrying `before`/`after` anchors (id strings).
     * @returns the combined list; unmatched extras append.
     */
    function insertMenuItems(base, extra) {
      const items = Array.isArray(base) ? base.slice() : [];
      for (const item of Array.isArray(extra) ? extra : []) {
        if (item === null || typeof item !== "object") continue;
        const beforeIndex = typeof item.before === "string" ? items.findIndex((entry) => entry.id === item.before) : -1;
        if (beforeIndex !== -1) {
          items.splice(beforeIndex, 0, item);
          continue;
        }
        const afterIndex = typeof item.after === "string" ? items.findIndex((entry) => entry.id === item.after) : -1;
        if (afterIndex !== -1) {
          items.splice(afterIndex + 1, 0, item);
          continue;
        }
        items.push(item);
      }
      return items;
    }

    /**
     * Extra commit actions appended to {@link commitMenuItems} by the UI.
     *
     * Kept separate so the wave-2 base list stays the stable, tested contract:
     * dropping is refused for HEAD and for any commit a loaded commit depends on.
     * @param commit - commit record.
     * @param context - `{ headHash?, commits?, busy? }`.
     * @returns `[{ id, kind, labelKey, after?, disabled?, reasonKey? }]`.
     */
    function commitActionItems(commit, context) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const hash = typeof record.hash === "string" ? record.hash : "";
      const settings = context !== null && typeof context === "object" ? context : {};
      const headHash = typeof settings.headHash === "string" ? settings.headHash : "";
      const busy = settings.busy === true;
      const hasChildren = hash !== "" && commitHasChildren(settings.commits, hash);
      const items = [
        // Working-tree comparison is offered next to the two-commit comparison.
        { id: "compare-working", kind: "compareWorking", labelKey: "menu.compareWorking", after: "compare" },
        { id: "merge", kind: "merge", labelKey: "action.merge", after: "create-branch" },
        { id: "rebase", kind: "rebase", labelKey: "action.rebase", after: "merge" },
        { id: "drop-commit", kind: "dropCommit", labelKey: "action.dropCommit", after: "revert" },
        { id: "reset-commit", kind: "resetToCommit", labelKey: "action.resetToCommit", after: "drop-commit" },
      ];
      return items.map((item) => {
        if (hash === "" || busy) return { ...item, disabled: true, reasonKey: "menu.busy" };
        if (item.kind === "dropCommit") {
          if (hash === headHash) return { ...item, disabled: true, reasonKey: "menu.dropHead" };
          if (hasChildren) return { ...item, disabled: true, reasonKey: "menu.dropHasChildren" };
        }
        return item;
      });
    }

    /**
     * Extra ref actions appended to {@link refMenuItems} by the UI.
     *
     * Separate from the base list for the same reason as commits: branch merge/
     * pull/push/rebase/reset/fetch, tag details/push and the whole stash menu.
     * @param chip - classified ref chip `{ label, kind, isHead }`.
     * @param context - `{ currentBranch?, busy?, hasRemotes? }`.
     * @returns `[{ id, kind, labelKey, before?, after?, disabled?, reasonKey? }]`.
     */
    function refActionItems(chip, context) {
      const record = chip !== null && typeof chip === "object" ? chip : {};
      const kind = typeof record.kind === "string" ? record.kind : "";
      const label = typeof record.label === "string" ? record.label : "";
      const settings = context !== null && typeof context === "object" ? context : {};
      const currentBranch = typeof settings.currentBranch === "string" ? settings.currentBranch : "";
      const busy = settings.busy === true;
      const hasRemotes = settings.hasRemotes === true;
      const checkedOut = record.isHead === true || (currentBranch !== "" && label === currentBranch);
      let items;
      if (kind === "branch") {
        items = [
          { id: "merge-branch", kind: "merge", labelKey: "action.merge", after: "checkout-branch" },
          { id: "pull-branch", kind: "pullBranch", labelKey: "action.pullBranch", after: "merge-branch" },
          { id: "push-branch", kind: "pushBranch", labelKey: "action.pushBranch", after: "pull-branch" },
          { id: "rebase-branch", kind: "rebase", labelKey: "action.rebase", after: "push-branch" },
          { id: "reset-branch", kind: "resetToCommit", labelKey: "action.resetToCommit", after: "rebase-branch" },
          { id: "fetch-branch", kind: "fetchIntoBranch", labelKey: "action.fetch", after: "delete-branch" },
        ];
      } else if (kind === "tag") {
        items = [
          { id: "tag-details", kind: "tagDetails", labelKey: "action.tagDetails", before: "delete-tag" },
          { id: "push-tag", kind: "pushTag", labelKey: "action.pushTag", after: "tag-details" },
        ];
      } else if (kind === "stash") {
        items = [
          { id: "stash-apply", kind: "stashApply", labelKey: "action.stashApply" },
          { id: "stash-pop", kind: "stashPop", labelKey: "action.stashPop" },
          { id: "stash-drop", kind: "stashDrop", labelKey: "action.stashDrop" },
          { id: "stash-branch", kind: "branchFromStash", labelKey: "action.branchFromStash" },
        ];
      } else {
        return [];
      }
      return items.map((item) => {
        if (busy) return { ...item, disabled: true, reasonKey: "menu.busy" };
        if (kind === "stash" && stashIndex(label) < 0) return { ...item, disabled: true, reasonKey: "menu.noRef" };
        if (item.kind === "pullBranch" || item.kind === "pushBranch" || item.kind === "fetchIntoBranch" || item.kind === "pushTag") {
          if (!hasRemotes) return { ...item, disabled: true, reasonKey: "menu.noRemotes" };
        }
        if (item.kind === "rebase" && checkedOut) return { ...item, disabled: true, reasonKey: "menu.sameBranch" };
        return item;
      });
    }

    /**
     * The branch menu's extra "push to multiple remotes…" item.
     *
     * Composed separately from `refActionItems` so that the wave-4 branch-item
     * contract (and its test) stays untouched; it still obeys the same busy and
     * "no remotes" gating rules.
     * @param chip - ref chip the menu was opened on.
     * @param context - `{ busy, hasRemotes }`.
     * @returns `[]` for non-branch chips, otherwise the single menu item.
     */
    function multiRemotePushItem(chip, context) {
      const kind = chip !== null && typeof chip === "object" && typeof chip.kind === "string" ? chip.kind : refKind(chip);
      if (kind !== "branch") return [];
      const settings = context !== null && typeof context === "object" ? context : {};
      const item = { id: "push-multi", kind: "pushToMultipleRemotes", labelKey: "action.pushToMultipleRemotes", after: "push-branch" };
      if (settings.busy === true) return [{ ...item, disabled: true, reasonKey: "menu.busy" }];
      if (settings.hasRemotes !== true) return [{ ...item, disabled: true, reasonKey: "menu.noRemotes" }];
      return [item];
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
      if (typeof spec.path === "string" && spec.path !== "") request.path = spec.path;
      return request;
    }

    // ── wave 8: full-history search + branch globs (pure) ─────────────────

    /** Find-bar scope values: the loaded page (default) or the whole history. */
    const FIND_SCOPE_PAGE = "page";
    const FIND_SCOPE_ALL = "all";
    /** Result page size and debounce requested by the wave-8 contract. */
    const SEARCH_LIMIT = 50;
    const SEARCH_DEBOUNCE_MS = 300;

    /** Resting full-history search state: no query has been searched yet. */
    const EMPTY_SEARCH = {
      status: "idle",
      error: "",
      isRepo: true,
      commits: [],
      count: 0,
      offset: 0,
      nextOffset: 0,
      hasMore: false,
      capped: false,
      scanned: 0,
      loadingMore: false,
    };

    /**
     * Which find behavior the current scope/query selects.
     *
     * `page` keeps the original in-page matching (and performs no network call),
     * `search` debounces a full-history `/search` request, `idle` means the query
     * is empty and the whole list stays visible.
     * @param scope - find scope, `page` or `all`.
     * @param query - raw query text.
     * @returns `"page" | "search" | "idle"`.
     */
    function findModeOf(scope, query) {
      if (typeof query !== "string" || query.trim() === "") return "idle";
      return scope === FIND_SCOPE_ALL ? "search" : "page";
    }

    /**
     * Exact `POST /api/dsh-git-graph/search` request body.
     * @param input - `{ sessionId, query, offset?, path? }`.
     * @returns the JSON request body, in the contract's field order.
     */
    function searchRequest(input) {
      const spec = input !== null && typeof input === "object" ? input : {};
      const request = {
        query: typeof spec.query === "string" ? spec.query.trim() : "",
        scope: "all",
        limit: SEARCH_LIMIT,
        offset: Number.isSafeInteger(spec.offset) && spec.offset > 0 ? spec.offset : 0,
        sessionId: spec.sessionId,
      };
      // The repository override is only present when the toolbar selected one,
      // exactly like every other path-taking route.
      if (typeof spec.path === "string" && spec.path !== "") request.path = spec.path;
      return request;
    }

    /**
     * One ref decoration from a search result as the graph's ref string.
     * @param raw - string decoration or `{ type, name }` record.
     * @returns the label the existing classifiers understand.
     */
    function searchRefLabel(raw) {
      if (typeof raw === "string") return raw;
      if (raw === null || typeof raw !== "object") return "";
      const type = typeof raw.type === "string" ? raw.type : "";
      const name = typeof raw.name === "string" && raw.name !== ""
        ? raw.name
        : typeof raw.shortName === "string" ? raw.shortName : "";
      if (name === "") return "";
      const short = name
        .replace(/^refs\/heads\//, "")
        .replace(/^refs\/remotes\//, "")
        .replace(/^refs\/tags\//, "")
        .replace(/^refs\//, "");
      if (type === "tag") return "tag: " + short;
      if (type === "head") return "HEAD -> " + short;
      return short;
    }

    /**
     * One `author`/`committer` timestamp from a search result.
     * @param person - `{ name, email, date }` record.
     * @returns unix seconds, or undefined when absent/unparsable.
     */
    function searchPersonTime(person) {
      const date = person !== null && typeof person === "object" ? person.date : undefined;
      if (Number.isFinite(date)) return date;
      if (typeof date === "string" && date.trim() !== "") {
        const numeric = Number(date);
        if (Number.isFinite(numeric)) return numeric;
        const parsed = Date.parse(date);
        if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
      }
      return undefined;
    }

    /**
     * Normalize one search result commit onto the graph commit shape.
     *
     * The contract returns `{ author, committer, refs: [{ type, name }] }` while the
     * graph's rows consume `authorName`/`authorTime` and plain ref decorations, so
     * the mapping happens once here and every row component stays reused as-is.
     * @param commit - raw search commit.
     * @returns a commit record the existing rows can render.
     */
    function normalizeSearchCommit(commit) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const hash = typeof record.hash === "string" ? record.hash : "";
      const author = record.author !== null && typeof record.author === "object" ? record.author : {};
      const committer = record.committer !== null && typeof record.committer === "object" ? record.committer : {};
      const refs = Array.isArray(record.refs) ? record.refs.map(searchRefLabel).filter((label) => label !== "") : [];
      return {
        hash,
        abbrev: typeof record.abbrev === "string" && record.abbrev !== "" ? record.abbrev : hash.slice(0, 7),
        parents: Array.isArray(record.parents) ? record.parents.filter((parent) => typeof parent === "string" && parent !== "") : [],
        authorName: typeof record.authorName === "string" ? record.authorName : typeof author.name === "string" ? author.name : "",
        authorEmail: typeof record.authorEmail === "string" ? record.authorEmail : typeof author.email === "string" ? author.email : "",
        authorTime: Number.isFinite(record.authorTime) ? record.authorTime : searchPersonTime(author),
        committerName: typeof record.committerName === "string" ? record.committerName : typeof committer.name === "string" ? committer.name : "",
        committerEmail: typeof record.committerEmail === "string" ? record.committerEmail : typeof committer.email === "string" ? committer.email : "",
        committerTime: Number.isFinite(record.committerTime) ? record.committerTime : searchPersonTime(committer),
        subject: typeof record.subject === "string" ? record.subject : "",
        refs,
      };
    }

    /**
     * Normalize a `/search` value.
     * @param value - host response value.
     * @returns `{ isRepo, commits, offset, limit, hasMore, scanned, capped, nextOffset }`.
     */
    function normalizeSearchValue(value) {
      const record = value !== null && typeof value === "object" ? value : {};
      const commits = Array.isArray(record.commits)
        ? record.commits
          .filter((commit) => commit !== null && typeof commit === "object" && typeof commit.hash === "string" && commit.hash !== "")
          .map(normalizeSearchCommit)
        : [];
      const offset = Number.isSafeInteger(record.offset) && record.offset >= 0 ? record.offset : 0;
      return {
        isRepo: record.isRepo !== false,
        commits,
        offset,
        limit: Number.isSafeInteger(record.limit) && record.limit > 0 ? record.limit : SEARCH_LIMIT,
        hasMore: record.hasMore === true,
        scanned: Number.isSafeInteger(record.scanned) && record.scanned >= 0 ? record.scanned : 0,
        capped: record.capped === true,
        nextOffset: offset + commits.length,
      };
    }

    /**
     * The search state for a freshly requested first page.
     * @param value - `/search` value.
     * @returns the component search state.
     */
    function searchStateFrom(value) {
      const page = normalizeSearchValue(value);
      return {
        status: "ready",
        error: "",
        isRepo: page.isRepo,
        commits: page.commits,
        count: page.commits.length,
        offset: page.offset,
        nextOffset: page.nextOffset,
        hasMore: page.hasMore,
        capped: page.capped,
        scanned: page.scanned,
        loadingMore: false,
      };
    }

    /**
     * Append a pagination page to the loaded search results.
     *
     * Duplicate hashes are dropped so a server that re-sends an overlapping page
     * cannot render the same row twice; `nextOffset` always follows the response.
     * @param previous - current search state.
     * @param value - `/search` value of the page just requested.
     * @returns the merged search state.
     */
    function appendSearchPage(previous, value) {
      const page = normalizeSearchValue(value);
      const base = previous !== null && typeof previous === "object" ? previous : {};
      const existing = Array.isArray(base.commits) ? base.commits : [];
      const seen = new Set();
      for (const commit of existing) {
        if (commit !== null && typeof commit === "object" && typeof commit.hash === "string" && commit.hash !== "") seen.add(commit.hash);
      }
      const appended = page.commits.filter((commit) => commit.hash !== "" && !seen.has(commit.hash));
      const commits = existing.concat(appended);
      return {
        status: "ready",
        error: "",
        isRepo: base.isRepo !== false && page.isRepo,
        commits,
        count: commits.length,
        offset: page.offset,
        nextOffset: page.nextOffset,
        hasMore: page.hasMore,
        capped: page.capped === true || base.capped === true,
        scanned: page.scanned,
        loadingMore: false,
      };
    }

    /**
     * Load one `/search` page through the shared JSON helper.
     * @param input - `{ sessionId, query, offset?, path?, signal? }`.
     * @returns the normalized page.
     */
    async function loadSearchPage(input) {
      const spec = input !== null && typeof input === "object" ? input : {};
      const value = await postJson("search", searchRequest(spec), spec.signal);
      return normalizeSearchValue(value);
    }

    /**
     * A trailing-edge debouncer with injectable timers, so the ≥250 ms search
     * debounce is unit-testable without sleeping.
     * @param delayMs - wait after the last call before firing.
     * @param timers - optional `{ setTimeout, clearTimeout }`.
     * @returns `{ schedule, cancel, pending, delay }`.
     */
    function createDebouncer(delayMs, timers) {
      const wait = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : SEARCH_DEBOUNCE_MS;
      const clock = timers !== null && typeof timers === "object" ? timers : null;
      const set = clock !== null && typeof clock.setTimeout === "function" ? clock.setTimeout : setTimeout;
      const clear = clock !== null && typeof clock.clearTimeout === "function" ? clock.clearTimeout : clearTimeout;
      let handle = null;
      return {
        schedule(callback) {
          if (typeof callback !== "function") return;
          if (handle !== null) clear(handle);
          handle = set(() => {
            handle = null;
            callback();
          }, wait);
        },
        cancel() {
          if (handle !== null) clear(handle);
          handle = null;
        },
        pending() {
          return handle !== null;
        },
        delay() {
          return wait;
        },
      };
    }

    /**
     * Compile one branch glob into a matcher.
     *
     * Supports `*` (any run without `/`), `**` (any run, including `/`), `?` (one
     * character that is not `/`), `[abc]`, `[!abc]` and a leading `!` that negates
     * the whole pattern. Invalid patterns report a locale key instead of matching.
     * @param pattern - raw pattern text.
     * @returns `{ ok: true, negated, regex, test }` or `{ ok: false, errorKey }`.
     */
    function compileGlob(pattern) {
      const raw = typeof pattern === "string" ? pattern.trim() : "";
      if (raw === "") return { ok: false, errorKey: "filter.globEmpty" };
      const negated = raw.startsWith("!");
      const body = negated ? raw.slice(1) : raw;
      if (body === "") return { ok: false, errorKey: "filter.globEmpty" };
      let source = "";
      for (let index = 0; index < body.length; index += 1) {
        const character = body[index];
        if (character === "*") {
          if (body[index + 1] === "*") {
            while (body[index + 1] === "*") index += 1;
            source += ".*";
          } else {
            source += "[^/]*";
          }
          continue;
        }
        if (character === "?") {
          source += "[^/]";
          continue;
        }
        if (character === "[") {
          const close = body.indexOf("]", index + 1);
          if (close === -1) return { ok: false, errorKey: "filter.globInvalid" };
          let content = body.slice(index + 1, close);
          if (content.startsWith("!")) content = "^" + content.slice(1);
          source += "[" + content + "]";
          index = close;
          continue;
        }
        source += /[\\^$.*+?()[\]{}|]/.test(character) ? "\\" + character : character;
      }
      let regex;
      try {
        regex = new RegExp("^" + source + "$");
      } catch {
        return { ok: false, errorKey: "filter.globInvalid" };
      }
      return {
        ok: true,
        negated,
        regex,
        test(name) {
          const value = typeof name === "string" ? name : "";
          const matched = regex.test(value);
          return negated ? !matched : matched;
        },
      };
    }

    /**
     * Compile a list of patterns, keeping only the valid ones.
     * @param patterns - raw pattern texts.
     * @returns `{ matchers, errorKey }`; the first failure is reported.
     */
    function compileGlobList(patterns) {
      const list = Array.isArray(patterns) ? patterns : [];
      const matchers = [];
      let errorKey = "";
      for (const pattern of list) {
        const compiled = compileGlob(pattern);
        if (compiled.ok === true) matchers.push(compiled);
        else if (errorKey === "") errorKey = compiled.errorKey;
      }
      return { matchers, errorKey };
    }

    /**
     * Split the glob input into patterns and compile them.
     *
     * Empty input means "no glob" (valid); commas/whitespace separate patterns.
     * Any invalid pattern is reported and, per the contract, never applied.
     * @param text - input text.
     * @returns `{ patterns, matchers, errorKey }`.
     */
    function parseGlobInput(text) {
      const raw = typeof text === "string" ? text.trim() : "";
      if (raw === "") return { patterns: [], matchers: [], errorKey: "" };
      const patterns = raw.split(/[\s,]+/).filter((part) => part !== "");
      if (patterns.length === 0) return { patterns: [], matchers: [], errorKey: "filter.globEmpty" };
      const compiled = compileGlobList(patterns);
      return { patterns, matchers: compiled.matchers, errorKey: compiled.errorKey };
    }

    /**
     * Effect-key sentinel for “a valid glob matched no branch”.
     *
     * The graph effect must not run in that state: the effective branch set is
     * empty, and an omitted `branches` member would mean “all commits”. Putting
     * this sentinel in the effect's dependency key makes the skip explicit and
     * keeps it from looping.
     */
    const NO_MATCH_BRANCH_KEY = "\u0000dgg-no-branch-match";

    /**
     * Effective branch-filter state for the current checkboxes and globs.
     *
     * The result feeds the existing server-side `branches` filter, whose git
     * revision walk is reachability-based, so a commit is included when any
     * effective branch reaches it. Semantics:
     * 1. no valid glob → the checkbox selection only (`null` means every branch);
     * 2. valid glob + no explicit selection → the glob-matched branches only
     *    (a positive filter, not a union with “all”);
     * 3. valid glob + explicit selection → selected ∪ glob-matched, options order;
     * 4. valid glob that yields an empty effective set → `noMatch: true`, and the
     *    graph must not be requested.
     * Invalid patterns are ignored here (they are rejected inline instead).
     * @param selection - selected names, or null for the implicit “all”.
     * @param patterns - raw glob patterns.
     * @param options - options from {@link branchFilterOptions}.
     * @returns `{ union, noMatch }`; `union` is in options order.
     */
    function branchFilterState(selection, patterns, options) {
      const list = Array.isArray(options) ? options : [];
      const names = list
        .map((option) => (option !== null && typeof option === "object" && typeof option.name === "string" ? option.name : ""))
        .filter((name) => name !== "");
      // Branch options are unknown until the first graph page arrives. Without a
      // ref list a glob cannot be evaluated, so keep the request unfiltered and
      // let the next render (once refs exist) decide whether anything matches.
      if (names.length === 0) return { union: [], noMatch: false };
      const { matchers } = compileGlobList(patterns);
      if (matchers.length === 0) {
        const union = Array.isArray(selection) ? names.filter((name) => selection.includes(name)) : names.slice();
        return { union, noMatch: false };
      }
      const matched = names.filter((name) => matchers.some((matcher) => matcher.test(name)));
      if (Array.isArray(selection)) {
        const union = names.filter((name) => selection.includes(name) || matched.includes(name));
        return { union, noMatch: union.length === 0 };
      }
      // The implicit “all” selection is a filter over branch names once a glob
      // is present: only glob-matched branches remain.
      return { union: matched, noMatch: matched.length === 0 };
    }

    /**
     * The effective union of the checkbox selection and the globs.
     * @param selection - selected names, or null for the implicit “all”.
     * @param patterns - raw glob patterns.
     * @param options - options from {@link branchFilterOptions}.
     * @returns the effective branch names in options order.
     */
    function branchFilterUnion(selection, patterns, options) {
      return branchFilterState(selection, patterns, options).union;
    }

    /**
     * Stable dependency key for the graph request.
     *
     * Returns the no-match sentinel when a zero-match glob suppresses the request,
     * `""` when the request omits `branches` (all branches), and the joined branch
     * names otherwise.
     * @param branchRequest - value from {@link branchRequestValue}.
     * @param noMatch - whether {@link branchFilterState} reported `noMatch`.
     * @returns the effect key.
     */
    function branchRequestKey(branchRequest, noMatch) {
      if (noMatch === true) return NO_MATCH_BRANCH_KEY;
      if (!Array.isArray(branchRequest) || branchRequest.length === 0) return "";
      return branchRequest.join("\u0001");
    }

    /**
     * The pre-fill text for the glob input from the graph presentation.
     * @param presentation - normalized presentation value.
     * @returns comma-separated valid patterns, or "" when absent/empty.
     */
    function globPrefillText(presentation) {
      const record = presentation !== null && typeof presentation === "object" ? presentation : {};
      const patterns = Array.isArray(record.customBranchGlobPatterns) ? record.customBranchGlobPatterns : [];
      const valid = [];
      for (const pattern of patterns) {
        // The host sends `[{ name, glob }]`; a plain string is accepted for tests
        // and older shapes. Anything else is dropped.
        const text = typeof pattern === "string"
          ? pattern.trim()
          : pattern !== null && typeof pattern === "object" && typeof pattern.glob === "string" ? pattern.glob.trim() : "";
        if (text !== "" && compileGlob(text).ok === true) valid.push(text);
      }
      return valid.join(", ");
    }

    // ── wave 5: presentation, tooltip, rich text, shortcuts (pure) ─────────

    /** Tooltip delay after the pointer/focus enters a commit row. */
    const TOOLTIP_DELAY_MS = 400;
    /** Maximum cached `contains` answers (one hash each). */
    const CONTAINS_CACHE_LIMIT = 64;
    /** Items of each kind the tooltip lists before collapsing into "+N". */
    const TOOLTIP_ITEM_LIMIT = 6;

    // ── wave 8-C: presentation-driven rendering (pure) ─────────────────────

    /** Date formats the host offers, in its own spelling. */
    const DATE_FORMATS = ["Date & Time", "Date Only", "ISO Date & Time", "ISO Date Only", "Relative"];
    /** Upstream reference-label alignments. */
    const REFERENCE_LABEL_ALIGNMENTS = [
      "Normal",
      "Branches (on the left) & Tags (on the right)",
      "Branches (aligned to the graph) & Tags (on the right)",
    ];
    /** Defensive caps for custom emoji mappings from raw settings. */
    const MAX_CUSTOM_EMOJI_SHORTCODE = 64;
    const MAX_CUSTOM_EMOJI_GLYPH = 32;
    const MAX_CUSTOM_EMOJI_MAPPINGS = 200;

    /** Two-digit zero padding for the ISO date formats. */
    function pad2(value) {
      return String(value).padStart(2, "0");
    }

    /**
     * `YYYY-MM-DD` in local time (the same clock the regular formatter shows).
     * @param seconds - Unix seconds.
     * @returns the ISO date.
     */
    function isoDateText(seconds) {
      const date = new Date(seconds * 1000);
      return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
    }

    /**
     * `YYYY-MM-DD HH:mm` in local time.
     * @param seconds - Unix seconds.
     * @returns the ISO date and time.
     */
    function isoDateTimeText(seconds) {
      const date = new Date(seconds * 1000);
      return isoDateText(seconds) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    }

    /**
     * Locale-aware date without a time part.
     * @param seconds - Unix seconds.
     * @param lang - BCP 47 tag.
     * @returns the formatted date.
     */
    function dateOnlyText(seconds, lang) {
      const date = new Date(seconds * 1000);
      try {
        return new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(date);
      } catch {
        return isoDateText(seconds);
      }
    }

    /**
     * The configured date format, or `""` when the presentation did not carry a
     * recognized value (the pre-wave-8 behavior then applies).
     * @param value - raw `dateFormat`.
     * @returns the format string or "".
     */
    function normalizeDateFormat(value) {
      return typeof value === "string" && DATE_FORMATS.includes(value) ? value : "";
    }

    /** `Author Date` (default) or `Commit Date`. */
    function normalizeDateType(value) {
      return value === "Commit Date" ? "Commit Date" : "Author Date";
    }

    /** One of the three upstream reference-label alignments, default `Normal`. */
    function normalizeReferenceLabelAlignment(value) {
      return typeof value === "string" && REFERENCE_LABEL_ALIGNMENTS.includes(value) ? value : "Normal";
    }

    /**
     * Format one commit timestamp with the configured `dateFormat`.
     *
     * ISO variants are rendered from local-time components (never UTC) so they stay
     * consistent with the locale formatter; `Relative` reuses the existing relative
     * formatter. Returns "" when the format is absent/unrecognized, so callers can
     * keep the legacy presentation.
     * @param seconds - Unix seconds.
     * @param presentation - normalized presentation settings.
     * @param lang - BCP 47 tag.
     * @returns the formatted timestamp, or "".
     */
    function formatCommitDate(seconds, presentation, lang) {
      const settings = presentation !== null && typeof presentation === "object" ? presentation : {};
      const format = normalizeDateFormat(settings.dateFormat);
      if (!Number.isFinite(seconds) || format === "") return "";
      if (format === "Relative") return relativeTime(seconds, lang);
      if (format === "Date Only") return dateOnlyText(seconds, lang);
      if (format === "ISO Date Only") return isoDateText(seconds);
      if (format === "ISO Date & Time") return isoDateTimeText(seconds);
      return absoluteTime(seconds, lang);
    }

    /**
     * Local column visibility from the host's `{ Date, Author, Commit }` object.
     *
     * Invalid or missing entries stay visible, matching the pre-wave-8 defaults.
     * @param presentation - normalized presentation settings.
     * @returns `{ author, date, hash }`.
     */
    function columnsOf(presentation) {
      const record = presentation !== null && typeof presentation === "object" ? presentation : {};
      const raw = record.columnVisibility !== null && typeof record.columnVisibility === "object" && !Array.isArray(record.columnVisibility)
        ? record.columnVisibility
        : {};
      const value = (name) => (typeof raw[name] === "boolean" ? raw[name] : true);
      return { author: value("Author"), date: value("Date"), hash: value("Commit") };
    }

    /**
     * The default file view: `"tree"` for `File Tree`, otherwise `"flat"`.
     * @param presentation - normalized presentation settings.
     * @returns `"tree"` or `"flat"`.
     */
    function fileViewOf(presentation) {
      const record = presentation !== null && typeof presentation === "object" ? presentation : {};
      return record.fileViewType === "tree" ? "tree" : "flat";
    }

    /**
     * Whether single-child directory chains are compacted (default: today's `true`).
     * @param presentation - normalized presentation settings.
     * @returns the effective flag.
     */
    function compactFoldersOf(presentation) {
      const record = presentation !== null && typeof presentation === "object" ? presentation : {};
      return record.compactFolders !== false;
    }

    /**
     * Whether the detail pane scrolls itself into view (default: off).
     * @param presentation - normalized presentation settings.
     * @returns the effective flag.
     */
    function autoCenterDetailsOf(presentation) {
      const record = presentation !== null && typeof presentation === "object" ? presentation : {};
      return record.autoCenterDetails === true;
    }

    /**
     * Reference-label configuration derived from the presentation.
     * @param presentation - normalized presentation settings.
     * @returns `{ alignment, tagsOnRight, alignedToGraph, combine }`.
     */
    function refLabelConfig(presentation) {
      const record = presentation !== null && typeof presentation === "object" ? presentation : {};
      const alignment = normalizeReferenceLabelAlignment(record.referenceLabelAlignment);
      return {
        alignment,
        tagsOnRight: alignment !== "Normal",
        alignedToGraph: alignment === "Branches (aligned to the graph) & Tags (on the right)",
        combine: record.combineLocalAndRemoteBranchLabels === true,
      };
    }

    /**
     * Merge each local branch chip with the remote chip of the same branch.
     *
     * The remote short name is `<remote>/<branch>`; when `<branch>` is the local
     * chip's label the two become one chip labelled `branch (remote/branch)`.
     * @param chips - classified chips, in decoration order.
     * @returns the merged chip list; order of the surviving chips is preserved.
     */
    function combineLocalAndRemoteChips(chips) {
      const list = Array.isArray(chips) ? chips : [];
      const locals = new Map();
      for (const chip of list) {
        if (chip === null || typeof chip !== "object" || chip.kind !== "branch" || typeof chip.label !== "string" || chip.label === "") continue;
        if (!locals.has(chip.label)) locals.set(chip.label, chip.key);
      }
      if (locals.size === 0) return list;
      const remoteKeys = new Map();
      for (const chip of list) {
        if (chip === null || typeof chip !== "object" || chip.kind !== "remote" || typeof chip.label !== "string") continue;
        const slash = chip.label.indexOf("/");
        const branchName = slash === -1 ? "" : chip.label.slice(slash + 1);
        const localKey = branchName === "" ? undefined : locals.get(branchName);
        if (localKey === undefined) continue;
        const remotes = remoteKeys.get(localKey) ?? [];
        remotes.push(chip.label);
        remoteKeys.set(localKey, remotes);
      }
      if (remoteKeys.size === 0) return list;
      const merged = [];
      for (const chip of list) {
        if (chip !== null && typeof chip === "object" && chip.kind === "remote") {
          const slash = chip.label.indexOf("/");
          const branchName = slash === -1 ? "" : chip.label.slice(slash + 1);
          if (branchName !== "" && locals.has(branchName)) continue; // folded into its local chip
        }
        if (chip !== null && typeof chip === "object" && remoteKeys.has(chip.key)) {
          const remotes = remoteKeys.get(chip.key);
          merged.push({ ...chip, label: chip.label + " (" + remotes.join(", ") + ")", combined: remotes.slice() });
          continue;
        }
        merged.push(chip);
      }
      return merged;
    }

    /**
     * Chips for one commit with the presentation's combination and alignment.
     *
     * `Normal` keeps the host decoration order. Both aligned modes order branches
     * (and remotes/stashes) before tags so the renderer can push the tag cluster to
     * the right; the graph-aligned mode is reported separately for its inset.
     * @param rawRefs - decorations from the graph value.
     * @param refIndex - host ref index.
     * @param limit - maximum chips to show.
     * @param presentation - normalized presentation settings.
     * @returns `{ chips, tagsOnRight, alignedToGraph }`.
     */
    function layoutRefChips(rawRefs, refIndex, limit, presentation) {
      const config = refLabelConfig(presentation);
      const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : MAX_ROW_CHIPS;
      // Combine before applying the chip cap, so folding a remote into its local
      // chip does not waste one of the visible slots.
      const classified = classifyRefs(rawRefs, refIndex, Number.MAX_SAFE_INTEGER);
      const combined = config.combine ? combineLocalAndRemoteChips(classified) : classified;
      const chips = combined.slice(0, max);
      if (!config.tagsOnRight) return { chips, tagsOnRight: false, alignedToGraph: false };
      const branches = chips.filter((chip) => chip.kind !== "tag");
      const tags = chips.filter((chip) => chip.kind === "tag");
      return { chips: branches.concat(tags), tagsOnRight: true, alignedToGraph: config.alignedToGraph };
    }

    /**
     * Hashes of the loaded commits that are not reachable from HEAD through the
     * parents present in the loaded page.
     *
     * Used only to de-emphasize rows (`muteNonAncestors`), never to filter them. An
     * empty/unresolvable HEAD mutes nothing: there is no reference point.
     * @param commits - commits of the loaded page.
     * @param headHash - HEAD commit hash.
     * @returns a Set of muted hashes.
     */
    function nonAncestorHashes(commits, headHash) {
      const list = Array.isArray(commits) ? commits : [];
      const head = typeof headHash === "string" ? headHash : "";
      const byHash = new Map();
      for (const commit of list) {
        if (commit === null || typeof commit !== "object" || typeof commit.hash !== "string" || commit.hash === "") continue;
        if (!byHash.has(commit.hash)) byHash.set(commit.hash, commit);
      }
      const muted = new Set();
      if (head === "" || !byHash.has(head)) return muted;
      const reachable = new Set([head]);
      const queue = [head];
      while (queue.length > 0) {
        const hash = queue.pop();
        const commit = byHash.get(hash);
        const parents = Array.isArray(commit.parents) ? commit.parents : [];
        for (const parent of parents) {
          if (typeof parent !== "string" || parent === "" || !byHash.has(parent) || reachable.has(parent)) continue;
          reachable.add(parent);
          queue.push(parent);
        }
      }
      for (const hash of byHash.keys()) {
        if (!reachable.has(hash)) muted.add(hash);
      }
      return muted;
    }

    /**
     * Sanitize custom emoji mappings from the presentation.
     *
     * The host sends an array of `{ shortcode, emoji }` (settings module shape); an
     * object map `{ shortcode: glyph }` is accepted too. Non-string, empty and
     * oversized entries are dropped; later entries win.
     * @param raw - raw `emojiMappings`.
     * @returns `{ shortcode: glyph }` with sanitized names.
     */
    function sanitizeEmojiMappings(raw) {
      const mappings = {};
      const add = (shortcode, glyph) => {
        if (typeof shortcode !== "string" || typeof glyph !== "string") return;
        const key = shortcode.trim().replace(/^:+|:+$/g, "");
        const value = glyph.trim();
        if (key === "" || value === "" || key.length > MAX_CUSTOM_EMOJI_SHORTCODE || value.length > MAX_CUSTOM_EMOJI_GLYPH) return;
        if (!Object.prototype.hasOwnProperty.call(mappings, key) && Object.keys(mappings).length >= MAX_CUSTOM_EMOJI_MAPPINGS) return;
        mappings[key] = value;
      };
      if (Array.isArray(raw)) {
        for (const entry of raw) {
          if (entry === null || typeof entry !== "object") continue;
          add(entry.shortcode, typeof entry.emoji === "string" ? entry.emoji : entry.glyph);
        }
      } else if (raw !== null && typeof raw === "object") {
        for (const [shortcode, glyph] of Object.entries(raw)) add(shortcode, glyph);
      }
      return mappings;
    }

    /**
     * Built-in emoji shortcodes merged with the presentation's custom mappings
     * (custom entries win).
     * @param presentation - normalized presentation settings.
     * @returns `{ shortcode: glyph }`.
     */
    function emojiTable(presentation) {
      const record = presentation !== null && typeof presentation === "object" ? presentation : {};
      const custom = sanitizeEmojiMappings(record.emojiMappings);
      const table = { ...EMOJI_SHORTCODES };
      for (const [shortcode, glyph] of Object.entries(custom)) {
        if (typeof shortcode === "string" && shortcode !== "" && typeof glyph === "string" && glyph !== "") table[shortcode] = glyph;
      }
      return table;
    }

    /**
     * Scroll the detail pane into view when `autoCenterDetails` is enabled.
     * @param node - mounted detail root (or null).
     * @param enabled - effective flag.
     * @returns true when a scroll was requested.
     */
    function scrollDetailIntoView(node, enabled) {
      if (enabled !== true) return false;
      if (node === null || typeof node !== "object" || typeof node.scrollIntoView !== "function") return false;
      node.scrollIntoView({ block: "nearest" });
      return true;
    }

    /** Repository dropdown order values; anything else keeps today's order. */
    const REPOSITORY_DROPDOWN_ORDERS = ["Full Path", "Name", "Workspace Full Path"];

    /** Client-side cap for the configured page sizes (host max is the same 2000). */
    const PAGE_SIZE_MAX = 2000;

    /**
     * Clamp a configured `initialLoad` / `loadMore` value.
     * @param value - raw number from the presentation.
     * @returns a positive integer ≤2000, or 0 when absent/malformed.
     */
    function normalizePageSize(value) {
      if (!Number.isSafeInteger(value) || value < 1) return 0;
      return Math.min(value, PAGE_SIZE_MAX);
    }

    /**
     * Effective pagination for the graph list.
     *
     * Configured sizes win when valid (clamped to 1–2000); otherwise today's PAGE_SIZE
     * is the initial request and the load-more step.
     * @param presentation - normalized presentation settings.
     * @returns `{ initial, step, auto }`.
     */
    function paginationOf(presentation) {
      const record = presentation !== null && typeof presentation === "object" ? presentation : {};
      const initialLoad = normalizePageSize(record.initialLoad);
      const loadMore = normalizePageSize(record.loadMore);
      return {
        initial: initialLoad > 0 ? initialLoad : PAGE_SIZE,
        step: loadMore > 0 ? loadMore : PAGE_SIZE,
        auto: record.loadMoreAutomatically === true,
      };
    }

    /**
     * Sanitize the nine `dialogDefaults` entries.
     *
     * Only the known groups/keys are kept; booleans must be real booleans and reset
     * modes are normalized to the dialog's lowercase values (`soft`/`mixed`/`hard`).
     * Unknown or malformed entries are dropped, so today's hardcoded defaults apply.
     * @param raw - raw `dialogDefaults`.
     * @returns `{ group: { key: boolean | mode } }`.
     */
    function sanitizeDialogDefaults(raw) {
      const source = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      const result = {};
      const group = (name) => (source[name] !== null && typeof source[name] === "object" && !Array.isArray(source[name]) ? source[name] : {});
      const booleans = (name, keys) => {
        const rawGroup = group(name);
        const out = {};
        for (const key of keys) {
          if (typeof rawGroup[key] === "boolean") out[key] = rawGroup[key];
        }
        return out;
      };
      const add = (name, values) => {
        if (Object.keys(values).length > 0) result[name] = values;
      };
      add("applyStash", booleans("applyStash", ["reinstateIndex"]));
      add("popStash", booleans("popStash", ["reinstateIndex"]));
      add("merge", booleans("merge", ["noCommit", "noFastForward", "squashCommits"]));
      add("pullBranch", booleans("pullBranch", ["noFastForward"]));
      add("stashUncommittedChanges", booleans("stashUncommittedChanges", ["includeUntracked"]));
      const resetCommitMode = group("resetCurrentBranchToCommit").mode;
      if (resetCommitMode === "Soft" || resetCommitMode === "Mixed" || resetCommitMode === "Hard") {
        result.resetCurrentBranchToCommit = { mode: resetCommitMode.toLowerCase() };
      }
      const resetUncommittedMode = group("resetUncommittedChanges").mode;
      if (resetUncommittedMode === "Mixed" || resetUncommittedMode === "Hard") {
        result.resetUncommittedChanges = { mode: resetUncommittedMode.toLowerCase() };
      }
      return result;
    }

    /**
     * Sanitize `contextMenuVisibility` to two levels of booleans.
     *
     * Action ids are free-form (upstream camelCase); unknown ids are harmless and are
     * ignored at match time. Non-boolean leaves and non-object groups are dropped.
     * @param raw - raw `contextMenuVisibility`.
     * @returns `{ group: { actionId: boolean } }`.
     */
    function sanitizeContextMenuVisibility(raw) {
      const result = {};
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return result;
      for (const [group, actions] of Object.entries(raw)) {
        if (actions === null || typeof actions !== "object" || Array.isArray(actions)) continue;
        const kept = {};
        for (const [action, visible] of Object.entries(actions)) {
          if (typeof action !== "string" || action === "" || typeof visible !== "boolean") continue;
          kept[action] = visible;
        }
        if (Object.keys(kept).length > 0) result[group] = kept;
      }
      return result;
    }

    /**
     * Normalize one context-menu action id for comparison.
     * @param value - id or kind, e.g. `cherry-pick`, `cherryPick`.
     * @returns lowercase letters only.
     */
    function normalizeMenuId(value) {
      return typeof value === "string" ? value.replace(/[^A-Za-z]/g, "").toLowerCase() : "";
    }

    /**
     * Action ids hidden by `contextMenuVisibility` (false in any group).
     * @param visibility - sanitized context-menu visibility.
     * @returns a Set of normalized ids.
     */
    function hiddenMenuIds(visibility) {
      const hidden = new Set();
      if (visibility === null || typeof visibility !== "object" || Array.isArray(visibility)) return hidden;
      for (const actions of Object.values(visibility)) {
        if (actions === null || typeof actions !== "object" || Array.isArray(actions)) continue;
        for (const [action, visible] of Object.entries(actions)) {
          if (visible === false) {
            const id = normalizeMenuId(action);
            if (id !== "") hidden.add(id);
          }
        }
      }
      return hidden;
    }

    /**
     * Guardrail-critical menu actions that are never hidden by context-menu
     * visibility: their destructive/force/clean confirmations must stay reachable.
     */
    const CONTEXT_MENU_GUARDRAIL_KINDS = new Set([
      "deleteBranch", "deleteTag", "deleteRemote", "cleanUntracked", "resetUncommitted",
      "dropCommit", "resetToCommit", "forceDeleteBranch",
    ]);

    /**
     * Filter a context menu by `contextMenuVisibility`.
     *
     * An item is hidden when its kind or id (letters lowercased) is named `false` in
     * any group; unknown ids never match. The guardrail-critical kinds above are never
     * hidden. If filtering would remove every entry the unfiltered list is returned,
     * so a menu can never become unusable.
     * @param items - menu items `[{ id, kind, ... }]`.
     * @param visibility - sanitized context-menu visibility.
     * @returns the visible items (or the original list when that would be empty).
     */
    function visibleMenuItems(items, visibility) {
      const list = Array.isArray(items) ? items : [];
      const hidden = hiddenMenuIds(visibility);
      if (hidden.size === 0 || list.length === 0) return list;
      const visible = list.filter((item) => {
        if (item === null || typeof item !== "object") return true;
        if (CONTEXT_MENU_GUARDRAIL_KINDS.has(item.kind)) return true;
        const ids = [normalizeMenuId(item.kind), normalizeMenuId(item.id)].filter((id) => id !== "");
        return !ids.some((id) => hidden.has(id));
      });
      return visible.length > 0 ? visible : list;
    }

    /**
     * Stable repository ordering for the toolbar dropdown.
     *
     * `Full Path` sorts by path; `Name` by name then path; `Workspace Full Path`
     * puts the current/workspace repository first, then by path (the payload has no
     * workspace-folder index, so the current repo stands in for it). An absent or
     * malformed order returns today's host order unchanged.
     * @param repos - normalized repository records `[{ path, name, isCurrent }]`.
     * @param order - `repositoryDropdownOrder` value.
     * @returns a new ordered array (the input is not mutated).
     */
    function orderedRepositories(repos, order) {
      const list = Array.isArray(repos) ? repos.slice() : [];
      if (order === "Full Path") {
        return list.sort((left, right) => String(left.path).localeCompare(String(right.path)));
      }
      if (order === "Name") {
        return list.sort((left, right) => (left.name !== right.name ? String(left.name).localeCompare(String(right.name)) : String(left.path).localeCompare(String(right.path))));
      }
      if (order === "Workspace Full Path") {
        return list.sort((left, right) => {
          if (left.isCurrent !== right.isCurrent) return left.isCurrent === true ? -1 : 1;
          return String(left.path).localeCompare(String(right.path));
        });
      }
      return list;
    }

    /**
     * Whether the list should request the next page automatically.
     *
     * True only when enabled and another page exists, and the scroller is within the
     * threshold of its bottom. Degenerate sizes (no visible height) never trigger.
     * @param scrollTop - scroller offset.
     * @param scrollHeight - total content height.
     * @param clientHeight - visible height.
     * @param hasMore - whether another page is available.
     * @param enabled - `presentation.loadMoreAutomatically`.
     * @returns true when a load-more request should start.
     */
    function shouldAutoLoad(scrollTop, scrollHeight, clientHeight, hasMore, enabled) {
      if (enabled !== true || hasMore !== true) return false;
      const top = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
      const height = Number.isFinite(scrollHeight) ? Math.max(0, scrollHeight) : 0;
      const view = Number.isFinite(clientHeight) ? Math.max(0, clientHeight) : 0;
      if (view <= 0) return false;
      return top + view >= height - AUTO_LOAD_THRESHOLD_PX;
    }

    /** Distance from the bottom that still triggers an automatic load-more. */
    const AUTO_LOAD_THRESHOLD_PX = 120;

    /**
     * Normalize the graph value's `presentation` object.
     *
     * Defensive because the host config is raw: unknown styles fall back to
     * `rounded`, invalid colours are dropped and a template without `{id}` is
     * disabled outright (never linkify from a malformed template). Wave 8-B adds
     * the normalized shortcut descriptors and the opt-in global-scope switch;
     * wave 8-C adds the date/column/file-view/ref-label/mute/emoji settings. A
     * missing or malformed value keeps the pre-wave-8 behavior.
     * @param value - graph value.
     * @returns the normalized presentation settings.
     */
    function presentationOf(value) {
      const raw = value !== null && typeof value === "object" && value.presentation !== null && typeof value.presentation === "object"
        ? value.presentation : {};
      const colours = Array.isArray(raw.graphColours)
        ? raw.graphColours.filter((colour) => typeof colour === "string" && colour.trim() !== "")
        : [];
      // The host sends `[{ name, glob }]`; plain strings are accepted too. The client
      // only needs the glob text (pre-fill of the branch-filter input).
      const globPatterns = Array.isArray(raw.customBranchGlobPatterns)
        ? raw.customBranchGlobPatterns
            .map((pattern) => (typeof pattern === "string"
              ? pattern.trim()
              : pattern !== null && typeof pattern === "object" && typeof pattern.glob === "string" ? pattern.glob.trim() : ""))
            .filter((pattern) => pattern !== "")
        : [];
      const rawColumns = raw.columnVisibility !== null && typeof raw.columnVisibility === "object" && !Array.isArray(raw.columnVisibility)
        ? raw.columnVisibility
        : {};
      const columnVisibility = {
        Date: typeof rawColumns.Date === "boolean" ? rawColumns.Date : true,
        Author: typeof rawColumns.Author === "boolean" ? rawColumns.Author : true,
        Commit: typeof rawColumns.Commit === "boolean" ? rawColumns.Commit : true,
      };
      const fileViewType = raw.fileViewType === "File Tree" ? "tree" : raw.fileViewType === "File List" ? "flat" : "";
      return {
        graphStyle: raw.graphStyle === "angular" ? "angular" : "rounded",
        graphColours: colours,
        showSignature: raw.showSignature === true,
        showEmoji: raw.showEmoji !== false,
        issueUrlTemplate: typeof raw.issueUrlTemplate === "string" && raw.issueUrlTemplate.includes("{id}") ? raw.issueUrlTemplate : "",
        customBranchGlobPatterns: globPatterns,
        shortcuts: shortcutsOf(raw),
        globalShortcuts: raw.globalShortcuts === true,
        dateType: normalizeDateType(raw.dateType),
        dateFormat: normalizeDateFormat(raw.dateFormat),
        columnVisibility,
        fileViewType,
        compactFolders: raw.compactFolders !== false,
        autoCenterDetails: raw.autoCenterDetails === true,
        referenceLabelAlignment: normalizeReferenceLabelAlignment(raw.referenceLabelAlignment),
        combineLocalAndRemoteBranchLabels: raw.combineLocalAndRemoteBranchLabels === true,
        muteMergeCommits: raw.muteMergeCommits === true,
        muteNonAncestors: raw.muteNonAncestors === true,
        emojiMappings: sanitizeEmojiMappings(raw.emojiMappings),
        markdown: raw.markdown === true,
        enhancedAccessibility: raw.enhancedAccessibility === true,
        repositoryDropdownOrder: REPOSITORY_DROPDOWN_ORDERS.includes(raw.repositoryDropdownOrder) ? raw.repositoryDropdownOrder : "",
        initialLoad: normalizePageSize(raw.initialLoad),
        loadMore: normalizePageSize(raw.loadMore),
        loadMoreAutomatically: raw.loadMoreAutomatically === true,
        dialogDefaults: sanitizeDialogDefaults(raw.dialogDefaults),
        contextMenuVisibility: sanitizeContextMenuVisibility(raw.contextMenuVisibility),
      };
    }

    /** Built-in shortcode map; anything else stays literal. */
    const EMOJI_SHORTCODES = {
      smile: "\u{1F604}",
      tada: "\u{1F389}",
      bug: "\u{1F41B}",
      rocket: "\u{1F680}",
      sparkles: "\u{2728}",
      fire: "\u{1F525}",
      heart: "\u{2764}\u{FE0F}",
      thumbsup: "\u{1F44D}",
      warning: "\u{26A0}\u{FE0F}",
      white_check_mark: "\u{2705}",
    };

    /**
     * Split a subject or body into renderable parts: plain text, emoji glyphs and
     * issue links. Never returns markup — the component renders React text nodes.
     * @param text - source string.
     * @param presentation - normalized presentation settings.
     * @returns `[{ type: "text"|"emoji"|"issue", text, shortcode?, id?, href? }]`.
     */
    function richTextParts(text, presentation) {
      const source = typeof text === "string" ? text : "";
      if (source === "") return [];
      const settings = presentation !== null && typeof presentation === "object" ? presentation : {};
      const showEmoji = settings.showEmoji !== false;
      const markdown = settings.markdown === true;
      const template = typeof settings.issueUrlTemplate === "string" && settings.issueUrlTemplate.includes("{id}") ? settings.issueUrlTemplate : "";
      if (!showEmoji && template === "" && !markdown) return [{ type: "text", text: source }];
      const emoji = showEmoji ? emojiTable(settings) : {};

      /**
       * Scan one run of text. Markup is only recognized at the top level: the inside
       * of an emphasis run still gets emoji and issue-link treatment (so they compose)
       * but not nested emphasis, which keeps unmatched markers literal.
       */
      const scan = (input, allowMarkup) => {
        const parts = [];
        let buffer = "";
        let index = 0;
        const flush = () => {
          if (buffer !== "") {
            parts.push({ type: "text", text: buffer });
            buffer = "";
          }
        };
        while (index < input.length) {
          const character = input[index];
          if (allowMarkup && character === "`") {
            const close = input.indexOf("`", index + 1);
            if (close > index + 1) {
              flush();
              parts.push({ type: "code", text: input.slice(index + 1, close) });
              index = close + 1;
              continue;
            }
          }
          if (allowMarkup && input.startsWith("***", index)) {
            const close = input.indexOf("***", index + 3);
            if (close > index + 3) {
              flush();
              parts.push({ type: "boldItalic", parts: scan(input.slice(index + 3, close), false) });
              index = close + 3;
              continue;
            }
            // Unmatched run stays literal as a whole (never reinterpreted as italic).
            buffer += "***";
            index += 3;
            continue;
          }
          if (allowMarkup && input.startsWith("**", index)) {
            const close = input.indexOf("**", index + 2);
            if (close > index + 2) {
              flush();
              parts.push({ type: "bold", parts: scan(input.slice(index + 2, close), false) });
              index = close + 2;
              continue;
            }
            buffer += "**";
            index += 2;
            continue;
          }
          if (allowMarkup && (character === "*" || character === "_")) {
            const close = input.indexOf(character, index + 1);
            if (close > index + 1) {
              flush();
              parts.push({ type: "italic", parts: scan(input.slice(index + 1, close), false) });
              index = close + 1;
              continue;
            }
            buffer += character;
            index += 1;
            continue;
          }
          if (showEmoji && character === ":") {
            const end = input.indexOf(":", index + 1);
            if (end !== -1) {
              const name = input.slice(index + 1, end);
              if (Object.prototype.hasOwnProperty.call(emoji, name)) {
                flush();
                parts.push({ type: "emoji", text: emoji[name], shortcode: ":" + name + ":" });
                index = end + 1;
                continue;
              }
            }
          }
          if (template !== "" && character === "#") {
            let end = index + 1;
            while (end < input.length && input[end] >= "0" && input[end] <= "9") end += 1;
            const digits = input.slice(index + 1, end);
            if (digits !== "") {
              flush();
              parts.push({ type: "issue", text: "#" + digits, id: digits, href: template.replace("{id}", digits) });
              index = end;
              continue;
            }
          }
          buffer += character;
          index += 1;
        }
        flush();
        return parts;
      };
      return scan(source, markdown);
    }

    /**
     * Badge for one commit signature.
     * @param signature - `{ status, signer, keyId }` from the commit route.
     * @returns `{ status, labelKey, tone, signer }` or null when nothing should render.
     */
    function signatureBadge(signature) {
      const record = signature !== null && typeof signature === "object" ? signature : null;
      if (record === null) return null;
      const status = typeof record.status === "string" ? record.status.toUpperCase() : "";
      const labels = {
        G: { labelKey: "detail.signatureVerified", tone: "good" },
        B: { labelKey: "detail.signatureBad", tone: "bad" },
        U: { labelKey: "detail.signatureUnknown", tone: "warn" },
        X: { labelKey: "detail.signatureExpired", tone: "warn" },
        Y: { labelKey: "detail.signatureExpired", tone: "warn" },
        R: { labelKey: "detail.signatureRevoked", tone: "bad" },
      };
      const label = Object.prototype.hasOwnProperty.call(labels, status) ? labels[status] : null;
      if (label === null) return null;
      return {
        status,
        labelKey: label.labelKey,
        tone: label.tone,
        signer: typeof record.signer === "string" ? record.signer : "",
      };
    }

    /**
     * Collapse a `contains` value into what the tooltip shows.
     * @param data - `contains` route value.
     * @param limit - items per kind before the "+N" overflow.
     * @returns `{ inHead, branches, tags, stashes, hidden }`.
     */
    function containsSummary(data, limit) {
      const record = data !== null && typeof data === "object" ? data : {};
      const cap = Number.isSafeInteger(limit) && limit > 0 ? limit : TOOLTIP_ITEM_LIMIT;
      const branches = Array.isArray(record.branches)
        ? record.branches
            .filter((branch) => branch !== null && typeof branch === "object" && typeof branch.name === "string" && branch.name !== "")
            .map((branch) => ({ name: branch.name, isHead: branch.isHead === true }))
        : [];
      const tags = Array.isArray(record.tags) ? record.tags.filter((tag) => typeof tag === "string" && tag !== "") : [];
      const stashes = Array.isArray(record.stashes)
        ? record.stashes
            .filter((stash) => stash !== null && typeof stash === "object")
            .map((stash) => ({ index: Number.isSafeInteger(stash.index) ? stash.index : 0, shortName: typeof stash.shortName === "string" ? stash.shortName : "" }))
        : [];
      const shownBranches = branches.slice(0, cap);
      const shownTags = tags.slice(0, cap);
      const shownStashes = stashes.slice(0, cap);
      const hidden = (branches.length - shownBranches.length) + (tags.length - shownTags.length) + (stashes.length - shownStashes.length);
      return { inHead: record.inHead === true, branches: shownBranches, tags: shownTags, stashes: shownStashes, hidden };
    }

    /**
     * Clamp the tooltip rectangle near the pointer/row.
     * @param point - `{ x, y }` anchor.
     * @param size - `{ width, height }` estimate.
     * @param viewport - `{ width, height }` of the window.
     * @returns `{ left, top }` for the fixed-position tooltip.
     */
    function tooltipPosition(point, size, viewport) {
      const margin = 6;
      const finite = (value, fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
      const x = finite(point !== null && typeof point === "object" ? point.x : undefined, 0);
      const y = finite(point !== null && typeof point === "object" ? point.y : undefined, 0);
      const width = finite(size !== null && typeof size === "object" ? size.width : undefined, 0);
      const height = finite(size !== null && typeof size === "object" ? size.height : undefined, 0);
      const viewWidth = finite(viewport !== null && typeof viewport === "object" ? viewport.width : undefined, 0);
      const viewHeight = finite(viewport !== null && typeof viewport === "object" ? viewport.height : undefined, 0);
      let left = Math.max(margin, x + 14);
      let top = Math.max(margin, y + 18);
      if (viewWidth > 0 && width > 0 && left + width + margin > viewWidth) left = Math.max(margin, viewWidth - width - margin);
      if (viewHeight > 0 && height > 0 && top + height + margin > viewHeight) top = Math.max(margin, viewHeight - height - margin);
      return { left, top };
    }

    /**
     * Small insertion-ordered LRU map.
     * @param limit - maximum entries.
     * @returns `{ get, set, has, delete, clear, size, limit }`.
     */
    function createLruCache(limit) {
      const max = Number.isSafeInteger(limit) && limit > 0 ? limit : CONTAINS_CACHE_LIMIT;
      const entries = new Map();
      return {
        limit: () => max,
        size: () => entries.size,
        has: (key) => entries.has(key),
        get(key) {
          if (!entries.has(key)) return undefined;
          const value = entries.get(key);
          entries.delete(key);
          entries.set(key, value);
          return value;
        },
        set(key, value) {
          if (entries.has(key)) entries.delete(key);
          entries.set(key, value);
          while (entries.size > max) {
            const oldest = entries.keys().next();
            if (oldest.done === true) break;
            entries.delete(oldest.value);
          }
          return value;
        },
        delete: (key) => entries.delete(key),
        clear: () => entries.clear(),
      };
    }

    /**
     * Whether a DOM target is a text-entry control (shortcuts must not fire there).
     * @param target - event target.
     * @returns true for input/textarea/select/contenteditable.
     */
    function isTypingTarget(target) {
      if (target === null || typeof target !== "object") return false;
      const tag = typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true;
    }

    /**
     * Today's hardcoded tab shortcuts, used whenever the presentation does not
     * carry a usable `shortcuts` object (the pre-wave-8 host).
     *
     * `ctrl`+`meta` together mean “either platform modifier”, matching the old
     * Ctrl/Cmd behaviour on both platforms.
     */
    const DEFAULT_SHORTCUTS = {
      find: { key: "f", ctrl: true, meta: true, alt: false, shift: false },
      refresh: { key: "r", ctrl: true, meta: true, alt: false, shift: false },
      scrollToHead: { key: "h", ctrl: true, meta: true, alt: false, shift: false },
      scrollToStash: { key: "s", ctrl: true, meta: true, alt: false, shift: false },
    };

    /** The four configurable shortcuts and the action each one triggers. */
    const SHORTCUT_BINDINGS = [
      { name: "find", action: "find" },
      { name: "refresh", action: "refresh" },
      { name: "scrollToHead", action: "head" },
      { name: "scrollToStash", action: "stash-next" },
    ];

    /** An explicitly unassigned shortcut: `key: ""` never matches a key event. */
    const UNASSIGNED_SHORTCUT = { key: "", ctrl: false, meta: false, alt: false, shift: false };

    /**
     * Normalize one shortcut descriptor.
     *
     * A descriptor is usable when it is an object with a string `key` (an empty
     * string is a deliberate UNASSIGNED binding and is preserved). Anything else
     * falls back to the supplied default, so malformed presentation data can never
     * disable a shortcut silently.
     * @param value - raw descriptor from the presentation.
     * @param fallback - default descriptor for this action.
     * @returns a normalized `{ key, ctrl, meta, alt, shift }` descriptor.
     */
    function normalizeShortcut(value, fallback) {
      const usable = value !== null && typeof value === "object" && typeof value.key === "string";
      const source = usable ? value : fallback !== null && typeof fallback === "object" ? fallback : UNASSIGNED_SHORTCUT;
      return {
        key: typeof source.key === "string" ? source.key : "",
        ctrl: source.ctrl === true,
        meta: source.meta === true,
        alt: source.alt === true,
        shift: source.shift === true,
      };
    }

    /**
     * Resolve the four configurable shortcuts from the raw presentation object.
     *
     * Missing or malformed entries fall back to {@link DEFAULT_SHORTCUTS}. The
     * previous-stash shortcut is derived from `scrollToStash` by forcing Shift, so
     * remapping (or unassigning) one remaps both directions.
     * @param presentation - raw `presentation` object from the graph value.
     * @returns `{ find, refresh, scrollToHead, scrollToStash, stashPrevious }`.
     */
    function shortcutsOf(presentation) {
      const raw = presentation !== null && typeof presentation === "object" && presentation.shortcuts !== null && typeof presentation.shortcuts === "object"
        ? presentation.shortcuts
        : null;
      const resolved = {};
      for (const binding of SHORTCUT_BINDINGS) {
        const fallback = DEFAULT_SHORTCUTS[binding.name];
        resolved[binding.name] = normalizeShortcut(raw === null ? undefined : raw[binding.name], fallback);
      }
      resolved.stashPrevious = { ...resolved.scrollToStash, shift: true };
      return resolved;
    }

    /**
     * Whether one key event matches a shortcut descriptor.
     *
     * Rules (wave 8-B): the event key is compared case-insensitively; a
     * descriptor with both `ctrl` and `meta` accepts either platform modifier, a
     * descriptor with only one requires exactly that one and the other must be
     * released; `alt`/`shift` must match exactly; `key: ""` (UNASSIGNED) never
     * matches.
     * @param shortcut - normalized descriptor.
     * @param event - keydown event.
     * @returns true when the event requests that shortcut.
     */
    function matchShortcut(shortcut, event) {
      if (shortcut === null || typeof shortcut !== "object" || event === null || typeof event !== "object") return false;
      const key = typeof shortcut.key === "string" ? shortcut.key : "";
      if (key === "") return false;
      const eventKey = typeof event.key === "string" ? event.key.toLowerCase() : "";
      if (eventKey === "" || eventKey !== key.toLowerCase()) return false;
      const wantCtrl = shortcut.ctrl === true;
      const wantMeta = shortcut.meta === true;
      const ctrl = event.ctrlKey === true;
      const meta = event.metaKey === true;
      if (wantCtrl && wantMeta) {
        if (!ctrl && !meta) return false;
      } else if (wantCtrl) {
        if (!ctrl || meta) return false;
      } else if (wantMeta) {
        if (!meta || ctrl) return false;
      } else if (ctrl || meta) {
        return false;
      }
      if ((shortcut.alt === true) !== (event.altKey === true)) return false;
      if ((shortcut.shift === true) !== (event.shiftKey === true)) return false;
      return true;
    }

    /**
     * The tab-scoped shortcut one key event requests.
     *
     * These are handled by the tab root's own keydown listener because the right
     * sidebar has no per-tab shortcut scope: registering them globally would steal
     * Ctrl/Cmd+R and Ctrl/Cmd+F from the whole application. The bindings come from
     * `presentation.shortcuts` when the host sends them, falling back to today's
     * Ctrl/Cmd+H (HEAD), R (refresh), F (find), S (next stash commit) and
     * Ctrl/Cmd+Shift+S (previous stash commit). Arrow navigation in the detail
     * view is handled separately as plain navigation keys.
     * @param event - keydown event.
     * @param target - event target (to ignore typing).
     * @param shortcuts - resolved shortcuts from {@link shortcutsOf}.
     * @returns "head" | "refresh" | "find" | "stash-next" | "stash-prev" | null.
     */
    function shortcutFor(event, target, shortcuts) {
      if (event === null || typeof event !== "object") return null;
      if (isTypingTarget(target)) return null;
      const bindings = shortcuts !== null && typeof shortcuts === "object" ? shortcuts : shortcutsOf(null);
      if (matchShortcut(bindings.stashPrevious, event)) return "stash-prev";
      for (const binding of SHORTCUT_BINDINGS) {
        if (matchShortcut(bindings[binding.name], event)) return binding.action;
      }
      return null;
    }

    /**
     * The hash Ctrl/Cmd+Down opens: the first parent, or with Shift the next
     * parent at a merge commit.
     * @param commit - open commit detail record.
     * @param shift - whether Shift is held.
     * @returns the parent hash, or "".
     */
    function parentHash(commit, shift) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const parents = Array.isArray(record.parents) ? record.parents.filter((parent) => typeof parent === "string" && parent !== "") : [];
      if (parents.length === 0) return "";
      if (shift === true && parents.length > 1) return parents[1];
      return parents[0];
    }

    /**
     * The hash Ctrl/Cmd+Up opens: the first child in graph order.
     *
     * “Same branch” is approximated by preferring a child whose first parent is
     * the open commit (a first-parent child continues the branch; later parents are
     * merges). With Shift the next child in graph order is opened instead, so a
     * merge's second child stays reachable.
     * @param commits - commits of the loaded page, newest first.
     * @param hash - open commit hash.
     * @param shift - whether Shift is held.
     * @returns the child hash, or "".
     */
    function childHash(commits, hash, shift) {
      const needle = typeof hash === "string" ? hash : "";
      if (needle === "") return "";
      const list = Array.isArray(commits) ? commits : [];
      const children = list.filter((commit) => {
        if (commit === null || typeof commit !== "object" || !Array.isArray(commit.parents)) return false;
        return typeof commit.hash === "string" && commit.hash !== "" && commit.hash !== needle && commit.parents.includes(needle);
      });
      if (children.length === 0) return "";
      const firstParent = children.find((commit) => commit.parents[0] === needle);
      const preferred = firstParent !== undefined ? firstParent : children[0];
      const chosen = shift === true && children.length > 1 ? children[1] : preferred;
      return typeof chosen.hash === "string" ? chosen.hash : "";
    }

    /**
     * Target of a Ctrl/Cmd+Up/Down in the object-detail view.
     *
     * These are additional to the four configurable shortcuts and are never
     * remapped: Down opens the first parent (older), Up opens the first child
     * (newer). Shift follows the next parent at merges / the next child in order.
     * @param event - keydown event.
     * @param detail - open commit detail record.
     * @param commits - commits of the loaded page.
     * @returns the hash to open, or "".
     */
    function detailArrowHash(event, detail, commits) {
      if (event === null || typeof event !== "object") return "";
      if (event.ctrlKey !== true && event.metaKey !== true) return "";
      if (event.altKey === true) return "";
      const shift = event.shiftKey === true;
      if (event.key === "ArrowDown") return parentHash(detail, shift);
      if (event.key === "ArrowUp") return childHash(commits, detail !== null && typeof detail === "object" ? detail.hash : "", shift);
      return "";
    }

    /**
     * Stable review/diff identity of one file row: its path.
     * @param file - host file record.
     * @param index - fallback position.
     * @returns the React key for the row.
     */
    function fileRowKey(file, index) {
      const path = file !== null && typeof file === "object" && typeof file.path === "string" ? file.path : "";
      return path !== "" ? path : "file:" + (Number.isSafeInteger(index) ? index : 0);
    }

    // ── wave 8-B: opt-in global shortcut scope (module-level registry) ─────

    /**
     * Mounted tab bodies in registration order. A document-level keydown is
     * dispatched to the last one only (“last visible panel wins”), so two open
     * Git Graph tabs can never both act on one event.
     */
    const GLOBAL_SHORTCUT_PANELS = [];

    /** The single document listener shared by every mounted panel. */
    let globalShortcutListener = null;

    /**
     * Register one panel's global keydown handler.
     * @param handler - `(event) => boolean`; true means the event was handled.
     * @returns a disposer that removes this panel.
     */
    function registerGlobalShortcutPanel(handler) {
      if (typeof handler !== "function") return () => {};
      const entry = { handler };
      GLOBAL_SHORTCUT_PANELS.push(entry);
      return () => {
        const index = GLOBAL_SHORTCUT_PANELS.indexOf(entry);
        if (index !== -1) GLOBAL_SHORTCUT_PANELS.splice(index, 1);
      };
    }

    /**
     * The panel that currently owns document-level shortcuts.
     * @returns the last registered `{ handler }` entry, or null.
     */
    function activeGlobalShortcutPanel() {
      return GLOBAL_SHORTCUT_PANELS.length === 0 ? null : GLOBAL_SHORTCUT_PANELS[GLOBAL_SHORTCUT_PANELS.length - 1];
    }

    /**
     * Dispatch one document-level keydown to the active panel.
     *
     * Editable targets are ignored unless a modifier is held (so typing in an
     * input cannot trigger plain navigation, while Ctrl/Cmd shortcuts still work
     * there).
     * @param event - keydown event.
     * @returns true when the active panel handled it.
     */
    function dispatchGlobalShortcut(event) {
      if (event === null || typeof event !== "object") return false;
      const panel = activeGlobalShortcutPanel();
      if (panel === null) return false;
      const modifier = event.ctrlKey === true || event.metaKey === true || event.altKey === true;
      if (isTypingTarget(event.target) === true && !modifier) return false;
      return panel.handler(event) === true;
    }

    /**
     * Install the shared capture-phase `keydown` listener on a document.
     *
     * Reference counted: the first install adds the listener, the last disposer
     * removes it. Only handled events are `preventDefault`/`stopPropagation`-ed.
     * @param doc - document-like object.
     * @param dispatch - the dispatcher, normally {@link dispatchGlobalShortcut}.
     * @returns a disposer.
     */
    function installGlobalShortcutListener(doc, dispatch) {
      if (doc === null || typeof doc !== "object" || typeof doc.addEventListener !== "function") return () => {};
      if (globalShortcutListener === null || globalShortcutListener.doc !== doc) {
        if (globalShortcutListener !== null) globalShortcutListener.dispose();
        const listener = (event) => {
          if (dispatch(event) !== true) return;
          if (typeof event.preventDefault === "function") event.preventDefault();
          if (typeof event.stopPropagation === "function") event.stopPropagation();
        };
        doc.addEventListener("keydown", listener, true);
        globalShortcutListener = {
          doc,
          count: 0,
          dispose() {
            if (typeof doc.removeEventListener === "function") doc.removeEventListener("keydown", listener, true);
          },
        };
      }
      const state = globalShortcutListener;
      state.count += 1;
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        state.count -= 1;
        if (state.count <= 0 && globalShortcutListener === state) {
          state.dispose();
          globalShortcutListener = null;
        }
      };
    }

    // ── wave 6: repositories and review marks (pure) ───────────────────────

    /**
     * Normalize the `repos` route value.
     * @param value - `{ workspacePath, maxDepth, repos, truncated }`.
     * @returns `{ workspacePath, repos, multiple, truncated }` with safe records.
     */
    function repoOptions(value) {
      const record = value !== null && typeof value === "object" ? value : {};
      const repos = Array.isArray(record.repos)
        ? record.repos
            .filter((repo) => repo !== null && typeof repo === "object" && typeof repo.path === "string" && repo.path !== "")
            .map((repo) => ({
              path: repo.path,
              name: typeof repo.name === "string" && repo.name !== "" ? repo.name : basename(repo.path),
              isCurrent: repo.isCurrent === true,
            }))
        : [];
      return {
        workspacePath: typeof record.workspacePath === "string" ? record.workspacePath : "",
        repos,
        multiple: repos.length > 1,
        truncated: record.truncated === true,
      };
    }

    /**
     * Attach the selected repository path to a request body.
     *
     * Returns the same body when no repository is selected, so a single-repository
     * session keeps every request byte-identical to earlier waves.
     * @param body - request body.
     * @param path - absolute repository path, or "".
     * @returns the body, with `path` appended only when one is selected.
     */
    function withRepoPath(body, path) {
      const record = body !== null && typeof body === "object" ? body : {};
      if (typeof path !== "string" || path === "") return record;
      return { ...record, path };
    }

    /**
     * Identity of one review scope.
     *
     * `working` is reserved for a working-tree comparison (`<base>|<base>`); the
     * host `/review` route currently has no working-tree form (it requires a head
     * ref and derives the total from a two-commit diff), so the comparison view
     * hides review marks in that mode while the key stays stable for a future
     * host extension.
     * @param kind - "commit", "compare" or "working".
     * @param base - base hash.
     * @param head - head hash (=== base for a commit).
     * @returns a stable key.
     */
    function reviewKey(kind, base, head) {
      const scope = kind === "compare" ? "compare" : kind === "working" ? "working" : "commit";
      const baseHash = typeof base === "string" ? base : "";
      const headHash = typeof head === "string" && head !== "" ? head : baseHash;
      return scope + "|" + baseHash + "|" + headHash;
    }

    /**
     * Build the `review` route body for one action.
     * @param input - `{ sessionId, action, kind, base, head, file }`.
     * @returns the JSON request body.
     */
    function reviewRequest(input) {
      const spec = input !== null && typeof input === "object" ? input : {};
      const action = spec.action === "toggle" || spec.action === "clear" ? spec.action : "read";
      const body = {
        sessionId: spec.sessionId,
        action,
        kind: spec.kind === "compare" ? "compare" : "commit",
        base: typeof spec.base === "string" ? spec.base : "",
        head: typeof spec.head === "string" ? spec.head : "",
      };
      if (action === "toggle") body.file = typeof spec.file === "string" ? spec.file : "";
      return body;
    }

    /**
     * Normalize a `review` route value.
     * @param value - `{ files, total, reviewed }`.
     * @returns `{ files, total, reviewed }` with numeric totals.
     */
    function reviewStateOf(value) {
      const record = value !== null && typeof value === "object" ? value : {};
      const raw = record.files !== null && typeof record.files === "object" && !Array.isArray(record.files) ? record.files : {};
      const files = {};
      for (const [path, stamp] of Object.entries(raw)) {
        if (typeof path === "string" && path !== "") files[path] = Number.isFinite(stamp) ? stamp : 0;
      }
      const reviewed = Object.keys(files).length;
      const total = Number.isSafeInteger(record.total) && record.total >= 0 ? record.total : reviewed;
      return { files, total, reviewed };
    }

    /**
     * Flip one file's review mark locally (the optimistic half of a toggle).
     * @param state - normalized review state `{ files, total, reviewed }`.
     * @param path - file path.
     * @param stamp - reviewedAt timestamp.
     * @returns the new normalized state.
     */
    function toggleReviewFile(state, path, stamp) {
      const record = state !== null && typeof state === "object" ? state : { files: {}, total: 0 };
      const files = { ...(record.files !== null && typeof record.files === "object" ? record.files : {}) };
      if (typeof path !== "string" || path === "") return { files, total: Number.isSafeInteger(record.total) ? record.total : Object.keys(files).length, reviewed: Object.keys(files).length };
      if (Object.prototype.hasOwnProperty.call(files, path)) delete files[path];
      else files[path] = Number.isFinite(stamp) ? stamp : 0;
      const reviewed = Object.keys(files).length;
      return { files, total: Number.isSafeInteger(record.total) ? record.total : reviewed, reviewed };
    }

    /**
     * File paths of the current commit/compare that are not reviewed yet.
     * @param files - host file records of the open scope.
     * @param reviewFiles - `review.files` map.
     * @returns pending paths, in file-list order.
     */
    function unreviewedPaths(files, reviewFiles) {
      const map = reviewFiles !== null && typeof reviewFiles === "object" ? reviewFiles : {};
      const paths = [];
      for (const file of Array.isArray(files) ? files : []) {
        if (file === null || typeof file !== "object" || typeof file.path !== "string" || file.path === "") continue;
        if (Object.prototype.hasOwnProperty.call(map, file.path)) continue;
        paths.push(file.path);
      }
      return paths;
    }

    /**
     * Whether a failed request means the review store is not available.
     * @param error - rejected request error.
     * @returns true for the host's UNAVAILABLE code.
     */
    function isUnavailableError(error) {
      return error !== null && typeof error === "object" && error.code === "UNAVAILABLE";
    }

    // ── wave 7: row columns, file tree, extra navigation (pure) ───────────

    /** Default column visibility: everything on. */
    const DEFAULT_COLUMNS = { author: true, date: true, hash: true };

    /**
     * The meta segments of one commit row, honouring the column toggles.
     *
     * The date segment follows `presentation.dateType` (Author vs Commit date) and
     * `presentation.dateFormat`; without a recognized format it keeps today's
     * relative timestamp.
     * Column *width dragging* is deliberately out of scope: the right sidebar is
     * 380–520 px wide and has no resizable table, so only visibility is offered.
     * @param commit - commit record.
     * @param visibility - `{ author, date, hash }`; missing/false hides a segment.
     * @param lang - language for relative times.
     * @param presentation - normalized presentation settings (optional).
     * @returns the ordered non-empty segments (hash, author, date).
     */
    function rowMetaParts(commit, visibility, lang, presentation) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const view = visibility !== null && typeof visibility === "object" ? visibility : DEFAULT_COLUMNS;
      const settings = presentation !== null && typeof presentation === "object" ? presentation : null;
      const parts = [];
      if (view.hash !== false) {
        const abbrev = typeof record.abbrev === "string" && record.abbrev !== ""
          ? record.abbrev
          : typeof record.hash === "string" ? record.hash.slice(0, 7) : "";
        if (abbrev !== "") parts.push(abbrev);
      }
      if (view.author !== false && typeof record.authorName === "string" && record.authorName !== "") parts.push(record.authorName);
      if (view.date !== false) {
        const seconds = settings !== null && settings.dateType === "Commit Date" ? record.committerTime : record.authorTime;
        const format = settings === null ? "" : normalizeDateFormat(settings.dateFormat);
        const date = format === "" ? relativeTime(seconds, lang) : formatCommitDate(seconds, settings, lang);
        if (date !== "") parts.push(date);
      }
      return parts;
    }

    /**
     * Group changed files into a directory tree.
     *
     * Directories come before files at every level, names are sorted, duplicate
     * paths collapse, and — when `compact` is not false — a directory whose only
     * child is another directory is compacted into one `a/b/c` node like upstream's
     * "compact folders" setting.
     * @param files - host file records.
     * @param options - `{ compact?: boolean }`; default true keeps today's behavior.
     * @returns `{ nodes, fileCount }`; nodes are `{ type: "dir"|"file", name, path, children?, file? }`.
     */
    function buildFileTree(files, options) {
      const settings = options !== null && typeof options === "object" ? options : {};
      const compact = settings.compact !== false;
      const list = Array.isArray(files)
        ? files.filter((file) => file !== null && typeof file === "object" && typeof file.path === "string" && file.path !== "")
        : [];
      const root = { type: "dir", name: "", path: "", children: new Map() };
      const seenPaths = new Set();
      for (const file of list) {
        if (seenPaths.has(file.path)) continue;
        seenPaths.add(file.path);
        const segments = file.path.split("/").filter((segment) => segment !== "");
        if (segments.length === 0) continue;
        let node = root;
        let prefix = "";
        for (let index = 0; index < segments.length - 1; index += 1) {
          prefix = prefix === "" ? segments[index] : prefix + "/" + segments[index];
          if (!node.children.has(segments[index])) {
            node.children.set(segments[index], { type: "dir", name: segments[index], path: prefix, children: new Map() });
          }
          node = node.children.get(segments[index]);
        }
        const name = segments[segments.length - 1];
        if (!node.children.has(name)) node.children.set(name, { type: "file", name, path: file.path, file });
      }
      const finalize = (dir) => {
        const children = [];
        for (const child of dir.children.values()) {
          children.push(child.type === "dir" ? compactDir(child) : child);
        }
        children.sort((left, right) => (left.type === right.type ? left.name.localeCompare(right.name) : left.type === "dir" ? -1 : 1));
        return children;
      };
      const compactDir = (dir) => {
        let node = dir;
        while (compact && node.children.size === 1) {
          const only = node.children.values().next().value;
          if (only === undefined || only.type !== "dir") break;
          node = { type: "dir", name: node.name + "/" + only.name, path: only.path, children: only.children };
        }
        return { type: "dir", name: node.name, path: node.path, children: finalize(node) };
      };
      return { nodes: finalize(root), fileCount: seenPaths.size };
    }

    /**
     * Next index in a wrapping sequence.
     * @param length - number of items.
     * @param current - current index (-1 = before the first).
     * @param step - +1 or -1.
     * @returns the next index, or -1 when the sequence is empty.
     */
    function nextIndex(length, current, step) {
      const total = Number.isSafeInteger(length) && length > 0 ? length : 0;
      if (total === 0) return -1;
      const position = Number.isInteger(current) ? current : -1;
      const direction = step === -1 ? -1 : 1;
      if (position < 0 || position >= total) return direction > 0 ? 0 : total - 1;
      return (position + direction + total) % total;
    }

    /**
     * The commit above/below the current one in the displayed order.
     * Unlike the stash jump this does not wrap: at an end there is no neighbour.
     * @param commits - commit records.
     * @param indices - displayed indices into `commits`.
     * @param current - current commit hash.
     * @param step - -1 for above, +1 for below.
     * @returns the neighbour hash, or "" when there is none.
     */
    function neighbourHash(commits, indices, current, step) {
      const list = Array.isArray(indices) ? indices : [];
      const records = Array.isArray(commits) ? commits : [];
      const position = list.findIndex((index) => {
        const commit = records[index];
        return commit !== null && typeof commit === "object" && commit.hash === current;
      });
      if (position === -1) return "";
      const target = position + (step === -1 ? -1 : 1);
      if (target < 0 || target >= list.length) return "";
      const commit = records[list[target]];
      return commit !== null && typeof commit === "object" && typeof commit.hash === "string" ? commit.hash : "";
    }

    /**
     * Displayed-order hashes of the commits that carry a stash ref.
     * @param commits - commit records.
     * @param indices - displayed indices into `commits`.
     * @param refs - graph refs.
     * @returns unique hashes, in display order.
     */
    function stashHashesIn(commits, indices, refs) {
      const stash = new Set();
      for (const ref of Array.isArray(refs) ? refs : []) {
        if (ref !== null && typeof ref === "object" && refKind(ref) === "stash" && typeof ref.hash === "string" && ref.hash !== "") stash.add(ref.hash);
      }
      const records = Array.isArray(commits) ? commits : [];
      const list = Array.isArray(indices) ? indices : [];
      const hashes = [];
      const seen = new Set();
      for (const index of list) {
        const commit = records[index];
        const hash = commit !== null && typeof commit === "object" && typeof commit.hash === "string" ? commit.hash : "";
        if (hash === "" || !stash.has(hash) || seen.has(hash)) continue;
        seen.add(hash);
        hashes.push(hash);
      }
      return hashes;
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
     * Locale key of the explicit textual change indicator for one status letter.
     * @param status - uppercase status letter.
     * @returns a `file.status.*` locale key.
     */
    function fileStatusKey(status) {
      return status === "A" ? "file.status.A"
        : status === "D" ? "file.status.D"
          : status === "R" ? "file.status.R"
            : status === "C" ? "file.status.C"
              : status === "T" ? "file.status.T"
                : status === "U" ? "file.status.U"
                  : status === "M" ? "file.status.M" : "file.status.other";
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
    function LaneGraph({ row, laneCount, style, colours } = {}) {
      const lanes = Number.isFinite(laneCount) && laneCount > 0 ? Math.min(Math.floor(laneCount), MAX_LANES) : 1;
      const width = lanes * LANE_WIDTH + 2;
      const centerX = (lane) => Math.min(Math.max(lane, 0), lanes - 1) * LANE_WIDTH + LANE_WIDTH / 2 + 1;
      const record = row !== null && typeof row === "object" ? row : { lane: 0, edges: [], merge: false, root: false };
      const edges = Array.isArray(record.edges) ? record.edges : [];
      const children = edges.map((edge, index) => {
        const colorLane = Number.isFinite(edge.colorLane) ? edge.colorLane : edge.fromY === 1 ? edge.toLane : edge.fromLane;
        return h("path", {
          key: "edge" + index,
          d: lanePath(centerX(edge.fromLane), Number(edge.fromY) * ROW_HEIGHT, centerX(edge.toLane), Number(edge.toY) * ROW_HEIGHT, style),
          stroke: laneColor(colorLane, colours),
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
          fill: record.root ? "var(--dsw-alias-bg-base)" : laneColor(node, colours),
          stroke: record.root ? laneColor(node, colours) : record.merge ? "var(--dsw-alias-bg-base)" : "none",
          strokeWidth: record.root ? 1.5 : 1.5,
        }),
      );
      if (record.merge) {
        children.push(
          h("circle", { key: "ring", cx: centerX(node), cy: ROW_HEIGHT / 2, r: 5, fill: "none", stroke: laneColor(node, colours), strokeWidth: 1.2 }),
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
    function RefChips({ chips, t, onPick, onRefMenu, buttons, tagsOnRight, alignedToGraph } = {}) {
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
      const renderChip = (chip) => {
        // A branch at HEAD stays a branch chip (actionable); `isHead` only adds ink.
        const className = "dgg-chip dgg-chip-" + chip.kind + (chip.isHead === true && chip.kind === "branch" ? " dgg-chip-head" : "");
        const checkout = pickable && chip.kind === "branch";
        const menu = menuable && (chip.kind === "branch" || chip.kind === "tag" || chip.kind === "remote" || chip.kind === "stash");
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
      };
      const containerClass = "dgg-chips" + (alignedToGraph === true ? " dgg-chips-aligned" : "");
      if (tagsOnRight !== true) {
        return h("span", { className: containerClass }, list.map(renderChip));
      }
      const branches = list.filter((chip) => chip.kind !== "tag");
      const tags = list.filter((chip) => chip.kind === "tag");
      return h(
        "span",
        { className: containerClass },
        branches.map(renderChip),
        tags.length > 0 ? h("span", { className: "dgg-chips-right", key: "tags-right" }, tags.map(renderChip)) : null,
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
    function CommitRow({ t, commit, row, laneCount, refIndex, stashRefs, presentation, metaVisibility, mutedHashes, onSelect, onMenu, onRefMenu, onHoverStart, onHoverEnd, selected, active, rowRef } = {}) {
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const hash = typeof record.hash === "string" ? record.hash : "";
      const abbrev = typeof record.abbrev === "string" && record.abbrev !== "" ? record.abbrev : hash.slice(0, 7);
      const subject = typeof record.subject === "string" && record.subject !== "" ? record.subject : abbrev;
      const author = typeof record.authorName === "string" ? record.authorName : "";
      const settings = presentation !== null && typeof presentation === "object" ? presentation : null;
      const stashChips = (Array.isArray(stashRefs) ? stashRefs : []).map((label, index) => ({ key: "stash#" + index, label, kind: "stash", isHead: false }));
      const chipLayout = layoutRefChips(record.refs, refIndex, MAX_ROW_CHIPS, settings);
      const chips = chipLayout.chips.concat(stashChips);
      // Muting is visual only: merged commits and commits outside HEAD's loaded
      // ancestry stay fully selectable, findable and clickable.
      const mergeMuted = settings !== null && settings.muteMergeCommits === true && Array.isArray(record.parents) && record.parents.length > 1;
      const ancestorMuted = isSetLike(mutedHashes) && hash !== "" && mutedHashes.has(hash);
      const muted = mergeMuted || ancestorMuted;
      const muteKey = mergeMuted ? "mute.mergeCommit" : ancestorMuted ? "mute.nonAncestor" : "";
      const rowClass = "dgg-row" + (selected === true ? " dgg-row-selected" : "") + (active === true ? " dgg-row-active" : "") + (muted ? " dgg-row-muted" : "");
      const rowLabel = subject + " " + abbrev + (muteKey === "" ? "" : " · " + t(muteKey));
      const emitMenu = (x, y) => {
        if (typeof onMenu !== "function") return;
        onMenu({ x, y, hash, commit: record });
      };
      const hoverPoint = (event, fallbackY) => {
        const gesture = event !== null && typeof event === "object" ? event : {};
        if (typeof gesture.clientX === "number" && typeof gesture.clientY === "number") return { x: gesture.clientX, y: gesture.clientY };
        const element = gesture.currentTarget;
        const rect = element !== null && typeof element === "object" && typeof element.getBoundingClientRect === "function" ? element.getBoundingClientRect() : null;
        return rect === null ? { x: 0, y: 0 } : { x: rect.left, y: typeof fallbackY === "number" ? rect.bottom : rect.top };
      };
      const startHover = (event, fromFocus) => {
        if (typeof onHoverStart !== "function" || hash === "") return;
        onHoverStart(hash, hoverPoint(event, fromFocus === true ? 0 : undefined));
      };
      const endHover = () => {
        if (typeof onHoverEnd === "function") onHoverEnd();
      };
      return h(
        "button",
        {
          type: "button",
          className: rowClass,
          "aria-label": rowLabel,
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
          onPointerEnter: (event) => startHover(event, false),
          onPointerLeave: endHover,
          onFocus: (event) => startHover(event, true),
          onBlur: endHover,
        },
        h(LaneGraph, {
          row,
          laneCount,
          style: presentation !== null && typeof presentation === "object" ? presentation.graphStyle : undefined,
          colours: presentation !== null && typeof presentation === "object" ? presentation.graphColours : undefined,
        }),
        h(
          "span",
          { className: "dgg-rowtext" },
          h("span", { className: "dgg-subject" }, h(RichText, { text: subject, presentation })),
          h("span", { className: "dgg-meta" }, rowMetaParts(record, metaVisibility, currentLanguage(), settings).join(" · ")),
          chips.length > 0
            ? h(RefChips, {
                chips,
                t,
                onRefMenu,
                buttons: false,
                tagsOnRight: chipLayout.tagsOnRight,
                alignedToGraph: chipLayout.alignedToGraph,
              })
            : null,
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
    function CommitList({ t, value, layout, refIndex, stashRefsByHash, presentation, metaVisibility, mutedHashes, uncommitted, selectedHash, headHash, scrollHeadKey, stashScrollHash, stashScrollKey, indices, activeHash, onSelect, onSelectUncommitted, onMenu, onRefMenu, onHoverStart, onHoverEnd, onLoadMore, canLoadMore, loadingMore } = {}) {
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
      // Ctrl/Cmd+H scrolls the HEAD commit into view (the tab owns that shortcut).
      const headRef = React.useRef(null);
      React.useEffect(() => {
        if (!Number.isFinite(scrollHeadKey) || scrollHeadKey === 0) return;
        const node = headRef.current;
        if (node !== null && typeof node === "object" && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "center" });
      }, [scrollHeadKey]);
      // Ctrl/Cmd+S and Ctrl/Cmd+Shift+S walk the stash-bearing commits.
      const stashRef = React.useRef(null);
      React.useEffect(() => {
        if (!Number.isFinite(stashScrollKey) || stashScrollKey === 0) return;
        const node = stashRef.current;
        if (node !== null && typeof node === "object" && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "center" });
      }, [stashScrollKey]);
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
            rowRef: isActive
              ? activeRef
              : hash !== "" && hash === headHash
                ? headRef
                : hash !== "" && hash === stashScrollHash
                  ? stashRef
                  : undefined,
            stashRefs: isMapLike(stashRefsByHash) && hash !== "" ? stashRefsByHash.get(hash) : undefined,
            presentation,
            metaVisibility,
            mutedHashes,
            onSelect,
            onMenu,
            onRefMenu,
            onHoverStart,
            onHoverEnd,
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
     * Render one subject/body string with emoji glyphs and issue links.
     *
     * Everything is a React text node or an anchor; no markup is ever parsed.
     * @param props - source text and normalized presentation settings.
     * @returns the rendered fragment.
     */
    function RichText({ text, presentation } = {}) {
      const parts = richTextParts(text, presentation);
      if (parts.length === 0) return null;
      const renderParts = (list) => list.map((part, index) => {
        if (part.type === "issue") {
          return h(
            "a",
            { key: "issue-" + index, className: "dgg-issue-link", href: part.href, target: "_blank", rel: "noreferrer noopener" },
            part.text,
          );
        }
        if (part.type === "emoji") {
          return h("span", { key: "emoji-" + index, className: "dgg-emoji", role: "img", "aria-label": part.shortcode }, part.text);
        }
        if (part.type === "code") {
          return h("code", { key: "code-" + index, className: "dgg-md-code" }, part.text);
        }
        if (part.type === "bold") {
          return h("strong", { key: "bold-" + index, className: "dgg-md-bold" }, renderParts(part.parts));
        }
        if (part.type === "italic") {
          return h("em", { key: "italic-" + index, className: "dgg-md-italic" }, renderParts(part.parts));
        }
        if (part.type === "boldItalic") {
          return h(
            "strong",
            { key: "bold-italic-" + index, className: "dgg-md-bold" },
            h("em", { className: "dgg-md-italic" }, renderParts(part.parts)),
          );
        }
        return part.text;
      });
      return h(React.Fragment, null, renderParts(parts));
    }

    /**
     * Signature badge for the commit detail view.
     * @param props - translate function and the commit's `signature` value.
     * @returns the badge, or null when the status is absent/unremarkable.
     */
    function SignatureBadge({ t, signature } = {}) {
      const badge = signatureBadge(signature);
      if (badge === null) return null;
      return h(
        "span",
        {
          className: "dgg-signature dgg-signature-" + badge.tone,
          title: badge.signer !== "" ? t("detail.signer") + ": " + badge.signer : t("detail.signature"),
        },
        h("span", { className: "dgg-signature-label" }, t(badge.labelKey)),
        badge.signer !== "" ? h("span", { className: "dgg-signature-signer" }, badge.signer) : null,
      );
    }

    /**
     * The controlled hover tooltip for one commit row.
     *
     * Fixed-position, pointer-events:none and rendered inside the tab body, so it
     * never blocks scrolling or leaves the pane.
     * @param props - translate function and the hover state.
     * @returns the tooltip, or null when nothing is hovered.
     */
    function CommitTooltip({ t, hover } = {}) {
      if (hover === null || typeof hover !== "object") return null;
      const style = {
        position: "fixed",
        left: typeof hover.x === "number" ? hover.x : 0,
        top: typeof hover.y === "number" ? hover.y : 0,
      };
      let body;
      if (hover.status === "error") {
        body = h(
          "p",
          { className: "dgg-tooltip-head" },
          t("tooltip.error") + (typeof hover.error === "string" && hover.error !== "" ? ": " + hover.error : ""),
        );
      } else if (hover.status !== "ready" || hover.data === null) {
        body = h("p", { className: "dgg-tooltip-head" }, t("tooltip.loading"));
      } else {
        const summary = containsSummary(hover.data, TOOLTIP_ITEM_LIMIT);
        const rows = [
          h("p", { className: "dgg-tooltip-head", key: "head" }, t(summary.inHead ? "tooltip.containsHead" : "tooltip.notContainsHead")),
        ];
        if (summary.branches.length > 0) {
          rows.push(
            h(
              "div",
              { className: "dgg-tooltip-row", key: "branches" },
              h("span", { className: "dgg-tooltip-key" }, t("tooltip.branches")),
              h(
                "span",
                { className: "dgg-tooltip-value" },
                summary.branches.map((branch, index) =>
                  h(
                    "span",
                    {
                      key: "branch-" + index,
                      className: "dgg-tooltip-branch" + (branch.isHead === true ? " dgg-tooltip-current" : ""),
                    },
                    branch.name + (branch.isHead === true ? " (" + t("tooltip.currentBranch") + ")" : ""),
                  ),
                ),
              ),
            ),
          );
        }
        if (summary.tags.length > 0) {
          rows.push(
            h(
              "div",
              { className: "dgg-tooltip-row", key: "tags" },
              h("span", { className: "dgg-tooltip-key" }, t("tooltip.tags")),
              h("span", { className: "dgg-tooltip-value" }, summary.tags.map((tag, index) => h("span", { key: "tag-" + index }, tag))),
            ),
          );
        }
        if (summary.stashes.length > 0) {
          rows.push(
            h(
              "div",
              { className: "dgg-tooltip-row", key: "stashes" },
              h("span", { className: "dgg-tooltip-key" }, t("tooltip.stashes")),
              h("span", { className: "dgg-tooltip-value" }, summary.stashes.map((stash, index) => h("span", { key: "stash-" + index }, stash.shortName))),
            ),
          );
        }
        if (summary.hidden > 0) {
          rows.push(h("span", { className: "dgg-tooltip-overflow", key: "overflow" }, t("tooltip.overflow", { count: summary.hidden })));
        }
        body = rows;
      }
      return h("div", { className: "dgg-tooltip", role: "tooltip", "aria-label": t("tooltip.label"), style }, body);
    }

    /**
     * The toolbar's repository label.
     *
     * Kept as its own component so a future repository selector can replace it
     * without touching the rest of the toolbar's layout.
     * @param props - translate function, display name and full path.
     * @returns the repository name span.
     */
    function RepoLabel({ t, repoLabel, repoPath, repositories, value, onChange, order } = {}) {
      const info = repositories !== null && typeof repositories === "object" ? repositories : { repos: [], multiple: false };
      // The presentation's dropdown order only changes the option order; an absent or
      // malformed value keeps the host order.
      const repos = orderedRepositories(Array.isArray(info.repos) ? info.repos : [], order);
      const label = typeof repoLabel === "string" && repoLabel !== "" ? repoLabel : t("tab.title");
      if (info.multiple !== true || repos.length < 2 || typeof onChange !== "function") {
        return h("span", { className: "dgg-repo", title: typeof repoPath === "string" && repoPath !== "" ? repoPath : t("tab.title") }, label);
      }
      const selected = typeof value === "string" ? value : "";
      return h(
        "select",
        {
          className: "dgg-select dgg-repo-input",
          value: selected,
          title: t("repo.label"),
          "aria-label": t("repo.label"),
          onChange: (event) => onChange(event.target.value),
        },
        h("option", { value: "" }, label + (info.truncated === true ? " …" : "")),
        repos.map((repo) =>
          h(
            "option",
            { key: repo.path, value: repo.path },
            repo.name + (repo.isCurrent === true ? " (" + t("repo.current") + ")" : ""),
          ),
        ),
      );
    }

    /**
     * The per-file review checkbox.
     *
     * Rendered through FileRow's `renderLeading` slot so the row itself keeps its
     * diff toggle; review state is deliberately separate from the diff cache.
     * @param props - translate function, current mark, file path and toggle callback.
     * @returns a labelled checkbox.
     */
    function ReviewCheckbox({ t, reviewed, path, onToggle } = {}) {
      return h(
        "label",
        { className: "dgg-review-check", title: t("review.toggle") },
        h("input", {
          type: "checkbox",
          checked: reviewed === true,
          "aria-label": t("review.toggle") + (typeof path === "string" && path !== "" ? " " + path : ""),
          onChange: () => {
            if (typeof onToggle === "function") onToggle(typeof path === "string" ? path : "");
          },
        }),
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
     * Empty state for a valid glob that matched no branch.
     *
     * The graph request is suppressed in this state (an omitted `branches`
     * member would mean “every commit”), so this stands in for the list. The
     * still-open filter bar lets the reader clear the glob and get the page back.
     * @param props - translate function.
     * @returns a centered state block.
     */
    function NoGlobMatchState({ t } = {}) {
      return h(
        "div",
        { className: "dgg-state" },
        h("p", { className: "dgg-state-title" }, t("filter.noGlobMatch")),
        h("p", { className: "dgg-state-detail" }, t("filter.noGlobMatchHint")),
      );
    }

    /**
     * The find row: scope toggle, query input, match counter and previous/next
     * controls.
     *
     * `scope` defaults to the loaded page, which keeps the original in-page
     * matching UI; `全部历史` swaps the counter/navigation for the server-side
     * result list rendered by {@link SearchResults}.
     * @param props - scope, query, match state and callbacks.
     * @returns the find row.
     */
    function FindBar({ t, scope, query, total, activeIndex, onQuery, onScope, onNext, onPrev, onClose } = {}) {
      const inputRef = React.useRef(null);
      React.useEffect(() => {
        const node = inputRef.current;
        if (node !== null && typeof node === "object" && typeof node.focus === "function") node.focus();
      }, []);
      const current = typeof total === "number" && total > 0 ? Math.max(0, Math.min(activeIndex, total - 1)) + 1 : 0;
      const matches = typeof total === "number" && total > 0 ? total : 0;
      const findScope = scope === FIND_SCOPE_ALL ? FIND_SCOPE_ALL : FIND_SCOPE_PAGE;
      const allHistory = findScope === FIND_SCOPE_ALL;
      const emitScope = (next) => {
        if (typeof onScope === "function") onScope(next);
      };
      const scopeOption = (value, labelKey) =>
        h(
          "label",
          { className: "dgg-scope-option" },
          h("input", {
            type: "radio",
            name: "dgg-find-scope",
            value,
            checked: findScope === value,
            onChange: () => emitScope(value),
          }),
          h("span", null, t(labelKey)),
        );
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
        h(
          "div",
          { className: "dgg-find-scope", role: "radiogroup", "aria-label": t("find.scopeLabel") },
          scopeOption(FIND_SCOPE_PAGE, "find.scopePage"),
          scopeOption(FIND_SCOPE_ALL, "find.scopeAll"),
        ),
        allHistory
          ? null
          : h("span", { className: "dgg-find-count", role: "status", "aria-label": t("find.counter", { current, total: matches }) }, current + "/" + matches),
        allHistory
          ? null
          : h("button", { type: "button", className: "dgg-icon-btn", title: t("find.prev"), "aria-label": t("find.prev"), disabled: matches === 0, onClick: onPrev }, h(ChevronUpIcon)),
        allHistory
          ? null
          : h("button", { type: "button", className: "dgg-icon-btn", title: t("find.next"), "aria-label": t("find.next"), disabled: matches === 0, onClick: onNext }, h(ChevronDownIcon)),
        h("button", { type: "button", className: "dgg-icon-btn", title: t("find.close"), "aria-label": t("find.close"), onClick: onClose }, h(CloseIcon)),
      );
    }

    /**
     * Full-history search results: count, capped notice, inline error, retry and
     * the paginated commit rows.
     *
     * Results are normalized onto the graph commit shape by `normalizeSearchValue`,
     * so the same {@link CommitList}/{@link CommitRow} components render them and
     * selecting a row opens the normal commit detail.
     * @param props - search state and the reused row callbacks.
     * @returns the search result block.
     */
    function SearchResults({ t, search, refIndex, presentation, metaVisibility, selectedHash, onSelect, onMenu, onRefMenu, onHoverStart, onHoverEnd, onLoadMore, onRetry } = {}) {
      const state = search !== null && typeof search === "object" ? search : EMPTY_SEARCH;
      const status = typeof state.status === "string" ? state.status : "idle";
      const commits = Array.isArray(state.commits) ? state.commits : [];
      const count = Number.isSafeInteger(state.count) ? state.count : commits.length;
      const layout = React.useMemo(() => layoutGraph(commits), [commits]);
      if (status === "error") {
        const message = typeof state.error === "string" && state.error !== "" ? ": " + state.error : "";
        return h(
          "div",
          { className: "dgg-search" },
          h("p", { className: "dgg-hint dgg-search-error", role: "alert" }, t("find.searchError") + message),
          h("button", { type: "button", className: "dgg-btn", onClick: onRetry }, t("state.retry")),
        );
      }
      // `idle` is the first frame after entering full-history mode, before the
      // debounced request effect runs: show the searching state, not "0 results".
      if ((status === "loading" || status === "idle") && commits.length === 0) {
        return h(
          "div",
          { className: "dgg-search dgg-search-loading" },
          h(Spinner),
          h("p", { className: "dgg-hint" }, t("find.searching")),
        );
      }
      return h(
        "div",
        { className: "dgg-search" },
        h("p", { className: "dgg-hint dgg-search-count", role: "status" }, t("find.searchCount", { count })),
        state.capped === true ? h("p", { className: "dgg-hint dgg-search-capped" }, t("find.searchCapped")) : null,
        commits.length === 0
          ? h("p", { className: "dgg-hint dgg-list-empty" }, t("find.noMatches"))
          : h(CommitList, {
              t,
              value: { commits },
              layout,
              refIndex,
              presentation,
              metaVisibility,
              uncommitted: null,
              selectedHash: typeof selectedHash === "string" ? selectedHash : "",
              headHash: "",
              scrollHeadKey: 0,
              stashScrollHash: "",
              stashScrollKey: 0,
              indices: commits.map((commit, index) => index),
              activeHash: "",
              onSelect,
              onMenu,
              onRefMenu,
              onHoverStart,
              onHoverEnd,
              onLoadMore,
              canLoadMore: state.hasMore === true,
              loadingMore: state.loadingMore === true,
            }),
      );
    }

    /**
     * The branch filter row: one checkbox per local branch, an “all” reset and
     * the branch glob input.
     *
     * A valid glob unions extra branches into the selection; an invalid one is
     * reported inline (`globError` is a locale key) and never applied.
     * @param props - branch options, selection, glob text/error and callbacks.
     * @returns the filter row.
     */
    function BranchFilterBar({ t, options, selection, globText, globError, onToggle, onGlob, onReset, onClose } = {}) {
      const list = Array.isArray(options) ? options : [];
      const all = selection === null || selection === undefined;
      const checked = (option) => all || (Array.isArray(selection) && selection.includes(option.name));
      const text = typeof globText === "string" ? globText : "";
      const errorKey = typeof globError === "string" ? globError : "";
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
        h(
          "label",
          { className: "dgg-glob-field" },
          h("span", { className: "dgg-glob-label" }, t("filter.globLabel")),
          h("input", {
            type: "text",
            className: "dgg-input dgg-glob-input",
            value: text,
            placeholder: t("filter.globPlaceholder"),
            "aria-label": t("filter.globLabel"),
            spellCheck: false,
            autoComplete: "off",
            onChange: (event) => {
              if (typeof onGlob === "function") onGlob(event.target.value);
            },
          }),
        ),
        errorKey !== "" ? h("p", { className: "dgg-hint dgg-glob-error", role: "alert" }, t(errorKey)) : null,
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
      const { t, repoLabel, repoPath, repositories, repoValue, repoOrder, onRepoChange, branchLabel, dirty, busy, backVisible, menuOpen, running, order, findOpen, filterOpen, columns, onToggleColumn, onRefresh, onToggleMenu, onCloseMenu, onFetch, onOpenRemotes, onBack, onToggleFind, onToggleFilter, onOrderChange } = props;
      return h(
        "div",
        { className: "dgg-toolbar" },
        backVisible === true
          ? h("button", { type: "button", className: "dgg-icon-btn", title: t("toolbar.back"), "aria-label": t("toolbar.back"), onClick: onBack }, h(BackIcon))
          : h("span", { className: "dgg-toolbar-icon" }, h(GitGraphIcon, { size: 16 })),
        h(RepoLabel, { t, repoLabel, repoPath, repositories, value: repoValue, order: repoOrder, onChange: onRepoChange }),
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
                h("button", { type: "button", className: "dgg-menu-item", disabled: running === true, onClick: onOpenRemotes }, t("toolbar.remotes")),
                // Column visibility only: column width dragging is out of scope
                // because the right sidebar is 380–520 px wide and has no
                // resizable table.
                ...[
                  ["author", "column.showAuthor"],
                  ["date", "column.showDate"],
                  ["hash", "column.showHash"],
                ].map(([key, labelKey]) =>
                  h(
                    "label",
                    { className: "dgg-menu-check", key: "column-" + key },
                    h("input", {
                      type: "checkbox",
                      checked: columns !== null && typeof columns === "object" ? columns[key] !== false : true,
                      onChange: () => {
                        if (typeof onToggleColumn === "function") onToggleColumn(key);
                      },
                    }),
                    h("span", null, t(labelKey)),
                  ),
                ),
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
     * Read-only details of one tag, from the `tag` route.
     * @param props - tag name, request state and the close callback.
     * @returns the tag details panel.
     */
    function TagDetails({ t, name, status, value, error, presentation, onClose } = {}) {
      const record = value !== null && typeof value === "object" ? value : {};
      const annotated = record.annotated === true;
      const tagger = record.tagger !== null && typeof record.tagger === "object" ? record.tagger : null;
      const lang = currentLanguage();
      const tagTime = tagger === null
        ? ""
        : typeof tagger.time === "string" && tagger.time !== ""
          ? tagger.time
          : Number.isFinite(tagger.time) ? absoluteTime(tagger.time, lang) + " (" + relativeTime(tagger.time, lang) + ")" : "";
      const message = typeof record.message === "string" ? record.message.trim() : "";
      const settings = presentation !== null && typeof presentation === "object" ? presentation : null;
      let body;
      if (status === "error") {
        body = h("p", { className: "dgg-hint" }, t("state.error") + (typeof error === "string" && error !== "" ? ": " + error : ""));
      } else if (status !== "ready" || value === null) {
        body = h("p", { className: "dgg-hint" }, t("state.loading"));
      } else {
        body = h(
          React.Fragment,
          null,
          h(
            "div",
            { className: "dgg-kv" },
            h("span", { className: "dgg-k" }, t("detail.tagType")),
            h("span", { className: "dgg-v" }, annotated ? t("detail.annotated") : t("detail.lightweight")),
            tagger !== null
              ? h(
                  React.Fragment,
                  null,
                  h("span", { className: "dgg-k" }, t("detail.tagger")),
                  h("span", { className: "dgg-v" }, personLine(tagger.name, tagger.email, undefined, lang)),
                )
              : null,
            tagTime !== ""
              ? h(
                  React.Fragment,
                  null,
                  h("span", { className: "dgg-k" }, t("detail.tagTime")),
                  h("span", { className: "dgg-v" }, tagTime),
                )
              : null,
          ),
          h("p", { className: "dgg-section-title" }, t("detail.tagMessage")),
          message === ""
            ? h("p", { className: "dgg-hint" }, t("detail.tagNoMessage"))
            : h(
                "pre",
                { className: "dgg-body" },
                settings !== null && settings.markdown === true ? h(RichText, { text: message, presentation: settings }) : message,
              ),
        );
      }
      return h(
        "div",
        { className: "dgg-panel dgg-tag-details", role: "region", "aria-label": t("action.tagDetails") },
        h(
          "div",
          { className: "dgg-panel-head" },
          h("h3", { className: "dgg-panel-title", title: typeof name === "string" ? name : "" }, t("action.tagDetails") + (typeof name === "string" && name !== "" ? ": " + name : "")),
          h("button", { type: "button", className: "dgg-icon-btn", title: t("common.close"), "aria-label": t("common.close"), onClick: onClose }, h(CloseIcon)),
        ),
        body,
      );
    }

    /**
     * Remote management: list, add, edit, prune and delete remotes.
     * @param props - `remotes` route state and the callbacks.
     * @returns the remotes panel.
     */
    function RemotesPanel({ t, status, value, error, onAdd, onEdit, onPrune, onDelete, onRefresh, onClose } = {}) {
      const record = value !== null && typeof value === "object" ? value : {};
      const remotes = Array.isArray(record.remotes) ? record.remotes.filter((remote) => remote !== null && typeof remote === "object") : [];
      let body;
      if (status === "error") {
        body = h("p", { className: "dgg-hint" }, t("remote.error") + (typeof error === "string" && error !== "" ? ": " + error : ""));
      } else if (status !== "ready") {
        body = h("p", { className: "dgg-hint" }, t("state.loading"));
      } else if (remotes.length === 0) {
        // No remotes is a normal state for a local-only repository.
        body = h("p", { className: "dgg-hint" }, t("remote.empty"));
      } else {
        body = h(
          "div",
          { className: "dgg-remotes" },
          remotes.map((remote) =>
            h(
              "div",
              { className: "dgg-remote-row", key: typeof remote.name === "string" ? remote.name : "remote" },
              h("span", { className: "dgg-remote-name" }, typeof remote.name === "string" ? remote.name : ""),
              h("span", { className: "dgg-remote-url", title: typeof remote.fetchUrl === "string" ? remote.fetchUrl : "" }, typeof remote.fetchUrl === "string" ? remote.fetchUrl : ""),
              h("button", { type: "button", className: "dgg-btn", onClick: () => onEdit(remote) }, t("remote.edit")),
              h("button", { type: "button", className: "dgg-btn", onClick: () => onPrune(remote) }, t("remote.prune")),
              h("button", { type: "button", className: "dgg-btn dgg-btn-danger", onClick: () => onDelete(remote) }, t("remote.delete")),
            ),
          ),
        );
      }
      return h(
        "div",
        { className: "dgg-panel", role: "region", "aria-label": t("remote.title") },
        h(
          "div",
          { className: "dgg-panel-head" },
          h("h3", { className: "dgg-panel-title" }, t("remote.title")),
          h("button", { type: "button", className: "dgg-icon-btn", title: t("common.refresh"), "aria-label": t("common.refresh"), onClick: onRefresh }, h(RefreshIcon)),
          h("button", { type: "button", className: "dgg-btn", onClick: onAdd }, t("remote.add")),
          h("button", { type: "button", className: "dgg-icon-btn", title: t("remote.close"), "aria-label": t("remote.close"), onClick: onClose }, h(CloseIcon)),
        ),
        body,
      );
    }

    /**
     * The single confirmation dialog for every repository action.
     *
     * Fully declarative: `actionDialogSpec` supplies the fields, choices, checkbox
     * options and guardrail keys, so a new action never needs bespoke UI here.
     * @param props - dialog descriptor, worktree dirtiness and callbacks.
     * @returns the inline confirmation panel.
     */
    function ActionDialog({ t, dialog, dirty, running, onCancel, onConfirm } = {}) {
      const spec = dialog !== null && typeof dialog === "object" ? dialog : { kind: "fetch", needs: null, options: [], fields: [], choices: [] };
      const fields = Array.isArray(spec.fields) && spec.fields.length > 0 ? spec.fields : actionFields(spec.kind, spec.needs);
      const optionList = Array.isArray(spec.options) ? spec.options : [];
      const declaredChecks = Array.isArray(spec.checks) ? spec.checks : [];
      const checkOptions = declaredChecks.length > 0
        ? declaredChecks.filter((option) => option !== null && typeof option === "object" && typeof option.key === "string")
        : optionList.filter((option) => option !== null && typeof option === "object" && typeof option.key === "string" && typeof option.labelKey === "string");
      const selectOptions = optionList.filter((option) => option !== null && typeof option === "object" && typeof option.name === "string");
      const choices = Array.isArray(spec.choices) ? spec.choices : [];
      const needsSelect = spec.needs === "branch" || spec.needs === "tag" || spec.needs === "remote";
      // Multi-remote push: a checkbox per remote instead of one select. No force
      // option is offered because the host action pushes each remote once and
      // takes no force flag.
      const remotesMany = spec.remotesMany === true;
      const [remotesPicked, setRemotesPicked] = React.useState(() => selectOptions.map((option) => option.name));
      const toggleRemote = (name) => setRemotesPicked((previous) => (previous.includes(name) ? previous.filter((entry) => entry !== name) : previous.concat(name)));
      const label = t("action." + spec.kind);

      const initialValues = {};
      for (const field of fields) {
        const prefill = field.prefill === "requestedRef"
          ? (typeof spec.requestedRef === "string" ? spec.requestedRef : "")
          : field.prefill === "extra" ? (typeof spec.defaultExtra === "string" ? spec.defaultExtra : "") : "";
        initialValues[field.key] = typeof field.default === "string" ? field.default : prefill;
      }
      const requestedSelect = typeof spec.requestedRef === "string" && selectOptions.some((option) => option.name === spec.requestedRef) ? spec.requestedRef : selectOptions.length > 0 ? selectOptions[0].name : "";
      const [values, setValues] = React.useState(initialValues);
      const [ref, setRef] = React.useState(requestedSelect);
      // Presentation defaults only seed the state: toggling/choosing in the dialog wins.
      const specDefaults = spec.defaults !== null && typeof spec.defaults === "object" ? spec.defaults : {};
      const defaultFlags = specDefaults.flags !== null && typeof specDefaults.flags === "object" ? specDefaults.flags : {};
      const defaultMode = typeof specDefaults.mode === "string" && choices.some((choice) => choice.value === specDefaults.mode)
        ? specDefaults.mode
        : choices.length > 0 ? choices[0].value : "";
      const [mode, setMode] = React.useState(defaultMode);
      const initialFlags = {};
      for (const option of checkOptions) initialFlags[option.key] = option.checked === true || defaultFlags[option.key] === true;
      const [flags, setFlags] = React.useState(initialFlags);

      const trimmed = (key) => (typeof values[key] === "string" ? values[key].trim() : "");
      const nameMissing = fields.some((field) => field.key === "name" && field.required !== false && trimmed("name") === "");
      const extraMissing = fields.some((field) => field.key === "newName" || field.key === "url") && fields.some((field) => (field.key === "newName" || field.key === "url") && field.required !== false && trimmed(field.key) === "");
      const unchangedName = fields.some((field) => field.key === "newName") && trimmed("newName") === trimmed("name");
      const selectMissing = needsSelect && !remotesMany && ref === "";
      const remotesMissing = remotesMany && remotesPicked.length === 0;
      const preview = spec.preview !== null && typeof spec.preview === "object" && Array.isArray(spec.preview.lines) ? spec.preview : null;
      const awaitingPreview = spec.requiresPreview === true && preview === null;
      const ready = running !== true && !nameMissing && !extraMissing && !unchangedName && !selectMissing && !remotesMissing && !awaitingPreview;

      const warnings = [];
      if (spec.dirtySensitive === true && Number.isFinite(dirty) && dirty > 0) warnings.push(t("action.cleanWorktreeWarning"));
      for (const key of Array.isArray(spec.warnings) ? spec.warnings : []) warnings.push(t(key));
      const modeWarnings = spec.modeWarnings !== null && typeof spec.modeWarnings === "object" ? spec.modeWarnings : {};
      if (typeof modeWarnings[mode] === "string") warnings.push(t(modeWarnings[mode]));
      for (const option of checkOptions) {
        if (flags[option.key] === true && typeof option.warningKey === "string") warnings.push(t(option.warningKey));
      }
      const checkWarnings = spec.checkWarnings !== null && typeof spec.checkWarnings === "object" ? spec.checkWarnings : {};
      if (typeof checkWarnings.force === "string" && flags.force === true) warnings.push(t(checkWarnings.force));

      const extraValue = typeof values.newName === "string" ? values.newName.trim() : typeof values.url === "string" ? values.url.trim() : mode;
      const submit = () => {
        if (remotesMany) {
          // The branch travels as the dialog's requested ref; the picked remote
          // names travel as the "ref" argument so actionArguments can build
          // `{ branch, remotes }` without a new callback signature.
          onConfirm("", remotesPicked.slice(), typeof spec.requestedRef === "string" ? spec.requestedRef : "");
          return;
        }
        if (checkOptions.length > 0) onConfirm(trimmed("name"), ref, extraValue, { ...flags });
        else onConfirm(trimmed("name"), ref, extraValue);
      };
      const fieldLabel = spec.needs === "tag" ? t("action.tagName") : spec.needs === "remote" ? t("action.remote") : t("action.branchName");
      const selectLabel = spec.needs === "remote" ? t("action.remote") : fieldLabel;

      return h(
        "div",
        { className: "dgg-dialog", role: "group", "aria-label": t("action.confirm", { action: label }) },
        h("p", { className: "dgg-dialog-title" }, t("action.confirm", { action: label })),
        warnings.map((warning, index) => h("p", { className: "dgg-dialog-warning", key: "warning-" + index }, warning)),
        fields.map((field, index) =>
          h(
            "label",
            { className: "dgg-field", key: "field-" + field.key },
            h("span", { className: "dgg-field-label" }, t(field.labelKey)),
            h("input", {
              className: "dgg-input",
              type: "text",
              value: typeof values[field.key] === "string" ? values[field.key] : "",
              autoFocus: index === 0,
              spellCheck: false,
              autoComplete: "off",
              "aria-label": t(field.labelKey),
              onChange: (event) => setValues((previous) => ({ ...previous, [field.key]: event.target.value })),
              onKeyDown: (event) => {
                if (event.key === "Enter" && ready) submit();
                if (event.key === "Escape") onCancel();
              },
            }),
          ),
        ),
        remotesMany
          ? h(
              React.Fragment,
              null,
              h("p", { className: "dgg-dialog-note" }, t("action.branch") + ": " + (typeof spec.requestedRef === "string" ? spec.requestedRef : "")),
              h(
                "div",
                { className: "dgg-checks", role: "group", "aria-label": t("action.remotes") },
                h("span", { className: "dgg-field-label" }, t("action.remotes")),
                selectOptions.length === 0
                  ? h("p", { className: "dgg-hint" }, t("action.noTarget"))
                  : selectOptions.map((option) =>
                      h(
                        "label",
                        { className: "dgg-check", key: "remote-" + option.name },
                        h("input", {
                          type: "checkbox",
                          checked: remotesPicked.includes(option.name),
                          "aria-label": t("action.remote") + " " + option.name,
                          onChange: () => toggleRemote(option.name),
                        }),
                        h("span", { className: "dgg-check-label" }, option.name),
                      ),
                    ),
              ),
            )
          : needsSelect
          ? h(
              "label",
              { className: "dgg-field" },
              h("span", { className: "dgg-field-label" }, selectLabel),
              h(
                "select",
                { className: "dgg-select", value: ref, "aria-label": selectLabel, onChange: (event) => setRef(event.target.value) },
                selectOptions.length === 0
                  ? h("option", { value: "" }, t("action.noTarget"))
                  : selectOptions.map((option) => h("option", { key: option.name, value: option.name }, option.name)),
              ),
            )
          : null,
        choices.length > 0
          ? h(
              "label",
              { className: "dgg-field" },
              h("span", { className: "dgg-field-label" }, t("action.mode")),
              h(
                "select",
                { className: "dgg-select", value: mode, "aria-label": t("action.mode"), onChange: (event) => setMode(event.target.value) },
                choices.map((choice) => h("option", { key: choice.value, value: choice.value }, t(choice.labelKey))),
              ),
            )
          : null,
        checkOptions.length > 0
          ? h(
              "div",
              { className: "dgg-checks" },
              checkOptions.map((option) =>
                h(
                  "label",
                  { className: "dgg-check", key: "check-" + option.key },
                  h("input", {
                    type: "checkbox",
                    checked: flags[option.key] === true,
                    onChange: () => setFlags((previous) => ({ ...previous, [option.key]: previous[option.key] !== true })),
                  }),
                  h("span", { className: "dgg-check-label" }, t(option.labelKey)),
                ),
              ),
            )
          : null,
        spec.requiresPreview === true
          ? h(
              "div",
              { className: "dgg-preview" },
              h("p", { className: "dgg-preview-title" }, t("action.cleanPreview")),
              awaitingPreview
                ? h("p", { className: "dgg-hint" }, t("action.previewing"))
                : preview.lines.length === 0
                  ? h("p", { className: "dgg-hint" }, t("action.cleanNothing"))
                  : h(
                      "ul",
                      { className: "dgg-preview-list" },
                      preview.lines.map((line, index) => h("li", { className: "dgg-preview-line", key: "preview-" + index }, line)),
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
              onClick: submit,
            },
            t("action.run"),
          ),
          h("button", { type: "button", className: "dgg-btn", onClick: onCancel }, t("action.cancel")),
          running === true ? h("span", { className: "dgg-inline-status" }, t("action.running")) : null,
        ),
      );
    }

    /**
     * Recursive directory tree of changed files (the "tree" view).
     *
     * Directories are collapsible and start expanded; every file is rendered by
     * the caller's `renderFile` so review checkboxes and diff expansion survive.
     * @param props - translate function, `buildFileTree` nodes and a file renderer.
     * @returns the tree.
     */
    function FileTree({ t, nodes, renderFile } = {}) {
      const [collapsed, setCollapsed] = React.useState({});
      const isOpen = (path) => collapsed[path] !== true;
      const toggle = (path) => setCollapsed((previous) => ({ ...previous, [path]: previous[path] !== true }));
      const renderNodes = (list) =>
        (Array.isArray(list) ? list : []).map((node) => {
          if (node === null || typeof node !== "object") return null;
          if (node.type === "dir") {
            const open = isOpen(node.path);
            return h(
              "div",
              { className: "dgg-tree-dir", key: "dir:" + node.path },
              h(
                "button",
                {
                  type: "button",
                  className: "dgg-tree-dir-head",
                  "aria-expanded": open,
                  "aria-label": t("tree.toggle") + " " + node.path,
                  onClick: () => toggle(node.path),
                },
                h("span", { className: "dgg-tree-caret", "aria-hidden": "true" }, open ? "▾" : "▸"),
                h("span", { className: "dgg-tree-dir-name", title: node.path }, node.name),
              ),
              open ? h("div", { className: "dgg-tree-children" }, renderNodes(node.children)) : null,
            );
          }
          return h("div", { className: "dgg-tree-file", key: "file:" + node.path }, typeof renderFile === "function" ? renderFile(node.file, node.path) : null);
        });
      return h("div", { className: "dgg-tree" }, renderNodes(nodes));
    }

    /**
     * Flat/tree segmented control for the file list.
     * @param props - translate function, current view and change callback.
     * @returns the segmented toggle.
     */
    function FileViewToggle({ t, value, onChange } = {}) {
      const current = value === "tree" ? "tree" : "flat";
      return h(
        "div",
        { className: "dgg-seg", role: "group", "aria-label": t("tree.view") },
        ["flat", "tree"].map((mode) =>
          h(
            "button",
            {
              key: mode,
              type: "button",
              className: "dgg-seg-btn" + (current === mode ? " dgg-seg-on" : ""),
              "aria-pressed": current === mode,
              onClick: () => {
                if (typeof onChange === "function") onChange(mode);
              },
            },
            t("tree." + mode),
          ),
        ),
      );
    }

    /**
     * Progress line and mark-all/clear controls above a file list.
     *
     * Renders nothing unless the review store answered (a UNAVAILABLE answer keeps
     * the control hidden entirely, without any error toast).
     * @param props - translate function, review state, files and callbacks.
     * @returns the review bar, or null when review is not available.
     */
    function ReviewBar({ t, review, files, onMarkAll, onClearReviews } = {}) {
      if (review === null || typeof review !== "object" || review.status !== "ready") return null;
      const total = Number.isSafeInteger(review.total) && review.total >= 0 ? review.total : 0;
      const reviewed = Number.isSafeInteger(review.reviewed) && review.reviewed >= 0 ? review.reviewed : 0;
      return h(
        "div",
        { className: "dgg-review-head" },
        h("span", { className: "dgg-review-progress", role: "status" }, t("review.progress", { reviewed, total })),
        h(
          "button",
          { type: "button", className: "dgg-btn", disabled: reviewed >= total, onClick: () => onMarkAll(files) },
          t("review.markAll"),
        ),
        h("button", { type: "button", className: "dgg-btn", disabled: reviewed === 0, onClick: onClearReviews }, t("review.clear")),
      );
    }

    /**
     * The review props for one file row (checkbox through `renderLeading`).
     * @param t - translate function.
     * @param review - review state.
     * @param file - host file record.
     * @param onToggle - per-file toggle callback.
     * @returns `{ reviewed, renderLeading }`, both undefined when review is hidden.
     */
    function reviewPropsFor(t, review, file, onToggle) {
      if (review === null || typeof review !== "object" || review.status !== "ready") return { reviewed: undefined, renderLeading: undefined };
      const path = file !== null && typeof file === "object" && typeof file.path === "string" ? file.path : "";
      const reviewed = path !== "" && Object.prototype.hasOwnProperty.call(review.files, path);
      return {
        reviewed,
        renderLeading: () => h(ReviewCheckbox, { t, reviewed, path, onToggle }),
      };
    }

    /**
     * One changed file with a lazily loaded, expandable diff.
     *
     * The same row serves all three diff scopes: a commit's files (`commit`), the
     * working tree (`staged`/`unstaged`) and a two-commit comparison (`compare`).
     * @param props - session, scope, file record and the shared diff cache.
     * @returns the file row and its diff.
     */
    function FileRow({ t, sessionId, hash, file, cache, scope = "commit", base, head, emptyHintKey, onDiscard, renderLeading, reviewed, repoPath, enhancedAccessibility } = {}) {
      const record = file !== null && typeof file === "object" ? file : {};
      const filePath = typeof record.path === "string" ? record.path : "";
      const oldPath = typeof record.oldPath === "string" && record.oldPath !== "" ? record.oldPath : undefined;
      const status = fileStatus(record);
      const [expanded, setExpanded] = React.useState(false);
      const [state, setState] = React.useState({ status: "idle", value: null, error: null });
      React.useEffect(() => {
        if (!expanded) return undefined;
        const store = cache !== null && typeof cache === "object" ? cache : null;
        const key = diffCacheKey({ scope, hash, base, head, file: filePath, oldPath, path: repoPath });
        if (store !== null && isMapLike(store.current) && store.current.has(key)) {
          setState({ status: "ready", value: store.current.get(key), error: null });
          return undefined;
        }
        const controller = new AbortController();
        let active = true;
        setState({ status: "loading", value: null, error: null });
        postJson(
          "diff",
          diffRequest({ sessionId, scope, hash, base, head, file: filePath, oldPath, status, path: repoPath }),
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
      }, [expanded, sessionId, scope, hash, base, head, filePath, oldPath, status, cache, repoPath]);

      const added = Number.isFinite(record.added) ? record.added : null;
      const removed = Number.isFinite(record.removed) ? record.removed : null;
      const counts = [added === null ? "" : "+" + added, removed === null ? "" : "−" + removed].filter((part) => part !== "").join(" ");
      const toggleLabel = (expanded ? t("detail.hideDiff") : t("detail.showingDiff")) + " " + filePath;

      const rowClass = "dgg-file" + (reviewed === true ? " dgg-file-reviewed" : reviewed === false ? " dgg-file-reviewable" : "");
      return h(
        "div",
        { className: rowClass },
        h(
          "div",
          { className: "dgg-file-line" },
          typeof renderLeading === "function" ? renderLeading(record) : null,
          h(
          "button",
          {
            type: "button",
            className: "dgg-file-head",
            "aria-expanded": expanded,
            "aria-label": toggleLabel,
            onClick: () => setExpanded((value) => !value),
          },
          h("span", { className: "dgg-st dgg-st-" + status, "aria-hidden": enhancedAccessibility === true ? undefined : "true" }, status),
          enhancedAccessibility === true ? h("span", { className: "dgg-st-text" }, t(fileStatusKey(status))) : null,
          h("span", { className: "dgg-file-path", title: filePath }, filePath),
          typeof record.oldPath === "string" && record.oldPath !== "" ? h("span", { className: "dgg-file-old", title: record.oldPath }, "← " + record.oldPath) : null,
          h("span", { className: "dgg-file-counts" }, counts),
          h("span", { className: "dgg-file-toggle", "aria-hidden": "true" }, expanded ? "▾" : "▸"),
        ),
        ),
        typeof onDiscard === "function"
          ? h(
              "div",
              { className: "dgg-file-actions" },
              h("button", { type: "button", className: "dgg-btn", onClick: () => onDiscard(record) }, t("action.resetFileToRevision")),
            )
          : null,
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
    function UncommittedView({ t, value, sessionId, cache, repoPath, presentation, dialog, dirty, running, onStash, onStashUntracked, onClean, onReset, onDiscard, onCompareWorking, onCancelDialog, onConfirmDialog } = {}) {
      const groups = uncommittedGroups(value);
      const summary = uncommittedSummary(value);
      const settings = presentation !== null && typeof presentation === "object" ? presentation : null;
      const canCompare = typeof onCompareWorking === "function";
      return h(
        "div",
        { className: "dgg-uncommitted" },
        h("h2", { className: "dgg-subject-lg" }, t("uncommitted.title")),
        h(
          "div",
          { className: "dgg-stats" },
          t("uncommitted.counts", { staged: summary.staged, unstaged: summary.unstaged, untracked: summary.untracked }),
        ),
        h(
          "div",
          { className: "dgg-actions" },
          h("button", { type: "button", className: "dgg-btn", disabled: running === true || !canCompare, onClick: onCompareWorking }, t("uncommitted.compareWorking")),
          h("button", { type: "button", className: "dgg-btn", disabled: running === true, onClick: onStash }, t("action.stashUncommitted")),
          h("button", { type: "button", className: "dgg-btn", disabled: running === true, onClick: onStashUntracked }, t("action.stashUntracked")),
          h("button", { type: "button", className: "dgg-btn", disabled: running === true, onClick: onClean }, t("action.cleanUntracked")),
          h("button", { type: "button", className: "dgg-btn dgg-btn-danger", disabled: running === true, onClick: onReset }, t("action.resetUncommitted")),
        ),
        dialog !== null && typeof dialog === "object"
          ? h(ActionDialog, {
              key: dialog.kind + "|" + (dialog.requestedRef || "") + "|" + (dialog.hash || ""),
              t,
              dialog,
              dirty,
              running,
              onCancel: onCancelDialog,
              onConfirm: onConfirmDialog,
            })
          : null,
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
                      key: fileRowKey(file, index),
                      t,
                      sessionId,
                      file,
                      scope: group.scope,
                      cache,
                      repoPath,
                      enhancedAccessibility: settings !== null && settings.enhancedAccessibility === true,
                      emptyHintKey: group.hintKey,
                      onDiscard,
                    }),
                  ),
                ),
              ),
            ),
      );
    }

    /**
     * One comparison: two commits, or a commit against the working tree.
     *
     * The working-tree form (`pair.working === true`) fetches `/compare` with
     * `{ base, working: true }`, labels the right-hand side “工作区” instead of a
     * bogus head hash, hides the swap control (there is nothing to swap to) and
     * expands each file through the `working` diff scope keyed by the base commit.
     * @param props - comparison pair, `compare` route state, session and cache.
     * @returns the comparison pane.
     */
    function CompareView({ t, pair, value, status, error, sessionId, cache, repoPath, presentation, review, onToggleReviewed, onMarkAll, onClearReviews, onSwap, onExit, onRetry } = {}) {
      const spec = pair !== null && typeof pair === "object" ? pair : { base: "", head: "" };
      const record = value !== null && typeof value === "object" ? value : {};
      const working = spec.working === true || record.working === true;
      const baseHash = typeof spec.base === "string" && spec.base !== "" ? spec.base : typeof record.base === "string" ? record.base : "";
      // The working diff is keyed by the resolved base commit when the host answered.
      const workingBase = typeof record.base === "string" && record.base !== "" ? record.base : baseHash;
      const headHash = working ? "" : typeof spec.head === "string" ? spec.head : "";
      const baseAbbrev = typeof record.baseAbbrev === "string" && record.baseAbbrev !== "" ? record.baseAbbrev : baseHash.slice(0, 7);
      const headAbbrev = working
        ? t("compare.workingTree")
        : typeof record.headAbbrev === "string" && record.headAbbrev !== "" ? record.headAbbrev : headHash.slice(0, 7);
      const files = Array.isArray(record.files) ? record.files : [];
      const groups = groupFiles(files);
      const stats = record.stats !== null && typeof record.stats === "object" ? record.stats : null;
      const insertions = stats !== null && Number.isFinite(stats.insertions) ? stats.insertions : 0;
      const deletions = stats !== null && Number.isFinite(stats.deletions) ? stats.deletions : 0;
      const fileCount = stats !== null && Number.isFinite(stats.files) ? stats.files : files.length;
      const settings = presentation !== null && typeof presentation === "object" ? presentation : presentationOf(null);
      // The host's file-view default only seeds the toggle; the reader can still switch.
      const [fileView, setFileView] = React.useState(() => fileViewOf(settings));
      const compactFolders = compactFoldersOf(settings);
      const renderFile = (file, index) => h(FileRow, {
        key: fileRowKey(file, index),
        t,
        sessionId,
        file,
        scope: working ? "working" : "compare",
        ...(working ? { hash: workingBase } : { base: baseHash, head: headHash }),
        cache,
        repoPath,
        enhancedAccessibility: settings.enhancedAccessibility === true,
        ...reviewPropsFor(t, review, file, onToggleReviewed),
      });
      let body;
      if (status === "error") body = h(ErrorState, { t, message: error, onRetry });
      else if (value === null) body = h(LoadingState, { t });
      else if (groups.length === 0) body = h("p", { className: "dgg-hint" }, t("compare.empty"));
      else if (fileView === "tree") {
        body = h(FileTree, { t, nodes: buildFileTree(files, { compact: compactFolders }).nodes, renderFile });
      } else {
        body = h(
          "div",
          { className: "dgg-files" },
          groups.map(([statusLetter, group]) =>
            h(
              "div",
              { className: "dgg-group", key: statusLetter },
              h("h4", { className: "dgg-group-title", title: statusLetter }, statusLetter),
              group.map((file, index) => renderFile(file, index)),
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
          working
            ? null
            : h(
                "button",
                { type: "button", className: "dgg-btn", title: t("compare.swap"), "aria-label": t("compare.swap"), onClick: onSwap },
                "⇄",
              ),
          h("span", { className: "dgg-k" }, t("compare.head")),
          working
            ? h("span", { className: "dgg-compare-abbrev dgg-compare-working" }, headAbbrev)
            : h("code", { className: "dgg-compare-abbrev", title: headHash }, headAbbrev),
          h("button", { type: "button", className: "dgg-btn", onClick: onExit }, t("compare.exit")),
        ),
        h("h2", { className: "dgg-subject-lg" }, working ? t("compare.workingTitle") : t("compare.title")),
        h("div", { className: "dgg-stats" }, t("detail.stats", { files: fileCount, insertions, deletions })),
        h(ReviewBar, { t, review, files, onMarkAll, onClearReviews }),
        value !== null ? h("div", { className: "dgg-file-views" }, h("span", null), h(FileViewToggle, { t, value: fileView, onChange: setFileView })) : null,
        body,
      );
    }

    /**
     * Detail view: metadata, refs, stats, actions and the changed files.
     * @param props - commit detail value, refs, dialog state and callbacks.
     * @returns the detail pane.
     */
    function DetailView(props) {
      const { t, commit, refIndex, branches, dirty, dialog, run, copy, sessionId, onOpenDialog, onCancelDialog, onConfirmDialog, onRunFetch, onSelectCommit, onCopy, onRefMenu, diffCache, dropDisabledReason, presentation, repoPath, review, onToggleReviewed, onMarkAll, onClearReviews } = props;
      const record = commit !== null && typeof commit === "object" ? commit : {};
      const hash = typeof record.hash === "string" ? record.hash : "";
      const abbrev = typeof record.abbrev === "string" && record.abbrev !== "" ? record.abbrev : hash.slice(0, 7);
      const lang = currentLanguage();
      const parents = Array.isArray(record.parents) ? record.parents.filter((parent) => typeof parent === "string" && parent !== "") : [];
      const files = Array.isArray(record.files) ? record.files : [];
      const groups = groupFiles(files);
      const stats = record.stats !== null && typeof record.stats === "object" ? record.stats : null;
      const fileCount = stats !== null && Number.isFinite(stats.files) ? stats.files : files.length;
      const insertions = stats !== null && Number.isFinite(stats.insertions) ? stats.insertions : 0;
      const deletions = stats !== null && Number.isFinite(stats.deletions) ? stats.deletions : 0;
      const running = run !== null && typeof run === "object" && run.phase === "running";
      const copyLabel = copy !== null && typeof copy === "object" && copy.text === hash ? (copy.state === "copied" ? t("toolbar.copied") : copy.state === "failed" ? t("toolbar.copyFailed") : t("toolbar.copyHash")) : t("toolbar.copyHash");
      const settings = presentation !== null && typeof presentation === "object" ? presentation : presentationOf(null);
      const refLayout = layoutRefChips(record.refs, refIndex, 12, settings);
      const refs = refLayout.chips;
      const badge = settings.showSignature === true ? signatureBadge(record.signature) : null;
      // The host's file-view default only seeds the toggle; the reader can still switch.
      const [fileView, setFileView] = React.useState(() => fileViewOf(settings));
      const compactFolders = compactFoldersOf(settings);
      const autoCenter = autoCenterDetailsOf(settings);
      const rootRef = React.useRef(null);
      // `autoCenterDetails`: scroll the opened detail into view. The fake-React test
      // harness never runs effects, so this is covered through scrollDetailIntoView
      // plus a source-level wiring assertion.
      React.useEffect(() => {
        scrollDetailIntoView(rootRef.current, autoCenter);
      }, [autoCenter, hash]);
      // Column width dragging is out of scope; the sidebar is too narrow for a table.
      const renderFile = (file, index) => h(FileRow, {
        key: fileRowKey(file, index),
        t,
        sessionId,
        hash,
        file,
        cache: diffCache,
        repoPath,
        enhancedAccessibility: settings.enhancedAccessibility === true,
        ...reviewPropsFor(t, review, file, onToggleReviewed),
      });
      const actions = [
        "checkoutCommit", "checkoutBranch", "createBranch", "merge", "rebase", "cherryPick",
        "revert", "dropCommit", "resetToCommit", "createTag", "deleteTag", "deleteBranch", "fetch",
      ];

      return h(
        "div",
        { className: "dgg-detail", ref: rootRef },
        h(
          "h2",
          { className: "dgg-subject-lg" },
          typeof record.subject === "string" && record.subject !== "" ? h(RichText, { text: record.subject, presentation: settings }) : abbrev,
        ),
        typeof record.body === "string" && record.body.trim() !== "" ? h("pre", { className: "dgg-body" }, h(RichText, { text: record.body, presentation: settings })) : null,
        h(
          "div",
          { className: "dgg-kv" },
          h("span", { className: "dgg-k" }, t("detail.author")),
          h("span", { className: "dgg-v" }, personLine(record.authorName, record.authorEmail, record.authorTime, lang, settings)),
          h("span", { className: "dgg-k" }, t("detail.committer")),
          h("span", { className: "dgg-v" }, personLine(record.committerName, record.committerEmail, record.committerTime, lang, settings)),
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
        badge !== null ? h(SignatureBadge, { t, signature: record.signature }) : null,
        refs.length > 0
          ? h(RefChips, {
              chips: refs,
              t,
              buttons: true,
              tagsOnRight: refLayout.tagsOnRight,
              alignedToGraph: refLayout.alignedToGraph,
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
            actions.map((kind) => {
              const blocked = kind === "dropCommit" && typeof dropDisabledReason === "string" && dropDisabledReason !== "";
              return h(
                "button",
                {
                  key: kind,
                  type: "button",
                  className: "dgg-btn" + (blocked ? " dgg-btn-blocked" : ""),
                  disabled: running === true || blocked,
                  title: blocked ? t(dropDisabledReason) : undefined,
                  onClick: () => (kind === "fetch" ? onRunFetch() : onOpenDialog(kind)),
                },
                t("action." + kind),
              );
            }),
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
          h(
            "div",
            { className: "dgg-file-views" },
            h("h3", { className: "dgg-section-title" }, t("detail.files")),
            h(FileViewToggle, { t, value: fileView, onChange: setFileView }),
          ),
          h(ReviewBar, { t, review, files, onMarkAll, onClearReviews }),
          groups.length === 0
            ? h("p", { className: "dgg-hint" }, t("detail.noFiles"))
            : fileView === "tree"
              ? h(FileTree, { t, nodes: buildFileTree(files, { compact: compactFolders }).nodes, renderFile })
              : h(
                  "div",
                  { className: "dgg-files" },
                  groups.map(([status, group]) =>
                    h(
                      "div",
                      { className: "dgg-group", key: status },
                      h("h4", { className: "dgg-group-title", title: status }, status),
                      group.map((file, index) => renderFile(file, index)),
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
      /** Find scope: the loaded page (default, in-page matching) or all history. */
      const [findScope, setFindScope] = React.useState(FIND_SCOPE_PAGE);
      /** Branch glob input text; parsed/compiled by `parseGlobInput`. */
      const [globText, setGlobText] = React.useState("");
      /** Full-history search state `{ status, commits, count, hasMore, capped, … }`. */
      const [search, setSearch] = React.useState(EMPTY_SEARCH);
      /** The presentation's `customBranchGlobPatterns` pre-fills the input once. */
      const globPrefilled = React.useRef(false);
      const searchController = React.useRef(null);
      const searchDebouncer = React.useRef(null);
      if (searchDebouncer.current === null) searchDebouncer.current = createDebouncer(SEARCH_DEBOUNCE_MS);
      const [filterOpen, setFilterOpen] = React.useState(false);
      /** Explicit branch selection, or null for "all branches" (today's behavior). */
      const [branchSelection, setBranchSelection] = React.useState(null);
      const [order, setOrder] = React.useState("date");
      /** Column visibility for the commit-row meta line. Width dragging is out of scope:
       *  the right sidebar is 380–520 px wide and has no resizable table. */
      const [columns, setColumns] = React.useState(() => ({ ...DEFAULT_COLUMNS }));
      /** Bumped by Ctrl/Cmd+S so the list scrolls the targeted stash commit into view. */
      const [stashScroll, setStashScroll] = React.useState({ hash: "", key: 0 });
      /** Hover/focus tooltip state `{ hash, status, data, error, x, y }`. */
      const [hover, setHover] = React.useState(null);
      /** Bumped by Ctrl/Cmd+H so the list scrolls its HEAD row into view. */
      const [scrollHeadKey, setScrollHeadKey] = React.useState(0);
      /** Open tag-details panel `{ name, status, value, error }`. */
      const [tagDetails, setTagDetails] = React.useState(null);
      /** Remote-management panel `{ open, status, value, error }`. */
      const [remotesOpen, setRemotesOpen] = React.useState(false);
      /** `remotes` route state; shared by dialogs and the remote panel. */
      const [remotesData, setRemotesData] = React.useState({ status: "idle", value: null, error: null });
      /** Repository discovery `{ status, value, error }` for the toolbar selector. */
      const [repositories, setRepositories] = React.useState({ status: "idle", value: null, error: null });
      /** Bumped to re-run discovery when the workspace changes. */
      const [repositoriesKey, setRepositoriesKey] = React.useState(0);
      /** Selected absolute repository path, remembered for the tab's lifetime. */
      const [selectedRepo, setSelectedRepo] = React.useState("");
      /** Review marks for the open detail/comparison `{ status, key, files, total, reviewed }`. */
      const [review, setReview] = React.useState({ status: "idle", key: "", files: {}, total: 0, reviewed: 0 });
      const [dialog, setDialog] = React.useState(null);
      const [run, setRun] = React.useState(null);
      const [copy, setCopy] = React.useState({ state: "idle", text: "" });
      const [summary, setSummary] = React.useState(null);
      const [compare, setCompare] = React.useState(null);
      const [compareData, setCompareData] = React.useState({ status: "idle", value: null, error: null });
      /** Branch awaiting a force-delete decision after a not-merged refusal. */
      const forceRef = React.useRef(null);
      const repositoriesRef = React.useRef(null);
      /** Cursor into the displayed stash-bearing commits for Ctrl/Cmd+S. */
      const stashPos = React.useRef(-1);
      const actionController = React.useRef(null);
      const diffCache = React.useRef(new Map());
      const menuRef = React.useRef(null);
      /** Tab root, used to tell whether the panel currently owns focus. */
      const rootRef = React.useRef(null);
      /** Latest global keydown handler, so the document listener never goes stale. */
      const globalHandlerRef = React.useRef(null);
      /** Applies the presentation's initial column visibility exactly once. */
      const columnsInitialized = React.useRef(false);
      /** Applies the presentation's `initialLoad` page size exactly once. */
      const paginationInitialized = React.useRef(false);
      const hoverTimer = React.useRef(null);
      const containsCache = React.useRef(null);
      const containsInFlight = React.useRef(null);
      const containsControllers = React.useRef(null);
      if (containsCache.current === null) {
        containsCache.current = createLruCache(CONTAINS_CACHE_LIMIT);
        containsInFlight.current = new Map();
        containsControllers.current = new Set();
      }

      const value = graph.value;
      const dirty = value !== null && typeof value === "object" && value.status !== null && typeof value.status === "object" && Number.isFinite(value.status.dirty) ? value.status.dirty : 0;
      const commits = value !== null && typeof value === "object" && Array.isArray(value.commits) ? value.commits : [];
      const pageRefs = value !== null && typeof value === "object" && Array.isArray(value.refs) ? value.refs : [];
      const running = run !== null && typeof run === "object" && run.phase === "running";
      const isRepo = value !== null && typeof value === "object" && value.isRepo === true;
      const tagName = tagDetails !== null && typeof tagDetails === "object" && typeof tagDetails.name === "string" ? tagDetails.name : "";
      const repoInfo = React.useMemo(() => repoOptions(repositories.value), [repositories.value]);
      const workspacePath = value !== null && typeof value === "object" && typeof value.workspacePath === "string" ? value.workspacePath : "";
      // Review marks follow the open detail/comparison; the host's total is authoritative.
      // A working-tree comparison has no review form on the host yet (`/review` keys on
      // two commit-ish endpoints), so it hides the control; the reserved key is
      // `reviewKey("working", base, base)`.
      const reviewScope = compare !== null
        ? compare.working === true
          ? null
          : compareData.value !== null && typeof compareData.value === "object"
            ? {
                kind: "compare",
                base: typeof compare.base === "string" ? compare.base : "",
                head: typeof compare.head === "string" ? compare.head : "",
                files: Array.isArray(compareData.value.files) ? compareData.value.files : [],
              }
            : null
        : detail.value !== null && typeof detail.value === "object" && typeof detail.value.hash === "string"
          ? { kind: "commit", base: detail.value.hash, head: detail.value.hash, files: Array.isArray(detail.value.files) ? detail.value.files : [] }
          : null;
      const reviewScopeKey = reviewScope === null ? "" : reviewKey(reviewScope.kind, reviewScope.base, reviewScope.head);

      const branchOptions = React.useMemo(() => branchFilterOptions(pageRefs), [pageRefs]);
      // Effective branch filter: a valid glob filters branch names (or unions with
      // an explicit checkbox selection); an empty effective set suppresses the
      // request instead of falling back to “all commits”.
      const globParsed = React.useMemo(() => parseGlobInput(globText), [globText]);
      const branchFilter = React.useMemo(
        () => branchFilterState(branchSelection, globParsed.patterns, branchOptions),
        [branchSelection, globParsed, branchOptions],
      );
      const branchNoMatch = branchFilter.noMatch === true;
      // `branches` is only sent for an explicit subset; null keeps today's body.
      const branchRequest = React.useMemo(() => branchRequestValue(branchFilter.union, branchOptions), [branchFilter, branchOptions]);
      const branchKey = branchRequestKey(branchRequest, branchNoMatch);
      const find = React.useMemo(() => filterCommits(commits, findQuery), [commits, findQuery]);
      const filterActive = typeof findQuery === "string" && findQuery.trim() !== "";
      const findMode = findModeOf(findScope, findQuery);
      const searchActive = findMode === "search";
      const displayedIndices = React.useMemo(
        () => (filterActive ? find.indices : commits.map((unused, index) => index)),
        [filterActive, find.indices, commits],
      );
      const activeMatchIndex = find.matches === 0 ? -1 : Math.min(Math.max(findMatch, 0), find.matches - 1);
      const activeHash = activeMatchIndex === -1 ? "" : (() => {
        const commit = commits[find.indices[activeMatchIndex]];
        return commit !== null && typeof commit === "object" && typeof commit.hash === "string" ? commit.hash : "";
      })();

      // The graph page: aborted when the session, the page size or a refresh supersedes it.
      React.useEffect(() => {
        // A valid glob that matched no branch suppresses the request entirely:
        // the effective set is empty, and omitting `branches` would mean “all
        // commits”. `branchKey` carries the sentinel, so transitions re-run this
        // effect without falling back to an unfiltered page.
        if (branchKey === NO_MATCH_BRANCH_KEY) return undefined;
        const controller = new AbortController();
        let active = true;
        setGraph((previous) => ({
          status: previous.value === null ? "loading" : "refreshing",
          value: previous.value,
          error: null,
        }));
        postJson("graph", graphRequest({ sessionId, limit, branches: branchRequest, order, path: selectedRepo }), controller.signal).then(
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
      }, [sessionId, limit, reloadKey, branchKey, order, selectedRepo]);

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
        postJson(
          uncommitted ? "uncommitted" : "commit",
          withRepoPath(uncommitted ? { sessionId } : { sessionId, hash }, selectedRepo),
          controller.signal,
        ).then(
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
      }, [sessionId, selected, reloadKey, selectedRepo]);

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
        postJson("uncommitted", withRepoPath({ sessionId }, selectedRepo), controller.signal).then(
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
      }, [sessionId, reloadKey, dirty, value, selectedRepo]);

      // The open comparison (two commits, or the working tree against one commit),
      // kept visible while a refresh is in flight.
      React.useEffect(() => {
        if (compare === null) {
          setCompareData({ status: "idle", value: null, error: null });
          return undefined;
        }
        const working = compare.working === true;
        const controller = new AbortController();
        let active = true;
        setCompareData((previous) => {
          const reusable = previous.value !== null && typeof previous.value === "object" &&
            previous.value.base === compare.base &&
            (working ? previous.value.working === true : previous.value.head === compare.head);
          return { status: reusable ? "refreshing" : "loading", value: reusable ? previous.value : null, error: null };
        });
        postJson(
          "compare",
          compareRequest({ sessionId, base: compare.base, head: compare.head, working, path: selectedRepo }),
          controller.signal,
        ).then(
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
      }, [sessionId, compare, reloadKey, selectedRepo]);

      // The remotes list powers the remote panel and the pull/push dialogs.
      React.useEffect(() => {
        if (!isRepo) {
          setRemotesData({ status: "idle", value: null, error: null });
          return undefined;
        }
        const controller = new AbortController();
        let active = true;
        setRemotesData((previous) => ({ status: previous.value === null ? "loading" : "refreshing", value: previous.value, error: null }));
        postJson("remotes", withRepoPath({ sessionId }, selectedRepo), controller.signal).then(
          (next) => {
            if (active) setRemotesData({ status: "ready", value: next, error: null });
          },
          (error) => {
            if (!active || isAbort(error)) return;
            setRemotesData((previous) => ({ status: "error", value: previous.value, error: messageOf(error) }));
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [sessionId, reloadKey, isRepo, selectedRepo]);

      // The tag details panel loads one tag through the new read route.
      React.useEffect(() => {
        if (tagName === "") return undefined;
        const controller = new AbortController();
        let active = true;
        postJson("tag", withRepoPath({ sessionId, name: tagName }, selectedRepo), controller.signal).then(
          (next) => {
            if (active) setTagDetails((previous) => (previous === null ? previous : { ...previous, status: "ready", value: next, error: null }));
          },
          (error) => {
            if (!active || isAbort(error)) return;
            setTagDetails((previous) => (previous === null ? previous : { ...previous, status: "error", value: null, error: messageOf(error) }));
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [sessionId, tagName, reloadKey, selectedRepo]);

      // Discover sibling repositories for the toolbar selector. An empty list is
      // a normal state; the label simply stays a label.
      React.useEffect(() => {
        const controller = new AbortController();
        let active = true;
        postJson("repos", { sessionId }, controller.signal).then(
          (next) => {
            if (!active) return;
            const info = repoOptions(next);
            const previousWorkspace = repositoriesRef.current;
            if (previousWorkspace !== null && previousWorkspace !== "" && info.workspacePath !== "" && previousWorkspace !== info.workspacePath) {
              setSelectedRepo("");
            }
            if (info.workspacePath !== "") repositoriesRef.current = info.workspacePath;
            setRepositories({ status: "ready", value: next, error: null });
          },
          (error) => {
            if (!active || isAbort(error)) return;
            setRepositories({ status: "error", value: null, error: messageOf(error) });
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [sessionId, repositoriesKey]);

      // The workspace moved: forget the previous selection and rediscover.
      React.useEffect(() => {
        if (workspacePath === "") return;
        if (repositoriesRef.current === null || repositoriesRef.current === workspacePath) return;
        setSelectedRepo("");
        setRepositoriesKey((key) => key + 1);
      }, [workspacePath]);

      // Review marks for the open detail/comparison. A UNAVAILABLE store hides the
      // control entirely; any other failure reports in the feedback bar.
      React.useEffect(() => {
        if (reviewScopeKey === "" || reviewScope === null) {
          setReview({ status: "idle", key: "", files: {}, total: 0, reviewed: 0 });
          return undefined;
        }
        const scope = reviewScope;
        const controller = new AbortController();
        let active = true;
        setReview({ status: "loading", key: reviewScopeKey, files: {}, total: 0, reviewed: 0 });
        postJson(
          "review",
          reviewRequest({ sessionId, action: "read", kind: scope.kind, base: scope.base, head: scope.head }),
          controller.signal,
        ).then(
          (next) => {
            if (active) setReview({ status: "ready", key: reviewScopeKey, ...reviewStateOf(next) });
          },
          (error) => {
            if (!active || isAbort(error)) return;
            if (isUnavailableError(error)) {
              setReview({ status: "unavailable", key: reviewScopeKey, files: {}, total: 0, reviewed: 0 });
              return;
            }
            setReview({ status: "error", key: reviewScopeKey, files: {}, total: 0, reviewed: 0 });
            setRun({ kind: "review", phase: "error", message: t("review.failed", { message: messageOf(error) }), detail: "", expanded: false });
          },
        );
        return () => {
          active = false;
          controller.abort();
        };
      }, [sessionId, reviewScopeKey]);

      // A different repository invalidates the tooltip cache (it is keyed by path
      // as well, but dropping it keeps memory bounded when switching often).
      React.useEffect(() => {
        containsCache.current.clear();
        containsInFlight.current.clear();
        setHover(null);
      }, [selectedRepo]);

      // Abort a running repository action when the tab unmounts.
      React.useEffect(
        () => () => {
          const controller = actionController.current;
          if (controller !== null && typeof controller.abort === "function") controller.abort();
        },
        [],
      );

      // Abort an in-flight full-history search and its debounce on unmount.
      React.useEffect(
        () => () => {
          const controller = searchController.current;
          if (controller !== null && typeof controller.abort === "function") controller.abort();
          if (searchDebouncer.current !== null) searchDebouncer.current.cancel();
        },
        [],
      );

      // Clear the transient “copied”/“copy failed” feedback.
      React.useEffect(() => {
        if (copy.state === "idle") return undefined;
        const timer = setTimeout(() => setCopy({ state: "idle", text: "" }), 1800);
        return () => clearTimeout(timer);
      }, [copy.state, copy.text]);

      // One `/contains` request may be in flight per hash; abort them all on unmount.
      React.useEffect(
        () => () => {
          for (const controller of containsControllers.current) controller.abort();
          if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
        },
        [],
      );

      // The tooltip is anchored to the viewport, so scrolling or resizing hides it
      // instead of leaving it floating over different content. `pointer-events:none`
      // means it can never intercept the wheel or a click.
      React.useEffect(() => {
        if (hover === null) return undefined;
        const win = typeof window !== "undefined" ? window : null;
        if (win === null || typeof win.addEventListener !== "function") return undefined;
        const hide = () => {
          if (hoverTimer.current !== null) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
          }
          setHover(null);
        };
        win.addEventListener("scroll", hide, true);
        win.addEventListener("resize", hide);
        return () => {
          win.removeEventListener("scroll", hide, true);
          win.removeEventListener("resize", hide);
        };
      }, [hover]);

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

      const stashRefsByHash = React.useMemo(() => {
        const byHash = new Map();
        for (const ref of pageRefs) {
          if (ref === null || typeof ref !== "object" || refKind(ref) !== "stash" || typeof ref.hash !== "string" || ref.hash === "") continue;
          const label = typeof ref.shortName === "string" && ref.shortName !== "" ? ref.shortName : typeof ref.name === "string" ? ref.name.replace(/^refs\//, "") : "";
          if (label === "") continue;
          const list = byHash.get(ref.hash);
          if (list === undefined) byHash.set(ref.hash, [label]);
          else list.push(label);
        }
        return byHash;
      }, [pageRefs]);

      const remoteOptions = React.useMemo(() => {
        const record = remotesData.value !== null && typeof remotesData.value === "object" ? remotesData.value : {};
        const list = Array.isArray(record.remotes) ? record.remotes : [];
        return list
          .filter((remote) => remote !== null && typeof remote === "object" && typeof remote.name === "string" && remote.name !== "")
          .map((remote) => ({ name: remote.name }));
      }, [remotesData.value]);

      const presentation = React.useMemo(() => presentationOf(value), [value]);
      /** Resolved shortcuts (presentation-driven, fallback to the pre-wave-8 map). */
      const shortcuts = presentation.shortcuts;

      // Pagination from the presentation: `initialLoad` seeds the first request and
      // `loadMore` is the step for every later request. Absent values keep today's
      // PAGE_SIZE fallback. The page size is applied once, when the real graph value
      // (and with it the presentation) first arrives.
      const pagination = paginationOf(presentation);
      React.useEffect(() => {
        if (paginationInitialized.current || value === null) return;
        paginationInitialized.current = true;
        if (pagination.initial !== PAGE_SIZE) setLimit(pagination.initial);
      }, [pagination.initial, value]);

      // The host's default column visibility seeds the toggles once; afterwards the
      // reader's own choices win (and a refresh must not reset them).
      React.useEffect(() => {
        if (columnsInitialized.current || value === null) return;
        columnsInitialized.current = true;
        setColumns(columnsOf(presentation));
      }, [presentation, value]);

      /**
       * HEAD as reported by the graph value, and its hash.
       *
       * Declared before every memo/effect that reads them: a dependency array is
       * evaluated at call time, so a later `const` would throw a TDZ ReferenceError
       * on the first render (the fake-React harness cannot catch that — see the
       * GitGraphBody render smoke test).
       */
      const head = value !== null && typeof value === "object" && value.head !== null && typeof value.head === "object" ? value.head : null;
      const headHash = head !== null && typeof head.hash === "string" ? head.hash : "";

      // `muteNonAncestors`: de-emphasize (never filter) commits outside HEAD's
      // loaded ancestry.
      const mutedHashes = React.useMemo(
        () => (presentation.muteNonAncestors === true ? nonAncestorHashes(commits, headHash) : null),
        [presentation, commits, headHash],
      );
      const globalShortcutsEnabled = presentation.globalShortcuts === true;

      // Opt-in document-level shortcut scope. Only the last mounted panel handles
      // an event (module-level registry); the listener is ref-counted and always
      // removed on unmount. With the flag off this effect does nothing.
      React.useEffect(() => {
        if (globalShortcutsEnabled !== true) return undefined;
        const doc = typeof document !== "undefined" ? document : null;
        if (doc === null || typeof doc.addEventListener !== "function") return undefined;
        const disposePanel = registerGlobalShortcutPanel((event) => {
          const handler = globalHandlerRef.current;
          return typeof handler === "function" ? handler(event) === true : false;
        });
        const disposeListener = installGlobalShortcutListener(doc, dispatchGlobalShortcut);
        return () => {
          disposePanel();
          disposeListener();
        };
      }, [globalShortcutsEnabled]);

      // Keep the registered dispatcher pointed at the latest render's state.
      React.useEffect(() => {
        globalHandlerRef.current = handleGlobalKeyDown;
      });

      // Pre-fill the glob input once from the presentation, when the host sends
      // `customBranchGlobPatterns`; its absence leaves the input empty.
      React.useEffect(() => {
        if (globPrefilled.current) return;
        const prefill = globPrefillText(presentation);
        if (prefill === "") return;
        globPrefilled.current = true;
        setGlobText(prefill);
      }, [presentation]);

      // Full-history search. In-page mode is untouched and performs no request;
      // 全部历史 debounces the typed query (≥250 ms) and aborts superseded pages.
      // Clearing the query or leaving the mode resets the state and aborts.
      React.useEffect(() => {
        const debouncer = searchDebouncer.current;
        const mode = findModeOf(findScope, findQuery);
        if (mode !== "search") {
          debouncer.cancel();
          const controller = searchController.current;
          if (controller !== null && typeof controller.abort === "function") controller.abort();
          searchController.current = null;
          setSearch(EMPTY_SEARCH);
          return undefined;
        }
        const query = findQuery.trim();
        debouncer.schedule(() => runSearch(query, 0, false));
        return () => debouncer.cancel();
      }, [findScope, findQuery, sessionId, selectedRepo, reloadKey]);

      const summaryCounts = React.useMemo(() => uncommittedSummary(summary, dirty), [summary, dirty]);
      const listModel = React.useMemo(() => buildListModel(commits, summaryCounts), [commits, summaryCounts]);
      const layout = listModel.layout;

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
      const detailHash = detail.value !== null && typeof detail.value === "object" && typeof detail.value.hash === "string" ? detail.value.hash : "";
      /** Why dropping the open commit is refused (HEAD or another commit depends on it). */
      const detailDropReason = detailHash === "" ? "" : detailHash === headHash ? "menu.dropHead" : commitHasChildren(commits, detailHash) ? "menu.dropHasChildren" : "";
      const detailAbbrev = detail.value !== null && typeof detail.value === "object" && typeof detail.value.abbrev === "string" ? detail.value.abbrev : "";
      const compareBaseHash = selectedHash !== "" ? selectedHash : base;
      const compareBaseAbbrev = selectedHash !== "" ? (detailAbbrev !== "" ? detailAbbrev : selectedHash.slice(0, 7)) : baseAbbrev;
      const hasRemotes = remoteOptions.length > 0 || pageRefs.some((ref) => ref !== null && typeof ref === "object" && refKind(ref) === "remote");
      const refMenuContext = { currentBranch, busy: running, hasRemotes };
      const commitMenuContext = { baseHash: compareBaseHash, baseAbbrev: compareBaseAbbrev, busy: running, headHash, commits };
      const menuItems = contextMenu === null
        ? []
        : visibleMenuItems(
            contextMenu.type === "ref"
              ? insertMenuItems(
                  insertMenuItems(refMenuItems(contextMenu.chip, refMenuContext), refActionItems(contextMenu.chip, refMenuContext)),
                  multiRemotePushItem(contextMenu.chip, refMenuContext),
                )
              : insertMenuItems(commitMenuItems(contextMenu.commit, commitMenuContext), commitActionItems(contextMenu.commit, commitMenuContext)),
            presentation.contextMenuVisibility,
          );
      const activeMenuIndex = menuItems.length === 0 ? 0 : Math.min(Math.max(menuIndex, 0), menuItems.length - 1);

      function clearHoverTimer() {
        if (hoverTimer.current !== null) {
          clearTimeout(hoverTimer.current);
          hoverTimer.current = null;
        }
      }

      /** Hide the tooltip immediately (pointer leave, Escape, scroll, actions). */
      function hideTooltip() {
        clearHoverTimer();
        setHover(null);
      }

      /**
       * Read one commit's containment through POST /contains, caching the answer.
       * @param hash - full commit hash.
       * @returns the cached or freshly requested `contains` value.
       */
      function requestContains(hash) {
        const cache = containsCache.current;
        const cacheKey = selectedRepo === "" ? hash : selectedRepo + "::" + hash;
        const cached = cache.get(cacheKey);
        if (cached !== undefined) return Promise.resolve(cached);
        const inFlight = containsInFlight.current;
        if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
        const controller = new AbortController();
        containsControllers.current.add(controller);
        const promise = postJson("contains", withRepoPath({ sessionId, hash }, selectedRepo), controller.signal).then(
          (data) => {
            inFlight.delete(cacheKey);
            containsControllers.current.delete(controller);
            cache.set(cacheKey, data);
            return data;
          },
          (error) => {
            inFlight.delete(cacheKey);
            containsControllers.current.delete(controller);
            throw error;
          },
        );
        inFlight.set(cacheKey, promise);
        return promise;
      }

      /**
       * Show the tooltip for a row after the shared delay.
       * @param hash - commit hash.
       * @param point - `{ x, y }` pointer/row anchor.
       */
      function scheduleTooltip(hash, point) {
        if (typeof hash !== "string" || hash === "") return;
        clearHoverTimer();
        const origin = point !== null && typeof point === "object" ? point : { x: 0, y: 0 };
        const cached = containsCache.current.get(selectedRepo === "" ? hash : selectedRepo + "::" + hash);
        const position = tooltipPosition(origin, { width: 260, height: 170 }, viewportSize());
        hoverTimer.current = setTimeout(() => {
          hoverTimer.current = null;
          setHover({
            hash,
            status: cached === undefined ? "loading" : "ready",
            data: cached === undefined ? null : cached,
            error: "",
            x: position.left,
            y: position.top,
          });
          if (cached !== undefined) return;
          requestContains(hash).then(
            (data) => setHover((previous) => (previous !== null && previous.hash === hash ? { ...previous, status: "ready", data } : previous)),
            (error) => {
              if (isAbort(error)) return;
              setHover((previous) => (previous !== null && previous.hash === hash ? { ...previous, status: "error", error: messageOf(error) } : previous));
            },
          );
        }, TOOLTIP_DELAY_MS);
      }

      /** Report a failed review mutation, hiding the control for UNAVAILABLE. */
      function showReviewError(error) {
        if (isUnavailableError(error)) {
          setReview({ status: "unavailable", key: review.key, files: {}, total: 0, reviewed: 0 });
          return;
        }
        setRun({ kind: "review", phase: "error", message: t("review.failed", { message: messageOf(error) }), detail: "", expanded: false });
      }

      /**
       * Flip one file's mark optimistically and revert when the host refuses.
       * Never touches the diff cache or expands the row.
       * @param filePath - changed file path.
       */
      function toggleReviewed(filePath) {
        if (review.status !== "ready" || reviewScope === null || typeof filePath !== "string" || filePath === "") return;
        const scope = reviewScope;
        const key = review.key;
        const previous = { files: review.files, total: review.total, reviewed: review.reviewed };
        const next = toggleReviewFile(previous, filePath, Date.now());
        setReview({ status: "ready", key, ...next });
        postJson("review", reviewRequest({ sessionId, action: "toggle", kind: scope.kind, base: scope.base, head: scope.head, file: filePath })).then(
          (next) => setReview((current) => (current.key === key ? { status: "ready", key, ...reviewStateOf(next) } : current)),
          (error) => {
            setReview((current) => (current.key === key ? { status: "ready", key, ...previous } : current));
            showReviewError(error);
          },
        );
      }

      /**
       * Mark every unreviewed file in the open scope. Optimistic, like a toggle.
       * @param files - host file records currently listed.
       */
      function markAllReviewed(files) {
        if (review.status !== "ready" || reviewScope === null) return;
        const scope = reviewScope;
        const key = review.key;
        const pending = unreviewedPaths(Array.isArray(files) ? files : scope.files, review.files);
        if (pending.length === 0) return;
        const previous = { files: review.files, total: review.total, reviewed: review.reviewed };
        const filesNext = { ...review.files };
        const stamp = Date.now();
        for (const path of pending) filesNext[path] = stamp;
        setReview({ status: "ready", key, files: filesNext, total: review.total, reviewed: Object.keys(filesNext).length });
        Promise.all(
          pending.map((path) =>
            postJson("review", reviewRequest({ sessionId, action: "toggle", kind: scope.kind, base: scope.base, head: scope.head, file: path })),
          ),
        ).then(
          () => {},
          (error) => {
            setReview((current) => (current.key === key ? { status: "ready", key, ...previous } : current));
            showReviewError(error);
          },
        );
      }

      /** Clear every mark in the open scope. */
      function clearReviews() {
        if (review.status !== "ready" || reviewScope === null) return;
        const scope = reviewScope;
        const key = review.key;
        const previous = { files: review.files, total: review.total, reviewed: review.reviewed };
        setReview({ status: "ready", key, files: {}, total: review.total, reviewed: 0 });
        postJson("review", reviewRequest({ sessionId, action: "clear", kind: scope.kind, base: scope.base, head: scope.head })).then(
          (next) => setReview((current) => (current.key === key ? { status: "ready", key, ...reviewStateOf(next) } : current)),
          (error) => {
            setReview((current) => (current.key === key ? { status: "ready", key, ...previous } : current));
            showReviewError(error);
          },
        );
      }

      /**
       * Move to the next/previous displayed commit that carries a stash ref and
       * scroll it into view. A page without stash commits has no visible effect.
       * @param step - +1 for next, -1 for previous.
       */
      function jumpToStash(step) {
        const hashes = stashHashesIn(commits, displayedIndices, pageRefs);
        if (hashes.length === 0) return;
        stashPos.current = nextIndex(hashes.length, stashPos.current, step);
        hideTooltip();
        setContextMenu(null);
        setMenuOpen(false);
        setDialog(null);
        setCompare(null);
        setSelected(null);
        setStashScroll((previous) => ({ hash: hashes[stashPos.current], key: previous.key + 1 }));
      }

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

      function openDialog(kind, requestedRef, hashOverride, extra) {
        const override = extra !== null && typeof extra === "object" ? extra : {};
        hideTooltip();
        const hash = typeof hashOverride === "string" && hashOverride !== "" ? hashOverride : selectedHash;
        setMenuOpen(false);
        setContextMenu(null);
        forceRef.current = null;
        setDialog({
          kind,
          hash,
          ...actionDialogSpec(kind, { branches, tags, remotes: remoteOptions, currentBranch, dialogDefaults: presentation.dialogDefaults }),
          requestedRef: typeof requestedRef === "string" ? requestedRef : "",
          defaultExtra: typeof override.defaultExtra === "string" ? override.defaultExtra : "",
          branch: typeof override.branch === "string" ? override.branch : "",
          path: typeof override.path === "string" ? override.path : "",
          index: Number.isSafeInteger(override.index) ? override.index : 0,
          tagName: typeof override.tagName === "string" ? override.tagName : "",
          remoteName: typeof override.remoteName === "string" ? override.remoteName : "",
          preview: null,
        });
      }

      /**
       * Open the clean dialog and immediately run its dry run.
       *
       * The confirmation stays disabled until that preview has rendered the files
       * git would remove (C3), so a clean is never a blind destructive click.
       */
      function openCleanDialog() {
        const spec = actionDialogSpec("cleanUntracked", { dialogDefaults: presentation.dialogDefaults });
        setMenuOpen(false);
        setContextMenu(null);
        setDialog({
          kind: "cleanUntracked",
          hash: "",
          ...spec,
          requestedRef: "",
          defaultExtra: "",
          branch: "",
          path: "",
          index: 0,
          tagName: "",
          remoteName: "",
          preview: null,
        });
        startAction("cleanUntracked", actionArguments("cleanUntracked", { flags: { dryRun: true } }), {
          quiet: true,
          onResult: (record) => {
            const detail = record !== null && typeof record === "object" && typeof record.output === "string" ? record.output : "";
            setDialog((previous) => (previous === null || previous.kind !== "cleanUntracked" ? previous : { ...previous, preview: { lines: outputLines(detail) } }));
          },
          onError: (error) => {
            setDialog(null);
            setRun({ kind: "cleanUntracked", phase: "error", message: t("action.failed", { message: messageOf(error) }), detail: "", expanded: false });
          },
        });
      }

      /** Show the tag-details panel for one tag. */
      function openTagDetails(name) {
        if (typeof name !== "string" || name === "") return;
        setMenuOpen(false);
        setContextMenu(null);
        setDialog(null);
        setTagDetails({ name, status: "loading", value: null, error: null });
      }

      function openRemotes() {
        setMenuOpen(false);
        setContextMenu(null);
        setRemotesOpen(true);
      }

      function openCommitMenu(point) {
        if (point === null || typeof point !== "object" || typeof point.hash !== "string" || point.hash === "") return;
        hideTooltip();
        const items = visibleMenuItems(
          insertMenuItems(commitMenuItems(point.commit, commitMenuContext), commitActionItems(point.commit, commitMenuContext)),
          presentation.contextMenuVisibility,
        );
        if (items.length === 0) return;
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
        hideTooltip();
        const items = visibleMenuItems(
          insertMenuItems(
            insertMenuItems(refMenuItems(chip, refMenuContext), refActionItems(chip, refMenuContext)),
            multiRemotePushItem(chip, refMenuContext),
          ),
          presentation.contextMenuVisibility,
        );
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

      /**
       * Open a working-tree comparison against one commit.
       *
       * Reached from the commit context menu (`与工作区对比`, base = the clicked
       * commit) and from the uncommitted pane (`与 HEAD 对比`, base = HEAD). The
       * compare view then requests `/compare { base, working: true }` and each file
       * diff uses scope `working`; `head` is never sent.
       * @param baseHash - commit-ish to compare the working tree against.
       */
      function enterWorkingCompare(baseHash) {
        const base = typeof baseHash === "string" ? baseHash.trim() : "";
        if (base === "") return;
        hideTooltip();
        setDialog(null);
        setRun(null);
        setContextMenu(null);
        setMenuOpen(false);
        setCompare({ base, head: null, working: true });
      }

      function runMenuItem(item) {
        const target = contextMenu;
        if (item === null || item === undefined || item.disabled === true) return;
        setContextMenu(null);
        if (target === null || typeof target !== "object") return;
        if (target.type === "ref") {
          const label = typeof target.label === "string" ? target.label : "";
          const chipKind = target.chip !== null && typeof target.chip === "object" && typeof target.chip.kind === "string" ? target.chip.kind : "";
          // Every mutating ref item goes through the shared dialog/action path.
          if (item.kind === "copyRef") {
            handleCopy(refCopyValue(target.chip));
            return;
          }
          if (item.kind === "fetch") {
            startAction("fetch", {});
            return;
          }
          if (item.kind === "tagDetails") {
            openTagDetails(label);
            return;
          }
          if (item.kind === "pushTag") {
            openDialog("pushTag", "", "", { tagName: label });
            return;
          }
          if (chipKind === "stash") {
            openDialog(item.kind, "", "", { index: stashIndex(label) });
            return;
          }
          if (item.kind === "merge" || item.kind === "rebase" || item.kind === "resetToCommit") {
            // These actions take a ref in their hash field.
            openDialog(item.kind, "", label);
            return;
          }
          if (item.kind === "pullBranch" || item.kind === "pushBranch") {
            openDialog(item.kind, "", "", { branch: label });
            return;
          }
          if (item.kind === "pushToMultipleRemotes") {
            // requestedRef carries the branch shown in the dialog.
            openDialog(item.kind, label);
            return;
          }
          if (item.kind === "fetchIntoBranch") {
            openDialog("fetch");
            return;
          }
          openDialog(item.kind, label);
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
        if (item.kind === "compareWorking") {
          enterWorkingCompare(target.hash);
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
      function runAction(kind, args, signal, options) {
        const settings = options !== null && typeof options === "object" ? options : {};
        setRun({ kind, phase: "running", message: "", detail: "", expanded: false });
        postJson("action", withRepoPath(Object.assign({ sessionId, action: kind }, args), selectedRepo), signal).then(
          (result) => {
            const record = result !== null && typeof result === "object" ? result : {};
            const message = typeof record.message === "string" && record.message !== "" ? record.message : "";
            const detail = typeof record.output === "string" ? record.output.trim() : "";
            // A quiet run (the clean dry-run preview) reports to its caller instead of
            // taking over the shared feedback line and refreshing the graph.
            if (settings.quiet === true) {
              if (typeof settings.onResult === "function") settings.onResult(record, detail);
              setRun(null);
              return;
            }
            setRun({ kind, phase: "success", message: t("action.success") + (message === "" ? "" : " · " + message), detail, expanded: false });
            refresh();
          },
          (error) => {
            if (isAbort(error)) return;
            if (settings.quiet === true) {
              if (typeof settings.onError === "function") settings.onError(error);
              setRun(null);
              return;
            }
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

      function startAction(kind, args, options) {
        const controller = new AbortController();
        const previous = actionController.current;
        if (previous !== null && typeof previous.abort === "function") previous.abort();
        actionController.current = controller;
        runAction(kind, args === undefined ? {} : args, controller.signal, options);
        return controller;
      }

      function confirmDialog(name, ref, extra, flags) {
        if (dialog === null || typeof dialog !== "object") return;
        const kind = dialog.kind;
        if (kind === "deleteBranch") forceRef.current = ref;
        const checks = flags === null || typeof flags !== "object" ? {} : flags;
        const args = actionArguments(kind, {
          name,
          ref,
          hash: dialog.hash,
          newName: extra,
          extra,
          flags: kind === "cleanUntracked" ? { ...checks, dryRun: false } : checks,
          branch: typeof dialog.branch === "string" ? dialog.branch : "",
          path: typeof dialog.path === "string" ? dialog.path : "",
          index: Number.isSafeInteger(dialog.index) ? dialog.index : 0,
          tagName: typeof dialog.tagName === "string" ? dialog.tagName : "",
          remoteName: typeof dialog.remoteName === "string" ? dialog.remoteName : "",
        });
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

      /** Close the find row, restoring the full list and the default scope. */
      function closeFind() {
        setFindOpen(false);
        setFindQuery("");
        setFindMatch(0);
        setFindScope(FIND_SCOPE_PAGE);
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
       * Switch the find scope. The search effect resets state and aborts any
       * in-flight full-history request when leaving `全部历史`.
       * @param next - `all` or anything else for the loaded page.
       */
      function handleFindScope(next) {
        setFindScope(next === FIND_SCOPE_ALL ? FIND_SCOPE_ALL : FIND_SCOPE_PAGE);
        setFindMatch(0);
      }

      /**
       * Request one full-history search page.
       *
       * `offset` 0 replaces the results; a later offset appends (the server page
       * carries `hasMore`/`capped`, merged by `appendSearchPage`). Superseded
       * requests are aborted, and an older response can never overwrite a newer
       * query's state.
       * @param query - typed query text.
       * @param offset - result offset to request.
       * @param append - whether this page appends to the loaded results.
       */
      function runSearch(query, offset, append) {
        const text = typeof query === "string" ? query.trim() : "";
        if (text === "") return;
        const controller = new AbortController();
        const previous = searchController.current;
        if (previous !== null && typeof previous.abort === "function") previous.abort();
        searchController.current = controller;
        if (append === true) {
          setSearch((current) => ({ ...current, status: "ready", error: "", loadingMore: true }));
        } else {
          setSearch({ ...EMPTY_SEARCH, status: "loading" });
        }
        loadSearchPage({
          sessionId,
          query: text,
          offset: Number.isSafeInteger(offset) ? offset : 0,
          path: selectedRepo,
          signal: controller.signal,
        }).then(
          (page) => {
            if (searchController.current !== controller) return;
            searchController.current = null;
            setSearch((current) => (append === true ? appendSearchPage(current, page) : searchStateFrom(page)));
          },
          (error) => {
            if (isAbort(error) || searchController.current !== controller) return;
            searchController.current = null;
            setSearch((current) => ({ ...current, status: "error", error: messageOf(error), loadingMore: false }));
          },
        );
      }

      /** Request the next search page, appending it to the loaded results. */
      function loadMoreSearch() {
        if (search.status !== "ready" || search.hasMore !== true || search.loadingMore === true) return;
        runSearch(findQuery, search.nextOffset, true);
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

      /** Reset both halves of the branch filter: checkbox selection and globs. */
      function resetBranchFilter() {
        setBranchSelection(null);
        setGlobText("");
      }

      /** Stash every uncommitted change (tracked only). */
      function stashAll() {
        startAction("stashUncommitted", {});
      }

      /** Stash every uncommitted change, including untracked files. */
      function stashAllUntracked() {
        startAction("stashUncommitted", { includeUntracked: true });
      }

      /** Discard one working-tree file back to HEAD (through the shared dialog). */
      function discardFile(file) {
        const path = file !== null && typeof file === "object" && typeof file.path === "string" ? file.path : "";
        if (path === "") return;
        openDialog("resetFileToRevision", "", "HEAD", { path });
      }

      /**
       * Run one resolved tab shortcut.
       * @param shortcut - action id from {@link shortcutFor}.
       * @returns true when the shortcut was handled.
       */
      function runShortcutAction(shortcut) {
        hideTooltip();
        if (shortcut === "refresh") {
          refresh();
          return true;
        }
        if (shortcut === "find") {
          openFind();
          return true;
        }
        if (shortcut === "stash-next") {
          jumpToStash(1);
          return true;
        }
        if (shortcut === "stash-prev") {
          jumpToStash(-1);
          return true;
        }
        if (shortcut === "head") {
          if (headHash !== "") {
            setDialog(null);
            setMenuOpen(false);
            setContextMenu(null);
            setCompare(null);
            setSelected(null);
            setScrollHeadKey((key) => key + 1);
          }
          return true;
        }
        return false;
      }

      /** Whether an open commit detail can navigate to neighbours. */
      function detailOpen() {
        return selected !== null && selected.uncommitted !== true &&
          detail.value !== null && typeof detail.value === "object" && typeof detail.value.hash === "string";
      }

      /**
       * Open the neighbour above/below in the displayed order.
       * @param arrow - -1 for up, 1 for down.
       * @returns true when a neighbour was opened.
       */
      function stepDetailNeighbour(arrow) {
        if (!detailOpen()) return false;
        const target = neighbourHash(commits, displayedIndices, detail.value.hash, arrow);
        if (target === "") return false;
        selectCommit(target);
        return true;
      }

      /**
       * Ctrl/Cmd+Up/Down parent/child navigation (additional, never remapped).
       * @param event - keydown event.
       * @returns true when a parent/child was opened.
       */
      function stepDetailParentChild(event) {
        if (!detailOpen()) return false;
        const target = detailArrowHash(event, detail.value, commits);
        if (target === "") return false;
        selectCommit(target);
        return true;
      }

      /** Run the Escape chain; returns true when something was closed. */
      function handleEscapeKey() {
        if (hover !== null) {
          hideTooltip();
          return true;
        }
        if (contextMenu !== null) {
          setContextMenu(null);
          return true;
        }
        if (menuOpen) {
          setMenuOpen(false);
          return true;
        }
        if (dialog !== null) {
          setDialog(null);
          return true;
        }
        if (remotesOpen) {
          setRemotesOpen(false);
          return true;
        }
        if (tagDetails !== null) {
          setTagDetails(null);
          return true;
        }
        if (findOpen) {
          closeFind();
          return true;
        }
        if (compare !== null) {
          setCompare(null);
          return true;
        }
        if (selected !== null) {
          setSelected(null);
          return true;
        }
        return false;
      }

      /** Whether the tab root currently contains the document's focus. */
      function isPanelFocused() {
        const doc = typeof document !== "undefined" ? document : null;
        const node = rootRef.current;
        if (doc === null || node === null || typeof node !== "object" || typeof node.contains !== "function") return false;
        const active = doc.activeElement;
        if (active === null || typeof active !== "object") return false;
        return active === node || node.contains(active);
      }

      function handleRootKeyDown(event) {
        // Tab-scoped shortcuts: the right sidebar has no per-tab shortcut scope, so
        // these live on the tab root's keydown listener instead of the global
        // shortcut registry (which would steal Ctrl/Cmd+R, Ctrl/Cmd+F and
        // Ctrl/Cmd+S app-wide). Bindings come from `presentation.shortcuts`
        // (find/refresh/scrollToHead/scrollToStash), falling back to the pre-wave-8
        // Ctrl/Cmd+H/R/F/S map. Ctrl/Cmd+Up/Down and the plain arrow keys are
        // additional navigation and are never remapped by those four.
        const shortcut = shortcutFor(event, event !== null && typeof event === "object" ? event.target : null, shortcuts);
        if (shortcut !== null) {
          if (typeof event.preventDefault === "function") event.preventDefault();
          runShortcutAction(shortcut);
          return;
        }
        if (isTypingTarget(event.target) !== true && stepDetailParentChild(event)) {
          if (typeof event.preventDefault === "function") event.preventDefault();
          return;
        }
        // Arrow navigation only makes sense on the open commit detail: it opens the
        // neighbour above/below in the displayed order (no wrapping at the ends).
        const arrow = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        if (
          arrow !== 0 &&
          isTypingTarget(event.target) !== true &&
          event.ctrlKey !== true && event.metaKey !== true && event.altKey !== true &&
          stepDetailNeighbour(arrow)
        ) {
          if (typeof event.preventDefault === "function") event.preventDefault();
          return;
        }
        if (event.key !== "Escape") return;
        handleEscapeKey();
      }

      /**
       * Document-level keydown handler, used only when `presentation.globalShortcuts`
       * is true.
       *
       * The resolved four shortcuts fire even when focus is elsewhere in the page
       * (editable targets are still guarded unless a modifier is held). The
       * navigation set — Ctrl/Cmd+Up/Down parent/child, plain Up/Down list
       * navigation and Escape — fires only while this panel owns focus; Enter is
       * deliberately left to the focused control's native activation so the global
       * listener can never double-activate a button.
       * @param event - keydown event.
       * @returns true when the event was handled (and must be prevented).
       */
      function handleGlobalKeyDown(event) {
        if (event === null || typeof event !== "object") return false;
        const target = event.target;
        const typing = isTypingTarget(target) === true;
        const modifier = event.ctrlKey === true || event.metaKey === true || event.altKey === true;
        if (!typing || modifier) {
          // A null target bypasses the typing guard: with a modifier held the
          // shortcut is allowed inside an input, as the global scope requires.
          const shortcut = shortcutFor(event, null, shortcuts);
          if (shortcut !== null) return runShortcutAction(shortcut);
        }
        if (!isPanelFocused() || typing) return false;
        if (stepDetailParentChild(event)) return true;
        if (event.ctrlKey === true || event.metaKey === true || event.altKey === true) return false;
        if (event.key === "ArrowUp" || event.key === "ArrowDown") return stepDetailNeighbour(event.key === "ArrowUp" ? -1 : 1);
        if (event.key === "Escape") return handleEscapeKey();
        return false;
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
      /** Whether the commit list can request another page. */
      const listHasMore = value !== null && typeof value === "object" && value.truncated === true && commits.length < PAGE_MAX && limit < PAGE_MAX;
      const autoLoadEnabled = pagination.auto;

      /** Request one more commit page (manual button or auto-load near the bottom). */
      function requestMoreCommits() {
        setLimit((current) => Math.min(current + pagination.step, PAGE_MAX));
      }

      /**
       * Auto-load-more: only in the plain commit list, only when enabled and another
       * page exists, and only near the scroller's bottom.
       * @param event - scroll event from `.dgg-main`.
       */
      function handleMainScroll(event) {
        if (autoLoadEnabled !== true || listHasMore !== true) return;
        if (selected !== null || compare !== null || searchActive === true || branchNoMatch === true) return;
        const node = event !== null && typeof event === "object" ? event.currentTarget : null;
        if (node === null || typeof node !== "object") return;
        if (shouldAutoLoad(node.scrollTop, node.scrollHeight, node.clientHeight, listHasMore, autoLoadEnabled)) requestMoreCommits();
      }

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
          repoPath: selectedRepo,
          presentation,
          review,
          onToggleReviewed: toggleReviewed,
          onMarkAll: markAllReviewed,
          onClearReviews: clearReviews,
          onSwap: () => setCompare((previous) => (previous === null || previous.working === true ? previous : { base: previous.head, head: previous.base })),
          onExit: () => setCompare(null),
          onRetry: refresh,
        });
      } else if (selected === null) {
        if (value !== null && typeof value === "object" && value.isRepo === false) {
          content = h(NotRepoState, {
            t,
            pathValue: typeof value.workspacePath === "string" && value.workspacePath !== "" ? value.workspacePath : repoPath,
            onRetry: refresh,
          });
        } else if (branchNoMatch === true && searchActive !== true) {
          // A valid glob matched no branch: the graph request was suppressed, so
          // show the filter-specific empty state instead of an unfiltered list.
          // Full-history search is a separate mode and keeps its own results.
          content = h(NoGlobMatchState, { t });
        } else if (value === null) {
          content = graph.status === "error" ? h(ErrorState, { t, message: graph.error, onRetry: refresh }) : h(LoadingState, { t });
        } else if (commits.length === 0 && listModel.synthetic === null && searchActive !== true) {
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
            searchActive !== true && filterActive === true && find.matches === 0
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
            searchActive === true
              ? h(SearchResults, {
                  t,
                  search,
                  refIndex,
                  presentation,
                  metaVisibility: columns,
                  selectedHash: "",
                  onSelect: selectCommit,
                  onMenu: openCommitMenu,
                  onRefMenu: openRefMenu,
                  onHoverStart: scheduleTooltip,
                  onHoverEnd: hideTooltip,
                  onLoadMore: loadMoreSearch,
                  onRetry: () => runSearch(findQuery, 0, false),
                })
              : h(CommitList, {
                  t,
                  value,
                  layout,
                  refIndex,
                  stashRefsByHash,
                  presentation,
                  metaVisibility: columns,
                  mutedHashes,
                  headHash,
                  scrollHeadKey,
                  stashScrollHash: stashScroll.hash,
                  stashScrollKey: stashScroll.key,
                  onHoverStart: scheduleTooltip,
                  onHoverEnd: hideTooltip,
                  uncommitted: filterActive === true ? null : listModel.synthetic,
                  selectedHash: "",
                  indices: find.indices,
                  activeHash: filterActive === true ? activeHash : "",
                  onSelect: selectCommit,
                  onSelectUncommitted: selectUncommitted,
                  onMenu: openCommitMenu,
                  onRefMenu: openRefMenu,
                  onLoadMore: requestMoreCommits,
                  canLoadMore: listHasMore,
                  loadingMore: graph.status === "refreshing",
                }),
          );
        }
      } else if (selected.uncommitted === true) {
        if (detail.value !== null) {
          content = h(UncommittedView, {
            t,
            value: detail.value,
            sessionId,
            cache: diffCache,
            repoPath: selectedRepo,
            presentation,
            dialog,
            dirty,
            running,
            onStash: stashAll,
            onStashUntracked: stashAllUntracked,
            onClean: openCleanDialog,
            onReset: () => openDialog("resetUncommitted"),
            onDiscard: discardFile,
            onCompareWorking: headHash === "" ? undefined : () => enterWorkingCompare(headHash),
            onCancelDialog: () => setDialog(null),
            onConfirmDialog: confirmDialog,
          });
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
          dropDisabledReason: detailDropReason,
          presentation,
          repoPath: selectedRepo,
          review,
          onToggleReviewed: toggleReviewed,
          onMarkAll: markAllReviewed,
          onClearReviews: clearReviews,
        });
      } else if (detail.status === "error") {
        content = h(ErrorState, { t, message: detail.error, onRetry: refresh });
      } else {
        content = h(LoadingState, { t });
      }

      return h(
        "div",
        {
          className: "dgg-root",
          ref: rootRef,
          onKeyDown: handleRootKeyDown,
          "data-dgg-enhanced-accessibility": presentation.enhancedAccessibility === true ? "true" : undefined,
        },
        h("style", { key: "dgg-style" }, CSS),
        h(Toolbar, {
          t,
          repoLabel,
          repoPath,
          repositories: repoInfo,
          repoValue: selectedRepo,
          repoOrder: presentation.repositoryDropdownOrder,
          onRepoChange: (next) => {
            const path = typeof next === "string" ? next : "";
            if (path === selectedRepo) return;
            hideTooltip();
            setSelected(null);
            setCompare(null);
            setDialog(null);
            setContextMenu(null);
            setMenuOpen(false);
            // Branch names belong to one repository; carrying the checkbox set or
            // a zero-match glob across a switch could suppress the next repo's
            // first graph request (and stale refs would be rejected by the host).
            setBranchSelection(null);
            setGlobText("");
            setSelectedRepo(path);
          },
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
          columns,
          onToggleColumn: (key) => {
            if (key !== "author" && key !== "date" && key !== "hash") return;
            setColumns((previous) => ({ ...previous, [key]: previous[key] === false }));
          },
          onToggleMenu: () => setMenuOpen((open) => !open),
          onCloseMenu: () => setMenuOpen(false),
          onFetch: () => {
            setMenuOpen(false);
            startAction("fetch", {});
          },
          onOpenRemotes: openRemotes,
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
              scope: findScope,
              query: findQuery,
              total: filterActive === true ? find.matches : 0,
              activeIndex: filterActive === true ? activeMatchIndex : -1,
              onQuery: handleFindQuery,
              onScope: handleFindScope,
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
              globText,
              globError: globParsed.errorKey,
              onToggle: handleToggleBranch,
              onGlob: setGlobText,
              onReset: resetBranchFilter,
              onClose: () => setFilterOpen(false),
            })
          : null,
        remotesOpen === true
          ? h(RemotesPanel, {
              t,
              status: remotesData.status,
              value: remotesData.value,
              error: remotesData.error,
              onAdd: () => openDialog("addRemote"),
              onEdit: (remote) => openDialog("editRemote", remote.name, "", { defaultExtra: typeof remote.fetchUrl === "string" ? remote.fetchUrl : "" }),
              onPrune: (remote) => openDialog("pruneRemote", "", "", { remoteName: remote.name }),
              onDelete: (remote) => openDialog("deleteRemote", "", "", { remoteName: remote.name }),
              onRefresh: refresh,
              onClose: () => setRemotesOpen(false),
            })
          : null,
        tagDetails !== null
          ? h(TagDetails, {
              t,
              name: tagDetails.name,
              status: tagDetails.status,
              value: tagDetails.value,
              error: tagDetails.error,
              presentation,
              onClose: () => setTagDetails(null),
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
        h("div", { className: "dgg-main", onScroll: handleMainScroll }, content),
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
        hover !== null ? h(CommitTooltip, { t, hover }) : null,
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
