"use client";

/**
 * useTabShortcuts Hook
 *
 * Registers keyboard shortcuts for tab operations.
 *
 * Supported shortcuts:
 * - Ctrl/Cmd + W: Close current tab
 * - Ctrl/Cmd + Shift + T: Restore recently closed tab
 * - Ctrl/Cmd + Tab: Switch to next tab
 * - Ctrl/Cmd + Shift + Tab: Switch to previous tab
 * - Ctrl/Cmd + 1-9: Switch to tab by index
 * - Ctrl/Cmd + `: Switch to most recently accessed tab
 *
 * @module hooks/useTabShortcuts
 */

import { useEffect, useCallback } from "react";
import { useTabsStore } from "@/lib/stores/tabs";
import { useTabClose } from "./useTabClose";

/**
 * Shortcut configuration
 */
export interface TabShortcutsConfig {
  /** Enable Ctrl/Cmd + W to close tab */
  closeTab?: boolean;

  /** Enable Ctrl/Cmd + Shift + T to restore tab */
  restoreTab?: boolean;

  /** Enable Ctrl/Cmd + Tab navigation */
  tabNavigation?: boolean;

  /** Enable Ctrl/Cmd + 1-9 for quick switch */
  numberNavigation?: boolean;

  /** Enable Ctrl/Cmd + ` for recent tab */
  recentTab?: boolean;

  /** Callback when a shortcut is triggered */
  onShortcut?: (action: string) => void;
}

/**
 * Default configuration
 */
const defaultConfig: TabShortcutsConfig = {
  closeTab: true,
  restoreTab: true,
  tabNavigation: true,
  numberNavigation: true,
  recentTab: true,
};

/**
 * useTabShortcuts Hook
 *
 * Registers global keyboard shortcuts for tab operations.
 * Automatically cleans up listeners on unmount.
 *
 * @param config - Configuration object to enable/disable specific shortcuts
 *
 * @example
 * ```tsx
 * function WorkspaceLayout() {
 *   // Enable all tab shortcuts
 *   useTabShortcuts();
 *
 *   // Or with custom config
 *   useTabShortcuts({
 *     closeTab: true,
 *     tabNavigation: true,
 *     onShortcut: (action) => console.log(`Shortcut: ${action}`),
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useTabShortcuts(config: TabShortcutsConfig = {}) {
  const mergedConfig = { ...defaultConfig, ...config };

  const tabs = useTabsStore((state) => state.tabs);
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const setActiveTab = useTabsStore((state) => state.setActiveTab);
  const { handleCloseTab } = useTabClose();

  /**
   * Get next tab in the list
   */
  const getNextTab = useCallback(() => {
    if (tabs.length === 0) return null;
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    return tabs[nextIndex];
  }, [tabs, activeTabId]);

  /**
   * Get previous tab in the list
   */
  const getPreviousTab = useCallback(() => {
    if (tabs.length === 0) return null;
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const prevIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
    return tabs[prevIndex];
  }, [tabs, activeTabId]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      const isMod = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      if (!isMod) return;

      // Ctrl/Cmd + W: Close current tab
      if (mergedConfig.closeTab && e.key === "w" && !isShift) {
        e.preventDefault();
        if (activeTabId) {
          handleCloseTab(activeTabId);
          mergedConfig.onShortcut?.("closeTab");
        }
        return;
      }

      // Ctrl/Cmd + Shift + T: Restore recently closed tab
      // Note: This conflicts with browser's reopen tab, so we might want to use a different shortcut
      // For now, we'll use Ctrl/Cmd + Shift + T
      if (mergedConfig.restoreTab && e.key === "t" && isShift) {
        // Prevent default browser behavior if possible
        // Note: This may not work in all browsers
        e.preventDefault();
        // TODO: Implement restore tab functionality
        // useTabsStore.getState().restoreRecentlyClosedTab?.();
        mergedConfig.onShortcut?.("restoreTab");
        return;
      }

      // Ctrl/Cmd + Tab: Next tab
      if (mergedConfig.tabNavigation && e.key === "Tab" && !isShift) {
        e.preventDefault();
        const nextTab = getNextTab();
        if (nextTab) {
          setActiveTab(nextTab.id);
          mergedConfig.onShortcut?.("nextTab");
        }
        return;
      }

      // Ctrl/Cmd + Shift + Tab: Previous tab
      if (mergedConfig.tabNavigation && e.key === "Tab" && isShift) {
        e.preventDefault();
        const prevTab = getPreviousTab();
        if (prevTab) {
          setActiveTab(prevTab.id);
          mergedConfig.onShortcut?.("previousTab");
        }
        return;
      }

      // Ctrl/Cmd + 1-9: Switch to tab by index
      if (mergedConfig.numberNavigation && !isShift) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          const tabIndex = num - 1;
          if (tabIndex < tabs.length) {
            setActiveTab(tabs[tabIndex].id);
            mergedConfig.onShortcut?.(`switchToTab${num}`);
          }
          return;
        }
      }

      // Ctrl/Cmd + `: Switch to most recently accessed tab
      if (mergedConfig.recentTab && e.key === "`" && !isShift) {
        e.preventDefault();
        // Find the most recently accessed tab that's not the current one
        const sortedByAccess = [...tabs]
          .filter((t) => t.id !== activeTabId)
          .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

        if (sortedByAccess.length > 0) {
          setActiveTab(sortedByAccess[0].id);
          mergedConfig.onShortcut?.("recentTab");
        }
        return;
      }
    },
    [
      mergedConfig,
      activeTabId,
      tabs,
      handleCloseTab,
      setActiveTab,
      getNextTab,
      getPreviousTab,
    ]
  );

  // Register keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * List of supported shortcuts for documentation
 */
export const TAB_SHORTCUTS = [
  { keys: "Ctrl/Cmd + W", description: "Close current tab" },
  { keys: "Ctrl/Cmd + Shift + T", description: "Restore recently closed tab" },
  { keys: "Ctrl/Cmd + Tab", description: "Switch to next tab" },
  { keys: "Ctrl/Cmd + Shift + Tab", description: "Switch to previous tab" },
  { keys: "Ctrl/Cmd + 1-9", description: "Switch to tab by number" },
  { keys: "Ctrl/Cmd + `", description: "Switch to most recent tab" },
] as const;

export default useTabShortcuts;
