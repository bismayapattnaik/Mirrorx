/**
 * @fileoverview Face texture generation for 3D avatars
 * Phase 2: Extracts face from photo and applies to avatar using MediaPipe Face Mesh
 */

import * as THREE from 'three';

/**
 * Face landmark indices for texture mapping
 * Based on MediaPipe Face Mesh 468 landmarks
 */
const FACE_LANDMARKS = {
  // Face oval (outline)
  faceOval: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ],

  // Left eye region
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  leftEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],

  // Right eye region
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  rightEyebrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],

  // Nose
  nose: [1, 2, 98, 327, 4, 5, 6, 168, 197, 195, 5, 4, 1, 19, 94, 2, 164],

  // Lips/mouth
  upperLip: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78],
  lowerLip: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78],

  // Forehead (estimated from face oval top)
  forehead: [10, 338, 297, 332, 284, 54, 103, 67, 109, 21],
};

/**
 * UV mapping for face regions on avatar texture
 */
const FACE_UV_REGIONS = {
  // Standard UV coordinates for avatar face texture (0-1 normalized)
  faceOval: { uMin: 0.25, uMax: 0.75, vMin: 0.1, vMax: 0.9 },
  leftEye: { uMin: 0.35, uMax: 0.48, vMin: 0.35, vMax: 0.45 },
  rightEye: { uMin: 0.52, uMax: 0.65, vMin: 0.35, vMax: 0.45 },
  nose: { uMin: 0.45, uMax: 0.55, vMin: 0.4, vMax: 0.65 },
  mouth: { uMin: 0.4, uMax: 0.6, vMin: 0.65, vMax: 0.8 },
};

/**
 * Face texture configuration
 */
export interface FaceTextureConfig {
  /** Output texture size (width and height) */
  textureSize: number;
  /** Whether to include eye cutouts for expression animation */
  eyeCutouts: boolean;
  /** Whether to include mouth cutout for expression animation */
  mouthCutout: boolean;
  /** Blend factor for combining face with avatar base (0-1) */
  blendFactor: number;
  /** Smoothing iterations for face edges */
  edgeSmoothing: number;
}

const DEFAULT_CONFIG: FaceTextureConfig = {
  textureSize: 1024,
  eyeCutouts: true,
  mouthCutout: true,
  blendFactor: 0.85,
  edgeSmoothing: 5,
};

/**
 * Face mesh data from MediaPipe
 */
export interface FaceMeshData {
  /** 468 face landmarks (normalized 0-1 to image size) */
  landmarks: Array<{ x: number; y: number; z: number }>;
  /** Source image width */
  imageWidth: number;
  /** Source image height */
  imageHeight: number;
}

/**
 * Result of face texture generation
 */
export interface FaceTextureResult {
  /** Generated face texture (base64 data URL) */
  texture: string;
  /** THREE.js texture object */
  threeTexture: THREE.Texture;
  /** Face bounding box in source image */
  boundingBox: { x: number; y: number; width: number; height: number };
  /** Generation confidence (0-1) */
  confidence: number;
}

/**
 * Generates face textures for 3D avatars from photos using MediaPipe Face Mesh
 */
export class FaceTextureGenerator {
  private config: FaceTextureConfig;
  private faceLandmarker: any = null;
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  constructor(config: Partial<FaceTextureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create canvas for texture generation
    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(this.config.textureSize, this.config.textureSize);
      this.ctx = this.canvas.getContext('2d')!;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.config.textureSize;
      this.canvas.height = this.config.textureSize;
      this.ctx = this.canvas.getContext('2d')!;
    }
  }

  /**
   * Initialize MediaPipe Face Landmarker
   */
  async initialize(): Promise<void> {
    try {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

      console.log('[FaceTextureGenerator] Initialized successfully');
    } catch (error) {
      console.error('[FaceTextureGenerator] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Generate face texture from an image element or canvas
   */
  async generateFromImage(
    image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    avatarBaseTexture?: THREE.Texture
  ): Promise<FaceTextureResult | null> {
    if (!this.faceLandmarker) {
      throw new Error('FaceTextureGenerator not initialized. Call initialize() first.');
    }

    // Detect face landmarks
    const results = this.faceLandmarker.detect(image);

    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      console.warn('[FaceTextureGenerator] No face detected in image');
      return null;
    }

    const landmarks = results.faceLandmarks[0];
    const imageWidth = 'naturalWidth' in image ? image.naturalWidth : image.width;
    const imageHeight = 'naturalHeight' in image ? image.naturalHeight : image.height;

    const faceMesh: FaceMeshData = {
      landmarks,
      imageWidth,
      imageHeight,
    };

    return this.generateTexture(image, faceMesh, avatarBaseTexture);
  }

  /**
   * Generate face texture from video frame
   */
  async generateFromVideo(
    video: HTMLVideoElement,
    avatarBaseTexture?: THREE.Texture
  ): Promise<FaceTextureResult | null> {
    if (!this.faceLandmarker) {
      throw new Error('FaceTextureGenerator not initialized. Call initialize() first.');
    }

    // Detect face landmarks from video
    const results = this.faceLandmarker.detectForVideo(video, performance.now());

    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      return null;
    }

    const landmarks = results.faceLandmarks[0];
    const faceMesh: FaceMeshData = {
      landmarks,
      imageWidth: video.videoWidth,
      imageHeight: video.videoHeight,
    };

    return this.generateTexture(video, faceMesh, avatarBaseTexture);
  }

  /**
   * Generate the actual texture from face mesh data
   */
  private async generateTexture(
    source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
    faceMesh: FaceMeshData,
    avatarBaseTexture?: THREE.Texture
  ): Promise<FaceTextureResult> {
    const { textureSize } = this.config;
    const { landmarks, imageWidth, imageHeight } = faceMesh;

    // Clear canvas
    this.ctx.clearRect(0, 0, textureSize, textureSize);

    // If we have a base texture, draw it first
    if (avatarBaseTexture?.image) {
      this.ctx.drawImage(avatarBaseTexture.image, 0, 0, textureSize, textureSize);
    } else {
      // Fill with neutral skin tone
      this.ctx.fillStyle = '#DEB887';
      this.ctx.fillRect(0, 0, textureSize, textureSize);
    }

    // Calculate face bounding box
    const boundingBox = this.calculateBoundingBox(landmarks, imageWidth, imageHeight);

    // Extract face region from source
    const faceCanvas = this.extractFaceRegion(source, landmarks, boundingBox);

    // Apply face to UV mapped position
    this.applyFaceToTexture(faceCanvas, landmarks);

    // Create cutouts for eyes and mouth if enabled
    if (this.config.eyeCutouts) {
      this.createEyeCutouts(landmarks);
    }
    if (this.config.mouthCutout) {
      this.createMouthCutout(landmarks);
    }

    // Apply edge smoothing
    this.smoothEdges();

    // Convert to data URL and THREE.Texture
    const dataUrl = this.canvasToDataUrl();
    const threeTexture = this.createThreeTexture();

    return {
      texture: dataUrl,
      threeTexture,
      boundingBox,
      confidence: this.calculateConfidence(landmarks),
    };
  }

  /**
   * Calculate face bounding box from landmarks
   */
  private calculateBoundingBox(
    landmarks: FaceMeshData['landmarks'],
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number; width: number; height: number } {
    const faceOvalIndices = FACE_LANDMARKS.faceOval;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const idx of faceOvalIndices) {
      const lm = landmarks[idx];
      const x = lm.x * imageWidth;
      const y = lm.y * imageHeight;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    // Add padding
    const padding = (maxX - minX) * 0.1;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    return {
      x: Math.max(0, minX),
      y: Math.max(0, minY),
      width: Math.min(imageWidth, maxX) - Math.max(0, minX),
      height: Math.min(imageHeight, maxY) - Math.max(0, minY),
    };
  }

  /**
   * Extract face region using face mesh landmarks
   */
  private extractFaceRegion(
    source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
    landmarks: FaceMeshData['landmarks'],
    boundingBox: { x: number; y: number; width: number; height: number }
  ): HTMLCanvasElement {
    const tempCanvas = document.createElement('canvas');
    const size = Math.max(boundingBox.width, boundingBox.height);
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Center the face in the extraction
    const offsetX = (size - boundingBox.width) / 2;
    const offsetY = (size - boundingBox.height) / 2;

    // Draw source face region
    tempCtx.drawImage(
      source,
      boundingBox.x,
      boundingBox.y,
      boundingBox.width,
      boundingBox.height,
      offsetX,
      offsetY,
      boundingBox.width,
      boundingBox.height
    );

    // Create mask using face oval
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = size;
    maskCanvas.height = size;
    const maskCtx = maskCanvas.getContext('2d')!;

    // Draw face oval mask
    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();

    const imageWidth = 'naturalWidth' in source
      ? (source as HTMLImageElement).naturalWidth
      : 'videoWidth' in source
        ? (source as HTMLVideoElement).videoWidth
        : source.width;
    const imageHeight = 'naturalHeight' in source
      ? (source as HTMLImageElement).naturalHeight
      : 'videoHeight' in source
        ? (source as HTMLVideoElement).videoHeight
        : source.height;

    const faceOvalIndices = FACE_LANDMARKS.faceOval;
    for (let i = 0; i < faceOvalIndices.length; i++) {
      const lm = landmarks[faceOvalIndices[i]];
      const x = (lm.x * imageWidth - boundingBox.x + offsetX);
      const y = (lm.y * imageHeight - boundingBox.y + offsetY);

      if (i === 0) {
        maskCtx.moveTo(x, y);
      } else {
        maskCtx.lineTo(x, y);
      }
    }
    maskCtx.closePath();
    maskCtx.fill();

    // Apply mask with feathered edges
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.filter = 'blur(3px)';
    tempCtx.drawImage(maskCanvas, 0, 0);
    tempCtx.filter = 'none';

    return tempCanvas;
  }

  /**
   * Apply extracted face to the avatar texture
   */
  private applyFaceToTexture(
    faceCanvas: HTMLCanvasElement,
    _landmarks: FaceMeshData['landmarks']
  ): void {
    const { textureSize, blendFactor } = this.config;
    const faceRegion = FACE_UV_REGIONS.faceOval;

    // Calculate destination position in UV space
    const destX = faceRegion.uMin * textureSize;
    const destY = faceRegion.vMin * textureSize;
    const destWidth = (faceRegion.uMax - faceRegion.uMin) * textureSize;
    const destHeight = (faceRegion.vMax - faceRegion.vMin) * textureSize;

    // Apply blending
    this.ctx.globalAlpha = blendFactor;
    this.ctx.drawImage(faceCanvas, destX, destY, destWidth, destHeight);
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Create transparent cutouts for eyes to allow expression animation
   */
  private createEyeCutouts(landmarks: FaceMeshData['landmarks']): void {
    const { textureSize } = this.config;

    // Left eye cutout
    this.createRegionCutout(landmarks, FACE_LANDMARKS.leftEye, textureSize);

    // Right eye cutout
    this.createRegionCutout(landmarks, FACE_LANDMARKS.rightEye, textureSize);
  }

  /**
   * Create transparent cutout for mouth
   */
  private createMouthCutout(landmarks: FaceMeshData['landmarks']): void {
    const { textureSize } = this.config;
    const mouthIndices = [...FACE_LANDMARKS.upperLip, ...FACE_LANDMARKS.lowerLip];
    this.createRegionCutout(landmarks, mouthIndices, textureSize);
  }

  /**
   * Create a transparent cutout for a region defined by landmark indices
   */
  private createRegionCutout(
    landmarks: FaceMeshData['landmarks'],
    indices: number[],
    textureSize: number
  ): void {
    // Calculate region bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const idx of indices) {
      const lm = landmarks[idx];
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }

    // Map to texture UV coordinates
    const faceRegion = FACE_UV_REGIONS.faceOval;
    const mapToUV = (x: number, y: number) => ({
      u: faceRegion.uMin + (x - 0.2) / 0.6 * (faceRegion.uMax - faceRegion.uMin),
      v: faceRegion.vMin + (y - 0.2) / 0.6 * (faceRegion.vMax - faceRegion.vMin),
    });

    const topLeft = mapToUV(minX, minY);
    const bottomRight = mapToUV(maxX, maxY);

    const padding = 0.01;
    const x = (topLeft.u - padding) * textureSize;
    const y = (topLeft.v - padding) * textureSize;
    const width = (bottomRight.u - topLeft.u + padding * 2) * textureSize;
    const height = (bottomRight.v - topLeft.v + padding * 2) * textureSize;

    // Clear the region (make transparent)
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = 'black';
    this.ctx.beginPath();
    this.ctx.ellipse(
      x + width / 2,
      y + height / 2,
      width / 2,
      height / 2,
      0,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Smooth edges of the face texture
   */
  private smoothEdges(): void {
    // Apply slight blur to edges for smoother blending
    // This is done by drawing the canvas onto itself with slight blur
    const iterations = this.config.edgeSmoothing;

    for (let i = 0; i < iterations; i++) {
      // Save current state
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.config.textureSize,
        this.config.textureSize
      );

      // Apply minimal smoothing to edges only
      this.smoothImageDataEdges(imageData);

      // Put back
      this.ctx.putImageData(imageData, 0, 0);
    }
  }

  /**
   * Smooth edges in image data
   */
  private smoothImageDataEdges(imageData: ImageData): void {
    const { width, height, data } = imageData;
    const edgeThreshold = 200; // Alpha threshold for edge detection

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];

        // Only process edge pixels
        if (alpha > 10 && alpha < edgeThreshold) {
          // Average with neighbors
          let sumR = 0, sumG = 0, sumB = 0, count = 0;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4;
              if (data[nIdx + 3] > 10) {
                sumR += data[nIdx];
                sumG += data[nIdx + 1];
                sumB += data[nIdx + 2];
                count++;
              }
            }
          }

          if (count > 0) {
            data[idx] = sumR / count;
            data[idx + 1] = sumG / count;
            data[idx + 2] = sumB / count;
          }
        }
      }
    }
  }

  /**
   * Calculate confidence score for face detection
   */
  private calculateConfidence(landmarks: FaceMeshData['landmarks']): number {
    // Check if all key landmarks have valid positions
    const keyIndices = [
      ...FACE_LANDMARKS.leftEye.slice(0, 4),
      ...FACE_LANDMARKS.rightEye.slice(0, 4),
      ...FACE_LANDMARKS.nose.slice(0, 4),
      1, 4, // Center landmarks
    ];

    let validCount = 0;
    for (const idx of keyIndices) {
      const lm = landmarks[idx];
      if (lm && lm.x >= 0 && lm.x <= 1 && lm.y >= 0 && lm.y <= 1) {
        validCount++;
      }
    }

    return validCount / keyIndices.length;
  }

  /**
   * Convert canvas to data URL
   */
  private canvasToDataUrl(): string {
    if (this.canvas instanceof OffscreenCanvas) {
      // OffscreenCanvas needs different handling
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(this.canvas, 0, 0);
      return tempCanvas.toDataURL('image/png');
    }
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Create THREE.js texture from canvas
   */
  private createThreeTexture(): THREE.Texture {
    let textureSource: HTMLCanvasElement;

    if (this.canvas instanceof OffscreenCanvas) {
      // Convert OffscreenCanvas to regular canvas for THREE.js
      textureSource = document.createElement('canvas');
      textureSource.width = this.canvas.width;
      textureSource.height = this.canvas.height;
      const ctx = textureSource.getContext('2d')!;
      ctx.drawImage(this.canvas, 0, 0);
    } else {
      textureSource = this.canvas;
    }

    const texture = new THREE.CanvasTexture(textureSource);
    texture.flipY = false;
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
  }
}
