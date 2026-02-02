/**
 * MirrorX Zero-Cost Virtual Try-On Service
 *
 * This service provides virtual try-on capabilities using free, open-source models
 * deployed on Hugging Face Spaces or self-hosted infrastructure.
 *
 * Cost: $0 (compared to $0.02-0.05 per try-on with Gemini)
 *
 * Models used:
 * - OOTDiffusion (Apache 2.0) - Virtual try-on generation
 * - InsightFace (MIT) - Face detection and preservation
 * - Ollama + Llama 3.2 (Apache 2.0) - Style recommendations
 */

import axios, { AxiosError } from 'axios';

// ============================================
// Types
// ============================================

export interface ZeroCostTryOnRequest {
  personImage: string; // base64 encoded
  clothingImage: string; // base64 encoded
  category: 'upperbody' | 'lowerbody' | 'dress';
  preserveFace?: boolean;
  numSteps?: number;
  guidanceScale?: number;
}

export interface ZeroCostTryOnResponse {
  resultImage: string; // base64 encoded
  status: string;
  modelUsed: string;
  facePreserved: boolean;
  processingTimeMs: number;
}

export interface StyleRecommendation {
  itemAnalysis: {
    type: string;
    style: string;
    colors: string[];
    occasions: string[];
    material?: string;
  };
  stylingTips: string[];
  complementaryItems: Array<{
    type: string;
    style: string;
    colors: string[];
  }>;
  searchQueriesIndia: string[];
}

// ============================================
// Configuration
// ============================================

const config = {
  // Hugging Face Space endpoint (free tier)
  hfSpaceEndpoint:
    process.env.HF_SPACE_ENDPOINT || 'https://mirrorx-tryon.hf.space/api/predict',

  // Self-hosted endpoint (for production scale)
  selfHostedEndpoint: process.env.SELF_HOSTED_TRYON_ENDPOINT || null,

  // Ollama endpoint for style recommendations (free, local)
  ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',

  // Timeout in milliseconds
  timeout: 120000, // 2 minutes for try-on generation

  // Retry configuration
  maxRetries: 3,
  retryDelayMs: 2000,
};

// ============================================
// Zero-Cost Try-On Service
// ============================================

export class ZeroCostTryOnService {
  private endpoint: string;
  private ollamaEndpoint: string;

  constructor() {
    // Prefer self-hosted if available, otherwise use HF Space
    this.endpoint = config.selfHostedEndpoint || config.hfSpaceEndpoint;
    this.ollamaEndpoint = config.ollamaEndpoint;

    console.log(`[ZeroCostTryOn] Using endpoint: ${this.endpoint}`);
    console.log(`[ZeroCostTryOn] Ollama endpoint: ${this.ollamaEndpoint}`);
  }

  /**
   * Generate virtual try-on using open-source models.
   * Cost: $0
   */
  async generateTryOn(request: ZeroCostTryOnRequest): Promise<ZeroCostTryOnResponse> {
    const startTime = Date.now();

    const payload = {
      data: [
        request.personImage,
        request.clothingImage,
        request.category || 'upperbody',
        request.preserveFace ?? true,
        request.numSteps || 20,
        request.guidanceScale || 2.0,
      ],
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        console.log(
          `[ZeroCostTryOn] Attempt ${attempt}/${config.maxRetries} - Generating try-on...`
        );

        const response = await axios.post(this.endpoint, payload, {
          timeout: config.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        // Hugging Face Spaces returns data in a specific format
        const result = response.data;

        // Extract result image (format depends on Gradio version)
        let resultImage: string;
        let status: string;

        if (result.data && Array.isArray(result.data)) {
          // Gradio 4.x format
          resultImage = result.data[0];
          status = result.data[1] || 'Success';
        } else if (result.result) {
          // Alternative format
          resultImage = result.result;
          status = result.status || 'Success';
        } else {
          throw new Error('Unexpected response format from try-on service');
        }

        const processingTime = Date.now() - startTime;
        console.log(`[ZeroCostTryOn] Success in ${processingTime}ms`);

        return {
          resultImage,
          status,
          modelUsed: 'OOTDiffusion',
          facePreserved: request.preserveFace ?? true,
          processingTimeMs: processingTime,
        };
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;

        console.error(
          `[ZeroCostTryOn] Attempt ${attempt} failed:`,
          axiosError.message
        );

        // Don't retry on client errors (4xx)
        if (axiosError.response && axiosError.response.status < 500) {
          throw error;
        }

        // Wait before retrying
        if (attempt < config.maxRetries) {
          await this.sleep(config.retryDelayMs * attempt);
        }
      }
    }

    throw new Error(
      `Try-on generation failed after ${config.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Get style recommendations using local Ollama (Llama 3.2).
   * Cost: $0
   */
  async getStyleRecommendations(
    itemDescription: string
  ): Promise<StyleRecommendation> {
    const prompt = this.buildStylePrompt(itemDescription);

    try {
      const response = await axios.post(
        `${this.ollamaEndpoint}/api/chat`,
        {
          model: 'llama3.2:3b', // Free, runs locally
          messages: [
            {
              role: 'system',
              content: `You are a fashion stylist expert specializing in Indian fashion.
Analyze clothing items and provide styling recommendations.
Always respond in valid JSON format.
Focus on practical styling tips for the Indian market.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          format: 'json',
          stream: false,
        },
        {
          timeout: 30000, // 30 seconds for text generation
        }
      );

      const content = response.data.message.content;
      return JSON.parse(content) as StyleRecommendation;
    } catch (error) {
      console.error('[ZeroCostTryOn] Style recommendation failed:', error);

      // Return fallback recommendations
      return this.getFallbackRecommendations(itemDescription);
    }
  }

  /**
   * Check if the zero-cost service is available.
   */
  async healthCheck(): Promise<{
    available: boolean;
    endpoint: string;
    ollamaAvailable: boolean;
  }> {
    let available = false;
    let ollamaAvailable = false;

    // Check try-on endpoint
    try {
      const response = await axios.get(this.endpoint.replace('/api/predict', ''), {
        timeout: 5000,
      });
      available = response.status === 200;
    } catch {
      available = false;
    }

    // Check Ollama
    try {
      const response = await axios.get(`${this.ollamaEndpoint}/api/tags`, {
        timeout: 5000,
      });
      ollamaAvailable = response.status === 200;
    } catch {
      ollamaAvailable = false;
    }

    return {
      available,
      endpoint: this.endpoint,
      ollamaAvailable,
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  private buildStylePrompt(description: string): string {
    return `Analyze this clothing item and provide styling recommendations for the Indian fashion market.

Item: ${description}

Provide your response in this exact JSON format:
{
  "itemAnalysis": {
    "type": "shirt/pants/dress/kurta/saree/etc",
    "style": "casual/formal/ethnic/fusion/party/etc",
    "colors": ["primary color", "secondary color"],
    "occasions": ["work", "party", "casual", "festive", "wedding"],
    "material": "cotton/silk/polyester/etc"
  },
  "stylingTips": [
    "Tip 1 for styling this item",
    "Tip 2 for styling this item",
    "Tip 3 for styling this item",
    "Tip 4 for styling this item"
  ],
  "complementaryItems": [
    {"type": "pants/jeans", "style": "slim fit/regular", "colors": ["navy", "black"]},
    {"type": "shoes", "style": "loafers/sneakers", "colors": ["brown", "white"]},
    {"type": "accessories", "style": "watch/belt", "colors": ["silver", "brown"]}
  ],
  "searchQueriesIndia": [
    "search query 1 for Myntra",
    "search query 2 for Amazon India",
    "search query 3 for Ajio"
  ]
}`;
  }

  private getFallbackRecommendations(description: string): StyleRecommendation {
    // Basic fallback when Ollama is not available
    const lowerDesc = description.toLowerCase();

    let type = 'clothing';
    if (lowerDesc.includes('shirt')) type = 'shirt';
    else if (lowerDesc.includes('pant') || lowerDesc.includes('jean')) type = 'pants';
    else if (lowerDesc.includes('dress')) type = 'dress';
    else if (lowerDesc.includes('kurta')) type = 'kurta';

    return {
      itemAnalysis: {
        type,
        style: 'casual',
        colors: ['neutral'],
        occasions: ['casual', 'daily wear'],
      },
      stylingTips: [
        'Pair with neutral colored bottoms for a balanced look',
        'Add minimal accessories to complete the outfit',
        'Choose comfortable footwear for all-day wear',
        'Layer with a light jacket for cooler weather',
      ],
      complementaryItems: [
        { type: 'pants', style: 'slim fit', colors: ['navy', 'black', 'grey'] },
        { type: 'shoes', style: 'casual', colors: ['white', 'brown'] },
        { type: 'watch', style: 'minimal', colors: ['silver', 'gold'] },
      ],
      searchQueriesIndia: [
        `${type} styling ideas Myntra`,
        `${type} outfit combinations Amazon India`,
        `matching ${type} accessories Ajio`,
      ],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// Hybrid Service (Zero-Cost + Gemini Fallback)
// ============================================

/**
 * Hybrid service that tries zero-cost first, falls back to Gemini.
 * Useful during migration period.
 */
export class HybridTryOnService {
  private zeroCostService: ZeroCostTryOnService;
  private useZeroCostFirst: boolean;

  constructor(useZeroCostFirst = true) {
    this.zeroCostService = new ZeroCostTryOnService();
    this.useZeroCostFirst = useZeroCostFirst;
  }

  async generateTryOn(
    personImage: string,
    clothingImage: string,
    options: {
      category?: 'upperbody' | 'lowerbody' | 'dress';
      preserveFace?: boolean;
      forceGemini?: boolean;
    } = {}
  ): Promise<{
    resultImage: string;
    source: 'zero-cost' | 'gemini';
    cost: number;
  }> {
    // If forced to use Gemini, skip zero-cost
    if (options.forceGemini) {
      return this.useGeminiFallback(personImage, clothingImage, options);
    }

    // Try zero-cost first
    if (this.useZeroCostFirst) {
      try {
        const result = await this.zeroCostService.generateTryOn({
          personImage,
          clothingImage,
          category: options.category || 'upperbody',
          preserveFace: options.preserveFace,
        });

        return {
          resultImage: result.resultImage,
          source: 'zero-cost',
          cost: 0, // Free!
        };
      } catch (error) {
        console.warn('[HybridTryOn] Zero-cost failed, falling back to Gemini:', error);
        return this.useGeminiFallback(personImage, clothingImage, options);
      }
    }

    return this.useGeminiFallback(personImage, clothingImage, options);
  }

  private async useGeminiFallback(
    personImage: string,
    clothingImage: string,
    options: {
      category?: string;
      preserveFace?: boolean;
    }
  ): Promise<{
    resultImage: string;
    source: 'zero-cost' | 'gemini';
    cost: number;
  }> {
    // Import the existing Gemini service
    // This would call the existing gemini.ts service
    const { generateVirtualTryOn } = await import('./gemini');

    const result = await generateVirtualTryOn(
      personImage,
      clothingImage,
      'PART',
      'neutral'
    );

    return {
      resultImage: result.image,
      source: 'gemini',
      cost: 0.03, // Estimated Gemini cost
    };
  }
}

// ============================================
// Export singleton instance
// ============================================

export const zeroCostTryOn = new ZeroCostTryOnService();
export const hybridTryOn = new HybridTryOnService();
