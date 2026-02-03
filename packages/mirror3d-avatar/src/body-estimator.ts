/**
 * @fileoverview Body measurement estimation from pose landmarks
 */

import { PoseLandmark, type PoseResult, type Landmark3D } from '@mirrorx/mirror3d-tracking';
import type { BodyEstimation, BodyScales } from './types';

/**
 * Reference measurements for a "standard" person
 * These are used to calculate ratios
 */
const REFERENCE = {
  // Approximate ratios based on average human proportions
  shoulderWidthToHeight: 0.26,  // Shoulder width is ~26% of height
  torsoWidthToShoulderWidth: 0.85, // Torso is ~85% of shoulder width
  hipWidthToShoulderWidth: 0.9, // Hips are ~90% of shoulders (varies by gender)
};

/**
 * Estimate body proportions from pose landmarks
 */
export class BodyEstimator {
  private samples: BodyEstimation[] = [];
  private maxSamples = 30; // Number of frames to average

  /**
   * Add a pose sample and update estimation
   */
  addSample(pose: PoseResult): BodyEstimation {
    const landmarks = pose.worldLandmarks;
    const estimation = this.estimateFromLandmarks(landmarks, pose.confidence);

    // Add to samples
    this.samples.push(estimation);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    return estimation;
  }

  /**
   * Estimate body proportions from a single frame of landmarks
   */
  private estimateFromLandmarks(landmarks: Landmark3D[], confidence: number): BodyEstimation {
    // Get key landmarks
    const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const leftHip = landmarks[PoseLandmark.LEFT_HIP];
    const rightHip = landmarks[PoseLandmark.RIGHT_HIP];
    const leftAnkle = landmarks[PoseLandmark.LEFT_ANKLE];
    const rightAnkle = landmarks[PoseLandmark.RIGHT_ANKLE];
    const nose = landmarks[PoseLandmark.NOSE];

    // Calculate distances
    const shoulderWidth = this.distance3D(leftShoulder, rightShoulder);
    const hipWidth = this.distance3D(leftHip, rightHip);

    // Estimate height from nose to ankles
    const ankleCenter = {
      x: (leftAnkle.x + rightAnkle.x) / 2,
      y: (leftAnkle.y + rightAnkle.y) / 2,
      z: (leftAnkle.z + rightAnkle.z) / 2,
    };
    const height = this.distance3D(nose, ankleCenter as Landmark3D) * 1.1; // Add ~10% for head above nose

    // Estimate torso width from shoulder and hip average
    const torsoWidth = (shoulderWidth + hipWidth) / 2;

    // Calculate ratios relative to height
    const heightRatio = 1.0; // We normalize to height
    const shoulderWidthRatio = (shoulderWidth / height) / REFERENCE.shoulderWidthToHeight;
    const hipWidthRatio = (hipWidth / shoulderWidth) / REFERENCE.hipWidthToShoulderWidth;
    const torsoWidthRatio = (torsoWidth / shoulderWidth) / REFERENCE.torsoWidthToShoulderWidth;

    return {
      heightRatio,
      shoulderWidthRatio,
      torsoWidthRatio,
      hipWidthRatio,
      confidence,
    };
  }

  /**
   * Get averaged estimation from all samples
   */
  getAveragedEstimation(): BodyEstimation | null {
    if (this.samples.length === 0) return null;

    // Weight samples by confidence
    let totalWeight = 0;
    const sum = {
      heightRatio: 0,
      shoulderWidthRatio: 0,
      torsoWidthRatio: 0,
      hipWidthRatio: 0,
    };

    for (const sample of this.samples) {
      const weight = sample.confidence;
      totalWeight += weight;
      sum.heightRatio += sample.heightRatio * weight;
      sum.shoulderWidthRatio += sample.shoulderWidthRatio * weight;
      sum.torsoWidthRatio += sample.torsoWidthRatio * weight;
      sum.hipWidthRatio += sample.hipWidthRatio * weight;
    }

    if (totalWeight === 0) return null;

    return {
      heightRatio: sum.heightRatio / totalWeight,
      shoulderWidthRatio: sum.shoulderWidthRatio / totalWeight,
      torsoWidthRatio: sum.torsoWidthRatio / totalWeight,
      hipWidthRatio: sum.hipWidthRatio / totalWeight,
      confidence: totalWeight / this.samples.length,
    };
  }

  /**
   * Convert estimation to body scales for avatar
   */
  estimationToScales(estimation: BodyEstimation): BodyScales {
    // Clamp ratios to reasonable ranges and convert to scales
    return {
      height: this.clamp(estimation.heightRatio, 0.8, 1.2),
      shoulderWidth: this.clamp(estimation.shoulderWidthRatio, 0.8, 1.3),
      torsoWidth: this.clamp(estimation.torsoWidthRatio, 0.8, 1.3),
      hipWidth: this.clamp(estimation.hipWidthRatio, 0.8, 1.3),
      armLength: 1.0, // Can't reliably estimate from pose alone
      legLength: 1.0,
      headSize: 1.0,
    };
  }

  /**
   * Clear all samples
   */
  reset(): void {
    this.samples = [];
  }

  /**
   * Calculate 3D distance between two landmarks
   */
  private distance3D(a: Landmark3D, b: Landmark3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Clamp a value to a range
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

/**
 * Quick body estimation from a single pose
 */
export function estimateBodyScalesFromPose(pose: PoseResult): BodyScales {
  const estimator = new BodyEstimator();
  const estimation = estimator.addSample(pose);
  return estimator.estimationToScales(estimation);
}
