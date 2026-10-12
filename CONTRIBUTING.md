# Contributing to DeepScientist

Thank you for contributing.

This repository is intended to stay small, readable, and reliable. Please optimize for
clarity, correctness, and maintainability over feature volume.

## Before You Start

- read [README.md](README.md)
- read [docs/en/ARCHITECTURE.md](docs/en/ARCHITECTURE.md)
- read [docs/en/DEVELOPMENT.md](docs/en/DEVELOPMENT.md)
- read the relevant user docs under `docs/en/` or `docs/zh/`
- inspect the existing code before proposing a new abstraction
- prefer small, coherent changes over large mixed pull requests

## Development Setup

Requirements:

- Node.js `>=18.18`
- npm `>=9`
- Python `>=3.11`
- Git on `PATH`

Common local setup:

```bash
bash install.sh
npm --prefix src/ui install
npm --prefix src/tui install
```

Build the UI bundles when needed:

```bash
npm --prefix src/ui run build
npm --prefix src/tui run build
```

Run tests:

```bash
pytest
```

## Contribution Principles

Please keep these contracts intact:

- one quest = one Git repository
- Python remains the authoritative runtime
- npm remains the launcher and packaging path
- only `memory`, `artifact`, and `bash_exec` are public built-in MCP namespaces
- web UI and TUI must stay aligned on the same daemon API contract
- prompts and skills should carry workflow behavior whenever possible

## Documentation Rules

- keep user-facing docs in `docs/en/` and `docs/zh/`
- do not add internal planning notes or temporary checklists to `docs/`
- update docs when behavior or architecture changes
- do not commit local machine paths or private workstation references

## Code Style

- prefer simple files and direct control flow
- avoid unnecessary abstraction layers
- keep registries small and explicit
- prefer durable file- and Git-based state over hidden runtime state
- use ASCII by default unless a file already uses non-ASCII or the content clearly needs it

## Pull Request Scope

A good pull request usually has one clear purpose, for example:

- one runtime fix
- one API contract change
- one connector improvement
- one prompt and skill update
- one documentation cleanup

Avoid combining unrelated refactors, UI redesign, connector logic, and packaging changes in one PR.

## Tests And Validation

When relevant, update:

- unit tests
- API contract tests
- prompt and skill tests
- documentation that describes the affected behavior

For packaging changes, also run:

```bash
npm pack --dry-run
```

## Open-Source Hygiene

Do not commit:

- `node_modules/`
- `dist/` build output
- `.turbo/`
- `__pycache__/`
- `.pytest_cache/`
- local secrets
- local absolute paths

## Issues And Proposals

DeepScientist uses GitHub Issues and GitHub Pull Requests as the default contribution path.
No external contribution software is required.

### Which Issue Type To Use

Use one of these issue types:

- `[Bug]` for crashes, regressions, broken behavior, connector failures, UI/TUI problems, or API mismatches
- `[Feature]` for new capabilities, connector requests, workflow improvements, or UX improvements
- `[RFC]` for non-trivial design changes that affect architecture, contracts, or multiple subsystems
- `[Docs]` for missing, incorrect, outdated, or unclear documentation

### What A Good Issue Should Include

When opening an issue, include:

- the problem being solved
- the expected behavior
- the main files or subsystems affected
- any migration or compatibility concerns

For bug reports, also include:

- exact reproduction steps
- the observed behavior
- logs, screenshots, or stack traces when available
- local environment details when relevant

For feature requests, also include:

- the user workflow being improved
- why the current behavior is insufficient
- the rough scope of the proposed change

### When To Open An RFC First

Open an `[RFC]` issue before writing a PR when the change is non-trivial, for example:

- API contract changes
- quest layout changes
- connector contract changes
- runner contract changes
- prompt or skill workflow changes
- cross-cutting refactors that touch multiple subsystems
- large changes that are hard to review incrementally

An RFC should explain:

- the problem
- the proposed design
- alternatives considered
- compatibility or migration impact
- the expected implementation scope

## Pull Request Process

### Before Opening A PR

Before opening a PR:

- make sure the change has one clear purpose
- open or reference an issue first
- use an RFC issue first for non-trivial or cross-cutting changes
- update tests and docs when behavior changes

### PR Title Prefixes

Use one of these prefixes in the PR title:

- `[Bugfix]`
- `[UI]`
- `[TUI]`
- `[Connector]`
- `[Runner]`
- `[Prompt/Skill]`
- `[Docs]`
- `[Core]`
- `[CI/Build]`
- `[Misc]`

Examples:

- `[Connector] Add Lingzhu one-step binding flow`
- `[UI] Fix settings navigation state mismatch`
- `[Docs] Clarify Lingzhu public URL requirements`

### What A Good PR Should Include

A pull request should clearly state:

- what changed
- why it changed
- which issue it resolves or relates to
- which tests were run
- whether docs were updated
- whether there is any breaking behavior or migration impact

### AI-Assisted Contributions

AI-assisted contributions are allowed, but the human contributor remains responsible for the result.

If you use AI assistance:

- review every changed line yourself
- verify the behavior end to end
- run the relevant tests yourself
- disclose AI assistance in the PR description

Do not submit large, unreviewed AI-generated changes.

### Review States

Maintainers may use labels or review comments such as:

- `needs-triage`
- `needs-rfc`
- `action-required`
- `ready-for-review`
- `ready-to-merge`

### Good First Contributions

Issues labeled with these are the best starting points for new contributors:

- `good first issue`
- `help wanted`

## License

By contributing to this repository, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
