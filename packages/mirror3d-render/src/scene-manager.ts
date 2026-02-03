/**
 * @fileoverview Scene manager for Three.js rendering with video compositing
 */

import * as THREE from 'three';
import {
  type RenderConfig,
  type LightingConfig,
  type CameraConfig,
  type RenderStats,
  DEFAULT_RENDER_CONFIG,
  DEFAULT_LIGHTING_CONFIG,
  DEFAULT_CAMERA_CONFIG,
} from './types';

/**
 * Manages the Three.js scene, camera, lighting, and rendering
 */
export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;

  // Lighting
  private ambientLight: THREE.AmbientLight;
  private mainLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;

  // Video background
  private videoTexture: THREE.VideoTexture | null = null;
  private videoMesh: THREE.Mesh | null = null;

  // Configuration
  private renderConfig: RenderConfig;
  private lightingConfig: LightingConfig;
  private cameraConfig: CameraConfig;

  // Stats tracking
  private frameCount = 0;
  private lastStatsTime = 0;
  private currentFps = 0;

  // Container reference
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    container: HTMLElement,
    config: Partial<RenderConfig> = {},
    lighting: Partial<LightingConfig> = {},
    camera: Partial<CameraConfig> = {}
  ) {
    this.container = container;
    this.renderConfig = { ...DEFAULT_RENDER_CONFIG, ...config };
    this.lightingConfig = { ...DEFAULT_LIGHTING_CONFIG, ...lighting };
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG, ...camera };

    // Initialize clock
    this.clock = new THREE.Clock();

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.renderConfig.antialias,
      alpha: this.renderConfig.backgroundColor === null,
      powerPreference: 'high-performance',
    });

    this.setupRenderer();

    // Create scene
    this.scene = new THREE.Scene();
    if (this.renderConfig.backgroundColor) {
      this.scene.background = new THREE.Color(this.renderConfig.backgroundColor);
    }

    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.cameraConfig.fov,
      aspect,
      this.cameraConfig.near,
      this.cameraConfig.far
    );
    this.camera.position.set(
      this.cameraConfig.position.x,
      this.cameraConfig.position.y,
      this.cameraConfig.position.z
    );
    this.camera.lookAt(
      this.cameraConfig.target.x,
      this.cameraConfig.target.y,
      this.cameraConfig.target.z
    );

    // Create lighting
    this.ambientLight = new THREE.AmbientLight(
      this.lightingConfig.ambientColor,
      this.lightingConfig.ambientIntensity
    );
    this.scene.add(this.ambientLight);

    this.mainLight = new THREE.DirectionalLight(
      this.lightingConfig.mainLightColor,
      this.lightingConfig.mainLightIntensity
    );
    this.mainLight.position.set(
      this.lightingConfig.mainLightPosition.x,
      this.lightingConfig.mainLightPosition.y,
      this.lightingConfig.mainLightPosition.z
    );
    if (this.renderConfig.shadows) {
      this.mainLight.castShadow = true;
      this.mainLight.shadow.mapSize.width = 1024;
      this.mainLight.shadow.mapSize.height = 1024;
      this.mainLight.shadow.camera.near = 0.1;
      this.mainLight.shadow.camera.far = 20;
    }
    this.scene.add(this.mainLight);

    this.fillLight = new THREE.DirectionalLight('#ffffff', this.lightingConfig.fillLightIntensity);
    this.fillLight.position.set(-2, 1, -1);
    this.scene.add(this.fillLight);

    // Append to container
    container.appendChild(this.renderer.domElement);

    // Setup resize handling
    this.setupResizeObserver();
  }

  /**
   * Setup renderer settings
   */
  private setupRenderer(): void {
    const { width, height, pixelRatio, toneMapping, exposure, shadows } = this.renderConfig;

    this.renderer.setPixelRatio(pixelRatio);

    if (width && height) {
      this.renderer.setSize(width, height);
    } else if (this.container) {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    // Tone mapping
    switch (toneMapping) {
      case 'linear':
        this.renderer.toneMapping = THREE.LinearToneMapping;
        break;
      case 'reinhard':
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        break;
      case 'cineon':
        this.renderer.toneMapping = THREE.CineonToneMapping;
        break;
      case 'aces':
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        break;
      default:
        this.renderer.toneMapping = THREE.NoToneMapping;
    }

    this.renderer.toneMappingExposure = exposure;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  /**
   * Setup resize observer for responsive rendering
   */
  private setupResizeObserver(): void {
    if (!this.container) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.resize(width, height);
      }
    });

    this.resizeObserver.observe(this.container);
  }

  /**
   * Resize the renderer and camera
   */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    // Update video background if exists
    if (this.videoMesh) {
      this.updateVideoMeshSize();
    }
  }

  /**
   * Set video element as background
   */
  setVideoBackground(video: HTMLVideoElement): void {
    // Remove existing video mesh
    if (this.videoMesh) {
      this.scene.remove(this.videoMesh);
      this.videoTexture?.dispose();
    }

    // Create video texture
    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;

    // Create fullscreen quad behind everything
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      depthWrite: false,
      depthTest: false,
    });

    this.videoMesh = new THREE.Mesh(geometry, material);
    this.videoMesh.renderOrder = -1000; // Render first (background)
    this.videoMesh.frustumCulled = false;

    // Use a separate scene for the video background
    // or position it far back
    this.updateVideoMeshSize();
    this.scene.add(this.videoMesh);
  }

  /**
   * Update video mesh size to fill camera view
   */
  private updateVideoMeshSize(): void {
    if (!this.videoMesh || !this.videoTexture) return;

    // Calculate size to fill the view
    const distance = this.camera.position.z - (-10); // Video at z=-10
    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * distance;
    const width = height * this.camera.aspect;

    this.videoMesh.scale.set(width / 2, height / 2, 1);
    this.videoMesh.position.z = -10;
  }

  /**
   * Add an object to the scene
   */
  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  /**
   * Remove an object from the scene
   */
  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  /**
   * Get the scene
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get the camera
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get the renderer
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Render a single frame
   */
  render(): void {
    // Update video texture if needed
    if (this.videoTexture) {
      this.videoTexture.needsUpdate = true;
    }

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastStatsTime >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastStatsTime = now;
    }
  }

  /**
   * Get delta time since last frame
   */
  getDelta(): number {
    return this.clock.getDelta();
  }

  /**
   * Get elapsed time
   */
  getElapsedTime(): number {
    return this.clock.getElapsedTime();
  }

  /**
   * Get render stats
   */
  getStats(): RenderStats {
    const info = this.renderer.info;
    return {
      fps: this.currentFps,
      frameTime: 1000 / Math.max(1, this.currentFps),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      textureMemory: info.memory.textures,
    };
  }

  /**
   * Update lighting configuration
   */
  setLighting(config: Partial<LightingConfig>): void {
    this.lightingConfig = { ...this.lightingConfig, ...config };

    this.ambientLight.intensity = this.lightingConfig.ambientIntensity;
    this.ambientLight.color.set(this.lightingConfig.ambientColor);

    this.mainLight.intensity = this.lightingConfig.mainLightIntensity;
    this.mainLight.color.set(this.lightingConfig.mainLightColor);
    this.mainLight.position.set(
      this.lightingConfig.mainLightPosition.x,
      this.lightingConfig.mainLightPosition.y,
      this.lightingConfig.mainLightPosition.z
    );

    this.fillLight.intensity = this.lightingConfig.fillLightIntensity;
  }

  /**
   * Set camera position
   */
  setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  /**
   * Set camera target
   */
  setCameraTarget(x: number, y: number, z: number): void {
    this.camera.lookAt(x, y, z);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Stop observing
    this.resizeObserver?.disconnect();

    // Dispose video texture
    if (this.videoTexture) {
      this.videoTexture.dispose();
    }

    // Dispose video mesh
    if (this.videoMesh) {
      (this.videoMesh.geometry as THREE.BufferGeometry).dispose();
      (this.videoMesh.material as THREE.Material).dispose();
    }

    // Dispose renderer
    this.renderer.dispose();

    // Remove canvas from DOM
    this.renderer.domElement.remove();
  }
}
