import React, { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  HelpCircle,
  StickyNote,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/useI18n";
import styles from "../style/Tip.module.css";

type AnnotationKind = "note" | "question" | "task";

interface Props {
  onConfirm: (comment: { text: string; emoji: string }) => void;
  onCancel?: () => void;
  onOpen: () => void;
  onUpdate?: () => void;
  onAskCopilot?: () => void;
  popup?: { position: "above" | "below" };
  authorColor?: string;
  authorHandle?: string;
  showAuthorHandle?: boolean;
  onToggleAuthorHandle?: () => void;
}

export function Tip({
  onConfirm,
  onCancel,
  onOpen,
  onUpdate,
  onAskCopilot,
  authorColor,
  authorHandle,
  showAuthorHandle,
  onToggleAuthorHandle,
}: Props) {
  const { t } = useI18n("pdf_viewer");
  const [kind, setKind] = useState<AnnotationKind>("note");
  const [text, setText] = useState("");

  // Immediately convert the native selection into the internal “ghost highlight”,
  // so the user gets an instant, crisp preview and the tip can anchor reliably.
  useEffect(() => {
    onOpen();
    onUpdate?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onUpdate?.();
  }, [kind, onUpdate]);

  const placeholder = useMemo(() => {
    switch (kind) {
      case "question":
        return t("type_question");
      case "task":
        return t("type_task");
      default:
        return t("add_note_optional");
    }
  }, [kind, t]);

  const handleSave = () => {
    onConfirm({ text: text.trim(), emoji: kind });
  };

  return (
    <Card
      className={cn(
        "w-80 border border-border bg-popover text-popover-foreground shadow-soft-lg",
        "backdrop-blur supports-[backdrop-filter]:bg-popover/95",
        styles.tip,
        kind === "note" && styles.tipNote,
        kind === "question" && styles.tipQuestion,
        kind === "task" && styles.tipTask,
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">{t("add_annotation")}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onCancel}
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                title={authorHandle || t("author")}
              >
                <span
                  className="h-2 w-2 rounded-full border border-border"
                  style={{ backgroundColor: authorColor || "#F1E9D0" }}
                />
                {showAuthorHandle ? (
                  <span className="text-[11px]">{authorHandle || "user"}</span>
                ) : (
                  <span className="text-[11px]">{t("author")}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{t("author")}</DropdownMenuLabel>
              <DropdownMenuItem disabled>{authorHandle || "user"}</DropdownMenuItem>
              {onToggleAuthorHandle ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onToggleAuthorHandle();
                  }}
                >
                  {showAuthorHandle ? t("hide_name") : t("show_name")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <SegmentedControl<AnnotationKind>
          value={kind}
          onValueChange={setKind}
          size="sm"
          ariaLabel={t("type_label")}
          items={[
            {
              value: "note",
              label: t("type_note"),
              icon: <StickyNote className="h-4 w-4" />,
            },
            {
              value: "question",
              label: "Q",
              icon: <HelpCircle className="h-4 w-4" />,
            },
            {
              value: "task",
              label: t("type_task"),
              icon: <CheckSquare className="h-4 w-4" />,
            },
          ]}
          className="w-full justify-between"
        />

        <Textarea
          // biome-ignore lint/a11y/noAutofocus: selection -> instant annotation
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="min-h-[92px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel?.();
              return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("save_shortcut")}
          </p>
          <div className="flex items-center gap-2">
            {onAskCopilot ? (
              <Button type="button" variant="outline" onClick={onAskCopilot} className="h-8">
                {t("ask_copilot")}
              </Button>
            ) : null}
            <Button type="button" onClick={handleSave} className="h-8">
              {t("save")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
