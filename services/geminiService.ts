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
  ACT AS AN EXPERT VFX ARTIST AND HIGH-FASHION PHOTOGRAPHER.

  TASK: Perform a photorealistic VIRTUAL TRY-ON.

  INPUTS:
  - IMAGE A (Face): The user's face and head.
  - IMAGE B (Garment/Item): The fashion item to be worn.

  EXECUTION PIPELINE:
  1. **IDENTITY RECONSTRUCTION (CRITICAL)**:
     - Reconstruct the user's face from IMAGE A with 100% fidelity.
     - PRESERVE: Eye shape, nose, mouth, jawline, skin tone, facial hair, and hair texture.
     - The face MUST look exactly like the person in IMAGE A.

  2. **VIRTUAL TAILORING & PHYSICS**:
     - Fit the Garment from IMAGE B onto a generated body that matches the user's head size and skin tone.
     - **PHYSICS ENGINE**: The cloth must WRAP around the body volumes (chest, shoulders, arms). It cannot look flat.
     - **WEIGHT & DRAPE**: If the cloth is heavy (jacket/coat), show stiffness and volume. If light (t-shirt/silk), show natural draping and gravity.
     - **CONTACT POINTS**: The collar/neckline must touch the skin naturally. No visible gaps or "floating" pixels between cloth and skin.

  3. **OUTFIT COMPLETION (SMART STYLING)**:
     - **Identify the Item Type in IMAGE B**:
       - If TOP (Shirt, Jacket, Hoodie): You MUST generate matching bottoms (e.g., denim jeans, chinos, cargo pants) and shoes to complete the look.
       - If BOTTOM (Pants, Skirt): Generate a matching neutral or stylish top and shoes.
       - If FOOTWEAR: Generate a full outfit that highlights the shoes.
       - If ACCESSORY (Bag, Hat, Jewelry): Generate a full outfit that suits the accessory.
     - **Color Coordination**: Ensure the generated items color-match the input item.

  4. **PHOTOREALISTIC INTEGRATION**:
     - **LIGHTING MATCH**: The lighting on the cloth MUST match the lighting on the face.
     - **AMBIENT OCCLUSION**: Cast realistic shadows from the cloth onto the skin (e.g., collar shadow on neck, sleeve shadow on arm).
     - **TEXTURE**: Keep the high-frequency details of the cloth (fabric weave, stitching, logos).

  OUTPUT: A 4K, RAW-style photograph. No AI gloss. No cartoon effects. The user must look like they are physically standing there wearing the item.
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