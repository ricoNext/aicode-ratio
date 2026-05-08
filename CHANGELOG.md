# Changelog

## [Unreleased]

### Changed

- **BREAKING:** npm 包重命名为 **`aicode-ratio`**；CLI 为 `aicode-ratio` / `acr`（曾用名：`cursor-code-attribution` → `agent-code-attribution` → 现名）。
- 默认配置与日志： **`.aicode-ratio.json`**、**`.aicode-ratio/log.jsonl`**；仍兼容 **`.agent-code-attribution.json`**、**`.cursor-attribution.json`** 及 `AGENT_CODE_ATTRIBUTION_CONFIG` / `CURSOR_ATTRIBUTION_CONFIG`；新增优先 **`AICODE_RATIO_CONFIG`**。
- Hook 脚本：**`aicode-ratio-append-log.mjs`**；合并/卸载仍识别旧标记 `agent-code-attribution-append-log`、`cursor-attribution-append-log`。

### Added

- M0: Project skeleton, CLI stub with `init`, `report`, `uninstall`, `doctor`, `config print` commands
- M0: GitHub Actions CI workflow
