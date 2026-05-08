import { describe, it, expect } from 'vitest';
import {
  hasInRange,
  intersectCommit,
  lowerBoundEventTs,
  hasEventInRange,
} from '../../src/report/intersect.js';
import type { LogEvent, LogIndex } from '../../src/report/load-log.js';

describe('hasInRange', () => {
  it('returns false for empty array', () => {
    expect(hasInRange([], 0, 100)).toBe(false);
  });

  it('returns true when a value is exactly at lo', () => {
    expect(hasInRange([100, 200, 300], 100, 150)).toBe(true);
  });

  it('returns true when a value is exactly at hi', () => {
    expect(hasInRange([100, 200, 300], 150, 200)).toBe(true);
  });

  it('returns false when all values are below lo', () => {
    expect(hasInRange([10, 20, 30], 50, 100)).toBe(false);
  });

  it('returns false when all values are above hi', () => {
    expect(hasInRange([100, 200, 300], 0, 50)).toBe(false);
  });

  it('returns true for a single value in range', () => {
    expect(hasInRange([42], 40, 50)).toBe(true);
  });
});

function ev(tsMs: number, gitUserKey = 'dev@example.com'): LogEvent {
  return { tsMs, gitUserKey };
}

function idx(agent: Record<string, LogEvent[]>, tab: Record<string, LogEvent[]> = {}): LogIndex {
  const agentByPath = new Map(Object.entries(agent));
  const tabByPath = new Map(Object.entries(tab));
  return { agentByPath, tabByPath };
}

describe('lowerBoundEventTs / hasEventInRange', () => {
  it('lowerBound finds first >= target', () => {
    const events = [ev(10), ev(20), ev(20), ev(30)];
    expect(lowerBoundEventTs(events, 0)).toBe(0);
    expect(lowerBoundEventTs(events, 20)).toBe(1);
    expect(lowerBoundEventTs(events, 100)).toBe(4);
  });

  it('hasEventInRange respects closed interval', () => {
    const events = [ev(100)];
    expect(hasEventInRange(events, 100, 100)).toBe(true);
    expect(hasEventInRange(events, 99, 100)).toBe(true);
    expect(hasEventInRange(events, 101, 200)).toBe(false);
  });
});

describe('intersectCommit', () => {
  it('marks agent touch inside window and returns user keys', () => {
    const commitTsMs = 1_000_000;
    const preMs = 10_000;
    const postMs = 10_000;
    const index = idx({ 'src/a.ts': [ev(commitTsMs - 5000, 'a@x.com')] });
    const matches = intersectCommit({
      files: ['src/a.ts', 'src/b.ts'],
      commitTsMs,
      preMs,
      postMs,
      index,
    });
    expect(matches).toEqual([
      {
        path: 'src/a.ts',
        byAgent: true,
        byTab: false,
        agentLogGitUserKeys: ['a@x.com'],
        tabLogGitUserKeys: [],
      },
      {
        path: 'src/b.ts',
        byAgent: false,
        byTab: false,
        agentLogGitUserKeys: [],
        tabLogGitUserKeys: [],
      },
    ]);
  });

  it('excludes touches outside window', () => {
    const commitTsMs = 1_000_000;
    const index = idx({ 'src/a.ts': [ev(commitTsMs - 20_000, 'u@x.com')] });
    const matches = intersectCommit({
      files: ['src/a.ts'],
      commitTsMs,
      preMs: 5000,
      postMs: 5000,
      index,
    });
    expect(matches[0].byAgent).toBe(false);
    expect(matches[0].agentLogGitUserKeys).toEqual([]);
  });

  it('detects tab channel separately', () => {
    const commitTsMs = 2_000_000;
    const index = idx({}, { 'README.md': [ev(commitTsMs, 'tab@x.com')] });
    const matches = intersectCommit({
      files: ['README.md'],
      commitTsMs,
      preMs: 1000,
      postMs: 1000,
      index,
    });
    expect(matches[0]).toEqual({
      path: 'README.md',
      byAgent: false,
      byTab: true,
      agentLogGitUserKeys: [],
      tabLogGitUserKeys: ['tab@x.com'],
    });
  });

  it('dedupes multiple users in same window', () => {
    const commitTsMs = 5_000_000;
    const index = idx({
      'f.ts': [ev(commitTsMs, 'a@x.com'), ev(commitTsMs, 'b@x.com'), ev(commitTsMs, 'a@x.com')],
    });
    const matches = intersectCommit({
      files: ['f.ts'],
      commitTsMs,
      preMs: 1,
      postMs: 1,
      index,
    });
    expect(matches[0].agentLogGitUserKeys).toEqual(['a@x.com', 'b@x.com']);
  });
});
