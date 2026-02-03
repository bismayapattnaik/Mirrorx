import { GoogleGenAI } from '@google/genai';
import type { TryOnMode } from '@mrrx/shared';
import { swapFaceHighQuality } from './face-swap';

// Initialize Gemini client
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Feature flag for face swap post-processing
const ENABLE_FACE_SWAP = process.env.REPLICATE_API_TOKEN ? true : false;

// Model - Gemini 3 Pro Image Preview (Nano Banana Pro)
// State-of-the-art image generation with advanced reasoning ("Thinking")
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const TEXT_MODEL = 'gemini-2.0-flash';

type Gender = 'male' | 'female';

/**
 * System instruction for virtual try-on
 * Optimized for realistic output with consistent skin tone for face-swap
 */
const SYSTEM_INSTRUCTION = `You are a virtual try-on AI creating REALISTIC fashion photos.

INPUTS:
- Image 1: Person reference (face, body, skin tone - STUDY THIS CAREFULLY)
- Image 2: Clothing to apply

YOUR TASK:
Generate a photorealistic fashion photo showing the person from Image 1 wearing Image 2's clothing.

CRITICAL REQUIREMENTS:

1. SKIN TONE CONSISTENCY (MOST IMPORTANT):
   - Study the EXACT skin tone from Image 1's face
   - The generated body MUST have the IDENTICAL skin tone as the face
   - Neck, arms, hands, any visible skin = SAME exact color as face
   - No lighting differences between face area and body
   - This is crucial for realism - mismatched skin tones look fake

2. BODY TYPE: Match body proportions from Image 1. Do NOT slim or fatten.

3. CLOTHING: Natural draping on the person's body shape. Realistic wrinkles and shadows.

4. LIGHTING: Even, consistent lighting across the entire image (face and body).

OUTPUT: Professional fashion photograph, photorealistic, seamless appearance.`;

/**
 * Build the try-on prompt based on mode
 * Emphasizes skin tone matching for seamless face-swap
 */
const buildTryOnPrompt = (gender: Gender, mode: TryOnMode): string => {
  const person = gender === 'female' ? 'woman' : 'man';

  if (mode === 'FULL_FIT') {
    return `FULL OUTFIT MODE:

Generate this ${person} wearing a complete coordinated outfit:
- Image 2's garment is the HERO PIECE
- Add matching complementary pieces (complete outfit)
- Show FULL BODY from head to toe

CRITICAL - SKIN TONE:
Study Image 1's face skin tone carefully.
The body's skin (neck, arms, hands) MUST be the EXACT SAME skin tone.
Lighting must be consistent across face and body - no color shifts.

OUTPUT: Photorealistic full-body fashion photo with seamless, natural appearance.
Generate now.`;
  }

  return `SINGLE ITEM MODE:

Apply the garment from Image 2 onto the ${person} from Image 1.

CRITICAL - SKIN TONE:
Study Image 1's face skin tone carefully.
All visible skin (neck, arms) MUST match this EXACT skin tone.
Consistent lighting between face and body.

OUTPUT: Photorealistic fashion photo with natural, seamless appearance.
Generate now.`;
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
    // Using strict identity preservation with clothing-only modification
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `📸 IMAGE 1 - THE PERSON (Reference)

This is the person who will wear the outfit. Study:

APPEARANCE TO PRESERVE:
• Face features and structure
• Skin tone - EXACT shade (very important for realism)
• Hair color and style
• Body proportions and build
• Pose/angle (use similar)

IMPORTANT FOR REALISM:
The skin tone must be consistent from face to neck to any visible skin.
Match the lighting and shadow style from this image.`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanSelfie,
              },
            },
            {
              text: `👔 IMAGE 2 - THE CLOTHING (To Apply)

Extract the clothing from this image:
• Garment type and style
• Fabric color, pattern, texture
• Design details (buttons, collar, etc.)

Apply this outfit onto the person from Image 1.
Make sure the clothing:
• Drapes naturally on their body
• Has realistic wrinkles and folds
• Fits their body proportions
• Casts natural shadows`
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

          const geminiResult = `data:${mimeType};base64,${cleanData}`;

          // CRITICAL: Apply face swap to guarantee 100% face preservation
          // Gemini generates good clothing but often changes the face
          // Face swap replaces the generated face with the user's ACTUAL face
          if (ENABLE_FACE_SWAP) {
            console.log('[FaceSwap] Applying face swap for 100% identity preservation...');
            try {
              const faceSwappedResult = await swapFaceHighQuality(selfieBase64, geminiResult);
              console.log('[FaceSwap] Face swap completed - user\'s exact face preserved');
              return faceSwappedResult;
            } catch (faceSwapError) {
              console.error('[FaceSwap] Face swap failed, returning Gemini result:', faceSwapError);
              return geminiResult;
            }
          }

          return geminiResult;
        }

        // Check alternative formats - some Gemini versions use different structures
        if ((part as any).image?.data) {
          const imageData = (part as any).image;
          const mimeType = imageData.mimeType || 'image/png';
          const data = imageData.data;
          if (data && data.length > 100) {
            console.log(`Found image in alternative format (${data.length} chars)`);
            const altResult = `data:${mimeType};base64,${data}`;

            // Apply face swap for alternative format too
            if (ENABLE_FACE_SWAP) {
              try {
                return await swapFaceHighQuality(selfieBase64, altResult);
              } catch {
                return altResult;
              }
            }
            return altResult;
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
