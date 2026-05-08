/**
 * Tencent CodeBuddy — project `.codebuddy/settings.json` Hooks (PostToolUse, Write|Edit).
 * Tab argv: reserve `CODEBUDDY_HOOK_ARG_TAB_RESERVED` in constants (not wired).
 */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOOK_SCRIPT_NAME } from '../constants.js';
import type { EditorAdapter, EditorDoctorContext, EditorInstallContext, EditorUninstallContext } from './types.js';
import {
  mergeCodeBuddySettings,
  stripCodeBuddySettingsRaw,
  codeBuddySettingsContainsOurs,
} from './codebuddy-hooks.js';

const SETTINGS_REL = '.codebuddy/settings.json';

function bundledHookPath(ctx: Pick<EditorInstallContext, 'bundledHooksDir'>): string {
  return join(ctx.bundledHooksDir, HOOK_SCRIPT_NAME);
}

function settingsAbs(repoRoot: string): string {
  return join(repoRoot, SETTINGS_REL);
}

function runDoctor(ctx: EditorDoctorContext): void {
  const { repoRoot } = ctx;
  const sp = settingsAbs(repoRoot);
  const hp = join(repoRoot, '.codebuddy', 'hooks', HOOK_SCRIPT_NAME);

  if (!existsSync(sp)) console.warn(`[warn] [codebuddy] Missing ${sp} — run init`);
  else {
    const raw = readFileSync(sp, 'utf8');
    if (codeBuddySettingsContainsOurs(raw)) {
      console.log('[ok] [codebuddy] settings.json contains aicode-ratio hook command');
    } else {
      console.warn(
        `[warn] [codebuddy] ${sp} exists but has no aicode-ratio PostToolUse entry — run init`,
      );
    }
  }

  if (existsSync(hp)) console.log(`[ok] [codebuddy] Hook script present: ${hp}`);
  else console.warn(`[warn] [codebuddy] Missing hook script ${hp} — run init`);
}

export const codeBuddyAdapter: EditorAdapter = {
  id: 'codebuddy',
  label: 'CodeBuddy',
  tier: 'supported',
  gitignoreLines: [],
  install(ctx: EditorInstallContext): void {
    const base = join(ctx.repoRoot, '.codebuddy');
    const hooksDir = join(base, 'hooks');
    mkdirSync(hooksDir, { recursive: true });

    const src = bundledHookPath(ctx);
    if (!existsSync(src)) {
      throw new Error(
        `Bundled hook not found at ${src}. Run \`pnpm run build\` so dist/hooks/${HOOK_SCRIPT_NAME} exists.`,
      );
    }
    const destHook = join(hooksDir, HOOK_SCRIPT_NAME);
    copyFileSync(src, destHook);

    const sp = settingsAbs(ctx.repoRoot);
    const prev = existsSync(sp) ? readFileSync(sp, 'utf8') : '';
    const merged = mergeCodeBuddySettings(prev);
    writeFileSync(sp, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  },
  doctor(ctx: EditorDoctorContext): void {
    runDoctor(ctx);
  },
  uninstall(ctx: EditorUninstallContext): string[] {
    const sp = settingsAbs(ctx.repoRoot);
    if (!existsSync(sp)) return [];
    const prev = readFileSync(sp, 'utf8');
    writeFileSync(sp, stripCodeBuddySettingsRaw(prev), 'utf8');
    return [`Removed aicode-ratio PostToolUse hook entries from ${sp}`];
  },
};
