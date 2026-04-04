import { create } from 'zustand';
import { api, Conversation, Message } from '@/lib/api';

// Persist read message counts in localStorage
const STORAGE_KEY = 'omnichat_read_counts';

function getReadCounts(): Record<number, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveReadCount(conversationId: number, count: number) {
  if (typeof window === 'undefined') return;
  const counts = getReadCounts();
  counts[conversationId] = count;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
}

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  loading: boolean;

  fetchConversations: (filters?: {
    status?: string;
    inboxId?: number;
  }) => Promise<void>;
  setActiveConversation: (conv: Conversation | null) => void;
  fetchMessages: (conversationId: number) => Promise<void>;
  addMessage: (message: Message) => void;
  sendMessage: (
    conversationId: number,
    content: string,
    isPrivate?: boolean,
    options?: { contentType?: string; contentAttributes?: Record<string, unknown> },
  ) => Promise<void>;
  markAsRead: (conversationId: number) => void;
  getUnreadCount: (conversationId: number, totalMessages: number) => number;
  updateConversation: (update: Partial<Conversation> & { id: number; contact?: { id: number; name: string; avatarUrl?: string }; lastMessage?: { content: string; contentType: string; createdAt: string } }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  loading: false,

  fetchConversations: async (filters) => {
    set({ loading: true });
    try {
      const conversations = await api.getConversations(filters);
      conversations.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
      set({ conversations });
    } finally {
      set({ loading: false });
    }
  },

  setActiveConversation: (conv) => {
    // Don't clear messages immediately — let fetchMessages replace them
    // This prevents the flash of empty content when switching conversations
    set({ activeConversation: conv });
    if (conv) {
      get().fetchMessages(conv.id);
      get().markAsRead(conv.id);
    } else {
      set({ messages: [] });
    }
  },

  fetchMessages: async (conversationId) => {
    const messages = await api.getMessages(conversationId);
    set({ messages });
  },

  addMessage: (message) => {
    set((state) => {
      // Dedup
      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message] };
    });
  },

  sendMessage: async (conversationId, content, isPrivate = false, options) => {
    const message = await api.sendMessage(conversationId, {
      content,
      private: isPrivate,
      contentType: options?.contentType,
      contentAttributes: options?.contentAttributes,
    });
    // Add message to current list
    get().addMessage(message);
    // Update sidebar preview locally (no server round-trip)
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          lastActivityAt: new Date().toISOString(),
          messagesCount: (c.messagesCount || 0) + 1,
          messages: [{ content, contentType: options?.contentType || 'text', createdAt: new Date().toISOString() } as Message],
        };
      });
      conversations.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
      return { conversations };
    });
    // Mark as read with incremented count
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (conv) {
      saveReadCount(conversationId, conv.messagesCount);
    }
  },

  markAsRead: (conversationId) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (conv) {
      saveReadCount(conversationId, conv.messagesCount);
    }
  },

  getUnreadCount: (conversationId, totalMessages) => {
    const readCounts = getReadCounts();
    const lastRead = readCounts[conversationId] || 0;
    return Math.max(0, totalMessages - lastRead);
  },

  updateConversation: (update) => {
    const state = get();
    const exists = state.conversations.some((c) => c.id === update.id);

    // If conversation not in list yet (new contact), re-fetch all
    if (!exists) {
      get().fetchConversations();
      return;
    }

    set((state) => {
      const conversations = state.conversations.map((conv) => {
        if (conv.id !== update.id) return conv;
        return {
          ...conv,
          ...(update.contact && { contact: { ...conv.contact, ...update.contact } }),
          ...(update.lastActivityAt && { lastActivityAt: String(update.lastActivityAt) }),
          ...(update.messagesCount != null && { messagesCount: update.messagesCount }),
          ...(update.lastMessage && {
            messages: [{ content: update.lastMessage.content, contentType: update.lastMessage.contentType, createdAt: update.lastMessage.createdAt } as Message],
          }),
          ...((update as any).customAttributes && {
            customAttributes: { ...(conv.customAttributes as Record<string, unknown> || {}), ...(update as any).customAttributes },
          }),
        };
      });

      // Also update activeConversation if it matches
      let activeConversation = state.activeConversation;
      if (activeConversation?.id === update.id) {
        activeConversation = {
          ...activeConversation,
          ...(update.contact && { contact: { ...activeConversation.contact, ...update.contact } }),
          ...(update.messagesCount != null && { messagesCount: update.messagesCount }),
          ...((update as any).customAttributes && {
            customAttributes: { ...(activeConversation.customAttributes as Record<string, unknown> || {}), ...(update as any).customAttributes },
          }),
        };
        // Auto-mark as read if user is viewing this conversation
        if (update.messagesCount != null) {
          saveReadCount(update.id, update.messagesCount);
        }
      }

      conversations.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
      return { conversations, activeConversation };
    });
  },
}));
