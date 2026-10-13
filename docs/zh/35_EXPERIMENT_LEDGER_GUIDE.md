# 35 实验账本指南

实验账本是 EEEE Scientist 的“科研事实表”。它把一次实验的核心信息放在同一行：

`假设 → 配置 → 数据范围 → 运行 → 指标 → 证据 → 结论`

它不是新的实验执行器，也不会替代 `bash_exec`。它只负责把计划和结果记成可以回查、比较、写论文的记录。

## 在哪里看

打开项目后进入右侧的 `Details`，在 `Metrics Overview` 和 `Baseline Compare` 下面可以看到 `Experiment Ledger`。

- `Total`：当前项目的实验条数
- `Running`：正在推进的实验；`planned` 是已经登记但尚未运行的实验
- `Completed`：已有结果的实验
- `Blocked`：需要人工决定或补材料的实验
- 每条记录会显示实验名、数据范围、run id、主指标、相对 baseline 的变化、假设、证据数量和结论

历史项目不需要迁移：已有的 `main_experiment` 和 `analysis.slice` 运行记录会自动出现在账本里，并按实验 id 去重。

## 让 agent 登记实验

在 artifact MCP 中使用 `artifact.record_experiment`。它只写入账本，不启动命令：

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

真实运行仍然通过 `bash_exec` 完成。运行完成后再次用同一个 `experiment_id` 更新：

```text
artifact.record_experiment(
  experiment_id="adapter-lr-001",
  status="completed",
  run_id="main-adapter-lr-001",
  metrics_summary={"accuracy": 0.912},
  primary_metric={
    "id": "accuracy",
    "value": 0.912,
    "baseline_value": 0.884,
    "delta_vs_baseline": 0.028
  },
  evidence_paths=[
    "experiments/main/main-adapter-lr-001/RESULT.json",
    "experiments/main/main-adapter-lr-001/RUN.md"
  ],
  conclusion="Accuracy improved over the confirmed baseline."
)
```

## 给科研人员的最小规则

1. 先登记假设和配置，再运行实验。
2. `dataset_scope` 写清楚是 `full`、`subset` 还是特定 split。
3. 至少记录一个 seed、配置路径或实际命令。
4. 指标必须带证据路径；没有证据的数字只保留为计划信息，不当作论文结果。
5. 重复实验使用不同的 `experiment_id`，用相同的 `replicate_group_id` 关联。
6. 结论写“支持 / 不支持 / 还不能判断”，不要只写“跑完了”。

## 设计边界

- 账本是 Artifact 的一个轻量投影，不另建第二套运行状态。
- 已有 run artifact 会自动兼容；新记录保存在项目的 `artifacts/experiments/`。
- 记录默认不触发 Git checkpoint，避免每次更新实验状态都产生提交；实验代码和结果文件仍按原有运行流程保存。
- API 读取接口是：`GET /api/quests/<quest_id>/experiments/ledger`。
