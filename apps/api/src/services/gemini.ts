import { GoogleGenAI } from '@google/genai';
import type { TryOnMode } from '@mrrx/shared';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Gemini client with new SDK
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Model IDs - Using Nano Banana 3 Pro for realistic image generation
const IMAGE_MODEL = 'gemini-3-pro-image-preview'; // Nano Banana 3 Pro
const TEXT_MODEL = 'gemini-2.0-flash';

// Gender type
type Gender = 'male' | 'female';

// Expert prompt builder for photorealistic try-on with EXACT face preservation
const buildTryOnPrompt = (gender: Gender, feedbackContext?: string): string => {
  const genderWord = gender === 'female' ? 'woman' : 'man';
  const pronouns = gender === 'female' ? { subject: 'she', object: 'her', possessive: 'her' } : { subject: 'he', object: 'him', possessive: 'his' };

  let prompt = `TASK: Virtual clothing try-on with EXACT FACE TRANSFER from Image 1 to the output.

You are performing a FACE SWAP + CLOTHING TRANSFER operation:
- Image 1 (FIRST IMAGE): The ${genderWord}'s face photo - THIS IS THE REFERENCE FACE that MUST appear in the output
- Image 2 (SECOND IMAGE): The clothing/outfit to put on ${pronouns.object}

CRITICAL FACE TRANSFER RULES (ABSOLUTE PRIORITY - VIOLATION = FAILURE):
1. COPY the EXACT face from Image 1 pixel-by-pixel - do NOT generate a new face
2. The output face must be IDENTICAL to Image 1 - same person, same identity
3. If someone who knows this ${genderWord} sees the output, they MUST recognize ${pronouns.object} immediately
4. Transfer these EXACTLY from Image 1:
   - EXACT facial structure: jawline, cheekbones, chin shape, forehead
   - EXACT eyes: shape, size, color, distance apart, eyelids, eyelashes
   - EXACT nose: bridge, tip, nostrils, size, angle
   - EXACT mouth: lip shape, lip color, lip size, smile/expression
   - EXACT eyebrows: shape, thickness, arch, color
   - EXACT skin: tone, texture, complexion, any imperfections
   - EXACT hair: color, texture, style, hairline, length
   - ALL unique features: moles, scars, birthmarks, freckles, dimples - in EXACT positions
   - EXACT ear shape if visible
   - EXACT facial hair if any (beard, mustache)

5. DO NOT:
   - Generate a new face that "looks similar"
   - Beautify, smooth, or enhance any facial features
   - Change skin tone or complexion
   - Alter eye color or shape
   - Modify nose or lip shape
   - Remove any moles, scars, or birthmarks
   - Change hair color or style

CLOTHING TRANSFER:
6. Take the clothing from Image 2 and dress the ${genderWord} in it
7. The clothing should fit naturally on ${pronouns.possessive} body
8. Maintain realistic fabric draping and shadows
9. Keep body proportions consistent with Image 1

OUTPUT:
10. Photorealistic fashion photograph quality
11. The ${genderWord} from Image 1 wearing clothes from Image 2
12. Face must pass identity verification - it IS the same person`;

  if (feedbackContext) {
    prompt += `\n\nUSER FEEDBACK FROM PREVIOUS ATTEMPTS (MUST ADDRESS):\n${feedbackContext}`;
  }

  prompt += `\n\nGenerate the try-on image. Remember: The face MUST be the EXACT same face from Image 1 - not similar, but IDENTICAL.`;

  return prompt;
};

const buildFullFitPrompt = (gender: Gender, feedbackContext?: string): string => {
  const genderWord = gender === 'female' ? 'woman' : 'man';
  const pronouns = gender === 'female' ? { subject: 'she', object: 'her', possessive: 'her' } : { subject: 'he', object: 'him', possessive: 'his' };

  let prompt = `TASK: Complete outfit styling with EXACT FACE TRANSFER from Image 1.

You are performing a FACE SWAP + FULL OUTFIT STYLING operation:
- Image 1 (FIRST IMAGE): The ${genderWord}'s face photo - THIS EXACT FACE must appear in output
- Image 2 (SECOND IMAGE): A top/garment to style into a complete outfit

CRITICAL FACE TRANSFER RULES (ABSOLUTE PRIORITY):
1. COPY the EXACT face from Image 1 - do NOT generate a new face
2. The person in output MUST be recognizable as the SAME person from Image 1
3. Anyone who knows this ${genderWord} must immediately recognize ${pronouns.object}
4. Transfer EXACTLY from Image 1:
   - Complete facial bone structure and shape
   - Eye shape, color, size, spacing - EXACTLY as in Image 1
   - Nose shape and size - EXACTLY as in Image 1
   - Lip shape and color - EXACTLY as in Image 1
   - Eyebrow shape - EXACTLY as in Image 1
   - Skin tone and texture - EXACTLY as in Image 1
   - Hair color, style, texture - EXACTLY as in Image 1
   - ALL moles, scars, birthmarks, freckles - in EXACT positions
   - Any facial hair - EXACTLY as shown

5. DO NOT beautify, enhance, or modify ANY facial feature

OUTFIT STYLING:
6. Use the garment from Image 2 as the top/main piece
7. Create a COMPLETE fashionable outfit with complementary:
   - Bottom wear (pants/jeans/skirt matching the top's style)
   - Appropriate footwear
8. The complete look should be cohesive and stylish
9. Maintain the ${genderWord}'s body proportions from Image 1

OUTPUT:
10. Full-body photorealistic fashion image
11. The EXACT person from Image 1 in a complete styled outfit
12. Professional fashion photography quality`;

  if (feedbackContext) {
    prompt += `\n\nUSER FEEDBACK FROM PREVIOUS ATTEMPTS (MUST ADDRESS):\n${feedbackContext}`;
  }

  prompt += `\n\nGenerate the full outfit image. The face MUST be IDENTICAL to Image 1 - the same person, not a look-alike.`;

  return prompt;
};

interface GenerationResult {
  image: string;
  success: boolean;
  error?: string;
}

export async function generateTryOnImage(
  selfieBase64: string,
  productBase64: string,
  mode: TryOnMode = 'PART',
  gender: Gender = 'female',
  feedbackContext?: string
): Promise<string> {
  try {
    // Clean base64 strings (remove data URL prefix if present)
    const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

    const genderWord = gender === 'female' ? 'woman' : 'man';

    const prompt = mode === 'FULL_FIT'
      ? buildFullFitPrompt(gender, feedbackContext)
      : buildTryOnPrompt(gender, feedbackContext);

    // Use Gemini 3 Pro Image Preview for high-fidelity generation
    // Structure: explicit labels for each image to ensure face reference is clear
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `IMAGE 1 - REFERENCE FACE (This ${genderWord}'s face MUST appear EXACTLY in the output):` },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanSelfie,
              },
            },
            { text: `IMAGE 2 - CLOTHING TO WEAR (Put this outfit on the ${genderWord} from Image 1):` },
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
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '3:4', // Portrait orientation for fashion
          imageSize: '2K', // High resolution
        },
      },
    });

    // Extract image from response
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content?.parts || [];

      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const mimeType = part.inlineData.mimeType;
          const data = part.inlineData.data;
          return `data:${mimeType};base64,${data}`;
        }
      }

      // Check if there's text response (might indicate an issue)
      for (const part of parts) {
        if (part.text) {
          console.log('Model returned text:', part.text.substring(0, 200));
        }
      }
    }

    throw new Error('Model did not generate an image');

  } catch (error) {
    console.error('Gemini generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Image generation failed: ${message}`);
  }
}

// Style recommendations and Full Fit suggestions
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

    const prompt = `Analyze this fashion item and provide detailed styling recommendations for Indian consumers.

Return a JSON object with:
- "analysis": Detailed description of the item (type, style, color, material, occasion)
- "stylingTips": Array of 4-5 specific styling tips for this item
- "complementaryItems": Array of 4-5 complementary items to complete the outfit, each with:
  - "type": Category (e.g., "Jeans", "Trousers", "Sneakers", "Watch", "Sunglasses")
  - "description": Specific product recommendation (e.g., "Slim fit dark blue denim jeans")
  - "color": Recommended color
  - "priceRange": Price range in INR (e.g., "₹1,500 - ₹3,000")
  - "searchQuery": Search term for Indian e-commerce sites (e.g., "slim fit blue jeans men")

Focus on:
- Indian fashion trends and sensibilities
- Mix of budget and premium options
- Practical outfit combinations
- Items available on Myntra, Ajio, Amazon India

Return ONLY the JSON object, no other text.`;

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

// Generate complete outfit suggestion for Full Fit mode
export async function generateFullFitSuggestions(
  selfieBase64: string,
  topWearBase64: string,
  gender: Gender = 'female',
  feedbackContext?: string
): Promise<{
  outfitImage: string;
  analysis: string;
  stylingTips: string[];
  complementaryItems: Array<{
    type: string;
    description: string;
    color: string;
    priceRange: string;
    buyLinks: Array<{ store: string; url: string }>;
  }>;
}> {
  try {
    // First generate the complete outfit image
    const outfitImage = await generateTryOnImage(selfieBase64, topWearBase64, 'FULL_FIT', gender, feedbackContext);

    // Then get styling recommendations
    const recommendations = await getStyleRecommendations(topWearBase64);

    // Indian e-commerce stores
    const INDIAN_STORES = [
      { name: 'Myntra', baseUrl: 'https://www.myntra.com/search?q=' },
      { name: 'Ajio', baseUrl: 'https://www.ajio.com/search/?text=' },
      { name: 'Amazon', baseUrl: 'https://www.amazon.in/s?k=' },
      { name: 'Flipkart', baseUrl: 'https://www.flipkart.com/search?q=' },
      { name: 'Meesho', baseUrl: 'https://www.meesho.com/search?q=' },
    ];

    // Add buy links to complementary items
    const itemsWithLinks = recommendations.complementaryItems.map(item => ({
      ...item,
      buyLinks: INDIAN_STORES.map(store => ({
        store: store.name,
        url: `${store.baseUrl}${encodeURIComponent(item.searchQuery || item.description)}`,
      })),
    }));

    return {
      outfitImage,
      analysis: recommendations.analysis,
      stylingTips: recommendations.stylingTips,
      complementaryItems: itemsWithLinks,
    };
  } catch (error) {
    console.error('Full fit suggestions error:', error);
    throw error;
  }
}

export default {
  generateTryOnImage,
  getStyleRecommendations,
  generateFullFitSuggestions,
};
