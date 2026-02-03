/**
 * @fileoverview Enhanced lighting and materials for realistic garment rendering
 * Phase 2: Includes environment mapping, fabric shaders, and advanced lighting
 */

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

/**
 * Environment preset configurations
 */
export interface EnvironmentPreset {
  name: string;
  /** HDR environment map URL (optional) */
  hdrUrl?: string;
  /** Ambient light color */
  ambientColor: string;
  /** Ambient intensity */
  ambientIntensity: number;
  /** Main light color */
  mainLightColor: string;
  /** Main light intensity */
  mainLightIntensity: number;
  /** Main light position */
  mainLightPosition: THREE.Vector3;
  /** Fill light color */
  fillLightColor: string;
  /** Fill light intensity */
  fillLightIntensity: number;
  /** Rim/back light color */
  rimLightColor: string;
  /** Rim light intensity */
  rimLightIntensity: number;
  /** Exposure adjustment */
  exposure: number;
  /** Background color (if no HDR) */
  backgroundColor: string;
}

/**
 * Built-in environment presets
 */
export const ENVIRONMENT_PRESETS: Record<string, EnvironmentPreset> = {
  studio: {
    name: 'Studio',
    ambientColor: '#f0f0f0',
    ambientIntensity: 0.6,
    mainLightColor: '#ffffff',
    mainLightIntensity: 1.2,
    mainLightPosition: new THREE.Vector3(2, 3, 2),
    fillLightColor: '#e8e8ff',
    fillLightIntensity: 0.4,
    rimLightColor: '#fff5e6',
    rimLightIntensity: 0.3,
    exposure: 1.0,
    backgroundColor: '#f5f5f5',
  },
  softbox: {
    name: 'Softbox',
    ambientColor: '#ffffff',
    ambientIntensity: 0.8,
    mainLightColor: '#fffaf0',
    mainLightIntensity: 1.0,
    mainLightPosition: new THREE.Vector3(1, 2, 2),
    fillLightColor: '#f0f8ff',
    fillLightIntensity: 0.5,
    rimLightColor: '#fffaf0',
    rimLightIntensity: 0.2,
    exposure: 1.0,
    backgroundColor: '#ffffff',
  },
  warm: {
    name: 'Warm Boutique',
    ambientColor: '#fff5e6',
    ambientIntensity: 0.5,
    mainLightColor: '#ffcc80',
    mainLightIntensity: 1.1,
    mainLightPosition: new THREE.Vector3(2, 2.5, 1.5),
    fillLightColor: '#ffe4c4',
    fillLightIntensity: 0.4,
    rimLightColor: '#ffd700',
    rimLightIntensity: 0.3,
    exposure: 1.1,
    backgroundColor: '#faf0e6',
  },
  cool: {
    name: 'Cool Modern',
    ambientColor: '#e6f0ff',
    ambientIntensity: 0.5,
    mainLightColor: '#f0f8ff',
    mainLightIntensity: 1.0,
    mainLightPosition: new THREE.Vector3(2, 3, 2),
    fillLightColor: '#e0e8f0',
    fillLightIntensity: 0.4,
    rimLightColor: '#87ceeb',
    rimLightIntensity: 0.25,
    exposure: 1.0,
    backgroundColor: '#f0f5fa',
  },
  dramatic: {
    name: 'Dramatic',
    ambientColor: '#1a1a2e',
    ambientIntensity: 0.2,
    mainLightColor: '#ffffff',
    mainLightIntensity: 1.5,
    mainLightPosition: new THREE.Vector3(3, 3, 1),
    fillLightColor: '#404080',
    fillLightIntensity: 0.2,
    rimLightColor: '#ff6b6b',
    rimLightIntensity: 0.4,
    exposure: 1.2,
    backgroundColor: '#0a0a14',
  },
  natural: {
    name: 'Natural Daylight',
    ambientColor: '#87ceeb',
    ambientIntensity: 0.6,
    mainLightColor: '#fffacd',
    mainLightIntensity: 1.3,
    mainLightPosition: new THREE.Vector3(3, 5, 2),
    fillLightColor: '#add8e6',
    fillLightIntensity: 0.3,
    rimLightColor: '#ffd700',
    rimLightIntensity: 0.15,
    exposure: 1.0,
    backgroundColor: '#e6f2ff',
  },
};

/**
 * Fabric material types
 */
export type FabricType =
  | 'cotton'
  | 'silk'
  | 'wool'
  | 'denim'
  | 'leather'
  | 'synthetic'
  | 'velvet'
  | 'satin'
  | 'linen';

/**
 * Fabric material properties
 */
export interface FabricProperties {
  roughness: number;
  metalness: number;
  sheenColor: string;
  sheenRoughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  normalScale: number;
  aoIntensity: number;
}

/**
 * Default fabric properties by type
 */
export const FABRIC_PROPERTIES: Record<FabricType, FabricProperties> = {
  cotton: {
    roughness: 0.8,
    metalness: 0.0,
    sheenColor: '#ffffff',
    sheenRoughness: 0.8,
    clearcoat: 0.0,
    clearcoatRoughness: 0.5,
    normalScale: 0.5,
    aoIntensity: 1.0,
  },
  silk: {
    roughness: 0.3,
    metalness: 0.0,
    sheenColor: '#fffaf0',
    sheenRoughness: 0.25,
    clearcoat: 0.1,
    clearcoatRoughness: 0.2,
    normalScale: 0.2,
    aoIntensity: 0.8,
  },
  wool: {
    roughness: 0.9,
    metalness: 0.0,
    sheenColor: '#f5f5f5',
    sheenRoughness: 0.9,
    clearcoat: 0.0,
    clearcoatRoughness: 0.5,
    normalScale: 0.8,
    aoIntensity: 1.2,
  },
  denim: {
    roughness: 0.85,
    metalness: 0.0,
    sheenColor: '#a0c4ff',
    sheenRoughness: 0.7,
    clearcoat: 0.0,
    clearcoatRoughness: 0.5,
    normalScale: 0.6,
    aoIntensity: 1.0,
  },
  leather: {
    roughness: 0.4,
    metalness: 0.0,
    sheenColor: '#8b4513',
    sheenRoughness: 0.4,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
    normalScale: 0.4,
    aoIntensity: 1.1,
  },
  synthetic: {
    roughness: 0.5,
    metalness: 0.1,
    sheenColor: '#ffffff',
    sheenRoughness: 0.4,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
    normalScale: 0.3,
    aoIntensity: 0.9,
  },
  velvet: {
    roughness: 0.95,
    metalness: 0.0,
    sheenColor: '#4a0080',
    sheenRoughness: 0.2,
    clearcoat: 0.0,
    clearcoatRoughness: 0.5,
    normalScale: 0.9,
    aoIntensity: 1.3,
  },
  satin: {
    roughness: 0.2,
    metalness: 0.0,
    sheenColor: '#fffaf0',
    sheenRoughness: 0.15,
    clearcoat: 0.15,
    clearcoatRoughness: 0.15,
    normalScale: 0.15,
    aoIntensity: 0.7,
  },
  linen: {
    roughness: 0.75,
    metalness: 0.0,
    sheenColor: '#faf0e6',
    sheenRoughness: 0.7,
    clearcoat: 0.0,
    clearcoatRoughness: 0.5,
    normalScale: 0.7,
    aoIntensity: 1.0,
  },
};

/**
 * Enhanced lighting manager for realistic garment rendering
 */
export class EnhancedLightingManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  // Lights
  private ambientLight: THREE.AmbientLight;
  private mainLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  // Environment
  private envMap: THREE.Texture | null = null;
  private pmremGenerator: THREE.PMREMGenerator;
  private currentPreset: EnvironmentPreset;

  // Material cache
  private fabricMaterials: Map<string, THREE.MeshPhysicalMaterial> = new Map();

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.currentPreset = ENVIRONMENT_PRESETS.studio;

    // Create lights
    this.ambientLight = new THREE.AmbientLight();
    this.mainLight = new THREE.DirectionalLight();
    this.fillLight = new THREE.DirectionalLight();
    this.rimLight = new THREE.DirectionalLight();

    // Add lights to scene
    this.scene.add(this.ambientLight);
    this.scene.add(this.mainLight);
    this.scene.add(this.fillLight);
    this.scene.add(this.rimLight);

    // Setup shadow for main light
    this.setupShadows();

    // Apply default preset
    this.applyPreset('studio');
  }

  /**
   * Setup shadow configuration
   */
  private setupShadows(): void {
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 2048;
    this.mainLight.shadow.mapSize.height = 2048;
    this.mainLight.shadow.camera.near = 0.1;
    this.mainLight.shadow.camera.far = 20;
    this.mainLight.shadow.camera.left = -3;
    this.mainLight.shadow.camera.right = 3;
    this.mainLight.shadow.camera.top = 3;
    this.mainLight.shadow.camera.bottom = -3;
    this.mainLight.shadow.bias = -0.0001;
    this.mainLight.shadow.normalBias = 0.02;

    // Use PCF soft shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  /**
   * Apply an environment preset
   */
  applyPreset(presetName: string): void {
    const preset = ENVIRONMENT_PRESETS[presetName];
    if (!preset) {
      console.warn(`[EnhancedLighting] Unknown preset: ${presetName}`);
      return;
    }

    this.currentPreset = preset;

    // Apply ambient light
    this.ambientLight.color.set(preset.ambientColor);
    this.ambientLight.intensity = preset.ambientIntensity;

    // Apply main light
    this.mainLight.color.set(preset.mainLightColor);
    this.mainLight.intensity = preset.mainLightIntensity;
    this.mainLight.position.copy(preset.mainLightPosition);

    // Apply fill light (opposite side of main)
    this.fillLight.color.set(preset.fillLightColor);
    this.fillLight.intensity = preset.fillLightIntensity;
    this.fillLight.position.set(
      -preset.mainLightPosition.x,
      preset.mainLightPosition.y * 0.7,
      preset.mainLightPosition.z
    );

    // Apply rim light (behind subject)
    this.rimLight.color.set(preset.rimLightColor);
    this.rimLight.intensity = preset.rimLightIntensity;
    this.rimLight.position.set(0, 2, -2);

    // Apply exposure
    this.renderer.toneMappingExposure = preset.exposure;

    // Set background if no environment map
    if (!this.envMap) {
      this.scene.background = new THREE.Color(preset.backgroundColor);
    }

    console.log(`[EnhancedLighting] Applied preset: ${presetName}`);
  }

  /**
   * Load HDR environment map
   */
  async loadEnvironmentMap(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = new RGBELoader();
      loader.load(
        url,
        (texture) => {
          this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
          texture.dispose();

          this.scene.environment = this.envMap;

          // Update all materials to use environment map
          this.updateMaterialsEnvironment();

          console.log('[EnhancedLighting] Environment map loaded');
          resolve();
        },
        undefined,
        (error) => {
          console.error('[EnhancedLighting] Failed to load environment map:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Create a procedural studio environment
   */
  createProceduralEnvironment(): void {
    // Create a simple gradient environment
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#87ceeb'); // Sky blue top
    gradient.addColorStop(0.4, '#f0f8ff'); // Light blue
    gradient.addColorStop(0.6, '#ffffff'); // White
    gradient.addColorStop(1, '#f5f5f5'); // Light gray bottom

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 256);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;

    this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
    texture.dispose();

    this.scene.environment = this.envMap;
    this.updateMaterialsEnvironment();
  }

  /**
   * Update all scene materials to use current environment
   */
  private updateMaterialsEnvironment(): void {
    this.scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        for (const material of materials) {
          if ((material as THREE.MeshStandardMaterial).envMap !== undefined) {
            (material as THREE.MeshStandardMaterial).envMap = this.envMap;
            (material as THREE.MeshStandardMaterial).envMapIntensity = 0.5;
            material.needsUpdate = true;
          }
        }
      }
    });
  }

  /**
   * Create a fabric material with realistic properties
   */
  createFabricMaterial(
    fabricType: FabricType,
    baseColor: string,
    options: Partial<FabricProperties> = {}
  ): THREE.MeshPhysicalMaterial {
    const props = { ...FABRIC_PROPERTIES[fabricType], ...options };

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(baseColor),
      roughness: props.roughness,
      metalness: props.metalness,
      sheen: 1.0,
      sheenColor: new THREE.Color(props.sheenColor),
      sheenRoughness: props.sheenRoughness,
      clearcoat: props.clearcoat,
      clearcoatRoughness: props.clearcoatRoughness,
      envMap: this.envMap,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    });

    return material;
  }

  /**
   * Apply fabric properties to an existing material
   */
  applyFabricProperties(
    material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
    fabricType: FabricType
  ): void {
    const props = FABRIC_PROPERTIES[fabricType];

    material.roughness = props.roughness;
    material.metalness = props.metalness;

    if ('sheen' in material) {
      const physMat = material as THREE.MeshPhysicalMaterial;
      physMat.sheen = 1.0;
      physMat.sheenColor.set(props.sheenColor);
      physMat.sheenRoughness = props.sheenRoughness;
      physMat.clearcoat = props.clearcoat;
      physMat.clearcoatRoughness = props.clearcoatRoughness;
    }

    material.envMap = this.envMap;
    material.needsUpdate = true;
  }

  /**
   * Set main light color dynamically (e.g., from room lighting)
   */
  setMainLightColor(color: string): void {
    this.mainLight.color.set(color);
  }

  /**
   * Set ambient light from room estimation
   */
  setAmbientFromRoom(dominantColor: string, intensity: number): void {
    this.ambientLight.color.set(dominantColor);
    this.ambientLight.intensity = intensity;
  }

  /**
   * Adjust exposure
   */
  setExposure(exposure: number): void {
    this.renderer.toneMappingExposure = exposure;
  }

  /**
   * Get available presets
   */
  getPresets(): string[] {
    return Object.keys(ENVIRONMENT_PRESETS);
  }

  /**
   * Get current preset name
   */
  getCurrentPreset(): string {
    return this.currentPreset.name;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.envMap?.dispose();
    this.pmremGenerator.dispose();

    for (const material of this.fabricMaterials.values()) {
      material.dispose();
    }
    this.fabricMaterials.clear();
  }
}

/**
 * Estimate ambient light color from video frame
 */
export function estimateAmbientLight(video: HTMLVideoElement): {
  dominantColor: string;
  brightness: number;
} {
  const canvas = document.createElement('canvas');
  const size = 64; // Small size for performance
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  let totalR = 0, totalG = 0, totalB = 0;
  let totalBrightness = 0;
  const pixelCount = size * size;

  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }

  const avgR = Math.round(totalR / pixelCount);
  const avgG = Math.round(totalG / pixelCount);
  const avgB = Math.round(totalB / pixelCount);
  const avgBrightness = totalBrightness / pixelCount / 255;

  const dominantColor = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;

  return {
    dominantColor,
    brightness: avgBrightness,
  };
}
