/**
 * @fileoverview Main tracking manager that orchestrates MediaPipe pose, hands, and segmentation
 * This is the primary interface for real-time body tracking
 */

import type {
  TrackingConfig,
  TrackingFrame,
  TrackingFrameCallback,
  TrackingStatus,
  TrackingStatusCallback,
  PoseResult,
  HandResult,
  Landmark3D,
  Landmark2D,
} from './types';
import { DEFAULT_TRACKING_CONFIG, PoseLandmark } from './types';
import { PoseSmoother, SmoothingConfig } from './smoothing';

// MediaPipe types - we use dynamic import for browser compatibility
type PoseLandmarker = any;
type HandLandmarker = any;
type ImageSegmenter = any;

/**
 * Unified tracking manager for the 3D Mirror system
 * Manages MediaPipe models and provides smoothed tracking data
 */
export class TrackingManager {
  private config: TrackingConfig;
  private poseLandmarker: PoseLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private imageSegmenter: ImageSegmenter | null = null;

  private video: HTMLVideoElement | null = null;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private frameInterval: number;
  private frameNumber: number = 0;

  private frameCallbacks: TrackingFrameCallback[] = [];
  private statusCallbacks: TrackingStatusCallback[] = [];

  private poseSmoother: PoseSmoother;
  private leftHandSmoother: PoseSmoother;
  private rightHandSmoother: PoseSmoother;

  // Performance tracking
  private processingTimes: number[] = [];
  private lastFpsUpdate: number = 0;
  private fpsFrameCount: number = 0;
  private currentFps: number = 0;

  private lastError: string | null = null;
  private isInitialized: boolean = false;

  // MediaPipe Vision module - loaded dynamically
  private vision: any = null;

  constructor(config: Partial<TrackingConfig> = {}) {
    this.config = { ...DEFAULT_TRACKING_CONFIG, ...config };
    this.frameInterval = 1000 / this.config.targetFps;

    // Initialize smoothers with One Euro filter (best for real-time tracking)
    const smoothConfig: SmoothingConfig = {
      type: 'oneEuro',
      minCutoff: 1.5,
      beta: 0.01,
    };

    this.poseSmoother = new PoseSmoother(33, smoothConfig);
    this.leftHandSmoother = new PoseSmoother(21, smoothConfig);
    this.rightHandSmoother = new PoseSmoother(21, smoothConfig);
  }

  /**
   * Initialize MediaPipe models
   * Must be called before starting tracking
   */
  async initialize(): Promise<void> {
    try {
      // Dynamically import MediaPipe Vision module
      const { FilesetResolver, PoseLandmarker, HandLandmarker, ImageSegmenter } =
        await import('@mediapipe/tasks-vision');

      // Initialize the vision module
      this.vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      );

      // Initialize Pose Landmarker
      if (this.config.enablePose) {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(this.vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: this.config.minDetectionConfidence,
          minPosePresenceConfidence: this.config.minTrackingConfidence,
          minTrackingConfidence: this.config.minTrackingConfidence,
          outputSegmentationMasks: this.config.enableSegmentation,
        });
      }

      // Initialize Hand Landmarker
      if (this.config.enableHands) {
        this.handLandmarker = await HandLandmarker.createFromOptions(this.vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: this.config.minDetectionConfidence,
          minHandPresenceConfidence: this.config.minTrackingConfidence,
          minTrackingConfidence: this.config.minTrackingConfidence,
        });
      }

      // Initialize Image Segmenter for occlusion masks
      if (this.config.enableSegmentation && !this.config.enablePose) {
        // Only create standalone segmenter if pose doesn't provide one
        this.imageSegmenter = await ImageSegmenter.createFromOptions(this.vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
        });
      }

      this.isInitialized = true;
      this.notifyStatusChange();
      console.log('[TrackingManager] Initialized successfully');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Failed to initialize tracking';
      this.notifyStatusChange();
      throw error;
    }
  }

  /**
   * Start tracking with a video element
   * @param video - The video element (usually from webcam)
   */
  async startTracking(video: HTMLVideoElement): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('TrackingManager not initialized. Call initialize() first.');
    }

    this.video = video;
    this.isRunning = true;
    this.frameNumber = 0;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdate = performance.now();
    this.fpsFrameCount = 0;

    // Reset smoothers
    this.poseSmoother.reset();
    this.leftHandSmoother.reset();
    this.rightHandSmoother.reset();

    this.notifyStatusChange();
    this.trackingLoop();
  }

  /**
   * Stop tracking
   */
  stopTracking(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.notifyStatusChange();
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.stopTracking();

    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    if (this.imageSegmenter) {
      this.imageSegmenter.close();
      this.imageSegmenter = null;
    }

    this.isInitialized = false;
    this.notifyStatusChange();
  }

  /**
   * Subscribe to tracking frames
   */
  onFrame(callback: TrackingFrameCallback): () => void {
    this.frameCallbacks.push(callback);
    return () => {
      const index = this.frameCallbacks.indexOf(callback);
      if (index > -1) {
        this.frameCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to status updates
   */
  onStatusChange(callback: TrackingStatusCallback): () => void {
    this.statusCallbacks.push(callback);
    // Immediately notify with current status
    callback(this.getStatus());
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current tracking status
   */
  getStatus(): TrackingStatus {
    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      currentFps: this.currentFps,
      averageProcessingTime: avgProcessingTime,
      lastError: this.lastError,
    };
  }

  /**
   * Update smoothing configuration
   */
  setSmoothingStrength(strength: number): void {
    // Map strength (0-1) to One Euro filter parameters
    // Higher strength = more smoothing = lower minCutoff and beta
    const minCutoff = 0.5 + (1 - strength) * 3; // 0.5 - 3.5
    const beta = 0.001 + (1 - strength) * 0.02; // 0.001 - 0.021

    const smoothConfig: SmoothingConfig = {
      type: 'oneEuro',
      minCutoff,
      beta,
    };

    this.poseSmoother = new PoseSmoother(33, smoothConfig);
    this.leftHandSmoother = new PoseSmoother(21, smoothConfig);
    this.rightHandSmoother = new PoseSmoother(21, smoothConfig);
  }

  /**
   * Main tracking loop
   */
  private trackingLoop = (): void => {
    if (!this.isRunning || !this.video) {
      return;
    }

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    // Throttle to target FPS
    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = now - (elapsed % this.frameInterval);
      this.processFrame(now);
    }

    this.animationFrameId = requestAnimationFrame(this.trackingLoop);
  };

  /**
   * Process a single frame
   */
  private processFrame(timestamp: number): void {
    if (!this.video || this.video.readyState < 2) {
      return; // Video not ready
    }

    const startTime = performance.now();

    try {
      const frame = this.runInference(timestamp);

      // Track processing time
      const processingTime = performance.now() - startTime;
      frame.processingTime = processingTime;
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 30) {
        this.processingTimes.shift();
      }

      // Update FPS counter
      this.fpsFrameCount++;
      if (timestamp - this.lastFpsUpdate >= 1000) {
        this.currentFps = this.fpsFrameCount;
        this.fpsFrameCount = 0;
        this.lastFpsUpdate = timestamp;
        this.notifyStatusChange();
      }

      // Notify subscribers
      this.frameCallbacks.forEach((cb) => cb(frame));
      this.frameNumber++;
    } catch (error) {
      console.error('[TrackingManager] Frame processing error:', error);
      this.lastError = error instanceof Error ? error.message : 'Processing error';
    }
  }

  /**
   * Run inference on the current video frame
   */
  private runInference(timestamp: number): TrackingFrame {
    const frame: TrackingFrame = {
      pose: null,
      leftHand: null,
      rightHand: null,
      face: null,
      segmentationMask: null,
      processingTime: 0,
      frameNumber: this.frameNumber,
    };

    // Run pose detection
    if (this.poseLandmarker && this.video) {
      const poseResults = this.poseLandmarker.detectForVideo(this.video, timestamp);

      if (poseResults.landmarks && poseResults.landmarks.length > 0) {
        const worldLandmarks = poseResults.worldLandmarks?.[0] || [];
        const imageLandmarks = poseResults.landmarks[0] || [];

        // Calculate confidence from landmark visibility
        const confidence = this.calculatePoseConfidence(worldLandmarks);

        // Smooth landmarks
        const smoothedWorld = this.poseSmoother.update(
          worldLandmarks.map((lm: any) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility,
          })),
          timestamp
        );

        frame.pose = {
          worldLandmarks: smoothedWorld,
          imageLandmarks: imageLandmarks.map((lm: any) => ({
            x: lm.x,
            y: lm.y,
            visibility: lm.visibility,
          })),
          confidence,
          timestamp,
        };
      }

      // Get segmentation mask if available
      if (poseResults.segmentationMasks && poseResults.segmentationMasks.length > 0) {
        frame.segmentationMask = this.extractMaskData(poseResults.segmentationMasks[0]);
      }
    }

    // Run hand detection
    if (this.handLandmarker && this.video) {
      const handResults = this.handLandmarker.detectForVideo(this.video, timestamp);

      if (handResults.landmarks && handResults.landmarks.length > 0) {
        for (let i = 0; i < handResults.landmarks.length; i++) {
          const landmarks = handResults.landmarks[i];
          const worldLandmarks = handResults.worldLandmarks?.[i] || landmarks;
          const handedness = handResults.handednesses?.[i]?.[0]?.categoryName?.toLowerCase() || 'right';

          // Note: MediaPipe returns handedness as seen from the camera (mirrored)
          // So 'Left' in MediaPipe means the user's right hand when mirrored
          const isLeft = handedness === 'left';

          const smoother = isLeft ? this.leftHandSmoother : this.rightHandSmoother;
          const smoothedLandmarks = smoother.update(
            worldLandmarks.map((lm: any) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z,
              visibility: 1,
            })),
            timestamp
          );

          const handResult: HandResult = {
            landmarks: smoothedLandmarks,
            handedness: isLeft ? 'left' : 'right',
            confidence: handResults.handednesses?.[i]?.[0]?.score || 0.5,
          };

          if (isLeft) {
            frame.leftHand = handResult;
          } else {
            frame.rightHand = handResult;
          }
        }
      }
    }

    // Run standalone segmentation if needed
    if (this.imageSegmenter && !frame.segmentationMask && this.video) {
      const segResults = this.imageSegmenter.segmentForVideo(this.video, timestamp);
      if (segResults.categoryMask) {
        frame.segmentationMask = this.extractMaskData(segResults.categoryMask);
      }
    }

    return frame;
  }

  /**
   * Calculate overall pose confidence from landmark visibilities
   */
  private calculatePoseConfidence(landmarks: Landmark3D[]): number {
    if (!landmarks || landmarks.length === 0) return 0;

    // Focus on key body landmarks for confidence
    const keyIndices = [
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP,
      PoseLandmark.LEFT_ELBOW,
      PoseLandmark.RIGHT_ELBOW,
    ];

    let totalVisibility = 0;
    let count = 0;

    for (const idx of keyIndices) {
      if (landmarks[idx]?.visibility !== undefined) {
        totalVisibility += landmarks[idx].visibility!;
        count++;
      }
    }

    return count > 0 ? totalVisibility / count : 0;
  }

  /**
   * Extract mask data from MediaPipe segmentation result
   */
  private extractMaskData(mask: any): ImageData | null {
    try {
      if (mask.getAsFloat32Array) {
        const floatArray = mask.getAsFloat32Array();
        const width = mask.width;
        const height = mask.height;

        // Convert to ImageData (RGBA format)
        const imageData = new ImageData(width, height);
        for (let i = 0; i < floatArray.length; i++) {
          const value = Math.round(floatArray[i] * 255);
          const idx = i * 4;
          imageData.data[idx] = value;     // R
          imageData.data[idx + 1] = value; // G
          imageData.data[idx + 2] = value; // B
          imageData.data[idx + 3] = 255;   // A
        }
        return imageData;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Notify status callbacks
   */
  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.statusCallbacks.forEach((cb) => cb(status));
  }
}
