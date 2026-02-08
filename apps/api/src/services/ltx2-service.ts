/**
 * MirrorX LTX-2 360° Video Generation Service
 *
 * TypeScript client for the LTX-2 Python microservice.
 * Provides 360-degree rotation video generation from static images.
 *
 * Pipeline Flow:
 * 1. User Image + Garment → IDM-VTON → Static Try-On Image
 * 2. Static Try-On Image → LTX-2 → 360° Rotation Video
 *
 * This service orchestrates the full pipeline and provides:
 * - Async job submission with status polling
 * - Sync generation for quick results
 * - Integration with IDM-VTON service
 * - Automatic retry with exponential backoff
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import FormData from 'form-data';
import { idmVtonService, GarmentCategory } from './idm-vton-service';

// ============================================
// Types
// ============================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface LTX2GenerationOptions {
  /** Text prompt for video generation */
  prompt?: string;
  /** Negative prompt to avoid artifacts */
  negativePrompt?: string;
  /** Number of frames to generate (16-200) */
  numFrames?: number;
  /** Number of denoising steps (10-100) */
  numInferenceSteps?: number;
  /** Text guidance scale (1.0-20.0) */
  guidanceScale?: number;
  /** Image guidance scale for identity preservation (1.0-5.0) */
  imageGuidanceScale?: number;
  /** Output video width */
  width?: number;
  /** Output video height */
  height?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

export interface LTX2JobResponse {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  completedAt: string | null;
  progress: number;
  resultUrl: string | null;
  errorMessage: string | null;
  processingTimeMs: number | null;
  metadata: {
    outputPath?: string;
    numFrames?: number;
    resolution?: string;
  } | null;
}

export interface LTX2HealthResponse {
  status: 'healthy' | 'unhealthy';
  modelLoaded: boolean;
  loraLoaded: boolean;
  device: string;
  gpuAvailable: boolean;
  gpuName: string | null;
  gpuMemoryGb: number | null;
  version: string;
  concurrentJobs: number;
  maxConcurrentJobs: number;
}

export interface Full360TryOnOptions {
  /** Garment category for IDM-VTON */
  category?: GarmentCategory;
  /** Alias for category (for backwards compatibility) */
  garmentCategory?: GarmentCategory;
  /** Whether to preserve face in IDM-VTON */
  preserveFace?: boolean;
  /** LTX-2 generation options */
  videoOptions?: LTX2GenerationOptions;
  /** Direct prompt (convenience, merged into videoOptions) */
  prompt?: string;
}

export interface Full360TryOnResult {
  /** Job ID for status tracking */
  jobId: string;
  /** Current job status */
  status: JobStatus;
  /** URL to download the video when complete */
  videoUrl: string | null;
  /** The VTON result image (base64) */
  vtonResultImage: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Metadata about the generation */
  metadata: {
    vtonImageGenerated: boolean;
    vtonProcessingTimeMs: number;
    videoProcessingTimeMs: number | null;
    numFrames: number;
    resolution: string;
  };
}

// ============================================
// Configuration
// ============================================

export interface LTX2Config {
  /** URL of the LTX-2 inference server */
  serviceUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  retryDelayMs: number;
  /** Maximum time to wait for job completion (polling) */
  maxWaitTimeMs: number;
  /** Interval between status polls */
  pollIntervalMs: number;
}

// Alias for backwards compatibility
export type LTX2ServiceConfig = LTX2Config;

const defaultConfig: LTX2Config = {
  serviceUrl: process.env.LTX2_SERVICE_URL || process.env.LTX_SERVICE_URL || 'http://localhost:5001',
  timeout: parseInt(process.env.LTX2_TIMEOUT || process.env.LTX_TIMEOUT || '300000', 10), // 5 minutes
  maxRetries: parseInt(process.env.LTX2_MAX_RETRIES || process.env.LTX_MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.LTX2_RETRY_DELAY || process.env.LTX_RETRY_DELAY || '2000', 10),
  maxWaitTimeMs: parseInt(process.env.LTX2_MAX_WAIT_TIME || process.env.LTX_MAX_WAIT_TIME || '600000', 10), // 10 minutes
  pollIntervalMs: parseInt(process.env.LTX2_POLL_INTERVAL || process.env.LTX_POLL_INTERVAL || '5000', 10), // 5 seconds
};

// Check if using Modal deployment (URL contains .modal.run)
const isModalDeployment = (): boolean => {
  const url = process.env.LTX2_SERVICE_URL || process.env.LTX_SERVICE_URL || '';
  return url.includes('.modal.run');
};

// Default generation options
const defaultGenerationOptions: LTX2GenerationOptions = {
  prompt:
    'a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, white background, high quality, 4k',
  negativePrompt:
    'morphing, dissolving, extra limbs, bad anatomy, blurry, static, jerky motion, distorted face, multiple people',
  numFrames: 80,
  numInferenceSteps: 40,
  guidanceScale: 3.0,
  imageGuidanceScale: 1.8,
  width: 512,
  height: 512,
};

// ============================================
// LTX-2 Service Class
// ============================================

export class LTX2Service {
  private client: AxiosInstance;
  private config: LTX2Config;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor(config: Partial<LTX2Config> = {}) {
    this.config = { ...defaultConfig, ...config };

    this.client = axios.create({
      baseURL: this.config.serviceUrl,
      timeout: this.config.timeout,
    });

    console.log(`[LTX-2] Service initialized with URL: ${this.config.serviceUrl}`);
  }

  // ============================================
  // Public Methods - Video Generation
  // ============================================

  /**
   * Submit a 360-degree video generation job from an image (base64 or buffer).
   * Supports both self-hosted and Modal deployment formats.
   *
   * @param imageInput - Input image as base64 string or Buffer
   * @param options - Generation options
   * @returns Job response with ID for status tracking
   */
  async submitJob(
    imageInput: Buffer | string,
    options: LTX2GenerationOptions = {}
  ): Promise<LTX2JobResponse> {
    // Handle Modal deployment (synchronous, JSON-based)
    if (isModalDeployment()) {
      return this.submitJobModal(imageInput, options);
    }

    // Self-hosted deployment (async, FormData-based)
    const imageBuffer = typeof imageInput === 'string'
      ? Buffer.from(imageInput.includes(',') ? imageInput.split(',')[1] : imageInput, 'base64')
      : imageInput;
    const mergedOptions = { ...defaultGenerationOptions, ...options };

    const formData = new FormData();
    formData.append('image', imageBuffer, { filename: 'input.png', contentType: 'image/png' });
    formData.append('prompt', mergedOptions.prompt || '');
    formData.append('negative_prompt', mergedOptions.negativePrompt || '');
    formData.append('num_frames', String(mergedOptions.numFrames || 80));
    formData.append('num_inference_steps', String(mergedOptions.numInferenceSteps || 40));
    formData.append('guidance_scale', String(mergedOptions.guidanceScale || 3.0));
    formData.append('image_guidance_scale', String(mergedOptions.imageGuidanceScale || 1.8));
    formData.append('width', String(mergedOptions.width || 512));
    formData.append('height', String(mergedOptions.height || 512));

    if (mergedOptions.seed !== undefined) {
      formData.append('seed', String(mergedOptions.seed));
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[LTX-2] Attempt ${attempt}/${this.config.maxRetries} - Submitting job...`);

        const response = await this.client.post<{
          job_id: string;
          status: string;
          created_at: string;
          completed_at: string | null;
          progress: number;
          result_url: string | null;
          error_message: string | null;
          processing_time_ms: number | null;
          metadata: Record<string, unknown> | null;
        }>('/generate-360', formData, {
          headers: formData.getHeaders(),
        });

        console.log(`[LTX-2] Job submitted: ${response.data.job_id}`);

        return this.transformJobResponse(response.data);
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;

        console.error(
          `[LTX-2] Attempt ${attempt} failed:`,
          axiosError.message,
          axiosError.response?.status
        );

        // Don't retry on client errors (4xx)
        if (axiosError.response && axiosError.response.status < 500) {
          throw this.formatError(axiosError);
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          console.log(`[LTX-2] Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `LTX-2 job submission failed after ${this.config.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Get the status of a video generation job.
   *
   * @param jobId - Job ID from submitJob
   * @returns Current job status
   */
  async getJobStatus(jobId: string): Promise<LTX2JobResponse> {
    const response = await this.client.get<{
      job_id: string;
      status: string;
      created_at: string;
      completed_at: string | null;
      progress: number;
      result_url: string | null;
      error_message: string | null;
      processing_time_ms: number | null;
      metadata: Record<string, unknown> | null;
    }>(`/job/${jobId}`);

    return this.transformJobResponse(response.data);
  }

  /**
   * Wait for a job to complete (polls until done or timeout).
   *
   * @param jobId - Job ID from submitJob
   * @param maxWaitMs - Maximum time to wait (default: config.maxWaitTimeMs)
   * @returns Final job status
   */
  async waitForCompletion(
    jobId: string,
    maxWaitMs: number = this.config.maxWaitTimeMs
  ): Promise<LTX2JobResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getJobStatus(jobId);

      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      console.log(
        `[LTX-2] Job ${jobId} status: ${status.status} (${Math.round(status.progress * 100)}%)`
      );

      await this.sleep(this.config.pollIntervalMs);
    }

    throw new Error(`LTX-2 job ${jobId} timed out after ${maxWaitMs}ms`);
  }

  /**
   * Download the generated video for a completed job.
   *
   * @param jobId - Job ID of a completed job
   * @returns Video buffer (MP4)
   */
  async downloadVideo(jobId: string): Promise<Buffer> {
    // Check if this is a Modal job (stored in cache)
    if (jobId.startsWith('modal-') && this.modalVideoCache.has(jobId)) {
      const videoBase64 = this.modalVideoCache.get(jobId)!;
      // Remove data URI prefix if present
      const base64Data = videoBase64.includes(',') ? videoBase64.split(',')[1] : videoBase64;
      // Optionally delete from cache after download
      this.modalVideoCache.delete(jobId);
      return Buffer.from(base64Data, 'base64');
    }

    // Self-hosted: fetch from server
    const response = await this.client.get(`/download/${jobId}`, {
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
  }

  /**
   * Generate video synchronously (blocks until complete).
   *
   * @param imageBuffer - Input image buffer
   * @param options - Generation options
   * @returns Video buffer (MP4)
   */
  async generateSync(
    imageBuffer: Buffer,
    options: LTX2GenerationOptions = {}
  ): Promise<Buffer> {
    const mergedOptions = { ...defaultGenerationOptions, ...options };

    const formData = new FormData();
    formData.append('image', imageBuffer, { filename: 'input.png', contentType: 'image/png' });
    formData.append('prompt', mergedOptions.prompt || '');
    formData.append('negative_prompt', mergedOptions.negativePrompt || '');
    formData.append('num_frames', String(mergedOptions.numFrames || 80));
    formData.append('num_inference_steps', String(mergedOptions.numInferenceSteps || 40));
    formData.append('guidance_scale', String(mergedOptions.guidanceScale || 3.0));
    formData.append('image_guidance_scale', String(mergedOptions.imageGuidanceScale || 1.8));
    formData.append('width', String(mergedOptions.width || 512));
    formData.append('height', String(mergedOptions.height || 512));

    if (mergedOptions.seed !== undefined) {
      formData.append('seed', String(mergedOptions.seed));
    }

    const response = await this.client.post('/generate-360/sync', formData, {
      headers: formData.getHeaders(),
      responseType: 'arraybuffer',
      timeout: this.config.timeout,
    });

    return Buffer.from(response.data);
  }

  // ============================================
  // Public Methods - Full Pipeline
  // ============================================

  /**
   * Full Pipeline: User Image + Garment → Static VTON → 360° Video
   *
   * This method orchestrates the complete try-on to video pipeline:
   * 1. Calls IDM-VTON to generate the static try-on image
   * 2. Submits the result to LTX-2 for 360° video generation
   *
   * @param userImageInput - User/model photo (Buffer or base64 string)
   * @param garmentImageInput - Garment image (Buffer or base64 string)
   * @param options - Pipeline options
   * @returns Job response with video URL and VTON image
   */
  async generate360TryOn(
    userImageInput: Buffer | string,
    garmentImageInput: Buffer | string,
    options: Full360TryOnOptions = {}
  ): Promise<Full360TryOnResult> {
    const startTime = Date.now();

    console.log('[LTX-2] Starting full 360° try-on pipeline...');

    // Convert inputs to base64 strings (IDM-VTON expects base64)
    const userImageBase64 = typeof userImageInput === 'string'
      ? userImageInput
      : userImageInput.toString('base64');
    const garmentImageBase64 = typeof garmentImageInput === 'string'
      ? garmentImageInput
      : garmentImageInput.toString('base64');

    // Use garmentCategory as fallback for category
    const category = options.category || options.garmentCategory || 'upper_body';

    // Step 1: Generate static VTON image
    console.log('[LTX-2] Step 1: Generating static VTON image...');

    const vtonStartTime = Date.now();

    const vtonResult = await idmVtonService.generateTryOn({
      personImage: userImageBase64,
      garmentImage: garmentImageBase64,
      category,
      preserveFace: options.preserveFace ?? true,
    });

    const vtonProcessingTime = Date.now() - vtonStartTime;
    console.log(`[LTX-2] VTON complete in ${vtonProcessingTime}ms`);

    // Store the VTON result image for the response
    const vtonResultImage = vtonResult.resultImage;

    // Extract base64 image data (remove data URI prefix if present)
    let vtonImageBase64 = vtonResultImage;
    if (vtonImageBase64.startsWith('data:')) {
      vtonImageBase64 = vtonImageBase64.split(',')[1];
    }

    const vtonImageBuffer = Buffer.from(vtonImageBase64, 'base64');

    // Step 2: Submit to LTX-2 for video generation
    console.log('[LTX-2] Step 2: Submitting to video generation...');

    // Merge prompt into videoOptions if provided directly
    const videoOptions: LTX2GenerationOptions = {
      ...options.videoOptions,
      ...(options.prompt && { prompt: options.prompt }),
    };
    const job = await this.submitJob(vtonImageBuffer, videoOptions);

    return {
      jobId: job.jobId,
      status: job.status,
      videoUrl: job.resultUrl ? `${this.config.serviceUrl}${job.resultUrl}` : null,
      vtonResultImage,
      processingTimeMs: Date.now() - startTime,
      metadata: {
        vtonImageGenerated: true,
        vtonProcessingTimeMs: vtonProcessingTime,
        videoProcessingTimeMs: null,
        numFrames: videoOptions.numFrames || 80,
        resolution: `${videoOptions.width || 512}x${videoOptions.height || 512}`,
      },
    };
  }

  /**
   * Full Pipeline with waiting: Returns video buffer when complete.
   *
   * @param userImageInput - User/model photo (Buffer or base64 string)
   * @param garmentImageInput - Garment image (Buffer or base64 string)
   * @param options - Pipeline options
   * @returns Video buffer (MP4)
   */
  async generate360TryOnSync(
    userImageInput: Buffer | string,
    garmentImageInput: Buffer | string,
    options: Full360TryOnOptions = {}
  ): Promise<Buffer> {
    const result = await this.generate360TryOn(userImageInput, garmentImageInput, options);

    // Wait for completion
    const finalStatus = await this.waitForCompletion(result.jobId);

    if (finalStatus.status === 'failed') {
      throw new Error(`Video generation failed: ${finalStatus.errorMessage}`);
    }

    // Download video
    return this.downloadVideo(result.jobId);
  }

  // ============================================
  // Public Methods - Health & Status
  // ============================================

  /**
   * Check health of the LTX-2 service.
   */
  async healthCheck(): Promise<LTX2HealthResponse> {
    try {
      const response = await this.client.get<{
        status: string;
        model_loaded: boolean;
        lora_loaded: boolean;
        device: string;
        gpu_available: boolean;
        gpu_name: string | null;
        gpu_memory_gb: number | null;
        version: string;
        concurrent_jobs: number;
        max_concurrent_jobs: number;
      }>('/health', { timeout: 5000 });

      this.isHealthy = response.data.status === 'healthy';
      this.lastHealthCheck = Date.now();

      return {
        status: response.data.status as 'healthy' | 'unhealthy',
        modelLoaded: response.data.model_loaded,
        loraLoaded: response.data.lora_loaded,
        device: response.data.device,
        gpuAvailable: response.data.gpu_available,
        gpuName: response.data.gpu_name,
        gpuMemoryGb: response.data.gpu_memory_gb,
        version: response.data.version,
        concurrentJobs: response.data.concurrent_jobs,
        maxConcurrentJobs: response.data.max_concurrent_jobs,
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();

      return {
        status: 'unhealthy',
        modelLoaded: false,
        loraLoaded: false,
        device: 'unknown',
        gpuAvailable: false,
        gpuName: null,
        gpuMemoryGb: null,
        version: 'unknown',
        concurrentJobs: 0,
        maxConcurrentJobs: 0,
      };
    }
  }

  /**
   * Check if the service is available (cached health check).
   */
  async isAvailable(): Promise<boolean> {
    // Use cached result if recent
    if (Date.now() - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isHealthy;
    }

    const health = await this.healthCheck();
    return health.status === 'healthy';
  }

  /**
   * List all jobs (optionally filtered by status).
   */
  async listJobs(status?: JobStatus, limit: number = 50): Promise<LTX2JobResponse[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', String(limit));

    const response = await this.client.get<
      Array<{
        job_id: string;
        status: string;
        created_at: string;
        completed_at: string | null;
        progress: number;
        result_url: string | null;
        error_message: string | null;
        processing_time_ms: number | null;
        metadata: Record<string, unknown> | null;
      }>
    >(`/jobs?${params.toString()}`);

    return response.data.map((job) => this.transformJobResponse(job));
  }

  /**
   * Delete a job and its generated video.
   */
  async deleteJob(jobId: string): Promise<void> {
    await this.client.delete(`/job/${jobId}`);
    console.log(`[LTX-2] Job ${jobId} deleted`);
  }

  /**
   * Submit job to Modal deployment (synchronous, returns video directly).
   */
  private async submitJobModal(
    imageInput: Buffer | string,
    options: LTX2GenerationOptions = {}
  ): Promise<LTX2JobResponse> {
    const mergedOptions = { ...defaultGenerationOptions, ...options };
    const jobId = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Convert to base64 if buffer
    let imageBase64: string;
    if (typeof imageInput === 'string') {
      imageBase64 = imageInput.includes(',') ? imageInput : `data:image/jpeg;base64,${imageInput}`;
    } else {
      imageBase64 = `data:image/jpeg;base64,${imageInput.toString('base64')}`;
    }

    console.log(`[LTX-2/Modal] Submitting job ${jobId}...`);

    try {
      const response = await this.client.post<{
        video_base64?: string;
        status: string;
        error?: string;
        metadata?: {
          num_frames?: number;
          resolution?: string;
          processing_time_ms?: number;
        };
      }>('', {
        image_base64: imageBase64,
        prompt: mergedOptions.prompt,
        negative_prompt: mergedOptions.negativePrompt,
        num_frames: mergedOptions.numFrames,
        num_inference_steps: mergedOptions.numInferenceSteps,
        guidance_scale: mergedOptions.guidanceScale,
        width: mergedOptions.width,
        height: mergedOptions.height,
        seed: mergedOptions.seed,
      }, {
        timeout: this.config.timeout,
      });

      if (response.data.status === 'completed' && response.data.video_base64) {
        // Store video in memory for download (in production, use Redis or S3)
        this.modalVideoCache.set(jobId, response.data.video_base64);

        return {
          jobId,
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          progress: 1,
          resultUrl: `/download/${jobId}`,
          errorMessage: null,
          processingTimeMs: response.data.metadata?.processing_time_ms || null,
          metadata: {
            numFrames: response.data.metadata?.num_frames,
            resolution: response.data.metadata?.resolution,
          },
        };
      } else {
        return {
          jobId,
          status: 'failed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          progress: 0,
          resultUrl: null,
          errorMessage: response.data.error || 'Unknown error',
          processingTimeMs: null,
          metadata: null,
        };
      }
    } catch (error) {
      const err = error as Error;
      console.error('[LTX-2/Modal] Generation failed:', err.message);

      return {
        jobId,
        status: 'failed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        progress: 0,
        resultUrl: null,
        errorMessage: err.message,
        processingTimeMs: null,
        metadata: null,
      };
    }
  }

  // Cache for Modal video results (in production, use Redis)
  private modalVideoCache: Map<string, string> = new Map();

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Transform snake_case API response to camelCase.
   */
  private transformJobResponse(data: {
    job_id: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    progress: number;
    result_url: string | null;
    error_message: string | null;
    processing_time_ms: number | null;
    metadata: Record<string, unknown> | null;
  }): LTX2JobResponse {
    return {
      jobId: data.job_id,
      status: data.status as JobStatus,
      createdAt: data.created_at,
      completedAt: data.completed_at,
      progress: data.progress,
      resultUrl: data.result_url,
      errorMessage: data.error_message,
      processingTimeMs: data.processing_time_ms,
      metadata: data.metadata as LTX2JobResponse['metadata'],
    };
  }

  /**
   * Format error for better messaging.
   */
  private formatError(error: AxiosError): Error {
    if (error.response) {
      const data = error.response.data as { detail?: string; error?: string };
      const message = data?.detail || data?.error || error.message;
      return new Error(`LTX-2 Error (${error.response.status}): ${message}`);
    }
    if (error.code === 'ECONNREFUSED') {
      return new Error('LTX-2 service is not running. Please start the inference server.');
    }
    if (error.code === 'ETIMEDOUT') {
      return new Error('LTX-2 request timed out. Video generation may be taking too long.');
    }
    return new Error(`LTX-2 Error: ${error.message}`);
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// Export Singleton Instance
// ============================================

/** Singleton LTX-2 service instance */
export const ltx2Service = new LTX2Service();

// ============================================
// Convenience Functions
// ============================================

/**
 * Generate 360° try-on video from user and garment images.
 *
 * @param userImage - Base64 encoded user photo
 * @param garmentImage - Base64 encoded garment image
 * @param category - Garment category (upper_body, lower_body, dress)
 * @returns Job response with video URL
 */
export async function generate360TryOn(
  userImage: string,
  garmentImage: string,
  category: GarmentCategory = 'upper_body'
): Promise<Full360TryOnResult> {
  const userBuffer = Buffer.from(
    userImage.startsWith('data:') ? userImage.split(',')[1] : userImage,
    'base64'
  );
  const garmentBuffer = Buffer.from(
    garmentImage.startsWith('data:') ? garmentImage.split(',')[1] : garmentImage,
    'base64'
  );

  return ltx2Service.generate360TryOn(userBuffer, garmentBuffer, { category });
}

/**
 * Check if LTX-2 service is available.
 */
export async function isLTX2Available(): Promise<boolean> {
  return ltx2Service.isAvailable();
}

/**
 * Get LTX-2 service health status.
 */
export async function getLTX2Health(): Promise<LTX2HealthResponse> {
  return ltx2Service.healthCheck();
}

/**
 * Get status of a video generation job.
 */
export async function getVideoJobStatus(jobId: string): Promise<LTX2JobResponse> {
  return ltx2Service.getJobStatus(jobId);
}

/**
 * Download generated video for a job.
 */
export async function downloadGeneratedVideo(jobId: string): Promise<Buffer> {
  return ltx2Service.downloadVideo(jobId);
}
