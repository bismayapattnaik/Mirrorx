import { GoogleGenAI } from '@google/genai';
import type { TryOnMode } from '@mirrorx/shared';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Gemini client with new SDK
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Model IDs - Using Nano Banana 3 Pro for realistic image generation
const IMAGE_MODEL = 'gemini-3-pro-image-preview'; // Nano Banana 3 Pro
const TEXT_MODEL = 'gemini-2.0-flash';

// Expert prompt for photorealistic try-on with face preservation
const TRYON_PROMPT = `You are an expert virtual fashion try-on system creating 100% photorealistic images.

CRITICAL REQUIREMENTS:
1. PRESERVE THE EXACT FACE - The person's face must be 100% identical to the input image
2. Keep the same body shape, skin tone, and proportions
3. Only change the clothing to match the product image
4. The clothing should fit naturally on the person's body
5. Maintain realistic lighting, shadows, and fabric draping
6. Output should look like a real photograph, not AI-generated
7. Ensure the clothing integrates seamlessly with the person

Generate a photorealistic image of this person wearing the clothing shown.`;

const FULL_FIT_PROMPT = `You are an expert virtual fashion stylist creating complete outfit looks.

CRITICAL REQUIREMENTS:
1. PRESERVE THE EXACT FACE - The person's face must be 100% identical to the input image
2. The person is wearing a TOP/UPPER garment - create a COMPLETE OUTFIT
3. Based on the top wear provided, generate matching:
   - Bottom wear (pants, jeans, skirt, etc.) that complements the top
   - Footwear that matches the overall style
4. The complete outfit should be fashionable and cohesive
5. Maintain 100% photorealistic quality
6. Proper lighting, shadows, and natural fabric appearance
7. The person should look like they're in a fashion photoshoot

Generate a full-body photorealistic image with the complete styled outfit.`;

interface GenerationResult {
  image: string;
  success: boolean;
  error?: string;
}

export async function generateTryOnImage(
  selfieBase64: string,
  productBase64: string,
  mode: TryOnMode = 'PART'
): Promise<string> {
  try {
    // Clean base64 strings (remove data URL prefix if present)
    const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanProduct = productBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = mode === 'FULL_FIT' ? FULL_FIT_PROMPT : TRYON_PROMPT;

    // Use Gemini 3 Pro Image Preview (Nano Banana 3 Pro) for high-fidelity generation
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
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
  topWearBase64: string
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
    const outfitImage = await generateTryOnImage(selfieBase64, topWearBase64, 'FULL_FIT');

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
