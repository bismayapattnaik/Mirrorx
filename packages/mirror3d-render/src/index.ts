/**
 * @fileoverview 3D Mirror Render Package
 * Three.js scene management, compositing, and enhanced lighting
 */

export * from './types';
export { SceneManager } from './scene-manager';
export { OcclusionCompositor } from './occlusion-compositor';
export {
  EnhancedLightingManager,
  ENVIRONMENT_PRESETS,
  FABRIC_PROPERTIES,
  estimateAmbientLight,
  type EnvironmentPreset,
  type FabricType,
  type FabricProperties,
} from './enhanced-lighting';
export { VideoRecorder, type RecordingOptions, type RecordingResult } from './video-recorder';
