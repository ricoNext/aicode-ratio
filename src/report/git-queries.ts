import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CommitInfo {
  hash: string;
  timestamp: number;
  subject: string;
}

export async function listCommits(opts: {
  repo: string;
  branch: string;
  since: string;
  until: string;
  noMerges: boolean;
  author?: string;
  gitDateField: 'committer' | 'author';
}): Promise<CommitInfo[]> {
  const { repo, branch, since, until, noMerges, author, gitDateField } = opts;
  const format = gitDateField === 'author' ? '%H%x09%at%x09%s' : '%H%x09%ct%x09%s';
  const args = ['-C', repo, 'log', branch, `--since=${since}`, `--until=${until}`, `--format=${format}`, '--reverse'];
  if (noMerges) args.push('--no-merges');
  if (author) args.push(`--author=${author}`);

  const { stdout } = await execFileAsync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const lines = stdout.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const out: CommitInfo[] = [];
  for (const line of lines) {
    const tab1 = line.indexOf('\t');
    const tab2 = line.indexOf('\t', tab1 + 1);
    if (tab1 < 0 || tab2 < 0) continue;
    const hash = line.slice(0, tab1);
    const tsStr = line.slice(tab1 + 1, tab2);
    const subject = line.slice(tab2 + 1);
    const timestamp = Number(tsStr);
    if (!hash || !Number.isFinite(timestamp)) continue;
    out.push({ hash, timestamp, subject });
  }
  return out;
}

export async function isRootCommit(repo: string, hash: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['-C', repo, 'rev-parse', `${hash}^`], { encoding: 'utf8' });
    return false;
  } catch {
    return true;
  }
}

export async function getCommitFiles(opts: { repo: string; hash: string; isRoot: boolean }): Promise<string[]> {
  const { repo, hash, isRoot } = opts;
  const args = isRoot
    ? ['-C', repo, 'show', '--pretty=', '--name-only', hash]
    : ['-C', repo, 'diff', '--name-only', `${hash}^`, hash];

  const { stdout } = await execFileAsync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}
