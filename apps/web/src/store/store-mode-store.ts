import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Store,
  StoreZone,
  StoreProduct,
  StoreSession,
  StoreCart,
  StoreOrder,
  PickupPass,
  StorePlanogram,
} from '@mrrx/shared';

interface StoreTryOnResult {
  jobId: string;
  productId: string;
  resultImageUrl: string;
  product: StoreProduct;
  location?: StorePlanogram;
}

interface StoreModeState {
  // Session
  sessionToken: string | null;
  session: StoreSession | null;
  store: Store | null;
  zones: StoreZone[] | null;
  hasSelfie: boolean;

  // Browsing
  currentZone: StoreZone | null;
  products: (StoreProduct & { location: StorePlanogram | null })[];
  selectedProduct: (StoreProduct & { location: StorePlanogram | null; zone: StoreZone | null }) | null;
  searchQuery: string;
  filters: {
    category?: string;
    gender?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
  };

  // Try-On
  tryOnResults: StoreTryOnResult[];
  currentTryOn: StoreTryOnResult | null;
  isTryingOn: boolean;

  // Cart
  cart: StoreCart | null;

  // Order
  currentOrder: StoreOrder | null;
  pickupPass: PickupPass | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  setSession: (token: string, session: StoreSession, store: Store, zones: StoreZone[]) => void;
  updateSession: (session: Partial<StoreSession>) => void;
  setSelfieStatus: (hasSelfie: boolean) => void;
  setCurrentZone: (zone: StoreZone | null) => void;
  setProducts: (products: (StoreProduct & { location: StorePlanogram | null })[]) => void;
  setSelectedProduct: (product: (StoreProduct & { location: StorePlanogram | null; zone: StoreZone | null }) | null) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: StoreModeState['filters']) => void;
  addTryOnResult: (result: StoreTryOnResult) => void;
  setCurrentTryOn: (result: StoreTryOnResult | null) => void;
  setIsTryingOn: (isTryingOn: boolean) => void;
  setCart: (cart: StoreCart | null) => void;
  setCurrentOrder: (order: StoreOrder | null) => void;
  setPickupPass: (pass: PickupPass | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSession: () => void;
  reset: () => void;
}

const initialState = {
  sessionToken: null,
  session: null,
  store: null,
  zones: null,
  hasSelfie: false,
  currentZone: null,
  products: [],
  selectedProduct: null,
  searchQuery: '',
  filters: {},
  tryOnResults: [],
  currentTryOn: null,
  isTryingOn: false,
  cart: null,
  currentOrder: null,
  pickupPass: null,
  isLoading: false,
  error: null,
};

export const useStoreModeStore = create<StoreModeState>()(
  persist(
    (set) => ({
      ...initialState,

      setSession: (token, session, store, zones) =>
        set({
          sessionToken: token,
          session,
          store,
          zones,
          error: null,
        }),

      updateSession: (sessionUpdates) =>
        set((state) => ({
          session: state.session ? { ...state.session, ...sessionUpdates } : null,
        })),

      setSelfieStatus: (hasSelfie) => set({ hasSelfie }),

      setCurrentZone: (zone) => set({ currentZone: zone }),

      setProducts: (products) => set({ products }),

      setSelectedProduct: (product) => set({ selectedProduct: product }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setFilters: (filters) => set({ filters }),

      addTryOnResult: (result) =>
        set((state) => ({
          tryOnResults: [result, ...state.tryOnResults].slice(0, 20), // Keep last 20
          currentTryOn: result,
        })),

      setCurrentTryOn: (result) => set({ currentTryOn: result }),

      setIsTryingOn: (isTryingOn) => set({ isTryingOn }),

      setCart: (cart) => set({ cart }),

      setCurrentOrder: (order) => set({ currentOrder: order }),

      setPickupPass: (pass) => set({ pickupPass: pass }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      clearSession: () =>
        set({
          ...initialState,
        }),

      reset: () => set(initialState),
    }),
    {
      name: 'mirrorx-store-mode',
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        hasSelfie: state.hasSelfie,
        // Don't persist full session data, just the token
      }),
    }
  )
);
