# Codex 实验卡片、复现包与卡住监控设计

## 1. 背景

EEEE Scientist 已经在项目 `Details` 页面提供 `Metrics Overview`、`Baseline Compare` 和 `Experiment Ledger`。当前台账可以汇总显式实验记录以及历史 `main` / `analysis` 运行，但还缺少三个面向实际科研执行的能力：

1. 在同一张实验卡片中同时看到假设、配置、运行健康、结果和下一步；
2. 用固定的代码、数据、环境和命令生成可复现材料；
3. 区分“暂时没有输出但仍在运行”和“疑似卡住”，减少误杀长时间 MPS 任务的风险。

本设计只覆盖当前项目的 Codex runner 与 `bash_exec` 实验，继续使用现有 quest、artifact、daemon 和 Experiment Ledger 结构。

## 2. 目标与非目标

### 目标

- 让每条实验在 Details 页面形成一条可审计的生命周期记录；
- 将运行健康作为实验记录的一部分，而不是独立的 UI 临时状态；
- 为已完成实验生成轻量、可分享、不会复制大数据的复现目录；
- 对无进展任务给出分级提示，但不自动终止训练进程；
- 只监控活跃实验，保持历史项目和前端响应速度；
- 保持已有实验记录、旧项目数据、精简模式和其他 runner 的兼容性。

### 非目标

- 不实现新的实验队列或分布式调度器；
- 不在第一版支持 Claude、Kimi、OpenCode 等 runner 的专用健康采集；
- 不自动杀死 MPS、GPU 或长时间运行的 bash 任务；
- 不复制数据集、checkpoint 或完整运行环境到复现包；
- 不改变现有 Canvas、Copilot 或连接器的交互合同。

## 3. 设计原则

### 3.1 复用现有事实源

`ArtifactService` 和现有 `Experiment Ledger` 继续作为事实投影层。Codex 的 bash 运行事件、artifact 记录和结果文件是输入；新的健康字段和复现元数据在同一投影中提供，不建立第二套实验状态机。

### 3.2 状态与判断分离

实验生命周期状态表示实验业务进度；健康状态表示当前运行是否有可观察进展。`quiet` 和 `suspected_stalled` 不覆盖 `running` 的业务语义，而是附加的健康信号，避免把“没有日志”直接解释为失败。

### 3.3 引用优先

复现包保存数据、checkpoint 和完整日志的路径、大小与哈希引用。只有 manifest、命令、环境白名单、指标摘要和必要的小型日志摘要进入包内，避免复制大型科研资产。

## 4. 生命周期与数据模型

### 4.1 生命周期

```text
planned -> queued -> running -> completed
                         |          |
                         |          +-> failed
                         |          +-> cancelled
                         v
                       quiet -> suspected_stalled
                         |              |
                         +--------------+
```

`quiet` 和 `suspected_stalled` 是运行健康标签，也可以在实验仍处于 `running` 时出现。恢复输出或文件进展后，健康标签回到 `healthy`，实验生命周期仍保持 `running`。

### 4.2 实验记录字段

现有字段继续保留，并增加以下结构化字段：

```json
{
  "experiment_id": "exp-001",
  "title": "SE-only matched run",
  "hypothesis": "...",
  "status": "running",
  "dataset_scope": "cifar-10",
  "configuration": {},
  "seed": 7,
  "run_id": "run-001",
  "execution": {
    "runner": "codex",
    "executor": "bash_exec",
    "command": "python -m train ...",
    "working_directory": "/path/to/quest",
    "started_at": "2026-10-13T00:00:00Z",
    "updated_at": "2026-10-13T00:02:00Z",
    "last_output_at": "2026-10-13T00:01:30Z",
    "last_progress_at": "2026-10-13T00:01:30Z",
    "health": "healthy",
    "health_reason": null,
    "process_alive": true,
    "output_bytes": 4096
  },
  "environment": {
    "git_commit": "abc123",
    "python_version": "3.13.3",
    "device": "mps",
    "dependency_lock": "uv.lock"
  },
  "primary_metric": {},
  "metrics_summary": {},
  "evidence_paths": [],
  "conclusion": "",
  "next_action": ""
}
```

`command`、工作目录和环境字段必须经过敏感信息清理。Token、Cookie、API Key、带认证信息的代理 URL 和其他密钥不得进入页面或复现包。

## 5. 健康监控规则

### 5.1 监控范围

daemon 只检查 `planned`、`queued`、`running`、`quiet` 和 `suspected_stalled` 的实验。已完成、失败和取消的实验只读 artifact，不再查询进程。

### 5.2 默认阈值

- 连续 2 分钟没有输出或有效进展：标记 `quiet`；
- 连续 10 分钟没有输出、文件增长、进程心跳或可观察资源进展：标记 `suspected_stalled`；
- 一旦出现新的 stdout/stderr、指标文件增长、artifact 更新或进程恢复信号，立即回到 `healthy`；
- 进程退出时根据退出码和已有证据进入 `completed`、`failed` 或 `cancelled`，不因静默单独判定失败。

阈值应作为运行配置项提供，默认值适合普通 Codex bash 任务；长时间 MPS 任务可以提高阈值。第一版只提示，不自动停止。

### 5.3 低开销实现

- 后台检查间隔默认 10 秒；
- 只处理活跃实验；
- 每次只读取进程摘要、文件大小/修改时间和最近事件，不读取完整日志；
- 前端不按秒刷新，通过已有 quest 更新签名和手动刷新获取最新投影；
- 健康变化写入轻量事件，不重复写入完整运行输出。

## 6. 复现包

### 6.1 目录

生成到对应实验目录：

```text
reproducibility/
├── manifest.json
├── run.sh
├── environment.json
├── command.txt
├── git.txt
├── metrics.json
├── evidence.json
└── logs/
```

### 6.2 文件合同

- `manifest.json`：实验 ID、状态、生成时间、数据/结果引用和文件哈希；
- `run.sh`：只生成可执行命令，不自动执行；
- `environment.json`：Python、依赖锁文件、runner、设备和允许公开的环境字段；
- `command.txt`：经过脱敏的原始 bash 命令；
- `git.txt`：commit、分支和工作树状态摘要；
- `metrics.json`：主指标、baseline、差值和指标来源；
- `evidence.json`：证据路径、存在性、大小和哈希；
- `logs/`：有限大小的摘要日志，完整日志保留原路径引用。

生成失败时返回结构化错误，并保留已经生成的安全中间文件；不影响实验结果和 quest 状态。

## 7. API、MCP 与前端

### 7.1 API

保留并扩展：

```text
GET /api/quests/<quest_id>/experiments/ledger
```

返回每条记录的 `execution.health`、最近进展时间和复现包状态。

新增：

```text
POST /api/quests/<quest_id>/experiments/<experiment_id>/reproducibility
```

该接口只生成复现材料，不执行实验命令。

### 7.2 MCP

保留现有：

- `artifact.record_experiment`
- `artifact.get_experiment_ledger`

如需要 Codex 主动生成复现包，再增加只生成文件的 `artifact.export_reproducibility_bundle`。健康监控由 daemon 负责，不要求 Codex 高频调用工具。

### 7.3 Details 页面

在现有 `Experiment Ledger` 中增加：

- `Quiet` 和 `Suspected stalled` 统计卡；
- 状态与健康双标签；
- 展开式详情区域；
- 查看日志、复制复现命令、导出复现包、刷新状态按钮；
- 精简模式下默认隐藏命令、环境和证据明细，只显示状态、指标和异常原因。

不新增 Canvas 页面，不改变右侧 Copilot 和现有详情区块顺序。

## 8. 错误处理与兼容性

- 没有历史运行元数据的旧记录显示“未记录”，不阻断页面；
- 找不到进程时显示“状态未知”或“疑似停止”，不直接伪造失败；
- 复现包中不存在的路径保留原引用并标记 `missing`；
- 旧 artifact 仍按当前 ledger 规则投影；
- API 不可用时，Details 保留已有台账内容并显示局部刷新失败；
- 运行监控异常不得阻止 Codex、bash 或连接器继续工作。

## 9. 验收测试

### 功能验收

1. 创建 `planned` 实验，Details 显示 Planned；
2. 通过 Codex 启动一个有周期输出的 bash 实验，显示 Running/Healthy；
3. 启动一个短时间无输出但进程存在的任务，显示 Quiet，不自动停止；
4. 终止一个无进展任务，显示 Suspected stalled 或 Failed，并保留日志；
5. 正常完成实验，显示 Completed、主指标、baseline 差值和证据；
6. 点击导出，生成完整复现目录，敏感字段已脱敏；
7. 重启 daemon、刷新浏览器，实验状态和复现包仍可读取；
8. 精简模式下页面隐藏高级字段但保留异常状态和主指标。

### 回归验收

- 现有 `Experiment Ledger` 历史记录数量和内容不减少；
- 既有项目打开、Canvas、Copilot、连接器和 token 统计正常；
- 其他 runner 的已有配置和页面不受影响；
- 10 条以上活跃实验不会造成明显 UI 卡顿；
- 纯 ledger、API 合同、MCP 工具和前端构建测试全部通过。

## 10. 分阶段实现

### Phase 1：数据合同与 ledger 投影

扩展实验记录字段、健康字段和 API 类型，保持旧数据兼容。

### Phase 2：Codex bash 健康采集

接入现有 bash 运行状态和文件进展，加入低频监控与阈值配置。

### Phase 3：复现包

实现脱敏、manifest、命令、环境、Git、指标和证据导出。

### Phase 4：Details UI 与验收

补充统计卡、详情展开、操作按钮、精简模式展示和端到端验收。

## 11. 完成定义

当一个 Codex + bash 实验可以在 Details 页面被登记、运行、监控、完成、导出复现材料，并且重启后状态仍可恢复；旧项目与历史 artifact 不受影响；全部目标测试通过时，本功能视为完成。
