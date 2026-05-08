import type { AggregateResult } from './aggregate.js';
import type { Config } from '../config/schema.js';

export interface RenderOptions {
  format: 'md' | 'json' | 'csv';
  params: {
    since: string;
    until: string;
    branch: string;
    author?: string;
    preHours: number;
    postHours: number;
  };
  configSnapshot: Config;
}

function escapeMdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderReport(result: AggregateResult, opts: RenderOptions): string {
  if (opts.format === 'json') return renderJson(result, opts);
  if (opts.format === 'csv') return renderCsv(result, opts);
  return renderMd(result, opts);
}

function renderJson(result: AggregateResult, opts: RenderOptions): string {
  const payload = {
    reportVersion: 1 as const,
    params: opts.params,
    config: opts.configSnapshot,
    summary: {
      ratioA: result.ratioA,
      commitsWithTouch: result.commitsWithTouch,
      commitsTotal: result.commitsTotal,
      ratioB: result.ratioB,
      filesGitUnique: result.filesGitUnique,
      filesGitUniqueTouched: result.filesGitUniqueTouched,
    },
    commits: result.commits,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function renderCsv(result: AggregateResult, opts: RenderOptions): string {
  const header = [
    'hash',
    'timestamp',
    'subject',
    'filesTotal',
    'filesTouchedByAgent',
    'filesTouchedByTab',
    'filesTouchedByEither',
    'commitTouched',
  ].join(',');
  const rows = result.commits.map((c) =>
    [
      c.hash,
      String(c.timestamp),
      csvEscape(c.subject),
      String(c.filesTotal),
      String(c.filesTouchedByAgent),
      String(c.filesTouchedByTab),
      String(c.filesTouchedByEither),
      c.commitTouched ? '1' : '0',
    ].join(','),
  );
  const summary = [
    '# summary',
    `ratioA,${result.ratioA}`,
    `commitsWithTouch,${result.commitsWithTouch}`,
    `commitsTotal,${result.commitsTotal}`,
    `ratioB,${result.ratioB}`,
    `filesGitUnique,${result.filesGitUnique}`,
    `filesGitUniqueTouched,${result.filesGitUniqueTouched}`,
    `# params since,${csvEscape(opts.params.since)}`,
    `# params until,${csvEscape(opts.params.until)}`,
    `# params branch,${csvEscape(opts.params.branch)}`,
    `# params preHours,${opts.params.preHours}`,
    `# params postHours,${opts.params.postHours}`,
  ].join('\n');
  return [header, ...rows, '', summary, ''].join('\n');
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function renderMd(result: AggregateResult, opts: RenderOptions): string {
  const { params } = opts;
  const lines: string[] = [];
  lines.push('# AI Agent 写盘归因报表', '');
  lines.push('## 统计口径', '');
  lines.push(
    '- **口径 A（按 commit）**：在所选时间窗内，`commitsWithTouch / commitsTotal`，表示至少有一个变更文件在对应 commit 时间窗内被 Cursor 日志命中的提交占比。',
  );
  lines.push(
    '- **口径 B（按文件并集）**：时间窗内所有 commit 变更文件的并集去重为 `filesGitUnique`；若某文件在**至少一次**包含它的 commit 的时间窗内被日志命中，则计入 `filesGitUniqueTouched`。比率为 `filesGitUniqueTouched / filesGitUnique`。',
  );
  lines.push('', '## 参数快照', '', '| 项 | 值 |', '|---|---|');
  lines.push(`| since（含） | ${escapeMdCell(params.since)} |`);
  lines.push(`| until（不含） | ${escapeMdCell(params.until)} |`);
  lines.push(`| branch | ${escapeMdCell(params.branch)} |`);
  if (params.author) lines.push(`| author | ${escapeMdCell(params.author)} |`);
  lines.push(`| preHours | ${params.preHours} |`);
  lines.push(`| postHours | ${params.postHours} |`);
  lines.push(`| gitDateField | ${opts.configSnapshot.gitDateField} |`);
  lines.push('', '## 汇总', '', '| 指标 | 值 |', '|---|---|');
  lines.push(`| 口径 A | ${(result.ratioA * 100).toFixed(2)}%（${result.commitsWithTouch}/${result.commitsTotal} commits）|`);
  lines.push(`| 口径 B | ${(result.ratioB * 100).toFixed(2)}%（${result.filesGitUniqueTouched}/${result.filesGitUnique} 文件）|`);

  lines.push('', '## 按 commit', '');
  lines.push(
    '| hash | ts(UTC unix) | subject | files | agent | tab | either | touched |',
    '|---|---|---:|---:|---:|---:|---:|---|',
  );
  for (const c of result.commits) {
    lines.push(
      `| \`${c.hash.slice(0, 7)}\` | ${c.timestamp} | ${escapeMdCell(c.subject)} | ${c.filesTotal} | ${c.filesTouchedByAgent} | ${c.filesTouchedByTab} | ${c.filesTouchedByEither} | ${c.commitTouched ? '是' : '否'} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
