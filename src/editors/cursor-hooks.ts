/**
 * Cursor `hooks.json` merge / strip logic (shared between init and uninstall).
 */
import { HOOK_SCRIPT_NAME, hookCommandMatchesOurs } from '../constants.js';

export interface HookEntry {
  command: string;
  timeout?: number;
}

export interface HooksJson {
  version?: number;
  hooks?: Record<string, HookEntry[] | undefined>;
}

export interface HooksJsonMerged {
  version: 1;
  hooks: {
    afterFileEdit?: HookEntry[];
    afterTabFileEdit?: HookEntry[];
    [key: string]: HookEntry[] | undefined;
  };
}

/**
 * Parse existing `.cursor/hooks.json` content and append our Cursor hook commands if absent.
 */
export function mergeHooksJson(existing: string): HooksJsonMerged {
  let parsed: HooksJsonMerged;

  try {
    parsed = existing.trim() ? (JSON.parse(existing) as HooksJsonMerged) : buildEmptyMerged();
  } catch {
    throw new Error(
      '.cursor/hooks.json contains invalid JSON — please fix it manually before running init',
    );
  }

  if (!parsed.hooks) parsed.hooks = {};

  for (const [hookName, source] of [
    ['afterFileEdit', 'agent'],
    ['afterTabFileEdit', 'tab'],
  ] as const) {
    const arr: HookEntry[] = parsed.hooks[hookName] ?? [];
    const alreadyPresent = arr.some((e) => hookCommandMatchesOurs(e.command));
    if (!alreadyPresent) {
      arr.push({
        command: `node .cursor/hooks/${HOOK_SCRIPT_NAME} ${source}`,
        timeout: 2,
      });
    }
    parsed.hooks[hookName] = arr;
  }

  return parsed;
}

/** Remove hook entries matching this package's markers from Cursor `hooks.json` content. */
export function stripCursorHooksFromHooksJsonRaw(raw: string): string {
  let parsed: HooksJson;
  try {
    parsed = JSON.parse(raw) as HooksJson;
  } catch {
    throw new Error('.cursor/hooks.json is not valid JSON — fix or remove manually');
  }
  if (!parsed.hooks) parsed.hooks = {};
  for (const name of ['afterFileEdit', 'afterTabFileEdit'] as const) {
    const arr = parsed.hooks[name];
    if (!Array.isArray(arr)) continue;
    parsed.hooks[name] = arr.filter((e) => !hookCommandMatchesOurs(e.command));
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function buildEmptyMerged(): HooksJsonMerged {
  return { version: 1, hooks: {} };
}
