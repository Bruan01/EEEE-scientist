# 35 Experiment Ledger Guide

The Experiment Ledger is EEEE Scientist's compact research fact table. It keeps the core of one experiment together:

`hypothesis -> configuration -> dataset scope -> run -> metrics -> evidence -> conclusion`

It is not another execution engine and does not replace `bash_exec`. It records plans and results so they can be inspected, compared, and reused in paper writing.

## Where to find it

Open a quest, switch to `Details`, and look below `Metrics Overview` and `Baseline Compare` for `Experiment Ledger`.

- `Total`: experiment rows in the current quest
- `Running`: active work; `planned` means registered but not run yet
- `Completed`: rows with a recorded result
- `Blocked`: rows that need a decision or missing evidence
- Each row shows the title, dataset scope, run id, primary metric, baseline delta, hypothesis, evidence count, and conclusion

Existing quests need no migration. Historical `main_experiment` and `analysis.slice` run artifacts are automatically included and deduplicated by experiment id.

## Register an experiment

Use `artifact.record_experiment` from the artifact MCP namespace. It records a row but does not execute a command:

```text
artifact.record_experiment(
  experiment_id="adapter-lr-001",
  title="Adapter with lower learning rate",
  research_question="Does the adapter improve validation accuracy?",
  hypothesis="The adapter improves accuracy without increasing instability.",
  status="planned",
  baseline_ref={"baseline_id": "cifar10-baseline"},
  dataset_scope="full",
  configuration={"lr": 0.001, "batch_size": 128},
  seed=7,
  command="python train.py --lr 0.001 --seed 7",
  config_paths=["configs/adapter_lr_001.yaml"]
)
```

Run the actual command through `bash_exec`. When it finishes, update the same `experiment_id` with its result, metrics, and evidence paths.

## Minimal research rules

1. Register the hypothesis and configuration before execution.
2. Make `dataset_scope` explicit: `full`, `subset`, or a named split.
3. Record at least a seed, configuration path, or actual command.
4. Attach evidence paths to measured metrics; unsupported numbers remain planning information.
5. Use a new `experiment_id` for each replicate and share a `replicate_group_id`.
6. State whether the result supports, weakens, or leaves the hypothesis undecided.

## Boundary

- The ledger is a lightweight Artifact projection, not a second runtime state machine.
- Existing run artifacts remain compatible; new explicit rows live under `artifacts/experiments/`.
- Updates do not trigger Git checkpoints by default, avoiding a commit for every status edit.
- The read API is `GET /api/quests/<quest_id>/experiments/ledger`.
