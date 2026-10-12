import type { TabContext } from "@/lib/types/tab";
import { inferNotebookDocKind, isMarkdownFileName } from "../doc-kind";

describe("isMarkdownFileName", () => {
  it("detects markdown by extension", () => {
    expect(isMarkdownFileName("readme.md")).toBe(true);
    expect(isMarkdownFileName("notes.markdown")).toBe(true);
    expect(isMarkdownFileName("docs.mdx")).toBe(true);
    expect(isMarkdownFileName("notes.txt")).toBe(false);
  });

  it("detects markdown by mime type", () => {
    expect(isMarkdownFileName("notes.txt", "text/markdown")).toBe(true);
    expect(isMarkdownFileName(undefined, "text/x-markdown")).toBe(true);
    expect(isMarkdownFileName("notes.md", "text/plain")).toBe(true);
    expect(isMarkdownFileName("notes.txt", "text/plain")).toBe(false);
  });
});

describe("inferNotebookDocKind", () => {
  it("keeps notebook contexts as notebook", () => {
    const context: TabContext = {
      type: "notebook",
      resourceName: "notes.md",
    };
    expect(inferNotebookDocKind(context)).toBe("notebook");
  });

  it("treats markdown files as markdown", () => {
    const context: TabContext = {
      type: "file",
      resourceName: "readme.md",
      customData: { mimeType: "text/markdown" },
    };
    expect(inferNotebookDocKind(context)).toBe("markdown");
  });

  it("respects explicit overrides", () => {
    const context: TabContext = {
      type: "file",
      resourceName: "doc.md",
      customData: { docKind: "notebook" },
    };
    expect(inferNotebookDocKind(context)).toBe("notebook");
  });
});
