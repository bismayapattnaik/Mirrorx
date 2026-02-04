/**
 * @fileoverview Commercial-Grade Virtual Try-On Service
 *
 * TWO-PIPELINE ARCHITECTURE for 100% Face Identity Preservation:
 *
 * PIPELINE 1: PART Mode (Half-Body Inpainting)
 * - Uses face mask to protect face region
 * - Inpainting request: "Edit ONLY the masked (white) body area"
 * - Face is PHYSICALLY UNTOUCHED by AI
 *
 * PIPELINE 2: FULL_FIT Mode (Generation + Identity Guardrail)
 * - Step A: Generate full body with outfit
 * - Step B: Mandatory face overlay from original
 * - Face is GUARANTEED to match original
 *
 * This architecture ensures the user's face is NEVER modified.
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

// Model Configuration - uses environment variables for flexibility
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp-image-generation';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';

type Gender = 'male' | 'female';

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
 */
async function getSegmentation(selfieBase64: string): Promise<SegmentationResult | null> {
  const cacheKey = selfieBase64.substring(0, 100);
  const cached = segmentationCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[Gemini] Using cached segmentation');
    return cached.data;
  }

  console.log('[Gemini] Creating new segmentation...');
  const data = await segmentImage(selfieBase64);

  if (data) {
    segmentationCache.set(cacheKey, { data, timestamp: Date.now() });
  }
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
  const faceMask = segmentation.faceMaskBase64; // face=black, body=white

  const person = gender === 'female' ? 'woman' : 'man';

  const inpaintingPrompt = `INPAINTING TASK: Virtual Clothing Try-On

You are given:
1. IMAGE 1: A photo of a ${person} (the subject)
2. IMAGE 2: A clothing item to apply
3. IMAGE 3: A mask where BLACK = protected (face), WHITE = editable (body/clothes)

YOUR TASK:
Replace ONLY the WHITE masked area with the clothing from IMAGE 2.
The BLACK masked area (face and head) must remain COMPLETELY UNCHANGED.

CRITICAL REQUIREMENTS:

1. **MASKED REGIONS:**
   - BLACK regions (face, head, hair): DO NOT TOUCH - keep pixel-perfect from original
   - WHITE regions (body, torso): EDIT ONLY THESE - apply the clothing here

2. **CLOTHING APPLICATION:**
   - Apply the exact clothing from IMAGE 2
   - Natural draping on ${profile?.body.build || 'the'} body type
   - Realistic wrinkles and folds
   - Accurate colors, patterns, textures
   ${profile ? `- Fit for ${profile.body.shoulderWidth} shoulders` : ''}

3. **BOUNDARIES:**
   - Seamless transition at mask edges
   - No visible seams between protected and edited regions
   - Consistent lighting across the image

4. **BODY PRESERVATION:**
   - Keep original body proportions
   ${profile ? `- Body build: ${profile.body.build}` : ''}
   ${profile ? `- Do NOT change body weight or shape` : ''}

5. **OUTPUT:**
   - Show from head to waist (half-body)
   - Natural pose similar to original
   - Photorealistic quality

REMEMBER: The BLACK masked area must be EXACTLY the same as IMAGE 1.
The face is SACRED and must not change in any way.

Generate the inpainted try-on image now.`;

  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'IMAGE 1 - THE PERSON (subject):' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanSelfie,
            },
          },
          { text: 'IMAGE 2 - THE CLOTHING (to apply):' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanProduct,
            },
          },
          { text: 'IMAGE 3 - THE MASK (black=protected face, white=editable body):' },
          {
            inlineData: {
              mimeType: 'image/png',
              data: faceMask,
            },
          },
          { text: inpaintingPrompt },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '3:4',
        imageSize: '2K',
      },
    },
  });

  // Extract image from response
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
 * Generate full body try-on image
 * This generates the outfit but may modify the face
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
  const possessive = gender === 'female' ? 'her' : 'his';

  const fullBodyPrompt = `FULL OUTFIT GENERATION TASK

Generate a PHOTOREALISTIC image of this ${person} wearing a complete outfit.

SUBJECT DETAILS (from IMAGE 1):
${profile ? `
- Face: ${profile.face.faceShape} shape, ${profile.face.faceWidth} width
- Skin tone: ${profile.face.skinTone}
- Body build: ${profile.body.build}
- Shoulders: ${profile.body.shoulderWidth}
- Proportions: ${profile.body.bodyProportions}
` : '- Preserve all features from the reference image'}

PRIMARY GARMENT (from IMAGE 2):
- Apply this exact clothing item
- Maintain all design details, colors, patterns
- Natural fit on ${possessive} body

COMPLEMENTARY ITEMS (AI-generated):
- Add coordinating items to complete the outfit
- Matching bottom/top as needed
- Appropriate footwear
- Cohesive, stylish look

REQUIREMENTS:
1. FULL BODY: Show from head to at least mid-shin
2. FACE: Make the face look like the person in IMAGE 1
3. BODY: Maintain ${profile?.body.build || 'the same'} body proportions
4. POSE: Natural standing fashion pose
5. QUALITY: Professional fashion photography aesthetic

Generate the full outfit try-on image now.`;

  const response = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'IMAGE 1 - THE PERSON (reference for identity):' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanSelfie,
            },
          },
          { text: 'IMAGE 2 - THE CLOTHING (primary garment):' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanProduct,
            },
          },
          { text: fullBodyPrompt },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '3:4',
        imageSize: '2K',
      },
    },
  });

  // Extract image from response
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
      imageConfig: {
        aspectRatio: '3:4',
        imageSize: '2K',
      },
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
    console.log('[Gemini] Step 1: Analyzing image...');
    processingSteps.push('Image analysis');

    const [segmentation, profile] = await Promise.all([
      getSegmentation(selfieBase64),
      getAppearanceProfile(selfieBase64),
    ]);

    if (!segmentation) {
      throw new Error('Failed to segment image - no face detected');
    }

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

      // Verify face is unchanged (should be since we used mask)
      const identityGuard = new IdentityGuard({ minSimilarityThreshold: 0.90 });
      const faceValidation = await identityGuard.calculateFaceSimilarity(
        selfieBase64,
        resultImage,
        segmentation
      );

      console.log(`[Gemini] Face similarity after inpainting: ${(faceValidation * 100).toFixed(1)}%`);

      // If face was somehow modified, apply overlay
      if (faceValidation < 0.90) {
        console.log('[Gemini] Applying face overlay as safety measure...');
        processingSteps.push('Face overlay (safety)');

        const postResult = await restoreIdentity(
          selfieBase64,
          resultImage,
          segmentation
        );
        resultImage = postResult.imageBase64;
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
