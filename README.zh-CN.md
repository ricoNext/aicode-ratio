# aicode-ratio

[English](README.md)

在本地追踪 **AI 编程智能体 / Tab** 的写盘事件（当前已接入 **Cursor** Hooks；**Claude Code** 等更多编辑器在路线图中），并与 Git 提交交叉比对，估算 **AI 写码占比** 类报表（按月 / 按季度）。

## 能做什么、不能做什么

**可以：**

- 估计某段时间内，有多少比例的提交（或变更文件）在提交前曾被编辑器 Agent 触碰过。
- 按提交拆解，并以 JSON、CSV 或 Markdown 输出汇总比例。
- 在 Hook 提供区分时，按来源拆分：`agent` 与 `tab`。

**不可以：**

- 替代各厂商自带的「接受率」类漏斗指标（例如 Cursor 官方 Acceptance）。
- 按行级精确归属（人机混编文件整体计一次）。
- 在无本机日志的机器上对齐 Git — 归属依赖**本机**记录。

**环境要求：** Node.js ≥ 20、开发本仓库时需 [pnpm](https://pnpm.io/) ≥ 9、PATH 中有 Git；运行期需要支持 Hooks 的编辑器（当前为 **Cursor** 桌面版）。

---

## 本地开发

```bash
corepack enable
pnpm install
pnpm run build
pnpm test
```

CI 使用 `pnpm install --frozen-lockfile`（pnpm 下与 `npm ci` 等价的严格安装）。

设计与实现文档参见 [docs/multi-editor-plan.md](docs/multi-editor-plan.md)
（多编辑器规划）与 [docs/aicode-ratio-npm-package.md](docs/aicode-ratio-npm-package.md)
（包整体方案）。

---

## 快速开始（约 1 分钟）

```bash
# 在仓库中一次性初始化
pnpm dlx aicode-ratio init

# 检查 hooks 与日志路径
pnpm dlx aicode-ratio doctor
```

在普通终端里，`init` 会先由 **Commander** 解析 `[editors...]` / 选项，再在 TTY 下弹出 **Inquirer** 多选清单（目前仅 Cursor）。无需交互时可用：**`acr init cursor`**、**`acr init --editors cursor`**、**`acr init -y`**。

之后在 Cursor 等已接入的编辑器中让 Agent / Tab 编辑文件 — 事件会写入 `.aicode-ratio.json` 中的 `logPath`（默认：`.aicode-ratio/log.jsonl`）。

---

## 生成报告

```bash
pnpm dlx aicode-ratio report \
  --repo . \
  --since 2026-04-01 \
  --until 2026-05-01 \
  --branch main \
  --format md \
  --out ./reports/2026-04.md
```

合并提交默认排除；需要时请加 `--include-merges`。

---

## 命令一览

| 命令 | 说明 |
| --- | --- |
| `init` | 安装 hooks：`[editors...]` / 选项由 Commander 解析；TTY 下用 Inquirer 多选 |
| `doctor` | 检查环境：Node、git、hooks、日志 |
| `report` | 生成归属报告 |
| `uninstall` | 移除此包写入的 hook 配置 |
| `config print` | 打印解析后的配置 |

命令行短名：**`acr`**（与 `aicode-ratio` 同一入口）。

---

## 配置说明

若仓库中尚不存在配置文件，`init` 会写入 **`.aicode-ratio.json`**。仍会读取旧版 **`.agent-code-attribution.json`**、**`.cursor-attribution.json`**（若存在）。

环境变量（按「首个存在的路径」生效）：**`AICODE_RATIO_CONFIG`** → **`AGENT_CODE_ATTRIBUTION_CONFIG`** → **`CURSOR_ATTRIBUTION_CONFIG`** → 仓库/用户目录下的 JSON；详见 `src/config/load-config.ts`。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `logPath` | `.aicode-ratio/log.jsonl` | 相对仓库根的 JSONL 日志路径 |
| `preCommitHours` | `72` | 提交前在日志中向前扫描的小时数 |
| `postCommitHours` | `2` | 提交后在日志中向后扫描的小时数 |
| `gitDateField` | `"committer"` | `"committer"` 或 `"author"` |
| `ignoreLogPathPrefixes` | `["node_modules/","dist/",".git/"]` | 跳过的路径前缀 |
| `sources.agent` / `sources.tab` | `true` | 是否计入 Agent / Tab 通道 |

---

## 如何理解比例

**比例 A（按提交）：** `commitsWithTouch / commitsTotal`  
若某次提交中，至少有一个变更文件在该提交对应的时间窗口内出现在日志中，则该提交计为「被触碰」。

**比例 B（按文件）：** `filesGitUniqueTouched / filesGitUnique`  
在整个统计周期内，有多少个「不重复的变更文件」在其所属提交的时间窗口内被日志命中。

报告中会同时展示两种比例，避免歧义。

---

## 隐私与 .gitignore

`init` 会向 `.gitignore` 追加当前与旧版日志路径，例如：

```gitignore
.aicode-ratio/log.jsonl
.aicode-ratio/log.jsonl.*
.aicode-ratio/hook-errors.log
.agent-code-attribution/log.jsonl
.agent-code-attribution/log.jsonl.*
.agent-code-attribution/hook-errors.log
.cursor/cursor-attribution.log.jsonl
.cursor/cursor-attribution.log.jsonl.*
.cursor/cursor-attribution-hook-errors.log
```

日志仅记录**文件路径与时间戳** — **不会写入文件内容、提示词或密钥**。

---

## 故障排查

请先运行 `acr doctor` 或 `pnpm dlx aicode-ratio doctor`。常见问题：

- **日志不增长** — 确认 `init` 已写入 `.cursor/hooks.json`，并在编辑器中触发一次 Agent 写盘。
- **仓库根目录不对** — 在 Git 仓库根目录执行，或使用 `--repo <path>`。
- **Hook 入参格式变更** — 请带上编辑器名称与版本开 issue；本工具支持多种候选字段名。

---

## 参与贡献

单元测试与集成测试见 `test/`。若要为新编辑器或新版本增加 stdin 样例，请在 `test/fixtures/` 下添加 `.json` 样例，并扩展 `src/hooks/append-log.mjs` 中的解析逻辑。
