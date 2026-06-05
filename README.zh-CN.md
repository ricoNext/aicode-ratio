<p align="center">
  <a href="https://github.com/ricoNext/aicode-ratio">
    <picture>
      <source srcset="logo.jpeg" media="(prefers-color-scheme: dark)">
      <source srcset="logo-light.jpeg" media="(prefers-color-scheme: light)">
      <img src="logo.jpeg" alt="aicode-ratio logo">
    </picture>
  </a>
</p>

<p align="center">一个统计 AI agent 的代码变更与手写代码变更的比率（AI Code Ratio）的命令行工具</p>

<p align="center">
  <a href="https://www.npmjs.com/package/aicode-ratio"><img alt="npm" src="https://img.shields.io/pnpm/v/aicode-ratio?style=flat-square" /></a>
  <a href="https://github.com/ricoNext/aicode-ratio/actions/workflows/publish-npm.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/ricoNext/aicode-ratio/publish-npm.yml?style=flat-square&amp;branch=main" /></a>
</p>

[English](README.md)

**aicode-ratio** 是一个统计某段时间内 AI agent 的代码变更与手写代码变更的比率（AI Code Ratio）的命令行工具：

它通过AI agent 提供的 **Hooks** 记录 **AI 编程智能体 / Tab** 在何时**改过、保存过哪些文件**，再与 **Git 提交**在时间上对齐，估算一段时间内 **「有多少提交 / 多少变更文件」曾与编辑器侧活动重合**。

目前已经支持多种 AI agent 的 Hooks，包括：

- Cursor
- Claude Code
- CodeBuddy(IDE & CLI)
- Qoder(IDE & CLI)
- Codex

> Cursor 支持 Tab 模式，其它编辑器暂不支持。

输出可以是 **Markdown、JSON 或 CSV**，便于自己存档、发团队或进二次分析 — **不是**厂商控制台里的官方指标，而是你可控的、与 Git 可对账的补充视角。

---

## 与厂商「接受率」类漏斗指标的区别与优点

> 一句话概括： 厂商统计的是 agent 采纳率，aicode-ratio 统计的有多少代码是 agent 写的。

### 差别是什么

| 维度 | 厂商「接受率」类漏斗（示意） | aicode-ratio |
| --- | --- | --- |
| 数据来源 | 编辑器 / 云端产品链路，定义随厂商更新 | 本机 Hook 日志 + 本地 Git |
| 统计对象 | 常围绕「建议 → 接受 / 拒绝」等产品事件 | **文件是否被 Agent/Tab 触碰过**，再与 **commit 时间窗**对齐 |
| 可见范围 | 多在官方界面或 API 内 | 你仓库里的 **`.aicode-ratio`** 下日志与报表文件 |
| 与 Git 的关系 | 不一定与某次 `git commit` 一一可对账 | 显式按 **分支、时间区间、提交** 出表 |

两者**不互斥**：厂商指标回答「产品内采纳行为」，aicode-ratio 回答「在本机编辑链路里，哪些变更曾靠近 AI 辅助」— **口径不同，不能互相替代**。

### 优点是什么

- **口径透明**：时间窗、分支、是否含 merge、是否按作者过滤等，都可由命令行与 `.aicode-ratio.json` 说清。
- **可自建、可审计**：日志默认在仓库侧（团队模式可约定提交 `*.jsonl`），报表可进 Git 或 CI 产物。
- **不依赖厂商是否开放某块仪表盘**：只要 Hook 仍触发、本机有 Git，就能在一致流程下复现同类报表。
- **与研发节奏对齐**：按自然月 / 季度、按分支做复盘时，和「我们这段时间合并了什么」同语境。
- **完全本地**， 日志完全隐私，不用担心泄露。

---

## 统计什么、统计不到什么

### 统计的是什么

- **本机**在配置的时间范围内，编辑器写入的 **文件路径 + 时间**（及可选 **`gitUser`**），来源可区分 **`agent` / `tab`**（视 Hook 是否提供）。
- 在指定 **`--since` / `--until`** 与分支上，Git 的 **提交列表及每次提交变更的文件路径**。
- 将两者按 **「每个提交前后若干小时」** 的时间窗做交集，得到：
  - **口径 A**：有多少 **提交** 至少有一个变更文件在时间窗内被日志命中；
  - **口径 B**：统计区间内所有 **不重复变更文件** 中，有多少曾在对应提交的时间窗内被日志命中；
  - 若日志带 **`gitUser`**，还可看 **按本机 Git 身份汇总的触碰情况**（与口径 A 同分母语境）。

### 统计不到或刻意不覆盖的内容

- **不是行级归属**：同一文件里人机混写，整体仍按「文件是否被触碰」计，**无法**拆到每一行是谁写的。
- **没有本机日志就没有归因**：在从未装 Hook、或另一台机器上提交的改动，**无法**从本工具推断「是否经 AI」；归属是 **机器与仓库侧配置** 绑定的。
- **不读取文件正文、提示词、密钥**：日志只记路径与时间（及可选 `gitUser`），**不**把代码内容或对话写进日志。
- **不能替代厂商官方 Acceptance**：数值与官方漏斗 **不可直接对比**，因定义与采样边界不同。
- **依赖 Git 与编辑器行为**：rebase、cherry-pick、大量合并提交等会影响「提交粒度」观感；合并提交默认 **排除**（可用 `--include-merges` 打开）。

**环境要求（使用侧）：** Node.js ≥ 20、PATH 中有 **Git**；通过 `pnpm dlx` / `npx` 调用时需能访问 npm registry；编辑器需支持本工具所接入的 **Hooks** 写法。

---

## 使用步骤

### 0. 全局安装（可选）

```bash
npm install -g aicode-ratio
# 或：pnpm add -g aicode-ratio
# 或：npm install -g aicode-ratio
# 或：yarn global add aicode-ratio
# 或：bun add -g aicode-ratio
```

全局安装后，可使用 **`acr`** 或 **`aicode-ratio`**（同一入口）。

```bash
acr --help
```


### 1. 初始化：

在项目根目录下执行以下命令：

```bash
# pnpm 
pnpm dlx aicode-ratio init

# 已全局安装
acr init
```
`init` 命令会在项目下完成：

1. **`.aicode-ratio.json` 配置**（若尚无则创建，否则合并已启用编辑器等字段）
2. 如果选择非团队模式，会询问是否把个人日志路径写入 **`.gitignore`**（默认「是」）。
3. 安装所选编辑器的 Hooks，并写入对应的配置文件。
4. 在已选编辑器的 **`commands/`** 目录下写入 **`aicode-ratio-report`**， 让 AI agent 可以调用该命令生成报表。

另外 `init` 支持在命令行直接带参数；常用选项如下（完整列表以 `acr init --help` 为准）：

| 参数 / 选项 | 说明 |
| --- | --- |
| `[editors...]` | 位置参数：空格分隔的编辑器 id（如 `cursor`、`claude-code`）；与下方 `--editors`、`--<id>` 等组合方式见下文 |
| `--repo <path>` | 仓库根目录，默认当前目录 `.` |
| `--editors <list>` | 逗号分隔的编辑器 id 列表；优先级高于各 `--<id>` 开关与位置参数 |
| `-y` / `--yes` | 跳过 Inquirer 交互，**仅安装 Cursor**；适用于无 TTY（如 CI）或脚本 |
| `--team` | 开启团队模式：每人写入 `.aicode-ratio/logs/` 下独立 `*.jsonl` |
| `--no-team` | 个人模式：单一主日志文件（与 `-y` 搭配时默认为个人模式） |
| `--gitignore-logs` | **仅个人模式**：把 `.aicode-ratio` 相关日志路径追加进 `.gitignore`；与 `--no-team` 搭配时，非交互场景下常为默认行为 |
| `--no-gitignore-logs` | **仅个人模式**：不追加上述 `.gitignore` 规则，便于将日志纳入 Git 跟踪 |
| `--cursor` | 安装 Cursor 的 Hooks 等 |
| `--codebuddy` | 安装 CodeBuddy 的 Hooks 等 |
| `--claude-code` | 安装 Claude Code 的 Hooks 等 |
| `--qoder` | 安装 Qoder 的 Hooks 等 |
| `--codex` | 安装 Codex 的 Hooks 等 |
| `--codebuddyIDE` | 已弃用，效果与 `--codebuddy` 相同 |
| `-h` / `--help` | 显示该子命令的帮助信息 |


**为什么需要团队模式？**

团队模式是应对多人协作场景下，每个开发者需要独立统计自己的代码变更与 AI 辅助的比率。

使用团队模式， 产生的日志文件不会添加到 `.gitignore` 中， 便于团队成员之间共享日志。 并且日志会按照每个开发者的 Git 用户名进行分类， 便于团队成员之间共享日志。

在进行统计时，也会分别统计每个开发者的 Git 用户的 agent code 变更率， 和总体 agent code 变更率。


**团队模式与个人模式（命令行显式指定，避免交互）**

- **`--team`**：每人写 **`.aicode-ratio/logs/<slug>.jsonl`**，`report` 会合并该目录下全部 `*.jsonl`；通常把日志 **提交进 Git**；`init` **不会**把团队日志路径写进 `.gitignore`。
- **`--no-team`**：个人模式（**`-y` 时默认**），单文件 **`logPath`**（默认 `.aicode-ratio/log.jsonl`）。
- **个人模式 + 非交互**：**`--gitignore-logs`**（默认行为）在 `.gitignore` 中追加主日志相关行；**`--no-gitignore-logs`** 表示不追加、可把日志纳入版本库。
- 团队模式下 **不要**再传 `--gitignore-logs` / `--no-gitignore-logs`（会与个人模式冲突并报错）。

### 2. 自检：`doctor`

```bash
pnpm dlx aicode-ratio doctor
```

用于检查 Node、Git、Hook 配置、日志路径是否就绪。

### 3. 日常开发：让日志持续产生

在已接入的编辑器里用 **Agent / Tab** 正常改文件、保存；事件会追加到个人或团队模式对应的 **`.jsonl`**。若长期无新行，多半是 Hook 未触发或不在仓库根 — 见本节末**故障排查**。

### 4. 生成报表

#### 推荐利用 Agent 生成报表

`init` 完成后，仓库里已经生成各编辑器可识别的 command 文件（例如 **`.[编辑器]/commands/aicode-ratio-report.md`**，与你在 `init` 里勾选的编辑器一致）。

因此生成报告时 **不必先手写整条 `report` 命令**：在对应编辑器的聊天里输入 **`/`**，选择 **`aicode-ratio-report`**，即可把「读说明 → 与用户确认或询问统计区间 → 在集成终端执行 `report` → 产出 Markdown」交给 **Agent**。命令说明里**不设**默认 `--since` / `--until`；若你在消息里写了时间段，Agent 会先换算成 `YYYY-MM-DD` 并向你**复述确认**；若没写清，Agent 会按说明**依次询问**起始日与结束边界（半开区间）。**自然语言约定**：像「本月」「这周」「最近几天」且未说「整月 / 到月底」时，应按 **周期起点（含）→ 含今天在 UTC 下的整天** 来设 `until`（半开区间下即 **`until` = 当前 UTC 日历日的次日**），不要把「本月」默认当成「当月 1 号到下月 1 号」的整月；只有在你明确要 **整月 / 整周** 时才用「下一段起点」作 `until`。**若始终无法识别或确认时间范围，则不得执行 `report`、不得生成报表文件或编造占比结论**，只能请你先给出明确的起止日期。输出目录仍为 **`.aicode-ratio/reports/`**。请始终在 **该仓库根** 下执行。

这是与下文「终端里自己跑 `report`」**等价**的流程，一般 **更省事、更少抄错参数**。

例如： 

```bash
# 以 Cursor 为例， 在 Cursor 的聊天里输入：
/aicode-ratio-report  给我生成这个月 AI 辅助的代码变更率报表
/aicode-ratio-report  给我基于xx 分支， 生成这个月 AI 辅助的代码变更率报表
```

#### 备选：在终端手动执行 `report`

适合 CI、无 Agent、或你要完全自定义参数时。

**必须在 Git 仓库根执行**（或使用 **`--repo <path>`** 指向根目录）。

**时间范围**：`--since` / `--until` 为 **半开区间** `[since, until)`；使用 **`YYYY-MM-DD`** 时按 **UTC** 日界，**`until` 当天不计入**。例如 **2026 年 4 月整月**（UTC）：`--since 2026-04-01 --until 2026-05-01`。若只要 **4 月 1 日起到「今天」**（仍在 4 月内），则 `since` 仍为 `2026-04-01`，`until` 取 **「今天」UTC 日期的下一天**（例如 4 月 8 日当天跑报表时常为 `--until 2026-04-09`）。

**推荐输出路径**（与日志同目录树）：

`.aicode-ratio/reports/aicode-ratio-YYYY-MM.md`

**示例（Markdown、当前分支）：**

```bash
pnpm dlx aicode-ratio report \
  --repo . \
  --since 2026-04-01 \
  --until 2026-05-01 \
  --branch "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)" \
  --format md \
  --out ".aicode-ratio/reports/aicode-ratio-2026-04.md"
```

也可使用 **`npx aicode-ratio@latest report`**、全局 **`acr report`**，或本仓库已安装 devDependency 时的 **`pnpm exec aicode-ratio report …`**。

**`report` 常用参数：**

| 选项 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--since` | 是 | — | 起始日（含） |
| `--until` | 是 | — | 结束日（**不含**） |
| `--repo` | 否 | `.` | 仓库根 |
| `--branch` | 否 | `HEAD` | 分析分支 |
| `--format` | 否 | `md` | `json` / `csv` / `md` |
| `--out` | 否 | stdout | 省略则打印到标准输出 |
| `--author` | 否 | — | 按提交作者 **邮箱** 过滤 |
| `--include-merges` | 否 | 关闭 | 需要含 merge 时加上 |
| `--pre-hours` / `--post-hours` | 否 | 见配置 | 覆盖与每个提交对齐的前后搜索小时数 |

以下项**不能**靠 `report` 子命令覆盖，均来自解析后的 **`.aicode-ratio.json`**（及环境变量）：`teamMode`、`logPath`、`gitDateField`、`sources`、`ignoreLogPathPrefixes` 等。

### 5. 其它子命令（按需）

| 命令 | 用途 |
| --- | --- |
| `config print` | 打印当前解析后的配置 |
| `uninstall` | 移除本包写入的 Hook 相关配置 |

命令行短名：**`acr`**（与 `aicode-ratio` 同一入口）。

### 配置字段速查（`init` 生成的 `.aicode-ratio.json`）

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `teamMode` | `false` | `true` 时合并 `.aicode-ratio/logs/` 下所有 `*.jsonl` |
| `logPath` | `.aicode-ratio/log.jsonl` | 个人模式主日志路径 |
| `preCommitHours` | `72` | 提交时间之前向前搜日志的小时数 |
| `postCommitHours` | `2` | 提交时间之后向后搜日志的小时数 |
| `gitDateField` | `"committer"` | 使用 `committer` 或 `author` 时间对齐 |
| `ignoreLogPathPrefixes` | `node_modules/` 等 | 日志路径前缀过滤 |
| `sources.agent` / `sources.tab` | `true` | 是否计入对应通道 |

### 故障排查（摘录）

- 先运行 **`acr doctor`**。
- **日志不增长**：确认对应编辑器的 hooks 已由 `init` 写入，并在本仓库内用 Agent **实际改存**过受 Git 跟踪的文件。
- **报表空或异常**：确认当前目录为 **Git 根**，`--since`/`--until` 是否覆盖你有提交的时间段。

---

## 关于统计的说明

### 时间窗与「触碰」的含义

对每个 Git 提交，工具取一个时间锚点（默认用 **`gitDateField`** 配置的提交者或作者时间），在 **`[提交时间 - preCommitHours, 提交时间 + postCommitHours]`** 内向日志检索：若某次提交变更的**任一文件路径**在该窗内出现过 Hook 记录，则该提交在**口径 A** 下计为「被触碰」；**口径 B** 则在全区间去重文件路径后，看有多大比例曾在**其所属提交**的同一类时间窗内被命中。

`--pre-hours` / `--post-hours` 仅覆盖上述小时数，**不**改变其它配置含义。

### 口径 A（按提交）

**`commitsWithTouch / commitsTotal`**

若某次提交中，至少有一个变更文件在该提交对应的时间窗口内出现在日志中，则该提交计为「被触碰」。

### 口径 B（按不重复变更文件）

**`filesGitUniqueTouched / filesGitUnique`**

在统计区间内，所有提交里出现过的**不重复文件路径**中，有多大比例曾在其**对应提交**的时间窗口内被日志命中。

### 按本机 Git 用户（可选）

若日志行含 **`gitUser`**（Hook 执行时该仓库的 `git config user.*`），报表可出现 **`byLogGitUser`** 等汇总；旧数据无 `gitUser` 时可能归入 **`(unknown log user)`**。分母语境与口径 A 一致。

### 报表中同时展示多类比例

为避免「只看一个数」产生误解，报表会同时给出 **口径 A、口径 B**（及有条件的 **`byLogGitUser`**）；解读时请始终带上 **时间区间、分支、是否含 merge、是否过滤作者** 等前提。

---

## 附录：本地开发与参与贡献

### 版本与 Changelog（Changesets）

发版与 `CHANGELOG.md` 的维护使用 [Changesets](https://github.com/changesets/changesets)。流程说明见 **[.changeset/README.md](.changeset/README.md)**。

- **`pnpm changeset`**：为即将发布的改动添加一条 changeset（生成 `.changeset/*.md`），与代码一起提交/合并。
- **`pnpm changeset:version`**：根据已合并的 changeset **提升 `package.json` 的 `version`**，并用 `@changesets/changelog-github` **更新根目录 `CHANGELOG.md`**（随后删除已消费的 changeset 文件）。
- 审阅 diff 后 **提交并推送**，再 **`git tag v<版本>`** 且 **`git push origin v<版本>`**，由 **`.github/workflows/publish-npm.yml`** 触发 **npm publish**。

本仓库开发与 CI：`pnpm install`、`pnpm run build`、`pnpm test`；CI 使用 `pnpm install --frozen-lockfile`。
