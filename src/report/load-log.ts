import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import micromatch from 'micromatch';
import { logGitUserKeyFromRow } from './log-git-user.js';
import { TEAM_LOG_DIR_REL } from '../util/user-log-slug.js';

/** One log hit for intersection (timestamp + local git identity from hook time). */
export interface LogEvent {
  tsMs: number;
  gitUserKey: string;
}

export interface LogIndex {
  agentByPath: Map<string, LogEvent[]>;
  tabByPath: Map<string, LogEvent[]>;
}

function shouldIgnorePath(
  relPath: string,
  ignorePrefixes: string[],
  ignoreGlobs: string[],
): boolean {
  for (const p of ignorePrefixes) {
    if (p && (relPath === p.slice(0, -1) || relPath.startsWith(p))) return true;
  }
  if (ignoreGlobs.length && micromatch.isMatch(relPath, ignoreGlobs)) return true;
  return false;
}

function pushEvent(
  map: Map<string, LogEvent[]>,
  path: string,
  tsMs: number,
  gitUserKey: string,
): void {
  const arr = map.get(path) ?? [];
  arr.push({ tsMs, gitUserKey });
  map.set(path, arr);
}

function sortDedupeEvents(map: Map<string, LogEvent[]>): void {
  for (const [k, arr] of map) {
    arr.sort((a, b) => (a.tsMs !== b.tsMs ? a.tsMs - b.tsMs : a.gitUserKey.localeCompare(b.gitUserKey)));
    const dedup: LogEvent[] = [];
    for (const ev of arr) {
      const prev = dedup[dedup.length - 1];
      if (!prev || prev.tsMs !== ev.tsMs || prev.gitUserKey !== ev.gitUserKey) dedup.push(ev);
    }
    map.set(k, dedup);
  }
}

async function readJsonlFile(
  filePath: string,
  fromMs: number,
  toMs: number,
  sources: { agent: boolean; tab: boolean },
  ignorePrefixes: string[],
  ignoreGlobs: string[],
  agentByPath: Map<string, LogEvent[]>,
  tabByPath: Map<string, LogEvent[]>,
): Promise<void> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: unknown;
    try {
      row = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (typeof row !== 'object' || row === null) continue;
    const o = row as Record<string, unknown>;
    if (o.v !== 1) continue;
    const ts = o.ts;
    const source = o.source;
    const path = o.path;
    if (typeof ts !== 'string' || (source !== 'agent' && source !== 'tab') || typeof path !== 'string') continue;
    if (source === 'agent' && !sources.agent) continue;
    if (source === 'tab' && !sources.tab) continue;
    if (shouldIgnorePath(path, ignorePrefixes, ignoreGlobs)) continue;
    const ms = Date.parse(ts);
    if (!Number.isFinite(ms) || ms < fromMs || ms > toMs) continue;
    const userKey = logGitUserKeyFromRow(o);
    if (source === 'agent') pushEvent(agentByPath, path, ms, userKey);
    else pushEvent(tabByPath, path, ms, userKey);
  }
}

/**
 * Discover rotated segments: `logPath` and `logPath.*` in the same directory.
 */
function logSegmentPaths(logPathAbs: string): string[] {
  const out: string[] = [];
  if (existsSync(logPathAbs)) out.push(logPathAbs);
  const dir = dirname(logPathAbs);
  const base = logPathAbs.slice(dir.length + 1);
  if (!existsSync(dir)) return out;
  const suffixPattern = `${base}.`;
  try {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(suffixPattern)) out.push(join(dir, name));
    }
  } catch {
    // ignore
  }
  return out;
}

/** All `*.jsonl` directly under the team log directory (one file per machine user). */
function teamModeLogJsonlPaths(repoRoot: string): string[] {
  const dir = resolve(repoRoot, TEAM_LOG_DIR_REL);
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.jsonl') || name.includes('/') || name.includes('\\')) continue;
      out.push(join(dir, name));
    }
  } catch {
    // ignore
  }
  out.sort();
  return out;
}

export async function loadLog(opts: {
  logPath: string;
  repoRoot: string;
  teamMode: boolean;
  fromMs: number;
  toMs: number;
  sources: { agent: boolean; tab: boolean };
  ignoreLogPathPrefixes: string[];
  ignoreLogGlobs: string[];
}): Promise<LogIndex> {
  const { logPath, repoRoot, teamMode, fromMs, toMs, sources, ignoreLogPathPrefixes, ignoreLogGlobs } = opts;
  const segments = teamMode ? teamModeLogJsonlPaths(repoRoot) : logSegmentPaths(resolve(repoRoot, logPath));
  const agentByPath = new Map<string, LogEvent[]>();
  const tabByPath = new Map<string, LogEvent[]>();

  for (const seg of segments) {
    await readJsonlFile(seg, fromMs, toMs, sources, ignoreLogPathPrefixes, ignoreLogGlobs, agentByPath, tabByPath);
  }

  sortDedupeEvents(agentByPath);
  sortDedupeEvents(tabByPath);

  return { agentByPath, tabByPath };
}
