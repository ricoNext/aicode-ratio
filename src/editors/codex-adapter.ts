/**
 * OpenAI Codex — project `.codex/hooks.json` PostToolUse (Write|Edit).
 */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOOK_SCRIPT_NAME } from '../constants.js';
import type { EditorAdapter, EditorDoctorContext, EditorInstallContext, EditorUninstallContext } from './types.js';
import { codexHooksContainsOurs, mergeCodexHooks, stripCodexHooksRaw } from './codex-hooks.js';
import { installAicodeRatioReportCommand, tryRemoveAicodeRatioReportCommand } from './report-slash-command.js';

const CONFIG_REL = '.codex/config.toml';
const HOOKS_REL = '.codex/hooks.json';

function bundledHookPath(ctx: Pick<EditorInstallContext, 'bundledHooksDir'>): string {
  return join(ctx.bundledHooksDir, HOOK_SCRIPT_NAME);
}

function hooksAbs(repoRoot: string): string {
  return join(repoRoot, HOOKS_REL);
}

function configAbs(repoRoot: string): string {
  return join(repoRoot, CONFIG_REL);
}

export function ensureCodexHooksFeatureEnabled(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n');
  const lines = normalized.length > 0 ? normalized.split('\n') : [];
  const hadTrailingNewline = normalized.endsWith('\n');
  if (hadTrailingNewline) lines.pop();

  const featureHeaderIdx = lines.findIndex((line) => line.trim() === '[features]');
  if (featureHeaderIdx < 0) {
    const prefix = lines.length > 0 ? [...lines, ''] : [];
    return [...prefix, '[features]', 'hooks = true', ''].join('\n');
  }

  let nextHeaderIdx = lines.length;
  for (let i = featureHeaderIdx + 1; i < lines.length; i += 1) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      nextHeaderIdx = i;
      break;
    }
  }

  const hooksIdx = lines
    .slice(featureHeaderIdx + 1, nextHeaderIdx)
    .findIndex((line) => /^\s*hooks\s*=/.test(line));

  if (hooksIdx >= 0) {
    lines[featureHeaderIdx + 1 + hooksIdx] = 'hooks = true';
  } else {
    lines.splice(nextHeaderIdx, 0, 'hooks = true');
  }

  return `${lines.join('\n')}\n`;
}

function runDoctor(ctx: EditorDoctorContext): void {
  const { repoRoot } = ctx;
  const cp = configAbs(repoRoot);
  const sp = hooksAbs(repoRoot);
  const hp = join(repoRoot, '.codex', 'hooks', HOOK_SCRIPT_NAME);

  if (!existsSync(cp)) console.warn(`[warn] [codex] Missing ${cp} — run init`);
  else {
    const raw = readFileSync(cp, 'utf8');
    if (/^\s*hooks\s*=\s*true\s*$/m.test(raw) && /^\s*\[features\]\s*$/m.test(raw)) {
      console.log('[ok] [codex] config.toml enables hooks feature');
    } else {
      console.warn(`[warn] [codex] ${cp} does not enable [features] hooks = true — run init`);
    }
  }

  if (!existsSync(sp)) console.warn(`[warn] [codex] Missing ${sp} — run init`);
  else {
    const raw = readFileSync(sp, 'utf8');
    if (codexHooksContainsOurs(raw)) {
      console.log('[ok] [codex] hooks.json contains aicode-ratio hook command');
    } else {
      console.warn(`[warn] [codex] ${sp} exists but has no aicode-ratio PostToolUse entry — run init`);
    }
  }

  if (existsSync(hp)) console.log(`[ok] [codex] Hook script present: ${hp}`);
  else console.warn(`[warn] [codex] Missing hook script ${hp} — run init`);
}

export const codexAdapter: EditorAdapter = {
  id: 'codex',
  label: 'Codex',
  tier: 'supported',
  gitignoreLines: [],
  install(ctx: EditorInstallContext): void {
    const base = join(ctx.repoRoot, '.codex');
    const hooksDir = join(base, 'hooks');
    mkdirSync(hooksDir, { recursive: true });

    const src = bundledHookPath(ctx);
    if (!existsSync(src)) {
      throw new Error(
        `Bundled hook not found at ${src}. Run \`pnpm run build\` so dist/hooks/${HOOK_SCRIPT_NAME} exists.`,
      );
    }
    copyFileSync(src, join(hooksDir, HOOK_SCRIPT_NAME));

    const hp = hooksAbs(ctx.repoRoot);
    const prevHooks = existsSync(hp) ? readFileSync(hp, 'utf8') : '';
    writeFileSync(hp, `${JSON.stringify(mergeCodexHooks(prevHooks), null, 2)}\n`, 'utf8');

    const cp = configAbs(ctx.repoRoot);
    const prevConfig = existsSync(cp) ? readFileSync(cp, 'utf8') : '';
    writeFileSync(cp, ensureCodexHooksFeatureEnabled(prevConfig), 'utf8');

    installAicodeRatioReportCommand(join(ctx.repoRoot, '.codex', 'commands'));
  },
  doctor(ctx: EditorDoctorContext): void {
    runDoctor(ctx);
  },
  uninstall(ctx: EditorUninstallContext): string[] {
    const lines: string[] = [];
    const cmdRm = tryRemoveAicodeRatioReportCommand(join(ctx.repoRoot, '.codex', 'commands'));
    if (cmdRm) lines.push(`Removed ${cmdRm}`);

    const hp = hooksAbs(ctx.repoRoot);
    if (!existsSync(hp)) return lines;
    const prev = readFileSync(hp, 'utf8');
    writeFileSync(hp, stripCodexHooksRaw(prev), 'utf8');
    lines.push(`Removed aicode-ratio PostToolUse hook entries from ${hp}`);
    return lines;
  },
};
