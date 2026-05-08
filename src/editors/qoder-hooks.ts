/**
 * Qoder IDE / JB 插件 — 项目 `.qoder/settings.json` PostToolUse (Write|Edit).
 * @see https://docs.qoder.com/zh/extensions/hooks
 */
import {
  HOOK_SCRIPT_NAME,
  QODER_HOOK_ARG,
  hookCommandMatchesOurs,
} from '../constants.js';

export const QODER_POST_TOOL_MATCHER = 'Write|Edit';

export const QODER_HOOK_TIMEOUT_SECONDS = 60;

export type QoderHookEntry = {
  type?: string;
  command?: string;
  timeout?: number;
};

export type QoderHookMatcherBlock = {
  matcher?: string;
  hooks?: QoderHookEntry[];
};

export type QoderSettingsShape = {
  hooks?: Partial<Record<string, QoderHookMatcherBlock[]>>;
  [key: string]: unknown;
};

/** 与文档示例一致：相对项目根的路径（插件从项目上下文执行）。 */
export function buildQoderAppendCommand(): string {
  return `node ".qoder/hooks/${HOOK_SCRIPT_NAME}" ${QODER_HOOK_ARG}`;
}

export function parseQoderSettings(raw: string): QoderSettingsShape {
  try {
    return raw.trim() ? (JSON.parse(raw) as QoderSettingsShape) : {};
  } catch {
    throw new Error('.qoder/settings.json contains invalid JSON — fix it manually before running init');
  }
}

function findOurCommandInBlocks(blocks: QoderHookMatcherBlock[] | undefined): boolean {
  if (!Array.isArray(blocks)) return false;
  for (const b of blocks) {
    const hh = b.hooks;
    if (!Array.isArray(hh)) continue;
    if (hh.some((e) => hookCommandMatchesOurs(e.command))) return true;
  }
  return false;
}

/** PostToolUse：去掉同 matcher 块内我方 append-log 后再写回一条 canonical 命令 */
export function mergeQoderSettings(existing: string): QoderSettingsShape {
  const doc = parseQoderSettings(existing);
  if (!doc.hooks || typeof doc.hooks !== 'object') doc.hooks = {};
  const hooks = doc.hooks;

  let postBlocks = hooks.PostToolUse;
  if (!Array.isArray(postBlocks)) postBlocks = [];

  const existingIdx = postBlocks.findIndex(
    (b) => typeof b.matcher === 'string' && b.matcher === QODER_POST_TOOL_MATCHER,
  );

  const ourCommand = buildQoderAppendCommand();
  const newEntry: QoderHookEntry = {
    type: 'command',
    command: ourCommand,
    timeout: QODER_HOOK_TIMEOUT_SECONDS,
  };

  if (existingIdx >= 0) {
    const block = postBlocks[existingIdx]!;
    const arr = Array.isArray(block.hooks) ? [...block.hooks] : [];
    const theirs = arr.filter((e) => !hookCommandMatchesOurs(e.command));
    postBlocks = [...postBlocks];
    postBlocks[existingIdx] = { ...block, hooks: [...theirs, newEntry] };
  } else {
    postBlocks = [...postBlocks, { matcher: QODER_POST_TOOL_MATCHER, hooks: [newEntry] }];
  }

  hooks.PostToolUse = postBlocks;
  return doc;
}

export function stripQoderSettingsRaw(raw: string): string {
  const doc = parseQoderSettings(raw);
  if (!doc.hooks?.PostToolUse || !Array.isArray(doc.hooks.PostToolUse)) {
    return `${JSON.stringify(doc, null, 2)}\n`;
  }

  const nextBlocks: QoderHookMatcherBlock[] = [];
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

export function qoderSettingsContainsOurs(raw: string): boolean {
  try {
    const doc = parseQoderSettings(raw);
    return findOurCommandInBlocks(doc.hooks?.PostToolUse);
  } catch {
    return false;
  }
}
