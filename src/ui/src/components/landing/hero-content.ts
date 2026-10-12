import { assetUrl } from '@/lib/assets'
import type { Locale } from '@/types'

export type HeroStage = {
  key: string
  title: string
  body: string
  metricPrimary: string
  metricSecondary: string
  icon: string
  tone: 'warm' | 'cool'
}

export type HeroResearchStep = {
  id: string
  title: string
  subtitle: string
  body: string
  tags: string[]
  icon: string
  tone: 'warm' | 'cool'
  terminal: string[]
}

export type HeroFeature = {
  id: string
  kicker: string
  title: string
  body: string
  bullets: string[]
  chips: string[]
  icon: string
  tone: 'warm' | 'cool'
}

export type HeroBundle = {
  stages: HeroStage[]
  copy: {
    headline: string
    subhead: string
    tagline: string
    primaryCta: string
    secondaryCta: string
    supportLine: string
    moreContentUrl: string
    moreContentLine: string
  }
  researchSteps: HeroResearchStep[]
  features: HeroFeature[]
  terminalIntro: string[]
}

const heroBundles: Record<Locale, HeroBundle> = {
  en: {
    stages: [
      {
        key: 'local',
        title: 'Local Optimum',
        body: 'Establish a reproducible baseline before pushing the frontier.',
        metricPrimary: 'Baseline Value - 1.0x',
        metricSecondary: 'Observations - 24',
        icon: 'BarChart3',
        tone: 'warm',
      },
      {
        key: 'learn',
        title: 'Learn & Adapt',
        body: 'Accumulate experiments and notes to update strategy with evidence.',
        metricPrimary: 'Experiment Cycles - 12',
        metricSecondary: 'Notes Linked - 86',
        icon: 'Brain',
        tone: 'cool',
      },
      {
        key: 'escape',
        title: 'Escape Local',
        body: 'Introduce new hypotheses and evidence to widen the search.',
        metricPrimary: 'Exploration Radius - +32%',
        metricSecondary: 'New Hypotheses - 5',
        icon: 'SparklesIcon',
        tone: 'warm',
      },
      {
        key: 'global',
        title: 'Global Optimum',
        body: 'Converge on the best result and ship reproducible outputs.',
        metricPrimary: 'Insights - +17.3%',
        metricSecondary: 'Reproducibility - High',
        icon: 'Crown',
        tone: 'cool',
      },
    ],
    copy: {
      headline: 'Automated scientific discovery, driven by autonomous AI research',
      subhead: '',
      tagline: 'Survey · Experiment · Publish',
      primaryCta: 'Start Research',
      secondaryCta: 'List Quests',
      supportLine: 'DeepScientist keeps your full research loop local, reproducible, and continuously moving.',
      moreContentUrl: 'https://deepscientist.cc',
      moreContentLine: 'More content at',
    },
    researchSteps: [
      {
        id: 'literature',
        title: 'Survey literature',
        subtitle: 'Map the landscape in minutes',
        body: 'Ingest PDFs, extract claims, and highlight contradictions before you design experiments.',
        tags: ['PDF ingestion', 'Citation map', 'Claim index'],
        icon: 'BookOpen',
        tone: 'cool',
        terminal: [
          '> /help',
          '/new     Start a new quest',
          '/config  Edit config',
          '/resume  Resume a session',
          '/model   Show or set model',
          '',
          '> /resume',
          'Session: protein-folding',
          'Step 1/4 Literature survey',
          'Sources indexed: 128',
          'Contradictions flagged: 6',
        ],
      },
      {
        id: 'design',
        title: 'Design experiments',
        subtitle: 'Turn hypotheses into runnable plans',
        body: 'Draft protocols, define controls, and pre-register the metrics before execution.',
        tags: ['Hypothesis grid', 'Protocol draft', 'Risk notes'],
        icon: 'Braces',
        tone: 'warm',
        terminal: [
          '> /config',
          'sync_mode: remote',
          'model: glm-4.6',
          '',
          '> /resume',
          'Step 2/4 Experiment design',
          'Candidate hypotheses: 4',
          'Planned runs: 12',
          'Controls assigned: 3',
        ],
      },
      {
        id: 'execute',
        title: 'Run experiments',
        subtitle: 'Measure, adapt, and accelerate',
        body: 'Launch runs, track live metrics, and widen exploration when gains plateau.',
        tags: ['Queued runs', 'Live metrics', 'Auto notes'],
        icon: 'BarChart3',
        tone: 'cool',
        terminal: [
          '> /resume',
          'Step 3/4 Run experiments',
          'Active runs: 12',
          'Best delta: +8.4%',
          'Next action: widen sweep',
          'Notes linked: 52',
        ],
      },
      {
        id: 'publish',
        title: 'Write and publish',
        subtitle: 'Draft, visualize, and export',
        body: 'Generate figures, assemble the manuscript, and export a reproducible package.',
        tags: ['Figures', 'LaTeX export', 'Repro package'],
        icon: 'File',
        tone: 'warm',
        terminal: [
          '> /resume',
          'Step 4/4 Draft and publish',
          'Figures rendered: 6',
          'Manuscript: results.tex',
          'Export: arxiv-ready.zip',
          'Share link created',
        ],
      },
    ],
    features: [
      {
        id: 'welcome',
        kicker: 'Welcome + Copilot',
        title: 'Turn a question into a structured research plan',
        body: 'Start fast with guided prompts, then connect the dialogue to your sources and notes.',
        bullets: [
          'Guided prompts for concept, literature, and experiments',
          'Drag and drop PDFs, notebooks, or data tables',
          'Jump back into pinned threads with full context',
        ],
        chips: ['Concept', 'Literature', 'Experiment', 'Analysis'],
        icon: assetUrl('icons/welcome/feature-knowledge.png'),
        tone: 'warm',
      },
      {
        id: 'workspace',
        kicker: 'Projects + Workspace',
        title: 'One project holds the full research system',
        body: 'Notebook, PDF, LaTeX, code, and collaboration stay unified from start to finish.',
        bullets: [
          'Unified file tree',
          'Multi-plugin workflow (Notebook, PDF, LaTeX, Copilot)',
          'Shareable and reproducible by default',
        ],
        chips: ['Notebook', 'PDF', 'LaTeX', 'Copilot'],
        icon: assetUrl('icons/FolderIcon.png'),
        tone: 'warm',
      },
    ],
    terminalIntro: ['# Autonomous research loop', 'Type /help for commands.', ''],
  },
  zh: {
    stages: [
      {
        key: 'local',
        title: '局部最优',
        body: '先建立一个可复现的基线，再去推动研究边界。',
        metricPrimary: '基线水平 - 1.0x',
        metricSecondary: '观察结论 - 24',
        icon: 'BarChart3',
        tone: 'warm',
      },
      {
        key: 'learn',
        title: '学习与调整',
        body: '不断积累实验和笔记，用证据更新策略。',
        metricPrimary: '实验轮次 - 12',
        metricSecondary: '已关联笔记 - 86',
        icon: 'Brain',
        tone: 'cool',
      },
      {
        key: 'escape',
        title: '跳出局部',
        body: '引入新假设与新证据，拓宽搜索空间。',
        metricPrimary: '探索范围 - +32%',
        metricSecondary: '新假设 - 5',
        icon: 'SparklesIcon',
        tone: 'warm',
      },
      {
        key: 'global',
        title: '全局最优',
        body: '收敛到最佳结果，并导出可复现成果。',
        metricPrimary: '洞见提升 - +17.3%',
        metricSecondary: '可复现性 - 高',
        icon: 'Crown',
        tone: 'cool',
      },
    ],
    copy: {
      headline: '由自治 AI 研究驱动的自动化科学发现',
      subhead: '',
      tagline: '调研 · 实验 · 发表',
      primaryCta: '开始研究',
      secondaryCta: '查看 Quest',
      supportLine: 'DeepScientist 让完整研究闭环保持本地、可复现，并持续推进。',
      moreContentUrl: 'https://deepscientist.cc',
      moreContentLine: '更多内容见',
    },
    researchSteps: [
      {
        id: 'literature',
        title: '调研文献',
        subtitle: '几分钟内搭起研究地图',
        body: '先读取 PDF、抽取核心 claim，并在设计实验前找出冲突点。',
        tags: ['PDF 读取', '引用地图', 'Claim 索引'],
        icon: 'BookOpen',
        tone: 'cool',
        terminal: [
          '> /help',
          '/new     新建 quest',
          '/config  编辑配置',
          '/resume  恢复会话',
          '/model   查看或切换模型',
          '',
          '> /resume',
          '会话: protein-folding',
          '步骤 1/4 文献调研',
          '已索引来源: 128',
          '发现冲突: 6',
        ],
      },
      {
        id: 'design',
        title: '设计实验',
        subtitle: '把假设变成可运行计划',
        body: '先明确 protocol、对照组与指标，再进入执行。',
        tags: ['假设网格', '协议草稿', '风险记录'],
        icon: 'Braces',
        tone: 'warm',
        terminal: [
          '> /config',
          'sync_mode: remote',
          'model: glm-4.6',
          '',
          '> /resume',
          '步骤 2/4 实验设计',
          '候选假设: 4',
          '计划运行: 12',
          '已分配对照: 3',
        ],
      },
      {
        id: 'execute',
        title: '执行实验',
        subtitle: '测量、调整并持续加速',
        body: '启动实验、跟踪实时指标，并在提升停滞时扩大探索。',
        tags: ['排队任务', '实时指标', '自动笔记'],
        icon: 'BarChart3',
        tone: 'cool',
        terminal: [
          '> /resume',
          '步骤 3/4 执行实验',
          '运行中任务: 12',
          '最佳提升: +8.4%',
          '下一步: 扩大 sweep',
          '已关联笔记: 52',
        ],
      },
      {
        id: 'publish',
        title: '写作与发布',
        subtitle: '生成草稿、图表并导出',
        body: '生成图表、组织论文草稿，并导出可复现包。',
        tags: ['图表', 'LaTeX 导出', '复现包'],
        icon: 'File',
        tone: 'warm',
        terminal: [
          '> /resume',
          '步骤 4/4 写作与发布',
          '已生成图表: 6',
          '论文文件: results.tex',
          '导出结果: arxiv-ready.zip',
          '已创建分享链接',
        ],
      },
    ],
    features: [
      {
        id: 'welcome',
        kicker: 'Welcome + Copilot',
        title: '把一个问题整理成结构化研究计划',
        body: '先用引导式提示快速起步，再把对话连接到你的文献、数据与笔记。',
        bullets: [
          '面向概念、文献和实验的引导式提示',
          '支持拖拽上传 PDF、Notebook 与数据表',
          '可随时回到已固定线程继续当前上下文',
        ],
        chips: ['概念', '文献', '实验', '分析'],
        icon: assetUrl('icons/welcome/feature-knowledge.png'),
        tone: 'warm',
      },
      {
        id: 'workspace',
        kicker: 'Projects + Workspace',
        title: '一个项目承载完整研究系统',
        body: 'Notebook、PDF、LaTeX、代码与协作从开始到结束都保持统一。',
        bullets: [
          '统一文件树',
          '多插件协作流程（Notebook、PDF、LaTeX、Copilot）',
          '默认即可分享、也可复现',
        ],
        chips: ['Notebook', 'PDF', 'LaTeX', 'Copilot'],
        icon: assetUrl('icons/FolderIcon.png'),
        tone: 'warm',
      },
    ],
    terminalIntro: ['# 自治研究循环', '输入 /help 查看命令。', ''],
  },
}

export function getHeroBundle(locale: Locale): HeroBundle {
  return heroBundles[locale]
}
