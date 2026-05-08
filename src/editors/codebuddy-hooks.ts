/**
 * Merge / strip aicode-ratio entries inside CodeBuddy `.codebuddy/settings.json` `hooks`.
 * Spec: compatible with Claude Code hooks shape (Tencent CodeBuddy docs).
 */
import {
  HOOK_SCRIPT_NAME,
  CODEBUDDY_HOOK_ARG,
  hookCommandMatchesOurs,
} from '../constants.js';

/** PostToolUse matcher for tracked file writes. */
export const CODEBUDDY_POST_TOOL_MATCHER = 'Write|Edit';

/** Default timeout seconds for hook command (writes can be slower than Cursor hooks). */
export const CODEBUDDY_HOOK_TIMEOUT_SECONDS = 60;

export type CodeBuddyHookEntry = {
  type?: string;
  command?: string;
  timeout?: number;
};

export type CodeBuddyHookMatcherBlock = {
  matcher?: string;
  hooks?: CodeBuddyHookEntry[];
};

/** Top-level `.codebuddy/settings.json` subset we mutate. */
export type CodeBuddySettingsShape = {
  hooks?: Partial<Record<string, CodeBuddyHookMatcherBlock[]>>;
  [key: string]: unknown;
};

export function buildCodeBuddyAppendCommand(): string {
  return `node "$CODEBUDDY_PROJECT_DIR/.codebuddy/hooks/${HOOK_SCRIPT_NAME}" ${CODEBUDDY_HOOK_ARG}`;
}

/** Parse existing settings (may omit `hooks`). */
export function parseCodeBuddySettings(raw: string): CodeBuddySettingsShape {
  try {
    return raw.trim() ? (JSON.parse(raw) as CodeBuddySettingsShape) : {};
  } catch {
    throw new Error(
      '.codebuddy/settings.json contains invalid JSON — fix it manually before running init',
    );
  }
}

function findOurCommandInBlocks(blocks: CodeBuddyHookMatcherBlock[] | undefined): boolean {
  if (!Array.isArray(blocks)) return false;
  for (const b of blocks) {
    const hh = b.hooks;
    if (!Array.isArray(hh)) continue;
    if (hh.some((e) => hookCommandMatchesOurs(e.command))) return true;
  }
  return false;
}

/**
 * Merge PostToolUse command for Write|Edit.
 * Strips existing `aicode-ratio-append-log` hooks in that matcher block then re-adds canonical entry
 * (dedup + upgrades legacy argv e.g. `codebuddyIDE` → `codebuddy`).
 */
export function mergeCodeBuddySettings(existing: string): CodeBuddySettingsShape {
  const doc = parseCodeBuddySettings(existing);
  if (!doc.hooks || typeof doc.hooks !== 'object') doc.hooks = {};
  const hooks = doc.hooks;

  let postBlocks = hooks.PostToolUse;
  if (!Array.isArray(postBlocks)) postBlocks = [];

  const existingIdx = postBlocks.findIndex(
    (b) => typeof b.matcher === 'string' && b.matcher === CODEBUDDY_POST_TOOL_MATCHER,
  );

  const ourCommand = buildCodeBuddyAppendCommand();
  const newEntry: CodeBuddyHookEntry = {
    type: 'command',
    command: ourCommand,
    timeout: CODEBUDDY_HOOK_TIMEOUT_SECONDS,
  };

  if (existingIdx >= 0) {
    const block = postBlocks[existingIdx]!;
    const arr = Array.isArray(block.hooks) ? [...block.hooks] : [];
    const theirs = arr.filter((e) => !hookCommandMatchesOurs(e.command));
    postBlocks = [...postBlocks];
    postBlocks[existingIdx] = { ...block, hooks: [...theirs, newEntry] };
  } else {
    postBlocks = [
      ...postBlocks,
      { matcher: CODEBUDDY_POST_TOOL_MATCHER, hooks: [newEntry] },
    ];
  }

  hooks.PostToolUse = postBlocks;
  return doc;
}

/** Remove our hook entries from PostToolUse blocks; drop empty blocks. */
export function stripCodeBuddySettingsRaw(raw: string): string {
  const doc = parseCodeBuddySettings(raw);
  if (!doc.hooks?.PostToolUse || !Array.isArray(doc.hooks.PostToolUse)) {
    return `${JSON.stringify(doc, null, 2)}\n`;
  }

  const nextBlocks: CodeBuddyHookMatcherBlock[] = [];
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

export function codeBuddySettingsContainsOurs(raw: string): boolean {
  try {
    const doc = parseCodeBuddySettings(raw);
    return findOurCommandInBlocks(doc.hooks?.PostToolUse);
  } catch {
    return false;
  }
}
