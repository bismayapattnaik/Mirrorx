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

// ==========================================
// STORE MODE TYPES (B2B Offline Retail)
// ==========================================

// ---------- Store Mode Enums ----------
export type StoreStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
export type StoreOrderStatus = 'PENDING' | 'CONFIRMED' | 'READY_FOR_PICKUP' | 'PICKED_UP' | 'CANCELLED' | 'REFUNDED';
export type PickupPassStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
export type StoreStaffRole = 'ADMIN' | 'MANAGER' | 'ASSOCIATE' | 'CASHIER';
export type StoreSessionStatus = 'ACTIVE' | 'EXPIRED' | 'CONVERTED';
export type StoreProductCategory =
  | 'tops' | 'shirts' | 'tshirts' | 'blouses' | 'kurtas'
  | 'bottoms' | 'jeans' | 'trousers' | 'skirts' | 'leggings'
  | 'dresses' | 'sarees' | 'lehengas' | 'suits'
  | 'outerwear' | 'jackets' | 'blazers' | 'sweaters'
  | 'ethnicwear' | 'westernwear' | 'sportswear' | 'loungewear'
  | 'accessories' | 'footwear' | 'other';
export type GenderType = 'male' | 'female' | 'unisex';

// ---------- Store Types ----------
export interface StoreOpeningHours {
  open: string; // HH:mm format
  close: string;
}

export interface StoreSettings {
  allow_guest_checkout: boolean;
  require_selfie: boolean;
  enable_try_on: boolean;
  enable_find_in_store: boolean;
  pickup_time_minutes: number;
}

export interface Store {
  id: string;
  merchant_id: string;
  name: string;
  slug: string;
  description: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string | null;
  email: string | null;
  status: StoreStatus;
  logo_url: string | null;
  banner_url: string | null;
  opening_hours: Record<string, StoreOpeningHours>;
  settings: StoreSettings;
  created_at: Date;
  updated_at: Date;
}

export interface StoreZone {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  floor: string | null;
  section: string | null;
  category: StoreProductCategory | null;
  display_order: number;
  qr_code_id: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StoreProductColor {
  name: string;
  hex: string;
}

export interface StoreProduct {
  id: string;
  store_id: string;
  zone_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: StoreProductCategory;
  gender: GenderType;
  price: number; // in paise
  original_price: number | null;
  currency: string;
  image_url: string;
  additional_images: string[];
  sizes: string[];
  colors: StoreProductColor[];
  material: string | null;
  care_instructions: string | null;
  tags: string[];
  is_active: boolean;
  is_try_on_enabled: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  qr_code_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StorePlanogram {
  id: string;
  store_id: string;
  product_id: string;
  zone_id: string | null;
  aisle: string | null;
  row: string | null;
  shelf: string | null;
  rack: string | null;
  facing: number;
  position_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// ---------- Store Session Types ----------
export interface StoreSession {
  id: string;
  store_id: string;
  user_id: string | null;
  session_token: string;
  selfie_image_url: string | null;
  status: StoreSessionStatus;
  device_info: Record<string, unknown> | null;
  entry_qr_type: 'store' | 'zone' | 'product' | null;
  entry_qr_id: string | null;
  started_at: Date;
  last_active_at: Date;
  ended_at: Date | null;
  expires_at: Date;
}

// ---------- Store Cart Types ----------
export interface StoreCart {
  id: string;
  store_id: string;
  session_id: string;
  user_id: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  coupon_code: string | null;
  notes: string | null;
  items: StoreCartItem[];
  created_at: Date;
  updated_at: Date;
}

export interface StoreCartItem {
  id: string;
  cart_id: string;
  product_id: string;
  product?: StoreProduct;
  tryon_job_id: string | null;
  quantity: number;
  size: string | null;
  color: string | null;
  unit_price: number;
  total_price: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// ---------- Store Order Types ----------
export interface StoreOrder {
  id: string;
  order_number: string;
  store_id: string;
  session_id: string | null;
  user_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: StoreOrderStatus;
  payment_method: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  payment_verified_at: Date | null;
  pickup_time_estimate: Date | null;
  picked_up_at: Date | null;
  staff_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  items: StoreOrderItem[];
  created_at: Date;
  updated_at: Date;
}

export interface StoreOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  tryon_job_id: string | null;
  product_snapshot: StoreProduct;
  quantity: number;
  size: string | null;
  color: string | null;
  unit_price: number;
  total_price: number;
  location_info: StorePlanogram | null;
  created_at: Date;
}

// ---------- Pickup Pass Types ----------
export interface PickupPass {
  id: string;
  order_id: string;
  pass_code: string;
  qr_data: string;
  status: PickupPassStatus;
  generated_at: Date;
  expires_at: Date;
  used_at: Date | null;
  scanned_by_staff_id: string | null;
}

// ---------- Store Staff Types ----------
export interface StoreStaff {
  id: string;
  store_id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: StoreStaffRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ---------- Store QR Code Types ----------
export interface StoreQRCode {
  id: string;
  store_id: string;
  qr_type: 'store' | 'zone' | 'product';
  reference_id: string;
  qr_code_id: string;
  deep_link_url: string;
  short_code: string | null;
  scan_count: number;
  last_scanned_at: Date | null;
  is_active: boolean;
  created_at: Date;
}

// ---------- Store Coupon Types ----------
export interface StoreCoupon {
  id: string;
  store_id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  valid_from: Date;
  valid_until: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ---------- Store Analytics Types ----------
export type StoreAnalyticsEventType =
  | 'qr_scan' | 'session_start' | 'selfie_upload'
  | 'zone_browse' | 'product_view' | 'tryon_start'
  | 'tryon_complete' | 'tryon_fail' | 'add_to_cart'
  | 'remove_from_cart' | 'checkout_start' | 'payment_success'
  | 'payment_fail' | 'pickup_pass_generated' | 'pickup_complete'
  | 'session_end';

export interface StoreAnalyticsEvent {
  id: string;
  store_id: string;
  session_id: string | null;
  user_id: string | null;
  event_type: StoreAnalyticsEventType;
  event_data: Record<string, unknown>;
  zone_id: string | null;
  product_id: string | null;
  device_type: 'mobile' | 'tablet' | 'kiosk' | null;
  created_at: Date;
}

export interface StoreDailyMetrics {
  id: string;
  store_id: string;
  metric_date: Date;
  total_sessions: number;
  total_qr_scans: number;
  total_tryons: number;
  successful_tryons: number;
  failed_tryons: number;
  total_cart_adds: number;
  total_orders: number;
  total_revenue: number;
  average_order_value: number | null;
  conversion_rate_browse_to_tryon: number | null;
  conversion_rate_tryon_to_cart: number | null;
  conversion_rate_cart_to_purchase: number | null;
  median_decision_time_seconds: number | null;
  created_at: Date;
}

// ---------- Store Mode API Types ----------

// Session Management
export interface CreateStoreSessionRequest {
  store_id: string;
  qr_type?: 'store' | 'zone' | 'product';
  qr_id?: string;
  device_info?: Record<string, unknown>;
}

export interface CreateStoreSessionResponse {
  session: StoreSession;
  store: Store;
  initial_zone?: StoreZone;
  initial_product?: StoreProduct;
}

export interface UploadSelfieRequest {
  session_token: string;
  selfie_image: string; // base64
}

// Store Browsing
export interface GetStoreProductsRequest {
  store_id: string;
  zone_id?: string;
  category?: StoreProductCategory;
  gender?: GenderType;
  brand?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetStoreProductsResponse {
  products: StoreProduct[];
  total: number;
  page: number;
  limit: number;
}

// Store Try-On
export interface StoreTryOnRequest {
  session_token: string;
  product_id: string;
  mode?: TryOnMode;
}

export interface StoreTryOnResponse {
  job_id: string;
  status: TryOnJobStatus;
  result_image_url?: string;
  product: StoreProduct;
  location?: StorePlanogram;
}

// Cart Management
export interface AddToStoreCartRequest {
  session_token: string;
  product_id: string;
  quantity?: number;
  size?: string;
  color?: string;
  tryon_job_id?: string;
}

export interface UpdateStoreCartItemRequest {
  session_token: string;
  item_id: string;
  quantity?: number;
  size?: string;
  color?: string;
}

export interface GetStoreCartResponse {
  cart: StoreCart;
}

export interface ApplyCouponRequest {
  session_token: string;
  coupon_code: string;
}

// Checkout
export interface StoreCheckoutRequest {
  session_token: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  notes?: string;
}

export interface StoreCheckoutResponse {
  order_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface VerifyStorePaymentRequest {
  session_token: string;
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyStorePaymentResponse {
  order: StoreOrder;
  pickup_pass: PickupPass;
}

// Pickup
export interface GetPickupPassResponse {
  pickup_pass: PickupPass;
  order: StoreOrder;
  store: Store;
}

// Staff Operations
export interface StaffLoginRequest {
  store_id: string;
  email: string;
  pin: string;
}

export interface StaffLoginResponse {
  staff: StoreStaff;
  token: string;
}

export interface GetStoreOrdersRequest {
  store_id: string;
  status?: StoreOrderStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface GetStoreOrdersResponse {
  orders: StoreOrder[];
  total: number;
  page: number;
  limit: number;
}

export interface ScanPickupPassRequest {
  staff_token: string;
  pass_code: string;
}

export interface ScanPickupPassResponse {
  order: StoreOrder;
  items_with_locations: Array<{
    item: StoreOrderItem;
    location: StorePlanogram | null;
  }>;
}

export interface CompletePickupRequest {
  staff_token: string;
  order_id: string;
}

// Merchant Portal
export interface CreateStoreRequest {
  name: string;
  slug: string;
  description?: string;
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  banner_url?: string;
  settings?: Partial<StoreSettings>;
}

export interface UpdateStoreRequest {
  name?: string;
  description?: string;
  address_line1?: string;
  address_line2?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  banner_url?: string;
  opening_hours?: Record<string, StoreOpeningHours>;
  settings?: Partial<StoreSettings>;
}

export interface CreateStoreZoneRequest {
  store_id: string;
  name: string;
  slug: string;
  description?: string;
  floor?: string;
  section?: string;
  category?: StoreProductCategory;
  display_order?: number;
  image_url?: string;
}

export interface ImportStoreProductsRequest {
  store_id: string;
  products: Array<{
    sku: string;
    name: string;
    description?: string;
    brand?: string;
    category: StoreProductCategory;
    gender?: GenderType;
    price: number;
    original_price?: number;
    image_url: string;
    additional_images?: string[];
    sizes?: string[];
    colors?: StoreProductColor[];
    material?: string;
    tags?: string[];
    zone_slug?: string;
    aisle?: string;
    row?: string;
    shelf?: string;
    rack?: string;
    stock_quantity?: number;
  }>;
}

export interface ImportStoreProductsResponse {
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ sku: string; error: string }>;
}

export interface GetStoreAnalyticsRequest {
  store_id: string;
  date_from: string;
  date_to: string;
  group_by?: 'day' | 'week' | 'month';
}

export interface GetStoreAnalyticsResponse {
  metrics: StoreDailyMetrics[];
  summary: {
    total_sessions: number;
    total_tryons: number;
    total_orders: number;
    total_revenue: number;
    average_order_value: number;
    overall_conversion_rate: number;
  };
}

export interface GenerateQRCodesRequest {
  store_id: string;
  type: 'store' | 'zone' | 'product';
  ids?: string[]; // For zones/products, specific IDs to generate
}

export interface GenerateQRCodesResponse {
  qr_codes: Array<{
    qr_code: StoreQRCode;
    qr_image_url: string; // Base64 or URL to generated QR image
  }>;
}

// ---------- Store Mode B2B Pricing ----------
export interface StoreModeB2BPricing {
  setup_fee: number; // One-time setup in paise
  monthly_saas_fee: number; // Per store per month in paise
  per_tryon_fee: number; // Per try-on usage in paise
  per_transaction_fee_percentage: number; // % of order value
  white_label_addon: number; // Monthly addon for white-label in paise
  kiosk_rental: number; // Monthly kiosk rental in paise
}

export const STORE_MODE_PRICING: StoreModeB2BPricing = {
  setup_fee: 2500000, // ₹25,000
  monthly_saas_fee: 999900, // ₹9,999/month/store
  per_tryon_fee: 200, // ₹2 per try-on
  per_transaction_fee_percentage: 1.5, // 1.5% of order value
  white_label_addon: 500000, // ₹5,000/month
  kiosk_rental: 1500000, // ₹15,000/month
};

// ---------- Store Mode Pilot KPIs ----------
export interface StorePilotKPIs {
  target_scan_to_browse_rate: number;
  target_browse_to_tryon_rate: number;
  target_tryon_to_cart_rate: number;
  target_cart_to_paid_rate: number;
  target_median_decision_time_minutes: number;
  target_tryon_success_rate: number;
  target_refund_rate: number;
}

export const PILOT_KPI_TARGETS: StorePilotKPIs = {
  target_scan_to_browse_rate: 80, // 80% of QR scans should lead to browsing
  target_browse_to_tryon_rate: 40, // 40% of browsers should try-on
  target_tryon_to_cart_rate: 30, // 30% of try-ons should add to cart
  target_cart_to_paid_rate: 60, // 60% of carts should convert
  target_median_decision_time_minutes: 4, // <4 minutes to decision
  target_tryon_success_rate: 95, // 95% try-on success rate
  target_refund_rate: 5, // <5% refund rate
};
