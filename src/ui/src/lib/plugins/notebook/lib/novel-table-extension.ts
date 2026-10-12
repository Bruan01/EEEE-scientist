// @ts-nocheck
/**
 * Novel Table Extensions
 *
 * Table schema + markdown-it integration for Notebook tables.
 */

import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type MarkdownIt from "markdown-it";
import { cx } from "class-variance-authority";

function childNodes(node: ProseMirrorNode): ProseMirrorNode[] {
  return node?.content?.content ?? [];
}

function isHeaderRow(row: ProseMirrorNode | undefined): boolean {
  if (!row) return false;
  const cells = childNodes(row);
  return (
    cells.length > 0 &&
    cells.every((cell) => cell.type.name === "tableHeader")
  );
}

function writeRow(
  state: MarkdownSerializerState,
  row: ProseMirrorNode | undefined,
  columnCount: number
): void {
  const cells = row ? childNodes(row) : [];
  state.write("| ");
  for (let i = 0; i < columnCount; i += 1) {
    if (i > 0) {
      state.write(" | ");
    }
    const cell = cells[i];
    const cellContent = cell?.firstChild;
    if (cellContent && cellContent.textContent.trim()) {
      state.renderInline(cellContent);
    }
  }
  state.write(" |");
  state.ensureNewLine();
}

function serializeTable(
  state: MarkdownSerializerState,
  node: ProseMirrorNode
): void {
  const rows = childNodes(node);
  if (!rows.length) return;

  const headerRow = rows[0];
  const hasHeader = isHeaderRow(headerRow);
  const bodyRows = hasHeader ? rows.slice(1) : rows;
  const columnCount =
    childNodes(hasHeader ? headerRow : bodyRows[0] ?? headerRow).length;

  if (!columnCount) return;

  state.inTable = true;

  if (hasHeader) {
    writeRow(state, headerRow, columnCount);
  } else {
    writeRow(state, undefined, columnCount);
  }

  state.write("| ");
  for (let i = 0; i < columnCount; i += 1) {
    if (i > 0) {
      state.write(" | ");
    }
    state.write("---");
  }
  state.write(" |");
  state.ensureNewLine();

  bodyRows.forEach((row) => {
    writeRow(state, row, columnCount);
  });

  state.closeBlock(node);
  state.inTable = false;
}

const table = Table.extend({
  addStorage() {
    return {
      markdown: {
        serialize: serializeTable,
        parse: {
          setup(markdownit: MarkdownIt) {
            if (typeof markdownit?.enable === "function") {
              markdownit.enable("table");
            }
          },
        },
      },
    };
  },
}).configure({
  resizable: true,
  lastColumnResizable: true,
  allowTableNodeSelection: true,
  HTMLAttributes: {
    class: cx("notebook-table"),
  },
});

const tableRow = TableRow.configure({
  HTMLAttributes: {
    class: cx("notebook-table-row"),
  },
});

const tableCell = TableCell.configure({
  HTMLAttributes: {
    class: cx("notebook-table-cell"),
  },
});

const tableHeader = TableHeader.configure({
  HTMLAttributes: {
    class: cx("notebook-table-header"),
  },
});

export const tableExtensions = [table, tableRow, tableCell, tableHeader];
