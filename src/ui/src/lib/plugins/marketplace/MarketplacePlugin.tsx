"use client";

import * as React from "react";
import {
  BookOpen,
  Code2,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Puzzle,
  ScrollText,
  Search,
  Settings,
  Sigma,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PluginComponentProps } from "@/lib/types/plugin";
import type { TabContext, TabContextType } from "@/lib/types/tab";
import { useTabsStore } from "@/lib/stores/tabs";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { useOpenFile } from "@/hooks/useOpenFile";
import { BUILTIN_PLUGINS } from "@/lib/types/plugin";
import { cn } from "@/lib/utils";

type PluginCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  openLabel?: string;
  openMode?: "tab" | "disabled";
  contextType?: TabContextType;
  resourceName?: string;
  resourcePath?: string;
  mimeType?: string;
  tabTitle?: string;
  requiresProject?: boolean;
  customData?: Record<string, unknown>;
  disabledReason?: string;
};

type PluginSection = {
  id: string;
  title: string;
  subtitle?: string;
  plugins: PluginCard[];
};

function getProjectIdFromContext(context: PluginComponentProps["context"]): string | null {
  const projectId = context.customData?.projectId;
  return typeof projectId === "string" ? projectId : null;
}

function ensureExtension(fileName: string, ext: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(".")) return trimmed;
  return `${trimmed}${ext}`;
}

function buildNotebookSeedFile(name: string): File {
  const finalName = ensureExtension(name, ".md");
  const title = finalName.replace(/\.md$/i, "");
  const content = `# ${title}\n\n`;
  return new File([content], finalName, { type: "text/markdown" });
}

function buildSeedName(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${suffix}`;
}

const workspaceTools: PluginCard[] = [
  {
    id: BUILTIN_PLUGINS.SEARCH,
    title: "Search",
    description: "Find files by name or path.",
    icon: Search,
    badge: "tool",
    requiresProject: true,
  },
  {
    id: "@ds/plugin-analysis",
    title: "Analysis",
    description: "Reusable prompts and analysis recipes.",
    icon: Sparkles,
    badge: "tool",
    requiresProject: true,
  },
  {
    id: BUILTIN_PLUGINS.CLI,
    title: "CLI",
    description: "Remote CLI sessions and agent tooling.",
    icon: Terminal,
    badge: "tool",
    requiresProject: true,
  },
  {
    id: BUILTIN_PLUGINS.SETTINGS,
    title: "Settings",
    description: "Quest-focused settings and workspace preferences.",
    icon: Settings,
    badge: "system",
  },
  {
    id: "@ds/plugin-marketplace",
    title: "Plugin Marketplace",
    description: "Browse and organize installed plugins.",
    icon: Puzzle,
    badge: "system",
  },
];

const authoringTools: PluginCard[] = [
  {
    id: BUILTIN_PLUGINS.NOTEBOOK,
    title: "Notebook",
    description: "Create a new markdown notebook file.",
    icon: BookOpen,
    badge: "authoring",
    requiresProject: true,
    openLabel: "New",
  },
  {
    id: BUILTIN_PLUGINS.LATEX,
    title: "LaTeX",
    description: "Create a new LaTeX project folder.",
    icon: Sigma,
    badge: "authoring",
    requiresProject: true,
    openLabel: "New",
  },
];

const pdfTools: PluginCard[] = [
  {
    id: BUILTIN_PLUGINS.PDF_VIEWER,
    title: "PDF Viewer",
    description: "View and annotate PDFs with highlights.",
    icon: FileText,
    badge: "pdf",
    openMode: "disabled",
    openLabel: "Auto",
    disabledReason: "Opens when you select a PDF file.",
  },
  {
    id: BUILTIN_PLUGINS.PDF_MARKDOWN,
    title: "PDF Markdown",
    description: "Read MinerU Markdown output from PDFs.",
    icon: FileCode2,
    badge: "pdf",
    openMode: "disabled",
    openLabel: "Auto",
    disabledReason: "Opens after selecting a PDF and switching to Markdown view.",
  },
];

const fileViewers: PluginCard[] = [
  {
    id: BUILTIN_PLUGINS.CODE_EDITOR,
    title: "Code Editor",
    description: "Monaco editor with autosave.",
    icon: Code2,
    badge: "viewer",
    openMode: "disabled",
    openLabel: "Auto",
    disabledReason: "Opens when you select a code file.",
  },
  {
    id: BUILTIN_PLUGINS.CODE_VIEWER,
    title: "Code Viewer",
    description: "Read-only viewer with syntax highlighting.",
    icon: Code2,
    badge: "viewer",
    openMode: "disabled",
    openLabel: "Auto",
    disabledReason: "Opens when you select a supported code file.",
  },
  {
    id: BUILTIN_PLUGINS.MARKDOWN_VIEWER,
    title: "Markdown Viewer",
    description: "Render Markdown with GFM + math.",
    icon: ScrollText,
    badge: "viewer",
    openMode: "disabled",
    openLabel: "Auto",
    disabledReason: "Opens when you select a Markdown file.",
  },
  {
    id: BUILTIN_PLUGINS.TEXT_VIEWER,
    title: "Text Viewer",
    description: "Plain text viewer with search tools.",
    icon: FileText,
    badge: "viewer",
    openMode: "disabled",
    openLabel: "Auto",
    disabledReason: "Opens when you select a text file.",
  },
  {
    id: BUILTIN_PLUGINS.IMAGE_VIEWER,
    title: "Image Viewer",
    description: "Zoom, pan, and inspect images.",
    icon: ImageIcon,
    badge: "viewer",
    openMode: "disabled",
    openLabel: "Auto",
    disabledReason: "Opens when you select an image file.",
  },
  {
    id: "@ds/plugin-doc-viewer",
    title: "Document Viewer",
    description: "Preview Word, Excel, and PowerPoint files.",
    icon: FileText,
    badge: "viewer",
    openMode: "disabled",
    openLabel: "Auto",
    disabledReason: "Opens when you select a document file.",
  },
];

const integrations: PluginCard[] = [
  {
    id: "panel:arxiv",
    title: "ArXiv Import",
    description: "Import papers from arXiv into your workspace.",
    icon: BookOpen,
    badge: "integration",
    openMode: "disabled",
    openLabel: "Use sidebar",
    disabledReason: "Use the ArXiv panel in the left sidebar.",
  },
];

const pluginSections: PluginSection[] = [
  {
    id: "workspace-tools",
    title: "Workspace tools",
    subtitle: "Openable as tabs",
    plugins: workspaceTools,
  },
  {
    id: "authoring",
    title: "Authoring",
    subtitle: "Notes and documents",
    plugins: authoringTools,
  },
  {
    id: "pdf-tools",
    title: "PDF workflow",
    subtitle: "View, extract, and publish",
    plugins: pdfTools,
  },
  {
    id: "file-viewers",
    title: "Viewers & editors",
    subtitle: "Auto-picked based on file type",
    plugins: fileViewers,
  },
  {
    id: "integrations",
    title: "Integrations",
    subtitle: "External sources",
    plugins: integrations,
  },
];

export default function MarketplacePlugin({ context, setTitle }: PluginComponentProps) {
  React.useEffect(() => setTitle("Plugin Marketplace"), [setTitle]);

  const navigate = useNavigate();
  const openTab = useTabsStore((s) => s.openTab);
  const { openFileInTab } = useOpenFile();
  const storeProjectId = useFileTreeStore((s) => s.projectId);
  const loadFiles = useFileTreeStore((s) => s.loadFiles);
  const upload = useFileTreeStore((s) => s.upload);
  const createLatexProject = useFileTreeStore((s) => s.createLatexProject);
  const highlightFile = useFileTreeStore((s) => s.highlightFile);
  const projectId = getProjectIdFromContext(context);

  const ensureProjectReady = React.useCallback(async (): Promise<boolean> => {
    if (!projectId) return false;
    if (storeProjectId !== projectId) {
      await loadFiles(projectId);
    }
    return true;
  }, [loadFiles, projectId, storeProjectId]);

  const handleOpen = React.useCallback(
    async (card: PluginCard) => {
      if (card.openMode === "disabled") return;
      if (card.requiresProject && !projectId) return;

      if (card.id === BUILTIN_PLUGINS.SETTINGS) {
        navigate("/settings");
        return;
      }

      if (card.id === BUILTIN_PLUGINS.NOTEBOOK) {
        try {
          const ready = await ensureProjectReady();
          if (!ready || !projectId) return;
          const fileName = buildSeedName("Notebook");
          const file = buildNotebookSeedFile(fileName);
          const created = await upload(null, [file]);
          const createdFile = created.find((node) => node.type === "file") || created[0];
          if (createdFile) {
            highlightFile(createdFile.id);
            await openFileInTab(createdFile, { customData: { projectId } });
          }
        } catch (error) {
          console.error("[MarketplacePlugin] Failed to create notebook file:", error);
        }
        return;
      }

      if (card.id === BUILTIN_PLUGINS.LATEX) {
        try {
          const ready = await ensureProjectReady();
          if (!ready || !projectId) return;
          const folderName = buildSeedName("LaTeX");
          const folder = await createLatexProject(null, folderName);
          highlightFile(folder.id);
          openTab({
            pluginId: card.id,
            context: {
              type: "custom",
              resourceId: folder.id,
              resourceName: folder.name,
              customData: {
                projectId,
                latexFolderId: folder.id,
                mainFileId: folder.latex?.mainFileId ?? null,
              },
            },
            title: folder.name,
          });
        } catch (error) {
          console.error("[MarketplacePlugin] Failed to create LaTeX project:", error);
        }
        return;
      }

      const contextData: TabContext = {
        type: card.contextType ?? "custom",
        resourceName: card.resourceName ?? card.title,
        resourcePath: card.resourcePath,
        mimeType: card.mimeType,
        customData: projectId
          ? { projectId, ...(card.customData ?? {}) }
          : card.customData,
      };

      openTab({
        pluginId: card.id,
        context: contextData,
        title: card.tabTitle ?? card.resourceName ?? card.title,
      });
    },
    [
      createLatexProject,
      ensureProjectReady,
      highlightFile,
      openFileInTab,
      openTab,
      projectId,
      upload,
      navigate,
    ]
  );

  return (
    <div className="h-full">
      <div className="max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Plugin Marketplace
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse built-in plugins and jump straight in. File-based viewers open
              automatically when you select a file.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 rounded-full border border-border bg-muted/30">
              Built-in
            </span>
          </div>
        </div>

        {pluginSections.map((section) => (
          <div key={section.id} className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {section.title}
              </h2>
              {section.subtitle ? (
                <div className="text-xs text-muted-foreground">
                  {section.subtitle}
                </div>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.plugins.map((plugin) => {
                const Icon = plugin.icon;
                const isCurrent = plugin.id === "@ds/plugin-marketplace";
                const missingProject = plugin.requiresProject && !projectId;
                const showButton = plugin.openMode !== "disabled" || missingProject;
                const isDisabled = isCurrent || missingProject;
                const buttonLabel = isCurrent
                  ? "You're here"
                  : missingProject
                    ? "Requires project"
                    : plugin.openLabel ?? "Open";
                const helperText = missingProject
                  ? "Open a project to use this plugin."
                  : plugin.disabledReason;

                return (
                  <div
                    key={plugin.id}
                    className={cn(
                      "rounded-2xl border border-border bg-card/90 backdrop-blur p-5",
                      "shadow-sm hover:shadow-md transition-shadow"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">
                            {plugin.title}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {plugin.description}
                          </div>
                          <div className="mt-2 text-[11px] font-mono text-muted-foreground truncate">
                            {plugin.id}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-1 rounded-full border border-border bg-muted/30 text-[10px] text-muted-foreground">
                        {plugin.badge ?? "built-in"}
                      </span>
                    </div>

                    <div className="mt-4">
                      {showButton ? (
                        <button
                          type="button"
                          onClick={() => void handleOpen(plugin)}
                          disabled={isDisabled}
                          className={cn(
                            "inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-sm",
                            "border border-border bg-background hover:bg-accent/40 transition-colors text-foreground",
                            isDisabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {buttonLabel}
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs border border-border bg-muted/30 text-muted-foreground">
                          {plugin.openLabel ?? "Auto"}
                        </span>
                      )}
                      {helperText ? (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {helperText}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-8 text-xs text-muted-foreground">
          Want external plugins? That's next: sandboxing, permissions, and a loader
          that can fetch + verify bundles.
        </div>
      </div>
    </div>
  );
}
