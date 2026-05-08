import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOOK_SCRIPT_NAME, hookCommandMatchesOurs } from '../constants.js';
import type { EditorAdapter, EditorDoctorContext, EditorInstallContext, EditorUninstallContext } from './types.js';
import { mergeHooksJson, stripCursorHooksFromHooksJsonRaw } from './cursor-hooks.js';
import { installAicodeRatioReportCommand, tryRemoveAicodeRatioReportCommand } from './report-slash-command.js';

function bundledHookPath(ctx: Pick<EditorInstallContext, 'bundledHooksDir'>): string {
  return join(ctx.bundledHooksDir, HOOK_SCRIPT_NAME);
}

function runDoctor(ctx: EditorDoctorContext): void {
  const { repoRoot } = ctx;
  const hooksJsonPath = join(repoRoot, '.cursor', 'hooks.json');
  if (!existsSync(hooksJsonPath)) {
    console.warn(`[warn] [cursor] Missing ${hooksJsonPath} — run init`);
    return;
  }
  const raw = readFileSync(hooksJsonPath, 'utf8');
  let found = false;
  try {
    const j = JSON.parse(raw) as { hooks?: Record<string, Array<{ command?: string }>> };
    for (const name of ['afterFileEdit', 'afterTabFileEdit'] as const) {
      const arr = j.hooks?.[name];
      if (!Array.isArray(arr)) continue;
      if (arr.some((e) => hookCommandMatchesOurs(e.command))) found = true;
    }
  } catch {
    // ignore malformed JSON — warn below
  }
  if (found) console.log('[ok] [cursor] hooks.json contains aicode-ratio hook commands');
  else console.warn('[warn] [cursor] hooks.json exists but no aicode-ratio hook entries');

  const hookPath = join(repoRoot, '.cursor', 'hooks', HOOK_SCRIPT_NAME);
  if (existsSync(hookPath)) console.log(`[ok] [cursor] Hook script present: ${hookPath}`);
  else console.warn(`[warn] [cursor] Missing hook script ${hookPath} — run init`);
}

export const cursorAdapter: EditorAdapter = {
  id: 'cursor',
  label: 'Cursor',
  tier: 'supported',
  gitignoreLines: [],
  install(ctx: EditorInstallContext): void {
    const cursorDir = join(ctx.repoRoot, '.cursor');
    const hooksDir = join(cursorDir, 'hooks');
    mkdirSync(hooksDir, { recursive: true });

    const src = bundledHookPath(ctx);
    if (!existsSync(src)) {
      throw new Error(
        `Bundled hook not found at ${src}. Run \`pnpm run build\` so dist/hooks/${HOOK_SCRIPT_NAME} exists.`,
      );
    }
    const destHook = join(hooksDir, HOOK_SCRIPT_NAME);
    copyFileSync(src, destHook);

    const hooksJsonPath = join(cursorDir, 'hooks.json');
    const prev = existsSync(hooksJsonPath) ? readFileSync(hooksJsonPath, 'utf8') : '';
    const merged = mergeHooksJson(prev);
    writeFileSync(hooksJsonPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

    installAicodeRatioReportCommand(join(ctx.repoRoot, '.cursor', 'commands'));
  },
  doctor(ctx: EditorDoctorContext): void {
    runDoctor(ctx);
  },
  uninstall(ctx: EditorUninstallContext): string[] {
    const lines: string[] = [];
    const cmdRm = tryRemoveAicodeRatioReportCommand(join(ctx.repoRoot, '.cursor', 'commands'));
    if (cmdRm) lines.push(`Removed ${cmdRm}`);

    const hooksJsonPath = join(ctx.repoRoot, '.cursor', 'hooks.json');
    if (!existsSync(hooksJsonPath)) return lines;
    const prev = readFileSync(hooksJsonPath, 'utf8');
    writeFileSync(hooksJsonPath, stripCursorHooksFromHooksJsonRaw(prev), 'utf8');
    lines.push(`Removed aicode-ratio hook entries from ${hooksJsonPath}`);
    return lines;
  },
};
