import { describe, it, expect } from 'vitest';
import {
  CLAUDE_CODE_POST_TOOL_MATCHER,
  mergeClaudeCodeSettings,
  stripClaudeCodeSettingsRaw,
  buildClaudeCodeAppendCommand,
} from '../../src/editors/claude-code-hooks.js';

describe('Claude Code hooks settings merge/strip', () => {
  it('buildClaudeCodeAppendCommand wires claude-code argv and CLAUDE_PROJECT_DIR', () => {
    expect(buildClaudeCodeAppendCommand()).toMatch(/\.mjs"\s+claude-code$/);
    expect(buildClaudeCodeAppendCommand()).toContain('CLAUDE_PROJECT_DIR');
    expect(buildClaudeCodeAppendCommand()).toContain('.claude/hooks');
  });

  it('creates hooks.PostToolUse with Write|Edit when empty', () => {
    const doc = mergeClaudeCodeSettings('');
    expect(doc.hooks?.PostToolUse).toHaveLength(1);
    expect(doc.hooks?.PostToolUse?.[0].matcher).toBe(CLAUDE_CODE_POST_TOOL_MATCHER);
    const hooks = doc.hooks?.PostToolUse?.[0].hooks;
    expect(hooks).toHaveLength(1);
    expect(hooks?.[0].type).toBe('command');
    expect(hooks?.[0].command).toContain('aicode-ratio-append-log');
    expect(hooks?.[0].timeout).toBeGreaterThan(0);
  });

  it('preserves unrelated hooks keys', () => {
    const existing = JSON.stringify({
      foo: 1,
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo' }] }],
      },
    });
    const doc = mergeClaudeCodeSettings(existing);
    expect(doc.foo).toBe(1);
    expect(doc.hooks?.PreToolUse).toHaveLength(1);
    expect(doc.hooks?.PostToolUse).toHaveLength(1);
  });

  it('appends beside user hooks in the Write|Edit block', () => {
    const existing = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: CLAUDE_CODE_POST_TOOL_MATCHER,
            hooks: [{ type: 'command', command: 'echo user', timeout: 5 }],
          },
        ],
      },
    });
    const doc = mergeClaudeCodeSettings(existing);
    const block = doc.hooks?.PostToolUse?.[0];
    expect(block?.hooks).toHaveLength(2);
    expect(block?.hooks?.[0].command).toBe('echo user');
    expect(block?.hooks?.[1].command).toContain('aicode-ratio-append-log');
  });

  it('is idempotent on second merge', () => {
    const first = mergeClaudeCodeSettings('');
    const second = mergeClaudeCodeSettings(JSON.stringify(first));
    expect(second.hooks?.PostToolUse?.[0].hooks).toHaveLength(1);
  });

  it('strip removes our entries', () => {
    const raw = JSON.stringify(mergeClaudeCodeSettings(''), null, 2);
    const stripped = stripClaudeCodeSettingsRaw(raw);
    const doc = JSON.parse(stripped);
    expect(doc.hooks).toBeUndefined();
  });

  it('throws on invalid JSON', () => {
    expect(() => mergeClaudeCodeSettings('{')).toThrow(/invalid JSON/);
  });
});
