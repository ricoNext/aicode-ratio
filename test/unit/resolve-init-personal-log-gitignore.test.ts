import { describe, it, expect } from 'vitest';
import {
  parseInitPersonalLogGitignoreFromCommander,
  resolveInitPersonalLogGitignore,
} from '../../src/commands/resolve-init-personal-log-gitignore.js';

describe('parseInitPersonalLogGitignoreFromCommander', () => {
  it('returns null explicit when no flags', () => {
    expect(parseInitPersonalLogGitignoreFromCommander({})).toEqual({ ok: true, explicit: null });
  });

  it('--gitignore-logs forces true', () => {
    expect(parseInitPersonalLogGitignoreFromCommander({ gitignoreLogs: true })).toEqual({
      ok: true,
      explicit: true,
    });
  });

  it('--no-gitignore-logs forces false', () => {
    expect(parseInitPersonalLogGitignoreFromCommander({ noGitignoreLogs: true })).toEqual({
      ok: true,
      explicit: false,
    });
  });

  it('rejects both flags', () => {
    const r = parseInitPersonalLogGitignoreFromCommander({
      gitignoreLogs: true,
      noGitignoreLogs: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/together/i);
  });
});

describe('resolveInitPersonalLogGitignore', () => {
  it('non-TTY defaults to true when explicit unset', async () => {
    await expect(
      resolveInitPersonalLogGitignore(null, { isTTY: false, prompt: async () => false }),
    ).resolves.toBe(true);
  });

  it('TTY calls prompt when explicit unset', async () => {
    await expect(
      resolveInitPersonalLogGitignore(null, { isTTY: true, prompt: async () => false }),
    ).resolves.toBe(false);
  });
});
