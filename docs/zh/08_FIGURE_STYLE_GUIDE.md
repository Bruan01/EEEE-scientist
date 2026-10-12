# 08 图表风格指南：实验图与论文图规范

本文档定义 DeepScientist 默认的实验图、分析图和论文图风格规范。

## 核心原则

优先使用克制、证据优先的图。

- 面向 connector 的里程碑图，目标是快速传达结论
- 面向论文的图，目标是干净、稳定、适合 PDF 导出与审稿阅读
- 两者都统一使用 prompt / stage skills 中固定的莫兰迪色系

## 固定莫兰迪配色

- `mist-stone`: `#F3EEE8`, `#D8D1C7`, `#8A9199`
- `sage-clay`: `#E7E1D6`, `#B7A99A`, `#7F8F84`
- `dust-rose`: `#F2E9E6`, `#D8C3BC`, `#B88C8C`
- `fog-blue`: `#DCE5E8`, `#A9BCC4`, `#6F8894`
- `olive-paper`: `#E6E1D3`, `#B8B095`, `#7C7A5C`
- `lavender-ash`: `#E8E3EA`, `#B9AFC2`, `#7D7486`

推荐搭配：

- 主方法 vs baseline：`sage-clay` + `mist-stone`
- 多个 ablation：`mist-stone` + `fog-blue` + `dust-rose`
- uncertainty / sensitivity：`mist-stone` + `olive-paper`
- appendix / supplementary：`mist-stone` + `lavender-ash`

## 图表类型选择

图表类型应由研究问题决定：

- 折线图：epoch、step、budget、scale 或有序条件上的趋势
- 柱状图：少量类别的并列比较，且共享零基线
- 点图 / point-range：更强调精确值和置信区间时
- 箱线图 / 小提琴图 / 直方图：真正的分布问题
- 热力图：只有当矩阵结构本身就是结果时才使用

不要为了“看起来丰富”而做成拥挤的 dashboard。

## 颜色语义

- 有序幅值 -> 使用顺序型、低饱和配色
- 围绕 0 或某个参考值的正负偏移 -> 使用带中性中心的发散型低饱和配色
- 类别比较 -> 使用离散配色，不要拿连续色带冒充类别

避免使用 rainbow / jet / HSV 这类会扭曲排序感知的配色。

## 导出规则

- connector 里程碑图：通常导出 `png`
- 论文图：导出 `pdf` 或 `svg`，同时保留一份 `png` 预览
- 如果可以导出矢量格式，就不要把线稿和文字栅格化
- 背景保持白色或近白色
- 网格线保持轻量
- 图例尽量简洁，能直标就直标
- 确保缩放到论文版面后文字仍然可读
- 默认优先接近常见论文版式：
  - 单栏宽度约 `89 mm`
  - 双栏宽度约 `183 mm`

## 强制复检流程

不要在第一次渲染后就把重要图片标记为完成。

对于里程碑图、论文图、附录图，默认流程应当是：

1. 先生成第一版
2. 打开导出的实际图片进行查看
3. 如果发现留白、标签、图例、颜色层级或可读性问题，就立即修图
4. 再导出最终版本

最低完成条件应当是“已经实际看过图，并做过必要修正”，而不是“代码看起来没问题”。

## 最小检查清单

把图当作完成之前，至少确认：

- 可视编码与研究问题一致
- 标签、单位、基线明确
- 同一组图里的颜色语义一致
- 源数据路径明确
- 生成脚本路径明确
- 图可以从 durable 文件重新生成
- 缩小到真实论文版面后仍然可读
- 用户快速扫一眼就能看出主结论
- 图例不会挡住数据

## 参考依据

本规范主要参考以下公开资料进行约束抽象：

- PLOS Computational Biology《Ten Simple Rules for Better Figures》：`https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003833`
- Graphics Principles：`https://graphicsprinciples.github.io/`
- Nature 作者格式说明：`https://www.nature.com/nature/for-authors/formatting-guide`
- Matplotlib colormap 指南：`https://matplotlib.org/stable/users/explain/colors/colormaps.html`
- Datawrapper 可访问性图表规范：`https://academy.datawrapper.de/article/206-how-we-make-sure-our-charts-maps-and-tables-are-accessible`
