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
 * System instruction for virtual try-on with STRICT identity preservation
 * Balance between exact face matching and natural clothing integration
 */
const SYSTEM_INSTRUCTION = `You are an AI that performs virtual clothing try-on with STRICT IDENTITY PRESERVATION.

⚠️ MOST IMPORTANT RULE: The face in your output MUST be the EXACT SAME face from Image 1.
NOT a similar face. NOT a beautified face. NOT a model's face. THE EXACT SAME PERSON.

═══════════════════════════════════════════════════════════════════
                    STRICT IDENTITY RULES
═══════════════════════════════════════════════════════════════════

You are performing INPAINTING - you are ONLY changing the clothing.
The person's face, head, hair, and body structure must remain UNCHANGED.

FACE IDENTITY (ABSOLUTE - NO CHANGES ALLOWED):
- EXACT same face shape (round, oval, square - whatever they have)
- EXACT same skin tone and complexion (dark, medium, light - keep it)
- EXACT same nose shape and size
- EXACT same eyes (shape, size, spacing)
- EXACT same lips and mouth
- EXACT same jawline and chin
- EXACT same forehead
- EXACT same facial hair (mustache, beard, stubble - if present)
- EXACT same eyebrows
- EXACT same hair color, texture, and style
- EXACT same ears (if visible)

DO NOT:
❌ Make the person look like a fashion model
❌ Lighten or darken their skin
❌ Change their face shape to be more "attractive"
❌ Smooth their skin or remove natural texture
❌ Change their hair style or color
❌ Make them look younger or older
❌ Change their body proportions
❌ Use a generic/stock face
❌ Beautify or enhance any feature

The person in Image 1 is a REAL PERSON. They want to see THEMSELVES in the clothes.
If you change their face, the result is USELESS to them.

═══════════════════════════════════════════════════════════════════
                    CLOTHING CHANGE ONLY
═══════════════════════════════════════════════════════════════════

WHAT YOU CAN CHANGE:
✓ The clothing/outfit only
✓ How the fabric drapes on their body
✓ Shadows cast by the new clothing

WHAT MUST STAY IDENTICAL:
✓ Their face (every feature)
✓ Their skin tone (face AND body)
✓ Their hair
✓ Their body shape/proportions
✓ Their pose (similar to original)

═══════════════════════════════════════════════════════════════════
                    NATURAL INTEGRATION
═══════════════════════════════════════════════════════════════════

While preserving identity, ensure:
- Lighting is consistent across face and clothing
- Skin tone matches from face to neck to body
- The collar/neckline sits naturally
- No "pasted on" appearance - it should look like one photograph

OUTPUT: The SAME person from Image 1, wearing the clothes from Image 2.`;

/**
 * Build the try-on prompt based on mode
 * STRICT identity preservation with natural clothing integration
 */
const buildTryOnPrompt = (gender: Gender, mode: TryOnMode): string => {
  const person = gender === 'female' ? 'woman' : 'man';
  const pronoun = gender === 'female' ? 'her' : 'his';

  const modeInstructions = mode === 'FULL_FIT'
    ? `Apply a complete styled look with this garment as centerpiece.`
    : `Apply ONLY the specific garment from Image 2.`;

  return `═══════════════════════════════════════════════════════════════
                    ⚠️ IDENTITY-LOCKED TRY-ON ⚠️
═══════════════════════════════════════════════════════════════

TASK: Show the EXACT person from Image 1 wearing clothes from Image 2.

🔒 THE FACE IS LOCKED - DO NOT MODIFY IT 🔒

Study the person in Image 1 carefully. Note:
• Their exact face shape
• Their exact skin tone (preserve it exactly)
• Their exact nose, eyes, lips, jawline
• Their exact hair color and style
• Any facial hair, moles, or unique features

Now generate an image where THIS EXACT PERSON is wearing the new outfit.

═══════════════════════════════════════════════════════════════
                    WHAT MUST BE IDENTICAL
═══════════════════════════════════════════════════════════════

The output face must match Image 1 so precisely that:
- A facial recognition system would confirm it's the same person
- Their family would instantly recognize them
- They could use it as a profile photo

PRESERVE EXACTLY:
✓ Face shape and proportions
✓ Skin tone and complexion (VERY IMPORTANT - keep the exact shade)
✓ All facial features (eyes, nose, mouth, chin)
✓ Hair color, texture, and style
✓ Facial hair if present
✓ Expression/mood

═══════════════════════════════════════════════════════════════
                    WHAT TO CHANGE
═══════════════════════════════════════════════════════════════

ONLY change the clothing:
${modeInstructions}

- Apply the garment naturally on ${pronoun} body
- Keep ${pronoun} body proportions from Image 1
- Natural fabric draping and shadows
- Consistent lighting across face and clothing

═══════════════════════════════════════════════════════════════
                    COMMON MISTAKES TO AVOID
═══════════════════════════════════════════════════════════════

❌ DO NOT generate a "similar looking" person
❌ DO NOT use a stock model face
❌ DO NOT lighten or change skin tone
❌ DO NOT beautify or enhance features
❌ DO NOT change the face shape
❌ DO NOT change hair color or style

The user wants to see THEMSELVES - not a prettier version, not a model.
Keep their EXACT appearance. Only change the clothes.

Generate the image now - same person, new clothes.`;
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
              text: `🔒 IMAGE 1 - THE PERSON (IDENTITY LOCKED - DO NOT CHANGE)

This is the person. Their face MUST appear EXACTLY the same in your output.

MEMORIZE these features - they must be IDENTICAL in output:
• Face shape: Study the exact shape of their face
• Skin tone: Note the EXACT shade - preserve it precisely
• Eyes: Shape, size, color, spacing
• Nose: Shape, size, bridge width
• Mouth: Lip shape, thickness
• Jawline: Shape of jaw and chin
• Hair: Color, texture, style, length
• Facial hair: If any mustache/beard, keep it exactly
• Any moles, marks, or unique features

⚠️ If the output face looks different, you have FAILED the task.
The person MUST be able to recognize themselves.`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanSelfie,
              },
            },
            {
              text: `👔 IMAGE 2 - THE CLOTHING (ONLY THING TO CHANGE)

Extract ONLY the clothing from this image:
• Garment type and style
• Fabric color and pattern
• Texture and material
• Design details

Apply this clothing onto the person from Image 1.
Do NOT use anything else from this image - only the clothes.`
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
