/**
 * @fileoverview Live Virtual Try-On Component with Decart SDK
 *
 * Real-time video try-on using Decart AI's mirage_v2 (MirageLSD) model.
 * User uploads their own clothing image to try on live via AI transformation.
 *
 * Model: mirage_v2 (MirageLSD 2.0)
 * Endpoint: wss://api3.decart.ai/v1/stream?model=mirage_v2
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Sparkles, Video, VideoOff,
    Upload, Wand2, Wifi, WifiOff, Camera, ImagePlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LiveVTONProps {
    isOpen: boolean;
    onClose: () => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// API key from environment or hardcoded
const DECART_API_KEY = import.meta.env.VITE_DECART_API_KEY || 'mirrorx_JSsnNnCHmtYMltDXFJAbMLAXdShCYNKdzhZZDsEZndVJLaIKFPVvUdZrWjiuTAvH';

// Model specifications for mirage_v2
const MODEL_SPECS = {
    width: 1280,
    height: 720,
    fps: 30,
    model: 'mirage_v2',
};

// Decart WebSocket endpoint
const DECART_WS_URL = 'wss://api3.decart.ai/v1/stream';

export function LiveVTON({ isOpen, onClose }: LiveVTONProps) {
    // Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [uploadedImageName, setUploadedImageName] = useState<string>('');
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [showOriginal, setShowOriginal] = useState(false);
    const [styleMode, setStyleMode] = useState<'realistic' | 'anime' | 'cyberpunk'>('realistic');

    // Handle image upload
    const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadedImage(reader.result as string);
            setUploadedImageName(file.name);
            setError(null);
        };
        reader.onerror = () => {
            setError('Failed to read image file');
        };
        reader.readAsDataURL(file);
    }, []);

    // Clear uploaded image
    const clearUploadedImage = useCallback(() => {
        setUploadedImage(null);
        setUploadedImageName('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // Generate try-on prompt
    const generateTryOnPrompt = useCallback((style: string) => {
        const stylePrefix = style === 'anime'
            ? 'Anime style, '
            : style === 'cyberpunk'
                ? 'Cyberpunk aesthetic with neon lighting, '
                : '';

        return `${stylePrefix}Transform the person to wear the uploaded clothing item. CRITICAL: Keep the person's face, skin tone, hair, body shape, and all physical features EXACTLY the same - 100% identity preservation. Only modify the clothing/outfit area. Photorealistic fabric textures, natural draping, accurate lighting.`;
    }, []);

    // Create WebRTC peer connection
    const createPeerConnection = useCallback(async (stream: MediaStream) => {
        console.log('[LiveVTON] Creating peer connection...');

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate.toJSON(),
                }));
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[LiveVTON] ICE state:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                setConnectionState('connected');
            } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                setError('Connection lost. Please reconnect.');
            }
        };

        pc.ontrack = (event) => {
            console.log('[LiveVTON] Received transformed stream!');
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                remoteVideoRef.current.play().catch(console.error);
            }
        };

        stream.getTracks().forEach((track: MediaStreamTrack) => {
            pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: false,
        });
        await pc.setLocalDescription(offer);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'offer',
                sdp: offer.sdp,
            }));
        }
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            localStreamRef.current = null;
        }
        setConnectionState('disconnected');
        setIsTransforming(false);
        setCurrentPrompt('');
    }, []);

    // Connect to Decart
    const connect = useCallback(async () => {
        if (connectionState === 'connecting' || connectionState === 'connected') return;

        try {
            setConnectionState('connecting');
            setError(null);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: MODEL_SPECS.width },
                    height: { ideal: MODEL_SPECS.height },
                    frameRate: { ideal: MODEL_SPECS.fps },
                    facingMode: 'user',
                },
                audio: false,
            });

            localStreamRef.current = stream;

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(console.error);
            }

            const wsUrl = `${DECART_WS_URL}?api_key=${DECART_API_KEY}&model=${MODEL_SPECS.model}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[LiveVTON] WebSocket connected');
                createPeerConnection(stream);
            };

            ws.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'answer' && pcRef.current) {
                        await pcRef.current.setRemoteDescription({
                            type: 'answer',
                            sdp: message.sdp,
                        });
                        setConnectionState('connected');
                    }

                    if (message.type === 'ice-candidate' && pcRef.current && message.candidate) {
                        await pcRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
                    }

                    if (message.type === 'error') {
                        setError(message.message || 'Server error');
                    }
                } catch (err) {
                    console.error('[LiveVTON] Message error:', err);
                }
            };

            ws.onerror = () => {
                setError('Connection failed. Check your API key.');
                setConnectionState('disconnected');
            };

            ws.onclose = () => {
                setConnectionState('disconnected');
            };

        } catch (err: unknown) {
            const error = err as Error;
            if (error.name === 'NotAllowedError') {
                setError('Camera access denied. Please allow camera permissions.');
            } else if (error.name === 'NotFoundError') {
                setError('No camera found. Please connect a camera.');
            } else {
                setError(`Connection error: ${error.message}`);
            }
            setConnectionState('disconnected');
        }
    }, [connectionState, createPeerConnection]);

    // Start try-on
    const startTryOn = useCallback(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            setError('Not connected. Please wait for connection.');
            return;
        }

        if (!uploadedImage) {
            setError('Please upload a clothing image first.');
            return;
        }

        setIsTransforming(true);
        setShowOriginal(false);
        setError(null);

        const prompt = generateTryOnPrompt(styleMode);
        setCurrentPrompt(prompt);

        // Send prompt
        wsRef.current.send(JSON.stringify({
            type: 'prompt',
            prompt: prompt,
        }));

        // Send clothing image as reference
        wsRef.current.send(JSON.stringify({
            type: 'reference_image',
            image: uploadedImage,
        }));

        console.log('[LiveVTON] Started try-on with uploaded clothing');
    }, [styleMode, uploadedImage, generateTryOnPrompt]);

    // Stop try-on
    const stopTryOn = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'prompt',
                prompt: '',
            }));
        }
        setIsTransforming(false);
        setCurrentPrompt('');
    }, []);

    // Handle close
    const handleClose = () => {
        disconnect();
        onClose();
    };

    // Auto-connect when opened
    useEffect(() => {
        if (isOpen && connectionState === 'disconnected') {
            const timer = setTimeout(() => connect(), 100);
            return () => clearTimeout(timer);
        }
        return () => {
            if (!isOpen) disconnect();
        };
    }, [isOpen, connectionState, connect, disconnect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => disconnect();
    }, [disconnect]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                />

                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 to-transparent">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-gold-400" />
                        <span className="text-xl font-bold text-white">Live Try-On</span>
                        <span className={cn(
                            "px-3 py-1 text-xs rounded-full flex items-center gap-2",
                            connectionState === 'connected'
                                ? "bg-green-500/20 text-green-400"
                                : connectionState === 'connecting'
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-red-500/20 text-red-400"
                        )}>
                            {connectionState === 'connected' ? (
                                <><Wifi className="w-3 h-3" /> Connected</>
                            ) : connectionState === 'connecting' ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Connecting...</>
                            ) : (
                                <><WifiOff className="w-3 h-3" /> Disconnected</>
                            )}
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
                <div className="flex h-full pt-16 pb-16">
                    {/* Video Area */}
                    <div className="flex-1 relative">
                        <video
                            ref={localVideoRef}
                            className={cn(
                                "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                                isTransforming && !showOriginal ? "opacity-0" : "opacity-100"
                            )}
                            playsInline
                            muted
                            autoPlay
                            style={{ transform: 'scaleX(-1)' }}
                        />

                        <video
                            ref={remoteVideoRef}
                            className={cn(
                                "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                                isTransforming && !showOriginal ? "opacity-100" : "opacity-0"
                            )}
                            playsInline
                            autoPlay
                            style={{ transform: 'scaleX(-1)' }}
                        />

                        {isTransforming && (
                            <div className="absolute bottom-4 left-4">
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-sm flex items-center gap-2",
                                    showOriginal
                                        ? "bg-white/20 text-white"
                                        : "bg-gold-500/20 text-gold-400"
                                )}>
                                    {showOriginal ? 'Original' : <><Sparkles className="w-4 h-4" /> AI Transformed</>}
                                </span>
                            </div>
                        )}

                        {/* Connection Overlay */}
                        {connectionState !== 'connected' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                                {connectionState === 'connecting' ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-16 h-16 text-gold-400 animate-spin" />
                                        <span className="text-white text-xl">Connecting to AI...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <Camera className="w-16 h-16 text-gray-500" />
                                        <Button onClick={connect} size="lg" className="gap-2">
                                            <Video className="w-5 h-5" />
                                            Connect Camera
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg max-w-md text-center">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="w-80 bg-black/90 p-4 flex flex-col gap-4 border-l border-white/10 overflow-y-auto">
                        {/* Upload Section */}
                        <div className="space-y-3">
                            <h3 className="text-white font-semibold text-lg">Your Clothing</h3>

                            {uploadedImage ? (
                                <div className="bg-white/10 rounded-lg p-4 space-y-3">
                                    <img
                                        src={uploadedImage}
                                        alt="Uploaded clothing"
                                        className="w-full h-48 object-contain rounded-lg bg-white/5"
                                    />
                                    <p className="text-gray-400 text-sm truncate">{uploadedImageName}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={clearUploadedImage}
                                        className="w-full text-red-400 border-red-500/30 hover:bg-red-500/10"
                                    >
                                        Remove Image
                                    </Button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-white/5 border-2 border-dashed border-white/20 rounded-lg p-8 flex flex-col items-center gap-4 cursor-pointer hover:border-gold-400/50 hover:bg-white/10 transition-colors"
                                >
                                    <ImagePlus className="w-12 h-12 text-gray-500" />
                                    <div className="text-center">
                                        <p className="text-white font-medium">Upload Clothing Image</p>
                                        <p className="text-gray-500 text-sm mt-1">Click to browse or drag & drop</p>
                                    </div>
                                </div>
                            )}

                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                {uploadedImage ? 'Change Image' : 'Upload Image'}
                            </Button>
                        </div>

                        {/* Style Selector */}
                        <div className="space-y-2">
                            <label className="text-gray-400 text-sm">Style Mode</label>
                            <div className="flex gap-2">
                                {(['realistic', 'anime', 'cyberpunk'] as const).map((style) => (
                                    <Button
                                        key={style}
                                        variant={styleMode === style ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setStyleMode(style)}
                                        className="flex-1 capitalize text-xs"
                                    >
                                        {style}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Current Prompt */}
                        {isTransforming && currentPrompt && (
                            <div className="p-3 bg-gold-500/10 rounded-lg border border-gold-500/30">
                                <p className="text-gold-400 text-xs line-clamp-3">{currentPrompt}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-2 mt-auto">
                            {!isTransforming ? (
                                <Button
                                    onClick={startTryOn}
                                    disabled={connectionState !== 'connected' || !uploadedImage}
                                    className="w-full gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-black font-bold disabled:opacity-50"
                                >
                                    <Wand2 className="w-5 h-5" />
                                    {!uploadedImage ? 'Upload Clothing First' : 'Try On Live'}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => setShowOriginal(!showOriginal)}
                                        variant="outline"
                                        className="w-full gap-2"
                                    >
                                        {showOriginal ? <Sparkles className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                        {showOriginal ? 'Show Transformed' : 'Show Original'}
                                    </Button>
                                    <Button
                                        onClick={stopTryOn}
                                        variant="outline"
                                        className="w-full gap-2 border-red-500/50 text-red-400"
                                    >
                                        <VideoOff className="w-5 h-5" />
                                        Stop Try-On
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-black border-t border-white/10">
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                        <span>Model: {MODEL_SPECS.model}</span>
                        <span>•</span>
                        <span>{MODEL_SPECS.width}x{MODEL_SPECS.height}@{MODEL_SPECS.fps}fps</span>
                        <span>•</span>
                        <span>Powered by Decart AI</span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default LiveVTON;
