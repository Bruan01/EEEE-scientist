/**
 * AnnotationSidebar Component
 *
 * Sidebar for managing PDF annotations with filtering and grouping.
 *
 * @module plugins/pdf-viewer/components/AnnotationSidebar
 */

"use client";

import React, { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n/useI18n";
import { AnnotationCard, AnnotationCardSkeleton } from "./AnnotationCard";
import {
  ANNOTATION_COLORS,
  type AnnotationSidebarProps,
  type Annotation,
  type AnnotationColor,
  type UpdateAnnotationRequest,
} from "../types";

/**
 * Filter state interface
 */
interface FilterState {
  color?: AnnotationColor;
  tag?: string;
  search?: string;
}

/**
 * Select dropdown component
 */
function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; color?: string }[];
  placeholder: string;
  className?: string;
}) {
  const { t } = useI18n("pdf_viewer");

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 px-2 text-xs rounded-soft-sm border",
        "bg-soft-bg-elevated text-soft-text-primary",
        "border-soft-border focus:border-soft-accent",
        "focus:outline-none focus:ring-1 focus:ring-soft-accent",
        "cursor-pointer",
        className
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Empty state component
 */
function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  const { t } = useI18n("pdf_viewer");

  return (
    <div className="p-8 text-center">
      {/* Icon */}
      <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-soft-bg-elevated flex items-center justify-center">
        <svg
          className="w-6 h-6 text-soft-text-tertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 3v4a2 2 0 002 2h4"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 13h6M9 17h4"
          />
        </svg>
      </div>

      {hasFilters ? (
        <>
          <p className="text-soft-text-primary mb-1">{t("no_matching_annotations")}</p>
          <p className="text-sm text-soft-text-secondary mb-4">
            {t("adjust_filters")}
          </p>
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            {t("clear_filters")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-soft-text-primary mb-1">{t("no_annotations")}</p>
          <p className="text-sm text-soft-text-secondary">
            {t("select_text_to_highlight")}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {[1, 2, 3].map((i) => (
        <AnnotationCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * AnnotationSidebar component
 */
export function AnnotationSidebar({
  annotations,
  isLoading,
  onSelect,
  onDelete,
  onUpdate,
  selectedAnnotationId,
}: AnnotationSidebarProps) {
  const { t } = useI18n("pdf_viewer");
  const [filter, setFilter] = useState<FilterState>({});

  // Get all unique tags from annotations
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    annotations.forEach((a) => a.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [annotations]);

  // Check if any filters are active
  const hasFilters = !!(filter.color || filter.tag || filter.search);

  // Filter and group annotations by page
  const groupedAnnotations = useMemo(() => {
    let filtered = [...annotations];

    // Apply color filter
    if (filter.color) {
      filtered = filtered.filter((a) => a.color === filter.color);
    }

    // Apply tag filter
    if (filter.tag) {
      filtered = filtered.filter((a) => a.tags.includes(filter.tag!));
    }

    // Apply search filter
    if (filter.search) {
      const query = filter.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.content.text?.toLowerCase().includes(query) ||
          a.comment.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Group by page number
    const grouped = new Map<number, Annotation[]>();
    for (const annotation of filtered) {
      const page = annotation.position.pageNumber;
      const existing = grouped.get(page) || [];
      existing.push(annotation);
      grouped.set(page, existing);
    }

    // Sort pages and annotations within each page
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([page, pageAnnotations]) => ({
        page,
        annotations: pageAnnotations.sort(
          (a, b) =>
            a.position.boundingRect.y1 - b.position.boundingRect.y1
        ),
      }));
  }, [annotations, filter]);

  // Total filtered count
  const filteredCount = useMemo(
    () => groupedAnnotations.reduce((sum, g) => sum + g.annotations.length, 0),
    [groupedAnnotations]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilter({});
  }, []);

  // Handle annotation update
  const handleUpdate = useCallback(
    (id: string, updates: UpdateAnnotationRequest) => {
      onUpdate(id, updates);
    },
    [onUpdate]
  );

  // Color options for filter
  const colorOptions = useMemo(
    () =>
      (Object.keys(ANNOTATION_COLORS) as AnnotationColor[]).map((color) => ({
        value: color,
        label: ANNOTATION_COLORS[color].label,
        color: ANNOTATION_COLORS[color].border,
      })),
    []
  );

  // Tag options for filter
  const tagOptions = useMemo(
    () => allTags.map((tag) => ({ value: tag, label: tag })),
    [allTags]
  );

  return (
    <div className="w-80 h-full border-l border-soft-border flex flex-col bg-soft-bg-surface">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-soft-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-soft-text-primary">{t("annotations")}</h3>
          <Badge variant="default">
            {isLoading ? "..." : filteredCount}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-soft-text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            placeholder={t("search_annotations")}
            value={filter.search || ""}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, search: e.target.value || undefined }))
            }
            className="pl-8 h-8 text-sm"
          />
          {filter.search && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-soft-text-tertiary hover:text-soft-text-primary"
              onClick={() => setFilter((prev) => ({ ...prev, search: undefined }))}
            >
              <svg
                className="w-4 h-4"
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
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select
            value={filter.color || ""}
            onChange={(value) =>
              setFilter((prev) => ({
                ...prev,
                color: value as AnnotationColor | undefined,
              }))
            }
            options={colorOptions}
            placeholder={t("all_colors")}
            className="flex-1"
          />
          <Select
            value={filter.tag || ""}
            onChange={(value) =>
              setFilter((prev) => ({
                ...prev,
                tag: value || undefined,
              }))
            }
            options={tagOptions}
            placeholder={t("all_tags")}
            className="flex-1"
          />
        </div>

        {/* Active filter badges */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1 mt-2">
            {filter.color && (
              <Badge variant="info" className="text-xs">
                <span
                  className="w-2 h-2 rounded-full mr-1 inline-block"
                  style={{ backgroundColor: ANNOTATION_COLORS[filter.color].border }}
                />
                {ANNOTATION_COLORS[filter.color].label}
                <button
                  type="button"
                  className="ml-1 hover:text-red-500"
                  onClick={() =>
                    setFilter((prev) => ({ ...prev, color: undefined }))
                  }
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </Badge>
            )}
            {filter.tag && (
              <Badge variant="info" className="text-xs">
                #{filter.tag}
                <button
                  type="button"
                  className="ml-1 hover:text-red-500"
                  onClick={() =>
                    setFilter((prev) => ({ ...prev, tag: undefined }))
                  }
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </Badge>
            )}
            <button
              type="button"
              className="text-xs text-soft-text-tertiary hover:text-soft-accent"
              onClick={handleClearFilters}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Annotation list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <LoadingSkeleton />
        ) : groupedAnnotations.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClearFilters={handleClearFilters} />
        ) : (
          <div className="p-4 space-y-6">
            {groupedAnnotations.map(({ page, annotations: pageAnnotations }) => (
              <div key={page}>
                {/* Page header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-soft-text-secondary">
                    {t("page", { page })}
                  </span>
                  <div className="flex-1 h-px bg-soft-border" />
                  <span className="text-xs text-soft-text-tertiary">
                    {pageAnnotations.length}
                  </span>
                </div>

                {/* Annotations for this page */}
                <div className="space-y-3">
                  {pageAnnotations.map((annotation) => (
                    <AnnotationCard
                      key={annotation.id}
                      annotation={annotation}
                      onClick={() => onSelect(annotation.id)}
                      onDelete={() => onDelete(annotation.id)}
                      onUpdate={(updates) => handleUpdate(annotation.id, updates)}
                      isSelected={annotation.id === selectedAnnotationId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer with stats */}
      {!isLoading && annotations.length > 0 && (
        <div className="flex-shrink-0 p-3 border-t border-soft-border bg-soft-bg-elevated">
          <div className="flex justify-between text-xs text-soft-text-tertiary">
            <span>
              {filteredCount} of {annotations.length} annotations
            </span>
            <span>
              {new Set(annotations.map((a) => a.position.pageNumber)).size} pages
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnotationSidebar;
