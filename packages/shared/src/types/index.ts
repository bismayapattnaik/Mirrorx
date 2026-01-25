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
  tryon_job_id: string;
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

// ==========================================
// PREMIUM FEATURES TYPES (Studio 2.0)
// ==========================================

// ---------- Enhanced Try-On Types ----------
export type TryOnJobType = 'PART' | 'FULL_FIT' | 'GARMENT_ONLY_REGEN' | 'OUTFIT_STEP' | 'OUTFIT_FINAL';
export type BackgroundMode = 'ORIGINAL' | 'STUDIO' | 'BLUR';
export type QualityTier = 'SD' | 'HD' | 'ULTRA_HD';

export interface EnhancedTryOnJob extends TryOnJob {
  job_type: TryOnJobType;
  parent_job_id: string | null;
  background_mode: BackgroundMode;
  compare_eligible: boolean;
  result_metadata: TryOnMetadata | null;
  fit_confidence: number | null;
  quality_tier: QualityTier;
  processing_time_ms: number | null;
}

export interface TryOnMetadata {
  lighting_score?: number;
  face_match_score?: number;
  garment_fit_score?: number;
  style_compatibility?: number;
}

export interface EnhancedTryOnRequest {
  mode: TryOnMode;
  background_mode?: BackgroundMode;
  quality_tier?: QualityTier;
  product_url?: string;
  regen_from_job_id?: string;
  outfit_context?: OutfitContext;
}

export interface OutfitContext {
  outfit_build_id?: string;
  item_type?: string;
  existing_items?: string[];
}

// ---------- Compare Mode Types ----------
export interface CompareSet {
  id: string;
  user_id: string;
  name: string | null;
  description: string | null;
  is_favorite: boolean;
  items: CompareSetItem[];
  created_at: Date;
  updated_at: Date;
}

export interface CompareSetItem {
  id: string;
  compare_set_id: string;
  tryon_job_id: string;
  position: number;
  notes: string | null;
  is_winner: boolean;
  tryon_job?: EnhancedTryOnJob;
  created_at: Date;
}

export interface CreateCompareSetRequest {
  name?: string;
  description?: string;
  job_ids: string[];
}

export interface CompareSetListResponse {
  sets: CompareSet[];
  total: number;
}

// ---------- Wishlist Types ----------
export type Platform = 'myntra' | 'ajio' | 'amazon' | 'flipkart' | 'meesho' | 'nykaa' | 'tatacliq' | 'other';

export interface WishlistItem {
  id: string;
  user_id: string;
  platform: Platform;
  product_url: string;
  title: string | null;
  brand: string | null;
  image_url: string | null;
  current_price: number | null;
  original_price: number | null;
  currency: string;
  palette_match_score: number | null;
  size_recommendation: string | null;
  occasion_tags: string[];
  is_on_sale: boolean;
  last_price_check: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AddWishlistRequest {
  product_url: string;
  occasion_tags?: string[];
}

export interface WishlistListResponse {
  items: WishlistItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PriceAlert {
  wishlist_item_id: string;
  old_price: number;
  new_price: number;
  discount_percentage: number;
}

// ---------- Occasion Stylist Types ----------
export type Occasion =
  | 'office' | 'interview' | 'date_night' | 'wedding_day' | 'wedding_night'
  | 'festive' | 'vacation' | 'casual' | 'college' | 'party' | 'formal' | 'ethnic';

export interface OccasionStylistRequest {
  occasion: Occasion;
  budget_min?: number;
  budget_max?: number;
  style_slider: number; // 0-100 (Modest to Bold)
  color_preferences?: string[];
  use_style_dna?: boolean;
  gender?: 'male' | 'female';
}

export interface OccasionLook {
  id: string;
  rank: number;
  name: string;
  description: string;
  items: OccasionLookItem[];
  total_price: number;
  rationale: string;
  palette_match: number;
  tryon_job_id: string | null;
  is_saved: boolean;
}

export interface OccasionLookItem {
  type: 'top' | 'bottom' | 'footwear' | 'accessory' | 'outerwear';
  title: string;
  brand: string | null;
  price: number | null;
  image_url: string | null;
  buy_links: BuyLink[];
  search_query: string;
}

export interface BuyLink {
  store: string;
  url: string;
}

export interface OccasionStylistResponse {
  request_id: string;
  occasion: Occasion;
  looks: OccasionLook[];
  generated_at: Date;
}

// ---------- Fit Signals Types ----------
export type FitFeedback = 'too_tight' | 'slightly_tight' | 'perfect' | 'slightly_loose' | 'too_loose';

export interface FitSignal {
  id: string;
  user_id: string;
  brand: string;
  category: string;
  size_recommended: string | null;
  size_confirmed: string | null;
  fit_feedback: FitFeedback | null;
  confidence: number;
  source: 'prediction' | 'user_input' | 'purchase_feedback';
  created_at: Date;
  updated_at: Date;
}

export interface FitSignalRequest {
  brand: string;
  category: string;
  size_confirmed: string;
  fit_feedback: FitFeedback;
}

export interface FitConfidenceResponse {
  brand: string;
  category: string;
  recommended_size: string;
  confidence: number;
  based_on: string[];
  fit_notes: string[];
}

// ---------- Outfit Builder Types ----------
export type OutfitBuildStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type OutfitItemType = 'top' | 'bottom' | 'footwear' | 'accessory' | 'outerwear';

export interface OutfitBuild {
  id: string;
  user_id: string;
  name: string | null;
  occasion: string | null;
  status: OutfitBuildStatus;
  items: OutfitBuildItem[];
  final_tryon_job_id: string | null;
  total_price: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface OutfitBuildItem {
  id: string;
  outfit_build_id: string;
  item_type: OutfitItemType;
  product_url: string | null;
  product_image: string | null;
  title: string | null;
  brand: string | null;
  price: number | null;
  tryon_job_id: string | null;
  position: number;
  created_at: Date;
}

export interface AddOutfitItemRequest {
  item_type: OutfitItemType;
  product_url?: string;
  product_image?: string;
  title?: string;
  brand?: string;
  price?: number;
}

// ---------- Notifications Types ----------
export type NotificationType =
  | 'PRICE_DROP' | 'BACK_IN_STOCK' | 'WEEKLY_DIGEST'
  | 'STYLE_TIP' | 'NEW_FEATURE' | 'CREDIT_LOW' | 'SUBSCRIPTION_EXPIRING';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  is_sent: boolean;
  send_via: 'in_app' | 'email' | 'push';
  sent_at: Date | null;
  created_at: Date;
}

export interface NotificationPreferences {
  price_drop_alerts: boolean;
  weekly_digest: boolean;
  style_tips: boolean;
  new_features: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  digest_day: string;
}

// ---------- Feature Flags ----------
export interface FeatureFlag {
  flag_name: string;
  is_enabled: boolean;
  rollout_percentage: number;
  allowed_tiers: SubscriptionTier[];
}

// ---------- Analytics Types ----------
export interface AnalyticsEvent {
  event_name: string;
  properties?: Record<string, unknown>;
  user_id?: string;
  session_id?: string;
}

// ---------- Premium Entitlements ----------
export interface UserEntitlements {
  max_daily_tryons: number | 'unlimited';
  max_wardrobe_items: number | 'unlimited';
  max_wishlist_items: number | 'unlimited';
  max_compare_items: number;
  background_modes: BackgroundMode[];
  quality_tiers: QualityTier[];
  features: {
    compare_mode: boolean;
    studio_backgrounds: boolean;
    garment_regen: boolean;
    occasion_stylist: boolean;
    outfit_builder: boolean;
    price_alerts: boolean;
    priority_processing: boolean;
    api_access: boolean;
  };
}

export const TIER_ENTITLEMENTS: Record<SubscriptionTier, UserEntitlements> = {
  FREE: {
    max_daily_tryons: 5,
    max_wardrobe_items: 5,
    max_wishlist_items: 10,
    max_compare_items: 2,
    background_modes: ['ORIGINAL'],
    quality_tiers: ['SD'],
    features: {
      compare_mode: true,
      studio_backgrounds: false,
      garment_regen: false,
      occasion_stylist: true,
      outfit_builder: false,
      price_alerts: false,
      priority_processing: false,
      api_access: false,
    },
  },
  PRO: {
    max_daily_tryons: 'unlimited',
    max_wardrobe_items: 'unlimited',
    max_wishlist_items: 'unlimited',
    max_compare_items: 6,
    background_modes: ['ORIGINAL', 'STUDIO', 'BLUR'],
    quality_tiers: ['SD', 'HD'],
    features: {
      compare_mode: true,
      studio_backgrounds: true,
      garment_regen: true,
      occasion_stylist: true,
      outfit_builder: true,
      price_alerts: true,
      priority_processing: true,
      api_access: false,
    },
  },
  ELITE: {
    max_daily_tryons: 'unlimited',
    max_wardrobe_items: 'unlimited',
    max_wishlist_items: 'unlimited',
    max_compare_items: 6,
    background_modes: ['ORIGINAL', 'STUDIO', 'BLUR'],
    quality_tiers: ['SD', 'HD', 'ULTRA_HD'],
    features: {
      compare_mode: true,
      studio_backgrounds: true,
      garment_regen: true,
      occasion_stylist: true,
      outfit_builder: true,
      price_alerts: true,
      priority_processing: true,
      api_access: true,
    },
  },
};
