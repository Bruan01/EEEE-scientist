/**
 * Socket.IO helpers for Notebook collaboration (Yjs)
 *
 * spaceId: projectId (per user request)
 * docId: notebookId
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

export type WebsocketResponse<T> =
  | { error: EventError }
  | { data: T };

export interface ServerEvents {
  "arxiv:imported": (payload: {
    project_id: string;
    arxiv_id: string;
    file_id: string;
    status: string;
  }) => void;
  "arxiv:import_failed": (payload: {
    project_id: string;
    arxiv_id: string;
    file_id?: string;
    error: string;
  }) => void;
  "arxiv:batch_progress": (payload: {
    project_id: string;
    completed: number;
    total: number;
    current_arxiv_id?: string;
  }) => void;
  "space:broadcast-doc-update": (payload: {
    spaceType: string;
    spaceId: string;
    docId: string;
    update: string;
    timestamp: number;
    editor?: string;
  }) => void;
  "space:doc-reset": (payload: {
    spaceType: string;
    spaceId: string;
    docId: string;
    timestamp: number;
    reason?: string;
    actorUserId?: string | null;
    sentAt?: number;
  }) => void;
  "space:collect-awareness": (payload: {
    spaceType: string;
    spaceId: string;
    docId: string;
  }) => void;
  "space:broadcast-awareness-update": (payload: {
    spaceType: string;
    spaceId: string;
    docId: string;
    awarenessUpdate: string;
  }) => void;
}

export interface ClientEvents {
  "space:join": [
    { spaceType: string; spaceId: string; clientVersion: string },
    { clientId: string; success: boolean }
  ];
  "space:leave": { spaceType: string; spaceId: string };

  "space:load-doc": [
    { spaceType: string; spaceId: string; docId: string; stateVector?: string },
    { missing: string; state: string; timestamp: number }
  ];

  "space:push-doc-update": [
    { spaceType: string; spaceId: string; docId: string; update: string },
    { accepted: true; timestamp: number }
  ];

  "space:load-doc-timestamps": [
    { spaceType: string; spaceId: string; timestamp?: number },
    Record<string, number>
  ];

  "space:join-awareness": [
    { spaceType: string; spaceId: string; docId: string; clientVersion: string },
    { clientId: string; success: boolean }
  ];
  "space:leave-awareness": { spaceType: string; spaceId: string; docId: string };
  "space:update-awareness": {
    spaceType: string;
    spaceId: string;
    docId: string;
    awarenessUpdate: string;
  };
  "space:load-awarenesses": { spaceType: string; spaceId: string; docId: string };
}

export type NotebookSocket = Socket<ServerEvents, any> & {
  emitWithAck: <T>(
    event: string,
    data: any
  ) => Promise<WebsocketResponse<T>>;
  once?: (event: string, listener: (...args: any[]) => void) => NotebookSocket;
};

// Use resolveApiBaseUrl from @/lib/api/client for consistent API URL resolution

type SocketEntry = {
  socket: NotebookSocket;
  refCount: number;
};

const SOCKET_CACHE = new Map<string, SocketEntry>();

function createNoopNotebookSocket(): NotebookSocket {
  const socket = {
    connected: false,
    connect: () => socket,
    disconnect: () => socket,
    on: () => socket,
    once: () => socket,
    off: () => socket,
    emit: () => true,
    emitWithAck: async () => ({ data: undefined }),
  };
  return socket as unknown as NotebookSocket;
}

export function acquireSocket(options: {
  authMode?: "user";
} = {}): { socket: NotebookSocket; release: () => void } {
  if (!supportsSocketIo()) {
    return {
      socket: createNoopNotebookSocket(),
      release: () => {},
    };
  }
  const endpoint = resolveApiBaseUrl();
  const cacheKey = `${endpoint}::user`;

  let entry = SOCKET_CACHE.get(cacheKey);

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
        cb({ token: token || null });
      },
    }) as NotebookSocket;

    entry = { socket, refCount: 0 };
    SOCKET_CACHE.set(cacheKey, entry);
  }

  entry.refCount += 1;
  if (!entry.socket.connected) {
    entry.socket.connect();
  }

  return {
    socket: entry.socket,
    release: () => {
      const cur = SOCKET_CACHE.get(cacheKey);
      if (!cur) return;
      cur.refCount -= 1;
      if (cur.refCount <= 0) {
        cur.socket.disconnect();
        SOCKET_CACHE.delete(cacheKey);
      }
    },
  };
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const binaryArray = [...binaryString].map((char) => char.charCodeAt(0));
  return new Uint8Array(binaryArray);
}

export function uint8ArrayToBase64(array: Uint8Array): Promise<string> {
  return new Promise<string>((resolve) => {
    const buffer = new ArrayBuffer(array.byteLength);
    new Uint8Array(buffer).set(array);
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string | null;
      resolve(dataUrl ? dataUrl.split(",")[1] : "");
    };
    reader.readAsDataURL(blob);
  });
}
