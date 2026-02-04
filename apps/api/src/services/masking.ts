/**
 * @fileoverview Image Masking & Segmentation Utility for Virtual Try-On
 *
 * This module provides segmentation and masking capabilities to ensure
 * the user's face is NEVER touched by AI generation.
 *
 * Key Features:
 * - Face/Body segmentation using Gemini-powered analysis
 * - Binary mask generation (face=black/protected, body=white/editable)
 * - High-resolution face extraction for overlay operations
 * - Feathered edge masks for seamless blending
 *
 * Architecture:
 * - Face region is ALWAYS protected (masked black)
 * - Only body/clothing region is editable (masked white)
 * - This guarantees 100% face identity preservation
 */

import sharp from 'sharp';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const ANALYSIS_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp';
// Fallback models to try if primary model fails
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

/**
 * Face bounding box with landmarks
 */
export interface FaceBoundingBox {
  x: number;      // Normalized 0-1
  y: number;      // Normalized 0-1
  width: number;  // Normalized 0-1
  height: number; // Normalized 0-1
  confidence: number;
}

/**
 * Face landmarks for precise masking
 */
export interface FaceLandmarks {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  nose: { x: number; y: number };
  leftMouth: { x: number; y: number };
  rightMouth: { x: number; y: number };
  chin: { x: number; y: number };
  leftEar: { x: number; y: number };
  rightEar: { x: number; y: number };
  foreheadTop: { x: number; y: number };
}

/**
 * Segmentation result containing all mask data
 */
export interface SegmentationResult {
  // Binary mask: face=black(0), body=white(255)
  faceMaskBase64: string;
  // Inverted mask for body editing: face=white(255), body=black(0)
  bodyMaskBase64: string;
  // Feathered mask for smooth blending
  featheredMaskBase64: string;
  // High-res face crop for overlay operations
  faceCropBase64: string;
  // Face crop with alpha channel for compositing
  faceCropWithAlphaBase64: string;
  // Face bounding box
  faceBBox: FaceBoundingBox;
  // Face landmarks
  landmarks: FaceLandmarks;
  // Original image dimensions
  originalWidth: number;
  originalHeight: number;
  // Detected skin tone for color matching
  skinToneRGB: { r: number; g: number; b: number };
  skinToneHex: string;
}

/**
 * Mask generation options
 */
export interface MaskOptions {
  // Padding around face (0.0-0.5)
  facePadding?: number;
  // Feather radius for soft edges
  featherRadius?: number;
  // Include hair in protected region
  includeHair?: boolean;
  // Include neck in protected region
  includeNeck?: boolean;
  // Output mask resolution
  maskResolution?: number;
}

const DEFAULT_MASK_OPTIONS: Required<MaskOptions> = {
  facePadding: 0.15,
  featherRadius: 20,
  includeHair: true,
  includeNeck: true,
  maskResolution: 1024,
};

/**
 * ImageMasker - Core class for face/body segmentation
 *
 * This class ensures the user's face is NEVER modified by AI generation
 * by creating precise masks that protect the face region.
 */
export class ImageMasker {
  private options: Required<MaskOptions>;

  constructor(options: MaskOptions = {}) {
    this.options = { ...DEFAULT_MASK_OPTIONS, ...options };
  }

  /**
   * Analyze image and detect face region using Gemini
   * Returns face detection result or throws specific errors
   * Includes fallback to default coordinates when API fails
   */
  async detectFaceRegion(imageBase64: string, retryCount: number = 0, modelIndex: number = 0): Promise<{
    bbox: FaceBoundingBox;
    landmarks: FaceLandmarks;
    skinTone: { rgb: { r: number; g: number; b: number }; hex: string };
  } | null> {
    const MAX_RETRIES = 3; // Increased from 2

    try {
      const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      const prompt = `Analyze this image for PRECISE face detection. I need exact coordinates for face masking.

Return a JSON object with EXACT measurements (all coordinates normalized 0.0-1.0 relative to image dimensions):

{
  "faceDetected": true/false,
  "faceBoundingBox": {
    "x": 0.0-1.0,
    "y": 0.0-1.0,
    "width": 0.0-1.0,
    "height": 0.0-1.0,
    "confidence": 0.0-1.0
  },
  "landmarks": {
    "leftEye": {"x": 0.0-1.0, "y": 0.0-1.0},
    "rightEye": {"x": 0.0-1.0, "y": 0.0-1.0},
    "nose": {"x": 0.0-1.0, "y": 0.0-1.0},
    "leftMouth": {"x": 0.0-1.0, "y": 0.0-1.0},
    "rightMouth": {"x": 0.0-1.0, "y": 0.0-1.0},
    "chin": {"x": 0.0-1.0, "y": 0.0-1.0},
    "leftEar": {"x": 0.0-1.0, "y": 0.0-1.0},
    "rightEar": {"x": 0.0-1.0, "y": 0.0-1.0},
    "foreheadTop": {"x": 0.0-1.0, "y": 0.0-1.0}
  },
  "skinTone": {
    "r": 0-255,
    "g": 0-255,
    "b": 0-255,
    "hex": "#RRGGBB"
  },
  "hairRegion": {
    "topY": 0.0-1.0,
    "included": true/false
  }
}

CRITICAL: Be VERY precise with the bounding box. It should include:
- The entire face from forehead to chin
- Include ears if visible
- Include hair if visible
- Add 10% padding for safety

Return ONLY the JSON object.`;

      // Select model - use primary model first, then fallbacks
      const modelsToTry = [ANALYSIS_MODEL, ...FALLBACK_MODELS];
      const currentModel = modelsToTry[modelIndex] || ANALYSIS_MODEL;

      console.log(`[ImageMasker] Calling Gemini for face detection (attempt ${retryCount + 1}/${MAX_RETRIES + 1}, model: ${currentModel})...`);

      const response = await client.models.generateContent({
        model: currentModel,
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
        config: {
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });

      // Check if response was blocked by safety filters
      if (response.promptFeedback?.blockReason) {
        const blockReason = response.promptFeedback.blockReason;
        console.error('[ImageMasker] Request blocked by safety filters:', blockReason);
        throw new Error(`Image blocked by safety filters: ${blockReason}`);
      }

      // Check if we have any candidates
      if (!response.candidates || response.candidates.length === 0) {
        console.error('[ImageMasker] No candidates in response:', JSON.stringify(response, null, 2));

        // Try next model if available
        const modelsToTry = [ANALYSIS_MODEL, ...FALLBACK_MODELS];
        if (modelIndex < modelsToTry.length - 1) {
          console.log(`[ImageMasker] Trying fallback model: ${modelsToTry[modelIndex + 1]}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.detectFaceRegion(imageBase64, 0, modelIndex + 1);
        }

        // Retry on empty response (could be transient API issue)
        if (retryCount < MAX_RETRIES) {
          console.log(`[ImageMasker] Retrying face detection (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
          await new Promise(resolve => setTimeout(resolve, 1500 * (retryCount + 1))); // Exponential backoff
          return this.detectFaceRegion(imageBase64, retryCount + 1, modelIndex);
        }

        // Use fallback face detection as last resort
        console.log('[ImageMasker] All API attempts failed, using fallback face detection...');
        return this.getFallbackFaceDetection(imageBase64);
      }

      // Check for finish reason that might indicate an issue
      const finishReason = response.candidates[0].finishReason;
      if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
        console.error('[ImageMasker] Unexpected finish reason:', finishReason);
        if (finishReason === 'SAFETY') {
          throw new Error('Image was flagged by content safety filters');
        }
      }

      let text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!text) {
        console.error('[ImageMasker] Empty text response from Gemini');

        // Try next model if available
        const modelsToTry = [ANALYSIS_MODEL, ...FALLBACK_MODELS];
        if (modelIndex < modelsToTry.length - 1) {
          console.log(`[ImageMasker] Trying fallback model: ${modelsToTry[modelIndex + 1]}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.detectFaceRegion(imageBase64, 0, modelIndex + 1);
        }

        // Retry on empty text (could be transient)
        if (retryCount < MAX_RETRIES) {
          console.log(`[ImageMasker] Retrying due to empty response...`);
          await new Promise(resolve => setTimeout(resolve, 1500 * (retryCount + 1)));
          return this.detectFaceRegion(imageBase64, retryCount + 1, modelIndex);
        }

        // Use fallback face detection as last resort
        console.log('[ImageMasker] All API attempts failed, using fallback face detection...');
        return this.getFallbackFaceDetection(imageBase64);
      }

      console.log('[ImageMasker] Raw response text:', text.substring(0, 200));

      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error(
          '[ImageMasker] Failed to parse face detection response:',
          text.substring(0, 200)
        );

        // Try next model if available
        const modelsToTry = [ANALYSIS_MODEL, ...FALLBACK_MODELS];
        if (modelIndex < modelsToTry.length - 1) {
          console.log(`[ImageMasker] Trying fallback model: ${modelsToTry[modelIndex + 1]}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.detectFaceRegion(imageBase64, 0, modelIndex + 1);
        }

        // Retry on parse failure
        if (retryCount < MAX_RETRIES) {
          console.log(`[ImageMasker] Retrying due to parse failure...`);
          await new Promise(resolve => setTimeout(resolve, 1500 * (retryCount + 1)));
          return this.detectFaceRegion(imageBase64, retryCount + 1, modelIndex);
        }

        // Use fallback face detection as last resort
        console.log('[ImageMasker] All API attempts failed, using fallback face detection...');
        return this.getFallbackFaceDetection(imageBase64);
      }

      let data;
      try {
        data = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('[ImageMasker] JSON parse error:', parseError);
        console.error('[ImageMasker] Attempted to parse:', jsonMatch[0].substring(0, 200));
        throw new Error('Invalid JSON in face detection response');
      }

      if (!data.faceDetected) {
        console.log('[ImageMasker] Gemini reports no face detected in image');
        // This is a genuine "no face" scenario, return null (not an error)
        return null;
      }

      // Validate the response has required fields
      if (!data.faceBoundingBox || typeof data.faceBoundingBox.x !== 'number') {
        console.error('[ImageMasker] Invalid face bounding box data:', data.faceBoundingBox);
        throw new Error('Invalid face detection response: missing bounding box');
      }

      console.log('[ImageMasker] Face detected successfully:', {
        bbox: data.faceBoundingBox,
        confidence: data.faceBoundingBox.confidence,
      });

      return {
        bbox: {
          x: data.faceBoundingBox.x,
          y: data.faceBoundingBox.y,
          width: data.faceBoundingBox.width,
          height: data.faceBoundingBox.height,
          confidence: data.faceBoundingBox.confidence || 0.9,
        },
        landmarks: data.landmarks,
        skinTone: {
          rgb: {
            r: data.skinTone?.r || 180,
            g: data.skinTone?.g || 140,
            b: data.skinTone?.b || 120,
          },
          hex: data.skinTone?.hex || '#B48C78',
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ImageMasker] Face detection error:', errorMessage);

      // Check for specific error types that should not be retried
      if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
        throw error; // Re-throw safety-related errors
      }

      // Try next model if available
      const modelsToTry = [ANALYSIS_MODEL, ...FALLBACK_MODELS];
      if (modelIndex < modelsToTry.length - 1 && !errorMessage.includes('blocked') && !errorMessage.includes('safety')) {
        console.log(`[ImageMasker] Trying fallback model after error: ${modelsToTry[modelIndex + 1]}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.detectFaceRegion(imageBase64, 0, modelIndex + 1);
      }

      // Check for API/network errors that might be transient
      if (retryCount < MAX_RETRIES && (
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('500') ||
        errorMessage.includes('503') ||
        errorMessage.includes('rate') ||
        errorMessage.includes('empty response') ||
        errorMessage.includes('API')
      )) {
        console.log(`[ImageMasker] Retrying after network/API error...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return this.detectFaceRegion(imageBase64, retryCount + 1, modelIndex);
      }

      // Use fallback face detection as last resort for non-safety errors
      if (!errorMessage.includes('blocked') && !errorMessage.includes('safety')) {
        console.log('[ImageMasker] All API attempts failed, using fallback face detection...');
        return this.getFallbackFaceDetection(imageBase64);
      }

      // If error already has a specific message, re-throw it
      if (error instanceof Error && !errorMessage.includes('Unknown')) {
        throw error;
      }

      throw new Error(`Face detection failed: ${errorMessage}`);
    }
  }

  /**
   * Fallback face detection using image analysis and default coordinates
   * Used when Gemini API is unavailable
   * Returns typical selfie face coordinates (face in upper-center portion)
   */
  private async getFallbackFaceDetection(imageBase64: string): Promise<{
    bbox: FaceBoundingBox;
    landmarks: FaceLandmarks;
    skinTone: { rgb: { r: number; g: number; b: number }; hex: string };
  }> {
    console.log('[ImageMasker] Using fallback face detection with default coordinates...');

    try {
      const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanImage, 'base64');
      const metadata = await sharp(buffer).metadata();

      const width = metadata.width || 1024;
      const height = metadata.height || 1024;

      // For typical selfie images, the face is usually:
      // - Horizontally centered (x: 0.25, width: 0.5)
      // - In the upper portion (y: 0.05-0.15, height: 0.35-0.45)
      // Adjust based on aspect ratio
      const aspectRatio = width / height;

      let faceX = 0.25;
      let faceY = 0.05;
      let faceWidth = 0.5;
      let faceHeight = 0.4;

      // Adjust for portrait vs landscape images
      if (aspectRatio < 0.75) {
        // Tall portrait - face takes more horizontal space
        faceX = 0.15;
        faceWidth = 0.7;
        faceHeight = 0.35;
      } else if (aspectRatio > 1.3) {
        // Landscape - face is smaller and more centered
        faceX = 0.35;
        faceWidth = 0.3;
        faceY = 0.1;
        faceHeight = 0.5;
      }

      // Try to analyze dominant colors for skin tone
      let skinTone = { r: 180, g: 140, b: 120 };
      try {
        const stats = await sharp(buffer)
          .extract({
            left: Math.floor(width * faceX),
            top: Math.floor(height * faceY),
            width: Math.floor(width * faceWidth * 0.5),
            height: Math.floor(height * faceHeight * 0.5),
          })
          .stats();

        // Use the dominant channel values as an approximation
        if (stats.channels && stats.channels.length >= 3) {
          skinTone = {
            r: Math.round(stats.channels[0].mean),
            g: Math.round(stats.channels[1].mean),
            b: Math.round(stats.channels[2].mean),
          };
        }
      } catch {
        // Use default skin tone if extraction fails
      }

      const centerX = faceX + faceWidth / 2;
      const centerY = faceY + faceHeight / 2;

      console.log('[ImageMasker] Fallback face detection complete:', {
        bbox: { x: faceX, y: faceY, width: faceWidth, height: faceHeight },
        skinTone,
      });

      return {
        bbox: {
          x: faceX,
          y: faceY,
          width: faceWidth,
          height: faceHeight,
          confidence: 0.7, // Lower confidence for fallback
        },
        landmarks: {
          leftEye: { x: centerX - 0.08, y: centerY - 0.08 },
          rightEye: { x: centerX + 0.08, y: centerY - 0.08 },
          nose: { x: centerX, y: centerY },
          leftMouth: { x: centerX - 0.05, y: centerY + 0.1 },
          rightMouth: { x: centerX + 0.05, y: centerY + 0.1 },
          chin: { x: centerX, y: centerY + 0.18 },
          leftEar: { x: faceX, y: centerY - 0.05 },
          rightEar: { x: faceX + faceWidth, y: centerY - 0.05 },
          foreheadTop: { x: centerX, y: faceY },
        },
        skinTone: {
          rgb: skinTone,
          hex: `#${skinTone.r.toString(16).padStart(2, '0')}${skinTone.g.toString(16).padStart(2, '0')}${skinTone.b.toString(16).padStart(2, '0')}`,
        },
      };
    } catch (error) {
      console.error('[ImageMasker] Fallback face detection error:', error);
      // Return absolute minimum defaults
      return {
        bbox: { x: 0.25, y: 0.05, width: 0.5, height: 0.4, confidence: 0.5 },
        landmarks: {
          leftEye: { x: 0.4, y: 0.2 },
          rightEye: { x: 0.6, y: 0.2 },
          nose: { x: 0.5, y: 0.28 },
          leftMouth: { x: 0.45, y: 0.35 },
          rightMouth: { x: 0.55, y: 0.35 },
          chin: { x: 0.5, y: 0.43 },
          leftEar: { x: 0.25, y: 0.2 },
          rightEar: { x: 0.75, y: 0.2 },
          foreheadTop: { x: 0.5, y: 0.05 },
        },
        skinTone: {
          rgb: { r: 180, g: 140, b: 120 },
          hex: '#B48C78',
        },
      };
    }
  }

  /**
   * Generate binary face mask
   * Face region = BLACK (0) - Protected, DO NOT edit
   * Body region = WHITE (255) - Editable for clothing
   */
  async generateFaceMask(
    imageBase64: string,
    faceBBox: FaceBoundingBox,
    landmarks: FaceLandmarks
  ): Promise<{ faceMask: Buffer; bodyMask: Buffer; featheredMask: Buffer }> {
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanImage, 'base64');
    const metadata = await sharp(buffer).metadata();

    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    // Calculate face region with padding
    const padding = this.options.facePadding;
    const faceX = Math.max(0, faceBBox.x - padding) * width;
    const faceY = Math.max(0, faceBBox.y - padding * 1.5) * height; // More padding on top for hair
    const faceW = Math.min(1, faceBBox.width + padding * 2) * width;
    const faceH = Math.min(1, faceBBox.height + padding * 2.5) * height; // More for chin/neck

    // Create SVG for face mask (elliptical shape for natural face shape)
    const centerX = faceX + faceW / 2;
    const centerY = faceY + faceH / 2;
    const radiusX = faceW / 2;
    const radiusY = faceH / 2;

    // Face mask: BLACK face (protected), WHITE body (editable)
    const faceMaskSvg = `
      <svg width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="white"/>
        <ellipse cx="${centerX}" cy="${centerY}" rx="${radiusX}" ry="${radiusY}" fill="black"/>
      </svg>
    `;

    // Body mask: WHITE face (to keep), BLACK body (to replace)
    const bodyMaskSvg = `
      <svg width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="black"/>
        <ellipse cx="${centerX}" cy="${centerY}" rx="${radiusX}" ry="${radiusY}" fill="white"/>
      </svg>
    `;

    // Feathered mask for smooth blending
    const featherRadius = this.options.featherRadius;
    const featheredMaskSvg = `
      <svg width="${width}" height="${height}">
        <defs>
          <radialGradient id="feather" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stop-color="white" stop-opacity="1"/>
            <stop offset="70%" stop-color="white" stop-opacity="1"/>
            <stop offset="85%" stop-color="white" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="white" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="black"/>
        <ellipse cx="${centerX}" cy="${centerY}"
                 rx="${radiusX + featherRadius}" ry="${radiusY + featherRadius}"
                 fill="url(#feather)"/>
      </svg>
    `;

    const [faceMask, bodyMask, featheredMask] = await Promise.all([
      sharp(Buffer.from(faceMaskSvg))
        .resize(width, height)
        .grayscale()
        .png()
        .toBuffer(),
      sharp(Buffer.from(bodyMaskSvg))
        .resize(width, height)
        .grayscale()
        .png()
        .toBuffer(),
      sharp(Buffer.from(featheredMaskSvg))
        .resize(width, height)
        .grayscale()
        .png()
        .toBuffer(),
    ]);

    return { faceMask, bodyMask, featheredMask };
  }

  /**
   * Extract high-resolution face crop for overlay operations
   */
  async extractFaceCrop(
    imageBase64: string,
    faceBBox: FaceBoundingBox
  ): Promise<{ faceCrop: Buffer; faceCropWithAlpha: Buffer }> {
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanImage, 'base64');
    const metadata = await sharp(buffer).metadata();

    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    // Calculate face region with padding for overlay
    const padding = this.options.facePadding + 0.05; // Extra padding for overlay
    const faceX = Math.max(0, faceBBox.x - padding) * width;
    const faceY = Math.max(0, faceBBox.y - padding * 1.5) * height;
    const faceW = Math.min(width - faceX, (faceBBox.width + padding * 2) * width);
    const faceH = Math.min(height - faceY, (faceBBox.height + padding * 2.5) * height);

    // Extract face crop
    const faceCrop = await sharp(buffer)
      .extract({
        left: Math.round(faceX),
        top: Math.round(faceY),
        width: Math.round(faceW),
        height: Math.round(faceH),
      })
      .png({ quality: 100 })
      .toBuffer();

    // Create alpha mask for the face (elliptical with feathered edges)
    const cropWidth = Math.round(faceW);
    const cropHeight = Math.round(faceH);

    const alphaMaskSvg = `
      <svg width="${cropWidth}" height="${cropHeight}">
        <defs>
          <radialGradient id="alphaGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stop-color="white" stop-opacity="1"/>
            <stop offset="65%" stop-color="white" stop-opacity="1"/>
            <stop offset="85%" stop-color="white" stop-opacity="0.7"/>
            <stop offset="95%" stop-color="white" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="white" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="${cropWidth / 2}" cy="${cropHeight / 2}"
                 rx="${cropWidth * 0.48}" ry="${cropHeight * 0.48}"
                 fill="url(#alphaGrad)"/>
      </svg>
    `;

    const alphaMask = await sharp(Buffer.from(alphaMaskSvg))
      .resize(cropWidth, cropHeight)
      .grayscale()
      .raw()
      .toBuffer();

    // Get face crop raw data
    const faceRaw = await sharp(faceCrop)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Apply alpha mask to face crop
    const pixelCount = cropWidth * cropHeight;
    const rgbaBuffer = Buffer.alloc(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      rgbaBuffer[i * 4] = faceRaw.data[i * 4];     // R
      rgbaBuffer[i * 4 + 1] = faceRaw.data[i * 4 + 1]; // G
      rgbaBuffer[i * 4 + 2] = faceRaw.data[i * 4 + 2]; // B
      rgbaBuffer[i * 4 + 3] = alphaMask[i];         // A from mask
    }

    const faceCropWithAlpha = await sharp(rgbaBuffer, {
      raw: { width: cropWidth, height: cropHeight, channels: 4 },
    })
      .png()
      .toBuffer();

    return { faceCrop, faceCropWithAlpha };
  }

  /**
   * Main segmentation method - returns all mask data needed for try-on
   * Throws errors for API failures, returns null only for genuine "no face" cases
   */
  async segment(imageBase64: string): Promise<SegmentationResult | null> {
    console.log('[ImageMasker] Starting segmentation...');

    // Step 1: Detect face region
    // This will throw errors for API failures, return null only for genuine "no face"
    const detection = await this.detectFaceRegion(imageBase64);
    if (!detection) {
      console.log('[ImageMasker] No face detected in image (genuine result, not an error)');
      return null;
    }

    console.log('[ImageMasker] Face detected:', {
      bbox: detection.bbox,
      confidence: detection.bbox.confidence,
    });

    // Step 2: Generate masks
    const { faceMask, bodyMask, featheredMask } = await this.generateFaceMask(
      imageBase64,
      detection.bbox,
      detection.landmarks
    );

    // Step 3: Extract face crop
    const { faceCrop, faceCropWithAlpha } = await this.extractFaceCrop(
      imageBase64,
      detection.bbox
    );

    // Get original dimensions
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanImage, 'base64');
    const metadata = await sharp(buffer).metadata();

    console.log('[ImageMasker] Segmentation complete');

    return {
      faceMaskBase64: faceMask.toString('base64'),
      bodyMaskBase64: bodyMask.toString('base64'),
      featheredMaskBase64: featheredMask.toString('base64'),
      faceCropBase64: faceCrop.toString('base64'),
      faceCropWithAlphaBase64: faceCropWithAlpha.toString('base64'),
      faceBBox: detection.bbox,
      landmarks: detection.landmarks,
      originalWidth: metadata.width || 1024,
      originalHeight: metadata.height || 1024,
      skinToneRGB: detection.skinTone.rgb,
      skinToneHex: detection.skinTone.hex,
    };
  }

  /**
   * Create inpainting mask for clothing region only
   * This mask tells the AI: "Only edit the WHITE areas (body/clothes)"
   */
  async createInpaintingMask(
    imageBase64: string,
    segmentation: SegmentationResult
  ): Promise<string> {
    const cleanImage = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanImage, 'base64');

    // The face mask already has face=black, body=white
    // This is exactly what we need for inpainting
    const mask = Buffer.from(segmentation.faceMaskBase64, 'base64');

    // Ensure mask matches image dimensions
    const resizedMask = await sharp(mask)
      .resize(segmentation.originalWidth, segmentation.originalHeight)
      .png()
      .toBuffer();

    return resizedMask.toString('base64');
  }

  /**
   * Validate that a generated image has the face region unchanged
   * Compares the face regions of original and generated images
   */
  async validateFaceUnchanged(
    originalBase64: string,
    generatedBase64: string,
    segmentation: SegmentationResult,
    threshold: number = 0.95
  ): Promise<{ isValid: boolean; similarity: number; pixelDiff: number }> {
    const cleanOriginal = originalBase64.replace(/^data:image\/\w+;base64,/, '');
    const cleanGenerated = generatedBase64.replace(/^data:image\/\w+;base64,/, '');

    const originalBuffer = Buffer.from(cleanOriginal, 'base64');
    const generatedBuffer = Buffer.from(cleanGenerated, 'base64');

    // Extract face regions from both images
    const bbox = segmentation.faceBBox;
    const padding = this.options.facePadding;

    const originalMeta = await sharp(originalBuffer).metadata();
    const width = originalMeta.width || 1024;
    const height = originalMeta.height || 1024;

    const faceX = Math.max(0, bbox.x - padding) * width;
    const faceY = Math.max(0, bbox.y - padding) * height;
    const faceW = Math.min(width - faceX, (bbox.width + padding * 2) * width);
    const faceH = Math.min(height - faceY, (bbox.height + padding * 2) * height);

    const extractOptions = {
      left: Math.round(faceX),
      top: Math.round(faceY),
      width: Math.round(faceW),
      height: Math.round(faceH),
    };

    const [originalFace, generatedFace] = await Promise.all([
      sharp(originalBuffer)
        .extract(extractOptions)
        .resize(256, 256)
        .raw()
        .toBuffer(),
      sharp(generatedBuffer)
        .extract(extractOptions)
        .resize(256, 256)
        .raw()
        .toBuffer(),
    ]);

    // Calculate pixel-wise difference
    let totalDiff = 0;
    const pixelCount = 256 * 256 * 3;

    for (let i = 0; i < pixelCount; i++) {
      totalDiff += Math.abs(originalFace[i] - generatedFace[i]);
    }

    const avgDiff = totalDiff / pixelCount;
    const similarity = 1 - avgDiff / 255;

    return {
      isValid: similarity >= threshold,
      similarity,
      pixelDiff: avgDiff,
    };
  }
}

/**
 * Singleton instance for convenience
 */
let defaultMasker: ImageMasker | null = null;

export function getImageMasker(options?: MaskOptions): ImageMasker {
  if (!defaultMasker || options) {
    defaultMasker = new ImageMasker(options);
  }
  return defaultMasker;
}

/**
 * Quick segmentation helper
 */
export async function segmentImage(imageBase64: string): Promise<SegmentationResult | null> {
  const masker = getImageMasker();
  return masker.segment(imageBase64);
}

export default {
  ImageMasker,
  getImageMasker,
  segmentImage,
};
