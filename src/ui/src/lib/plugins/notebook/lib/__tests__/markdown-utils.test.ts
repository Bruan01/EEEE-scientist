import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

import { getEditorMarkdown, setEditorMarkdown } from "../markdown-utils";

describe("markdown-utils", () => {
  it("loads markdown into the editor when markdown extension is enabled", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, Markdown.configure({ html: true })],
      content: "",
    });

    setEditorMarkdown(editor as any, "# Title\n\nHello world");

    expect(editor.getText()).toContain("Title");
    expect(editor.getText()).toContain("Hello world");
    expect(getEditorMarkdown(editor as any)).toContain("# Title");

    editor.destroy();
  });
});

