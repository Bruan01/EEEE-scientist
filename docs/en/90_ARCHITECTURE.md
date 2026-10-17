# 90 Architecture: Maintainer Architecture Reference

This document is the maintainer-facing architecture reference for the current open-source repository.

It describes the implementation that actually exists in this checkout. When code and docs diverge, fix the docs in the same change.

## Goals

EEEE Scientist is a small, local-first research operating system with these stable constraints:

- the authoritative runtime is Python
- `npm` is the install and launch path
- one quest equals one Git repository
- durable state stays in files plus Git
- the public built-in MCP surface stays limited to `memory`, `artifact`, and `bash_exec`
- the workflow remains prompt-led and skill-led instead of stage-scheduler-heavy

## Top-Level Layout

Important repository areas:

- `bin/`
  - npm launcher entrypoint
- `src/deepscientist/`
  - authoritative runtime, daemon, CLI, registries, quest state, connectors
- `src/prompts/`
  - system prompt source
- `src/skills/`
  - first-party stage skills
- `src/ui/`
  - web workspace
- `src/tui/`
  - local TUI
- `docs/`
  - user docs and maintainer docs
- `tests/`
  - runtime, API, prompt, connector, packaging, and UI contract tests

## Launch Chain

The normal user path is:

1. `npm install -g eeee-scientist`
2. run `ds`
3. `bin/ds.js` ensures a locked uv-managed Python runtime is ready under `~/DeepScientist/runtime/python-env`
4. the launcher starts the Python daemon
5. the daemon serves the web workspace and shared API surface
6. the TUI and web UI both consume the same daemon contracts

`bin/ds.js` should stay thin. Product behavior belongs in Python services, prompts, and skills.

## Runtime Home

The default runtime home is `~/DeepScientist/`.

Key directories:

- `runtime/`
  - launcher-managed runtime state
  - uv-managed Python environment
  - uv-managed Python installs
  - uv cache
  - built bundle helpers
  - managed local tool installs under `runtime/tools/`
- `config/`
  - YAML configuration and baseline registry data
- `memory/`
  - global memory cards
- `quests/`
  - one quest per Git repository
- `logs/`
  - daemon and runtime logs
- `cache/`
  - reusable caches such as synced skills

## Quest Model

Each quest lives under `~/DeepScientist/quests/<quest_id>/` and is its own Git repository.

Important quest state lives in:

- `quest.yaml`
- `brief.md`
- `plan.md`
- `status.md`
- `SUMMARY.md`
- `.ds/runtime_state.json`
- `.ds/user_message_queue.json`
- `.ds/events.jsonl`
- `.ds/interaction_journal.jsonl`

The quest layout contract is defined in `src/deepscientist/quest/layout.py`. If it changes, update quest services, daemon handlers, UI/TUI consumers, and tests together.

## Core Runtime Boundaries

### CLI

- file: `src/deepscientist/cli.py`
- responsibility: thin Python command surface over quest, config, doctor, and runtime services

### Daemon

- files:
  - `src/deepscientist/daemon/app.py`
  - `src/deepscientist/daemon/api/router.py`
  - `src/deepscientist/daemon/api/handlers.py`
- responsibility:
  - serve the local web workspace
  - expose shared API routes
  - coordinate quest turn execution, inbox delivery, connectors, and run control

### Quest

- files under `src/deepscientist/quest/`
- responsibility:
  - create quests
  - maintain quest snapshots
  - persist runtime state
  - derive explorer and canvas state

### Artifact

- files under `src/deepscientist/artifact/`
- responsibility:
  - durable structured artifacts
  - Git-backed quest operations
  - baselines, approvals, progress, reports, interactions

### Memory

- files under `src/deepscientist/memory/`
- responsibility:
  - global and quest-scoped Markdown memory

### Bash Execution

- files under `src/deepscientist/bash_exec/`
- responsibility:
  - managed, stoppable, durable shell sessions

## Git Checkpoints And Large Experiment Outputs

Quest Git is the durable index for source, branch refs, artifact metadata,
metrics, and reports. It is not the storage layer for model weights or other
large checkpoint blobs.

`gitops.checkpoint_repo()` applies three safeguards:

- checkpoints run under a lock in the repository's Git common directory, so
  the main checkout and linked worktrees do not mutate the same Git object
  database concurrently;
- files above the checkpoint size limit (256 MiB by default) are excluded from
  staging, while small metadata files in the same experiment can still be
  committed;
- excluded experiment files are listed in `weights_manifest.json` under the
  experiment directory with their local relative paths and sizes. The file is
  committed as metadata; the large files remain in the experiment worktree.

The isolated provider homes under `.ds/codex-home/`, `.ds/claude-home/`, and
`.ds/opencode-home/` are also checkpoint-excluded. They contain provider auth,
SQLite state, caches, and session material; quest recovery uses the durable
quest event stream, run records, artifacts, memory, and runner history instead.
Older quests may already have these files tracked, so ignoring them does not
rewrite existing history. A separate migration must verify recovery first and
then remove only the cache paths from the index while preserving the files.

New quest `.gitignore` files also exclude common model-weight extensions under
experiment directories. Existing quests are protected by the checkpoint
preflight, but already-created Git objects are not rewritten automatically.
Any migration of an existing repository must first verify that the local
manifest and experiment paths are recoverable, then remove old blobs in a
separate maintenance window.

Branch Map does not use model blobs to identify nodes. It reads refs, commit
metadata, artifact records, and worktree metadata. Therefore a local-only
weight path in a manifest does not make a branch or run disappear; Git history
can show the metadata commit while the experiment runtime resolves the local
weight path. Live Explorer/status calls can still scan the worktree, so keeping
large outputs ignored is important for UI responsiveness as well as object
database size.

Projection refreshes are deliberately asynchronous. Session/status requests return the
cached projection or a placeholder and queue Git-backed source-signature work in a daemon
worker. Read-only Git probes use a short timeout; a stalled DrvFS/9p Git call is reported as
stale/failed projection state instead of holding the HTTP request indefinitely. Long-running
experiment commands and explicit checkpoint mutations keep their own execution semantics.

## Public MCP Boundary

The public built-in MCP surface must remain:

- `memory`
- `artifact`
- `bash_exec`

Do not introduce public `git`, `connector`, or `runtime_tool` MCP namespaces.

Git behavior stays inside `artifact`. Managed local tooling is a daemon/runtime concern, not a public MCP surface.

## Registry-First Extension Points

EEEE Scientist prefers small explicit registries over large dispatch branches.

Current registry-backed areas include:

- runners
- channels
- connector bridges
- skill discovery
- managed local runtime tools

Patterns should stay close to:

- `register_*()`
- `get_*()`
- `list_*()`

## Managed Local Runtime Tools

Managed local tools are optional helper runtimes installed under `~/DeepScientist/runtime/tools/`.

Examples:

- TinyTeX for local `pdflatex`
- future candidates such as `pandoc`, `graphviz`, or `ffmpeg`

The runtime-tool layer lives under `src/deepscientist/runtime_tools/` and exists to:

- keep install logic out of unrelated subsystems
- let the daemon and CLI inspect tool health in one place
- resolve binaries consistently
- make new managed tools register the same way as runners or channels

Current pieces:

- `runtime_tools/registry.py`
  - `register_runtime_tool()`, `get_runtime_tool_factory()`, `list_runtime_tool_names()`
- `runtime_tools/service.py`
  - high-level access for status, install, and binary resolution
- `runtime_tools/builtins.py`
  - built-in registrations
- `runtime_tools/tinytex.py`
  - TinyTeX provider adapter

Low-level TinyTeX implementation remains in `src/deepscientist/tinytex.py`.

## Prompt And Skill Flow

Research workflow behavior should primarily live in:

- `src/prompts/system.md`
- `src/deepscientist/prompts/builder.py`
- `src/skills/*/SKILL.md`

The daemon should persist and route state, but avoid becoming a rigid workflow scheduler.

## UI Contract

The web UI and TUI share the same daemon API contract.

If an API route changes:

- update daemon handlers/router
- update `src/ui/src/lib/api.ts`
- update `src/tui/src/lib/api.ts`
- update tests that enforce the contract

Preserve `/projects` and `/projects/:quest_id` as the main web workspace routes.

## Documentation Contract

Maintainer docs:

- this file: `docs/en/90_ARCHITECTURE.md`
- `docs/en/91_DEVELOPMENT.md`

User docs:

- `docs/en/*.md`
- `docs/zh/*.md`

Do not put temporary implementation checklists or planning drafts under `docs/`.

## Testing Layers

Typical validation layers:

- Python unit and integration tests under `tests/`
- API contract tests
- prompt and skill tests
- web/TUI bundle builds
- packaging checks such as `npm pack --dry-run --ignore-scripts`

When changing registries, quest layout, API contracts, prompts, or packaging, update the corresponding tests in the same change.
