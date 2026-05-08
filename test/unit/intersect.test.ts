import { describe, it, expect } from 'vitest';
import { hasInRange, intersectCommit } from '../../src/report/intersect.js';
import type { LogIndex } from '../../src/report/load-log.js';

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

function idx(agent: Record<string, number[]>, tab: Record<string, number[]> = {}): LogIndex {
  const agentByPath = new Map(Object.entries(agent));
  const tabByPath = new Map(Object.entries(tab));
  return { agentByPath, tabByPath };
}

describe('intersectCommit', () => {
  it('marks agent touch inside window', () => {
    const commitTsMs = 1_000_000;
    const preMs = 10_000;
    const postMs = 10_000;
    const index = idx({ 'src/a.ts': [commitTsMs - 5000] });
    const matches = intersectCommit({
      files: ['src/a.ts', 'src/b.ts'],
      commitTsMs,
      preMs,
      postMs,
      index,
    });
    expect(matches).toEqual([
      { path: 'src/a.ts', byAgent: true, byTab: false },
      { path: 'src/b.ts', byAgent: false, byTab: false },
    ]);
  });

  it('excludes touches outside window', () => {
    const commitTsMs = 1_000_000;
    const index = idx({ 'src/a.ts': [commitTsMs - 20_000] });
    const matches = intersectCommit({
      files: ['src/a.ts'],
      commitTsMs,
      preMs: 5000,
      postMs: 5000,
      index,
    });
    expect(matches[0].byAgent).toBe(false);
  });

  it('detects tab channel separately', () => {
    const commitTsMs = 2_000_000;
    const index = idx({}, { 'README.md': [commitTsMs] });
    const matches = intersectCommit({
      files: ['README.md'],
      commitTsMs,
      preMs: 1000,
      postMs: 1000,
      index,
    });
    expect(matches[0]).toEqual({ path: 'README.md', byAgent: false, byTab: true });
  });
});
