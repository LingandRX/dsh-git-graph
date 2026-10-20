# dsh-git-graph 待办清单（对齐 vscode-git-graph）

差距来源见 [`parity.md`](./parity.md)。本清单按**可交付、可验收**拆分，每条带文件范围与验收标准，
可直接作为实现任务领取。

约定：

- `P0` 补完主链路，`P1` 常用增强，`P2` 锦上添花。
- 每条状态：`[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成。
- 验收统一先跑：`node --check lib/*.js`、`node --test`（当前基线 **87** 个用例全绿）。
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

### [ ] TODO-5 分支/标签级菜单项（P1）

- **目标**：右键 branch chip → 检出 / 删除 / 重命名；右键 tag chip → 删除 / 推送。
- **依赖**：TODO-1、TODO-6、TODO-7。

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

### [ ] TODO-8 提交顶点悬浮提示（P2）

- **目标**：悬停提交节点显示"是否在 HEAD 内 / 被哪些分支、标签、stash 包含"（对齐 A7）。
- **文件**：`lib/git.js`（`branch --contains` 一次性批量，或 `for-each-ref --contains <hash>`）、`lib/client.js`（受控 tooltip，延时出现）。
- **验收**：悬停 400ms 出现；内容来自 host 而非 client 猜测；键盘聚焦同样可见；不阻塞列表滚动。
- **注意**：批量查询需限流（一次悬停只查一个哈希，带缓存 LRU ≤ 64）。

---

## 阶段 3：查找与过滤

### [ ] TODO-9 查找控件（P1）

- **目标**：图内搜索提交（对齐 A4），快捷键沿用 DSH 侧栏习惯（先做面板内按钮 + 输入框，快捷键可选）。
- **文件**：`lib/client.js`（搜索框 + 高亮 + 上下跳转），host 无需改动（客户端对已加载页做过滤即可）。
- **验收**：
  - 输入即过滤（message / abbrev+hash / author / refs 四类，防抖 150ms，纯大小写不敏感）；
  - 命中计数 `N/M`、Enter/Shift+Enter 或上下按钮跳转并滚动到可见；
  - 无命中显示空态；Esc 清空并退出搜索；
  - 补 client 用例 2（匹配与跳转顺序）。

### [ ] TODO-10 分支过滤（P2）

- **目标**：只显示选中分支的提交（对齐 A5）。
- **文件**：`lib/index.js`+`lib/git.js`（`graph` 请求增加 `branches: string[]`，`git log <branches...>`）、`lib/client.js`（多选下拉）。
- **验收**：默认全部；选中子集后请求携带该子集且图只含相关提交；选择状态在本次会话内保持；补 host 用例 1。

### [ ] TODO-11 列显隐与排序（P2）

- **目标**：可隐藏作者/时间、可切换 `--date-order` / `--author-date-order` / `--topo-order`（对齐 A6、C4）。
- **文件**：`cordis.patch.yml`（新增 `commitOrder`、`hideAuthor`、`hideDate`）、`lib/git.js`（排序参数）、`lib/client.js`（工具栏菜单开关，选择存 `localStorage`）。
- **验收**：切换立即生效且刷新后保持；非法排序值回落到 `date-order`；补 host 用例 1（参数映射）。

---

## 阶段 4：Git 动作扩展

> 每条都遵循：先 `lib/git.js` 的 `performAction`，再 `ACTION_FIELDS`，再 UI，最后 3 个路由/工具复用同一实现。

### [ ] TODO-12 分支动作补齐（P1）

- [ ] `renameBranch`（`git branch -m`)
- [ ] `merge`（`git merge [--no-ff] [--no-commit]`，冲突时返回 git 原文而非抛栈）
- [ ] `resetToCommit`（`git reset --soft|--mixed|--hard`，`hard` 必须二次确认并显示脏工作区警告）
- [ ] `pullBranch`（`git pull --ff-only` 优先，可选 `--no-ff`）
- [ ] `pushBranch`（`git push`，无上游时提示）
- [ ] `rebase`（非交互；明确标注"不做 interactive rebase"）
- **验收**：每个动作在临时仓库测试中成功路径 + 失败路径各 1 用例；`hard reset` / `rebase` 在脏工作区时先警告；工具端不暴露任何写操作。

### [ ] TODO-13 提交动作补齐（P1）

- [ ] `dropCommit`（仅限非 HEAD 且未被引用时允许，先 `git rebase --onto`；高风险，默认隐藏，需在确认框勾选"我了解这会重写历史"）
- [ ] `mergeCommit`（等价 TODO-12 的 `merge` 指定提交）
- **验收**：`dropCommit` 在会被拒绝的场景给出明确原因；补 host 用例 2。

### [ ] TODO-14 标签详情与推送（P2）

- [ ] annotated tag：`git for-each-ref --format=%(taggername)...` + `git tag -l --format=%(contents)` 展示 tagger 与 message
- [ ] `pushTag`（`git push <remote> <tag>`）
- **验收**：lightweight 与 annotated 区分显示；推送失败显示远端拒绝原文。

### [ ] TODO-15 贮藏 stash 全族（P1）

- [ ] `stashPush` / `stashApply` / `stashPop` / `stashDrop` / `branchFromStash`
- [ ] 图上以 stash 引用展示（`refs/stash`，`stash@{n}` 标签）
- **验收**：stash 与分支/标签同处以独立 chip 显示；四条动作各有成功/失败用例；`pop` 冲突时保留 stash 并提示。

### [ ] TODO-16 未提交改动动作（P2）

- [ ] `cleanUntracked`（默认 dry-run 预览再执行）、`resetUncommitted`（soft/mixed/hard）、`stashUncommitted`、`resetFileToRevision`
- **验收**：`clean` 必须先显示将被删除的文件清单；`hard` 类动作双重确认。

### [ ] TODO-17 远端管理（P2）

- [ ] `addRemote` / `editRemote` / `deleteRemote` / `pruneRemote` / `pushToMultipleRemotes`
- **验收**：远端列表含 URL 与 fetch/push 地址；删除远端需确认；补 host 用例 2。

---

## 阶段 5：工程化周边

### [ ] TODO-18 多仓库支持（P1）

- **目标**：会话工作区内发现多个仓库并可切换（对齐 C1）。
- **文件**：`lib/git.js`（`discoverRepos(root, maxDepth)`）、`lib/index.js`（`graph` 请求携带 `repoPath` 绝对路径并做**白名单校验**：必须位于 workspace 内）、`lib/client.js`（仓库下拉）、`cordis.patch.yml`（`maxDepthOfRepoSearch`）。
- **验收**：
  - 工作区含子仓库时下拉可切换，选择项在刷新后保持；
  - 请求外部路径被拒绝（`BAD_REQUEST`），补 host 安全用例 2（`..` 逃逸、符号链接逃逸）；
  - 单仓库场景不显示下拉。

### [ ] TODO-19 代码评审标记（P2）

- **目标**：记录"已评审文件"，跨会话保留、90 天过期（对齐 C2）。
- **文件**：`lib/index.js`（用 DSH `storageDomain` 持久化，键 `session → { commit, files: [{path, reviewedAt}] }`）、`lib/client.js`（文件行勾选、未评审加粗、进度 `3/8`）。
- **验收**：勾选状态重开标签页仍在；`git_graph` 工具保持只读（不得写入评审状态）；过期清理有单测。

### [ ] TODO-20 视觉与设置面（P2）

- [ ] `graphStyle`：`rounded` / `angular`（`lanePath` 增加直角分支）
- [ ] `graphColours`：自定义 lane 调色板（`cordis.patch.yml` 数组）
- [ ] 签名状态：`git log --format=%G?` 在详情显示 verified/unverified
- [ ] emoji shortcode：`:smile:` → 😄，支持 `customEmojiShortcodeMappings`
- [ ] mailmap / issue 链接（issue URL 模板 → 提交正文中的编号变链接）
- [ ] 快捷键：`Ctrl+H` 回 HEAD、`Ctrl+R` 刷新（需确认 DSH 侧栏快捷键注册方式）
- **验收**：每项独立可开关；`angular` 与 `rounded` 快照测试各 1；设置项写进 `cordis.patch.yml` 并有默认值。

---

## 非目标（明确不做）

| 项 | 原因 |
| --- | --- |
| VS Code diff 编辑器 / `openFile` / `openDiffTabLocation` | 由 DSH 文档预览与工作区文件页承担 |
| 状态栏按钮、命令面板命令 | 入口由右侧栏 guide 卡片承担 |
| `retainContextWhenHidden`、`integratedTerminalShell` | VS Code 宿主专属 |
| 推送 PR 创建集成（GitHub/GitLab/Bitbucket 及自定义 provider） | 依赖外部平台 OAuth 与网络；如需可单独立项 |
| interactive rebase | 需交互式序列编辑器，超出面板能力 |
| 头像（`fetchAvatars`、`clearAvatarCache`） | 需网络与缓存目录，且与隐私取舍相关 |

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
