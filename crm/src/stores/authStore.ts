import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('crm_token', token);
        }
        set({ user, token });
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('crm_token');
        }
        set({ user: null, token: null });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'crm-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
