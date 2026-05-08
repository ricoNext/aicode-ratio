import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadResolvedConfig } from '../config/load-config.js';

export function registerConfigPrint(program: Command): void {
  const config = new Command('config').description('Configuration subcommands');

  config
    .command('print')
    .description('Print the resolved configuration')
    .option('--repo <path>', 'Repository root', '.')
    .action((options: { repo: string }) => {
      const repoRoot = resolve(options.repo);
      const resolved = loadResolvedConfig(repoRoot);
      process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
    });

  program.addCommand(config);
}
