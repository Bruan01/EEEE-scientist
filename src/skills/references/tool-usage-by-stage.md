# Tool Usage By Stage

Use this shared reference when a stage skill needs precise guidance for when to use `artifact`, `bash_exec`, and `memory`.

The goal is not a generic tool summary.
The goal is accurate stage control for long-running autonomous quests where durable management, validation, and continuation matter.

## Core roles

- `artifact`
  - canonical state surface
  - canonical verification surface
  - canonical route and handoff surface
- `bash_exec`
  - execution surface
  - first-hand evidence surface
  - local inspection and monitoring surface
- `memory`
  - reusable lesson surface
  - anti-repeat surface
  - authoritative resume-hint surface

## Global rules

### Default stage-start order

For most stage passes:

1. recover durable state with `artifact`
2. retrieve reusable lessons with `memory`
3. execute or inspect with `bash_exec`

### Default stage-end order

For most stage passes:

1. finish the concrete execution or inspection with `bash_exec`
2. convert the result into durable truth with `artifact`
3. write `memory` only if the lesson should change future default behavior

### When `artifact` is mandatory

Use `artifact` before exit whenever:

- a stage result became durable truth
- the active route changed
- the next stage became clear
- a blocker became authoritative
- a user-visible milestone needs to survive resume or handoff

### When `memory` is mandatory

Use `memory` when:

- the next default action should change because of this pass
- repeated failure is likely unless the lesson is preserved
- a reusable success pattern appeared
- the authoritative resume point changed materially

Do not use `memory` as the primary record of baselines, experiments, analyses, or paper state.

## Baseline

### Use `artifact` when

- recovering the active baseline gate state
- checking whether `requested_baseline_ref` or `confirmed_baseline_ref` already exists
- attaching, confirming, waiving, publishing, or blocking a baseline
- recording the accepted comparator and metric contract

### Use `memory` when

- resuming a previously blocked or ambiguous baseline route
- reopening an old command path or environment fix
- repeated failures or environment incidents risk repeating
- a paper-to-code mismatch or accepted caveat should affect later stages

### Use `bash_exec` when

- verifying a local existing comparator
- running reproduction or repair
- checking the evaluator, service, dataset path, or environment
- collecting first-hand evidence from files, logs, or outputs

### Do not

- do not keep running `bash_exec` retries after the same failure class repeats with no real change
- do not stop at attach/import/publish alone; use `artifact.confirm_baseline(...)` or `artifact.waive_baseline(...)`

## Scout

### Use `artifact` when

- reconstructing the current frame from durable state
- reading quest docs before broad search
- recording the evaluation contract, baseline direction, or next anchor
- recording an explicit blocked scout state

### Use `memory` when

- resuming after a pause
- broad literature or repo search is about to start
- you suspect the survey or shortlist was already partially built
- repeated search would likely revisit the same cluster

### Use `bash_exec` when

- inspecting local repo docs, benchmark scripts, evaluator code, or dataset paths
- local code or file inspection materially changes the frame

### Use external search or DeepXiv when

- the task frame, metric contract, or baseline direction is still unclear
- the current neighborhood is too thin or too recent-only
- novelty, field map, or historical lineage is still ambiguous

If DeepXiv is available, prefer it for broad paper-centric discovery, citation expansion, and shortlist triage.
If DeepXiv is unavailable, use search engines directly plus backward and forward citation chaining.

### Do not

- do not continue searching once the next anchor is already clear
- do not treat recent papers as a substitute for field history

## Idea

### Use `artifact` when

- recovering current board state and research branches
- writing the objective contract and current board packet
- recording selected, deferred, and rejected candidates
- submitting a selected idea as a durable route

### Use `memory` when

- resuming an old ideation thread
- checking whether a route is stale and should not be reopened
- broad literature search is about to begin
- a contradiction, failure pattern, or rejected-route reason should influence later ideation

### Use `bash_exec` when

- local code or evaluator inspection changes feasibility or implementation-surface judgment
- local branch or file state matters for choosing a foundation

### Use DeepXiv or search when

- broad, history-aware literature search is needed
- you need seminal papers, turning-point papers, SOTA papers, or citation chaining
- the strongest prior work or field lineage is still unclear

If DeepXiv is available, prefer it for broad paper-centric discovery.
If not, use search engines plus citation chaining directly.

### Multiple strong and feasible ideas

If several candidates are truly strong:

- if they are same-family micro-variants:
  - do not keep them as separate serious routes
  - merge them into one family-level candidate
- if they are meaningfully different families:
  - keep `1` selected route
  - keep `1-2` deferred but serious alternatives durably
- if the next regime is algorithm-first and validation is cheap:
  - keep a small serious frontier, usually `2-3`
  - hand that frontier into `optimize` as candidate briefs
- if validation is expensive:
  - keep one lead plus at most one hedge route

Do not promote every strong-looking idea.
Do preserve the serious non-winners if they are structurally different and still valuable.

### Do not

- do not start from “swap A for B” before naming the important contradiction or bottleneck
- do not let only excitement decide promotion

## Optimize

### Use `artifact` when

- recovering the optimization frontier
- creating candidate briefs
- promoting durable lines
- recording implementation-level optimization candidates
- recording route changes or main measured results

### Use `memory` when

- broad new search is about to start
- the same durable line has recent sibling attempts
- repeated failure, plateau, fusion, or non-retry rules should influence the next move

### Use `bash_exec` when

- running smoke checks
- running quick validations
- running full evaluations
- debugging or validating fusion candidates

### Candidate and frontier rules

- keep candidate briefs small and differentiated
- default serious brief count: `2-3`
- default line promotion count: usually `1`, sometimes `2`, rarely `3`
- do not let one familiar mechanism family fill the whole promoted slate
- keep implementation-level live pools small, usually `2-3`

### Do not

- do not create a durable line for every plausible brief
- do not treat an implementation candidate as a new durable line

## Experiment

### Use `artifact` when

- recovering runtime refs, baseline refs, and quest state before the run
- recording the main experiment with `artifact.record_main_experiment(...)`
- recording the route decision after the measured result

### Use `memory` when

- reopening an old command path
- retrying after a known failure pattern
- environment fixes or comparability caveats may repeat

### Use `bash_exec` when

- running smoke or pilot checks
- running the real experiment
- monitoring long-running jobs
- validating outputs and logs

### Practical trigger rules

- if the command path or evaluator wiring is still unclear, start with a bounded smoke or pilot
- if the path is already concrete, go straight to the real run
- if the result is suspicious or confounded, do not blindly rerun; route through diagnosis, decision, or analysis

### Do not

- do not treat a run as complete before `artifact.record_main_experiment(...)` succeeds
- do not let logs alone become the accepted system state

## Analysis Campaign

### Use `artifact` when

- durable lineage matters
- multiple slices exist
- paper/rebuttal/review traceability matters
- campaign launch, slice recording, synthesis, or closeout becomes durable truth

### Use `memory` when

- resuming an old campaign
- repeated slice failures or comparability caveats may recur
- a cross-slice lesson should change later defaults

### Use `bash_exec` when

- running slices
- monitoring slices
- validating outputs
- diagnosing slice failures

### Route rules

- if one bounded question is enough and lineage does not matter, a lighter report route can be enough
- if multiple slices, traceability, or replay matter, use an artifact-backed campaign
- if multiple slices are valuable, run claim-critical ones first and queue the rest

### Do not

- do not leave slice truth only in chat
- do not start every plausible slice before the first decisive ones return evidence

## Decision

### Use `artifact` when

- making any consequential route judgment
- recording verdict, action, reason, evidence paths, and next direction

### Use `memory` when

- the authoritative resume point changed
- a do-not-reopen rule or reusable route rationale should persist

### Use `bash_exec` when

- local evidence is still missing and a quick concrete check would materially change the route judgment

### Candidate-choice rule

If several options are plausible:

- still choose one winner when local evidence is enough
- record the main rejected alternative and why it lost
- only ask the user when the choice is genuinely preference, scope, or cost sensitive and cannot be derived locally

## Finalize

### Use `artifact` when

- checking global quest status
- checking paper contract health
- reading the scoreboard
- completing the quest after explicit approval

### Use `memory` when

- a reusable closure lesson or final authoritative checkpoint should persist

### Use `bash_exec` when

- building, exporting, compiling, or locally verifying final deliverables

### Do not

- do not finalize through a still-blocked paper or evidence contract
- do not call `artifact.complete_quest(...)` before explicit approval

## Intake Audit

### Use `artifact` when

- recovering mixed state
- reading quest docs, artifacts, and current runtime state
- recording the current board packet, trust ranking, or next anchor recommendation

### Use `memory` when

- an old checkpoint, stale route, or resume point may still contaminate current judgment

### Use `bash_exec` when

- local file tree, git state, or output inspection is needed to resolve ambiguity

### Do not

- do not let a mixed-state quest proceed on conversational guesses about the active mainline

## Review

### Use `artifact` when

- reading paper contract health
- reading quest docs and evidence state
- recording review findings, revision routes, and experiment requests

### Use `memory` when

- recurring review weaknesses or novelty caveats should persist

### Use `bash_exec` when

- building, compiling, or checking manuscript artifacts locally

### Routing rule

- if the problem is missing evidence, route to `analysis-campaign`
- if the problem is wording, positioning, or claim scope, route to `write`
- if the problem is novelty ambiguity, route to `scout`

## Rebuttal

### Use `artifact` when

- reading reviewer packet state
- recording response matrix, action plan, manuscript delta route, and evidence route

### Use `memory` when

- a recurring rebuttal pattern or claim downgrade should influence later responses

### Use `bash_exec` when

- building, compiling, or verifying local manuscript artifacts

### Do not

- do not hide an evidence gap under rhetorical rewriting

## Paper Plot

### Use `artifact` when

- the figure requirement, output path, and downstream paper role need to be explicit

### Use `bash_exec` when

- rendering figures
- rerendering after data or spec change
- validating output existence and export

### Use `memory` when

- a plotting failure or rendering lesson is likely to recur

### Do not

- do not use `figure-polish` when the figure is still missing; first create the structured first-pass figure here

## Figure Polish

### Use `artifact` when

- the figure already exists and the remaining blocker is presentation quality, not missing evidence

### Use `bash_exec` when

- rerendering polished versions
- checking exports

### Use `memory` when

- a reusable polish or style lesson will affect later figures

## Mentor

### Use `artifact` when

- reading the current board, route, blocker, or paper state before giving calibration advice

### Use `memory` when

- a reusable calibration lesson, founder preference, or do-not-repeat route mistake should persist

### Use `bash_exec` when

- local evidence inspection is needed before making a real calibration judgment

### Do not

- do not let mentor advice float free from the current durable state
