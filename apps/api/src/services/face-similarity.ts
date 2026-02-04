/**
 * @fileoverview Face Similarity Utilities
 *
 * Provides utility functions for face comparison, validation,
 * and quality assessment for the virtual try-on system.
 *
 * These utilities complement the face-restoration.ts service
 * by providing quick validation checks and thresholds.
 */

/**
 * Face similarity thresholds for different quality levels
 */
export const FACE_SIMILARITY_THRESHOLDS = {
  /** Excellent - faces are nearly identical */
  EXCELLENT: 0.95,
  /** Good - faces are very similar, acceptable for production */
  GOOD: 0.90,
  /** Acceptable - faces are similar enough, may need restoration */
  ACCEPTABLE: 0.85,
  /** Poor - faces are different, restoration required */
  POOR: 0.80,
  /** Failed - faces are too different, regeneration needed */
  FAILED: 0.70,
} as const;

/**
 * Face quality levels based on similarity score
 */
export type FaceQualityLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'failed';

/**
 * Get the quality level based on similarity score
 */
export function getFaceQualityLevel(similarityScore: number): FaceQualityLevel {
  if (similarityScore >= FACE_SIMILARITY_THRESHOLDS.EXCELLENT) return 'excellent';
  if (similarityScore >= FACE_SIMILARITY_THRESHOLDS.GOOD) return 'good';
  if (similarityScore >= FACE_SIMILARITY_THRESHOLDS.ACCEPTABLE) return 'acceptable';
  if (similarityScore >= FACE_SIMILARITY_THRESHOLDS.POOR) return 'poor';
  return 'failed';
}

/**
 * Check if face similarity is acceptable for production
 */
export function isFaceSimilarityAcceptable(
  similarityScore: number,
  threshold: number = FACE_SIMILARITY_THRESHOLDS.ACCEPTABLE
): boolean {
  return similarityScore >= threshold;
}

/**
 * Get a human-readable description of face similarity
 */
export function getFaceSimilarityDescription(similarityScore: number): string {
  const percentage = Math.round(similarityScore * 100);
  const quality = getFaceQualityLevel(similarityScore);

  const descriptions: Record<FaceQualityLevel, string> = {
    excellent: `Excellent match (${percentage}%) - Face is nearly identical to original`,
    good: `Good match (${percentage}%) - Face closely resembles original`,
    acceptable: `Acceptable match (${percentage}%) - Face is similar to original`,
    poor: `Poor match (${percentage}%) - Face has noticeable differences`,
    failed: `Failed match (${percentage}%) - Face is significantly different`,
  };

  return descriptions[quality];
}

/**
 * Determine if face restoration should be applied
 */
export function shouldApplyFaceRestoration(
  similarityScore: number,
  minThreshold: number = FACE_SIMILARITY_THRESHOLDS.GOOD
): {
  shouldRestore: boolean;
  reason: string;
  urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
} {
  const quality = getFaceQualityLevel(similarityScore);

  if (quality === 'excellent') {
    return {
      shouldRestore: false,
      reason: 'Face is already well preserved',
      urgency: 'none',
    };
  }

  if (quality === 'good' && similarityScore >= minThreshold) {
    return {
      shouldRestore: false,
      reason: 'Face similarity is acceptable',
      urgency: 'none',
    };
  }

  if (quality === 'good') {
    return {
      shouldRestore: true,
      reason: 'Minor face differences detected',
      urgency: 'low',
    };
  }

  if (quality === 'acceptable') {
    return {
      shouldRestore: true,
      reason: 'Face needs restoration for optimal results',
      urgency: 'medium',
    };
  }

  if (quality === 'poor') {
    return {
      shouldRestore: true,
      reason: 'Significant face differences - restoration required',
      urgency: 'high',
    };
  }

  return {
    shouldRestore: true,
    reason: 'Face is significantly different - urgent restoration needed',
    urgency: 'critical',
  };
}

/**
 * Calculate weighted face similarity score
 * Considers multiple factors for comprehensive face comparison
 */
export function calculateWeightedSimilarity(
  faceSimilarity: number,
  skinToneMatch: number = 1.0,
  faceShapeMatch: number = 1.0,
  featureMatch: number = 1.0
): number {
  // Weights for different factors
  const weights = {
    faceSimilarity: 0.50,   // Face embedding similarity
    skinTone: 0.20,         // Skin tone consistency
    faceShape: 0.15,        // Face shape match
    features: 0.15,         // Individual features match
  };

  const weightedScore =
    faceSimilarity * weights.faceSimilarity +
    skinToneMatch * weights.skinTone +
    faceShapeMatch * weights.faceShape +
    featureMatch * weights.features;

  return Math.max(0, Math.min(1, weightedScore));
}

/**
 * Get recommended action based on face validation result
 */
export function getRecommendedAction(
  similarityScore: number,
  isValid: boolean,
  issues: string[]
): {
  action: 'accept' | 'restore' | 'regenerate' | 'manual_review';
  message: string;
  priority: number;
} {
  if (isValid && similarityScore >= FACE_SIMILARITY_THRESHOLDS.GOOD) {
    return {
      action: 'accept',
      message: 'Image passes face validation - ready for use',
      priority: 0,
    };
  }

  if (similarityScore >= FACE_SIMILARITY_THRESHOLDS.ACCEPTABLE) {
    return {
      action: 'restore',
      message: 'Apply face restoration to improve similarity',
      priority: 1,
    };
  }

  if (similarityScore >= FACE_SIMILARITY_THRESHOLDS.FAILED) {
    return {
      action: 'restore',
      message: 'Face restoration required - significant differences detected',
      priority: 2,
    };
  }

  // Check if issues suggest regeneration is better
  const criticalIssues = issues.filter(
    issue =>
      issue.toLowerCase().includes('different person') ||
      issue.toLowerCase().includes('unrecognizable') ||
      issue.toLowerCase().includes('major distortion')
  );

  if (criticalIssues.length > 0) {
    return {
      action: 'regenerate',
      message: 'Face is too different - regenerate with stronger constraints',
      priority: 3,
    };
  }

  return {
    action: 'manual_review',
    message: 'Face validation inconclusive - manual review recommended',
    priority: 4,
  };
}

/**
 * Format face preservation result for logging
 */
export function formatFacePreservationLog(
  originalImageId: string,
  generatedImageId: string,
  similarityScore: number,
  restorationApplied: boolean,
  finalScore: number
): string {
  const quality = getFaceQualityLevel(finalScore);
  const percentage = Math.round(finalScore * 100);

  return [
    `[FacePreservation]`,
    `Original: ${originalImageId}`,
    `Generated: ${generatedImageId}`,
    `Initial: ${Math.round(similarityScore * 100)}%`,
    `Restored: ${restorationApplied ? 'Yes' : 'No'}`,
    `Final: ${percentage}%`,
    `Quality: ${quality.toUpperCase()}`,
  ].join(' | ');
}

/**
 * Face preservation statistics for monitoring
 */
export interface FacePreservationStats {
  totalProcessed: number;
  excellentMatches: number;
  goodMatches: number;
  acceptableMatches: number;
  poorMatches: number;
  failedMatches: number;
  restorationRate: number;
  averageSimilarity: number;
}

/**
 * Aggregate face preservation statistics
 */
export function aggregateFaceStats(
  results: Array<{ similarity: number; restored: boolean }>
): FacePreservationStats {
  if (results.length === 0) {
    return {
      totalProcessed: 0,
      excellentMatches: 0,
      goodMatches: 0,
      acceptableMatches: 0,
      poorMatches: 0,
      failedMatches: 0,
      restorationRate: 0,
      averageSimilarity: 0,
    };
  }

  const stats: FacePreservationStats = {
    totalProcessed: results.length,
    excellentMatches: 0,
    goodMatches: 0,
    acceptableMatches: 0,
    poorMatches: 0,
    failedMatches: 0,
    restorationRate: 0,
    averageSimilarity: 0,
  };

  let totalSimilarity = 0;
  let restoredCount = 0;

  for (const result of results) {
    totalSimilarity += result.similarity;
    if (result.restored) restoredCount++;

    const quality = getFaceQualityLevel(result.similarity);
    switch (quality) {
      case 'excellent':
        stats.excellentMatches++;
        break;
      case 'good':
        stats.goodMatches++;
        break;
      case 'acceptable':
        stats.acceptableMatches++;
        break;
      case 'poor':
        stats.poorMatches++;
        break;
      case 'failed':
        stats.failedMatches++;
        break;
    }
  }

  stats.averageSimilarity = totalSimilarity / results.length;
  stats.restorationRate = restoredCount / results.length;

  return stats;
}

export default {
  FACE_SIMILARITY_THRESHOLDS,
  getFaceQualityLevel,
  isFaceSimilarityAcceptable,
  getFaceSimilarityDescription,
  shouldApplyFaceRestoration,
  calculateWeightedSimilarity,
  getRecommendedAction,
  formatFacePreservationLog,
  aggregateFaceStats,
};
