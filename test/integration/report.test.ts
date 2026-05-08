import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadResolvedConfig } from '../../src/config/load-config.js';
import { listCommits, getCommitFiles, isRootCommit } from '../../src/report/git-queries.js';
import { loadLog } from '../../src/report/load-log.js';
import { intersectCommit } from '../../src/report/intersect.js';
import { aggregate } from '../../src/report/aggregate.js';
import { renderReport } from '../../src/report/render-md.js';

describe('report pipeline (temp git repo)', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cca-rpt-'));
    execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: dir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'T'], { cwd: dir, stdio: 'pipe' });
    writeFileSync(join(dir, 'hello.txt'), 'hello\n', 'utf8');
    execFileSync('git', ['add', 'hello.txt'], { cwd: dir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'add hello'], { cwd: dir, stdio: 'pipe' });

    const ct = Number(execFileSync('git', ['log', '-1', '--format=%ct'], { cwd: dir, encoding: 'utf8' }).trim());
    const iso = new Date(ct * 1000).toISOString();

    mkdirSync(join(dir, '.aicode-ratio'), { recursive: true });
    const logLine = JSON.stringify({
      v: 1,
      ts: iso,
      source: 'agent',
      event: 'afterFileEdit',
      repoRoot: dir,
      path: 'hello.txt',
      gitUser: { name: 'T', email: 't@example.com' },
    });
    writeFileSync(join(dir, '.aicode-ratio', 'log.jsonl'), `${logLine}\n`, 'utf8');

    writeFileSync(
      join(dir, '.aicode-ratio.json'),
      JSON.stringify({
        version: 1,
        logPath: '.aicode-ratio/log.jsonl',
        preCommitHours: 72,
        postCommitHours: 2,
        gitDateField: 'committer',
        ignoreLogPathPrefixes: ['node_modules/', 'dist/', '.git/'],
        ignoreLogGlobs: [],
        enabledEditors: ['cursor'],
        teamMode: false,
        sources: { agent: true, tab: true },
      }),
      'utf8',
    );

  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('produces markdown with ratio A = 1 for a single touched commit', async () => {
    const config = loadResolvedConfig(dir);
    const since = '2000-01-01';
    const until = '2099-01-01';
    const sinceIso = `${since}T00:00:00.000Z`;
    const untilIso = `${until}T00:00:00.000Z`;
    const sinceMs = Date.parse(sinceIso);
    const untilMs = Date.parse(untilIso);

    let rawCommits = await listCommits({
      repo: dir,
      branch: 'HEAD',
      since: sinceIso,
      until: untilIso,
      noMerges: true,
      gitDateField: config.gitDateField,
    });
    rawCommits = rawCommits.filter((c) => c.timestamp * 1000 >= sinceMs && c.timestamp * 1000 < untilMs);
    expect(rawCommits.length).toBeGreaterThanOrEqual(1);

    const minTc = Math.min(...rawCommits.map((c) => c.timestamp));
    const maxTc = Math.max(...rawCommits.map((c) => c.timestamp));
    const preMs = config.preCommitHours * 3600 * 1000;
    const postMs = config.postCommitHours * 3600 * 1000;
    const index = await loadLog({
      logPath: config.logPath,
      repoRoot: dir,
      teamMode: config.teamMode,
      fromMs: minTc * 1000 - preMs,
      toMs: maxTc * 1000 + postMs,
      sources: config.sources,
      ignoreLogPathPrefixes: config.ignoreLogPathPrefixes,
      ignoreLogGlobs: config.ignoreLogGlobs,
    });

    const rows = [];
    for (const c of rawCommits) {
      const root = await isRootCommit(dir, c.hash);
      const files = await getCommitFiles({ repo: dir, hash: c.hash, isRoot: root });
      rows.push({
        hash: c.hash,
        timestamp: c.timestamp,
        subject: c.subject,
        matches: intersectCommit({
          files,
          commitTsMs: c.timestamp * 1000,
          preMs,
          postMs,
          index,
        }),
        allFiles: files,
      });
    }

    const agg = aggregate(rows);
    expect(agg.commitsTotal).toBeGreaterThanOrEqual(1);
    expect(agg.commitsWithTouch).toBeGreaterThanOrEqual(1);
    expect(agg.ratioA).toBeGreaterThan(0);

    expect(agg.byLogGitUser.some((r) => r.userKey === 't@example.com')).toBe(true);

    const md = renderReport(agg, {
      format: 'md',
      params: {
        since: sinceIso,
        until: untilIso,
        branch: 'HEAD',
        preHours: config.preCommitHours,
        postHours: config.postCommitHours,
      },
      configSnapshot: config,
    });
    expect(md).toContain('口径 A');
    expect(md).toContain('口径 B');
    expect(md).toContain('按本地 Git 用户');
  });

  it('CLI report writes JSON to a file', () => {
    const out = join(dir, 'out-report.json');
    const cli = join(dirname(fileURLToPath(import.meta.url)), '../../dist/cli.js');
    execFileSync(
      process.execPath,
      [cli, 'report', '--repo', dir, '--since', '2000-01-01', '--until', '2099-01-01', '--format', 'json', '--out', out],
      { stdio: 'pipe', encoding: 'utf8' },
    );
    const j = JSON.parse(readFileSync(out, 'utf8')) as {
      reportVersion: number;
      summary: { ratioA: number };
      byLogGitUser: Array<{ userKey: string }>;
    };
    expect(j.reportVersion).toBe(2);
    expect(j.byLogGitUser.some((r) => r.userKey === 't@example.com')).toBe(true);
    expect(j.summary.ratioA).toBeGreaterThan(0);
  });

  it('CLI report creates parent directories for --out when missing', () => {
    const nested = join(dir, '.aicode-ratio', 'reports', 'nested', 'out.json');
    const cli = join(dirname(fileURLToPath(import.meta.url)), '../../dist/cli.js');
    execFileSync(
      process.execPath,
      [cli, 'report', '--repo', dir, '--since', '2000-01-01', '--until', '2099-01-01', '--format', 'json', '--out', nested],
      { cwd: dir, stdio: 'pipe', encoding: 'utf8' },
    );
    const j = JSON.parse(readFileSync(nested, 'utf8')) as { reportVersion: number };
    expect(j.reportVersion).toBe(2);
  });
});
