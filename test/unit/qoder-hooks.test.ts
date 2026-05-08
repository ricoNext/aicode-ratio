import { describe, it, expect } from 'vitest';
import {
  QODER_POST_TOOL_MATCHER,
  mergeQoderSettings,
  stripQoderSettingsRaw,
  buildQoderAppendCommand,
} from '../../src/editors/qoder-hooks.js';

describe('Qoder hooks settings merge/strip', () => {
  it('buildQoderAppendCommand uses project-relative .qoder/hooks and qoder argv', () => {
    const cmd = buildQoderAppendCommand();
    expect(cmd).toContain('.qoder/hooks/');
    expect(cmd).toMatch(/\sqoder$/);
    expect(cmd).toMatch(/^node "\.qoder\/hooks\//);
  });

  it('creates hooks.PostToolUse with Write|Edit when empty', () => {
    const doc = mergeQoderSettings('');
    expect(doc.hooks?.PostToolUse).toHaveLength(1);
    expect(doc.hooks?.PostToolUse?.[0].matcher).toBe(QODER_POST_TOOL_MATCHER);
    const hooks = doc.hooks?.PostToolUse?.[0].hooks;
    expect(hooks).toHaveLength(1);
    expect(hooks?.[0].command).toContain('aicode-ratio-append-log');
  });

  it('keeps user hooks next to ours in the Write|Edit block', () => {
    const existing = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: QODER_POST_TOOL_MATCHER,
            hooks: [{ type: 'command', command: 'echo other' }],
          },
        ],
      },
    });
    const doc = mergeQoderSettings(existing);
    expect(doc.hooks?.PostToolUse?.[0].hooks).toHaveLength(2);
  });

  it('strip clears our hooks', () => {
    const stripped = stripQoderSettingsRaw(JSON.stringify(mergeQoderSettings(''), null, 2));
    expect(JSON.parse(stripped).hooks).toBeUndefined();
  });

  it('throws on invalid JSON', () => {
    expect(() => mergeQoderSettings('not-json')).toThrow(/invalid JSON/);
  });
});
