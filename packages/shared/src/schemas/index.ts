import { z } from 'zod';

// ==========================================
// MirrorX Zod Validation Schemas
// ==========================================

// ---------- Common Schemas ----------
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
  .optional()
  .nullable();

export const urlSchema = z.string().url();
export const base64ImageSchema = z.string().refine(
  (val) => val.startsWith('data:image/') || /^[A-Za-z0-9+/]+=*$/.test(val),
  'Invalid base64 image format'
);

// ---------- Auth Schemas ----------
export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: phoneSchema,
  avatar_url: urlSchema.optional().nullable(),
});

// ---------- Try-On Schemas ----------
export const tryOnModeSchema = z.enum(['PART', 'FULL_FIT']);

export const tryOnRequestSchema = z.object({
  mode: tryOnModeSchema,
  product_url: urlSchema.optional(),
});

export const tryOnJobStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
]);

// ---------- Product Extraction Schemas ----------
export const productExtractRequestSchema = z.object({
  url: urlSchema.refine((url) => {
    const supportedDomains = [
      'myntra.com',
      'ajio.com',
      'amazon.in',
      'amazon.com',
      'flipkart.com',
      'meesho.com',
    ];
    return supportedDomains.some((domain) => url.includes(domain));
  }, 'URL must be from a supported e-commerce site'),
});

// ---------- Payment Schemas ----------
export const orderKindSchema = z.enum(['CREDITS_PACK', 'SUBSCRIPTION']);
export const orderStatusSchema = z.enum(['CREATED', 'PAID', 'FAILED', 'REFUNDED']);

export const createOrderRequestSchema = z.object({
  kind: orderKindSchema,
  sku: z.string().min(1, 'SKU is required'),
});

export const verifyPaymentRequestSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// ---------- Wardrobe Schemas ----------
export const wardrobeCategorySchema = z.enum([
  'casual',
  'formal',
  'ethnic',
  'party',
  'sports',
  'other',
]);

export const wardrobeSortSchema = z.enum(['newest', 'oldest', 'brand']);

export const wardrobeQuerySchema = z.object({
  search: z.string().optional(),
  category: wardrobeCategorySchema.optional(),
  sort: wardrobeSortSchema.default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const saveToWardrobeSchema = z.object({
  tryon_job_id: uuidSchema,
  brand: z.string().max(100).optional(),
  category: wardrobeCategorySchema.optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  product_url: urlSchema.optional(),
});

// ---------- Merchant Schemas ----------
export const merchantRegisterSchema = z.object({
  name: z.string().min(2).max(200),
  email: emailSchema,
  website: urlSchema.optional(),
});

// ---------- Subscription Schemas ----------
export const subscriptionTierSchema = z.enum(['FREE', 'PRO', 'ELITE']);
export const subscriptionStatusSchema = z.enum([
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'EXPIRED',
]);

// ---------- Transaction Schemas ----------
export const transactionTypeSchema = z.enum([
  'PURCHASE',
  'USAGE',
  'ADJUSTMENT',
  'REFUND',
]);

// ---------- API Response Schemas ----------
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.any()).optional(),
});

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

// ---------- Type Exports ----------
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type TryOnMode = z.infer<typeof tryOnModeSchema>;
export type TryOnRequestInput = z.infer<typeof tryOnRequestSchema>;
export type TryOnJobStatus = z.infer<typeof tryOnJobStatusSchema>;
export type ProductExtractRequestInput = z.infer<typeof productExtractRequestSchema>;
export type OrderKind = z.infer<typeof orderKindSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type CreateOrderRequestInput = z.infer<typeof createOrderRequestSchema>;
export type VerifyPaymentRequestInput = z.infer<typeof verifyPaymentRequestSchema>;
export type WardrobeCategory = z.infer<typeof wardrobeCategorySchema>;
export type WardrobeSort = z.infer<typeof wardrobeSortSchema>;
export type WardrobeQueryInput = z.infer<typeof wardrobeQuerySchema>;
export type SaveToWardrobeInput = z.infer<typeof saveToWardrobeSchema>;
export type MerchantRegisterInput = z.infer<typeof merchantRegisterSchema>;
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
