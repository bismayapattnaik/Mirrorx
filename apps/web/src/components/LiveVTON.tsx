/**
 * @fileoverview Live Virtual Try-On Component with WebRTC
 *
 * Real-time video try-on using Decart AI's mirage_v2 (MirageLSD) model.
 * User can select from demo clothing or upload their own image.
 * The AI transforms the video to show them wearing the clothing.
 *
 * Model: mirage_v2 (MirageLSD 2.0)
 * Endpoint: wss://api3.decart.ai/v1/stream?model=mirage_v2
 * Credit: 1 per second
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Sparkles, Video, VideoOff,
    Upload, Wand2, Wifi, WifiOff, Camera,
    ChevronLeft, ChevronRight, ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Demo clothing items for users to try
const DEMO_CLOTHING = [
    {
        id: 'demo-1',
        name: 'Classic Navy Blazer',
        image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400',
        description: 'A tailored navy blue blazer with modern slim fit, perfect for formal occasions',
        price: 4999,
    },
    {
        id: 'demo-2',
        name: 'Burgundy Polo Shirt',
        image: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=400',
        description: 'A premium cotton polo shirt in rich burgundy color with classic collar',
        price: 1299,
    },
    {
        id: 'demo-3',
        name: 'Floral Summer Dress',
        image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400',
        description: 'A flowing floral print summer dress with V-neckline and knee-length hem',
        price: 2499,
    },
    {
        id: 'demo-4',
        name: 'Denim Jacket',
        image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400',
        description: 'Classic blue denim jacket with distressed details and brass buttons',
        price: 3499,
    },
    {
        id: 'demo-5',
        name: 'White Formal Shirt',
        image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400',
        description: 'Crisp white formal shirt with spread collar, perfect for office wear',
        price: 1899,
    },
];

interface LiveVTONProps {
    isOpen: boolean;
    onClose: () => void;
    onAddToCart?: (item: { id: string; name: string; price: number }) => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// Decart Realtime API settings - Using Lucy 2 RT for face preservation
const DECART_WS_URL = 'wss://api3.decart.ai/v1/stream';
const DECART_MODEL = 'lucy_2_rt'; // Lucy 2 RT with character reference for 100% face preservation
const API_KEY = import.meta.env.VITE_DECART_API_KEY || '';

// Model specifications for lucy_2_rt
const MODEL_SPECS = {
    width: 1280,
    height: 704,
    fps: 25,
};

export function LiveVTON({ isOpen, onClose, onAddToCart }: LiveVTONProps) {
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
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [showOriginal, setShowOriginal] = useState(false);
    const [styleMode, setStyleMode] = useState<'realistic' | 'anime' | 'cyberpunk'>('realistic');

    // Get current clothing item (uploaded or demo)
    const currentClothing = uploadedImage
        ? { id: 'uploaded', name: 'Your Clothing', image: uploadedImage, description: 'User uploaded clothing', price: 0 }
        : DEMO_CLOTHING[selectedIndex];

    // Generate try-on prompt with identity preservation
    const generateTryOnPrompt = useCallback((description: string, style: string) => {
        const stylePrefix = style === 'anime'
            ? 'Anime style, '
            : style === 'cyberpunk'
                ? 'Cyberpunk aesthetic with neon lighting, '
                : '';

        // Lucy 2 RT specific prompt for identity preservation
        return `${stylePrefix}Change ONLY the clothing to: ${description}. CRITICAL: Keep the person's face, skin tone, hair, body shape, and all physical features EXACTLY the same - 100% identity preservation. Only modify the clothing/outfit area. Photorealistic fabric textures, natural draping, accurate lighting.`;
    }, []);

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
            setError(null);
        };
        reader.onerror = () => {
            setError('Failed to read image file');
        };
        reader.readAsDataURL(file);
    }, []);

    // Navigate demo clothing
    const nextClothing = () => {
        setUploadedImage(null); // Clear uploaded image when browsing demos
        setSelectedIndex((prev: number) => (prev + 1) % DEMO_CLOTHING.length);
    };

    const prevClothing = () => {
        setUploadedImage(null);
        setSelectedIndex((prev: number) => (prev - 1 + DEMO_CLOTHING.length) % DEMO_CLOTHING.length);
    };

    // Connect to Decart WebRTC
    const connect = useCallback(async () => {
        if (connectionState === 'connecting' || connectionState === 'connected') return;

        try {
            setConnectionState('connecting');
            setError(null);

            // Get user's camera
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

            // Connect WebSocket with API key and model
            const wsUrl = `${DECART_WS_URL}?api_key=${API_KEY}&model=${DECART_MODEL}`;
            console.log('[LiveVTON] Connecting to Decart with model:', DECART_MODEL);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[LiveVTON] WebSocket connected');
                createPeerConnection(stream);
            };

            ws.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('[LiveVTON] Message:', message.type);

                    if (message.type === 'answer' && pcRef.current) {
                        await pcRef.current.setRemoteDescription({
                            type: 'answer',
                            sdp: message.sdp,
                        });
                        setConnectionState('connected');
                        console.log('[LiveVTON] WebRTC connected!');
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
                console.log('[LiveVTON] WebSocket closed');
                setConnectionState('disconnected');
            };

        } catch (err: unknown) {
            const error = err as Error;
            console.error('[LiveVTON] Connection error:', error);
            if (error.name === 'NotAllowedError') {
                setError('Camera access denied. Please allow camera permissions.');
            } else {
                setError('Failed to access camera. Please check permissions.');
            }
            setConnectionState('disconnected');
        }
    }, [connectionState]);

    // Create WebRTC peer connection
    const createPeerConnection = useCallback(async (stream: MediaStream) => {
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

        // Receive transformed video stream
        pc.ontrack = (event) => {
            console.log('[LiveVTON] Received transformed stream!');
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                remoteVideoRef.current.play().catch(console.error);
            }
        };

        // Add local video track
        stream.getTracks().forEach((track: MediaStreamTrack) => {
            pc.addTrack(track, stream);
        });

        // Create and send offer
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

    // Start try-on transformation
    const startTryOn = useCallback(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            setError('Not connected. Please wait for connection.');
            return;
        }

        setIsTransforming(true);
        setShowOriginal(false);
        setError(null);

        const prompt = generateTryOnPrompt(currentClothing.description, styleMode);
        setCurrentPrompt(prompt);

        // Send prompt to Decart
        wsRef.current.send(JSON.stringify({
            type: 'prompt',
            prompt: prompt,
        }));

        // If we have an uploaded image, send it as reference
        if (uploadedImage) {
            wsRef.current.send(JSON.stringify({
                type: 'reference_image',
                image: uploadedImage,
            }));
        }

        console.log('[LiveVTON] Started try-on:', prompt);
    }, [currentClothing, styleMode, uploadedImage, generateTryOnPrompt]);

    // Stop transformation
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
            connect();
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
                        {/* Local video (camera) */}
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

                        {/* Remote video (transformed) */}
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

                        {/* Video label */}
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
                            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="w-80 bg-black/90 p-4 flex flex-col gap-4 border-l border-white/10 overflow-y-auto">
                        {/* Current Clothing */}
                        <div className="bg-white/10 rounded-lg p-4">
                            <img
                                src={currentClothing.image}
                                alt={currentClothing.name}
                                className="w-full h-40 object-contain rounded-lg mb-3 bg-white/5"
                            />
                            <h3 className="text-white font-semibold">{currentClothing.name}</h3>
                            {currentClothing.price > 0 && (
                                <p className="text-gold-400 font-bold">₹{currentClothing.price}</p>
                            )}
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

                        {/* Demo Clothing Navigation */}
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon" onClick={prevClothing}>
                                <ChevronLeft className="w-6 h-6 text-white" />
                            </Button>
                            <span className="text-gray-400 text-sm">
                                {uploadedImage ? 'Your Upload' : `${selectedIndex + 1} / ${DEMO_CLOTHING.length}`}
                            </span>
                            <Button variant="ghost" size="icon" onClick={nextClothing}>
                                <ChevronRight className="w-6 h-6 text-white" />
                            </Button>
                        </div>

                        {/* Upload Button */}
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            Upload Your Clothing
                        </Button>

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
                                    disabled={connectionState !== 'connected'}
                                    className="w-full gap-2 bg-gradient-to-r from-gold-500 to-gold-600 text-black font-bold"
                                >
                                    <Wand2 className="w-5 h-5" />
                                    Try On Live
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

                            {onAddToCart && currentClothing.price > 0 && (
                                <Button
                                    onClick={() => onAddToCart(currentClothing)}
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
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-black border-t border-white/10">
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                        <span>Model: Lucy 2 RT (Face Preserved)</span>
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
