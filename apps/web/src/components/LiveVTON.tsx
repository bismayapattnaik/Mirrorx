/**
 * @fileoverview Live Virtual Try-On Component
 *
 * Real-time video try-on using Decart AI's lucy-pro-v2v model.
 * Captures video chunks from webcam and transforms them with clothing overlay.
 *
 * Architecture:
 * 1. MediaRecorder captures short video chunks (1-2 seconds)
 * 2. Chunks are sent to backend /tryon/live/transform endpoint
 * 3. Backend uses Decart lucy-pro-v2v for transformation
 * 4. Transformed video is rendered in overlay canvas
 * 5. MediaPipe provides instant pose feedback while AI processes
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Sparkles, Video, VideoOff,
    ChevronLeft, ChevronRight, ShoppingBag, Wand2, Pause, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils,
} from '@mediapipe/tasks-vision';
import { useAuthStore } from '@/store/auth-store';

interface ClothingItem {
    id: string;
    name: string;
    image: string;
    category: string;
    price: number;
}

interface LiveVTONProps {
    isOpen: boolean;
    onClose: () => void;
    clothing: ClothingItem[];
    onAddToCart?: (item: ClothingItem) => void;
}

type ProcessingStatus = 'idle' | 'recording' | 'processing' | 'ready';

const CHUNK_DURATION_MS = 1500; // 1.5 seconds per chunk
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function LiveVTON({ isOpen, onClose, clothing, onAddToCart }: LiveVTONProps) {
    const { token } = useAuthStore();

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayVideoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const animationFrameRef = useRef<number>(0);
    const chunksRef = useRef<Blob[]>([]);

    // State
    const [isActive, setIsActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [transformedVideoUrl, setTransformedVideoUrl] = useState<string | null>(null);
    const [poseDetected, setPoseDetected] = useState(false);
    const [styleMode, setStyleMode] = useState<'realistic' | 'anime' | 'artistic'>('realistic');

    const selectedItem = clothing[selectedIndex];

    // Initialize MediaPipe Pose Landmarker
    useEffect(() => {
        if (!isOpen) return;

        const initPoseLandmarker = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );

                poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1,
                });

                console.log('[LiveVTON] Pose landmarker initialized');
            } catch (err) {
                console.error('[LiveVTON] Failed to init pose landmarker:', err);
            }
        };

        initPoseLandmarker();

        return () => {
            poseLandmarkerRef.current?.close();
        };
    }, [isOpen]);

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user',
                },
                audio: false,
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            setIsActive(true);
            setIsLoading(false);
            startPoseDetection();
        } catch (err) {
            console.error('[LiveVTON] Camera error:', err);
            setError('Failed to access camera. Please allow camera permissions.');
            setIsLoading(false);
        }
    }, []);

    // Stop camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        cancelAnimationFrame(animationFrameRef.current);
        setIsActive(false);
        setStatus('idle');
        setTransformedVideoUrl(null);
    }, []);

    // Start pose detection loop
    const startPoseDetection = useCallback(() => {
        const detect = () => {
            if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current) {
                animationFrameRef.current = requestAnimationFrame(detect);
                return;
            }

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (!ctx || video.readyState < 2) {
                animationFrameRef.current = requestAnimationFrame(detect);
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame
            ctx.drawImage(video, 0, 0);

            // Detect pose
            const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());

            if (results.landmarks && results.landmarks.length > 0) {
                setPoseDetected(true);

                // Draw pose landmarks for visual feedback
                const drawingUtils = new DrawingUtils(ctx);
                for (const landmarks of results.landmarks) {
                    drawingUtils.drawConnectors(
                        landmarks,
                        PoseLandmarker.POSE_CONNECTIONS,
                        { color: '#22c55e', lineWidth: 2 }
                    );
                    drawingUtils.drawLandmarks(landmarks, {
                        color: '#ef4444',
                        lineWidth: 1,
                        radius: 3,
                    });
                }
            } else {
                setPoseDetected(false);
            }

            animationFrameRef.current = requestAnimationFrame(detect);
        };

        detect();
    }, []);

    // Start recording and processing chunks
    const startRecording = useCallback(async () => {
        if (!streamRef.current || !selectedItem) {
            setError('Camera not ready or no clothing selected');
            return;
        }

        setStatus('recording');
        setError(null);
        chunksRef.current = [];

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';

        const recorder = new MediaRecorder(streamRef.current, {
            mimeType,
            videoBitsPerSecond: 2500000, // 2.5 Mbps
        });

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                chunksRef.current.push(event.data);

                // Process the chunk when we have enough data
                if (chunksRef.current.length >= 1) {
                    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                    chunksRef.current = [];
                    await processVideoChunk(blob);
                }
            }
        };

        recorder.start(CHUNK_DURATION_MS);
    }, [selectedItem]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setStatus('idle');
    }, []);

    // Process a video chunk
    const processVideoChunk = async (blob: Blob) => {
        if (!selectedItem || !token) {
            setError('Please log in to use live try-on');
            return;
        }

        setStatus('processing');

        try {
            const formData = new FormData();
            formData.append('video', blob, 'chunk.webm');
            formData.append('garment_base64', selectedItem.image);
            formData.append('style', styleMode);
            formData.append('gender', 'female'); // TODO: Get from user profile

            const response = await fetch(`${API_URL}/tryon/video`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to process video');
            }

            const result = await response.json();

            // Poll for completion
            await pollForResult(result.job_id);
        } catch (err) {
            console.error('[LiveVTON] Processing error:', err);
            setError('Failed to process video. Please try again.');
            setStatus('ready');
        }
    };

    // Poll for video result
    const pollForResult = async (jobId: string) => {
        const maxAttempts = 60; // 30 seconds max
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${API_URL}/tryon/video/${jobId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                const result = await response.json();

                if (result.status === 'completed') {
                    // Download and display the video
                    const videoUrl = `${API_URL}/tryon/video/${jobId}/download`;
                    setTransformedVideoUrl(videoUrl);
                    setStatus('ready');

                    // Play the transformed video
                    if (overlayVideoRef.current) {
                        overlayVideoRef.current.src = videoUrl;
                        overlayVideoRef.current.play();
                    }
                    return;
                }

                if (result.status === 'failed') {
                    throw new Error('Video transformation failed');
                }

                attempts++;
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                console.error('[LiveVTON] Poll error:', err);
                setError('Failed to get transformed video');
                setStatus('ready');
                return;
            }
        }

        setError('Video processing timed out');
        setStatus('ready');
    };

    // Handle close
    const handleClose = () => {
        stopCamera();
        onClose();
    };

    // Navigate clothing
    const nextClothing = () => {
        setSelectedIndex((prev) => (prev + 1) % clothing.length);
        setTransformedVideoUrl(null);
    };

    const prevClothing = () => {
        setSelectedIndex((prev) => (prev - 1 + clothing.length) % clothing.length);
        setTransformedVideoUrl(null);
    };

    // Auto-start camera when opened
    useEffect(() => {
        if (isOpen && !isActive) {
            startCamera();
        }

        return () => {
            if (!isOpen) {
                stopCamera();
            }
        };
    }, [isOpen, isActive, startCamera, stopCamera]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-gold-400" />
                        <span className="text-xl font-bold text-white">Live Try-On</span>
                        <span className={cn(
                            "px-2 py-1 text-xs rounded-full",
                            poseDetected ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                        )}>
                            {poseDetected ? 'Body Detected' : 'Stand in Frame'}
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="text-white hover:bg-white/20"
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                {/* Main Content */}
                <div className="flex h-full pt-16 pb-24">
                    {/* Video Area */}
                    <div className="flex-1 relative">
                        {/* Live Camera Feed */}
                        <video
                            ref={videoRef}
                            className="absolute inset-0 w-full h-full object-cover"
                            playsInline
                            muted
                            style={{ transform: 'scaleX(-1)' }}
                        />

                        {/* Pose Detection Overlay */}
                        <canvas
                            ref={canvasRef}
                            className={cn(
                                "absolute inset-0 w-full h-full object-cover pointer-events-none",
                                transformedVideoUrl ? 'opacity-30' : 'opacity-100'
                            )}
                            style={{ transform: 'scaleX(-1)' }}
                        />

                        {/* Transformed Video Overlay */}
                        {transformedVideoUrl && (
                            <video
                                ref={overlayVideoRef}
                                className="absolute inset-0 w-full h-full object-cover"
                                playsInline
                                loop
                                muted
                                autoPlay
                                style={{ transform: 'scaleX(-1)', mixBlendMode: 'normal' }}
                            />
                        )}

                        {/* Loading Indicator */}
                        {status === 'processing' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <div className="flex flex-col items-center gap-4">
                                    <Loader2 className="w-12 h-12 text-gold-400 animate-spin" />
                                    <span className="text-white text-lg">Processing with AI...</span>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        {/* Camera Off State */}
                        {!isActive && !isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                <Button onClick={startCamera} className="gap-2">
                                    <Video className="w-5 h-5" />
                                    Start Camera
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Clothing Selector Sidebar */}
                    <div className="w-80 bg-black/80 p-4 flex flex-col gap-4">
                        {/* Selected Item */}
                        {selectedItem && (
                            <div className="bg-white/10 rounded-lg p-4">
                                <img
                                    src={selectedItem.image}
                                    alt={selectedItem.name}
                                    className="w-full h-48 object-contain rounded-lg mb-3"
                                />
                                <h3 className="text-white font-semibold">{selectedItem.name}</h3>
                                <p className="text-gold-400 font-bold">₹{selectedItem.price}</p>
                            </div>
                        )}

                        {/* Style Selector */}
                        <div className="space-y-2">
                            <label className="text-gray-400 text-sm">Style Mode</label>
                            <div className="flex gap-2">
                                {(['realistic', 'anime', 'artistic'] as const).map((style) => (
                                    <Button
                                        key={style}
                                        variant={styleMode === style ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setStyleMode(style)}
                                        className="flex-1 capitalize"
                                    >
                                        {style}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon" onClick={prevClothing}>
                                <ChevronLeft className="w-6 h-6 text-white" />
                            </Button>
                            <span className="text-gray-400">
                                {selectedIndex + 1} / {clothing.length}
                            </span>
                            <Button variant="ghost" size="icon" onClick={nextClothing}>
                                <ChevronRight className="w-6 h-6 text-white" />
                            </Button>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 mt-auto">
                            {status === 'idle' || status === 'ready' ? (
                                <Button
                                    onClick={startRecording}
                                    disabled={!poseDetected || !isActive}
                                    className="w-full gap-2 bg-gradient-to-r from-gold-500 to-gold-600"
                                >
                                    <Wand2 className="w-5 h-5" />
                                    Transform with AI
                                </Button>
                            ) : (
                                <Button
                                    onClick={stopRecording}
                                    variant="destructive"
                                    className="w-full gap-2"
                                >
                                    <Pause className="w-5 h-5" />
                                    Stop Recording
                                </Button>
                            )}

                            {selectedItem && onAddToCart && (
                                <Button
                                    onClick={() => onAddToCart(selectedItem)}
                                    variant="outline"
                                    className="w-full gap-2"
                                >
                                    <ShoppingBag className="w-5 h-5" />
                                    Add to Cart
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
                        <span className={cn(
                            "flex items-center gap-2",
                            isActive ? "text-green-400" : "text-gray-500"
                        )}>
                            {isActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                            Camera {isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span>•</span>
                        <span>Status: {status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        <span>•</span>
                        <span>Powered by Decart AI</span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default LiveVTON;
