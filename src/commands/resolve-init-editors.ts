import { resolveEditorIdsForInit } from '../editors/registry.js';

/** Merge `--editors` (wins) or Commander positional `[editors...]` into a comma list. */
export function mergeExplicitEditorsFromCli(
  editorsOpt: string | undefined,
  positionalEditors: string[],
): string | undefined {
  const trimmedOpt = editorsOpt?.trim();
  if (trimmedOpt) return trimmedOpt;
  const cleaned = positionalEditors.map((s) => s.trim()).filter((s) => s.length > 0);
  if (cleaned.length === 0) return undefined;
  return cleaned.join(',');
}

/**
 * Parse editor ids from Commander `init` args only (no readline / third-party prompts).
 * Returns `null` if the user must be told to pass `[editors...]`, `--editors`, or `-y`.
 */
export function parseInitEditorIdsFromCommander(options: {
  editors?: string;
  yes?: boolean;
  positionalEditors: string[];
}): string[] | null {
  const merged = mergeExplicitEditorsFromCli(options.editors, options.positionalEditors);
  if (merged) return resolveEditorIdsForInit(merged);
  if (options.yes) return resolveEditorIdsForInit('cursor');
  return null;
}
