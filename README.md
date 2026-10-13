<h1 align="center">EEEE Scientist</h1>

<p align="center">
  <img src="assets/branding/logo.svg" alt="EEEE Scientist logo" width="72" />
</p>

<p align="center">
  A local-first research workspace for long-running experiments, papers, and
  human-in-the-loop AI workflows.
</p>

<p align="center">
  <a href="https://github.com/Bruan01/EEEE-scientist">Repository</a> ·
  <a href="README_ZH.md">中文说明</a> ·
  <a href="docs/en/README.md">Documentation</a> ·
  <a href="https://github.com/ResearAI/DeepScientist">Upstream project</a>
</p>

EEEE Scientist is a secondary-development fork based on
[DeepScientist](https://github.com/ResearAI/DeepScientist). The fork keeps the
original local-first research workflow while making the product smaller,
clearer, and easier to continue developing in this repository.

## What this fork focuses on

- One quest is one Git repository with durable files, branches, artifacts, and
  memory.
- Codex is the primary runner; Claude Code, Kimi Code, and OpenCode remain
  available as optional runners.
- The Web workspace, TUI, Canvas, terminal, memory, and connectors share one
  daemon state.
- Researchers can inspect, pause, edit, redirect, and resume an autonomous
  workflow at any time.

## Changes in EEEE Scientist

The current fork includes the following product decisions and extensions:

- BenchStore has been removed from the active workflow. Users can download
  data themselves or ask the selected runner to prepare it.
- A compact interface mode disables decorative transitions and animations.
  Open Settings, go to Runtime, and enable compact mode when the workspace
  feels heavy.
- The runtime proxy can be changed without restarting the whole project. The
  command-line entry point also accepts a proxy, for example:

~~~bash
ds --proxy http://127.0.0.1:7897
~~~

- Lightweight Codex token accounting is shown in a project at Details,
  Overall, and Codex tokens. Other runners are intentionally excluded.
- Connector and Weixin state is kept in the existing durable runtime layout,
  so the fork can continue existing local projects.

## Quick start from this repository

### Requirements

- macOS or Linux
- Node.js 18.18 or newer
- npm 9 or newer
- Python 3.11 or newer
- Git
- At least one working runner, with Codex recommended for the first run

### Install and launch

~~~bash
git clone https://github.com/Bruan01/EEEE-scientist.git
cd EEEE-scientist
bash install.sh

codex login
# Skip `codex login` when Codex Desktop is already authenticated on this machine.
ds doctor --runner codex
ds --here --runner codex
~~~

The default local Web address is usually
<http://127.0.0.1:20999>. Use <code>ds --status</code> and
<code>ds --stop</code> to inspect or stop the managed daemon.

The source-first fork is not dependent on the upstream npm package. The root
package metadata is named <code>eeee-scientist</code>; the supported local
installation path is the checkout above.

### Other runners

When a runner already works in the same shell, validate it before selecting it:

~~~bash
ds doctor --runner claude
ds --here --runner claude

ds doctor --runner kimi
ds --here --runner kimi

ds doctor --runner opencode
ds --here --runner opencode
~~~

Runner authentication and provider/model configuration still belong to the
underlying CLI. EEEE Scientist reuses that working runner instead of replacing
its provider configuration.

## Runtime configuration

The existing runtime home is intentionally kept as <code>~/DeepScientist</code>
for compatibility with previously created quests. This is a storage path, not
the public product name. You can always select another home explicitly:

~~~bash
ds --home /path/to/eeee-scientist-home
~~~

Important configuration locations:

- <code>~/DeepScientist/config/config.yaml</code>: daemon, UI, proxy, logging,
  Git, and runtime defaults.
- <code>~/DeepScientist/config/runners.yaml</code>: Codex profile, model,
  sandbox, approval policy, retries, and environment variables.
- Web Settings: the preferred path for changing runtime, model, connector,
  proxy, and compact-mode settings.

For a local HTTP proxy such as port 7897, use the Web Settings Runtime page or
set the runtime proxy value to:

~~~text
http://127.0.0.1:7897
~~~

## Development

Install the workspace dependencies:

~~~bash
npm ci
npm --prefix src/ui ci
npm --prefix src/tui ci
~~~

Build the Web UI and TUI:

~~~bash
npm --prefix src/ui run build
npm --prefix src/tui run build
~~~

Run the lightweight checks used by this fork:

~~~bash
python3 -m compileall -q src/deepscientist tests
npm --prefix src/ui run build
git diff --check
~~~

The authoritative runtime is Python under <code>src/deepscientist/</code>.
<code>bin/ds.js</code> is the npm launcher, while <code>src/ui/</code> and
<code>src/tui/</code> provide the two front ends.

## Repository map

| Path | Role |
|---|---|
| <code>src/deepscientist/</code> | Python runtime, daemon, runners, connectors, quest state, and services |
| <code>src/ui/</code> | React Web workspace and settings |
| <code>src/tui/</code> | Terminal user interface |
| <code>src/prompts/</code> | System, Copilot, connector, and runtime contracts |
| <code>src/skills/</code> | Research workflow skills |
| <code>docs/en/</code> | English user and maintainer guides |
| <code>docs/zh/</code> | Chinese user and maintainer guides |
| <code>tests/</code> | Python, launcher, API, and UI contract tests |

Recommended documentation entry points:

- [English documentation index](docs/en/README.md)
- [Chinese documentation index](docs/zh/README.md)
- [Quick Start](docs/en/00_QUICK_START.md)
- [Architecture](docs/en/90_ARCHITECTURE.md)
- [Development Guide](docs/en/91_DEVELOPMENT.md)
- [Codex Provider Setup](docs/en/15_CODEX_PROVIDER_SETUP.md)
- [Settings Reference](docs/en/01_SETTINGS_REFERENCE.md)
- [Weixin Connector Guide](docs/en/10_WEIXIN_CONNECTOR_GUIDE.md)

## Naming and compatibility

The public product name is **EEEE Scientist** and the npm package name is
<code>eeee-scientist</code>. The following legacy identifiers remain by
design:

- Python imports use <code>deepscientist</code>.
- The primary launcher command remains <code>ds</code>; the package also
  exposes <code>eeee-scientist</code>.
- Existing environment variables such as
  <code>DEEPSCIENTIST_HOME</code> remain supported.
- Existing runtime homes under <code>~/DeepScientist</code> remain valid.

Keeping these compatibility identifiers avoids migrating every existing quest
just because the fork has a new display name.

## Upstream, attribution, and license

EEEE Scientist is a modified fork of DeepScientist. The upstream project and
paper remain acknowledged in the repository documentation. Changes specific to
this fork are maintained at
[Bruan01/EEEE-scientist](https://github.com/Bruan01/EEEE-scientist).

The source remains available under the Apache-2.0 license. See [LICENSE](LICENSE),
[CITATION.cff](CITATION.cff), and [TRADEMARK.md](TRADEMARK.md) for the current
attribution and naming guidance.
