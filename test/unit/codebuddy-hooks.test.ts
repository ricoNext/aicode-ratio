import { describe, it, expect } from 'vitest';
import {
  CODEBUDDY_POST_TOOL_MATCHER,
  mergeCodeBuddySettings,
  stripCodeBuddySettingsRaw,
  buildCodeBuddyAppendCommand,
} from '../../src/editors/codebuddy-hooks.js';

describe('CodeBuddy hooks settings merge/strip', () => {
  it('buildCodeBuddyAppendCommand wires codebuddy argv token', () => {
    expect(buildCodeBuddyAppendCommand()).toMatch(/\.mjs"\s+codebuddy$/);
    expect(buildCodeBuddyAppendCommand()).toContain('CODEBUDDY_PROJECT_DIR');
  });

  it('merge replaces legacy codebuddyIDE argv hook with canonical codebuddy argv', () => {
    const legacyCmd =
      'node "$CODEBUDDY_PROJECT_DIR/.codebuddy/hooks/aicode-ratio-append-log.mjs" codebuddyIDE';
    const existing = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: CODEBUDDY_POST_TOOL_MATCHER,
            hooks: [{ type: 'command', command: legacyCmd }],
          },
        ],
      },
    });
    const doc = mergeCodeBuddySettings(existing);
    const cmd = doc.hooks?.PostToolUse?.[0].hooks?.[0].command;
    expect(cmd).toMatch(/\scodebuddy$/);
    expect(cmd).not.toContain('codebuddyIDE');
    expect(doc.hooks?.PostToolUse?.[0].hooks).toHaveLength(1);
  });

  it('creates hooks.PostToolUse with Write|Edit when empty', () => {
    const doc = mergeCodeBuddySettings('');
    expect(doc.hooks?.PostToolUse).toHaveLength(1);
    expect(doc.hooks?.PostToolUse?.[0].matcher).toBe(CODEBUDDY_POST_TOOL_MATCHER);
    const hooks = doc.hooks?.PostToolUse?.[0].hooks;
    expect(hooks).toHaveLength(1);
    expect(hooks?.[0].type).toBe('command');
    expect(hooks?.[0].command).toContain('aicode-ratio-append-log');
    expect(hooks?.[0].timeout).toBeGreaterThan(0);
  });

  it('preserves unrelated hooks keys and matcher blocks', () => {
    const existing = JSON.stringify({
      foo: 1,
      hooks: {
        PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: 'echo pre' }] }],
      },
    });
    const doc = mergeCodeBuddySettings(existing);
    expect(doc.foo).toBe(1);
    expect(doc.hooks?.PreToolUse).toHaveLength(1);
    expect(doc.hooks?.PostToolUse).toHaveLength(1);
  });

  it('appends to existing PostToolUse block without removing other hook commands', () => {
    const existing = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: CODEBUDDY_POST_TOOL_MATCHER,
            hooks: [{ type: 'command', command: 'node user-hook.mjs', timeout: 10 }],
          },
        ],
      },
    });
    const doc = mergeCodeBuddySettings(existing);
    const block = doc.hooks?.PostToolUse?.[0];
    expect(block?.hooks).toHaveLength(2);
    expect(block?.hooks?.[0].command).toBe('node user-hook.mjs');
    expect(block?.hooks?.[1].command).toContain('aicode-ratio-append-log');
  });

  it('is idempotent when our command already present', () => {
    const first = mergeCodeBuddySettings('');
    const second = mergeCodeBuddySettings(JSON.stringify(first));
    expect(second.hooks?.PostToolUse?.[0].hooks).toHaveLength(1);
  });

  it('strip removes our entries and drops empty PostToolUse / hooks', () => {
    const raw = JSON.stringify(mergeCodeBuddySettings(''), null, 2);
    const stripped = stripCodeBuddySettingsRaw(raw);
    const doc = JSON.parse(stripped);
    expect(doc.hooks).toBeUndefined();
  });

  it('strip keeps user hooks in the same matcher block', () => {
    const merged = mergeCodeBuddySettings(
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: CODEBUDDY_POST_TOOL_MATCHER,
              hooks: [{ type: 'command', command: 'node keep.mjs' }],
            },
          ],
        },
      }),
    );
    const stripped = stripCodeBuddySettingsRaw(JSON.stringify(merged));
    const doc = JSON.parse(stripped);
    expect(doc.hooks.PostToolUse).toHaveLength(1);
    expect(doc.hooks.PostToolUse[0].hooks).toHaveLength(1);
    expect(doc.hooks.PostToolUse[0].hooks[0].command).toBe('node keep.mjs');
  });

  it('throws on invalid JSON', () => {
    expect(() => mergeCodeBuddySettings('{ not json')).toThrow(/invalid JSON/);
  });
});
