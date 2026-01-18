import { create } from 'zustand';
import type { WardrobeItem, TryOnResponse, TryOnMode } from '@mrrx/shared';

interface TryOnState {
  selfieImage: string | null;
  productImage: string | null;
  productUrl: string | null;
  mode: TryOnMode;
  currentJob: TryOnResponse | null;
  resultImage: string | null;
}

interface AppState {
  // Try-on state
  tryOn: TryOnState;
  setTryOnSelfie: (image: string | null) => void;
  setTryOnProduct: (image: string | null) => void;
  setTryOnProductUrl: (url: string | null) => void;
  setTryOnMode: (mode: TryOnMode) => void;
  setTryOnJob: (job: TryOnResponse | null) => void;
  setTryOnResult: (image: string | null) => void;
  resetTryOn: () => void;

  // Wardrobe state
  wardrobeItems: WardrobeItem[];
  setWardrobeItems: (items: WardrobeItem[]) => void;
  addWardrobeItem: (item: WardrobeItem) => void;
  removeWardrobeItem: (id: string) => void;

  // UI state
  isSidebarOpen: boolean;
  toggleSidebar: () => void;

  // Credits info
  dailyFreeRemaining: number;
  setDailyFreeRemaining: (count: number) => void;
}

const initialTryOnState: TryOnState = {
  selfieImage: null,
  productImage: null,
  productUrl: null,
  mode: 'PART',
  currentJob: null,
  resultImage: null,
};

export const useAppStore = create<AppState>((set) => ({
  // Try-on state
  tryOn: initialTryOnState,

  setTryOnSelfie: (image) =>
    set((state) => ({
      tryOn: { ...state.tryOn, selfieImage: image },
    })),

  setTryOnProduct: (image) =>
    set((state) => ({
      tryOn: { ...state.tryOn, productImage: image },
    })),

  setTryOnProductUrl: (url) =>
    set((state) => ({
      tryOn: { ...state.tryOn, productUrl: url },
    })),

  setTryOnMode: (mode) =>
    set((state) => ({
      tryOn: { ...state.tryOn, mode },
    })),

  setTryOnJob: (job) =>
    set((state) => ({
      tryOn: { ...state.tryOn, currentJob: job },
    })),

  setTryOnResult: (image) =>
    set((state) => ({
      tryOn: { ...state.tryOn, resultImage: image },
    })),

  resetTryOn: () => set({ tryOn: initialTryOnState }),

  // Wardrobe state
  wardrobeItems: [],

  setWardrobeItems: (items) => set({ wardrobeItems: items }),

  addWardrobeItem: (item) =>
    set((state) => ({
      wardrobeItems: [item, ...state.wardrobeItems],
    })),

  removeWardrobeItem: (id) =>
    set((state) => ({
      wardrobeItems: state.wardrobeItems.filter((item) => item.id !== id),
    })),

  // UI state
  isSidebarOpen: false,
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  // Credits
  dailyFreeRemaining: 5,
  setDailyFreeRemaining: (count) => set({ dailyFreeRemaining: count }),
}));
