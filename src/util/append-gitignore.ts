import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Append tracker-related lines at the repo root `.gitignore` if missing (idempotent).
 */
export function appendGitignoreLines(repoRoot: string, lines: readonly string[]): void {
  if (lines.length === 0) return;
  const p = join(repoRoot, '.gitignore');
  const existing = existsSync(p) ? readFileSync(p, 'utf8') : '';
  const existingLines = existing.split(/\r?\n/);
  const toAdd: string[] = [];
  for (const line of lines) {
    if (!existingLines.some((l) => l.trim() === line)) toAdd.push(line);
  }
  if (toAdd.length === 0) return;
  const block =
    `${existing.endsWith('\n') || existing.length === 0 ? '' : '\n'}\n# aicode-ratio\n${toAdd.join('\n')}\n`;
  writeFileSync(p, existing + block, 'utf8');
}
