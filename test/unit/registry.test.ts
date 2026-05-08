import { describe, it, expect } from 'vitest';
import {
  parseEditorIdsFromArg,
  resolveEditorIdsForInit,
  registeredEditorIds,
  normalizeLegacyEditorId,
} from '../../src/editors/registry.js';

describe('editor registry', () => {
  it('parses comma-separated ids with trimming', () => {
    expect(parseEditorIdsFromArg('cursor, cursor')).toEqual(['cursor', 'cursor']);
    expect(parseEditorIdsFromArg(' cursor ')).toEqual(['cursor']);
  });

  it('requires at least one id', () => {
    expect(() => resolveEditorIdsForInit(',')).toThrow(/At least one editor id/);
    expect(() => resolveEditorIdsForInit('')).toThrow(/At least one editor id/);
    expect(resolveEditorIdsForInit('cursor')).toEqual(['cursor']);
  });

  it('lists built-in adapters', () => {
    expect(registeredEditorIds()).toEqual(['cursor', 'codebuddy', 'claude-code', 'qoder']);
  });

  it('normalizes legacy codebuddyIDE id when resolving editors', () => {
    expect(normalizeLegacyEditorId('codebuddyIDE')).toBe('codebuddy');
    expect(resolveEditorIdsForInit('cursor,codebuddyIDE')).toEqual(['cursor', 'codebuddy']);
  });
});
