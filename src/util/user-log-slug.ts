/**
 * Stable filename segment for team-mode per-user log files (under `.aicode-ratio/logs/`).
 * Matches hook script logic in `append-log.mjs`.
 */
export function userLogFilenameSlugFromGitUser(gu: { name?: string; email?: string } | undefined): string {
  const email = typeof gu?.email === 'string' ? gu.email.trim() : '';
  const name = typeof gu?.name === 'string' ? gu.name.trim() : '';
  /** Prefer email for stable uniqueness; otherwise use `user.name` as the base filename (sanitized below). */
  const raw = email || name || '';
  if (!raw) return '_unknown';
  const slug = raw
    .replace(/[^a-zA-Z0-9._@-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const safe = slug.length ? slug : '_unknown';
  return safe.length > 120 ? safe.slice(0, 120) : safe;
}

/** Directory (relative to repo root) for team-mode logs. */
export const TEAM_LOG_DIR_REL = '.aicode-ratio/logs';
