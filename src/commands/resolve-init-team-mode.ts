import { stdin as input } from 'node:process';
import { confirm } from '@inquirer/prompts';

export type ParseInitTeamModeResult =
  | { ok: true; explicit: boolean | null }
  | { ok: false; message: string };

/**
 * Parse `--team` / `--no-team` after Commander.
 * `explicit === null`: TTY may prompt; non-TTY defaults to personal mode (`teamMode: false`).
 */
export function parseInitTeamModeFromCommander(options: {
  team?: boolean;
  noTeam?: boolean;
}): ParseInitTeamModeResult {
  const t = options.team === true;
  const n = options.noTeam === true;
  if (t && n) {
    return { ok: false, message: 'Cannot use --team and --no-team together.' };
  }
  if (t) return { ok: true, explicit: true };
  if (n) return { ok: true, explicit: false };
  return { ok: true, explicit: null };
}

export async function promptTeamModeInquirer(): Promise<boolean> {
  return confirm({
    message:
      'Enable team mode? Each member writes their own log under .aicode-ratio/logs/ (from local git user.*) to reduce Git merge conflicts; report reads all *.jsonl there and shows per-user ratios.',
    default: false,
  });
}

export type ResolveInitTeamModeDeps = {
  isTTY: boolean;
  prompt: () => Promise<boolean>;
};

const defaultDeps = (): ResolveInitTeamModeDeps => ({
  isTTY: Boolean(input.isTTY),
  prompt: promptTeamModeInquirer,
});

/**
 * Resolve `teamMode` for init.
 * When `explicit` is null: non-TTY → `false` (personal); TTY → `prompt()` (default false).
 */
export async function resolveInitTeamMode(
  explicit: boolean | null,
  deps: Partial<ResolveInitTeamModeDeps> = {},
): Promise<boolean> {
  if (explicit !== null) return explicit;
  const d = { ...defaultDeps(), ...deps };
  if (!d.isTTY) return false;
  return d.prompt();
}
