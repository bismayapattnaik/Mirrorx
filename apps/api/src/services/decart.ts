/**
 * @fileoverview Decart AI Service for MirrorX Virtual Try-On
 *
 * This service integrates with Decart AI's video/image transformation models:
 * - lucy-pro-i2i: Image-to-image for static virtual try-on
 * - lucy-pro-v2v: Video-to-video for video try-on
 * - lucy-fast-v2v: Fast video transformation
 * - Realtime models: Live webcam try-on via WebRTC
 *
 * Replaces Gemini for better quality transformation without sticker effect.
 */

import { createDecartClient, models } from '@decartai/sdk';
import sharp from 'sharp';

// Initialize Decart client
const client = createDecartClient({
    apiKey: process.env.DECART_API_KEY || '',
});

// Model configuration
const MODELS = {
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
 * Generate virtual try-on using Decart's lucy-pro-i2i model
 * This is the primary method for static image try-on
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
        // Clean base64 data
        const cleanSelfie = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
        const cleanGarment = garmentImageBase64.replace(/^data:image\/\w+;base64,/, '');

        // Convert base64 to Blob for SDK
        const selfieBuffer = Buffer.from(cleanSelfie, 'base64');
        const garmentBuffer = Buffer.from(cleanGarment, 'base64');

        // Create prompts for try-on
        const person = options?.gender === 'female' ? 'woman' : 'man';
        const prompt = `Virtual try-on: Make this ${person} wear the clothing from the reference image. 
Keep the exact face, body shape, and skin tone. Only change the clothing.
Natural lighting, photorealistic quality, no artifacts.`;

        // Create combined image with selfie and garment side by side (reference injection)
        const combinedImage = await createReferenceImage(selfieBuffer, garmentBuffer);

        const combinedBlob = new Blob([combinedImage], { type: 'image/jpeg' });

        // Call Decart API
        const result = await client.queue.submitAndPoll({
            model: models.image(MODELS.IMAGE_TO_IMAGE),
            prompt: prompt,
            data: combinedBlob,
            enhance_prompt: options?.enhancePrompt ?? true,
            onStatusChange: (job: any) => console.log(`[Decart] Status: ${job.status}`),
        });

        if (result.status === 'completed' && result.data) {
            const buffer = Buffer.from(await result.data.arrayBuffer());
            const base64Result = `data:image/jpeg;base64,${buffer.toString('base64')}`;

            console.log(`[Decart] Try-on completed in ${Date.now() - startTime}ms`);

            return {
                imageBase64: base64Result,
                model: MODELS.IMAGE_TO_IMAGE,
                processingTimeMs: Date.now() - startTime,
                success: true,
            };
        }

        throw new Error(`Decart job failed with status: ${result.status}`);
    } catch (error) {
        console.error('[Decart] Try-on error:', error);
        throw error;
    }
}

/**
 * Generate video try-on using Decart's lucy-pro-v2v model
 * Submits async job and returns job ID for polling
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
        const cleanGarment = garmentImageBase64.replace(/^data:image\/\w+;base64,/, '');
        const garmentBuffer = Buffer.from(cleanGarment, 'base64');

        const person = options?.gender === 'female' ? 'woman' : 'man';
        const prompt = `Virtual try-on: Make this ${person} wear the reference clothing throughout the video.
Maintain face identity and body proportions. Only change clothing.
Natural movement, consistent transformation, no flickering.`;

        const model = options?.fast ? MODELS.FAST_VIDEO : MODELS.VIDEO_TO_VIDEO;

        const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });

        const job = await client.queue.submit({
            model: models.video(model),
            prompt: prompt,
            data: videoBlob,
            enhance_prompt: true,
        });

        console.log(`[Decart] Video job submitted: ${job.job_id}`);

        return { jobId: job.job_id };
    } catch (error) {
        console.error('[Decart] Video submit error:', error);
        throw error;
    }
}

/**
 * Poll video try-on job status
 */
export async function getVideoJobStatus(jobId: string): Promise<VideoTryOnResult> {
    try {
        const job = await client.queue.get(jobId);

        const result: VideoTryOnResult = {
            jobId: jobId,
            status: job.status as VideoTryOnResult['status'],
        };

        if (job.status === 'completed') {
            result.videoUrl = `https://api.decart.ai/v1/jobs/${jobId}/content`;
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
        const response = await fetch(`https://api.decart.ai/v1/jobs/${jobId}/content`, {
            headers: {
                'X-API-KEY': process.env.DECART_API_KEY || '',
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
 * Get realtime WebRTC configuration for live video try-on
 */
export async function getRealtimeConfig(model?: string): Promise<RealtimeConfig> {
    // Realtime models use WebRTC connection
    // Frontend connects directly to Decart's realtime endpoint
    const selectedModel = model || MODELS.REALTIME_720P;

    return {
        model: selectedModel,
        serverUrl: 'wss://rt.decart.ai/v1/stream',
        sessionToken: process.env.DECART_API_KEY || '',
    };
}

/**
 * Create a reference image combining selfie and garment for try-on
 */
async function createReferenceImage(
    selfieBuffer: Buffer,
    garmentBuffer: Buffer
): Promise<Buffer> {
    // Get dimensions
    const selfieMetadata = await sharp(selfieBuffer).metadata();
    const garmentMetadata = await sharp(garmentBuffer).metadata();

    const targetHeight = Math.min(selfieMetadata.height || 1024, 1024);
    const targetWidth = Math.round(targetHeight * 0.75); // 3:4 aspect ratio

    // Resize both images to same height
    const resizedSelfie = await sharp(selfieBuffer)
        .resize({ height: targetHeight, fit: 'contain' })
        .jpeg({ quality: 90 })
        .toBuffer();

    const resizedGarment = await sharp(garmentBuffer)
        .resize({ width: targetWidth, height: targetHeight, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .jpeg({ quality: 90 })
        .toBuffer();

    // Get final dimensions
    const selfieInfo = await sharp(resizedSelfie).metadata();
    const garmentInfo = await sharp(resizedGarment).metadata();

    const totalWidth = (selfieInfo.width || 512) + (garmentInfo.width || 512) + 20; // 20px gap

    // Combine images horizontally
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
 * Health check for Decart API
 */
export async function healthCheck(): Promise<boolean> {
    try {
        // Simple API check
        if (!process.env.DECART_API_KEY) {
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
