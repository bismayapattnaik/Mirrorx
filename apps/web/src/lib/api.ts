import { useAuthStore } from '@/store/auth-store';
import type {
  AuthResponse,
  User,
  TryOnResponse,
  ProductExtractResponse,
  CreateOrderResponse,
  CreditsBalanceResponse,
  WardrobeListResponse,
  WardrobeItem,
  CreditLedgerEntry,
} from '@mrrx/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Use Supabase session access token
  const session = useAuthStore.getState().session;
  const token = session?.access_token;

  const headers: HeadersInit = {
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));

    if (response.status === 401) {
      useAuthStore.getState().logout();
    }

    throw new ApiError(response.status, error.message || 'Request failed', error.details);
  }

  return response.json();
}

// Auth API
export const authApi = {
  signup: async (email: string, password: string, name?: string): Promise<AuthResponse> => {
    return fetchWithAuth('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    return fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  googleAuth: async (credential: string): Promise<AuthResponse> => {
    return fetchWithAuth('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  },

  me: async (): Promise<User> => {
    return fetchWithAuth('/me');
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    return fetchWithAuth('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteAccount: async (): Promise<void> => {
    return fetchWithAuth('/me', { method: 'DELETE' });
  },
};

// Try-on API
export const tryOnApi = {
  create: async (
    selfieImage: File,
    productImage: File | null,
    mode: 'PART' | 'FULL_FIT',
    gender: 'male' | 'female' = 'female',
    productUrl?: string
  ): Promise<TryOnResponse> => {
    const formData = new FormData();
    formData.append('selfie_image', selfieImage);
    if (productImage) {
      formData.append('product_image', productImage);
    }
    formData.append('mode', mode);
    formData.append('gender', gender);
    if (productUrl) {
      formData.append('product_url', productUrl);
    }

    return fetchWithAuth('/tryon', {
      method: 'POST',
      body: formData,
    });
  },

  getStatus: async (jobId: string): Promise<TryOnResponse> => {
    return fetchWithAuth(`/tryon/${jobId}`);
  },

  submitFeedback: async (
    jobId: string,
    satisfaction: boolean,
    feedbackNotes?: string,
    issues?: string[]
  ): Promise<{ success: boolean; message: string }> => {
    return fetchWithAuth(`/tryon/${jobId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({
        satisfaction,
        feedback_notes: feedbackNotes,
        issues,
      }),
    });
  },

  getFeedbackStats: async (): Promise<{
    total_feedback: number;
    satisfied_count: number;
    unsatisfied_count: number;
    improvement_message: string;
  }> => {
    return fetchWithAuth('/tryon/feedback/stats');
  },

  listRecent: async (limit = 50): Promise<{
    jobs: Array<{
      id: string;
      user_id: string;
      mode: string;
      result_image_url: string | null;
      product_image_url: string | null;
      status: string;
      created_at: string;
    }>;
    total: number;
  }> => {
    return fetchWithAuth(`/tryon/list/recent?limit=${limit}`);
  },

  getSavedSelfie: async (): Promise<{
    has_selfie: boolean;
    selfie_base64?: string;
  }> => {
    return fetchWithAuth('/tryon/selfie/saved');
  },

  quickTryOn: async (
    productImageBase64: string,
    mode: 'PART' | 'FULL_FIT' = 'PART',
    gender: 'male' | 'female' = 'female'
  ): Promise<TryOnResponse> => {
    return fetchWithAuth('/tryon/quick', {
      method: 'POST',
      body: JSON.stringify({
        product_image_base64: productImageBase64,
        mode,
        gender,
      }),
    });
  },

  quickTryOnFromUrl: async (
    productUrl: string,
    mode: 'PART' | 'FULL_FIT' = 'PART',
    gender: 'male' | 'female' = 'female'
  ): Promise<TryOnResponse> => {
    return fetchWithAuth('/tryon/quick', {
      method: 'POST',
      body: JSON.stringify({
        product_url: productUrl,
        mode,
        gender,
      }),
    });
  },
};

// Product API
export const productApi = {
  extract: async (url: string): Promise<ProductExtractResponse> => {
    return fetchWithAuth('/products/extract', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },
};

// Credits API
export const creditsApi = {
  getBalance: async (): Promise<CreditsBalanceResponse> => {
    return fetchWithAuth('/credits/balance');
  },

  getHistory: async (): Promise<CreditLedgerEntry[]> => {
    return fetchWithAuth('/credits/history');
  },
};

// Payments API
export const paymentsApi = {
  createOrder: async (
    kind: 'CREDITS_PACK' | 'SUBSCRIPTION',
    sku: string
  ): Promise<CreateOrderResponse> => {
    return fetchWithAuth('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ kind, sku }),
    });
  },

  verify: async (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ): Promise<{ success: boolean; credits_balance?: number }> => {
    return fetchWithAuth('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      }),
    });
  },
};

// Wardrobe API
export const wardrobeApi = {
  list: async (params?: {
    search?: string;
    category?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<WardrobeListResponse> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return fetchWithAuth(`/wardrobe${query ? `?${query}` : ''}`);
  },

  save: async (
    tryon_job_id: string,
    metadata?: {
      brand?: string;
      category?: string;
      tags?: string[];
      product_url?: string;
    }
  ): Promise<WardrobeItem> => {
    return fetchWithAuth('/wardrobe/save', {
      method: 'POST',
      body: JSON.stringify({ tryon_job_id, ...metadata }),
    });
  },

  delete: async (id: string): Promise<void> => {
    return fetchWithAuth(`/wardrobe/${id}`, { method: 'DELETE' });
  },
};

// Feed API - Social Try-On Sharing
export interface FeedPost {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  tryon_image_url: string;
  product_url: string | null;
  product_title: string | null;
  caption: string | null;
  is_poll: boolean;
  poll_options: string[] | null;
  votes: Record<string, number>;
  total_votes: number;
  comments_count: number;
  created_at: string;
  has_voted: boolean;
  user_vote: string | null;
}

export interface FeedComment {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  created_at: string;
}

export const feedApi = {
  // Get feed posts
  getFeed: async (params?: {
    page?: number;
    limit?: number;
    filter?: 'all' | 'friends' | 'trending' | 'polls';
  }): Promise<{
    posts: FeedPost[];
    total: number;
    page: number;
    has_more: boolean;
  }> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.filter) searchParams.append('filter', params.filter);
    const query = searchParams.toString();
    return fetchWithAuth(`/feed${query ? `?${query}` : ''}`);
  },

  // Create a new post
  createPost: async (data: {
    tryon_job_id: string;
    caption?: string;
    is_poll?: boolean;
    poll_question?: string;
    poll_options?: string[];
    visibility?: 'public' | 'friends' | 'private';
  }): Promise<{ success: boolean; post: FeedPost }> => {
    return fetchWithAuth('/feed', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Vote on a poll
  vote: async (postId: string, option: string): Promise<{ success: boolean; votes: Record<string, number> }> => {
    return fetchWithAuth(`/feed/${postId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ option }),
    });
  },

  // Get comments
  getComments: async (postId: string): Promise<{ comments: FeedComment[] }> => {
    return fetchWithAuth(`/feed/${postId}/comments`);
  },

  // Add comment
  addComment: async (postId: string, content: string): Promise<{ success: boolean; comment: FeedComment }> => {
    return fetchWithAuth(`/feed/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  // Delete post
  deletePost: async (postId: string): Promise<{ success: boolean }> => {
    return fetchWithAuth(`/feed/${postId}`, { method: 'DELETE' });
  },

  // Get trending posts
  getTrending: async (): Promise<{ posts: FeedPost[] }> => {
    return fetchWithAuth('/feed/trending');
  },
};

// Health check
export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  },
};

// ==========================================
// Store Mode API (B2B Offline Retail)
// ==========================================

import type {
  Store,
  StoreZone,
  StoreProduct,
  StoreSession,
  StoreCart,
  StoreOrder,
  PickupPass,
  StorePlanogram,
  TryOnJobStatus,
} from '@mrrx/shared';

// Store session token management
let storeSessionToken: string | null = null;

export function setStoreSessionToken(token: string | null) {
  storeSessionToken = token;
  if (token) {
    localStorage.setItem('mirrorx_store_session', token);
  } else {
    localStorage.removeItem('mirrorx_store_session');
  }
}

export function getStoreSessionToken(): string | null {
  if (!storeSessionToken) {
    storeSessionToken = localStorage.getItem('mirrorx_store_session');
  }
  return storeSessionToken;
}

async function fetchWithStoreSession<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoreSessionToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['X-Store-Session'] = token;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || 'Request failed', error.details);
  }

  return response.json();
}

export const storeApi = {
  // Session Management
  createSession: async (
    qrCodeId: string,
    deviceInfo?: Record<string, unknown>
  ): Promise<{
    session_token: string;
    store: Store;
    zones: StoreZone[];
    initial_zone?: StoreZone;
    initial_product?: StoreProduct;
    settings: Store['settings'];
  }> => {
    const response = await fetch(`${API_BASE}/store/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_code_id: qrCodeId, device_info: deviceInfo }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to start session' }));
      throw new ApiError(response.status, error.message);
    }

    const data = await response.json();
    setStoreSessionToken(data.session_token);
    return data;
  },

  getSession: async (): Promise<{
    session: StoreSession;
    store: Store;
    cart: StoreCart | null;
    has_selfie: boolean;
  }> => {
    return fetchWithStoreSession('/store/session');
  },

  uploadSelfie: async (selfieBase64: string, consentGiven?: boolean): Promise<{ success: boolean; message: string }> => {
    return fetchWithStoreSession('/store/session/selfie', {
      method: 'POST',
      body: JSON.stringify({ selfie_image: selfieBase64, consent_given: consentGiven }),
    });
  },

  // Store Browsing
  getZones: async (storeId: string): Promise<{ zones: StoreZone[] }> => {
    return fetchWithStoreSession(`/store/${storeId}/zones`);
  },

  getProducts: async (
    storeId: string,
    params?: {
      zone_id?: string;
      category?: string;
      gender?: string;
      brand?: string;
      min_price?: number;
      max_price?: number;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    products: (StoreProduct & { location: StorePlanogram | null })[];
    total: number;
    page: number;
    limit: number;
  }> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return fetchWithStoreSession(`/store/${storeId}/products${query ? `?${query}` : ''}`);
  },

  getProduct: async (
    productId: string
  ): Promise<{
    product: StoreProduct & { location: StorePlanogram | null; zone: StoreZone | null };
  }> => {
    return fetchWithStoreSession(`/store/product/${productId}`);
  },

  // Try-On
  createTryOn: async (
    productId: string,
    mode: 'PART' | 'FULL_FIT' = 'PART'
  ): Promise<{
    job_id: string;
    status: TryOnJobStatus;
    result_image_url?: string;
    product: StoreProduct;
    location?: StorePlanogram;
  }> => {
    return fetchWithStoreSession('/store/tryon', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, mode }),
    });
  },

  getTryOnResult: async (
    jobId: string
  ): Promise<{
    id: string;
    status: TryOnJobStatus;
    result_image_url: string | null;
    error_message: string | null;
    product: StoreProduct;
    location: StorePlanogram | null;
  }> => {
    return fetchWithStoreSession(`/store/tryon/${jobId}`);
  },

  // Cart Management
  addToCart: async (
    productId: string,
    options?: {
      quantity?: number;
      size?: string;
      color?: string;
      tryon_job_id?: string;
    }
  ): Promise<{ success: boolean; cart: StoreCart }> => {
    return fetchWithStoreSession('/store/cart/add', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, ...options }),
    });
  },

  getCart: async (): Promise<{ cart: StoreCart | null }> => {
    return fetchWithStoreSession('/store/cart');
  },

  updateCartItem: async (
    itemId: string,
    updates: { quantity?: number; size?: string; color?: string }
  ): Promise<{ cart: StoreCart }> => {
    return fetchWithStoreSession(`/store/cart/item/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  removeFromCart: async (itemId: string): Promise<{ cart: StoreCart }> => {
    return fetchWithStoreSession(`/store/cart/item/${itemId}`, {
      method: 'DELETE',
    });
  },

  applyCoupon: async (
    couponCode: string
  ): Promise<{ success: boolean; discount_applied: number; cart: StoreCart }> => {
    return fetchWithStoreSession('/store/cart/coupon', {
      method: 'POST',
      body: JSON.stringify({ coupon_code: couponCode }),
    });
  },

  // Checkout
  createCheckout: async (
    customerInfo?: {
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      notes?: string;
    }
  ): Promise<{
    order_id: string;
    order_number: string;
    razorpay_order_id: string;
    amount: number;
    currency: string;
    key_id: string;
  }> => {
    return fetchWithStoreSession('/store/checkout', {
      method: 'POST',
      body: JSON.stringify(customerInfo || {}),
    });
  },

  verifyPayment: async (
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<{
    success: boolean;
    order: StoreOrder;
    pickup_pass: PickupPass;
    store: Store;
  }> => {
    return fetchWithStoreSession('/store/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
      }),
    });
  },

  // Pickup Pass
  getPickupPass: async (
    passCode: string
  ): Promise<{
    pickup_pass: PickupPass;
    order: StoreOrder;
    store: Store;
  }> => {
    const response = await fetch(`${API_BASE}/store/pickup/${passCode}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Invalid pickup pass' }));
      throw new ApiError(response.status, error.message);
    }
    return response.json();
  },

  // End session
  endSession: () => {
    setStoreSessionToken(null);
  },
};

// Store Staff API
export const storeStaffApi = {
  login: async (
    storeId: string,
    email: string,
    pin: string
  ): Promise<{
    staff: {
      id: string;
      name: string;
      email: string;
      role: string;
      store_id: string;
    };
    token: string;
  }> => {
    const response = await fetch(`${API_BASE}/store/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: storeId, email, pin }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new ApiError(response.status, error.message);
    }

    return response.json();
  },

  getOrders: async (
    staffToken: string,
    status?: string
  ): Promise<{ orders: StoreOrder[] }> => {
    const params = status ? `?status=${status}` : '';
    const response = await fetch(`${API_BASE}/store/staff/orders${params}`, {
      headers: { 'X-Staff-Token': staffToken },
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to get orders');
    }

    return response.json();
  },

  scanPickupPass: async (
    staffToken: string,
    passCode: string
  ): Promise<{
    order: StoreOrder;
    items_with_locations: Array<{
      item: StoreOrder['items'][0];
      location: StorePlanogram | null;
    }>;
    pass: PickupPass;
  }> => {
    const response = await fetch(`${API_BASE}/store/staff/scan-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Staff-Token': staffToken,
      },
      body: JSON.stringify({ pass_code: passCode }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Invalid pass' }));
      throw new ApiError(response.status, error.message);
    }

    return response.json();
  },

  completePickup: async (
    staffToken: string,
    orderId: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/store/staff/complete-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Staff-Token': staffToken,
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to complete pickup');
    }

    return response.json();
  },

  markReadyForPickup: async (
    staffToken: string,
    orderId: string
  ): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/store/staff/ready-for-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Staff-Token': staffToken,
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to update order');
    }

    return response.json();
  },
};

// ==========================================
// Merchant Portal API (B2B Management)
// ==========================================

// Merchant API key management
let merchantApiKey: string | null = null;

export function setMerchantApiKey(key: string | null) {
  merchantApiKey = key;
  if (key) {
    localStorage.setItem('mirrorx_merchant_api_key', key);
  } else {
    localStorage.removeItem('mirrorx_merchant_api_key');
  }
}

export function getMerchantApiKey(): string | null {
  if (!merchantApiKey) {
    merchantApiKey = localStorage.getItem('mirrorx_merchant_api_key');
  }
  return merchantApiKey;
}

async function fetchWithMerchantAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getMerchantApiKey();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (apiKey) {
    (headers as Record<string, string>)['X-Merchant-API-Key'] = apiKey;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || 'Request failed', error.details);
  }

  return response.json();
}

export interface MerchantStore extends Store {
  metrics?: {
    todaySessions: number;
    todayTryOns: number;
    todayOrders: number;
    todayRevenue: number;
    conversionRate: number;
  };
}

export interface StoreAnalytics {
  totalSessions: number;
  totalTryOns: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  conversionRate: number;
  sessionsTrend: number;
  tryOnsTrend: number;
  ordersTrend: number;
  revenueTrend: number;
  dailyMetrics: Array<{
    date: string;
    sessions: number;
    tryons: number;
    orders: number;
    revenue: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    tryons: number;
    orders: number;
    revenue: number;
  }>;
  funnelData: {
    scans: number;
    sessions: number;
    tryons: number;
    addToCart: number;
    checkout: number;
    paid: number;
  };
}

export interface ProductImportRow {
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  gender?: string;
  price: number;
  original_price?: number;
  image_url: string;
  additional_images?: string[];
  sizes?: string[];
  colors?: string[];
  material?: string;
  care_instructions?: string;
  stock_quantity?: number;
  zone_id?: string;
  aisle?: string;
  row?: string;
  shelf?: string;
  rack?: string;
}

export interface StoreStaffMember {
  id: string;
  store_id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'ADMIN' | 'MANAGER' | 'ASSOCIATE' | 'CASHIER';
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface GeneratedQRCode {
  id: string;
  store_id: string;
  qr_type: 'store' | 'zone' | 'product';
  reference_id: string;
  qr_code_id: string;
  deep_link_url: string;
  short_code: string;
  qr_data_url: string;
  is_active: boolean;
}

export const merchantApi = {
  // Authentication
  login: async (
    email: string,
    password: string
  ): Promise<{
    merchant: {
      id: string;
      name: string;
      email: string;
      company_name: string;
    };
    api_key: string;
    stores: MerchantStore[];
  }> => {
    const response = await fetch(`${API_BASE}/merchant/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new ApiError(response.status, error.message);
    }

    const data = await response.json();
    setMerchantApiKey(data.api_key);
    return data;
  },

  logout: () => {
    setMerchantApiKey(null);
  },

  // Store Management
  getStores: async (): Promise<{ stores: MerchantStore[] }> => {
    return fetchWithMerchantAuth('/merchant/stores');
  },

  createStore: async (storeData: {
    name: string;
    slug?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email?: string;
    logo_url?: string;
    banner_url?: string;
    opening_hours?: Record<string, { open: string; close: string }>;
    settings?: {
      guest_checkout_enabled?: boolean;
      selfie_required?: boolean;
      tryon_enabled?: boolean;
      default_pickup_time_minutes?: number;
    };
  }): Promise<{ store: MerchantStore }> => {
    return fetchWithMerchantAuth('/merchant/stores', {
      method: 'POST',
      body: JSON.stringify(storeData),
    });
  },

  updateStore: async (
    storeId: string,
    updates: Partial<Store>
  ): Promise<{ store: MerchantStore }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // Zone Management
  getZones: async (storeId: string): Promise<{ zones: StoreZone[] }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/zones`);
  },

  createZone: async (
    storeId: string,
    zoneData: {
      name: string;
      slug?: string;
      description?: string;
      floor?: string;
      section?: string;
      category?: string;
      image_url?: string;
    }
  ): Promise<{ zone: StoreZone; qr_code: GeneratedQRCode }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/zones`, {
      method: 'POST',
      body: JSON.stringify(zoneData),
    });
  },

  updateZone: async (
    storeId: string,
    zoneId: string,
    updates: Partial<StoreZone>
  ): Promise<{ zone: StoreZone }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/zones/${zoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteZone: async (storeId: string, zoneId: string): Promise<{ success: boolean }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/zones/${zoneId}`, {
      method: 'DELETE',
    });
  },

  // Product Management
  getProducts: async (
    storeId: string,
    params?: {
      zone_id?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    products: (StoreProduct & { location?: StorePlanogram })[];
    total: number;
    page: number;
    limit: number;
  }> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/products${query ? `?${query}` : ''}`);
  },

  createProduct: async (
    storeId: string,
    productData: Omit<ProductImportRow, 'sku'> & { sku?: string }
  ): Promise<{ product: StoreProduct }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/products`, {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  updateProduct: async (
    storeId: string,
    productId: string,
    updates: Partial<StoreProduct>
  ): Promise<{ product: StoreProduct }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteProduct: async (storeId: string, productId: string): Promise<{ success: boolean }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/products/${productId}`, {
      method: 'DELETE',
    });
  },

  // Bulk Product Import (CSV)
  importProducts: async (
    storeId: string,
    products: ProductImportRow[]
  ): Promise<{
    success: boolean;
    imported_count: number;
    failed_count: number;
    errors: Array<{ row: number; sku: string; error: string }>;
  }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/products/import`, {
      method: 'POST',
      body: JSON.stringify({ products }),
    });
  },

  // Staff Management
  getStaff: async (storeId: string): Promise<{ staff: StoreStaffMember[] }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/staff`);
  },

  addStaff: async (
    storeId: string,
    staffData: {
      name: string;
      email: string;
      phone?: string;
      role: 'ADMIN' | 'MANAGER' | 'ASSOCIATE' | 'CASHIER';
      pin: string;
    }
  ): Promise<{ staff: StoreStaffMember }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/staff`, {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
  },

  updateStaff: async (
    storeId: string,
    staffId: string,
    updates: Partial<StoreStaffMember> & { pin?: string }
  ): Promise<{ staff: StoreStaffMember }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/staff/${staffId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  removeStaff: async (storeId: string, staffId: string): Promise<{ success: boolean }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/staff/${staffId}`, {
      method: 'DELETE',
    });
  },

  // QR Code Generation
  generateQRCodes: async (
    storeId: string,
    options: {
      qr_type: 'store' | 'zone' | 'product';
      reference_ids?: string[];
      include_all?: boolean;
    }
  ): Promise<{ qr_codes: GeneratedQRCode[] }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/qr-codes/generate`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  getQRCodes: async (
    storeId: string,
    params?: {
      qr_type?: 'store' | 'zone' | 'product';
    }
  ): Promise<{ qr_codes: GeneratedQRCode[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.qr_type) {
      searchParams.append('qr_type', params.qr_type);
    }
    const query = searchParams.toString();
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/qr-codes${query ? `?${query}` : ''}`);
  },

  // Analytics
  getAnalytics: async (
    storeId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      period?: 'today' | 'week' | 'month' | 'custom';
    }
  ): Promise<StoreAnalytics> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/analytics${query ? `?${query}` : ''}`);
  },

  // Orders
  getOrders: async (
    storeId: string,
    params?: {
      status?: string;
      start_date?: string;
      end_date?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    orders: StoreOrder[];
    total: number;
    page: number;
    limit: number;
  }> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/orders${query ? `?${query}` : ''}`);
  },

  // Coupons
  getCoupons: async (storeId: string): Promise<{ coupons: StoreCoupon[] }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/coupons`);
  },

  createCoupon: async (
    storeId: string,
    couponData: {
      code: string;
      description?: string;
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      min_order_amount?: number;
      max_discount?: number;
      usage_limit?: number;
      per_user_limit?: number;
      valid_from?: string;
      valid_until?: string;
    }
  ): Promise<{ coupon: StoreCoupon }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/coupons`, {
      method: 'POST',
      body: JSON.stringify(couponData),
    });
  },

  updateCoupon: async (
    storeId: string,
    couponId: string,
    updates: Partial<StoreCoupon>
  ): Promise<{ coupon: StoreCoupon }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/coupons/${couponId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteCoupon: async (storeId: string, couponId: string): Promise<{ success: boolean }> => {
    return fetchWithMerchantAuth(`/merchant/stores/${storeId}/coupons/${couponId}`, {
      method: 'DELETE',
    });
  },
};

// StoreCoupon type for coupons
export interface StoreCoupon {
  id: string;
  store_id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount?: number;
  max_discount?: number;
  usage_limit?: number;
  usage_count: number;
  per_user_limit?: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

export { ApiError };
