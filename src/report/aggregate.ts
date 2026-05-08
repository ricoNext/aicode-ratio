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

    commitRows.push({
      hash: c.hash,
      timestamp: c.timestamp,
      subject: c.subject,
      filesTotal: c.allFiles.length,
      filesTouchedByAgent,
      filesTouchedByTab,
      filesTouchedByEither,
      commitTouched,
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

  return {
    ratioA,
    commitsWithTouch,
    commitsTotal,
    ratioB,
    filesGitUnique: u,
    filesGitUniqueTouched,
    commits: commitRows,
  };
}
