/** Current hook script basename (without path). */
export const HOOK_SCRIPT_NAME = 'aicode-ratio-append-log.mjs';

/** Substring in `hooks.json` `command` for the current hook script. */
export const HOOK_COMMAND_MARKER = 'aicode-ratio-append-log';

/**
 * Older package hook ids — merge/uninstall still match these so upgrades do not duplicate entries.
 */
export const LEGACY_HOOK_COMMAND_MARKERS = [
  'agent-code-attribution-append-log',
  'cursor-attribution-append-log',
] as const;

export function hookCommandMatchesOurs(command: string | undefined): boolean {
  if (!command) return false;
  if (command.includes(HOOK_COMMAND_MARKER)) return true;
  return LEGACY_HOOK_COMMAND_MARKERS.some((m) => command.includes(m));
}

/** Gitignore: current paths plus legacy agent-code-attribution & Cursor-era paths. */
export const GITIGNORE_LINES = [
  '.aicode-ratio/log.jsonl',
  '.aicode-ratio/log.jsonl.*',
  '.aicode-ratio/hook-errors.log',
  '.agent-code-attribution/log.jsonl',
  '.agent-code-attribution/log.jsonl.*',
  '.agent-code-attribution/hook-errors.log',
  '.cursor/cursor-attribution.log.jsonl',
  '.cursor/cursor-attribution.log.jsonl.*',
  '.cursor/cursor-attribution-hook-errors.log',
] as const;

export const CONFIG_FILENAME = '.aicode-ratio.json';

/** Older config filenames still read by `loadResolvedConfig` (init skips writing default if any exist). */
export const LEGACY_CONFIG_FILENAMES = ['.agent-code-attribution.json', '.cursor-attribution.json'] as const;
