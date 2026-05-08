import type { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadResolvedConfig } from '../config/load-config.js';
import { listCommits, getCommitFiles, isRootCommit } from '../report/git-queries.js';
import { loadLog } from '../report/load-log.js';
import { intersectCommit } from '../report/intersect.js';
import { aggregate } from '../report/aggregate.js';
import { renderReport } from '../report/render-md.js';

/** Date-only `YYYY-MM-DD` → UTC midnight; otherwise parsed by `Date.parse`. */
function toUtcIsoBoundary(s: string): string {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${t}T00:00:00.000Z`;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) throw new Error(`Invalid date: ${s}`);
  return new Date(ms).toISOString();
}

function parseHours(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid hours: ${v}`);
  return n;
}

export function registerReport(program: Command): void {
  program
    .command('report')
    .description('Cross-reference Cursor log with Git commits and generate attribution report')
    .requiredOption('--since <date>', 'Start date (inclusive), e.g. 2026-04-01')
    .requiredOption('--until <date>', 'End date (exclusive), e.g. 2026-05-01')
    .option('--repo <path>', 'Repository root', '.')
    .option('--branch <branch>', 'Git branch', 'HEAD')
    .option('--author <email>', 'Filter commits by author email')
    .option('--include-merges', 'Include merge commits in the report', false)
    .option('--format <fmt>', 'Output format: json | csv | md', 'md')
    .option('--out <path>', 'Output file path (default: stdout)')
    .option('--pre-hours <n>', 'Hours before commit to look back in log')
    .option('--post-hours <n>', 'Hours after commit to look forward in log')
    .action(async (options: {
      repo: string;
      since: string;
      until: string;
      branch: string;
      author?: string;
      includeMerges?: boolean;
      format: string;
      out?: string;
      preHours?: string;
      postHours?: string;
    }) => {
      try {
        await runReport(options);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(msg);
        process.exitCode = 1;
      }
    });
}

async function runReport(options: {
  repo: string;
  since: string;
  until: string;
  branch: string;
  author?: string;
  includeMerges?: boolean;
  format: string;
  out?: string;
  preHours?: string;
  postHours?: string;
}): Promise<void> {
      const repoRoot = resolve(options.repo);
      const config = loadResolvedConfig(repoRoot);
      const preHours = parseHours(options.preHours, config.preCommitHours);
      const postHours = parseHours(options.postHours, config.postCommitHours);
      const preMs = preHours * 3600 * 1000;
      const postMs = postHours * 3600 * 1000;

      const sinceIso = toUtcIsoBoundary(options.since);
      const untilIso = toUtcIsoBoundary(options.until);
      const sinceMs = Date.parse(sinceIso);
      const untilMs = Date.parse(untilIso);
      if (!(untilMs > sinceMs)) throw new Error('--until must be after --since (half-open interval [since, until))');

      const noMerges = !options.includeMerges;

      let rawCommits = await listCommits({
        repo: repoRoot,
        branch: options.branch,
        since: sinceIso,
        until: untilIso,
        noMerges,
        author: options.author,
        gitDateField: config.gitDateField,
      });

      rawCommits = rawCommits.filter((c) => {
        const tMs = c.timestamp * 1000;
        return tMs >= sinceMs && tMs < untilMs;
      });

      if (rawCommits.length === 0) {
        const empty = aggregate([]);
        const fmt = options.format === 'json' || options.format === 'csv' || options.format === 'md' ? options.format : 'md';
        const text = renderReport(empty, {
          format: fmt,
          params: {
            since: sinceIso,
            until: untilIso,
            branch: options.branch,
            author: options.author,
            preHours,
            postHours,
          },
          configSnapshot: config,
        });
        if (options.out) writeFileSync(options.out, text, 'utf8');
        else process.stdout.write(text);
        return;
      }

      const minTc = Math.min(...rawCommits.map((c) => c.timestamp));
      const maxTc = Math.max(...rawCommits.map((c) => c.timestamp));
      const fromMs = minTc * 1000 - preMs;
      const toMs = maxTc * 1000 + postMs;

      const index = await loadLog({
        logPath: config.logPath,
        repoRoot,
        fromMs,
        toMs,
        sources: config.sources,
        ignoreLogPathPrefixes: config.ignoreLogPathPrefixes,
        ignoreLogGlobs: config.ignoreLogGlobs,
      });

      const rows: Array<{
        hash: string;
        timestamp: number;
        subject: string;
        matches: ReturnType<typeof intersectCommit>;
        allFiles: string[];
      }> = [];

      for (const c of rawCommits) {
        const root = await isRootCommit(repoRoot, c.hash);
        const files = await getCommitFiles({ repo: repoRoot, hash: c.hash, isRoot: root });
        const matches = intersectCommit({
          files,
          commitTsMs: c.timestamp * 1000,
          preMs,
          postMs,
          index,
        });
        rows.push({
          hash: c.hash,
          timestamp: c.timestamp,
          subject: c.subject,
          matches,
          allFiles: files,
        });
      }

      const agg = aggregate(rows);
      const fmt = options.format === 'json' || options.format === 'csv' || options.format === 'md' ? options.format : 'md';
      const text = renderReport(agg, {
        format: fmt,
        params: {
          since: sinceIso,
          until: untilIso,
          branch: options.branch,
          author: options.author,
          preHours,
          postHours,
        },
        configSnapshot: config,
      });

      if (options.out) writeFileSync(options.out, text, 'utf8');
      else process.stdout.write(text);
}
