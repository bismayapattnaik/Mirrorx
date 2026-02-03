/**
 * @fileoverview 3D Mirror Wardrobe Package
 * Garment loading, management, and physics simulation
 */

export * from './types';
export { WardrobeManager } from './wardrobe-manager';
export {
  SpringBoneSystem,
  createSpringBoneSystemFromMetadata,
  type SpringChainConfig,
} from './spring-bone';
