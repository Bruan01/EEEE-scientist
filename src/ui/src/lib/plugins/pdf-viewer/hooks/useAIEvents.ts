/**
 * useAIEvents Hook
 *
 * WebSocket event listener for AI-triggered UI synchronization.
 * Handles annotation:created, annotation:updated, annotation:deleted, and pdf:jump events.
 *
 * @module plugins/pdf-viewer/hooks/useAIEvents
 */

"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { annotationKeys } from "./useAnnotations";
import type {
  AIEvent,
  AIEventType,
  AnnotationCreatedEvent,
  PdfJumpEvent,
} from "../types";

/**
 * Event handler type
 */
type EventHandler<T = unknown> = (data: T) => void;

/**
 * Event handlers configuration
 */
export interface AIEventHandlers {
  /** Called when an annotation is created by AI */
  onAnnotationCreated?: EventHandler<AnnotationCreatedEvent>;
  /** Called when an annotation is updated */
  onAnnotationUpdated?: EventHandler<AnnotationCreatedEvent>;
  /** Called when an annotation is deleted */
  onAnnotationDeleted?: EventHandler<{ annotationId: string }>;
  /** Called when AI requests a page jump */
  onPdfJump?: EventHandler<PdfJumpEvent>;
}

/**
 * Hook options
 */
export interface UseAIEventsOptions {
  /** File ID to filter events */
  fileId?: string;
  /** Event handlers */
  handlers?: AIEventHandlers;
  /** Whether to automatically refresh annotations on events */
  autoRefresh?: boolean;
  /** WebSocket URL (defaults to standard endpoint) */
  wsUrl?: string;
}

/**
 * Hook return value
 */
export interface UseAIEventsReturn {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Last received event */
  lastEvent: AIEvent | null;
  /** Manually trigger reconnection */
  reconnect: () => void;
}

/**
 * Parse an AI event from WebSocket message
 */
function parseAIEvent(data: unknown): AIEvent | null {
  if (!data || typeof data !== "object") return null;

  const event = data as Record<string, unknown>;

  // Handle different event formats
  if (event.type && typeof event.type === "string") {
    return {
      type: event.type as AIEventType,
      data: (event.data as Record<string, unknown>) || {},
    };
  }

  // Handle alternate event format
  if (event.name && typeof event.name === "string") {
    return {
      type: event.name as AIEventType,
      data: (event.data as Record<string, unknown>) || {},
    };
  }

  return null;
}

/**
 * Hook for listening to AI events via WebSocket
 *
 * @param options - Configuration options
 * @returns Connection state and utilities
 */
export function useAIEvents(options: UseAIEventsOptions = {}): UseAIEventsReturn {
  const {
    fileId,
    handlers = {},
    autoRefresh = true,
    wsUrl,
  } = options;

  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);
  const lastEventRef = useRef<AIEvent | null>(null);

  /**
   * Handle incoming AI event
   */
  const handleEvent = useCallback(
    (event: AIEvent) => {
      lastEventRef.current = event;

      // Filter by fileId if provided
      const eventFileId = (event.data as { fileId?: string })?.fileId;
      if (fileId && eventFileId && eventFileId !== fileId) {
        return;
      }

      switch (event.type) {
        case "annotation:created": {
          const data = event.data as AnnotationCreatedEvent;

          // Auto-refresh annotations
          if (autoRefresh && data.fileId) {
            queryClient.invalidateQueries({
              queryKey: annotationKeys.list(data.fileId),
            });
          }

          // Call handler
          handlers.onAnnotationCreated?.(data);
          break;
        }

        case "annotation:updated": {
          const data = event.data as AnnotationCreatedEvent;

          if (autoRefresh && data.fileId) {
            queryClient.invalidateQueries({
              queryKey: annotationKeys.list(data.fileId),
            });
          }

          handlers.onAnnotationUpdated?.(data);
          break;
        }

        case "annotation:deleted": {
          const data = event.data as { annotationId: string; fileId?: string };

          if (autoRefresh && data.fileId) {
            queryClient.invalidateQueries({
              queryKey: annotationKeys.list(data.fileId),
            });
          }

          handlers.onAnnotationDeleted?.(data);
          break;
        }

        case "pdf:jump": {
          const data = event.data as PdfJumpEvent;
          handlers.onPdfJump?.(data);
          break;
        }

        default:
          // Unknown event type, ignore
          break;
      }
    },
    [fileId, handlers, autoRefresh, queryClient]
  );

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    // Determine WebSocket URL
    const baseUrl = wsUrl || getDefaultWsUrl();
    if (!baseUrl) {
      console.warn("[useAIEvents] No WebSocket URL available");
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(baseUrl);

      ws.onopen = () => {
        isConnectedRef.current = true;
        console.log("[useAIEvents] WebSocket connected");
      };

      ws.onclose = () => {
        isConnectedRef.current = false;
        console.log("[useAIEvents] WebSocket disconnected");

        // Attempt reconnection after 5 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = (error) => {
        console.error("[useAIEvents] WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const aiEvent = parseAIEvent(data);
          if (aiEvent) {
            handleEvent(aiEvent);
          }
        } catch (error) {
          console.error("[useAIEvents] Failed to parse message:", error);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[useAIEvents] Failed to connect:", error);
    }
  }, [wsUrl, handleEvent]);

  /**
   * Reconnect manually
   */
  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    connect();
  }, [connect]);

  /**
   * Setup connection on mount
   */
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected: isConnectedRef.current,
    lastEvent: lastEventRef.current,
    reconnect,
  };
}

/**
 * Get default WebSocket URL based on current location
 */
function getDefaultWsUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;

  // Use environment variable if available
  const apiUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (apiUrl) {
    return apiUrl;
  }

  // Fallback to current host with /ws endpoint
  return `${protocol}//${host}/api/v1/ws`;
}

export default useAIEvents;
