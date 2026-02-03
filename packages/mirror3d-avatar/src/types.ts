/**
 * @fileoverview Types for the avatar system
 */

import type { Object3D, SkinnedMesh, Bone, AnimationClip } from 'three';

/**
 * User profile containing body measurements and personalization
 */
export interface UserProfile {
  /** Unique identifier */
  id: string;
  /** Display name */
  name?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last modified timestamp */
  updatedAt: string;

  /** Body scaling parameters (normalized, 1.0 = default) */
  bodyScales: BodyScales;

  /** Optional face texture from user photo (base64 data URL) */
  faceTexture?: string;

  /** Captured photos during onboarding */
  capturedPhotos?: {
    front?: string;
    side?: string;
    angle45?: string;
  };

  /** Auto-estimated measurements (can be manually adjusted) */
  measurements?: {
    /** Estimated height in cm */
    heightCm?: number;
    /** Shoulder width in cm */
    shoulderWidthCm?: number;
    /** Chest circumference in cm */
    chestCm?: number;
    /** Waist circumference in cm */
    waistCm?: number;
    /** Hip circumference in cm */
    hipCm?: number;
  };
}

/**
 * Body scaling parameters for avatar customization
 */
export interface BodyScales {
  /** Overall height scale (0.8 - 1.2) */
  height: number;
  /** Shoulder width scale (0.8 - 1.3) */
  shoulderWidth: number;
  /** Torso/chest scale (0.8 - 1.3) */
  torsoWidth: number;
  /** Hip width scale (0.8 - 1.3) */
  hipWidth: number;
  /** Arm length scale (0.9 - 1.1) */
  armLength: number;
  /** Leg length scale (0.9 - 1.1) */
  legLength: number;
  /** Head size scale (0.9 - 1.1) */
  headSize: number;
}

/**
 * Default body scales (average human proportions)
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
 * Create a new empty user profile
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
 * Avatar model data loaded from GLB
 */
export interface AvatarModel {
  /** Root scene object */
  scene: Object3D;
  /** All skinned meshes in the model */
  skinnedMeshes: SkinnedMesh[];
  /** Skeleton root bone */
  skeleton: Bone | null;
  /** Bone name to Bone object mapping */
  boneMap: Map<string, Bone>;
  /** Original bone positions (for scaling reset) */
  originalBonePositions: Map<string, { x: number; y: number; z: number }>;
  /** Any included animations */
  animations: AnimationClip[];
}

/**
 * Avatar bone name aliases for different rig conventions
 * Maps common conventions (Mixamo, VRM, etc.) to our standard names
 */
export const BONE_NAME_ALIASES: Record<string, string[]> = {
  hips: ['Hips', 'pelvis', 'Pelvis', 'mixamorigHips', 'J_Bip_C_Hips'],
  spine: ['Spine', 'spine1', 'Spine1', 'mixamorigSpine', 'J_Bip_C_Spine'],
  spine1: ['Spine1', 'spine2', 'Spine2', 'mixamorigSpine1'],
  spine2: ['Spine2', 'spine3', 'Spine3', 'mixamorigSpine2'],
  chest: ['Chest', 'chest', 'mixamorigSpine1', 'J_Bip_C_Chest'],
  upperChest: ['UpperChest', 'upper_chest', 'mixamorigSpine2', 'J_Bip_C_UpperChest'],
  neck: ['Neck', 'neck', 'mixamorigNeck', 'J_Bip_C_Neck'],
  head: ['Head', 'head', 'mixamorigHead', 'J_Bip_C_Head'],

  leftShoulder: ['LeftShoulder', 'shoulder_L', 'mixamorigLeftShoulder', 'J_Bip_L_Shoulder'],
  leftUpperArm: ['LeftUpperArm', 'upper_arm_L', 'mixamorigLeftArm', 'J_Bip_L_UpperArm'],
  leftLowerArm: ['LeftLowerArm', 'lower_arm_L', 'forearm_L', 'mixamorigLeftForeArm', 'J_Bip_L_LowerArm'],
  leftHand: ['LeftHand', 'hand_L', 'mixamorigLeftHand', 'J_Bip_L_Hand'],

  rightShoulder: ['RightShoulder', 'shoulder_R', 'mixamorigRightShoulder', 'J_Bip_R_Shoulder'],
  rightUpperArm: ['RightUpperArm', 'upper_arm_R', 'mixamorigRightArm', 'J_Bip_R_UpperArm'],
  rightLowerArm: ['RightLowerArm', 'lower_arm_R', 'forearm_R', 'mixamorigRightForeArm', 'J_Bip_R_LowerArm'],
  rightHand: ['RightHand', 'hand_R', 'mixamorigRightHand', 'J_Bip_R_Hand'],

  leftUpperLeg: ['LeftUpperLeg', 'thigh_L', 'upper_leg_L', 'mixamorigLeftUpLeg', 'J_Bip_L_UpperLeg'],
  leftLowerLeg: ['LeftLowerLeg', 'shin_L', 'lower_leg_L', 'mixamorigLeftLeg', 'J_Bip_L_LowerLeg'],
  leftFoot: ['LeftFoot', 'foot_L', 'mixamorigLeftFoot', 'J_Bip_L_Foot'],
  leftToes: ['LeftToes', 'toe_L', 'mixamorigLeftToeBase', 'J_Bip_L_ToeBase'],

  rightUpperLeg: ['RightUpperLeg', 'thigh_R', 'upper_leg_R', 'mixamorigRightUpLeg', 'J_Bip_R_UpperLeg'],
  rightLowerLeg: ['RightLowerLeg', 'shin_R', 'lower_leg_R', 'mixamorigRightLeg', 'J_Bip_R_LowerLeg'],
  rightFoot: ['RightFoot', 'foot_R', 'mixamorigRightFoot', 'J_Bip_R_Foot'],
  rightToes: ['RightToes', 'toe_R', 'mixamorigRightToeBase', 'J_Bip_R_ToeBase'],
};

/**
 * Body estimation from pose landmarks
 */
export interface BodyEstimation {
  /** Estimated height ratio (relative to reference) */
  heightRatio: number;
  /** Estimated shoulder width ratio */
  shoulderWidthRatio: number;
  /** Estimated torso width ratio */
  torsoWidthRatio: number;
  /** Estimated hip width ratio */
  hipWidthRatio: number;
  /** Confidence score for the estimation */
  confidence: number;
}
