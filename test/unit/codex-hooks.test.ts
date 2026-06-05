import { describe, it, expect } from 'vitest';
import {
  CODEX_POST_TOOL_MATCHER,
  buildCodexAppendCommand,
  mergeCodexHooks,
  stripCodexHooksRaw,
} from '../../src/editors/codex-hooks.js';
import { ensureCodexHooksFeatureEnabled } from '../../src/editors/codex-adapter.js';

describe('Codex hooks merge/strip', () => {
  it('buildCodexAppendCommand uses project-relative .codex/hooks and codex argv', () => {
    const cmd = buildCodexAppendCommand();
    expect(cmd).toContain('.codex/hooks/');
    expect(cmd).toMatch(/\scodex$/);
    expect(cmd).toMatch(/^node "\.codex\/hooks\//);
  });

  it('creates hooks.PostToolUse with Write|Edit when empty', () => {
    const doc = mergeCodexHooks('');
    expect(doc.hooks?.PostToolUse).toHaveLength(1);
    expect(doc.hooks?.PostToolUse?.[0].matcher).toBe(CODEX_POST_TOOL_MATCHER);
    const hooks = doc.hooks?.PostToolUse?.[0].hooks;
    expect(hooks).toHaveLength(1);
    expect(hooks?.[0].command).toContain('aicode-ratio-append-log');
  });

  it('keeps user hooks next to ours in the Write|Edit block', () => {
    const existing = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: CODEX_POST_TOOL_MATCHER,
            hooks: [{ type: 'command', command: 'echo other' }],
          },
        ],
      },
    });
    const doc = mergeCodexHooks(existing);
    expect(doc.hooks?.PostToolUse?.[0].hooks).toHaveLength(2);
  });

  it('strip clears our hooks', () => {
    const stripped = stripCodexHooksRaw(JSON.stringify(mergeCodexHooks(''), null, 2));
    expect(JSON.parse(stripped).hooks).toBeUndefined();
  });

  it('throws on invalid JSON', () => {
    expect(() => mergeCodexHooks('not-json')).toThrow(/invalid JSON/);
  });
});

describe('Codex config.toml hooks feature merge', () => {
  it('creates [features] hooks = true when config is empty', () => {
    expect(ensureCodexHooksFeatureEnabled('')).toBe('[features]\nhooks = true\n');
  });

  it('adds hooks = true to existing [features]', () => {
    expect(ensureCodexHooksFeatureEnabled('[features]\njs_repl = false\n')).toBe(
      '[features]\njs_repl = false\nhooks = true\n',
    );
  });

  it('updates existing hooks value under [features]', () => {
    expect(ensureCodexHooksFeatureEnabled('[features]\nhooks = false\n')).toBe(
      '[features]\nhooks = true\n',
    );
  });

  it('does not move following tables', () => {
    expect(ensureCodexHooksFeatureEnabled('[features]\njs_repl = false\n\n[mcp_servers.x]\n')).toBe(
      '[features]\njs_repl = false\n\nhooks = true\n[mcp_servers.x]\n',
    );
  });
});
