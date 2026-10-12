import type { EditorInstance } from "novel";

const CODE_BLOCK_TOKEN = "__DS_MD_CODE_BLOCK__";
const INLINE_CODE_TOKEN = "__DS_MD_INLINE_CODE__";
const FENCED_CODE_REGEX = /(^|\n)(```|~~~)[\s\S]*?\n\2[^\n]*($|\n)/g;
const INLINE_CODE_REGEX = /`[^`\n]*`/g;
const BLOCK_MATH_REGEX = /\$\$([\s\S]+?)\$\$/g;
const BLOCK_MATH_BRACKET_REGEX = /\\\[([\s\S]+?)\\\]/g;
const INLINE_MATH_REGEX = /(?<!\\)\$(?!\$)([^$\n]+?)(?<!\\)\$(?!\$)/g;
const INLINE_MATH_PAREN_REGEX = /\\\((.+?)\\\)/g;
const MATH_SPAN_REGEX =
  /<span([^>]*data-type=['"]math['"][^>]*)>([\s\S]*?)<\/span>/g;

const DEFAULT_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

type ProseMirrorNode = {
  type?: string;
  content?: ProseMirrorNode[];
  text?: string;
  [key: string]: unknown;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function protectSegments(input: string, regex: RegExp, token: string) {
  const segments: string[] = [];
  const text = input.replace(regex, (match) => {
    const index = segments.length;
    segments.push(match);
    return `${token}${index}__`;
  });
  return { text, segments };
}

function restoreSegments(input: string, segments: string[], token: string) {
  let text = input;
  segments.forEach((segment, index) => {
    text = text.replace(`${token}${index}__`, segment);
  });
  return text;
}

function wrapMarkdownMath(markdown: string): string {
  if (!markdown) return markdown;

  const { text: withoutFenced, segments: fencedBlocks } = protectSegments(
    markdown,
    FENCED_CODE_REGEX,
    CODE_BLOCK_TOKEN
  );
  const { text: withoutInline, segments: inlineBlocks } = protectSegments(
    withoutFenced,
    INLINE_CODE_REGEX,
    INLINE_CODE_TOKEN
  );

  let transformed = withoutInline;
  transformed = transformed.replace(BLOCK_MATH_REGEX, (_match, latex) => {
    return `<span data-type="math" data-display="block">${escapeHtml(
      String(latex).trim()
    )}</span>`;
  });
  transformed = transformed.replace(BLOCK_MATH_BRACKET_REGEX, (_match, latex) => {
    return `<span data-type="math" data-display="block">${escapeHtml(
      String(latex).trim()
    )}</span>`;
  });
  transformed = transformed.replace(INLINE_MATH_PAREN_REGEX, (_match, latex) => {
    return `<span data-type="math">${escapeHtml(
      String(latex).trim()
    )}</span>`;
  });
  transformed = transformed.replace(INLINE_MATH_REGEX, (_match, latex) => {
    return `<span data-type="math">${escapeHtml(
      String(latex).trim()
    )}</span>`;
  });

  const restoredInline = restoreSegments(
    transformed,
    inlineBlocks,
    INLINE_CODE_TOKEN
  );
  return restoreSegments(restoredInline, fencedBlocks, CODE_BLOCK_TOKEN);
}

function unwrapMarkdownMath(markdown: string): string {
  if (!markdown) return markdown;

  return markdown.replace(
    MATH_SPAN_REGEX,
    (match: string, attrs: string, latex: string) => {
      const content = unescapeHtml(String(latex)).trim();
      if (!content) return match;
      const isBlock = /data-display=['"]block['"]/.test(attrs);
      return isBlock ? `$$\n${content}\n$$` : `$${content}$`;
    }
  );
}

function getNodeText(node: ProseMirrorNode): string {
  if (node.type === "text") {
    return typeof node.text === "string" ? node.text : "";
  }
  if (!Array.isArray(node.content)) return "";
  return node.content.map(getNodeText).join("");
}

function stripInvisible(value: string): string {
  return value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
}

function isEmptyCodeBlock(node: ProseMirrorNode): boolean {
  if (node.type !== "codeBlock") return false;
  const text = stripInvisible(getNodeText(node)).trim();
  return text.length === 0;
}

function stripEmptyCodeBlocks(
  node: ProseMirrorNode | null | undefined
): ProseMirrorNode | null {
  if (!node || typeof node !== "object") return null;
  if (isEmptyCodeBlock(node)) return null;

  if (Array.isArray(node.content)) {
    const nextContent = node.content
      .map(stripEmptyCodeBlocks)
      .filter((item): item is ProseMirrorNode => Boolean(item));
    const contentChanged =
      nextContent.length !== node.content.length ||
      nextContent.some((child, index) => child !== node.content?.[index]);
    if (contentChanged) {
      return { ...node, content: nextContent };
    }
  }
  return node;
}

export function getEditorMarkdown(editor: EditorInstance): string {
  const serializer = editor.storage?.markdown?.serializer;
  if (serializer?.serialize) {
    const markdown = serializer.serialize(editor.state.doc) as string;
    return unwrapMarkdownMath(markdown);
  }
  return editor.getText();
}

export function setEditorMarkdown(editor: EditorInstance, markdown: string): void {
  const normalized = markdown.trim().length > 0 ? markdown : "";
  const prepared = wrapMarkdownMath(normalized);
  const hasMarkdownParser = Boolean(editor.storage?.markdown?.parser?.parse);

  // When tiptap-markdown is enabled, `editor.commands.setContent(string)` expects a markdown string
  // (it is overridden by the Markdown extension). `parser.parse()` returns HTML, not JSONContent.
  if (hasMarkdownParser) {
    editor.commands.setContent(prepared || DEFAULT_DOC, false);
    return;
  }

  if (normalized) {
    editor.commands.setContent(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: normalized }],
          },
        ],
      },
      false
    );
    return;
  }

  editor.commands.setContent(DEFAULT_DOC, false);
}
