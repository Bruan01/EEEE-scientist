<h1 align="center">EEEE Scientist</h1>

<p align="center">
  <img src="assets/branding/logo.svg" alt="EEEE Scientist logo" width="72" />
</p>

<p align="center">
  面向长期实验、论文产出和人机协作科研流程的本地优先研究工作区。
</p>

<p align="center">
  <a href="https://github.com/Bruan01/EEEE-scientist">项目仓库</a> ·
  <a href="README.md">English README</a> ·
  <a href="docs/zh/README.md">中文文档</a> ·
  <a href="https://github.com/ResearAI/DeepScientist">上游项目</a>
</p>

EEEE Scientist 是基于
[DeepScientist](https://github.com/ResearAI/DeepScientist) 的二次开发版本。
这个分支保留原项目的本地优先科研工作流，同时把产品定位、运行方式和后续维护统一到本仓库。

## 这个版本解决什么问题

- 一个 quest 对应一个 Git 仓库，代码、实验、产物、分支和记忆都可以持久保存。
- Codex 是主要运行时，同时保留 Claude Code、Kimi Code 和 OpenCode。
- Web 工作区、TUI、Canvas、终端、记忆和连接器共享同一个 daemon 状态。
- 研究者可以随时查看、暂停、接管、修改、纠偏，再继续自动推进。

## EEEE Scientist 的当前改动

- 已移除 BenchStore 主流程。数据可以由你自己下载，也可以直接让当前 runner 准备。
- 增加精简模式：关闭装饰性动画和过渡效果。进入 Settings → Runtime，开启精简模式即可。
- 代理可以在运行期间修改，不需要重启整个项目；命令行也支持直接指定代理：

~~~bash
ds --proxy http://127.0.0.1:7897
~~~

- 增加轻量 Codex Token 统计：进入项目的 Details → Overall，在 Codex tokens 查看当前项目累计用量；其他运行时不统计。
- 保留现有运行时目录和连接器状态格式，已有本地项目可以继续使用。

## 从本仓库安装

### 环境要求

- macOS 或 Linux
- Node.js 18.18+
- npm 9+
- Python 3.11+
- Git
- 至少一个已经能独立运行的 runner，第一次推荐 Codex

### 安装并启动

~~~bash
git clone https://github.com/Bruan01/EEEE-scientist.git
cd EEEE-scientist
bash install.sh

codex login
# 如果你已经在 Codex Desktop 中登录，可跳过这一行。
ds doctor --runner codex
ds --here --runner codex
~~~

默认 Web 地址通常是
<http://127.0.0.1:20999>。可以使用 <code>ds --status</code> 查看状态，
使用 <code>ds --stop</code> 停止受管理的 daemon。

这个二次开发版本以源码安装为主，不依赖上游 npm 包。根目录包名已经改为
<code>eeee-scientist</code>；推荐直接使用上面的源码安装路径。

### 其他 runner

如果某个 runner 在当前终端已经可以工作，先做健康检查，再启动：

~~~bash
ds doctor --runner claude
ds --here --runner claude

ds doctor --runner kimi
ds --here --runner kimi

ds doctor --runner opencode
ds --here --runner opencode
~~~

登录、Provider、模型和 API Key 仍然由对应的 CLI 管理。EEEE Scientist 会复用
已经可用的 runner，不会替你重写它的 Provider 配置。

## 运行时配置

为了兼容已经创建的 quest，现有运行时主目录仍然默认使用
<code>~/DeepScientist</code>。这是存储路径，不是公开产品名称。也可以显式指定新的目录：

~~~bash
ds --home /path/to/eeee-scientist-home
~~~

常用配置位置：

- <code>~/DeepScientist/config/config.yaml</code>：daemon、UI、代理、日志、Git 和运行时默认值。
- <code>~/DeepScientist/config/runners.yaml</code>：Codex profile、模型、沙箱、审批策略、重试和环境变量。
- Web Settings：优先用于修改运行时、模型、连接器、代理和精简模式。

如果本机代理端口是 7897，可以在 Settings → Runtime 配置为：

~~~text
http://127.0.0.1:7897
~~~

## 二次开发

安装工作区依赖：

~~~bash
npm ci
npm --prefix src/ui ci
npm --prefix src/tui ci
~~~

构建 Web UI 和 TUI：

~~~bash
npm --prefix src/ui run build
npm --prefix src/tui run build
~~~

运行轻量校验：

~~~bash
python3 -m compileall -q src/deepscientist tests
npm --prefix src/ui run build
git diff --check
~~~

主要代码位置：

| 路径 | 作用 |
|---|---|
| <code>src/deepscientist/</code> | Python 运行时、daemon、runner、连接器、quest 和服务 |
| <code>src/ui/</code> | React Web 工作区和设置页面 |
| <code>src/tui/</code> | 终端界面 |
| <code>src/prompts/</code> | 系统、Copilot、连接器和运行时契约 |
| <code>src/skills/</code> | 科研工作流技能 |
| <code>docs/en/</code> | 英文用户和维护文档 |
| <code>docs/zh/</code> | 中文用户和维护文档 |
| <code>tests/</code> | Python、launcher、API 和 UI 契约测试 |

推荐入口：

- [中文文档总览](docs/zh/README.md)
- [English documentation index](docs/en/README.md)
- [快速开始](docs/zh/00_QUICK_START.md)
- [架构说明](docs/zh/90_ARCHITECTURE.md)
- [开发者指南](docs/zh/91_DEVELOPMENT.md)
- [Codex Provider 配置](docs/zh/15_CODEX_PROVIDER_SETUP.md)
- [设置参考](docs/zh/01_SETTINGS_REFERENCE.md)
- [微信连接器指南](docs/zh/10_WEIXIN_CONNECTOR_GUIDE.md)

## 名称与兼容性

公开产品名是 **EEEE Scientist**，npm 包名是 <code>eeee-scientist</code>。
下面这些旧标识会继续保留：

- Python import 路径仍然是 <code>deepscientist</code>。
- 主启动命令仍然是 <code>ds</code>，同时增加 <code>eeee-scientist</code>。
- <code>DEEPSCIENTIST_HOME</code> 等既有环境变量继续有效。
- <code>~/DeepScientist</code> 下已有的运行时数据和 quest 继续有效。

这样可以只更换产品显示名，不要求迁移所有历史项目。

## 上游、归因与许可证

EEEE Scientist 是 DeepScientist 的修改版分支。上游项目和论文仍然保留归因；
本分支的改动维护在
[Bruan01/EEEE-scientist](https://github.com/Bruan01/EEEE-scientist)。

源码继续使用 Apache-2.0 许可证。详见 [LICENSE](LICENSE)、
[CITATION.cff](CITATION.cff) 和 [TRADEMARK.md](TRADEMARK.md)。
