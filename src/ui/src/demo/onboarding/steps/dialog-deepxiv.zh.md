DeepXiv 影响文献发现路线。

如果项目需要读论文、找相关工作、生成 related work 或检查 claim 边界，DeepXiv 可以作为更结构化的论文入口。未配置时，系统仍会走普通文献路线。

你可以这样理解：

- 需要系统性文献检索：配置 DeepXiv
- 只做本地代码复现或 benchmark 启动：可以暂时跳过
- 从 BenchStore 进入且已有 paper：先使用自动带入的 paper，再按需要补充 DeepXiv

它不是装饰项，而是会影响 scout / idea / write 阶段可以依赖的论文来源。
