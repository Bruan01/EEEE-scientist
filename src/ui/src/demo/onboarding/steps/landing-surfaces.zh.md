这里有三个主要入口，对应三种不同状态。

- **Start Research**：你已经知道要研究什么，直接打开启动输入框
- **BenchStore**：你还没确定任务，先从 benchmark 商店里浏览、筛选、安装或启动
- **Settings**：你暂时不启动项目，而是先调整 runner、模型、connector、DeepXiv、代理或诊断项

更具体地说：

- 从 **Start Research** 进入时，默认先看到大输入框。把目标、材料、限制、期望产物写进去，SetupAgent 会先做启动规划。
- 从 **BenchStore** 进入时，先像 App Store 一样浏览任务。已安装的任务可以直接 `Start`，未安装的任务先 `GET / Download`。
- 从 **Settings** 进入时，主要处理系统层问题，例如 Codex / Claude / Kimi / OpenCode runner、微信 connector、代理、DeepXiv 和 issue 诊断。

如果只记一句话：**Start Research 是自定义任务入口，BenchStore 是开放 benchmark 入口，Settings 是系统控制面。**
