import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { ConfigSchema, type Config } from './schema.js';
import { DEFAULTS } from './defaults.js';
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAMES } from '../constants.js';

function readJsonFile(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Resolve config: first existing path wins, then merge over defaults.
 *
 * Priority: `AICODE_RATIO_CONFIG` → `AGENT_CODE_ATTRIBUTION_CONFIG` → `CURSOR_ATTRIBUTION_CONFIG` →
 * repo `.aicode-ratio.json` → repo legacy files → home `.aicode-ratio.json` → home legacy files.
 */
export function loadResolvedConfig(repoRoot: string): Config {
  const root = resolve(repoRoot);
  const aicodeEnv = process.env.AICODE_RATIO_CONFIG?.trim();
  const agentEnv = process.env.AGENT_CODE_ATTRIBUTION_CONFIG?.trim();
  const cursorEnv = process.env.CURSOR_ATTRIBUTION_CONFIG?.trim();

  const candidates: Array<string | null> = [];

  const envPaths = [aicodeEnv, agentEnv, cursorEnv];
  for (const e of envPaths) {
    if (!e) continue;
    const abs = resolve(e);
    if (existsSync(abs)) {
      candidates.push(abs);
      break;
    }
  }

  if (candidates.length === 0) {
    const repoFiles = [CONFIG_FILENAME, ...LEGACY_CONFIG_FILENAMES];
    for (const f of repoFiles) {
      const p = join(root, f);
      if (existsSync(p)) {
        candidates.push(p);
        break;
      }
    }
  }

  if (candidates.length === 0) {
    const repoFiles = [CONFIG_FILENAME, ...LEGACY_CONFIG_FILENAMES];
    for (const f of repoFiles) {
      const p = join(homedir(), f);
      if (existsSync(p)) {
        candidates.push(p);
        break;
      }
    }
  }

  const filePath = candidates[0] ?? null;

  const base: Record<string, unknown> = { ...DEFAULTS };
  if (!filePath) return ConfigSchema.parse(base);

  try {
    const data = readJsonFile(filePath);
    return ConfigSchema.parse({ ...base, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid or unreadable config ${filePath}: ${msg}`);
  }
}
