import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Remove `# aicode-ratio` blocks and following lines that match `knownLines`
 * (same lines `init` may append via {@link appendGitignoreLines}).
 */
export function removeAicodeRatioBlocksFromGitignore(
  repoRoot: string,
  knownLines: ReadonlySet<string>,
): { changed: boolean } {
  const p = join(repoRoot, '.gitignore');
  if (!existsSync(p)) return { changed: false };
  const raw = readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === '# aicode-ratio') {
      i++;
      while (i < lines.length && knownLines.has(lines[i].trim())) i++;
      continue;
    }
    out.push(lines[i]);
    i++;
  }
  const deduped: string[] = [];
  for (const line of out) {
    if (line === '' && deduped.length > 0 && deduped[deduped.length - 1] === '') continue;
    deduped.push(line);
  }
  let next = deduped.join('\n');
  next = next.replace(/\n{3,}/g, '\n\n');
  if (next === raw) return { changed: false };
  const withNl = next.length === 0 ? '' : next.endsWith('\n') ? next : `${next}\n`;
  writeFileSync(p, withNl, 'utf8');
  return { changed: true };
}
