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
| 我们的能力 | `lib/git.js` 的 11 个读方法 + `performAction` 的 34 个 action；`lib/index.js` 的 12 条路由；`cordis.patch.yml` 的 11 个配置键；197 个测试用例（host 85 / client 112） |

## 总览

| 维度 | 上游 v1.30.0 | 当前实现 | 覆盖率 |
| --- | --- | --- | --- |
| 设置项 | 110 | 11 | 10% |
| 命令 | 10 | 1 个入口（右侧栏 guide 卡片） | 场景等价 |
| Git 操作 | 51 | 34（`ACTION_FIELDS`，UI 可达 33） | ~67% |
| 图视图交互 | 右键菜单 / 查找 / 过滤 / 对比 / 悬浮 / 列设置 | 全部交互已迁移（列宽拖拽除外，见非目标） | ~95% |
| 快捷键 | 6 组 | Escape / Enter + 标签页内 H·R·F·S·Shift+S/箭头 | 接近 |

**一句话结论**：主链路、右键菜单驱动的 Git 操作面、对比/未提交/查找/过滤/悬浮、多仓库、代码评审、stash/tag/远端、
视觉与设置面均已迁移；剩余差异见第五节「声明为非目标或残余差异」，每项都写明了理由。

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
| A3 | ~~**未提交改动节点**~~ | 图顶部显示 uncommitted changes 虚拟节点 | **已迁移（TODO-6）**：虚线合成行 + 分组文件面板；"与某个提交对比"见第五节残余 | 尚不能直接对比工作区与选定提交 |
| A4 | ~~**查找控件**~~ | 在 message / 日期 / 作者 / 哈希 / 分支名 / 标签名中搜索提交 | **已迁移（TODO-9）**：已加载页内匹配 + N/M 跳转；服务端全量搜索未做 | 仅覆盖当前页 |
| A5 | ~~**分支过滤下拉**~~ | 全部 / 多选分支 / 自定义 glob | **多选已迁移（TODO-10）**；自定义 glob 模式未做 | 无 glob |
| A6 | ~~**列显隐**~~ | 可隐藏 Date / Author / Commit 列 | **已迁移**：溢出菜单三个复选框；**列宽拖拽为非目标**（右侧栏 380–520px，无可调表格） | — |
| A7 | ~~**提交顶点悬浮提示**~~ | 是否在 HEAD 内、被哪些分支/标签/stash 包含 | **已迁移（TODO-8）**：400ms 受控 tooltip，数据只来自 host `/contains`，LRU 64 | — |
| A8 | ~~**文件树视图 + 紧凑文件夹**~~ | 详情内可切换树形/扁平 | **已迁移**：flat/tree 切换、目录折叠、单子目录链压缩 | — |
| A9 | ~~**看图快捷键**~~ | Ctrl+H/R/S、上下键移动详情 | **已迁移**（标签页作用域）：H 回 HEAD、R 刷新、F 查找、S/Shift+S 跳 stash、上下键移动详情、Escape | 未注册全局快捷键（右侧栏无 per-tab 作用域） |

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
| C4 | **设置面** | 110 → 11（含 `showStashes`、`graphStyle`、`graphColours`、`showSignature`、`showEmoji`、`issueUrlTemplate`、`useMailmap`、`maxDepthOfRepoSearch`）；排序支持 date / author-date / topo；**其余为上游的兼容别名与外观微调，未逐项搬** |
| C5 | **上游专属 UI 载体** | VS Code diff 编辑器、`openFile` 命令、状态栏按钮、命令面板命令、`retainContextWhenHidden`、集成终端 shell 设置 |

> C5 属**有意不迁移**：diff 由 DSH 文档预览 / 工作区文件页承担，入口由右侧栏 guide 卡片承担。
> 这一组不应出现在待办里（见 `todolist.md` 的"非目标"）。

---

## 五、声明为非目标或残余差异

逐项落地之后仍然存在的差异，全部在此显式声明（不再作为"待办"隐性存在）：

| 项 | 状态 | 理由 |
| --- | --- | --- |
| 列宽拖拽 | 非目标 | 右侧栏固定 380–520px，没有可拖拽表格的语义；列显隐已提供信息密度控制 |
| `git archive` 导出 | 非目标 | 需要文件落盘位置与交付物语义，DSH 的 `bash`/交付物机制更合适；插件不越权写任意路径 |
| 作者头像 | 非目标 | 需要外网抓取与本地缓存目录，涉及隐私取舍；且头像对图谱可读性无功能影响 |
| PR 创建集成（GitHub/GitLab/Bitbucket） | 非目标 | 依赖各平台 OAuth 与网络回调，属独立产品集成，应在单独插件中实现 |
| 跨工作区批量结束代码评审 | 非目标 | DSH 的会话隔离模型下，跨工作区批量操作应由宿主提供，而不是单个侧栏插件 |
| 仓库配置导入/导出文件 | 非目标 | 属"团队共享配置"产品功能，当前 11 项配置写在 profile patch 中已可版本化 |
| 上游 110 项设置的逐项对齐 | 残余 | 其中大量为**旧版兼容别名**（同一能力两个键）与 VS Code 外观微调；按能力对齐，不逐键复制 |
| 服务端全量提交搜索 | 残余 | 当前查找在已加载页内匹配；全量搜索需要新的 `git log --grep` 路由与分页策略，收益低于成本 |
| 自定义分支 glob 过滤 | 残余 | 多选过滤已覆盖主要场景；glob 需要模式解析与校验 |
| 工作区改动与指定提交对比 | 残余 | 未提交改动已可单独查看并与自身 staged/unstaged 对比；与任意提交对比需新的 compare 基座 |
| 全局快捷键注册 | 残余 | 右侧栏没有 per-tab 快捷键作用域，全局注册会与宿主/其他插件冲突；改为标签页内快捷键 |

---

## 六、判断依据说明

- "未迁移"以**能否在 UI 中触发并完成**为准，不以 host 是否具备为准：`deleteBranch`、`revertCommit` 别名这类
  host 已实现但 UI 未接的，仍计入缺口。
- 上游"设置项 110"含大量**旧版兼容别名**（如 `git-graph.autoCenterCommitDetailsView` 与
  `git-graph.commitDetailsView.autoCenter` 成对出现），因此真实独立配置项少于 110；对比时按"能力"而非"键数"理解。
- 本报告只描述差距，不承诺排期；排期与验收标准见 [`todolist.md`](./todolist.md)。
