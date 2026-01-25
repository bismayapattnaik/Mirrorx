import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { User, SubscriptionTier } from '@mrrx/shared';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  login: (user: User, session: Session) => void;
  logout: () => Promise<void>;
  updateCredits: (amount: number) => void;
  updateSubscription: (tier: SubscriptionTier) => void;
  setLoading: (isLoading: boolean) => void;
  initializeAuth: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ user: User; session: Session }>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<{ user: User; session: Session }>;
}

// Helper to convert Supabase user to our User type
const mapSupabaseUser = (supabaseUser: SupabaseUser, additionalData?: any): User => ({
  id: supabaseUser.id,
  email: supabaseUser.email || '',
  name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || additionalData?.name || null,
  phone: supabaseUser.phone || null,
  avatar_url: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null,
  google_id: supabaseUser.app_metadata?.provider === 'google' ? supabaseUser.id : null,
  credits_balance: additionalData?.credits_balance || 0,
  subscription_tier: additionalData?.subscription_tier || 'FREE',
  created_at: new Date(supabaseUser.created_at),
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      supabaseUser: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setSession: (session) => set({ session }),

      login: (user, session) =>
        set({
          user,
          session,
          supabaseUser: session.user,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: async () => {
        await supabase.auth.signOut();
        set({
          user: null,
          supabaseUser: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

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

      initializeAuth: async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.error('Auth initialization error:', error);
            set({ isLoading: false });
            return;
          }

          if (session?.user) {
            // Fetch user data from our backend
            try {
              const response = await fetch(`${import.meta.env.VITE_API_URL}/me`, {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                },
              });

              if (response.ok) {
                const userData = await response.json();
                const user = mapSupabaseUser(session.user, userData);
                set({
                  user,
                  session,
                  supabaseUser: session.user,
                  isAuthenticated: true,
                  isLoading: false,
                });
              } else {
                // User exists in Supabase but not in our DB - create them
                const user = mapSupabaseUser(session.user);
                set({
                  user,
                  session,
                  supabaseUser: session.user,
                  isAuthenticated: true,
                  isLoading: false,
                });
              }
            } catch {
              const user = mapSupabaseUser(session.user);
              set({
                user,
                session,
                supabaseUser: session.user,
                isAuthenticated: true,
                isLoading: false,
              });
            }
          } else {
            set({ isLoading: false });
          }

          // Listen for auth changes
          supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (event === 'SIGNED_IN' && newSession?.user) {
              const user = mapSupabaseUser(newSession.user);
              set({
                user,
                session: newSession,
                supabaseUser: newSession.user,
                isAuthenticated: true,
                isLoading: false,
              });
            } else if (event === 'SIGNED_OUT') {
              set({
                user: null,
                supabaseUser: null,
                session: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          });
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ isLoading: false });
        }
      },

      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/app/tryon`,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) {
          throw error;
        }
      },

      signInWithEmail: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        if (!data.session || !data.user) {
          throw new Error('Login failed');
        }

        const user = mapSupabaseUser(data.user);
        set({
          user,
          session: data.session,
          supabaseUser: data.user,
          isAuthenticated: true,
          isLoading: false,
        });

        return { user, session: data.session };
      },

      signUpWithEmail: async (email: string, password: string, name?: string) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (!data.session || !data.user) {
          // Email confirmation required
          throw new Error('Please check your email to confirm your account');
        }

        const user = mapSupabaseUser(data.user, { name });
        set({
          user,
          session: data.session,
          supabaseUser: data.user,
          isAuthenticated: true,
          isLoading: false,
        });

        return { user, session: data.session };
      },
    }),
    {
      name: 'mirrorx-auth',
      partialize: (state) => ({
        session: state.session,
        user: state.user,
      }),
    }
  )
);
