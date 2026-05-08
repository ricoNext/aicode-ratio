import { defineConfig } from 'tsup';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  /**
   * Bundled CJS deps that `require()` Node builtins break under the ESM bundle shim.
   * Keep these as runtime dependencies from `node_modules`.
   */
  external: ['commander', 'micromatch'],
  noExternal: ['zod'],
  async onSuccess() {
    await mkdir(join('dist', 'hooks'), { recursive: true });
    await copyFile(
      join('src', 'hooks', 'append-log.mjs'),
      join('dist', 'hooks', 'aicode-ratio-append-log.mjs'),
    );
    console.log('Copied append-log.mjs → dist/hooks/aicode-ratio-append-log.mjs');
  },
});
