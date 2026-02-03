/**
 * @fileoverview Video recording and sharing for 3D Mirror try-on sessions
 * Phase 2: Records canvas/video to MP4/WebM with watermarking and sharing
 */

/**
 * Recording options
 */
export interface RecordingOptions {
  /** Video format (webm is more widely supported) */
  format: 'webm' | 'mp4';
  /** Video quality (bits per second) */
  videoBitsPerSecond: number;
  /** Frame rate */
  frameRate: number;
  /** Whether to include audio from microphone */
  includeAudio: boolean;
  /** Maximum recording duration in seconds */
  maxDuration: number;
  /** Whether to add watermark */
  addWatermark: boolean;
  /** Watermark text */
  watermarkText: string;
  /** Watermark position */
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const DEFAULT_OPTIONS: RecordingOptions = {
  format: 'webm',
  videoBitsPerSecond: 4000000, // 4 Mbps
  frameRate: 30,
  includeAudio: false,
  maxDuration: 60, // 1 minute max
  addWatermark: true,
  watermarkText: 'MirrorX',
  watermarkPosition: 'bottom-right',
};

/**
 * Recording result
 */
export interface RecordingResult {
  /** Blob containing the video data */
  blob: Blob;
  /** Object URL for playback */
  url: string;
  /** Duration in seconds */
  duration: number;
  /** Format */
  format: string;
  /** File size in bytes */
  size: number;
  /** Thumbnail data URL */
  thumbnail: string;
}

/**
 * Recording state
 */
type RecordingState = 'idle' | 'recording' | 'paused' | 'processing';

/**
 * Video recorder for 3D mirror sessions
 */
export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private options: RecordingOptions;
  private state: RecordingState = 'idle';
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  private maxDurationTimeout: number | null = null;

  // Watermark canvas
  private watermarkCanvas: HTMLCanvasElement | null = null;
  private watermarkCtx: CanvasRenderingContext2D | null = null;

  // Callbacks
  private onStateChange?: (state: RecordingState) => void;
  private onProgress?: (duration: number) => void;
  private onComplete?: (result: RecordingResult) => void;
  private onError?: (error: Error) => void;

  constructor(options: Partial<RecordingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start recording from a canvas element
   */
  async startRecording(canvas: HTMLCanvasElement): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error('Recording already in progress');
    }

    try {
      // Setup watermark canvas if needed
      if (this.options.addWatermark) {
        this.setupWatermarkCanvas(canvas.width, canvas.height);
      }

      // Create composite stream
      this.stream = await this.createStream(canvas);

      // Determine MIME type
      const mimeType = this.getMimeType();
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`MIME type ${mimeType} not supported`);
      }

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: this.options.videoBitsPerSecond,
      });

      this.recordedChunks = [];

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Handle stop
      this.mediaRecorder.onstop = () => {
        this.processRecording();
      };

      // Handle error
      this.mediaRecorder.onerror = (event) => {
        const error = new Error(`Recording error: ${(event as any).error?.message || 'Unknown'}`);
        this.onError?.(error);
        this.cleanup();
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.startTime = Date.now();
      this.pausedDuration = 0;
      this.setState('recording');

      // Setup max duration timeout
      if (this.options.maxDuration > 0) {
        this.maxDurationTimeout = window.setTimeout(() => {
          this.stopRecording();
        }, this.options.maxDuration * 1000);
      }

      // Start progress updates
      this.startProgressUpdates();

      console.log('[VideoRecorder] Recording started');
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    if (this.state !== 'recording' && this.state !== 'paused') {
      return;
    }

    this.setState('processing');

    if (this.maxDurationTimeout) {
      clearTimeout(this.maxDurationTimeout);
      this.maxDurationTimeout = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.state !== 'recording') return;

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();
      this.setState('paused');
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.state !== 'paused') return;

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.mediaRecorder.resume();
      this.setState('recording');
    }
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get current recording duration in seconds
   */
  getDuration(): number {
    if (this.state === 'idle') return 0;
    const elapsed = Date.now() - this.startTime - this.pausedDuration;
    return Math.floor(elapsed / 1000);
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: {
    onStateChange?: (state: RecordingState) => void;
    onProgress?: (duration: number) => void;
    onComplete?: (result: RecordingResult) => void;
    onError?: (error: Error) => void;
  }): void {
    this.onStateChange = callbacks.onStateChange;
    this.onProgress = callbacks.onProgress;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;
  }

  /**
   * Create video stream from canvas
   */
  private async createStream(canvas: HTMLCanvasElement): Promise<MediaStream> {
    // Get canvas stream
    const canvasStream = canvas.captureStream(this.options.frameRate);
    const videoTrack = canvasStream.getVideoTracks()[0];

    // Create composite stream with watermark if needed
    if (this.options.addWatermark && this.watermarkCanvas) {
      return this.createWatermarkedStream(canvas, videoTrack);
    }

    // Add audio if requested
    if (this.options.includeAudio) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        return new MediaStream([videoTrack, audioTrack]);
      } catch (error) {
        console.warn('[VideoRecorder] Could not capture audio:', error);
      }
    }

    return canvasStream;
  }

  /**
   * Create stream with watermark overlay
   */
  private createWatermarkedStream(
    sourceCanvas: HTMLCanvasElement,
    _videoTrack: MediaStreamTrack
  ): MediaStream {
    const watermarkCanvas = this.watermarkCanvas!;
    const ctx = this.watermarkCtx!;

    // Animation loop to composite watermark
    let animationId: number;
    const drawFrame = () => {
      // Draw source canvas
      ctx.drawImage(sourceCanvas, 0, 0);

      // Draw watermark
      this.drawWatermark(ctx, watermarkCanvas.width, watermarkCanvas.height);

      animationId = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    // Return watermarked canvas stream
    const stream = watermarkCanvas.captureStream(this.options.frameRate);

    // Cleanup animation on track end
    const track = stream.getVideoTracks()[0];
    track.addEventListener('ended', () => {
      cancelAnimationFrame(animationId);
    });

    return stream;
  }

  /**
   * Setup watermark canvas
   */
  private setupWatermarkCanvas(width: number, height: number): void {
    this.watermarkCanvas = document.createElement('canvas');
    this.watermarkCanvas.width = width;
    this.watermarkCanvas.height = height;
    this.watermarkCtx = this.watermarkCanvas.getContext('2d')!;
  }

  /**
   * Draw watermark on canvas
   */
  private drawWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const { watermarkText, watermarkPosition } = this.options;
    const padding = 20;
    const fontSize = Math.max(16, width * 0.025);

    ctx.save();

    // Text style
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;

    const textMetrics = ctx.measureText(watermarkText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    // Calculate position
    let x: number, y: number;
    switch (watermarkPosition) {
      case 'top-left':
        x = padding;
        y = padding + textHeight;
        break;
      case 'top-right':
        x = width - textWidth - padding;
        y = padding + textHeight;
        break;
      case 'bottom-left':
        x = padding;
        y = height - padding;
        break;
      case 'bottom-right':
      default:
        x = width - textWidth - padding;
        y = height - padding;
        break;
    }

    // Draw text with outline
    ctx.strokeText(watermarkText, x, y);
    ctx.fillText(watermarkText, x, y);

    ctx.restore();
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(): string {
    switch (this.options.format) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
      default:
        return 'video/webm;codecs=vp9';
    }
  }

  /**
   * Process recorded chunks into result
   */
  private async processRecording(): Promise<void> {
    try {
      const mimeType = this.getMimeType();
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const duration = this.getDuration();

      // Generate thumbnail
      const thumbnail = await this.generateThumbnail(blob);

      const result: RecordingResult = {
        blob,
        url,
        duration,
        format: this.options.format,
        size: blob.size,
        thumbnail,
      };

      this.onComplete?.(result);
      console.log(`[VideoRecorder] Recording complete: ${duration}s, ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.cleanup();
    }
  }

  /**
   * Generate thumbnail from video blob
   */
  private async generateThumbnail(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(blob);
      video.muted = true;

      video.onloadeddata = () => {
        // Seek to 1 second or start
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(320, video.videoWidth);
        canvas.height = Math.min(240, video.videoHeight);

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(video.src);
        resolve(thumbnail);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(''); // Return empty on error
      };

      video.load();
    });
  }

  /**
   * Start progress updates
   */
  private startProgressUpdates(): void {
    const updateProgress = () => {
      if (this.state === 'recording') {
        this.onProgress?.(this.getDuration());
        requestAnimationFrame(updateProgress);
      }
    };
    updateProgress();
  }

  /**
   * Set state and notify
   */
  private setState(state: RecordingState): void {
    this.state = state;
    this.onStateChange?.(state);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.watermarkCanvas = null;
    this.watermarkCtx = null;
    this.setState('idle');
  }

  /**
   * Dispose recorder
   */
  dispose(): void {
    this.stopRecording();
    this.cleanup();
  }
}

/**
 * Download a recording result
 */
export function downloadRecording(result: RecordingResult, filename?: string): void {
  const name = filename || `mirrorx-tryon-${Date.now()}.${result.format}`;
  const a = document.createElement('a');
  a.href = result.url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Share recording using Web Share API
 */
export async function shareRecording(
  result: RecordingResult,
  shareData: { title?: string; text?: string } = {}
): Promise<boolean> {
  if (!navigator.share || !navigator.canShare) {
    console.warn('[VideoRecorder] Web Share API not supported');
    return false;
  }

  const file = new File(
    [result.blob],
    `mirrorx-tryon.${result.format}`,
    { type: result.blob.type }
  );

  const data: ShareData = {
    title: shareData.title || 'MirrorX Try-On',
    text: shareData.text || 'Check out my virtual try-on!',
    files: [file],
  };

  if (!navigator.canShare(data)) {
    console.warn('[VideoRecorder] Cannot share this content');
    return false;
  }

  try {
    await navigator.share(data);
    return true;
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('[VideoRecorder] Share failed:', error);
    }
    return false;
  }
}

/**
 * Generate GIF from video recording (simplified)
 */
export async function generateGif(
  result: RecordingResult,
  options: { width?: number; frameRate?: number; duration?: number } = {}
): Promise<string> {
  // This is a placeholder - full GIF generation would require a library like gif.js
  // For now, return the thumbnail as a fallback
  console.warn('[VideoRecorder] GIF generation requires gif.js library - returning thumbnail');
  return result.thumbnail;
}
