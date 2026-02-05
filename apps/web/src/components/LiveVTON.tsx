/**
 * @fileoverview Live Virtual Try-On Component with WebRTC
 *
 * Real-time video try-on using Decart AI's mirage_v2 (MirageLSD) model.
 * User uploads a clothing image, and the AI transforms the video to show
 * them wearing the clothing with realistic lighting and textures.
 *
 * Model: mirage_v2 (MirageLSD 2.0)
 * Endpoint: wss://api3.decart.ai/v1/stream?model=mirage_v2
 * Credit: 1 per second
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Loader2, Sparkles, Video, VideoOff,
    Upload, Image as ImageIcon, Wand2, Wifi, WifiOff, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LiveVTONProps {
    isOpen: boolean;
    onClose: () => void;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// Decart Realtime API settings - Using MirageLSD 2.0
const DECART_WS_URL = 'wss://api3.decart.ai/v1/stream';
const DECART_MODEL = 'mirage_v2'; // MirageLSD 2.0 for realistic style transfer
const API_KEY = import.meta.env.VITE_DECART_API_KEY || '';

// Model specifications for mirage_v2
const MODEL_SPECS = {
    width: 1280,
    height: 720,
    fps: 30,
};

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

    // Generate virtual try-on prompt from uploaded clothing
    const generateTryOnPrompt = useCallback((imageDescription: string) => {
        return `Transform this person to wear the clothing shown in the reference image. ${imageDescription}. Keep the person's face identity exactly the same. Photorealistic quality with accurate lighting, natural fabric textures, proper shadows, and realistic draping. The clothing should look naturally worn, not pasted on.`;
    }, []);

    // Handle image upload
    const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        // Read and convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setUploadedImage(base64);
            setUploadedImageName(file.name);
            setError(null);
        };
        reader.onerror = () => {
            setError('Failed to read image file');
        };
        reader.readAsDataURL(file);
    }, []);

    // Trigger file input
    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    // Connect to Decart WebRTC
    const connect = useCallback(async () => {
        if (connectionState === 'connecting' || connectionState === 'connected') return;

        try {
            setConnectionState('connecting');
            setError(null);

            // Get user's camera with model specifications
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
            }

            // Connect WebSocket with API key and model
            const wsUrl = `${DECART_WS_URL}?api_key=${API_KEY}&model=${DECART_MODEL}`;
            console.log('[LiveVTON] Connecting to:', wsUrl.replace(API_KEY, '***'));

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[LiveVTON] WebSocket connected');
                createPeerConnection(stream);
            };

            ws.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('[LiveVTON] Message received:', message.type);

                    if (message.type === 'answer' && pcRef.current) {
                        await pcRef.current.setRemoteDescription({
                            type: 'answer',
                            sdp: message.sdp,
                        });
                        setConnectionState('connected');
                        console.log('[LiveVTON] WebRTC connected successfully');
                    }

                    if (message.type === 'ice-candidate' && pcRef.current && message.candidate) {
                        try {
                            await pcRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
                        } catch (err) {
                            console.warn('[LiveVTON] ICE candidate error:', err);
                        }
                    }

                    if (message.type === 'error') {
                        console.error('[LiveVTON] Server error:', message.message);
                        setError(message.message || 'Server error occurred');
                    }
                } catch (err) {
                    console.error('[LiveVTON] Message parse error:', err);
                }
            };

            ws.onerror = (err) => {
                console.error('[LiveVTON] WebSocket error:', err);
                setError('Connection failed. Please check your API key and try again.');
                setConnectionState('disconnected');
            };

            ws.onclose = (event) => {
                console.log('[LiveVTON] WebSocket closed:', event.code, event.reason);
                if (connectionState === 'connected') {
                    setError('Connection lost. Please reconnect.');
                }
                setConnectionState('disconnected');
            };

        } catch (err: any) {
            console.error('[LiveVTON] Connection error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Camera access denied. Please allow camera permissions and try again.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera found. Please connect a camera and try again.');
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

        // Handle ICE connection state
        pc.oniceconnectionstatechange = () => {
            console.log('[LiveVTON] ICE state:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                setError('Connection failed. Please try again.');
                setConnectionState('disconnected');
            }
        };

        // Send ICE candidates to server
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
            console.log('[LiveVTON] Received transformed stream');
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        // Add local video track
        stream.getTracks().forEach((track) => {
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
            console.log('[LiveVTON] Offer sent');
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
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        setConnectionState('disconnected');
        setIsTransforming(false);
        setCurrentPrompt('');
    }, []);

    // Start virtual try-on transformation
    const startTryOn = useCallback(async () => {
        if (!uploadedImage) {
            setError('Please upload a clothing image first');
            return;
        }

        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            setError('Not connected. Please wait for connection.');
            return;
        }

        setIsTransforming(true);
        setError(null);

        // Generate prompt for clothing try-on
        const prompt = generateTryOnPrompt(
            'Realistic virtual try-on. Show the person wearing this exact clothing with proper fit, natural lighting, accurate shadows, and photorealistic fabric texture.'
        );
        setCurrentPrompt(prompt);

        // Send prompt to start transformation
        wsRef.current.send(JSON.stringify({
            type: 'prompt',
            prompt: prompt,
        }));

        // Send reference image (the clothing)
        wsRef.current.send(JSON.stringify({
            type: 'reference_image',
            image: uploadedImage,
        }));

        console.log('[LiveVTON] Started try-on with prompt:', prompt);
    }, [uploadedImage, generateTryOnPrompt]);

    // Stop transformation
    const stopTryOn = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            // Send empty prompt to stop transformation
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
                        {/* Show original or transformed video */}
                        {showOriginal || !isTransforming ? (
                            <video
                                ref={localVideoRef}
                                className="w-full h-full object-cover"
                                playsInline
                                muted
                                autoPlay
                                style={{ transform: 'scaleX(-1)' }}
                            />
                        ) : (
                            <video
                                ref={remoteVideoRef}
                                className="w-full h-full object-cover"
                                playsInline
                                autoPlay
                                style={{ transform: 'scaleX(-1)' }}
                            />
                        )}

                        {/* Video label */}
                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                            {isTransforming && !showOriginal && (
                                <span className="bg-gold-500/20 text-gold-400 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    AI Transformed
                                </span>
                            )}
                            {showOriginal && (
                                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm">
                                    Original
                                </span>
                            )}
                        </div>

                        {/* Connection Overlay */}
                        {connectionState !== 'connected' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                                {connectionState === 'connecting' ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-16 h-16 text-gold-400 animate-spin" />
                                        <span className="text-white text-xl">Connecting to AI...</span>
                                        <span className="text-gray-400 text-sm">Setting up WebRTC stream</span>
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

                    {/* Sidebar - Upload & Controls */}
                    <div className="w-96 bg-black/90 p-6 flex flex-col gap-6 border-l border-white/10">
                        <h2 className="text-xl font-bold text-white">Upload Clothing</h2>

                        {/* Upload Area */}
                        <div
                            onClick={triggerFileUpload}
                            className={cn(
                                "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[200px]",
                                uploadedImage
                                    ? "border-gold-500/50 bg-gold-500/5"
                                    : "border-white/20 hover:border-white/40 hover:bg-white/5"
                            )}
                        >
                            {uploadedImage ? (
                                <>
                                    <img
                                        src={uploadedImage}
                                        alt="Uploaded clothing"
                                        className="max-h-40 object-contain rounded-lg mb-3"
                                    />
                                    <span className="text-white text-sm truncate max-w-full">{uploadedImageName}</span>
                                    <span className="text-gray-400 text-xs mt-1">Click to change</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                                    <span className="text-white font-medium">Upload Clothing Image</span>
                                    <span className="text-gray-400 text-sm mt-1">PNG, JPG up to 10MB</span>
                                </>
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="bg-white/5 rounded-lg p-4 space-y-2">
                            <h3 className="text-white font-medium text-sm">How it works:</h3>
                            <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                                <li>Upload a clothing image (shirt, dress, etc.)</li>
                                <li>Click "Start Try-On" to see yourself wearing it</li>
                                <li>The AI will transform you in real-time!</li>
                            </ol>
                        </div>

                        {/* Current Prompt (when active) */}
                        {isTransforming && currentPrompt && (
                            <div className="p-3 bg-gold-500/10 rounded-lg border border-gold-500/30">
                                <p className="text-gold-400 text-xs line-clamp-3">{currentPrompt}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-3 mt-auto">
                            {!isTransforming ? (
                                <Button
                                    onClick={startTryOn}
                                    disabled={connectionState !== 'connected' || !uploadedImage}
                                    size="lg"
                                    className="w-full gap-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold"
                                >
                                    <Wand2 className="w-5 h-5" />
                                    Start Try-On
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => setShowOriginal(!showOriginal)}
                                        variant="outline"
                                        size="lg"
                                        className="w-full gap-2"
                                    >
                                        {showOriginal ? <Sparkles className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                                        {showOriginal ? 'Show Transformed' : 'Show Original'}
                                    </Button>
                                    <Button
                                        onClick={stopTryOn}
                                        variant="outline"
                                        size="lg"
                                        className="w-full gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
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
                        <span>Model: MirageLSD 2.0 ({DECART_MODEL})</span>
                        <span>•</span>
                        <span>{MODEL_SPECS.width}x{MODEL_SPECS.height}@{MODEL_SPECS.fps}fps</span>
                        <span>•</span>
                        <span>1 Credit/Second</span>
                        <span>•</span>
                        <span>Powered by Decart AI</span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default LiveVTON;
