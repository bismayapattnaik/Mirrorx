// MirrorX Shared Package

// Export all types
export * from './types/index.js';

// Export schemas and inferred types
export {
  // Common
  uuidSchema,
  emailSchema,
  phoneSchema,
  urlSchema,
  base64ImageSchema,
  // Auth
  signupSchema,
  loginSchema,
  googleAuthSchema,
  updateProfileSchema,
  // Try-On
  tryOnModeSchema,
  tryOnRequestSchema,
  tryOnJobStatusSchema,
  // Product
  productExtractRequestSchema,
  // Payment
  orderKindSchema,
  orderStatusSchema,
  createOrderRequestSchema,
  verifyPaymentRequestSchema,
  // Wardrobe
  wardrobeCategorySchema,
  wardrobeSortSchema,
  wardrobeQuerySchema,
  saveToWardrobeSchema,
  // Merchant
  merchantRegisterSchema,
  // Subscription
  subscriptionTierSchema,
  subscriptionStatusSchema,
  // Transaction
  transactionTypeSchema,
  // API
  apiErrorSchema,
  paginationSchema,
  // Inferred Types from schemas
  type SignupInput,
  type LoginInput,
  type UpdateProfileInput,
  type GoogleAuthInput,
  type TryOnRequestInput,
  type ProductExtractRequestInput,
  type CreateOrderRequestInput,
  type VerifyPaymentRequestInput,
  type WardrobeQueryInput,
  type SaveToWardrobeInput,
  type MerchantRegisterInput,
} from './schemas/index.js';
