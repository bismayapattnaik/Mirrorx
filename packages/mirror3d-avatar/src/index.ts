/**
 * @fileoverview 3D Mirror Avatar Package
 * Avatar loading, scaling, pose application, and face texture mapping
 */

export * from './types';
export { AvatarManager } from './avatar-manager';
export {
  BodyEstimator,
  estimateBodyScalesFromPose,
  estimateMeasurementsFromPose,
} from './body-estimator';
export { FaceTextureGenerator } from './face-texture-generator';
