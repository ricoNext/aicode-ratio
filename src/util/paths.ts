import { execSync } from 'node:child_process';
import { resolve, relative, sep, posix } from 'node:path';

/** Returns git toplevel or `null` if `cwd` is not inside a repository. */
export function tryGetGitRepoRoot(cwd: string): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Returns the absolute path of the Git repository root for the given directory,
 * or falls back to resolved `cwd` if not in a git repo.
 */
export function getRepoRoot(cwd: string = process.cwd()): string {
  return tryGetGitRepoRoot(cwd) ?? resolve(cwd);
}

/**
 * Returns the path of `absPath` relative to `root`, using posix separators.
 */
export function toRelativePosix(absPath: string, root: string): string {
  return relative(root, absPath).split(sep).join(posix.sep);
}
