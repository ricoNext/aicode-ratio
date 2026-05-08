import type { FileMatch } from './intersect.js';

export interface CommitResult {
  hash: string;
  timestamp: number;
  subject: string;
  filesTotal: number;
  filesTouchedByAgent: number;
  filesTouchedByTab: number;
  filesTouchedByEither: number;
  commitTouched: boolean;
  /**
   * Local Git identities recorded on log lines (hook-time `git config user.*`) for hits in this commit's window.
   * Empty when `commitTouched` is false.
   */
  logGitUserKeys: string[];
}

export interface LogGitUserSummaryRow {
  userKey: string;
  commitsWithTouch: number;
  commitsTotal: number;
  ratioA: number;
}

export interface AggregateResult {
  /** Ratio A: commitsWithTouch / commitsTotal */
  ratioA: number;
  commitsWithTouch: number;
  commitsTotal: number;
  /** Ratio B: filesGitUniqueTouched / filesGitUnique */
  ratioB: number;
  filesGitUnique: number;
  filesGitUniqueTouched: number;
  commits: CommitResult[];
  /** Per local log identity: how many commits had at least one matching log line from that user (same denominator as global ratio A). */
  byLogGitUser: LogGitUserSummaryRow[];
}

function collectLogGitUserKeysForCommit(matches: FileMatch[]): string[] {
  const keys = new Set<string>();
  for (const m of matches) {
    if (!m.byAgent && !m.byTab) continue;
    for (const k of m.agentLogGitUserKeys) keys.add(k);
    for (const k of m.tabLogGitUserKeys) keys.add(k);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function aggregate(
  commits: Array<{
    hash: string;
    timestamp: number;
    subject: string;
    matches: FileMatch[];
    allFiles: string[];
  }>,
): AggregateResult {
  const commitRows: CommitResult[] = [];
  let commitsWithTouch = 0;

  const touchedPaths = new Set<string>();

  for (const c of commits) {
    const { matches } = c;
    let filesTouchedByAgent = 0;
    let filesTouchedByTab = 0;
    let filesTouchedByEither = 0;
    for (const m of matches) {
      if (m.byAgent) filesTouchedByAgent += 1;
      if (m.byTab) filesTouchedByTab += 1;
      if (m.byAgent || m.byTab) {
        filesTouchedByEither += 1;
        touchedPaths.add(m.path);
      }
    }
    const commitTouched = filesTouchedByEither > 0;
    if (commitTouched) commitsWithTouch += 1;

    const logGitUserKeys = commitTouched ? collectLogGitUserKeysForCommit(matches) : [];

    commitRows.push({
      hash: c.hash,
      timestamp: c.timestamp,
      subject: c.subject,
      filesTotal: c.allFiles.length,
      filesTouchedByAgent,
      filesTouchedByTab,
      filesTouchedByEither,
      commitTouched,
      logGitUserKeys,
    });
  }

  const commitsTotal = commits.length;
  const ratioA = commitsTotal === 0 ? 0 : commitsWithTouch / commitsTotal;

  const filesGitUnique = new Set<string>();
  for (const c of commits) {
    for (const f of c.allFiles) filesGitUnique.add(f);
  }
  let filesGitUniqueTouched = 0;
  for (const f of filesGitUnique) {
    if (touchedPaths.has(f)) filesGitUniqueTouched += 1;
  }
  const u = filesGitUnique.size;
  const ratioB = u === 0 ? 0 : filesGitUniqueTouched / u;

  const touchCountByUser = new Map<string, number>();
  for (const row of commitRows) {
    if (!row.commitTouched) continue;
    for (const ukey of row.logGitUserKeys) {
      touchCountByUser.set(ukey, (touchCountByUser.get(ukey) ?? 0) + 1);
    }
  }

  const byLogGitUser: LogGitUserSummaryRow[] = [...touchCountByUser.entries()]
    .map(([userKey, n]) => ({
      userKey,
      commitsWithTouch: n,
      commitsTotal,
      ratioA: commitsTotal === 0 ? 0 : n / commitsTotal,
    }))
    .sort((a, b) => b.commitsWithTouch - a.commitsWithTouch || a.userKey.localeCompare(b.userKey));

  return {
    ratioA,
    commitsWithTouch,
    commitsTotal,
    ratioB,
    filesGitUnique: u,
    filesGitUniqueTouched,
    commits: commitRows,
    byLogGitUser,
  };
}
