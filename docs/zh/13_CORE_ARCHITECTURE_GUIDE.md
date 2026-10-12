# 13 核心架构说明：DeepScientist 是如何拼起来的

这是一篇面向用户的核心架构说明。

它的目标不是替代维护者文档，而是让你在不通读底层实现的情况下，也能理解 DeepScientist 的主要结构。

如果你要维护仓库本身，还应该继续阅读 [90 Architecture](../en/90_ARCHITECTURE.md) 和 [91 Development](../en/91_DEVELOPMENT.md)。

## 1. 一句话总结

DeepScientist 是一个本地优先的科研操作系统，其中：

- 对外安装和启动入口是 `npm` 与 `ds`
- 真正的权威运行时在 Python
- 每个 quest 都是独立 Git 仓库
- 工作流纪律主要来自 prompts 和 skills
- 持久状态保存在文件、Git、memory、artifacts 和运行日志中

## 2. 四个主要入口

DeepScientist 实际上有四个常见入口：

1. `ds` 命令
2. Web 工作区
3. TUI
4. 外部 connectors

### 2.1 `ds`

`ds` 是正常用户的启动入口。

它负责：

- 准备运行时
- 启动 daemon
- 暴露 Web 与 TUI 共用的 API 面

### 2.2 Web 工作区

Web 界面是最主要的可视化工作区。

你通常会在这里：

- 创建 quest
- 查看文件
- 阅读 Canvas
- 检查 memory
- 继续一个正在进行的线程

### 2.3 TUI

TUI 不是另一套独立产品，也不是另一份状态。

它和 Web 一样，都是连到同一个 daemon、同一个 quest 状态上。

### 2.4 Connectors

微信、QQ、灵珠等 connectors，本质上是沟通表面。

它们不是核心运行时本身。

它们的作用，是让同一个 quest 能在浏览器之外继续收发消息。

## 3. 启动链路

正常启动链路是：

1. `npm install -g @researai/deepscientist`
2. 运行 `ds`
3. `bin/ds.js` 准备运行时环境
4. 启动 Python daemon
5. daemon 提供 Web 工作区与共用 API
6. Web、TUI、connectors 都连接到这个 daemon

这里的关键设计是：

- JavaScript 负责启动
- Python 负责权威运行时

## 4. Runtime home

默认情况下，DeepScientist 使用 `~/DeepScientist/` 作为运行时主目录。

其中最重要的目录有：

- `runtime/`
- `config/`
- `memory/`
- `quests/`
- `logs/`
- `cache/`

它们分别大致表示：

- `runtime/`：受管运行时工具与 Python 环境
- `config/`：YAML 配置和 baseline registry
- `memory/`：全局 memory 卡片
- `quests/`：所有 quest 仓库
- `logs/`：daemon 与运行日志
- `cache/`：复用缓存

## 5. 一题一仓库

这是 DeepScientist 最关键的设计之一。

每个 quest 都在自己的目录里：

`~/DeepScientist/quests/<quest_id>/`

并且它本身就是一个独立 Git 仓库。

所以一个 quest 并不只是一次聊天，而是一个真正的本地工作区，里面有：

- 分支
- 文件
- 计划
- 总结
- artifacts
- memory
- shell 历史

这正是 DeepScientist 能变成 persistent research map，而不是一次性对话的原因。

## 6. `Start Research` 真正创建了什么

`Start Research` 不只是新建一个目录。

它还会创建一份结构化 startup contract。

这份合同里会保存：

- 研究目标
- baseline 与 references
- runtime constraints
- 项目目标
- connector 绑定选择
- 启动与决策策略

这就是 quest 的第一份持久研究 brief。

也正因为如此，系统的起点不只是一个随意 prompt，而是一份更严谨的项目合同。

## 7. 当用户发送一条消息时，会发生什么

简化后的生命周期大致是：

1. 用户消息从 Web、TUI 或 connector 进入
2. daemon 把它写入 quest history
3. 如果 quest 空闲，就调度一个新 turn
4. prompt builder 组装本轮 prompt
5. runner 启动
6. agent 使用 MCP、文件、Git 和 shell
7. 输出被持久化为 events、artifacts、文件变化和总结

最重要的一点是：

- 用户消息不会绕开 quest 状态
- 它们会进入 quest 的持久执行历史

## 8. Prompt-led 与 Skill-led 工作流

DeepScientist 并不是主要依赖一个巨大的硬编码 stage scheduler。

它的工作流纪律更多来自：

- `src/prompts/system.md`
- `src/skills/*/SKILL.md`
- 当前 quest 的 active anchor

也就是说，系统里的分工更像这样：

- daemon 负责路由、调度和持久化
- prompt 负责定义研究纪律
- skill 负责告诉 agent 在当前阶段该怎样工作

这种设计的好处是：

- runtime 更薄
- 行为更容易通过 prompts 和 skills 演化

## 9. 内建 MCP 只有三个 namespace

DeepScientist 故意把内建 MCP 面控制得很小：

- `memory`
- `artifact`
- `bash_exec`

### 9.1 `memory`

用于可复用知识，例如：

- 论文笔记
- 失败经验
- 稳定 caveat
- 被选中 idea 的理由

### 9.2 `artifact`

用于 quest 状态和结构化研究进展，例如：

- 实验记录
- 分支决策
- 里程碑推送
- 交互投递
- Git 驱动的 quest 操作

### 9.3 `bash_exec`

用于可持久跟踪的 shell 工作，例如：

- 训练
- 评测
- 长脚本
- 后续还要查看的命令

## 10. 为什么 `artifact.interact(...)` 这么重要

`artifact.interact(...)` 是运行时里的核心工具之一，因为它能同时帮助系统完成多件事：

- 持久化交互状态
- 必要时 checkpoint
- 按路由策略向外推送进展
- 消费排队中的用户消息
- 让长时间运行期间的交互线程保持连续

这也是 DeepScientist 能在长任务里不断线协作的原因之一。

## 11. Web 工作区是如何从持久状态重建的

工作区不是拿一段临时回答糊出来的前端。

不同页面会从不同的持久状态重建：

- `Explorer`：quest 文件与文件树派生状态
- `Canvas`：Git、artifacts 与原始 quest events
- `Details`：quest summary 与状态快照
- `Memory`：quest 与 global memory cards
- `Copilot / Studio`：实时 daemon 会话 + 持久历史

所以即使刷新页面，quest 的研究结构也不会消失。

## 12. Canvas 到底是什么

Canvas 不是一份单独维护的中心化图数据库。

它主要从以下内容重建：

- Git 分支结构
- artifact 记录
- quest 事件

这意味着：你在 Canvas 里看到的节点和分支，原则上都应该能对应到真实的持久 quest 状态，而不只是临时前端对象。

## 13. Connectors 在系统里处于什么位置

Connectors 是 quest 外围的适配层，不是 quest 本身。

它们的职责是：

- 接收外部 surface 的入站消息
- 把这些消息绑定到正确 quest
- 在允许的路由策略下把出站进展发回去

它们并不拥有核心项目状态。

真正的 source of truth 仍然是 quest 仓库和 daemon。

## 14. 为什么系统能持续生长

DeepScientist 能跨轮次累积进展，是因为它把状态保存在持久形式里：

- quest 文件
- Git 分支与 commit
- memory cards
- artifact 记录
- event logs
- bash session history

所以后续轮次能够恢复：

- 做过什么
- 哪些失败了
- 选中了什么
- 产出了哪些证据

这也是它更像一个科研工作坊，而不是一次性运行的原因。

## 15. 下一步建议阅读

- 第一次按流程用产品：[12 引导式工作流教程](./12_GUIDED_WORKFLOW_TOUR.md)
- 理解每轮 prompt、skills 与工具结构：[14 Prompt、Skills 与 MCP 指南](./14_PROMPT_SKILLS_AND_MCP_GUIDE.md)
- 精确理解启动合同：[02 Start Research 参考](./02_START_RESEARCH_GUIDE.md)
- 深入理解 runtime 与 Canvas：[06 Runtime 与 Canvas](./06_RUNTIME_AND_CANVAS.md)
- 深入理解 memory 与 MCP：[07 Memory 与 MCP](./07_MEMORY_AND_MCP.md)
- 维护者架构参考：[90 Architecture](../en/90_ARCHITECTURE.md)
