/**
 * Qoder — 项目 `.qoder/settings.json` PostToolUse (Write|Edit).
 * Tab argv：常量 `QODER_HOOK_ARG_TAB_RESERVED`（未接线）。
 */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOOK_SCRIPT_NAME } from '../constants.js';
import type { EditorAdapter, EditorDoctorContext, EditorInstallContext, EditorUninstallContext } from './types.js';
import { mergeQoderSettings, stripQoderSettingsRaw, qoderSettingsContainsOurs } from './qoder-hooks.js';
import { installAicodeRatioReportCommand, tryRemoveAicodeRatioReportCommand } from './report-slash-command.js';

const SETTINGS_REL = '.qoder/settings.json';

function bundledHookPath(ctx: Pick<EditorInstallContext, 'bundledHooksDir'>): string {
  return join(ctx.bundledHooksDir, HOOK_SCRIPT_NAME);
}

function settingsAbs(repoRoot: string): string {
  return join(repoRoot, SETTINGS_REL);
}

function runDoctor(ctx: EditorDoctorContext): void {
  const { repoRoot } = ctx;
  const sp = settingsAbs(repoRoot);
  const hp = join(repoRoot, '.qoder', 'hooks', HOOK_SCRIPT_NAME);

  if (!existsSync(sp)) console.warn(`[warn] [qoder] Missing ${sp} — run init`);
  else {
    const raw = readFileSync(sp, 'utf8');
    if (qoderSettingsContainsOurs(raw)) {
      console.log('[ok] [qoder] settings.json contains aicode-ratio hook command');
    } else {
      console.warn(`[warn] [qoder] ${sp} exists but has no aicode-ratio PostToolUse entry — run init`);
    }
  }

  if (existsSync(hp)) console.log(`[ok] [qoder] Hook script present: ${hp}`);
  else console.warn(`[warn] [qoder] Missing hook script ${hp} — run init`);
}

export const qoderAdapter: EditorAdapter = {
  id: 'qoder',
  label: 'Qoder',
  tier: 'supported',
  gitignoreLines: [],
  install(ctx: EditorInstallContext): void {
    const base = join(ctx.repoRoot, '.qoder');
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
    const merged = mergeQoderSettings(prev);
    writeFileSync(sp, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

    installAicodeRatioReportCommand(join(ctx.repoRoot, '.qoder', 'commands'));
  },
  doctor(ctx: EditorDoctorContext): void {
    runDoctor(ctx);
  },
  uninstall(ctx: EditorUninstallContext): string[] {
    const lines: string[] = [];
    const cmdRm = tryRemoveAicodeRatioReportCommand(join(ctx.repoRoot, '.qoder', 'commands'));
    if (cmdRm) lines.push(`Removed ${cmdRm}`);

    const sp = settingsAbs(ctx.repoRoot);
    if (!existsSync(sp)) return lines;
    const prev = readFileSync(sp, 'utf8');
    writeFileSync(sp, stripQoderSettingsRaw(prev), 'utf8');
    lines.push(`Removed aicode-ratio PostToolUse hook entries from ${sp}`);
    return lines;
  },
};
