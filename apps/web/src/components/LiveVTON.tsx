/**
 * @fileoverview Live AI Style Effects Component
 *
 * Real-time video style transformation using Decart AI's mirage_v2 model.
 * Apply creative style effects to your live video feed.
 * 
 * NOTE: This is for style effects, not exact clothing matching.
 * For accurate virtual try-on, use the Photo Try-On feature.
 *
 * Model: mirage_v2 (MirageLSD 2.0)
 * Endpoint: wss://api3.decart.ai/v1/stream?model=mirage_v2
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Sparkles, Video, VideoOff,
    Wand2, Wifi, WifiOff, Camera, Palette, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Preset style effects
const STYLE_PRESETS = [
    {
        id: 'formal',
        name: 'Formal Look',
        prompt: 'Transform the person to wear an elegant formal business suit with tie, professional executive appearance, photorealistic',
        icon: '👔',
    },
    {
        id: 'casual',
        name: 'Casual Vibes',
        prompt: 'Transform the person to wear casual streetwear, relaxed modern fashion, comfortable trendy outfit, photorealistic',
        icon: '👕',
    },
    {
        id: 'party',
        name: 'Party Mode',
        prompt: 'Transform the person to wear glamorous party outfit, sparkling festive fashion, celebration ready, photorealistic',
        icon: '✨',
    },
    {
        id: 'anime',
        name: 'Anime Style',
        prompt: 'Transform into anime art style, vibrant colors, anime character appearance, Japanese animation aesthetic',
        icon: '🎌',
    },
    {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        prompt: 'Cyberpunk aesthetic, neon lighting, futuristic tech fashion, glowing accents, sci-fi atmosphere',
        icon: '🌆',
    },
    {
        id: 'vintage',
        name: 'Vintage Classic',
        prompt: 'Vintage retro fashion style, classic 1950s elegant outfit, timeless sophisticated look, film photography aesthetic',
        icon: '📷',
    },
    {
        id: 'royal',
        name: 'Royal Elegance',
        prompt: 'Royal elegant attire, luxurious regal fashion, aristocratic refined style, majestic appearance',
        icon: '👑',
    },
    {
        id: 'athletic',
        name: 'Sporty Active',
        prompt: 'Athletic sporty outfit, modern activewear, fitness fashion, dynamic energetic style, photorealistic',
        icon: '🏃',
    },
];

interface LiveVTONProps {
    isOpen: boolean;
    onClose: () => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// API key from environment
const DECART_API_KEY = import.meta.env.VITE_DECART_API_KEY || 'mirrorx_JSsnNnCHmtYMltDXFJAbMLAXdShCYNKdzhZZDsEZndVJLaIKFPVvUdZrWjiuTAvH';

const MODEL_SPECS = {
    width: 1280,
    height: 720,
    fps: 30,
    model: 'mirage_v2',
};

const DECART_WS_URL = 'wss://api3.decart.ai/v1/stream';

export function LiveVTON({ isOpen, onClose }: LiveVTONProps) {
    // Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    // State
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [showOriginal, setShowOriginal] = useState(false);

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

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                setConnectionState('connected');
            } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                setError('Connection lost. Please reconnect.');
            }
        };

        pc.ontrack = (event) => {
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

            ws.onopen = () => createPeerConnection(stream);

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
                setError('Connection failed. Check your network.');
                setConnectionState('disconnected');
            };

            ws.onclose = () => setConnectionState('disconnected');

        } catch (err: unknown) {
            const error = err as Error;
            if (error.name === 'NotAllowedError') {
                setError('Camera access denied. Please allow camera permissions.');
            } else if (error.name === 'NotFoundError') {
                setError('No camera found.');
            } else {
                setError(`Connection error: ${error.message}`);
            }
            setConnectionState('disconnected');
        }
    }, [connectionState, createPeerConnection]);

    // Apply style effect
    const applyStyle = useCallback((prompt: string, presetId?: string) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            setError('Not connected. Please wait.');
            return;
        }

        setIsTransforming(true);
        setShowOriginal(false);
        setError(null);
        if (presetId) setSelectedPreset(presetId);

        wsRef.current.send(JSON.stringify({
            type: 'prompt',
            prompt: prompt,
        }));
    }, []);

    // Stop effect
    const stopEffect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'prompt',
                prompt: '',
            }));
        }
        setIsTransforming(false);
        setSelectedPreset(null);
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
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 to-transparent">
                    <div className="flex items-center gap-3">
                        <Palette className="w-6 h-6 text-gold-400" />
                        <span className="text-xl font-bold text-white">Live Style Effects</span>
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
                                    {showOriginal ? 'Original' : <><Sparkles className="w-4 h-4" /> AI Styled</>}
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

                        {error && (
                            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg max-w-md text-center">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="w-80 bg-black/90 p-4 flex flex-col gap-4 border-l border-white/10 overflow-y-auto">
                        {/* Info Banner */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex gap-2">
                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-blue-300 text-xs">
                                This applies <strong>creative style effects</strong> to your live video.
                                For exact clothing try-on, use <strong>Photo Try-On</strong> feature.
                            </p>
                        </div>

                        {/* Style Presets */}
                        <div className="space-y-2">
                            <h3 className="text-white font-semibold">Style Effects</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {STYLE_PRESETS.map((preset) => (
                                    <Button
                                        key={preset.id}
                                        variant={selectedPreset === preset.id ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => applyStyle(preset.prompt, preset.id)}
                                        disabled={connectionState !== 'connected'}
                                        className={cn(
                                            "flex flex-col items-center gap-1 h-auto py-3",
                                            selectedPreset === preset.id && "bg-gold-500 text-black"
                                        )}
                                    >
                                        <span className="text-lg">{preset.icon}</span>
                                        <span className="text-xs">{preset.name}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Prompt */}
                        <div className="space-y-2">
                            <label className="text-gray-400 text-sm">Custom Style</label>
                            <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="Describe a style effect..."
                                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white text-sm resize-none h-20 placeholder:text-gray-500"
                            />
                            <Button
                                onClick={() => applyStyle(customPrompt)}
                                disabled={connectionState !== 'connected' || !customPrompt.trim()}
                                size="sm"
                                className="w-full gap-2"
                            >
                                <Wand2 className="w-4 h-4" />
                                Apply Custom Style
                            </Button>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 mt-auto">
                            {isTransforming && (
                                <>
                                    <Button
                                        onClick={() => setShowOriginal(!showOriginal)}
                                        variant="outline"
                                        className="w-full gap-2"
                                    >
                                        {showOriginal ? <Sparkles className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                        {showOriginal ? 'Show Styled' : 'Show Original'}
                                    </Button>
                                    <Button
                                        onClick={stopEffect}
                                        variant="outline"
                                        className="w-full gap-2 border-red-500/50 text-red-400"
                                    >
                                        <VideoOff className="w-5 h-5" />
                                        Stop Effect
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
