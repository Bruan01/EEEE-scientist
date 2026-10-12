/**
 * Markdown Viewer Plugin Component
 *
 * @ds/plugin-markdown-viewer
 *
 * Displays Markdown files with:
 * - GFM (GitHub Flavored Markdown) support
 * - Math formula rendering
 * - Syntax highlighted code blocks
 * - Tables, task lists, strikethrough
 * - Copy source functionality
 * - Toggle between rendered and source view
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { PluginComponentProps } from "@/lib/types/plugin";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  FileText,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  Code,
} from "lucide-react";
import { MARKDOWN_VIEWER_STYLES } from "./markdownStyles";
import { isMdxDocument, preprocessMarkdownDocument } from "./lib/rendering";
import { useI18n } from "@/lib/i18n/useI18n";
import MarkdownRenderer from "./components/MarkdownRenderer";
import { getQuestMarkdownContextFromFileId } from "@/lib/markdown/quest-assets";
import { useWorkspaceSurfaceStore } from '@/lib/stores/workspace-surface'

// ============================================================
// Demo Content
// ============================================================

const DEMO_MARKDOWN = `# DeepScientist Markdown Viewer

Welcome to the **Markdown Viewer** plugin. This viewer supports [GitHub Flavored Markdown](https://github.github.com/gfm/) with additional features.

## Features

### Text Formatting

- **Bold text** using \`**bold**\`
- *Italic text* using \`*italic*\`
- ***Bold and italic*** using \`***combined***\`
- ~~Strikethrough~~ using \`~~text~~\`
- \`Inline code\` using backticks

### Code Blocks

\`\`\`typescript
interface Document {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

async function fetchDocument(id: string): Promise<Document> {
  const response = await fetch(\`/api/documents/\${id}\`);
  return response.json();
}
\`\`\`

### Math Support

Inline math: $E = mc^2$

Display math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

### Tables (GFM)

| Feature | Status | Priority |
|---------|--------|----------|
| Markdown rendering | Done | High |
| Code highlighting | Done | High |
| Math formulas | Done | Medium |
| Export to PDF | Planned | Low |

### Task Lists (GFM)

- [x] Implement markdown parser
- [x] Add code highlighting
- [ ] Add export functionality
- [ ] Implement search

### Blockquotes

> This is a blockquote.
> It can span multiple lines.
>
> Use it for citations or important notes.

### Images

Images are loaded lazily for better performance:

![DeepScientist Logo](https://via.placeholder.com/400x200?text=DeepScientist)

### Links

- [Visit our website](https://example.com)
- [GitHub Repository](https://github.com/example/deepscientist)

---

## Getting Started

1. Open a markdown file
2. The viewer will render it automatically
3. Use the toolbar to toggle between rendered and source view
4. Copy the source using the copy button

Happy writing! :rocket:
`;

const DEMO_MARKDOWN_ZH = `# DeepScientist Markdown 查看器

欢迎使用 **Markdown 查看器** 插件。该查看器支持 [GitHub Flavored Markdown](https://github.github.com/gfm/) 及更多增强能力。

## 功能特性

### 文本格式

- 使用 \`**粗体**\` 显示 **粗体**
- 使用 \`*斜体*\` 显示 *斜体*
- 使用 \`***加粗斜体***\` 显示 ***加粗斜体***
- 使用 \`~~删除线~~\` 显示 ~~删除线~~
- 使用反引号显示 \`行内代码\`

### 数学公式

行内公式：$E = mc^2$

块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

### 表格

| 功能 | 状态 | 优先级 |
|------|------|--------|
| Markdown 渲染 | 已完成 | 高 |
| 代码高亮 | 已完成 | 高 |
| 数学公式 | 已完成 | 中 |
| 导出 PDF | 规划中 | 低 |

### 开始使用

1. 打开一个 Markdown 文件
2. 查看器会自动完成渲染
3. 使用顶部工具栏在渲染视图和源码视图之间切换
4. 使用复制按钮复制源内容

祝你写作顺利！:rocket:
`;

// ============================================================
// Styles for Markdown Content (shared)
// ============================================================

// ============================================================
// Main Component
// ============================================================

export default function MarkdownViewerPlugin({
  context,
  tabId,
  setDirty,
  setTitle,
}: PluginComponentProps) {
  const { t, language } = useI18n('markdown_viewer')
  const updateWorkspaceTabState = useWorkspaceSurfaceStore((state) => state.updateTabState)
  // State
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"rendered" | "source">("rendered");

  // Get file name
  const fileName = context.resourceName || context.resourcePath || "Untitled.md";
  const isMdx = isMdxDocument(fileName)
  const renderedContent = preprocessMarkdownDocument(content, { isMdx })
  const questContext = React.useMemo(
    () => getQuestMarkdownContextFromFileId(context.resourceId),
    [context.resourceId]
  )

  // Set tab title
  useEffect(() => {
    setTitle(fileName);
  }, [fileName, setTitle]);

  useEffect(() => {
    updateWorkspaceTabState(tabId, {
      contentKind: isMdx ? 'mdx' : 'markdown',
      documentMode: viewMode,
      isReadOnly: true,
    })
  }, [isMdx, tabId, updateWorkspaceTabState, viewMode])

  // Load file content
  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!context.resourceId) {
          // No file selected: show demo content
          setContent(language === 'zh-CN' ? DEMO_MARKDOWN_ZH : DEMO_MARKDOWN);
          setLoading(false);
          return;
        }

        // Load file content from API
        const { getFileContent } = await import("@/lib/api/files");
        const text = await getFileContent(context.resourceId);
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('load_failed'));
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [context.resourceId, language, t]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3 text-destructive">
          <AlertCircle className="w-8 h-8" />
          <span>{error}</span>
          <button
            className="px-4 py-2 text-sm bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors"
            onClick={() => window.location.reload()}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Inject styles */}
      <style dangerouslySetInnerHTML={{ __html: MARKDOWN_VIEWER_STYLES }} />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{fileName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {isMdx ? 'MDX' : 'Markdown'}
              </span>
        </div>

        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded-md mr-2">
            <button
              onClick={() => setViewMode("rendered")}
              className={cn(
                "p-2 rounded-l-md transition-colors",
                viewMode === "rendered"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              )}
              title={t('rendered_view')}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("source")}
              className={cn(
                "p-2 rounded-r-md transition-colors",
                viewMode === "source"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              )}
              title={t('source_view')}
            >
              <Code className="w-4 h-4" />
            </button>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title={t('copy_source')}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "rendered" ? (
          <div className="max-w-4xl mx-auto p-8">
            <MarkdownRenderer content={renderedContent} questContext={questContext} />
          </div>
        ) : (
          <pre className="p-4 font-mono text-sm whitespace-pre-wrap">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
