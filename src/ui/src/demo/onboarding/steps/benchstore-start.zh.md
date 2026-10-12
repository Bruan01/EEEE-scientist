这里的动作区决定下一步走向。

- `开始 / Start`：任务已经安装，DeepScientist 会读取 setup packet，把 benchmark 目标、本地路径、论文和运行约束带入 Start Research 表单
- `获取 / GET`：任务还没安装，先下载、校验并准备本地资源
- 进度条：下载或准备过程中会显示当前状态
- `已就绪`：说明本地状态足够进入启动流程

实际规则很简单：

- 已就绪就 `Start`
- 没安装就 `GET`
- 安装状态异常时再重新获取或检查详情页里的本地路径

教程会先关闭 BenchStore，然后继续展示 Start Research 的大输入框和完整启动表单。
