import { describe, it, expect } from 'vitest';
import { parseInitTeamModeFromCommander, resolveInitTeamMode } from '../../src/commands/resolve-init-team-mode.js';

describe('parseInitTeamModeFromCommander', () => {
  it('returns null explicit when no flags', () => {
    expect(parseInitTeamModeFromCommander({})).toEqual({ ok: true, explicit: null });
  });

  it('--team forces team mode', () => {
    expect(parseInitTeamModeFromCommander({ team: true })).toEqual({ ok: true, explicit: true });
  });

  it('--no-team forces personal mode', () => {
    expect(parseInitTeamModeFromCommander({ noTeam: true })).toEqual({ ok: true, explicit: false });
  });

  it('rejects both flags', () => {
    const r = parseInitTeamModeFromCommander({ team: true, noTeam: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/together/i);
  });
});

describe('resolveInitTeamMode', () => {
  it('uses explicit true without prompt', async () => {
    await expect(resolveInitTeamMode(true, { prompt: async () => false })).resolves.toBe(true);
  });

  it('uses explicit false without prompt', async () => {
    await expect(resolveInitTeamMode(false, { prompt: async () => true })).resolves.toBe(false);
  });

  it('non-TTY defaults to personal when explicit unset', async () => {
    await expect(resolveInitTeamMode(null, { isTTY: false, prompt: async () => true })).resolves.toBe(false);
  });

  it('TTY calls prompt when explicit unset', async () => {
    await expect(resolveInitTeamMode(null, { isTTY: true, prompt: async () => true })).resolves.toBe(true);
  });
});
