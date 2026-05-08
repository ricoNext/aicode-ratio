import type { Command } from 'commander';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { tryGetGitRepoRoot } from '../util/paths.js';
import { loadResolvedConfig } from '../config/load-config.js';
import { getEditorAdapter } from '../editors/registry.js';

function checkNode(): void {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isFinite(major) || major < 20) {
    console.warn(`[warn] Node.js ${process.version} — recommend >= 20`);
  } else {
    console.log(`[ok] Node.js ${process.version}`);
  }
}

function checkGit(): boolean {
  try {
    const v = execSync('git --version', { encoding: 'utf8' }).trim();
    console.log(`[ok] ${v}`);
    return true;
  } catch {
    console.error('[error] git not found in PATH');
    process.exitCode = 1;
    return false;
  }
}

export function registerDoctor(program: Command): void {
  program
    .command('doctor')
    .description('Check environment: Node version, git, hooks installation, log growth')
    .option('--repo <path>', 'Repository root', '.')
    .action((options: { repo: string }) => {
      const repoRoot = resolve(options.repo);
      checkNode();
      if (!checkGit()) return;

      const root = tryGetGitRepoRoot(repoRoot);
      if (!root) {
        console.error('[error] Not a git repository (or git failed)');
        process.exitCode = 1;
        return;
      }
      console.log(`[ok] Git repo root: ${root}`);

      const cfg = loadResolvedConfig(root);
      console.log(`[ok] enabledEditors: ${cfg.enabledEditors.join(', ')}`);

      for (const id of cfg.enabledEditors) {
        const adapter = getEditorAdapter(id);
        if (!adapter) {
          console.warn(`[warn] Unknown editor id in config.enabledEditors: ${id}`);
          continue;
        }
        if (adapter.doctor) adapter.doctor({ repoRoot: root });
      }

      const logAbs = join(root, cfg.logPath);
      if (existsSync(logAbs)) {
        const st = statSync(logAbs);
        console.log(`[ok] Log file exists (${st.size} bytes): ${logAbs}`);
        console.log('     Trigger another agent save and re-run doctor to see size increase.');
      } else {
        console.warn(`[warn] Log not found yet: ${logAbs}`);
        console.log(
          '     After init, let your editor agent touch a tracked file to create the log.',
        );
      }
    });
}
