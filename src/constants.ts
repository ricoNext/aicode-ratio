/** Current hook script basename (without path). */
export const HOOK_SCRIPT_NAME = 'aicode-ratio-append-log.mjs';

/** Substring in hook `command` for the append-log script (Cursor hooks.json path; CodeBuddy settings.json uses same basename). */
export const HOOK_COMMAND_MARKER = 'aicode-ratio-append-log';

/**
 * Older package hook ids — merge/uninstall still match these so upgrades do not duplicate entries.
 */
export const LEGACY_HOOK_COMMAND_MARKERS = [
  'agent-code-attribution-append-log',
  'cursor-attribution-append-log',
] as const;

/**
 * append-log `argv[2]` for Tencent CodeBuddy (IDE + CLI share project `.codebuddy/settings.json`,
 * PostToolUse + Write|Edit per hooks docs).
 */
export const CODEBUDDY_HOOK_ARG = 'codebuddy';

/**
 * Reserved for future CodeBuddy Tab hook argv — **not wired** to any matcher yet.
 */
export const CODEBUDDY_HOOK_ARG_TAB_RESERVED = 'codebuddy-tab';

/**
 * append-log `argv[2]` for Claude Code project hooks (`.claude/settings.json`, PostToolUse + Write|Edit).
 * @see https://code.claude.com/docs/zh-CN/hooks
 */
export const CLAUDE_CODE_HOOK_ARG = 'claude-code';

/** Reserved for future Claude Code Tab-style hook argv — **not wired**. */
export const CLAUDE_CODE_HOOK_ARG_TAB_RESERVED = 'claude-code-tab';

/**
 * append-log `argv[2]` for Qoder（项目 `.qoder/settings.json`，PostToolUse + Write|Edit）。
 * @see https://docs.qoder.com/zh/extensions/hooks
 */
export const QODER_HOOK_ARG = 'qoder';

/** Tab 预留，未接线 */
export const QODER_HOOK_ARG_TAB_RESERVED = 'qoder-tab';

export function hookCommandMatchesOurs(command: string | undefined): boolean {
  if (!command) return false;
  if (command.includes(HOOK_COMMAND_MARKER)) return true;
  return LEGACY_HOOK_COMMAND_MARKERS.some((m) => command.includes(m));
}

/** `init` 追加到 `.gitignore`：主日志与 hook 报错（均在 `.aicode-ratio/`）。 */
export const GITIGNORE_LINES = [
  '.aicode-ratio/log.jsonl',
  '.aicode-ratio/log.jsonl.*',
  '.aicode-ratio/hook-errors.log',
] as const;

export const CONFIG_FILENAME = '.aicode-ratio.json';

/** Older config filenames still read by `loadResolvedConfig` (init skips writing default if any exist). */
export const LEGACY_CONFIG_FILENAMES = ['.cursor-attribution.json'] as const;
