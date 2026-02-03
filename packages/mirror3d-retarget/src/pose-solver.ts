/**
 * @fileoverview Pose solver that converts MediaPipe landmarks to avatar bone rotations
 */

import { PoseLandmark, type TrackingFrame, type Landmark3D, type HandResult } from '@mirrorx/mirror3d-tracking';
import { HumanoidBone, type AvatarPose, type RetargetConfig, DEFAULT_RETARGET_CONFIG } from './types';
import { Vec3, Quat, solveTwoBoneIK, lookAtRotation } from './math';

/**
 * Maps MediaPipe pose landmarks to humanoid avatar bone rotations
 */
export class PoseSolver {
  private config: RetargetConfig;
  private lastPose: AvatarPose | null = null;
  private confidenceThreshold = 0.3;

  constructor(config: Partial<RetargetConfig> = {}) {
    this.config = { ...DEFAULT_RETARGET_CONFIG, ...config };
  }

  /**
   * Solve avatar pose from tracking frame
   */
  solve(frame: TrackingFrame): AvatarPose | null {
    if (!frame.pose || frame.pose.confidence < this.confidenceThreshold) {
      // Return last pose with reduced confidence for smooth fallback
      if (this.lastPose) {
        return {
          ...this.lastPose,
          confidence: this.lastPose.confidence * 0.95,
        };
      }
      return null;
    }

    const landmarks = frame.pose.worldLandmarks;
    const boneRotations = new Map<HumanoidBone, { boneName: HumanoidBone; rotation: { x: number; y: number; z: number; w: number } }>();

    // Convert landmarks to Vec3 for easier manipulation
    const landmarkVecs = landmarks.map((lm) =>
      new Vec3(
        this.config.mirrorMode ? -lm.x : lm.x,
        -lm.y, // MediaPipe Y is inverted
        -lm.z  // MediaPipe Z is depth
      )
    );

    // Calculate root position (hip center)
    const leftHip = landmarkVecs[PoseLandmark.LEFT_HIP];
    const rightHip = landmarkVecs[PoseLandmark.RIGHT_HIP];
    const hipCenter = leftHip.add(rightHip).scale(0.5);

    // Solve spine/torso
    if (this.config.enableSpine) {
      this.solveSpine(landmarkVecs, boneRotations);
    }

    // Solve arms
    if (this.config.enableArms) {
      this.solveArm(landmarkVecs, boneRotations, 'left');
      this.solveArm(landmarkVecs, boneRotations, 'right');
    }

    // Solve legs
    if (this.config.enableLegs) {
      this.solveLeg(landmarkVecs, boneRotations, 'left');
      this.solveLeg(landmarkVecs, boneRotations, 'right');
    }

    // Solve head
    if (this.config.enableHead) {
      this.solveHead(landmarkVecs, boneRotations);
    }

    // Solve fingers if hands are available
    if (this.config.enableFingers) {
      if (frame.leftHand) {
        this.solveFingers(frame.leftHand, boneRotations, 'left');
      }
      if (frame.rightHand) {
        this.solveFingers(frame.rightHand, boneRotations, 'right');
      }
    }

    const pose: AvatarPose = {
      rootPosition: hipCenter.toObject(),
      boneRotations,
      timestamp: frame.pose.timestamp,
      confidence: frame.pose.confidence,
    };

    this.lastPose = pose;
    return pose;
  }

  /**
   * Solve spine rotation from shoulders and hips
   */
  private solveSpine(
    landmarks: Vec3[],
    rotations: Map<HumanoidBone, { boneName: HumanoidBone; rotation: { x: number; y: number; z: number; w: number } }>
  ): void {
    const leftHip = landmarks[PoseLandmark.LEFT_HIP];
    const rightHip = landmarks[PoseLandmark.RIGHT_HIP];
    const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];

    // Hip orientation
    const hipCenter = leftHip.add(rightHip).scale(0.5);
    const hipRight = rightHip.sub(leftHip).normalize();
    const hipForward = new Vec3(0, 0, 1); // Default forward

    // Calculate hip rotation
    const hipUp = new Vec3(0, 1, 0);
    const hipRotation = this.calculateOrientationQuat(hipRight, hipUp, hipForward);

    rotations.set(HumanoidBone.HIPS, {
      boneName: HumanoidBone.HIPS,
      rotation: hipRotation.toObject(),
    });

    // Shoulder orientation
    const shoulderCenter = leftShoulder.add(rightShoulder).scale(0.5);
    const shoulderRight = rightShoulder.sub(leftShoulder).normalize();

    // Spine direction (from hips to shoulders)
    const spineDir = shoulderCenter.sub(hipCenter).normalize();

    // Calculate spine twist from shoulder rotation relative to hips
    const spineRotation = this.calculateOrientationQuat(shoulderRight, spineDir, hipForward);

    rotations.set(HumanoidBone.SPINE, {
      boneName: HumanoidBone.SPINE,
      rotation: spineRotation.toObject(),
    });

    // Upper chest follows shoulders more closely
    rotations.set(HumanoidBone.CHEST, {
      boneName: HumanoidBone.CHEST,
      rotation: spineRotation.toObject(),
    });
  }

  /**
   * Solve arm bones using IK
   */
  private solveArm(
    landmarks: Vec3[],
    rotations: Map<HumanoidBone, { boneName: HumanoidBone; rotation: { x: number; y: number; z: number; w: number } }>,
    side: 'left' | 'right'
  ): void {
    const isLeft = side === 'left';
    const shoulderIdx = isLeft ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER;
    const elbowIdx = isLeft ? PoseLandmark.LEFT_ELBOW : PoseLandmark.RIGHT_ELBOW;
    const wristIdx = isLeft ? PoseLandmark.LEFT_WRIST : PoseLandmark.RIGHT_WRIST;

    const shoulder = landmarks[shoulderIdx];
    const elbow = landmarks[elbowIdx];
    const wrist = landmarks[wristIdx];

    // Upper arm direction
    const upperArmDir = elbow.sub(shoulder).normalize();

    // Calculate upper arm rotation
    // Rest pose: arm pointing down/out at T-pose angle
    const restDir = isLeft ? new Vec3(-1, -0.3, 0).normalize() : new Vec3(1, -0.3, 0).normalize();
    const upperArmRotation = Quat.fromToRotation(restDir, upperArmDir);

    const upperArmBone = isLeft ? HumanoidBone.LEFT_UPPER_ARM : HumanoidBone.RIGHT_UPPER_ARM;
    rotations.set(upperArmBone, {
      boneName: upperArmBone,
      rotation: upperArmRotation.toObject(),
    });

    // Lower arm direction
    const lowerArmDir = wrist.sub(elbow).normalize();

    // Calculate elbow bend (relative to upper arm)
    const lowerArmRotation = Quat.fromToRotation(upperArmDir, lowerArmDir);

    const lowerArmBone = isLeft ? HumanoidBone.LEFT_LOWER_ARM : HumanoidBone.RIGHT_LOWER_ARM;
    rotations.set(lowerArmBone, {
      boneName: lowerArmBone,
      rotation: lowerArmRotation.toObject(),
    });

    // Hand rotation (based on wrist-to-finger direction if available)
    const indexIdx = isLeft ? PoseLandmark.LEFT_INDEX : PoseLandmark.RIGHT_INDEX;
    const pinkyIdx = isLeft ? PoseLandmark.LEFT_PINKY : PoseLandmark.RIGHT_PINKY;

    if (landmarks[indexIdx] && landmarks[pinkyIdx]) {
      const index = landmarks[indexIdx];
      const pinky = landmarks[pinkyIdx];
      const handCenter = index.add(pinky).scale(0.5);
      const handDir = handCenter.sub(wrist).normalize();
      const handRotation = Quat.fromToRotation(lowerArmDir, handDir);

      const handBone = isLeft ? HumanoidBone.LEFT_HAND : HumanoidBone.RIGHT_HAND;
      rotations.set(handBone, {
        boneName: handBone,
        rotation: handRotation.toObject(),
      });
    }
  }

  /**
   * Solve leg bones
   */
  private solveLeg(
    landmarks: Vec3[],
    rotations: Map<HumanoidBone, { boneName: HumanoidBone; rotation: { x: number; y: number; z: number; w: number } }>,
    side: 'left' | 'right'
  ): void {
    const isLeft = side === 'left';
    const hipIdx = isLeft ? PoseLandmark.LEFT_HIP : PoseLandmark.RIGHT_HIP;
    const kneeIdx = isLeft ? PoseLandmark.LEFT_KNEE : PoseLandmark.RIGHT_KNEE;
    const ankleIdx = isLeft ? PoseLandmark.LEFT_ANKLE : PoseLandmark.RIGHT_ANKLE;

    const hip = landmarks[hipIdx];
    const knee = landmarks[kneeIdx];
    const ankle = landmarks[ankleIdx];

    // Upper leg direction
    const upperLegDir = knee.sub(hip).normalize();
    const restDir = new Vec3(0, -1, 0); // Pointing down
    const upperLegRotation = Quat.fromToRotation(restDir, upperLegDir);

    const upperLegBone = isLeft ? HumanoidBone.LEFT_UPPER_LEG : HumanoidBone.RIGHT_UPPER_LEG;
    rotations.set(upperLegBone, {
      boneName: upperLegBone,
      rotation: upperLegRotation.toObject(),
    });

    // Lower leg direction
    const lowerLegDir = ankle.sub(knee).normalize();
    const lowerLegRotation = Quat.fromToRotation(upperLegDir, lowerLegDir);

    const lowerLegBone = isLeft ? HumanoidBone.LEFT_LOWER_LEG : HumanoidBone.RIGHT_LOWER_LEG;
    rotations.set(lowerLegBone, {
      boneName: lowerLegBone,
      rotation: lowerLegRotation.toObject(),
    });

    // Foot rotation
    const footIdx = isLeft ? PoseLandmark.LEFT_FOOT_INDEX : PoseLandmark.RIGHT_FOOT_INDEX;
    if (landmarks[footIdx]) {
      const footTip = landmarks[footIdx];
      const footDir = footTip.sub(ankle).normalize();
      const footRotation = Quat.fromToRotation(new Vec3(0, 0, 1), footDir);

      const footBone = isLeft ? HumanoidBone.LEFT_FOOT : HumanoidBone.RIGHT_FOOT;
      rotations.set(footBone, {
        boneName: footBone,
        rotation: footRotation.toObject(),
      });
    }
  }

  /**
   * Solve head/neck rotation
   */
  private solveHead(
    landmarks: Vec3[],
    rotations: Map<HumanoidBone, { boneName: HumanoidBone; rotation: { x: number; y: number; z: number; w: number } }>
  ): void {
    const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const nose = landmarks[PoseLandmark.NOSE];
    const leftEar = landmarks[PoseLandmark.LEFT_EAR];
    const rightEar = landmarks[PoseLandmark.RIGHT_EAR];

    // Neck base (between shoulders, slightly higher)
    const shoulderCenter = leftShoulder.add(rightShoulder).scale(0.5);
    const neckBase = shoulderCenter.add(new Vec3(0, 0.1, 0));

    // Head center (between ears)
    const headCenter = leftEar.add(rightEar).scale(0.5);

    // Head facing direction (from head center to nose)
    const headForward = nose.sub(headCenter).normalize();

    // Head up direction
    const headUp = headCenter.sub(neckBase).normalize();

    // Calculate head rotation
    const headRotation = lookAtRotation(new Vec3(0, 0, 1), new Vec3(0, 1, 0), headForward);

    // Neck rotation (partial head rotation)
    const neckRotation = Quat.identity().slerp(headRotation, 0.3);

    rotations.set(HumanoidBone.NECK, {
      boneName: HumanoidBone.NECK,
      rotation: neckRotation.toObject(),
    });

    rotations.set(HumanoidBone.HEAD, {
      boneName: HumanoidBone.HEAD,
      rotation: headRotation.toObject(),
    });
  }

  /**
   * Solve finger bones from hand landmarks
   */
  private solveFingers(
    hand: HandResult,
    rotations: Map<HumanoidBone, { boneName: HumanoidBone; rotation: { x: number; y: number; z: number; w: number } }>,
    side: 'left' | 'right'
  ): void {
    const landmarks = hand.landmarks.map((lm) =>
      new Vec3(this.config.mirrorMode ? -lm.x : lm.x, -lm.y, -lm.z)
    );

    // Finger bone mappings
    const fingerMappings = [
      {
        name: 'thumb',
        indices: [1, 2, 3, 4],
        bones: side === 'left'
          ? [HumanoidBone.LEFT_THUMB_PROXIMAL, HumanoidBone.LEFT_THUMB_INTERMEDIATE, HumanoidBone.LEFT_THUMB_DISTAL]
          : [HumanoidBone.RIGHT_THUMB_PROXIMAL, HumanoidBone.RIGHT_THUMB_INTERMEDIATE, HumanoidBone.RIGHT_THUMB_DISTAL],
      },
      {
        name: 'index',
        indices: [5, 6, 7, 8],
        bones: side === 'left'
          ? [HumanoidBone.LEFT_INDEX_PROXIMAL, HumanoidBone.LEFT_INDEX_INTERMEDIATE, HumanoidBone.LEFT_INDEX_DISTAL]
          : [HumanoidBone.RIGHT_INDEX_PROXIMAL, HumanoidBone.RIGHT_INDEX_INTERMEDIATE, HumanoidBone.RIGHT_INDEX_DISTAL],
      },
      {
        name: 'middle',
        indices: [9, 10, 11, 12],
        bones: side === 'left'
          ? [HumanoidBone.LEFT_MIDDLE_PROXIMAL, HumanoidBone.LEFT_MIDDLE_INTERMEDIATE, HumanoidBone.LEFT_MIDDLE_DISTAL]
          : [HumanoidBone.RIGHT_MIDDLE_PROXIMAL, HumanoidBone.RIGHT_MIDDLE_INTERMEDIATE, HumanoidBone.RIGHT_MIDDLE_DISTAL],
      },
      {
        name: 'ring',
        indices: [13, 14, 15, 16],
        bones: side === 'left'
          ? [HumanoidBone.LEFT_RING_PROXIMAL, HumanoidBone.LEFT_RING_INTERMEDIATE, HumanoidBone.LEFT_RING_DISTAL]
          : [HumanoidBone.RIGHT_RING_PROXIMAL, HumanoidBone.RIGHT_RING_INTERMEDIATE, HumanoidBone.RIGHT_RING_DISTAL],
      },
      {
        name: 'little',
        indices: [17, 18, 19, 20],
        bones: side === 'left'
          ? [HumanoidBone.LEFT_LITTLE_PROXIMAL, HumanoidBone.LEFT_LITTLE_INTERMEDIATE, HumanoidBone.LEFT_LITTLE_DISTAL]
          : [HumanoidBone.RIGHT_LITTLE_PROXIMAL, HumanoidBone.RIGHT_LITTLE_INTERMEDIATE, HumanoidBone.RIGHT_LITTLE_DISTAL],
      },
    ];

    for (const finger of fingerMappings) {
      for (let i = 0; i < finger.bones.length; i++) {
        const startIdx = finger.indices[i];
        const endIdx = finger.indices[i + 1];

        if (!landmarks[startIdx] || !landmarks[endIdx]) continue;

        const dir = landmarks[endIdx].sub(landmarks[startIdx]).normalize();
        const restDir = new Vec3(0, -1, 0); // Assuming rest pose is straight down
        const rotation = Quat.fromToRotation(restDir, dir);

        rotations.set(finger.bones[i], {
          boneName: finger.bones[i],
          rotation: rotation.toObject(),
        });
      }
    }
  }

  /**
   * Calculate orientation quaternion from right, up, and forward vectors
   */
  private calculateOrientationQuat(right: Vec3, up: Vec3, forward: Vec3): Quat {
    // Orthonormalize the vectors
    const normalRight = right.normalize();
    const normalUp = up.sub(normalRight.scale(up.dot(normalRight))).normalize();
    const normalForward = normalRight.cross(normalUp);

    // Build rotation matrix and convert to quaternion
    const m00 = normalRight.x, m01 = normalUp.x, m02 = normalForward.x;
    const m10 = normalRight.y, m11 = normalUp.y, m12 = normalForward.y;
    const m20 = normalRight.z, m21 = normalUp.z, m22 = normalForward.z;

    const trace = m00 + m11 + m22;
    let x: number, y: number, z: number, w: number;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      w = 0.25 / s;
      x = (m21 - m12) * s;
      y = (m02 - m20) * s;
      z = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
      w = (m21 - m12) / s;
      x = 0.25 * s;
      y = (m01 + m10) / s;
      z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
      w = (m02 - m20) / s;
      x = (m01 + m10) / s;
      y = 0.25 * s;
      z = (m12 + m21) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
      w = (m10 - m01) / s;
      x = (m02 + m20) / s;
      y = (m12 + m21) / s;
      z = 0.25 * s;
    }

    return new Quat(x, y, z, w).normalize();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RetargetConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set confidence threshold for tracking
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }
}
