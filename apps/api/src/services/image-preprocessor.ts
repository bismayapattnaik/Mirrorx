/**
 * @fileoverview Advanced Image Preprocessor for Virtual Try-On
 *
 * This module extracts detailed face and body features from user images
 * to anchor the AI generation with EXACT identity preservation.
 *
 * Key Features:
 * - Face feature extraction (shape, proportions, skin tone)
 * - Body build analysis (slim/average/athletic/heavy)
 * - Image quality enhancement suggestions
 * - Vectorized face description for AI anchoring
 */

import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Use Gemini Flash for fast analysis
const ANALYSIS_MODEL = 'gemini-2.0-flash';

/**
 * Extracted face features for identity anchoring
 */
export interface FaceFeatures {
  faceShape: 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'diamond';
  faceWidth: 'narrow' | 'average' | 'wide';
  jawline: 'sharp' | 'soft' | 'angular' | 'rounded';
  cheeks: 'hollow' | 'flat' | 'full' | 'prominent';
  skinTone: string; // Detailed description
  skinTexture: string;
  eyeShape: string;
  eyeColor: string;
  eyebrows: string;
  noseShape: string;
  lipShape: string;
  facialHair?: string;
  hairStyle: string;
  hairColor: string;
  distinctiveFeatures: string[];
  age: 'young_adult' | 'adult' | 'middle_aged' | 'senior';
  ethnicity: string;
}

/**
 * Extracted body features for proportion anchoring
 */
export interface BodyFeatures {
  build: 'slim' | 'lean' | 'average' | 'athletic' | 'muscular' | 'stocky' | 'plus_size';
  shoulderWidth: 'narrow' | 'average' | 'broad';
  torsoLength: 'short' | 'average' | 'long';
  waistType: 'narrow' | 'average' | 'wide';
  hipWidth: 'narrow' | 'average' | 'wide';
  armLength: 'short' | 'average' | 'long';
  heightEstimate: 'short' | 'average' | 'tall';
  posture: string;
  bodyProportions: string;
  overallDescription: string;
}

/**
 * Complete user appearance profile
 */
export interface AppearanceProfile {
  face: FaceFeatures;
  body: BodyFeatures;
  overallDescription: string;
  identityAnchors: string[]; // Key features that MUST be preserved
  skinToneHex?: string;
  confidence: number;
}

/**
 * Image quality assessment
 */
export interface ImageQuality {
  isUsable: boolean;
  faceVisible: boolean;
  faceClarity: 'excellent' | 'good' | 'fair' | 'poor';
  lighting: 'excellent' | 'good' | 'fair' | 'poor';
  angle: 'frontal' | 'slight_angle' | 'side' | 'unusual';
  bodyVisible: boolean;
  suggestions: string[];
}

/**
 * Analyze user's face features with extreme detail
 */
export async function analyzeFaceFeatures(imageBase64: string): Promise<FaceFeatures | null> {
  try {
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this person's face with EXTREME PRECISION. I need exact details for identity preservation in AI image generation.

CRITICAL: Be very specific about facial proportions and structure. This data will be used to ensure the face looks EXACTLY the same in generated images.

Analyze and return a JSON object with these EXACT fields:

{
  "faceShape": "oval|round|square|heart|oblong|diamond",
  "faceWidth": "narrow|average|wide",
  "jawline": "sharp|soft|angular|rounded",
  "cheeks": "hollow|flat|full|prominent",
  "skinTone": "detailed description (e.g., 'warm medium brown with golden undertones', 'fair with pink undertones', 'deep brown with neutral undertones')",
  "skinTexture": "description (e.g., 'smooth with minimal texture', 'light freckling', 'some texture/pores visible')",
  "eyeShape": "description (e.g., 'almond-shaped, slightly upturned', 'round with visible crease')",
  "eyeColor": "specific color (e.g., 'dark brown, almost black', 'hazel with green flecks')",
  "eyebrows": "description (e.g., 'thick, natural arch', 'thin, straight')",
  "noseShape": "description (e.g., 'straight bridge, medium width', 'slightly upturned tip')",
  "lipShape": "description (e.g., 'full lips with defined cupid's bow', 'thin, wide lips')",
  "facialHair": "if applicable (e.g., 'clean shaven', 'full beard, trimmed', 'stubble')",
  "hairStyle": "description (e.g., 'short sides, longer on top', 'long wavy hair past shoulders')",
  "hairColor": "specific color (e.g., 'jet black', 'dark brown with lighter highlights')",
  "distinctiveFeatures": ["array of unique features", "like moles, dimples, scars"],
  "age": "young_adult|adult|middle_aged|senior",
  "ethnicity": "observed ethnicity for accurate representation"
}

Be EXTREMELY precise. The goal is that any AI reading this description would generate the EXACT same face.

Return ONLY the JSON object, no other text.`;

    const response = await client.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanImage,
              },
            },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as FaceFeatures;
    }

    return null;
  } catch (error) {
    console.error('[ImagePreprocessor] Face analysis error:', error);
    return null;
  }
}

/**
 * Analyze user's body features and proportions
 */
export async function analyzeBodyFeatures(imageBase64: string): Promise<BodyFeatures | null> {
  try {
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this person's body build and proportions with EXTREME PRECISION. This data will be used to ensure the body looks EXACTLY the same in AI-generated images.

CRITICAL: Accurately assess the body type - do NOT make assumptions. The person should appear the SAME weight/build in generated images.

Analyze and return a JSON object with these EXACT fields:

{
  "build": "slim|lean|average|athletic|muscular|stocky|plus_size",
  "shoulderWidth": "narrow|average|broad",
  "torsoLength": "short|average|long",
  "waistType": "narrow|average|wide",
  "hipWidth": "narrow|average|wide",
  "armLength": "short|average|long",
  "heightEstimate": "short|average|tall",
  "posture": "description (e.g., 'straight, good posture', 'slightly slouched')",
  "bodyProportions": "detailed description of how body parts relate (e.g., 'shoulders slightly wider than hips, balanced torso')",
  "overallDescription": "2-3 sentence description of overall body appearance and build"
}

IMPORTANT:
- "slim" = noticeably thin, slender frame
- "lean" = thin but with some definition
- "average" = typical/medium build
- "athletic" = fit, visible muscle tone
- "muscular" = visibly built, large muscles
- "stocky" = solid, compact build
- "plus_size" = larger body frame

Be ACCURATE. Do not default to "average" - carefully assess the actual build.

Return ONLY the JSON object, no other text.`;

    const response = await client.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanImage,
              },
            },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as BodyFeatures;
    }

    return null;
  } catch (error) {
    console.error('[ImagePreprocessor] Body analysis error:', error);
    return null;
  }
}

/**
 * Assess image quality for virtual try-on
 */
export async function assessImageQuality(imageBase64: string): Promise<ImageQuality> {
  try {
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Assess this image for virtual try-on suitability.

Return a JSON object:
{
  "isUsable": true/false,
  "faceVisible": true/false,
  "faceClarity": "excellent|good|fair|poor",
  "lighting": "excellent|good|fair|poor",
  "angle": "frontal|slight_angle|side|unusual",
  "bodyVisible": true/false,
  "suggestions": ["array of improvement suggestions if any"]
}

Return ONLY the JSON object.`;

    const response = await client.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanImage,
              },
            },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ImageQuality;
    }

    return {
      isUsable: true,
      faceVisible: true,
      faceClarity: 'good',
      lighting: 'good',
      angle: 'frontal',
      bodyVisible: true,
      suggestions: [],
    };
  } catch (error) {
    console.error('[ImagePreprocessor] Quality assessment error:', error);
    return {
      isUsable: true,
      faceVisible: true,
      faceClarity: 'fair',
      lighting: 'fair',
      angle: 'frontal',
      bodyVisible: true,
      suggestions: [],
    };
  }
}

/**
 * Create complete appearance profile for identity anchoring
 */
export async function createAppearanceProfile(imageBase64: string): Promise<AppearanceProfile | null> {
  try {
    console.log('[ImagePreprocessor] Creating appearance profile...');

    // Run face and body analysis in parallel for speed
    const [faceFeatures, bodyFeatures] = await Promise.all([
      analyzeFaceFeatures(imageBase64),
      analyzeBodyFeatures(imageBase64),
    ]);

    if (!faceFeatures) {
      console.error('[ImagePreprocessor] Failed to extract face features');
      return null;
    }

    // Create identity anchors - key features that MUST be preserved
    const identityAnchors: string[] = [];

    // Face anchors
    identityAnchors.push(`Face shape: ${faceFeatures.faceShape}, ${faceFeatures.faceWidth} width`);
    identityAnchors.push(`Jawline: ${faceFeatures.jawline}`);
    identityAnchors.push(`Cheeks: ${faceFeatures.cheeks}`);
    identityAnchors.push(`Skin: ${faceFeatures.skinTone}`);
    identityAnchors.push(`Eyes: ${faceFeatures.eyeShape}, ${faceFeatures.eyeColor}`);
    identityAnchors.push(`Nose: ${faceFeatures.noseShape}`);
    identityAnchors.push(`Lips: ${faceFeatures.lipShape}`);
    identityAnchors.push(`Hair: ${faceFeatures.hairStyle}, ${faceFeatures.hairColor}`);

    if (faceFeatures.facialHair) {
      identityAnchors.push(`Facial hair: ${faceFeatures.facialHair}`);
    }

    if (faceFeatures.distinctiveFeatures?.length > 0) {
      identityAnchors.push(`Distinctive: ${faceFeatures.distinctiveFeatures.join(', ')}`);
    }

    // Body anchors
    if (bodyFeatures) {
      identityAnchors.push(`Body build: ${bodyFeatures.build}`);
      identityAnchors.push(`Shoulders: ${bodyFeatures.shoulderWidth}`);
      identityAnchors.push(`Body proportions: ${bodyFeatures.bodyProportions}`);
    }

    // Create overall description
    const overallDescription = `${faceFeatures.age.replace('_', ' ')} ${faceFeatures.ethnicity} individual with ${faceFeatures.faceShape} face, ${faceFeatures.skinTone} skin, ${faceFeatures.hairStyle} ${faceFeatures.hairColor} hair. ${bodyFeatures?.overallDescription || ''}`;

    console.log('[ImagePreprocessor] Appearance profile created successfully');

    return {
      face: faceFeatures,
      body: bodyFeatures || {
        build: 'average',
        shoulderWidth: 'average',
        torsoLength: 'average',
        waistType: 'average',
        hipWidth: 'average',
        armLength: 'average',
        heightEstimate: 'average',
        posture: 'natural',
        bodyProportions: 'balanced proportions',
        overallDescription: 'Average build with balanced proportions',
      },
      overallDescription,
      identityAnchors,
      confidence: faceFeatures && bodyFeatures ? 0.95 : 0.75,
    };
  } catch (error) {
    console.error('[ImagePreprocessor] Profile creation error:', error);
    return null;
  }
}

/**
 * Generate identity-anchored prompt section
 * This creates the critical prompt text that ensures face/body preservation
 */
export function generateIdentityAnchorPrompt(profile: AppearanceProfile): string {
  const { face, body, identityAnchors } = profile;

  return `
═══════════════════════════════════════════════════════════════════
                    CRITICAL: IDENTITY SPECIFICATION
            (THE GENERATED IMAGE MUST MATCH THESE EXACTLY)
═══════════════════════════════════════════════════════════════════

## FACE IDENTITY (PRESERVE EXACTLY - NO CHANGES)

**Face Structure:**
- Shape: ${face.faceShape} face with ${face.faceWidth} width
- Jawline: ${face.jawline}
- Cheeks: ${face.cheeks}

**Skin:**
- Tone: ${face.skinTone}
- Texture: ${face.skinTexture}
- CRITICAL: Skin tone must be EXACTLY this shade from face to neck to all visible skin

**Facial Features:**
- Eyes: ${face.eyeShape}, ${face.eyeColor}
- Eyebrows: ${face.eyebrows}
- Nose: ${face.noseShape}
- Lips: ${face.lipShape}
${face.facialHair ? `- Facial Hair: ${face.facialHair}` : ''}

**Hair:**
- Style: ${face.hairStyle}
- Color: ${face.hairColor}

${face.distinctiveFeatures?.length > 0 ? `**Distinctive Features (MUST INCLUDE):**
${face.distinctiveFeatures.map(f => `- ${f}`).join('\n')}` : ''}

## BODY IDENTITY (PRESERVE EXACTLY - NO CHANGES)

**Build:** ${body.build.toUpperCase()}
- Shoulders: ${body.shoulderWidth}
- Torso: ${body.torsoLength} length
- Waist: ${body.waistType}
- Hips: ${body.hipWidth}
- Height Appearance: ${body.heightEstimate}

**Body Proportions:** ${body.bodyProportions}

**CRITICAL:** The person's body should have the EXACT same build as described.
- If "${body.build}" - the body MUST appear ${body.build}
- Do NOT make the person appear thinner or heavier than "${body.build}"

## IDENTITY ANCHORS (NON-NEGOTIABLE)
${identityAnchors.map((anchor, i) => `${i + 1}. ${anchor}`).join('\n')}

═══════════════════════════════════════════════════════════════════
`;
}

/**
 * Generate body-sync prompt to ensure face and body match
 */
export function generateBodySyncPrompt(profile: AppearanceProfile): string {
  const { face, body } = profile;

  return `
═══════════════════════════════════════════════════════════════════
                    FACE-BODY SYNCHRONIZATION
═══════════════════════════════════════════════════════════════════

The face and body MUST be synchronized and consistent:

1. **Face Fullness ↔ Body Build Correlation:**
   - Face: ${face.cheeks} cheeks, ${face.faceWidth} face width
   - Body: ${body.build} build
   - These MUST match - a ${face.faceWidth} face goes with a ${body.build} body

2. **Skin Tone Consistency:**
   - Face skin: ${face.skinTone}
   - ALL visible skin (neck, arms, hands) must be EXACTLY this same tone
   - No color variation between face and body

3. **Proportional Harmony:**
   - The face-to-body ratio should look natural and consistent
   - Head size should be proportional to ${body.shoulderWidth} shoulders
   - Neck width should match ${face.faceWidth} face

4. **Lighting Consistency:**
   - Shadows on face and body must come from the same direction
   - Skin highlights should be consistent across all visible skin

═══════════════════════════════════════════════════════════════════
`;
}

export default {
  analyzeFaceFeatures,
  analyzeBodyFeatures,
  assessImageQuality,
  createAppearanceProfile,
  generateIdentityAnchorPrompt,
  generateBodySyncPrompt,
};
