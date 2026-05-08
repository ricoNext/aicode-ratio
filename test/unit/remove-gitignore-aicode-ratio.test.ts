import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { appendGitignoreLines } from '../../src/util/append-gitignore.js';
import { removeAicodeRatioBlocksFromGitignore } from '../../src/util/remove-gitignore-aicode-ratio.js';
import { GITIGNORE_LINES } from '../../src/constants.js';

function mkTmpRepo(): string {
  const dir = join(tmpdir(), `aicode-ratio-ig-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('removeAicodeRatioBlocksFromGitignore', () => {
  it('removes a block appended by appendGitignoreLines', () => {
    const root = mkTmpRepo();
    try {
      writeFileSync(join(root, '.gitignore'), 'node_modules/\n', 'utf8');
      appendGitignoreLines(root, ['.aicode-ratio/log.jsonl']);
      const { changed } = removeAicodeRatioBlocksFromGitignore(root, new Set(GITIGNORE_LINES));
      expect(changed).toBe(true);
      const next = readFileSync(join(root, '.gitignore'), 'utf8');
      expect(next).toBe('node_modules/\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is a no-op when no marker exists', () => {
    const root = mkTmpRepo();
    try {
      writeFileSync(join(root, '.gitignore'), 'dist/\n', 'utf8');
      const { changed } = removeAicodeRatioBlocksFromGitignore(root, new Set(GITIGNORE_LINES));
      expect(changed).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('leaves lines after the tracked block in place', () => {
    const root = mkTmpRepo();
    try {
      const p = join(root, '.gitignore');
      writeFileSync(
        p,
        ['# aicode-ratio', '.aicode-ratio/log.jsonl', 'custom-after-block', 'other/', ''].join('\n'),
        'utf8',
      );
      const known = new Set<string>(['.aicode-ratio/log.jsonl']);
      removeAicodeRatioBlocksFromGitignore(root, known);
      const next = readFileSync(p, 'utf8');
      expect(next).toContain('custom-after-block');
      expect(next).toContain('other/');
      expect(next).not.toContain('# aicode-ratio');
      expect(next).not.toContain('.aicode-ratio/log.jsonl');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
