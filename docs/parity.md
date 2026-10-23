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
| 我们的能力 | `lib/git.js` 的 14 个读方法 + `performAction` 的 34 个 action；`lib/index.js` 的 16 条路由；`lib/settings.js` 的 110 键设置表（30 键 presentation）；330 个测试用例（host 113 / client 169 / settings 48） |

## 总览

| 维度 | 上游 v1.30.0 | 当前实现 | 覆盖率 |
| --- | --- | --- | --- |
| 设置项 | 110 | 110 键全部接受并给出处置（mapped 74 / vscode-only 10 / out-of-scope 26，逐键见 [`settings-parity.md`](./settings-parity.md)） | 100% 键面 |
| 命令 | 10 | 1 个入口（右侧栏 guide 卡片） | 场景等价 |
| Git 操作 | 51 | 34（`ACTION_FIELDS`，UI 可达 33） | ~67% |
| 图视图交互 | 右键菜单 / 查找 / 过滤 / 对比 / 悬浮 / 列设置 | 全部交互已迁移：右键菜单、全量搜索、glob、工作区对比、列显隐 + 列宽拖拽、悬浮、文件树 | 100% |
| 快捷键 | 6 组 | 可配置 `keyboardShortcut.*` + Escape/Enter/箭头 + Ctrl/Cmd+↑↓ 父子导航 + 可选全局作用域 | 已对齐 |

**一句话结论**：wave 8 消除了 5 项残余，wave 9 把此前声明的 6 项非目标也全部迁移（列宽拖拽、`git archive`、
头像、PR 创建、跨工作区评审管理、仓库配置导入/导出）。**功能层已经没有未迁移项**；仍存在的差异只在设置层
（10 项 VS Code 专属 + 26 项 out-of-scope，逐键理由见 [`settings-parity.md`](./settings-parity.md)）。

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
| 列显隐 | `Toolbar` 溢出菜单 | 作者/日期/哈希三个复选框 |
| 文件树视图 | `buildFileTree` / `FileTree` | flat/tree 切换、目录折叠、单子目录链压缩 |
| 标签页快捷键 | `shortcutFor` | H 回 HEAD、R 刷新、F 查找、S/Shift+S 跳 stash、上下键移动详情 |
| 多远端推送 | `pushToMultipleRemotes` | 逐远端推送并汇报每条结果，0 成功时抛 `GIT_FAILED` |
| 全量历史搜索 | `POST /search` + `searchCommits()` | 单次 `git log --all -n 20000` 扫描，按 all/message/author/ref 匹配，offset/limit 分页，`scanned`/`capped` 上报；Find 栏"全部历史"模式 |
| 工作区 ↔ 提交对比 | `/compare` 的 `working:true` + `/diff` 的 `working` scope | 已跟踪（staged+unstaged）与未跟踪文件一并列出；未跟踪文件返回全新增 patch；未出生 HEAD 返回空对比 |
| 110 项设置 | `lib/settings.js` + `docs/settings-parity.md` | 上游 v1.30.0 的 110 个键全部接受、别名折叠、类型强制、非法值上报；74 项驱动真实行为 |
| 列宽拖拽 | `ColumnHeader` 边界句柄 + `--dgg-col-*` 变量 | 拖边界时左侧列变宽、右侧相邻列等量让出（与上游一致，边界跟手）；clamp、双击重置相邻列、localStorage 持久化 |
| 归档导出 | `POST /archive` + `archive()` | zip/tar.gz 写入 `<workspace>/.dsh-git-graph/archives/`，realpath 围栏、唯一文件名、返回相对路径 |
| 作者头像 | `avatarUrl()` + `presentation.avatars` | Gravatar（md5、identicon）URL，默认关闭；客户端 `<img>` + 首字母兜底 |
| PR 创建 | `POST /pr` + `readPullRequest()` | 解析 https/ssh remote → github/gitlab/bitbucket/other，base←origin/HEAD←main/master，内置 URL + 自定义 `$1..$8` 模板 |
| 跨工作区评审管理 | `/review` 的 `scopes`/`end` | 遍历所有会话键列出评审范围（repoPath + 文件数 + 尽力计算的 total），按范围或全部结束 |
| 仓库配置导入导出 | `POST /repoconfig` + `<repo>/.gitgraph.json` | 导出非默认设置、导入后按仓库覆盖生效（仓库优先于插件配置）、清除恢复 |
| 多仓库 | `POST /repos` + 仓库下拉 | 深度受限发现 + 统一路径围栏 `OUTSIDE_WORKSPACE` |
| 代码评审 | `POST /review` + `storageDomain` | 逐文件勾选、进度、持久化、90 天过期 |

已迁移的 Git 动作（`ACTION_FIELDS` **34 个**，UI 可达 **33 个**）按家族列出：
分支（建/检出/删除/重命名/合并/拉取/推送/rebase/reset/fetch 进本地分支）、提交（检出/拣选/还原/丢弃/合并/重设）、
标签（建/删/推送/详情）、贮藏 stash（push/apply/pop/drop/branch）、未提交改动（clean/reset/stash/单文件丢弃）、
远端（增/改/删/prune/多远端推送）、fetch。

> `mergeCommit` 是 `merge` 的别名，不单独暴露 UI（34 − 1 = 33）。
> `deleteBranch` 的 UI 接线（TODO-1）已完成：首次删除总是非强制，git 拒绝未合并分支后再由 UI 升级为
> "强制删除"二次确认。

---

## 二、图视图交互（已全部迁移）

| # | 能力 | 上游行为 | 现状 | 影响 |
| --- | --- | --- | --- | --- |
| A1 | ~~**右键菜单**~~ | 在 commit / branch / tag 上右键弹出动作菜单 | **已迁移（TODO-3/4/5）**：提交、分支、标签、远端、stash chip 各有上下文菜单 | — |
| A2 | ~~**双提交对比视图**~~ | 点一个 commit，Ctrl/Cmd 再点另一个 → 对比文件与 diff | **已迁移（TODO-7）** | — |
| A3 | ~~**未提交改动节点**~~ | 图顶部显示 uncommitted changes 虚拟节点 | **已迁移（TODO-6 + wave 8）**：虚线合成行 + 分组文件面板；提交菜单"与工作区对比"、未提交面板"与 HEAD 对比" | — |
| A4 | ~~**查找控件**~~ | 在 message / 日期 / 作者 / 哈希 / 分支名 / 标签名中搜索提交 | **已迁移（TODO-9 + wave 8）**：已加载页内 N/M 跳转 + 服务端全量搜索（`POST /search`，分页、扫描上限提示） | — |
| A5 | ~~**分支过滤下拉**~~ | 全部 / 多选分支 / 自定义 glob | **已迁移（TODO-10 + wave 8）**：多选 + glob（`*`、`**`、`?`、`[abc]`、`[!abc]`、前导 `!`），无匹配时给出空状态；`customBranchGlobPatterns` 预填 | — |
| A6 | ~~**列显隐 + 列宽拖拽**~~ | 可隐藏列、可拖拽列宽 | **已迁移（wave 8 + wave 9）**：溢出菜单三个复选框；Date/Author/Commit 表头可拖拽调宽（clamp、双击重置、localStorage 持久化） | — |
| A7 | ~~**提交顶点悬浮提示**~~ | 是否在 HEAD 内、被哪些分支/标签/stash 包含 | **已迁移（TODO-8）**：400ms 受控 tooltip，数据只来自 host `/contains`，LRU 64 | — |
| A8 | ~~**文件树视图 + 紧凑文件夹**~~ | 详情内可切换树形/扁平 | **已迁移**：flat/tree 切换、目录折叠、单子目录链压缩 | — |
| A9 | ~~**看图快捷键**~~ | Ctrl+H/R/S、上下键移动详情 | **已迁移（wave 8）**：`keyboardShortcut.*` 可重映射（严格修饰键匹配、UNASSIGNED）、Ctrl/Cmd+↑↓ 父子导航、可选全局作用域（`globalShortcuts`，最后挂载的面板生效） | — |

## 三、Git 动作（已全部迁移）

按家族列出（上游 `dataSource.ts` 有、我们无）：

| 家族 | 上游具备 | 我们缺失 |
| --- | --- | --- |
| 分支 | 建/检出/删除/重命名/合并/拉取/推送/rebase/reset 到提交/fetch 进本地分支 | **全部迁移（TODO-12, 21）** |
| 标签 | ~~建/删/推送、查看 annotated tag 详情~~ | **全部迁移（TODO-14）** | — |
| 提交 | 检出/拣选/丢弃(drop)/合并/还原 | **全部迁移（TODO-13）** | — |
| 贮藏 stash | 创建/apply/pop/drop/从 stash 建分支/查看 stash 详情 | **全部迁移（TODO-15）** | — |
| 未提交改动 | clean 未跟踪文件 / reset / stash / 重置文件到某版本 | **全部迁移（TODO-16）** | — |
| 远端 | 增/改/删远端、prune、push 到多远端 | **全部迁移（TODO-17 + 第 7 波）**：`pushToMultipleRemotes` 逐个推送并汇报每条结果 |
| 归档 | `git archive` 导出 | **声明为非目标**（见第五节） |

## 四、工程化周边（已全部迁移）

| # | 能力 | 说明 |
| --- | --- | --- |
| C1 | ~~**多仓库 + 仓库配置**~~ | **已迁移（TODO-18 + wave 9）**：`/repos` 深度受限发现 + 工具栏下拉；`<repo>/.gitgraph.json` 导出/导入/清除，导入后该仓库的设置立即生效 |
| C2 | ~~**代码评审**~~ | **已迁移（TODO-19 + wave 9）**：勾选/加粗/变淡、`storageDomain` 持久化、90 天过期、200 条上限；评审管理面板可跨仓库/会话列出并结束（单个或全部） |
| C3 | **视觉 + 协作** | **已迁移（TODO-20 + wave 9）**：rounded/angular、自定义配色、签名状态、emoji shortcode、mailmap、issue 链接；Gravatar 头像（可选）与 PR 创建（GitHub/GitLab/Bitbucket + 自定义模板） |
| C4 | **设置面** | **已迁移（wave 8 + wave 9）**：110 键逐项处置（74 mapped / 10 vscode-only / 26 out-of-scope），别名折叠、类型校验、非法值上报；30 键 presentation 驱动日期格式/列显隐/文件视图/引用标签/弱化/markdown/对话框默认/菜单可见性/a11y/分页/头像等 |
| C5 | **上游专属 UI 载体** | VS Code diff 编辑器、`openFile` 命令、状态栏按钮、命令面板命令、`retainContextWhenHidden`、集成终端 shell 设置 |

> C5 属**有意不迁移**：diff 由 DSH 文档预览 / 工作区文件页承担，入口由右侧栏 guide 卡片承担。
> 这一组不应出现在待办里（见 `todolist.md` 的"非目标"）。

---

## 五、已消除的缺口与仍存差异

### 5.1 wave 8 消除的 5 项残余

| 项 | 落地方式 | 证据 |
| --- | --- | --- |
| 服务端全量提交搜索 | `POST /search` + `searchCommits()`：一次 20k 扫描、四类 facet、分页、`scanned`/`capped` | host 真实仓库用例 + 客户端请求体回放 |
| 自定义分支 glob 过滤 | `compileGlob`/`branchFilterState`：`*`、`**`、`?`、`[abc]`、`[!abc]`、`!` 取反；零匹配空状态 | matcher 表 + 请求体断言 |
| 工作区 ↔ 提交对比 | `/compare {working:true}` + `/diff` 的 `working` scope；两个入口 | 真实仓库（未跟踪/二进制/空文件/未出生 HEAD）+ 请求体回放 |
| 全局快捷键 | `keyboardShortcut.*` 重映射、Ctrl/Cmd+↑↓、可选 `globalShortcuts` document 作用域 | 纯函数表 + fake-document 挂载/卸载用例 |
| 110 项设置逐键对齐 | `lib/settings.js`：110 键、别名折叠、类型强制、30 键 presentation | settings 测试 + 逐键处置表 |

### 5.2 wave 9 迁移的原「非目标」6 项

| 项 | 落地方式 | 证据 |
| --- | --- | --- |
| 列宽拖拽 | 表头拖拽句柄（pointer capture）+ clamp + 双击重置 + localStorage；CSS 变量驱动表头与行 | 纯函数表 + 渲染断言 + 真实拖拽需浏览器验证 |
| `git archive` 导出 | `POST /archive`：zip/tar.gz 写入 `<workspace>/.dsh-git-graph/archives/`，realpath 围栏、唯一名 | 真实仓库 zip/gzip magic + 围栏用例 + 客户端 body 回放 |
| 作者头像 | `fetchAvatars` → Gravatar URL（md5/identicon，空邮箱 null）；客户端 img + 首字母兜底；默认关闭 | md5 向量 + URL/禁用用例 + 客户端渲染用例 |
| PR 创建集成 | `POST /pr`：remote 解析 → github/gitlab/bitbucket/other；base 解析；内置 URL + `$1..$8` 自定义模板 | 真实 remote 矩阵（https/ssh/subgroup/detached/no-remote）+ body 回放 |
| 跨工作区批量结束评审 | `/review` `scopes`/`end`：遍历所有会话键、按 repo 分组、按范围或全部结束 | 双会话双仓库用例 + 真实 storage 形状探针 |
| 仓库配置导入/导出 | `<repo>/.gitgraph.json` + `POST /repoconfig`（status/export/import/clear），按仓库覆盖生效 | 导出→改文件→导入→`/graph` 页大小/样式变化→清除恢复 |

### 5.3 仍存在的差异：只在设置层

功能层已无未迁移项。设置层仍有两类，且每项都写明了理由（见
[`settings-parity.md`](./settings-parity.md)）：

- **10 项 VS Code 专属**：`commitDetailsView.location`、`integratedTerminalShell`、`openNewTabEditorGroup`、
  `openToTheRepoOfTheActiveTextEditorDocument`、`retainContextWhenHidden`、`showStatusBarItem`、
  `sourceCodeProviderIntegrationLocation`、`tabIconColourTheme`（含 2 个别名）——DSH 没有对应宿主物。
- **26 项 out-of-scope**：头像之外的签名（`repository.sign.*`，需 `gpg`）、interactive rebase、
  未实现的对话框选项（`dialog.*`）、`repository.onLoad.*`、`fileEncoding` 等。逐键理由见处置表。

---

## 六、判断依据说明

- "未迁移"以**能否在 UI 中触发并完成**为准，不以 host 是否具备为准：`deleteBranch`、`revertCommit` 别名这类
  host 已实现但 UI 未接的，仍计入缺口。
- 上游"设置项 110"含大量**旧版兼容别名**（如 `git-graph.autoCenterCommitDetailsView` 与
  `git-graph.commitDetailsView.autoCenter` 成对出现），因此真实独立配置项少于 110；对比时按"能力"而非"键数"理解。
- 设置项的"对齐"按**键面处置**计：每个上游键都必须被接受、有明确处置（mapped/vscode-only/out-of-scope）并写明理由；
  "mapped"必须能指出真实消费者（host 选项/argv 或 client 读取的 presentation 成员）。
- "非目标"在 wave 9 之后只存在于**设置键层面**；功能层面（图、交互、动作、协作、配置）不再有未迁移项。
- 本报告只描述差距，不承诺排期；排期与验收标准见 [`todolist.md`](./todolist.md)。
