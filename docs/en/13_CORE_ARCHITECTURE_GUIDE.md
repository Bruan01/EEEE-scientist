# 13 Core Architecture Guide: How DeepScientist Fits Together

This is the user-facing architecture guide.

Use it when you want to understand how DeepScientist is organized without reading the maintainer-only architecture reference line by line.

If you are maintaining the repository itself, also read [90 Architecture](./90_ARCHITECTURE.md) and [91 Development](./91_DEVELOPMENT.md).

## 1. One-sentence summary

DeepScientist is a local-first research operating system where:

- the public launcher is `npm` + `ds`
- the authoritative runtime is Python
- each quest is its own Git repository
- prompts and skills drive workflow behavior
- durable state lives in files, Git, memory cards, artifacts, and run logs

## 2. Main entrypoints

DeepScientist has four practical entrypoints:

1. the `ds` command
2. the web workspace
3. the TUI
4. external connectors

### 2.1 `ds`

`ds` is the normal user launch path.

It is the command that:

- prepares the runtime
- starts the daemon
- exposes the shared web and TUI API surface

### 2.2 Web workspace

The web UI is the main visual workspace.

This is where you usually:

- create a quest
- inspect files
- read Canvas
- check memory
- continue a running thread

### 2.3 TUI

The TUI is not a separate product with separate state.

It talks to the same daemon and the same quest state as the web UI.

### 2.4 Connectors

Connectors such as Weixin, QQ, and Lingzhu are communication surfaces.

They are not the core runtime.

They let the same quest send or receive messages outside the browser.

## 3. Launch chain

The normal launch chain is:

1. `npm install -g @researai/deepscientist`
2. run `ds`
3. `bin/ds.js` prepares the runtime environment
4. the Python daemon starts
5. the daemon serves the web workspace and shared API
6. the web UI, TUI, and connectors all talk to that daemon

The key design choice is:

- JavaScript is the launcher
- Python is the runtime authority

## 4. Runtime home

By default, DeepScientist uses `~/DeepScientist/` as its runtime home.

Important directories inside it are:

- `runtime/`
- `config/`
- `memory/`
- `quests/`
- `logs/`
- `cache/`

What they mean:

- `runtime/`: managed runtime tools and Python environment
- `config/`: YAML config and baseline registry data
- `memory/`: global memory cards
- `quests/`: every quest repository
- `logs/`: daemon and runtime logs
- `cache/`: reusable caches

## 5. One quest equals one Git repository

This is one of the most important DeepScientist ideas.

Every quest lives in its own directory:

`~/DeepScientist/quests/<quest_id>/`

That directory is its own Git repository.

This means the quest is not only a chat session.

It is a durable local workspace with:

- branches
- files
- plans
- summaries
- artifacts
- memory
- shell history

This is why DeepScientist can behave like a persistent research map instead of a disposable conversation.

## 6. What `Start Research` actually creates

`Start Research` does not only create a new folder.

It also creates a structured startup contract.

That contract carries:

- the research goal
- references and baselines
- runtime constraints
- project objectives
- connector binding choice
- launch and decision policy

This contract becomes the first durable research brief for the quest.

It is the reason the system can start from something more disciplined than an ad hoc prompt.

## 7. What happens when you send a user message

The simplified lifecycle is:

1. a user message arrives from web, TUI, or a connector
2. the daemon writes it into quest history
3. if the quest is idle, the daemon schedules a turn
4. the prompt builder assembles the current prompt
5. the runner starts
6. the agent uses MCP tools, files, Git, and shell
7. outputs are persisted as events, artifacts, file changes, and summaries

The important detail is:

- user messages do not bypass quest state
- they become part of the quest's durable execution history

## 8. Prompt-led and skill-led workflow

DeepScientist does not primarily rely on a giant hard-coded stage scheduler.

Instead, workflow discipline mainly comes from:

- `src/prompts/system.md`
- `src/skills/*/SKILL.md`
- the active quest anchor

In practice, this means:

- the daemon routes and persists
- the prompt defines expectations
- the skill tells the agent how to operate in the current stage

This keeps the runtime thinner and makes behavior easier to evolve through prompts and skills.

## 9. The three built-in MCP namespaces

DeepScientist keeps its built-in MCP surface intentionally small:

- `memory`
- `artifact`
- `bash_exec`

### 9.1 `memory`

Use `memory` for reusable knowledge:

- paper notes
- failure lessons
- stable caveats
- selected idea rationale

### 9.2 `artifact`

Use `artifact` for quest state and structured progress:

- experiment records
- branch decisions
- milestone updates
- interaction delivery
- Git-backed quest operations

### 9.3 `bash_exec`

Use `bash_exec` for durable shell work:

- training
- evaluations
- long-running scripts
- commands that may need later inspection

## 10. Why `artifact.interact(...)` matters so much

`artifact.interact(...)` is one of the central runtime tools because it helps the system do several things together:

- persist interaction state
- optionally checkpoint progress
- push updates outward when routing allows it
- consume queued inbound user messages
- keep the interaction thread continuous across long runs

This is one reason DeepScientist can support long-running work without losing the collaboration thread.

## 11. How the web workspace is built from durable state

The workspace is not a fake frontend over one temporary answer.

Different surfaces are rebuilt from durable state:

- `Explorer` from quest files and derived file-tree state
- `Canvas` from Git, artifacts, and raw quest events
- `Details` from quest summaries and state snapshots
- `Memory` from quest and global memory cards
- `Copilot / Studio` from the live daemon session plus durable history

This is why refreshing the page does not erase the quest's research structure.

## 12. What Canvas really is

Canvas is not a separate graph database.

It is reconstructed from:

- Git branch structure
- artifact records
- quest events

So when you see a node or branch in Canvas, it should correspond to durable quest state, not only a temporary frontend object.

## 13. Where connectors fit

Connectors are adapters around the quest, not replacements for the quest.

Their job is to:

- receive inbound messages from external surfaces
- bind those messages to the correct quest
- deliver outbound updates when routing allows

They do not own the core project state.

The quest repository and daemon still remain the source of truth.

## 14. Why the system can keep growing

DeepScientist can accumulate progress across rounds because it stores state in durable forms:

- quest files
- Git branches and commits
- memory cards
- artifact records
- event logs
- bash session history

That is why later rounds can recover:

- what was tried
- what failed
- what was selected
- what evidence was produced

This is also why the system feels closer to a workshop than a one-shot run.

## 15. Which document to read next

Read these next depending on your goal:

- first practical workflow: [12 Guided Workflow Tour](./12_GUIDED_WORKFLOW_TOUR.md)
- turn-time prompt and tool structure: [14 Prompt, Skills, and MCP Guide](./14_PROMPT_SKILLS_AND_MCP_GUIDE.md)
- exact startup contract: [02 Start Research Guide](./02_START_RESEARCH_GUIDE.md)
- runtime and Canvas detail: [06 Runtime and Canvas](./06_RUNTIME_AND_CANVAS.md)
- memory and MCP detail: [07 Memory and MCP](./07_MEMORY_AND_MCP.md)
- maintainer architecture: [90 Architecture](./90_ARCHITECTURE.md)
