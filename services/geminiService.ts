import { GoogleGenAI, Type } from "@google/genai";

// Helper to check and prompt for API Key selection
export const checkAndEnsureApiKey = async (): Promise<boolean> => {
  const win = window as any;
  if (win.aistudio && win.aistudio.hasSelectedApiKey) {
    const hasKey = await win.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      if (win.aistudio.openSelectKey) {
        await win.aistudio.openSelectKey();
        return true; // Assume success after modal interaction due to race condition guidance
      }
      return false;
    }
    return true;
  }
  // Fallback for dev environments without the special window object
  return true;
};

export const generateTryOnImage = async (
  faceImageBase64: string,
  clothImageBase64: string
): Promise<string> => {
  await checkAndEnsureApiKey();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const cleanFace = faceImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  const cleanCloth = clothImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  // Use gemini-3-pro-image-preview only for best quality
  const modelName = 'gemini-3-pro-image-preview';

  console.log(`Generating with model: ${modelName}`);

  const promptText = `VIRTUAL TRY-ON:

Generate a photorealistic fashion photo of the person from Image 1 wearing clothing from Image 2.

FULL OUTFIT MODE:
- Image 2's garment is the HERO PIECE
- Add matching complementary pieces (complete outfit)
- Show FULL BODY from head to toe

CRITICAL - SKIN TONE CONSISTENCY:
- Study Image 1's face skin tone CAREFULLY
- The body's skin (neck, arms, hands) MUST be the EXACT SAME skin tone as the face
- Consistent lighting across entire body - no color shifts
- This is crucial for realism

PRESERVE from Image 1:
- Body type and weight (do NOT slim or fatten)

OUTPUT: Professional fashion photo, photorealistic, seamless natural appearance.
Generate now.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: promptText },
          { inlineData: { mimeType: 'image/png', data: cleanFace } },
          { inlineData: { mimeType: 'image/png', data: cleanCloth } }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "2K"
        }
      }
    });

    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error(`Model ${modelName} returned no image data.`);

  } catch (error: any) {
    console.error(`Model ${modelName} failed:`, error.message);

    const win = window as any;
    if (
      (error.message?.includes("Requested entity was not found") ||
        error.status === 403 ||
        error.message?.includes("PERMISSION_DENIED")) &&
      win.aistudio?.openSelectKey
    ) {
      await win.aistudio.openSelectKey();
      throw new Error("Access Denied. Please select a valid API Key.");
    }

    throw new Error(error.message || "Failed to generate realistic image. Please try again.");
  }
};

export const getStyleRecommendations = async (
  faceImageBase64: string,
  clothImageBase64: string
): Promise<any> => {
  await checkAndEnsureApiKey();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const cleanCloth = clothImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            text: `You are a fashion stylist. 
            1. Analyze this fashion item (it could be a shirt, pants, shoes, or accessory).
            2. Based on what it is, suggest ONE specific COMPLEMENTARY item to complete the look (e.g., if it's a shirt, suggest pants; if pants, suggest a shirt).
            3. Provide a search query I can use on Google Shopping to find this complementary item.
            
            Return JSON.`
          },
          { inlineData: { mimeType: 'image/png', data: cleanCloth } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING, description: "Brief analysis of the item" },
            complementaryItem: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Name of the suggested item" },
                searchQuery: { type: Type.STRING, description: "Shopping search query" },
                priceRange: { type: Type.STRING, description: "Estimated price range in INR" }
              }
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  color: { type: Type.STRING },
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Style Recommendation Error:", error);
    return null;
  }
};
