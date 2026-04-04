import { create } from 'zustand';
import { api } from '@/lib/api';

interface AuthState {
  role: string | null;
  userId: number | null;
  loaded: boolean;
  fetchProfile: () => Promise<void>;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  role: null,
  userId: null,
  loaded: false,

  fetchProfile: async () => {
    try {
      const profile = await api.getProfile();
      set({ role: profile.role, userId: profile.id, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  isAdmin: () => get().role === 'admin',
}));
