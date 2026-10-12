"use client";

/**
 * TabContextMenu Component
 *
 * Right-click context menu for tabs with common operations.
 *
 * @module components/workspace/TabContextMenu
 */

import { useEffect, useRef, useCallback } from "react";
import {
  X,
  XCircle,
  Pin,
  PinOff,
  Copy,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { useI18n } from "@/lib/i18n/useI18n";
import { useFileContentStore } from "@/lib/stores/file-content";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { useTabsStore } from "@/lib/stores/tabs";

/**
 * TabContextMenu Props
 */
export interface TabContextMenuProps {
  /** ID of the tab this menu is for */
  tabId: string;

  /** Position to render the menu */
  position: { x: number; y: number };

  /** Called when menu should close */
  onClose: () => void;
}

/**
 * Menu item component
 */
interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false,
  variant = "default",
}: MenuItemProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left",
        "hover:bg-soft-bg-elevated transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        variant === "danger" && "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-soft-text-secondary ml-4">{shortcut}</span>
      )}
    </button>
  );
}

/**
 * Menu separator
 */
function MenuSeparator() {
  return <div className="h-px bg-soft-border my-1" />;
}

/**
 * TabContextMenu Component
 *
 * Provides common tab operations:
 * - Close tab
 * - Close other tabs
 * - Close tabs to the right
 * - Close all tabs
 * - Pin/Unpin tab
 * - Copy file path
 */
export function TabContextMenu({
  tabId,
  position,
  onClose,
}: TabContextMenuProps) {
  const { t } = useI18n("workspace");
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    tabs,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    setTabPinned,
  } = useTabsStore();
  const reloadFile = useFileContentStore((state) => state.reload);
  const fileTreeProjectId = useFileTreeStore((state) => state.projectId);

  const tab = tabs.find((t) => t.id === tabId);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Position menu within viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position
    if (position.x + rect.width > viewportWidth) {
      menu.style.left = `${viewportWidth - rect.width - 8}px`;
    }

    // Adjust vertical position
    if (position.y + rect.height > viewportHeight) {
      menu.style.top = `${viewportHeight - rect.height - 8}px`;
    }
  }, [position]);

  // Handler functions
  const handleClose = useCallback(() => {
    closeTab(tabId);
    onClose();
  }, [tabId, closeTab, onClose]);

  const handleCloseOthers = useCallback(() => {
    closeOtherTabs(tabId);
    onClose();
  }, [tabId, closeOtherTabs, onClose]);

  const handleCloseToRight = useCallback(() => {
    closeTabsToRight(tabId);
    onClose();
  }, [tabId, closeTabsToRight, onClose]);

  const handleCloseAll = useCallback(() => {
    closeAllTabs();
    onClose();
  }, [closeAllTabs, onClose]);

  const handleTogglePin = useCallback(() => {
    if (tab) {
      setTabPinned(tabId, !tab.isPinned);
    }
    onClose();
  }, [tab, tabId, setTabPinned, onClose]);

  const handleCopyPath = useCallback(() => {
    if (tab?.context.resourcePath) {
      void copyToClipboard(tab.context.resourcePath);
    } else if (tab?.context.resourceName) {
      void copyToClipboard(tab.context.resourceName);
    }
    onClose();
  }, [tab, onClose]);

  const handleReload = useCallback(() => {
    if (!tab || tab.context.type !== "file") {
      onClose();
      return;
    }
    const fileId = tab.context.resourceId;
    if (!fileId) {
      onClose();
      return;
    }
    const customData = tab.context.customData as
      | {
          projectId?: unknown;
          fileMeta?: { updatedAt?: string; sizeBytes?: number; mimeType?: string };
        }
      | undefined;
    const projectId =
      typeof customData?.projectId === "string"
        ? customData.projectId
        : fileTreeProjectId || undefined;
    if (!projectId) {
      onClose();
      return;
    }
    void reloadFile({
      projectId,
      fileId,
      updatedAt: customData?.fileMeta?.updatedAt,
      sizeBytes: customData?.fileMeta?.sizeBytes,
      mimeType: tab.context.mimeType ?? customData?.fileMeta?.mimeType,
    }).catch((error) => {
      console.error("[TabContextMenu] Reload failed:", error);
    });
    onClose();
  }, [fileTreeProjectId, onClose, reloadFile, tab]);

  if (!tab) return null;

  // Calculate number of tabs to the right
  const tabIndex = tabs.findIndex((t) => t.id === tabId);
  const tabsToRightCount = tabs.length - tabIndex - 1;

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[10002] min-w-[200px] py-1",
        "bg-soft-bg-elevated rounded-lg shadow-lg",
        "border border-soft-border"
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
      role="menu"
      aria-label={t("tab_context_menu")}
    >
      {/* Close actions */}
      <MenuItem
        icon={<X className="h-4 w-4" />}
        label={t("tab_close")}
        shortcut="Ctrl+W"
        onClick={handleClose}
        disabled={tab.isPinned}
      />
      <MenuItem
        icon={<XCircle className="h-4 w-4" />}
        label={t("tab_close_others")}
        onClick={handleCloseOthers}
        disabled={tabs.length <= 1}
      />
      <MenuItem
        icon={<ArrowRight className="h-4 w-4" />}
        label={t("tab_close_right", { count: tabsToRightCount })}
        onClick={handleCloseToRight}
        disabled={tabsToRightCount === 0}
      />
      <MenuItem
        icon={<XCircle className="h-4 w-4" />}
        label={t("tab_close_all")}
        onClick={handleCloseAll}
        variant="danger"
      />

      <MenuSeparator />

      {/* Pin action */}
      <MenuItem
        icon={tab.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        label={tab.isPinned ? t("tab_unpin") : t("tab_pin")}
        onClick={handleTogglePin}
      />

      <MenuSeparator />

      {/* Copy path */}
      <MenuItem
        icon={<Copy className="h-4 w-4" />}
        label={t("tab_copy_path")}
        onClick={handleCopyPath}
        disabled={!tab.context.resourcePath && !tab.context.resourceName}
      />

      {/* Reload (for future use) */}
      {tab.context.type === "file" && (
        <MenuItem
          icon={<RefreshCw className="h-4 w-4" />}
          label={t("tab_reload")}
          shortcut="Ctrl+R"
          onClick={handleReload}
        />
      )}
    </div>
  );
}

export default TabContextMenu;
