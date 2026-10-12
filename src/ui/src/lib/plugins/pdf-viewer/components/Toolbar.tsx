/**
 * Toolbar Component
 *
 * PDF viewer toolbar with zoom controls, page navigation,
 * search, and sidebar toggle.
 *
 * @module plugins/pdf-viewer/components/Toolbar
 */

"use client";

import React, { useState, useEffect, useCallback, memo, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  Search,
  PanelRight,
  Download,
  X,
  FileText,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTriangleIcon } from "@/components/ui/info-triangle-icon";
import { useI18n } from "@/lib/i18n/useI18n";
import type { ToolbarProps } from "../types";
import { ZOOM_LEVELS } from "../types";

// ============================================================
// Sub-Components
// ============================================================

/**
 * Zoom Controls Component
 */
interface ZoomControlsProps {
  scale: number;
  onScaleChange: (scale: number) => void;
}

const ZoomControls = memo(function ZoomControls({
  scale,
  onScaleChange,
}: ZoomControlsProps) {
  const { t } = useI18n("pdf_viewer");

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= scale);
    if (currentIndex > 0) {
      onScaleChange(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= scale);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      onScaleChange(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onScaleChange(parseFloat(e.target.value));
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleZoomOut}
        disabled={scale <= ZOOM_LEVELS[0]}
        className={cn(
          "p-1.5 rounded hover:bg-muted transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title={t("zoom_out")}
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <select
        value={scale}
        onChange={handleSelectChange}
        className={cn(
          "w-20 px-2 py-1 text-sm rounded",
          "bg-muted/50 border border-border",
          "focus:outline-none focus:ring-2 focus:ring-primary/50"
        )}
      >
        {ZOOM_LEVELS.map((z) => (
          <option key={z} value={z}>
            {Math.round(z * 100)}%
          </option>
        ))}
      </select>

      <button
        onClick={handleZoomIn}
        disabled={scale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
        className={cn(
          "p-1.5 rounded hover:bg-muted transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title={t("zoom_in")}
      >
        <ZoomIn className="w-4 h-4" />
      </button>
    </div>
  );
});

/**
 * Page Navigation Component
 */
interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const PageNavigation = memo(function PageNavigation({
  currentPage,
  totalPages,
  onPageChange,
}: PageNavigationProps) {
  const { t } = useI18n("pdf_viewer");
  const [inputValue, setInputValue] = useState(String(currentPage));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value with current page
  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setInputValue(String(currentPage));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setInputValue(String(currentPage));
      inputRef.current?.blur();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePrevPage}
        disabled={currentPage <= 1}
        className={cn(
          "p-1.5 rounded hover:bg-muted transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title={t("previous_page")}
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1 text-sm whitespace-nowrap">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className={cn(
            "w-12 px-2 py-1 text-center rounded",
            "bg-muted/50 border border-border",
            "focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
        />
        <span className="shrink-0 whitespace-nowrap text-muted-foreground">
          / {totalPages}
        </span>
      </div>

      <button
        onClick={handleNextPage}
        disabled={currentPage >= totalPages}
        className={cn(
          "p-1.5 rounded hover:bg-muted transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title={t("next_page")}
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
});

/**
 * Search Box Component
 */
interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBox = memo(function SearchBox({
  value,
  onChange,
  placeholder,
}: SearchBoxProps) {
  const { t } = useI18n("pdf_viewer");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t("search_placeholder")}
        className={cn(
          "w-48 pl-8 pr-8 py-1.5 text-sm rounded",
          "bg-muted/50 border border-border",
          "placeholder:text-muted-foreground/60",
          "focus:outline-none focus:ring-2 focus:ring-primary/50"
        )}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2 p-0.5 rounded hover:bg-muted/80 transition-colors"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
});

/**
 * Separator Component
 */
function Separator() {
  return <div className="w-px h-6 bg-border mx-2" />;
}

// ============================================================
// Toolbar Component
// ============================================================

/**
 * Toolbar Component
 *
 * Main toolbar for PDF viewer with zoom, navigation,
 * search, and sidebar controls.
 *
 * @example
 * ```tsx
 * <Toolbar
 *   scale={1.0}
 *   onScaleChange={setScale}
 *   currentPage={1}
 *   totalPages={10}
 *   onPageChange={goToPage}
 *   sidebarVisible={true}
 *   onSidebarToggle={toggleSidebar}
 * />
 * ```
 */
export const Toolbar = memo(function Toolbar({
  scale,
  onScaleChange,
  currentPage,
  totalPages,
  onPageChange,
  sidebarVisible,
  onSidebarToggle,
  searchQuery = "",
  onSearchChange,
  onDownload,
  onInfo,
  infoDisabled = false,
  markdownActive,
  onMarkdownToggle,
  markdownLabel,
  markdownTitle,
  reviewOpinionActive,
  onReviewOpinionToggle,
  reviewOpinionLabel,
  reviewOpinionTitle,
}: ToolbarProps) {
  const { t } = useI18n("pdf_viewer");
  const isMarkdownActive = Boolean(markdownActive);
  const canToggleMarkdown = typeof onMarkdownToggle === "function";
  const markdownButtonLabel = markdownLabel?.trim() || t("markdown");
  const markdownButtonTitle = markdownTitle?.trim() || t("open_markdown");
  const isReviewOpinionActive = Boolean(reviewOpinionActive);
  const canToggleReviewOpinion = typeof onReviewOpinionToggle === "function";
  const reviewOpinionButtonLabel = reviewOpinionLabel?.trim() || t("review_opinion");
  const reviewOpinionButtonTitle =
    reviewOpinionTitle?.trim() || t("open_review_opinion");
  const canShowInfo = typeof onInfo === "function";
  const hasLeftActions = Boolean(onSearchChange || onDownload || canShowInfo);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-4 py-2",
        "bg-muted/30 border-b border-border"
      )}
    >
      {/* Left section: search + download + info + zoom + paging */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {onSearchChange ? (
            <SearchBox
              value={searchQuery}
              onChange={onSearchChange}
              placeholder={t("search_pdf_placeholder")}
            />
        ) : null}

        {onDownload ? (
          <button
            onClick={onDownload}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title={t("download_pdf")}
          >
            <Download className="w-4 h-4" />
          </button>
        ) : null}
        {canShowInfo ? (
          <button
            onClick={onInfo}
            disabled={infoDisabled}
            className={cn(
              "p-1.5 rounded transition-colors",
              "hover:bg-muted",
              infoDisabled && "opacity-50 cursor-not-allowed"
            )}
            title={t("paper_info")}
            aria-label={t("paper_info")}
          >
            <InfoTriangleIcon className="h-4 w-4" />
          </button>
        ) : null}

        {hasLeftActions ? <Separator /> : null}
        <ZoomControls scale={scale} onScaleChange={onScaleChange} />
        <Separator />
        <PageNavigation
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>

      {/* Right section: Sidebar toggle */}
      <div className="ml-auto flex items-center justify-end gap-2">
        {canToggleMarkdown ? (
          <button
            type="button"
            onClick={onMarkdownToggle}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-sm",
              "bg-background hover:bg-muted/60 border-border",
              isMarkdownActive && "bg-primary/10 text-primary border-primary/20"
            )}
            title={markdownButtonTitle}
          >
            <FileText className="w-4 h-4" />
            {markdownButtonLabel}
          </button>
        ) : null}
        {canToggleReviewOpinion ? (
          <button
            type="button"
            onClick={onReviewOpinionToggle}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-sm",
              "bg-background hover:bg-muted/60 border-border",
              isReviewOpinionActive && "bg-primary/10 text-primary border-primary/20"
            )}
            title={reviewOpinionButtonTitle}
          >
            <MessageSquare className="w-4 h-4" />
            {reviewOpinionButtonLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSidebarToggle}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-sm",
            "bg-background hover:bg-muted/60 border-border",
            sidebarVisible && "bg-primary/10 text-primary border-primary/20"
          )}
          title={sidebarVisible ? t("hide_annotations") : t("show_annotations")}
        >
          <PanelRight className="w-4 h-4" />
          {sidebarVisible ? t("hide") : t("show")}
        </button>
      </div>
    </div>
  );
});

export default Toolbar;
