/**
 * @fileoverview Advanced Virtual Try-On Service using Gemini 3 Pro
 *
 * PRODUCTION-QUALITY IMPLEMENTATION
 *
 * Key Features:
 * - 100% Face Identity Preservation (exact face shape, weight, features)
 * - Body Proportion Anchoring (maintains user's actual body build)
 * - Face-Body Synchronization (face and body proportions match)
 * - Realistic Cloth Rendering (natural draping, textures, shadows)
 * - Complete FULL_FIT Outfit Generation
 *
 * NO external dependencies (Replicate) - Pure Gemini implementation
 */

import { GoogleGenAI } from '@google/genai';
import type { TryOnMode } from '@mrrx/shared';
import {
  createAppearanceProfile,
  generateIdentityAnchorPrompt,
  generateBodySyncPrompt,
  type AppearanceProfile,
} from './image-preprocessor';

// Initialize Gemini client
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Model Configuration - Gemini 3 Pro Image (Best quality)
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-2.0-flash';

type Gender = 'male' | 'female';

// Cache for appearance profiles (avoid re-analyzing same image)
const profileCache = new Map<string, { profile: AppearanceProfile; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get or create appearance profile with caching
 */
async function getAppearanceProfile(selfieBase64: string): Promise<AppearanceProfile | null> {
  // Create cache key from first 100 chars of base64
  const cacheKey = selfieBase64.substring(0, 100);
  const cached = profileCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[Gemini] Using cached appearance profile');
    return cached.profile;
  }

  console.log('[Gemini] Creating new appearance profile...');
  const profile = await createAppearanceProfile(selfieBase64);

  if (profile) {
    profileCache.set(cacheKey, { profile, timestamp: Date.now() });
  }

  return profile;
}

/**
 * System instruction for ultra-precise identity preservation
 */
const SYSTEM_INSTRUCTION = `You are an elite AI fashion photographer and virtual try-on specialist.

YOUR MISSION: Create PHOTOREALISTIC images where the person's identity is 100% preserved.

═══════════════════════════════════════════════════════════════════
                    ABSOLUTE REQUIREMENTS
═══════════════════════════════════════════════════════════════════

1. FACE IDENTITY = SACRED
   - The face must be IDENTICAL to Image 1 - same shape, same features
   - Face weight/fullness must match EXACTLY (no making face thinner or fatter)
   - All facial features must be preserved: eyes, nose, lips, jawline, cheeks
   - Skin tone must be EXACTLY the same shade

2. BODY PROPORTIONS = LOCKED
   - The body build must match Image 1 EXACTLY
   - If person is slim → generate slim body
   - If person is average → generate average body
   - If person is plus-size → generate plus-size body
   - NEVER change the person's apparent weight or build

3. FACE-BODY SYNCHRONIZATION
   - Face fullness must correlate with body build
   - A full face = fuller body, a slim face = slimmer body
   - Skin tone consistent across all visible skin
   - Natural proportional relationship

4. CLOTHING REALISM
   - Clothes must drape naturally on the ACTUAL body shape
   - Realistic wrinkles, folds, and fabric behavior
   - Accurate colors and textures from the product image
   - Proper fit for the specific body type

5. PHOTOGRAPHIC QUALITY
   - Natural lighting with soft shadows
   - Professional fashion photography aesthetic
   - High detail and clarity
   - No AI artifacts or unnatural elements

═══════════════════════════════════════════════════════════════════
                    FORBIDDEN ACTIONS
═══════════════════════════════════════════════════════════════════

❌ NEVER make the face thinner or fatter
❌ NEVER change the body build/weight
❌ NEVER alter facial features
❌ NEVER change skin tone
❌ NEVER create mismatched face-body proportions
❌ NEVER over-smooth skin (plastic look)
❌ NEVER generate flat/artificial lighting`;

/**
 * Build the comprehensive try-on prompt with identity anchoring
 */
function buildAdvancedTryOnPrompt(
  gender: Gender,
  mode: TryOnMode,
  profile: AppearanceProfile | null
): string {
  const person = gender === 'female' ? 'woman' : 'man';
  const possessive = gender === 'female' ? 'her' : 'his';

  // Identity anchoring section (if profile available)
  const identitySection = profile
    ? generateIdentityAnchorPrompt(profile)
    : `
═══════════════════════════════════════════════════════════════════
                    IDENTITY PRESERVATION
═══════════════════════════════════════════════════════════════════

Preserve from Image 1 EXACTLY:
- Face shape, width, and fullness
- All facial features without modification
- Skin tone (exact shade)
- Body build and proportions
- Hair style and color
`;

  // Body sync section (if profile available)
  const bodySyncSection = profile
    ? generateBodySyncPrompt(profile)
    : `
═══════════════════════════════════════════════════════════════════
                    FACE-BODY SYNCHRONIZATION
═══════════════════════════════════════════════════════════════════

- Face fullness must match body build
- If the face appears [slim/average/full], the body must match
- Consistent skin tone across all visible skin
- Natural proportional relationship between face and body
`;

  // Mode-specific instructions
  let modeInstructions: string;

  if (mode === 'FULL_FIT') {
    modeInstructions = `
═══════════════════════════════════════════════════════════════════
                    FULL_FIT MODE: COMPLETE OUTFIT
═══════════════════════════════════════════════════════════════════

Create a COMPLETE, COORDINATED OUTFIT:

1. **Primary Garment** (from Image 2):
   - Apply the exact clothing item from Image 2
   - Maintain all design details, colors, patterns
   - Natural fit on ${possessive} body

2. **Complementary Items** (AI-generated to match):
   - Add coordinating bottom wear (if top shown) or top (if bottom shown)
   - Include appropriate footwear
   - Add subtle accessories if fitting the style
   - Everything should form a cohesive, fashionable outfit

3. **Style Cohesion**:
   - All items should match in style (casual/formal/sporty)
   - Color palette should be harmonious
   - Overall look should be fashion-forward and complete

4. **Full Body Visibility**:
   - Show the complete outfit from head to at least mid-thigh
   - All clothing items should be clearly visible
   - Natural standing pose to showcase the outfit
`;
  } else {
    modeInstructions = `
═══════════════════════════════════════════════════════════════════
                    PART MODE: SINGLE GARMENT
═══════════════════════════════════════════════════════════════════

Apply ONLY the specific garment from Image 2:

1. **Single Item Focus**:
   - Apply only the clothing item shown in Image 2
   - Maintain the person's existing other clothing
   - Focus on how this one item fits and looks

2. **Natural Integration**:
   - The new item should blend naturally with existing clothes
   - Realistic interaction between garments (tucking, layering)
`;
  }

  return `
═══════════════════════════════════════════════════════════════════
            PROFESSIONAL VIRTUAL TRY-ON GENERATION
═══════════════════════════════════════════════════════════════════

Generate a PHOTOREALISTIC image of the ${person} from Image 1 wearing
the clothing from Image 2.

The result MUST look like a REAL PHOTOGRAPH taken by a professional
fashion photographer - not AI-generated.

${identitySection}

${bodySyncSection}

${modeInstructions}

═══════════════════════════════════════════════════════════════════
                    CLOTHING APPLICATION
═══════════════════════════════════════════════════════════════════

From Image 2, extract and apply:
• Exact garment style, cut, and design
• Precise fabric color and pattern
• Texture and material appearance
• All design details (buttons, zippers, logos, stitching)

Apply clothing with PHOTOREALISTIC quality:
• Natural draping on ${possessive} specific body shape
• Realistic wrinkles and folds at natural stress points
• Proper fit for ${possessive} ${profile?.body.build || 'actual'} build
• Natural shadows under and around clothing
• Fabric behavior appropriate to the material

═══════════════════════════════════════════════════════════════════
                    LIGHTING & PHOTOGRAPHY
═══════════════════════════════════════════════════════════════════

• Soft, natural lighting (studio or natural daylight feel)
• Consistent shadows on face, body, and clothing
• Light direction from front-above (standard portrait lighting)
• No harsh shadows or flat lighting
• Subtle ambient fill to prevent deep shadows

═══════════════════════════════════════════════════════════════════
                    FINAL QUALITY CHECK
═══════════════════════════════════════════════════════════════════

Before generating, verify:
✓ Face is IDENTICAL to Image 1 (shape, features, weight)
✓ Body build matches Image 1 EXACTLY
✓ Skin tone is consistent everywhere
✓ Face and body proportions are synchronized
✓ Clothing looks realistic and properly fitted
✓ Image looks like a real photograph

Generate the photorealistic try-on image now.`;
}

/**
 * Generate virtual try-on image using Gemini 3 Pro Image
 * With advanced identity preservation and body synchronization
 */
export async function generateTryOnImage(
  selfieBase64: string,
  productBase64: string,
  mode: TryOnMode = 'PART',
  gender: Gender = 'female',
  _feedbackContext?: string
): Promise<string> {
  // Validate inputs
  if (!selfieBase64 || selfieBase64.length < 100) {
    throw new Error('Invalid selfie image provided');
  }
  if (!productBase64 || productBase64.length < 100) {
    throw new Error('Invalid product image provided');
  }

  try {
    // Clean base64 strings
    const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

    if (!cleanSelfie || cleanSelfie.length < 100) {
      throw new Error('Selfie image data is too small or invalid');
    }
    if (!cleanProduct || cleanProduct.length < 100) {
      throw new Error('Product image data is too small or invalid');
    }

    // CRITICAL: Extract appearance profile for identity anchoring
    console.log('[Gemini] Extracting appearance profile for identity anchoring...');
    const profile = await getAppearanceProfile(selfieBase64);

    if (profile) {
      console.log('[Gemini] Profile extracted:', {
        faceShape: profile.face.faceShape,
        build: profile.body.build,
        skinTone: profile.face.skinTone.substring(0, 30) + '...',
      });
    } else {
      console.log('[Gemini] Profile extraction failed, using fallback prompts');
    }

    // Build the advanced prompt with identity anchoring
    const prompt = buildAdvancedTryOnPrompt(gender, mode, profile);

    console.log(`[Gemini] Generating try-on with ${IMAGE_MODEL}...`);
    console.log(`[Gemini] Mode: ${mode}, Gender: ${gender}`);
    console.log(`[Gemini] Selfie: ${cleanSelfie.length} chars, Product: ${cleanProduct.length} chars`);

    // Generate with Gemini 3 Pro Image
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `📸 IMAGE 1 - THE PERSON (Identity Source)

This is the person whose identity must be preserved EXACTLY.

STUDY AND PRESERVE:
${profile ? `
• Face: ${profile.face.faceShape} shape, ${profile.face.faceWidth} width, ${profile.face.cheeks} cheeks
• Build: ${profile.body.build} body with ${profile.body.shoulderWidth} shoulders
• Skin: ${profile.face.skinTone}
• Features: ${profile.face.eyeShape} eyes, ${profile.face.noseShape} nose, ${profile.face.lipShape} lips
• Hair: ${profile.face.hairStyle}, ${profile.face.hairColor}
` : `
• Face shape, width, and fullness
• Body build and proportions
• Skin tone (exact shade)
• All facial features
• Hair style and color
`}

CRITICAL: The generated image must show THIS EXACT PERSON with THIS EXACT BODY BUILD.
Do NOT make the face thinner/fatter or body slimmer/heavier.`,
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanSelfie,
              },
            },
            {
              text: `👔 IMAGE 2 - THE CLOTHING (To Apply)

Extract this clothing to apply onto the person from Image 1:

• Garment type and style
• Exact colors and patterns
• Fabric texture and material
• All design details (buttons, logos, stitching)

Apply this clothing REALISTICALLY:
• Natural draping on their ${profile?.body.build || 'actual'} body
• Realistic wrinkles at stress points
• Proper fit for their proportions
• Natural shadows and depth`,
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanProduct,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseModalities: ['TEXT', 'IMAGE'],
        // High resolution output
        imageConfig: {
          aspectRatio: '3:4', // Portrait for fashion
          imageSize: '2K',
        },
      },
    });

    // Log response structure
    console.log('[Gemini] Response received, candidates:', response.candidates?.length || 0);

    // Extract image from response
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      const parts = candidate.content?.parts || [];

      console.log(`[Gemini] Parts in response: ${parts.length}`);

      // Log structure for debugging
      console.log('[Gemini] Response structure:', JSON.stringify({
        finishReason: candidate.finishReason,
        partsCount: parts.length,
        partTypes: parts.map((p: any) => ({
          hasText: !!p.text,
          hasInlineData: !!p.inlineData,
          inlineDataMime: p.inlineData?.mimeType,
          inlineDataLength: p.inlineData?.data?.length || 0,
        }))
      }, null, 2));

      // Check for blocked content
      if ((candidate.finishReason as string) === 'SAFETY' || (candidate.finishReason as string) === 'BLOCKED') {
        console.error('[Gemini] Content blocked by safety filters');
        throw new Error('Image generation was blocked by safety filters. Please try different images.');
      }

      for (const part of parts) {
        // Check for inline image data
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const mimeType = part.inlineData.mimeType;
          const data = part.inlineData.data;

          if (!mimeType || mimeType === '' || !data || data.length < 100) {
            console.error('[Gemini] Invalid image data received');
            continue;
          }

          // Clean data if needed
          const cleanData = data.startsWith('data:')
            ? data.split(',')[1] || data
            : data;

          console.log(`[Gemini] Try-on image generated successfully (${cleanData.length} chars)`);

          return `data:${mimeType};base64,${cleanData}`;
        }

        // Check alternative format
        if ((part as any).image?.data) {
          const imageData = (part as any).image;
          const mimeType = imageData.mimeType || 'image/png';
          const data = imageData.data;
          if (data && data.length > 100) {
            console.log(`[Gemini] Found image in alternative format (${data.length} chars)`);
            return `data:${mimeType};base64,${data}`;
          }
        }
      }

      // Log any text response for debugging
      let textResponse = '';
      for (const part of parts) {
        if (part.text && !(part as any).thought) {
          textResponse += part.text;
        }
      }
      if (textResponse) {
        console.log('[Gemini] Model text response:', textResponse.substring(0, 500));

        if (textResponse.toLowerCase().includes('cannot') ||
            textResponse.toLowerCase().includes('unable') ||
            textResponse.toLowerCase().includes('sorry')) {
          throw new Error(`Model declined: ${textResponse.substring(0, 200)}`);
        }
      }
    } else {
      console.error('[Gemini] No candidates in response');
    }

    throw new Error('No image was generated. Please try again with clearer photos.');

  } catch (error) {
    console.error('[Gemini] Generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('API_KEY') || message.includes('apiKey')) {
      throw new Error('API configuration error. Please contact support.');
    }
    if (message.includes('quota') || message.includes('rate')) {
      throw new Error('Service is temporarily busy. Please try again.');
    }
    if (message.includes('404') || message.includes('not found')) {
      throw new Error('Image generation service unavailable. Please try again later.');
    }

    throw new Error(`Image generation failed: ${message}`);
  }
}

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
