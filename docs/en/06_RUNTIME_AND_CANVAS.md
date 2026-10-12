# 06 Runtime and Canvas: Understand Runtime Flow and Canvas

This document describes the **current implemented behavior** of DeepScientist Core in this repository.

It is intentionally based on the real runtime code rather than older architecture drafts.

## 1. Source Of Truth

The behavior described here is derived from these files:

- `src/prompts/system.md`
- `src/skills/scout/SKILL.md`
- `src/skills/baseline/SKILL.md`
- `src/skills/idea/SKILL.md`
- `src/skills/experiment/SKILL.md`
- `src/skills/analysis-campaign/SKILL.md`
- `src/skills/write/SKILL.md`
- `src/skills/finalize/SKILL.md`
- `src/skills/decision/SKILL.md`
- `src/deepscientist/prompts/builder.py`
- `src/deepscientist/daemon/app.py`
- `src/deepscientist/daemon/api/handlers.py`
- `src/deepscientist/runners/codex.py`
- `src/deepscientist/mcp/server.py`
- `src/deepscientist/artifact/service.py`
- `src/deepscientist/quest/service.py`
- `src/deepscientist/quest/node_traces.py`
- `src/deepscientist/gitops/diff.py`
- `src/ui/src/lib/api/lab.ts`
- `src/ui/src/lib/plugins/lab/components/LabQuestGraphCanvas.tsx`

## 2. One-Sentence Summary

The current system is **not** a heavy daemon-driven stage engine.

It is a **prompt-led, skill-led, file-led quest runtime** where:

- the daemon handles queueing, turn execution, API, connectors, and recovery
- the prompt and skill files define most of the research discipline
- durable state lives in quest files, memory cards, artifacts, Git, and run logs
- the UI Canvas is reconstructed from Git branches plus durable artifact records and raw quest events

## 3. Canonical Anchor Model

The current system prompt defines these canonical stage anchors:

- `scout`
- `baseline`
- `idea`
- `experiment`
- `analysis-campaign`
- `write`
- `finalize`

`decision` is **not** a stage anchor.
It is a cross-cutting skill used when continuation, branching, reset, stop, or user decision handling is non-trivial.

The graph is explicitly non-linear.
The prompt allows backward motion such as:

- `write -> analysis-campaign`
- `write -> experiment`
- `write -> scout`
- `experiment -> idea`
- `analysis-campaign -> experiment`

## 4. What Actually Happens When A User Sends A Command

There are two different paths:

### 4.1 Structured slash/control path

Commands such as status, graph, pause, stop, and resume are handled directly by the daemon/API layer.

Typical examples:

- `GET /api/quests/<id>/workflow`
- `GET /api/quests/<id>/node-traces`
- `GET /api/quests/<id>/artifacts`
- `GET /api/quests/<id>/events?format=raw`
- `GET /api/quests/<id>/git/branches`
- `POST /api/quests/<id>/control`

This path does **not** invoke the runner unless the action itself causes a new turn to be scheduled.

### 4.2 Plain user message path

Normal conversation text goes through the quest mailbox and turn scheduler.

The actual sequence is:

1. UI, TUI, or connector submits a user message.
2. The daemon appends it to quest history.
3. If the quest is idle, the daemon schedules a new turn immediately.
4. If a turn is already running, the message is queued for later delivery through `artifact.interact(...)`.

This means the first message typically launches the turn, while later follow-up messages are delivered through the artifact-thread continuity mechanism.

## 5. Actual Turn Lifecycle

The current runtime flow is:

1. `submit_user_message(...)`
2. `schedule_turn(...)`
3. worker thread enters `_drain_turns(...)`
4. `_run_quest_turn(...)`
5. choose runner
6. choose skill
7. build prompt
8. start Codex runner
9. agent uses MCP tools, files, Git, and shell
10. runner exits and runtime records run outputs

### 5.1 Scheduling behavior

The daemon keeps a per-quest turn state:

- `running`
- `pending`
- `stop_requested`

If a quest is already running, new user messages do **not** start a second runner process.
They mark the turn as pending and are later surfaced via `artifact.interact(include_recent_inbound_messages=True)`.

### 5.2 Which skill is used for the turn

The skill selection rule is currently simple and important:

1. If the latest user message replies to an active blocking interaction thread, use `decision`.
2. Otherwise read `quest.yaml.active_anchor`.
3. If `active_anchor` is one of the standard skills, use that.
4. Otherwise fall back to `decision`.

This is implemented in `src/deepscientist/daemon/app.py` via `_turn_skill_for(...)`.

## 6. Important Reality: Anchor Progression Is Not Strongly Automated

This is the most important implementation fact to understand.

New quests start with:

- `active_anchor: baseline`

But the daemon currently does **not** act like a strict workflow engine that automatically advances every quest from stage to stage.

In practice:

- the prompt explains the canonical research graph
- the active skill for a turn usually comes from `quest.yaml.active_anchor`
- the agent is expected to follow the skill, write durable outputs, and use `decision` when routing changes
- durable files and artifacts carry continuity much more than a centralized stage-transition table does

So today the system behaves more like:

- a disciplined research copilot runtime
- with durable state and strong conventions
- not yet a full automatic stage controller

## 7. How The Prompt Is Built

For each turn, `PromptBuilder.build(...)` composes a single prompt from these blocks:

1. system prompt from `src/prompts/system.md`
2. runtime context
3. active communication surface
4. canonical skill root and skill paths
5. quest context files
6. recent durable state
7. interaction style instructions
8. priority memory for this turn
9. recent conversation window
10. current turn attachments
11. current user message

The runtime context includes:

- `ds_home`
- `quest_id`
- `quest_root`
- `active_anchor`
- `active_branch`
- `requested_skill`
- `runner_name`
- `model`
- `conversation_id`
- `default_locale`
- built-in MCP namespace list

### 7.1 Active communication surface

The builder now injects a surface block that tells the agent which user-facing surface is active for the current turn.

Typical fields include:

- latest user source
- whether the surface is local or connector-driven
- active connector name and chat type when applicable
- QQ-specific milestone media policy when the current turn came from QQ

This is intentionally lightweight.
It does not create a separate per-connector workflow engine.
It only makes the current turn's communication contract explicit.

### 7.2 Current turn attachments

If the newest inbound user message carries attachment metadata, the builder injects a small attachment summary block.

The intent is:

- tell the agent that attachments exist
- point the agent toward readable sidecars when available
- avoid forcing the agent to guess whether a binary attachment matters

This block is a summary surface, not a full attachment-processing pipeline.

### 7.3 Skill files are referenced by path, not inlined

The builder injects the canonical skill root and the concrete stage skill file paths.

The system prompt then tells the agent to open the corresponding skill file for the active stage.

That means the runtime currently works like this:

- prompt gives the agent the skill file locations
- agent reads the appropriate skill file
- skill body stays on disk instead of being pasted into every prompt

### 7.4 Memory injection is stage-aware

`PromptBuilder` uses a stage-specific memory plan.

Examples:

- `scout` prioritizes quest/global `papers`, `knowledge`, `decisions`
- `baseline` prioritizes `papers`, `decisions`, `episodes`, `knowledge`
- `idea` prioritizes `papers`, `ideas`, `decisions`, `knowledge`
- `experiment` prioritizes `ideas`, `decisions`, `episodes`, `knowledge`
- `analysis-campaign` also pulls relevant `papers`

So memory retrieval is not random.
It is biased by the active stage and then expanded by user-message search terms.

## 8. Runner Behavior

The current authoritative runner path is Codex.

The Codex runner:

- prepares an isolated runtime home under `.ds/codex-home/`
- inherits the configured Codex home semantics (`config.toml`, `auth.json`, `skills/`, `agents/`, `prompts/`)
- overlays quest-local `.codex/skills/` and `.codex/prompts/` on top of that runtime copy
- injects DeepScientist built-in MCP servers into `.ds/codex-home/config.toml`
- runs `codex --search exec --json --cd <quest_root> --skip-git-repo-check --model <model> -`

The injected built-in MCP namespaces are exactly:

- `memory`
- `artifact`
- `bash_exec`

This matches the repo rule that built-in Core MCP stays minimal at the namespace level.

## 9. Built-In MCP Surface

### 9.1 `memory`

The `memory` namespace currently provides:

- `write`
- `read`
- `search`
- `list_recent`
- `promote_to_global`

Memory cards are Markdown files with YAML frontmatter and are managed as durable files.

### 9.2 `artifact`

The `artifact` namespace currently provides the main structured continuity and Git-aware operations:

- `record`
- `checkpoint`
- `prepare_branch`
- `publish_baseline`
- `attach_baseline`
- `arxiv`
- `refresh_summary`
- `render_git_graph`
- `interact`

This is intentional:

- Git behavior is exposed through `artifact`
- there is no separate public `git` MCP namespace

### 9.3 `bash_exec`

The `bash_exec` namespace is the durable shell execution surface.

It supports:

- detached execution
- wait/create execution
- read log
- kill session
- list sessions

This is the correct shell path for long-running, auditable quest-local commands.

## 10. Why `artifact.interact(...)` Is Central

`artifact.interact(...)` is the real continuity spine across:

- web UI
- TUI
- local conversation surfaces
- external connectors

It does several jobs at once:

1. writes a durable artifact
2. optionally checkpoints important interactions
3. updates interaction thread state
4. optionally pushes the message to bound conversations/connectors
5. consumes queued inbound user messages back to the agent
6. returns recent interaction context and delivery results

### 10.1 Interaction kinds

The main kinds are:

- `progress`
- `milestone`
- `decision_request`
- `approval_result`

### 10.2 Reply modes

The main reply modes are:

- `none`
- `threaded`
- `blocking`

Current runtime rule:

- blocking requests become waiting user decisions
- threaded updates remain conversational progress threads

### 10.3 Mailbox behavior

If the agent calls `artifact.interact(include_recent_inbound_messages=True)`:

- queued user messages can be consumed
- the agent receives them as recent inbound messages
- the runtime also returns recent interaction records
- if there is no new user message, the runtime explicitly tells the agent to continue current work

This is why later user follow-up messages can reach a long-running turn without launching a second runner.

## 11. Connector Delivery Reality

When `artifact.interact(...)` is allowed to deliver outward, delivery targets are selected from quest bindings.

The runtime currently uses:

- bound conversations from `<quest_root>/.ds/bindings.json`
- connector config from the home config
- a routing policy

The current routing policy options are:

- `fanout_all`
- `primary_only`
- `primary_plus_local`

The default behavior is effectively:

- local conversation stays included
- one preferred non-local connector may also receive the update

So if multiple connectors are configured, the system does **not** blindly broadcast everywhere unless the routing policy asks for that.

## 12. Durable Runtime Outputs

During and after a run, continuity is reconstructed from durable files such as:

- `quest.yaml`
- `brief.md`
- `plan.md`
- `status.md`
- `SUMMARY.md`
- `memory/*`
- `artifacts/*`
- `.ds/events.jsonl`
- `.ds/user_message_queue.json`
- `.ds/interaction_journal.jsonl`
- `.ds/codex_history/<run_id>/events.jsonl`
- `.ds/bash_exec/*`

This is why the system can recover context from files without needing a database.

## 13. Quest Event Stream And ACP Compatibility

The daemon also exposes quest events through:

- `GET /api/quests/<id>/events`

This endpoint can return:

- native event payloads
- ACP-compatible updates
- optional ACP Python SDK notifications when the bridge is available

Current practical rule:

- web and TUI should treat the quest event stream as the live update channel
- `format=acp` returns ACP-style session updates derived from quest events
- the ACP bridge is optional and is not the core source of truth

So the runtime model remains:

- quest files and artifacts are the durable source of truth
- quest events are the live operational stream
- ACP is a compatibility envelope layered on top

## 14. How Operational Views Are Reconstructed

Neither workflow nor Canvas is stored as one authoritative graph document.

Instead, the runtime reconstructs operational views from:

- core quest documents
- recent runs
- recent artifacts
- raw quest events from `.ds/events.jsonl`
- parsed Codex history events for compatibility surfaces

The compatibility workflow payload from `QuestService.workflow(...)` contains:

- `entries`
- `changed_files`

### 13.1 `entries`

Entries can include at least:

- quest documents
- run summaries
- parsed tool calls from Codex history
- artifacts

### 13.2 `changed_files`

This is a compact recent file set assembled from:

- core quest documents
- run outputs
- artifact paths

It is mainly used by the UI to show relevant recent files.

## 15. How Canvas Is Built

There are currently three practical Canvas views:

- branch view
- event view
- stage view

These do **not** come from the same source.

## 16. Branch View: Git-Derived Canvas

Branch Canvas comes from:

- `list_branch_canvas(...)`

This inspects Git refs and quest branch metadata, then produces:

- `nodes`
- `edges`
- `views.ideas`
- `views.analysis`

### 15.1 Branch nodes

Each branch node includes fields such as:

- `ref`
- `label`
- `branch_kind`
- `tier`
- `mode`
- `parent_ref`
- `compare_base`
- `current`
- `head`
- `updated_at`
- `subject`
- `commit_count`
- `ahead`
- `behind`
- `run_id`
- `run_kind`
- `idea_id`
- `worktree_root`
- `latest_metric`
- `latest_summary`
- `recent_artifacts`

### 15.2 Branch edges

Branch edges are Git/branch-structure edges:

- relation = `branch`
- source = parent ref
- target = child ref

### 15.3 Two branch modes already exist conceptually

The branch view already has enough metadata to support the two user mental models:

1. major branches for different ideas / main implementations
2. smaller analysis branches under one accepted main experimental line

The backend exposes `tier`, `mode`, `branch_kind`, `idea_id`, and related metadata specifically to support this kind of UI distinction.

### 15.4 Extra experiments become child branches

The current runtime contract is:

- whenever extra experiments are needed after a durable result, they should be launched through `artifact.create_analysis_campaign(...)`
- this applies even when there is only one extra experiment; a one-slice campaign is still the correct shape
- the campaign should branch from the current workspace/result node, not silently rewrite the completed parent node in place
- this is what keeps Git history and Canvas lineage aligned

## 17. Event View: Artifact-And-Event-Derived Canvas

The current Lab Canvas event view is reconstructed from durable artifact records plus raw quest events.

In local quest mode the pipeline is:

1. `QuestService.artifacts(...)`
2. raw quest events from `.ds/events.jsonl` through `GET /api/quests/<id>/events?format=raw`
3. frontend local trace builder in `src/ui/src/lib/api/lab.ts`
4. frontend maps trace items into graph nodes

### 16.1 Event nodes

Each durable artifact becomes one primary `event_node` trace item.

The trace captures:

- selection ref
- title
- branch name
- inferred stage key
- worktree relative path
- action list
- summary
- counts
- updated time
- artifact id / kind
- head commit
- changed files
- payload snapshot

An event node may represent:

- an artifact
- a stage-significant decision or report
- the related MCP / tool-call history attached to that artifact
- another operational event when no durable artifact exists yet

### 16.2 Event edges

The current frontend edge rule is simple:

- group event nodes by branch
- sort by `updated_at`
- connect each item to the next item on the same branch

So current event edges are **sequence edges**, not deep semantic-causal edges.

## 18. Stage View: Aggregated Trace Canvas

Stage view is also built from node traces, but durable artifact traces are grouped by:

- branch name
- inferred stage key

Each group becomes one `stage_node`.

Current stage edges are also built as chronological edges **within a branch** after sorting by `updated_at`.

So stage view is:

- aggregated
- branch-aware
- time-ordered
- but still not a fully explicit research dependency graph

## 19. Important Normalization Rules In Trace Materialization

Current local trace materialization uses the canonical prompt anchors:

- `scout`
- `baseline`
- `idea`
- `experiment`
- `analysis-campaign`
- `write`
- `finalize`

`decision` is treated as cross-cutting.
Decision artifacts are merged into the effective canonical stage for branch and stage summaries instead of becoming a standalone stage anchor.

## 20. What Canvas Does Not Yet Mean

The current Canvas should **not** be interpreted as:

- a fully authoritative workflow state machine
- a complete semantic dependency graph
- a perfect mirror of the canonical prompt graph

Today it is better understood as:

- a reconstructed operational map
- from Git topology plus durable artifacts plus raw quest events

## 21. Current Gaps To Keep In Mind

The following gaps are real in the current implementation:

### 20.1 Anchor progression is weakly enforced

`active_anchor` is not robustly auto-advanced by a central scheduler.

### 20.2 Prompt graph is richer than visualization graph

Prompt anchors include `analysis-campaign`, `write`, and `finalize` distinctly, but node trace grouping compresses some of them.

### 20.3 Event/stage edges are mostly chronological

They are useful and readable, but they are not yet explicit evidence edges or decision-dependency edges.

### 20.4 Canvas is reconstructed, not authored directly

There is no single canonical graph database or graph file that the runtime treats as the one true source.

## 22. Practical Mental Model For Developers

If you are modifying this system, the safest current mental model is:

1. user message or connector event enters the daemon
2. daemon schedules one quest turn
3. active skill is chosen from `active_anchor` or `decision`
4. prompt is assembled from system prompt, skill paths, quest files, memory, and recent history
5. Codex runs inside the quest repo with built-in MCP namespaces
6. agent writes memory, artifacts, shell sessions, Git checkpoints, and reports
7. `artifact.interact(...)` keeps user-facing continuity alive
8. workflow and Canvas are reconstructed from those durable outputs and the raw quest event stream

## 23. Suggested Next Hardening Direction

If this runtime is tightened further, the most valuable next steps would be:

1. make `active_anchor` advancement more explicit and durable
2. keep remote and local Canvas semantics equally artifact-first
3. add stronger decision/evidence edges in Canvas
4. keep the core small while making the protocol clearer rather than adding a large scheduler

That direction stays aligned with the current repository constraints:

- small core
- prompt-led workflow
- artifact-led Git behavior
- minimal built-in MCP namespaces
- durable file state instead of database-first orchestration
