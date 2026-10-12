"use client";

import * as React from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  ChevronRight,
  Check,
  CloudDownload,
  Compass,
  Cpu,
  Download,
  FlaskConical,
  Grid,
  LayoutGrid,
  Layers3,
  LibraryBig,
  MonitorSmartphone,
  MoreHorizontal,
  Play,
  Search,
  Sparkles,
  WandSparkles,
  Wrench,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { OverlayDialog } from "@/components/home/OverlayDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { client } from "@/lib/api";
import {
  buildBenchStoreEntryImageUrl,
  getBenchStoreEntry,
  getBenchStoreSetupPacket,
  installBenchStoreEntry,
  listBenchStoreEntries,
} from "@/lib/api/benchstore";
import type { QuestMessageAttachmentDraft } from '@/lib/hooks/useQuestMessageAttachments'
import { useAdminTaskStream } from "@/lib/hooks/useAdminTaskStream";
import type {
  BenchCatalogPayload,
  BenchCompatibility,
  BenchEntry,
  BenchResourceSpec,
  BenchSetupPacket,
} from "@/lib/types/benchstore";
import { cn } from "@/lib/utils";
import { normalizeBuiltinRunnerName, runnerLabel } from "@/lib/runnerBranding";
import type { QuestSummary } from "@/types";

type BenchStoreDialogProps = {
  open: boolean;
  locale: "en" | "zh";
  onClose: () => void;
  setupQuestId?: string | null;
  setupQuestCreating?: boolean;
  onStartWithSetupPacket?: (
    setupPacket: BenchSetupPacket,
  ) => void | Promise<void>;
  onRequestSetupAgent?: (payload: {
    message: string;
    entry?: BenchEntry | null;
    setupPacket?: BenchSetupPacket | null;
    attachments?: QuestMessageAttachmentDraft[];
    createOnly?: boolean;
  }) => void | Promise<void>;
};

type SortMode =
  | "recommended"
  | "minimum_spec"
  | "recommended_spec"
  | "fastest"
  | "easiest"
  | "name"
  | "year";
type FitFilter =
  | "all"
  | "best_match"
  | "runnable"
  | "installed"
  | "hide_unsupported";
type BooleanFilter = "all" | "true" | "false";
type BenchViewMode = "store" | "library";
type BenchSurfacePage =
  | "recommended"
  | "all"
  | "aisb"
  | "llm"
  | "cv"
  | "ml"
  | "systems"
  | "installed"
  | "compare";
type BenchTopic = "aisb" | "llm" | "cv" | "ml" | "systems" | "other";

const AISB_PR81_ENTRY_RE = /^aisb\.b\d+(?:\.|$)/i;
const BENCH_TOPIC_KEYWORDS: Record<Exclude<BenchTopic, "aisb" | "other">, string[]> = {
  llm: [
    "large_language_models",
    "llm",
    "llm_tooling",
    "nlp",
    "language",
    "reasoning",
    "math_proof",
    "agentic_coding",
    "dialogue",
    "tool_use",
  ],
  cv: [
    "computer_vision",
    "vision",
    "image",
    "image_classification",
    "multimodal_fusion",
    "diffusion_models",
    "flow_matching",
    "embodied_ai",
    "video",
    "segmentation",
  ],
  ml: [
    "scientific_ml",
    "scientific ml",
    "machine_learning",
    "machine learning",
    "traditional_ml",
    "traditional ml",
    "tabular_ml",
    "tabular ml",
    "time_series",
    "time series",
    "time_series_forecasting",
    "time series forecasting",
    "forecasting",
    "graph_learning",
    "graph learning",
    "causal_inference",
    "causal inference",
    "probabilistic_modeling",
    "probabilistic modeling",
    "anomaly_detection",
    "anomaly detection",
    "missing_data",
    "missing data",
    "representation_learning",
    "representation learning",
    "optimization",
    "classification",
    "regression",
    "federated_learning",
    "federated learning",
    "conformal_prediction",
    "conformal prediction",
    "uncertainty_quantification",
    "uncertainty quantification",
    "机器学习",
    "科学机器学习",
    "时间序列",
    "分类",
    "预测",
  ],
  systems: [
    "systems_efficiency",
    "systems efficiency",
    "cuda_kernels",
    "cuda kernels",
    "efficient_inference",
    "efficient inference",
    "inference_acceleration",
    "inference acceleration",
    "model_efficiency",
    "model efficiency",
    "agent_systems",
    "agent systems",
    "serving_systems",
    "serving systems",
    "系统效率",
  ],
};

const BENCH_SURFACE_ORDER: BenchSurfacePage[] = [
  "recommended",
  "all",
  "aisb",
  "llm",
  "cv",
  "ml",
  "systems",
  "installed",
  "compare",
];

function normalizeBenchSignal(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

function benchSurfaceTitle(page: BenchSurfacePage, locale: "en" | "zh") {
  if (locale === "zh") {
    switch (page) {
      case "recommended":
        return "推荐";
      case "all":
        return "全部";
      case "aisb":
        return "AISB";
      case "llm":
        return "LLM";
      case "cv":
        return "CV";
      case "ml":
        return "ML";
      case "systems":
        return "系统";
      case "installed":
        return "已安装";
      case "compare":
        return "对比";
    }
  }
  switch (page) {
    case "recommended":
      return "Recommended";
    case "all":
      return "All";
    case "aisb":
      return "AISB";
    case "llm":
      return "LLM";
    case "cv":
      return "CV";
    case "ml":
      return "ML";
    case "systems":
      return "Systems";
    case "installed":
      return "Installed";
    case "compare":
      return "Compare";
  }
}

function benchSurfaceHint(page: BenchSurfacePage, locale: "en" | "zh") {
  if (locale === "zh") {
    switch (page) {
      case "recommended":
        return "优先精选";
      case "all":
        return "完整目录";
      case "aisb":
        return "PR 81 新增任务";
      case "llm":
        return "语言与推理";
      case "cv":
        return "视觉与多模态";
      case "ml":
        return "传统与科学机器学习";
      case "systems":
        return "系统与效率";
      case "installed":
        return "本地已安装";
      case "compare":
        return "并排审视";
    }
  }
  switch (page) {
    case "recommended":
      return "Curated picks";
    case "all":
      return "Entire catalog";
    case "aisb":
      return "PR 81 additions";
    case "llm":
      return "Language and reasoning";
    case "cv":
      return "Vision and multimodal";
    case "ml":
      return "Scientific and tabular ML";
    case "systems":
      return "Systems and efficiency";
    case "installed":
      return "Installed locally";
    case "compare":
      return "Side-by-side review";
  }
}

function getBenchSignalText(entry: BenchEntry) {
  const rawDisplay = isRecord(entry.raw_payload?.display)
    ? (entry.raw_payload.display as Record<string, unknown>)
    : null;
  return [
    entry.id,
    entry.name,
    entry.one_line,
    entry.task_description,
    entry.aisb_direction,
    entry.task_mode,
    entry.discovery?.collection,
    entry.discovery?.featured_reason,
    entry.display?.art_style,
    entry.display?.badge,
    ...(entry.capability_tags || []),
    ...(entry.track_fit || []),
    ...(entry.primary_outputs || []),
    ...(entry.launch_profiles || []).flatMap((profile) => [
      profile.id,
      profile.label,
      profile.description,
    ]),
    ...(Array.isArray(rawDisplay?.tags) ? rawDisplay.tags : []),
    ...(Array.isArray(rawDisplay?.domain_tags) ? rawDisplay.domain_tags : []),
    ...(Array.isArray(rawDisplay?.summary_cards) ? rawDisplay.summary_cards : []),
  ]
    .map(normalizeBenchSignal)
    .filter(Boolean)
    .join(" ");
}

function isAisbTask(entry: BenchEntry) {
  return AISB_PR81_ENTRY_RE.test(entry.id);
}

function resolveBenchTopic(entry: BenchEntry): BenchTopic {
  if (isAisbTask(entry)) return "aisb";
  const text = getBenchSignalText(entry);
  if (
    BENCH_TOPIC_KEYWORDS.llm
      .map(normalizeBenchSignal)
      .filter(Boolean)
      .some((needle) => text.includes(needle))
  )
    return "llm";
  if (
    BENCH_TOPIC_KEYWORDS.cv
      .map(normalizeBenchSignal)
      .filter(Boolean)
      .some((needle) => text.includes(needle))
  )
    return "cv";
  if (
    BENCH_TOPIC_KEYWORDS.ml
      .map(normalizeBenchSignal)
      .filter(Boolean)
      .some((needle) => text.includes(needle))
  )
    return "ml";
  if (
    BENCH_TOPIC_KEYWORDS.systems
      .map(normalizeBenchSignal)
      .filter(Boolean)
      .some((needle) => text.includes(needle))
  )
    return "systems";
  return "other";
}

function benchTopicMatchesEntry(
  entry: BenchEntry,
  topic: Exclude<BenchTopic, "aisb" | "other">,
) {
  const text = getBenchSignalText(entry);
  return BENCH_TOPIC_KEYWORDS[topic]
    .map(normalizeBenchSignal)
    .filter(Boolean)
    .some((needle) => text.includes(needle));
}

function getBenchSurfaceIcon(page: BenchSurfacePage) {
  switch (page) {
    case "recommended":
      return Sparkles;
    case "all":
      return LayoutGrid;
    case "aisb":
      return LibraryBig;
    case "llm":
      return BrainCircuit;
    case "cv":
      return MonitorSmartphone;
    case "ml":
      return FlaskConical;
    case "systems":
      return Cpu;
    case "installed":
      return BadgeCheck;
    case "compare":
      return Layers3;
  }
}

function isRecommendedBenchEntry(
  entry: BenchEntry,
  bestMatchIds?: Set<string> | null,
) {
  if (bestMatchIds?.has(entry.id)) return true;
  if (entry.recommendation?.shelf_bucket === "best_match") return true;
  if (entry.discovery?.featured) return true;
  if (entry.compatibility?.recommended_ok) return true;
  return Boolean(
    entry.compatibility?.minimum_ok &&
      Number(entry.recommendation?.score || entry.compatibility?.score || 0) >=
        60,
  );
}

function benchTopicLabel(topic: BenchTopic, locale: "en" | "zh") {
  if (locale === "zh") {
    switch (topic) {
      case "aisb":
        return "AISB";
      case "llm":
        return "LLM";
      case "cv":
        return "CV";
      case "ml":
        return "ML";
      case "systems":
        return "系统";
      case "other":
        return "其他";
    }
  }
  switch (topic) {
    case "aisb":
      return "AISB";
    case "llm":
      return "LLM";
    case "cv":
      return "CV";
    case "ml":
      return "ML";
    case "systems":
      return "Systems";
    case "other":
      return "Other";
  }
}

function surfacePageMatchesEntry(
  entry: BenchEntry,
  page: BenchSurfacePage,
  bestMatchIds?: Set<string> | null,
): boolean {
  if (page === "all" || page === "compare") return true;
  if (page === "recommended") return isRecommendedBenchEntry(entry, bestMatchIds);
  if (page === "installed") {
    return entry.install_state?.status === "installed";
  }
  if (page === "aisb") return isAisbTask(entry);
  return benchTopicMatchesEntry(entry, page);
}

function stableHash(input: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function buildPalette(seed: string) {
  const hash = stableHash(seed);
  const families = [
    {
      a: [202, 210, 218],
      b: [172, 184, 194],
      c: [38, 46, 54],
      sat: [68, 58, 50],
      light: [70, 78, 84],
    },
    {
      a: [12, 18, 24],
      b: [172, 184, 188],
      c: [42, 50, 58],
      sat: [72, 48, 62],
      light: [72, 80, 86],
    },
    {
      a: [142, 154, 164],
      b: [188, 198, 206],
      c: [72, 82, 94],
      sat: [50, 56, 54],
      light: [66, 78, 84],
    },
    {
      a: [336, 346, 356],
      b: [24, 32, 40],
      c: [196, 204, 212],
      sat: [66, 70, 56],
      light: [74, 80, 86],
    },
    {
      a: [216, 224, 232],
      b: [44, 50, 58],
      c: [168, 178, 188],
      sat: [46, 74, 48],
      light: [62, 78, 84],
    },
    {
      a: [282, 296, 310],
      b: [28, 36, 44],
      c: [184, 192, 202],
      sat: [52, 74, 52],
      light: [72, 80, 86],
    },
    {
      a: [112, 124, 136],
      b: [206, 214, 222],
      c: [18, 26, 34],
      sat: [44, 56, 72],
      light: [68, 78, 86],
    },
    {
      a: [224, 230, 236],
      b: [152, 162, 172],
      c: [6, 14, 22],
      sat: [54, 44, 70],
      light: [68, 78, 86],
    },
  ];
  const family = families[hash % families.length];
  const hueA = family.a[(hash >>> 2) % family.a.length];
  const hueB = family.b[(hash >>> 6) % family.b.length];
  const hueC = family.c[(hash >>> 10) % family.c.length];
  const satA = family.sat[0];
  const satB = family.sat[1];
  const satC = family.sat[2];
  const lightA = family.light[0];
  const lightB = family.light[1];
  const lightC = family.light[2];
  return {
    backgroundImage: `
      radial-gradient(circle at 18% 20%, hsla(${hueA}, ${satA + 6}%, ${Math.min(lightA + 16, 92)}%, 0.92), transparent 34%),
      radial-gradient(circle at 82% 16%, hsla(${hueB}, ${satB + 6}%, ${Math.min(lightB + 10, 92)}%, 0.68), transparent 30%),
      radial-gradient(circle at 62% 78%, hsla(${hueC}, ${satC}%, ${Math.min(lightC + 2, 90)}%, 0.58), transparent 28%),
      linear-gradient(135deg, hsla(${hueA}, ${satA}%, ${lightA}%, 0.96), hsla(${hueB}, ${satB}%, ${lightB}%, 0.98) 46%, hsla(${hueC}, ${satC}%, ${lightC}%, 0.96))
    `,
    cleanBackgroundImage: `
      linear-gradient(135deg, hsla(${hueA}, ${satA + 4}%, ${Math.min(lightA + 6, 84)}%, 0.96), hsla(${hueB}, ${satB + 8}%, ${Math.min(lightB + 1, 84)}%, 0.94) 48%, hsla(${hueC}, ${satC}%, ${Math.min(lightC, 86)}%, 0.92))
    `,
    cardBackgroundImage: `
      linear-gradient(145deg, hsla(${hueA}, ${satA + 8}%, 94%, 0.96), hsla(${hueB}, ${satB + 4}%, 95%, 0.86) 54%, hsla(${hueC}, ${satC}%, 92%, 0.92))
    `,
    borderColor: `hsla(${hueB}, ${Math.max(36, satB - 8)}%, 70%, 0.28)`,
    lineColor: `hsla(${hueC}, ${Math.max(38, satC - 8)}%, 96%, 0.55)`,
    dotColor: `hsla(${hueA}, ${satA + 6}%, 94%, 0.85)`,
  };
}

function formatBytes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 100 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatEta(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return null;
  const totalSeconds = Math.round(value);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function mergeInstallState(
  entry: BenchEntry | null | undefined,
  patch: Record<string, unknown> | null | undefined,
) {
  if (!entry || !patch) return entry ?? null;
  const patchedEntryId = String(patch.entry_id || "").trim();
  if (patchedEntryId && patchedEntryId !== entry.id) {
    return entry;
  }
  return {
    ...entry,
    install_state: {
      ...(entry.install_state || {}),
      ...patch,
    },
  };
}

function extractInstallRecord(
  events: Array<{ event?: string; data?: Record<string, unknown> | null }> | undefined,
  entryId: string | null | undefined,
) {
  const normalizedEntryId = String(entryId || "").trim();
  if (!normalizedEntryId || !Array.isArray(events)) return null;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const item = events[index];
    const data =
      item?.data && typeof item.data === "object" && !Array.isArray(item.data)
        ? item.data
        : null;
    const installRecord =
      data?.install_record &&
      typeof data.install_record === "object" &&
      !Array.isArray(data.install_record)
        ? (data.install_record as Record<string, unknown>)
        : null;
    if (!installRecord) continue;
    const recordEntryId = String(installRecord.entry_id || "").trim();
    if (!recordEntryId || recordEntryId === normalizedEntryId) {
      return installRecord;
    }
  }
  return null;
}

function readNumberMeta(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatQuestUpdatedAt(
  value?: string | null,
  locale: "en" | "zh" = "en",
) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function benchEntryIdFromQuest(summary: QuestSummary | null | undefined) {
  const startupContract =
    summary?.startup_contract && typeof summary.startup_contract === "object"
      ? (summary.startup_contract as Record<string, unknown>)
      : null;
  const benchContext =
    startupContract?.benchstore_context &&
    typeof startupContract.benchstore_context === "object"
      ? (startupContract.benchstore_context as Record<string, unknown>)
      : null;
  const entryId = String(benchContext?.entry_id || "").trim();
  return entryId || null;
}

function isQuestRunning(summary: QuestSummary | null | undefined) {
  const status = String(summary?.status || "")
    .trim()
    .toLowerCase();
  const runtimeStatus = String(summary?.runtime_status || "")
    .trim()
    .toLowerCase();
  return status === "active" || runtimeStatus === "running";
}

function copy(locale: "en" | "zh") {
  return locale === "zh"
    ? {
        title: "AI Scientist Bench",
        description:
          "像商店一样浏览、安装并选择适合当前设备的 benchmark，然后一键带入全自动启动表单。",
        searchPlaceholder: "搜索 benchmark、论文标题、venue、tag...",
        recommended: "推荐给当前设备",
        all: "全部任务",
        deviceSummary: "当前设备",
        openDetail: "查看详情",
        backToStore: "返回商店",
        empty: "当前没有可展示的 benchmark。",
        noResults: "没有匹配结果。",
        sortRecommended: "优先推荐",
        sortMinimumSpec: "按最低配置",
        sortRecommendedSpec: "按推荐配置",
        sortFastest: "按时长",
        sortEasiest: "按难度",
        sortName: "名称",
        sortYear: "年份",
        sortVenue: "Venue",
        fitFilterLabel: "设备适配",
        fitFilterAll: "全部",
        fitFilterBest: "最佳匹配",
        fitFilterRunnable: "可运行",
        fitFilterInstalled: "已安装",
        fitFilterHideUnsupported: "隐藏不适合",
        directionFilterLabel: "方向",
        modeFilterLabel: "模式",
        trackFilterLabel: "轨道",
        accessFilterLabel: "数据",
        executionFilterLabel: "执行",
        paperFilterLabel: "论文",
        costFilterLabel: "成本",
        difficultyFilterLabel: "难度",
        moreFilters: "更多筛选",
        fewerFilters: "收起筛选",
        featuredHeading: "为当前设备优先推荐",
        browseShelf: "全部任务",
        storeTab: "Store",
        libraryTab: "Library",
        openLibrary: "进入 Library",
        returnToStore: "返回 Store",
        backToLibrary: "返回 Library",
        libraryHeading: "你的 Bench Library",
        libraryIntro:
          "集中管理已安装 Bench，以及已经关联到 quest 的 benchmark。",
        libraryInstalled: "已安装 Bench",
        libraryReady: "可直接启动",
        latestQuest: "最近 Quest",
        notInstalledYet: "尚未安装",
        libraryEmpty: "还没有已安装或已关联 quest 的 benchmark。",
        linkedQuests: "关联 Quest",
        linkedQuestCount: "关联数量",
        runningQuestCount: "运行中",
        openQuest: "打开 Quest",
        continueQuest: "继续最近 Quest",
        showAll: "展开全部",
        showLess: "收起列表",
        actionStrip: "快速操作",
        whyRecommended: "推荐判断",
        moreDetails: "更多信息",
        lessDetails: "收起信息",
        coreInfo: "核心信息",
        quickFacts: "快速信息",
        signalTags: "标签列",
        trackFit: "适合轨道",
        details: "详情",
        taskDescription: "任务描述",
        recommendedWhen: "适合使用场景",
        notRecommendedWhen: "不适合使用场景",
        minimum: "最低配置",
        recommendedSpec: "推荐配置",
        links: "链接",
        download: "下载链接",
        downloadAction: "Download",
        reinstallAction: "重新安装",
        startAction: "Start",
        downloadingAction: "正在下载",
        extractingAction: "正在解压",
        installedState: "已安装到本地",
        installFailed: "安装失败",
        localPath: "本地路径",
        speed: "速率",
        eta: "预计剩余",
        paperLink: "论文链接",
        sourceFile: "Catalog 源文件",
        unknown: "未知",
        compatibilityRecommended: "推荐运行",
        compatibilityMinimum: "可运行",
        compatibilityUnsupported: "设备偏弱",
        venue: "录用场所",
        year: "年份",
        version: "版本",
        catalogId: "Catalog ID",
        annualFee: "年费",
        dataAccess: "数据访问",
        integrityLevel: "完整性级别",
        runtimeEnvironment: "运行环境",
        keyPackages: "关键依赖",
        environmentNotes: "环境说明",
        imagePath: "图片路径",
        requiresPaper: "论文要求",
        requiresExecution: "执行要求",
        python: "Python",
        cuda: "CUDA",
        pytorch: "PyTorch",
        flashAttn: "FlashAttention",
        riskWarning: "风险提示",
        reproduction: "复现信息",
        timeBand: "时长估计",
        costBand: "成本档位",
        paperTitle: "论文标题",
        paperContext: "论文信息",
        paperAuthors: "作者",
        paperInstitutions: "机构",
        paperLicense: "许可",
        paperDoi: "DOI",
        paperLinks: "相关链接",
        packageInfo: "打包信息",
        archiveType: "压缩格式",
        localDirName: "本地目录名",
        packageNotes: "打包说明",
        catalogStyle: "Catalog 风格",
        schemaVersion: "Schema 版本",
        paletteSeed: "调色种子",
        artStyle: "视觉风格",
        accentPriority: "强调优先级",
        displayTags: "展示标签",
        resourceConfidence: "资源信息完整度",
        recommendationScore: "推荐分",
        fullRisks: "完整风险",
        riskFlags: "风险标签",
        riskNotes: "风险说明",
        datasetRoute: "数据获取",
        datasetMethod: "获取方式",
        datasetSources: "数据源",
        datasetNotes: "数据说明",
        credentialRequirements: "凭证要求",
        credentialMode: "凭证模式",
        credentialItems: "需要的凭证",
        credentialNotes: "凭证说明",
        snapshotStatus: "快照状态",
        supportLevel: "支持等级",
        primaryOutputs: "主要产物",
        launchProfiles: "启动档位",
        additionalCatalogFields: "补充字段",
        yes: "是",
        no: "否",
      }
    : {
        title: "AI Scientist Bench",
        description:
          "Browse, install, and choose benchmarks like a storefront, then send them directly into the autonomous start form.",
        searchPlaceholder:
          "Search benchmarks, paper titles, venues, or tags...",
        recommended: "Recommended For This Device",
        all: "All Benchmarks",
        deviceSummary: "Current Device",
        openDetail: "Open Details",
        backToStore: "Back To Store",
        empty: "No benchmarks are currently available.",
        noResults: "No matching benchmarks found.",
        sortRecommended: "Recommended",
        sortMinimumSpec: "Minimum Spec",
        sortRecommendedSpec: "Recommended Spec",
        sortFastest: "Fastest",
        sortEasiest: "Easiest",
        sortName: "Name",
        sortYear: "Year",
        sortVenue: "Venue",
        fitFilterLabel: "Device Fit",
        fitFilterAll: "All",
        fitFilterBest: "Best Match",
        fitFilterRunnable: "Runnable",
        fitFilterInstalled: "Installed",
        fitFilterHideUnsupported: "Hide Unsupported",
        directionFilterLabel: "Direction",
        modeFilterLabel: "Mode",
        trackFilterLabel: "Track",
        accessFilterLabel: "Access",
        executionFilterLabel: "Execution",
        paperFilterLabel: "Paper",
        costFilterLabel: "Cost",
        difficultyFilterLabel: "Difficulty",
        moreFilters: "More Filters",
        fewerFilters: "Fewer Filters",
        featuredHeading: "Top Picks For This Device",
        browseShelf: "All Benchmarks",
        storeTab: "Store",
        libraryTab: "Library",
        openLibrary: "Open Library",
        returnToStore: "Back To Store",
        backToLibrary: "Back To Library",
        libraryHeading: "Your Bench Library",
        libraryIntro:
          "Manage installed benches and every benchmark already linked to an existing quest.",
        libraryInstalled: "Installed Benches",
        libraryReady: "Ready To Start",
        latestQuest: "Latest Quest",
        notInstalledYet: "Not installed yet",
        libraryEmpty: "No installed or linked benchmarks yet.",
        linkedQuests: "Linked Quests",
        linkedQuestCount: "Linked Count",
        runningQuestCount: "Running",
        openQuest: "Open Quest",
        continueQuest: "Continue Last Quest",
        showAll: "Show All",
        showLess: "Show Less",
        actionStrip: "Quick Actions",
        whyRecommended: "Why It Fits",
        moreDetails: "More Details",
        lessDetails: "Less Details",
        coreInfo: "Core Info",
        quickFacts: "Quick Facts",
        signalTags: "Signal Tags",
        trackFit: "Track Fit",
        details: "Details",
        taskDescription: "Task Description",
        recommendedWhen: "Recommended When",
        notRecommendedWhen: "Not Recommended When",
        minimum: "Minimum Spec",
        recommendedSpec: "Recommended Spec",
        links: "Links",
        download: "Download Link",
        downloadAction: "Download",
        reinstallAction: "Reinstall",
        startAction: "Start",
        downloadingAction: "Downloading",
        extractingAction: "Extracting",
        installedState: "Installed locally",
        installFailed: "Install failed",
        localPath: "Local Path",
        speed: "Speed",
        eta: "ETA",
        paperLink: "Paper Link",
        sourceFile: "Catalog Source",
        unknown: "Unknown",
        compatibilityRecommended: "Recommended",
        compatibilityMinimum: "Runnable",
        compatibilityUnsupported: "Below Target",
        venue: "Venue",
        year: "Year",
        version: "Version",
        catalogId: "Catalog ID",
        annualFee: "Annual Fee",
        dataAccess: "Data Access",
        integrityLevel: "Integrity Level",
        runtimeEnvironment: "Runtime Environment",
        keyPackages: "Key Packages",
        environmentNotes: "Environment Notes",
        imagePath: "Image Path",
        requiresPaper: "Paper Required",
        requiresExecution: "Execution Required",
        python: "Python",
        cuda: "CUDA",
        pytorch: "PyTorch",
        flashAttn: "FlashAttention",
        riskWarning: "Risk Warning",
        reproduction: "Reproduction",
        timeBand: "Time Band",
        costBand: "Cost Band",
        paperTitle: "Paper Title",
        paperContext: "Paper Context",
        paperAuthors: "Authors",
        paperInstitutions: "Institutions",
        paperLicense: "License",
        paperDoi: "DOI",
        paperLinks: "Related Links",
        packageInfo: "Package",
        archiveType: "Archive Type",
        localDirName: "Local Folder",
        packageNotes: "Package Notes",
        catalogStyle: "Catalog Style",
        schemaVersion: "Schema Version",
        paletteSeed: "Palette Seed",
        artStyle: "Art Style",
        accentPriority: "Accent Priority",
        displayTags: "Display Tags",
        resourceConfidence: "Resource Confidence",
        recommendationScore: "Recommendation Score",
        fullRisks: "Full Risks",
        riskFlags: "Risk Flags",
        riskNotes: "Risk Notes",
        datasetRoute: "Dataset Route",
        datasetMethod: "Primary Method",
        datasetSources: "Sources",
        datasetNotes: "Dataset Notes",
        credentialRequirements: "Credential Requirements",
        credentialMode: "Credential Mode",
        credentialItems: "Credential Items",
        credentialNotes: "Credential Notes",
        snapshotStatus: "Snapshot Status",
        supportLevel: "Support Level",
        primaryOutputs: "Primary Outputs",
        launchProfiles: "Launch Profiles",
        additionalCatalogFields: "Additional Catalog Fields",
        yes: "Yes",
        no: "No",
      };
}

function compatibilityLabel(
  value: BenchCompatibility | null | undefined,
  locale: "en" | "zh",
) {
  const t = copy(locale);
  if (value?.recommended_ok) return t.compatibilityRecommended;
  if (value?.minimum_ok) return t.compatibilityMinimum;
  return t.compatibilityUnsupported;
}

function booleanFilterText(value: BooleanFilter, locale: "en" | "zh") {
  if (value === "true") return locale === "zh" ? "需要" : "Required";
  if (value === "false") return locale === "zh" ? "不需要" : "Not Required";
  return locale === "zh" ? "全部" : "All";
}

function hasBenchImage(entry: BenchEntry | null | undefined) {
  return Boolean(String(entry?.image_path || entry?.image_url || "").trim());
}

function hasBenchRisk(entry: BenchEntry | null | undefined) {
  return Boolean(
    (entry?.risk_flags || []).length || (entry?.risk_notes || []).length,
  );
}

function benchRiskSummary(
  entry: BenchEntry | null | undefined,
  locale: "en" | "zh",
) {
  const notes = (entry?.risk_notes || []).filter(Boolean);
  if (notes.length > 0) return notes.join(locale === "zh" ? "；" : " | ");
  const flags = (entry?.risk_flags || []).filter(Boolean);
  return flags.join(locale === "zh" ? "；" : " | ");
}

function detailTextList(value: unknown): string[] {
  return catalogStringList(value).filter(Boolean);
}

function detailJoin(value: unknown, locale: "en" | "zh") {
  return detailTextList(value).join(locale === "zh" ? "；" : "; ");
}

function detailBool(value: boolean | null | undefined, locale: "en" | "zh") {
  if (value == null) return locale === "zh" ? "未知" : "Unknown";
  return value ? (locale === "zh" ? "需要" : "Required") : locale === "zh" ? "不需要" : "Not required";
}

function detailSectionLabel(
  key:
    | "overview"
    | "benchInfo"
    | "paper"
    | "runtime"
    | "resources"
    | "data"
    | "risk"
    | "package"
    | "catalog",
  locale: "en" | "zh",
) {
  const zh: Record<typeof key, string> = {
    overview: "新功能",
    benchInfo: "任务信息",
    paper: "论文信息",
    runtime: "运行环境",
    resources: "资源需求",
    data: "数据与凭证",
    risk: "风险提示",
    package: "包与安装",
    catalog: "Catalog 详情",
  };
  const en: Record<typeof key, string> = {
    overview: "What's New",
    benchInfo: "Benchmark Info",
    paper: "Paper",
    runtime: "Runtime",
    resources: "Resources",
    data: "Data & Credentials",
    risk: "Risks",
    package: "Package & Install",
    catalog: "Catalog Details",
  };
  return locale === "zh" ? zh[key] : en[key];
}

function credentialModeText(
  value: string | null | undefined,
  locale: "en" | "zh",
) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return locale === "zh" ? "未知" : "Unknown";
  if (normalized === "required") return locale === "zh" ? "必需" : "Required";
  if (normalized === "conditional")
    return locale === "zh" ? "条件式" : "Conditional";
  if (normalized === "none") return locale === "zh" ? "无" : "None";
  return value || (locale === "zh" ? "未知" : "Unknown");
}

function resourceConfidenceText(
  value: string | null | undefined,
  locale: "en" | "zh",
) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return locale === "zh" ? "未知" : "Unknown";
  if (normalized === "full") return locale === "zh" ? "完整" : "Full";
  if (normalized === "partial") return locale === "zh" ? "部分" : "Partial";
  if (normalized === "none") return locale === "zh" ? "缺失" : "None";
  return value || (locale === "zh" ? "未知" : "Unknown");
}

function formatTimeUpperHours(
  value: number | null | undefined,
  locale: "en" | "zh",
) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return null;
  if (value >= 24) {
    const days = value / 24;
    const text = Number.isInteger(days) ? days.toFixed(0) : days.toFixed(1);
    return locale === "zh" ? `${text} 天` : `${text} days`;
  }
  const text = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return locale === "zh" ? `${text} 小时` : `${text} hours`;
}

function formatAnnualFee(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  return String(value);
}

function humanizeEnum(value: string | null | undefined, locale: "en" | "zh") {
  const raw = String(value || "").trim();
  if (!raw) return locale === "zh" ? "未知" : "Unknown";
  return raw.replace(/[_-]+/g, " ");
}

const CONSUMED_CATALOG_PATHS = new Set([
  "id",
  "name",
  "version",
  "one_line",
  "task_description",
  "capability_tags",
  "track_fit",
  "task_mode",
  "requires_execution",
  "requires_paper",
  "integrity_level",
  "snapshot_status",
  "support_level",
  "primary_outputs",
  "launch_profiles",
  "cost_band",
  "time_band",
  "difficulty",
  "data_access",
  "risk_flags",
  "risk_notes",
  "recommended_when",
  "not_recommended_when",
  "image_path",
  "paper.title",
  "paper.venue",
  "paper.year",
  "paper.url",
  "download.url",
  "dataset_download.primary_method",
  "dataset_download.sources",
  "dataset_download.notes",
  "credential_requirements.mode",
  "credential_requirements.items",
  "credential_requirements.notes",
  "resources.minimum",
  "resources.recommended",
  "environment.python",
  "environment.cuda",
  "environment.pytorch",
  "environment.flash_attn",
  "environment.key_packages",
  "environment.notes",
  "commercial.annual_fee",
  "aisb_direction",
  "schema_version",
  "download.archive_type",
  "download.local_dir_name",
  "download.notes",
  "download.upstream_url",
  "download.upstream_repo",
  "display.palette_seed",
  "display.art_style",
  "display.accent_priority",
  "display.tags",
  "display.summary_cards",
  "display.domain_tags",
  "paper.authors",
  "paper.institution",
  "paper.affiliations",
  "paper.affiliation",
  "paper.institutions",
  "paper.license",
  "paper.notes",
  "paper.code_url",
  "paper.github",
  "paper.project_url",
  "paper.github_url",
  "paper.arxiv_url",
  "paper.homepage",
  "paper.pypi",
  "paper.code",
  "paper.project_page",
  "paper.doi",
  "paper.abstract",
  "paper.abstract_summary",
  "paper.note",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEmptyCatalogValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value))
    return value.every((item) => isEmptyCatalogValue(item));
  if (isRecord(value))
    return Object.values(value).every((item) => isEmptyCatalogValue(item));
  return false;
}

function pruneCatalogPayload(value: unknown, path = ""): unknown {
  if (path && CONSUMED_CATALOG_PATHS.has(path)) return undefined;
  if (Array.isArray(value)) {
    const items = value
      .map((item) => pruneCatalogPayload(item))
      .filter((item) => !isEmptyCatalogValue(item));
    return items.length > 0 ? items : undefined;
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const next = pruneCatalogPayload(item, childPath);
      if (!isEmptyCatalogValue(next)) result[key] = next;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return isEmptyCatalogValue(value) ? undefined : value;
}

function formatCatalogFieldLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCatalogScalar(value: unknown, locale: "en" | "zh") {
  const t = copy(locale);
  if (typeof value === "boolean") return value ? t.yes : t.no;
  return String(value ?? "");
}

function serializeCatalogValue(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function catalogStringList(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => catalogStringList(item));
  }
  return [];
}

function catalogLinkEntries(record: Record<string, unknown> | null) {
  if (!record) return [];
  return [
    "code_url",
    "github",
    "github_url",
    "project_url",
    "project_page",
    "homepage",
    "pypi",
    "arxiv_url",
    "code",
  ]
    .map((key) => {
      const value = record[key];
      const url = typeof value === "string" ? value.trim() : "";
      if (!url) return null;
      return { key, url };
    })
    .filter((item): item is { key: string; url: string } => Boolean(item));
}

function AutoCatalogValue({
  value,
  locale,
}: {
  value: unknown;
  locale: "en" | "zh";
}) {
  if (value == null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (
      <div className="text-sm leading-7 text-[#544E46]">
        {formatCatalogScalar(value, locale)}
      </div>
    );
  }
  if (Array.isArray(value)) {
    const primitiveItems = value.filter(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    );
    if (primitiveItems.length === value.length) {
      return (
        <div className="flex flex-wrap gap-2">
          {primitiveItems.map((item, index) => (
            <BenchChip key={`${String(item)}-${index}`}>
              {formatCatalogScalar(item, locale)}
            </BenchChip>
          ))}
        </div>
      );
    }
  }
  return (
    <pre className="overflow-x-auto rounded-[10px] border border-black/8 bg-white/58 px-4 py-3 text-xs leading-6 text-[#4A433B]">
      {serializeCatalogValue(value)}
    </pre>
  );
}

function formatResourceSpec(spec?: BenchResourceSpec | null) {
  if (!spec) return [];
  const rows = [
    spec.cpu_cores != null ? `${spec.cpu_cores} CPU` : null,
    spec.ram_gb != null ? `${spec.ram_gb}GB RAM` : null,
    spec.disk_gb != null ? `${spec.disk_gb}GB Disk` : null,
    spec.gpu_count != null ? `${spec.gpu_count} GPU` : null,
    spec.gpu_vram_gb != null ? `${spec.gpu_vram_gb}GB VRAM` : null,
  ];
  return rows.filter((item): item is string => Boolean(item));
}

function minimumFootprint(entry: BenchEntry) {
  const minimum = entry.resources?.minimum;
  if (!minimum) return Number.POSITIVE_INFINITY;
  return (
    Number(minimum.gpu_vram_gb || 0) * 5 +
    Number(minimum.gpu_count || 0) * 20 +
    Number(minimum.ram_gb || 0) * 1.5 +
    Number(minimum.cpu_cores || 0) * 1.2 +
    Number(minimum.disk_gb || 0) * 0.05
  );
}

function recommendedFootprint(entry: BenchEntry) {
  const recommended = entry.resources?.recommended;
  if (!recommended) return Number.POSITIVE_INFINITY;
  return (
    Number(recommended.gpu_vram_gb || 0) * 5 +
    Number(recommended.gpu_count || 0) * 20 +
    Number(recommended.ram_gb || 0) * 1.5 +
    Number(recommended.cpu_cores || 0) * 1.2 +
    Number(recommended.disk_gb || 0) * 0.05
  );
}

function sortEntries(entries: BenchEntry[], mode: SortMode) {
  const next = [...entries];
  next.sort((left, right) => {
    const leftRisk = hasBenchRisk(left) ? 1 : 0;
    const rightRisk = hasBenchRisk(right) ? 1 : 0;
    if (leftRisk !== rightRisk) return leftRisk - rightRisk;
    if (mode === "minimum_spec") {
      return minimumFootprint(left) - minimumFootprint(right);
    }
    if (mode === "recommended_spec") {
      return recommendedFootprint(left) - recommendedFootprint(right);
    }
    if (mode === "fastest") {
      return (
        Number(
          left.recommendation?.time_upper_hours || Number.POSITIVE_INFINITY,
        ) -
        Number(
          right.recommendation?.time_upper_hours || Number.POSITIVE_INFINITY,
        )
      );
    }
    if (mode === "easiest") {
      return (
        Number(
          left.recommendation?.difficulty_rank || Number.POSITIVE_INFINITY,
        ) -
        Number(
          right.recommendation?.difficulty_rank || Number.POSITIVE_INFINITY,
        )
      );
    }
    if (mode === "name")
      return String(left.name || "").localeCompare(String(right.name || ""));
    if (mode === "year")
      return Number(right.paper?.year || 0) - Number(left.paper?.year || 0);
    const leftCompat = left.compatibility;
    const rightCompat = right.compatibility;
    const rightScore = Number(
      right.recommendation?.score || rightCompat?.score || 0,
    );
    const leftScore = Number(
      left.recommendation?.score || leftCompat?.score || 0,
    );
    const rightRecommended = rightCompat?.recommended_ok ? 1 : 0;
    const leftRecommended = leftCompat?.recommended_ok ? 1 : 0;
    if (rightRecommended !== leftRecommended)
      return rightRecommended - leftRecommended;
    const rightMinimum = rightCompat?.minimum_ok ? 1 : 0;
    const leftMinimum = leftCompat?.minimum_ok ? 1 : 0;
    if (rightMinimum !== leftMinimum) return rightMinimum - leftMinimum;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return String(left.name || "").localeCompare(String(right.name || ""));
  });
  return next;
}

function BenchArtwork({
  entry,
  locale,
  className,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  className?: string;
}) {
  const palette = React.useMemo(
    () =>
      buildPalette(`${entry.id}:${entry.display?.palette_seed || entry.name}`),
    [entry.display?.palette_seed, entry.id, entry.name],
  );
  const resolvedImageUrl = React.useMemo(() => {
    if (entry.image_url) return buildBenchStoreEntryImageUrl(entry.id, locale);
    if (entry.image_path) return buildBenchStoreEntryImageUrl(entry.id, locale);
    return null;
  }, [entry.id, entry.image_path, entry.image_url, locale]);
  const [imageFailed, setImageFailed] = React.useState(false);
  const showGeneratedMarks = !resolvedImageUrl || imageFailed;

  React.useEffect(() => {
    setImageFailed(false);
  }, [resolvedImageUrl]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] border border-black/10 shadow-[0_28px_80px_-54px_rgba(61,54,46,0.45)]",
        className,
      )}
      style={{
        backgroundImage: palette.backgroundImage,
        borderColor: palette.borderColor,
      }}
      aria-hidden
    >
      {resolvedImageUrl && !imageFailed ? (
        <img
          src={resolvedImageUrl}
          alt={entry.name}
          className="absolute inset-0 h-full w-full object-cover opacity-[0.94] saturate-[0.92] contrast-[0.96]"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,22,19,0.04),rgba(24,22,19,0.22))]" />
      {showGeneratedMarks ? (
        <>
          <div
            className="absolute -left-6 top-6 h-40 w-40 rounded-[12px] border blur-[2px]"
            style={{ borderColor: palette.lineColor }}
          />
          <div
            className="absolute right-8 top-10 h-24 w-24 rounded-[14px] border"
            style={{ borderColor: palette.lineColor }}
          />
          <div
            className="absolute bottom-8 left-10 h-20 w-28 rounded-[14px] border"
            style={{ borderColor: palette.lineColor }}
          />
          <div
            className="absolute bottom-10 right-16 h-32 w-32 rounded-[12px] border"
            style={{ borderColor: palette.lineColor }}
          />
        </>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(36,34,31,0.36))]" />
      {showGeneratedMarks ? (
        <div className="absolute inset-x-6 top-6 flex items-center justify-between">
          <div className="rounded-[12px] border border-white/40 bg-white/30 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#191714] backdrop-blur-md">
            AI Scientist Bench
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-[12px]"
              style={{ backgroundColor: palette.dotColor }}
            />
            <span className="h-2.5 w-2.5 rounded-[12px] bg-white/50" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BenchChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-[12px] border border-black/10 bg-white/58 px-3 py-1 text-[11px] font-medium text-[#5F5A54] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </span>
  );
}

function BenchCard({
  entry,
  locale,
  onOpen,
  linkedQuestCount = 0,
  activeQuestCount = 0,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  onOpen: () => void;
  linkedQuestCount?: number;
  activeQuestCount?: number;
}) {
  const t = copy(locale);
  return (
    <button type="button" onClick={onOpen} className="group h-full w-full text-left">
      <div className="h-full overflow-hidden rounded-[10px] border border-black/10 bg-[rgba(255,250,245,0.78)] p-3 text-[#191714] shadow-[0_24px_80px_-58px_rgba(44,39,34,0.44)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_90px_-56px_rgba(44,39,34,0.5)]">
        <div className="relative">
          <BenchArtwork entry={entry} locale={locale} className="h-44" />
          <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-[12px] bg-white/62 px-4 py-3 backdrop-blur-md">
            <div className="line-clamp-2 text-base font-semibold tracking-[-0.02em] text-[#191714]">
              {entry.name}
            </div>
            {entry.one_line ? (
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#191714]">
                {entry.one_line}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <BenchChip className="text-[#191714]">
              {compatibilityLabel(entry.compatibility, locale)}
            </BenchChip>
            {entry.install_state?.status === "installed" ? (
              <BenchChip className="text-[#191714]">{t.installedState}</BenchChip>
            ) : null}
            {entry.paper?.year ? (
              <BenchChip className="text-[#191714]">{entry.paper.year}</BenchChip>
            ) : null}
            {linkedQuestCount > 0 ? (
              <BenchChip className="text-[#191714]">
                {locale === "zh"
                  ? `Quest ${linkedQuestCount}`
                  : `${linkedQuestCount} quest${linkedQuestCount > 1 ? "s" : ""}`}
              </BenchChip>
            ) : null}
            {activeQuestCount > 0 ? (
              <BenchChip className="text-[#191714]">
                {locale === "zh"
                  ? `运行中 ${activeQuestCount}`
                  : `${activeQuestCount} running`}
              </BenchChip>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-[#191714]">
            <div className="truncate">
              {entry.paper?.venue || entry.task_mode || t.unknown}
            </div>
            <div className="inline-flex items-center gap-1 font-medium text-[#191714] transition group-hover:text-[#191714]">
              {t.openDetail}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function BenchFeatureMiniCard({
  entry,
  locale,
  onOpen,
  linkedQuestCount = 0,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  onOpen: () => void;
  linkedQuestCount?: number;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid gap-3 rounded-[14px] bg-[rgba(255,252,248,0.58)] p-3 text-left shadow-[0_18px_54px_-46px_rgba(26,30,38,0.42)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,252,248,0.74)] sm:grid-cols-[118px_minmax(0,1fr)]"
    >
      <div className="relative">
        <BenchArtwork
          entry={entry}
          locale={locale}
          className="h-[96px] rounded-[12px]"
        />
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-[10px] bg-white/30 px-3 py-2 backdrop-blur-md">
          <div className="line-clamp-2 text-sm font-semibold leading-5 text-[#191714]">
            {entry.name}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <BenchChip>
            {compatibilityLabel(entry.compatibility, locale)}
          </BenchChip>
          {entry.install_state?.status === "installed" ? (
            <BenchChip>{locale === "zh" ? "已安装" : "Installed"}</BenchChip>
          ) : null}
          {linkedQuestCount > 0 ? (
            <BenchChip>
              {locale === "zh"
                ? `Quest ${linkedQuestCount}`
                : `${linkedQuestCount} quest${linkedQuestCount > 1 ? "s" : ""}`}
            </BenchChip>
          ) : null}
        </div>
        <div className="mt-3 line-clamp-2 text-sm leading-6 text-[#666055]">
          {entry.one_line ||
            entry.task_description ||
            entry.paper?.venue ||
            entry.task_mode ||
            ""}
        </div>
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#4F6971] transition group-hover:text-[#375B66]">
          {locale === "zh" ? "查看任务" : "Open"}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  );
}

function BenchLibrarySummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string | null;
}) {
  return (
    <div className="inline-flex min-w-[148px] items-center gap-3 rounded-full border border-black/8 bg-white/74 px-4 py-2.5 text-left shadow-[0_14px_34px_-30px_rgba(44,39,34,0.28)] backdrop-blur-xl">
      <div className="text-xl font-semibold tracking-[-0.04em] text-[#2D2A26]">
        {value}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[#9B9389]">
          {label}
        </div>
        {hint ? (
          <div className="truncate text-xs leading-5 text-[#7B746A]">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BenchLibraryCard({
  entry,
  locale,
  linkedQuests,
  onOpen,
  onOpenQuest,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  linkedQuests: QuestSummary[];
  onOpen: () => void;
  onOpenQuest: (questId: string) => void;
}) {
  const t = copy(locale);
  const latestQuest = linkedQuests[0] ?? null;
  const runningQuestCount = linkedQuests.filter((quest) =>
    isQuestRunning(quest),
  ).length;
  const linkedQuestCount = linkedQuests.length;
  const isInstalled = entry.install_state?.status === "installed";

  return (
    <div className="rounded-[10px] border border-black/8 bg-white/72 px-4 py-4 shadow-[0_18px_52px_-44px_rgba(44,39,34,0.28)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <button
          type="button"
          onClick={onOpen}
          className="w-full shrink-0 text-left xl:w-[164px]"
        >
          <BenchArtwork entry={entry} locale={locale} className="h-[110px]" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BenchChip>
              {compatibilityLabel(entry.compatibility, locale)}
            </BenchChip>
            {isInstalled ? <BenchChip>{t.installedState}</BenchChip> : null}
            {linkedQuestCount > 0 ? (
              <BenchChip>
                {locale === "zh"
                  ? `Quest ${linkedQuestCount}`
                  : `${linkedQuestCount} quest${linkedQuestCount > 1 ? "s" : ""}`}
              </BenchChip>
            ) : null}
            {runningQuestCount > 0 ? (
              <BenchChip>
                {locale === "zh"
                  ? `运行中 ${runningQuestCount}`
                  : `${runningQuestCount} running`}
              </BenchChip>
            ) : null}
          </div>
          <div className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-[#1F1B17]">
            {entry.name}
          </div>
          <div className="mt-2 line-clamp-2 text-sm leading-7 text-[#5D554C]">
            {entry.one_line || entry.task_description || t.unknown}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs leading-6 text-[#746B61]">
            <div className="min-w-0">
              <span className="mr-2 uppercase tracking-[0.14em] text-[#9B9389]">
                {t.latestQuest}
              </span>
              <span className="font-medium text-[#2D2A26]">
                {latestQuest
                  ? latestQuest.title || latestQuest.quest_id
                  : locale === "zh"
                    ? "暂未关联"
                    : "None"}
              </span>
            </div>
            <div className="min-w-0 max-w-full">
              <span className="mr-2 uppercase tracking-[0.14em] text-[#9B9389]">
                {t.localPath}
              </span>
              <span className="inline-block max-w-[260px] truncate align-middle text-[#2D2A26]">
                {entry.install_state?.local_path || t.notInstalledYet}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 xl:flex-col">
          <Button
            className="rounded-[12px] bg-[linear-gradient(135deg,#C8A482,#B7C8CF)] px-5 text-[#221C18] hover:opacity-95"
            onClick={onOpen}
          >
            {t.openDetail}
          </Button>
          {latestQuest ? (
            <Button
              variant="outline"
              className="rounded-[12px] border-black/10 bg-white/72 px-5 text-[#2D2A26] hover:bg-white"
              onClick={() => onOpenQuest(latestQuest.quest_id)}
            >
              {t.continueQuest}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetadataRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/6 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-[#9B9389]">
        {label}
      </div>
      <div className="text-right text-sm leading-6 text-[#342F2B]">{value}</div>
    </div>
  );
}

function BenchSurfaceNavItem({
  active,
  count,
  hint,
  icon: Icon,
  reduceMotion = false,
  title,
  onClick,
}: {
  active: boolean;
  count?: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  reduceMotion?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[18px] border px-3 py-2.5 text-left transition",
        active
          ? "border-[#D9C4B5] bg-white text-[#231F1B] shadow-[0_18px_50px_-36px_rgba(44,39,34,0.3)]"
          : "border-transparent bg-transparent text-[#72695E] hover:border-black/6 hover:bg-white/64",
      )}
      whileHover={reduceMotion || active ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border",
          active
            ? "border-[#D2BDAF] bg-[linear-gradient(135deg,rgba(243,232,223,0.98),rgba(228,239,243,0.94))]"
            : "border-black/6 bg-white/70",
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{title}</span>
        <span className="block truncate text-[11px] leading-5 text-current/60">
          {hint}
        </span>
      </span>
      {typeof count === "number" ? (
        <Badge
          variant={active ? "primary" : "secondary"}
          size="sm"
          className="shrink-0 rounded-full px-2.5"
        >
          {count}
        </Badge>
      ) : null}
    </motion.button>
  );
}

function BenchCompareCard({
  entry,
  locale,
  linkedQuestCount = 0,
  reduceMotion = false,
  onOpen,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  linkedQuestCount?: number;
  reduceMotion?: boolean;
  onOpen: () => void;
}) {
  const t = copy(locale);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-black/8 bg-white/78 text-left shadow-[0_20px_56px_-44px_rgba(44,39,34,0.28)] transition"
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
    >
      <BenchArtwork entry={entry} locale={locale} className="h-[182px] rounded-none" />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <BenchChip>{compatibilityLabel(entry.compatibility, locale)}</BenchChip>
          {entry.install_state?.status === "installed" ? (
            <BenchChip>{t.installedState}</BenchChip>
          ) : null}
          {linkedQuestCount > 0 ? (
            <BenchChip>
              {locale === "zh"
                ? `Quest ${linkedQuestCount}`
                : `${linkedQuestCount} quest${linkedQuestCount > 1 ? "s" : ""}`}
            </BenchChip>
          ) : null}
        </div>
        <div className="min-h-0 flex-1">
          <div className="line-clamp-2 text-[20px] font-semibold tracking-[-0.03em] text-[#1F1B17]">
            {entry.name}
          </div>
          <div className="mt-2 line-clamp-3 text-sm leading-6 text-[#5D554C]">
            {entry.one_line || entry.task_description || t.unknown}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-black/6 pt-3 text-xs text-[#746B61]">
          <span className="truncate">
            {entry.paper?.venue || entry.task_mode || t.unknown}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-[#3F5F67]">
            {t.openDetail}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

type BenchCopy = ReturnType<typeof copy>;

function benchIconInitials(entry: BenchEntry) {
  const parts = String(entry.id || entry.name || "bench")
    .split(/[._\-\s]+/)
    .filter((part) => /[a-z0-9]/i.test(part));
  const preferred = parts.filter((part) => !["aisb", "t3", "bench"].includes(part.toLowerCase()));
  const source = preferred.length > 0 ? preferred : parts;
  const suffix = source.slice(-2);
  const initials = suffix
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
  return initials || "DS";
}

function AisbAppIcon({
  entry,
  locale,
  className,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  className?: string;
}) {
  const palette = React.useMemo(
    () =>
      buildPalette(`${entry.id}:${entry.display?.palette_seed || entry.name}:icon`),
    [entry.display?.palette_seed, entry.id, entry.name],
  );
  const topic = resolveBenchTopic(entry);
  const TopicIcon =
    topic === "llm"
      ? BrainCircuit
      : topic === "cv"
        ? MonitorSmartphone
        : topic === "ml"
          ? FlaskConical
          : topic === "systems"
            ? Wrench
            : topic === "aisb"
              ? LibraryBig
              : Grid;
  const initials = benchIconInitials(entry);
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-black/5 text-[12px] font-bold text-white shadow-sm",
        className,
      )}
      style={{ backgroundImage: palette.cleanBackgroundImage }}
      aria-label={entry.name}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.55),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.16),rgba(0,0,0,0.10))]" />
      <div className="absolute -right-[24%] -top-[20%] h-[72%] w-[72%] rounded-full bg-white/24" />
      <div className="absolute bottom-[-24%] left-[18%] h-[58%] w-[72%] rotate-[-12deg] rounded-[22px] border border-white/28 bg-white/10 backdrop-blur-[1px]" />
      <TopicIcon className="relative z-10 h-[34%] w-[34%] opacity-90 drop-shadow-sm" />
      <span className="absolute bottom-[14%] right-[14%] z-10 text-[0.52em] font-black leading-none tracking-tight text-white/90 drop-shadow-sm">
        {initials}
      </span>
    </div>
  );
}

function AppStoreIcon({
  entry,
  locale,
  className,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  className?: string;
}) {
  return <AisbAppIcon entry={entry} locale={locale} className={className} />;
}

function BenchStoreHeroArtwork({
  entry,
  locale,
  label,
  onOpen,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  label: string;
  onOpen: () => void;
}) {
  const palette = React.useMemo(
    () =>
      buildPalette(`${entry.id}:${entry.display?.palette_seed || entry.name}:hero`),
    [entry.display?.palette_seed, entry.id, entry.name],
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block aspect-[21/9] w-full overflow-hidden rounded-2xl text-left shadow-2xl shadow-blue-100 md:aspect-[3/1]"
      style={{ backgroundImage: palette.cleanBackgroundImage }}
      data-onboarding-id="benchstore-featured-card"
    >
      <div className="absolute inset-0 opacity-90">
        <div className="absolute -right-[7%] top-[8%] h-[84%] w-[45%] rounded-full bg-white/20 blur-[1px]" />
        <div className="absolute bottom-[-16%] left-[36%] h-[46%] w-[38%] rounded-full bg-black/10 blur-2xl" />
        <div className="absolute left-[52%] top-[14%] h-[58%] w-[34%] rounded-[42px] border border-white/30 bg-white/10 backdrop-blur-sm" />
      </div>
      <div className="absolute inset-y-0 right-0 hidden w-[47%] items-center justify-center md:flex">
        <motion.div
          aria-hidden
          className="absolute right-[8%] top-[18%] h-24 w-24 rounded-[28px] bg-white/68 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.48)] backdrop-blur-xl"
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 6.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[14%] top-[22%] rounded-[30px] bg-white/42 p-3 shadow-[0_28px_80px_-45px_rgba(15,23,42,0.48)] backdrop-blur-xl"
          initial={{ rotate: 0, scale: 1 }}
          whileHover={{ rotate: -2, scale: 1.03 }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
        >
          <AppStoreIcon
            entry={entry}
            locale={locale}
            className="h-24 w-24 rounded-[24px]"
          />
        </motion.div>
        <motion.div
          className="absolute bottom-[-15%] right-[22%] h-[72%] w-[58%] overflow-hidden rounded-[30px] border-2 border-white/65 shadow-[0_34px_95px_-48px_rgba(15,23,42,0.58)]"
          initial={{ rotate: -10, y: 10 }}
          whileHover={{ rotate: -7, y: 4 }}
          transition={{ type: "spring", stiffness: 170, damping: 20 }}
        >
          <BenchArtwork
            entry={entry}
            locale={locale}
            className="h-full rounded-none border-0 shadow-none"
          />
          <div className="absolute inset-0 bg-white/18 backdrop-blur-[1.5px]" />
        </motion.div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/24 via-black/4 to-transparent" />
      <div className="relative z-10 flex h-full max-w-[680px] flex-col justify-center p-6 text-white md:p-10">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest opacity-85 md:text-[13px]">
          {label}
        </p>
        <h2 className="mb-2 max-w-[600px] text-2xl font-bold tracking-tight md:text-4xl">
          {entry.name}
        </h2>
        <p className="max-w-[560px] text-sm font-medium leading-6 opacity-90 md:text-lg md:leading-7">
          {entry.one_line || entry.task_description}
        </p>
      </div>
      <div className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/5" />
    </button>
  );
}

function BenchStoreCleanPreviewArt({
  entry,
  locale,
  title,
  subtitle,
  hasPlay = false,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  title: string;
  subtitle: string;
  hasPlay?: boolean;
}) {
  const palette = React.useMemo(
    () =>
      buildPalette(`${entry.id}:${entry.display?.palette_seed || entry.name}:preview`),
    [entry.display?.palette_seed, entry.id, entry.name],
  );
  return (
    <div
      className="group relative aspect-[16/10] w-[280px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-black/5 shadow-sm md:w-[600px]"
      style={{ backgroundImage: palette.cleanBackgroundImage }}
    >
      <div className="absolute inset-0">
        <div className="absolute -right-[12%] -top-[18%] h-[72%] w-[58%] rounded-full bg-white/22" />
        <div className="absolute bottom-[-22%] left-[12%] h-[52%] w-[42%] rounded-full bg-black/10 blur-2xl" />
        <motion.div
          className="absolute bottom-[-18%] right-[8%] h-[70%] w-[50%] overflow-hidden rounded-[28px] border-2 border-white/60 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.48)]"
          initial={{ rotate: -8, y: 6 }}
          whileHover={{ rotate: -5, y: 0 }}
          transition={{ type: "spring", stiffness: 170, damping: 20 }}
        >
          <BenchArtwork
            entry={entry}
            locale={locale}
            className="h-full rounded-none border-0 shadow-none"
          />
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[1.5px]" />
        </motion.div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-8 text-white drop-shadow-lg">
        <h3 className="mb-1 text-xl font-bold tracking-tight md:text-[28px]">
          {title}
        </h3>
        <p className="line-clamp-2 max-w-[62%] text-lg font-bold leading-tight opacity-90 md:text-[22px]">
          {subtitle}
        </p>
      </div>
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
      {hasPlay ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-md transition-transform group-hover:scale-110 md:h-16 md:w-16">
            <div className="translate-x-1 border-b-[8px] border-l-[14px] border-t-[8px] border-b-transparent border-l-white border-t-transparent md:border-b-[10px] md:border-l-[18px] md:border-t-[10px]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppStoreSidebarItem({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  count?: number;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition-colors duration-200",
        active ? "bg-black/5 text-[#007aff]" : "text-gray-700 hover:bg-black/5",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          size={18}
          className={cn(active ? "text-[#007aff]" : "text-gray-500")}
        />
        <span
          className={cn(
            "truncate text-[13px] font-medium",
            active ? "text-[#007aff]" : "text-gray-900",
          )}
        >
          {label}
        </span>
      </span>
      {typeof count === "number" ? (
        <span className="shrink-0 text-[11px] font-semibold text-gray-400">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function AppStoreSectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-gray-200 py-4 first:mt-0 first:border-t-0">
      <h2 className="text-xl font-bold tracking-tight text-gray-900">
        {title}
      </h2>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="text-[13px] font-normal text-[#007aff] hover:underline"
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

function AppStoreAppRow({
  entry,
  locale,
  onOpen,
  onStart,
  starting = false,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  onOpen: () => void;
  onStart: () => void;
  starting?: boolean;
}) {
  const installed = entry.install_state?.status === "installed";
  return (
    <div className="group flex w-full items-center gap-3 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <AppStoreIcon entry={entry} locale={locale} className="h-12 w-12" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold tracking-tight text-gray-900">
            {entry.name}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-gray-500">
            {entry.one_line ||
              entry.task_mode ||
              entry.paper?.venue ||
              (locale === "zh" ? "Benchmark 任务" : "Benchmark task")}
          </span>
        </span>
      </button>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {installed ? (
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="inline-flex min-w-[78px] items-center justify-center gap-1.5 rounded-full bg-[#007aff] px-4 py-1 text-[13px] font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-[#006ee6] disabled:cursor-wait disabled:bg-[#8ec5ff]"
          >
            <Play size={13} fill="currentColor" />
            {starting
              ? locale === "zh"
                ? "准备"
                : "Prep"
              : locale === "zh"
                ? "开始"
                : "START"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full bg-[#f1f1f2] px-5 py-1 text-[13px] font-bold text-[#007aff] transition-colors hover:bg-[#e8e8e9]"
          >
            {locale === "zh" ? "获取" : "GET"}
          </button>
        )}
        <span className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
          {installed
            ? locale === "zh"
              ? "已安装"
              : "Installed"
            : entry.cost_band || entry.time_band || (locale === "zh" ? "Benchmark" : "Bench")}
        </span>
      </span>
    </div>
  );
}

function AppStoreFeaturedMiniCard({
  entry,
  locale,
  type,
  onOpen,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  type: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-64 overflow-hidden rounded-2xl border border-black/5 bg-[#f5f5f7] text-left shadow-sm"
    >
      <div
        className="absolute inset-0 opacity-75"
        style={{
          backgroundImage: buildPalette(
            `${entry.id}:${entry.display?.palette_seed || entry.name}:mini`,
          ).cardBackgroundImage,
        }}
      />
      <div className="relative z-10 flex h-full flex-col p-5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {type}
        </p>
        <h3 className="mb-2 line-clamp-2 max-w-[72%] text-xl font-bold tracking-tight text-gray-900">
          {entry.name}
        </h3>
        <p className="line-clamp-2 max-w-[68%] text-[13px] font-medium text-gray-500">
          {entry.one_line || entry.task_description || entry.paper?.venue}
        </p>
      </div>
      <div className="absolute bottom-0 right-0 h-2/3 w-2/3 translate-x-4 translate-y-4">
        <div className="h-full w-full rotate-[-12deg] overflow-hidden rounded-2xl border-2 border-white/60 shadow-lg transition-transform duration-700 group-hover:scale-105">
          <BenchArtwork
            entry={entry}
            locale={locale}
            className="h-full rounded-none border-0 shadow-none"
          />
          <div className="absolute inset-0 bg-white/18 backdrop-blur-[1.5px]" />
        </div>
      </div>
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
    </button>
  );
}

function AppStoreEditorialCard({
  entry,
  locale,
  category,
  onOpen,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  category: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col gap-3 text-left"
    >
      <div
        className="relative aspect-video w-full overflow-hidden rounded-2xl border border-black/5 shadow-sm"
        style={{
          backgroundImage: buildPalette(
            `${entry.id}:${entry.display?.palette_seed || entry.name}:editorial`,
          ).cleanBackgroundImage,
        }}
      >
        <div className="absolute inset-0 bg-white/10" />
        <div className="absolute right-5 top-5 rounded-[18px] bg-white/40 p-2 shadow-[0_20px_54px_-34px_rgba(15,23,42,0.36)] backdrop-blur-md">
          <AppStoreIcon
            entry={entry}
            locale={locale}
            className="h-14 w-14 rounded-[16px]"
          />
        </div>
        <div className="absolute bottom-[-20%] left-[18%] h-[76%] w-[58%] rotate-[-9deg] overflow-hidden rounded-2xl border-2 border-white/60 shadow-[0_28px_76px_-44px_rgba(15,23,42,0.48)] transition-transform duration-700 group-hover:scale-[1.03]">
          <BenchArtwork
            entry={entry}
            locale={locale}
            className="h-full rounded-none border-0 shadow-none"
          />
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[1.5px]" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {category}
        </p>
        <h3 className="line-clamp-1 text-[16px] font-bold leading-tight text-gray-900">
          {entry.name}
        </h3>
        <p className="line-clamp-1 text-[13px] text-gray-500">
          {entry.one_line || entry.task_description || entry.paper?.venue}
        </p>
      </div>
    </button>
  );
}

function AppStoreCatalogTile({
  entry,
  locale,
  onOpen,
  onStart,
  starting = false,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  onOpen: () => void;
  onStart: () => void;
  starting?: boolean;
}) {
  const installed = entry.install_state?.status === "installed";
  const palette = React.useMemo(
    () =>
      buildPalette(
        `${entry.id}:${entry.display?.palette_seed || entry.name}:catalog`,
      ),
    [entry.display?.palette_seed, entry.id, entry.name],
  );
  const topic = resolveBenchTopic(entry);
  const score = Number(entry.recommendation?.score || entry.compatibility?.score || 0);
  const meta = [
    benchTopicLabel(topic, locale),
    entry.aisb_direction,
    entry.task_mode,
    entry.paper?.venue,
  ].filter(Boolean);

  return (
    <div
      className="group flex min-h-[154px] w-full flex-col rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_24px_62px_-44px_rgba(15,23,42,0.36)]"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-start gap-3 text-left"
      >
        <div
          className="rounded-[18px] p-1.5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.42)]"
          style={{ backgroundImage: palette.cardBackgroundImage }}
        >
          <AppStoreIcon
            entry={entry}
            locale={locale}
            className="h-14 w-14 rounded-[15px]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-5 tracking-tight text-gray-900">
            {entry.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-gray-500">
            {entry.one_line || entry.task_description || entry.paper?.title}
          </p>
        </div>
      </button>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {meta.slice(0, 3).map((item) => (
            <span
              key={String(item)}
              className="max-w-[150px] truncate rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[10px] font-semibold text-gray-500"
            >
              {item}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={installed ? onStart : onOpen}
          disabled={installed && starting}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition",
            installed
              ? "bg-[#007aff] text-white shadow-sm shadow-blue-200 hover:bg-[#006ee6] disabled:cursor-wait disabled:bg-[#8ec5ff]"
              : "bg-[#f1f1f2] text-[#007aff] hover:bg-[#e8e8e9]",
          )}
        >
          {installed
            ? starting
              ? locale === "zh"
                ? "准备"
                : "PREP"
              : locale === "zh"
                ? "开始"
                : "START"
            : locale === "zh"
              ? "获取"
              : "GET"}
        </button>
      </div>
    </div>
  );
}

function AppStoreAllCatalogView({
  entries,
  locale,
  onOpenEntry,
  onStartEntry,
  startingEntryId,
  setSurfacePage,
  visibleCountBySurface,
}: {
  entries: BenchEntry[];
  locale: "en" | "zh";
  onOpenEntry: (entryId: string) => void;
  onStartEntry: (entry: BenchEntry) => void;
  startingEntryId: string | null;
  setSurfacePage: (page: BenchSurfacePage) => void;
  visibleCountBySurface: Map<BenchSurfacePage, number>;
}) {
  const topicCards: Array<{
    page: BenchSurfacePage;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    accent: string;
  }> = [
    { page: "aisb", icon: LibraryBig, accent: "from-sky-500 to-cyan-400" },
    { page: "llm", icon: BrainCircuit, accent: "from-indigo-500 to-blue-400" },
    { page: "cv", icon: MonitorSmartphone, accent: "from-rose-500 to-orange-400" },
    { page: "ml", icon: FlaskConical, accent: "from-emerald-500 to-lime-400" },
    { page: "systems", icon: Cpu, accent: "from-amber-500 to-yellow-400" },
    { page: "installed", icon: BadgeCheck, accent: "from-slate-700 to-slate-500" },
  ];

  return (
    <div className="pb-20" data-onboarding-id="benchstore-all-catalog">
      <section className="mb-8">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 pb-5 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#007aff]">
              {locale === "zh" ? "完整目录" : "Complete Catalog"}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-[30px]">
              {locale === "zh"
                ? `${entries.length} 个 Benchmark 全量展示`
                : `${entries.length} Benchmarks, All Visible`}
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-gray-500">
              {locale === "zh"
                ? "这里不再只展示摘要切片。当前搜索与过滤条件下的全部 Bench 都会直接出现在下面，便于逐项审计和打开详情。"
                : "This page renders every benchmark that matches the current search and filters, not a sliced storefront summary."}
            </p>
          </div>
          <div className="rounded-full bg-[#f1f1f2] px-4 py-1.5 text-[12px] font-bold text-gray-500">
            {locale === "zh" ? "All" : "All"} · {entries.length}
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {topicCards.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              type="button"
              onClick={() => setSurfacePage(item.page)}
              className="group overflow-hidden rounded-2xl border border-black/5 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_20px_56px_-42px_rgba(15,23,42,0.32)]"
            >
              <div
                className={cn(
                  "mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br text-white shadow-sm",
                  item.accent,
                )}
              >
                <Icon size={20} />
              </div>
              <div className="text-[13px] font-bold text-gray-900">
                {benchSurfaceTitle(item.page, locale)}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-gray-400">
                {visibleCountBySurface.get(item.page) || 0}
              </div>
            </button>
          );
        })}
      </section>

      <section>
        <AppStoreSectionTitle
          title={locale === "zh" ? "全部 Bench" : "All Benches"}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <AppStoreCatalogTile
              key={entry.id}
              entry={entry}
              locale={locale}
              onOpen={() => onOpenEntry(entry.id)}
              onStart={() => onStartEntry(entry)}
              starting={startingEntryId === entry.id}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AppStoreStorefrontView({
  entries,
  featuredEntry,
  libraryView,
  surfacePage,
  locale,
  loading,
  error,
  onOpenEntry,
  onStartEntry,
  startingEntryId,
  openLibraryView,
  query,
  setQuery,
  setSurfacePage,
  visibleCountBySurface,
}: {
  entries: BenchEntry[];
  featuredEntry: BenchEntry | null;
  libraryView: BenchViewMode;
  surfacePage: BenchSurfacePage;
  locale: "en" | "zh";
  loading: boolean;
  error: string | null;
  onOpenEntry: (entryId: string) => void;
  onStartEntry: (entry: BenchEntry) => void;
  startingEntryId: string | null;
  openLibraryView: () => void;
  query: string;
  setQuery: (value: string) => void;
  setSurfacePage: (page: BenchSurfacePage) => void;
  visibleCountBySurface: Map<BenchSurfacePage, number>;
}) {
  const hero = featuredEntry || entries[0] || null;
  const miniEntries = entries.filter((entry) => entry.id !== hero?.id).slice(0, 3);
  const appRows = entries.slice(0, 10);
  const editorialEntries = entries.slice(3, 7);
  const topRows = entries.slice(7, 12);
  const allText = locale === "zh" ? "查看全部" : "See All";
  const showCompleteCatalog = libraryView !== "library" && surfacePage === "all";
  const openAllCatalog = React.useCallback(() => {
    setSurfacePage("all");
  }, [setSurfacePage]);
  const title =
    libraryView === "library"
      ? locale === "zh"
        ? "Library"
        : "Library"
      : surfacePage === "recommended"
        ? locale === "zh"
          ? "探索"
          : "Discover"
        : benchSurfaceTitle(surfacePage, locale);
  const heroLabel =
    libraryView === "library"
      ? locale === "zh"
        ? "本地任务库"
        : "Local Library"
      : benchSurfaceHint(surfacePage, locale);
  const primarySection =
    libraryView === "library"
      ? locale === "zh"
        ? "你的 Bench Library"
        : "Your Bench Library"
      : surfacePage === "all"
        ? locale === "zh"
          ? "全部 Benchmark"
          : "All Benchmarks"
        : locale === "zh"
          ? `我们喜爱的 ${benchSurfaceTitle(surfacePage, locale)}`
          : `${benchSurfaceTitle(surfacePage, locale)} Benchmarks We Love`;

  return (
    <motion.div
      key={`storefront-${libraryView}-${surfacePage}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="benchstore-scrollbar h-full overflow-y-auto overscroll-contain bg-white px-4 py-6 md:px-10 md:py-10"
      data-onboarding-id="benchstore-overview-surface"
    >
      <div className="mx-auto max-w-[1200px]">
        <header className="sticky top-0 z-20 mb-6 flex items-center justify-between border-b border-gray-100 bg-white/80 py-3 backdrop-blur-md md:hidden">
          <h1 className="px-1 text-2xl font-bold tracking-tight">{title}</h1>
          <label className="relative w-44">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={locale === "zh" ? "搜索" : "Search"}
              className="h-9 w-full rounded-lg bg-black/5 pl-9 pr-3 text-[13px] outline-none"
            />
          </label>
        </header>

        <div className="mb-8 hidden items-center justify-between md:flex">
          <h1 className="text-[34px] font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          <button
            type="button"
            onClick={openLibraryView}
            className="rounded-full bg-[#f1f1f2] px-5 py-1.5 text-[13px] font-bold text-[#007aff] transition hover:bg-[#e8e8e9]"
          >
            {libraryView === "library"
              ? locale === "zh"
                ? "管理已安装"
                : "Installed"
              : locale === "zh"
                ? "进入 Library"
                : "Open Library"}
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-[#f5f5f7] px-6 py-12 text-center text-sm text-gray-500">
            Loading BenchStore...
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-[#f5f5f7] px-6 py-12 text-center text-sm text-gray-500">
            {error}
          </div>
        ) : !hero ? (
          <div className="rounded-2xl bg-[#f5f5f7] px-6 py-12 text-center text-sm text-gray-500">
            {query.trim()
              ? locale === "zh"
                ? "没有匹配结果。"
                : "No matching benchmarks found."
              : locale === "zh"
                ? "当前没有可展示的 benchmark。"
                : "No benchmarks found."}
          </div>
        ) : showCompleteCatalog ? (
          <AppStoreAllCatalogView
            entries={entries}
            locale={locale}
            onOpenEntry={onOpenEntry}
            onStartEntry={onStartEntry}
            startingEntryId={startingEntryId}
            setSurfacePage={setSurfacePage}
            visibleCountBySurface={visibleCountBySurface}
          />
        ) : (
          <>
            <section className="mb-12">
              <BenchStoreHeroArtwork
                entry={hero}
                locale={locale}
                label={heroLabel}
                onOpen={() => onOpenEntry(hero.id)}
              />
            </section>

            {miniEntries.length > 0 ? (
              <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
                {miniEntries.map((entry, index) => (
                  <AppStoreFeaturedMiniCard
                    key={entry.id}
                    entry={entry}
                    locale={locale}
                    type={
                      locale === "zh"
                        ? ["编辑精选", "入门", "研究方向"][index] || "精选"
                        : ["Editors' Choice", "Getting Started", "Research"][index] ||
                          "Featured"
                    }
                    onOpen={() => onOpenEntry(entry.id)}
                  />
                ))}
              </section>
            ) : null}

            <section className="mb-12">
              <AppStoreSectionTitle
                title={primarySection}
                action={libraryView === "store" ? allText : undefined}
                onAction={libraryView === "store" ? openAllCatalog : undefined}
              />
              <div className="grid grid-cols-1 gap-x-12 gap-y-1 md:grid-cols-2">
                {appRows.map((entry) => (
                  <AppStoreAppRow
                    key={entry.id}
                    entry={entry}
                    locale={locale}
                    onOpen={() => onOpenEntry(entry.id)}
                    onStart={() => onStartEntry(entry)}
                    starting={startingEntryId === entry.id}
                  />
                ))}
              </div>
            </section>

            {editorialEntries.length > 0 ? (
              <section className="mb-12">
                <AppStoreSectionTitle
                  title={
                    locale === "zh"
                      ? "新鲜 Benchmark 精选"
                      : "Fresh Benchmark Picks"
                  }
                  action={libraryView === "store" ? allText : undefined}
                  onAction={libraryView === "store" ? openAllCatalog : undefined}
                />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  {editorialEntries.map((entry, index) => (
                    <AppStoreEditorialCard
                      key={entry.id}
                      entry={entry}
                      locale={locale}
                      category={
                        locale === "zh"
                          ? ["新任务", "编辑精选", "AISB", "研究精选"][index] ||
                            "精选"
                          : ["New Task", "Editors' Choice", "AISB", "Research Pick"][
                              index
                            ] || "Featured"
                      }
                      onOpen={() => onOpenEntry(entry.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="pb-20">
              <AppStoreSectionTitle
                title={
                  locale === "zh"
                    ? "体验热门 Benchmark"
                    : "Top Benchmarks"
                }
                action={libraryView === "store" ? allText : undefined}
                onAction={libraryView === "store" ? openAllCatalog : undefined}
              />
              <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2 lg:grid-cols-3">
                {(topRows.length > 0 ? topRows : appRows.slice(0, 6)).map(
                  (entry) => (
                    <AppStoreAppRow
                      key={entry.id}
                      entry={entry}
                      locale={locale}
                      onOpen={() => onOpenEntry(entry.id)}
                      onStart={() => onStartEntry(entry)}
                      starting={startingEntryId === entry.id}
                    />
                  ),
                )}
              </div>
            </section>
          </>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-t border-gray-100 bg-white/95 px-6 backdrop-blur-xl md:hidden">
          {[
            { page: "recommended" as BenchSurfacePage, icon: Compass },
            { page: "llm" as BenchSurfacePage, icon: BrainCircuit },
            { page: "cv" as BenchSurfacePage, icon: MonitorSmartphone },
            { page: "ml" as BenchSurfacePage, icon: FlaskConical },
            { page: "all" as BenchSurfacePage, icon: Search },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => setSurfacePage(item.page)}
                className={cn(
                  "p-2 transition-colors",
                  item.page === surfacePage ? "text-[#007aff]" : "text-gray-400",
                )}
              >
                <Icon size={24} strokeWidth={item.page === surfacePage ? 2.5 : 1.5} />
                <span className="sr-only">
                  {benchSurfaceTitle(item.page, locale)}{" "}
                  {visibleCountBySurface.get(item.page) || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function AisbStatBox({
  label,
  value,
  subValue,
}: {
  label: string;
  value: React.ReactNode;
  subValue: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center space-y-1 text-center">
      <span className="w-full truncate px-1 text-[10px] font-bold uppercase tracking-tight text-gray-400">
        {label}
      </span>
      <div className="text-[20px] font-bold leading-none text-gray-700">
        {value}
      </div>
      <span className="w-full truncate px-1 text-[12px] font-medium text-gray-400">
        {subValue}
      </span>
    </div>
  );
}

function AisbPreviewShot({
  entry,
  locale,
  title,
  subtitle,
  hasPlay = false,
}: {
  entry: BenchEntry;
  locale: "en" | "zh";
  title: string;
  subtitle: string;
  hasPlay?: boolean;
}) {
  return (
    <BenchStoreCleanPreviewArt
      entry={entry}
      locale={locale}
      title={title}
      subtitle={subtitle}
      hasPlay={hasPlay}
    />
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="text-[10px] font-bold uppercase tracking-tight text-gray-400">
        {label}
      </div>
      <div className="mt-1 break-words text-[13px] leading-6 text-gray-700">
        {value}
      </div>
    </div>
  );
}

function DetailPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm",
        className,
      )}
    >
      <h3 className="text-[17px] font-bold tracking-tight text-gray-900">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailSummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="rounded-2xl border border-black/5 bg-[#f6f6f6]/60 px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-tight text-gray-400">
        {label}
      </div>
      <div className="mt-2 line-clamp-2 text-[15px] font-bold leading-5 text-gray-900">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-gray-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function DetailPills({ items }: { items: string[] }) {
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {filtered.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="rounded-full bg-[#f1f1f2] px-3 py-1 text-[12px] font-semibold text-gray-600"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function DetailLinks({
  links,
}: {
  links: Array<{ key: string; url: string } | null | undefined>;
}) {
  const filtered = links.filter(
    (item): item is { key: string; url: string } =>
      Boolean(item?.url && String(item.url).trim()),
  );
  if (filtered.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {filtered.map((item) => (
        <a
          key={`${item.key}-${item.url}`}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#f1f1f2] px-3 py-1 text-[12px] font-semibold text-[#007aff] hover:bg-[#e8e8e9]"
        >
          <span className="truncate">{formatCatalogFieldLabel(item.key)}</span>
          <ArrowUpRight size={12} />
        </a>
      ))}
    </div>
  );
}

function AisbAppDetailView({
  actionError,
  entry,
  installInFlight,
  installTaskLabel,
  locale,
  onBack,
  onPrimaryAction,
  progressPercent,
  relatedEntries,
  setupPacketLoading,
}: {
  actionError: string | null;
  entry: BenchEntry;
  installInFlight: boolean;
  installTaskLabel: string;
  locale: "en" | "zh";
  onBack: () => void;
  onPrimaryAction: () => Promise<void>;
  progressPercent: number;
  relatedEntries: BenchEntry[];
  setupPacketLoading: boolean;
}) {
  const installed = entry.install_state?.status === "installed";
  const score = Number(entry.recommendation?.score || entry.compatibility?.score || 0);
  const previewEntries = [entry, ...relatedEntries.filter((item) => item.id !== entry.id)]
    .slice(0, 3);
  const actionBusy = installInFlight || setupPacketLoading;
  const progress = installInFlight
    ? Math.max(2, Math.min(100, progressPercent || 2))
    : setupPacketLoading
      ? 100
      : 0;
  const compatibilityText = compatibilityLabel(entry.compatibility, locale);
  const appSubtitle =
    entry.one_line ||
    entry.task_description ||
    entry.paper?.title ||
    (locale === "zh" ? "Benchmark 任务" : "Benchmark task");
  const overviewText =
    entry.task_description ||
    entry.one_line ||
    entry.paper?.title ||
    (locale === "zh"
      ? "这个 benchmark 暂未提供详细任务描述。"
      : "This benchmark has no detailed task description yet.");
  const recommendedText = detailJoin(entry.recommended_when, locale);
  const notRecommendedText = detailJoin(entry.not_recommended_when, locale);
  const riskText = benchRiskSummary(entry, locale);
  const minimumSpec = formatResourceSpec(entry.resources?.minimum);
  const recommendedSpec = formatResourceSpec(entry.resources?.recommended);
  const rawPaper = isRecord(entry.raw_payload?.paper)
    ? (entry.raw_payload.paper as Record<string, unknown>)
    : null;
  const rawDownload = isRecord(entry.raw_payload?.download)
    ? (entry.raw_payload.download as Record<string, unknown>)
    : null;
  const rawDisplay = isRecord(entry.raw_payload?.display)
    ? (entry.raw_payload.display as Record<string, unknown>)
    : null;
  const rawOfficialLinks = isRecord(entry.raw_payload?.official_links)
    ? (entry.raw_payload.official_links as Record<string, unknown>)
    : null;
  const rawCommercial = isRecord(entry.raw_payload?.commercial)
    ? (entry.raw_payload.commercial as Record<string, unknown>)
    : null;
  const paperAuthors = [
    ...catalogStringList(rawPaper?.authors),
    ...catalogStringList(rawPaper?.author),
  ];
  const paperInstitutions = [
    ...catalogStringList(rawPaper?.institution),
    ...catalogStringList(rawPaper?.institutions),
    ...catalogStringList(rawPaper?.affiliation),
    ...catalogStringList(rawPaper?.affiliations),
  ];
  const paperLinks = catalogLinkEntries(rawPaper);
  const paperNotes = [
    ...catalogStringList(rawPaper?.notes),
    ...catalogStringList(rawPaper?.note),
    ...catalogStringList(rawPaper?.abstract_summary),
  ];
  const packageNotes = [
    ...catalogStringList(rawDownload?.notes),
    ...catalogStringList(rawDownload?.upstream_url),
    ...catalogStringList(rawDownload?.upstream_repo),
  ];
  const officialLinks = [
    entry.homepage ? { key: "homepage", url: entry.homepage } : null,
    entry.official_links?.homepage
      ? { key: "official homepage", url: entry.official_links.homepage }
      : null,
    entry.official_links?.github
      ? { key: "github", url: entry.official_links.github }
      : null,
    entry.official_links?.docs
      ? { key: "docs", url: entry.official_links.docs }
      : null,
    ...catalogLinkEntries(rawOfficialLinks),
  ];
  const downloadLinks = [
    entry.download?.url ? { key: "download", url: entry.download.url } : null,
    ...(rawDownload
      ? ["url", "repo", "upstream_url", "upstream_repo", "provider_url"]
          .map((key) => {
            const url = String(rawDownload[key] || "").trim();
            return url ? { key, url } : null;
          })
          .filter((item): item is { key: string; url: string } => Boolean(item))
      : []),
  ];
  const datasetLinks =
    entry.dataset_download?.sources
      ?.map((source, index) =>
        source.url ? { key: source.kind || `source ${index + 1}`, url: source.url } : null,
      )
      .filter((item): item is { key: string; url: string } => Boolean(item)) || [];
  const displayTags = [
    ...catalogStringList(rawDisplay?.tags),
    ...catalogStringList(rawDisplay?.domain_tags),
    ...catalogStringList(rawDisplay?.summary_cards),
  ];
  const additionalCatalogFields = React.useMemo(() => {
    if (!isRecord(entry.raw_payload)) return [];
    const remainder = pruneCatalogPayload(entry.raw_payload);
    if (!isRecord(remainder)) return [];
    return Object.entries(remainder).filter(
      ([, value]) => !isEmptyCatalogValue(value),
    );
  }, [entry.raw_payload]);
  const downloadSize =
    typeof rawDownload?.size_bytes === "number"
      ? formatBytes(rawDownload.size_bytes)
      : typeof rawDownload?.size === "number"
        ? formatBytes(rawDownload.size)
        : null;
  const downloadSha =
    String(rawDownload?.sha256 || rawDownload?.checksum || "").trim() || null;
  const datasetSources =
    entry.dataset_download?.sources?.map((source) =>
      [
        source.kind,
        source.access,
        source.url,
        source.note,
      ]
        .filter(Boolean)
        .join(" · "),
    ) || [];
  const launchProfileText =
    entry.launch_profiles?.map((profile) =>
      [
        profile.label || profile.id,
        profile.description,
      ]
        .filter(Boolean)
        .join(": "),
    ) || [];

  return (
    <motion.div
      key="aisb-detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="benchstore-scrollbar h-full overflow-y-auto overscroll-contain bg-white"
      data-onboarding-id="benchstore-detail-surface"
    >
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 px-6 py-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5"
        >
          <span className="block rotate-180">
            <ChevronRight size={24} />
          </span>
          <span className="sr-only">
            {locale === "zh" ? "返回" : "Back"}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {installed ? (
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1"
            >
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-[11px] font-bold text-green-600">
                {locale === "zh" ? "已就绪" : "Ready"}
              </span>
            </motion.div>
          ) : null}
          <button
            type="button"
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5"
            aria-label={locale === "zh" ? "更多" : "More"}
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-6 py-10">
        <header className="mb-10 flex flex-col items-start gap-6 md:flex-row md:gap-8">
          <motion.div layoutId={`bench-icon-${entry.id}`}>
            <AisbAppIcon
              entry={entry}
              locale={locale}
              className="h-32 w-32 rounded-[32px] shadow-2xl md:h-44 md:w-44 md:rounded-[40px]"
            />
          </motion.div>
          <div className="flex-1 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold leading-tight text-gray-900 md:text-[32px]">
                {entry.name}
              </h1>
              <p className="text-[17px] font-medium text-gray-500">
                {appSubtitle}
              </p>
            </div>
            <div className="flex flex-col items-start gap-4">
              <div
                className="relative h-11 w-44"
                data-onboarding-id="benchstore-detail-action-strip"
              >
                <AnimatePresence mode="wait">
                  {!installed && !actionBusy ? (
                    <motion.button
                      key="idle"
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      onClick={() => void onPrimaryAction()}
                      className="group flex h-full w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[#f1f1f2] font-bold text-[#007aff] transition-colors hover:bg-[#e8e8e9]"
                    >
                      <CloudDownload
                        size={20}
                        strokeWidth={2.5}
                        className="transition-transform group-hover:-translate-y-0.5"
                      />
                      <span>{locale === "zh" ? "获取" : "GET"}</span>
                    </motion.button>
                  ) : actionBusy ? (
                    <motion.div
                      key="downloading"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-[#f1f1f2]"
                    >
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-[#007aff]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.28 }}
                      />
                      <span className="relative z-10 text-[11px] font-black text-gray-900 mix-blend-difference">
                        {installInFlight
                          ? `${Math.round(progress)}%`
                          : installTaskLabel}
                      </span>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="ready"
                      type="button"
                      initial={{ opacity: 0, y: -10, scale: 1.06 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      onClick={() => void onPrimaryAction()}
                      className="group flex h-full w-full items-center justify-center gap-2 rounded-full border border-[#B7D2DE] bg-[linear-gradient(180deg,#F5FBFF,#DDEFF7)] font-bold text-[#0B6388] shadow-[0_16px_34px_-28px_rgba(0,90,140,0.58),inset_0_0_0_1px_rgba(255,255,255,0.82)] transition-all hover:border-[#9FC2D2] hover:bg-[linear-gradient(180deg,#EFF8FD,#D3EAF4)] hover:text-[#074F70] active:scale-[0.98]"
                    >
                      <Play
                        size={18}
                        fill="currentColor"
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                      <span className="tracking-[0.08em] uppercase">
                        {locale === "zh" ? "开始" : "START"}
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1 px-4 text-[11px] font-medium text-gray-400">
                <Check size={14} className="text-green-500" />
                <span>
                  {compatibilityText}
                  {entry.install_state?.local_path
                    ? ` · ${entry.install_state.local_path}`
                    : ""}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="mb-10 grid grid-cols-4 gap-x-2 border-y border-gray-100 py-4 md:grid-cols-7">
          <AisbStatBox
            label={locale === "zh" ? "推荐分" : "Score"}
            value={score ? score.toFixed(1) : "4.0"}
            subValue="★★★★☆"
          />
          <div className="mt-2 hidden h-10 w-px bg-gray-100 md:block" />
          <AisbStatBox
            label={locale === "zh" ? "获奖" : "Award"}
            value={entry.discovery?.featured ? (locale === "zh" ? "编辑" : "Editor") : (locale === "zh" ? "Bench" : "Bench")}
            subValue={entry.discovery?.featured_reason || entry.support_level || (locale === "zh" ? "精选任务" : "Choice")}
          />
          <div className="mt-2 hidden h-10 w-px bg-gray-100 md:block" />
          <AisbStatBox
            label={locale === "zh" ? "难度" : "Difficulty"}
            value={entry.difficulty || "M"}
            subValue={entry.time_band || "AISB"}
          />
          <div className="mt-2 hidden h-10 w-px bg-gray-100 md:block" />
          <AisbStatBox
            label={locale === "zh" ? "类别" : "Category"}
            value={<Grid size={26} />}
            subValue={benchTopicLabel(resolveBenchTopic(entry), locale)}
          />
        </div>

        {actionError ? (
          <div className="mb-10 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        <section className="mb-12">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {detailSectionLabel("overview", locale)}
            </h2>
            <button className="text-[15px] text-[#007aff] hover:underline">
              {locale === "zh" ? "版本历史记录" : "Version History"}
            </button>
          </div>
          <div className="mb-4 flex justify-between text-[15px]">
            <span className="font-medium text-gray-900 opacity-60">
              {entry.task_mode || entry.support_level || compatibilityText}
            </span>
            <span className="text-gray-400">
              {entry.version || (locale === "zh" ? "最新版本" : "Latest")}
            </span>
          </div>
          <p className="max-w-3xl text-[15px] leading-relaxed text-gray-600">
            {overviewText}
            <span className="cursor-pointer text-[#007aff] hover:underline">
              {" "}
              {locale === "zh" ? "更多" : "More"}
            </span>
          </p>
        </section>

        <section className="mb-12">
          <div className="mb-5 flex items-end justify-between gap-4 border-t border-gray-100 pt-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#007aff]">
                {locale === "zh" ? "完整 Bench 资料" : "Complete Bench Details"}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
                {locale === "zh" ? "审计所需字段" : "Fields For Review"}
              </h2>
            </div>
            <span className="hidden rounded-full bg-[#f1f1f2] px-4 py-1.5 text-[12px] font-bold text-gray-500 md:inline-flex">
              {entry.source_file || entry.id}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailSummaryTile
              label="Catalog ID"
              value={entry.id}
              hint={entry.schema_version ? `schema ${entry.schema_version}` : entry.source_file}
            />
            <DetailSummaryTile
              label={locale === "zh" ? "任务方向" : "Direction"}
              value={entry.aisb_direction || benchTopicLabel(resolveBenchTopic(entry), locale)}
              hint={entry.task_mode || entry.support_level}
            />
            <DetailSummaryTile
              label={locale === "zh" ? "运行要求" : "Execution"}
              value={detailBool(entry.requires_execution, locale)}
              hint={entry.time_band || entry.difficulty || compatibilityText}
            />
            <DetailSummaryTile
              label={locale === "zh" ? "数据访问" : "Data Access"}
              value={entry.data_access || credentialModeText(entry.credential_requirements?.mode, locale)}
              hint={entry.snapshot_status || entry.integrity_level}
            />
          </div>
        </section>

        <section className="mb-12 grid gap-5">
          <DetailPanel title={locale === "zh" ? "研究目标与适用场景" : "Research Goal & Fit"}>
            <DetailField
              label={locale === "zh" ? "任务描述" : "Task Description"}
              value={entry.task_description || entry.one_line}
            />
            <DetailField
              label={locale === "zh" ? "适合使用" : "Recommended When"}
              value={recommendedText}
            />
            <DetailField
              label={locale === "zh" ? "不适合使用" : "Not Recommended When"}
              value={notRecommendedText}
            />
          </DetailPanel>

          <DetailPanel title={locale === "zh" ? "运行与来源快照" : "Runtime & Provenance Snapshot"}>
            <DetailField
              label={locale === "zh" ? "最低配置" : "Minimum"}
              value={<DetailPills items={minimumSpec} />}
            />
            <DetailField
              label={locale === "zh" ? "推荐配置" : "Recommended"}
              value={<DetailPills items={recommendedSpec} />}
            />
            <DetailField
              label={locale === "zh" ? "下载来源" : "Download Sources"}
              value={<DetailLinks links={downloadLinks} />}
            />
            <DetailField
              label={locale === "zh" ? "官方链接" : "Official Links"}
              value={<DetailLinks links={officialLinks} />}
            />
          </DetailPanel>
        </section>

        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-bold">
            {locale === "zh" ? "预览" : "Preview"}
          </h2>
          <div className="-mx-6 flex space-x-6 overflow-x-auto px-6 pb-6">
            {previewEntries.map((item, index) => (
              <AisbPreviewShot
                key={item.id}
                entry={item}
                locale={locale}
                title={
                  locale === "zh"
                    ? ["任务目标", "评测路线", "启动配置"][index] || "AISB"
                    : ["Task Goal", "Evaluation", "Launch Setup"][index] ||
                      "AISB"
                }
                subtitle={item.name}
                hasPlay={index !== 1}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 px-2 text-gray-400">
            <Grid size={16} />
            <span className="text-[13px] font-medium">
              {entry.paper?.venue || entry.aisb_direction || "BenchStore"}
            </span>
          </div>
        </section>

        <footer className="space-y-6 border-t border-gray-100 pt-8 text-[13px] text-gray-500">
          <p className="leading-relaxed">
            {recommendedText ||
              entry.one_line ||
              entry.task_description}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-50 pt-4">
            {entry.paper?.url ? (
              <a
                href={entry.paper.url}
                target="_blank"
                rel="noreferrer"
                className="text-[15px] font-bold text-[#007aff] hover:underline"
              >
                {entry.paper?.venue || (locale === "zh" ? "论文" : "Paper")}
              </a>
            ) : (
              <span className="text-[15px] font-bold text-[#007aff]">
                {entry.paper?.venue || entry.aisb_direction || "BenchStore"}
              </span>
            )}
            <div className="flex gap-8">
              <a
                href={entry.homepage || entry.official_links?.homepage || entry.paper?.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-gray-500 transition-colors hover:text-gray-900"
              >
                <span className="font-bold">
                  {locale === "zh" ? "网站" : "Website"}
                </span>
                <Compass size={18} />
              </a>
              <a
                href={entry.official_links?.github || entry.official_links?.docs || entry.download?.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-gray-500 transition-colors hover:text-gray-900"
              >
                <span className="font-bold">
                  {locale === "zh" ? "支持" : "Support"}
                </span>
                <Wrench size={18} />
              </a>
            </div>
          </div>
        </footer>

        <div className="mt-12 grid gap-5 border-t border-gray-100 pt-8">
          <DetailPanel title={detailSectionLabel("benchInfo", locale)}>
            <DetailField label="Catalog ID" value={entry.id} />
            <DetailField label={locale === "zh" ? "方向" : "Direction"} value={entry.aisb_direction || benchTopicLabel(resolveBenchTopic(entry), locale)} />
            <DetailField label={locale === "zh" ? "模式" : "Mode"} value={entry.task_mode} />
            <DetailField label={locale === "zh" ? "支持等级" : "Support Level"} value={entry.support_level} />
            <DetailField label={locale === "zh" ? "快照状态" : "Snapshot Status"} value={entry.snapshot_status} />
            <DetailField label={locale === "zh" ? "完整性级别" : "Integrity Level"} value={entry.integrity_level} />
            <DetailField label={locale === "zh" ? "成本档位" : "Cost Band"} value={entry.cost_band} />
            <DetailField label={locale === "zh" ? "时长估计" : "Time Band"} value={entry.time_band} />
            <DetailField label={locale === "zh" ? "难度" : "Difficulty"} value={entry.difficulty} />
            <DetailField label={locale === "zh" ? "适合轨道" : "Track Fit"} value={<DetailPills items={entry.track_fit || []} />} />
            <DetailField label={locale === "zh" ? "主要产物" : "Primary Outputs"} value={<DetailPills items={entry.primary_outputs || []} />} />
            <DetailField label={locale === "zh" ? "标签" : "Tags"} value={<DetailPills items={entry.capability_tags || []} />} />
            <DetailField label={locale === "zh" ? "启动档位" : "Launch Profiles"} value={<DetailPills items={launchProfileText} />} />
            <DetailField label={locale === "zh" ? "适合使用" : "Recommended When"} value={recommendedText} />
            <DetailField label={locale === "zh" ? "不适合使用" : "Not Recommended When"} value={notRecommendedText} />
          </DetailPanel>

          <DetailPanel title={detailSectionLabel("paper", locale)}>
            <DetailField label={locale === "zh" ? "标题" : "Title"} value={entry.paper?.title} />
            <DetailField label={locale === "zh" ? "Venue" : "Venue"} value={entry.paper?.venue} />
            <DetailField label={locale === "zh" ? "年份" : "Year"} value={entry.paper?.year} />
            <DetailField label={locale === "zh" ? "作者" : "Authors"} value={paperAuthors.join(", ")} />
            <DetailField label={locale === "zh" ? "机构" : "Institutions"} value={paperInstitutions.join(" | ")} />
            <DetailField label={locale === "zh" ? "许可" : "License"} value={String(rawPaper?.license || "")} />
            <DetailField label="DOI" value={String(rawPaper?.doi || "")} />
            <DetailField
              label={locale === "zh" ? "链接" : "Links"}
              value={<DetailLinks links={[
                entry.paper?.url ? { key: "paper", url: entry.paper.url } : null,
                ...paperLinks,
              ]} />}
            />
            <DetailField label={locale === "zh" ? "说明" : "Notes"} value={paperNotes.join(locale === "zh" ? "；" : "; ")} />
          </DetailPanel>

          <DetailPanel title={detailSectionLabel("runtime", locale)}>
            <DetailField label="Python" value={entry.environment?.python} />
            <DetailField label="CUDA" value={entry.environment?.cuda} />
            <DetailField label="PyTorch" value={entry.environment?.pytorch} />
            <DetailField label="FlashAttention" value={entry.environment?.flash_attn} />
            <DetailField label={locale === "zh" ? "关键依赖" : "Key Packages"} value={<DetailPills items={entry.environment?.key_packages || []} />} />
            <DetailField label={locale === "zh" ? "环境说明" : "Environment Notes"} value={(entry.environment?.notes || []).join(locale === "zh" ? "；" : "; ")} />
          </DetailPanel>

          <DetailPanel title={detailSectionLabel("resources", locale)}>
            <DetailField label={locale === "zh" ? "最低配置" : "Minimum"} value={<DetailPills items={minimumSpec} />} />
            <DetailField label={locale === "zh" ? "推荐配置" : "Recommended"} value={<DetailPills items={recommendedSpec} />} />
            <DetailField label={locale === "zh" ? "资源置信度" : "Resource Confidence"} value={resourceConfidenceText(entry.compatibility?.resource_confidence, locale)} />
            <DetailField label={locale === "zh" ? "设备适配" : "Device Fit"} value={compatibilityText} />
            <DetailField label={locale === "zh" ? "推荐分" : "Recommendation Score"} value={score ? score.toFixed(1) : null} />
            <DetailField label={locale === "zh" ? "容量级别" : "Capacity Class"} value={entry.recommendation?.capacity_class} />
            <DetailField label={locale === "zh" ? "预计时长上限" : "Time Upper Bound"} value={formatTimeUpperHours(entry.recommendation?.time_upper_hours, locale)} />
            <DetailField label={locale === "zh" ? "推荐理由" : "Recommendation Reasons"} value={(entry.recommendation?.reasons || entry.compatibility?.recommended_reasons || entry.compatibility?.minimum_reasons || []).join(locale === "zh" ? "；" : "; ")} />
          </DetailPanel>

          <DetailPanel title={detailSectionLabel("data", locale)}>
            <DetailField label={locale === "zh" ? "数据访问" : "Data Access"} value={entry.data_access} />
            <DetailField label={locale === "zh" ? "需要论文" : "Requires Paper"} value={detailBool(entry.requires_paper, locale)} />
            <DetailField label={locale === "zh" ? "需要执行" : "Requires Execution"} value={detailBool(entry.requires_execution, locale)} />
            <DetailField label={locale === "zh" ? "数据获取方式" : "Dataset Method"} value={entry.dataset_download?.primary_method} />
            <DetailField label={locale === "zh" ? "数据源" : "Dataset Sources"} value={<DetailPills items={datasetSources} />} />
            <DetailField label={locale === "zh" ? "数据链接" : "Dataset Links"} value={<DetailLinks links={datasetLinks} />} />
            <DetailField label={locale === "zh" ? "数据说明" : "Dataset Notes"} value={(entry.dataset_download?.notes || []).join(locale === "zh" ? "；" : "; ")} />
            <DetailField label={locale === "zh" ? "凭证模式" : "Credential Mode"} value={credentialModeText(entry.credential_requirements?.mode, locale)} />
            <DetailField label={locale === "zh" ? "凭证项" : "Credential Items"} value={<DetailPills items={entry.credential_requirements?.items || []} />} />
            <DetailField label={locale === "zh" ? "凭证说明" : "Credential Notes"} value={(entry.credential_requirements?.notes || []).join(locale === "zh" ? "；" : "; ")} />
          </DetailPanel>

          <DetailPanel title={detailSectionLabel("package", locale)}>
            <DetailField label={locale === "zh" ? "下载链接" : "Download URL"} value={<DetailLinks links={downloadLinks} />} />
            <DetailField label={locale === "zh" ? "压缩格式" : "Archive Type"} value={entry.download?.archive_type} />
            <DetailField label={locale === "zh" ? "本地目录名" : "Local Folder"} value={entry.download?.local_dir_name} />
            <DetailField label={locale === "zh" ? "提供方" : "Provider"} value={String(rawDownload?.provider || "")} />
            <DetailField label={locale === "zh" ? "仓库" : "Repository"} value={String(rawDownload?.repo || "")} />
            <DetailField label={locale === "zh" ? "标签" : "Tag"} value={String(rawDownload?.tag || "")} />
            <DetailField label={locale === "zh" ? "资源文件" : "Asset Name"} value={String(rawDownload?.asset_name || "")} />
            <DetailField label={locale === "zh" ? "文件大小" : "Size"} value={downloadSize} />
            <DetailField label="SHA-256" value={downloadSha} />
            <DetailField label={locale === "zh" ? "本地路径" : "Local Path"} value={entry.install_state?.local_path} />
            <DetailField label={locale === "zh" ? "压缩包路径" : "Archive Path"} value={entry.install_state?.archive_path} />
            <DetailField label={locale === "zh" ? "安装状态" : "Install State"} value={entry.install_state?.status || (locale === "zh" ? "未安装" : "Not installed")} />
            <DetailField label={locale === "zh" ? "已下载" : "Downloaded"} value={entry.install_state?.bytes_downloaded != null ? formatBytes(entry.install_state.bytes_downloaded) : null} />
            <DetailField label={locale === "zh" ? "总大小" : "Total Bytes"} value={entry.install_state?.bytes_total != null ? formatBytes(entry.install_state.bytes_total) : null} />
            <DetailField label={locale === "zh" ? "安装时间" : "Installed At"} value={entry.install_state?.installed_at} />
            <DetailField label={locale === "zh" ? "商业费用" : "Commercial Fee"} value={formatAnnualFee(entry.commercial?.annual_fee ?? rawCommercial?.annual_fee as string | number | null | undefined)} />
            <DetailField label={locale === "zh" ? "包说明" : "Package Notes"} value={packageNotes.join(locale === "zh" ? "；" : "; ")} />
          </DetailPanel>

          {riskText || hasBenchRisk(entry) ? (
            <DetailPanel title={detailSectionLabel("risk", locale)}>
              <DetailField label={locale === "zh" ? "风险标签" : "Risk Flags"} value={<DetailPills items={entry.risk_flags || []} />} />
              <DetailField label={locale === "zh" ? "风险说明" : "Risk Notes"} value={(entry.risk_notes || []).join(locale === "zh" ? "；" : "; ")} />
            </DetailPanel>
          ) : null}

          <DetailPanel title={detailSectionLabel("catalog", locale)}>
            <DetailField label={locale === "zh" ? "Schema 版本" : "Schema Version"} value={entry.schema_version} />
            <DetailField label={locale === "zh" ? "Source File" : "Source File"} value={entry.source_file} />
            <DetailField label={locale === "zh" ? "调色种子" : "Palette Seed"} value={rawDisplay?.palette_seed ? String(rawDisplay.palette_seed) : entry.display?.palette_seed} />
            <DetailField label={locale === "zh" ? "视觉风格" : "Art Style"} value={rawDisplay?.art_style ? String(rawDisplay.art_style) : entry.display?.art_style} />
            <DetailField label={locale === "zh" ? "强调优先级" : "Accent Priority"} value={rawDisplay?.accent_priority ? String(rawDisplay.accent_priority) : entry.display?.accent_priority} />
            <DetailField label={locale === "zh" ? "图片路径" : "Image Path"} value={entry.image_path || entry.image_url} />
            <DetailField label={locale === "zh" ? "展示标签" : "Display Tags"} value={<DetailPills items={displayTags} />} />
            {additionalCatalogFields.length > 0 ? (
              <div className="mt-3 space-y-3">
                {additionalCatalogFields.map(([key, value]) => (
                  <div key={key} className="border-t border-gray-100 pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-tight text-gray-400">
                      {formatCatalogFieldLabel(key)}
                    </div>
                    <div className="mt-2">
                      <AutoCatalogValue value={value} locale={locale} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </DetailPanel>

        </div>
      </div>
    </motion.div>
  );
}

function BenchAppStoreShell({
  actionError,
  activeEntry,
  entries,
  error,
  featuredEntry,
  installInFlight,
  installTaskLabel,
  loading,
  locale,
  libraryView,
  onBackFromDetail,
  onClose,
  onOpenEntry,
  onPrimaryAction,
  onStartEntry,
  openLibraryView,
  progressPercent,
  query,
  setQuery,
  setSurfacePage,
  startingEntryId,
  surfacePage,
  setupPacketLoading,
  visibleCountBySurface,
}: {
  actionError: string | null;
  activeEntry: BenchEntry | null;
  entries: BenchEntry[];
  error: string | null;
  featuredEntry: BenchEntry | null;
  installInFlight: boolean;
  installTaskLabel: string;
  loading: boolean;
  locale: "en" | "zh";
  libraryView: BenchViewMode;
  onBackFromDetail: () => void;
  onClose: () => void;
  onOpenEntry: (entryId: string) => void;
  onPrimaryAction: () => Promise<void>;
  onStartEntry: (entry: BenchEntry) => void;
  openLibraryView: () => void;
  progressPercent: number;
  query: string;
  setQuery: (value: string) => void;
  setSurfacePage: (page: BenchSurfacePage) => void;
  startingEntryId: string | null;
  surfacePage: BenchSurfacePage;
  setupPacketLoading: boolean;
  visibleCountBySurface: Map<BenchSurfacePage, number>;
}) {
  const sidebarItems: Array<{
    page: BenchSurfacePage;
    label: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
  }> = [
    {
      page: "recommended",
      label: locale === "zh" ? "推荐" : "Discover",
      icon: WandSparkles,
    },
    { page: "all", label: locale === "zh" ? "全部" : "All", icon: Grid },
    { page: "aisb", label: locale === "zh" ? "AISB" : "AISB", icon: LibraryBig },
    { page: "llm", label: "LLM", icon: BrainCircuit },
    { page: "cv", label: "CV", icon: MonitorSmartphone },
    { page: "ml", label: "ML", icon: FlaskConical },
    { page: "systems", label: locale === "zh" ? "系统" : "Systems", icon: Wrench },
    {
      page: "installed",
      label: locale === "zh" ? "已安装" : "Installed",
      icon: Download,
    },
  ];

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden bg-white font-sans text-gray-900 selection:bg-[#007aff]/20 selection:text-[#007aff]"
      data-onboarding-id="benchstore-dialog"
    >
      <aside
        className="hidden h-full w-64 shrink-0 flex-col border-r border-[#e5e5e5] bg-[#f6f6f6]/85 backdrop-blur-xl md:flex"
        data-onboarding-id="benchstore-sidebar"
      >
        <div className="space-y-4 p-4">
          <label className="group relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-500"
              size={14}
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={locale === "zh" ? "搜索" : "Search"}
              className="w-full rounded-lg border border-transparent bg-black/5 py-1.5 pl-9 pr-4 text-[13px] outline-none transition-all placeholder:text-gray-500 hover:bg-black/10 focus:border-black/5 focus:bg-white focus:shadow-md"
            />
          </label>
          <nav className="space-y-0.5">
            {sidebarItems.map((item) => (
              <AppStoreSidebarItem
                key={item.page}
                active={item.page === surfacePage && !activeEntry}
                count={visibleCountBySurface.get(item.page) || 0}
                icon={item.icon}
                label={item.label}
                onClick={() => {
                  setSurfacePage(item.page);
                  if (activeEntry) onBackFromDetail();
                }}
              />
            ))}
          </nav>
        </div>
        <div className="mt-auto border-t border-black/5 p-4">
          <button
            type="button"
            onClick={openLibraryView}
            className="flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-black/5"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-sm">
              <img
                src="/ui/logo.svg"
                alt="DeepScientist"
                className="h-6 w-6 object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-[13px] font-bold text-gray-900">
                Bench Library
              </h4>
              <p className="text-[11px] text-gray-500">
                {locale === "zh" ? "本地任务库" : "Local catalog"}
              </p>
            </div>
          </button>
        </div>
      </aside>

      <main className="relative h-full min-w-0 flex-1 overflow-hidden bg-white">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-50 rounded-full p-2 text-gray-500 transition hover:bg-black/5 hover:text-gray-900"
          aria-label={locale === "zh" ? "关闭" : "Close"}
          data-onboarding-id="benchstore-close"
        >
          ×
        </button>
        {activeEntry ? (
          <AisbAppDetailView
            actionError={actionError}
            entry={activeEntry}
            installInFlight={installInFlight}
            installTaskLabel={installTaskLabel}
            locale={locale}
            onBack={onBackFromDetail}
            onPrimaryAction={onPrimaryAction}
            progressPercent={progressPercent}
            relatedEntries={entries}
            setupPacketLoading={setupPacketLoading}
          />
        ) : (
          <AppStoreStorefrontView
            entries={entries}
            error={error}
            featuredEntry={featuredEntry}
            libraryView={libraryView}
            loading={loading}
            locale={locale}
            onOpenEntry={onOpenEntry}
            onStartEntry={onStartEntry}
            openLibraryView={openLibraryView}
            query={query}
            setQuery={setQuery}
            setSurfacePage={setSurfacePage}
            startingEntryId={startingEntryId}
            surfacePage={surfacePage}
            visibleCountBySurface={visibleCountBySurface}
          />
        )}
      </main>
    </div>
  );
}

export function BenchStoreDialog({
  open,
  locale,
  onClose,
  onStartWithSetupPacket,
}: BenchStoreDialogProps) {
  const navigate = useNavigate();
  const t = React.useMemo(() => copy(locale), [locale]);
  const [catalog, setCatalog] = React.useState<BenchCatalogPayload | null>(
    null,
  );
  const [questSummaries, setQuestSummaries] = React.useState<QuestSummary[]>(
    [],
  );
  const [libraryView, setLibraryView] = React.useState<BenchViewMode>("store");
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(
    null,
  );
  const [detailEntry, setDetailEntry] = React.useState<BenchEntry | null>(null);
  const [installTaskIds, setInstallTaskIds] = React.useState<
    Record<string, string>
  >({});
  const [startingEntryId, setStartingEntryId] = React.useState<string | null>(
    null,
  );
  const [setupPacketLoading, setSetupPacketLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sortMode: SortMode = "recommended";
  const [fitFilter, setFitFilter] = React.useState<FitFilter>("all");
  const [directionFilter, setDirectionFilter] = React.useState("all");
  const [modeFilter, setModeFilter] = React.useState("all");
  const [trackFilter, setTrackFilter] = React.useState("all");
  const [accessFilter, setAccessFilter] = React.useState("all");
  const [executionFilter, setExecutionFilter] =
    React.useState<BooleanFilter>("all");
  const [paperFilter, setPaperFilter] = React.useState<BooleanFilter>("all");
  const [costFilter, setCostFilter] = React.useState("all");
  const [difficultyFilter, setDifficultyFilter] = React.useState("all");
  const [surfacePage, setSurfacePage] =
    React.useState<BenchSurfacePage>("recommended");
  const [query, setQuery] = React.useState("");
  const [activeRunnerName, setActiveRunnerName] = React.useState(() =>
    normalizeBuiltinRunnerName("codex"),
  );
  const contentScrollRef = React.useRef<HTMLDivElement | null>(null);
  const lastStoreSurfaceRef = React.useRef<BenchSurfacePage>("recommended");

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    void client.configDocument("config").then((payload) => {
      if (!active) return;
      const structured = payload.meta?.structured_config && typeof payload.meta.structured_config === "object"
        ? (payload.meta.structured_config as Record<string, unknown>)
        : {};
      setActiveRunnerName(normalizeBuiltinRunnerName(structured.default_runner));
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  const openStoreView = React.useCallback(() => {
    setLibraryView("store");
    setSurfacePage(lastStoreSurfaceRef.current || "recommended");
    setSelectedEntryId(null);
    setDetailEntry(null);
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const openLibraryView = React.useCallback(() => {
    setLibraryView("library");
    setSurfacePage("installed");
    lastStoreSurfaceRef.current = surfacePage;
    setSelectedEntryId(null);
    setDetailEntry(null);
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const reloadCatalog = React.useCallback(async () => {
    const payload = await listBenchStoreEntries(locale);
    setCatalog(payload);
  }, [locale]);

  const reloadDetail = React.useCallback(async (entryId: string) => {
    const payload = await getBenchStoreEntry(entryId, locale);
    setDetailEntry(payload.entry);
  }, [locale]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void Promise.allSettled([listBenchStoreEntries(locale), client.quests()])
      .then((results) => {
        if (!active) return;
        const [catalogResult, questResult] = results;
        if (catalogResult.status === "fulfilled") {
          setCatalog(catalogResult.value);
          setError(null);
        } else {
          setError(
            catalogResult.reason instanceof Error
              ? catalogResult.reason.message
              : "Failed to load BenchStore.",
          );
        }
        if (questResult.status === "fulfilled") {
          setQuestSummaries(questResult.value || []);
        } else {
          setQuestSummaries([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, locale]);

  React.useEffect(() => {
    if (!selectedEntryId) {
      setActionError(null);
    }
  }, [selectedEntryId]);

  React.useEffect(() => {
    if (open) return;
    setLibraryView("store");
    setSurfacePage("recommended");
    lastStoreSurfaceRef.current = "recommended";
    setSelectedEntryId(null);
    setDetailEntry(null);
    setStartingEntryId(null);
  }, [open]);

  React.useEffect(() => {
    if (libraryView === "store") {
      lastStoreSurfaceRef.current = surfacePage;
    }
  }, [libraryView, surfacePage]);

  React.useEffect(() => {
    if (!open || !selectedEntryId) return;
    let active = true;
    setLoadingDetail(true);
    void getBenchStoreEntry(selectedEntryId, locale)
      .then((payload) => {
        if (!active) return;
        setDetailEntry(payload.entry);
      })
      .catch(() => {
        if (!active) return;
        const local =
          catalog?.items.find((item) => item.id === selectedEntryId) ?? null;
        setDetailEntry(local);
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [catalog?.items, locale, open, selectedEntryId]);

  const linkedQuestMap = React.useMemo(() => {
    const map = new Map<string, QuestSummary[]>();
    for (const summary of questSummaries) {
      const entryId = benchEntryIdFromQuest(summary);
      if (!entryId) continue;
      const current = map.get(entryId) || [];
      current.push(summary);
      current.sort(
        (left, right) =>
          Date.parse(right.updated_at || "") -
          Date.parse(left.updated_at || ""),
      );
      map.set(entryId, current);
    }
    return map;
  }, [questSummaries]);

  const libraryEntries = React.useMemo(
    () =>
      sortEntries(
        (catalog?.items ?? []).filter(
          (item) =>
            item.install_state?.status === "installed" ||
            (linkedQuestMap.get(item.id)?.length || 0) > 0,
        ),
        sortMode,
      ),
    [catalog?.items, linkedQuestMap, sortMode],
  );

  const bestMatchIds = React.useMemo(
    () => new Set(catalog?.shelves?.best_match_ids || []),
    [catalog?.shelves?.best_match_ids],
  );

  const filteredEntries = React.useMemo(() => {
    const raw =
      libraryView === "library" ? libraryEntries : (catalog?.items ?? []);
    const normalizedQuery = query.trim().toLowerCase();
    const searched = normalizedQuery
      ? raw.filter((item) => {
          const searchText = String(
            item.search_text ||
              [
                item.id,
                item.name,
                item.one_line,
                item.task_description,
                item.paper?.title,
                item.paper?.venue,
                ...(item.capability_tags || []),
                ...(item.track_fit || []),
                ...(item.environment?.key_packages || []),
                ...(item.environment?.notes || []),
              ]
                .filter(Boolean)
                .join(" "),
          ).toLowerCase();
          return searchText.includes(normalizedQuery);
        })
      : raw;
    const filtered = searched.filter((item) => {
      if (
        fitFilter === "best_match" &&
        item.recommendation?.shelf_bucket !== "best_match"
      )
        return false;
      if (
        fitFilter === "runnable" &&
        !(item.compatibility?.minimum_ok || item.compatibility?.recommended_ok)
      )
        return false;
      if (
        fitFilter === "installed" &&
        item.install_state?.status !== "installed"
      )
        return false;
      if (
        fitFilter === "hide_unsupported" &&
        !item.compatibility?.minimum_ok &&
        !item.compatibility?.recommended_ok
      )
        return false;
      if (
        directionFilter !== "all" &&
        String(item.aisb_direction || "") !== directionFilter
      )
        return false;
      if (modeFilter !== "all" && String(item.task_mode || "") !== modeFilter)
        return false;
      if (
        trackFilter !== "all" &&
        !(item.track_fit || []).includes(trackFilter)
      )
        return false;
      if (
        accessFilter !== "all" &&
        String(item.data_access || "") !== accessFilter
      )
        return false;
      if (executionFilter !== "all") {
        const needsExecution =
          item.requires_execution == null
            ? null
            : String(Boolean(item.requires_execution));
        if (needsExecution !== executionFilter) return false;
      }
      if (paperFilter !== "all") {
        const needsPaper =
          item.requires_paper == null
            ? null
            : String(Boolean(item.requires_paper));
        if (needsPaper !== paperFilter) return false;
      }
      if (costFilter !== "all" && String(item.cost_band || "") !== costFilter)
        return false;
      if (
        difficultyFilter !== "all" &&
        String(item.difficulty || "") !== difficultyFilter
      )
        return false;
      return true;
    });
    return sortEntries(filtered, sortMode);
  }, [
    accessFilter,
    catalog?.items,
    libraryEntries,
    libraryView,
    linkedQuestMap,
    costFilter,
    difficultyFilter,
    directionFilter,
    executionFilter,
    fitFilter,
    modeFilter,
    paperFilter,
    query,
    sortMode,
    trackFilter,
  ]);

  const visibleEntries = React.useMemo(() => {
    if (libraryView === "library") return filteredEntries;
    return filteredEntries.filter((item) =>
      surfacePageMatchesEntry(item, surfacePage, bestMatchIds),
    );
  }, [bestMatchIds, filteredEntries, libraryView, surfacePage]);

  const visibleCountBySurface = React.useMemo(() => {
    const counts = new Map<BenchSurfacePage, number>();
    for (const page of BENCH_SURFACE_ORDER) {
      counts.set(page, 0);
    }
    if (libraryView === "library") {
      counts.set("installed", filteredEntries.length);
      counts.set("compare", Math.min(3, filteredEntries.length));
      return counts;
    }
    for (const entry of filteredEntries) {
      for (const page of BENCH_SURFACE_ORDER) {
        if (surfacePageMatchesEntry(entry, page, bestMatchIds)) {
          counts.set(page, (counts.get(page) || 0) + 1);
        }
      }
    }
    return counts;
  }, [bestMatchIds, filteredEntries, libraryView]);

  const showcaseEntries = React.useMemo(
    () =>
      libraryView === "store" && surfacePage === "aisb"
        ? visibleEntries
        : visibleEntries.filter((item) => !hasBenchRisk(item)),
    [libraryView, surfacePage, visibleEntries],
  );

  const recommendedEntries = React.useMemo(
    () =>
      showcaseEntries
        .filter(
          (item) =>
            item.compatibility?.minimum_ok ||
            item.compatibility?.recommended_ok,
        )
        .slice(0, 6),
    [showcaseEntries],
  );

  const featuredEntry = React.useMemo(() => {
    const items = showcaseEntries;
    return (
      items.find((item) => bestMatchIds.has(item.id) && hasBenchImage(item)) ??
      items.find((item) => bestMatchIds.has(item.id)) ??
      recommendedEntries.find((item) => hasBenchImage(item)) ??
      recommendedEntries[0] ??
      showcaseEntries.find((item) => hasBenchImage(item)) ??
      showcaseEntries[0] ??
      null
    );
  }, [
    recommendedEntries,
    showcaseEntries,
    bestMatchIds,
  ]);

  const activeEntry = React.useMemo(() => {
    if (!selectedEntryId) return null;
    return detailEntry?.id === selectedEntryId
      ? detailEntry
      : (catalog?.items.find((item) => item.id === selectedEntryId) ?? null);
  }, [catalog?.items, detailEntry, selectedEntryId]);

  const surfaceFeaturedEntry = React.useMemo(() => {
    return (
      featuredEntry ??
      visibleEntries[0] ??
      recommendedEntries[0] ??
      activeEntry ??
      catalog?.items[0] ??
      null
    );
  }, [
    activeEntry,
    catalog?.items,
    featuredEntry,
    recommendedEntries,
    visibleEntries,
  ]);

  const activeInstallTaskId = React.useMemo(() => {
    if (!selectedEntryId) return null;
    const fromLocalMap = installTaskIds[selectedEntryId];
    if (fromLocalMap) return fromLocalMap;
    const taskId = String(activeEntry?.install_state?.task_id || "").trim();
    if (taskId && activeEntry?.install_state?.status === "installing")
      return taskId;
    return null;
  }, [
    activeEntry?.install_state?.status,
    activeEntry?.install_state?.task_id,
    installTaskIds,
    selectedEntryId,
  ]);

  const installStream = useAdminTaskStream(activeInstallTaskId);
  const installTask = installStream.task;
  const installStatus = String(installTask?.status || "")
    .trim()
    .toLowerCase();
  const installMetadata =
    installTask?.metadata &&
    typeof installTask.metadata === "object" &&
    !Array.isArray(installTask.metadata)
      ? (installTask.metadata as Record<string, unknown>)
      : null;
  const installBytesDownloaded = readNumberMeta(
    installMetadata,
    "bytes_downloaded",
  );
  const installBytesTotal = readNumberMeta(installMetadata, "bytes_total");
  const installSpeed = readNumberMeta(installMetadata, "speed_bytes_per_sec");
  const installEta = readNumberMeta(installMetadata, "eta_seconds");
  const installInFlight = Boolean(
    installTask &&
    !["completed", "failed", "cancelled"].includes(installStatus),
  );

  React.useEffect(() => {
    if (!selectedEntryId || !activeInstallTaskId || !installTask) return;
    const metadata =
      installTask.metadata &&
      typeof installTask.metadata === "object" &&
      !Array.isArray(installTask.metadata)
        ? (installTask.metadata as Record<string, unknown>)
        : null;
    if (String(metadata?.entry_id || "").trim() !== selectedEntryId) return;
    const optimisticPatch: Record<string, unknown> = {
      entry_id: selectedEntryId,
      task_id: activeInstallTaskId,
      status:
        installStatus === "failed" || installStatus === "cancelled"
          ? "failed"
          : installStatus === "completed"
            ? "installed"
            : "installing",
      bytes_downloaded: installBytesDownloaded ?? undefined,
      bytes_total: installBytesTotal ?? undefined,
      download_url: metadata?.download_url,
      archive_type: metadata?.archive_type,
      local_path: metadata?.install_dir,
    };
    setDetailEntry((current) => mergeInstallState(current, optimisticPatch));
    setCatalog((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === selectedEntryId
                ? (mergeInstallState(item, optimisticPatch) as BenchEntry)
                : item,
            ),
          }
        : current,
    );
  }, [
    activeInstallTaskId,
    installBytesDownloaded,
    installBytesTotal,
    installStatus,
    installTask,
    selectedEntryId,
  ]);

  React.useEffect(() => {
    if (!selectedEntryId || !activeInstallTaskId) return;
    if (!["completed", "failed", "cancelled"].includes(installStatus)) return;
    const installRecord = extractInstallRecord(installStream.events, selectedEntryId);
    if (installRecord) {
      setDetailEntry((current) => mergeInstallState(current, installRecord));
      setCatalog((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === selectedEntryId
                  ? (mergeInstallState(item, installRecord) as BenchEntry)
                  : item,
              ),
            }
          : current,
      );
    }
    setInstallTaskIds((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, selectedEntryId)) {
        return current;
      }
      const next = { ...current };
      delete next[selectedEntryId];
      return next;
    });
    if (installStatus === "failed" || installStatus === "cancelled") {
      setActionError(
        String(installTask?.error || installTask?.message || t.installFailed),
      );
    }
    void reloadCatalog();
    void reloadDetail(selectedEntryId);
  }, [
    activeInstallTaskId,
    installStatus,
    installStream.events,
    installTask?.error,
    installTask?.message,
    reloadCatalog,
    reloadDetail,
    selectedEntryId,
    t.installFailed,
  ]);

  const progressPercent = React.useMemo(() => {
    if (
      typeof installTask?.progress_percent === "number" &&
      Number.isFinite(installTask.progress_percent)
    ) {
      return Math.max(0, Math.min(100, installTask.progress_percent));
    }
    const record = activeEntry?.install_state;
    if (
      typeof record?.bytes_downloaded === "number" &&
      typeof record?.bytes_total === "number" &&
      record.bytes_total > 0
    ) {
      return Math.max(
        0,
        Math.min(100, (record.bytes_downloaded / record.bytes_total) * 100),
      );
    }
    return 0;
  }, [activeEntry?.install_state, installTask?.progress_percent]);

  const handleInstall = React.useCallback(async (entry: BenchEntry) => {
    const response = await installBenchStoreEntry(entry.id);
    setInstallTaskIds((current) => ({
      ...current,
      [entry.id]: response.task.task_id,
    }));
  }, []);

  const aisbInstallTaskLabel = installInFlight
    ? installTask?.current_step === "verify"
      ? "Verifying SHA-256"
      : installTask?.current_step === "extract"
        ? t.extractingAction
        : t.downloadingAction
    : setupPacketLoading
      ? locale === "zh"
        ? "准备启动"
        : "Preparing"
      : activeEntry?.install_state?.status === "installed"
        ? t.startAction
        : activeEntry?.install_state?.status === "failed" ||
            activeEntry?.install_state?.status === "missing"
          ? t.reinstallAction
          : t.downloadAction;
  const handleAisbBackFromDetail = React.useCallback(() => {
    setSelectedEntryId(null);
    setDetailEntry(null);
  }, []);
  const handleAisbPrimaryAction = React.useCallback(async () => {
    if (!activeEntry) return;
    setActionError(null);
    try {
      if (activeEntry.install_state?.status === "installed") {
        setStartingEntryId(activeEntry.id);
        setSetupPacketLoading(true);
        try {
          const payload = await getBenchStoreSetupPacket(activeEntry.id, locale);
          await onStartWithSetupPacket?.(payload.setup_packet);
        } finally {
          setSetupPacketLoading(false);
          setStartingEntryId(null);
        }
        return;
      }
      await handleInstall(activeEntry);
    } catch (caught) {
      setStartingEntryId(null);
      setActionError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [activeEntry, handleInstall, locale, onStartWithSetupPacket]);
  const handleAisbStartEntry = React.useCallback(async (entry: BenchEntry) => {
    setActionError(null);
    try {
      if (entry.install_state?.status === "installed") {
        setStartingEntryId(entry.id);
        setSetupPacketLoading(true);
        try {
          const payload = await getBenchStoreSetupPacket(entry.id, locale);
          await onStartWithSetupPacket?.(payload.setup_packet);
        } finally {
          setSetupPacketLoading(false);
          setStartingEntryId(null);
        }
        return;
      }
      setSelectedEntryId(entry.id);
      setDetailEntry(entry);
      await handleInstall(entry);
    } catch (caught) {
      setSetupPacketLoading(false);
      setStartingEntryId(null);
      setActionError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [handleInstall, locale, onStartWithSetupPacket]);
  const benchStoreShell = (
    <OverlayDialog
      open={open}
      title={t.title}
      description={t.description}
      onClose={onClose}
      hideHeader
      className="h-[90svh] w-[97vw] max-w-[min(1554px,97vw)] bg-white"
      contentClassName="min-h-0 flex-1 overflow-hidden"
      closeButtonDataOnboardingId="benchstore-close"
    >
      <BenchAppStoreShell
        actionError={actionError}
        activeEntry={activeEntry}
        entries={visibleEntries}
        error={error}
        featuredEntry={featuredEntry}
        installInFlight={installInFlight}
        installTaskLabel={aisbInstallTaskLabel}
        libraryView={libraryView}
        loading={loading}
        locale={locale}
        onBackFromDetail={handleAisbBackFromDetail}
        onClose={onClose}
        onOpenEntry={setSelectedEntryId}
        onPrimaryAction={handleAisbPrimaryAction}
        onStartEntry={(entry) => void handleAisbStartEntry(entry)}
        openLibraryView={openLibraryView}
        progressPercent={progressPercent}
        query={query}
        setQuery={setQuery}
        setSurfacePage={setSurfacePage}
        startingEntryId={startingEntryId}
        surfacePage={surfacePage}
        setupPacketLoading={setupPacketLoading}
        visibleCountBySurface={visibleCountBySurface}
      />
    </OverlayDialog>
  );

  return benchStoreShell;
}

export default BenchStoreDialog;
