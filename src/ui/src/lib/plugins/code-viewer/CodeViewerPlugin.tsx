/**
 * Code Viewer Plugin Component
 *
 * @ds/plugin-code-viewer
 *
 * Displays code files with:
 * - Syntax highlighting (using simple CSS-based highlighting)
 * - Line numbers
 * - Copy button
 * - File content loading from context.resourceId
 */

"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { PluginComponentProps } from "@/lib/types/plugin";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { consumeFileJumpEffects } from "@/lib/ai/file-jump-queue";
import {
  Code,
  Copy,
  Check,
  FileCode,
  AlertCircle,
  Loader2,
  Hash,
  WrapText,
  Eye,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/useI18n";
import { useWorkspaceSurfaceStore } from "@/lib/stores/workspace-surface";

/**
 * Language detection based on file extension
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // JavaScript/TypeScript
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  // Python
  ".py": "python",
  ".pyw": "python",
  ".pyi": "python",
  // JSON
  ".json": "json",
  ".jsonc": "json",
  ".json5": "json",
  // Web
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  // Config
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".ini": "ini",
  ".cfg": "ini",
  ".conf": "ini",
  // Shell
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "zsh",
  ".fish": "fish",
  // SQL
  ".sql": "sql",
  // XML
  ".xml": "xml",
  ".xsl": "xml",
  ".xslt": "xml",
  ".svg": "xml",
  // Go
  ".go": "go",
  // Rust
  ".rs": "rust",
  // C/C++
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
  // Java
  ".java": "java",
  // C#
  ".cs": "csharp",
  // PHP
  ".php": "php",
  // Ruby
  ".rb": "ruby",
  // Swift
  ".swift": "swift",
  // Kotlin
  ".kt": "kotlin",
  ".kts": "kotlin",
  // Markdown
  ".md": "markdown",
  ".markdown": "markdown",
};

/**
 * Get language from file path
 */
function getLanguageFromPath(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || "plaintext";
}

function isHtmlLanguage(language: string) {
  return language === "html";
}

/**
 * Simple syntax token types for basic highlighting
 */
type TokenType =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "function"
  | "operator"
  | "punctuation"
  | "default";

/**
 * Token for syntax highlighting
 */
interface Token {
  type: TokenType;
  value: string;
}

/**
 * Keywords for different languages
 */
const KEYWORDS: Record<string, string[]> = {
  javascript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "default", "class", "extends",
    "new", "this", "super", "import", "export", "from", "as", "async", "await",
    "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of",
    "true", "false", "null", "undefined", "void",
  ],
  typescript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "default", "class", "extends",
    "new", "this", "super", "import", "export", "from", "as", "async", "await",
    "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of",
    "true", "false", "null", "undefined", "void", "type", "interface", "enum",
    "namespace", "module", "declare", "abstract", "implements", "private",
    "protected", "public", "readonly", "static",
  ],
  python: [
    "def", "class", "if", "elif", "else", "for", "while", "try", "except",
    "finally", "with", "as", "import", "from", "return", "yield", "raise",
    "pass", "break", "continue", "and", "or", "not", "in", "is", "lambda",
    "True", "False", "None", "global", "nonlocal", "assert", "del",
  ],
  go: [
    "package", "import", "func", "return", "var", "const", "type", "struct",
    "interface", "map", "chan", "go", "defer", "if", "else", "for", "range",
    "switch", "case", "default", "break", "continue", "fallthrough", "select",
    "true", "false", "nil",
  ],
  rust: [
    "fn", "let", "mut", "const", "static", "if", "else", "match", "for", "while",
    "loop", "break", "continue", "return", "struct", "enum", "impl", "trait",
    "pub", "mod", "use", "as", "self", "super", "crate", "async", "await",
    "move", "ref", "true", "false", "where",
  ],
  // Add more as needed...
};

/**
 * Simple tokenizer for basic syntax highlighting
 */
function tokenize(code: string, language: string): Token[][] {
  const lines = code.split("\n");
  const keywords = KEYWORDS[language] || KEYWORDS.javascript || [];
  const keywordSet = new Set(keywords);

  return lines.map((line) => {
    const tokens: Token[] = [];
    let remaining = line;
    let pos = 0;

    while (remaining.length > 0) {
      // String (double quotes)
      const doubleStringMatch = remaining.match(/^"(?:[^"\\]|\\.)*"/);
      if (doubleStringMatch) {
        tokens.push({ type: "string", value: doubleStringMatch[0] });
        remaining = remaining.slice(doubleStringMatch[0].length);
        continue;
      }

      // String (single quotes)
      const singleStringMatch = remaining.match(/^'(?:[^'\\]|\\.)*'/);
      if (singleStringMatch) {
        tokens.push({ type: "string", value: singleStringMatch[0] });
        remaining = remaining.slice(singleStringMatch[0].length);
        continue;
      }

      // Template string (backticks)
      const templateStringMatch = remaining.match(/^`(?:[^`\\]|\\.)*`/);
      if (templateStringMatch) {
        tokens.push({ type: "string", value: templateStringMatch[0] });
        remaining = remaining.slice(templateStringMatch[0].length);
        continue;
      }

      // Single-line comment
      const commentMatch = remaining.match(/^(\/\/.*|#.*)$/);
      if (commentMatch) {
        tokens.push({ type: "comment", value: commentMatch[0] });
        remaining = "";
        continue;
      }

      // Multi-line comment start (simplified - doesn't handle spanning lines)
      const multiCommentMatch = remaining.match(/^\/\*.*?\*\//);
      if (multiCommentMatch) {
        tokens.push({ type: "comment", value: multiCommentMatch[0] });
        remaining = remaining.slice(multiCommentMatch[0].length);
        continue;
      }

      // Number
      const numberMatch = remaining.match(/^-?\d+\.?\d*([eE][+-]?\d+)?/);
      if (numberMatch) {
        tokens.push({ type: "number", value: numberMatch[0] });
        remaining = remaining.slice(numberMatch[0].length);
        continue;
      }

      // Word (keyword, function, or identifier)
      const wordMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
      if (wordMatch) {
        const word = wordMatch[0];
        const nextChar = remaining[word.length];
        if (keywordSet.has(word)) {
          tokens.push({ type: "keyword", value: word });
        } else if (nextChar === "(") {
          tokens.push({ type: "function", value: word });
        } else {
          tokens.push({ type: "default", value: word });
        }
        remaining = remaining.slice(word.length);
        continue;
      }

      // Operator
      const operatorMatch = remaining.match(/^[+\-*/%=<>!&|^~?:]+/);
      if (operatorMatch) {
        tokens.push({ type: "operator", value: operatorMatch[0] });
        remaining = remaining.slice(operatorMatch[0].length);
        continue;
      }

      // Punctuation
      const punctMatch = remaining.match(/^[{}[\]();,.]/);
      if (punctMatch) {
        tokens.push({ type: "punctuation", value: punctMatch[0] });
        remaining = remaining.slice(punctMatch[0].length);
        continue;
      }

      // Whitespace or unknown character
      tokens.push({ type: "default", value: remaining[0] });
      remaining = remaining.slice(1);
    }

    return tokens;
  });
}

/**
 * Token color classes for dark theme
 */
const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: "text-purple-400",
  string: "text-green-400",
  comment: "text-gray-500 italic",
  number: "text-slate-200",
  function: "text-blue-400",
  operator: "text-pink-400",
  punctuation: "text-gray-400",
  default: "text-gray-100",
};

/**
 * CodeViewerPlugin - Main component
 */
export default function CodeViewerPlugin({
  context,
  tabId,
  setDirty,
  setTitle,
}: PluginComponentProps) {
  const { t } = useI18n("code_viewer");
  const updateWorkspaceTabState = useWorkspaceSurfaceStore((state) => state.updateTabState);
  // State
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [viewMode, setViewMode] = useState<"rendered" | "source">("source");
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(
    null
  );
  const highlightTimerRef = useRef<number | null>(null);

  const fileId = context.resourceId;

  // Get file name and language
  const fileName = context.resourceName || context.resourcePath || "Untitled";
  const language = useMemo(
    () => getLanguageFromPath(context.resourcePath || ""),
    [context.resourcePath]
  );
  const isHtmlDocument = useMemo(
    () => isHtmlLanguage(language) || String(context.mimeType || "").toLowerCase().includes("html"),
    [context.mimeType, language]
  );

  useEffect(() => {
    setViewMode(isHtmlDocument ? "rendered" : "source");
  }, [fileId, isHtmlDocument]);

  // Set tab title
  useEffect(() => {
    setTitle(fileName);
  }, [fileName, setTitle]);

  useEffect(() => {
    updateWorkspaceTabState(tabId, {
      contentKind: isHtmlDocument ? "html" : "code",
      documentMode: isHtmlDocument ? viewMode : "source",
      isReadOnly: true,
    });
  }, [isHtmlDocument, tabId, updateWorkspaceTabState, viewMode]);

  // Load file content
  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!context.resourceId) {
          // No file selected: show demo content
          setContent(DEMO_CODE[language] || DEMO_CODE.javascript);
          setLoading(false);
          return;
        }

        // Load file content from API
        const { getFileContent } = await import("@/lib/api/files");
        const text = await getFileContent(context.resourceId);
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("load_failed"));
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [context.resourceId, language, t]);

  // Tokenize content for syntax highlighting
  const tokenizedLines = useMemo(() => tokenize(content, language), [content, language]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  // Line count
  const lineCount = tokenizedLines.length;

  const applyJump = useCallback(
    (detail: { fileId?: string; lineStart?: number; lineEnd?: number; line?: number }) => {
      if (!fileId || detail.fileId !== fileId) return;
      const startValue = detail.lineStart ?? detail.line ?? detail.lineEnd;
      if (!startValue) return;
      const endValue = detail.lineEnd ?? detail.line ?? detail.lineStart ?? startValue;
      const maxLine = Math.max(1, lineCount);
      const start = Math.min(Math.max(startValue, 1), maxLine);
      const end = Math.min(Math.max(endValue, start), maxLine);
      setHighlightRange({ start, end });
      const lineElement = document.getElementById(`code-line-${start - 1}`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightRange(null);
      }, 2500);
    },
    [fileId, lineCount]
  );

  useEffect(() => {
    if (!fileId) return;

    const processQueue = () => {
      const queued = consumeFileJumpEffects(fileId);
      queued.forEach((entry) => applyJump(entry.data));
    };

    processQueue();

    const handleJump = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        fileId?: string;
        lineStart?: number;
        lineEnd?: number;
        line?: number;
      };
      applyJump(detail);
    };

    const handleQueue = (event: Event) => {
      const detail = (event as CustomEvent).detail as { fileId?: string };
      if (!detail || detail.fileId !== fileId) return;
      processQueue();
    };

    window.addEventListener("ds:file:jump", handleJump as EventListener);
    window.addEventListener("ds:file:queue", handleQueue as EventListener);

    return () => {
      window.removeEventListener("ds:file:jump", handleJump as EventListener);
      window.removeEventListener("ds:file:queue", handleQueue as EventListener);
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [applyJump, fileId]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>{t("loading")}</span>
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
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#333] bg-[#252526]">
        <div className="flex items-center gap-3">
          <FileCode className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{fileName}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-[#333] text-gray-400 uppercase">
            {isHtmlDocument ? "HTML" : language}
          </span>
          <span className="text-xs text-gray-500">
            {t("line_count", { count: lineCount })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isHtmlDocument ? (
            <div className="mr-2 flex items-center rounded-md border border-[#3a3a3a] bg-[#202021] p-0.5">
              <button
                onClick={() => setViewMode("rendered")}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors",
                  viewMode === "rendered"
                    ? "bg-[#3A4653] text-white"
                    : "text-gray-400 hover:text-gray-200"
                )}
                title={t("rendered_view")}
              >
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {t("rendered_view_short")}
                </span>
              </button>
              <button
                onClick={() => setViewMode("source")}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors",
                  viewMode === "source"
                    ? "bg-[#3A4653] text-white"
                    : "text-gray-400 hover:text-gray-200"
                )}
                title={t("source_view")}
              >
                <span className="inline-flex items-center gap-1">
                  <Code className="h-3.5 w-3.5" />
                  {t("source_view_short")}
                </span>
              </button>
            </div>
          ) : null}

          {/* Toggle line numbers */}
          {!isHtmlDocument || viewMode === "source" ? (
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={cn(
                "p-2 rounded hover:bg-[#333] transition-colors",
                showLineNumbers ? "text-blue-400" : "text-gray-500"
              )}
              title={t("toggle_line_numbers")}
            >
              <Hash className="w-4 h-4" />
            </button>
          ) : null}

          {/* Toggle word wrap */}
          {!isHtmlDocument || viewMode === "source" ? (
            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={cn(
                "p-2 rounded hover:bg-[#333] transition-colors",
                wordWrap ? "text-blue-400" : "text-gray-500"
              )}
              title={t("toggle_word_wrap")}
            >
              <WrapText className="w-4 h-4" />
            </button>
          ) : null}

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-2 rounded hover:bg-[#333] transition-colors text-gray-400 hover:text-gray-200"
            title={t("copy_source")}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className="flex-1 overflow-auto">
        {isHtmlDocument && viewMode === "rendered" ? (
          <div className="flex h-full flex-col bg-[#1c1c1d]">
            <div className="border-b border-[#2f2f30] px-4 py-2 text-xs text-gray-400">
              {t("html_render_hint")}
            </div>
            <div className="flex-1 p-3">
              <div className="h-full overflow-hidden rounded-xl border border-white/10 bg-white shadow-[0_24px_60px_-36px_rgba(0,0,0,0.55)]">
                <iframe
                  title={t("html_render_frame_title", { name: fileName })}
                  srcDoc={content}
                  sandbox=""
                  className="h-full w-full bg-white"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-full">
          {/* Line Numbers */}
          {showLineNumbers && (
            <div className="flex-shrink-0 py-4 pr-4 text-right bg-[#1e1e1e] border-r border-[#333] select-none sticky left-0">
              {tokenizedLines.map((_, index) => (
                <div
                  key={index}
                  className="px-4 text-xs leading-6 text-gray-500 font-mono"
                >
                  {index + 1}
                </div>
              ))}
            </div>
          )}

          {/* Code */}
          <pre
            className={cn(
              "flex-1 py-4 px-4 font-mono text-sm leading-6 overflow-x-auto",
              wordWrap && "whitespace-pre-wrap break-all"
            )}
          >
            <code>
              {tokenizedLines.map((tokens, lineIndex) => {
                const isCitationLine =
                  highlightRange &&
                  lineIndex + 1 >= highlightRange.start &&
                  lineIndex + 1 <= highlightRange.end;
                return (
                  <div
                    key={lineIndex}
                    id={`code-line-${lineIndex}`}
                    className={cn("min-h-[1.5rem]", isCitationLine && "ds-citation-line-highlight")}
                  >
                    {tokens.length === 0 ? (
                      <span>&nbsp;</span>
                    ) : (
                      tokens.map((token, tokenIndex) => (
                        <span key={tokenIndex} className={TOKEN_COLORS[token.type]}>
                          {token.value}
                        </span>
                      ))
                    )}
                  </div>
                );
              })}
            </code>
          </pre>
        </div>
        )}
      </div>
    </div>
  );
}

/**
 * Demo code samples for different languages
 */
const DEMO_CODE: Record<string, string> = {
  javascript: `// DeepScientist - Example JavaScript Code
import { useState, useEffect } from 'react';

/**
 * Custom hook for fetching data
 * @param {string} url - The URL to fetch from
 * @returns {Object} - The data, loading state, and error
 */
export function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, loading, error };
}

// Example usage
const API_URL = "https://api.example.com/data";
const { data, loading } = useFetch(API_URL);

console.log("Data loaded:", data);
`,
  typescript: `// DeepScientist - Example TypeScript Code
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

type AsyncResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(\`/api/users/\${userId}\`);
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
}

class UserService {
  private cache: Map<string, User> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    const user = await fetchUser(id);
    this.cache.set(id, user);
    return user;
  }
}

export const userService = new UserService();
`,
  python: `# DeepScientist - Example Python Code
from typing import List, Optional, Dict
from dataclasses import dataclass
import asyncio

@dataclass
class Document:
    """Represents a research document."""
    id: str
    title: str
    content: str
    tags: List[str]
    metadata: Dict[str, any]

class DocumentProcessor:
    """Processes and analyzes documents."""

    def __init__(self, model_name: str = "gpt-4"):
        self.model_name = model_name
        self._cache: Dict[str, Document] = {}

    async def process(self, doc: Document) -> Dict[str, any]:
        """Process a document and extract insights."""
        # Simulate async processing
        await asyncio.sleep(0.1)

        return {
            "word_count": len(doc.content.split()),
            "tag_count": len(doc.tags),
            "has_metadata": bool(doc.metadata)
        }

    def summarize(self, doc: Document) -> str:
        """Generate a summary of the document."""
        words = doc.content.split()[:100]
        return " ".join(words) + "..."

# Example usage
if __name__ == "__main__":
    doc = Document(
        id="doc-001",
        title="Research Paper",
        content="This is the content of the research paper...",
        tags=["AI", "Machine Learning"],
        metadata={"author": "Dr. Smith"}
    )

    processor = DocumentProcessor()
    print(f"Processing: {doc.title}")
`,
  go: `// DeepScientist - Example Go Code
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Document represents a research document
type Document struct {
	ID       string            \`json:"id"\`
	Title    string            \`json:"title"\`
	Content  string            \`json:"content"\`
	Tags     []string          \`json:"tags"\`
	Metadata map[string]string \`json:"metadata"\`
}

// DocumentService handles document operations
type DocumentService struct {
	cache map[string]*Document
}

// NewDocumentService creates a new DocumentService
func NewDocumentService() *DocumentService {
	return &DocumentService{
		cache: make(map[string]*Document),
	}
}

// GetDocument retrieves a document by ID
func (s *DocumentService) GetDocument(ctx context.Context, id string) (*Document, error) {
	if doc, ok := s.cache[id]; ok {
		return doc, nil
	}
	return nil, fmt.Errorf("document not found: %s", id)
}

func main() {
	service := NewDocumentService()

	http.HandleFunc("/documents", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	fmt.Println("Server starting on :8080")
	http.ListenAndServe(":8080", nil)
}
`,
  rust: `// DeepScientist - Example Rust Code
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub metadata: HashMap<String, String>,
}

impl Document {
    pub fn new(id: &str, title: &str, content: &str) -> Self {
        Document {
            id: id.to_string(),
            title: title.to_string(),
            content: content.to_string(),
            tags: Vec::new(),
            metadata: HashMap::new(),
        }
    }

    pub fn word_count(&self) -> usize {
        self.content.split_whitespace().count()
    }

    pub fn add_tag(&mut self, tag: &str) {
        self.tags.push(tag.to_string());
    }
}

pub struct DocumentService {
    cache: HashMap<String, Document>,
}

impl DocumentService {
    pub fn new() -> Self {
        DocumentService {
            cache: HashMap::new(),
        }
    }

    pub fn get(&self, id: &str) -> Option<&Document> {
        self.cache.get(id)
    }

    pub fn insert(&mut self, doc: Document) {
        self.cache.insert(doc.id.clone(), doc);
    }
}

fn main() {
    let mut service = DocumentService::new();
    let mut doc = Document::new("doc-001", "Research Paper", "Content here...");
    doc.add_tag("AI");

    service.insert(doc);
    println!("Document service initialized");
}
`,
  json: `{
  "name": "@ds/plugin-code-viewer",
  "version": "1.0.0",
  "description": "Code viewer plugin for DeepScientist",
  "author": "DeepScientist Team",
  "license": "MIT",
  "keywords": ["code", "viewer", "syntax", "highlight"],
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "react": "^18.0.0",
    "lucide-react": "^0.263.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  }
}
`,
};
