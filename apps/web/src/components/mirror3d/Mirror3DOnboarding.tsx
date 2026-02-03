/**
 * @fileoverview 3D Mirror Onboarding Component
 * Handles camera permission, photo capture, and body calibration
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  User,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { OnboardingStep, UserProfile, BodyScales } from './types';
import {
  DEFAULT_BODY_SCALES,
  createDefaultUserProfile,
  STORAGE_KEYS,
} from './types';

interface Mirror3DOnboardingProps {
  onComplete: (profile: UserProfile) => void;
  onSkip?: () => void;
}

/**
 * Onboarding flow for the 3D Mirror
 */
export function Mirror3DOnboarding({ onComplete, onSkip }: Mirror3DOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<{
    front?: string;
    side?: string;
    angle45?: string;
  }>({});
  const [bodyScales, setBodyScales] = useState<BodyScales>(DEFAULT_BODY_SCALES);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Request camera permission
   */
  const requestCameraPermission = useCallback(async () => {
    try {
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

      setCameraPermission('granted');
      setStep('photo-front');
    } catch (err) {
      console.error('Camera permission denied:', err);
      setCameraPermission('denied');
      setError('Camera access denied. Please enable camera permissions in your browser settings.');
    }
  }, []);

  /**
   * Capture a photo from the video stream
   */
  const capturePhoto = useCallback(async (type: 'front' | 'side' | 'angle45') => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    // Brief delay for user to prepare
    await new Promise((resolve) => setTimeout(resolve, 500));

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Mirror the image for selfie view
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    // Get data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    setCapturedPhotos((prev) => ({
      ...prev,
      [type]: dataUrl,
    }));

    setIsCapturing(false);

    // Move to next step
    if (type === 'front') {
      setStep('photo-side');
    } else if (type === 'side') {
      setStep('photo-angle');
    } else {
      setStep('calibrate');
    }
  }, []);

  /**
   * Stop the camera stream
   */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  /**
   * Complete onboarding
   */
  const handleComplete = useCallback(() => {
    stopCamera();

    const profile: UserProfile = {
      ...createDefaultUserProfile(),
      bodyScales,
      capturedPhotos,
    };

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEYS.CALIBRATION_COMPLETE, 'true');

    onComplete(profile);
  }, [bodyScales, capturedPhotos, onComplete, stopCamera]);

  /**
   * Skip onboarding
   */
  const handleSkip = useCallback(() => {
    stopCamera();
    localStorage.setItem(STORAGE_KEYS.CALIBRATION_COMPLETE, 'true');
    onSkip?.();
  }, [onSkip, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  /**
   * Render the current step
   */
  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Create Your 3D Avatar
              </h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Take a few photos to create a personalized avatar that matches your body proportions
                for the most accurate virtual try-on experience.
              </p>
            </div>

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={() => setStep('camera')}
                className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Get Started
                <ChevronRight className="w-5 h-5" />
              </button>

              {onSkip && (
                <button
                  onClick={handleSkip}
                  className="w-full py-3 px-6 text-gray-400 hover:text-white font-medium transition-colors"
                >
                  Skip for now
                </button>
              )}
            </div>
          </motion.div>
        );

      case 'camera':
        return (
          <motion.div
            key="camera"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <Camera className="w-10 h-10 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Camera Access Required
              </h2>
              <p className="text-gray-400 max-w-md mx-auto">
                We need access to your camera to capture photos for your avatar.
                Your photos are stored locally and never uploaded.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-3 rounded-lg max-w-md mx-auto">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={requestCameraPermission}
                disabled={cameraPermission === 'granted'}
                className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {cameraPermission === 'granted' ? (
                  <>
                    <Check className="w-5 h-5" />
                    Camera Enabled
                  </>
                ) : (
                  <>
                    Enable Camera
                    <Camera className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                onClick={() => setStep('welcome')}
                className="w-full py-3 px-6 text-gray-400 hover:text-white font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
            </div>
          </motion.div>
        );

      case 'photo-front':
      case 'photo-side':
      case 'photo-angle':
        const photoType = step.replace('photo-', '') as 'front' | 'side' | 'angle45';
        const photoInstructions = {
          front: 'Stand facing the camera with arms slightly away from your body',
          side: 'Turn 90° to show your side profile',
          angle45: 'Turn 45° for a three-quarter view',
        };

        const currentPhoto = capturedPhotos[photoType === 'angle45' ? 'angle45' : photoType];

        return (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">
                {photoType === 'front' ? 'Front View' :
                  photoType === 'side' ? 'Side View' : '45° Angle View'}
              </h2>
              <p className="text-gray-400 text-sm">
                {photoInstructions[photoType === 'angle45' ? 'angle45' : photoType]}
              </p>
            </div>

            {/* Camera Preview */}
            <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black rounded-xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Overlay guide */}
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 133">
                  {/* Body outline guide */}
                  <ellipse
                    cx="50"
                    cy="66"
                    rx="25"
                    ry="45"
                    fill="none"
                    stroke="rgba(34, 197, 94, 0.5)"
                    strokeWidth="0.5"
                    strokeDasharray="2 2"
                  />
                  {/* Head guide */}
                  <circle
                    cx="50"
                    cy="18"
                    r="12"
                    fill="none"
                    stroke="rgba(34, 197, 94, 0.5)"
                    strokeWidth="0.5"
                    strokeDasharray="2 2"
                  />
                </svg>
              </div>

              {/* Captured preview overlay */}
              {currentPhoto && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <img
                    src={currentPhoto}
                    alt="Captured"
                    className="max-w-[80%] max-h-[80%] object-contain rounded-lg"
                  />
                </div>
              )}

              {/* Capturing indicator */}
              {isCapturing && (
                <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-white rounded-full animate-ping" />
                </div>
              )}
            </div>

            {/* Progress indicators */}
            <div className="flex justify-center gap-2">
              {['front', 'side', 'angle45'].map((type) => (
                <div
                  key={type}
                  className={`w-3 h-3 rounded-full transition-colors ${capturedPhotos[type as keyof typeof capturedPhotos]
                      ? 'bg-emerald-500'
                      : type === photoType
                        ? 'bg-white'
                        : 'bg-gray-600'
                    }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 max-w-sm mx-auto">
              {currentPhoto ? (
                <>
                  <button
                    onClick={() => {
                      setCapturedPhotos((prev) => ({ ...prev, [photoType]: undefined }));
                    }}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Retake
                  </button>
                  <button
                    onClick={() => {
                      if (photoType === 'front') setStep('photo-side');
                      else if (photoType === 'side') setStep('photo-angle');
                      else setStep('calibrate');
                    }}
                    className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    Continue
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => capturePhoto(photoType === 'angle45' ? 'angle45' : photoType)}
                  disabled={isCapturing}
                  className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {isCapturing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5" />
                      Capture Photo
                    </>
                  )}
                </button>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        );

      case 'calibrate':
        return (
          <motion.div
            key="calibrate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">
                Fine-tune Your Avatar
              </h2>
              <p className="text-gray-400 text-sm">
                Adjust these sliders to match your body proportions
              </p>
            </div>

            {/* Calibration Sliders */}
            <div className="space-y-4 max-w-sm mx-auto">
              {[
                { key: 'height', label: 'Height', min: 0.8, max: 1.2 },
                { key: 'shoulderWidth', label: 'Shoulders', min: 0.8, max: 1.3 },
                { key: 'torsoWidth', label: 'Torso', min: 0.8, max: 1.3 },
                { key: 'hipWidth', label: 'Hips', min: 0.8, max: 1.3 },
              ].map(({ key, label, min, max }) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-mono">
                      {(bodyScales[key as keyof BodyScales] * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.01}
                    value={bodyScales[key as keyof BodyScales]}
                    onChange={(e) => setBodyScales((prev) => ({
                      ...prev,
                      [key]: parseFloat(e.target.value),
                    }))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              ))}
            </div>

            {/* Photo preview */}
            <div className="flex gap-2 justify-center">
              {Object.entries(capturedPhotos).map(([type, url]) => (
                url && (
                  <img
                    key={type}
                    src={url}
                    alt={type}
                    className="w-16 h-20 object-cover rounded-lg border border-gray-700"
                  />
                )
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 max-w-sm mx-auto">
              <button
                onClick={() => setStep('photo-angle')}
                className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Complete
                <Check className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Mirror3DOnboarding;
