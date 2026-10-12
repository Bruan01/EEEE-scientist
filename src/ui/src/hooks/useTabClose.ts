"use client";

/**
 * useTabClose Hook
 *
 * Handles tab close logic with dirty state checking.
 * Shows confirmation dialog before closing tabs with unsaved changes.
 *
 * @module hooks/useTabClose
 */

import { useCallback, useState } from "react";
import { useTabsStore } from "@/lib/stores/tabs";
import type { Tab } from "@/lib/types/tab";

/**
 * Confirmation dialog result
 */
export type ConfirmResult = "save" | "discard" | "cancel";

/**
 * Confirm dialog options
 */
export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/**
 * Tab close result
 */
export interface TabCloseResult {
  /** Whether the tab was closed */
  closed: boolean;

  /** The tab that was affected */
  tab?: Tab;

  /** User's choice if confirmation was shown */
  result?: ConfirmResult;
}

/**
 * useTabClose Hook
 *
 * Provides safe tab closing with dirty state handling.
 *
 * @example
 * ```tsx
 * function TabBar() {
 *   const { handleCloseTab, pendingClose, confirmClose, cancelClose } = useTabClose();
 *
 *   return (
 *     <>
 *       <TabItem onClose={() => handleCloseTab(tab.id)} />
 *       {pendingClose && (
 *         <ConfirmDialog
 *           title="Unsaved Changes"
 *           message={`"${pendingClose.title}" has unsaved changes`}
 *           onConfirm={confirmClose}
 *           onCancel={cancelClose}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useTabClose() {
  const { tabs, closeTab, getDirtyTabs } = useTabsStore();

  // Tab pending confirmation before close
  const [pendingClose, setPendingClose] = useState<Tab | null>(null);

  /**
   * Request to close a tab
   *
   * If tab has unsaved changes, sets pendingClose for confirmation.
   * Otherwise, closes immediately.
   */
  const handleCloseTab = useCallback(
    async (tabId: string): Promise<TabCloseResult> => {
      const tab = tabs.find((t) => t.id === tabId);

      if (!tab) {
        return { closed: false };
      }

      // If tab is dirty, ask for confirmation
      if (tab.isDirty) {
        setPendingClose(tab);
        return { closed: false, tab };
      }

      // Close immediately
      closeTab(tabId);
      return { closed: true, tab };
    },
    [tabs, closeTab]
  );

  /**
   * Confirm closing the pending tab
   *
   * @param save - Whether to save before closing (future feature)
   */
  const confirmClose = useCallback(
    (save: boolean = false): TabCloseResult => {
      if (!pendingClose) {
        return { closed: false };
      }

      const tab = pendingClose;

      // TODO: If save is true, trigger save action before closing
      // For now, we just close the tab

      closeTab(tab.id);
      setPendingClose(null);

      return {
        closed: true,
        tab,
        result: save ? "save" : "discard",
      };
    },
    [pendingClose, closeTab]
  );

  /**
   * Cancel the pending close operation
   */
  const cancelClose = useCallback((): TabCloseResult => {
    const tab = pendingClose;
    setPendingClose(null);
    return { closed: false, tab: tab || undefined, result: "cancel" };
  }, [pendingClose]);

  /**
   * Force close a tab without confirmation
   */
  const forceCloseTab = useCallback(
    (tabId: string): void => {
      closeTab(tabId);
      // Clear pending if it's the same tab
      if (pendingClose?.id === tabId) {
        setPendingClose(null);
      }
    },
    [closeTab, pendingClose]
  );

  /**
   * Check if closing a tab would need confirmation
   */
  const wouldNeedConfirmation = useCallback(
    (tabId: string): boolean => {
      const tab = tabs.find((t) => t.id === tabId);
      return tab?.isDirty ?? false;
    },
    [tabs]
  );

  /**
   * Close all dirty tabs with confirmation
   *
   * Returns list of tabs that need confirmation
   */
  const getTabsNeedingConfirmation = useCallback((): Tab[] => {
    return getDirtyTabs();
  }, [getDirtyTabs]);

  return {
    /** Request to close a tab (may trigger confirmation) */
    handleCloseTab,

    /** Tab currently pending confirmation */
    pendingClose,

    /** Confirm and close the pending tab */
    confirmClose,

    /** Cancel the pending close */
    cancelClose,

    /** Force close without confirmation */
    forceCloseTab,

    /** Check if tab would need confirmation */
    wouldNeedConfirmation,

    /** Get all tabs that would need confirmation */
    getTabsNeedingConfirmation,

    /** Whether there's a pending close confirmation */
    hasPendingClose: pendingClose !== null,
  };
}

export default useTabClose;
