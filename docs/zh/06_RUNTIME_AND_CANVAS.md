# 06 运行时与 Canvas：理解运行流程和图结构

本文描述的是本仓库里 **DeepScientist Core 的当前实现行为**（以代码为准），而不是旧的架构草案。

## 1. 以哪些文件为准

本文的结论来自这些核心文件（不需要全部读完，按需定位即可）：

- Prompt / Skills
  - `src/prompts/system.md`
  - `src/skills/*/SKILL.md`
  - `src/deepscientist/prompts/builder.py`
- 运行时与 API
  - `src/deepscientist/daemon/app.py`
  - `src/deepscientist/daemon/api/handlers.py`
  - `src/deepscientist/daemon/api/router.py`
- 任务状态 / Artifact / Memory
  - `src/deepscientist/quest/service.py`
  - `src/deepscientist/artifact/service.py`
  - `src/deepscientist/memory/service.py`
- 前端 Canvas（Lab）
  - `src/ui/src/lib/api/lab.ts`
  - `src/ui/src/lib/plugins/lab/components/LabQuestGraphCanvas.tsx`

## 2. 一句话总结

当前系统不是“重型的阶段机（stage engine）”。

它更像是一个 **Prompt-led + Skill-led + File-led** 的本地研究运行时：

- daemon 负责：排队、turn 调度、API、connector、恢复
- prompt/skills 负责：研究纪律、产物规范、什么时候需要决策
- 持久化真相在文件中：quest 文档、artifacts、memory 卡片、Git、bash 日志
- Canvas 从 Git + artifacts + events 重建，而不是维护一份中心化图数据库

## 3. Anchor（阶段）模型

system prompt 定义的 canonical anchors（会写入 `quest.yaml.active_anchor`）：

- `scout`
- `baseline`
- `idea`
- `experiment`
- `analysis-campaign`
- `write`
- `finalize`

`decision` **不是**一个固定 stage；它是跨阶段的 skill：当继续/停止/分支/归零/需要用户决策时使用。

本系统默认允许“非线性回退”：

- `write -> analysis-campaign / experiment / scout`
- `experiment -> idea`
- `analysis-campaign -> experiment`

## 4. 用户发来一条命令/消息后发生什么

有两条路径：

### 4.1 结构化命令（daemon 直接处理）

例如：

- `GET /api/quests/<id>/workflow`
- `GET /api/quests/<id>/node-traces`
- `GET /api/quests/<id>/artifacts`
- `GET /api/quests/<id>/events?format=raw|acp`
- `GET /api/quests/<id>/git/branches`
- `POST /api/quests/<id>/control`（pause/stop/resume）

这类请求通常不会启动 runner（除非某个动作明确触发 turn 调度）。

### 4.2 普通对话文本（走 mailbox + turn 调度）

顺序大致为：

1. UI/TUI/connector 提交用户消息
2. daemon 把消息写入 quest history
3. 如果 quest 空闲：立刻调度新 turn
4. 如果 quest 正在运行：消息进入 mailbox 队列，等待 agent 调用 `artifact.interact(...)` 时再投递

关键点：第一条消息往往启动 turn；后续消息通过 `artifact.interact(...)` 才会被“送达 agent”。

## 5. Turn 生命周期（实际实现）

概略流程：

1. `submit_user_message(...)`
2. `schedule_turn(...)`
3. worker 线程 `_drain_turns(...)`
4. `_run_quest_turn(...)`
5. 选择 runner（当前主要是 Codex）
6. 选择 skill
7. 构建 prompt
8. 运行 runner
9. agent 使用 MCP / 文件 / Git / shell
10. 退出并记录 run 输出

### 5.1 如果当前 quest 已经在运行

daemon 维护 per-quest turn state（`running/pending/stop_requested`）。

当 quest 已运行时，新消息不会启动第二个 runner，而是标记为 `pending` 并进入 mailbox，随后通过 `artifact.interact(...)` 投递。

### 5.2 本轮用哪个 skill

当前规则（很重要）：

1. 若用户消息是在回复一个阻塞交互（waiting interaction）：使用 `decision`
2. 否则读取 `quest.yaml.active_anchor`
3. 若 `active_anchor` 是标准 skill：使用该 skill
4. 否则 fallback 到 `decision`

实现位置：`src/deepscientist/daemon/app.py` 的 `_turn_skill_for(...)`。

## 6. 现实：Anchor 推进不是强自动化的

新 quest 通常从：

- `active_anchor: baseline`

开始。但 daemon 目前不会像严格 workflow engine 那样自动把每个 quest 从 A 推到 B。

实践上系统更依赖：

- prompt 的“研究纪律说明”
- `quest.yaml.active_anchor` 决定本轮 skill
- agent 写出 artifacts / memory / 文档来维持连续性
- 遇到路线变化时用 `decision` 明确理由与证据

## 7. Prompt 如何构建

每个 turn 的 prompt 由 `PromptBuilder.build(...)` 组装，主要包含：

1. `src/prompts/system.md`
2. 运行时上下文（home、quest_root、branch、anchor、runner、locale…）
3. 当前交互 surface
4. skills 的根目录与路径（让 agent 去读取对应 SKILL.md）
5. quest 核心文档（brief/plan/status/summary 等）
6. 相关 memory（按 stage 偏置）
7. 最近对话窗口
8. 当前 turn 的附件摘要
9. 当前用户消息

### 7.1 当前交互 surface

builder 现在会注入一个 surface block，明确告诉 agent：这一轮主要是在哪个用户表面上交流。

典型字段包括：

- 最新用户消息来源
- 当前是本地 surface 还是 connector surface
- 如果是 connector，则给出 connector 名称与 chat type
- 若当前 turn 来自 QQ，则补充 QQ 的里程碑媒体策略

这仍然是轻量做法：

- 不会把系统变成每个 connector 一套独立 workflow
- 只是把“这一轮的沟通契约”显式化

### 7.2 当前 turn 的附件摘要

如果最新一条入站用户消息携带了附件元信息，builder 会注入一个很小的附件摘要 block。

这个 block 的作用是：

- 告诉 agent 当前确实有附件
- 如果已经有可读 sidecar（如提取文本 / OCR / manifest），优先提示它先读这些
- 避免 agent 对二进制附件是否相关完全靠猜

它只是“摘要层”，不是完整的附件处理流水线。

### 7.3 Skill 以“路径引用”为主

系统并不把 skill 内容全部内联进 prompt，而是把 skill 文件路径注入，然后 prompt 指示 agent 去读对应 `SKILL.md`。

这保证：

- prompt 简洁
- skill 可独立维护
- 支持注册表式扩展

### 7.4 Memory 注入是“按阶段偏置”的

不同 stage 会优先检索不同 kind 的 memory（例如 baseline 更看 `episodes/knowledge/decisions`，idea 更看 `ideas/papers` 等）。

## 8. MCP（内建）只有三个 namespace

本仓库的核心约束：只提供 3 个内建 MCP namespace：

- `memory`
- `artifact`
- `bash_exec`

### 8.1 `memory`

用于可复用知识的持久化与检索（Markdown + YAML 头）。

### 8.2 `artifact`

用于 quest 状态改变 / 结构化产物 / Git 相关操作（例如 checkpoint、分支准备、实验记录、summary 刷新、git graph 渲染、交互投递）。

### 8.3 `bash_exec`

用于可审计、可恢复的 shell 运行（训练、评测、长脚本等）。

## 9. 为什么 `artifact.interact(...)` 是中枢

`artifact.interact(...)` 同时承担：

1. 写入结构化 artifact（形成可追踪的研究过程）
2. 可选 checkpoint
3. 维护交互线程状态（thread/blocking）
4. 向绑定的 connectors 推送进展（按路由策略）
5. 消费 mailbox 中排队的用户消息并返还给 agent
6. 返回近期交互上下文（便于长任务不中断）

这就是为什么“运行中”时用户补充消息不会丢：它们会在下一次 `interact` 时被投递。

## 10. Connector 推送与路由策略（简述）

当允许向外推送时，目标来自 quest bindings：

- `<quest_root>/.ds/bindings.json`
- home 的 `connectors.yaml` 以及 `_routing` 配置

常见策略：

- `fanout_all`：广播所有
- `primary_only`：只推送 primary
- `primary_plus_local`：primary + 本地

默认行为通常是：本地保留 + 一个 preferred connector。

## 11. Canvas（Git 图）如何构建

Canvas 不依赖一份中心化 graph 文件。

当前主要从两类来源重建：

1. Git refs/branches + worktree 元信息（用于“分支视图”）
2. artifacts + events（用于“事件视图/研究轨迹”）

其中“分支视图”可以表达两种模式（后端已有字段支持）：

1. 不同 idea / 不同主实现的 major branches
2. 在同一主实验线下分出多个 analysis branches，最终合并回主线写论文

额外实验的当前运行时约束也已经固定：

- 只要某个已完成节点之后还需要补做额外实验，就应通过 `artifact.create_analysis_campaign(...)` 启动
- 即使只需要 1 个额外实验，也应该作为一个只含 1 个 slice 的 campaign 来创建
- 这个 campaign 应该从“当前工作节点 / 当前结果节点”分叉，而不是直接在已完成父节点上继续改
- 这样 Git 历史和 Canvas 里的父子关系才会保持一致

## 12. 事件流与 ACP 兼容

daemon 的实时刷新依赖：

- `GET /api/quests/<id>/events`

该端点可以返回：

- `format=raw`：原生事件
- `format=acp`：ACP 兼容 envelope（给 Web/TUI/connector 做统一渲染）

重要原则：

- 文件与 artifacts 是持久化真相
- events 是实时操作流
- ACP 只是兼容包装层
