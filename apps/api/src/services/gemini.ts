import { GoogleGenAI } from '@google/genai';
import type { TryOnMode } from '@mirrorx/shared';

// Initialize Gemini client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Model IDs (configurable via environment)
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3-pro-preview';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image';

// Expert prompt for photorealistic try-on
const TRYON_PROMPT = `You are an expert virtual fashion try-on system specializing in photorealistic garment visualization for Indian fashion e-commerce.

TASK: Generate a highly realistic image of the person wearing the provided garment.

CRITICAL REQUIREMENTS:
1. IDENTITY PRESERVATION (HIGHEST PRIORITY):
   - Maintain exact facial features: face shape, eyes, nose, lips, skin tone
   - Preserve any unique characteristics: birthmarks, facial hair, expressions
   - The result must be unmistakably the same person

2. GARMENT FITTING:
   - Realistically drape the garment on the person's body
   - Apply physics-based cloth simulation for natural fabric behavior
   - Respect the garment's original style, color, pattern, and texture

3. OUTFIT COMPLETION (for FULL_FIT mode):
   - If only upper garment provided, intelligently suggest matching bottoms
   - If only lower garment provided, suggest appropriate upper wear
   - Add complementary footwear when applicable
   - Ensure the complete outfit is cohesive and fashion-forward

4. LIGHTING & ENVIRONMENT:
   - Match lighting direction, intensity, and color temperature from source image
   - Create consistent shadows and highlights on the garment
   - Maintain the original background or create a neutral studio environment

5. QUALITY STANDARDS:
   - Ultra-high resolution output (minimum 1024x1024)
   - No visible artifacts, seams, or AI-generated distortions
   - Professional fashion photography aesthetic

MODE: {mode}
- PART: Focus on the specific garment, minimal changes to other clothing
- FULL_FIT: Create a complete, styled outfit look`;

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
  const prompt = TRYON_PROMPT.replace('{mode}', mode);

  // Prepare image parts
  const parts: any[] = [
    { text: prompt },
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: selfieBase64.replace(/^data:image\/\w+;base64,/, ''),
      },
    },
  ];

  if (productBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: productBase64.replace(/^data:image\/\w+;base64,/, ''),
      },
    });
  }

  // Try primary model first
  let result = await attemptGeneration(IMAGE_MODEL, parts);

  // Fallback to secondary model if primary fails
  if (!result.success) {
    console.warn(`Primary model failed, trying fallback: ${result.error}`);
    result = await attemptGeneration(FALLBACK_IMAGE_MODEL, parts);
  }

  if (!result.success) {
    throw new Error(result.error || 'Image generation failed');
  }

  return result.image;
}

async function attemptGeneration(modelId: string, parts: any[]): Promise<GenerationResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const response = await model.generateContent(parts);
    const candidate = response.response.candidates?.[0];

    if (!candidate?.content?.parts) {
      return {
        success: false,
        image: '',
        error: 'No content generated',
      };
    }

    // Find image in response parts
    for (const part of candidate.content.parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        return {
          success: true,
          image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        };
      }
    }

    return {
      success: false,
      image: '',
      error: 'No image in response',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      image: '',
      error: message,
    };
  }
}

// Style recommendations
export async function getStyleRecommendations(productBase64: string): Promise<{
  analysis: string;
  suggestions: string[];
  complementaryItems: Array<{ type: string; description: string; priceRange: string }>;
}> {
  const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

  const prompt = `Analyze this fashion item and provide styling recommendations for Indian consumers.

Return a JSON object with:
- "analysis": Brief description of the item (type, style, color, material)
- "suggestions": Array of 3-5 styling tips
- "complementaryItems": Array of 3-4 complementary items, each with:
  - "type": Category (e.g., "Footwear", "Accessories", "Bottom wear")
  - "description": Specific recommendation
  - "priceRange": Estimated price in INR (e.g., "₹1,500 - ₹3,000")

Focus on Indian fashion sensibilities and practical styling advice.`;

  try {
    const response = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: productBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      },
    ]);

    const text = response.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      analysis: 'Unable to analyze the item',
      suggestions: [],
      complementaryItems: [],
    };
  } catch (error) {
    console.error('Style recommendations error:', error);
    return {
      analysis: 'Unable to analyze the item',
      suggestions: [],
      complementaryItems: [],
    };
  }
}

export default {
  generateTryOnImage,
  getStyleRecommendations,
};
