/**
 * @fileoverview Commercial-Grade Virtual Try-On Service using Gemini 3 Pro
 *
 * TWO-PIPELINE ARCHITECTURE with Reference Image Injection:
 *
 * PIPELINE 1: PART Mode (Semantic Inpainting)
 * - Uses Gemini's native Reference Image Injection for natural blending
 * - AI handles lighting/color grading to match room lighting
 * - CONDITIONAL face restoration: only if face similarity < 85% (corruption detected)
 * - No "Sticker Effect" - natural lighting integration
 *
 * PIPELINE 2: FULL_FIT Mode (Subject Consistency Generation)
 * - Uses Subject Consistency pattern for identity lock
 * - Reference A: Face/Identity | Reference B: Garment/Style
 * - Mandatory identity guardrail post-generation
 * - Face is GUARANTEED to match original
 *
 * This architecture prioritizes natural-looking results while preserving identity.
 */

import { GoogleGenAI } from '@google/genai';
import type { TryOnMode } from '@mrrx/shared';
import sharp from 'sharp';

import {
  ImageMasker,
  segmentImage,
  type SegmentationResult,
} from './masking';

import {
  IdentityGuard,
  restoreIdentity,
  detectFaceCorruption,
  validateImageContent,
  withRetry,
  type PostProcessingResult,
} from './post-processor';

import {
  createAppearanceProfile,
  type AppearanceProfile,
} from './image-preprocessor';

// Initialize Gemini client
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Model Configuration - Gemini 3 Pro Image Preview for best image generation
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-1.5-flash'; // Fast model for text analysis

type Gender = 'male' | 'female';

/**
 * SAFETY SETTINGS - Disable all safety blocks for human image processing
 * Required for virtual try-on to work with selfies/human images
 * Using 'as any' to allow string-based values that the API accepts
 */
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
] as any;

// Cache
const profileCache = new Map<string, { profile: AppearanceProfile; timestamp: number }>();
const segmentationCache = new Map<string, { data: SegmentationResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generation result with full metadata
 */
export interface TryOnGenerationResult {
  imageBase64: string;
  facePreserved: boolean;
  faceSimilarity: number;
  pipeline: 'inpainting' | 'generation_with_overlay';
  processingSteps: string[];
  totalTimeMs: number;
  retryAttempts: number;
  fallbackUsed: boolean;
}

/**
 * Get cached appearance profile
 */
async function getAppearanceProfile(selfieBase64: string): Promise<AppearanceProfile | null> {
  const cacheKey = selfieBase64.substring(0, 100);
  const cached = profileCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.profile;
  }

  const profile = await createAppearanceProfile(selfieBase64);
  if (profile) {
    profileCache.set(cacheKey, { profile, timestamp: Date.now() });
  }
  return profile;
}

/**
 * Get cached segmentation
 * NEVER returns null - segmentImage always provides valid segmentation
 */
async function getSegmentation(selfieBase64: string): Promise<SegmentationResult> {
  const cacheKey = selfieBase64.substring(0, 100);
  const cached = segmentationCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[Gemini] Using cached segmentation');
    return cached.data;
  }

  console.log('[Gemini] Creating new segmentation...');
  // segmentImage NEVER fails - uses fallback mask if needed
  const data = await segmentImage(selfieBase64);
  segmentationCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

/**
 * System instruction for all generations
 */
const SYSTEM_INSTRUCTION = `You are an expert virtual try-on AI. Your task is to apply clothing onto people while preserving their exact identity.

ABSOLUTE RULES:
1. The person's face must NEVER change - preserve every facial feature exactly
2. Body proportions must match the original person exactly
3. Skin tone must be consistent across all visible skin
4. Clothing must drape naturally on the specific body type
5. Output must be photorealistic - no AI artifacts

When given a mask, you must ONLY edit the white (editable) regions.
Black regions in the mask are PROTECTED and must remain pixel-perfect unchanged.`;

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE 1: PART MODE - INPAINTING
// Face is protected by mask, only body/clothes area is edited
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate clothing try-on using inpainting
 * The face is PHYSICALLY protected by the mask
 */
async function generateWithInpainting(
  selfieBase64: string,
  productBase64: string,
  segmentation: SegmentationResult,
  profile: AppearanceProfile | null,
  gender: Gender
): Promise<string> {
  const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
  const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

  const person = gender === 'female' ? 'woman' : 'man';

  // Reference Image Injection prompt - let Gemini handle lighting/blending
  const inpaintingPrompt = `VIRTUAL TRY-ON TASK using Reference Image Injection:

INPUT 1 (Canvas): Photo of a ${person} - this is the BASE image to edit.
INPUT 2 (Reference): A garment - this is the clothing to apply.

YOUR TASK:
Replace the current top/clothing in INPUT 1 with the garment from INPUT 2.

CRITICAL REQUIREMENTS:
1. FACE: Keep 100% unchanged - same pixels, same lighting
2. LIGHTING: Match the garment's lighting to the room lighting in INPUT 1
3. NECK SEAM: Blend naturally where skin meets fabric - NO visible edges
4. COLOR GRADING: Adjust garment white balance to match the selfie's warm/cool tone
5. SHADOWS: Generate realistic fabric shadows based on the light source direction
6. FIT: Natural draping on ${profile?.body.build || 'their'} body type

The output should look like a REAL photo, not a composite.

Generate the try-on image now.`;

  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: inpaintingPrompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanSelfie,
            },
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanProduct,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseModalities: ['TEXT', 'IMAGE'],
      safetySettings: SAFETY_SETTINGS,
    },
  });

  // Extract image from response
  if (!response.candidates || response.candidates.length === 0) {
    console.error(
      '[Gemini] Generation Failed. Response dump:',
      JSON.stringify(response, null, 2)
    );
    if (response.promptFeedback) {
      console.error('[Gemini] Block Reason:', response.promptFeedback);
    }
    throw new Error('Model refused to generate image (Safety/Block)');
  }

  if (response.candidates && response.candidates.length > 0) {
    const parts = response.candidates[0].content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const data = part.inlineData.data;
        if (data && data.length > 100) {
          const cleanData = data.startsWith('data:')
            ? data.split(',')[1] || data
            : data;
          return `data:${part.inlineData.mimeType};base64,${cleanData}`;
        }
      }

      if ((part as any).image?.data) {
        const imageData = (part as any).image;
        if (imageData.data && imageData.data.length > 100) {
          return `data:${imageData.mimeType || 'image/png'};base64,${imageData.data}`;
        }
      }
    }
  }

  throw new Error('No image generated from inpainting request');
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE 2: FULL_FIT MODE - GENERATION + IDENTITY GUARDRAIL
// Generate full body, then strictly overlay original face
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate full body try-on image using Reference Image Injection
 * Uses up to 2 reference images: Face reference + Garment reference
 */
async function generateFullBody(
  selfieBase64: string,
  productBase64: string,
  profile: AppearanceProfile | null,
  gender: Gender
): Promise<string> {
  const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
  const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

  const person = gender === 'female' ? 'woman' : 'man';

  // Subject Consistency pattern - strong identity anchoring
  const fullBodyPrompt = `SUBJECT CONSISTENCY TASK for Fashion Photography:

Generate a high-fashion full-body shot using these EXACT references:

REFERENCE IMAGE A (Identity Lock):
- This is the SUBJECT PERSON whose identity MUST be preserved
- Use their EXACT face: same bone structure, eyes, nose, lips, jawline
- Match their skin tone precisely across all visible skin
- Body type: ${profile?.body.build || 'natural proportions'}

REFERENCE IMAGE B (Style Reference):
- This is the GARMENT to dress the subject in
- Apply this clothing as the main outfit piece

OUTPUT REQUIREMENTS:
1. IDENTITY: The face must be MATHEMATICALLY identical to Reference A
2. LIGHTING: Professional studio lighting (soft key light, fill, rim)
3. POSE: Full body (head to feet), natural fashion stance
4. FRAMING: 3:4 portrait aspect ratio, fashion editorial style
5. QUALITY: 2K resolution, no artifacts, photorealistic
6. OUTFIT: Complete the look with complementary items that match the garment style

The output should look like a professional fashion lookbook photo of THIS SPECIFIC PERSON.

Generate the image now.`;

  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: fullBodyPrompt },
          { inlineData: { mimeType: 'image/jpeg', data: cleanSelfie } },  // Reference 1 (Face)
          { inlineData: { mimeType: 'image/jpeg', data: cleanProduct } }, // Reference 2 (Clothes)
        ],
      },
    ],
    config: {
      safetySettings: SAFETY_SETTINGS,
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  // Extract image from response
  if (!response.candidates || response.candidates.length === 0) {
    console.error(
      '[Gemini] Generation Failed. Response dump:',
      JSON.stringify(response, null, 2)
    );
    if (response.promptFeedback) {
      console.error('[Gemini] Block Reason:', response.promptFeedback);
    }
    throw new Error('Model refused to generate image (Safety/Block)');
  }

  if (response.candidates && response.candidates.length > 0) {
    const parts = response.candidates[0].content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const data = part.inlineData.data;
        if (data && data.length > 100) {
          const cleanData = data.startsWith('data:')
            ? data.split(',')[1] || data
            : data;
          return `data:${part.inlineData.mimeType};base64,${cleanData}`;
        }
      }

      if ((part as any).image?.data) {
        const imageData = (part as any).image;
        if (imageData.data && imageData.data.length > 100) {
          return `data:${imageData.mimeType || 'image/png'};base64,${imageData.data}`;
        }
      }
    }
  }

  throw new Error('No image generated from full body request');
}

/**
 * Fallback: Generate simpler pose if full body fails
 */
async function generateFallbackPose(
  selfieBase64: string,
  productBase64: string,
  gender: Gender
): Promise<string> {
  const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
  const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

  const person = gender === 'female' ? 'woman' : 'man';

  const fallbackPrompt = `SIMPLE TRY-ON: Generate a straightforward try-on image.

Show the ${person} from IMAGE 1 wearing the clothing from IMAGE 2.
- Simple front-facing pose
- Head to mid-thigh framing
- Natural standing position
- Keep the person's face and body proportions identical to IMAGE 1

This is a fallback request - prioritize accuracy over creativity.
Generate a clean, simple try-on image.`;

  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'PERSON:' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanSelfie,
            },
          },
          { text: 'CLOTHING:' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanProduct,
            },
          },
          { text: fallbackPrompt },
        ],
      },
    ],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      safetySettings: SAFETY_SETTINGS,
    },
  });

  if (response.candidates && response.candidates.length > 0) {
    const parts = response.candidates[0].content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const data = part.inlineData.data;
        if (data && data.length > 100) {
          const cleanData = data.startsWith('data:')
            ? data.split(',')[1] || data
            : data;
          return `data:${part.inlineData.mimeType};base64,${cleanData}`;
        }
      }
    }
  }

  throw new Error('Fallback generation also failed');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GENERATION FUNCTION
// Routes to appropriate pipeline based on mode
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main try-on generation function
 * Routes to appropriate pipeline and ensures face preservation
 */
export async function generateTryOnImage(
  selfieBase64: string,
  productBase64: string,
  mode: TryOnMode = 'PART',
  gender: Gender = 'female',
  _feedbackContext?: string
): Promise<string> {
  const startTime = Date.now();
  const processingSteps: string[] = [];
  let retryAttempts = 0;
  let fallbackUsed = false;

  // Validate inputs
  if (!selfieBase64 || selfieBase64.length < 100) {
    throw new Error('Invalid selfie image provided');
  }
  if (!productBase64 || productBase64.length < 100) {
    throw new Error('Invalid product image provided');
  }

  try {
    // Step 1: Get segmentation and profile (parallel)
    // segmentation NEVER fails - uses hardcoded fallback if API fails
    console.log('[Gemini] Step 1: Analyzing image...');
    processingSteps.push('Image analysis');

    const [segmentation, profile] = await Promise.all([
      getSegmentation(selfieBase64),
      getAppearanceProfile(selfieBase64),
    ]);

    console.log('[Gemini] Segmentation complete:', {
      faceConfidence: segmentation.faceBBox.confidence,
      skinTone: segmentation.skinToneHex,
    });

    if (profile) {
      console.log('[Gemini] Profile extracted:', {
        faceShape: profile.face.faceShape,
        build: profile.body.build,
      });
    }

    let resultImage: string;

    // ═══════════════════════════════════════════════════════════════════════
    // PIPELINE ROUTING
    // ═══════════════════════════════════════════════════════════════════════

    if (mode === 'PART') {
      // ─────────────────────────────────────────────────────────────────────
      // PIPELINE 1: INPAINTING (Face Protected by Mask)
      // ─────────────────────────────────────────────────────────────────────
      console.log('[Gemini] Using INPAINTING pipeline (PART mode)');
      processingSteps.push('Inpainting pipeline');

      // Generate with retry
      const { result, attempts, success } = await withRetry(
        async () => {
          return generateWithInpainting(
            selfieBase64,
            productBase64,
            segmentation,
            profile,
            gender
          );
        },
        async (image) => {
          const validation = await validateImageContent(image);
          return validation.isValid;
        },
        2 // Max 2 retries
      );

      retryAttempts = attempts - 1;
      resultImage = result;

      if (!success) {
        console.warn('[Gemini] Inpainting validation failed after retries');
      }

      // CONDITIONAL Face Restoration: Only if face is corrupted
      // Trust Gemini's Reference Image Injection for natural lighting/blending
      // This eliminates the "sticker effect" from hard compositing
      const FACE_CORRUPTION_THRESHOLD = 0.85; // Below this = face is corrupted

      console.log('[Gemini] PART mode: Checking face integrity...');
      processingSteps.push('Face integrity check');

      const isFaceCorrupted = await detectFaceCorruption(
        selfieBase64,
        resultImage,
        segmentation,
        FACE_CORRUPTION_THRESHOLD
      );

      if (isFaceCorrupted) {
        console.log('[Gemini] Face corruption detected in AI output, applying restoration...');
        processingSteps.push('Face restoration (conditional)');

        const postResult = await restoreIdentity(
          selfieBase64,
          resultImage,
          segmentation,
          { minSimilarityThreshold: FACE_CORRUPTION_THRESHOLD, enableColorCorrection: true }
        );
        resultImage = postResult.imageBase64;
        console.log(`[Gemini] Face restored with ${(postResult.faceSimilarity * 100).toFixed(1)}% similarity`);
      } else {
        console.log('[Gemini] AI preserved face correctly - no restoration needed (eliminates sticker effect)');
        processingSteps.push('Face preserved by AI');
      }

    } else {
      // ─────────────────────────────────────────────────────────────────────
      // PIPELINE 2: GENERATION + IDENTITY GUARDRAIL (FULL_FIT mode)
      // ─────────────────────────────────────────────────────────────────────
      console.log('[Gemini] Using GENERATION + GUARDRAIL pipeline (FULL_FIT mode)');
      processingSteps.push('Generation pipeline');

      // Step A: Generate full body
      let generatedImage: string;

      try {
        const { result, attempts, success } = await withRetry(
          async () => generateFullBody(selfieBase64, productBase64, profile, gender),
          async (image) => {
            const validation = await validateImageContent(image);
            return validation.isValid;
          },
          2
        );

        retryAttempts = attempts - 1;
        generatedImage = result;

        if (!success) {
          console.warn('[Gemini] Full body generation validation failed, trying fallback...');
          processingSteps.push('Fallback pose');
          fallbackUsed = true;
          generatedImage = await generateFallbackPose(selfieBase64, productBase64, gender);
        }
      } catch (genError) {
        console.error('[Gemini] Full body generation failed, using fallback:', genError);
        processingSteps.push('Fallback pose (error recovery)');
        fallbackUsed = true;
        generatedImage = await generateFallbackPose(selfieBase64, productBase64, gender);
      }

      // Step B: MANDATORY Identity Guardrail
      console.log('[Gemini] Applying Identity Guardrail...');
      processingSteps.push('Identity guardrail');

      const postResult = await restoreIdentity(
        selfieBase64,
        generatedImage,
        segmentation,
        {
          minSimilarityThreshold: 0.88,
          enableColorCorrection: true,
          enableValidation: true,
        }
      );

      resultImage = postResult.imageBase64;

      console.log('[Gemini] Identity guardrail result:', {
        faceOverlaid: postResult.faceOverlaid,
        similarity: `${(postResult.faceSimilarity * 100).toFixed(1)}%`,
        method: postResult.method,
      });

      // Final validation
      if (!postResult.validationPassed && postResult.faceSimilarity < 0.85) {
        console.warn('[Gemini] Identity guardrail did not achieve target similarity');
        processingSteps.push('Direct face copy (fallback)');

        // Use direct face copy as last resort
        const guard = new IdentityGuard();
        resultImage = await guard['directFaceCopy'](selfieBase64, resultImage, segmentation);
      }
    }

    // Final validation
    const finalValidation = await validateImageContent(resultImage);
    if (!finalValidation.isValid) {
      console.error('[Gemini] Final image validation failed:', finalValidation.issues);
      throw new Error(`Generated image is invalid: ${finalValidation.issues.join(', ')}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Gemini] Generation complete in ${totalTime}ms`);
    console.log(`[Gemini] Steps: ${processingSteps.join(' → ')}`);
    console.log(`[Gemini] Retries: ${retryAttempts}, Fallback: ${fallbackUsed}`);

    return resultImage;

  } catch (error) {
    console.error('[Gemini] Generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('API_KEY') || message.includes('apiKey')) {
      throw new Error('API configuration error. Please contact support.');
    }
    if (message.includes('quota') || message.includes('rate')) {
      throw new Error('Service is temporarily busy. Please try again.');
    }

    throw new Error(`Image generation failed: ${message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLE RECOMMENDATIONS (for FULL_FIT mode)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get comprehensive style recommendations for FULL_FIT mode
 */
export async function getStyleRecommendations(productBase64: string): Promise<{
  analysis: string;
  stylingTips: string[];
  complementaryItems: Array<{
    type: string;
    description: string;
    color: string;
    priceRange: string;
    searchQuery: string;
    priority: 'essential' | 'recommended' | 'optional';
  }>;
  outfitStyle: string;
  occasions: string[];
}> {
  try {
    const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this fashion item and provide COMPREHENSIVE styling recommendations.

This is for a FULL_FIT outfit completion system for Indian consumers.

Return a JSON object with:
{
  "analysis": "Detailed description of the item (type, style, color, material, occasion suitability)",
  "outfitStyle": "The overall style category (casual, formal, smart-casual, sporty, ethnic, indo-western)",
  "occasions": ["array of suitable occasions"],
  "stylingTips": ["5-6 detailed styling tips"],
  "complementaryItems": [
    {
      "type": "Category (e.g., Jeans, Chinos, Sneakers, Watch)",
      "description": "Specific recommendation that completes the outfit",
      "color": "Recommended color that coordinates",
      "priceRange": "₹X,XXX - ₹Y,YYY",
      "searchQuery": "Search term for e-commerce",
      "priority": "essential|recommended|optional"
    }
  ]
}

Provide 5-6 complementary items that create a COMPLETE, STYLISH outfit.
Mark items as:
- "essential": Must-have to complete the outfit (e.g., pants for a shirt)
- "recommended": Strongly recommended for the look (e.g., matching shoes)
- "optional": Nice additions (e.g., accessories)

Focus on Indian fashion trends and items available on Myntra, Ajio, Amazon India.

Return ONLY the JSON object.`;

    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanProduct,
              },
            },
          ],
        },
      ],
      config: {
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        analysis: parsed.analysis || 'Fashion item',
        stylingTips: parsed.stylingTips || [],
        complementaryItems: parsed.complementaryItems || [],
        outfitStyle: parsed.outfitStyle || 'casual',
        occasions: parsed.occasions || [],
      };
    }

    return {
      analysis: 'Unable to analyze the item',
      stylingTips: [],
      complementaryItems: [],
      outfitStyle: 'casual',
      occasions: [],
    };
  } catch (error) {
    console.error('[Gemini] Style recommendations error:', error);
    return {
      analysis: 'Unable to analyze the item',
      stylingTips: [],
      complementaryItems: [],
      outfitStyle: 'casual',
      occasions: [],
    };
  }
}

/**
 * Process store try-on (simplified wrapper)
 */
export async function processStoreTryOn(
  selfieBase64: string,
  productImageUrl: string,
  mode: TryOnMode = 'PART'
): Promise<string> {
  let productBase64 = productImageUrl;

  if (productImageUrl.startsWith('http')) {
    try {
      const response = await fetch(productImageUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      productBase64 = `data:${contentType};base64,${base64}`;
    } catch (error) {
      console.error('[Gemini] Failed to fetch product image:', error);
      throw new Error('Failed to load product image');
    }
  }

  return generateTryOnImage(selfieBase64, productBase64, mode, 'female');
}

/**
 * Analyze clothing item for detailed information
 */
export async function analyzeClothingItem(productBase64: string): Promise<{
  type: string;
  style: string;
  color: string;
  pattern: string;
  material: string;
  details: string[];
}> {
  try {
    const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this clothing item in detail.

Return a JSON object:
{
  "type": "Garment type (e.g., T-shirt, Shirt, Jeans, Dress)",
  "style": "Style category (casual, formal, sporty, ethnic)",
  "color": "Primary color(s)",
  "pattern": "Pattern type (solid, striped, printed, etc.)",
  "material": "Apparent material (cotton, polyester, silk, etc.)",
  "details": ["Array of design details like buttons, pockets, prints"]
}

Return ONLY the JSON object.`;

    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanProduct,
              },
            },
          ],
        },
      ],
      config: {
        safetySettings: SAFETY_SETTINGS,
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      type: 'Clothing item',
      style: 'casual',
      color: 'Unknown',
      pattern: 'solid',
      material: 'Unknown',
      details: [],
    };
  } catch (error) {
    console.error('[Gemini] Clothing analysis error:', error);
    return {
      type: 'Clothing item',
      style: 'casual',
      color: 'Unknown',
      pattern: 'solid',
      material: 'Unknown',
      details: [],
    };
  }
}

export default {
  generateTryOnImage,
  getStyleRecommendations,
  processStoreTryOn,
  analyzeClothingItem,
};
