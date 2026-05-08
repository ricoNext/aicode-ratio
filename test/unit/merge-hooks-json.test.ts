import { describe, it, expect } from 'vitest';
import { mergeHooksJson } from '../../src/util/merge-hooks-json.js';

describe('mergeHooksJson', () => {
  it('creates full structure when input is empty string', () => {
    const result = mergeHooksJson('');
    expect(result.version).toBe(1);
    expect(result.hooks.afterFileEdit).toHaveLength(1);
    expect(result.hooks.afterTabFileEdit).toHaveLength(1);
    expect(result.hooks.afterFileEdit![0].command).toContain('aicode-ratio-append-log');
    expect(result.hooks.afterTabFileEdit![0].command).toContain('aicode-ratio-append-log');
  });

  it('appends to existing hooks without removing others', () => {
    const existing = JSON.stringify({
      version: 1,
      hooks: {
        afterFileEdit: [{ command: 'node other-hook.mjs', timeout: 5 }],
      },
    });
    const result = mergeHooksJson(existing);
    expect(result.hooks.afterFileEdit).toHaveLength(2);
    expect(result.hooks.afterFileEdit![0].command).toBe('node other-hook.mjs');
    expect(result.hooks.afterFileEdit![1].command).toContain('aicode-ratio-append-log');
  });

  it('skips duplicate init (idempotent)', () => {
    const first = mergeHooksJson('');
    const second = mergeHooksJson(JSON.stringify(first));
    expect(second.hooks.afterFileEdit).toHaveLength(1);
    expect(second.hooks.afterTabFileEdit).toHaveLength(1);
  });

  it('does not append when legacy cursor hook entry exists', () => {
    const existing = JSON.stringify({
      version: 1,
      hooks: {
        afterFileEdit: [{ command: 'node .cursor/hooks/cursor-attribution-append-log.mjs agent', timeout: 2 }],
        afterTabFileEdit: [{ command: 'node .cursor/hooks/cursor-attribution-append-log.mjs tab', timeout: 2 }],
      },
    });
    const result = mergeHooksJson(existing);
    expect(result.hooks.afterFileEdit).toHaveLength(1);
    expect(result.hooks.afterTabFileEdit).toHaveLength(1);
  });

  it('does not append when legacy agent-code-attribution hook exists', () => {
    const existing = JSON.stringify({
      version: 1,
      hooks: {
        afterFileEdit: [{ command: 'node .cursor/hooks/agent-code-attribution-append-log.mjs agent', timeout: 2 }],
        afterTabFileEdit: [{ command: 'node .cursor/hooks/agent-code-attribution-append-log.mjs tab', timeout: 2 }],
      },
    });
    const result = mergeHooksJson(existing);
    expect(result.hooks.afterFileEdit).toHaveLength(1);
    expect(result.hooks.afterTabFileEdit).toHaveLength(1);
  });

  it('throws on invalid JSON', () => {
    expect(() => mergeHooksJson('{ invalid json')).toThrow(/invalid JSON/);
  });
});
