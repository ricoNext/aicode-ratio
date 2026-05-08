import { stdin as input } from 'node:process';
import { confirm } from '@inquirer/prompts';

export type ParseInitPersonalLogGitignoreResult =
  | { ok: true; explicit: boolean | null }
  | { ok: false; message: string };

/**
 * Parse `--gitignore-logs` / `--no-gitignore-logs` (personal mode only).
 * `explicit === null`: TTY may prompt; non-TTY defaults to appending rules (privacy).
 */
export function parseInitPersonalLogGitignoreFromCommander(options: {
  gitignoreLogs?: boolean;
  noGitignoreLogs?: boolean;
}): ParseInitPersonalLogGitignoreResult {
  const g = options.gitignoreLogs === true;
  const n = options.noGitignoreLogs === true;
  if (g && n) {
    return { ok: false, message: 'Cannot use --gitignore-logs and --no-gitignore-logs together.' };
  }
  if (g) return { ok: true, explicit: true };
  if (n) return { ok: true, explicit: false };
  return { ok: true, explicit: null };
}

export async function promptPersonalLogGitignoreInquirer(): Promise<boolean> {
  return confirm({
    message:
      'Add .aicode-ratio tracker log paths to .gitignore (recommended for privacy on this machine)? Choose No if you want Git to track the log file.',
    default: true,
  });
}

export type ResolveInitPersonalLogGitignoreDeps = {
  isTTY: boolean;
  prompt: () => Promise<boolean>;
};

const defaultDeps = (): ResolveInitPersonalLogGitignoreDeps => ({
  isTTY: Boolean(input.isTTY),
  prompt: promptPersonalLogGitignoreInquirer,
});

/**
 * Personal mode only: whether to append log-related lines to `.gitignore`.
 * `explicit === null`: non-TTY → `true` (append); TTY → `prompt()` (default true).
 */
export async function resolveInitPersonalLogGitignore(
  explicit: boolean | null,
  deps: Partial<ResolveInitPersonalLogGitignoreDeps> = {},
): Promise<boolean> {
  if (explicit !== null) return explicit;
  const d = { ...defaultDeps(), ...deps };
  if (!d.isTTY) return true;
  return d.prompt();
}
