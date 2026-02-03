/**
 * @fileoverview Occlusion compositing for hands/body over avatar
 * Uses segmentation masks and hand landmarks to composite layers correctly
 */

import type { TrackingFrame, Landmark2D } from '@mirrorx/mirror3d-tracking';
import type { OcclusionConfig } from './types';
import { DEFAULT_OCCLUSION_CONFIG } from './types';

/**
 * Handles occlusion compositing between the real user and the virtual avatar
 * This allows hands to appear in front of clothing when reaching forward
 */
export class OcclusionCompositor {
  private config: OcclusionConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;

  constructor(config: Partial<OcclusionConfig> = {}) {
    this.config = { ...DEFAULT_OCCLUSION_CONFIG, ...config };

    // Create canvas for compositing
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;

    // Create canvas for mask processing
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d')!;
  }

  /**
   * Generate an occlusion mask from tracking data
   * Returns a canvas that can be used as a mask texture
   */
  generateMask(
    frame: TrackingFrame,
    videoWidth: number,
    videoHeight: number
  ): HTMLCanvasElement {
    // Resize canvases if needed
    if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
      this.maskCanvas.width = videoWidth;
      this.maskCanvas.height = videoHeight;
    }

    // Clear mask
    this.maskCtx.clearRect(0, 0, videoWidth, videoHeight);
    this.maskCtx.fillStyle = 'black';
    this.maskCtx.fillRect(0, 0, videoWidth, videoHeight);

    // Draw segmentation mask if available and enabled
    if (this.config.useSegmentationMask && frame.segmentationMask) {
      this.drawSegmentationMask(frame.segmentationMask, videoWidth, videoHeight);
    }

    // Draw hand masks if enabled
    if (this.config.useHandOcclusion) {
      if (frame.leftHand && frame.pose) {
        this.drawHandMask(frame.pose.imageLandmarks, frame.leftHand, 'left', videoWidth, videoHeight);
      }
      if (frame.rightHand && frame.pose) {
        this.drawHandMask(frame.pose.imageLandmarks, frame.rightHand, 'right', videoWidth, videoHeight);
      }
    }

    // Apply edge softening if configured
    if (this.config.edgeSoftness > 0) {
      this.applyEdgeSoftening();
    }

    return this.maskCanvas;
  }

  /**
   * Draw the segmentation mask onto the mask canvas
   */
  private drawSegmentationMask(
    mask: ImageData,
    videoWidth: number,
    videoHeight: number
  ): void {
    // Create temporary ImageData at canvas size
    const scaledMask = this.maskCtx.createImageData(videoWidth, videoHeight);

    // Scale the mask to fit
    const scaleX = mask.width / videoWidth;
    const scaleY = mask.height / videoHeight;

    for (let y = 0; y < videoHeight; y++) {
      for (let x = 0; x < videoWidth; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcIdx = (srcY * mask.width + srcX) * 4;
        const dstIdx = (y * videoWidth + x) * 4;

        // Use red channel as mask value
        const maskValue = mask.data[srcIdx];

        scaledMask.data[dstIdx] = maskValue;     // R
        scaledMask.data[dstIdx + 1] = maskValue; // G
        scaledMask.data[dstIdx + 2] = maskValue; // B
        scaledMask.data[dstIdx + 3] = 255;       // A
      }
    }

    this.maskCtx.putImageData(scaledMask, 0, 0);
  }

  /**
   * Draw a hand/forearm mask using landmarks
   * This creates a more accurate mask for hand occlusion
   */
  private drawHandMask(
    poseLandmarks: Landmark2D[],
    hand: { landmarks: any[]; handedness: string },
    side: 'left' | 'right',
    videoWidth: number,
    videoHeight: number
  ): void {
    const isLeft = side === 'left';

    // Get pose landmarks for forearm
    // Note: In mirrored view, left/right are swapped
    const shoulderIdx = isLeft ? 11 : 12; // LEFT_SHOULDER : RIGHT_SHOULDER
    const elbowIdx = isLeft ? 13 : 14;    // LEFT_ELBOW : RIGHT_ELBOW
    const wristIdx = isLeft ? 15 : 16;    // LEFT_WRIST : RIGHT_WRIST

    const shoulder = poseLandmarks[shoulderIdx];
    const elbow = poseLandmarks[elbowIdx];
    const wrist = poseLandmarks[wristIdx];

    if (!shoulder || !elbow || !wrist) return;

    // Convert to pixel coordinates
    const toPixel = (lm: Landmark2D) => ({
      x: lm.x * videoWidth,
      y: lm.y * videoHeight,
    });

    const shoulderPx = toPixel(shoulder);
    const elbowPx = toPixel(elbow);
    const wristPx = toPixel(wrist);

    // Calculate arm width based on distance
    const upperArmLength = Math.hypot(elbowPx.x - shoulderPx.x, elbowPx.y - shoulderPx.y);
    const forearmLength = Math.hypot(wristPx.x - elbowPx.x, wristPx.y - elbowPx.y);
    const armWidth = Math.max(upperArmLength, forearmLength) * 0.25;

    // Draw forearm as thick line
    this.maskCtx.save();
    this.maskCtx.strokeStyle = 'white';
    this.maskCtx.lineWidth = armWidth;
    this.maskCtx.lineCap = 'round';
    this.maskCtx.lineJoin = 'round';

    this.maskCtx.beginPath();
    this.maskCtx.moveTo(elbowPx.x, elbowPx.y);
    this.maskCtx.lineTo(wristPx.x, wristPx.y);
    this.maskCtx.stroke();

    // Draw hand as polygon from hand landmarks
    if (hand.landmarks && hand.landmarks.length > 0) {
      // Use hand landmarks to create hand shape
      const handPoints = hand.landmarks.map((lm: any) => ({
        x: lm.x * videoWidth,
        y: lm.y * videoHeight,
      }));

      // Draw convex hull of hand landmarks
      this.maskCtx.fillStyle = 'white';
      this.maskCtx.beginPath();

      // Draw filled circles at each landmark for a rough hand shape
      for (const point of handPoints) {
        this.maskCtx.moveTo(point.x + armWidth * 0.4, point.y);
        this.maskCtx.arc(point.x, point.y, armWidth * 0.4, 0, Math.PI * 2);
      }
      this.maskCtx.fill();

      // Connect landmarks with lines for finger shapes
      const fingerIndices = [
        [0, 1, 2, 3, 4],      // Thumb
        [0, 5, 6, 7, 8],      // Index
        [0, 9, 10, 11, 12],   // Middle
        [0, 13, 14, 15, 16],  // Ring
        [0, 17, 18, 19, 20],  // Pinky
      ];

      this.maskCtx.lineWidth = armWidth * 0.3;
      for (const finger of fingerIndices) {
        this.maskCtx.beginPath();
        this.maskCtx.moveTo(handPoints[finger[0]].x, handPoints[finger[0]].y);
        for (let i = 1; i < finger.length; i++) {
          this.maskCtx.lineTo(handPoints[finger[i]].x, handPoints[finger[i]].y);
        }
        this.maskCtx.stroke();
      }
    }

    this.maskCtx.restore();
  }

  /**
   * Apply Gaussian-like blur for soft edges
   */
  private applyEdgeSoftening(): void {
    // Simple box blur approximation
    const iterations = Math.ceil(this.config.edgeSoftness * 3);
    const imageData = this.maskCtx.getImageData(
      0, 0, this.maskCanvas.width, this.maskCanvas.height
    );

    for (let i = 0; i < iterations; i++) {
      this.boxBlur(imageData, 2);
    }

    this.maskCtx.putImageData(imageData, 0, 0);
  }

  /**
   * Simple box blur for edge softening
   */
  private boxBlur(imageData: ImageData, radius: number): void {
    const { data, width, height } = imageData;
    const temp = new Uint8ClampedArray(data.length);
    temp.set(data);

    const kernelSize = radius * 2 + 1;
    const kernelArea = kernelSize * kernelSize;

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let sum = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            sum += temp[idx];
          }
        }

        const idx = (y * width + x) * 4;
        const avg = sum / kernelArea;
        data[idx] = avg;
        data[idx + 1] = avg;
        data[idx + 2] = avg;
      }
    }
  }

  /**
   * Composite the 3D render with the video using the occlusion mask
   * @param videoCanvas - Canvas with the webcam video
   * @param renderCanvas - Canvas with the 3D render
   * @param outputCanvas - Canvas to draw the composite
   */
  composite(
    videoCanvas: HTMLCanvasElement,
    renderCanvas: HTMLCanvasElement,
    outputCanvas: HTMLCanvasElement,
    frame: TrackingFrame
  ): void {
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = outputCanvas;

    // Clear output
    ctx.clearRect(0, 0, width, height);

    // Draw video background
    ctx.drawImage(videoCanvas, 0, 0, width, height);

    // Draw 3D render on top
    ctx.drawImage(renderCanvas, 0, 0, width, height);

    // If occlusion is enabled, apply mask for hands over avatar
    if (this.config.useHandOcclusion || this.config.useSegmentationMask) {
      // Generate occlusion mask
      const mask = this.generateMask(frame, width, height);

      // Use the mask to reveal the video (hands) over the render
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, 0, width, height);

      // Redraw video in those areas
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(videoCanvas, 0, 0, width, height);

      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<OcclusionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the mask canvas (for debugging)
   */
  getMaskCanvas(): HTMLCanvasElement {
    return this.maskCanvas;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Canvases will be garbage collected
  }
}
