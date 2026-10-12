import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { resolveNotebookAssetUrl } from "./novel-asset-upload";

export interface VideoOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      setVideo: (attrs: { src: string; poster?: string }) => ReturnType;
    };
  }
}

export const Video = Node.create<VideoOptions>({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        controls: "true",
        playsinline: "true",
      },
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      poster: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes };
    if (typeof attrs.src === "string") {
      attrs.src = resolveNotebookAssetUrl(attrs.src);
    }
    if (typeof attrs.poster === "string") {
      attrs.poster = resolveNotebookAssetUrl(attrs.poster);
    }
    return [
      "video",
      mergeAttributes(this.options.HTMLAttributes, attrs),
    ];
  },

  addCommands() {
    return {
      setVideo:
        (attrs: { src: string; poster?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void; closeBlock: (n: ProseMirrorNode) => void }, node: ProseMirrorNode) {
          const attrs = [
            `src="${node.attrs.src || ""}"`,
            node.attrs.poster ? `poster="${node.attrs.poster}"` : null,
            "controls",
            "playsinline",
          ]
            .filter(Boolean)
            .join(" ");
          state.write(`<video ${attrs}></video>`);
          state.closeBlock(node);
        },
      },
    };
  },
});
