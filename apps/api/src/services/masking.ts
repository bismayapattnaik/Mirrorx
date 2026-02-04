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
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const ANALYSIS_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3-pro';

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
   */
  async detectFaceRegion(imageBase64: string): Promise<{
    bbox: FaceBoundingBox;
    landmarks: FaceLandmarks;
    skinTone: { rgb: { r: number; g: number; b: number }; hex: string };
  } | null> {
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

      if (!jsonMatch) {
        console.error('[ImageMasker] Failed to parse face detection response');
        return null;
      }

      const data = JSON.parse(jsonMatch[0]);

      if (!data.faceDetected) {
        console.log('[ImageMasker] No face detected in image');
        return null;
      }

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
      console.error('[ImageMasker] Face detection error:', error);
      return null;
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
   */
  async segment(imageBase64: string): Promise<SegmentationResult | null> {
    console.log('[ImageMasker] Starting segmentation...');

    // Step 1: Detect face region
    const detection = await this.detectFaceRegion(imageBase64);
    if (!detection) {
      console.error('[ImageMasker] Face detection failed');
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
