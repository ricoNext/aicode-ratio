import { mkdirSync, readFileSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** First line of generated slash-command markdown; uninstall removes file only if this is present. */
export const AICODE_RATIO_REPORT_CMD_MARKER = '<!-- aicode-ratio-managed-command -->';

export const AICODE_RATIO_REPORT_CMD_FILENAME = 'aicode-ratio-report.md';

/** Default Markdown report output directory (under repo root). */
export const AICODE_RATIO_REPORTS_DIR_REL = '.aicode-ratio/reports';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Half-open UTC month `[since, until)` for `report --since/--until`, plus a `YYYY-MM` stem for an output file name. */
export function defaultReportMonthUtc(): { since: string; until: string; stem: string } {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const since = `${y}-${pad2(m + 1)}-01`;
  const ny = m === 11 ? y + 1 : y;
  const nm = m === 11 ? 0 : m + 1;
  const until = `${ny}-${pad2(nm + 1)}-01`;
  const stem = `${y}-${pad2(m + 1)}`;
  return { since, until, stem };
}

/**
 * Markdown for the editor slash command `aicode-ratio-report`.
 * Does **not** embed a default `--since`/`--until`; the agent must obtain dates from the user or their message before running `report`.
 */
export function buildAicodeRatioReportCommandMarkdown(): string {
  return [
    AICODE_RATIO_REPORT_CMD_MARKER,
    '---',
    'description: 生成 aicode-ratio 归因报表（须先与用户确认统计起止日期，无预填时间段）',
    '---',
    '',
    '# aicode-ratio 归因报表',
    '',
    '## 硬性规则（必须先满足再跑终端）',
    '',
    '- **禁止**在未得到明确的 `--since`、`--until`（`YYYY-MM-DD`，UTC 日界）之前执行 `report`；本说明**不提供**默认统计月份，也不得自行编造日期。',
    '- 仅当「已从用户消息解析出起止」或「用户已在对话里回答了你问的两项」之后，才把占位符换成具体日期并执行下方命令。',
    '- **若始终无法识别或无法与用户确认可用的统计时间范围**（含用户拒绝确认、答复矛盾、多轮追问仍无有效日期）：**必须终止**，**不得**执行 `report`、**不得**在 `.aicode-ratio/reports/`（或任意路径）下**新建报表文件**、**不得**凭猜测输出「估算占比」类结论 — 只向用户说明：**没有明确的起止日期就不能生成报表**，请对方给出可执行的 `YYYY-MM-DD` 区间后再继续。',
    '',
    '## 如何取得起止时间',
    '',
    '1. **先读当轮用户消息**：若已给出可映射到日历的区间（例如「2026 年 4 月」「4/1 到 4/30」「本月 / 上月」等），把它**换算**为 `report` 所需的 **`--since`（含）** 与 **`--until`（不含）** 的 `YYYY-MM-DD`（半开区间 `[since, until)`，`until` 当天不计入；统计整月 UTC 时常用 `since=当月1日`、`until=下月1日`）。',
    '2. **若消息里没有可执行的时间段**（或只有「生成报表」等模糊说法）：**必须用交互方式向用户询问**，且**先问再跑命令**：',
    '   - 「请提供统计的**起始日期** `--since`：哪一天起算（**含**该日）？请用 `YYYY-MM-DD`，按 UTC 日界。」',
    '   - 「请提供统计的**结束边界** `--until`：哪一天起**不算**在区间内（**不含**该日）？请用 `YYYY-MM-DD`。若要包含到某日整天，通常应把 `until` 设为**次日**的 `YYYY-MM-DD`。」',
    '3. 在得到 `since` / `until` 后，用**一两句话向用户复述**即将使用的两个日期及「`until` 不含当日」的含义；若用户纠正，以用户最新答复为准。',
    '4. **若经解析与（必要时）多轮询问后，仍得不到双方认可的 `since` / `until`**：按上条「硬性规则」**直接结束**，不跑命令、不写报告文件。',
    '',
    '## 时间语义备忘',
    '',
    '- `--since` / `--until` 为半开区间：`until` **不包含**。',
    '- 使用 `YYYY-MM-DD` 时按 **UTC** 午夜边界理解。',
    '- `--out` 建议：`' + AICODE_RATIO_REPORTS_DIR_REL + '/aicode-ratio-<与区间一致的 YYYY-MM 或其它 stem>.md`（先 `mkdir -p`）。',
    '',
    '## 一键命令（占位符须替换后再执行）',
    '',
    '```bash',
    'mkdir -p ' +
      AICODE_RATIO_REPORTS_DIR_REL +
      ' && npx aicode-ratio@latest report \\\n' +
      '  --repo . \\\n' +
      '  --since <SINCE_YYYY-MM-DD> \\\n' +
      '  --until <UNTIL_YYYY-MM-DD> \\\n' +
      '  --branch "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)" \\\n' +
      '  --format md \\\n' +
      '  --out "' +
      AICODE_RATIO_REPORTS_DIR_REL +
      '/aicode-ratio-<OUTPUT_STEM>.md"',
    '```',
    '',
    '将 `<SINCE_YYYY-MM-DD>`、`<UNTIL_YYYY-MM-DD>`、`<OUTPUT_STEM>` 替换为与用户确认后的值（`OUTPUT_STEM` 常用统计区间对应的 `YYYY-MM`）。',
    '',
    '**CLI 写法**：已全局安装时可将 `npx aicode-ratio@latest` 换成 `acr`；本仓库若已加 devDependency，也可用 `pnpm exec aicode-ratio` / `pnpm dlx aicode-ratio`。',
    '',
    '## 执行与说明',
    '',
    '1. 确认当前工作目录是 **Git 仓库根**（与 `.git` 同级）。',
    '2. 在**集成终端**执行已替换占位符后的命令。',
    '3. 若命令报错，根据终端输出排查（常见：未装 Node、不在仓库根、`npx` 网络问题）。',
    '4. 命令成功后，用 **中文** 向用户说明：**口径 A**（按 commit 占比）、**口径 B**（按不重复变更文件占比），并给出报告文件的**绝对路径或相对仓库根的路径**。',
    '',
    '## `report` 子命令参数（备忘）',
    '',
    '- **必填**：`--since`、`--until`（半开区间 `[since, until)`，`until` 当天不计入）。',
    '- **常用可选**（不传则用默认）：`--repo` 默认 `.`；`--branch` 默认 `HEAD`；`--format` 默认 `md`（亦支持 `json` / `csv`）；不传 `--out` 则打印到 stdout。',
    '- **其它可选**：`--author`（按作者邮箱过滤 commit）、`--include-merges`（含 merge）、`--pre-hours` / `--post-hours`（覆盖配置里与 commit 对齐的时间窗，默认一般来自 `.aicode-ratio.json` 的 72 / 2 小时）。',
    '- **不从 CLI 覆盖**：`teamMode`、`logPath`、`gitDateField`、`sources`、忽略前缀等 — 均读 **`.aicode-ratio.json`**（或环境变量指定的配置）。',
    '',
    '## 口径提示（写进回复即可）',
    '',
    '- **口径 A**：`commitsWithTouch / commitsTotal` — 至少有一个变更文件在「该 commit 时间 ± 配置时间窗」内被 Hook 日志命中，则该 commit 计为 touched。',
    '- **口径 B**：`filesGitUniqueTouched / filesGitUnique` — 统计窗内所有 commit 变更路径去重后，有多大比例曾在某次相关 commit 的时间窗内被日志命中。',
    '- 若有 **`byLogGitUser`**：按日志里的 `gitUser`（Hook 时本机 `git config`）汇总，分母与口径 A 相同。',
    '',
  ].join('\n');
}

/**
 * Write `.cursor/commands` / `.claude/commands` / … `aicode-ratio-report.md` (idempotent overwrite).
 */
export function installAicodeRatioReportCommand(commandsDirAbs: string): void {
  const body = buildAicodeRatioReportCommandMarkdown();
  mkdirSync(commandsDirAbs, { recursive: true });
  const p = join(commandsDirAbs, AICODE_RATIO_REPORT_CMD_FILENAME);
  writeFileSync(p, `${body}\n`, 'utf8');
}

/** Remove managed report command file if present and still marked. */
export function tryRemoveAicodeRatioReportCommand(commandsDirAbs: string): string | null {
  const p = join(commandsDirAbs, AICODE_RATIO_REPORT_CMD_FILENAME);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, 'utf8');
    if (!raw.includes(AICODE_RATIO_REPORT_CMD_MARKER)) return null;
    unlinkSync(p);
    return p;
  } catch {
    return null;
  }
}
