import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
let MarkdownExtension: any;

import { tableExtensions } from "../novel-table-extension";
import { getEditorMarkdown, setEditorMarkdown } from "../markdown-utils";

async function createEditor() {
  if (!MarkdownExtension) {
    const mod = await import("tiptap-markdown");
    MarkdownExtension = mod.Markdown;
  }
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit.configure({ history: false }),
      ...tableExtensions,
      MarkdownExtension.configure({ html: true }),
    ],
    content: "",
  });
}

describe("markdown table support", () => {
  it("serializes table nodes to GFM markdown", async () => {
    const editor = await createEditor();
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Name" }] },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Age" }] },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Alice" }] },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "30" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const markdown = getEditorMarkdown(editor as any);
    expect(markdown).toContain("| Name | Age |");
    expect(markdown).toContain("| --- | --- |");
    expect(markdown).toContain("| Alice | 30 |");

    editor.destroy();
  });

  it("parses GFM markdown tables via markdown-it", async () => {
    const editor = await createEditor();
    const markdown = `| Name | Age |
| --- | --- |
| Bob | 42 |`;

    setEditorMarkdown(editor as any, markdown);

    const table = editor.state.doc.firstChild;
    expect(table?.type.name).toBe("table");
    const headerCell = table?.firstChild?.firstChild;
    expect(headerCell?.type.name).toBe("tableHeader");

    editor.destroy();
  });
});
