import { describe, it, expect } from 'vitest';
import {
  logGitUserKeyFromRow,
  UNKNOWN_LOG_GIT_USER_KEY,
} from '../../src/report/log-git-user.js';

describe('logGitUserKeyFromRow', () => {
  it('prefers email lowercased', () => {
    expect(
      logGitUserKeyFromRow({
        gitUser: { name: 'N', email: 'User@Example.COM' },
      } as Record<string, unknown>),
    ).toBe('user@example.com');
  });

  it('uses name prefix when no email', () => {
    expect(logGitUserKeyFromRow({ gitUser: { name: 'Alice' } } as Record<string, unknown>)).toBe(
      'name:Alice',
    );
  });

  it('returns unknown when missing', () => {
    expect(logGitUserKeyFromRow({})).toBe(UNKNOWN_LOG_GIT_USER_KEY);
  });
});
