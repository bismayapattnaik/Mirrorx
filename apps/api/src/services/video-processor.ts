/**
 * @fileoverview Video Processor Service for Live Virtual Try-On
 *
 * Uses Decart AI's lucy-pro-v2v model for real-time video transformation.
 * Supports chunk-based streaming for low-latency live try-on experience.
 */

const DECART_API_BASE = 'https://api.decart.ai/v1';
const API_KEY = process.env.DECART_API_KEY || '';

export interface VideoChunkResult {
    chunkId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    videoBuffer?: Buffer;
    processingTimeMs?: number;
}

export interface LiveStreamConfig {
    chunkDurationMs: number; // Recommended: 1000-2000ms
    resolution: '720p' | '1080p';
    model: 'lucy-pro-v2v' | 'lucy-fast-v2v';
}

const DEFAULT_CONFIG: LiveStreamConfig = {
    chunkDurationMs: 1500,
    resolution: '720p',
    model: 'lucy-pro-v2v',
};

/**
 * Transforms a video chunk with clothing try-on
 * Optimized for real-time streaming with MediaRecorder chunks
 */
export async function transformVideoChunk(
    videoChunk: Buffer,
    clothingPrompt: string,
    options?: Partial<LiveStreamConfig>
): Promise<VideoChunkResult> {
    const startTime = Date.now();
    const config = { ...DEFAULT_CONFIG, ...options };
    const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`[VideoProcessor] Processing chunk ${chunkId}...`);

    try {
        const formData = new FormData();
        formData.append('data', new Blob([videoChunk], { type: 'video/webm' }), 'chunk.webm');
        formData.append('prompt', `${clothingPrompt}, high-quality fashion, realistic textures, maintain person identity`);
        formData.append('enhance_prompt', 'true');

        const response = await fetch(`${DECART_API_BASE}/jobs/${config.model}`, {
            method: 'POST',
            headers: {
                'X-API-KEY': API_KEY,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Decart API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json() as { job_id: string };

        // Poll for completion (short timeout for live streaming)
        const processedVideo = await pollVideoJob(result.job_id, 30000); // 30s max for chunks

        console.log(`[VideoProcessor] Chunk ${chunkId} completed in ${Date.now() - startTime}ms`);

        return {
            chunkId,
            status: 'completed',
            videoBuffer: processedVideo,
            processingTimeMs: Date.now() - startTime,
        };
    } catch (error) {
        console.error(`[VideoProcessor] Chunk ${chunkId} failed:`, error);
        return {
            chunkId,
            status: 'failed',
        };
    }
}

/**
 * Poll video job until completion with short timeout for live use
 */
async function pollVideoJob(jobId: string, maxWaitMs: number): Promise<Buffer> {
    const startTime = Date.now();
    const pollInterval = 500; // Fast polling for live streaming

    while (Date.now() - startTime < maxWaitMs) {
        const response = await fetch(`${DECART_API_BASE}/jobs/${jobId}`, {
            headers: { 'X-API-KEY': API_KEY },
        });

        if (!response.ok) {
            throw new Error(`Failed to get job status: ${response.statusText}`);
        }

        const job = await response.json() as { status: string };

        if (job.status === 'completed') {
            const videoResponse = await fetch(`${DECART_API_BASE}/jobs/${jobId}/content`, {
                headers: { 'X-API-KEY': API_KEY },
            });
            const arrayBuffer = await videoResponse.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }

        if (job.status === 'failed') {
            throw new Error('Video job failed');
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Video job timed out');
}

/**
 * Analyze clothing item to generate a detailed prompt for video transformation
 */
export async function generateClothingPrompt(clothingImageBase64: string): Promise<string> {
    // Use existing Gemini for text analysis
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    const result = await client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: clothingImageBase64.replace(/^data:image\/\w+;base64,/, ''),
                    },
                },
                {
                    text: `Analyze this clothing item and describe it in detail for a virtual try-on prompt.
          Include: color, material, style, pattern, fit type.
          Format: "a [color] [material] [style] [item type] with [details]"
          Keep it under 50 words.`,
                },
            ],
        }],
    });

    const response = result as any;
    return response.response?.text?.() || response.text?.() || 'casual fashion outfit';
}

/**
 * Get recommended chunk duration based on device capability
 */
export function getRecommendedChunkDuration(deviceType: 'mobile' | 'tablet' | 'desktop'): number {
    switch (deviceType) {
        case 'mobile':
            return 2000; // Longer chunks for mobile to reduce API calls
        case 'tablet':
            return 1500;
        case 'desktop':
            return 1000; // Shorter chunks for faster feedback on desktop
        default:
            return 1500;
    }
}

export default {
    transformVideoChunk,
    generateClothingPrompt,
    getRecommendedChunkDuration,
    DEFAULT_CONFIG,
};
