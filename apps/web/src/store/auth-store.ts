import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, SubscriptionTier } from '@mirrorx/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateCredits: (amount: number) => void;
  updateSubscription: (tier: SubscriptionTier) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setToken: (token) => set({ token }),

      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      updateCredits: (amount) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              credits_balance: user.credits_balance + amount,
            },
          });
        }
      },

      updateSubscription: (tier) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              subscription_tier: tier,
            },
          });
        }
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'mirrorx-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);
