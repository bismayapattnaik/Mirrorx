/**
 * @fileoverview Types for the 3D Mirror UI components
 */

/**
 * User profile for body calibration
 */
export interface UserProfile {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  bodyScales: BodyScales;
  faceTexture?: string;
  capturedPhotos?: {
    front?: string;
    side?: string;
    angle45?: string;
  };
  measurements?: {
    heightCm?: number;
    shoulderWidthCm?: number;
    chestCm?: number;
    waistCm?: number;
    hipCm?: number;
  };
}

/**
 * Body scaling parameters
 */
export interface BodyScales {
  height: number;
  shoulderWidth: number;
  torsoWidth: number;
  hipWidth: number;
  armLength: number;
  legLength: number;
  headSize: number;
}

/**
 * Default body scales
 */
export const DEFAULT_BODY_SCALES: BodyScales = {
  height: 1.0,
  shoulderWidth: 1.0,
  torsoWidth: 1.0,
  hipWidth: 1.0,
  armLength: 1.0,
  legLength: 1.0,
  headSize: 1.0,
};

/**
 * Create a new default user profile
 */
export function createDefaultUserProfile(): UserProfile {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bodyScales: { ...DEFAULT_BODY_SCALES },
  };
}

/**
 * Garment metadata
 */
export interface GarmentMetadata {
  id: string;
  name: string;
  category: 'top' | 'outerwear' | 'bottom' | 'dress' | 'footwear' | 'accessory';
  layer: number;
  thumbnailUrl?: string;
  glbPath: string;
  brand?: string;
  price?: number;
  currency?: string;
  colors?: Array<{ id: string; name: string; hex: string }>;
}

/**
 * Tracking status
 */
export interface TrackingStatus {
  isInitialized: boolean;
  isRunning: boolean;
  currentFps: number;
  confidence: number;
  lastError: string | null;
}

/**
 * Calibration step in onboarding
 */
export type OnboardingStep = 'welcome' | 'camera' | 'photo-front' | 'photo-side' | 'photo-angle' | 'calibrate' | 'complete';

/**
 * Sample garments for the demo
 */
export const SAMPLE_GARMENTS: GarmentMetadata[] = [
  {
    id: 'tshirt-basic-white',
    name: 'Basic T-Shirt',
    category: 'top',
    layer: 2,
    thumbnailUrl: '/assets/garments/thumbnails/tshirt-white.png',
    glbPath: '/assets/garments/tshirt-basic.glb',
    brand: 'MirrorX Basics',
    price: 29.99,
    currency: 'USD',
    colors: [
      { id: 'white', name: 'White', hex: '#ffffff' },
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
      { id: 'navy', name: 'Navy', hex: '#1e3a5f' },
    ],
  },
  {
    id: 'hoodie-classic-gray',
    name: 'Classic Hoodie',
    category: 'outerwear',
    layer: 3,
    thumbnailUrl: '/assets/garments/thumbnails/hoodie-gray.png',
    glbPath: '/assets/garments/hoodie-classic.glb',
    brand: 'MirrorX Comfort',
    price: 59.99,
    currency: 'USD',
    colors: [
      { id: 'gray', name: 'Heather Gray', hex: '#808080' },
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
      { id: 'burgundy', name: 'Burgundy', hex: '#722f37' },
    ],
  },
  {
    id: 'jeans-slim-blue',
    name: 'Slim Fit Jeans',
    category: 'bottom',
    layer: 1,
    thumbnailUrl: '/assets/garments/thumbnails/jeans-blue.png',
    glbPath: '/assets/garments/jeans-slim.glb',
    brand: 'MirrorX Denim',
    price: 79.99,
    currency: 'USD',
    colors: [
      { id: 'indigo', name: 'Indigo', hex: '#3f5277' },
      { id: 'black', name: 'Black', hex: '#1a1a1a' },
      { id: 'light', name: 'Light Wash', hex: '#87a9c9' },
    ],
  },
];

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  USER_PROFILE: 'mirror3d_user_profile',
  EQUIPPED_GARMENTS: 'mirror3d_equipped_garments',
  CALIBRATION_COMPLETE: 'mirror3d_calibration_complete',
} as const;
