"use client";

import * as React from "react";
import { FileText, FileCode2, Braces } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SegmentedControl, type SegmentedItem } from "@/components/ui/segmented-control";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import type { FileNode } from "@/lib/types/file";
import type { LatexCompiler } from "@/lib/api/latex";
import { cn } from "@/lib/utils";
import { PngIcon } from "@/components/ui/png-icon";

type TemplateId = "text" | "markdown" | "python" | "json";
type CreateType = TemplateId | "latex";

const typeItems: SegmentedItem<CreateType>[] = [
  { value: "text", label: "Text", icon: <FileText className="h-4 w-4" /> },
  { value: "markdown", label: "Markdown", icon: <FileText className="h-4 w-4" /> },
  { value: "python", label: "Python", icon: <FileCode2 className="h-4 w-4" /> },
  {
    value: "json",
    label: "JSON",
    icon: (
      <PngIcon
        name="Braces"
        size={16}
        className="h-4 w-4"
        fallback={<Braces className="h-4 w-4" />}
      />
    ),
  },
  {
    value: "latex",
    label: "LaTeX",
    icon: (
      <PngIcon
        name="Braces"
        size={16}
        className="h-4 w-4"
        fallback={<Braces className="h-4 w-4" />}
      />
    ),
  },
];

const compilerItems: SegmentedItem<LatexCompiler>[] = [
  { value: "pdflatex", label: "pdfLaTeX", icon: <FileText className="h-4 w-4" /> },
  {
    value: "xelatex",
    label: "XeLaTeX",
    icon: (
      <PngIcon
        name="Braces"
        size={16}
        className="h-4 w-4"
        fallback={<Braces className="h-4 w-4" />}
      />
    ),
  },
  {
    value: "lualatex",
    label: "LuaLaTeX",
    icon: (
      <PngIcon
        name="Braces"
        size={16}
        className="h-4 w-4"
        fallback={<Braces className="h-4 w-4" />}
      />
    ),
  },
];

function ensureExtension(fileName: string, ext: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(".")) return trimmed;
  return `${trimmed}${ext}`;
}

function buildTemplateFile(name: string, template: TemplateId): { file: File; finalName: string } {
  switch (template) {
    case "markdown": {
      const finalName = ensureExtension(name, ".md");
      const content = `# ${finalName.replace(/\\.md$/i, "")}\n\n`;
      return {
        finalName,
        file: new File([content], finalName, { type: "text/markdown" }),
      };
    }
    case "python": {
      const finalName = ensureExtension(name, ".py");
      const content = `# ${finalName}\n`;
      return {
        finalName,
        file: new File([content], finalName, { type: "text/x-python" }),
      };
    }
    case "json": {
      const finalName = ensureExtension(name, ".json");
      const content = `{\n  \n}\n`;
      return {
        finalName,
        file: new File([content], finalName, { type: "application/json" }),
      };
    }
    case "text":
    default: {
      const finalName = ensureExtension(name, ".txt");
      return {
        finalName,
        file: new File([""], finalName, { type: "text/plain" }),
      };
    }
  }
}

export interface CreateFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
  defaultName?: string;
  onCreated?: (file: FileNode) => void;
}

export function CreateFileDialog({
  open,
  onOpenChange,
  parentId,
  defaultName,
  onCreated,
}: CreateFileDialogProps) {
  const { upload, createLatexProject, highlightFile } = useFileTreeStore();
  const reduceMotion = useReducedMotion();
  const [type, setType] = React.useState<CreateType>("markdown");
  const [name, setName] = React.useState(defaultName || "");
  const [compiler, setCompiler] = React.useState<LatexCompiler>("pdflatex");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setIsSubmitting(false);
    setType("markdown");
    setName(defaultName || "");
    setCompiler("pdflatex");
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, defaultName]);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (type === "latex") {
        const folder = await createLatexProject(parentId, name.trim(), { compiler });
        highlightFile(folder.id);
        onCreated?.(folder);
        onOpenChange(false);
        return;
      }

      const { file } = buildTemplateFile(name, type);
      const created = await upload(parentId, [file]);
      const createdFile = created.find((n) => n.type === "file") || created[0];
      if (createdFile) {
        highlightFile(createdFile.id);
        onCreated?.(createdFile);
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : type === "latex"
            ? "Failed to create LaTeX project"
            : "Failed to create file";
      setError(message);
      setIsSubmitting(false);
    }
  };

  const title = type === "latex" ? "New LaTeX project" : "New file";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md",
          "border-black/10 bg-white/90 backdrop-blur-xl",
          "shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--text-main)]">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--text-muted)]">Type</div>
            <SegmentedControl
              value={type}
              onValueChange={setType}
              items={typeItems}
              size="sm"
              className="w-full justify-between bg-black/[0.03] border-black/[0.06]"
              ariaLabel="Create type"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--text-muted)]">Name</div>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "latex" ? "e.g. Paper" : "e.g. notes.md"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="h-10 bg-white border-black/[0.08] focus-visible:ring-[var(--brand)]/25"
            />
            {type === "latex" ? (
              <div className="text-[11px] text-[var(--text-muted)]">
                Creates <span className="font-mono">main.tex</span> and{" "}
                <span className="font-mono">references.bib</span>.
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-muted)]">
                Tip: omit extension and we’ll add one automatically.
              </div>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {type === "latex" ? (
              <motion.div
                key="latex"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="space-y-2"
              >
                <div className="text-xs font-medium text-[var(--text-muted)]">Compiler</div>
                <SegmentedControl
                  value={compiler}
                  onValueChange={setCompiler}
                  items={compilerItems}
                  className="w-full justify-between bg-black/[0.03] border-black/[0.06]"
                  ariaLabel="LaTeX compiler"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {error ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
            {type === "latex" ? "Create project" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateFileDialog;
