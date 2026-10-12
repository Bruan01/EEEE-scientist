"use client";

import * as React from "react";

export type CopilotDockSide = "left" | "right";

export type CopilotDockState = {
  open: boolean;
  side: CopilotDockSide;
  width: number;
  /**
   * Maximum fraction of the Stage width the dock can take.
   * e.g. 0.5 means "up to half of the Stage".
   */
  maxRatio: number;
};

export const COPILOT_DOCK_DEFAULTS = {
  storagePrefix: "ds:copilot:dock:",
  open: true,
  side: "right" as CopilotDockSide,
  width: 400,
  maxRatio: 0.5,
  minWidth: 320,
  gap: 25,
  edgeInset: 4,
  stageMinContent: 560,
  welcomeMaxRatio: 0.7,
  welcomeStageMinContent: 0,
};

type UseCopilotDockStateOptions = Partial<{
  defaultOpen: boolean;
  defaultSide: CopilotDockSide;
  defaultWidth: number;
  defaultMaxRatio: number;
  storagePrefix: string;
}>;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isSide(value: unknown): value is CopilotDockSide {
  return value === "left" || value === "right";
}

function parseStoredState(raw: string | null): Partial<CopilotDockState> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CopilotDockState> | null;
    if (!parsed || typeof parsed !== "object") return null;

    const next: Partial<CopilotDockState> = {};
    if (typeof parsed.open === "boolean") next.open = parsed.open;
    if (isSide(parsed.side)) next.side = parsed.side;
    if (typeof parsed.width === "number" && Number.isFinite(parsed.width))
      next.width = parsed.width;
    if (typeof parsed.maxRatio === "number" && Number.isFinite(parsed.maxRatio))
      next.maxRatio = parsed.maxRatio;

    return next;
  } catch {
    return null;
  }
}

export function getCopilotDockMaxWidth(params: {
  stageWidth: number;
  maxRatio: number;
  stageMinContent?: number;
  gap?: number;
}) {
  const stageMinContent =
    typeof params.stageMinContent === "number"
      ? params.stageMinContent
      : COPILOT_DOCK_DEFAULTS.stageMinContent;
  const gap =
    typeof params.gap === "number" ? params.gap : COPILOT_DOCK_DEFAULTS.gap;

  const ratioMax = Math.floor(params.stageWidth * params.maxRatio);
  const contentMax = Math.floor(params.stageWidth - stageMinContent - gap);
  return Math.max(0, Math.min(ratioMax, contentMax));
}

export function clampCopilotDockWidth(params: {
  width: number;
  stageWidth: number;
  minWidth?: number;
  maxRatio: number;
  stageMinContent?: number;
  gap?: number;
}) {
  const minWidth =
    typeof params.minWidth === "number"
      ? params.minWidth
      : COPILOT_DOCK_DEFAULTS.minWidth;
  const maxWidth = getCopilotDockMaxWidth({
    stageWidth: params.stageWidth,
    maxRatio: params.maxRatio,
    stageMinContent: params.stageMinContent,
    gap: params.gap,
  });

  if (maxWidth <= 0) return minWidth;
  return clampNumber(params.width, minWidth, Math.max(minWidth, maxWidth));
}

export function shouldForceCloseCopilotDock(params: {
  stageWidth: number;
  minWidth?: number;
  stageMinContent?: number;
  gap?: number;
}) {
  const minWidth =
    typeof params.minWidth === "number"
      ? params.minWidth
      : COPILOT_DOCK_DEFAULTS.minWidth;
  const stageMinContent =
    typeof params.stageMinContent === "number"
      ? params.stageMinContent
      : COPILOT_DOCK_DEFAULTS.stageMinContent;
  const gap =
    typeof params.gap === "number" ? params.gap : COPILOT_DOCK_DEFAULTS.gap;

  return params.stageWidth < stageMinContent + minWidth + gap + 40;
}

export function useCopilotDockState(
  projectId: string,
  options?: UseCopilotDockStateOptions
) {
  const storagePrefix = options?.storagePrefix ?? COPILOT_DOCK_DEFAULTS.storagePrefix;
  const storageKey = React.useMemo(
    () => `${storagePrefix}${projectId}`,
    [projectId, storagePrefix]
  );

  const [state, setState] = React.useState<CopilotDockState>(() => {
    const defaults: CopilotDockState = {
      open: options?.defaultOpen ?? COPILOT_DOCK_DEFAULTS.open,
      side: options?.defaultSide ?? COPILOT_DOCK_DEFAULTS.side,
      width: options?.defaultWidth ?? COPILOT_DOCK_DEFAULTS.width,
      maxRatio: options?.defaultMaxRatio ?? COPILOT_DOCK_DEFAULTS.maxRatio,
    };

    if (typeof window === "undefined") return defaults;
    const stored = parseStoredState(window.localStorage.getItem(storageKey));
    if (!stored) return defaults;
    return {
      open: stored.open ?? defaults.open,
      side: stored.side ?? defaults.side,
      width: stored.width ?? defaults.width,
      maxRatio: stored.maxRatio ?? defaults.maxRatio,
    };
  });

  const persistTimerRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!projectId) return;

    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // ignore write failures
      }
    }, 200);

    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [projectId, state, storageKey]);

  const setOpen = React.useCallback((open: boolean) => {
    setState((prev) => (prev.open === open ? prev : { ...prev, open }));
  }, []);

  const toggleOpen = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: !prev.open }));
  }, []);

  const setSide = React.useCallback((side: CopilotDockSide) => {
    setState((prev) => (prev.side === side ? prev : { ...prev, side }));
  }, []);

  const toggleSide = React.useCallback(() => {
    setState((prev) => ({ ...prev, side: prev.side === "left" ? "right" : "left" }));
  }, []);

  const setWidth = React.useCallback((width: number) => {
    setState((prev) => (prev.width === width ? prev : { ...prev, width }));
  }, []);

  const setMaxRatio = React.useCallback((maxRatio: number) => {
    setState((prev) => (prev.maxRatio === maxRatio ? prev : { ...prev, maxRatio }));
  }, []);

  const clampToStage = React.useCallback(
    (
      stageWidth: number,
      options?: {
        maxRatio?: number;
        minWidth?: number;
        stageMinContent?: number;
        gap?: number;
      }
    ) => {
      setState((prev) => {
        const nextWidth = clampCopilotDockWidth({
          width: prev.width,
          stageWidth,
          maxRatio: options?.maxRatio ?? prev.maxRatio,
          minWidth: options?.minWidth,
          stageMinContent: options?.stageMinContent,
          gap: options?.gap,
        });
        const forceClose = shouldForceCloseCopilotDock({
          stageWidth,
          minWidth: options?.minWidth,
          stageMinContent: options?.stageMinContent,
          gap: options?.gap,
        });
        const nextOpen = forceClose ? false : prev.open;
        if (nextWidth === prev.width && nextOpen === prev.open) return prev;
        return {
          ...prev,
          width: nextWidth,
          open: nextOpen,
        };
      });
    },
    []
  );

  return {
    state,
    storageKey,
    setOpen,
    toggleOpen,
    setSide,
    toggleSide,
    setWidth,
    setMaxRatio,
    clampToStage,
  };
}
