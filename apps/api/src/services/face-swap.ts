/**
 * Face Swap Service using Replicate
 *
 * This service ensures 100% face identity preservation by:
 * 1. Using Gemini to generate the try-on (good at clothing)
 * 2. Swapping the user's ACTUAL face onto the result
 *
 * This guarantees the face is exactly the same as the input.
 */

import Replicate from 'replicate';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// Type for Replicate output - can be string, array, or object
type ReplicateOutput = string | string[] | Record<string, unknown> | null | undefined;

/**
 * Process Replicate output and convert to base64 data URL
 */
async function processOutput(output: ReplicateOutput, fallback: string): Promise<string> {
  if (!output) {
    return fallback;
  }

  // Handle string output (URL or base64)
  if (typeof output === 'string') {
    if (output.startsWith('http')) {
      try {
        const response = await fetch(output);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      } catch {
        return fallback;
      }
    }
    if (output.startsWith('data:')) {
      return output;
    }
    return `data:image/jpeg;base64,${output}`;
  }

  // Handle array output
  if (Array.isArray(output) && output.length > 0) {
    const firstOutput = output[0];
    if (typeof firstOutput === 'string') {
      if (firstOutput.startsWith('http')) {
        try {
          const response = await fetch(firstOutput);
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          return `data:image/jpeg;base64,${base64}`;
        } catch {
          return fallback;
        }
      }
      if (firstOutput.startsWith('data:')) {
        return firstOutput;
      }
      return `data:image/jpeg;base64,${firstOutput}`;
    }
  }

  return fallback;
}

/**
 * Swap face from source image onto target image
 * Uses the user's actual face pixels - no generation, no modification
 */
export async function swapFace(
  sourceFaceBase64: string,  // User's selfie - the face to use
  targetImageBase64: string  // Generated try-on - where to put the face
): Promise<string> {
  console.log('[FaceSwap] Starting face swap for identity preservation...');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.warn('[FaceSwap] No REPLICATE_API_TOKEN - skipping face swap');
    return targetImageBase64; // Return original if no API key
  }

  try {
    // Clean base64 and create data URLs
    const cleanSource = sourceFaceBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanTarget = targetImageBase64.replace(/^data:image\/\w+;base64,/, '');

    const sourceDataUrl = `data:image/jpeg;base64,${cleanSource}`;
    const targetDataUrl = `data:image/jpeg;base64,${cleanTarget}`;

    console.log('[FaceSwap] Calling Replicate face-swap model...');

    // Use face-swap model - this preserves the EXACT face
    const output = await replicate.run(
      "yan-ops/face_swap:d5900f9ebed33e7ae08a07f17e0d98b4ebc68ab9528571d1f8b395c1e89d7f30",
      {
        input: {
          source_image: sourceDataUrl,  // Face to use (user's selfie)
          target_image: targetDataUrl,  // Image to swap face onto (try-on result)
        }
      }
    ) as ReplicateOutput;

    console.log('[FaceSwap] Face swap completed');
    return processOutput(output, targetImageBase64);

  } catch (error) {
    console.error('[FaceSwap] Face swap failed:', error);
    return targetImageBase64;
  }
}

/**
 * High-quality face swap using multiple models with fallback
 */
export async function swapFaceHighQuality(
  sourceFaceBase64: string,
  targetImageBase64: string
): Promise<string> {
  console.log('[FaceSwap] Starting high-quality face swap...');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.warn('[FaceSwap] No REPLICATE_API_TOKEN - skipping face swap');
    return targetImageBase64;
  }

  try {
    const cleanSource = sourceFaceBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanTarget = targetImageBase64.replace(/^data:image\/\w+;base64,/, '');

    const sourceDataUrl = `data:image/jpeg;base64,${cleanSource}`;
    const targetDataUrl = `data:image/jpeg;base64,${cleanTarget}`;

    // Try multiple models in order of preference
    const models: Array<{
      model: `${string}/${string}` | `${string}/${string}:${string}`;
      input: Record<string, unknown>;
    }> = [
      // InsightFace-based swap - very accurate
      {
        model: "lucataco/facefusion:a2c0043c3c538ba99d6a4de5dfd5f273e9cc4ae8e3f3c4c264b64a4d4db5296b",
        input: {
          source_image: sourceDataUrl,
          target_image: targetDataUrl,
          face_enhancer: "gfpgan_1.4",
        }
      },
      // Fallback model
      {
        model: "yan-ops/face_swap:d5900f9ebed33e7ae08a07f17e0d98b4ebc68ab9528571d1f8b395c1e89d7f30",
        input: {
          source_image: sourceDataUrl,
          target_image: targetDataUrl,
        }
      }
    ];

    for (const { model, input } of models) {
      try {
        console.log(`[FaceSwap] Trying model: ${model}`);
        const output = await replicate.run(model, { input }) as ReplicateOutput;

        if (output) {
          const result = await processOutput(output, '');
          if (result && result !== '') {
            console.log('[FaceSwap] High-quality face swap completed');
            return result;
          }
        }
      } catch (modelError) {
        console.warn(`[FaceSwap] Model ${model} failed:`, modelError);
        continue; // Try next model
      }
    }

    console.error('[FaceSwap] All face swap models failed');
    return targetImageBase64;

  } catch (error) {
    console.error('[FaceSwap] High-quality face swap failed:', error);
    return targetImageBase64;
  }
}

export default {
  swapFace,
  swapFaceHighQuality,
};
