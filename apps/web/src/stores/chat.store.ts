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
    set({ activeConversation: conv, messages: [] });
    if (conv) {
      get().fetchMessages(conv.id);
      get().markAsRead(conv.id);
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
    get().addMessage(message);
    // Re-fetch all messages to ensure outgoing message persists in state
    await get().fetchMessages(conversationId);
    // Mark as read with incremented count (backend increments messagesCount)
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (conv) {
      saveReadCount(conversationId, conv.messagesCount + 1);
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
