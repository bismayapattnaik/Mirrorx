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
    productUrl?: string
  ): Promise<TryOnResponse> => {
    const formData = new FormData();
    formData.append('selfie_image', selfieImage);
    if (productImage) {
      formData.append('product_image', productImage);
    }
    formData.append('mode', mode);
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

// Health check
export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  },
};

export { ApiError };
