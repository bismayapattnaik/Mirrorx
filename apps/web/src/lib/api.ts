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

export { ApiError };
