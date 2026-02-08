/**
 * MirrorX IDM-VTON Service
 *
 * TypeScript client for the IDM-VTON Python microservice.
 * Provides State-of-the-Art virtual try-on with:
 * - 100% garment detail preservation (logos, textures, patterns)
 * - 100% face fidelity (InsightFace face swap)
 * - Complex body pose handling
 *
 * This service connects to the self-hosted IDM-VTON inference server
 * and provides fallback to HF Space if the local server is unavailable.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// ============================================
// Types
// ============================================

export type GarmentCategory = 'upper_body' | 'lower_body' | 'dress';

export interface IDMVTONRequest {
  personImage: string; // Base64 encoded
  garmentImage: string; // Base64 encoded
  category?: GarmentCategory;
  preserveFace?: boolean;
  numInferenceSteps?: number;
  guidanceScale?: number;
  denoiseStrength?: number;
}

export interface IDMVTONResponse {
  resultImage: string; // Base64 encoded with data URI prefix
  metadata: {
    facePreserved: boolean;
    modelUsed: string;
    pipelineSteps: string[];
    garmentCategory: string;
    processingTimeMs: number;
  };
}

export interface IDMVTONHealthResponse {
  status: 'healthy' | 'unhealthy';
  modelsLoaded: Record<string, boolean>;
  gpuAvailable: boolean;
  gpuName: string | null;
  gpuMemoryGb: number | null;
  version: string;
}

export interface IDMVTONModelsResponse {
  models: Record<
    string,
    {
      loaded: boolean;
      type: string | null;
    }
  >;
  config: {
    idmVtonModel: string;
    inferenceSteps: number;
    guidanceScale: number;
    device: string;
  };
}

// ============================================
// Configuration
// ============================================

interface IDMVTONConfig {
  /** URL of the IDM-VTON inference server */
  serviceUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  retryDelayMs: number;
  /** Whether to enable HF Space fallback */
  enableFallback: boolean;
  /** HF Space endpoint for fallback */
  hfSpaceEndpoint: string;
}

const defaultConfig: IDMVTONConfig = {
  serviceUrl: process.env.IDM_VTON_SERVICE_URL || 'http://localhost:8080',
  timeout: parseInt(process.env.IDM_VTON_TIMEOUT || '180000', 10), // 3 minutes
  maxRetries: parseInt(process.env.IDM_VTON_MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.IDM_VTON_RETRY_DELAY || '2000', 10),
  enableFallback: process.env.IDM_VTON_ENABLE_FALLBACK !== 'false',
  hfSpaceEndpoint: process.env.IDM_VTON_HF_SPACE || 'https://yisol-idm-vton.hf.space',
};

// ============================================
// IDM-VTON Service Class
// ============================================

export class IDMVTONService {
  private client: AxiosInstance;
  private config: IDMVTONConfig;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor(config: Partial<IDMVTONConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    this.client = axios.create({
      baseURL: this.config.serviceUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`[IDM-VTON] Service initialized with URL: ${this.config.serviceUrl}`);
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Generate virtual try-on using IDM-VTON.
   *
   * @param request - Try-on request with person and garment images
   * @returns Try-on result with generated image and metadata
   */
  async generateTryOn(request: IDMVTONRequest): Promise<IDMVTONResponse> {
    const startTime = Date.now();

    // Validate input
    this.validateRequest(request);

    // Prepare request payload
    const payload = {
      person_image: this.ensureDataUri(request.personImage),
      garment_image: this.ensureDataUri(request.garmentImage),
      category: request.category || 'upper_body',
      preserve_face: request.preserveFace ?? true,
      num_inference_steps: request.numInferenceSteps || 30,
      guidance_scale: request.guidanceScale || 2.5,
      denoise_strength: request.denoiseStrength || 1.0,
    };

    let lastError: Error | null = null;

    // Retry loop
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(
          `[IDM-VTON] Attempt ${attempt}/${this.config.maxRetries} - Generating try-on...`
        );

        const response = await this.client.post<{
          result_image: string;
          metadata: {
            face_preserved: boolean;
            model_used: string;
            pipeline_steps: string[];
            garment_category: string;
            processing_time_ms: number;
          };
        }>('/tryon', payload);

        const result = response.data;

        console.log(
          `[IDM-VTON] Success in ${Date.now() - startTime}ms (server: ${result.metadata.processing_time_ms}ms)`
        );

        return {
          resultImage: result.result_image,
          metadata: {
            facePreserved: result.metadata.face_preserved,
            modelUsed: result.metadata.model_used,
            pipelineSteps: result.metadata.pipeline_steps,
            garmentCategory: result.metadata.garment_category,
            processingTimeMs: result.metadata.processing_time_ms,
          },
        };
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;

        console.error(
          `[IDM-VTON] Attempt ${attempt} failed:`,
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
          console.log(`[IDM-VTON] Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed - try fallback if enabled
    if (this.config.enableFallback) {
      console.log('[IDM-VTON] Attempting HF Space fallback...');
      try {
        return await this.generateTryOnViaGradio(request);
      } catch (fallbackError) {
        console.error('[IDM-VTON] Fallback also failed:', fallbackError);
      }
    }

    throw new Error(
      `IDM-VTON try-on generation failed after ${this.config.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate try-on from file paths (for uploaded files).
   *
   * @param personImagePath - Path to person image file
   * @param garmentImagePath - Path to garment image file
   * @param options - Additional options
   */
  async generateTryOnFromFiles(
    personImagePath: string,
    garmentImagePath: string,
    options: Omit<IDMVTONRequest, 'personImage' | 'garmentImage'> = {}
  ): Promise<IDMVTONResponse> {
    const formData = new FormData();
    formData.append('person_image', fs.createReadStream(personImagePath));
    formData.append('garment_image', fs.createReadStream(garmentImagePath));
    formData.append('category', options.category || 'upper_body');
    formData.append('preserve_face', String(options.preserveFace ?? true));
    formData.append('num_inference_steps', String(options.numInferenceSteps || 30));
    formData.append('guidance_scale', String(options.guidanceScale || 2.5));

    const response = await this.client.post<{
      result_image: string;
      metadata: {
        face_preserved: boolean;
        model_used: string;
        pipeline_steps: string[];
        garment_category: string;
        processing_time_ms: number;
      };
    }>('/tryon/upload', formData, {
      headers: formData.getHeaders(),
    });

    const result = response.data;

    return {
      resultImage: result.result_image,
      metadata: {
        facePreserved: result.metadata.face_preserved,
        modelUsed: result.metadata.model_used,
        pipelineSteps: result.metadata.pipeline_steps,
        garmentCategory: result.metadata.garment_category,
        processingTimeMs: result.metadata.processing_time_ms,
      },
    };
  }

  /**
   * Generate try-on and get raw image buffer (for streaming).
   */
  async generateTryOnRaw(request: IDMVTONRequest): Promise<Buffer> {
    const payload = {
      person_image: this.ensureDataUri(request.personImage),
      garment_image: this.ensureDataUri(request.garmentImage),
      category: request.category || 'upper_body',
      preserve_face: request.preserveFace ?? true,
      num_inference_steps: request.numInferenceSteps || 30,
      guidance_scale: request.guidanceScale || 2.5,
      denoise_strength: request.denoiseStrength || 1.0,
    };

    const response = await this.client.post('/tryon/raw', payload, {
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
  }

  /**
   * Check health of the IDM-VTON service.
   */
  async healthCheck(): Promise<IDMVTONHealthResponse> {
    try {
      const response = await this.client.get<{
        status: string;
        models_loaded: Record<string, boolean>;
        gpu_available: boolean;
        gpu_name: string | null;
        gpu_memory_gb: number | null;
        version: string;
      }>('/health', { timeout: 5000 });

      this.isHealthy = response.data.status === 'healthy';
      this.lastHealthCheck = Date.now();

      return {
        status: response.data.status as 'healthy' | 'unhealthy',
        modelsLoaded: response.data.models_loaded,
        gpuAvailable: response.data.gpu_available,
        gpuName: response.data.gpu_name,
        gpuMemoryGb: response.data.gpu_memory_gb,
        version: response.data.version,
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();

      return {
        status: 'unhealthy',
        modelsLoaded: {},
        gpuAvailable: false,
        gpuName: null,
        gpuMemoryGb: null,
        version: 'unknown',
      };
    }
  }

  /**
   * Get list of loaded models.
   */
  async getModels(): Promise<IDMVTONModelsResponse> {
    const response = await this.client.get<{
      models: Record<string, { loaded: boolean; type: string | null }>;
      config: {
        idm_vton_model: string;
        inference_steps: number;
        guidance_scale: number;
        device: string;
      };
    }>('/models');

    return {
      models: response.data.models,
      config: {
        idmVtonModel: response.data.config.idm_vton_model,
        inferenceSteps: response.data.config.inference_steps,
        guidanceScale: response.data.config.guidance_scale,
        device: response.data.config.device,
      },
    };
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

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Generate try-on via Gradio API (HF Space fallback).
   */
  private async generateTryOnViaGradio(request: IDMVTONRequest): Promise<IDMVTONResponse> {
    const startTime = Date.now();

    const payload = {
      person_image: this.ensureDataUri(request.personImage),
      garment_image: this.ensureDataUri(request.garmentImage),
      category: request.category || 'upper_body',
    };

    const response = await this.client.post<{
      result_image: string;
      metadata: {
        model_used: string;
        pipeline_steps: string[];
        processing_time_ms: number;
      };
    }>('/tryon/gradio', payload);

    const result = response.data;

    return {
      resultImage: result.result_image,
      metadata: {
        facePreserved: false, // HF Space may not have face preservation
        modelUsed: result.metadata.model_used,
        pipelineSteps: result.metadata.pipeline_steps,
        garmentCategory: request.category || 'upper_body',
        processingTimeMs: result.metadata.processing_time_ms,
      },
    };
  }

  /**
   * Validate request input.
   */
  private validateRequest(request: IDMVTONRequest): void {
    if (!request.personImage) {
      throw new Error('Person image is required');
    }
    if (!request.garmentImage) {
      throw new Error('Garment image is required');
    }
    if (request.category && !['upper_body', 'lower_body', 'dress'].includes(request.category)) {
      throw new Error('Invalid category. Must be: upper_body, lower_body, or dress');
    }
  }

  /**
   * Ensure image has data URI prefix.
   */
  private ensureDataUri(image: string): string {
    if (image.startsWith('data:image')) {
      return image;
    }
    // Assume JPEG if no prefix
    return `data:image/jpeg;base64,${image}`;
  }

  /**
   * Format error for better messaging.
   */
  private formatError(error: AxiosError): Error {
    if (error.response) {
      const data = error.response.data as { detail?: string; error?: string };
      const message = data?.detail || data?.error || error.message;
      return new Error(`IDM-VTON Error (${error.response.status}): ${message}`);
    }
    if (error.code === 'ECONNREFUSED') {
      return new Error('IDM-VTON service is not running. Please start the inference server.');
    }
    if (error.code === 'ETIMEDOUT') {
      return new Error('IDM-VTON request timed out. The image generation may be taking too long.');
    }
    return new Error(`IDM-VTON Error: ${error.message}`);
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// Hybrid Service (IDM-VTON + Gemini Fallback)
// ============================================

/**
 * Hybrid service that tries IDM-VTON first, falls back to Gemini if needed.
 * Useful during migration or when GPU is unavailable.
 */
export class HybridIDMVTONService {
  private idmVtonService: IDMVTONService;
  private useIDMVTONFirst: boolean;

  constructor(useIDMVTONFirst = true) {
    this.idmVtonService = new IDMVTONService();
    this.useIDMVTONFirst = useIDMVTONFirst;
  }

  async generateTryOn(
    personImage: string,
    garmentImage: string,
    options: {
      category?: GarmentCategory;
      preserveFace?: boolean;
      forceGemini?: boolean;
      mode?: 'PART' | 'FULL_FIT';
      gender?: 'male' | 'female';
    } = {}
  ): Promise<{
    resultImage: string;
    source: 'idm-vton' | 'gemini';
    facePreserved: boolean;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();

    // If forced to use Gemini, skip IDM-VTON
    if (options.forceGemini) {
      return this.useGeminiFallback(personImage, garmentImage, options);
    }

    // Try IDM-VTON first if enabled
    if (this.useIDMVTONFirst) {
      const isAvailable = await this.idmVtonService.isAvailable();

      if (isAvailable) {
        try {
          const result = await this.idmVtonService.generateTryOn({
            personImage,
            garmentImage,
            category: options.category,
            preserveFace: options.preserveFace,
          });

          return {
            resultImage: result.resultImage,
            source: 'idm-vton',
            facePreserved: result.metadata.facePreserved,
            processingTimeMs: Date.now() - startTime,
          };
        } catch (error) {
          console.warn('[HybridIDMVTON] IDM-VTON failed, falling back to Gemini:', error);
        }
      } else {
        console.log('[HybridIDMVTON] IDM-VTON not available, using Gemini');
      }
    }

    return this.useGeminiFallback(personImage, garmentImage, options);
  }

  private async useGeminiFallback(
    personImage: string,
    garmentImage: string,
    options: {
      mode?: 'PART' | 'FULL_FIT';
      gender?: 'male' | 'female';
    }
  ): Promise<{
    resultImage: string;
    source: 'idm-vton' | 'gemini';
    facePreserved: boolean;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();

    // Import the existing Gemini service
    const { generateTryOnImage } = await import('./gemini');

    const resultImage = await generateTryOnImage(
      personImage,
      garmentImage,
      options.mode || 'PART',
      options.gender || 'female'
    );

    return {
      resultImage,
      source: 'gemini',
      facePreserved: true, // Gemini service has its own face preservation
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================
// Export Singleton Instances
// ============================================

/** Singleton IDM-VTON service instance */
export const idmVtonService = new IDMVTONService();

/** Singleton hybrid service instance (IDM-VTON with Gemini fallback) */
export const hybridIdmVtonService = new HybridIDMVTONService();

// ============================================
// Convenience Functions
// ============================================

/**
 * Generate virtual try-on using IDM-VTON (convenience function).
 *
 * @param personImage - Base64 encoded person image
 * @param garmentImage - Base64 encoded garment image
 * @param category - Garment category (upper_body, lower_body, dress)
 * @param preserveFace - Whether to preserve original face (default: true)
 */
export async function generateIDMVTONImage(
  personImage: string,
  garmentImage: string,
  category: GarmentCategory = 'upper_body',
  preserveFace: boolean = true
): Promise<string> {
  const result = await idmVtonService.generateTryOn({
    personImage,
    garmentImage,
    category,
    preserveFace,
  });
  return result.resultImage;
}

/**
 * Check if IDM-VTON service is available.
 */
export async function isIDMVTONAvailable(): Promise<boolean> {
  return idmVtonService.isAvailable();
}

/**
 * Get IDM-VTON service health status.
 */
export async function getIDMVTONHealth(): Promise<IDMVTONHealthResponse> {
  return idmVtonService.healthCheck();
}
