import { describe, it, expect } from 'vitest';
import {
  mergeExplicitEditorsFromCli,
  parseInitEditorIdsFromCommander,
  resolveInitEditorsAfterCommander,
} from '../../src/commands/resolve-init-editors.js';

describe('mergeExplicitEditorsFromCli', () => {
  it('prefers --editors over positional', () => {
    expect(mergeExplicitEditorsFromCli('cursor', ['x'])).toBe('cursor');
  });

  it('maps positional ids to comma-separated', () => {
    expect(mergeExplicitEditorsFromCli(undefined, ['cursor'])).toBe('cursor');
    expect(mergeExplicitEditorsFromCli(undefined, ['cursor', 'foo'])).toBe('cursor,foo');
  });
});

describe('parseInitEditorIdsFromCommander', () => {
  it('uses explicit --editors first', () => {
    expect(
      parseInitEditorIdsFromCommander({
        editors: 'cursor',
        positionalEditors: [],
        selectedFromFlags: [],
      }),
    ).toEqual(['cursor']);
  });

  it('--editors wins over --cursor-style flags', () => {
    expect(
      parseInitEditorIdsFromCommander({
        editors: 'cursor',
        positionalEditors: [],
        selectedFromFlags: ['cursor'],
      }),
    ).toEqual(['cursor']);
  });

  it('uses Commander --<id> flags', () => {
    expect(
      parseInitEditorIdsFromCommander({
        positionalEditors: [],
        selectedFromFlags: ['cursor'],
      }),
    ).toEqual(['cursor']);
  });

  it('uses positional when no --editors and no flags', () => {
    expect(
      parseInitEditorIdsFromCommander({
        positionalEditors: ['cursor'],
        selectedFromFlags: [],
      }),
    ).toEqual(['cursor']);
  });

  it('prefer --<id> flags over positional args', () => {
    expect(
      parseInitEditorIdsFromCommander({
        positionalEditors: ['typo-unknown'],
        selectedFromFlags: ['cursor'],
      }),
    ).toEqual(['cursor']);
  });

  it('uses --yes when nothing else', () => {
    expect(
      parseInitEditorIdsFromCommander({
        positionalEditors: [],
        selectedFromFlags: [],
        yes: true,
      }),
    ).toEqual(['cursor']);
  });

  it('returns null when nothing selects editors', () => {
    expect(
      parseInitEditorIdsFromCommander({
        positionalEditors: [],
        selectedFromFlags: [],
      }),
    ).toBeNull();
  });
});

describe('resolveInitEditorsAfterCommander', () => {
  it('returns CLI result when already resolved', async () => {
    await expect(
      resolveInitEditorsAfterCommander(['cursor'], { prompt: async () => [] }),
    ).resolves.toEqual({ ok: true, ids: ['cursor'] });
  });

  it('non-TTY leaves selection unresolved without prompt', async () => {
    await expect(
      resolveInitEditorsAfterCommander(null, { isTTY: false, prompt: async () => ['cursor'] }),
    ).resolves.toEqual({ ok: false, reason: 'non-interactive-no-selection' });
  });

  it('TTY calls Inquirer surrogate prompt', async () => {
    await expect(
      resolveInitEditorsAfterCommander(null, { isTTY: true, prompt: async () => ['cursor'] }),
    ).resolves.toEqual({ ok: true, ids: ['cursor'] });
  });
});
