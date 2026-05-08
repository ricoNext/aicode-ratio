/**
 * Plug-in hooks for integrating AI-editor local write telemetry (manifest in docs/multi-editor-plan.md).
 */

export type EditorTier = 'supported' | 'beta' | 'unsupported';

export interface EditorInstallContext {
  repoRoot: string;
  /** Directory containing bundled `HOOK_SCRIPT_NAME` (typically `dist/hooks` after build). */
  bundledHooksDir: string;
}

export interface EditorDoctorContext {
  repoRoot: string;
}

/** Strip this package's hook wiring for this editor. */
export interface EditorUninstallContext {
  repoRoot: string;
}

export interface EditorAdapter {
  readonly id: string;
  readonly label: string;
  readonly tier: EditorTier;
  /** Lines appended to `.gitignore` during `init` (deduped with existing lines). */
  readonly gitignoreLines: readonly string[];
  install(ctx: EditorInstallContext): void;
  /** Optional checks scoped to this editor after shared Node/Git checks. */
  doctor?(ctx: EditorDoctorContext): void;
  /**
   * Remove hooks / editor-specific wiring installed by {@link EditorAdapter.install}.
   *
   * @returns Human-readable log lines (e.g. confirmation paths); empty if no-op.
   */
  uninstall(ctx: EditorUninstallContext): string[];
}
