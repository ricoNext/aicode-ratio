# Changelog

## [Unreleased]

### Fixed

- Hook `append-log.mjs`：`gitLocalUser` 使用 **`execFileSync('git', [...])`** 读取 `user.name` / `user.email`（此前误用 `execSync` 传参数组，读取始终失败，团队模式日志名为 **`_unknown.jsonl`**）。

### Changed

- **`report --out <path>`**：写入前自动 **`mkdir -p`** 父目录（与此前需手动 `mkdir` 不同）。
- Slash 命令 **`aicode-ratio-report`**：不再在 Markdown 中预填当月 `--since`/`--until`；改为占位符与流程说明，要求 Agent 从用户消息解析统计区间或**交互询问**起止日期并**复述确认**后再执行 `report`；**若仍无法识别或确认时间范围，禁止执行 `report`、禁止产出报表或编造占比**。
- Slash 命令 **`aicode-ratio-report`** 默认报表输出目录改为 **`.aicode-ratio/reports/`**（原为仓库根下 `reports/`）。
- 团队模式日志文件名：仅有 `user.name` 时不再加 `name-` 前缀，直接使用经清理的 **`user.name`** 作为 `*.jsonl` 文件名（空格等转为 `_`）；仍优先使用 `user.email` 作为文件名基底。

### Removed

- `.agent-code-attribution/` 日志路径、`.agent-code-attribution.json` 兼容读入，以及 **`AGENT_CODE_ATTRIBUTION_CONFIG`** 环境变量；`init` 生成的 `.gitignore` 规则不再包含上述路径。
- `init` 的 `.gitignore` 条目不再包含 **`.cursor/cursor-attribution*.log`**；日志仅在 **`.aicode-ratio/`** 下跟踪。

### Changed

- **BREAKING：`acr init`**： **`--team` / `--no-team`** 与交互式「团队模式」；团队模式**不向** `.gitignore` 追加跟踪日志路径。个人模式在非 TTY 下默认仍追加日志忽略规则，并支持 **`--gitignore-logs` / `--no-gitignore-logs`**；TTY 下个人模式会**再次询问**是否将日志写入 `.gitignore`。配置 **`teamMode`**；团队日志路径 **`.aicode-ratio/logs/<用户>.jsonl`**，`report` 合并该目录全部 `*.jsonl`。
- **`report` JSON** `reportVersion` 现为 **`2`**：新增 `byLogGitUser`、每条 commit 的 `logGitUserKeys`；`commits` 行结构扩展（仍含原字段）。
- **BREAKING：** npm 包重命名为 **`aicode-ratio`**；CLI 为 `aicode-ratio` / `acr`（曾用包/CLI 名：`cursor-code-attribution` 等历史名称见仓库历史）。
- 默认配置与日志：**`.aicode-ratio.json`**、**`.aicode-ratio/log.jsonl`**；仍兼容 **`.cursor-attribution.json`** 及 **`CURSOR_ATTRIBUTION_CONFIG`**；优先 **`AICODE_RATIO_CONFIG`**。
- Hook 脚本：**`aicode-ratio-append-log.mjs`**；合并/卸载仍识别旧标记 `agent-code-attribution-append-log`、`cursor-attribution-append-log`。

### Added

- `init` 为所选编辑器写入 **`aicode-ratio-report`** slash 命令（Markdown）：**Cursor** `.cursor/commands/`、**Claude Code** `.claude/commands/`、**CodeBuddy** `.codebuddy/commands/`、**Qoder** `.qoder/commands/`；内置当月 UTC 的 `report` 示例命令；`uninstall` 若文件仍含管理标记则删除。
- 日志行可选字段 **`gitUser`**（`user.name` / `user.email`）：由 `append-log` 在 hook 时刻从仓库读取；`report` 输出 **`byLogGitUser`** 与每 commit 的 **`logGitUserKeys`**（JSON `reportVersion: 2`）。
- M0: Project skeleton, CLI stub with `init`, `report`, `uninstall`, `doctor`, `config print` commands
- M0: GitHub Actions CI workflow
