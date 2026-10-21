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
| 我们的能力 | `lib/git.js` 的 12 个读方法 + `performAction` 的 34 个 action；`lib/index.js` 的 13 条路由；`lib/settings.js` 的 110 键设置表（29 键 presentation）；303 个测试用例（host 102 / client 155 / settings 46） |

## 总览

| 维度 | 上游 v1.30.0 | 当前实现 | 覆盖率 |
| --- | --- | --- | --- |
| 设置项 | 110 | 110 键全部接受并给出处置（mapped 71 / vscode-only 10 / out-of-scope 29，逐键见 [`settings-parity.md`](./settings-parity.md)） | 100% 键面 |
| 命令 | 10 | 1 个入口（右侧栏 guide 卡片） | 场景等价 |
| Git 操作 | 51 | 34（`ACTION_FIELDS`，UI 可达 33） | ~67% |
| 图视图交互 | 右键菜单 / 查找 / 过滤 / 对比 / 悬浮 / 列设置 | 全部交互已迁移，含全量搜索、glob 过滤、工作区对比（列宽拖拽除外，见非目标） | ~100% |
| 快捷键 | 6 组 | 可配置 `keyboardShortcut.*` + Escape/Enter/箭头 + Ctrl/Cmd+↑↓ 父子导航 + 可选全局作用域 | 已对齐 |

**一句话结论**：wave 8 消除了第五节最后 5 项残余（全量搜索、glob 过滤、工作区对比、快捷键、110 项设置），
主链路与全部交互/动作/设置面均已迁移；第五节只剩 6 项**显式非目标**，每项都写明了理由。

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
| 110 项设置 | `lib/settings.js` + `docs/settings-parity.md` | 上游 v1.30.0 的 110 个键全部接受、别名折叠、类型强制、非法值上报；71 项驱动真实行为 |
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

## 二、图视图交互（已全部迁移，残余见第五节）

| # | 能力 | 上游行为 | 现状 | 影响 |
| --- | --- | --- | --- | --- |
| A1 | ~~**右键菜单**~~ | 在 commit / branch / tag 上右键弹出动作菜单 | **已迁移（TODO-3/4/5）**：提交、分支、标签、远端、stash chip 各有上下文菜单 | — |
| A2 | ~~**双提交对比视图**~~ | 点一个 commit，Ctrl/Cmd 再点另一个 → 对比文件与 diff | **已迁移（TODO-7）** | — |
| A3 | ~~**未提交改动节点**~~ | 图顶部显示 uncommitted changes 虚拟节点 | **已迁移（TODO-6 + wave 8）**：虚线合成行 + 分组文件面板；提交菜单"与工作区对比"、未提交面板"与 HEAD 对比" | — |
| A4 | ~~**查找控件**~~ | 在 message / 日期 / 作者 / 哈希 / 分支名 / 标签名中搜索提交 | **已迁移（TODO-9 + wave 8）**：已加载页内 N/M 跳转 + 服务端全量搜索（`POST /search`，分页、扫描上限提示） | — |
| A5 | ~~**分支过滤下拉**~~ | 全部 / 多选分支 / 自定义 glob | **已迁移（TODO-10 + wave 8）**：多选 + glob（`*`、`**`、`?`、`[abc]`、`[!abc]`、前导 `!`），无匹配时给出空状态；`customBranchGlobPatterns` 预填 | — |
| A6 | ~~**列显隐**~~ | 可隐藏 Date / Author / Commit 列 | **已迁移**：溢出菜单三个复选框；**列宽拖拽为非目标**（右侧栏 380–520px，无可调表格） | — |
| A7 | ~~**提交顶点悬浮提示**~~ | 是否在 HEAD 内、被哪些分支/标签/stash 包含 | **已迁移（TODO-8）**：400ms 受控 tooltip，数据只来自 host `/contains`，LRU 64 | — |
| A8 | ~~**文件树视图 + 紧凑文件夹**~~ | 详情内可切换树形/扁平 | **已迁移**：flat/tree 切换、目录折叠、单子目录链压缩 | — |
| A9 | ~~**看图快捷键**~~ | Ctrl+H/R/S、上下键移动详情 | **已迁移（wave 8）**：`keyboardShortcut.*` 可重映射（严格修饰键匹配、UNASSIGNED）、Ctrl/Cmd+↑↓ 父子导航、可选全局作用域（`globalShortcuts`，最后挂载的面板生效） | — |

## 三、Git 动作（家族级已迁移，残余见第五节）

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

## 四、工程化周边（已迁移，残余见第五节）

| # | 能力 | 说明 |
| --- | --- | --- |
| C1 | ~~**多仓库**~~ | **已迁移（TODO-18）**：`/repos` 深度受限发现 + 工具栏下拉；**仓库配置导入/导出为非目标** |
| C2 | ~~**代码评审**~~ | **已迁移（TODO-19）**：勾选/加粗/变淡、`storageDomain` 持久化、90 天过期、200 条上限；**跨工作区批量结束为非目标** |
| C3 | **视觉** | **已迁移（TODO-20）**：rounded/angular、自定义配色、签名状态、emoji shortcode、mailmap、issue 链接；**头像与 PR 创建集成为非目标** |
| C4 | **设置面** | **已迁移（wave 8）**：110 键逐项处置（71 mapped / 10 vscode-only / 29 out-of-scope），别名折叠、类型校验、非法值上报；29 键 presentation 驱动日期格式/列显隐/文件视图/引用标签/弱化/markdown/对话框默认/菜单可见性/a11y/分页等 |
| C5 | **上游专属 UI 载体** | VS Code diff 编辑器、`openFile` 命令、状态栏按钮、命令面板命令、`retainContextWhenHidden`、集成终端 shell 设置 |

> C5 属**有意不迁移**：diff 由 DSH 文档预览 / 工作区文件页承担，入口由右侧栏 guide 卡片承担。
> 这一组不应出现在待办里（见 `todolist.md` 的"非目标"）。

---

## 五、非目标与残余差异

### 5.1 wave 8 已消除的残余（原第五节 5 项，全部落地）

| 项 | 落地方式 | 证据 |
| --- | --- | --- |
| 服务端全量提交搜索 | `POST /api/dsh-git-graph/search`（`searchCommits()`，一次 20k 提交扫描、四类 facet、offset/limit、`scanned`/`capped`） | host 测试 + 真实仓库探针；客户端"全部历史"模式把构造的请求体喂回真实路由（交叉验证 14/14） |
| 自定义分支 glob 过滤 | 客户端 `compileGlob`/`branchFilterState`：`*`、`**`、`?`、`[abc]`、`[!abc]`、前导 `!`；"全部"状态下作为过滤器生效，零匹配给出空状态；`customBranchGlobPatterns` 预填 | 客户端 matcher 表测试 + 请求体断言 |
| 工作区改动 ↔ 指定提交对比 | `POST /compare` 接受 `{base, working:true}`，`POST /diff` 新增 `working` scope；提交菜单与未提交面板两个入口 | host 测试（含未跟踪/二进制/空文件/未出生 HEAD）+ 真实仓库探针；客户端请求体回放通过 |
| 全局快捷键注册 | `keyboardShortcut.*` 四键可重映射（严格修饰键匹配、UNASSIGNED）+ Ctrl/Cmd+↑↓ 父子导航 + `globalShortcuts` 可选 document 级作用域（最后挂载面板生效、可编辑目标忽略） | 客户端纯函数表测试 + fake-document 监听器挂载/卸载测试；默认关闭，行为与 wave 8 前一致 |
| 上游 110 项设置的逐项对齐 | `lib/settings.js`：110 键、81 canonical + 29 别名、`normalizeSettings()`、29 键 presentation；逐键处置见 [`settings-parity.md`](./settings-parity.md) | settings 测试（键数、别名目标、折叠优先级、类型强制、非法/未知上报、presentation 形状、快捷键解析、docs 一致性） |

### 5.2 仍属非目标（6 项，理由不变）

| 项 | 状态 | 理由 |
| --- | --- | --- |
| 列宽拖拽 | 非目标 | 右侧栏固定 380–520px，没有可拖拽表格的语义；列显隐已提供信息密度控制 |
| `git archive` 导出 | 非目标 | 需要文件落盘位置与交付物语义，DSH 的 `bash`/交付物机制更合适；插件不越权写任意路径 |
| 作者头像 | 非目标 | 需要外网抓取与本地缓存目录，涉及隐私取舍；且头像对图谱可读性无功能影响 |
| PR 创建集成（GitHub/GitLab/Bitbucket） | 非目标 | 依赖各平台 OAuth 与网络回调，属独立产品集成，应在单独插件中实现 |
| 跨工作区批量结束代码评审 | 非目标 | DSH 的会话隔离模型下，跨工作区批量操作应由宿主提供，而不是单个侧栏插件 |
| 仓库配置导入/导出文件 | 非目标 | 属"团队共享配置"产品功能；110 键设置写在 profile patch 中已可版本化 |

> 110 键中的 29 项 `out-of-scope`（头像、PR provider、interactive rebase、VS Code 专属外观等）
> 不是隐性缺口：每一项都在 [`settings-parity.md`](./settings-parity.md) 写明"为什么不做"。

---

## 六、判断依据说明

- "未迁移"以**能否在 UI 中触发并完成**为准，不以 host 是否具备为准：`deleteBranch`、`revertCommit` 别名这类
  host 已实现但 UI 未接的，仍计入缺口。
- 上游"设置项 110"含大量**旧版兼容别名**（如 `git-graph.autoCenterCommitDetailsView` 与
  `git-graph.commitDetailsView.autoCenter` 成对出现），因此真实独立配置项少于 110；对比时按"能力"而非"键数"理解。
- 设置项的"对齐"按**键面处置**计：每个上游键都必须被接受、有明确处置（mapped/vscode-only/out-of-scope）并写明理由；
  "mapped"必须能指出真实消费者（host 选项/argv 或 client 读取的 presentation 成员）。
- 本报告只描述差距，不承诺排期；排期与验收标准见 [`todolist.md`](./todolist.md)。
