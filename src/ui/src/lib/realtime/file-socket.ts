/**
 * Socket.IO helpers for realtime file collaboration (Overleaf-like autosave).
 *
 * Backend mount: /ws/socket.io
 */

import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/lib/stores/auth";
import { resolveApiBaseUrl } from "@/lib/api/client";
import { supportsSocketIo } from "@/lib/runtime/quest-runtime";

export interface EventError {
  name: string;
  message: string;
}

export type WebsocketResponse<T> = { error: EventError } | { data: T };

export interface FileServerEvents {
  "file:content-updated": (payload: {
    projectId: string;
    fileId: string;
    content: string;
    updatedAt: string;
    size?: number;
    checksum?: string;
    editor?: string;
  }) => void;
  "annotation:created": (payload: { fileId: string; annotationId: string }) => void;
  "annotation:updated": (payload: { fileId: string; annotationId: string }) => void;
  "annotation:deleted": (payload: { fileId: string; annotationId: string }) => void;
}

export interface FileClientEvents {
  "file:join": [
    { projectId: string; fileId: string; clientVersion?: string },
    { clientId: string; success: boolean }
  ];
  "file:leave": { projectId: string; fileId: string };
  "file:update-content": [
    { projectId: string; fileId: string; content: string },
    { accepted: true; updatedAt: string; size?: number; checksum?: string }
  ];
}

export type FileSocket = Socket<FileServerEvents, any> & {
  emitWithAck: <T>(event: string, data: any) => Promise<WebsocketResponse<T>>;
};

// Use resolveApiBaseUrl from @/lib/api/client for consistent API URL resolution
const getApiBaseUrl = resolveApiBaseUrl;

type SocketEntry = {
  socket: FileSocket;
  refCount: number;
};

const SOCKET_CACHE = new Map<string, SocketEntry>();

function createNoopFileSocket(): FileSocket {
  const socket = {
    connected: false,
    connect: () => socket,
    disconnect: () => socket,
    on: () => socket,
    off: () => socket,
    emit: () => true,
    emitWithAck: async () => ({ data: undefined }),
  };
  return socket as unknown as FileSocket;
}

export function acquireFileSocket(): { socket: FileSocket; release: () => void } {
  if (!supportsSocketIo()) {
    return {
      socket: createNoopFileSocket(),
      release: () => {},
    };
  }
  const endpoint = getApiBaseUrl();
  let entry = SOCKET_CACHE.get(endpoint);

  if (!entry) {
    const socket = io(endpoint, {
      path: "/ws/socket.io",
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: (cb) => {
        const token =
          useAuthStore.getState().accessToken ||
          (typeof window !== "undefined"
            ? window.localStorage.getItem("ds_access_token")
            : null);
        cb({ token });
      },
    }) as FileSocket;

    entry = { socket, refCount: 0 };
    SOCKET_CACHE.set(endpoint, entry);
  }

  entry.refCount += 1;
  if (!entry.socket.connected) {
    entry.socket.connect();
  }

  return {
    socket: entry.socket,
    release: () => {
      const cur = SOCKET_CACHE.get(endpoint);
      if (!cur) return;
      cur.refCount -= 1;
      if (cur.refCount <= 0) {
        cur.socket.disconnect();
        SOCKET_CACHE.delete(endpoint);
      }
    },
  };
}
