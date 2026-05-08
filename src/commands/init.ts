import { Argument, Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { getEditorAdapter, registeredEditorIds } from '../editors/registry.js';
import { parseInitEditorIdsFromCommander } from './resolve-init-editors.js';
import { appendGitignoreLines } from '../util/append-gitignore.js';
import { getRepoRoot } from '../util/paths.js';
import { ConfigSchema } from '../config/schema.js';
import { DEFAULTS } from '../config/defaults.js';
import { CONFIG_FILENAME, LEGACY_CONFIG_FILENAMES } from '../constants.js';

function ensureGitRepo(repo: string): void {
  try {
    execSync('git rev-parse --show-toplevel', { cwd: repo, stdio: 'pipe' });
  } catch {
    throw new Error(`Not a git repository: ${repo}`);
  }
}

function hasAnyConfig(root: string): boolean {
  if (existsSync(join(root, CONFIG_FILENAME))) return true;
  return LEGACY_CONFIG_FILENAMES.some((f) => existsSync(join(root, f)));
}

function writePrimaryConfig(root: string, editorIds: string[]): void {
  const parsed = ConfigSchema.parse({ ...DEFAULTS, enabledEditors: editorIds });
  writeFileSync(join(root, CONFIG_FILENAME), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

function mergeEnabledEditorsIntoPrimaryConfig(root: string, editorIds: string[]): void {
  const cfgPath = join(root, CONFIG_FILENAME);
  if (!existsSync(cfgPath)) return;
  const raw = readFileSync(cfgPath, 'utf8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  const merged = ConfigSchema.parse({ ...DEFAULTS, ...data, enabledEditors: editorIds });
  writeFileSync(cfgPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

function editorsSelectionHelp(): string {
  const known = registeredEditorIds().join(', ');
  return [
    '',
    'You must choose which editors to install (Commander CLI only — no interactive prompts):',
    '  acr init cursor                    # positional [editors...]',
    '  acr init --editors cursor         # comma-separated list',
    '  acr init -y                       # shortcut: Cursor only (CI/scripts)',
    `  Known ids: ${known}`,
  ].join('\n');
}

export function registerInit(program: Command): void {
  program.addCommand(
    new Command('init')
      .description(
        'Install editor adapters (hooks, scripts) for AI edit logging and configure .gitignore',
      )
      .addHelpText('after', editorsSelectionHelp())
      .addArgument(
        new Argument(
          '[editors...]',
          'space-separated editor ids (--editors overrides; omit only with -y — see examples below)',
        ),
      )
      .option('--repo <path>', 'Repository root (default: current directory)', '.')
      .option(
        '--editors <list>',
        'comma-separated editor ids (overrides positional [editors...])',
      )
      .option(
        '-y, --yes',
        'install Cursor hooks only without passing [editors...] / --editors (for CI/scripts)',
      )
      .action(
        (
          positionalEditors: string[],
          options: { repo: string; editors?: string; yes?: boolean },
          command: Command,
        ) => {
          const repoRoot = resolve(options.repo);
          ensureGitRepo(repoRoot);
          const root = getRepoRoot(repoRoot);

          const editorIds = parseInitEditorIdsFromCommander({
            editors: options.editors,
            yes: options.yes,
            positionalEditors: positionalEditors,
          });
          if (editorIds === null) {
            command.error(['error: missing editor selection.', editorsSelectionHelp()].join('\n'));
          }

          const bundledHooksDir = join(dirname(fileURLToPath(import.meta.url)), 'hooks');

          for (const id of editorIds) {
            const adapter = getEditorAdapter(id);
            if (!adapter) continue;
            adapter.install({ repoRoot: root, bundledHooksDir });
          }

          const ig = new Set<string>();
          for (const id of editorIds) {
            const adapter = getEditorAdapter(id);
            if (!adapter) continue;
            for (const line of adapter.gitignoreLines) ig.add(line);
          }
          appendGitignoreLines(root, [...ig]);

          if (!hasAnyConfig(root)) {
            writePrimaryConfig(root, editorIds);
          } else {
            mergeEnabledEditorsIntoPrimaryConfig(root, editorIds);
          }

          console.log(`Initialized aicode-ratio in ${root}`);
          console.log('');
          console.log(`Editors: ${editorIds.join(', ')}`);
          console.log('');
          console.log('Next steps:');
          console.log("  1. Confirm each editor's hooks point at the bundled append-log script.");
          console.log(`     (Cursor: ${join(root, '.cursor', 'hooks.json')})`);
          console.log('  2. Run: pnpm dlx aicode-ratio doctor');
          console.log(
            `  3. Trigger an agent edit and check the log path in ${CONFIG_FILENAME} (default: .aicode-ratio/log.jsonl)`,
          );
        },
      ),
  );
}
