// @ts-nocheck
"use client";

import { findParentNodeClosestToPos } from "@tiptap/core";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Heading1,
  Minus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { EditorBubble, useEditor } from "novel";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type TableMenuProps = {
  className?: string;
};

const TABLE_BUBBLE_MENU_KEY = "notebook-table-bubble-menu";

type TableActionButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: LucideIcon;
  tone?: "default" | "destructive";
};

const TableActionButton = ({
  label,
  onClick,
  disabled,
  icon: Icon,
  tone = "default",
}: TableActionButtonProps) => (
  <Button
    type="button"
    size="icon"
    variant="ghost"
    disabled={disabled}
    onClick={onClick}
    title={label}
    className={cn(
      "h-8 w-8",
      tone === "destructive" && "text-destructive hover:text-destructive"
    )}
  >
    <Icon className="h-4 w-4" />
  </Button>
);

const TableControls = ({ className }: { className?: string }) => {
  const { editor } = useEditor();
  if (!editor) return null;

  const can = editor.can();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-md border border-muted bg-background p-1 shadow-md",
        className
      )}
    >
      <TableActionButton
        label="Add column before"
        icon={ArrowLeft}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        disabled={!can.addColumnBefore()}
      />
      <TableActionButton
        label="Add column after"
        icon={ArrowRight}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        disabled={!can.addColumnAfter()}
      />
      <Separator orientation="vertical" className="h-5" />
      <TableActionButton
        label="Add row above"
        icon={ArrowUp}
        onClick={() => editor.chain().focus().addRowBefore().run()}
        disabled={!can.addRowBefore()}
      />
      <TableActionButton
        label="Add row below"
        icon={ArrowDown}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        disabled={!can.addRowAfter()}
      />
      <Separator orientation="vertical" className="h-5" />
      <TableActionButton
        label="Toggle header row"
        icon={Heading1}
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        disabled={!can.toggleHeaderRow()}
      />
      <Separator orientation="vertical" className="h-5" />
      <TableActionButton
        label="Delete column"
        icon={Minus}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        disabled={!can.deleteColumn()}
      />
      <TableActionButton
        label="Delete row"
        icon={Minus}
        onClick={() => editor.chain().focus().deleteRow().run()}
        disabled={!can.deleteRow()}
      />
      <TableActionButton
        label="Delete table"
        icon={Trash2}
        onClick={() => editor.chain().focus().deleteTable().run()}
        disabled={!can.deleteTable()}
        tone="destructive"
      />
    </div>
  );
};

function getActiveTableElement(editor: NonNullable<ReturnType<typeof useEditor>["editor"]>) {
  const { $from } = editor.state.selection;
  const tableNode = findParentNodeClosestToPos(
    $from,
    (node) => node.type.name === "table"
  );
  if (!tableNode) return null;
  const dom = editor.view.nodeDOM(tableNode.pos);
  return dom instanceof HTMLElement ? dom : null;
}

export const TableBubbleMenu = ({ className }: TableMenuProps) => {
  const { editor } = useEditor();
  if (!editor || editor.isDestroyed) return null;

  return (
    <EditorBubble
      pluginKey={TABLE_BUBBLE_MENU_KEY}
      shouldShow={({ editor: current }) =>
        current.isEditable && current.isActive("table")
      }
      tippyOptions={{
        placement: "bottom",
        moveTransition: "transform 0.15s ease-out",
      }}
    >
      <TableControls className={className} />
    </EditorBubble>
  );
};

export const TableToolbar = ({ className }: TableMenuProps) => {
  const { editor } = useEditor();
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updatePosition = useCallback(() => {
    if (!editor || editor.isDestroyed || !editor.isEditable) {
      setPosition(null);
      return;
    }
    if (!editor.isActive("table")) {
      setPosition(null);
      return;
    }
    const table = getActiveTableElement(editor);
    if (!table) {
      setPosition(null);
      return;
    }
    const container =
      (editor.view.dom.parentElement as HTMLElement | null) || editor.view.dom;
    const containerRect = container.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const top =
      tableRect.top - containerRect.top + container.scrollTop - 12;
    const left =
      tableRect.left - containerRect.left + container.scrollLeft;
    setPosition({ top, left, width: tableRect.width });
  }, [editor]);

  const scheduleUpdate = useMemo(() => {
    let frame = 0;
    const handler = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updatePosition();
      });
    };
    return handler;
  }, [updatePosition]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const container =
      (editor.view.dom.parentElement as HTMLElement | null) || editor.view.dom;
    updatePosition();
    editor.on("selectionUpdate", scheduleUpdate);
    editor.on("transaction", scheduleUpdate);
    editor.on("focus", scheduleUpdate);
    editor.on("blur", scheduleUpdate);
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      editor.off("selectionUpdate", scheduleUpdate);
      editor.off("transaction", scheduleUpdate);
      editor.off("focus", scheduleUpdate);
      editor.off("blur", scheduleUpdate);
      container.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [editor, scheduleUpdate, updatePosition]);

  if (!editor || editor.isDestroyed || !position) return null;

  return (
    <div
      className={cn(
        "absolute z-30",
        className
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
      }}
    >
      <TableControls className="w-full justify-start" />
    </div>
  );
};
