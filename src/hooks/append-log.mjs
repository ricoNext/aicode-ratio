/**
 * aicode-ratio-append-log.mjs
 * Version: 0.1.0 (aicode-ratio)
 *
 * Editor hook script (e.g. Cursor `afterFileEdit` / `afterTabFileEdit`).
 * argv[2]: "agent" | "tab"
 *
 * Copied to `.cursor/hooks/aicode-ratio-append-log.mjs` by `aicode-ratio init`.
 */

import { execSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceArg = process.argv[2] === 'tab' ? 'tab' : 'agent';
const event = sourceArg === 'tab' ? 'afterTabFileEdit' : 'afterFileEdit';

const DEFAULT_IGNORE_PREFIXES = ['node_modules/', 'dist/', '.git/'];
const DEFAULT_LOG_REL = '.aicode-ratio/log.jsonl';

function readStdinUtf8() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

function loadConfig(repoRoot) {
  const out = {
    logPath: DEFAULT_LOG_REL,
    ignoreLogPathPrefixes: DEFAULT_IGNORE_PREFIXES,
  };
  const paths = [
    join(repoRoot, '.aicode-ratio.json'),
    join(repoRoot, '.agent-code-attribution.json'),
    join(repoRoot, '.cursor-attribution.json'),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const j = JSON.parse(readFileSync(p, 'utf8'));
      if (typeof j.logPath === 'string' && j.logPath.length) out.logPath = j.logPath;
      if (Array.isArray(j.ignoreLogPathPrefixes)) out.ignoreLogPathPrefixes = j.ignoreLogPathPrefixes;
      break;
    } catch {
      // try next
    }
  }
  return out;
}

function gitTopLevel(cwd) {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function pickPath(payload) {
  const direct = [
    payload.file,
    payload.path,
    payload.filePath,
    payload.absolutePath,
    payload.absolute_path,
    payload.file_path,
  ].find((x) => typeof x === 'string' && x.length);
  if (direct) return direct;
  const uri = payload.uri ?? payload.fileUri ?? payload.fileURL;
  if (typeof uri === 'string' && uri.startsWith('file://')) {
    try {
      return fileURLToPath(uri);
    } catch {
      return null;
    }
  }
  const edits = payload.edits;
  if (Array.isArray(edits) && edits.length) {
    const e0 = edits[0];
    if (e0 && typeof e0 === 'object') {
      const inner = pickPath(e0);
      if (inner) return inner;
    }
  }
  return null;
}

function shouldIgnore(relPosix, prefixes) {
  for (const p of prefixes) {
    if (typeof p !== 'string' || !p.length) continue;
    if (relPosix === p.replace(/\/$/, '') || relPosix.startsWith(p)) return true;
  }
  return false;
}

function appendErrorLine(repoRoot, message) {
  try {
    const errLog = join(repoRoot, '.aicode-ratio', 'hook-errors.log');
    mkdirSync(dirname(errLog), { recursive: true });
    appendFileSync(errLog, `${JSON.stringify({ ts: new Date().toISOString(), message })}\n`, 'utf8');
  } catch {
    // ignore
  }
}

async function main() {
  const raw = await readStdinUtf8();
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch (e) {
    const cwdRoot = gitTopLevel(process.cwd()) ?? process.cwd();
    appendErrorLine(cwdRoot, `json parse: ${e instanceof Error ? e.message : String(e)}`);
    process.stdout.write('{}');
    return;
  }

  const absPath = pickPath(payload);
  if (!absPath || typeof absPath !== 'string') {
    process.stdout.write('{}');
    return;
  }

  const repoRoot = gitTopLevel(process.cwd());
  if (!repoRoot) {
    process.stdout.write('{}');
    return;
  }

  const cfg = loadConfig(repoRoot);
  const rel = relative(repoRoot, absPath).split(sep).join('/');
  if (!rel || rel.startsWith('..')) {
    process.stdout.write('{}');
    return;
  }

  if (shouldIgnore(rel, cfg.ignoreLogPathPrefixes)) {
    process.stdout.write('{}');
    return;
  }

  const logAbs = join(repoRoot, cfg.logPath);
  mkdirSync(dirname(logAbs), { recursive: true });

  const tool = typeof payload.tool === 'string' ? payload.tool : undefined;
  let payloadHash;
  try {
    payloadHash = createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);
  } catch {
    // optional
  }

  const line = {
    v: 1,
    ts: new Date().toISOString(),
    source: sourceArg,
    event,
    repoRoot,
    path: rel,
    ...(tool ? { tool } : {}),
    ...(payloadHash ? { payloadHash } : {}),
  };

  appendFileSync(logAbs, `${JSON.stringify(line)}\n`, 'utf8');
  process.stdout.write('{}');
}

main().catch((e) => {
  try {
    const root = gitTopLevel(process.cwd()) ?? process.cwd();
    appendErrorLine(root, e instanceof Error ? e.message : String(e));
  } catch {
    // ignore
  }
  process.stdout.write('{}');
});
