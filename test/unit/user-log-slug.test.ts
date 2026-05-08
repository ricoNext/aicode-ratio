import { describe, it, expect } from 'vitest';
import { userLogFilenameSlugFromGitUser } from '../../src/util/user-log-slug.js';

describe('userLogFilenameSlugFromGitUser', () => {
  it('prefers email', () => {
    expect(userLogFilenameSlugFromGitUser({ name: 'N', email: 'A@B.CO' })).toBe('A@B.CO');
  });

  it('uses sanitized name when no email', () => {
    expect(userLogFilenameSlugFromGitUser({ name: 'Alice Bob' })).toBe('Alice_Bob');
  });

  it('returns _unknown when empty', () => {
    expect(userLogFilenameSlugFromGitUser(undefined)).toBe('_unknown');
  });
});
