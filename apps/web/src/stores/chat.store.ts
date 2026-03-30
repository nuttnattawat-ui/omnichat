import { create } from 'zustand';
import { api, Conversation, Message } from '@/lib/api';

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
  ) => Promise<void>;
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
      set({ conversations });
    } finally {
      set({ loading: false });
    }
  },

  setActiveConversation: (conv) => {
    set({ activeConversation: conv, messages: [] });
    if (conv) get().fetchMessages(conv.id);
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
}));
