"use client";

import * as React from "react";
import {
  BarChart3,
  Copy,
  FileText,
  Search,
  Sparkles,
  Check,
} from "lucide-react";
import type { PluginComponentProps } from "@/lib/types/plugin";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

type Action = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
};

const actions: Action[] = [
  {
    id: "paper-summary",
    title: "Summarize a paper",
    description: "Turn a PDF into crisp bullet points + open questions.",
    prompt:
      "Summarize this paper in 12 bullets. Then list: (1) assumptions, (2) key claims, (3) limitations, (4) what I should verify experimentally. End with 5 follow-up questions.",
    icon: FileText,
  },
  {
    id: "related-work",
    title: "Find related work",
    description: "Generate a reading list with search keywords.",
    prompt:
      "Based on the current context, suggest 10 related papers or topics. For each: why it's relevant, 3 search keywords, and what to skim first.",
    icon: Search,
  },
  {
    id: "dataset-audit",
    title: "Dataset quick audit",
    description: "Spot leakage, missingness, and obvious gotchas early.",
    prompt:
      "Audit this dataset: describe schema, missingness, outliers, potential leakage, and the most important sanity checks. Propose 3 baseline models and 5 evaluation pitfalls.",
    icon: BarChart3,
  },
  {
    id: "research-plan",
    title: "Draft a research plan",
    description: "From vague idea → steps, milestones, and risks.",
    prompt:
      "Create a 2-week research plan with daily milestones. Include risks, validation criteria, and a minimal reproducible baseline. Keep it practical and measurable.",
    icon: Sparkles,
  },
];

function sendToCopilot(text: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ds:copilot:prefill", {
      detail: { text, focus: true },
    })
  );
}

export default function AnalysisPlugin({ setTitle }: PluginComponentProps) {
  React.useEffect(() => setTitle("Analysis"), [setTitle]);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = React.useCallback(async (action: Action) => {
    const ok = await copyToClipboard(action.prompt);
    if (ok) {
      setCopiedId(action.id);
      window.setTimeout(() => setCopiedId((v) => (v === action.id ? null : v)), 1200);
    } else {
      setCopiedId(null);
    }
  }, []);

  return (
    <div className="h-full">
      <div className="max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analysis</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A small set of “good prompts” you can reuse. Copy them, or send
              them straight to Copilot.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;
            const copied = copiedId === action.id;
            return (
              <div
                key={action.id}
                className={cn(
                  "rounded-2xl border border-border bg-card/90 backdrop-blur",
                  "p-5 shadow-sm",
                  "hover:shadow-md transition-shadow"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{action.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{action.description}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy(action)}
                    className={cn(
                      "inline-flex h-8 items-center gap-2 rounded-xl px-3 text-sm leading-none whitespace-nowrap shrink-0",
                      "border border-border bg-background hover:bg-accent/40 transition-colors",
                      copied && "border-[var(--brand)] bg-[var(--brand-subtle)]"
                    )}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                    ) : (
                      <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="leading-none text-foreground">{copied ? "Copied" : "Copy"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendToCopilot(action.prompt)}
                    className={cn(
                      "inline-flex h-8 items-center gap-2 rounded-xl px-3 text-sm font-medium leading-none whitespace-nowrap shrink-0",
                      "border border-transparent bg-primary text-primary-foreground shadow-sm",
                      "hover:bg-primary/90 hover:shadow-md active:shadow-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "transition"
                    )}
                  >
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span className="leading-none">Send to Copilot</span>
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <div className="text-[11px] font-mono leading-relaxed text-muted-foreground line-clamp-4">
                    {action.prompt}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          Tip: these prompts work best when you reference a file (open it in a
          tab) or paste a snippet.
        </div>
      </div>
    </div>
  );
}
