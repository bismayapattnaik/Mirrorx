import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, Sparkles, RotateCcw, Video,
  VideoOff, ChevronLeft, ChevronRight, ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FaceLandmarker,
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from '@mediapipe/tasks-vision';

interface ClothingItem {
  id: string;
  name: string;
  image: string;
  category: string;
  price: number;
}

interface Avatar3DTryOnProps {
  isOpen: boolean;
  onClose: () => void;
  clothing: ClothingItem[];
  onAddToCart?: (item: ClothingItem) => void;
}

type TrackingMode = 'face' | 'pose' | 'both';

export default function Avatar3DTryOn({ isOpen, onClose, clothing, onAddToCart }: Avatar3DTryOnProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing camera...');
  const [error, setError] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('both');
  const [currentClothingIndex, setCurrentClothingIndex] = useState(0);
  const [showClothing, setShowClothing] = useState(true);

  // MediaPipe instances
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  const currentClothing = clothing[currentClothingIndex];

  // Initialize MediaPipe
  const initializeMediaPipe = useCallback(async () => {
    try {
      setLoadingMessage('Loading AI models...');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Initialize Face Landmarker
      setLoadingMessage('Loading face tracking...');
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });

      // Initialize Pose Landmarker
      setLoadingMessage('Loading body tracking...');
      poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      setLoadingMessage('Starting camera...');
      return true;
    } catch (err) {
      console.error('MediaPipe initialization error:', err);
      setError('Failed to load AI models. Please try again.');
      return false;
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraOn(true);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied. Please allow camera access to use 3D try-on.');
      setIsLoading(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  }, []);

  // Detection loop
  const runDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current) return;
    if (!faceLandmarkerRef.current || !poseLandmarkerRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');

    if (!ctx || !overlayCtx) return;

    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    overlayCanvas.width = video.videoWidth;
    overlayCanvas.height = video.videoHeight;

    const detect = () => {
      if (!video.paused && !video.ended && isCameraOn) {
        const timestamp = performance.now();

        // Clear canvases
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        // Draw video frame (mirrored)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        const drawingUtils = new DrawingUtils(ctx);

        // Face detection
        if (trackingMode === 'face' || trackingMode === 'both') {
          const faceResults = faceLandmarkerRef.current?.detectForVideo(video, timestamp);

          if (faceResults?.faceLandmarks) {
            for (const landmarks of faceResults.faceLandmarks) {
              // Mirror landmarks for display (add visibility for type compatibility)
              const mirroredLandmarks = landmarks.map(l => ({
                x: 1 - l.x,
                y: l.y,
                z: l.z,
                visibility: 1, // Face landmarks are always visible
              }));

              // Draw face mesh
              drawingUtils.drawConnectors(
                mirroredLandmarks,
                FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                { color: '#C0C0C070', lineWidth: 1 }
              );

              // Draw face contours
              drawingUtils.drawConnectors(
                mirroredLandmarks,
                FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
                { color: '#E0E0E0', lineWidth: 2 }
              );

              // Draw lips
              drawingUtils.drawConnectors(
                mirroredLandmarks,
                FaceLandmarker.FACE_LANDMARKS_LIPS,
                { color: '#FF6B9D', lineWidth: 2 }
              );

              // Draw eyes
              drawingUtils.drawConnectors(
                mirroredLandmarks,
                FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
                { color: '#30FF30', lineWidth: 1 }
              );
              drawingUtils.drawConnectors(
                mirroredLandmarks,
                FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
                { color: '#30FF30', lineWidth: 1 }
              );

              // Draw eyebrows
              drawingUtils.drawConnectors(
                mirroredLandmarks,
                FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
                { color: '#FF9030', lineWidth: 2 }
              );
              drawingUtils.drawConnectors(
                mirroredLandmarks,
                FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
                { color: '#FF9030', lineWidth: 2 }
              );
            }
          }
        }

        // Pose detection
        if (trackingMode === 'pose' || trackingMode === 'both') {
          const poseResults = poseLandmarkerRef.current?.detectForVideo(video, timestamp);

          if (poseResults?.landmarks) {
            for (const landmarks of poseResults.landmarks) {
              // Mirror landmarks
              const mirroredLandmarks = landmarks.map(l => ({
                x: 1 - l.x,
                y: l.y,
                z: l.z,
                visibility: l.visibility,
              }));

              // Draw pose skeleton
              drawingUtils.drawConnectors(
                mirroredLandmarks,
                PoseLandmarker.POSE_CONNECTIONS,
                { color: '#00FF00', lineWidth: 4 }
              );

              // Draw pose landmarks
              drawingUtils.drawLandmarks(mirroredLandmarks, {
                color: '#FF0000',
                lineWidth: 2,
                radius: 5,
              });

              // Draw clothing overlay on torso
              if (showClothing && currentClothing) {
                drawClothingOverlay(overlayCtx, mirroredLandmarks, overlayCanvas.width, overlayCanvas.height);
              }
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, [isCameraOn, trackingMode, showClothing, currentClothing]);

  // Draw clothing overlay on detected body
  const drawClothingOverlay = (
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>,
    width: number,
    height: number
  ) => {
    // Key pose landmarks:
    // 11: left shoulder, 12: right shoulder
    // 23: left hip, 24: right hip
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return;

    // Check visibility
    const minVisibility = 0.5;
    if (
      (leftShoulder.visibility || 0) < minVisibility ||
      (rightShoulder.visibility || 0) < minVisibility
    ) return;

    // Calculate torso bounds
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x) * width;
    const torsoHeight = Math.abs(leftHip.y - leftShoulder.y) * height;

    // Calculate center and dimensions for clothing
    const centerX = ((leftShoulder.x + rightShoulder.x) / 2) * width;
    const topY = Math.min(leftShoulder.y, rightShoulder.y) * height;

    // Expand the clothing area
    const clothingWidth = shoulderWidth * 1.8;
    const clothingHeight = torsoHeight * 1.4;

    // Draw semi-transparent clothing preview
    ctx.save();
    ctx.globalAlpha = 0.7;

    // Create gradient overlay effect
    const gradient = ctx.createLinearGradient(
      centerX - clothingWidth / 2,
      topY - 20,
      centerX + clothingWidth / 2,
      topY + clothingHeight
    );
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.6)');
    gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.3)');

    // Draw clothing shape (simplified torso outline)
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(centerX - clothingWidth / 2 - 20, topY - 10);
    ctx.lineTo(centerX + clothingWidth / 2 + 20, topY - 10);
    ctx.lineTo(centerX + clothingWidth / 2 + 10, topY + clothingHeight);
    ctx.lineTo(centerX - clothingWidth / 2 - 10, topY + clothingHeight);
    ctx.closePath();
    ctx.fill();

    // Draw clothing border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw clothing name
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(currentClothing?.name || '', centerX, topY + clothingHeight + 25);

    ctx.restore();
  };

  // Initialize on mount
  useEffect(() => {
    if (isOpen) {
      const init = async () => {
        setIsLoading(true);
        setError(null);
        const success = await initializeMediaPipe();
        if (success) {
          await startCamera();
        }
      };
      init();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      stopCamera();
    };
  }, [isOpen, initializeMediaPipe, startCamera, stopCamera]);

  // Start detection when camera is ready
  useEffect(() => {
    if (isCameraOn && !isLoading) {
      runDetection();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isCameraOn, isLoading, runDetection]);

  // Handle close
  const handleClose = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    stopCamera();
    onClose();
  };

  // Navigate clothing
  const nextClothing = () => {
    setCurrentClothingIndex((prev) => (prev + 1) % clothing.length);
  };

  const prevClothing = () => {
    setCurrentClothingIndex((prev) => (prev - 1 + clothing.length) % clothing.length);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={handleClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                <X className="w-5 h-5 text-white" />
              </button>
              <div>
                <h2 className="text-white font-bold">3D Virtual Try-On</h2>
                <p className="text-white/60 text-xs">Real-time body tracking</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tracking Mode Toggle */}
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setTrackingMode('face')}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-all',
                    trackingMode === 'face' ? 'bg-white text-black' : 'text-white/70'
                  )}
                >
                  Face
                </button>
                <button
                  onClick={() => setTrackingMode('pose')}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-all',
                    trackingMode === 'pose' ? 'bg-white text-black' : 'text-white/70'
                  )}
                >
                  Body
                </button>
                <button
                  onClick={() => setTrackingMode('both')}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-all',
                    trackingMode === 'both' ? 'bg-white text-black' : 'text-white/70'
                  )}
                >
                  Both
                </button>
              </div>

              {/* Camera toggle */}
              <button
                onClick={() => isCameraOn ? stopCamera() : startCamera()}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20"
              >
                {isCameraOn ? (
                  <Video className="w-5 h-5 text-green-400" />
                ) : (
                  <VideoOff className="w-5 h-5 text-red-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="h-full flex flex-col">
          {/* Video Container */}
          <div className="flex-1 relative">
            {/* Hidden video element */}
            <video
              ref={videoRef}
              className="hidden"
              playsInline
              muted
            />

            {/* Main canvas (mirrored video + tracking visualization) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain"
            />

            {/* Overlay canvas (clothing) */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Loading State */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
                  <p className="text-white font-medium">{loadingMessage}</p>
                  <p className="text-white/60 text-sm mt-1">This may take a few seconds</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-white font-medium mb-2">Something went wrong</p>
                  <p className="text-white/60 text-sm mb-4">{error}</p>
                  <Button
                    onClick={() => {
                      setError(null);
                      setIsLoading(true);
                      initializeMediaPipe().then(startCamera);
                    }}
                    className="bg-white text-black hover:bg-white/90"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* Clothing Navigation */}
            {!isLoading && !error && clothing.length > 0 && (
              <>
                <button
                  onClick={prevClothing}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={nextClothing}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="bg-gradient-to-t from-black/90 to-transparent p-4 pb-8">
            {/* Current Clothing Info */}
            {currentClothing && (
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={currentClothing.image}
                  alt={currentClothing.name}
                  className="w-16 h-20 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="text-white font-medium">{currentClothing.name}</h3>
                  <p className="text-amber-500 font-bold">
                    ₹{(currentClothing.price / 100).toLocaleString('en-IN')}
                  </p>
                  <p className="text-white/50 text-xs">
                    {currentClothingIndex + 1} of {clothing.length}
                  </p>
                </div>

                {/* Toggle Clothing Overlay */}
                <button
                  onClick={() => setShowClothing(!showClothing)}
                  className={cn(
                    'p-3 rounded-full transition-all',
                    showClothing ? 'bg-purple-500' : 'bg-white/10'
                  )}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </button>
              </div>
            )}

            {/* Clothing Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {clothing.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentClothingIndex(index)}
                  className={cn(
                    'flex-shrink-0 w-14 h-18 rounded-lg overflow-hidden border-2 transition-all',
                    index === currentClothingIndex
                      ? 'border-amber-500 scale-105'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  )}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Add to Cart Button */}
            {currentClothing && onAddToCart && (
              <Button
                onClick={() => onAddToCart(currentClothing)}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-semibold"
              >
                <ShoppingBag className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
