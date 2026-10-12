export type MarkdownPatchOp = {
  op: "replace";
  before: string;
  after: string;
};

export function diffMarkdown(oldMarkdown: string, newMarkdown: string): {
  patches: MarkdownPatchOp[];
} {
  if (oldMarkdown === newMarkdown) {
    return { patches: [] };
  }
  return {
    patches: [
      {
        op: "replace",
        before: oldMarkdown,
        after: newMarkdown,
      },
    ],
  };
}
