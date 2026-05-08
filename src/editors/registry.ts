import { cursorAdapter } from './cursor-adapter.js';
import type { EditorAdapter } from './types.js';

const adapters: EditorAdapter[] = [cursorAdapter];

const byId: Map<string, EditorAdapter> = new Map(adapters.map((a) => [a.id, a]));

/** Built-in adapters in stable display order */
export function listEditorAdapters(): readonly EditorAdapter[] {
  return adapters;
}

export function getEditorAdapter(id: string): EditorAdapter | undefined {
  return byId.get(id);
}

export function registeredEditorIds(): string[] {
  return adapters.map((a) => a.id);
}

/** Split comma-separated editor ids (`"cursor,foo"`). */
export function parseEditorIdsFromArg(arg: string): string[] {
  return arg
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Parse CLI `--editors` and ensure each id is registered. */
export function resolveEditorIdsForInit(editorsArg: string): string[] {
  const ids = parseEditorIdsFromArg(editorsArg);
  if (ids.length === 0) {
    throw new Error(
      `At least one editor id is required (e.g. cursor). Known: ${registeredEditorIds().join(', ')}`,
    );
  }
  for (const id of ids) {
    if (!getEditorAdapter(id)) {
      throw new Error(`Unknown editor "${id}". Known: ${registeredEditorIds().join(', ')}`);
    }
  }
  return ids;
}
