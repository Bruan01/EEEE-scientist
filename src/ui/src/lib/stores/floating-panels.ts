import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PanelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelState extends PanelPosition {
  isVisible: boolean;
  isMinimized: boolean;
  zIndex: number;
}

export interface SnapGuide {
  type: "vertical" | "horizontal";
  position: number;
  start: number;
  end: number;
}

interface FloatingPanelsState {
  panels: {
    files: PanelState;
    content: PanelState;
    chat: PanelState;
  };
  activePanel: string | null;
  snapThreshold: number;

  // Actions
  updatePanel: (
    id: "files" | "content" | "chat",
    updates: Partial<PanelState>
  ) => void;
  bringToFront: (id: string) => void;
  togglePanel: (id: "files" | "content" | "chat") => void;
  resetLayout: () => void;
  getSnapPosition: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => { x: number; y: number; guides: SnapGuide[] };
}

// Get default layout (based on window size)
const getDefaultLayout = () => ({
  files: {
    x: 20,
    y: 80,
    width: 280,
    height: typeof window !== "undefined" ? window.innerHeight - 140 : 600,
    isVisible: true,
    isMinimized: false,
    zIndex: 1,
  },
  content: {
    x: 320,
    y: 80,
    width: typeof window !== "undefined" ? window.innerWidth - 680 : 800,
    height: typeof window !== "undefined" ? window.innerHeight - 140 : 600,
    isVisible: true,
    isMinimized: false,
    zIndex: 2,
  },
  chat: {
    x: typeof window !== "undefined" ? window.innerWidth - 340 : 1000,
    y: 80,
    width: 320,
    height: typeof window !== "undefined" ? window.innerHeight - 140 : 600,
    isVisible: true,
    isMinimized: false,
    zIndex: 3,
  },
});

export const useFloatingPanelsStore = create<FloatingPanelsState>()(
  persist(
    (set, get) => ({
      panels: getDefaultLayout(),
      activePanel: null,
      snapThreshold: 15,

      updatePanel: (id, updates) =>
        set((state) => ({
          panels: {
            ...state.panels,
            [id]: { ...state.panels[id], ...updates },
          },
        })),

      bringToFront: (id) =>
        set((state) => {
          const maxZ = Math.max(
            ...Object.values(state.panels).map((p) => p.zIndex)
          );
          return {
            panels: {
              ...state.panels,
              [id]: {
                ...state.panels[id as keyof typeof state.panels],
                zIndex: maxZ + 1,
              },
            },
            activePanel: id,
          };
        }),

      togglePanel: (id) =>
        set((state) => ({
          panels: {
            ...state.panels,
            [id]: {
              ...state.panels[id],
              isVisible: !state.panels[id].isVisible,
            },
          },
        })),

      resetLayout: () => set({ panels: getDefaultLayout() }),

      getSnapPosition: (id, x, y, width, height) => {
        const { panels, snapThreshold } = get();
        const guides: SnapGuide[] = [];
        let snappedX = x;
        let snappedY = y;

        // Screen edges
        const screenWidth =
          typeof window !== "undefined" ? window.innerWidth : 1920;
        const screenHeight =
          typeof window !== "undefined" ? window.innerHeight : 1080;
        const edges = {
          left: 20,
          right: screenWidth - 20,
          top: 80,
          bottom: screenHeight - 60,
        };

        // Check snapping to screen edges
        if (Math.abs(x - edges.left) < snapThreshold) {
          snappedX = edges.left;
          guides.push({
            type: "vertical",
            position: edges.left,
            start: 0,
            end: screenHeight,
          });
        }
        if (Math.abs(x + width - edges.right) < snapThreshold) {
          snappedX = edges.right - width;
          guides.push({
            type: "vertical",
            position: edges.right,
            start: 0,
            end: screenHeight,
          });
        }
        if (Math.abs(y - edges.top) < snapThreshold) {
          snappedY = edges.top;
          guides.push({
            type: "horizontal",
            position: edges.top,
            start: 0,
            end: screenWidth,
          });
        }
        if (Math.abs(y + height - edges.bottom) < snapThreshold) {
          snappedY = edges.bottom - height;
          guides.push({
            type: "horizontal",
            position: edges.bottom,
            start: 0,
            end: screenWidth,
          });
        }

        // Check snapping to other panels
        Object.entries(panels).forEach(([panelId, panel]) => {
          if (panelId === id || !panel.isVisible) return;

          const panelRight = panel.x + panel.width;
          const panelBottom = panel.y + panel.height;

          // Left edge aligns with other panel's right edge
          if (Math.abs(x - panelRight) < snapThreshold) {
            snappedX = panelRight;
            guides.push({
              type: "vertical",
              position: panelRight,
              start: Math.min(y, panel.y),
              end: Math.max(y + height, panelBottom),
            });
          }
          // Right edge aligns with other panel's left edge
          if (Math.abs(x + width - panel.x) < snapThreshold) {
            snappedX = panel.x - width;
            guides.push({
              type: "vertical",
              position: panel.x,
              start: Math.min(y, panel.y),
              end: Math.max(y + height, panelBottom),
            });
          }
          // Top alignment
          if (Math.abs(y - panel.y) < snapThreshold) {
            snappedY = panel.y;
            guides.push({
              type: "horizontal",
              position: panel.y,
              start: Math.min(x, panel.x),
              end: Math.max(x + width, panelRight),
            });
          }
          // Bottom alignment
          if (Math.abs(y + height - panelBottom) < snapThreshold) {
            snappedY = panelBottom - height;
            guides.push({
              type: "horizontal",
              position: panelBottom,
              start: Math.min(x, panel.x),
              end: Math.max(x + width, panelRight),
            });
          }
        });

        return { x: snappedX, y: snappedY, guides };
      },
    }),
    {
      name: "ds-floating-panels",
      partialize: (state) => ({ panels: state.panels }),
    }
  )
);
