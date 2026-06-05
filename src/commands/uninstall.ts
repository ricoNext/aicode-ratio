import type { Command } from 'commander';
import { existsSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { getRepoRoot } from '../util/paths.js';
import { CONFIG_FILENAME, GITIGNORE_LINES, HOOK_SCRIPT_NAME } from '../constants.js';
import {
  getEditorAdapter,
  listEditorAdapters,
  resolveEditorIdsForInit,
} from '../editors/registry.js';
import { removeAicodeRatioBlocksFromGitignore } from '../util/remove-gitignore-aicode-ratio.js';

/** Hook script basenames from older package names. */
const LEGACY_HOOK_SCRIPTS = [
  'agent-code-attribution-append-log.mjs',
  'cursor-attribution-append-log.mjs',
] as const;

function collectAllGitignoreLines(): Set<string> {
  const ig = new Set<string>(GITIGNORE_LINES);
  for (const a of listEditorAdapters()) {
    for (const line of a.gitignoreLines) ig.add(line);
  }
  return ig;
}

function ensureGitRepo(repo: string): void {
  try {
    execSync('git rev-parse --show-toplevel', { cwd: repo, stdio: 'pipe' });
  } catch {
    throw new Error(`Not a git repository: ${repo}`);
  }
}

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  const answer: string = await new Promise((res) => rl.question(message, res));
  rl.close();
  const a = answer.trim().toLowerCase();
  return a === 'y' || a === 'yes';
}

export function registerUninstall(program: Command): void {
  program
    .command('uninstall')
    .description(
      'Remove artifacts created by init (hooks.json entries, hook scripts, .gitignore block, repo config)',
    )
    .option('--repo <path>', 'Repository root (default: current directory)', '.')
    .option(
      '--editors <list>',
      'Comma-separated editor ids (default: all built-in editors)',
    )
    .option('-y, --yes', 'Skip confirmation and non-interactive file operations')
    .option('--keep-config', `Do not delete ${CONFIG_FILENAME} in the repo root`)
    .option('--keep-gitignore', 'Do not remove the # aicode-ratio block from .gitignore')
    .option(
      '--keep-hook-script',
      'Do not delete hook scripts under editor hook directories (for selected editors)',
    )
    .action(
      async (options: {
        repo: string;
        editors?: string;
        yes?: boolean;
        keepConfig?: boolean;
        keepGitignore?: boolean;
        keepHookScript?: boolean;
      }) => {
        const repoRoot = resolve(options.repo);
        ensureGitRepo(repoRoot);
        const root = getRepoRoot(repoRoot);

        const editorIds = options.editors
          ? resolveEditorIdsForInit(options.editors)
          : listEditorAdapters().map((a) => a.id);

        const summary = `aicode-ratio artifacts under ${root} (editors: ${editorIds.join(', ')})`;
        if (!options.yes) {
          if (!input.isTTY) {
            throw new Error(
              'stdin is not a TTY; pass --yes to confirm uninstall without a prompt.',
            );
          }
          const ok = await confirm(`Remove ${summary}? [y/N] `);
          if (!ok) {
            console.log('Aborted.');
            return;
          }
        }

        const logLines: string[] = [];
        let didSomething = false;

        for (const id of [...new Set(editorIds)]) {
          const adapter = getEditorAdapter(id);
          if (!adapter) {
            console.warn(`[warn] Unknown editor "${id}" — skipped`);
            continue;
          }
          const lines = adapter.uninstall({ repoRoot: root });
          if (lines.length > 0) didSomething = true;
          logLines.push(...lines);
        }

        const editorIdsSet = new Set(editorIds);

        if (!options.keepHookScript) {
          if (editorIdsSet.has('cursor')) {
            const hooksDir = join(root, '.cursor', 'hooks');
            const hookPaths = [
              join(hooksDir, HOOK_SCRIPT_NAME),
              ...LEGACY_HOOK_SCRIPTS.map((n) => join(hooksDir, n)),
            ];
            for (const p of hookPaths) {
              if (!existsSync(p)) continue;
              unlinkSync(p);
              console.log(`Deleted ${p}`);
              didSomething = true;
            }
          }
          if (editorIdsSet.has('codebuddy')) {
            const codebuddyHook = join(root, '.codebuddy', 'hooks', HOOK_SCRIPT_NAME);
            if (existsSync(codebuddyHook)) {
              unlinkSync(codebuddyHook);
              console.log(`Deleted ${codebuddyHook}`);
              didSomething = true;
            }
          }
          if (editorIdsSet.has('claude-code')) {
            const claudeHook = join(root, '.claude', 'hooks', HOOK_SCRIPT_NAME);
            if (existsSync(claudeHook)) {
              unlinkSync(claudeHook);
              console.log(`Deleted ${claudeHook}`);
              didSomething = true;
            }
          }
          if (editorIdsSet.has('qoder')) {
            const qoderHook = join(root, '.qoder', 'hooks', HOOK_SCRIPT_NAME);
            if (existsSync(qoderHook)) {
              unlinkSync(qoderHook);
              console.log(`Deleted ${qoderHook}`);
              didSomething = true;
            }
          }
          if (editorIdsSet.has('codex')) {
            const codexHook = join(root, '.codex', 'hooks', HOOK_SCRIPT_NAME);
            if (existsSync(codexHook)) {
              unlinkSync(codexHook);
              console.log(`Deleted ${codexHook}`);
              didSomething = true;
            }
          }
        }

        if (!options.keepGitignore) {
          const { changed } = removeAicodeRatioBlocksFromGitignore(root, collectAllGitignoreLines());
          if (changed) {
            console.log('Removed aicode-ratio entries from .gitignore');
            didSomething = true;
          }
        }

        const cfgPath = join(root, CONFIG_FILENAME);
        if (!options.keepConfig && existsSync(cfgPath)) {
          unlinkSync(cfgPath);
          console.log(`Deleted ${cfgPath}`);
          didSomething = true;
        }

        for (const line of logLines) console.log(line);

        if (!didSomething) {
          console.log('Nothing to uninstall (no init artifacts found).');
        } else {
          console.log('Uninstall complete.');
        }
      },
    );
}
