# Changelog

## [Unreleased]

### Removed

- `.agent-code-attribution/` 日志路径、`.agent-code-attribution.json` 兼容读入，以及 **`AGENT_CODE_ATTRIBUTION_CONFIG`** 环境变量；`init` 生成的 `.gitignore` 规则不再包含上述路径。
- `init` 的 `.gitignore` 条目不再包含 **`.cursor/cursor-attribution*.log`**；日志仅在 **`.aicode-ratio/`** 下跟踪。

### Changed

- **BREAKING：** npm 包重命名为 **`aicode-ratio`**；CLI 为 `aicode-ratio` / `acr`（曾用包/CLI 名：`cursor-code-attribution` 等历史名称见仓库历史）。
- 默认配置与日志：**`.aicode-ratio.json`**、**`.aicode-ratio/log.jsonl`**；仍兼容 **`.cursor-attribution.json`** 及 **`CURSOR_ATTRIBUTION_CONFIG`**；优先 **`AICODE_RATIO_CONFIG`**。
- Hook 脚本：**`aicode-ratio-append-log.mjs`**；合并/卸载仍识别旧标记 `agent-code-attribution-append-log`、`cursor-attribution-append-log`。

### Added

- M0: Project skeleton, CLI stub with `init`, `report`, `uninstall`, `doctor`, `config print` commands
- M0: GitHub Actions CI workflow
