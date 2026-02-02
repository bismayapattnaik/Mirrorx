import { GoogleGenAI } from '@google/genai';
import type { TryOnMode } from '@mrrx/shared';

// Initialize Gemini client
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Model - Gemini 3 Pro Image Preview (Nano Banana Pro)
// State-of-the-art image generation with advanced reasoning ("Thinking")
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-2.0-flash';

type Gender = 'male' | 'female';

/**
 * System instruction for EXACT FACE CLONING virtual try-on
 * Zero tolerance for any facial changes - pixel-level face preservation
 */
const SYSTEM_INSTRUCTION = `You are a FACE-CLONING virtual try-on compositor.

CRITICAL: This is a COMPOSITING task, NOT a generation task.
You must EXTRACT and CLONE the exact face from Image 1 and composite it onto the output.

═══════════════════════════════════════════════════════════════════
                    FACE CLONING PROTOCOL
═══════════════════════════════════════════════════════════════════

The face in your output must be a PIXEL-PERFECT CLONE of Image 1.
Think of this as a face transplant operation - you are copying the exact face.

MANDATORY FACE CLONING CHECKLIST (verify each one):

□ SKULL STRUCTURE: Exact same head shape, forehead size, jaw width
□ FACE LENGTH: Identical face length ratio (forehead to chin)
□ EYE GEOMETRY: Same eye shape, size, spacing, depth, eyelid crease
□ NOSE: Exact nose bridge width, nostril shape, tip angle, length
□ MOUTH: Identical lip thickness, width, cupid's bow, lip color
□ JAWLINE: Same jaw angle, chin shape, chin prominence
□ CHEEKBONES: Exact cheekbone position and prominence
□ SKIN: Same skin tone, texture, any moles, marks, or blemishes
□ EYEBROWS: Identical shape, thickness, arch, color
□ HAIRLINE: Exact hairline shape and position
□ HAIR: Same hair color, texture, style, volume
□ FACIAL HAIR: If present, identical pattern and density
□ GLASSES: If wearing glasses, keep the EXACT same glasses
□ EXPRESSION: Maintain similar expression/mood

ABSOLUTE PROHIBITIONS:

🚫 DO NOT generate a "similar looking" person - clone the EXACT person
🚫 DO NOT beautify, enhance, or improve any facial feature
🚫 DO NOT smooth skin, remove blemishes, or apply filters
🚫 DO NOT change face proportions even 1%
🚫 DO NOT make the person look more attractive or photogenic
🚫 DO NOT change eye color, skin tone, or hair color
🚫 DO NOT alter age appearance in any direction
🚫 DO NOT change facial bone structure
🚫 DO NOT use a different person's face as reference
🚫 DO NOT hallucinate or imagine facial features

VERIFICATION TEST:
The person in Image 1 should be able to use the output as their ID photo.
Their mother should instantly recognize them without any hesitation.

═══════════════════════════════════════════════════════════════════
                    CLOTHING APPLICATION
═══════════════════════════════════════════════════════════════════

Image 2 provides ONLY the clothing to apply:
- Extract the garment design, color, pattern, texture
- Apply it onto the cloned person from Image 1
- Adjust draping naturally to the person's pose
- Match lighting to Image 1

PRIORITY ORDER:
1. FACE ACCURACY (non-negotiable - must be 100% identical)
2. Body proportions (maintain from Image 1)
3. Clothing application (from Image 2)
4. Lighting and realism

OUTPUT REQUIREMENTS:
- Photorealistic quality
- The face must pass facial recognition as the same person
- Natural clothing drape and shadows
- Professional fashion photography aesthetic`;

/**
 * Build the try-on prompt based on mode
 * Uses aggressive face-cloning language for 100% identity preservation
 */
const buildTryOnPrompt = (gender: Gender, mode: TryOnMode): string => {
  const person = gender === 'female' ? 'woman' : 'man';
  const pronoun = gender === 'female' ? 'her' : 'his';

  const modeInstructions = mode === 'FULL_FIT'
    ? `OUTFIT MODE: Full coordinated look with the garment as centerpiece.`
    : `SINGLE ITEM MODE: Apply ONLY the garment from Image 2.`;

  return `══════════════════════════════════════════════════════════════
                      FACE CLONING TRY-ON TASK
══════════════════════════════════════════════════════════════

⚠️ CRITICAL: CLONE THE EXACT FACE FROM IMAGE 1 ⚠️

This is NOT about generating a similar-looking person.
You must COPY the EXACT face - every pixel, every feature, every detail.

STEP 1 - FACE EXTRACTION (from Image 1):
Study and memorize every facial detail of this ${person}:
• Exact skull shape and face dimensions
• Precise eye shape, size, color, spacing, and depth
• Exact nose structure - bridge, tip, nostrils
• Lip shape, thickness, and color
• Jawline angle and chin shape
• Skin tone, texture, and any unique marks
• Eyebrow shape and thickness
• Hair color, texture, and style
• Glasses (if any) - keep the EXACT same frames

STEP 2 - FACE CLONING (to output):
Transfer this EXACT face to the output image.
The face must be so identical that facial recognition software would match it.
The ${person}'s family would recognize them INSTANTLY with zero doubt.

STEP 3 - CLOTHING APPLICATION (from Image 2):
${modeInstructions}
Apply the clothing naturally with proper draping for ${pronoun} body.

══════════════════════════════════════════════════════════════
                    VERIFICATION CHECKLIST
══════════════════════════════════════════════════════════════

Before generating, verify:
✓ Face shape IDENTICAL to Image 1
✓ All facial features EXACTLY match Image 1
✓ Skin tone UNCHANGED from Image 1
✓ NO beautification or enhancement applied
✓ Glasses preserved if present in Image 1
✓ Hair EXACTLY as in Image 1
✓ Expression similar to Image 1

FAILURE = generating a different-looking person
SUCCESS = the exact same person wearing new clothes

Generate the face-cloned try-on image now.`;
};

/**
 * Generate virtual try-on image using Gemini Image Generation
 * Maximum quality with strict identity preservation
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

    // Validate cleaned base64
    if (!cleanSelfie || cleanSelfie.length < 100) {
      throw new Error('Selfie image data is too small or invalid');
    }
    if (!cleanProduct || cleanProduct.length < 100) {
      throw new Error('Product image data is too small or invalid');
    }

    const prompt = buildTryOnPrompt(gender, mode);

    console.log(`Generating try-on with ${IMAGE_MODEL} (strict identity preservation)...`);
    console.log(`Selfie size: ${cleanSelfie.length} chars, Product size: ${cleanProduct.length} chars`);

    // Generate with Gemini Image Model
    // Using aggressive face-cloning instructions
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `🔒 IMAGE 1 - FACE TO CLONE (THIS IS THE EXACT FACE YOU MUST REPLICATE):

Study this face carefully. You must CLONE every detail:
- This exact face shape and skull structure
- These exact eyes (shape, color, spacing, depth)
- This exact nose (bridge, tip, nostrils)
- These exact lips (shape, thickness, color)
- This exact jawline and chin
- This exact skin tone and texture
- These exact eyebrows
- This exact hair (color, style, texture)
- Any glasses, moles, or unique features

The output face MUST be this person - not someone who looks similar.`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanSelfie,
              },
            },
            {
              text: `👔 IMAGE 2 - CLOTHING TO APPLY (extract ONLY the garment):

Use this image ONLY for the clothing/outfit.
Do NOT use any facial features from this image.
Do NOT let this image influence the face in any way.
Extract: fabric, color, pattern, style, fit.`
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
        // High resolution output for better face detail
        imageConfig: {
          aspectRatio: '3:4', // Portrait orientation for fashion
          imageSize: '2K',    // High quality output
        },
      },
    });

    // Log response structure for debugging
    console.log('Response received, candidates:', response.candidates?.length || 0);

    // Extract image from response
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      const parts = candidate.content?.parts || [];

      console.log(`Parts in response: ${parts.length}`);

      // Log full structure for debugging
      console.log('Response structure:', JSON.stringify({
        finishReason: candidate.finishReason,
        partsCount: parts.length,
        partTypes: parts.map((p: any) => ({
          hasText: !!p.text,
          hasInlineData: !!p.inlineData,
          hasFileData: !!p.fileData,
          hasImage: !!p.image,
          inlineDataMime: p.inlineData?.mimeType,
          inlineDataLength: p.inlineData?.data?.length || 0,
        }))
      }, null, 2));

      // Check for blocked content
      if ((candidate.finishReason as string) === 'SAFETY' || (candidate.finishReason as string) === 'BLOCKED') {
        console.error('Content was blocked by safety filters');
        throw new Error('Image generation was blocked by safety filters. Please try different images.');
      }

      for (const part of parts) {
        // Log each part for debugging
        console.log('Processing part:', {
          hasInlineData: !!part.inlineData,
          mimeType: part.inlineData?.mimeType,
          dataLength: part.inlineData?.data?.length || 0,
          dataPreview: part.inlineData?.data?.substring(0, 50)
        });

        // Check for inline image data
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const mimeType = part.inlineData.mimeType;
          const data = part.inlineData.data;

          // Validate the data
          if (!mimeType || mimeType === '') {
            console.error('Empty mimeType received');
            continue;
          }
          if (!data || data.length < 100) {
            console.error('Image data received but is too small:', data?.length || 0);
            continue;
          }

          // Validate base64 format (should not start with data: prefix)
          const cleanData = data.startsWith('data:')
            ? data.split(',')[1] || data
            : data;

          console.log(`Try-on image generated successfully with ${IMAGE_MODEL} (${cleanData.length} chars)`);
          return `data:${mimeType};base64,${cleanData}`;
        }

        // Check alternative formats - some Gemini versions use different structures
        if ((part as any).image?.data) {
          const imageData = (part as any).image;
          const mimeType = imageData.mimeType || 'image/png';
          const data = imageData.data;
          if (data && data.length > 100) {
            console.log(`Found image in alternative format (${data.length} chars)`);
            return `data:${mimeType};base64,${data}`;
          }
        }

        // Check for fileData format
        if ((part as any).fileData?.mimeType?.startsWith('image/')) {
          console.log('Found fileData format - this requires additional handling');
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
        console.log('Model text response:', textResponse.substring(0, 1000));

        // Check if the model is giving an error message
        if (textResponse.toLowerCase().includes('cannot') ||
            textResponse.toLowerCase().includes('unable') ||
            textResponse.toLowerCase().includes('sorry')) {
          throw new Error(`Model declined to generate image: ${textResponse.substring(0, 200)}`);
        }
      }
    } else {
      console.error('No candidates in response');
    }

    throw new Error('No image was generated. The AI model did not return an image. Please try again with clearer photos.');

  } catch (error) {
    console.error('Gemini generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Provide more helpful error messages
    if (message.includes('API_KEY') || message.includes('apiKey')) {
      throw new Error('API configuration error. Please contact support.');
    }
    if (message.includes('quota') || message.includes('rate')) {
      throw new Error('Service is temporarily busy. Please try again in a few moments.');
    }
    if (message.includes('404') || message.includes('not found')) {
      throw new Error('Image generation service is temporarily unavailable. Please try again later.');
    }

    throw new Error(`Image generation failed: ${message}`);
  }
}

/**
 * Get style recommendations for an outfit
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
  }>;
}> {
  try {
    const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this fashion item and provide styling recommendations for Indian consumers.

Return a JSON object with:
- "analysis": Detailed description (type, style, color, material, occasion)
- "stylingTips": Array of 4-5 styling tips
- "complementaryItems": Array of 4-5 items to complete the outfit:
  - "type": Category (Jeans, Trousers, Sneakers, Watch, etc.)
  - "description": Specific recommendation
  - "color": Recommended color
  - "priceRange": Price in INR (e.g., "₹1,500 - ₹3,000")
  - "searchQuery": Search term for e-commerce sites

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
      return JSON.parse(jsonMatch[0]);
    }

    return {
      analysis: 'Unable to analyze the item',
      stylingTips: [],
      complementaryItems: [],
    };
  } catch (error) {
    console.error('Style recommendations error:', error);
    return {
      analysis: 'Unable to analyze the item',
      stylingTips: [],
      complementaryItems: [],
    };
  }
}

/**
 * Process try-on in store context (simplified wrapper)
 * Uses the main try-on engine but returns base64 directly
 */
export async function processStoreTryOn(
  selfieBase64: string,
  productImageUrl: string,
  mode: TryOnMode = 'PART'
): Promise<string> {
  // If product is a URL, fetch and convert to base64
  let productBase64 = productImageUrl;

  if (productImageUrl.startsWith('http')) {
    try {
      const response = await fetch(productImageUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      productBase64 = `data:${contentType};base64,${base64}`;
    } catch (error) {
      console.error('Failed to fetch product image:', error);
      throw new Error('Failed to load product image');
    }
  }

  // Generate try-on using the main function
  return generateTryOnImage(selfieBase64, productBase64, mode, 'female');
}

export default {
  generateTryOnImage,
  getStyleRecommendations,
  processStoreTryOn,
};
