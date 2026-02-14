/**
 * @fileoverview Decart AI Service for MirrorX Virtual Try-On
 *
 * This service integrates with Decart AI's video/image transformation models
 * using direct HTTP API calls:
 * - lucy-pro-i2i: Image-to-image for static virtual try-on
 * - lucy-pro-v2v: Video-to-video for video try-on
 * - lucy-fast-v2v: Fast video transformation
 * - Realtime models: Live webcam try-on via WebRTC
 */

import sharp from 'sharp';

const DECART_API_BASE = 'https://api.decart.ai/v1';
const API_KEY = process.env.DECART_API_KEY || '';

// Model configuration
export const MODELS = {
    IMAGE_TO_IMAGE: 'lucy-pro-i2i',
    VIDEO_TO_VIDEO: 'lucy-pro-v2v',
    FAST_VIDEO: 'lucy-fast-v2v',
    REALTIME_720P: 'lucy_v2v_720p_rt',
    REALTIME_V2: 'lucy_2_rt',
    LIVE_AVATAR: 'live_avatar',
} as const;

export interface TryOnResult {
    imageBase64: string;
    model: string;
    processingTimeMs: number;
    success: boolean;
}

export interface VideoTryOnResult {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    videoUrl?: string;
    processingTimeMs?: number;
}

export interface RealtimeConfig {
    model: string;
    serverUrl: string;
    sessionToken: string;
}

/**
 * Generate virtual try-on using Decart's lucy-pro-i2i model (synchronous)
 */
export async function generateTryOn(
    selfieBase64: string,
    garmentImageBase64: string,
    options?: {
        enhancePrompt?: boolean;
        gender?: 'male' | 'female';
    }
): Promise<TryOnResult> {
    const startTime = Date.now();

    console.log('[Decart] Starting image-to-image try-on...');

    try {
        const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
        const cleanGarment = garmentImageBase64.replace(/^data:image\/\w+;base64,/, '');

        const selfieBuffer = Buffer.from(cleanSelfie, 'base64');
        const garmentBuffer = Buffer.from(cleanGarment, 'base64');

        const person = options?.gender === 'female' ? 'woman' : 'man';
        const prompt = `(photorealistic:1.4), (highest quality:1.2). A photo of a ${person} wearing the clothing from the reference image.
CRITICAL: The output must be a single, seamless photo of the person.
1. FACE PRESERVATION: Keep the person's face, hair, and head feature EXACTLY 100% identical to the input selfie.
2. CLOTHING: Replace the original outfit with the reference clothing utilizing realistic fabric physics and draping.
3. COMPOSITION: Do NOT show a split screen. Do NOT show the reference garment floating. Do NOT make a collage. Do NOT put the person in a circle or vignette.
4. LIGHTING: Use natural, cinematic lighting that matches the original selfie.
5. NO ARTIFACTS: Ensure no white borders, no sticker outlines, no cartoon effects.`;

        // Create combined reference image
        const combinedImage = await createReferenceImage(selfieBuffer, garmentBuffer);

        // Create form data for API
        const formData = new FormData();
        formData.append('data', new Blob([combinedImage], { type: 'image/jpeg' }), 'input.jpg');
        formData.append('prompt', prompt);
        // CRITICAL: Disable prompt enhancement to prevent model from overriding our strict instructions
        formData.append('enhance_prompt', 'false');

        // Submit job
        const submitResponse = await fetch(`${DECART_API_BASE}/generate/${MODELS.IMAGE_TO_IMAGE}`, {
            method: 'POST',
            headers: {
                'X-API-KEY': API_KEY,
            },
            body: formData,
        });

        if (!submitResponse.ok) {
            const errorText = await submitResponse.text();
            throw new Error(`Decart API error: ${submitResponse.status} - ${errorText}`);
        }

        // For image generation, response is direct (not async job)
        const contentType = submitResponse.headers.get('content-type');

        if (contentType?.includes('image')) {
            // Direct image response
            const imageBuffer = Buffer.from(await submitResponse.arrayBuffer());
            const base64Result = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

            console.log(`[Decart] Try-on completed in ${Date.now() - startTime}ms`);

            return {
                imageBase64: base64Result,
                model: MODELS.IMAGE_TO_IMAGE,
                processingTimeMs: Date.now() - startTime,
                success: true,
            };
        }

        // JSON response with job ID (async)
        const result = await submitResponse.json() as { data?: string; job_id?: string };

        if (result.data) {
            // If data is returned directly
            return {
                imageBase64: `data:image/jpeg;base64,${result.data}`,
                model: MODELS.IMAGE_TO_IMAGE,
                processingTimeMs: Date.now() - startTime,
                success: true,
            };
        }

        // If job ID returned, poll for completion
        if (result.job_id) {
            const completedResult = await pollJobUntilComplete(result.job_id);
            return {
                imageBase64: completedResult,
                model: MODELS.IMAGE_TO_IMAGE,
                processingTimeMs: Date.now() - startTime,
                success: true,
            };
        }

        throw new Error('Unexpected API response format');
    } catch (error) {
        console.error('[Decart] Try-on error:', error);
        throw error;
    }
}

/**
 * Submit video try-on job (asynchronous)
 */
export async function submitVideoTryOn(
    videoBuffer: Buffer,
    garmentImageBase64: string,
    options?: {
        fast?: boolean;
        gender?: 'male' | 'female';
    }
): Promise<{ jobId: string }> {
    console.log('[Decart] Submitting video try-on job...');

    try {
        const person = options?.gender === 'female' ? 'woman' : 'man';
        const prompt = `Virtual try-on: Make this ${person} wear the reference clothing throughout the video.
Maintain face identity and body proportions. Only change clothing.
Natural movement, consistent transformation, no flickering.`;

        const model = options?.fast ? MODELS.FAST_VIDEO : MODELS.VIDEO_TO_VIDEO;

        const formData = new FormData();
        formData.append('data', new Blob([videoBuffer], { type: 'video/mp4' }), 'input.mp4');
        formData.append('prompt', prompt);
        formData.append('enhance_prompt', 'true');

        const response = await fetch(`${DECART_API_BASE}/jobs/${model}`, {
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
        console.log(`[Decart] Video job submitted: ${result.job_id}`);

        return { jobId: result.job_id };
    } catch (error) {
        console.error('[Decart] Video submit error:', error);
        throw error;
    }
}

/**
 * Get video job status
 */
export async function getVideoJobStatus(jobId: string): Promise<VideoTryOnResult> {
    try {
        const response = await fetch(`${DECART_API_BASE}/jobs/${jobId}`, {
            headers: {
                'X-API-KEY': API_KEY,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get job status: ${response.statusText}`);
        }

        const job = await response.json() as { status: string };

        const result: VideoTryOnResult = {
            jobId: jobId,
            status: job.status as VideoTryOnResult['status'],
        };

        if (job.status === 'completed') {
            result.videoUrl = `${DECART_API_BASE}/jobs/${jobId}/content`;
        }

        return result;
    } catch (error) {
        console.error('[Decart] Job status error:', error);
        throw error;
    }
}

/**
 * Download completed video
 */
export async function downloadVideo(jobId: string): Promise<Buffer> {
    try {
        const response = await fetch(`${DECART_API_BASE}/jobs/${jobId}/content`, {
            headers: {
                'X-API-KEY': API_KEY,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error('[Decart] Video download error:', error);
        throw error;
    }
}

/**
 * Get realtime WebRTC configuration
 */
export async function getRealtimeConfig(model?: string): Promise<RealtimeConfig> {
    const selectedModel = model || MODELS.REALTIME_720P;

    return {
        model: selectedModel,
        serverUrl: 'wss://rt.decart.ai/v1/stream',
        sessionToken: API_KEY,
    };
}

/**
 * Poll job until completion
 */
async function pollJobUntilComplete(jobId: string, maxWaitMs = 120000): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
        const status = await getVideoJobStatus(jobId);

        if (status.status === 'completed') {
            const videoBuffer = await downloadVideo(jobId);
            return `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
        }

        if (status.status === 'failed') {
            throw new Error('Decart job failed');
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Decart job timed out');
}

/**
 * Create reference image combining selfie and garment
 */
async function createReferenceImage(
    selfieBuffer: Buffer,
    garmentBuffer: Buffer
): Promise<Buffer> {
    const selfieMetadata = await sharp(selfieBuffer).metadata();
    const targetHeight = Math.min(selfieMetadata.height || 1024, 1024);
    const targetWidth = Math.round(targetHeight * 0.75);

    const resizedSelfie = await sharp(selfieBuffer)
        .resize({ height: targetHeight, fit: 'contain' })
        .jpeg({ quality: 90 })
        .toBuffer();

    const resizedGarment = await sharp(garmentBuffer)
        .resize({ width: targetWidth, height: targetHeight, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .jpeg({ quality: 90 })
        .toBuffer();

    const selfieInfo = await sharp(resizedSelfie).metadata();
    const garmentInfo = await sharp(resizedGarment).metadata();

    const totalWidth = (selfieInfo.width || 512) + (garmentInfo.width || 512) + 20;

    const combined = await sharp({
        create: {
            width: totalWidth,
            height: targetHeight,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
        },
    })
        .composite([
            { input: resizedSelfie, left: 0, top: 0 },
            { input: resizedGarment, left: (selfieInfo.width || 512) + 20, top: 0 },
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

    return combined;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
    try {
        if (!API_KEY) {
            console.warn('[Decart] API key not configured');
            return false;
        }
        console.log('[Decart] Health check passed');
        return true;
    } catch (error) {
        console.error('[Decart] Health check failed:', error);
        return false;
    }
}

export default {
    generateTryOn,
    submitVideoTryOn,
    getVideoJobStatus,
    downloadVideo,
    getRealtimeConfig,
    healthCheck,
    MODELS,
};
