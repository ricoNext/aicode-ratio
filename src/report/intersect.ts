import type { LogEvent, LogIndex } from './load-log.js';

export interface FileMatch {
  path: string;
  byAgent: boolean;
  byTab: boolean;
  /** Distinct local `git config` identities (from log) whose agent events fell in the commit window for this path. */
  agentLogGitUserKeys: string[];
  /** Distinct identities for tab channel. */
  tabLogGitUserKeys: string[];
}

/** First index i with events[i].tsMs >= target, or events.length */
export function lowerBoundEventTs(events: LogEvent[], targetMs: number): number {
  let left = 0;
  let right = events.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    if (events[mid].tsMs < targetMs) left = mid + 1;
    else right = mid;
  }
  return left;
}

export function hasEventInRange(events: LogEvent[], lo: number, hi: number): boolean {
  const i = lowerBoundEventTs(events, lo);
  return i < events.length && events[i].tsMs <= hi;
}

export function logGitUserKeysInRange(events: LogEvent[], lo: number, hi: number): string[] {
  const i = lowerBoundEventTs(events, lo);
  const set = new Set<string>();
  for (let j = i; j < events.length; j++) {
    if (events[j].tsMs > hi) break;
    set.add(events[j].gitUserKey);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
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
    const byAgent = hasEventInRange(agentArr, lo, hi);
    const byTab = hasEventInRange(tabArr, lo, hi);
    out.push({
      path,
      byAgent,
      byTab,
      agentLogGitUserKeys: byAgent ? logGitUserKeysInRange(agentArr, lo, hi) : [],
      tabLogGitUserKeys: byTab ? logGitUserKeysInRange(tabArr, lo, hi) : [],
    });
  }
  return out;
}

/** Binary search: returns true if sorted number array has any element in [lo, hi] */
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
