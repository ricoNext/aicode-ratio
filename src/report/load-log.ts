import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import micromatch from 'micromatch';

export interface LogEntry {
  v: number;
  ts: string;
  source: 'agent' | 'tab';
  event: string;
  repoRoot: string;
  path: string;
}

export interface LogIndex {
  agentByPath: Map<string, number[]>;
  tabByPath: Map<string, number[]>;
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

function pushSorted(map: Map<string, number[]>, path: string, ms: number): void {
  const arr = map.get(path) ?? [];
  arr.push(ms);
  map.set(path, arr);
}

async function readJsonlFile(
  filePath: string,
  fromMs: number,
  toMs: number,
  sources: { agent: boolean; tab: boolean },
  ignorePrefixes: string[],
  ignoreGlobs: string[],
  agentByPath: Map<string, number[]>,
  tabByPath: Map<string, number[]>,
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
    if (source === 'agent') pushSorted(agentByPath, path, ms);
    else pushSorted(tabByPath, path, ms);
  }
}

function sortUniqueArrays(map: Map<string, number[]>): void {
  for (const [k, arr] of map) {
    arr.sort((a, b) => a - b);
    const dedup: number[] = [];
    for (const n of arr) {
      if (dedup.length === 0 || dedup[dedup.length - 1] !== n) dedup.push(n);
    }
    map.set(k, dedup);
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

export async function loadLog(opts: {
  logPath: string;
  repoRoot: string;
  fromMs: number;
  toMs: number;
  sources: { agent: boolean; tab: boolean };
  ignoreLogPathPrefixes: string[];
  ignoreLogGlobs: string[];
}): Promise<LogIndex> {
  const { logPath, repoRoot, fromMs, toMs, sources, ignoreLogPathPrefixes, ignoreLogGlobs } = opts;
  const absLog = resolve(repoRoot, logPath);
  const agentByPath = new Map<string, number[]>();
  const tabByPath = new Map<string, number[]>();

  for (const seg of logSegmentPaths(absLog)) {
    await readJsonlFile(seg, fromMs, toMs, sources, ignoreLogPathPrefixes, ignoreLogGlobs, agentByPath, tabByPath);
  }

  sortUniqueArrays(agentByPath);
  sortUniqueArrays(tabByPath);

  return { agentByPath, tabByPath };
}
