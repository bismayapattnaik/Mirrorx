import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  merchantApi,
  getMerchantApiKey,
  setMerchantApiKey,
  type MerchantStore,
  type StoreAnalytics,
  type StoreStaffMember,
  type GeneratedQRCode,
  type StoreCoupon,
} from '@/lib/api';
import type { StoreZone, StoreProduct, StoreOrder, StorePlanogram } from '@mrrx/shared';

interface MerchantState {
  // Auth
  isAuthenticated: boolean;
  merchant: {
    id: string;
    name: string;
    email: string;
    company_name: string;
  } | null;

  // Stores
  stores: MerchantStore[];
  selectedStoreId: string | null;
  selectedStore: MerchantStore | null;

  // Data
  zones: StoreZone[];
  products: (StoreProduct & { location?: StorePlanogram })[];
  staff: StoreStaffMember[];
  orders: StoreOrder[];
  analytics: StoreAnalytics | null;
  qrCodes: GeneratedQRCode[];
  coupons: StoreCoupon[];

  // Pagination
  productsTotal: number;
  productsPage: number;
  ordersTotal: number;
  ordersPage: number;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  selectStore: (storeId: string) => void;

  // Store CRUD
  createStore: (storeData: Parameters<typeof merchantApi.createStore>[0]) => Promise<MerchantStore | null>;
  updateStore: (storeId: string, updates: Parameters<typeof merchantApi.updateStore>[1]) => Promise<boolean>;

  // Zone CRUD
  fetchZones: () => Promise<void>;
  createZone: (zoneData: Parameters<typeof merchantApi.createZone>[1]) => Promise<StoreZone | null>;
  updateZone: (zoneId: string, updates: Parameters<typeof merchantApi.updateZone>[2]) => Promise<boolean>;
  deleteZone: (zoneId: string) => Promise<boolean>;

  // Product CRUD
  fetchProducts: (params?: Parameters<typeof merchantApi.getProducts>[1]) => Promise<void>;
  createProduct: (productData: Parameters<typeof merchantApi.createProduct>[1]) => Promise<StoreProduct | null>;
  updateProduct: (productId: string, updates: Parameters<typeof merchantApi.updateProduct>[2]) => Promise<boolean>;
  deleteProduct: (productId: string) => Promise<boolean>;
  importProducts: (products: Parameters<typeof merchantApi.importProducts>[1]) => Promise<{ success: boolean; imported_count: number; errors: Array<{ row: number; sku: string; error: string }> }>;

  // Staff CRUD
  fetchStaff: () => Promise<void>;
  addStaff: (staffData: Parameters<typeof merchantApi.addStaff>[1]) => Promise<StoreStaffMember | null>;
  updateStaff: (staffId: string, updates: Parameters<typeof merchantApi.updateStaff>[2]) => Promise<boolean>;
  removeStaff: (staffId: string) => Promise<boolean>;

  // QR Codes
  fetchQRCodes: (qrType?: 'store' | 'zone' | 'product') => Promise<void>;
  generateQRCodes: (options: Parameters<typeof merchantApi.generateQRCodes>[1]) => Promise<GeneratedQRCode[]>;

  // Analytics
  fetchAnalytics: (params?: Parameters<typeof merchantApi.getAnalytics>[1]) => Promise<void>;

  // Orders
  fetchOrders: (params?: Parameters<typeof merchantApi.getOrders>[1]) => Promise<void>;

  // Coupons
  fetchCoupons: () => Promise<void>;
  createCoupon: (couponData: Parameters<typeof merchantApi.createCoupon>[1]) => Promise<StoreCoupon | null>;
  updateCoupon: (couponId: string, updates: Parameters<typeof merchantApi.updateCoupon>[2]) => Promise<boolean>;
  deleteCoupon: (couponId: string) => Promise<boolean>;

  // Error handling
  clearError: () => void;
}

export const useMerchantStore = create<MerchantState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      merchant: null,
      stores: [],
      selectedStoreId: null,
      selectedStore: null,
      zones: [],
      products: [],
      staff: [],
      orders: [],
      analytics: null,
      qrCodes: [],
      coupons: [],
      productsTotal: 0,
      productsPage: 1,
      ordersTotal: 0,
      ordersPage: 1,
      isLoading: false,
      error: null,

      initialize: async () => {
        const apiKey = getMerchantApiKey();
        if (!apiKey) {
          set({ isAuthenticated: false, merchant: null });
          return;
        }

        try {
          set({ isLoading: true });
          const { stores } = await merchantApi.getStores();
          set({
            isAuthenticated: true,
            stores,
            isLoading: false,
          });

          // Auto-select first store if available
          const { selectedStoreId } = get();
          if (!selectedStoreId && stores.length > 0) {
            get().selectStore(stores[0].id);
          }
        } catch {
          // API key invalid, clear it
          setMerchantApiKey(null);
          set({
            isAuthenticated: false,
            merchant: null,
            isLoading: false,
          });
        }
      },

      login: async (email, password) => {
        try {
          set({ isLoading: true, error: null });
          const { merchant, stores } = await merchantApi.login(email, password);
          set({
            isAuthenticated: true,
            merchant,
            stores,
            isLoading: false,
          });

          // Auto-select first store
          if (stores.length > 0) {
            get().selectStore(stores[0].id);
          }
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Login failed',
          });
          return false;
        }
      },

      logout: () => {
        merchantApi.logout();
        set({
          isAuthenticated: false,
          merchant: null,
          stores: [],
          selectedStoreId: null,
          selectedStore: null,
          zones: [],
          products: [],
          staff: [],
          orders: [],
          analytics: null,
          qrCodes: [],
          coupons: [],
        });
      },

      selectStore: (storeId) => {
        const store = get().stores.find(s => s.id === storeId) || null;
        set({
          selectedStoreId: storeId,
          selectedStore: store,
          zones: [],
          products: [],
          staff: [],
          orders: [],
          analytics: null,
          qrCodes: [],
          coupons: [],
        });

        // Fetch store data
        if (store) {
          get().fetchZones();
          get().fetchAnalytics({ period: 'today' });
          get().fetchOrders({ limit: 10 });
        }
      },

      createStore: async (storeData) => {
        try {
          set({ isLoading: true, error: null });
          const { store } = await merchantApi.createStore(storeData);
          set(state => ({
            stores: [...state.stores, store],
            isLoading: false,
          }));
          return store;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to create store',
          });
          return null;
        }
      },

      updateStore: async (storeId, updates) => {
        try {
          set({ isLoading: true, error: null });
          const { store } = await merchantApi.updateStore(storeId, updates);
          set(state => ({
            stores: state.stores.map(s => s.id === storeId ? store : s),
            selectedStore: state.selectedStoreId === storeId ? store : state.selectedStore,
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to update store',
          });
          return false;
        }
      },

      fetchZones: async () => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return;

        try {
          const { zones } = await merchantApi.getZones(selectedStoreId);
          set({ zones });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch zones' });
        }
      },

      createZone: async (zoneData) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return null;

        try {
          set({ isLoading: true, error: null });
          const { zone, qr_code } = await merchantApi.createZone(selectedStoreId, zoneData);
          set(state => ({
            zones: [...state.zones, zone],
            qrCodes: [...state.qrCodes, qr_code],
            isLoading: false,
          }));
          return zone;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to create zone',
          });
          return null;
        }
      },

      updateZone: async (zoneId, updates) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return false;

        try {
          set({ isLoading: true, error: null });
          const { zone } = await merchantApi.updateZone(selectedStoreId, zoneId, updates);
          set(state => ({
            zones: state.zones.map(z => z.id === zoneId ? zone : z),
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to update zone',
          });
          return false;
        }
      },

      deleteZone: async (zoneId) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return false;

        try {
          set({ isLoading: true, error: null });
          await merchantApi.deleteZone(selectedStoreId, zoneId);
          set(state => ({
            zones: state.zones.filter(z => z.id !== zoneId),
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to delete zone',
          });
          return false;
        }
      },

      fetchProducts: async (params) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return;

        try {
          set({ isLoading: true });
          const { products, total, page } = await merchantApi.getProducts(selectedStoreId, params);
          set({
            products,
            productsTotal: total,
            productsPage: page,
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch products',
          });
        }
      },

      createProduct: async (productData) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return null;

        try {
          set({ isLoading: true, error: null });
          const { product } = await merchantApi.createProduct(selectedStoreId, productData);
          set(state => ({
            products: [product, ...state.products],
            productsTotal: state.productsTotal + 1,
            isLoading: false,
          }));
          return product;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to create product',
          });
          return null;
        }
      },

      updateProduct: async (productId, updates) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return false;

        try {
          set({ isLoading: true, error: null });
          const { product } = await merchantApi.updateProduct(selectedStoreId, productId, updates);
          set(state => ({
            products: state.products.map(p => p.id === productId ? { ...p, ...product } : p),
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to update product',
          });
          return false;
        }
      },

      deleteProduct: async (productId) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return false;

        try {
          set({ isLoading: true, error: null });
          await merchantApi.deleteProduct(selectedStoreId, productId);
          set(state => ({
            products: state.products.filter(p => p.id !== productId),
            productsTotal: state.productsTotal - 1,
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to delete product',
          });
          return false;
        }
      },

      importProducts: async (products) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return { success: false, imported_count: 0, errors: [] };

        try {
          set({ isLoading: true, error: null });
          const result = await merchantApi.importProducts(selectedStoreId, products);
          if (result.imported_count > 0) {
            // Refresh products list
            await get().fetchProducts();
          }
          set({ isLoading: false });
          return result;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to import products',
          });
          return { success: false, imported_count: 0, errors: [] };
        }
      },

      fetchStaff: async () => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return;

        try {
          const { staff } = await merchantApi.getStaff(selectedStoreId);
          set({ staff });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch staff' });
        }
      },

      addStaff: async (staffData) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return null;

        try {
          set({ isLoading: true, error: null });
          const { staff: newStaff } = await merchantApi.addStaff(selectedStoreId, staffData);
          set(state => ({
            staff: [...state.staff, newStaff],
            isLoading: false,
          }));
          return newStaff;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to add staff',
          });
          return null;
        }
      },

      updateStaff: async (staffId, updates) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return false;

        try {
          set({ isLoading: true, error: null });
          const { staff: updatedStaff } = await merchantApi.updateStaff(selectedStoreId, staffId, updates);
          set(state => ({
            staff: state.staff.map(s => s.id === staffId ? updatedStaff : s),
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to update staff',
          });
          return false;
        }
      },

      removeStaff: async (staffId) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return false;

        try {
          set({ isLoading: true, error: null });
          await merchantApi.removeStaff(selectedStoreId, staffId);
          set(state => ({
            staff: state.staff.filter(s => s.id !== staffId),
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to remove staff',
          });
          return false;
        }
      },

      fetchQRCodes: async (qrType) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return;

        try {
          const { qr_codes } = await merchantApi.getQRCodes(selectedStoreId, qrType ? { qr_type: qrType } : undefined);
          set({ qrCodes: qr_codes });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch QR codes' });
        }
      },

      generateQRCodes: async (options) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return [];

        try {
          set({ isLoading: true, error: null });
          const { qr_codes } = await merchantApi.generateQRCodes(selectedStoreId, options);
          set(state => ({
            qrCodes: [...state.qrCodes, ...qr_codes],
            isLoading: false,
          }));
          return qr_codes;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to generate QR codes',
          });
          return [];
        }
      },

      fetchAnalytics: async (params) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return;

        try {
          const analytics = await merchantApi.getAnalytics(selectedStoreId, params);
          set({ analytics });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch analytics' });
        }
      },

      fetchOrders: async (params) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return;

        try {
          const { orders, total, page } = await merchantApi.getOrders(selectedStoreId, params);
          set({
            orders,
            ordersTotal: total,
            ordersPage: page,
          });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch orders' });
        }
      },

      fetchCoupons: async () => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return;

        try {
          const { coupons } = await merchantApi.getCoupons(selectedStoreId);
          set({ coupons });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch coupons' });
        }
      },

      createCoupon: async (couponData) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return null;

        try {
          set({ isLoading: true, error: null });
          const { coupon } = await merchantApi.createCoupon(selectedStoreId, couponData);
          set(state => ({
            coupons: [...state.coupons, coupon],
            isLoading: false,
          }));
          return coupon;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to create coupon',
          });
          return null;
        }
      },

      updateCoupon: async (couponId, updates) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return false;

        try {
          set({ isLoading: true, error: null });
          const { coupon } = await merchantApi.updateCoupon(selectedStoreId, couponId, updates);
          set(state => ({
            coupons: state.coupons.map(c => c.id === couponId ? coupon : c),
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to update coupon',
          });
          return false;
        }
      },

      deleteCoupon: async (couponId) => {
        const { selectedStoreId } = get();
        if (!selectedStoreId) return false;

        try {
          set({ isLoading: true, error: null });
          await merchantApi.deleteCoupon(selectedStoreId, couponId);
          set(state => ({
            coupons: state.coupons.filter(c => c.id !== couponId),
            isLoading: false,
          }));
          return true;
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to delete coupon',
          });
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'mirrorx-merchant-storage',
      partialize: (state) => ({
        selectedStoreId: state.selectedStoreId,
      }),
    }
  )
);
