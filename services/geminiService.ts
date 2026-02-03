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

  const promptText = `
  VIRTUAL TRY-ON ENGINE - IDENTITY CLONING MODE

  === INPUTS ===
  IMAGE A (Person Reference): The user's EXACT face and body type to preserve
  IMAGE B (Garment Reference): The fashion item to apply

  === MISSION ===
  Clone the EXACT person from IMAGE A and dress them in clothing from IMAGE B.
  The output must show the SAME PERSON - same face, same body type, same weight.

  === FACE PRESERVATION (100% CLONE - CRITICAL) ===
  - Copy the face from IMAGE A with pixel-perfect accuracy
  - Keep ALL: face shape, eye shape/size, nose, lips, jawline width
  - Keep ALL: skin tone, texture, pores, marks, lines, imperfections
  - NO beautification - no smoothing, no slimming, no enhancement
  - Face width and fullness must be EXACTLY as in IMAGE A
  - The person's family must recognize them INSTANTLY

  === BODY PRESERVATION (SAME WEIGHT/BUILD - CRITICAL) ===
  - The body type MUST match IMAGE A
  - DO NOT make the person look THINNER than IMAGE A
  - DO NOT make the person look HEAVIER/FATTER than IMAGE A
  - Shoulder width proportional to face as shown in IMAGE A
  - Generate a body that IS the same person, not an idealized body
  - If face appears fuller, keep the body proportionally similar
  - The clothing fits on THIS person's actual body shape

  === OUTFIT COMPLETION (FULL FIT MODE) ===
  Identify what IMAGE B shows and complete the outfit:
  - If TOP (shirt/jacket/hoodie): Generate matching bottoms (jeans/trousers) + footwear
  - If BOTTOM (pants/skirt): Generate matching top + footwear
  - If FOOTWEAR: Generate complete outfit highlighting the shoes
  - If ACCESSORY: Generate full outfit complementing the accessory
  
  Color coordinate all pieces. Keep style cohesive.

  === CLOTHING APPLICATION ===
  - Natural draping following the person's ACTUAL body shape
  - Realistic shadows and wrinkles based on body contours
  - Preserve all clothing details: fabric texture, patterns, logos, stitching
  - Match lighting between face, body, and clothing

  === OUTPUT ===
  Full body shot (head to toe), professional fashion photography, 
  photorealistic quality, studio lighting, clean background.

  Generate the try-on image now.
  `;

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