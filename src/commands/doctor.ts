import type { Command } from 'commander';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { tryGetGitRepoRoot } from '../util/paths.js';
import { loadResolvedConfig } from '../config/load-config.js';
import { TEAM_LOG_DIR_REL } from '../util/user-log-slug.js';
import { getEditorAdapter, normalizeLegacyEditorId } from '../editors/registry.js';

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
        const nid = normalizeLegacyEditorId(id);
        const adapter = getEditorAdapter(nid);
        if (!adapter) {
          console.warn(`[warn] Unknown editor id in config.enabledEditors: ${id}`);
          continue;
        }
        if (adapter.doctor) adapter.doctor({ repoRoot: root });
      }

      if (cfg.teamMode) {
        const dir = join(root, TEAM_LOG_DIR_REL);
        if (!existsSync(dir)) {
          console.warn(`[warn] Team log directory not found yet: ${dir}`);
          console.log('     After init, let an agent save a file so your per-user *.jsonl is created.');
        } else {
          const files = readdirSync(dir).filter((n) => n.endsWith('.jsonl'));
          if (files.length === 0) {
            console.warn(`[warn] No *.jsonl under ${dir} yet`);
          } else {
            let total = 0;
            for (const f of files) {
              total += statSync(join(dir, f)).size;
            }
            console.log(`[ok] Team mode: ${files.length} log file(s) under ${dir} (${total} bytes total)`);
          }
        }
      } else {
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
      }
    });
}
