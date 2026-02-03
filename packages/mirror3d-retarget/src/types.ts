/**
 * @fileoverview Types for the pose retargeting system
 */

import type { Quaternion, Vector3 } from 'three';

/**
 * Standard humanoid bone names following the VRM/Mixamo convention
 */
export enum HumanoidBone {
  // Spine
  HIPS = 'hips',
  SPINE = 'spine',
  SPINE1 = 'spine1',
  SPINE2 = 'spine2',
  CHEST = 'chest',
  UPPER_CHEST = 'upperChest',
  NECK = 'neck',
  HEAD = 'head',

  // Left Arm
  LEFT_SHOULDER = 'leftShoulder',
  LEFT_UPPER_ARM = 'leftUpperArm',
  LEFT_LOWER_ARM = 'leftLowerArm',
  LEFT_HAND = 'leftHand',

  // Right Arm
  RIGHT_SHOULDER = 'rightShoulder',
  RIGHT_UPPER_ARM = 'rightUpperArm',
  RIGHT_LOWER_ARM = 'rightLowerArm',
  RIGHT_HAND = 'rightHand',

  // Left Leg
  LEFT_UPPER_LEG = 'leftUpperLeg',
  LEFT_LOWER_LEG = 'leftLowerLeg',
  LEFT_FOOT = 'leftFoot',
  LEFT_TOES = 'leftToes',

  // Right Leg
  RIGHT_UPPER_LEG = 'rightUpperLeg',
  RIGHT_LOWER_LEG = 'rightLowerLeg',
  RIGHT_FOOT = 'rightFoot',
  RIGHT_TOES = 'rightToes',

  // Fingers (optional)
  LEFT_THUMB_PROXIMAL = 'leftThumbProximal',
  LEFT_THUMB_INTERMEDIATE = 'leftThumbIntermediate',
  LEFT_THUMB_DISTAL = 'leftThumbDistal',
  LEFT_INDEX_PROXIMAL = 'leftIndexProximal',
  LEFT_INDEX_INTERMEDIATE = 'leftIndexIntermediate',
  LEFT_INDEX_DISTAL = 'leftIndexDistal',
  LEFT_MIDDLE_PROXIMAL = 'leftMiddleProximal',
  LEFT_MIDDLE_INTERMEDIATE = 'leftMiddleIntermediate',
  LEFT_MIDDLE_DISTAL = 'leftMiddleDistal',
  LEFT_RING_PROXIMAL = 'leftRingProximal',
  LEFT_RING_INTERMEDIATE = 'leftRingIntermediate',
  LEFT_RING_DISTAL = 'leftRingDistal',
  LEFT_LITTLE_PROXIMAL = 'leftLittleProximal',
  LEFT_LITTLE_INTERMEDIATE = 'leftLittleIntermediate',
  LEFT_LITTLE_DISTAL = 'leftLittleDistal',

  RIGHT_THUMB_PROXIMAL = 'rightThumbProximal',
  RIGHT_THUMB_INTERMEDIATE = 'rightThumbIntermediate',
  RIGHT_THUMB_DISTAL = 'rightThumbDistal',
  RIGHT_INDEX_PROXIMAL = 'rightIndexProximal',
  RIGHT_INDEX_INTERMEDIATE = 'rightIndexIntermediate',
  RIGHT_INDEX_DISTAL = 'rightIndexDistal',
  RIGHT_MIDDLE_PROXIMAL = 'rightMiddleProximal',
  RIGHT_MIDDLE_INTERMEDIATE = 'rightMiddleIntermediate',
  RIGHT_MIDDLE_DISTAL = 'rightMiddleDistal',
  RIGHT_RING_PROXIMAL = 'rightRingProximal',
  RIGHT_RING_INTERMEDIATE = 'rightRingIntermediate',
  RIGHT_RING_DISTAL = 'rightRingDistal',
  RIGHT_LITTLE_PROXIMAL = 'rightLittleProximal',
  RIGHT_LITTLE_INTERMEDIATE = 'rightLittleIntermediate',
  RIGHT_LITTLE_DISTAL = 'rightLittleDistal',
}

/**
 * Bone rotation in avatar space
 */
export interface BoneRotation {
  boneName: HumanoidBone;
  rotation: { x: number; y: number; z: number; w: number }; // Quaternion
}

/**
 * Complete pose for the avatar skeleton
 */
export interface AvatarPose {
  /** Root position offset (for translation) */
  rootPosition: { x: number; y: number; z: number };
  /** Bone rotations */
  boneRotations: Map<HumanoidBone, BoneRotation>;
  /** Timestamp of the source tracking frame */
  timestamp: number;
  /** Tracking confidence (for fading/freezing) */
  confidence: number;
}

/**
 * Skeleton structure definition
 */
export interface SkeletonDefinition {
  /** Bone hierarchy (parent -> children) */
  hierarchy: Map<HumanoidBone, HumanoidBone[]>;
  /** Rest pose rotations */
  restPose: Map<HumanoidBone, { x: number; y: number; z: number; w: number }>;
  /** Bone lengths (for IK) */
  boneLengths: Map<HumanoidBone, number>;
}

/**
 * Retargeting configuration
 */
export interface RetargetConfig {
  /** Enable arm retargeting */
  enableArms: boolean;
  /** Enable leg retargeting */
  enableLegs: boolean;
  /** Enable spine/torso retargeting */
  enableSpine: boolean;
  /** Enable head/neck retargeting */
  enableHead: boolean;
  /** Enable finger retargeting (from hand landmarks) */
  enableFingers: boolean;
  /** Mirror mode (flip X axis for mirror effect) */
  mirrorMode: boolean;
  /** Rotation limits for each bone */
  rotationLimits?: Map<HumanoidBone, { min: Vector3; max: Vector3 }>;
}

export const DEFAULT_RETARGET_CONFIG: RetargetConfig = {
  enableArms: true,
  enableLegs: true,
  enableSpine: true,
  enableHead: true,
  enableFingers: false, // Expensive, disable by default
  mirrorMode: true,
};

/**
 * MediaPipe pose landmark index to bone mapping
 */
export const POSE_TO_BONE_MAP: Record<number, HumanoidBone[]> = {
  // Shoulders - used to calculate upper arm rotation
  11: [HumanoidBone.LEFT_SHOULDER, HumanoidBone.LEFT_UPPER_ARM],
  12: [HumanoidBone.RIGHT_SHOULDER, HumanoidBone.RIGHT_UPPER_ARM],
  // Elbows - used to calculate lower arm rotation
  13: [HumanoidBone.LEFT_LOWER_ARM],
  14: [HumanoidBone.RIGHT_LOWER_ARM],
  // Wrists - used as hand target
  15: [HumanoidBone.LEFT_HAND],
  16: [HumanoidBone.RIGHT_HAND],
  // Hips
  23: [HumanoidBone.LEFT_UPPER_LEG],
  24: [HumanoidBone.RIGHT_UPPER_LEG],
  // Knees
  25: [HumanoidBone.LEFT_LOWER_LEG],
  26: [HumanoidBone.RIGHT_LOWER_LEG],
  // Ankles
  27: [HumanoidBone.LEFT_FOOT],
  28: [HumanoidBone.RIGHT_FOOT],
};
