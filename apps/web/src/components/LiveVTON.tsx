/**
 * @fileoverview Live Virtual Try-On Component with WebRTC
 *
 * Real-time video try-on using Decart AI's WebRTC API.
 * True realtime streaming with <40ms per frame latency.
 *
 * Uses vanilla WebSocket + WebRTC (no SDK dependency):
 * 1. WebSocket for signaling (offer/answer/ICE)
 * 2. WebRTC for video streaming
 * 3. Dynamic prompt updates for clothing changes
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Sparkles, Video, VideoOff,
    ChevronLeft, ChevronRight, ShoppingBag, Wand2, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClothingItem {
    id: string;
    name: string;
    image: string;
    category: string;
    price: number;
    description?: string;
}

interface LiveVTONProps {
    isOpen: boolean;
    onClose: () => void;
    clothing: ClothingItem[];
    onAddToCart?: (item: ClothingItem) => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// Decart Realtime API settings
const DECART_WS_URL = 'wss://api3.decart.ai/v1/stream';
const DECART_MODEL = 'lucy_2_rt'; // Supports character reference for clothing
const API_KEY = import.meta.env.VITE_DECART_API_KEY || '';

// Optimal video settings for Decart
const VIDEO_CONFIG = {
    width: 1280,
    height: 704,
    frameRate: 25,
};

export function LiveVTON({ isOpen, onClose, clothing, onAddToCart }: LiveVTONProps) {
    // Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    // State
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [isEditingActive, setIsEditingActive] = useState(false);
    const [styleMode, setStyleMode] = useState<'realistic' | 'anime' | 'cyberpunk'>('realistic');

    const selectedItem = clothing[selectedIndex];

    // Generate try-on prompt from clothing item
    const generateTryOnPrompt = useCallback((item: ClothingItem, style: string) => {
        const stylePrefix = style === 'anime'
            ? 'Anime style, '
            : style === 'cyberpunk'
                ? 'Cyberpunk aesthetic with neon lighting, '
                : '';

        const description = item.description || `${item.name} ${item.category}`;

        return `${stylePrefix}Transform the person to wear: ${description}. Maintain their face identity exactly. High-quality fashion, realistic textures, natural draping.`;
    }, []);

    // Connect to Decart WebRTC
    const connect = useCallback(async () => {
        if (connectionState === 'connecting' || connectionState === 'connected') return;

        try {
            setConnectionState('connecting');
            setError(null);

            // Get user's camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: VIDEO_CONFIG.width },
                    height: { ideal: VIDEO_CONFIG.height },
                    frameRate: { ideal: VIDEO_CONFIG.frameRate },
                    facingMode: 'user',
                },
                audio: false,
            });

            localStreamRef.current = stream;

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Connect WebSocket with API key and model
            const ws = new WebSocket(
                `${DECART_WS_URL}?api_key=${API_KEY}&model=${DECART_MODEL}`
            );
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[LiveVTON] WebSocket connected');
                createPeerConnection(stream);
            };

            ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);

                if (message.type === 'answer' && pcRef.current) {
                    await pcRef.current.setRemoteDescription({
                        type: 'answer',
                        sdp: message.sdp,
                    });
                    setConnectionState('connected');
                    console.log('[LiveVTON] WebRTC connected');
                }

                if (message.type === 'ice-candidate' && pcRef.current) {
                    try {
                        await pcRef.current.addIceCandidate(message.candidate);
                    } catch (err) {
                        console.warn('[LiveVTON] ICE candidate error:', err);
                    }
                }
            };

            ws.onerror = (err) => {
                console.error('[LiveVTON] WebSocket error:', err);
                setError('Connection failed. Check your API key.');
                setConnectionState('disconnected');
            };

            ws.onclose = () => {
                console.log('[LiveVTON] WebSocket closed');
                setConnectionState('disconnected');
            };

        } catch (err) {
            console.error('[LiveVTON] Connection error:', err);
            setError('Failed to access camera. Please allow camera permissions.');
            setConnectionState('disconnected');
        }
    }, [connectionState]);

    // Create WebRTC peer connection
    const createPeerConnection = useCallback(async (stream: MediaStream) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        // Send ICE candidates to server
        pc.onicecandidate = (event) => {
            if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                }));
            }
        };

        // Receive edited video stream
        pc.ontrack = (event) => {
            console.log('[LiveVTON] Received edited stream');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        // Add local tracks
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        });

        // Create and send offer
        const offer = await pc.createOffer();
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
        // Close WebRTC
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        // Close WebSocket
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Stop camera
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        setConnectionState('disconnected');
        setIsEditingActive(false);
        setCurrentPrompt('');
    }, []);

    // Send prompt to apply clothing
    const applyClothing = useCallback(async () => {
        if (!selectedItem || wsRef.current?.readyState !== WebSocket.OPEN) {
            setError('Not connected. Please wait for connection.');
            return;
        }

        const prompt = generateTryOnPrompt(selectedItem, styleMode);
        setCurrentPrompt(prompt);
        setIsEditingActive(true);

        // Send prompt
        wsRef.current.send(JSON.stringify({
            type: 'prompt',
            prompt: prompt,
        }));

        // Send character reference image for better clothing matching
        if (selectedItem.image) {
            try {
                // Convert image URL to base64 and send
                const response = await fetch(selectedItem.image);
                const blob = await response.blob();
                const reader = new FileReader();

                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    wsRef.current?.send(JSON.stringify({
                        type: 'image',
                        data: base64,
                    }));
                };

                reader.readAsDataURL(blob);
            } catch (err) {
                console.warn('[LiveVTON] Could not set reference image:', err);
            }
        }

        console.log('[LiveVTON] Applied prompt:', prompt);
    }, [selectedItem, styleMode, generateTryOnPrompt]);

    // Stop editing (show original)
    const stopEditing = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'prompt',
                prompt: '', // Empty prompt to stop editing
            }));
        }
        setIsEditingActive(false);
        setCurrentPrompt('');
    }, []);

    // Navigate clothing
    const nextClothing = () => {
        setSelectedIndex((prev) => (prev + 1) % clothing.length);
        if (isEditingActive) {
            setTimeout(() => applyClothing(), 100);
        }
    };

    const prevClothing = () => {
        setSelectedIndex((prev) => (prev - 1 + clothing.length) % clothing.length);
        if (isEditingActive) {
            setTimeout(() => applyClothing(), 100);
        }
    };

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
            if (!isOpen) {
                disconnect();
            }
        };
    }, [isOpen]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
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
                <div className="flex h-full pt-16 pb-4">
                    {/* Video Area */}
                    <div className="flex-1 relative flex">
                        {/* Local Video (Camera) */}
                        <div className={cn(
                            "relative transition-all duration-300",
                            isEditingActive ? "w-1/3 opacity-60" : "w-full"
                        )}>
                            <video
                                ref={localVideoRef}
                                className="w-full h-full object-cover"
                                playsInline
                                muted
                                autoPlay
                                style={{ transform: 'scaleX(-1)' }}
                            />
                            {!isEditingActive && (
                                <div className="absolute bottom-4 left-4 text-white/60 text-sm">
                                    Original
                                </div>
                            )}
                        </div>

                        {/* Remote Video (Edited) */}
                        {isEditingActive && (
                            <div className="w-2/3 relative">
                                <video
                                    ref={remoteVideoRef}
                                    className="w-full h-full object-cover"
                                    playsInline
                                    autoPlay
                                    style={{ transform: 'scaleX(-1)' }}
                                />
                                <div className="absolute bottom-4 left-4 text-gold-400 text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    AI Transformed
                                </div>
                            </div>
                        )}

                        {/* Connection Overlay */}
                        {connectionState !== 'connected' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                                {connectionState === 'connecting' ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-12 h-12 text-gold-400 animate-spin" />
                                        <span className="text-white text-lg">Connecting to AI...</span>
                                    </div>
                                ) : (
                                    <Button onClick={connect} className="gap-2">
                                        <Video className="w-5 h-5" />
                                        Connect Camera
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Clothing Selector Sidebar */}
                    <div className="w-80 bg-black/80 p-4 flex flex-col gap-4 border-l border-white/10">
                        {/* Selected Item */}
                        {selectedItem && (
                            <div className="bg-white/10 rounded-lg p-4">
                                <img
                                    src={selectedItem.image}
                                    alt={selectedItem.name}
                                    className="w-full h-48 object-contain rounded-lg mb-3 bg-white/5"
                                />
                                <h3 className="text-white font-semibold">{selectedItem.name}</h3>
                                <p className="text-gold-400 font-bold">₹{selectedItem.price}</p>
                            </div>
                        )}

                        {/* Style Selector */}
                        <div className="space-y-2">
                            <label className="text-gray-400 text-sm">Style Mode</label>
                            <div className="flex gap-2">
                                {(['realistic', 'anime', 'cyberpunk'] as const).map((style) => (
                                    <Button
                                        key={style}
                                        variant={styleMode === style ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => {
                                            setStyleMode(style);
                                            if (isEditingActive) {
                                                setTimeout(() => applyClothing(), 100);
                                            }
                                        }}
                                        className="flex-1 capitalize text-xs"
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

                        {/* Current Prompt */}
                        {isEditingActive && currentPrompt && (
                            <div className="p-3 bg-gold-500/10 rounded-lg border border-gold-500/30">
                                <p className="text-gold-400 text-xs line-clamp-3">{currentPrompt}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-2 mt-auto">
                            {!isEditingActive ? (
                                <Button
                                    onClick={applyClothing}
                                    disabled={connectionState !== 'connected'}
                                    className="w-full gap-2 bg-gradient-to-r from-gold-500 to-gold-600"
                                >
                                    <Wand2 className="w-5 h-5" />
                                    Try On Live
                                </Button>
                            ) : (
                                <Button
                                    onClick={stopEditing}
                                    variant="outline"
                                    className="w-full gap-2"
                                >
                                    <VideoOff className="w-5 h-5" />
                                    Show Original
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
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/80 border-t border-white/10">
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                        <span>Model: {DECART_MODEL}</span>
                        <span>•</span>
                        <span>{VIDEO_CONFIG.width}x{VIDEO_CONFIG.height}@{VIDEO_CONFIG.frameRate}fps</span>
                        <span>•</span>
                        <span>Powered by Decart AI WebRTC</span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default LiveVTON;
