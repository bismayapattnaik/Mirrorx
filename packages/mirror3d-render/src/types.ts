/**
 * @fileoverview Types for the rendering system
 */

/**
 * Render configuration
 */
export interface RenderConfig {
  /** Canvas width (or auto from container) */
  width?: number;
  /** Canvas height (or auto from container) */
  height?: number;
  /** Anti-aliasing */
  antialias: boolean;
  /** Enable shadows */
  shadows: boolean;
  /** Pixel ratio (1 = normal, 2 = retina) */
  pixelRatio: number;
  /** Background color (null = transparent) */
  backgroundColor: string | null;
  /** Enable occlusion compositing */
  enableOcclusion: boolean;
  /** Tone mapping mode */
  toneMapping: 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces';
  /** Exposure for tone mapping */
  exposure: number;
}

/**
 * Default render configuration
 */
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  antialias: true,
  shadows: true,
  pixelRatio: Math.min(2, window.devicePixelRatio),
  backgroundColor: null, // Transparent for video overlay
  enableOcclusion: true,
  toneMapping: 'aces',
  exposure: 1.0,
};

/**
 * Lighting configuration
 */
export interface LightingConfig {
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Ambient light color */
  ambientColor: string;
  /** Main directional light intensity */
  mainLightIntensity: number;
  /** Main light color */
  mainLightColor: string;
  /** Main light position */
  mainLightPosition: { x: number; y: number; z: number };
  /** Fill light intensity */
  fillLightIntensity: number;
  /** Enable environment map */
  useEnvironmentMap: boolean;
}

/**
 * Default lighting for fashion/mirror scenario
 */
export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  ambientIntensity: 0.4,
  ambientColor: '#ffffff',
  mainLightIntensity: 1.0,
  mainLightColor: '#ffffff',
  mainLightPosition: { x: 2, y: 3, z: 2 },
  fillLightIntensity: 0.3,
  useEnvironmentMap: false,
};

/**
 * Camera configuration
 */
export interface CameraConfig {
  /** Field of view (degrees) */
  fov: number;
  /** Near clipping plane */
  near: number;
  /** Far clipping plane */
  far: number;
  /** Initial camera position */
  position: { x: number; y: number; z: number };
  /** Look-at target */
  target: { x: number; y: number; z: number };
}

/**
 * Default camera configuration for mirror view
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  fov: 50,
  near: 0.1,
  far: 100,
  position: { x: 0, y: 1.2, z: 2.5 },
  target: { x: 0, y: 1, z: 0 },
};

/**
 * Occlusion compositing options
 */
export interface OcclusionConfig {
  /** Use segmentation mask for full body occlusion */
  useSegmentationMask: boolean;
  /** Use hand landmarks for hand-only occlusion */
  useHandOcclusion: boolean;
  /** Edge softness for mask blending (0-1) */
  edgeSoftness: number;
  /** Minimum depth difference for occlusion */
  depthThreshold: number;
}

/**
 * Default occlusion configuration
 */
export const DEFAULT_OCCLUSION_CONFIG: OcclusionConfig = {
  useSegmentationMask: true,
  useHandOcclusion: true,
  edgeSoftness: 0.1,
  depthThreshold: 0.05,
};

/**
 * Performance stats
 */
export interface RenderStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  textureMemory: number;
}
