# aicode-ratio

<p align="center">
  <a href="https://github.com/ricoNext/aicode-ratio">
    <picture>
      <source srcset="logo.jpeg" media="(prefers-color-scheme: dark)">
      <source srcset="logo-light.jpeg" media="(prefers-color-scheme: light)">
      <img src="logo.jpeg" alt="aicode-ratio logo">
    </picture>
  </a>
</p>

<p align="center">The AI code ratio tracker and reporting tool.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/aicode-ratio"><img alt="npm" src="https://img.shields.io/pnpm/v/aicode-ratio?style=flat-square" /></a>
  <a href="https://github.com/ricoNext/aicode-ratio/actions/workflows/publish-npm.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/ricoNext/aicode-ratio/publish-npm.yml?style=flat-square&amp;branch=main" /></a>
</p>

[简体中文](README.zh-CN.md)

**aicode-ratio** is a command-line tool for estimating **AI Code Ratio** over a period: how much of your code changes overlap editor-side AI activity versus plain Git history.

It uses editor **hooks** to record **when an AI agent / Tab touched or saved which files**, then aligns those events in time with **Git commits** to estimate **what share of commits / changed files** had editor-side activity nearby.

Supported editors (hooks) today include:

- Cursor  
- Claude Code  
- CodeBuddy (IDE & CLI)  
- Qoder (IDE & CLI)

> Cursor supports Tab mode; other editors do not yet.

Outputs can be **Markdown, JSON, or CSV** for your own archives, team sharing, or downstream analysis — this is **not** a vendor-official dashboard metric; it is a **local, Git-auditable** complement.

---

## How this differs from vendor “acceptance” funnels — and why use it

> In one line: vendors often measure **suggestion acceptance**; aicode-ratio measures **how much change co-occurred with agent activity** in your repo window.

### What’s different

| Dimension | Vendor “acceptance” style funnel (illustrative) | aicode-ratio |
| --- | --- | --- |
| Data source | Editor / cloud product pipeline; definitions change with the vendor | Local hook logs + local Git |
| What it counts | Often “suggestion → accept / reject” style product events | **Whether files were touched by Agent/Tab**, aligned to **commit time windows** |
| Where you see it | Mostly inside vendor UI or APIs | Under **`.aicode-ratio`** in your repo (logs + reports) |
| Relation to Git | Not always one-to-one with a `git commit` | Explicitly by **branch, date range, commits** |

They are **not mutually exclusive**: vendor metrics answer “in-product adoption”; aicode-ratio answers “on this machine’s edit trail, which changes sat near AI assistance” — **different definitions; do not substitute one for the other**.

### Strengths

- **Transparent definitions**: time windows, branch, merges, author filters — all explainable via CLI and `.aicode-ratio.json`.
- **Self-hosted, auditable**: logs live in the repo (team mode can commit `*.jsonl`); reports can live in Git or CI artifacts.
- **No dependency on a vendor dashboard**: if hooks still fire and Git is local, you can reproduce the same workflow.
- **Matches engineering cadence**: monthly / quarterly or per-branch reviews line up with “what we merged”.
- **Fully local** — logs stay private on your machine unless you choose to share them.

---

## What is counted — and what is not

### What is counted

- **Locally**, within configured windows, editor-written **path + time** (and optional **`gitUser`**), with **`agent` / `tab`** where the hook provides that split.
- Git’s **commit list and per-commit changed paths** for the given **`--since` / `--until`** and branch.
- Intersection in **“N hours before / after each commit”** windows yields:
  - **Ratio A**: share of **commits** with at least one changed file hit in the log window;
  - **Ratio B**: among **unique changed files** in the window, how many had a log hit in their commit’s window;
  - With **`gitUser`** in logs, **rollups by local Git identity** (same denominator context as ratio A).

### What is not counted (or out of scope)

- **Not line-level**: human + AI in the same file still counts as one file touch.
- **No logs ⇒ no attribution**: commits made on a machine without hooks (or never logged) **cannot** be inferred here; attribution is **machine- and config-bound**.
- **No file bodies, prompts, or secrets** in logs — only paths and times (and optional `gitUser`).
- **Cannot replace vendor “Acceptance”** — numbers are **not directly comparable** to official funnels.
- **Depends on Git workflow**: rebase, cherry-pick, many merges affect how commits “look”; merges are **excluded by default** (use `--include-merges` to include them).

**Runtime requirements:** Node.js ≥ 20, **Git** on PATH; `pnpm dlx` / `npx` need registry access; your editor must support the **hook wiring** this tool installs.

---

## Usage

### 0. Optional global install

```bash
npm install -g aicode-ratio
# or: pnpm add -g aicode-ratio
```

After a global install, use **`acr`** or **`aicode-ratio`** (same binary).

```bash
acr --help
```

### 1. Initialize (`init`)

Run from the **Git repository root**:

```bash
# with pnpm
pnpm dlx aicode-ratio init

# if installed globally
acr init
```

`init` will:

1. Create or merge **`.aicode-ratio.json`** (if missing, create; otherwise merge enabled editors, etc.).
2. In **personal** (non-team) mode, ask whether to append personal log paths to **`.gitignore`** (default **Yes** in TTY).
3. Install hooks and editor-specific config for the editors you selected.
4. Write **`aicode-ratio-report`** under each editor’s **`commands/`** folder so an **AI agent** can run the guided `report` flow.

`init` also accepts CLI flags; common options (see **`acr init --help`** for the full list):

| Flag / argument | Description |
| --- | --- |
| `[editors...]` | Positional: space-separated editor ids (e.g. `cursor`, `claude-code`); interacts with `--editors` and `--<id>` flags (see below). |
| `--repo <path>` | Repository root; default `.` |
| `--editors <list>` | Comma-separated editor ids; overrides `--<id>` flags and positionals. |
| `-y` / `--yes` | Skip Inquirer; **Cursor only**; for non-TTY or scripts. |
| `--team` | Team mode: per-developer files under `.aicode-ratio/logs/*.jsonl`. |
| `--no-team` | Personal mode: single main log (default with `-y`). |
| `--gitignore-logs` | **Personal only**: append `.aicode-ratio` log paths to `.gitignore` (common non-interactive default with `--no-team`). |
| `--no-gitignore-logs` | **Personal only**: do not append those `.gitignore` lines (you may commit logs). |
| `--cursor` | Install Cursor hooks, etc. |
| `--codebuddy` | Install CodeBuddy hooks, etc. |
| `--claude-code` | Install Claude Code hooks, etc. |
| `--qoder` | Install Qoder hooks, etc. |
| `--codebuddyIDE` | Deprecated; same as `--codebuddy`. |
| `-h` / `--help` | Show `init` help. |

**Why team mode?**

Team mode fits **multi-developer** repos: each developer keeps their own log file so you can still attribute locally, then **`report` merges all `*.jsonl`** under `.aicode-ratio/logs/`. Those paths are **not** added to `.gitignore` by default so the team can **commit and share** logs. Reporting can show both **per–Git-user** and **overall** agent-touch ratios.

**Team vs personal (explicit flags, non-interactive)**

- **`--team`**: one **`.aicode-ratio/logs/<slug>.jsonl`** per machine/user identity; **`report` merges every `*.jsonl`**; you usually **commit** these; `init` **does not** gitignore them.
- **`--no-team`**: personal mode (**default with `-y`**), single **`logPath`** (default `.aicode-ratio/log.jsonl`).
- **Personal + non-interactive**: **`--gitignore-logs`** (default) appends ignore rules; **`--no-gitignore-logs`** skips that.
- In **team** mode, do **not** pass **`--gitignore-logs` / `--no-gitignore-logs`** (they only apply to personal mode and will error).

### 2. Check health: `doctor`

```bash
pnpm dlx aicode-ratio doctor
```

Checks Node, Git, hook wiring, and log paths.

### 3. Day to day: keep logs growing

Use **Agent / Tab** in a hooked editor to edit and save; events append to the right **`.jsonl`**. If nothing new appears, hooks may not be firing or cwd may not be the repo root — see **Troubleshooting** at the end of this section.

### 4. Generate a report

#### Recommended: slash command + agent

After **`init`**, the repo contains editor **command** files (e.g. **`.[editor]/commands/aicode-ratio-report.md`**) for the editors you installed.

You do **not** have to type a full `report` line first: in chat, type **`/`** and choose **`aicode-ratio-report`** so the agent follows the doc: **confirm or ask for the date range**, then run **`report`** and produce Markdown. The file **does not** embed default **`--since` / `--until`**. If you already stated a range in natural language, the agent should map it to **`YYYY-MM-DD`** and **read it back for confirmation**; if unclear, the agent should **ask** for start (inclusive) and end boundary (exclusive half-open interval). **If a range still cannot be identified or confirmed, the agent must not run `report`, must not create a report file, and must not invent ratios** — only ask you for an explicit range. Default output location is still **`.aicode-ratio/reports/`**. Run from the **repository root**.

This is equivalent to running **`report`** yourself in a terminal, often **faster and less error-prone**.

Examples (Cursor-style chat):

```text
/aicode-ratio-report generate this month’s AI-assisted change report
/aicode-ratio-report on branch xx, generate this month’s AI-assisted change report
```

#### Alternative: run `report` in the terminal

For CI, no agent, or fully custom flags.

Must run from the **Git root** (or pass **`--repo <path>`**).

**Time range:** **`--since` / `--until`** are half-open **`[since, until)`**; with **`YYYY-MM-DD`** use **UTC** day boundaries; **`until` is exclusive**. Example — all of April 2026 UTC: `--since 2026-04-01 --until 2026-05-01`.

**Suggested output path:**

`.aicode-ratio/reports/aicode-ratio-YYYY-MM.md`

**Example (Markdown, current branch):**

```bash
pnpm dlx aicode-ratio report \
  --repo . \
  --since 2026-04-01 \
  --until 2026-05-01 \
  --branch "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)" \
  --format md \
  --out ".aicode-ratio/reports/aicode-ratio-2026-04.md"
```

You can also use **`npx aicode-ratio@latest report`**, global **`acr report`**, or **`pnpm exec aicode-ratio report …`** if the package is a devDependency.

**`report` flags:**

| Option | Required | Default | Notes |
| --- | --- | --- | --- |
| `--since` | yes | — | Start date (inclusive) |
| `--until` | yes | — | End date (**exclusive**) |
| `--repo` | no | `.` | Repo root |
| `--branch` | no | `HEAD` | Branch to analyze |
| `--format` | no | `md` | `json` / `csv` / `md` |
| `--out` | no | stdout | Omit to print to stdout; parent directories are **created automatically** |
| `--author` | no | — | Filter by commit author **email** |
| `--include-merges` | no | off | Add to include merge commits |
| `--pre-hours` / `--post-hours` | no | from config | Override log search window per commit |

These are **not** overridden by `report` and always come from resolved **`.aicode-ratio.json`** (and env): `teamMode`, `logPath`, `gitDateField`, `sources`, `ignoreLogPathPrefixes`, etc.

Environment resolution (first existing file wins): **`AICODE_RATIO_CONFIG`**, then **`CURSOR_ATTRIBUTION_CONFIG`**, then repo/home JSON — see `src/config/load-config.ts`.

### 5. Other commands (as needed)

| Command | Purpose |
| --- | --- |
| `config print` | Print resolved configuration |
| `uninstall` | Remove hook entries written by this package |

Shorter CLI alias: **`acr`** (same as `aicode-ratio`).

### Config quick reference (`.aicode-ratio.json` from `init`)

| Field | Default | Description |
| --- | --- | --- |
| `teamMode` | `false` | If `true`, merge all `*.jsonl` under `.aicode-ratio/logs/` |
| `logPath` | `.aicode-ratio/log.jsonl` | Personal-mode main log path |
| `preCommitHours` | `72` | Hours to search logs **before** each commit |
| `postCommitHours` | `2` | Hours to search logs **after** each commit |
| `gitDateField` | `"committer"` | Use `committer` or `author` time for alignment |
| `ignoreLogPathPrefixes` | `node_modules/`, etc. | Skip log paths with these prefixes |
| `sources.agent` / `sources.tab` | `true` | Whether to count each channel |

### Troubleshooting (short)

- Run **`acr doctor`** first.
- **Log not growing** — confirm `init` wrote hooks for your editor and that an agent actually **saved** a tracked file in this repo.
- **Empty or odd reports** — confirm cwd is the **Git root** and that **`--since` / `--until`** cover commits you care about.

---

## How to read the statistics

### Time windows and “touch”

For each commit, the tool anchors on **`gitDateField`** (committer or author time) and searches logs in **`[commitTime - preCommitHours, commitTime + postCommitHours]`**. If **any** changed path in that commit has a hook event in the window, the commit counts as touched for **ratio A**. **Ratio B** deduplicates file paths across the reporting window and asks how many had a matching event in their commit’s window.

`--pre-hours` / `--post-hours` only override those hour values; they do not replace the rest of config.

### Ratio A (by commit)

**`commitsWithTouch / commitsTotal`**

A commit counts if at least one changed file has a log hit in that commit’s window.

### Ratio B (by unique changed file)

**`filesGitUniqueTouched / filesGitUnique`**

Among unique file paths touched in Git in the window, how many had a log hit in their commit’s window.

### By local Git user (optional)

If log lines include **`gitUser`** (from `git config user.*` at hook time), the report can include **`byLogGitUser`**; legacy lines without `gitUser` may roll up to **`(unknown log user)`**. Denominator context matches ratio A.

### Multiple ratios on purpose

Reports show **ratio A**, **ratio B**, and when applicable **`byLogGitUser`** together so one number is not misread — always interpret with **date range, branch, merges, author filter** in mind.

---

## Appendix: develop and contribute

### Versions & changelog (Changesets)

Releases and `CHANGELOG.md` are managed with [Changesets](https://github.com/changesets/changesets). See **[.changeset/README.md](.changeset/README.md)** for the full workflow.

- **`pnpm changeset`**: add a changeset (creates `.changeset/*.md`) whenever you ship user-facing changes; commit it with your PR.
- **`pnpm changeset:version`**: consumes merged changesets, **bumps `package.json` `version`**, and **updates the root `CHANGELOG.md`** via `@changesets/changelog-github` (then removes the consumed files).
- **Commit & push**, then **`git tag v<version>`** and **`git push origin v<version>`** to trigger **`.github/workflows/publish-npm.yml`** (`npm publish`).

Local development and CI: `pnpm install`, `pnpm run build`, `pnpm test`; CI uses `pnpm install --frozen-lockfile`.

Design docs: [docs/multi-editor-plan.md](docs/multi-editor-plan.md), [docs/aicode-ratio-npm-package.md](docs/aicode-ratio-npm-package.md). Tests and hook fixtures live under `test/`, `test/fixtures/`, and `src/hooks/append-log.mjs`.
