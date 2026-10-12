/**
 * Project-scoped sync client (spaceId = projectId)
 *
 * Implements a minimal subset of the AFFiNE protocol used by our backend:
 * - space:join / space:leave
 * - space:load-doc / space:push-doc-update / space:broadcast-doc-update
 * - awareness join/update/broadcast
 */

import {
  acquireSocket,
  base64ToUint8Array,
  uint8ArrayToBase64,
  type SocketAuthMode,
  type NotebookSocket,
  type WebsocketResponse,
} from "./socket";

type SpaceType = "workspace";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export class ProjectSyncClient {
  private readonly spaceType: SpaceType = "workspace";
  private readonly projectId: string;
  private readonly authMode: SocketAuthMode;
  private readonly docKind?: string;

  private socket: NotebookSocket;
  private releaseSocket: () => void;
  private joined = false;
  private joinedDocs = new Set<string>();

  constructor(
    projectId: string,
    options: { authMode?: SocketAuthMode; docKind?: string } = {}
  ) {
    this.projectId = projectId;
    this.authMode = options.authMode ?? "user";
    this.docKind = options.docKind;
    const { socket, release } = acquireSocket({ authMode: this.authMode });
    this.socket = socket;
    this.releaseSocket = release;
  }

  private async waitForConnected(timeoutMs: number): Promise<void> {
    if (this.socket.connected) return;

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("WebSocket connection timeout"));
      }, timeoutMs);

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onConnectError = (err: unknown) => {
        cleanup();
        reject(new Error(getErrorMessage(err) || "WebSocket connection error"));
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        this.socket.off("connect", onConnect);
        this.socket.off("connect_error", onConnectError as any);
        (this.socket as any).off?.("error", onConnectError);
      };

      const attachOnce = (eventName: string, handler: (...args: any[]) => void) => {
        const socketAny = this.socket as any;
        if (typeof socketAny.once === "function") {
          socketAny.once(eventName, handler);
          return;
        }
        const wrapped = (...args: any[]) => {
          if (typeof socketAny.off === "function") {
            socketAny.off(eventName, wrapped);
          }
          handler(...args);
        };
        socketAny.on?.(eventName, wrapped);
      };

      attachOnce("connect", onConnect);
      attachOnce("connect_error", onConnectError as any);
      attachOnce("error", onConnectError as any);
    });
  }

  private async emitWithAck<T>(
    event: string,
    data: any,
    timeoutMs = 10000
  ): Promise<WebsocketResponse<T>> {
    await this.waitForConnected(timeoutMs);

    try {
      const socketAny: any = this.socket as any;
      if (typeof socketAny.timeout === "function" && typeof socketAny.emitWithAck === "function") {
        // socket.io-client supports a built-in timeout wrapper for ack.
        return (await socketAny.timeout(timeoutMs).emitWithAck(event, data)) as WebsocketResponse<T>;
      }

      // Fallback: manual ack timeout wrapper
      return await new Promise<WebsocketResponse<T>>((resolve) => {
        const timer = window.setTimeout(() => {
          resolve({
            error: { name: "SOCKET_TIMEOUT", message: `Ack timeout for ${event}` },
          });
        }, timeoutMs);

        this.socket.emit(event, data, (payload: WebsocketResponse<T>) => {
          window.clearTimeout(timer);
          resolve(payload);
        });
      });
    } catch (err) {
      return {
        error: { name: "SOCKET_ERROR", message: getErrorMessage(err) },
      };
    }
  }

  async connect(): Promise<void> {
    if (this.joined) return;

    const res = await this.emitWithAck<{ clientId: string; success: boolean }>(
      "space:join",
      {
        spaceType: this.spaceType,
        spaceId: this.projectId,
        clientVersion: "1.0.0",
      },
      12000
    );

    if ("error" in res) {
      throw new Error(res.error.message);
    }
    if (!res.data.success) {
      throw new Error("Failed to join space");
    }
    this.joined = true;
  }

  async joinDoc(docId: string): Promise<void> {
    if (!docId) return;
    if (!this.joined) {
      await this.connect();
    }
    if (this.joinedDocs.has(docId)) return;

    const res = await this.emitWithAck<{ clientId: string; success: boolean }>(
      "space:join-doc",
      {
        spaceType: this.spaceType,
        spaceId: this.projectId,
        docId,
        docKind: this.docKind,
      },
      12000
    );

    if ("error" in res) {
      throw new Error(res.error.message);
    }
    if (!res.data.success) {
      throw new Error("Failed to join doc");
    }
    this.joinedDocs.add(docId);
  }

  leaveDoc(docId: string): void {
    if (!docId) return;
    if (!this.joinedDocs.has(docId)) return;
    this.socket.emit("space:leave-doc", {
      spaceType: this.spaceType,
      spaceId: this.projectId,
      docId,
      docKind: this.docKind,
    });
    this.joinedDocs.delete(docId);
  }

  disconnect(): void {
    try {
      if (this.joined) {
        for (const docId of Array.from(this.joinedDocs)) {
          this.leaveDoc(docId);
        }
        this.socket.emit("space:leave", {
          spaceType: this.spaceType,
          spaceId: this.projectId,
        });
      }
    } finally {
      this.joined = false;
      this.releaseSocket();
    }
  }

  onDocUpdate(
    handler: (message: {
      docId: string;
      update: Uint8Array;
      timestamp: number;
      editor?: string;
    }) => void
  ): () => void {
    const wrapped = (msg: any) => {
      if (msg?.spaceId !== this.projectId) return;
      handler({
        docId: String(msg.docId),
        update: base64ToUint8Array(String(msg.update)),
        timestamp: Number(msg.timestamp),
        editor: msg.editor ? String(msg.editor) : undefined,
      });
    };
    this.socket.on("space:broadcast-doc-update", wrapped);
    return () => this.socket.off("space:broadcast-doc-update", wrapped);
  }

  onDocReset(
    handler: (message: { docId: string; timestamp: number; reason?: string; actorUserId?: string | null }) => void
  ): () => void {
    const wrapped = (msg: any) => {
      if (msg?.spaceId !== this.projectId) return;
      handler({
        docId: String(msg.docId),
        timestamp: Number(msg.timestamp),
        reason: msg?.reason ? String(msg.reason) : undefined,
        actorUserId: msg?.actorUserId != null ? String(msg.actorUserId) : null,
      });
    };
    this.socket.on("space:doc-reset", wrapped);
    return () => this.socket.off("space:doc-reset", wrapped);
  }

  async loadDoc(
    notebookId: string,
    stateVector?: Uint8Array
  ): Promise<{ missing: Uint8Array; state: Uint8Array; timestamp: number } | null> {
    await this.joinDoc(notebookId);
    const res = await this.emitWithAck<{
      missing: string;
      state: string;
      timestamp: number;
    }>(
      "space:load-doc",
      {
        spaceType: this.spaceType,
        spaceId: this.projectId,
        docId: notebookId,
        docKind: this.docKind,
        stateVector: stateVector ? await uint8ArrayToBase64(stateVector) : undefined,
      },
      15000
    );

    if ("error" in res) {
      if (res.error.name === "DOC_NOT_FOUND" || res.error.name === "NOT_FOUND") {
        return null;
      }
      throw new Error(res.error.message);
    }

    return {
      missing: base64ToUint8Array(res.data.missing),
      state: base64ToUint8Array(res.data.state),
      timestamp: Number(res.data.timestamp),
    };
  }

  async pushDocUpdate(notebookId: string, update: Uint8Array): Promise<number> {
    await this.joinDoc(notebookId);
    const res = await this.emitWithAck<{ accepted: true; timestamp: number }>(
      "space:push-doc-update",
      {
        spaceType: this.spaceType,
        spaceId: this.projectId,
        docId: notebookId,
        docKind: this.docKind,
        update: await uint8ArrayToBase64(update),
      },
      15000
    );

    if ("error" in res) {
      throw new Error(res.error.message);
    }
    return Number(res.data.timestamp);
  }

  // -------------------- Awareness --------------------

  async joinAwareness(notebookId: string): Promise<void> {
    const res = await this.emitWithAck<{ clientId: string; success: boolean }>(
      "space:join-awareness",
      {
        spaceType: this.spaceType,
        spaceId: this.projectId,
        docId: notebookId,
        docKind: this.docKind,
        clientVersion: "1.0.0",
      },
      12000
    );

    if ("error" in res) {
      throw new Error(res.error.message);
    }
    if (!res.data.success) {
      throw new Error("Failed to join awareness");
    }
  }

  leaveAwareness(notebookId: string): void {
    this.socket.emit("space:leave-awareness", {
      spaceType: this.spaceType,
      spaceId: this.projectId,
      docId: notebookId,
      docKind: this.docKind,
    });
  }

  onAwarenessCollect(notebookId: string, handler: () => void): () => void {
    const wrapped = (msg: any) => {
      if (msg?.spaceId !== this.projectId) return;
      if (String(msg?.docId) !== notebookId) return;
      handler();
    };
    this.socket.on("space:collect-awareness", wrapped);
    return () => this.socket.off("space:collect-awareness", wrapped);
  }

  onAwarenessUpdate(
    notebookId: string,
    handler: (update: Uint8Array) => void
  ): () => void {
    const wrapped = (msg: any) => {
      if (msg?.spaceId !== this.projectId) return;
      if (String(msg?.docId) !== notebookId) return;
      handler(base64ToUint8Array(String(msg.awarenessUpdate)));
    };
    this.socket.on("space:broadcast-awareness-update", wrapped);
    return () => this.socket.off("space:broadcast-awareness-update", wrapped);
  }

  async broadcastAwareness(notebookId: string, update: Uint8Array): Promise<void> {
    this.socket.emit("space:update-awareness", {
      spaceType: this.spaceType,
      spaceId: this.projectId,
      docId: notebookId,
      docKind: this.docKind,
      awarenessUpdate: await uint8ArrayToBase64(update),
    });
  }

  requestAwarenesses(notebookId: string): void {
    this.socket.emit("space:load-awarenesses", {
      spaceType: this.spaceType,
      spaceId: this.projectId,
      docId: notebookId,
      docKind: this.docKind,
    });
  }
}
