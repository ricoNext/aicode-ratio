import { Argument, Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  getEditorAdapter,
  listEditorAdapters,
  normalizeLegacyEditorId,
  registeredEditorIds,
} from '../editors/registry.js';
import {
  parseInitEditorIdsFromCommander,
  resolveInitEditorsAfterCommander,
} from './resolve-init-editors.js';
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
  const adapters = listEditorAdapters();
  const flagHints = adapters.map((a) => `  --${a.id}              Install hooks for ${a.label}`).join('\n');
  return [
    '',
    'Commander options (non-interactive):',
    flagHints,
    '  acr init --editors cursor         # comma-separated list',
    '  acr init cursor                   # positional [editors...]',
    '  acr init -y                       # Cursor only, no Inquirer (CI/scripts)',
    '',
    'Interactive: in a TTY, `acr init` with none of the above runs @inquirer/prompts to pick editors.',
    `  Known ids: ${registeredEditorIds().join(', ')}`,
  ].join('\n');
}

/** Read `--<id>` booleans from parsed opts (dynamic per registered adapter). */
function selectedEditorIdsFromOpts(opts: Record<string, unknown>): string[] {
  const ids = registeredEditorIds().filter((id) => opts[id] === true);
  if (opts.codebuddyIDE === true) ids.push('codebuddy');
  return [...new Set(ids.map(normalizeLegacyEditorId))];
}

export function registerInit(program: Command): void {
  const initCmd = new Command('init')
    .description(
      'Install editor adapters (hooks, scripts) for AI edit logging and configure .gitignore',
    )
    .addHelpText('after', editorsSelectionHelp())
    .addArgument(
      new Argument(
        '[editors...]',
        'space-separated ids, or omit in a TTY to pick editors via @inquirer/prompts',
      ),
    )
    .option('--repo <path>', 'Repository root (default: current directory)', '.')
    .option(
      '--editors <list>',
      'comma-separated editor ids (overrides --<id> flags and positional args)',
    )
    .option(
      '-y, --yes',
      'skip Inquirer and install Cursor only (use when stdin is not a TTY or in scripts)',
    );

  for (const a of listEditorAdapters()) {
    initCmd.option(`--${a.id}`, `Install hooks for ${a.label}`);
  }

  initCmd.option('--codebuddyIDE', 'Deprecated; same as --codebuddy.');

  initCmd.action(
    async (
      positionalEditors: string[],
      options: { repo: string; editors?: string; yes?: boolean },
      command: Command,
    ) => {
      const repoRoot = resolve(options.repo);
      ensureGitRepo(repoRoot);
      const root = getRepoRoot(repoRoot);

      const opts = command.opts() as Record<string, unknown>;
      const selectedFromFlags = selectedEditorIdsFromOpts(opts);

      const cliResolved = parseInitEditorIdsFromCommander({
        editors: options.editors,
        yes: options.yes,
        positionalEditors: positionalEditors,
        selectedFromFlags,
      });

      let editorIds: string[];
      try {
        const resolved = await resolveInitEditorsAfterCommander(cliResolved);
        if (!resolved.ok) {
          command.error(
            [
              'error: missing editor selection (stdin is not a TTY — cannot open @inquirer/prompts).',
              editorsSelectionHelp(),
            ].join('\n'),
          );
          return;
        }
        editorIds = resolved.ids;
      } catch (e) {
        if (e instanceof Error && e.name === 'ExitPromptError') {
          process.exitCode = 130;
          return;
        }
        throw e;
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
      console.log(`     (CodeBuddy: ${join(root, '.codebuddy', 'settings.json')})`);
      console.log(`     (Claude Code: ${join(root, '.claude', 'settings.json')})`);
      console.log(`     (Qoder: ${join(root, '.qoder', 'settings.json')})`);
      console.log('  2. Run: pnpm dlx aicode-ratio doctor');
      console.log(
        `  3. Trigger an agent edit and check the log path in ${CONFIG_FILENAME} (default: .aicode-ratio/log.jsonl)`,
      );
    },
  );

  program.addCommand(initCmd);
}
