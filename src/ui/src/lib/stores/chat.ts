/**
 * Chat Store
 *
 * Manages AI chat conversation state including:
 * - Conversation list and metadata
 * - Active conversation selection
 * - Conversation CRUD operations
 * - Persistence across sessions
 *
 * Note: Actual message history is managed by the SSE session system.
 * This store handles conversation metadata only.
 *
 * @module stores/chat
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Generate a UUID v4 compatible string
 * Uses crypto.randomUUID() if available, otherwise falls back to manual generation
 */
function generateUUID(): string {
  // Try native crypto.randomUUID first
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: generate UUID v4 manually
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Conversation metadata
 */
export interface Conversation {
  /** Unique conversation ID */
  id: string;
  /** Associated project ID */
  projectId: string;
  /** Conversation title (auto-generated or user-defined) */
  title: string;
  /** When the conversation was created */
  createdAt: Date;
  /** When the conversation was last updated */
  updatedAt: Date;
}

/**
 * Serialized conversation for persistence
 */
interface SerializedConversation {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat store state interface
 */
export interface ChatState {
  /** All conversations */
  conversations: Conversation[];
  /** Currently active conversation ID */
  activeConversationId: string | null;
}

/**
 * Chat store actions interface
 */
export interface ChatActions {
  /**
   * Create a new conversation for a project
   * @param projectId - The project to create the conversation for
   * @returns The new conversation ID
   */
  createConversation: (projectId: string) => string;

  /**
   * Set the active conversation
   * @param id - Conversation ID to activate
   */
  setActiveConversation: (id: string | null) => void;

  /**
   * Update a conversation's title
   * @param id - Conversation ID
   * @param title - New title
   */
  updateConversationTitle: (id: string, title: string) => void;

  /**
   * Delete a conversation
   * @param id - Conversation ID to delete
   */
  deleteConversation: (id: string) => void;

  /**
   * Clear all conversations for a project
   * @param projectId - Project ID to clear history for
   */
  clearHistory: (projectId: string) => void;

  /**
   * Get conversations for a specific project
   * @param projectId - Project ID
   * @returns Conversations for the project, sorted by updatedAt
   */
  getConversationsForProject: (projectId: string) => Conversation[];

  /**
   * Get the active conversation
   * @returns The active conversation or undefined
   */
  getActiveConversation: () => Conversation | undefined;

  /**
   * Get or create a conversation for a project
   * @param projectId - Project ID
   * @returns Existing active conversation or a new one
   */
  ensureConversation: (projectId: string) => string;
}

/**
 * Chat store with persistence
 */
export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      activeConversationId: null,

      // Create a new conversation
      createConversation: (projectId: string): string => {
        const id = generateUUID();
        const now = new Date();
        const conversation: Conversation = {
          id,
          projectId,
          title: "New Conversation",
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          conversations: [...state.conversations, conversation],
          activeConversationId: id,
        }));

        return id;
      },

      // Set active conversation
      setActiveConversation: (id: string | null) => {
        set({ activeConversationId: id });
      },

      // Update conversation title
      updateConversationTitle: (id: string, title: string) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id
              ? { ...conv, title, updatedAt: new Date() }
              : conv
          ),
        }));
      },

      // Delete conversation
      deleteConversation: (id: string) => {
        set((state) => {
          const newConversations = state.conversations.filter(
            (conv) => conv.id !== id
          );

          // If deleting active conversation, clear it
          let newActiveId = state.activeConversationId;
          if (state.activeConversationId === id) {
            // Try to select another conversation from the same project
            const deletedConv = state.conversations.find((c) => c.id === id);
            if (deletedConv) {
              const projectConvs = newConversations.filter(
                (c) => c.projectId === deletedConv.projectId
              );
              newActiveId = projectConvs.length > 0 ? projectConvs[0].id : null;
            } else {
              newActiveId = null;
            }
          }

          return {
            conversations: newConversations,
            activeConversationId: newActiveId,
          };
        });
      },

      // Clear all conversations for a project
      clearHistory: (projectId: string) => {
        set((state) => {
          const filtered = state.conversations.filter(
            (conv) => conv.projectId !== projectId
          );

          // Clear active if it was in this project
          const activeConv = state.conversations.find(
            (c) => c.id === state.activeConversationId
          );
          const newActiveId =
            activeConv?.projectId === projectId
              ? null
              : state.activeConversationId;

          return {
            conversations: filtered,
            activeConversationId: newActiveId,
          };
        });
      },

      // Get conversations for a project
      getConversationsForProject: (projectId: string): Conversation[] => {
        return get()
          .conversations.filter((conv) => conv.projectId === projectId)
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      },

      // Get active conversation
      getActiveConversation: (): Conversation | undefined => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId);
      },

      // Get or create conversation for project
      ensureConversation: (projectId: string): string => {
        const state = get();
        const activeConv = state.getActiveConversation();

        // If active conversation is for this project, return it
        if (activeConv && activeConv.projectId === projectId) {
          return activeConv.id;
        }

        // Look for existing conversations in this project
        const projectConvs = state.getConversationsForProject(projectId);
        if (projectConvs.length > 0) {
          // Activate the most recent one
          const mostRecent = projectConvs[0];
          set({ activeConversationId: mostRecent.id });
          return mostRecent.id;
        }

        // Create a new conversation
        return state.createConversation(projectId);
      },
    }),
    {
      name: "ds-chat-store",

      // Custom serialization for Date objects
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;

          const parsed = JSON.parse(str);
          if (parsed.state?.conversations) {
            parsed.state.conversations = parsed.state.conversations.map(
              (conv: SerializedConversation) => ({
                ...conv,
                createdAt: new Date(conv.createdAt),
                updatedAt: new Date(conv.updatedAt),
              })
            );
          }
          return parsed;
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: {
              ...value.state,
              conversations: value.state.conversations.map(
                (conv: Conversation) => ({
                  ...conv,
                  createdAt: conv.createdAt.toISOString(),
                  updatedAt: conv.updatedAt.toISOString(),
                })
              ),
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },

      // Only persist conversations and active ID
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }) as ChatState & ChatActions,
    }
  )
);

/**
 * Selector hooks for specific state slices
 */
export const useConversations = () =>
  useChatStore((state) => state.conversations);

export const useActiveConversation = () =>
  useChatStore((state) =>
    state.conversations.find((c) => c.id === state.activeConversationId)
  );

export const useProjectConversations = (projectId: string) =>
  useChatStore((state) =>
    state.conversations
      .filter((c) => c.projectId === projectId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
  );

export const useChatActions = () =>
  useChatStore((state) => ({
    createConversation: state.createConversation,
    setActiveConversation: state.setActiveConversation,
    updateConversationTitle: state.updateConversationTitle,
    deleteConversation: state.deleteConversation,
    clearHistory: state.clearHistory,
    ensureConversation: state.ensureConversation,
  }));
