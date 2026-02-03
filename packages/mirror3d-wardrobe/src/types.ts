/**
 * @fileoverview Types for the garment/wardrobe system
 */

/**
 * Garment category types
 */
export enum GarmentCategory {
  TOP = 'top',           // T-shirts, shirts, blouses
  OUTERWEAR = 'outerwear', // Jackets, hoodies, coats
  BOTTOM = 'bottom',     // Pants, shorts, skirts
  DRESS = 'dress',       // Full dresses
  FOOTWEAR = 'footwear', // Shoes, boots
  ACCESSORY = 'accessory', // Hats, glasses, watches
}

/**
 * Garment layer for occlusion ordering
 * Higher layer renders on top
 */
export enum GarmentLayer {
  BASE = 0,      // Underwear, base layers
  BOTTOM = 1,    // Pants, shorts
  TOP = 2,       // T-shirts, shirts
  OUTERWEAR = 3, // Jackets, hoodies
  ACCESSORY = 4, // Accessories
}

/**
 * Size options for garments
 */
export enum GarmentSize {
  XS = 'XS',
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
  XXL = 'XXL',
}

/**
 * Garment metadata schema (stored as JSON alongside GLB)
 */
export interface GarmentMetadata {
  /** Unique garment identifier */
  id: string;
  /** Display name */
  name: string;
  /** Category for filtering */
  category: GarmentCategory;
  /** Rendering layer */
  layer: GarmentLayer;
  /** Available sizes */
  availableSizes: GarmentSize[];
  /** Default size if not specified */
  defaultSize: GarmentSize;
  /** Thumbnail image URL */
  thumbnailUrl?: string;
  /** Brand/designer name */
  brand?: string;
  /** Price for e-commerce integration */
  price?: number;
  /** Currency code */
  currency?: string;
  /** Product URL for purchase */
  productUrl?: string;
  /** Color variants */
  colors?: GarmentColor[];
  /** Tags for search/filtering */
  tags?: string[];
  /** Description */
  description?: string;

  /** Technical metadata */
  technical: {
    /** Path to the GLB file */
    glbPath: string;
    /** Bones this garment is skinned to */
    affectedBones: string[];
    /** Whether garment supports physics simulation */
    hasPhysics?: boolean;
    /** Spring bone configuration for secondary motion */
    springBones?: SpringBoneConfig[];
    /** Material properties for customization */
    materials?: MaterialConfig[];
  };
}

/**
 * Color variant for a garment
 */
export interface GarmentColor {
  id: string;
  name: string;
  hex: string;
  /** Optional separate GLB for this color */
  glbPath?: string;
  /** Or texture swap */
  texturePath?: string;
}

/**
 * Spring bone configuration for cloth physics
 */
export interface SpringBoneConfig {
  /** Bone name or pattern (e.g., "cloth_*") */
  boneName: string;
  /** Stiffness (0-1, higher = less movement) */
  stiffness: number;
  /** Damping (0-1, higher = less oscillation) */
  damping: number;
  /** Gravity influence */
  gravityFactor: number;
}

/**
 * Material configuration for customization
 */
export interface MaterialConfig {
  /** Material name in the GLB */
  name: string;
  /** Whether color can be changed */
  colorizable: boolean;
  /** Base color if customizable */
  baseColor?: string;
  /** Whether texture can be swapped */
  textureSwappable?: boolean;
}

/**
 * Loaded garment instance
 */
export interface LoadedGarment {
  /** Metadata */
  metadata: GarmentMetadata;
  /** Three.js scene object */
  scene: THREE.Object3D;
  /** Skinned meshes */
  skinnedMeshes: THREE.SkinnedMesh[];
  /** Current visibility */
  visible: boolean;
  /** Current color selection */
  currentColorId?: string;
  /** Current size */
  currentSize: GarmentSize;
}

/**
 * Wardrobe state - currently equipped garments
 */
export interface WardrobeState {
  /** Equipped garments by slot (category) */
  equipped: Map<GarmentCategory, string>; // category -> garment ID
  /** All loaded garments */
  loaded: Map<string, LoadedGarment>;
}

/**
 * Default garment metadata template
 */
export function createDefaultGarmentMetadata(
  id: string,
  name: string,
  category: GarmentCategory,
  glbPath: string
): GarmentMetadata {
  return {
    id,
    name,
    category,
    layer: categoryToLayer(category),
    availableSizes: [GarmentSize.S, GarmentSize.M, GarmentSize.L],
    defaultSize: GarmentSize.M,
    technical: {
      glbPath,
      affectedBones: getDefaultAffectedBones(category),
    },
  };
}

/**
 * Map category to default layer
 */
function categoryToLayer(category: GarmentCategory): GarmentLayer {
  switch (category) {
    case GarmentCategory.BOTTOM:
      return GarmentLayer.BOTTOM;
    case GarmentCategory.TOP:
      return GarmentLayer.TOP;
    case GarmentCategory.OUTERWEAR:
      return GarmentLayer.OUTERWEAR;
    case GarmentCategory.DRESS:
      return GarmentLayer.TOP;
    case GarmentCategory.ACCESSORY:
    case GarmentCategory.FOOTWEAR:
      return GarmentLayer.ACCESSORY;
    default:
      return GarmentLayer.BASE;
  }
}

/**
 * Get default affected bones for a category
 */
function getDefaultAffectedBones(category: GarmentCategory): string[] {
  switch (category) {
    case GarmentCategory.TOP:
    case GarmentCategory.OUTERWEAR:
      return ['spine', 'chest', 'upperChest', 'leftShoulder', 'rightShoulder',
              'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm'];
    case GarmentCategory.BOTTOM:
      return ['hips', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg'];
    case GarmentCategory.DRESS:
      return ['spine', 'chest', 'hips', 'leftUpperLeg', 'rightUpperLeg'];
    case GarmentCategory.FOOTWEAR:
      return ['leftFoot', 'rightFoot', 'leftToes', 'rightToes'];
    default:
      return [];
  }
}

// Type augmentation for THREE namespace
declare global {
  namespace THREE {
    interface Object3D {}
    interface SkinnedMesh {}
  }
}
