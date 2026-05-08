import type { LogIndex } from './load-log.js';

export interface FileMatch {
  path: string;
  byAgent: boolean;
  byTab: boolean;
}

/**
 * For a single commit, determine which changed files were touched by Cursor
 * within the window [commitTs - preMs, commitTs + postMs].
 */
export function intersectCommit(opts: {
  files: string[];
  commitTsMs: number;
  preMs: number;
  postMs: number;
  index: LogIndex;
}): FileMatch[] {
  const { files, commitTsMs, preMs, postMs, index } = opts;
  const lo = commitTsMs - preMs;
  const hi = commitTsMs + postMs;
  const out: FileMatch[] = [];
  for (const path of files) {
    const agentArr = index.agentByPath.get(path) ?? [];
    const tabArr = index.tabByPath.get(path) ?? [];
    const byAgent = hasInRange(agentArr, lo, hi);
    const byTab = hasInRange(tabArr, lo, hi);
    out.push({ path, byAgent, byTab });
  }
  return out;
}

/** Binary search: returns true if sorted array has any element in [lo, hi] */
export function hasInRange(sorted: number[], lo: number, hi: number): boolean {
  if (sorted.length === 0) return false;
  let left = 0;
  let right = sorted.length - 1;
  while (left <= right) {
    const mid = (left + right) >>> 1;
    if (sorted[mid] < lo) {
      left = mid + 1;
    } else if (sorted[mid] > hi) {
      right = mid - 1;
    } else {
      return true;
    }
  }
  return false;
}
