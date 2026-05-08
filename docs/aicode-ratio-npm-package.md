# AI Agent 写盘归因 npm 包实现方案（aicode-ratio）

本文档描述 npm 包 **aicode-ratio** 的产品形态、目录结构、配置、日志、Hooks 安装、`report` 算法与发布策略，供实现与评审使用。目标是以统一模型覆盖多种 AI 编码助手（当前以 **Cursor** 为首个接入；**Claude Code** 等可逐步扩展）。

## 1. 产品定位与边界

**一句话**：在本机通过各编辑器提供的 Hooks 持续记录 **Agent / Tab 写盘事件**，再用 CLI 与 **Git 提交**在可配置时间窗内做**文件级交叉**，输出月/季报表（JSON / CSV / Markdown）。

**明确承诺**：

- 可统计：某时间窗内，Git 变更文件与「本机 Agent 写盘日志」的交叉覆盖（commit 维度、文件维度，可配置）。
- Tab 与 Agent 可分源统计（依赖 `afterFileEdit` 与 `afterTabFileEdit`）。

**明确不承诺**：

- 不是 Cursor 官方 **Acceptance rate**（展示/接受漏斗）。
- 不是行级司法级归因；同一文件人机混写无法按行拆分。
- 归因依赖本机日志；换机提交、无日志环境无法与 Git 对齐。

**运行环境**：

- Node.js（建议 ≥ 20，以 `engines` 写死为准）。
- Git 在 `PATH`。
- 至少一种已接入的编辑器环境（v1：**Cursor** 桌面版且 Hooks 可用，参考 [Cursor 钩子文档](https://cursor.com/cn/docs/hooks)）。

## 2. 包形态与目录结构

单包即可（不必 monorepo）。

```text
aicode-ratio/
├── package.json
├── README.md
├── LICENSE
├── CHANGELOG.md
├── tsconfig.json
├── src/
│   ├── cli.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── report.ts
│   │   ├── uninstall.ts
│   │   └── doctor.ts
│   ├── hooks/
│   │   └── append-log.mjs
│   ├── report/
│   │   ├── git-queries.ts
│   │   ├── load-log.ts
│   │   ├── intersect.ts
│   │   ├── aggregate.ts
│   │   └── render-md.ts
│   ├── config/
│   │   ├── schema.ts
│   │   └── defaults.ts
│   └── util/
│       ├── paths.ts
│       └── merge-hooks-json.ts
├── templates/
└── test/
```

**bin**：`package.json` 中 `"bin": { "aicode-ratio": "./dist/cli.js", "acr": "./dist/cli.js" }`。

**构建**：使用 `tsup` / `unbuild` 等打 bundle；Hooks 入口使用 `node` 调用**已复制到仓库内的** `.cursor/hooks/aicode-ratio-append-log.mjs`（见下文；Cursor 约定目录仍为 `.cursor/hooks`），避免全局安装路径与 pnpm symlink 问题。

## 3. 配置文件

### 3.1 查找优先级

1. 环境变量 `AICODE_RATIO_CONFIG` 指向的 JSON 路径（未设置时依次尝试 `AGENT_CODE_ATTRIBUTION_CONFIG`、`CURSOR_ATTRIBUTION_CONFIG`，兼容旧包）。
2. 仓库根 `.aicode-ratio.json`，其次 `.agent-code-attribution.json`、`.cursor-attribution.json`。
3. 用户目录 `~/.aicode-ratio.json`，其次同上两份兼容名。
4. 内置默认值。

### 3.2 建议 Schema（`version: 1`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | `1` | 配置版本，便于迁移 |
| `logPath` | string | 默认 `.aicode-ratio/log.jsonl`（相对仓库根；旧版默认曾为 `.cursor/...`） |
| `preCommitHours` | number | 默认 `72`，与「常隔几天才提交」场景可调大 |
| `postCommitHours` | number | 默认 `2`；常用 `git commit --amend` 时建议 `24` |
| `gitDateField` | `"committer"` \| `"author"` | 默认 `committer` |
| `ignoreLogPathPrefixes` | string[] | 如 `node_modules/`、`dist/`、`.git/` |
| `ignoreLogGlobs` | string[] | 可选，micromatch |
| `maxLogBytes` | number | 可选日志轮转阈值 |
| `sources` | `{ agent: boolean, tab: boolean }` | 默认均为 `true` |

`init` 时若无配置：写入 `.aicode-ratio.json` 示例；另可提供 `templates/.aicode-ratio.example.json` 供复制（JSON 无注释）。

## 4. 日志格式（jsonl）

**路径**：默认 `<repoRoot>/.aicode-ratio/log.jsonl`，**必须**加入 `.gitignore`（`init` 亦会忽略旧版 `.cursor/` 日志路径以便迁移）。

**每行一个 JSON 对象**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `v` | 是 | 日志 schema 版本，如 `1` |
| `ts` | 是 | ISO8601，建议 **UTC** 存盘 |
| `source` | 是 | `"agent"` \| `"tab"` |
| `event` | 是 | `"afterFileEdit"` \| `"afterTabFileEdit"` |
| `repoRoot` | 是 | 规范化绝对路径（`git rev-parse --show-toplevel`，失败则用 `cwd`） |
| `path` | 是 | **相对 repoRoot** 的 posix 路径（统一 `/`） |
| `tool` | 否 | stdin 能解析则写 |
| `payloadHash` | 否 | stdin 整段 SHA256 前 16 位，**不存原文** |

**禁止写入**：文件全文、prompt、密钥。

**并发**：单行追加 + `\n`；必要时用文件锁或写临时文件再 rename。

**轮转（可选 v1.1）**：超过 `maxLogBytes` 时滚动文件名；`report` 需读取多段文件。

## 5. Hooks 与 `init` 行为

### 5.1 安装产物

- 合并或创建 `.cursor/hooks.json`。
- 将 `append-log.mjs` **复制**到 `.cursor/hooks/aicode-ratio-append-log.mjs`（带版本注释），hooks 只引用**项目相对路径**。
- 更新 `.gitignore`（幂等追加忽略项）。

### 5.2 `hooks.json` 合并策略

- 不存在：写入完整 `version: 1` 与 `afterFileEdit` / `afterTabFileEdit` 数组。
- 已存在：解析 JSON，在对应数组**末尾追加**本包条目；若 `command` 已包含可识别子串（如 `aicode-ratio-append-log` 或旧版 `cursor-attribution-append-log`）则**跳过**，不删除用户其他 hook。

**生成示例**：

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [
      {
        "command": "node .cursor/hooks/aicode-ratio-append-log.mjs agent",
        "timeout": 2
      }
    ],
    "afterTabFileEdit": [
      {
        "command": "node .cursor/hooks/aicode-ratio-append-log.mjs tab",
        "timeout": 2
      }
    ]
  }
}
```

- `argv[2]` 传 `agent` / `tab`，与 `source` 一致。
- **`failClosed` 默认 false**，避免 hook 异常阻断保存。

### 5.3 `append-log.mjs` 处理步骤

1. 读取 stdin UTF-8，`JSON.parse`；失败则 exit 0（可选写入 `hook-errors.log` 一行，默认位于 `.aicode-ratio/`）。
2. 从 stdin 按**多候选字段**解析路径（兼容 Cursor 版本差异；文档维护「已验证版本」列表）。
3. `git rev-parse --show-toplevel` → `repoRoot`。
4. 路径转相对仓库根并 posix 化；命中 `ignoreLogPathPrefixes` 则丢弃。
5. 组装一行 JSON，追加到 `logPath`。
6. stdout：遵循 Cursor 对该 hook 的返回约定（无要求时可不写或 `{}`，以官方文档为准）。

### 5.4 `.gitignore` 追加项

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

## 6. `report` 命令

### 6.1 CLI 示例

```text
aicode-ratio report \
  --repo . \
  --since 2026-04-01 \
  --until 2026-05-01 \
  --branch main \
  --author "user@example.com" \
  --no-merges \
  --format md \
  --out ./reports/2026-04.md \
  --pre-hours 72 \
  --post-hours 2
```

- 时间区间建议文档写死为**半开区间** `[since, until)`，避免 off-by-one。
- `--pre-hours` / `--post-hours` 缺省时读配置文件。

### 6.2 Git 数据

1. 列出 commit（示例格式）：

   - `git log <branch> --since --until --no-merges --format=%H%x09%ct%x09%s --reverse`
   - `%ct`：committer UNIX 秒（与 `gitDateField` 一致）。

2. 对每个 `hash`：

   - 父提交：`hash^`；根提交单独策略。
   - 变更文件：`git diff --name-only parent..hash` → 集合 `F_c`。
   - 可选：`git diff --numstat parent..hash` 做行数加权报表。

### 6.3 与日志交叉（按 commit 回溯）

对每个 commit，令 `t_c` 为选定日期字段的 UNIX 秒，窗口：

`[t_c - pre*3600, t_c + post*3600]`

对每个 `f ∈ F_c`：在预处理的 log 索引中查询是否存在同 `path == f` 且 `ts` 落在窗口内、且 `source` 未被配置关闭。

**性能**：先根据所有 commit 的 `min(t_c)-pre` 与 `max(t_c)+post` 过滤 jsonl 再建索引（`Map<path, sorted[]>` + 二分），避免对每个 commit 全表扫描 log。

### 6.4 建议输出指标（v1）

**每个 commit**：

- `hash`、`t_c`、`subject`
- `filesTotal`、`filesTouchedByAgent`、`filesTouchedByTab`、`filesTouchedByEither`
- `commitTouched`：是否至少一文件触达

**聚合（月/季）**：

- **口径 A（commit）**：`commitsWithTouch / commitsTotal`
- **口径 B（文件并集）**：周期内所有 `F_c` 的文件并集去重为 `filesGitUnique`；其中在「所属 commit 的时间窗」内被 log 命中的为 `filesGitUniqueTouched`，输出 `filesGitUniqueTouched / filesGitUnique`

报表中必须**用文字声明两种口径**，避免读者混淆。

### 6.5 输出格式

- `json`：含 `reportVersion: 1` 与配置快照。
- `csv`：每 commit 一行 + 可选单独 summary。
- `md`：表格 + 口径说明 + 参数快照（pre/post、branch、author）。

## 7. 其他子命令

| 命令 | 作用 |
|------|------|
| `init` | 合并 hooks、复制脚本、gitignore、默认配置、打印下一步 |
| `report` | 交叉统计与导出 |
| `uninstall` | 仅移除本包写入的 hooks 条目；脚本与配置可交互确认 |
| `doctor` | 检查 node/git、hooks 是否存在、建议用户保存文件验证 log 增长 |
| `config print` | 打印生效配置 |

## 8. 测试策略

| 类型 | 内容 |
|------|------|
| 单元 | `merge-hooks-json`：空文件、已有 hook、重复 init、非法 JSON |
| 单元 | `intersect`：人造 log + commit，验证窗口边界 |
| 集成 | 临时目录 `git init`、造 commit + 手写 jsonl，对 `report` 输出做快照 |
| 契约 | 脱敏 stdin fixture（多 Cursor 版本各一份） |

CI：运行测试与 lint。

## 9. 版本与发布

- **semver**：stdin 字段不兼容 → **major**；报表增列 → **minor**；修复 → **patch**。
- `package.json` `files` 白名单：仅发布 `dist`、README、LICENSE 等必要文件。

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Cursor stdin 变更 | 多候选字段；`doctor` 输出客户端版本提示 |
| 多仓库 / submodule | v1 文档声明仅单根 `repoRoot` |
| 换机提交 | 文档声明归因仅限本机 log |
| pnpm / workspace | hooks 使用项目内相对路径脚本 |
| 权限与安全 | 默认 log 在仓库内 `.aicode-ratio/`（或配置路径），不写系统目录 |

## 11. 里程碑

| 阶段 | 交付 |
|------|------|
| M0 | 包骨架、CLI 占位、CI |
| M1 | `append-log` + 最小 `init` + jsonl |
| M2 | `merge-hooks-json` + `uninstall` |
| M3 | `report` + 索引 + md/json |
| M4 | 配置、作者过滤、numstat 加权、日志轮转 |
| M5 | 文档完善、fixture、npm 发布 |

## 12. README 建议目录

1. 产品是什么 / 不是什么（边界）。
2. 一分钟：`pnpm dlx aicode-ratio init`。
3. `doctor` 与验证 log 增长。
4. `report` 月报、季报示例。
5. 统计口径（committer、pre/post、口径 A/B）。
6. 隐私与 `.gitignore`。
7. 故障排查与贡献指南（含 stdin fixture）。

---

*文档版本：与对话中确认的口径一致；实现时以 Cursor 官方 Hooks 输入/输出文档为准做最终对齐。*
