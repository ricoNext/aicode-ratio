import { stdin as input } from 'node:process';
import { checkbox } from '@inquirer/prompts';
import { listEditorAdapters, resolveEditorIdsForInit } from '../editors/registry.js';

/** Join positional `[editors...]` into a comma-separated list (no `--editors` option). */
export function mergePositionalEditors(positionalEditors: string[]): string | undefined {
  const cleaned = positionalEditors.map((s) => s.trim()).filter((s) => s.length > 0);
  if (cleaned.length === 0) return undefined;
  return cleaned.join(',');
}

/** Merge `--editors` (wins) or positional `[editors...]` into a comma list (for tests / legacy callers). */
export function mergeExplicitEditorsFromCli(
  editorsOpt: string | undefined,
  positionalEditors: string[],
): string | undefined {
  const trimmedOpt = editorsOpt?.trim();
  if (trimmedOpt) return trimmedOpt;
  return mergePositionalEditors(positionalEditors);
}

/**
 * Parse editor ids from Commander `init` (options + args only).
 * Precedence: `--editors` → `--<id>` flags → `[editors...]` → `-y` → null (TTY may use Inquirer next).
 */
export function parseInitEditorIdsFromCommander(options: {
  editors?: string;
  yes?: boolean;
  positionalEditors: string[];
  selectedFromFlags: string[];
}): string[] | null {
  const fromListOpt = options.editors?.trim();
  if (fromListOpt) return resolveEditorIdsForInit(fromListOpt);

  const fromFlags = [...new Set(options.selectedFromFlags)].filter(Boolean);
  if (fromFlags.length > 0) return resolveEditorIdsForInit(fromFlags.join(','));

  const fromPositional = mergePositionalEditors(options.positionalEditors);
  if (fromPositional) return resolveEditorIdsForInit(fromPositional);

  if (options.yes) return resolveEditorIdsForInit('cursor');
  return null;
}

/** @inquirer/prompts checkbox — used when Commander left editor selection unspecified (TTY only). */
export async function promptEditorsWithInquirer(): Promise<string[]> {
  const adapters = listEditorAdapters();
  if (adapters.length === 0) throw new Error('No editor adapters are registered.');

  const selection = await checkbox({
    message: 'Which AI editors should aicode-ratio install hooks for?',
    choices: adapters.map((a) => ({
      value: a.id,
      name: `${a.label} (${a.id})`,
      description: `tier: ${a.tier}`,
      checked: false,
    })),
    required: true,
  });
  if (!selection.length) throw new Error('Pick at least one editor.');
  return [...new Set(selection)];
}

export type ResolveInitEditorsDeps = {
  isTTY: boolean;
  prompt: () => Promise<string[]>;
};

const defaultDeps = (): ResolveInitEditorsDeps => ({
  isTTY: Boolean(input.isTTY),
  prompt: promptEditorsWithInquirer,
});

/**
 * Combine Commander-parse result with optional Inquirer prompt when selection is still empty.
 */
export async function resolveInitEditorsAfterCommander(
  cliResolved: string[] | null,
  deps: Partial<ResolveInitEditorsDeps> = {},
): Promise<{ ok: true; ids: string[] } | { ok: false; reason: 'non-interactive-no-selection' }> {
  if (cliResolved !== null) return { ok: true, ids: cliResolved };
  const d = { ...defaultDeps(), ...deps };
  if (!d.isTTY) return { ok: false, reason: 'non-interactive-no-selection' };
  const picked = await d.prompt();
  return { ok: true, ids: resolveEditorIdsForInit([...new Set(picked)].join(',')) };
}
