import { create } from 'zustand';
import { api, Conversation, Message } from '@/lib/api';

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  readConversationIds: Set<number>;

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
  ) => Promise<void>;
  markAsRead: (conversationId: number) => void;
  updateConversation: (update: Partial<Conversation> & { id: number; contact?: { id: number; name: string; avatarUrl?: string }; lastMessage?: { content: string; contentType: string; createdAt: string } }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  loading: false,
  readConversationIds: new Set<number>(),

  fetchConversations: async (filters) => {
    set({ loading: true });
    try {
      const conversations = await api.getConversations(filters);
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

  sendMessage: async (conversationId, content, isPrivate = false) => {
    const message = await api.sendMessage(conversationId, {
      content,
      private: isPrivate,
    });
    get().addMessage(message);
  },

  markAsRead: (conversationId) => {
    set((state) => {
      const next = new Set(state.readConversationIds);
      next.add(conversationId);
      return { readConversationIds: next };
    });
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
        };
      });

      // Also update activeConversation if it matches
      let activeConversation = state.activeConversation;
      if (activeConversation?.id === update.id && update.contact) {
        activeConversation = {
          ...activeConversation,
          contact: { ...activeConversation.contact, ...update.contact },
        };
      }

      return { conversations, activeConversation };
    });
  },
}));
