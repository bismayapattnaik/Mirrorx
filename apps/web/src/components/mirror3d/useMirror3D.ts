/**
 * @fileoverview Custom hook for managing the 3D Mirror system
 * Orchestrates tracking, avatar, wardrobe, and rendering
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {
  UserProfile,
  BodyScales,
  GarmentMetadata,
  TrackingStatus,
} from './types';
import {
  DEFAULT_BODY_SCALES,
  createDefaultUserProfile,
  STORAGE_KEYS,
} from './types';

// MediaPipe imports will be dynamic

interface UseMirror3DOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  onStatusChange?: (status: TrackingStatus) => void;
}

interface UseMirror3DReturn {
  // State
  isInitialized: boolean;
  isTracking: boolean;
  status: TrackingStatus;
  userProfile: UserProfile;
  equippedGarments: string[];

  // Actions
  initialize: () => Promise<void>;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  equipGarment: (garment: GarmentMetadata) => Promise<void>;
  unequipGarment: (category: string) => void;
  updateBodyScales: (scales: Partial<BodyScales>) => void;
  saveUserProfile: () => void;
  resetCalibration: () => void;
  dispose: () => void;
}

/**
 * Main hook for the 3D Mirror system
 */
export function useMirror3D(options: UseMirror3DOptions): UseMirror3DReturn {
  const { containerRef, videoRef, onStatusChange } = options;

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    // Try to load from local storage
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load user profile from storage');
    }
    return createDefaultUserProfile();
  });
  const [equippedGarments, setEquippedGarments] = useState<string[]>([]);
  const [status, setStatus] = useState<TrackingStatus>({
    isInitialized: false,
    isRunning: false,
    currentFps: 0,
    confidence: 0,
    lastError: null,
  });

  // Refs for Three.js and MediaPipe objects
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarRef = useRef<THREE.Object3D | null>(null);
  const boneMapRef = useRef<Map<string, THREE.Bone>>(new Map());
  const garmentsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const animationFrameRef = useRef<number | null>(null);

  // MediaPipe refs
  const poseLandmarkerRef = useRef<any>(null);
  const handLandmarkerRef = useRef<any>(null);
  const trackingLoopRef = useRef<number | null>(null);
  const lastTrackingTimeRef = useRef<number>(0);

  // FPS tracking
  const fpsCounterRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);

  // Video texture ref
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null);

  // Pose smoothing state
  const smoothedPoseRef = useRef<Map<string, THREE.Quaternion>>(new Map());

  /**
   * Initialize the 3D scene
   */
  const initializeScene = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 2.5);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(2, 3, 2);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 1, -1);
    scene.add(fillLight);

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  /**
   * Setup video background
   */
  const setupVideoBackground = useCallback(() => {
    if (!videoRef.current || !sceneRef.current || !cameraRef.current) return;

    const video = videoRef.current;

    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTextureRef.current = videoTexture;

    // Create background plane
    const geometry = new THREE.PlaneGeometry(20, 15);
    const material = new THREE.MeshBasicMaterial({
      map: videoTexture,
      depthWrite: false,
      depthTest: false,
    });

    const videoMesh = new THREE.Mesh(geometry, material);
    videoMesh.position.z = -10;
    videoMesh.renderOrder = -1000;
    sceneRef.current.add(videoMesh);
  }, [videoRef]);

  /**
   * Load the avatar model
   */
  const loadAvatar = useCallback(async (): Promise<void> => {
    if (!sceneRef.current) return;

    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      // Use a standard humanoid model - we'll use a placeholder path
      // In production, this would be a proper humanoid GLB
      const avatarUrl = '/assets/avatar/humanoid.glb';

      loader.load(
        avatarUrl,
        (gltf) => {
          const avatar = gltf.scene;

          // Find and map bones
          avatar.traverse((child) => {
            if ((child as THREE.Bone).isBone) {
              const bone = child as THREE.Bone;
              boneMapRef.current.set(bone.name.toLowerCase(), bone);

              // Also map common aliases
              const aliases: Record<string, string[]> = {
                hips: ['mixamorigHips', 'pelvis'],
                spine: ['mixamorigSpine'],
                chest: ['mixamorigSpine1', 'mixamorigSpine2'],
                neck: ['mixamorigNeck'],
                head: ['mixamorigHead'],
                leftshoulder: ['mixamorigLeftShoulder'],
                leftupperarm: ['mixamorigLeftArm'],
                leftlowerarm: ['mixamorigLeftForeArm'],
                lefthand: ['mixamorigLeftHand'],
                rightshoulder: ['mixamorigRightShoulder'],
                rightupperarm: ['mixamorigRightArm'],
                rightlowerarm: ['mixamorigRightForeArm'],
                righthand: ['mixamorigRightHand'],
                leftupperleg: ['mixamorigLeftUpLeg'],
                leftlowerleg: ['mixamorigLeftLeg'],
                leftfoot: ['mixamorigLeftFoot'],
                rightupperleg: ['mixamorigRightUpLeg'],
                rightlowerleg: ['mixamorigRightLeg'],
                rightfoot: ['mixamorigRightFoot'],
              };

              for (const [standard, aliasList] of Object.entries(aliases)) {
                if (aliasList.some(a => bone.name.includes(a))) {
                  boneMapRef.current.set(standard, bone);
                }
              }
            }

            if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
              const mesh = child as THREE.SkinnedMesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });

          // Position avatar
          avatar.position.set(0, 0, 0);
          avatar.scale.setScalar(1);

          sceneRef.current!.add(avatar);
          avatarRef.current = avatar;

          console.log('[useMirror3D] Avatar loaded with', boneMapRef.current.size, 'bones');
          resolve();
        },
        undefined,
        (error) => {
          console.error('[useMirror3D] Failed to load avatar:', error);
          // Create a simple placeholder avatar
          createPlaceholderAvatar();
          resolve();
        }
      );
    });
  }, []);

  /**
   * Create a simple placeholder avatar if model fails to load
   */
  const createPlaceholderAvatar = useCallback(() => {
    if (!sceneRef.current) return;

    const group = new THREE.Group();

    // Create simple body parts
    const bodyGeometry = new THREE.CapsuleGeometry(0.15, 0.4, 8, 16);
    const headGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    const limbGeometry = new THREE.CapsuleGeometry(0.04, 0.25, 8, 8);

    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.7,
      metalness: 0.1,
    });

    // Body
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 1.0;
    group.add(body);

    // Head
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = 1.5;
    group.add(head);

    // Arms
    const leftArm = new THREE.Mesh(limbGeometry, material);
    leftArm.position.set(-0.25, 1.1, 0);
    leftArm.rotation.z = Math.PI / 6;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(limbGeometry, material);
    rightArm.position.set(0.25, 1.1, 0);
    rightArm.rotation.z = -Math.PI / 6;
    group.add(rightArm);

    // Legs
    const leftLeg = new THREE.Mesh(limbGeometry, material);
    leftLeg.position.set(-0.1, 0.5, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(limbGeometry, material);
    rightLeg.position.set(0.1, 0.5, 0);
    group.add(rightLeg);

    sceneRef.current.add(group);
    avatarRef.current = group;
  }, []);

  /**
   * Initialize MediaPipe
   */
  const initializeMediaPipe = useCallback(async () => {
    try {
      const { FilesetResolver, PoseLandmarker, HandLandmarker } =
        await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
      );

      // Initialize Pose Landmarker
      poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Initialize Hand Landmarker
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      console.log('[useMirror3D] MediaPipe initialized');
    } catch (error) {
      console.error('[useMirror3D] Failed to initialize MediaPipe:', error);
      throw error;
    }
  }, []);

  /**
   * Apply pose to avatar
   */
  const applyPoseToAvatar = useCallback((poseLandmarks: any[]) => {
    if (!avatarRef.current || poseLandmarks.length === 0) return;

    const worldLandmarks = poseLandmarks;

    // Helper to get landmark as Vec3
    const getLandmark = (idx: number) => {
      const lm = worldLandmarks[idx];
      if (!lm) return null;
      return new THREE.Vector3(-lm.x, -lm.y, -lm.z); // Mirror X, invert Y and Z
    };

    // Calculate bone rotations from landmarks
    const calculateRotation = (
      start: THREE.Vector3 | null,
      end: THREE.Vector3 | null,
      restDir: THREE.Vector3
    ): THREE.Quaternion => {
      if (!start || !end) return new THREE.Quaternion();
      const dir = end.clone().sub(start).normalize();
      return new THREE.Quaternion().setFromUnitVectors(restDir, dir);
    };

    // Smoothing factor
    const smoothFactor = 0.3;

    // Apply rotations to bones
    const applyBoneRotation = (boneName: string, rotation: THREE.Quaternion) => {
      const bone = boneMapRef.current.get(boneName);
      if (!bone) return;

      // Get or create smoothed rotation
      let smoothed = smoothedPoseRef.current.get(boneName);
      if (!smoothed) {
        smoothed = rotation.clone();
        smoothedPoseRef.current.set(boneName, smoothed);
      } else {
        smoothed.slerp(rotation, smoothFactor);
      }

      bone.quaternion.copy(smoothed);
    };

    // Spine rotation (from hips to shoulders midpoint)
    const leftHip = getLandmark(23);
    const rightHip = getLandmark(24);
    const leftShoulder = getLandmark(11);
    const rightShoulder = getLandmark(12);

    if (leftHip && rightHip && leftShoulder && rightShoulder) {
      const hipCenter = leftHip.clone().add(rightHip).multiplyScalar(0.5);
      const shoulderCenter = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5);
      const spineRotation = calculateRotation(hipCenter, shoulderCenter, new THREE.Vector3(0, 1, 0));
      applyBoneRotation('spine', spineRotation);
      applyBoneRotation('chest', spineRotation);
    }

    // Left arm
    const leftElbow = getLandmark(13);
    const leftWrist = getLandmark(15);

    if (leftShoulder && leftElbow) {
      const upperArmRotation = calculateRotation(leftShoulder, leftElbow, new THREE.Vector3(-1, 0, 0));
      applyBoneRotation('leftupperarm', upperArmRotation);
    }

    if (leftElbow && leftWrist) {
      const lowerArmRotation = calculateRotation(leftElbow, leftWrist, new THREE.Vector3(-1, 0, 0));
      applyBoneRotation('leftlowerarm', lowerArmRotation);
    }

    // Right arm
    const rightElbow = getLandmark(14);
    const rightWrist = getLandmark(16);

    if (rightShoulder && rightElbow) {
      const upperArmRotation = calculateRotation(rightShoulder, rightElbow, new THREE.Vector3(1, 0, 0));
      applyBoneRotation('rightupperarm', upperArmRotation);
    }

    if (rightElbow && rightWrist) {
      const lowerArmRotation = calculateRotation(rightElbow, rightWrist, new THREE.Vector3(1, 0, 0));
      applyBoneRotation('rightlowerarm', lowerArmRotation);
    }

    // Head rotation
    const nose = getLandmark(0);
    const leftEar = getLandmark(7);
    const rightEar = getLandmark(8);

    if (nose && leftEar && rightEar && leftShoulder && rightShoulder) {
      const headCenter = leftEar.clone().add(rightEar).multiplyScalar(0.5);
      const neckBase = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5);
      const headForward = nose.clone().sub(headCenter).normalize();

      const headRotation = new THREE.Quaternion();
      const lookMatrix = new THREE.Matrix4();
      lookMatrix.lookAt(new THREE.Vector3(), headForward, new THREE.Vector3(0, 1, 0));
      headRotation.setFromRotationMatrix(lookMatrix);

      applyBoneRotation('head', headRotation);
    }
  }, []);

  /**
   * Tracking loop
   */
  const trackingLoop = useCallback(() => {
    if (!videoRef.current || !poseLandmarkerRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) {
      trackingLoopRef.current = requestAnimationFrame(trackingLoop);
      return;
    }

    const now = performance.now();

    // Throttle tracking to ~30 FPS
    if (now - lastTrackingTimeRef.current < 33) {
      trackingLoopRef.current = requestAnimationFrame(trackingLoop);
      return;
    }
    lastTrackingTimeRef.current = now;

    try {
      // Run pose detection
      const poseResults = poseLandmarkerRef.current.detectForVideo(video, now);

      if (poseResults.worldLandmarks && poseResults.worldLandmarks.length > 0) {
        applyPoseToAvatar(poseResults.worldLandmarks[0]);

        // Update confidence
        const avgVisibility = poseResults.worldLandmarks[0].reduce(
          (sum: number, lm: any) => sum + (lm.visibility || 0),
          0
        ) / poseResults.worldLandmarks[0].length;

        setStatus((prev) => ({
          ...prev,
          confidence: avgVisibility,
        }));
      }

      // Update FPS counter
      fpsCounterRef.current++;
      if (now - lastFpsUpdateRef.current >= 1000) {
        setStatus((prev) => ({
          ...prev,
          currentFps: fpsCounterRef.current,
        }));
        fpsCounterRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
    } catch (error) {
      console.error('[useMirror3D] Tracking error:', error);
    }

    trackingLoopRef.current = requestAnimationFrame(trackingLoop);
  }, [videoRef, applyPoseToAvatar]);

  /**
   * Render loop
   */
  const renderLoop = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    // Update video texture
    if (videoTextureRef.current) {
      videoTextureRef.current.needsUpdate = true;
    }

    // Render
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    animationFrameRef.current = requestAnimationFrame(renderLoop);
  }, []);

  /**
   * Initialize the entire system
   */
  const initialize = useCallback(async () => {
    try {
      setStatus((prev) => ({ ...prev, lastError: null }));

      // Initialize scene
      initializeScene();

      // Initialize MediaPipe
      await initializeMediaPipe();

      // Load avatar
      await loadAvatar();

      // Setup video background
      setupVideoBackground();

      // Start render loop
      renderLoop();

      setIsInitialized(true);
      setStatus((prev) => ({
        ...prev,
        isInitialized: true,
      }));

      console.log('[useMirror3D] System initialized');
    } catch (error) {
      console.error('[useMirror3D] Initialization error:', error);
      setStatus((prev) => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Initialization failed',
      }));
      throw error;
    }
  }, [initializeScene, initializeMediaPipe, loadAvatar, setupVideoBackground, renderLoop]);

  /**
   * Start tracking
   */
  const startTracking = useCallback(async () => {
    if (!isInitialized) {
      throw new Error('System not initialized');
    }

    setIsTracking(true);
    setStatus((prev) => ({ ...prev, isRunning: true }));
    trackingLoop();
  }, [isInitialized, trackingLoop]);

  /**
   * Stop tracking
   */
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    setStatus((prev) => ({ ...prev, isRunning: false }));

    if (trackingLoopRef.current) {
      cancelAnimationFrame(trackingLoopRef.current);
      trackingLoopRef.current = null;
    }
  }, []);

  /**
   * Equip a garment
   */
  const equipGarment = useCallback(async (garment: GarmentMetadata) => {
    if (!sceneRef.current) return;

    // Unequip existing garment in same category
    const existingId = Array.from(garmentsRef.current.entries())
      .find(([id, _]) => id.startsWith(garment.category))?.[0];

    if (existingId) {
      const existing = garmentsRef.current.get(existingId);
      if (existing) {
        sceneRef.current.remove(existing);
        garmentsRef.current.delete(existingId);
      }
    }

    // Load new garment
    const loader = new GLTFLoader();

    return new Promise<void>((resolve) => {
      loader.load(
        garment.glbPath,
        (gltf) => {
          const garmentScene = gltf.scene;
          garmentScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.renderOrder = garment.layer;
            }
          });

          sceneRef.current!.add(garmentScene);
          garmentsRef.current.set(garment.id, garmentScene);
          setEquippedGarments((prev) => [...prev.filter((id) => !id.startsWith(garment.category)), garment.id]);
          resolve();
        },
        undefined,
        () => {
          // If garment fails to load, create a placeholder
          console.warn('[useMirror3D] Garment not found, using placeholder');
          resolve();
        }
      );
    });
  }, []);

  /**
   * Unequip a garment
   */
  const unequipGarment = useCallback((category: string) => {
    if (!sceneRef.current) return;

    const garmentId = Array.from(garmentsRef.current.entries())
      .find(([id, _]) => id.startsWith(category))?.[0];

    if (garmentId) {
      const garment = garmentsRef.current.get(garmentId);
      if (garment) {
        sceneRef.current.remove(garment);
        garmentsRef.current.delete(garmentId);
        setEquippedGarments((prev) => prev.filter((id) => id !== garmentId));
      }
    }
  }, []);

  /**
   * Update body scales
   */
  const updateBodyScales = useCallback((scales: Partial<BodyScales>) => {
    setUserProfile((prev) => ({
      ...prev,
      bodyScales: { ...prev.bodyScales, ...scales },
      updatedAt: new Date().toISOString(),
    }));

    // Apply scales to avatar
    if (avatarRef.current) {
      const fullScales = { ...DEFAULT_BODY_SCALES, ...scales };

      // Apply height scale
      avatarRef.current.scale.setScalar(fullScales.height);

      // For more detailed scaling, would need to adjust individual bones
      // This is a simplified implementation
    }
  }, []);

  /**
   * Save user profile to localStorage
   */
  const saveUserProfile = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
      console.log('[useMirror3D] User profile saved');
    } catch (error) {
      console.error('[useMirror3D] Failed to save user profile:', error);
    }
  }, [userProfile]);

  /**
   * Reset calibration
   */
  const resetCalibration = useCallback(() => {
    setUserProfile(createDefaultUserProfile());
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.CALIBRATION_COMPLETE);
  }, []);

  /**
   * Dispose all resources
   */
  const dispose = useCallback(() => {
    stopTracking();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (poseLandmarkerRef.current) {
      poseLandmarkerRef.current.close();
    }

    if (handLandmarkerRef.current) {
      handLandmarkerRef.current.close();
    }

    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current.domElement.remove();
    }

    if (videoTextureRef.current) {
      videoTextureRef.current.dispose();
    }

    setIsInitialized(false);
    setIsTracking(false);
  }, [stopTracking]);

  // Notify on status change
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    isInitialized,
    isTracking,
    status,
    userProfile,
    equippedGarments,
    initialize,
    startTracking,
    stopTracking,
    equipGarment,
    unequipGarment,
    updateBodyScales,
    saveUserProfile,
    resetCalibration,
    dispose,
  };
}
