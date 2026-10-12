/**
 * PDF Viewer State Hook
 *
 * Zustand store for managing PDF viewer state including:
 * - Scale/zoom level
 * - Current page
 * - Search state
 * - Sidebar visibility
 * - Selected annotation
 *
 * @module plugins/pdf-viewer/hooks/useViewerState
 */

"use client";

import { create } from "zustand";
import type {
  ViewerState,
  ViewerStateActions,
  ZoomFitMode,
  SearchResult,
} from "../types";
import { ZOOM_LEVELS } from "../types";

// ============================================================
// Initial State
// ============================================================

const initialState: ViewerState = {
  scale: 1.0,
  fitMode: "custom",
  currentPage: 1,
  totalPages: 0,
  scrollTop: 0,
  searchQuery: "",
  searchResults: [],
  currentSearchIndex: -1,
  // Default: keep annotations sidebar hidden until the user creates one.
  sidebarVisible: false,
  selectedAnnotationId: null,
};

// ============================================================
// Store Type
// ============================================================

type ViewerStore = ViewerState & ViewerStateActions;

// ============================================================
// Viewer State Store
// ============================================================

/**
 * Zustand store for PDF viewer state
 */
export const useViewerState = create<ViewerStore>((set, get) => ({
  // Initial state
  ...initialState,

  // ============================================================
  // Scale Actions
  // ============================================================

  setScale: (scale: number) => {
    // Clamp scale to valid range
    const clampedScale = Math.max(
      ZOOM_LEVELS[0],
      Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], scale)
    );
    set({ scale: clampedScale, fitMode: "custom" });
  },

  setFitMode: (mode: ZoomFitMode) => {
    set({ fitMode: mode });
    // Note: Actual scale calculation should be done in component
    // based on container dimensions
  },

  // ============================================================
  // Page Navigation Actions
  // ============================================================

  setCurrentPage: (page: number) => {
    const { totalPages } = get();
    const clampedPage = Math.max(1, Math.min(page, totalPages || 1));
    set({ currentPage: clampedPage });
  },

  setTotalPages: (total: number) => {
    set({ totalPages: total });
  },

  setScrollTop: (scrollTop: number) => {
    set({ scrollTop });
  },

  scrollToPage: (page: number) => {
    const { totalPages, setCurrentPage } = get();
    const clampedPage = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(clampedPage);
    // Note: Actual scrolling should be handled in component
    // This just sets the current page state
  },

  // ============================================================
  // Search Actions
  // ============================================================

  setSearchQuery: (query: string) => {
    set({ searchQuery: query, currentSearchIndex: -1 });
  },

  setSearchResults: (results: SearchResult[]) => {
    set({
      searchResults: results,
      currentSearchIndex: results.length > 0 ? 0 : -1,
    });
  },

  nextSearchResult: () => {
    const { searchResults, currentSearchIndex } = get();
    if (searchResults.length === 0) return;

    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    set({ currentSearchIndex: nextIndex });
  },

  prevSearchResult: () => {
    const { searchResults, currentSearchIndex } = get();
    if (searchResults.length === 0) return;

    const prevIndex =
      currentSearchIndex <= 0
        ? searchResults.length - 1
        : currentSearchIndex - 1;
    set({ currentSearchIndex: prevIndex });
  },

  // ============================================================
  // Sidebar Actions
  // ============================================================

  toggleSidebar: () => {
    set((state) => ({ sidebarVisible: !state.sidebarVisible }));
  },

  // ============================================================
  // Annotation Actions
  // ============================================================

  selectAnnotation: (id: string | null) => {
    set({ selectedAnnotationId: id });
  },

  scrollToAnnotation: (id: string) => {
    set({ selectedAnnotationId: id });
    // Note: Actual scrolling should be handled in component
    // by listening to selectedAnnotationId changes
  },

  // ============================================================
  // Reset
  // ============================================================

  reset: () => {
    set(initialState);
  },
}));

// ============================================================
// Selectors (for optimized re-renders)
// ============================================================

/**
 * Select scale from viewer state
 */
export const selectScale = (state: ViewerStore) => state.scale;

/**
 * Select current page from viewer state
 */
export const selectCurrentPage = (state: ViewerStore) => state.currentPage;

/**
 * Select total pages from viewer state
 */
export const selectTotalPages = (state: ViewerStore) => state.totalPages;

/**
 * Select search query from viewer state
 */
export const selectSearchQuery = (state: ViewerStore) => state.searchQuery;

/**
 * Select sidebar visibility from viewer state
 */
export const selectSidebarVisible = (state: ViewerStore) =>
  state.sidebarVisible;

/**
 * Select selected annotation ID from viewer state
 */
export const selectSelectedAnnotationId = (state: ViewerStore) =>
  state.selectedAnnotationId;

// ============================================================
// Hook for Scale Actions
// ============================================================

/**
 * Hook for zoom/scale actions
 */
export function useScaleActions() {
  const setScale = useViewerState((state) => state.setScale);
  const scale = useViewerState((state) => state.scale);

  const zoomIn = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= scale);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setScale(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const zoomOut = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= scale);
    if (currentIndex > 0) {
      setScale(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  return { scale, setScale, zoomIn, zoomOut, resetZoom };
}

// ============================================================
// Hook for Page Navigation
// ============================================================

/**
 * Hook for page navigation actions
 */
export function usePageNavigation() {
  const currentPage = useViewerState((state) => state.currentPage);
  const totalPages = useViewerState((state) => state.totalPages);
  const setCurrentPage = useViewerState((state) => state.setCurrentPage);
  const scrollToPage = useViewerState((state) => state.scrollToPage);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  const goToLastPage = () => {
    setCurrentPage(totalPages);
  };

  return {
    currentPage,
    totalPages,
    setCurrentPage,
    scrollToPage,
    goToNextPage,
    goToPrevPage,
    goToFirstPage,
    goToLastPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

// ============================================================
// Hook for Search
// ============================================================

/**
 * Hook for search functionality
 */
export function useSearch() {
  const searchQuery = useViewerState((state) => state.searchQuery);
  const searchResults = useViewerState((state) => state.searchResults);
  const currentSearchIndex = useViewerState(
    (state) => state.currentSearchIndex
  );
  const setSearchQuery = useViewerState((state) => state.setSearchQuery);
  const setSearchResults = useViewerState((state) => state.setSearchResults);
  const nextSearchResult = useViewerState((state) => state.nextSearchResult);
  const prevSearchResult = useViewerState((state) => state.prevSearchResult);

  const currentResult =
    currentSearchIndex >= 0 ? searchResults[currentSearchIndex] : null;

  return {
    searchQuery,
    searchResults,
    currentSearchIndex,
    currentResult,
    setSearchQuery,
    setSearchResults,
    nextSearchResult,
    prevSearchResult,
    hasResults: searchResults.length > 0,
    resultCount: searchResults.length,
  };
}

export default useViewerState;
