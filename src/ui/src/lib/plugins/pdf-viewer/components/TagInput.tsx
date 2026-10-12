/**
 * TagInput Component
 *
 * Tag input component with suggestions for PDF annotations.
 *
 * @module plugins/pdf-viewer/components/TagInput
 */

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/useI18n";
import type { TagInputProps } from "../types";

/**
 * Default tag suggestions
 */
const DEFAULT_SUGGESTIONS_EN = [
  "important",
  "question",
  "todo",
  "reference",
  "key-finding",
  "methodology",
  "result",
  "conclusion",
  "definition",
  "example",
];

const DEFAULT_SUGGESTIONS_ZH = [
  "重要",
  "问题",
  "待办",
  "参考",
  "关键发现",
  "方法",
  "结果",
  "结论",
  "定义",
  "示例",
];

/**
 * Tag input component for adding a single tag
 */
export function TagInput({
  onAdd,
  onCancel,
  suggestions = [],
}: TagInputProps) {
  const { t, language } = useI18n("pdf_viewer");
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine suggestions
  const defaultSuggestions = language === "zh-CN" ? DEFAULT_SUGGESTIONS_ZH : DEFAULT_SUGGESTIONS_EN;
  const allSuggestions = [...new Set([...suggestions, ...defaultSuggestions])];

  // Filter suggestions based on input
  const filteredSuggestions = allSuggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value
  );

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim().toLowerCase();
    if (trimmedValue) {
      onAdd(trimmedValue);
      setValue("");
    }
  }, [value, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Tab" && filteredSuggestions.length > 0 && value) {
        e.preventDefault();
        onAdd(filteredSuggestions[0]);
        setValue("");
      }
    },
    [handleSubmit, onCancel, filteredSuggestions, value, onAdd]
  );

  const handleSuggestionClick = useCallback(
    (tag: string) => {
      onAdd(tag);
      setValue("");
    },
    [onAdd]
  );

  return (
    <div className="space-y-2">
      {/* Input field */}
      <div className="flex gap-1">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay to allow clicking suggestions
              setTimeout(() => setShowSuggestions(false), 150);
            }}
            placeholder={t("type_tag_placeholder")}
            className="h-8 text-sm pr-16"
          />
          {value && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-soft-text-tertiary hover:text-soft-text-primary"
              onClick={() => setValue("")}
            >
              {t("clear")}
            </button>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="h-8"
        >
          {t("add")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8"
        >
          {t("cancel")}
        </Button>
      </div>

      {/* Suggestions */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filteredSuggestions.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              className={cn(
                "px-2 py-1 text-xs rounded-full",
                "bg-soft-bg-elevated text-soft-text-secondary",
                "hover:bg-soft-accent hover:text-white",
                "transition-colors duration-150"
              )}
              onClick={() => handleSuggestionClick(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Tag list display with add/remove functionality
 */
export function TagList({
  tags,
  onRemove,
  onAddClick,
  editable = true,
  maxVisible = 5,
}: {
  tags: string[];
  onRemove?: (tag: string) => void;
  onAddClick?: () => void;
  editable?: boolean;
  maxVisible?: number;
}) {
  const { t } = useI18n("pdf_viewer");
  const [showAll, setShowAll] = useState(false);

  const visibleTags = showAll ? tags : tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visibleTags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={cn(
            "text-xs",
            editable && "pr-1"
          )}
        >
          <span>{tag}</span>
          {editable && onRemove && (
            <button
              type="button"
              className="ml-1 hover:text-red-500 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag);
              }}
              aria-label={t("remove_tag", { tag })}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </Badge>
      ))}

      {/* Show more/less toggle */}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          className="text-xs text-soft-text-tertiary hover:text-soft-accent transition-colors"
          onClick={() => setShowAll(true)}
        >
          {t("show_more", { count: hiddenCount })}
        </button>
      )}
      {showAll && hiddenCount > 0 && (
        <button
          type="button"
          className="text-xs text-soft-text-tertiary hover:text-soft-accent transition-colors"
          onClick={() => setShowAll(false)}
        >
          {t("show_less")}
        </button>
      )}

      {/* Add button */}
      {editable && onAddClick && (
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 text-xs rounded-full",
            "text-soft-text-tertiary hover:text-soft-accent",
            "border border-dashed border-soft-border hover:border-soft-accent",
            "transition-colors duration-150"
          )}
          onClick={onAddClick}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {t("add_tag")}
        </button>
      )}
    </div>
  );
}

/**
 * Combined tag manager component with input toggle
 */
export function TagManager({
  tags,
  onChange,
  suggestions = [],
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = useCallback(
    (tag: string) => {
      if (!tags.includes(tag)) {
        onChange([...tags, tag]);
      }
      setIsAdding(false);
    },
    [tags, onChange]
  );

  const handleRemove = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange]
  );

  return (
    <div className="space-y-2">
      {/* Tag list */}
      <TagList
        tags={tags}
        onRemove={handleRemove}
        onAddClick={() => setIsAdding(true)}
        editable={!isAdding}
      />

      {/* Tag input */}
      {isAdding && (
        <TagInput
          onAdd={handleAdd}
          onCancel={() => setIsAdding(false)}
          suggestions={suggestions}
        />
      )}
    </div>
  );
}

export default TagInput;
