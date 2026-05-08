/**
 * aicode-ratio-append-log.mjs
 * Version: 0.7.2 (aicode-ratio)
 *
 * argv[2] mode:
 *   - Cursor: "agent" | "tab"
 *   - CodeBuddy: "codebuddy" (legacy: "codebuddyIDE") — PostToolUse Write|Edit.
 *   - Claude Code: "claude-code" — same hook JSON shape / stdout contract.
 *   - Qoder: "qoder" — PostToolUse Write|Edit（相对路径 `.qoder/hooks/`，见 Qoder 文档）。
 *
 * Copied into `.cursor/hooks/`, `.codebuddy/hooks/`, `.claude/hooks/`, and `.qoder/hooks/` by `aicode-ratio init`.
 */

import { execFileSync, execSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve as resolvePath, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEGACY_HOOK_ARG_CODEBUDDY_IDE = 'codebuddyIDE';

const DEFAULT_IGNORE_PREFIXES = ['node_modules/', 'dist/', '.git/'];
const DEFAULT_LOG_REL = '.aicode-ratio/log.jsonl';

const MODE = process.argv[2] ?? 'agent';

function isCodeBuddyMode(m) {
  return m === 'codebuddy' || m === LEGACY_HOOK_ARG_CODEBUDDY_IDE;
}

function isClaudeCodeMode(m) {
  return m === 'claude-code';
}

function isQoderMode(m) {
  return m === 'qoder';
}

function isPostToolUseCompatMode(m) {
  return isCodeBuddyMode(m) || isClaudeCodeMode(m) || isQoderMode(m);
}

function firstTruthyEnv(names) {
  for (const n of names) {
    const x = process.env[n];
    if (typeof x === 'string' && x.trim().length > 0) return x.trim();
  }
  return undefined;
}

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
    teamMode: false,
  };
  const paths = [join(repoRoot, '.aicode-ratio.json'), join(repoRoot, '.cursor-attribution.json')];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const j = JSON.parse(readFileSync(p, 'utf8'));
      if (typeof j.logPath === 'string' && j.logPath.length) out.logPath = j.logPath;
      if (Array.isArray(j.ignoreLogPathPrefixes)) out.ignoreLogPathPrefixes = j.ignoreLogPathPrefixes;
      if (typeof j.teamMode === 'boolean') out.teamMode = j.teamMode;
      break;
    } catch {
      // try next
    }
  }
  return out;
}

/** Keep in sync with `src/util/user-log-slug.ts`. */
function userLogFilenameSlug(gu) {
  const email = gu && typeof gu.email === 'string' ? gu.email.trim() : '';
  const name = gu && typeof gu.name === 'string' ? gu.name.trim() : '';
  const raw = email || name || '';
  if (!raw) return '_unknown';
  const slug = raw
    .replace(/[^a-zA-Z0-9._@-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const safe = slug.length ? slug : '_unknown';
  return safe.length > 120 ? safe.slice(0, 120) : safe;
}

function resolveLogAbsPath(repoRootAbs, cfg) {
  if (!cfg.teamMode) {
    return join(repoRootAbs, cfg.logPath);
  }
  const gu = gitLocalUser(repoRootAbs);
  const slug = userLogFilenameSlug(gu);
  const dir = join(repoRootAbs, '.aicode-ratio', 'logs');
  mkdirSync(dir, { recursive: true });
  return join(dir, `${slug}.jsonl`);
}

function gitTopLevel(cwd) {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Local `git config user.*` for this repo (who ran the editor / hook).
 * Cached per `repoRoot` for the lifetime of this Node process (typical hook = one process;
 * still avoids duplicate reads if one invocation ever asks twice).
 */
const gitLocalUserByRepoRoot = new Map();

function gitLocalUser(repoRoot) {
  if (gitLocalUserByRepoRoot.has(repoRoot)) {
    return gitLocalUserByRepoRoot.get(repoRoot);
  }
  let name;
  let email;
  try {
    name = execFileSync('git', ['-C', repoRoot, 'config', '--get', 'user.name'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    // unset
  }
  try {
    email = execFileSync('git', ['-C', repoRoot, 'config', '--get', 'user.email'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    // unset
  }
  const out = {};
  if (name) out.name = name;
  if (email) out.email = email;
  const resolved = Object.keys(out).length ? out : undefined;
  gitLocalUserByRepoRoot.set(repoRoot, resolved);
  return resolved;
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

/** PostToolUse（Claude Code / CodeBuddy / Qoder 兼容）：stdout 仅 JSON，不阻断。 */
function stdoutPostToolUseOk() {
  process.stdout.write(
    JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
      },
    }),
  );
}

function appendPathFieldDebug(repoRoot, debugBasename, editor, obj) {
  try {
    const p = join(repoRoot, '.aicode-ratio', debugBasename);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(
      p,
      `${JSON.stringify({ ts: new Date().toISOString(), editor, ...obj })}\n`,
      'utf8',
    );
  } catch {
    // ignore
  }
}

function pickToolInputPath(ti) {
  if (typeof ti.file_path === 'string' && ti.file_path.trim().length > 0)
    return { raw: ti.file_path.trim(), field: 'file_path' };
  if (typeof ti.filePath === 'string' && ti.filePath.trim().length > 0)
    return { raw: ti.filePath.trim(), field: 'filePath' };
  return { raw: null, field: 'none' };
}

/** Claude / CodeBuddy 用 Write|Edit；Qoder 还提供原生工具名映射（文档工具名映射表） */
function isWriteOrEditPostToolUse(toolName) {
  return (
    toolName === 'Write' ||
    toolName === 'Edit' ||
    toolName === 'create_file' ||
    toolName === 'search_replace'
  );
}

/** @param {{ projectDirEnvOrder: string[]; editor: string; logTag: string; debugLogFile: string }} v */
async function runPostToolUseAppendLog(raw, v) {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch (e) {
    const cw = gitTopLevel(process.cwd()) ?? process.cwd();
    appendErrorLine(
      cw,
      `PostToolUse hook json parse (${v.logTag}): ${e instanceof Error ? e.message : String(e)}`,
    );
    stdoutPostToolUseOk();
    return;
  }

  const envRoot = firstTruthyEnv(v.projectDirEnvOrder);

  const cwdFromPayload =
    typeof payload.cwd === 'string' && payload.cwd.trim().length > 0 ? payload.cwd.trim() : null;
  const baseForResolve = cwdFromPayload ?? envRoot ?? process.cwd();

  const repoRoot = gitTopLevel(baseForResolve) ?? (envRoot && gitTopLevel(envRoot)) ?? envRoot ?? baseForResolve;

  const tn = payload.tool_name;
  if (!isWriteOrEditPostToolUse(tn)) {
    stdoutPostToolUseOk();
    return;
  }

  const ti = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
  const { raw: rawPath, field } = pickToolInputPath(ti);

  const dbgMsg = `[aicode-ratio][${v.logTag}] pathField=${field} tool_name=${tn}`;
  console.error(dbgMsg);
  appendPathFieldDebug(repoRoot, v.debugLogFile, v.editor, {
    pathField: field,
    tool_name: tn,
    cwd: cwdFromPayload,
    hookArgv: MODE,
    rawPathSnippet:
      typeof rawPath === 'string' ? rawPath.slice(0, 400) + (rawPath.length > 400 ? '…' : '') : null,
  });

  if (!rawPath) {
    stdoutPostToolUseOk();
    return;
  }

  const absPath = resolvePath(baseForResolve, rawPath);
  const gr = gitTopLevel(absPath) ?? gitTopLevel(dirname(absPath)) ?? repoRoot;
  const rr = typeof gr === 'string' ? gr : repoRoot;

  const cfg = loadConfig(rr);
  const rel = relative(rr, absPath).split(sep).join('/');
  if (!rel || rel.startsWith('..')) {
    stdoutPostToolUseOk();
    return;
  }

  if (shouldIgnore(rel, cfg.ignoreLogPathPrefixes)) {
    stdoutPostToolUseOk();
    return;
  }

  const logAbs = resolveLogAbsPath(rr, cfg);
  mkdirSync(dirname(logAbs), { recursive: true });

  let payloadHash;
  try {
    payloadHash = createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);
  } catch {}

  const gitUser = gitLocalUser(rr);
  const line = {
    v: 1,
    ts: new Date().toISOString(),
    source: 'agent',
    event: 'PostToolUse',
    editor: v.editor,
    pathField: field,
    tool_name: tn,
    repoRoot: rr,
    path: rel,
    ...(gitUser ? { gitUser } : {}),
    ...(payloadHash ? { payloadHash } : {}),
  };

  appendFileSync(logAbs, `${JSON.stringify(line)}\n`, 'utf8');
  stdoutPostToolUseOk();
}

async function runCursorHook(raw, sourceArg) {
  const event = sourceArg === 'tab' ? 'afterTabFileEdit' : 'afterFileEdit';

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

  const logAbs = resolveLogAbsPath(repoRoot, cfg);
  mkdirSync(dirname(logAbs), { recursive: true });

  const tool = typeof payload.tool === 'string' ? payload.tool : undefined;
  let payloadHash;
  try {
    payloadHash = createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 16);
  } catch {}

  const gitUser = gitLocalUser(repoRoot);
  const line = {
    v: 1,
    ts: new Date().toISOString(),
    source: sourceArg,
    event,
    repoRoot,
    path: rel,
    ...(gitUser ? { gitUser } : {}),
    ...(tool ? { tool } : {}),
    ...(payloadHash ? { payloadHash } : {}),
  };

  appendFileSync(logAbs, `${JSON.stringify(line)}\n`, 'utf8');
  process.stdout.write('{}');
}

async function main() {
  const raw = await readStdinUtf8();

  if (isClaudeCodeMode(MODE)) {
    await runPostToolUseAppendLog(raw, {
      projectDirEnvOrder: ['CLAUDE_PROJECT_DIR', 'CODEBUDDY_PROJECT_DIR', 'QODER_PROJECT_DIR'],
      editor: 'claude-code',
      logTag: 'claude-code',
      debugLogFile: 'claude-code-path-field.log',
    });
    return;
  }

  if (isQoderMode(MODE)) {
    await runPostToolUseAppendLog(raw, {
      projectDirEnvOrder: ['QODER_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'CODEBUDDY_PROJECT_DIR'],
      editor: 'qoder',
      logTag: 'qoder',
      debugLogFile: 'qoder-path-field.log',
    });
    return;
  }

  if (isCodeBuddyMode(MODE)) {
    await runPostToolUseAppendLog(raw, {
      projectDirEnvOrder: ['CODEBUDDY_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'QODER_PROJECT_DIR'],
      editor: 'codebuddy',
      logTag: 'codebuddy',
      debugLogFile: 'codebuddy-path-field.log',
    });
    return;
  }

  const sourceArg = MODE === 'tab' ? 'tab' : 'agent';
  await runCursorHook(raw, sourceArg);
}

main().catch((e) => {
  try {
    const root = gitTopLevel(process.cwd()) ?? process.cwd();
    appendErrorLine(root, e instanceof Error ? e.message : String(e));
  } catch {}
  if (isPostToolUseCompatMode(MODE)) stdoutPostToolUseOk();
  else process.stdout.write('{}');
});
