// MirrorX Shared Package

// Export all types
export * from './types/index.js';

// Export schemas only (not the inferred types to avoid duplicates)
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
} from './schemas/index.js';
