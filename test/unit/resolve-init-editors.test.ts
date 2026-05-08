import { describe, it, expect } from 'vitest';
import {
  mergeExplicitEditorsFromCli,
  parseInitEditorIdsFromCommander,
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
  it('uses explicit --editors', () => {
    expect(
      parseInitEditorIdsFromCommander({
        editors: 'cursor',
        positionalEditors: [],
      }),
    ).toEqual(['cursor']);
  });

  it('uses positional editors', () => {
    expect(
      parseInitEditorIdsFromCommander({
        positionalEditors: ['cursor'],
      }),
    ).toEqual(['cursor']);
  });

  it('uses --yes as Cursor-only shorthand', () => {
    expect(
      parseInitEditorIdsFromCommander({
        positionalEditors: [],
        yes: true,
      }),
    ).toEqual(['cursor']);
  });

  it('returns null when nothing selects editors', () => {
    expect(
      parseInitEditorIdsFromCommander({
        positionalEditors: [],
      }),
    ).toBeNull();
  });

  it('--editors wins over --yes positional ambiguity', () => {
    expect(
      parseInitEditorIdsFromCommander({
        editors: 'cursor',
        yes: true,
        positionalEditors: [],
      }),
    ).toEqual(['cursor']);
  });
});
