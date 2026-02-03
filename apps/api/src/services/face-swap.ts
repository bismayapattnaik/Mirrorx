/**
 * Face Swap Service - DEPRECATED
 *
 * This service is no longer used. The main virtual try-on system now uses
 * pure Gemini 3 Pro with advanced identity anchoring prompts for 100%
 * face preservation WITHOUT external dependencies.
 *
 * The new approach:
 * 1. Extracts detailed face/body features before generation
 * 2. Uses identity-anchored prompts to ensure exact face preservation
 * 3. Synchronizes face-body proportions for natural results
 *
 * This file is kept for backwards compatibility but all functions
 * now simply return the input image unchanged.
 */

/**
 * @deprecated Use the enhanced Gemini service with identity anchoring instead
 * This function now returns the input unchanged.
 */
export async function swapFaceHighQuality(
  _sourceFaceBase64: string,
  targetImageBase64: string
): Promise<string> {
  console.log('[FaceSwap] DEPRECATED: Face swap is no longer used.');
  console.log('[FaceSwap] Identity preservation is now handled by Gemini prompts.');
  return targetImageBase64;
}

/**
 * @deprecated Use the enhanced Gemini service with identity anchoring instead
 * This function now returns the input unchanged.
 */
export async function swapFace(
  _sourceFaceBase64: string,
  targetImageBase64: string
): Promise<string> {
  console.log('[FaceSwap] DEPRECATED: Face swap is no longer used.');
  return targetImageBase64;
}

export default {
  swapFace,
  swapFaceHighQuality,
};
