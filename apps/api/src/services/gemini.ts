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
 * System instruction for hyper-accurate virtual try-on
 * Strict identity preservation with zero face changes
 */
const SYSTEM_INSTRUCTION = `You are a hyper-accurate virtual try-on engine.

Your sole task is to generate a realistic preview of how a selected clothing item will look on the user, while preserving the user's identity with absolute fidelity.

You must treat the user's face and body identity as immutable.
No creative interpretation is allowed on facial features or identity.

IMAGE ROLE DEFINITION:

Image 1: This is the user's reference image.
It defines the user's exact identity, including:
- Face structure
- Skin tone
- Facial features
- Hairline
- Hair texture
- Facial expression
- Body proportions (as visible)

Image 2: This is the clothing reference image.
It defines ONLY the clothing:
- Fabric
- Color
- Texture
- Stitching
- Fit
- Sleeves
- Length
- Patterns

STRICT IDENTITY PRESERVATION RULES (NON-NEGOTIABLE):

- The output face must be a 100% replica of Image 1
- Do NOT alter:
  - Face shape
  - Jawline
  - Nose size or shape
  - Eye size, spacing, or angle
  - Eyebrows
  - Lips
  - Skin tone
  - Facial symmetry
  - Age
  - Gender expression

- Do NOT beautify, stylize, or enhance the face
- Do NOT apply filters, smoothing, or artistic changes
- Do NOT modify hairstyle unless hidden naturally by the clothing
- Do NOT replace or hallucinate facial details

The face is a LOCKED ASSET - treat it as immutable.

CLOTHING APPLICATION RULES:

- Apply ONLY the clothing from Image 2 onto the user in Image 1
- Maintain:
  - Original clothing color
  - Fabric texture
  - Logos, prints, embroidery
  - Wrinkles and folds
  - Fit style (loose, slim, oversized)

- The clothing must follow the user's body posture naturally
- Adjust folds and drape realistically based on the user's pose
- Respect lighting consistency with Image 1

REALISM REQUIREMENTS:

- Photorealistic output
- Natural shadows and lighting
- Correct depth and perspective
- Seamless blending between skin and clothing
- No visible cut lines, artifacts, or warping
- The output should look like a real photo taken by a camera

FAILURE CONDITIONS:

If the clothing from Image 2 cannot be realistically applied due to pose, angle, or occlusion:
- Preserve the user's identity fully
- Apply the clothing as accurately as possible without distortion
- Never compromise facial accuracy to fit the clothing`;

/**
 * Build the try-on prompt based on mode
 */
const buildTryOnPrompt = (gender: Gender, mode: TryOnMode): string => {
  const person = gender === 'female' ? 'woman' : 'man';
  const pronoun = gender === 'female' ? 'her' : 'his';

  const modeInstructions = mode === 'FULL_FIT'
    ? `FULL OUTFIT MODE:
- Use the garment from Image 2 as the main piece
- Create a complete coordinated outfit
- Add matching bottom wear, accessories, footwear
- Full body shot showing the complete look`
    : `SINGLE ITEM MODE:
- Place ONLY the garment from Image 2 on the ${person}
- Keep the rest of ${pronoun} outfit as appropriate
- Focus on how this specific garment fits ${pronoun}`;

  return `TASK: Virtual Try-On

Image 1 is the ${person}'s identity reference - this face must be preserved with 100% accuracy.
Image 2 is the clothing reference - apply this clothing onto the person.

${modeInstructions}

CRITICAL REQUIREMENTS:
- The output face must be IDENTICAL to Image 1 - not similar, IDENTICAL
- Every facial feature must match exactly: eyes, nose, lips, skin tone, face shape
- The person's friends and family must be able to recognize them instantly
- Apply the clothing naturally with realistic draping and shadows
- Professional fashion photography quality
- Photorealistic result

Generate the try-on image now.`;
};

/**
 * Generate virtual try-on image using Gemini 3 Pro Image Preview
 * Maximum quality with strict identity preservation
 */
export async function generateTryOnImage(
  selfieBase64: string,
  productBase64: string,
  mode: TryOnMode = 'PART',
  gender: Gender = 'female',
  _feedbackContext?: string
): Promise<string> {
  try {
    // Clean base64 strings
    const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = buildTryOnPrompt(gender, mode);

    console.log('Generating try-on with Gemini 3 Pro Image Preview (strict identity preservation)...');

    // Generate with Gemini 3 Pro Image Preview
    // Using the correct API format with system instruction
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: '📷 IMAGE 1 - USER IDENTITY REFERENCE (preserve this face exactly):'
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanSelfie,
              },
            },
            {
              text: '👗 IMAGE 2 - CLOTHING REFERENCE (apply this clothing):'
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
          aspectRatio: '3:4', // Portrait orientation for fashion
          imageSize: '2K',    // High quality output
        },
      },
    });

    // Extract image from response
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content?.parts || [];

      for (const part of parts) {
        // Check for inline image data
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const mimeType = part.inlineData.mimeType;
          const data = part.inlineData.data;
          console.log('Try-on image generated successfully with Gemini 3 Pro');
          return `data:${mimeType};base64,${data}`;
        }
      }

      // Log any text response for debugging
      for (const part of parts) {
        if (part.text && !part.thought) {
          console.log('Model text response:', part.text.substring(0, 500));
        }
      }
    }

    throw new Error('No image generated by model');

  } catch (error) {
    console.error('Gemini generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
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

export default {
  generateTryOnImage,
  getStyleRecommendations,
};
