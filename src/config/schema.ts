import { z } from 'zod';

export const ConfigSchema = z.object({
  version: z.literal(1),
  /**
   * Team mode: each developer writes their own file under `.aicode-ratio/logs/<slug>.jsonl`
   * (from local `git config user.*`) so Git merges rarely conflict; `report` reads all `*.jsonl` there.
   */
  teamMode: z.boolean().default(false),
  logPath: z.string().default('.aicode-ratio/log.jsonl'),
  preCommitHours: z.number().positive().default(72),
  postCommitHours: z.number().positive().default(2),
  gitDateField: z.enum(['committer', 'author']).default('committer'),
  ignoreLogPathPrefixes: z.array(z.string()).default(['node_modules/', 'dist/', '.git/']),
  ignoreLogGlobs: z.array(z.string()).default([]),
  maxLogBytes: z.number().positive().optional(),
  /** Editors this repo uses for hook install / doctor (see `aicode-ratio init --editors`). */
  enabledEditors: z.array(z.string().min(1)).min(1).default(['cursor']),
  sources: z.object({
    agent: z.boolean().default(true),
    tab: z.boolean().default(true),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
