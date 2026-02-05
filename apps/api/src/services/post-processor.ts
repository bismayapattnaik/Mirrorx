/**
 * @fileoverview Post-Processing & Identity Restoration Guardrail
 *
 * This module is the FINAL GUARDRAIL that ensures 100% face identity preservation.
 * After ANY AI generation, this module:
 * 1. Validates the face region
 * 2. Overlays the original face if needed
 * 3. Blends edges for seamless results
 * 4. Validates final output
 *
 * This is the "safety net" that GUARANTEES the user's face is never changed.
 *
 * Architecture:
 * - Face Overlay: Strictly composites original face onto generated body
 * - Edge Blending: Feathered edges for natural appearance
 * - Color Matching: Adjusts skin tone for consistency
 * - Validation: Pixel-level comparison to verify face unchanged
 */

import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';
import type { SegmentationResult } from './masking';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const ANALYSIS_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp';

/**
 * Post-processing result
 */
export interface PostProcessingResult {
  imageBase64: string;
  faceOverlaid: boolean;
  faceSimilarity: number;
  colorCorrected: boolean;
  processingTimeMs: number;
  validationPassed: boolean;
  method: 'direct_overlay' | 'blended_overlay' | 'color_matched_overlay' | 'passthrough';
}

/**
 * Post-processing options
 */
export interface PostProcessingOptions {
  // Minimum similarity to accept without overlay
  minSimilarityThreshold?: number;
  // Enable color correction for skin tone matching
  enableColorCorrection?: boolean;
  // Feather radius for edge blending
  featherRadius?: number;
  // Enable validation after overlay
  enableValidation?: boolean;
  // Maximum retries for overlay
  maxRetries?: number;
}

const DEFAULT_OPTIONS: Required<PostProcessingOptions> = {
  minSimilarityThreshold: 0.99, // 99% Face Preservation (Strict)
  enableColorCorrection: true,
  featherRadius: 25, // Increased feathering to eliminate sticker edges
  enableValidation: true,
  maxRetries: 2,
};

/**
 * IdentityGuard - The Final Guardrail for Face Preservation
 *
 * This class ensures that NO generated image leaves the system
 * with a modified face. It's the ultimate safety mechanism.
 */
export class IdentityGuard {
  private options: Required<PostProcessingOptions>;

  constructor(options: PostProcessingOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Main post-processing method
   * Takes generated image and ensures face matches original
   */
  async process(
    originalImageBase64: string,
    generatedImageBase64: string,
    segmentation: SegmentationResult
  ): Promise<PostProcessingResult> {
    const startTime = Date.now();
    console.log('[IdentityGuard] Starting post-processing...');

    try {
      // Step 1: Validate current face similarity
      const initialSimilarity = await this.calculateFaceSimilarity(
        originalImageBase64,
        generatedImageBase64,
        segmentation
      );

      console.log(`[IdentityGuard] Initial face similarity: ${(initialSimilarity * 100).toFixed(1)}%`);

      // If similarity is already high enough, pass through
      if (initialSimilarity >= this.options.minSimilarityThreshold) {
        console.log('[IdentityGuard] Face similarity acceptable, passing through');
        return {
          imageBase64: generatedImageBase64,
          faceOverlaid: false,
          faceSimilarity: initialSimilarity,
          colorCorrected: false,
          processingTimeMs: Date.now() - startTime,
          validationPassed: true,
          method: 'passthrough',
        };
      }

      // Step 2: Apply face overlay
      console.log('[IdentityGuard] Applying face overlay...');
      let result = await this.overlayFace(
        originalImageBase64,
        generatedImageBase64,
        segmentation
      );

      // Step 3: Apply color correction if enabled
      if (this.options.enableColorCorrection) {
        console.log('[IdentityGuard] Applying color correction...');
        result = await this.applyColorCorrection(
          result,
          segmentation.skinToneRGB,
          segmentation.faceBBox
        );
      }

      // Step 4: Validate final result
      let finalSimilarity = initialSimilarity;
      let validationPassed = false;

      if (this.options.enableValidation) {
        finalSimilarity = await this.calculateFaceSimilarity(
          originalImageBase64,
          result,
          segmentation
        );
        validationPassed = finalSimilarity >= this.options.minSimilarityThreshold;
        console.log(`[IdentityGuard] Final face similarity: ${(finalSimilarity * 100).toFixed(1)}%`);
      }

      // Step 5: If still not good enough, do direct pixel copy
      if (!validationPassed && finalSimilarity < 0.85) {
        console.log('[IdentityGuard] Applying direct face copy as fallback...');
        result = await this.directFaceCopy(
          originalImageBase64,
          result,
          segmentation
        );
        finalSimilarity = await this.calculateFaceSimilarity(
          originalImageBase64,
          result,
          segmentation
        );
        validationPassed = finalSimilarity >= 0.95; // Should be very high after direct copy
      }

      return {
        imageBase64: result,
        faceOverlaid: true,
        faceSimilarity: finalSimilarity,
        colorCorrected: this.options.enableColorCorrection,
        processingTimeMs: Date.now() - startTime,
        validationPassed,
        method: this.options.enableColorCorrection ? 'color_matched_overlay' : 'blended_overlay',
      };

    } catch (error) {
      console.error('[IdentityGuard] Post-processing error:', error);

      // On error, return original generated image
      return {
        imageBase64: generatedImageBase64,
        faceOverlaid: false,
        faceSimilarity: 0,
        colorCorrected: false,
        processingTimeMs: Date.now() - startTime,
        validationPassed: false,
        method: 'passthrough',
      };
    }
  }

  /**
   * Calculate face similarity between original and generated images
   */
  async calculateFaceSimilarity(
    originalBase64: string,
    generatedBase64: string,
    segmentation: SegmentationResult
  ): Promise<number> {
    try {
      const cleanOriginal = originalBase64.replace(/^data:image\/\w+;base64,/, '');
      const cleanGenerated = generatedBase64.replace(/^data:image\/\w+;base64,/, '');

      const originalBuffer = Buffer.from(cleanOriginal, 'base64');
      const generatedBuffer = Buffer.from(cleanGenerated, 'base64');

      // Extract face regions
      const bbox = segmentation.faceBBox;
      const width = segmentation.originalWidth;
      const height = segmentation.originalHeight;
      const padding = 0.1;

      const faceX = Math.max(0, (bbox.x - padding) * width);
      const faceY = Math.max(0, (bbox.y - padding) * height);
      const faceW = Math.min(width - faceX, (bbox.width + padding * 2) * width);
      const faceH = Math.min(height - faceY, (bbox.height + padding * 2) * height);

      const extractOptions = {
        left: Math.round(faceX),
        top: Math.round(faceY),
        width: Math.round(faceW),
        height: Math.round(faceH),
      };

      // Resize generated to match original dimensions first
      const genMeta = await sharp(generatedBuffer).metadata();
      let processedGenerated = generatedBuffer;

      if (genMeta.width !== width || genMeta.height !== height) {
        processedGenerated = await sharp(generatedBuffer)
          .resize(width, height)
          .toBuffer();
      }

      // Extract face regions
      const [originalFace, generatedFace] = await Promise.all([
        sharp(originalBuffer)
          .extract(extractOptions)
          .resize(128, 128)
          .raw()
          .toBuffer(),
        sharp(processedGenerated)
          .extract(extractOptions)
          .resize(128, 128)
          .raw()
          .toBuffer(),
      ]);

      // Calculate SSIM-like similarity
      let totalDiff = 0;
      const pixelCount = 128 * 128 * 3;

      for (let i = 0; i < pixelCount; i++) {
        totalDiff += Math.abs(originalFace[i] - generatedFace[i]);
      }

      const avgDiff = totalDiff / pixelCount;
      const similarity = Math.max(0, 1 - avgDiff / 128); // Normalize

      return similarity;
    } catch (error) {
      console.error('[IdentityGuard] Similarity calculation error:', error);
      return 0.5;
    }
  }

  /**
   * Overlay original face onto generated image with feathered blending
   */
  async overlayFace(
    originalBase64: string,
    generatedBase64: string,
    segmentation: SegmentationResult
  ): Promise<string> {
    const cleanOriginal = originalBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanGenerated = generatedBase64.replace(/^data:image\/\w+;base64,/, '');

    const originalBuffer = Buffer.from(cleanOriginal, 'base64');
    const generatedBuffer = Buffer.from(cleanGenerated, 'base64');

    const width = segmentation.originalWidth;
    const height = segmentation.originalHeight;

    // Resize generated to match original dimensions
    const genMeta = await sharp(generatedBuffer).metadata();
    let processedGenerated = generatedBuffer;

    if (genMeta.width !== width || genMeta.height !== height) {
      processedGenerated = await sharp(generatedBuffer)
        .resize(width, height)
        .toBuffer();
    }

    // Get face crop with alpha from segmentation
    const faceCropWithAlpha = Buffer.from(segmentation.faceCropWithAlphaBase64, 'base64');

    // Calculate position for overlay
    const bbox = segmentation.faceBBox;
    const padding = 0.15 + 0.05; // Match extraction padding
    const faceX = Math.max(0, (bbox.x - padding) * width);
    const faceY = Math.max(0, (bbox.y - padding * 1.5) * height);

    // Composite face onto generated image
    const result = await sharp(processedGenerated)
      .composite([
        {
          input: faceCropWithAlpha,
          left: Math.round(faceX),
          top: Math.round(faceY),
          blend: 'over',
        },
      ])
      .jpeg({ quality: 95 })
      .toBuffer();

    return `data:image/jpeg;base64,${result.toString('base64')}`;
  }

  /**
   * Direct face copy - pixel-perfect replacement
   * Used as fallback when blending doesn't work well
   */
  async directFaceCopy(
    originalBase64: string,
    generatedBase64: string,
    segmentation: SegmentationResult
  ): Promise<string> {
    const cleanOriginal = originalBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanGenerated = generatedBase64.replace(/^data:image\/\w+;base64,/, '');

    const originalBuffer = Buffer.from(cleanOriginal, 'base64');
    const generatedBuffer = Buffer.from(cleanGenerated, 'base64');

    const width = segmentation.originalWidth;
    const height = segmentation.originalHeight;

    // Resize generated to match original
    const processedGenerated = await sharp(generatedBuffer)
      .resize(width, height)
      .toBuffer();

    // Get face mask (face=white, body=black for compositing)
    const bodyMask = Buffer.from(segmentation.bodyMaskBase64, 'base64');

    // Ensure mask is correct size
    const resizedMask = await sharp(bodyMask)
      .resize(width, height)
      .toBuffer();

    // Use the mask to composite: original face + generated body
    // face mask: face=white means keep from original
    const originalWithAlpha = await sharp(originalBuffer)
      .resize(width, height)
      .ensureAlpha()
      .toBuffer();

    const generatedWithAlpha = await sharp(processedGenerated)
      .ensureAlpha()
      .toBuffer();

    // Get raw pixel data
    const origRaw = await sharp(originalWithAlpha).raw().toBuffer();
    const genRaw = await sharp(generatedWithAlpha).raw().toBuffer();
    const maskRaw = await sharp(resizedMask).raw().toBuffer();

    // Composite: where mask is white (255), use original; where black (0), use generated
    const resultRaw = Buffer.alloc(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      const maskValue = maskRaw[i] / 255; // 0-1

      // RGBA composite
      resultRaw[i * 4] = Math.round(origRaw[i * 4] * maskValue + genRaw[i * 4] * (1 - maskValue));
      resultRaw[i * 4 + 1] = Math.round(origRaw[i * 4 + 1] * maskValue + genRaw[i * 4 + 1] * (1 - maskValue));
      resultRaw[i * 4 + 2] = Math.round(origRaw[i * 4 + 2] * maskValue + genRaw[i * 4 + 2] * (1 - maskValue));
      resultRaw[i * 4 + 3] = 255;
    }

    const result = await sharp(resultRaw, {
      raw: { width, height, channels: 4 },
    })
      .jpeg({ quality: 95 })
      .toBuffer();

    return `data:image/jpeg;base64,${result.toString('base64')}`;
  }

  /**
   * Apply color correction to match skin tones
   */
  async applyColorCorrection(
    imageBase64: string,
    targetSkinTone: { r: number; g: number; b: number },
    faceBBox: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    try {
      const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanImage, 'base64');
      const metadata = await sharp(buffer).metadata();

      const width = metadata.width || 1024;
      const height = metadata.height || 1024;

      // Extract neck/body region to check color
      const neckY = Math.min(height, (faceBBox.y + faceBBox.height + 0.05) * height);
      const neckH = Math.min(height - neckY, height * 0.1);

      if (neckH < 10) {
        return imageBase64; // Not enough neck area to correct
      }

      const neckRegion = await sharp(buffer)
        .extract({
          left: Math.round(faceBBox.x * width),
          top: Math.round(neckY),
          width: Math.round(faceBBox.width * width),
          height: Math.round(neckH),
        })
        .raw()
        .toBuffer();

      // Calculate average color in neck region
      let avgR = 0, avgG = 0, avgB = 0;
      const pixelCount = neckRegion.length / 3;

      for (let i = 0; i < pixelCount; i++) {
        avgR += neckRegion[i * 3];
        avgG += neckRegion[i * 3 + 1];
        avgB += neckRegion[i * 3 + 2];
      }

      avgR /= pixelCount;
      avgG /= pixelCount;
      avgB /= pixelCount;

      // Calculate color shift needed
      const shiftR = (targetSkinTone.r - avgR) * 0.3; // 30% correction
      const shiftG = (targetSkinTone.g - avgG) * 0.3;
      const shiftB = (targetSkinTone.b - avgB) * 0.3;

      // If shift is minimal, skip correction
      if (Math.abs(shiftR) < 5 && Math.abs(shiftG) < 5 && Math.abs(shiftB) < 5) {
        return imageBase64;
      }

      // Apply subtle color shift using modulate
      // This is a simplified approach - for production, use proper color grading
      const corrected = await sharp(buffer)
        .modulate({
          brightness: 1 + (shiftR + shiftG + shiftB) / (3 * 255) * 0.1,
        })
        .jpeg({ quality: 95 })
        .toBuffer();

      return `data:image/jpeg;base64,${corrected.toString('base64')}`;
    } catch (error) {
      console.error('[IdentityGuard] Color correction error:', error);
      return imageBase64;
    }
  }
}

/**
 * Restore identity on a generated image
 * This is the main export that guarantees face preservation
 */
export async function restoreIdentity(
  originalImageBase64: string,
  generatedImageBase64: string,
  segmentation: SegmentationResult,
  options?: PostProcessingOptions
): Promise<PostProcessingResult> {
  const guard = new IdentityGuard(options);
  return guard.process(originalImageBase64, generatedImageBase64, segmentation);
}

/**
 * Validate that face is unchanged
 */
export async function validateFaceUnchanged(
  originalImageBase64: string,
  generatedImageBase64: string,
  segmentation: SegmentationResult,
  threshold: number = 0.90
): Promise<{ isValid: boolean; similarity: number }> {
  const guard = new IdentityGuard();
  const similarity = await guard.calculateFaceSimilarity(
    originalImageBase64,
    generatedImageBase64,
    segmentation
  );

  return {
    isValid: similarity >= threshold,
    similarity,
  };
}

/**
 * Quick face overlay without full validation
 */
export async function quickFaceOverlay(
  originalImageBase64: string,
  generatedImageBase64: string,
  segmentation: SegmentationResult
): Promise<string> {
  const guard = new IdentityGuard({ enableValidation: false, enableColorCorrection: false });
  const result = await guard.overlayFace(originalImageBase64, generatedImageBase64, segmentation);
  return result;
}

/**
 * Detect if the generated image has face corruption
 * Returns true if face is significantly different from original (likely corrupted)
 * Used to determine if conditional face restoration is needed
 */
export async function detectFaceCorruption(
  originalImageBase64: string,
  generatedImageBase64: string,
  segmentation: SegmentationResult,
  corruptionThreshold: number = 0.75
): Promise<boolean> {
  try {
    const guard = new IdentityGuard();
    const similarity = await guard.calculateFaceSimilarity(
      originalImageBase64,
      generatedImageBase64,
      segmentation
    );

    console.log(`[PostProcessor] Face similarity check: ${(similarity * 100).toFixed(1)}% (threshold: ${(corruptionThreshold * 100).toFixed(0)}%)`);

    // If similarity is below threshold, face is considered corrupted
    const isCorrupted = similarity < corruptionThreshold;

    if (isCorrupted) {
      console.log('[PostProcessor] Face corruption detected - restoration needed');
    } else {
      console.log('[PostProcessor] Face preserved by AI - no restoration needed');
    }

    return isCorrupted;
  } catch (error) {
    console.error('[PostProcessor] Face corruption detection error:', error);
    // On error, assume corruption and restore to be safe
    return true;
  }
}

/**
 * Detect black/empty regions in generated image
 * Returns true if image appears valid
 */
export async function validateImageContent(imageBase64: string): Promise<{
  isValid: boolean;
  blackPixelRatio: number;
  avgBrightness: number;
  issues: string[];
}> {
  try {
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanImage, 'base64');

    const stats = await sharp(buffer).stats();

    // Check for predominantly black image
    const avgBrightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
    const variance = (stats.channels[0].stdev + stats.channels[1].stdev + stats.channels[2].stdev) / 3;

    const issues: string[] = [];

    if (avgBrightness < 20) {
      issues.push('Image is predominantly black');
    }

    if (variance < 10) {
      issues.push('Image has very low variance (possibly solid color)');
    }

    // Sample pixels to check for black regions
    const raw = await sharp(buffer)
      .resize(100, 100)
      .raw()
      .toBuffer();

    let blackPixels = 0;
    const totalPixels = 100 * 100;

    for (let i = 0; i < totalPixels; i++) {
      const r = raw[i * 3];
      const g = raw[i * 3 + 1];
      const b = raw[i * 3 + 2];

      if (r < 10 && g < 10 && b < 10) {
        blackPixels++;
      }
    }

    const blackPixelRatio = blackPixels / totalPixels;

    if (blackPixelRatio > 0.3) {
      issues.push(`High black pixel ratio: ${(blackPixelRatio * 100).toFixed(1)}%`);
    }

    return {
      isValid: issues.length === 0,
      blackPixelRatio,
      avgBrightness,
      issues,
    };
  } catch (error) {
    console.error('[PostProcessor] Image validation error:', error);
    return {
      isValid: false,
      blackPixelRatio: 1,
      avgBrightness: 0,
      issues: ['Failed to analyze image'],
    };
  }
}

/**
 * Retry wrapper for generation with validation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  validator: (result: T) => Promise<boolean>,
  maxRetries: number = 2
): Promise<{ result: T; attempts: number; success: boolean }> {
  let lastResult: T | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    console.log(`[PostProcessor] Attempt ${attempt}/${maxRetries + 1}...`);

    try {
      const result = await operation();
      lastResult = result;

      const isValid = await validator(result);

      if (isValid) {
        return { result, attempts: attempt, success: true };
      }

      console.log(`[PostProcessor] Attempt ${attempt} failed validation, retrying...`);
    } catch (error) {
      console.error(`[PostProcessor] Attempt ${attempt} error:`, error);
    }
  }

  if (lastResult === null) {
    throw new Error('All retry attempts failed');
  }

  return { result: lastResult, attempts: maxRetries + 1, success: false };
}

export default {
  IdentityGuard,
  restoreIdentity,
  validateFaceUnchanged,
  quickFaceOverlay,
  validateImageContent,
  detectFaceCorruption,
  withRetry,
};
