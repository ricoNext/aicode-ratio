/**
 * Merge / strip aicode-ratio entries inside Claude Code project `.claude/settings.json` `hooks`.
 * @see https://code.claude.com/docs/zh-CN/hooks
 */
import {
  HOOK_SCRIPT_NAME,
  CLAUDE_CODE_HOOK_ARG,
  hookCommandMatchesOurs,
} from '../constants.js';

/** PostToolUse matcher for Write / Edit (Claude Code docs). */
export const CLAUDE_CODE_POST_TOOL_MATCHER = 'Write|Edit';

export const CLAUDE_CODE_HOOK_TIMEOUT_SECONDS = 60;

export type ClaudeCodeHookEntry = {
  type?: string;
  command?: string;
  timeout?: number;
};

export type ClaudeCodeHookMatcherBlock = {
  matcher?: string;
  hooks?: ClaudeCodeHookEntry[];
};

export type ClaudeCodeSettingsShape = {
  hooks?: Partial<Record<string, ClaudeCodeHookMatcherBlock[]>>;
  [key: string]: unknown;
};

export function buildClaudeCodeAppendCommand(): string {
  return `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${HOOK_SCRIPT_NAME}" ${CLAUDE_CODE_HOOK_ARG}`;
}

export function parseClaudeCodeSettings(raw: string): ClaudeCodeSettingsShape {
  try {
    return raw.trim() ? (JSON.parse(raw) as ClaudeCodeSettingsShape) : {};
  } catch {
    throw new Error(
      '.claude/settings.json contains invalid JSON — fix it manually before running init',
    );
  }
}

function findOurCommandInBlocks(blocks: ClaudeCodeHookMatcherBlock[] | undefined): boolean {
  if (!Array.isArray(blocks)) return false;
  for (const b of blocks) {
    const hh = b.hooks;
    if (!Array.isArray(hh)) continue;
    if (hh.some((e) => hookCommandMatchesOurs(e.command))) return true;
  }
  return false;
}

/**
 * Merge PostToolUse for Write|Edit: remove prior aicode-ratio-append-log entries in that block,
 * then add one canonical command.
 */
export function mergeClaudeCodeSettings(existing: string): ClaudeCodeSettingsShape {
  const doc = parseClaudeCodeSettings(existing);
  if (!doc.hooks || typeof doc.hooks !== 'object') doc.hooks = {};
  const hooks = doc.hooks;

  let postBlocks = hooks.PostToolUse;
  if (!Array.isArray(postBlocks)) postBlocks = [];

  const existingIdx = postBlocks.findIndex(
    (b) => typeof b.matcher === 'string' && b.matcher === CLAUDE_CODE_POST_TOOL_MATCHER,
  );

  const ourCommand = buildClaudeCodeAppendCommand();
  const newEntry: ClaudeCodeHookEntry = {
    type: 'command',
    command: ourCommand,
    timeout: CLAUDE_CODE_HOOK_TIMEOUT_SECONDS,
  };

  if (existingIdx >= 0) {
    const block = postBlocks[existingIdx]!;
    const arr = Array.isArray(block.hooks) ? [...block.hooks] : [];
    const theirs = arr.filter((e) => !hookCommandMatchesOurs(e.command));
    postBlocks = [...postBlocks];
    postBlocks[existingIdx] = { ...block, hooks: [...theirs, newEntry] };
  } else {
    postBlocks = [...postBlocks, { matcher: CLAUDE_CODE_POST_TOOL_MATCHER, hooks: [newEntry] }];
  }

  hooks.PostToolUse = postBlocks;
  return doc;
}

export function stripClaudeCodeSettingsRaw(raw: string): string {
  const doc = parseClaudeCodeSettings(raw);
  if (!doc.hooks?.PostToolUse || !Array.isArray(doc.hooks.PostToolUse)) {
    return `${JSON.stringify(doc, null, 2)}\n`;
  }

  const nextBlocks: ClaudeCodeHookMatcherBlock[] = [];
  for (const block of doc.hooks.PostToolUse) {
    const arr = Array.isArray(block.hooks)
      ? block.hooks.filter((e) => !hookCommandMatchesOurs(e.command))
      : [];
    if (arr.length > 0) nextBlocks.push({ ...block, hooks: arr });
  }

  if (nextBlocks.length === 0) {
    delete doc.hooks.PostToolUse;
    if (doc.hooks && Object.keys(doc.hooks).length === 0) delete doc.hooks;
  } else {
    doc.hooks.PostToolUse = nextBlocks;
  }

  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function claudeCodeSettingsContainsOurs(raw: string): boolean {
  try {
    const doc = parseClaudeCodeSettings(raw);
    return findOurCommandInBlocks(doc.hooks?.PostToolUse);
  } catch {
    return false;
  }
}
