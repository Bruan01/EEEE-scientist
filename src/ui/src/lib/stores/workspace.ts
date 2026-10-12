/**
 * Workspace Store
 *
 * Manages the three-column layout state including:
 * - Panel sizes (left sidebar, content area, right chat panel)
 * - Panel collapsed states
 * - Layout preferences with localStorage persistence
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Workspace layout configuration
 */
export interface WorkspaceLayout {
  /** Left panel size as percentage (default 18%) */
  leftPanelSize: number;

  /** Right panel size as percentage (default 25%) */
  rightPanelSize: number;

  /** Whether left panel is collapsed */
  leftCollapsed: boolean;

  /** Whether right panel is collapsed */
  rightCollapsed: boolean;
}

/**
 * Workspace state interface
 */
export interface WorkspaceState extends WorkspaceLayout {
  // Actions
  setLeftPanelSize: (size: number) => void;
  setRightPanelSize: (size: number) => void;
  toggleLeftPanel: (collapsed?: boolean) => void;
  toggleRightPanel: (collapsed?: boolean) => void;
  resetLayout: () => void;
}

/**
 * Default layout values
 */
const DEFAULT_LAYOUT: WorkspaceLayout = {
  leftPanelSize: 18,
  rightPanelSize: 25,
  leftCollapsed: false,
  rightCollapsed: false,
};

/**
 * Workspace store with persistence
 */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      // Initial state
      ...DEFAULT_LAYOUT,

      // Actions
      setLeftPanelSize: (size: number) => {
        // Clamp size between min (15%) and max (30%)
        const clampedSize = Math.max(15, Math.min(30, size));
        set({ leftPanelSize: clampedSize });
      },

      setRightPanelSize: (size: number) => {
        // Clamp size between min (20%) and max (40%)
        const clampedSize = Math.max(20, Math.min(40, size));
        set({ rightPanelSize: clampedSize });
      },

      toggleLeftPanel: (collapsed?: boolean) =>
        set((state) => ({
          leftCollapsed: collapsed ?? !state.leftCollapsed,
        })),

      toggleRightPanel: (collapsed?: boolean) =>
        set((state) => ({
          rightCollapsed: collapsed ?? !state.rightCollapsed,
        })),

      resetLayout: () => set(DEFAULT_LAYOUT),
    }),
    {
      name: "ds-workspace-layout",
      // Only persist layout-related state
      partialize: (state) => ({
        leftPanelSize: state.leftPanelSize,
        rightPanelSize: state.rightPanelSize,
        leftCollapsed: state.leftCollapsed,
        rightCollapsed: state.rightCollapsed,
      }),
    }
  )
);

/**
 * Selector hooks for specific state slices
 */
export const useLeftPanel = () =>
  useWorkspaceStore((state) => ({
    size: state.leftPanelSize,
    collapsed: state.leftCollapsed,
    setSize: state.setLeftPanelSize,
    toggle: state.toggleLeftPanel,
  }));

export const useRightPanel = () =>
  useWorkspaceStore((state) => ({
    size: state.rightPanelSize,
    collapsed: state.rightCollapsed,
    setSize: state.setRightPanelSize,
    toggle: state.toggleRightPanel,
  }));
