/**
 * @fileoverview Avatar manager for loading, scaling, and posing 3D avatars
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HumanoidBone, type AvatarPose } from '@mirrorx/mirror3d-retarget';
import {
  type AvatarModel,
  type UserProfile,
  type BodyScales,
  BONE_NAME_ALIASES,
  DEFAULT_BODY_SCALES,
} from './types';

/**
 * Manages 3D avatar loading, scaling, and pose application
 */
export class AvatarManager {
  private loader: GLTFLoader;
  private currentModel: AvatarModel | null = null;
  private userProfile: UserProfile | null = null;

  // Pose interpolation
  private currentPose: Map<string, THREE.Quaternion> = new Map();
  private targetPose: Map<string, THREE.Quaternion> = new Map();
  private poseBlendFactor = 0.3; // How fast to blend to target pose

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Load an avatar model from a GLB file
   */
  async loadAvatar(url: string): Promise<AvatarModel> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const model = this.processLoadedModel(gltf);
          this.currentModel = model;
          resolve(model);
        },
        undefined,
        (error) => {
          console.error('[AvatarManager] Failed to load avatar:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Process a loaded GLTF model into our AvatarModel format
   */
  private processLoadedModel(gltf: any): AvatarModel {
    const scene = gltf.scene;
    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    const boneMap = new Map<string, THREE.Bone>();
    const originalBonePositions = new Map<string, { x: number; y: number; z: number }>();
    let skeleton: THREE.Bone | null = null;

    // Traverse the scene to find all skinned meshes and bones
    scene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        skinnedMeshes.push(mesh);

        // Ensure mesh casts shadows
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Get skeleton from first skinned mesh
        if (!skeleton && mesh.skeleton?.bones?.length > 0) {
          skeleton = mesh.skeleton.bones[0];
          while (skeleton.parent && (skeleton.parent as THREE.Bone).isBone) {
            skeleton = skeleton.parent as THREE.Bone;
          }
        }
      }

      if ((child as THREE.Bone).isBone) {
        const bone = child as THREE.Bone;

        // Store original bone position for scaling reset
        originalBonePositions.set(bone.name, {
          x: bone.position.x,
          y: bone.position.y,
          z: bone.position.z,
        });

        // Map bone using standard name
        const standardName = this.getStandardBoneName(bone.name);
        if (standardName) {
          boneMap.set(standardName, bone);
        }
        // Also map by original name for direct access
        boneMap.set(bone.name, bone);
      }
    });

    console.log('[AvatarManager] Loaded model with', skinnedMeshes.length, 'meshes and', boneMap.size, 'bones');

    return {
      scene,
      skinnedMeshes,
      skeleton,
      boneMap,
      originalBonePositions,
      animations: gltf.animations || [],
    };
  }

  /**
   * Convert a rig-specific bone name to our standard naming
   */
  private getStandardBoneName(boneName: string): string | null {
    for (const [standard, aliases] of Object.entries(BONE_NAME_ALIASES)) {
      if (boneName.toLowerCase() === standard.toLowerCase()) {
        return standard;
      }
      for (const alias of aliases) {
        if (boneName === alias || boneName.toLowerCase() === alias.toLowerCase()) {
          return standard;
        }
      }
    }
    return null;
  }

  /**
   * Set the user profile for body scaling
   */
  setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    if (this.currentModel) {
      this.applyBodyScales(profile.bodyScales);
    }
  }

  /**
   * Apply body scales to the current avatar
   */
  applyBodyScales(scales: BodyScales): void {
    if (!this.currentModel) {
      console.warn('[AvatarManager] No model loaded to apply scales');
      return;
    }

    const { boneMap, originalBonePositions } = this.currentModel;

    // Reset all bones to original positions first
    for (const [boneName, position] of originalBonePositions) {
      const bone = boneMap.get(boneName);
      if (bone) {
        bone.position.set(position.x, position.y, position.z);
      }
    }

    // Apply height scale to root/hips
    const hips = boneMap.get('hips');
    if (hips) {
      hips.scale.setScalar(scales.height);
    }

    // Apply shoulder width
    const leftShoulder = boneMap.get('leftShoulder');
    const rightShoulder = boneMap.get('rightShoulder');
    if (leftShoulder && rightShoulder) {
      const origLeft = originalBonePositions.get(leftShoulder.name);
      const origRight = originalBonePositions.get(rightShoulder.name);
      if (origLeft && origRight) {
        leftShoulder.position.x = origLeft.x * scales.shoulderWidth;
        rightShoulder.position.x = origRight.x * scales.shoulderWidth;
      }
    }

    // Apply torso width to spine bones
    const chest = boneMap.get('chest') || boneMap.get('spine1');
    if (chest) {
      chest.scale.x = scales.torsoWidth;
      chest.scale.z = scales.torsoWidth;
    }

    // Apply hip width
    const leftUpperLeg = boneMap.get('leftUpperLeg');
    const rightUpperLeg = boneMap.get('rightUpperLeg');
    if (leftUpperLeg && rightUpperLeg) {
      const origLeft = originalBonePositions.get(leftUpperLeg.name);
      const origRight = originalBonePositions.get(rightUpperLeg.name);
      if (origLeft && origRight) {
        leftUpperLeg.position.x = origLeft.x * scales.hipWidth;
        rightUpperLeg.position.x = origRight.x * scales.hipWidth;
      }
    }

    // Apply arm length
    const armBones = ['leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm'];
    for (const boneName of armBones) {
      const bone = boneMap.get(boneName);
      if (bone) {
        bone.scale.y = scales.armLength;
      }
    }

    // Apply leg length
    const legBones = ['leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg'];
    for (const boneName of legBones) {
      const bone = boneMap.get(boneName);
      if (bone) {
        bone.scale.y = scales.legLength;
      }
    }

    // Apply head size
    const head = boneMap.get('head');
    if (head) {
      head.scale.setScalar(scales.headSize);
    }

    // Update skeleton for all skinned meshes
    for (const mesh of this.currentModel.skinnedMeshes) {
      mesh.skeleton.update();
    }
  }

  /**
   * Apply a pose from the pose solver to the avatar
   */
  applyPose(pose: AvatarPose): void {
    if (!this.currentModel) return;

    const { boneMap } = this.currentModel;

    // Update target pose
    for (const [boneName, rotation] of pose.boneRotations) {
      const bone = boneMap.get(boneName);
      if (bone) {
        // Store target quaternion
        let targetQuat = this.targetPose.get(boneName);
        if (!targetQuat) {
          targetQuat = new THREE.Quaternion();
          this.targetPose.set(boneName, targetQuat);
        }
        targetQuat.set(rotation.rotation.x, rotation.rotation.y, rotation.rotation.z, rotation.rotation.w);
      }
    }

    // Interpolate current pose towards target
    this.interpolatePose(pose.confidence);
  }

  /**
   * Smoothly interpolate current pose towards target
   */
  private interpolatePose(confidence: number): void {
    if (!this.currentModel) return;

    const { boneMap } = this.currentModel;

    // Adjust blend factor based on confidence
    const blendFactor = this.poseBlendFactor * confidence;

    for (const [boneName, targetQuat] of this.targetPose) {
      const bone = boneMap.get(boneName);
      if (!bone) continue;

      // Get or create current quaternion
      let currentQuat = this.currentPose.get(boneName);
      if (!currentQuat) {
        currentQuat = bone.quaternion.clone();
        this.currentPose.set(boneName, currentQuat);
      }

      // Slerp towards target
      currentQuat.slerp(targetQuat, blendFactor);

      // Apply to bone
      bone.quaternion.copy(currentQuat);
    }

    // Apply root position with smoothing
    // (Commented out for now - avatar stays in place)
    // if (pose.rootPosition) {
    //   const hips = boneMap.get('hips');
    //   if (hips) {
    //     hips.position.lerp(
    //       new THREE.Vector3(pose.rootPosition.x, pose.rootPosition.y, pose.rootPosition.z),
    //       blendFactor
    //     );
    //   }
    // }
  }

  /**
   * Set pose blending speed (0 = no smoothing, 1 = instant)
   */
  setPoseBlendFactor(factor: number): void {
    this.poseBlendFactor = Math.max(0.01, Math.min(1, factor));
  }

  /**
   * Reset avatar to T-pose
   */
  resetPose(): void {
    if (!this.currentModel) return;

    const { boneMap, originalBonePositions } = this.currentModel;

    // Reset all bone rotations to identity
    for (const [name, bone] of boneMap) {
      bone.quaternion.identity();
    }

    // Clear interpolation state
    this.currentPose.clear();
    this.targetPose.clear();
  }

  /**
   * Get the current model
   */
  getModel(): AvatarModel | null {
    return this.currentModel;
  }

  /**
   * Get the scene object for adding to Three.js scene
   */
  getScene(): THREE.Object3D | null {
    return this.currentModel?.scene ?? null;
  }

  /**
   * Dispose of the current model and free resources
   */
  dispose(): void {
    if (this.currentModel) {
      // Dispose geometries and materials
      for (const mesh of this.currentModel.skinnedMeshes) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }

      // Remove from parent
      this.currentModel.scene.removeFromParent();
      this.currentModel = null;
    }

    this.currentPose.clear();
    this.targetPose.clear();
  }
}
