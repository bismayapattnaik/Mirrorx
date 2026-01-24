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

// AI Tailor API
export interface ProfileAnalysis {
  skinTone: {
    tone: string;
    undertone: string;
    description: string;
  };
  faceShape: string;
  bodyType: string;
  colorPalette: {
    bestColors: string[];
    avoidColors: string[];
    neutrals: string[];
    accentColors: string[];
  };
  stylePersonality: string;
}

export interface StyleRecommendation {
  category: string;
  title: string;
  description: string;
  colors: string[];
  occasions: string[];
  priceRange: string;
  searchQuery: string;
  buyLinks: Array<{ store: string; url: string }>;
}

export interface SizeRecommendation {
  category: string;
  recommendedSize: string;
  measurements: {
    chest?: string;
    waist?: string;
    hips?: string;
    length?: string;
  };
  fitTips: string[];
}

export const tailorApi = {
  analyzeProfile: async (
    photo: string,
    gender: 'male' | 'female'
  ): Promise<{ success: boolean; profile: ProfileAnalysis }> => {
    return fetchWithAuth('/tailor/analyze-profile', {
      method: 'POST',
      body: JSON.stringify({ photo, gender }),
    });
  },

  getProfile: async (): Promise<{
    success: boolean;
    profile: ProfileAnalysis;
    gender: string;
  }> => {
    return fetchWithAuth('/tailor/profile');
  },

  getRecommendations: async (
    occasion?: string,
    season?: string
  ): Promise<{
    success: boolean;
    profile: ProfileAnalysis;
    recommendations: StyleRecommendation[];
  }> => {
    return fetchWithAuth('/tailor/recommendations', {
      method: 'POST',
      body: JSON.stringify({ occasion, season }),
    });
  },

  getSizeRecommendation: async (
    photo: string,
    productCategory: string,
    height?: number,
    weight?: number
  ): Promise<{
    success: boolean;
    sizeRecommendation: SizeRecommendation;
    basedOnPastFeedback: boolean;
  }> => {
    return fetchWithAuth('/tailor/size-recommendation', {
      method: 'POST',
      body: JSON.stringify({ photo, productCategory, height, weight }),
    });
  },

  submitSizeFeedback: async (
    productCategory: string,
    sizeOrdered: string,
    fitFeedback: 'too_tight' | 'too_loose' | 'perfect' | 'slightly_tight' | 'slightly_loose'
  ): Promise<{ success: boolean; message: string }> => {
    return fetchWithAuth('/tailor/size-feedback', {
      method: 'POST',
      body: JSON.stringify({ productCategory, sizeOrdered, fitFeedback }),
    });
  },

  getComplementary: async (
    clothingImage: string,
    clothingType: 'topwear' | 'bottomwear' | 'footwear' | 'accessory'
  ): Promise<{
    success: boolean;
    itemAnalysis: string;
    complementaryItems: StyleRecommendation[];
    fullOutfitIdea: string;
    sizeSuggestion?: string;
  }> => {
    return fetchWithAuth('/tailor/complementary', {
      method: 'POST',
      body: JSON.stringify({ clothingImage, clothingType }),
    });
  },

  getTrending: async (
    occasion?: string,
    season?: string
  ): Promise<{
    success: boolean;
    trends: Array<{
      name: string;
      description: string;
      keyPieces: string[];
      celebrities: string[];
      howToWear: string;
    }>;
    recommendations: StyleRecommendation[];
  }> => {
    const params = new URLSearchParams();
    if (occasion) params.append('occasion', occasion);
    if (season) params.append('season', season);
    const query = params.toString();
    return fetchWithAuth(`/tailor/trending${query ? `?${query}` : ''}`);
  },

  updateMeasurements: async (
    height?: number,
    weight?: number
  ): Promise<{ success: boolean; message: string }> => {
    return fetchWithAuth('/tailor/update-measurements', {
      method: 'POST',
      body: JSON.stringify({ height, weight }),
    });
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
