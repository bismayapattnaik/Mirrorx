/**
 * @fileoverview Type definitions for the 3D Mirror tracking system
 * These types define the interface between MediaPipe and our avatar system
 */

/**
 * 3D position with optional visibility and presence scores
 */
export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

/**
 * 2D position normalized to image dimensions
 */
export interface Landmark2D {
  x: number;
  y: number;
  visibility?: number;
}

/**
 * MediaPipe Pose landmark indices (33 landmarks)
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export enum PoseLandmark {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

/**
 * Hand landmark indices (21 landmarks per hand)
 */
export enum HandLandmark {
  WRIST = 0,
  THUMB_CMC = 1,
  THUMB_MCP = 2,
  THUMB_IP = 3,
  THUMB_TIP = 4,
  INDEX_FINGER_MCP = 5,
  INDEX_FINGER_PIP = 6,
  INDEX_FINGER_DIP = 7,
  INDEX_FINGER_TIP = 8,
  MIDDLE_FINGER_MCP = 9,
  MIDDLE_FINGER_PIP = 10,
  MIDDLE_FINGER_DIP = 11,
  MIDDLE_FINGER_TIP = 12,
  RING_FINGER_MCP = 13,
  RING_FINGER_PIP = 14,
  RING_FINGER_DIP = 15,
  RING_FINGER_TIP = 16,
  PINKY_MCP = 17,
  PINKY_PIP = 18,
  PINKY_DIP = 19,
  PINKY_TIP = 20,
}

/**
 * Full pose tracking result from a single frame
 */
export interface PoseResult {
  /** World-space 3D landmarks (meters, hip-centered) */
  worldLandmarks: Landmark3D[];
  /** Image-space 2D landmarks (normalized 0-1) */
  imageLandmarks: Landmark2D[];
  /** Overall tracking confidence (0-1) */
  confidence: number;
  /** Timestamp of the frame */
  timestamp: number;
}

/**
 * Hand tracking result
 */
export interface HandResult {
  /** Hand landmarks in 3D */
  landmarks: Landmark3D[];
  /** Whether this is the left or right hand */
  handedness: 'left' | 'right';
  /** Tracking confidence */
  confidence: number;
}

/**
 * Face mesh tracking result
 */
export interface FaceResult {
  /** Face mesh landmarks (468 points) */
  landmarks: Landmark3D[];
  /** Face bounding box */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Face orientation (euler angles in radians) */
  orientation?: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  confidence: number;
}

/**
 * Complete tracking frame with all available data
 */
export interface TrackingFrame {
  pose: PoseResult | null;
  leftHand: HandResult | null;
  rightHand: HandResult | null;
  face: FaceResult | null;
  /** Segmentation mask for occlusion (ImageData) */
  segmentationMask: ImageData | null;
  /** Frame processing time in ms */
  processingTime: number;
  /** Frame sequence number */
  frameNumber: number;
}

/**
 * Configuration for the tracking system
 */
export interface TrackingConfig {
  /** Enable pose tracking */
  enablePose: boolean;
  /** Enable hand tracking */
  enableHands: boolean;
  /** Enable face mesh tracking */
  enableFace: boolean;
  /** Enable segmentation mask for occlusion */
  enableSegmentation: boolean;
  /** Model complexity (0=lite, 1=full, 2=heavy) */
  modelComplexity: 0 | 1 | 2;
  /** Minimum detection confidence (0-1) */
  minDetectionConfidence: number;
  /** Minimum tracking confidence (0-1) */
  minTrackingConfidence: number;
  /** Target framerate for tracking (separate from render) */
  targetFps: number;
}

/**
 * Default tracking configuration
 */
export const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  enablePose: true,
  enableHands: true,
  enableFace: false, // Optional for MVP
  enableSegmentation: true,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  targetFps: 30,
};

/**
 * Tracking system status
 */
export interface TrackingStatus {
  isInitialized: boolean;
  isRunning: boolean;
  currentFps: number;
  averageProcessingTime: number;
  lastError: string | null;
}

/**
 * Callback for receiving tracking frames
 */
export type TrackingFrameCallback = (frame: TrackingFrame) => void;

/**
 * Callback for tracking status updates
 */
export type TrackingStatusCallback = (status: TrackingStatus) => void;
