# aicode-ratio

[简体中文](README.zh-CN.md)

Track **AI coding agent / tab** file-edit events on your machine (starting with **Cursor** hooks; other editors such as **Claude Code** are on the roadmap) and cross-reference them with Git commits to build **AI vs human** share reports (monthly / quarterly).

## What it is — and what it isn't

**It can:**

- Estimate what share of commits (or changed files) in a window were touched by an editor agent before landing in Git.
- Emit per-commit tables plus aggregate ratios as JSON, CSV, or Markdown.
- Split by source: `agent` vs `tab` (where the hook provides that distinction).

**It cannot:**

- Replace vendor-specific “acceptance” funnels (e.g. Cursor’s in-editor metrics).
- Attribute at line granularity (human + AI in the same file counts as one).
- Work without local logs — attribution is **machine-local**.

**Requirements:** Node.js ≥ 20, [pnpm](https://pnpm.io/) ≥ 9 (to develop this repo), Git in PATH, and an editor that exposes hooks (today: **Cursor** desktop with Hooks).

---

## Development

```bash
corepack enable
pnpm install
pnpm run build
pnpm test
```

CI uses `pnpm install --frozen-lockfile` (pnpm’s strict install,
analogous to `npm ci`).

Design docs (Chinese):
[multi-editor-plan.md](docs/multi-editor-plan.md) — multi-editor roadmap;
[aicode-ratio-npm-package.md](docs/aicode-ratio-npm-package.md) —
overall package design.

---

## Quick start (about 1 minute)

```bash
# One-time setup — must name editors (examples: Cursor only)
pnpm dlx aicode-ratio init -y
# or: pnpm dlx aicode-ratio init cursor

# Verify hooks and log path
pnpm dlx aicode-ratio doctor
```

Pick editors on the **command line** (Commander only — no prompts): **`acr init cursor`**, **`acr init --editors cursor`**, or **`acr init -y`** (Cursor only; use in scripts/CI). **`acr init`** alone prints an error with examples; **`acr init --help`** lists the same.

Then use your editor’s agent (e.g. Cursor Agent or Tab) to edit a file — events append to the path in `.aicode-ratio.json` (default: `.aicode-ratio/log.jsonl`).

---

## Generate a report

```bash
pnpm dlx aicode-ratio report \
  --repo . \
  --since 2026-04-01 \
  --until 2026-05-01 \
  --branch main \
  --format md \
  --out ./reports/2026-04.md
```

Merge commits are excluded by default; pass `--include-merges` if you need them.

---

## Commands

| Command | Description |
|---------|-------------|
| `init` | Install hooks via Commander: pass `[editors...]`, `--editors`, or `-y` |
| `doctor` | Check Node, git, hooks, log file |
| `report` | Build attribution report |
| `uninstall` | Remove this package’s hook entries |
| `config print` | Print resolved configuration |

Shorter CLI alias: **`acr`** (same binary as `aicode-ratio`).

---

## Configuration

`init` creates **`.aicode-ratio.json`** when no config exists. Legacy configs **`.agent-code-attribution.json`** and **`.cursor-attribution.json`** are still read if present.

Environment override (first existing file wins): **`AICODE_RATIO_CONFIG`**, then **`AGENT_CODE_ATTRIBUTION_CONFIG`**, then **`CURSOR_ATTRIBUTION_CONFIG`**, then repo/home JSON — see `src/config/load-config.ts`.

| Field | Default | Description |
|-------|---------|-------------|
| `logPath` | `.aicode-ratio/log.jsonl` | JSONL log relative to repo root |
| `preCommitHours` | `72` | Hours before commit to scan |
| `postCommitHours` | `2` | Hours after commit to scan |
| `gitDateField` | `"committer"` | `"committer"` or `"author"` |
| `ignoreLogPathPrefixes` | `["node_modules/","dist/",".git/"]` | Path prefixes to skip |
| `sources.agent` / `sources.tab` | `true` | Include Agent / Tab channels |

---

## Understanding the ratios

**Ratio A (commits):** `commitsWithTouch / commitsTotal` — a commit counts if any changed file has a log hit in that commit’s time window.

**Ratio B (files):** `filesGitUniqueTouched / filesGitUnique` — among all unique files touched in Git across the window, how many had a matching log event in their commit’s window.

Both ratios appear in every report.

---

## Privacy & `.gitignore`

`init` appends ignore rules for current and legacy log paths, for example:

```gitignore
.aicode-ratio/log.jsonl
.aicode-ratio/log.jsonl.*
.aicode-ratio/hook-errors.log
.agent-code-attribution/log.jsonl
.agent-code-attribution/log.jsonl.*
.agent-code-attribution/hook-errors.log
.cursor/cursor-attribution.log.jsonl
.cursor/cursor-attribution.log.jsonl.*
.cursor/cursor-attribution-hook-errors.log
```

Logs store **paths and timestamps only** — no file bodies, prompts, or secrets.

---

## Troubleshooting

Run `acr doctor` or `pnpm dlx aicode-ratio doctor` first.

- **Log not growing** — confirm `.cursor/hooks.json` was written by `init` and that your editor fired the hook after an agent edit.
- **Wrong repo root** — run from the Git root or pass `--repo <path>`.
- **Hook payload shape changed** — open an issue with editor + version; the hook accepts several candidate field names.

---

## Contributing

See `test/` for unit and integration tests. For new editor versions, add stdin fixtures under `test/fixtures/` and extend parsing in `src/hooks/append-log.mjs`.
