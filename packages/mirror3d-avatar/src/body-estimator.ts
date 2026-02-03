/**
 * @fileoverview Enhanced body measurement estimation from pose landmarks
 * Phase 2: Supports detailed measurements and fit prediction
 */

import { PoseLandmark, type PoseResult, type Landmark3D } from '@mirrorx/mirror3d-tracking';
import type {
  BodyEstimation,
  BodyScales,
  BodyMeasurements,
  FitPrediction,
  FitQuality,
  GarmentSizeChart,
} from './types';

/**
 * Reference measurements for a "standard" person (in meters for MediaPipe coordinates)
 * Based on anthropometric data for average adult
 */
const REFERENCE = {
  // Ratios relative to height
  shoulderWidthToHeight: 0.26,     // Shoulder width is ~26% of height
  torsoWidthToShoulderWidth: 0.85, // Torso is ~85% of shoulder width
  hipWidthToShoulderWidth: 0.9,    // Hips are ~90% of shoulders (varies by gender)
  armLengthToHeight: 0.44,         // Arm length is ~44% of height
  legLengthToHeight: 0.47,         // Leg length is ~47% of height
  torsoLengthToHeight: 0.30,       // Torso (neck to hips) is ~30% of height

  // Circumference estimation multipliers (width to circumference)
  chestCircumferenceMultiplier: 2.8,  // Chest circumference ≈ 2.8x shoulder width
  waistCircumferenceMultiplier: 2.2,  // Waist circumference ≈ 2.2x torso width at waist
  hipCircumferenceMultiplier: 2.6,    // Hip circumference ≈ 2.6x hip width
  neckCircumferenceMultiplier: 1.8,   // Neck circumference from shoulder-head distance

  // Standard height for reference (170cm average)
  standardHeightCm: 170,
};

/**
 * Enhanced body measurement estimation from pose landmarks
 */
export class BodyEstimator {
  private samples: BodyEstimation[] = [];
  private maxSamples = 60; // More samples for better accuracy
  private knownHeightCm: number | null = null;
  private measurementHistory: BodyMeasurements[] = [];

  /**
   * Set user's known height for more accurate measurements
   */
  setKnownHeight(heightCm: number): void {
    this.knownHeightCm = heightCm;
  }

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
    const leftWrist = landmarks[PoseLandmark.LEFT_WRIST];
    const rightWrist = landmarks[PoseLandmark.RIGHT_WRIST];
    const leftElbow = landmarks[PoseLandmark.LEFT_ELBOW];
    const rightElbow = landmarks[PoseLandmark.RIGHT_ELBOW];
    const leftKnee = landmarks[PoseLandmark.LEFT_KNEE];
    const rightKnee = landmarks[PoseLandmark.RIGHT_KNEE];
    const nose = landmarks[PoseLandmark.NOSE];
    const neck = this.estimateNeckPosition(landmarks);

    // Calculate key distances
    const shoulderWidth = this.distance3D(leftShoulder, rightShoulder);
    const hipWidth = this.distance3D(leftHip, rightHip);

    // Estimate height from nose to ankles
    const ankleCenter = this.midpoint(leftAnkle, rightAnkle);
    const height = this.distance3D(nose, ankleCenter) * 1.1; // Add ~10% for head above nose

    // Estimate torso width from shoulder and hip average
    const torsoWidth = (shoulderWidth + hipWidth) / 2;

    // Calculate arm length (average of both arms)
    const leftArmLength = this.distance3D(leftShoulder, leftElbow) +
                          this.distance3D(leftElbow, leftWrist);
    const rightArmLength = this.distance3D(rightShoulder, rightElbow) +
                           this.distance3D(rightElbow, rightWrist);
    const armLength = (leftArmLength + rightArmLength) / 2;

    // Calculate leg length (average of both legs)
    const leftLegLength = this.distance3D(leftHip, leftKnee) +
                          this.distance3D(leftKnee, leftAnkle);
    const rightLegLength = this.distance3D(rightHip, rightKnee) +
                           this.distance3D(rightKnee, rightAnkle);
    const legLength = (leftLegLength + rightLegLength) / 2;

    // Calculate torso length (neck to hip center)
    const hipCenter = this.midpoint(leftHip, rightHip);
    const torsoLength = this.distance3D(neck, hipCenter);

    // Calculate ratios relative to reference proportions
    const heightRatio = 1.0; // Normalize to height
    const shoulderWidthRatio = (shoulderWidth / height) / REFERENCE.shoulderWidthToHeight;
    const hipWidthRatio = (hipWidth / shoulderWidth) / REFERENCE.hipWidthToShoulderWidth;
    const torsoWidthRatio = (torsoWidth / shoulderWidth) / REFERENCE.torsoWidthToShoulderWidth;
    const armLengthRatio = (armLength / height) / REFERENCE.armLengthToHeight;
    const legLengthRatio = (legLength / height) / REFERENCE.legLengthToHeight;
    const torsoLengthRatio = (torsoLength / height) / REFERENCE.torsoLengthToHeight;

    return {
      heightRatio,
      shoulderWidthRatio,
      torsoWidthRatio,
      hipWidthRatio,
      armLengthRatio,
      legLengthRatio,
      torsoLengthRatio,
      confidence,
    };
  }

  /**
   * Estimate neck position from landmarks (midpoint between shoulders, slightly up)
   */
  private estimateNeckPosition(landmarks: Landmark3D[]): Landmark3D {
    const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER];
    const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const nose = landmarks[PoseLandmark.NOSE];

    const shoulderMid = this.midpoint(leftShoulder, rightShoulder);

    // Neck is approximately 70% of the way from shoulders to nose
    return {
      x: shoulderMid.x * 0.7 + nose.x * 0.3,
      y: shoulderMid.y * 0.7 + nose.y * 0.3,
      z: shoulderMid.z * 0.7 + nose.z * 0.3,
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
      armLengthRatio: 0,
      legLengthRatio: 0,
      torsoLengthRatio: 0,
    };

    for (const sample of this.samples) {
      const weight = sample.confidence;
      totalWeight += weight;
      sum.heightRatio += sample.heightRatio * weight;
      sum.shoulderWidthRatio += sample.shoulderWidthRatio * weight;
      sum.torsoWidthRatio += sample.torsoWidthRatio * weight;
      sum.hipWidthRatio += sample.hipWidthRatio * weight;
      sum.armLengthRatio += sample.armLengthRatio * weight;
      sum.legLengthRatio += sample.legLengthRatio * weight;
      sum.torsoLengthRatio += sample.torsoLengthRatio * weight;
    }

    if (totalWeight === 0) return null;

    return {
      heightRatio: sum.heightRatio / totalWeight,
      shoulderWidthRatio: sum.shoulderWidthRatio / totalWeight,
      torsoWidthRatio: sum.torsoWidthRatio / totalWeight,
      hipWidthRatio: sum.hipWidthRatio / totalWeight,
      armLengthRatio: sum.armLengthRatio / totalWeight,
      legLengthRatio: sum.legLengthRatio / totalWeight,
      torsoLengthRatio: sum.torsoLengthRatio / totalWeight,
      confidence: totalWeight / this.samples.length,
    };
  }

  /**
   * Convert estimation to body scales for avatar
   */
  estimationToScales(estimation: BodyEstimation): BodyScales {
    return {
      height: this.clamp(estimation.heightRatio, 0.8, 1.2),
      shoulderWidth: this.clamp(estimation.shoulderWidthRatio, 0.8, 1.3),
      torsoWidth: this.clamp(estimation.torsoWidthRatio, 0.8, 1.3),
      hipWidth: this.clamp(estimation.hipWidthRatio, 0.8, 1.3),
      armLength: this.clamp(estimation.armLengthRatio, 0.85, 1.15),
      legLength: this.clamp(estimation.legLengthRatio, 0.85, 1.15),
      headSize: 1.0, // Keep head size constant
    };
  }

  /**
   * Calculate detailed body measurements in centimeters
   * Requires known height for accurate absolute measurements
   */
  calculateMeasurements(estimation: BodyEstimation): BodyMeasurements {
    const baseHeightCm = this.knownHeightCm || REFERENCE.standardHeightCm;

    // Calculate base dimensions
    const heightCm = baseHeightCm * estimation.heightRatio;
    const shoulderWidthCm = heightCm * REFERENCE.shoulderWidthToHeight * estimation.shoulderWidthRatio;
    const torsoWidthCm = shoulderWidthCm * REFERENCE.torsoWidthToShoulderWidth * estimation.torsoWidthRatio;
    const hipWidthCm = shoulderWidthCm * REFERENCE.hipWidthToShoulderWidth * estimation.hipWidthRatio;

    // Calculate arm and leg lengths
    const armLengthCm = heightCm * REFERENCE.armLengthToHeight * estimation.armLengthRatio;
    const inseamCm = heightCm * REFERENCE.legLengthToHeight * estimation.legLengthRatio;
    const torsoLengthCm = heightCm * REFERENCE.torsoLengthToHeight * estimation.torsoLengthRatio;

    // Estimate circumferences from widths
    const chestCircumferenceCm = shoulderWidthCm * REFERENCE.chestCircumferenceMultiplier;
    const waistCircumferenceCm = torsoWidthCm * REFERENCE.waistCircumferenceMultiplier;
    const hipCircumferenceCm = hipWidthCm * REFERENCE.hipCircumferenceMultiplier;
    const neckCircumferenceCm = shoulderWidthCm * 0.4 * REFERENCE.neckCircumferenceMultiplier;

    // Calculate confidence scores
    const baseConfidence = estimation.confidence;
    const confidences = {
      height: this.knownHeightCm ? 1.0 : baseConfidence * 0.7,
      shoulderWidth: baseConfidence * 0.9,
      chestCircumference: baseConfidence * 0.6, // Estimated, lower confidence
      waistCircumference: baseConfidence * 0.5, // Estimated, lower confidence
      hipCircumference: baseConfidence * 0.6,   // Estimated, lower confidence
      armLength: baseConfidence * 0.85,
      inseam: baseConfidence * 0.85,
      torsoLength: baseConfidence * 0.8,
      neckCircumference: baseConfidence * 0.5,  // Estimated, lower confidence
    };

    const overallConfidence = Object.values(confidences).reduce((a, b) => a + b, 0) /
                              Object.values(confidences).length;

    const measurements: BodyMeasurements = {
      heightCm: Math.round(heightCm),
      shoulderWidthCm: Math.round(shoulderWidthCm * 10) / 10,
      chestCircumferenceCm: Math.round(chestCircumferenceCm),
      waistCircumferenceCm: Math.round(waistCircumferenceCm),
      hipCircumferenceCm: Math.round(hipCircumferenceCm),
      armLengthCm: Math.round(armLengthCm * 10) / 10,
      inseamCm: Math.round(inseamCm * 10) / 10,
      torsoLengthCm: Math.round(torsoLengthCm * 10) / 10,
      neckCircumferenceCm: Math.round(neckCircumferenceCm * 10) / 10,
      confidences,
      overallConfidence,
    };

    // Store in history
    this.measurementHistory.push(measurements);
    if (this.measurementHistory.length > 10) {
      this.measurementHistory.shift();
    }

    return measurements;
  }

  /**
   * Get averaged measurements from history
   */
  getAveragedMeasurements(): BodyMeasurements | null {
    if (this.measurementHistory.length === 0) return null;
    if (this.measurementHistory.length === 1) return this.measurementHistory[0];

    // Average all measurements weighted by confidence
    const avg: Partial<BodyMeasurements> = {};
    let totalWeight = 0;

    const keys: (keyof Omit<BodyMeasurements, 'confidences' | 'overallConfidence'>)[] = [
      'heightCm', 'shoulderWidthCm', 'chestCircumferenceCm', 'waistCircumferenceCm',
      'hipCircumferenceCm', 'armLengthCm', 'inseamCm', 'torsoLengthCm', 'neckCircumferenceCm'
    ];

    for (const m of this.measurementHistory) {
      totalWeight += m.overallConfidence;
    }

    for (const key of keys) {
      let sum = 0;
      for (const m of this.measurementHistory) {
        sum += (m[key] as number) * m.overallConfidence;
      }
      (avg as any)[key] = Math.round((sum / totalWeight) * 10) / 10;
    }

    // Use latest confidences
    const latest = this.measurementHistory[this.measurementHistory.length - 1];
    avg.confidences = latest.confidences;
    avg.overallConfidence = totalWeight / this.measurementHistory.length;

    return avg as BodyMeasurements;
  }

  /**
   * Predict fit for a garment based on body measurements
   */
  predictFit(measurements: BodyMeasurements, sizeChart: GarmentSizeChart): FitPrediction {
    const sizes = Object.keys(sizeChart.sizes);
    const fitScores: Array<{ size: string; score: number; details: FitPrediction['fitDetails'] }> = [];

    for (const size of sizes) {
      const sizeData = sizeChart.sizes[size];
      const details = this.calculateFitDetails(measurements, sizeData, sizeChart.category);
      const score = this.calculateOverallFitScore(details);
      fitScores.push({ size, score, details });
    }

    // Sort by score (highest first)
    fitScores.sort((a, b) => b.score - a.score);

    const best = fitScores[0];
    const alternatives = fitScores.slice(1, 3).map(f => ({
      size: f.size,
      fitScore: f.score,
      notes: this.generateFitNotes(f.details),
    }));

    return {
      recommendedSize: best.size,
      confidence: best.score / 100,
      fitDetails: best.details,
      alternatives,
    };
  }

  /**
   * Calculate fit details for a specific size
   */
  private calculateFitDetails(
    measurements: BodyMeasurements,
    sizeData: GarmentSizeChart['sizes'][string],
    category: GarmentSizeChart['category']
  ): FitPrediction['fitDetails'] {
    const details: FitPrediction['fitDetails'] = {
      shoulders: this.assessFit(
        measurements.shoulderWidthCm,
        sizeData.shoulderWidthCm ? sizeData.shoulderWidthCm - 2 : undefined,
        sizeData.shoulderWidthCm ? sizeData.shoulderWidthCm + 2 : undefined
      ),
      chest: this.assessFit(
        measurements.chestCircumferenceCm,
        sizeData.chestMin,
        sizeData.chestMax
      ),
      waist: this.assessFit(
        measurements.waistCircumferenceCm,
        sizeData.waistMin,
        sizeData.waistMax
      ),
      hips: this.assessFit(
        measurements.hipCircumferenceCm,
        sizeData.hipMin,
        sizeData.hipMax
      ),
      length: this.assessFit(
        measurements.torsoLengthCm,
        sizeData.lengthCm ? sizeData.lengthCm - 3 : undefined,
        sizeData.lengthCm ? sizeData.lengthCm + 3 : undefined
      ),
    };

    // Add sleeves for tops/outerwear
    if (category === 'tops' || category === 'outerwear') {
      details.sleeves = this.assessFit(
        measurements.armLengthCm,
        sizeData.sleeveLengthCm ? sizeData.sleeveLengthCm - 3 : undefined,
        sizeData.sleeveLengthCm ? sizeData.sleeveLengthCm + 3 : undefined
      );
    }

    // Add inseam for bottoms
    if (category === 'bottoms') {
      details.inseam = this.assessFit(
        measurements.inseamCm,
        sizeData.inseamCm ? sizeData.inseamCm - 3 : undefined,
        sizeData.inseamCm ? sizeData.inseamCm + 3 : undefined
      );
    }

    return details;
  }

  /**
   * Assess fit quality for a single measurement
   */
  private assessFit(measurement: number, min?: number, max?: number): FitQuality {
    // If no size data, assume perfect fit
    if (min === undefined && max === undefined) {
      return { status: 'perfect', differenceCm: 0, score: 100 };
    }

    const mid = ((min || 0) + (max || min || measurement)) / 2;
    const range = max && min ? (max - min) / 2 : 5;
    const diff = measurement - mid;

    let status: FitQuality['status'];
    let score: number;

    if (Math.abs(diff) <= range * 0.3) {
      status = 'perfect';
      score = 100 - Math.abs(diff) * 2;
    } else if (diff < -range * 0.6) {
      status = 'tight';
      score = Math.max(0, 50 - Math.abs(diff) * 3);
    } else if (diff < -range * 0.3) {
      status = 'slightly_tight';
      score = Math.max(0, 70 - Math.abs(diff) * 2);
    } else if (diff > range * 0.6) {
      status = 'loose';
      score = Math.max(0, 50 - Math.abs(diff) * 3);
    } else {
      status = 'slightly_loose';
      score = Math.max(0, 70 - Math.abs(diff) * 2);
    }

    return {
      status,
      differenceCm: Math.round(diff * 10) / 10,
      score: Math.round(score),
    };
  }

  /**
   * Calculate overall fit score from details
   */
  private calculateOverallFitScore(details: FitPrediction['fitDetails']): number {
    const weights: Record<string, number> = {
      shoulders: 1.5,
      chest: 2.0,
      waist: 1.5,
      hips: 1.5,
      length: 1.0,
      sleeves: 0.8,
      inseam: 1.0,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, quality] of Object.entries(details)) {
      if (quality) {
        const weight = weights[key] || 1.0;
        totalScore += quality.score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * Generate human-readable fit notes
   */
  private generateFitNotes(details: FitPrediction['fitDetails']): string {
    const notes: string[] = [];

    for (const [area, quality] of Object.entries(details)) {
      if (quality && quality.status !== 'perfect') {
        const areaName = area.charAt(0).toUpperCase() + area.slice(1);
        notes.push(`${areaName}: ${quality.status.replace('_', ' ')}`);
      }
    }

    return notes.length > 0 ? notes.join(', ') : 'Good fit overall';
  }

  /**
   * Clear all samples
   */
  reset(): void {
    this.samples = [];
    this.measurementHistory = [];
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
   * Calculate midpoint between two landmarks
   */
  private midpoint(a: Landmark3D, b: Landmark3D): Landmark3D {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
    };
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

/**
 * Quick body measurements from a single pose
 */
export function estimateMeasurementsFromPose(
  pose: PoseResult,
  knownHeightCm?: number
): BodyMeasurements {
  const estimator = new BodyEstimator();
  if (knownHeightCm) {
    estimator.setKnownHeight(knownHeightCm);
  }
  const estimation = estimator.addSample(pose);
  return estimator.calculateMeasurements(estimation);
}
