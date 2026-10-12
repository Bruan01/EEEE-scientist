"use client";

import { EditorBubble, useEditor } from "novel";
import { Fragment, useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
  NodeSelector,
  TextButtons,
  LinkSelector,
  ColorSelector,
  MathSelector,
} from "./novel-selectors";

/**
 * EditorBubbleMenu
 *
 * A bubble menu that appears when text is selected in the editor.
 * Provides formatting options like node type, text style, links, colors, and math.
 */
export const EditorBubbleMenu = () => {
  const { editor } = useEditor();
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openLink, setOpenLink] = useState(false);

  if (!editor) return null;

  return (
    <EditorBubble
      tippyOptions={{
        placement: "top",
        onHidden: () => {
          setOpenNode(false);
          setOpenColor(false);
          setOpenLink(false);
        },
      }}
      className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl"
    >
      <Fragment>
        <NodeSelector open={openNode} onOpenChange={setOpenNode} />
        <Separator orientation="vertical" />

        <LinkSelector open={openLink} onOpenChange={setOpenLink} />
        <Separator orientation="vertical" />

        <MathSelector />
        <Separator orientation="vertical" />

        <TextButtons />
        <Separator orientation="vertical" />

        <ColorSelector open={openColor} onOpenChange={setOpenColor} />
      </Fragment>
    </EditorBubble>
  );
};

export default EditorBubbleMenu;
