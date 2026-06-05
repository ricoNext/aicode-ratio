import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { registerReport } from './commands/report.js';
import { registerUninstall } from './commands/uninstall.js';
import { registerDoctor } from './commands/doctor.js';
import { registerConfigPrint } from './commands/config-print.js';
import pkg from '../package.json' with { type: 'json' };

const program = new Command();

program
  .name('aicode-ratio')
  .description('Track AI agent / tab edits and cross-reference with Git for attribution reports')
  .version(pkg.version);

registerInit(program);
registerReport(program);
registerUninstall(program);
registerDoctor(program);
registerConfigPrint(program);

program.parse();
