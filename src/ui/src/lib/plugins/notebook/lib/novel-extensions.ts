/**
 * Novel Extensions Configuration
 *
 * @ds/plugin-notebook
 */

import {
  CharacterCount,
  CodeBlockLowlight,
  Color,
  CustomKeymap,
  GlobalDragHandle,
  HighlightExtension,
  HorizontalRule,
  MarkdownExtension,
  Mathematics,
  Placeholder,
  StarterKit,
  TaskItem,
  TaskList,
  TextStyle,
  TiptapImage,
  TiptapLink,
  TiptapUnderline,
  Twitter,
  UpdatedImage,
  UploadImagesPlugin,
  Youtube,
} from "novel";
import { mergeAttributes } from "@tiptap/core";
import { cx } from "class-variance-authority";
import katex from "katex";
import { common, createLowlight } from "lowlight";
import { Video } from "./novel-video-extension";
import { resolveNotebookAssetUrl } from "./novel-asset-upload";
import { tableExtensions } from "./novel-table-extension";

const placeholder = Placeholder.configure({
  placeholder: ({ node }) => {
    if (node.type.name === "heading") {
      return `Heading ${node.attrs.level}`;
    }
    return "Press '/' for commands";
  },
  includeChildren: true,
});
const tiptapLink = TiptapLink.configure({
  HTMLAttributes: {
    class: cx(
      "text-muted-foreground underline underline-offset-[3px] hover:text-primary transition-colors cursor-pointer"
    ),
  },
});

const tiptapImage = TiptapImage.extend({
  addProseMirrorPlugins() {
    return [
      UploadImagesPlugin({
        imageClass: cx("opacity-40 rounded-lg border border-stone-200"),
      }),
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes };
    if (typeof attrs.src === "string") {
      attrs.src = resolveNotebookAssetUrl(attrs.src);
    }
    return ["img", mergeAttributes(this.options.HTMLAttributes, attrs)];
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: {
    class: cx("rounded-lg border border-muted"),
  },
});

const updatedImage = UpdatedImage.extend({
  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes };
    if (typeof attrs.src === "string") {
      attrs.src = resolveNotebookAssetUrl(attrs.src);
    }
    return ["img", mergeAttributes(this.options.HTMLAttributes, attrs)];
  },
}).configure({
  HTMLAttributes: {
    class: cx("rounded-lg border border-muted"),
  },
});

const taskList = TaskList.configure({
  HTMLAttributes: {
    class: cx("not-prose pl-2 "),
  },
});
const taskItem = TaskItem.configure({
  HTMLAttributes: {
    class: cx("flex gap-2 items-start my-4"),
  },
  nested: true,
});

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: {
    class: cx("mt-4 mb-6 border-t border-muted-foreground"),
  },
});

const starterKit = StarterKit.configure({
  bulletList: {
    HTMLAttributes: {
      class: cx("list-disc list-outside leading-3 -mt-2"),
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: cx("list-decimal list-outside leading-3 -mt-2"),
    },
  },
  listItem: {
    HTMLAttributes: {
      class: cx("leading-normal -mb-2"),
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: cx("border-l-4 border-primary"),
    },
  },
  codeBlock: false,
  code: {
    HTMLAttributes: {
      class: cx("rounded-md bg-muted  px-1.5 py-1 font-mono font-medium"),
      spellcheck: "false",
    },
  },
  horizontalRule: false,
  history: false,
  dropcursor: {
    color: "#DBEAFE",
    width: 4,
  },
  gapcursor: false,
});

const codeBlockLowlight = CodeBlockLowlight.configure({
  lowlight: createLowlight(common),
  HTMLAttributes: {
    class: cx(
      "rounded-md bg-muted text-muted-foreground border p-5 font-mono font-medium"
    ),
  },
});

const youtube = Youtube.configure({
  HTMLAttributes: {
    class: cx("rounded-lg border border-muted"),
  },
  inline: false,
});

const twitter = Twitter.configure({
  HTMLAttributes: {
    class: cx("not-prose"),
  },
  inline: false,
});

const mathematics = Mathematics.extend({
  parseHTML() {
    return [
      {
        tag: 'span[data-type="math"]',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return {};
          const latex =
            node.getAttribute("latex") ||
            node.getAttribute("data-latex") ||
            node.textContent ||
            "";
          const display =
            node.getAttribute("data-display") === "block" ? "block" : "inline";
          return { latex, display };
        },
      },
    ];
  },
  addAttributes() {
    return {
      latex: {
        default: "",
      },
      display: {
        default: "inline",
        parseHTML: (element) =>
          element.getAttribute("data-display") === "block" ? "block" : "inline",
        renderHTML: (attrs) =>
          attrs.display === "block" ? { "data-display": "block" } : {},
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const latex = node.attrs["latex"] ?? "";
    const attrs: Record<string, string> = {
      ...HTMLAttributes,
      "data-type": this.name,
    };
    if (node.attrs.display === "block") {
      attrs["data-display"] = "block";
    }
    return ["span", attrs, latex];
  },
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const dom = document.createElement("span");
      const latex: string = node.attrs["latex"] ?? "";
      const displayMode = node.attrs.display === "block";

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        dom.setAttribute(key, value);
      });

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        dom.setAttribute(key, value);
      });

      dom.setAttribute("data-type", this.name);
      if (displayMode) {
        dom.setAttribute("data-display", "block");
        dom.style.display = "block";
        dom.style.textAlign = "center";
        dom.style.margin = "0.75rem 0";
      }

      dom.addEventListener("click", (evt) => {
        if (editor.isEditable && typeof getPos === "function") {
          const pos = getPos();
          const nodeSize = node.nodeSize;
          editor.commands.setTextSelection({ from: pos, to: pos + nodeSize });
        }
      });

      dom.contentEditable = "false";

      dom.innerHTML = katex.renderToString(latex, {
        ...this.options.katexOptions,
        displayMode,
      });

      return {
        dom: dom,
      };
    };
  },
}).configure({
  HTMLAttributes: {
    class: cx("text-foreground rounded p-1 hover:bg-accent cursor-pointer"),
  },
  katexOptions: {
    throwOnError: false,
  },
});

const characterCount = CharacterCount.configure();
const markdownExtension = MarkdownExtension.configure({
  html: true,
  tightLists: true,
  tightListClass: "tight",
  bulletListMarker: "-",
  linkify: false,
  breaks: false,
  transformPastedText: true,
  transformCopiedText: false,
});

export const defaultExtensions = [
  starterKit,
  placeholder,
  tiptapLink,
  tiptapImage,
  updatedImage,
  taskList,
  taskItem,
  horizontalRule,
  codeBlockLowlight,
  Video,
  youtube,
  twitter,
  mathematics,
  characterCount,
  TiptapUnderline,
  ...tableExtensions,
  markdownExtension,
  HighlightExtension,
  TextStyle,
  Color,
  CustomKeymap,
  GlobalDragHandle,
];
