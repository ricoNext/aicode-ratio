/** Log lines without `gitUser` (legacy) resolve to this key in reports. */
export const UNKNOWN_LOG_GIT_USER_KEY = '(unknown log user)';

/**
 * Normalize `gitUser` from a jsonl row for grouping (email preferred, then name).
 */
export function logGitUserKeyFromRow(o: Record<string, unknown>): string {
  const gu = o.gitUser;
  if (gu && typeof gu === 'object' && gu !== null) {
    const g = gu as Record<string, unknown>;
    const email = typeof g.email === 'string' ? g.email.trim() : '';
    const name = typeof g.name === 'string' ? g.name.trim() : '';
    if (email) return email.toLowerCase();
    if (name) return `name:${name}`;
  }
  return UNKNOWN_LOG_GIT_USER_KEY;
}
