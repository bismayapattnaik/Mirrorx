/**
 * @fileoverview Pose smoothing utilities using Kalman and exponential filters
 * These reduce jitter in tracking data while maintaining responsiveness
 */

import type { Landmark3D, Landmark2D } from './types';

/**
 * Simple 1D Kalman filter for smoothing individual values
 */
export class KalmanFilter1D {
  private x: number = 0;  // Current estimate
  private p: number = 1;  // Estimation error covariance
  private q: number;      // Process noise covariance
  private r: number;      // Measurement noise covariance
  private initialized: boolean = false;

  /**
   * @param processNoise - How much we expect the true value to change between frames (lower = smoother)
   * @param measurementNoise - How noisy we expect measurements to be (higher = smoother)
   */
  constructor(processNoise: number = 0.01, measurementNoise: number = 0.1) {
    this.q = processNoise;
    this.r = measurementNoise;
  }

  /**
   * Update the filter with a new measurement
   * @param measurement - The new measured value
   * @returns The smoothed estimate
   */
  update(measurement: number): number {
    if (!this.initialized) {
      this.x = measurement;
      this.initialized = true;
      return this.x;
    }

    // Prediction step
    // x = x (no control input)
    this.p = this.p + this.q;

    // Update step
    const k = this.p / (this.p + this.r);  // Kalman gain
    this.x = this.x + k * (measurement - this.x);
    this.p = (1 - k) * this.p;

    return this.x;
  }

  /**
   * Reset the filter state
   */
  reset(): void {
    this.x = 0;
    this.p = 1;
    this.initialized = false;
  }

  /**
   * Get current estimate without new measurement
   */
  get estimate(): number {
    return this.x;
  }
}

/**
 * 3D Kalman filter for smoothing landmark positions
 */
export class KalmanFilter3D {
  private filterX: KalmanFilter1D;
  private filterY: KalmanFilter1D;
  private filterZ: KalmanFilter1D;

  constructor(processNoise: number = 0.01, measurementNoise: number = 0.1) {
    this.filterX = new KalmanFilter1D(processNoise, measurementNoise);
    this.filterY = new KalmanFilter1D(processNoise, measurementNoise);
    this.filterZ = new KalmanFilter1D(processNoise, measurementNoise);
  }

  update(landmark: Landmark3D): Landmark3D {
    return {
      x: this.filterX.update(landmark.x),
      y: this.filterY.update(landmark.y),
      z: this.filterZ.update(landmark.z),
      visibility: landmark.visibility,
      presence: landmark.presence,
    };
  }

  reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.filterZ.reset();
  }
}

/**
 * Exponential Moving Average filter for fast smoothing
 * Simpler and faster than Kalman, good for real-time applications
 */
export class ExponentialSmoothing {
  private alpha: number;
  private smoothed: number | null = null;

  /**
   * @param alpha - Smoothing factor (0-1). Lower = smoother, higher = more responsive
   */
  constructor(alpha: number = 0.3) {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  update(value: number): number {
    if (this.smoothed === null) {
      this.smoothed = value;
    } else {
      this.smoothed = this.alpha * value + (1 - this.alpha) * this.smoothed;
    }
    return this.smoothed;
  }

  reset(): void {
    this.smoothed = null;
  }

  setAlpha(alpha: number): void {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }
}

/**
 * 3D Exponential smoothing filter
 */
export class ExponentialSmoothing3D {
  private smoothX: ExponentialSmoothing;
  private smoothY: ExponentialSmoothing;
  private smoothZ: ExponentialSmoothing;

  constructor(alpha: number = 0.3) {
    this.smoothX = new ExponentialSmoothing(alpha);
    this.smoothY = new ExponentialSmoothing(alpha);
    this.smoothZ = new ExponentialSmoothing(alpha);
  }

  update(landmark: Landmark3D): Landmark3D {
    return {
      x: this.smoothX.update(landmark.x),
      y: this.smoothY.update(landmark.y),
      z: this.smoothZ.update(landmark.z),
      visibility: landmark.visibility,
      presence: landmark.presence,
    };
  }

  reset(): void {
    this.smoothX.reset();
    this.smoothY.reset();
    this.smoothZ.reset();
  }

  setAlpha(alpha: number): void {
    this.smoothX.setAlpha(alpha);
    this.smoothY.setAlpha(alpha);
    this.smoothZ.setAlpha(alpha);
  }
}

/**
 * One Euro Filter - Adaptive smoothing that's responsive to fast movements
 * Best balance between smoothness and responsiveness for motion tracking
 * Reference: https://gery.casiez.net/1euro/
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private derivateCutoff: number;
  private x: LowPassFilter;
  private dx: LowPassFilter;
  private lastTime: number | null = null;

  /**
   * @param minCutoff - Minimum cutoff frequency (Hz). Lower = smoother when slow
   * @param beta - Speed coefficient. Higher = more responsive to fast movements
   * @param derivateCutoff - Cutoff frequency for derivative smoothing
   */
  constructor(minCutoff: number = 1.0, beta: number = 0.007, derivateCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.derivateCutoff = derivateCutoff;
    this.x = new LowPassFilter();
    this.dx = new LowPassFilter();
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  update(value: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      this.x.setWithAlpha(value, 1.0);
      this.dx.setWithAlpha(0, 1.0);
      return value;
    }

    const dt = Math.max(0.001, (timestamp - this.lastTime) / 1000); // Convert to seconds
    this.lastTime = timestamp;

    // Estimate velocity
    const dx = (value - this.x.value) / dt;
    const edx = this.dx.filterWithAlpha(dx, this.alpha(this.derivateCutoff, dt));

    // Adapt cutoff frequency based on velocity
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    // Filter the value
    return this.x.filterWithAlpha(value, this.alpha(cutoff, dt));
  }

  reset(): void {
    this.lastTime = null;
    this.x.reset();
    this.dx.reset();
  }
}

/**
 * Simple low-pass filter helper for One Euro Filter
 */
class LowPassFilter {
  private _value: number = 0;
  private initialized: boolean = false;

  get value(): number {
    return this._value;
  }

  setWithAlpha(value: number, alpha: number): void {
    this._value = value;
    this.initialized = true;
  }

  filterWithAlpha(value: number, alpha: number): number {
    if (!this.initialized) {
      this._value = value;
      this.initialized = true;
    } else {
      this._value = alpha * value + (1 - alpha) * this._value;
    }
    return this._value;
  }

  reset(): void {
    this._value = 0;
    this.initialized = false;
  }
}

/**
 * 3D One Euro Filter for landmarks
 */
export class OneEuroFilter3D {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;
  private filterZ: OneEuroFilter;

  constructor(minCutoff: number = 1.0, beta: number = 0.007, derivateCutoff: number = 1.0) {
    this.filterX = new OneEuroFilter(minCutoff, beta, derivateCutoff);
    this.filterY = new OneEuroFilter(minCutoff, beta, derivateCutoff);
    this.filterZ = new OneEuroFilter(minCutoff, beta, derivateCutoff);
  }

  update(landmark: Landmark3D, timestamp: number): Landmark3D {
    return {
      x: this.filterX.update(landmark.x, timestamp),
      y: this.filterY.update(landmark.y, timestamp),
      z: this.filterZ.update(landmark.z, timestamp),
      visibility: landmark.visibility,
      presence: landmark.presence,
    };
  }

  reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.filterZ.reset();
  }
}

/**
 * Smoothing configuration options
 */
export interface SmoothingConfig {
  type: 'kalman' | 'exponential' | 'oneEuro' | 'none';
  /** For Kalman: process noise (0.001-0.1) */
  processNoise?: number;
  /** For Kalman: measurement noise (0.01-1.0) */
  measurementNoise?: number;
  /** For Exponential: alpha (0.1-0.9) */
  alpha?: number;
  /** For One Euro: minimum cutoff frequency */
  minCutoff?: number;
  /** For One Euro: beta (speed coefficient) */
  beta?: number;
}

/**
 * Factory function to create appropriate smoother
 */
export function createLandmarkSmoother(config: SmoothingConfig): {
  update: (landmark: Landmark3D, timestamp?: number) => Landmark3D;
  reset: () => void;
} {
  switch (config.type) {
    case 'kalman': {
      const filter = new KalmanFilter3D(
        config.processNoise ?? 0.01,
        config.measurementNoise ?? 0.1
      );
      return {
        update: (landmark) => filter.update(landmark),
        reset: () => filter.reset(),
      };
    }
    case 'exponential': {
      const filter = new ExponentialSmoothing3D(config.alpha ?? 0.3);
      return {
        update: (landmark) => filter.update(landmark),
        reset: () => filter.reset(),
      };
    }
    case 'oneEuro': {
      const filter = new OneEuroFilter3D(
        config.minCutoff ?? 1.0,
        config.beta ?? 0.007
      );
      return {
        update: (landmark, timestamp = performance.now()) =>
          filter.update(landmark, timestamp),
        reset: () => filter.reset(),
      };
    }
    case 'none':
    default:
      return {
        update: (landmark) => landmark,
        reset: () => {},
      };
  }
}

/**
 * Smooth an entire pose (all landmarks)
 */
export class PoseSmoother {
  private smoothers: ReturnType<typeof createLandmarkSmoother>[];

  constructor(numLandmarks: number = 33, config: SmoothingConfig = { type: 'oneEuro' }) {
    this.smoothers = Array.from({ length: numLandmarks }, () =>
      createLandmarkSmoother(config)
    );
  }

  update(landmarks: Landmark3D[], timestamp?: number): Landmark3D[] {
    return landmarks.map((landmark, i) =>
      this.smoothers[i]?.update(landmark, timestamp) ?? landmark
    );
  }

  reset(): void {
    this.smoothers.forEach((s) => s.reset());
  }
}
