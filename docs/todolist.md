# dsh-git-graph 待办清单（对齐 vscode-git-graph）

差距来源见 [`parity.md`](./parity.md)。本清单按**可交付、可验收**拆分，每条带文件范围与验收标准，
可直接作为实现任务领取。

约定：

- `P0` 补完主链路，`P1` 常用增强，`P2` 锦上添花。
- 每条状态：`[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成。
- 验收统一先跑：`node --check lib/*.js`、`node --test`（当前基线 **330** 个用例全绿，只增不减）。
- 所有新增可见文案必须同时补 `zh` 与 `en` 两个字典（`lib/client.js` 内 `LOCALE_NS = "dshGitGraph"`）。
- 所有样式只用 `--dsw-alias-*` 主题变量；图形调色板除外。
- 新增 Git 能力一律先进 `lib/git.js` 的 `performAction`，再由路由与工具复用；**禁止在 client 里拼 git 命令**。
- 破坏性动作必须沿用现有"面板内二次确认"（`ActionDialog`），不得使用 `window.confirm`。

---

## 阶段 0：补齐已有能力（最小改动，先做）

### [x] TODO-1 `deleteBranch` 接入 UI（P0）

- **目标**：删除本地分支——host 已实现，只差接线。
- **文件**：`lib/client.js`（`actions` 数组、`openDialog` 的目标选择、locale `action.deleteBranch`/`action.branchName` 复用）。
- **做法**：把 `deleteBranch` 加入详情页动作行；目标分支下拉复用 `branches` memo；`force` 先用 `false`（失败时提示"未合并，需强制删除"再允许二次确认置 `true`）。
- **验收**：
  - 详情页出现"删除分支"；下拉列出本地分支且排除当前 HEAD 分支；
  - 确认后发出 `{ action: "deleteBranch", name, force: false }`，成功后图谱刷新、分支从下拉与 chips 消失；
  - 对未合并分支先报错、不静默强删；`node --test` 通过并补 1 个 client 用例。
- **备注**：`ACTION_FIELDS.deleteBranch = ["name", "force"]` 已就绪，无需改 host。
- **完成**（2026-10-20）：
  - 详情页动作行新增"删除分支"；下拉排除当前 HEAD 分支（`actionDialogSpec`）。
  - 先以 `force: false` 尝试；git 拒绝未合并分支时反馈条给出**"强制删除"**按钮（`isUnmergedRefusal` + `forceRef`），
    不静默强删，也不把用户逼进死路。
  - 抽出 3 个纯函数（`actionDialogSpec` / `actionArguments` / `isUnmergedRefusal`）便于测试，
    对应 3 个新用例；真实仓库验证：合并分支删除成功 → 未合并被拒 → 强制删除成功。

### [x] TODO-2 动作结果可见性统一（P0）

- **目标**：所有动作的 `output`（git stdout/stderr）在失败时完整可见，成功时折叠。
- **文件**：`lib/client.js`（`runAction`、反馈条 `dgg-feedback`）。
- **验收**：`GIT_FAILED` 时展示 git stderr 原文（可滚动、不截断到一行）；成功仅显示 `message` + 可展开 `output`。
- **完成**（2026-10-20）：
  - host `errorPayload()` 现在把 git 的 `stderr`/`stdout` 作为 `error.output` 一并返回（`BAD_REQUEST` 不含）。
  - client `postJson()` 把 `output` 挂到 rejection 上；反馈条右侧出现"查看输出/收起输出"折叠，
    展开后是等宽可滚动的 `pre.dgg-output`（上限 180px）。
  - host 新增 2 个用例（失败带 output、`BAD_REQUEST` 不带）；`node --test` 60 全绿。

---

## 阶段 1：右键菜单（核心交互）

### [x] TODO-3 图谱右键菜单框架（P0）

- **目标**：在 commit 行上右键弹出动作菜单，作为主要操作入口（对齐上游 A1）。
- **文件**：`lib/client.js` 新增 `ContextMenu` 组件 + `CommitRow.onContextMenu`。
- **做法**：`position: fixed` 菜单，`role="menu"`/`role="menuitem"`，Esc 与点击外部关闭，键盘上下键可移动、Enter 触发；不改 `document.body`，菜单作为 body 组件内的兄弟节点渲染；打开时记录 `{ x, y, commit }`，并在窗口 resize/滚动时关闭。
- **完成**（2026-10-20）：`commitMenuItems` / `menuStep` / `placeMenu` / `menuStillValid` 纯函数 +
  `CommitMenu` 组件；右键、Shift+F10、ContextMenu 键均可打开；方向键/Home/End 循环并跳过禁用项、
  Enter 执行、Escape 关闭、Tab 被拦截；指针外部、滚动、resize、刷新后提交消失都会关闭。
  菜单项复用 `openDialog`/`startAction`，未复制任何请求构造逻辑。合并提交的"还原"禁用并给出原因。
- **原验收**：
  - 右键任意提交行在指针位置弹出菜单，Esc / 点外部 / 选中动作后关闭；
  - 键盘可操作（Tab 不逃逸、方向键移动、Enter 执行）；
  - 菜单项由提交能力决定（见 TODO-4/5），禁用项显示原因；
  - 补 2 个 client 用例（打开/关闭、键盘选择）。
- **依赖**：无。

### [x] TODO-4 提交级菜单项（P0）

- **目标**：右键 commit → 检出、建分支、拣选、还原、建标签（复用已有动作）。
- **文件**：`lib/client.js`（菜单项表），无 host 改动。
- **验收**：每个菜单项等价于详情页同名按钮（同一 `startAction` 路径、同一确认框），发出完全相同的请求体。

### [x] TODO-5 分支/标签级菜单项（P1）

- **目标**：右键 branch chip → 检出 / 删除 / 重命名；右键 tag chip → 删除 / 推送。
- **依赖**：TODO-1、TODO-6、TODO-7。
- **完成**（2026-10-21）：`refMenuItems` 提供分支（检出/重命名/删除/复制名）、标签（删除/复制名）、
  远端（复制 ref/fetch）；当前分支可检出可重命名、不可删除；无远端时 fetch 禁用并给出原因。
  `ActionDialog` 新增 `needs: "rename"` 双输入框；host 新增 `renameBranch`（两个名字都过 ref 校验，
  重名冲突返回 GIT_FAILED）。

---

## 阶段 2：图上的"另一类对象"

### [x] TODO-6 未提交改动节点（P1）

- **目标**：图顶部显示 uncommitted changes 虚拟节点，可点击查看当前改动（对齐 A3）。
- **文件**：`lib/git.js`（新增读未提交文件列表的能力，复用 `status --porcelain=v1 -z` 已有解析）、`lib/index.js`（`commit` 路由支持 `hash: "UNCOMMITTED"` 或新增 `uncommitted` 路由）、`lib/client.js`（图首行注入虚拟节点、`layoutGraph` 忽略它）。
- **完成**（2026-10-20）：host `readUncommitted()` + `POST /uncommitted`；client `buildListModel`
  把合成行完全排除在 `layoutGraph` 之外（有测试断言布局逐字节不变），`UncommittedView` 按
  staged / unstaged / untracked 分组，文件 diff 走 `scope: "staged" | "unstaged"`。
- **原验收**：
  - 有改动时图首行出现单节点（虚线/特殊样式 + "未提交改动"），无改动时不出现；
  - 点击后详情区列出改动文件（A/M/D/R），每个文件可展开 diff（`git diff` / `git diff --cached` 分别对应工作区与暂存）；
  - 虚拟节点不参与 lane 计算，不影响既有快照测试；补 host + client 用例各 1。
- **风险**：`layoutGraph` 目前假设"每个 commit 都有 hash 且可能被父引用"，需显式排除虚拟节点。

### [x] TODO-7 双提交对比视图（P1）

- **目标**：选一个提交后 Ctrl/Cmd 点另一个，进入对比视图（对齐 A2）。
- **文件**：`lib/git.js`（`compareCommits(cwd, from, to)`：`diff --name-status` / `--numstat` / `diff`）、`lib/index.js`（`/api/dsh-git-graph/compare`）、`lib/client.js`（对比态 UI、`Ctrl/Cmd+Click` 选择、退出对比）。
- **验收**：
  - 选中 A 后 Ctrl/Cmd 点 B，进入 `A...B` 对比态，标题显示两个短哈希与 `←/→`；
  - 文件列表 + 逐文件 diff 与单提交详情结构一致；支持交换方向；
  - Esc 退出对比返回列表；`core.quotepath=false` 下非 ASCII 路径正常；
  - **完成**（2026-10-20）：host `compareCommits()` + `POST /compare`（`git diff` 树对树、名字状态 +
    numstat、rename/binary、stats 等于逐文件求和）；client `CompareView`（双方 abbrev、⇄ 交换、
    compare 作用域 diff、Escape 顺序 对比 → 详情 → 列表）。Ctrl/Cmd+点击与菜单"与…对比"两条入口。
  - 补 host 用例 2 个（重命名、二进制）+ client 用例 1 个。

### [x] TODO-8 提交顶点悬浮提示（P2）

- **目标**：悬停提交节点显示"是否在 HEAD 内 / 被哪些分支、标签、stash 包含"（对齐 A7）。
- **文件**：`lib/git.js`（`branch --contains` 一次性批量，或 `for-each-ref --contains <hash>`）、`lib/client.js`（受控 tooltip，延时出现）。
- **验收**：悬停 400ms 出现；内容来自 host 而非 client 猜测；键盘聚焦同样可见；不阻塞列表滚动。
- **注意**：批量查询需限流（一次悬停只查一个哈希，带缓存 LRU ≤ 64）。
- **完成**（2026-10-21）：host `POST /contains`（一次 `for-each-ref --contains` + `merge-base --is-ancestor`，
  stash 命中时才解析 reflog）；client `CommitTooltip` 400ms 延迟、仅用 host 数据、LRU 64、每 hash 单飞、
  卸载即 abort；指针/键盘聚焦都可触发，Escape/滚动/resize/打开菜单时隐藏，`pointer-events:none` 且不做 portal。

---

## 阶段 3：查找与过滤

### [x] TODO-9 查找控件（P1）

- **目标**：图内搜索提交（对齐 A4），快捷键沿用 DSH 侧栏习惯（先做面板内按钮 + 输入框，快捷键可选）。
- **文件**：`lib/client.js`（搜索框 + 高亮 + 上下跳转），host 无需改动（客户端对已加载页做过滤即可）。
- **完成**（2026-10-21）：工具栏放大镜展开查找行，对已加载页做大小写不敏感的子串匹配
  （subject / 作者名与邮箱 / 完整与短哈希 / ref 标签），显示 `N/M`，Enter / Shift+Enter 与前后按钮
  移动并滚动到可见；Escape 清空并关闭、恢复全量。纯函数 `filterCommits` / `nextMatch` 有直接测试。
  - 命中计数 `N/M`、Enter/Shift+Enter 或上下按钮跳转并滚动到可见；
  - 无命中显示空态；Esc 清空并退出搜索；
  - 补 client 用例 2（匹配与跳转顺序）。

### [x] TODO-10 分支过滤（P2）

- **目标**：只显示选中分支的提交（对齐 A5）。
- **文件**：`lib/index.js`+`lib/git.js`（`graph` 请求增加 `branches: string[]`，`git log <branches...>`）、`lib/client.js`（多选下拉）。
- **验收**：默认全部；选中子集后请求携带该子集且图只含相关提交；选择状态在本次会话内保持；补 host 用例 1。
- **完成**（2026-10-21）：host `readGraph` 支持 `branches[]`（只限制 revision walk，refs 列表保持完整，
  便于 UI 继续渲染 chips），未知 ref → BAD_REQUEST；client 多选复选 + "全部"重置，清空时**省略该字段**
  使请求与默认完全一致。

### [x] TODO-11 列显隐与排序（P2）

- **目标**：可隐藏作者/时间、可切换 `--date-order` / `--author-date-order` / `--topo-order`（对齐 A6、C4）。
- **文件**：`cordis.patch.yml`（新增 `commitOrder`、`hideAuthor`、`hideDate`）、`lib/git.js`（排序参数）、`lib/client.js`（工具栏菜单开关，选择存 `localStorage`）。
- **验收**：切换立即生效且刷新后保持；非法排序值回落到 `date-order`；补 host 用例 1（参数映射）。
- **完成**（2026-10-21）：host 支持 `order` = date / author-date / topo（未知名 BAD_REQUEST）；
  client 工具栏溢出菜单三选一，默认 `date` **不发送该字段**（测试断言默认请求体逐字节不变）。

---

## 阶段 4：Git 动作扩展

> 每条都遵循：先 `lib/git.js` 的 `performAction`，再 `ACTION_FIELDS`，再 UI，最后 3 个路由/工具复用同一实现。

### [x] TODO-12 分支动作补齐（P1）

- [x] `renameBranch`（`git branch -m`)
- [x] `merge`（`git merge [--no-ff] [--no-commit]`，冲突时返回 git 原文而非抛栈）
- [x] `resetToCommit`（`git reset --soft|--mixed|--hard`，`hard` 必须二次确认并显示脏工作区警告）
- [x] `pullBranch`（`git pull --ff-only` 优先，可选 `--no-ff`）
- [x] `pushBranch`（`git push`，无上游时提示）
- [x] `rebase`（非交互；明确标注"不做 interactive rebase"）
- **验收**：每个动作在临时仓库测试中成功路径 + 失败路径各 1 用例；`hard reset` / `rebase` 在脏工作区时先警告；工具端不暴露任何写操作。
- **完成**（2026-10-21）：`renameBranch` / `merge` / `resetToCommit` / `pullBranch` / `pushBranch` / `rebase` 全部落地；
  push 的 `force` **只会**生成 `--force-with-lease`（argv 级断言，绝不出现裸 `--force`）；`hard` reset 与 rebase 有脏工作区警告。
  偏差：`fetchIntoLocalBranch` 未实现 → 见 TODO-21。

### [x] TODO-13 提交动作补齐（P1）

- [x] `dropCommit`（仅限非 HEAD 且未被引用时允许，先 `git rebase --onto`；高风险，默认隐藏，需在确认框勾选"我了解这会重写历史"）
- [x] `mergeCommit`（等价 TODO-12 的 `merge` 指定提交）
- **验收**：`dropCommit` 在会被拒绝的场景给出明确原因；补 host 用例 2。
- **完成**（2026-10-21）：`dropCommit` 用 `git rebase --onto <hash>^ <hash>`，拒绝 HEAD、拒绝不在 HEAD 可达链上的提交、
  拒绝"本次 rebase 不会重写的其它 ref 所指向的子提交"（这是唯一既能拒绝"有子提交"又能丢中间提交的解读）；
  UI 对 HEAD 与有子提交的项禁用并给出原因。`mergeCommit` 作为 `merge` 的别名存在，不再单独暴露 UI。

### [x] TODO-14 标签详情与推送（P2）

- [x] annotated tag：`git for-each-ref --format=%(taggername)...` + `git tag -l --format=%(contents)` 展示 tagger 与 message
- [x] `pushTag`（`git push <remote> <tag>`）
- **验收**：lightweight 与 annotated 区分显示；推送失败显示远端拒绝原文。
- **完成**（2026-10-21）：`POST /tag` 返回 `{ name, annotated, tagger, message }`（lightweight → annotated:false、
  tagger:null、message 为提交标题）；`TagDetails` 面板显示类型/tagger/时间/message；`pushTag` 支持指定 remote。

### [x] TODO-15 贮藏 stash 全族（P1）

- [x] `stashPush` / `stashApply` / `stashPop` / `stashDrop` / `branchFromStash`
- [x] 图上以 stash 引用展示（`refs/stash`，`stash@{n}` 标签）
- **验收**：stash 与分支/标签同处以独立 chip 显示；四条动作各有成功/失败用例；`pop` 冲突时保留 stash 并提示。
- **完成**（2026-10-21）：`stashPush/Apply/Pop/Drop/branchFromStash` + `POST /stashes`；`showStashes` 开启时
  graph 值带 `stashes[]` 并把 stash 作为 `type:"stash"` 的 refs 追加（不改提交遍历）；chip 菜单含 apply/pop/drop/branch，
  apply/pop 支持 `--index`。

### [x] TODO-16 未提交改动动作（P2）

- [x] `cleanUntracked`（默认 dry-run 预览再执行）、`resetUncommitted`（soft/mixed/hard）、`stashUncommitted`、`resetFileToRevision`
- **验收**：`clean` 必须先显示将被删除的文件清单；`hard` 类动作双重确认。
- **完成**（2026-10-21）：`cleanUntracked`（dry-run 默认 true，UI 先跑 dry-run 展示清单、确认按钮在预览出现前禁用）、
  `resetUncommitted`（mixed/hard）、`stashUncommitted`、`resetFileToRevision`（单文件丢弃到 HEAD）全部落地。

### [x] TODO-17 远端管理（P2）

- [x] `addRemote` / `editRemote` / `deleteRemote` / `pruneRemote` / `pushToMultipleRemotes`
- **验收**：远端列表含 URL 与 fetch/push 地址；删除远端需确认；补 host 用例 2。
- **完成**（2026-10-21）：`POST /remotes`（`git remote -v` 去重，fetch/push URL 分开）、`addRemote`/`editRemote`/
  `deleteRemote`/`pruneRemote`；`RemotesPanel` 列出并增删改/prune，空列表视为正常状态。

---

## 阶段 5：工程化周边

### [x] TODO-18 多仓库支持（P1）

- **目标**：会话工作区内发现多个仓库并可切换（对齐 C1）。
- **文件**：`lib/git.js`（`discoverRepos(root, maxDepth)`）、`lib/index.js`（`graph` 请求携带 `repoPath` 绝对路径并做**白名单校验**：必须位于 workspace 内）、`lib/client.js`（仓库下拉）、`cordis.patch.yml`（`maxDepthOfRepoSearch`）。
- **验收**：
  - 工作区含子仓库时下拉可切换，选择项在刷新后保持；
  - 请求外部路径被拒绝（`BAD_REQUEST`），补 host 安全用例 2（`..` 逃逸、符号链接逃逸）；
  - 单仓库场景不显示下拉。
- **完成**（2026-10-21）：host `POST /repos`（深度受限遍历、跳过 node_modules/.git/dist/build、
  不进入已发现仓库、2000 目录/50 仓库上限 + `truncated`）+ **统一路径围栏**：`resolveCwd` 用
  `fs.realpath` 校验路径必须落在会话工作区内，否则 `OUTSIDE_WORKSPACE`（`..` 与符号链接逃逸都被拒；
  `repoPath` 配置为文档化豁免）。client 在发现 >1 仓库时把仓库名变成下拉，选择后所有请求带 `path`。

### [x] TODO-19 代码评审标记（P2）

- **目标**：记录"已评审文件"，跨会话保留、90 天过期（对齐 C2）。
- **文件**：`lib/index.js`（用 DSH `storageDomain` 持久化，键 `session → { commit, files: [{path, reviewedAt}] }`）、`lib/client.js`（文件行勾选、未评审加粗、进度 `3/8`）。
- **验收**：勾选状态重开标签页仍在；`git_graph` 工具保持只读（不得写入评审状态）；过期清理有单测。
- **完成**（2026-10-21）：host 用 `storageDomain`（领域 `dsh_git_graph`，集合 `reviews`，按会话 id 键控）
  持久化，90 天过期 + 每会话 200 条上限；`POST /review` 提供 read/toggle/clear，`total` 取自
  `readCommit`/`compareCommits` 为权威分母；无 `storageDomain` 时返回 `UNAVAILABLE` 而不抛错。
  client 在详情与对比视图给每个文件加评审勾选（未评审加粗、已评审变淡）、进度行与全标/清除，
  乐观更新失败回滚，且不触发任何 diff 请求。

### [x] TODO-20 视觉与设置面（P2）

- [x] `graphStyle`：`rounded` / `angular`（`lanePath` 增加直角分支）
- [x] `graphColours`：自定义 lane 调色板（`cordis.patch.yml` 数组）
- [x] 签名状态：`git log --format=%G?` 在详情显示 verified/unverified
- [x] emoji shortcode：`:smile:` → 😄（内置 10 个）+ `customEmojiShortcodeMappings` 自定义映射（wave 8：`presentation.emojiMappings` 由客户端合并，覆盖内置）
- [x] mailmap / issue 链接（issue URL 模板 → 提交正文中的编号变链接）
- [x] 快捷键：`Ctrl+H` 回 HEAD、`Ctrl+R` 刷新（需确认 DSH 侧栏快捷键注册方式）
- **验收**：每项独立可开关；`angular` 与 `rounded` 快照测试各 1；设置项写进 `cordis.patch.yml` 并有默认值。
- **完成**（2026-10-21）：`graphStyle`（rounded/angular，`lanePath` 参数化）、`graphColours`（循环自定义调色板）、
  签名徽标（G/B/U/X/Y/R → verified/bad/unknown/expired/revoked，N 不渲染）、emoji shortcode（10 个内置，
  未知保留原样）、issue 链接（模板含 `{id}` 且仅数字）、`useMailmap`（host 侧 `--use-mailmap` + mailmap 占位符）、
  标签页内快捷键 Ctrl/Cmd+H/R/F（焦点在输入控件时不触发）。
  说明：**未做**全局快捷键注册（右侧栏没有 per-tab 快捷键作用域），已在代码注释中写明；`cordis.patch.yml` 的键
  目前由 `apply()` 直接读取（`normalizeConfig` 导出形状保持不变，避免破坏既有测试）。

---

### [x] TODO-21 `fetchIntoLocalBranch`（P2）

- **来源**：第 4 波实现时发现的缺口。`git fetch <remote> <branch>:<local>` 直接更新本地分支，
  与 `fetch`（只更新 remote-tracking ref）语义不同，客户端当前"拉取到本地分支"实际调用的是 `fetch`。
- **文件**：`lib/git.js`（`performAction` 新增 case，argv `["fetch", remote, branch + ":" + local]`，两个 ref 都校验）、
  `lib/index.js`（`ACTION_FIELDS`）、`lib/client.js`（分支菜单项改为真正的该动作 + 失败提示）。
- **验收**：本地分支被快进/更新且不切分支；非快进场景返回 git 原文；补 host 用例 2 + client 用例 1。
- **完成**（2026-10-21）：host `fetchIntoLocalBranch`（`git fetch <remote> <branch>:<local>`，三个参数都过 ref 校验，
  **不带** `--force`、**不带** `+` 前缀），非快进由 git 拒绝并把 stderr 透传；client 分支菜单已改用该动作。

## 第 7 波补充（收尾 parity 残余交互）

- [x] 列显隐（A6 的可做部分；列宽拖拽在 wave 9 已迁移，见 TODO-27）
- [x] 文件树视图 + 紧凑文件夹（A8）
- [x] 剩余标签页快捷键：S / Shift+S 跳 stash、上下键移动详情（A9）
- [x] `pushToMultipleRemotes`（parity「远端」行）
- 说明：`git archive`、服务端全量搜索、工作区改动与指定提交对比、glob 过滤、头像、PR 集成等
  已在 `docs/parity.md` 第五节显式声明为残余，其中 5 项在 wave 8、6 项功能级非目标在 wave 9 已全部迁移。

## Wave 8：消除第五节残余（2026-10-21）

> 来源：`docs/parity.md` 第五节原本列出的 5 项"残余差异"。契约见 [`wave8-contract.md`](./wave8-contract.md)。

### [x] TODO-22 服务端全量提交搜索

- `lib/git.js` `searchCommits()`：一次 `git log --all -n 20000` 扫描，`all/message/author/ref` 四类 facet，
  offset/limit 分页，`scanned`/`capped` 上报；非仓库返回成功值。
- `POST /api/dsh-git-graph/search`：query 非空 ≤200、scope 白名单、limit 1–200、offset ≥0。
- 客户端 Find 栏"全部历史"模式：300ms 防抖、追加分页、扫描上限提示、错误重试、AbortController 取消。
- 验收：host 真实仓库 facet/分页/capped 用例 + 客户端请求体与渲染用例 + 交叉验证（客户端构造的 body 喂回真实路由）。

### [x] TODO-23 自定义分支 glob 过滤

- 客户端 `compileGlob`：`*`（不跨 `/`）、`**`、`?`、`[abc]`、`[!abc]`、前导 `!` 取反；非法模式就地报错且不生效。
- 语义：有 glob 且选择为"全部"时作为过滤器生效；显式选择时取并集；零匹配给出空状态并跳过请求。
- `presentation.customBranchGlobPatterns`（`[{name, glob}]`）预填输入。
- 验收：matcher 表、并集/取反/零匹配/非法模式用例 + 请求体断言。

### [x] TODO-24 工作区改动 ↔ 指定提交对比

- `POST /compare` 接受 `{base, working:true}`：已跟踪 staged+unstaged + 未跟踪（`A`）一并返回；未出生 HEAD 返回空对比。
- `POST /diff` 新增 `working` scope：按 base 提交与工作区对比；未跟踪文件返回全新增 patch（空文件零 hunk、二进制标记）。
- 客户端：提交菜单"与工作区对比"、未提交面板"与 HEAD 对比"；对比视图隐藏 swap、文件行用 working diff。
- 验收：host 用例（修改/暂存/未跟踪/二进制/空文件/未出生 HEAD）+ 客户端请求体与视图用例 + 真实仓库探针。

### [x] TODO-25 快捷键：可配置 + 全局作用域

- `keyboardShortcut.find/refresh/scrollToHead/scrollToStash` 由 presentation 下发并重映射；
  匹配规则：`CTRL/CMD` 二选一、单修饰键必须精确、alt/shift 精确、`UNASSIGNED` 永不匹配。
- Ctrl/Cmd+↑↓：详情视图父子提交导航（Shift 走合并的第二父/下一子）。
- `globalShortcuts`（默认 false）：document 级捕获监听，最后挂载的面板生效、可编辑目标忽略、卸载即移除。
- 验收：`matchShortcut`/`shortcutFor` 表、父子导航表、fake-document 挂载/卸载与 preventDefault 用例。

### [x] TODO-26 上游 110 项设置逐项对齐

- `lib/settings.js`：110 键（81 canonical + 29 别名）、别名折叠（canonical 优先）、类型强制、非法/未知上报、
  `parseShortcut`、30 键 presentation；`SETTINGS` 每项带 `wiring`（mapped/vscode-only/out-of-scope）与理由。
- host 接线：排序/初始页大小、标签/远端/远端 HEAD/stash 可见性、`--first-parent`、`--reflog`、mailmap、
  未跟踪可见性、`fetch --prune`/`--prune-tags`（默认关闭，与上游一致）。
- client 消费：日期类型/格式、列显隐、文件视图/紧凑目录、自动居中、引用标签对齐/合并、弱化行、自定义 emoji、
  markdown 子集、对话框默认、右键菜单可见性、增强无障碍、仓库下拉排序、分页（initialLoad/loadMore/自动加载）。
- 逐键处置表：[`settings-parity.md`](./settings-parity.md)。
- 验收：键数/别名目标/折叠/强制/上报/presentation/快捷键/docs 一致性测试；host 每项设置的默认值+覆盖+非法回退用例。

## Wave 9：迁移原「非目标」6 项（2026-10-21）

> 来源：`docs/parity.md` 原 §5.2 的 6 项非目标。契约见 [`wave9-contract.md`](./wave9-contract.md)。

### [x] TODO-27 列宽拖拽

- 表头 Date/Author/Commit 拖拽句柄（pointer capture、`touch-action:none`）、clamp 区间、双击重置、
  `localStorage` 持久化；`--dgg-col-*` CSS 变量驱动表头与行，列显隐仍可用。

### [x] TODO-28 `git archive` 导出

- `POST /archive`：`git archive --format=zip|tar.gz` 写入 `<workspace>/.dsh-git-graph/archives/`，
  realpath 围栏、文件名净化 + 唯一后缀、返回工作区相对路径/字节数；提交/分支/标签/远端菜单入口 + 格式选择对话框。

### [x] TODO-29 作者头像

- `repository.commits.fetchAvatars`（默认关闭）→ `/graph`、`/commit` 的 Gravatar URL（md5 + identicon，空邮箱 null），
  `presentation.avatars` 开关；客户端 `<img referrerpolicy=no-referrer loading=lazy>` + 首字母彩色兜底，关闭时无网络请求。

### [x] TODO-30 PR 创建集成

- `POST /pr`：origin/首个 remote 解析（https/ssh）→ github/gitlab（含子组）/bitbucket/other；
  base ← 请求 → `origin/HEAD` → main → master；内置 compare/MR/PR URL + `customPullRequestProviders` 的 `$1..$8` 模板；
  客户端对话框展示 provider、`base ← branch`、URL，可复制/打开。

### [x] TODO-31 跨工作区批量结束评审

- `/review` 新增 `scopes`（遍历所有会话键，repoPath + reviewed/total + 时间，回收过期项，上限 100）
  与 `end`（按范围或 `all:true` 批量清除）；评审条目写入 `repoPath`；客户端评审管理面板分组列出并支持单个/全部结束。

### [x] TODO-32 仓库配置导入/导出

- `<repo>/.gitgraph.json`（≤128 KiB，`{version, exportedAt, settings}`）+ `POST /repoconfig` 的 status/export/import/clear；
  导出仅写非默认的 canonical 键，导入校验并报告 unknown/invalid，按仓库覆盖生效（仓库优先于插件配置），清除恢复；
  客户端对话框显示状态/路径/键数/冲突并可在导入后刷新图谱。

## 非目标（wave 9 之后只剩设置键层面）

功能层面已无未迁移项。以下仅剩设置键层面的差异，逐键理由见 [`settings-parity.md`](./settings-parity.md)：

| 项 | 原因 |
| --- | --- |
| 10 项 VS Code 专属键（`commitDetailsView.location`、`openNewTabEditorGroup`、`showStatusBarItem`、`retainContextWhenHidden`、`integratedTerminalShell` 等） | DSH 没有对应宿主物（webview 布局、编辑器分组、状态栏、集成终端） |
| `repository.sign.*`（提交/标签签名） | 需要 `gpg` 与签名身份，沙箱无法验证；且属宿主级安全策略 |
| `dialog.*` 中 DSH 对话框未提供的 14 项、`repository.onLoad.*`、`fileEncoding` 等（共 26 项 out-of-scope） | 要么没有对应 UI 控件，要么只有透传无消费者；逐条写在处置表里 |
| interactive rebase | 需交互式序列编辑器，超出侧栏面板能力 |

> wave 9 已把原先的 6 项功能级非目标（列宽拖拽、`git archive`、头像、PR 创建、跨工作区评审管理、
> 仓库配置导入/导出）全部迁移。

---

## 建议实施顺序

1. **TODO-1、TODO-2**（半天内可完成，先把已有能力补齐）
2. **TODO-3、TODO-4**（右键菜单 = 交互骨架，后续动作都挂在上面）
3. **TODO-6、TODO-7**（未提交节点 + 对比，最能体现"图谱"价值）
4. **TODO-9**（查找，大仓库可用性门槛）
5. **TODO-12、TODO-13、TODO-15**（动作面补齐）
6. 其余按需

## 每完成一项的固定动作

1. `node --check lib/*.js`
2. `node --test`（基线 55，只增不减）
3. 更新本文件状态 `[x]`，并在 `docs/parity.md` 对应行标注"已迁移"
4. 若影响用户可见行为：更新 `README.md` 的 "What it does"
5. `git add -A && git commit`（单一职责提交，信息说明验收结果）
