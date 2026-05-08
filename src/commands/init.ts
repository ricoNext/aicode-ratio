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
import { CONFIG_FILENAME, GITIGNORE_LINES_PERSONAL, LEGACY_CONFIG_FILENAMES } from '../constants.js';
import { parseInitTeamModeFromCommander, resolveInitTeamMode } from './resolve-init-team-mode.js';
import {
  parseInitPersonalLogGitignoreFromCommander,
  resolveInitPersonalLogGitignore,
} from './resolve-init-personal-log-gitignore.js';

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

function writePrimaryConfig(root: string, editorIds: string[], teamMode: boolean): void {
  const parsed = ConfigSchema.parse({ ...DEFAULTS, enabledEditors: editorIds, teamMode });
  writeFileSync(join(root, CONFIG_FILENAME), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

function mergeEnabledEditorsIntoPrimaryConfig(root: string, editorIds: string[], teamMode: boolean): void {
  const cfgPath = join(root, CONFIG_FILENAME);
  if (!existsSync(cfgPath)) return;
  const raw = readFileSync(cfgPath, 'utf8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  const merged = ConfigSchema.parse({ ...DEFAULTS, ...data, enabledEditors: editorIds, teamMode });
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
    '  acr init -y --team                # team mode: per-user logs; no log lines added to .gitignore',
    '  acr init -y --no-team             # personal mode (default with -y)',
    '  acr init -y --no-team --no-gitignore-logs  # personal + track log.jsonl in Git',
    '  acr init -y --no-team --gitignore-logs     # personal + append log paths to .gitignore (default)',
    '',
    'Interactive: in a TTY, `acr init` with none of the above runs @inquirer/prompts to pick editors.',
    '  Then: team mode (default No). If personal mode: ask whether to add log paths to .gitignore (default Yes).',
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
      'Install editor hooks; choose team vs personal logs; in personal mode optionally add log paths to .gitignore',
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
    )
    .option('--team', 'enable team mode: per-user log files under .aicode-ratio/logs/')
    .option('--no-team', 'personal mode: single log file (default with -y)')
    .option(
      '--gitignore-logs',
      'personal mode only: append .aicode-ratio log paths to .gitignore (non-interactive default when paired with --no-team)',
    )
    .option(
      '--no-gitignore-logs',
      'personal mode only: do not append those .gitignore lines (track log in Git)',
    );

  for (const a of listEditorAdapters()) {
    initCmd.option(`--${a.id}`, `Install hooks for ${a.label}`);
  }

  initCmd.option('--codebuddyIDE', 'Deprecated; same as --codebuddy.');

  initCmd.action(
    async (
      positionalEditors: string[],
      options: {
        repo: string;
        editors?: string;
        yes?: boolean;
        team?: boolean;
        noTeam?: boolean;
        gitignoreLogs?: boolean;
        noGitignoreLogs?: boolean;
      },
      command: Command,
    ) => {
      const repoRoot = resolve(options.repo);
      ensureGitRepo(repoRoot);
      const root = getRepoRoot(repoRoot);

      const opts = command.opts() as Record<string, unknown>;
      const selectedFromFlags = selectedEditorIdsFromOpts(opts);

      const teamParsed = parseInitTeamModeFromCommander({
        team: options.team === true,
        noTeam: options.noTeam === true,
      });
      if (!teamParsed.ok) {
        command.error(`error: ${teamParsed.message}`);
        return;
      }

      const cliResolved = parseInitEditorIdsFromCommander({
        editors: options.editors,
        yes: options.yes,
        positionalEditors: positionalEditors,
        selectedFromFlags,
      });

      let editorIds: string[];
      let teamMode: boolean;
      let appendPersonalLogGitignore = false;
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
        teamMode = await resolveInitTeamMode(teamParsed.explicit);

        if (teamMode) {
          if (options.gitignoreLogs === true || options.noGitignoreLogs === true) {
            command.error(
              'error: --gitignore-logs / --no-gitignore-logs apply only in personal mode (use --no-team).',
            );
            return;
          }
        } else {
          const igParsed = parseInitPersonalLogGitignoreFromCommander({
            gitignoreLogs: options.gitignoreLogs === true,
            noGitignoreLogs: options.noGitignoreLogs === true,
          });
          if (!igParsed.ok) {
            command.error(`error: ${igParsed.message}`);
            return;
          }
          appendPersonalLogGitignore = await resolveInitPersonalLogGitignore(igParsed.explicit);
        }
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

      if (!teamMode && appendPersonalLogGitignore) {
        appendGitignoreLines(root, [...GITIGNORE_LINES_PERSONAL]);
      }

      if (!hasAnyConfig(root)) {
        writePrimaryConfig(root, editorIds, teamMode);
      } else {
        mergeEnabledEditorsIntoPrimaryConfig(root, editorIds, teamMode);
      }

      console.log(`Initialized aicode-ratio in ${root}`);
      console.log('');
      console.log(`Editors: ${editorIds.join(', ')}`);
      console.log(`Team mode: ${teamMode ? 'on' : 'off'}`);
      console.log('');
      if (teamMode) {
        console.log(
          'Per-user logs: .aicode-ratio/logs/<local-git-user>.jsonl — no tracker log paths were added to .gitignore (commit logs to share).',
        );
      } else if (appendPersonalLogGitignore) {
        console.log('Personal mode: tracker log paths were appended to .gitignore (privacy default).');
      } else {
        console.log(
          'Personal mode: skipped .gitignore rules for tracker logs — you can commit .aicode-ratio/log.jsonl if you want.',
        );
      }
      console.log('');
      console.log('Next steps:');
      console.log("  1. Confirm each editor's hooks point at the bundled append-log script.");
      console.log(`     (Cursor: ${join(root, '.cursor', 'hooks.json')})`);
      console.log(`     (CodeBuddy: ${join(root, '.codebuddy', 'settings.json')})`);
      console.log(`     (Claude Code: ${join(root, '.claude', 'settings.json')})`);
      console.log(`     (Qoder: ${join(root, '.qoder', 'settings.json')})`);
      console.log('  2. Run: pnpm dlx aicode-ratio doctor');
      console.log(
        `  3. See ${CONFIG_FILENAME} for teamMode / logPath; trigger an agent edit to create the log.`,
      );
      console.log(
        '  4. Slash command: in chat, type `/` and pick **aicode-ratio-report** — the agent must confirm `--since` / `--until` with you (or parse them from your message) before running `report` (see .cursor/commands, .claude/commands, …).',
      );
    },
  );

  program.addCommand(initCmd);
}
