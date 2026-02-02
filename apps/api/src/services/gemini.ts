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
 * System instruction for NATURAL virtual try-on photography
 * Focus on realistic integration, not face pasting
 */
const SYSTEM_INSTRUCTION = `You are a professional fashion photographer creating realistic try-on images.

YOUR TASK: Re-photograph the person from Image 1 wearing the outfit from Image 2.

Think of this as if you brought the same person into a photo studio, dressed them in the new outfit, and took a fresh photograph. The result should look like a NATURAL photograph, not a composite or collage.

═══════════════════════════════════════════════════════════════════
                    NATURAL PHOTOGRAPHY APPROACH
═══════════════════════════════════════════════════════════════════

CRITICAL: Generate a UNIFIED, COHESIVE image where:
- The person and clothing exist as ONE natural photograph
- Lighting falls CONSISTENTLY across face, body, and clothing
- Shadows are natural and unified (face shadow matches body shadow)
- Skin tones blend naturally from face to neck to any visible body
- The neck/collar transition looks completely natural

IDENTITY PRESERVATION (the same person, naturally):
- Maintain the person's unique facial features and proportions
- Keep their natural skin tone, texture, and complexion
- Preserve their hair color, style, and texture
- Keep any distinctive features (moles, facial hair, glasses)
- The person should be immediately recognizable

WHAT MAKES IT LOOK NATURAL vs FAKE:
✓ NATURAL: Consistent lighting direction on face AND body
✓ NATURAL: Face shadows that match the clothing shadows
✓ NATURAL: Smooth skin tone transition from face to neck to shoulders
✓ NATURAL: Hair that interacts naturally with collar/neckline
✓ NATURAL: Face positioned naturally on shoulders (correct neck angle)

✗ FAKE (AVOID): Face lit differently than the body
✗ FAKE (AVOID): Sharp edge or halo around the face
✗ FAKE (AVOID): Face skin tone different from neck/body
✗ FAKE (AVOID): Face floating or disconnected from body
✗ FAKE (AVOID): No natural neck shadow or collar interaction

═══════════════════════════════════════════════════════════════════
                    TECHNICAL REQUIREMENTS
═══════════════════════════════════════════════════════════════════

LIGHTING UNITY:
- Analyze light direction in Image 1 (where shadows fall)
- Apply the SAME lighting to the entire output image
- Face highlights should match body/clothing highlights
- Shadow intensity should be consistent throughout

SKIN CONTINUITY:
- Face, neck, and any visible skin must be the SAME tone
- No color shifts at the collar/neckline
- Natural subsurface scattering at skin edges

CLOTHING INTEGRATION:
- Collar sits naturally around the neck
- Sleeves/fabric interact naturally with body position
- Wrinkles and draping follow the body's natural form
- Fabric texture is consistent throughout

OUTPUT:
- Professional fashion photography quality
- Single cohesive photograph (NOT a composite)
- The person naturally wearing the new outfit`;

/**
 * Build the try-on prompt based on mode
 * Uses natural photography language for realistic integration
 */
const buildTryOnPrompt = (gender: Gender, mode: TryOnMode): string => {
  const person = gender === 'female' ? 'woman' : 'man';
  const pronoun = gender === 'female' ? 'her' : 'his';

  const modeInstructions = mode === 'FULL_FIT'
    ? `Create a complete styled look with this garment as the centerpiece.`
    : `Show this ${person} wearing ONLY the specific garment from Image 2.`;

  return `══════════════════════════════════════════════════════════════
                    VIRTUAL TRY-ON PHOTOGRAPHY
══════════════════════════════════════════════════════════════

Create a NATURAL photograph of this ${person} wearing the outfit.

IMAGE 1 = The person (reference for identity and body)
IMAGE 2 = The clothing to put on them

YOUR GOAL: Generate what this ${person} would look like in a real photo
wearing this outfit. The result should look like a genuine photograph
taken in a studio - NOT like a face pasted onto a body.

═══════════════════════════════════════════════════════════════
                    KEY REQUIREMENTS
═══════════════════════════════════════════════════════════════

1. UNIFIED LIGHTING
   - Light must fall the SAME way on face, neck, and clothing
   - If there's a shadow on the left cheek, there should be shadow on left shoulder
   - No "spotlight on face" effect - everything lit consistently

2. SEAMLESS SKIN CONTINUITY
   - Face skin tone = neck skin tone = any visible body
   - NO color difference at the collar/neckline
   - Natural gradual transitions, no hard edges

3. NATURAL NECK & COLLAR AREA
   - This is the most critical area for realism
   - The neck must connect naturally to the shoulders
   - Collar/neckline sits properly around the neck
   - Hair falls naturally over or around the collar

4. IDENTITY PRESERVATION
   - Same face structure, features, and proportions
   - Same skin complexion and texture
   - Same hair color and style
   - Same glasses if wearing any
   - Recognizably the same person

═══════════════════════════════════════════════════════════════
                    CLOTHING APPLICATION
═══════════════════════════════════════════════════════════════

${modeInstructions}

- Fabric drapes naturally on ${pronoun} body shape
- Wrinkles and folds look realistic
- Size appears correct for ${pronoun} frame
- Clothing matches the style from Image 2 exactly

═══════════════════════════════════════════════════════════════
                    FINAL CHECK
═══════════════════════════════════════════════════════════════

Before outputting, verify:
□ Does the face look CONNECTED to the body (not pasted on)?
□ Is lighting CONSISTENT across the entire image?
□ Does skin tone match from face to neck to body?
□ Would this pass as a real photograph?

Generate a natural, realistic try-on photograph now.`;
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

    console.log(`Generating try-on with ${IMAGE_MODEL} (natural photography mode)...`);
    console.log(`Selfie size: ${cleanSelfie.length} chars, Product size: ${cleanProduct.length} chars`);

    // Generate with Gemini Image Model
    // Using natural photography approach for realistic integration
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `📸 THE PERSON (Image 1):

This is the person who will be wearing the outfit.
Note their:
- Face and unique features
- Skin tone and complexion
- Hair color and style
- Body proportions
- Any glasses or accessories

The output should show THIS SAME PERSON naturally photographed in new clothes.`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanSelfie,
              },
            },
            {
              text: `👔 THE OUTFIT (Image 2):

This is the clothing to dress them in.
Note the:
- Garment type and style
- Fabric color and pattern
- Texture and material
- Design details

Apply this outfit onto the person, as if they tried it on and you photographed them.`
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
