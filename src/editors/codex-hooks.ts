/**
 * Codex — project `.codex/hooks.json` PostToolUse (Write|Edit).
 */
import {
  CODEX_HOOK_ARG,
  HOOK_SCRIPT_NAME,
  hookCommandMatchesOurs,
} from '../constants.js';

export const CODEX_POST_TOOL_MATCHER = 'Write|Edit';

export const CODEX_HOOK_TIMEOUT_SECONDS = 60;

export type CodexHookEntry = {
  type?: string;
  command?: string;
  timeout?: number;
};

export type CodexHookMatcherBlock = {
  matcher?: string;
  hooks?: CodexHookEntry[];
};

export type CodexHooksShape = {
  hooks?: Partial<Record<string, CodexHookMatcherBlock[]>>;
  [key: string]: unknown;
};

export function buildCodexAppendCommand(): string {
  return `node ".codex/hooks/${HOOK_SCRIPT_NAME}" ${CODEX_HOOK_ARG}`;
}

export function parseCodexHooks(raw: string): CodexHooksShape {
  try {
    return raw.trim() ? (JSON.parse(raw) as CodexHooksShape) : {};
  } catch {
    throw new Error('.codex/hooks.json contains invalid JSON — fix it manually before running init');
  }
}

function findOurCommandInBlocks(blocks: CodexHookMatcherBlock[] | undefined): boolean {
  if (!Array.isArray(blocks)) return false;
  for (const b of blocks) {
    const hh = b.hooks;
    if (!Array.isArray(hh)) continue;
    if (hh.some((e) => hookCommandMatchesOurs(e.command))) return true;
  }
  return false;
}

export function mergeCodexHooks(existing: string): CodexHooksShape {
  const doc = parseCodexHooks(existing);
  if (!doc.hooks || typeof doc.hooks !== 'object') doc.hooks = {};
  const hooks = doc.hooks;

  let postBlocks = hooks.PostToolUse;
  if (!Array.isArray(postBlocks)) postBlocks = [];

  const existingIdx = postBlocks.findIndex(
    (b) => typeof b.matcher === 'string' && b.matcher === CODEX_POST_TOOL_MATCHER,
  );

  const newEntry: CodexHookEntry = {
    type: 'command',
    command: buildCodexAppendCommand(),
    timeout: CODEX_HOOK_TIMEOUT_SECONDS,
  };

  if (existingIdx >= 0) {
    const block = postBlocks[existingIdx]!;
    const arr = Array.isArray(block.hooks) ? [...block.hooks] : [];
    const theirs = arr.filter((e) => !hookCommandMatchesOurs(e.command));
    postBlocks = [...postBlocks];
    postBlocks[existingIdx] = { ...block, hooks: [...theirs, newEntry] };
  } else {
    postBlocks = [...postBlocks, { matcher: CODEX_POST_TOOL_MATCHER, hooks: [newEntry] }];
  }

  hooks.PostToolUse = postBlocks;
  return doc;
}

export function stripCodexHooksRaw(raw: string): string {
  const doc = parseCodexHooks(raw);
  if (!doc.hooks?.PostToolUse || !Array.isArray(doc.hooks.PostToolUse)) {
    return `${JSON.stringify(doc, null, 2)}\n`;
  }

  const nextBlocks: CodexHookMatcherBlock[] = [];
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

export function codexHooksContainsOurs(raw: string): boolean {
  try {
    const doc = parseCodexHooks(raw);
    return findOurCommandInBlocks(doc.hooks?.PostToolUse);
  } catch {
    return false;
  }
}
