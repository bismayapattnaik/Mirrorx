// ==========================================
// MirrorX Shared Types
// ==========================================

// ---------- User & Auth Types ----------
export type SubscriptionTier = 'FREE' | 'PRO' | 'ELITE';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
export type TransactionType = 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'REFUND';
export type OrderStatus = 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';
export type TryOnMode = 'PART' | 'FULL_FIT';
export type TryOnJobStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type MerchantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  google_id: string | null;
  credits_balance: number;
  subscription_tier: SubscriptionTier;
  created_at: Date;
}

export interface WardrobeItem {
  id: string;
  user_id: string;
  tryon_image_url: string;
  product_image_url: string | null;
  product_url: string | null;
  brand: string | null;
  category: string | null;
  tags: string[];
  created_at: Date;
}

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: TransactionType;
  description: string | null;
  created_at: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: SubscriptionTier;
  status: SubscriptionStatus;
  start_date: Date;
  end_date: Date | null;
  razorpay_subscription_id: string | null;
  created_at: Date;
}

export interface Order {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: Date;
}

export interface TryOnJob {
  id: string;
  user_id: string;
  mode: TryOnMode;
  source_image_url: string;
  product_image_url: string | null;
  result_image_url: string | null;
  credits_used: number;
  status: TryOnJobStatus;
  error_message: string | null;
  retry_count: number;
  created_at: Date;
}

export interface Merchant {
  id: string;
  name: string;
  email: string;
  website: string | null;
  status: MerchantStatus;
  created_at: Date;
}

export interface MerchantApiKey {
  id: string;
  merchant_id: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: Date | null;
  created_at: Date;
}

// ---------- API Request/Response Types ----------
export interface AuthResponse {
  user: User;
  token: string;
}

export interface TryOnRequest {
  mode: TryOnMode;
  product_url?: string;
}

export interface TryOnResponse {
  job_id: string;
  status: TryOnJobStatus;
  result_image_url?: string;
  credits_used: number;
}

export interface ProductExtractRequest {
  url: string;
}

export interface ProductExtractResponse {
  title: string | null;
  brand: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  description: string | null;
  source: string;
}

export interface CreateOrderRequest {
  kind: 'CREDITS_PACK' | 'SUBSCRIPTION';
  sku: string;
}

export interface CreateOrderResponse {
  order_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface CreditsBalanceResponse {
  balance: number;
  daily_free_remaining: number;
  subscription_tier: SubscriptionTier;
}

export interface WardrobeListResponse {
  items: WardrobeItem[];
  total: number;
  page: number;
  limit: number;
}

// ---------- Pricing Configuration ----------
export interface CreditPack {
  sku: string;
  name: string;
  credits: number;
  price_inr: number;
  popular?: boolean;
}

export interface SubscriptionPlan {
  sku: string;
  name: string;
  tier: SubscriptionTier;
  price_inr: number;
  billing_period: 'monthly' | 'yearly';
  features: string[];
}

export const CREDIT_PACKS: CreditPack[] = [
  { sku: 'credits_20', name: 'Starter', credits: 20, price_inr: 4900 },
  { sku: 'credits_50', name: 'Basic', credits: 50, price_inr: 9900, popular: true },
  { sku: 'credits_120', name: 'Pro', credits: 120, price_inr: 19900 },
  { sku: 'credits_350', name: 'Elite', credits: 350, price_inr: 49900 },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    sku: 'free',
    name: 'Free',
    tier: 'FREE',
    price_inr: 0,
    billing_period: 'monthly',
    features: [
      '5 try-ons per day',
      'Basic AI suggestions',
      'Save to wardrobe',
      'Standard quality',
    ],
  },
  {
    sku: 'pro_monthly',
    name: 'Pro',
    tier: 'PRO',
    price_inr: 14900,
    billing_period: 'monthly',
    features: [
      'Unlimited try-ons',
      'Advanced AI styling',
      'Priority processing',
      'HD quality outputs',
      'Outfit combinations',
      'Email support',
    ],
  },
  {
    sku: 'elite_yearly',
    name: 'Elite',
    tier: 'ELITE',
    price_inr: 99900,
    billing_period: 'yearly',
    features: [
      'Everything in Pro',
      'Ultra HD quality',
      'API access',
      'Custom integrations',
      'Priority support',
      'Early feature access',
    ],
  },
];

// ---------- Constants ----------
export const DAILY_FREE_TRYONS = 5;
export const MAX_IMAGE_SIZE_MB = 10;
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
