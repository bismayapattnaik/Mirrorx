/**
 * @fileoverview Main 3D Mirror View Component
 * Live webcam feed with 3D avatar overlay
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  CameraOff,
  Settings,
  Shirt,
  RefreshCw,
  Activity,
  ChevronUp,
  ChevronDown,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useMirror3D } from './useMirror3D';
import type { GarmentMetadata, BodyScales } from './types';
import { SAMPLE_GARMENTS } from './types';

interface Mirror3DViewProps {
  onBack?: () => void;
}

/**
 * Main 3D Mirror component with live tracking and garment overlay
 */
export function Mirror3DView({ onBack }: Mirror3DViewProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // UI State
  const [showGarmentPanel, setShowGarmentPanel] = useState(true);
  const [showCalibrationPanel, setShowCalibrationPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('top');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Mirror3D hook
  const {
    isTracking,
    status,
    userProfile,
    equippedGarments,
    initialize,
    startTracking,
    stopTracking,
    equipGarment,
    updateBodyScales,
    saveUserProfile,
  } = useMirror3D({
    containerRef,
    videoRef,
  });

  /**
   * Start camera stream
   */
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);

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
      }

      // Initialize 3D system
      await initialize();

      // Start tracking
      await startTracking();
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Failed to access camera. Please check permissions.');
    }
  }, [initialize, startTracking]);

  /**
   * Stop camera stream
   */
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    stopTracking();
  }, [stopTracking]);

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  /**
   * Handle garment selection
   */
  const handleGarmentSelect = async (garment: GarmentMetadata) => {
    try {
      await equipGarment(garment);
    } catch (err) {
      console.error('Failed to equip garment:', err);
    }
  };

  /**
   * Handle body scale change
   */
  const handleScaleChange = (key: keyof BodyScales, value: number) => {
    updateBodyScales({ [key]: value });
  };

  /**
   * Group garments by category
   */
  const garmentsByCategory = SAMPLE_GARMENTS.reduce((acc, garment) => {
    if (!acc[garment.category]) {
      acc[garment.category] = [];
    }
    acc[garment.category].push(garment);
    return acc;
  }, {} as Record<string, GarmentMetadata[]>);

  const categories = Object.keys(garmentsByCategory);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden"
    >
      {/* Video Background (hidden, used for tracking) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* 3D Canvas will be appended here by Three.js */}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {/* FPS Counter */}
          <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg flex items-center gap-2">
            <Activity className={`w-4 h-4 ${status.currentFps > 20 ? 'text-emerald-400' : 'text-yellow-400'}`} />
            <span className="text-white text-sm font-mono">{status.currentFps} FPS</span>
          </div>

          {/* Tracking Confidence */}
          <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${status.confidence > 0.7 ? 'bg-emerald-400' :
                status.confidence > 0.4 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
            />
            <span className="text-white text-sm">
              {Math.round(status.confidence * 100)}%
            </span>
          </div>

          {/* Camera Toggle */}
          <button
            onClick={isTracking ? stopCamera : startCamera}
            className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${isTracking
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              }`}
          >
            {isTracking ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Camera Error */}
      {cameraError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="px-4 py-3 bg-red-500/90 text-white rounded-lg flex items-center gap-2">
            <CameraOff className="w-5 h-5" />
            <span>{cameraError}</span>
            <button
              onClick={startCamera}
              className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Calibration Panel */}
        <AnimatePresence>
          {showCalibrationPanel && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="mx-4 mb-4 p-4 bg-black/80 backdrop-blur-lg rounded-xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Body Calibration
                </h3>
                <button
                  onClick={() => setShowCalibrationPanel(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'height', label: 'Height', min: 0.8, max: 1.2 },
                  { key: 'shoulderWidth', label: 'Shoulders', min: 0.8, max: 1.3 },
                  { key: 'torsoWidth', label: 'Torso', min: 0.8, max: 1.3 },
                  { key: 'hipWidth', label: 'Hips', min: 0.8, max: 1.3 },
                ].map(({ key, label, min, max }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{label}</span>
                      <span className="text-white font-mono">
                        {(userProfile.bodyScales[key as keyof BodyScales] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={0.01}
                      value={userProfile.bodyScales[key as keyof BodyScales]}
                      onChange={(e) => handleScaleChange(key as keyof BodyScales, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={saveUserProfile}
                className="w-full mt-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save Settings
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Garment Panel */}
        <div className="bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-8">
          {/* Panel Toggle */}
          <div className="flex justify-center mb-2">
            <button
              onClick={() => setShowGarmentPanel(!showGarmentPanel)}
              className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
            >
              {showGarmentPanel ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>

          <AnimatePresence>
            {showGarmentPanel && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="px-4 pb-6"
              >
                {/* Category Tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === category
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}

                  {/* Calibration Toggle */}
                  <button
                    onClick={() => setShowCalibrationPanel(!showCalibrationPanel)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${showCalibrationPanel
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {/* Garment Grid */}
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {garmentsByCategory[selectedCategory]?.map((garment) => {
                    const isEquipped = equippedGarments.includes(garment.id);

                    return (
                      <motion.button
                        key={garment.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleGarmentSelect(garment)}
                        className={`flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden relative transition-all ${isEquipped
                          ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-black'
                          : 'ring-1 ring-white/20 hover:ring-white/40'
                          }`}
                      >
                        {/* Thumbnail or placeholder */}
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                          <Shirt className="w-8 h-8 text-gray-500" />
                        </div>

                        {garment.thumbnailUrl && (
                          <img
                            src={garment.thumbnailUrl}
                            alt={garment.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}

                        {/* Equipped indicator */}
                        {isEquipped && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}

                        {/* Name overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white text-xs truncate">{garment.name}</p>
                          {garment.price && (
                            <p className="text-emerald-400 text-xs font-medium">
                              ${garment.price}
                            </p>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}

                  {/* Empty state */}
                  {(!garmentsByCategory[selectedCategory] || garmentsByCategory[selectedCategory].length === 0) && (
                    <div className="flex-1 min-h-[96px] flex items-center justify-center text-gray-500 text-sm">
                      No garments in this category
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default Mirror3DView;
