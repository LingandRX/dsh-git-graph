# 迁移对齐报告：vscode-git-graph → dsh-git-graph

本文件记录 `dsh-git-graph` 相对上游扩展 **mhutchie/vscode-git-graph v1.30.0** 的迁移进度与差距。
结论均来自源码比对，不是凭印象：

| 来源 | 核查方式 |
| --- | --- |
| 上游功能清单 | 仓库 `README.md` 的 "Features" 段 |
| 上游设置项 | `package.json` → `contributes.configuration.properties`（**110** 项） |
| 上游命令 | `package.json` → `contributes.commands`（**10** 个） |
| 上游 Git 能力 | `src/dataSource.ts` 的 `public` 方法（**51** 个） |
| 上游快捷键 | `README.md` 的 Keyboard Shortcuts 段 |
| 我们的能力 | `lib/git.js` 导出的 6 个方法 + `performAction` 的 10 个 case；`lib/index.js` 的 `ACTION_FIELDS`（9 个键）；`lib/client.js` 的 `actions` 数组（9 个）；`cordis.patch.yml` 的 3 个配置键 |

## 总览

| 维度 | 上游 v1.30.0 | 当前实现 | 覆盖率 |
| --- | --- | --- | --- |
| 设置项 | 110 | 3 | 3% |
| 命令 | 10 | 1 个入口（右侧栏 guide 卡片） | 场景等价 |
| Git 操作 | 51 | 10（UI 接 9） | ~18% |
| 图视图交互 | 右键菜单 / 查找 / 过滤 / 对比 / 悬浮 / 列设置 | 右键菜单、对比、未提交节点、查找、过滤、排序已迁移；悬浮提示、列宽/列显隐未迁移 | ~80% |
| 快捷键 | 6 组 | 仅 Escape | 少 |

**一句话结论**：图、提交详情、逐文件 diff 这条主链路已完整可用；
缺的是「右键菜单驱动的完整 Git 操作面」、「对比 / 未提交改动 / 查找 / 过滤」这四类浏览能力、
以及「工程化周边」（多仓库、代码评审、视觉与设置面）。

---

## 一、已迁移（可用）

| 能力 | 实现位置 | 说明 |
| --- | --- | --- |
| 提交图谱 | `lib/client.js` `layoutGraph()` | 合并 / 八爪鱼合并 / 多根 / 断连历史；lane 上限 14；圆角贝塞尔边 |
| 引用标签 | `classifyRefs()` / `RefChips` | 分支 / 远端 / 标签 / HEAD 四类，样式区分 |
| 提交详情 | `DetailView` | 作者、提交者、绝对+相对时间、父提交（可点击）、哈希复制、引用、统计 |
| 文件列表 + diff | `FileRow` / `renderDiff()` | 按 A/M/D/R 状态分组，逐文件展开，`@@`/`+`/`-` 着色，二进制与截断态 |
| 合并提交文件集 | `readCommit()` | 对比第一父，`stats`/`files` 非空；`readDiff` 对合并同样走第一父 |
| 脏工作区提示 | `Toolbar` | 工具栏 `●N` 计数 + 动作前警告 |
| 分页 | `CommitList` | 截断时 "加载更多"，上限 500 |
| 状态页 | `LoadingState` / `ErrorState` / `NotRepoState` / `EmptyState` | 含非 Git 仓库的路径提示 |
| `git_graph` 智能体工具 | `lib/index.js` | 只读 log/show/diff/branches/status，与 UI 共用同一 Git 层 |

已迁移的 Git 动作（**9 个**，UI 可触发）：
检出分支、检出提交（分离 HEAD）、建分支、**删除分支**、拣选、还原、建标签、删标签、fetch。

> `deleteBranch`：已完成接线（TODO-1）——host 侧本就有实现，客户端现已纳入动作行，
> 并对未合并分支提供"强制删除"二次确认。

---

## 二、未迁移：图视图交互

| # | 能力 | 上游行为 | 现状 | 影响 |
| --- | --- | --- | --- | --- |
| A1 | ~~**右键菜单**~~ | 在 commit / branch / tag 上右键弹出动作菜单 | **已迁移（提交级，TODO-3/4）**；分支/标签级见 TODO-5 | — |
| A2 | ~~**双提交对比视图**~~ | 点一个 commit，Ctrl/Cmd 再点另一个 → 对比文件与 diff | **已迁移（TODO-7）** | — |
| A3 | ~~**未提交改动节点**~~ | 图顶部显示 uncommitted changes 虚拟节点 | **已迁移（TODO-6）**：虚线合成行 + 分组文件面板；"与某提交对比"部分见 TODO-16 | 尚不能直接对比工作区与选定提交 |
| A4 | ~~**查找控件**~~ | 在 message / 日期 / 作者 / 哈希 / 分支名 / 标签名中搜索提交 | **已迁移（TODO-9）**：已加载页内匹配 + N/M 跳转；服务端全量搜索未做 | 仅覆盖当前页 |
| A5 | ~~**分支过滤下拉**~~ | 全部 / 多选分支 / 自定义 glob | **多选已迁移（TODO-10）**；自定义 glob 模式未做 | 无 glob |
| A6 | **列宽拖拽 + 列显隐** | 可拖拽列宽，可隐藏 Date / Author / Commit 列 | **排序已迁移（TODO-11）**；列宽/列显隐未做 | 信息密度不可调 |
| A7 | **提交顶点悬浮提示** | 该提交是否在 HEAD 内、被哪些分支/标签/stash 包含 | 无 tooltip | 分支归属需逐个点开 |
| A8 | **文件树视图 + 紧凑文件夹** | 详情内可切换树形/扁平，`commitDetailsView.fileView.type` | 仅扁平（按状态分组） | 大提交难浏览 |
| A9 | **看图快捷键** | Ctrl+H 回 HEAD、Ctrl+R 刷新、Ctrl+S 跳 stash、上下键在相邻提交间移动详情 | 仅 `Escape` 关闭；确认框内 Enter/Escape | 键盘效率低 |

## 三、未迁移：Git 动作

按家族列出（上游 `dataSource.ts` 有、我们无）：

| 家族 | 上游具备 | 我们缺失 |
| --- | --- | --- |
| 分支 | 建/检出/删除/重命名/合并/拉取/推送/rebase/reset 到提交/fetch 进本地分支 | **重命名、删除已迁移**；合并、拉取、推送、rebase、reset、fetchIntoLocalBranch 未迁移 |
| 标签 | 建/删/推送、查看 annotated tag 详情（tagger 姓名/邮箱/日期/message） | 推送到远端、annotated 详情 |
| 提交 | 检出/拣选/丢弃(drop)/合并/还原 | 合并、丢弃 |
| 贮藏 stash | 创建/apply/pop/drop/从 stash 建分支/查看 stash 详情 | **整族缺失**（`stash` 在 `lib/*.js` 零命中） |
| 未提交改动 | clean 未跟踪文件 / reset / stash / 重置文件到某版本 | 整族缺失 |
| 远端 | 增/改/删远端、prune、push 到多远端 | 整族缺失（仅 `fetch --prune`） |
| 归档 | `git archive` 导出 | 缺失 |

## 四、未迁移：工程化周边

| # | 能力 | 说明 |
| --- | --- | --- |
| C1 | **多仓库** | 仅单仓库（会话 cwd 或 `repoPath`）；无仓库下拉、无子目录搜索（`maxDepthOfRepoSearch`）、无仓库配置导入/导出 |
| C2 | **代码评审** | 勾选已评审文件、粗体待评审、跨会话持久化、90 天自动关闭；跨工作区批量结束 |
| C3 | **视觉** | 作者头像（含缓存清理）、graph style（rounded/angular，我们只有圆角）、自定义分支配色（`graph.colours`）、emoji shortcode、签名状态、mailmap、issue 链接、PR 创建集成（GitHub/GitLab/Bitbucket + 自定义 provider） |
| C4 | **设置面** | 110 → 3（`repoPath`、`maxCommits`、`showRemoteBranches`）；提交排序仅 `--date-order`，上游支持 date / author-date / topo |
| C5 | **上游专属 UI 载体** | VS Code diff 编辑器、`openFile` 命令、状态栏按钮、命令面板命令、`retainContextWhenHidden`、集成终端 shell 设置 |

> C5 属**有意不迁移**：diff 由 DSH 文档预览 / 工作区文件页承担，入口由右侧栏 guide 卡片承担。
> 这一组不应出现在待办里（见 `todolist.md` 的"非目标"）。

---

## 五、判断依据说明

- "未迁移"以**能否在 UI 中触发并完成**为准，不以 host 是否具备为准：`deleteBranch`、`revertCommit` 别名这类
  host 已实现但 UI 未接的，仍计入缺口。
- 上游"设置项 110"含大量**旧版兼容别名**（如 `git-graph.autoCenterCommitDetailsView` 与
  `git-graph.commitDetailsView.autoCenter` 成对出现），因此真实独立配置项少于 110；对比时按"能力"而非"键数"理解。
- 本报告只描述差距，不承诺排期；排期与验收标准见 [`todolist.md`](./todolist.md)。
