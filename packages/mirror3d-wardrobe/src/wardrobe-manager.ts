/**
 * @fileoverview Wardrobe manager for loading and switching garments
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  type GarmentMetadata,
  type LoadedGarment,
  type WardrobeState,
  GarmentCategory,
  GarmentSize,
  GarmentLayer,
} from './types';

/**
 * Manages the wardrobe system - loading, equipping, and switching garments
 */
export class WardrobeManager {
  private loader: GLTFLoader;
  private state: WardrobeState;
  private avatarSkeleton: THREE.Skeleton | null = null;
  private parentObject: THREE.Object3D | null = null;

  // Event callbacks
  private onGarmentEquipped?: (garment: LoadedGarment) => void;
  private onGarmentUnequipped?: (garmentId: string) => void;

  constructor() {
    this.loader = new GLTFLoader();
    this.state = {
      equipped: new Map(),
      loaded: new Map(),
    };
  }

  /**
   * Set the avatar skeleton for garment binding
   */
  setAvatarSkeleton(skeleton: THREE.Skeleton, parent: THREE.Object3D): void {
    this.avatarSkeleton = skeleton;
    this.parentObject = parent;

    // Re-bind all loaded garments to the new skeleton
    for (const [, garment] of this.state.loaded) {
      this.bindToSkeleton(garment);
    }
  }

  /**
   * Load a garment from metadata
   */
  async loadGarment(metadata: GarmentMetadata): Promise<LoadedGarment> {
    // Check if already loaded
    const existing = this.state.loaded.get(metadata.id);
    if (existing) {
      return existing;
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        metadata.technical.glbPath,
        (gltf) => {
          const garment = this.processLoadedGarment(gltf, metadata);
          this.state.loaded.set(metadata.id, garment);

          // Bind to skeleton if available
          if (this.avatarSkeleton) {
            this.bindToSkeleton(garment);
          }

          resolve(garment);
        },
        undefined,
        (error) => {
          console.error(`[WardrobeManager] Failed to load garment ${metadata.id}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Process a loaded GLTF into a LoadedGarment
   */
  private processLoadedGarment(gltf: any, metadata: GarmentMetadata): LoadedGarment {
    const scene = gltf.scene;
    const skinnedMeshes: THREE.SkinnedMesh[] = [];

    // Find all skinned meshes
    scene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        skinnedMeshes.push(mesh);

        // Enable shadows
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Set render order based on layer
        mesh.renderOrder = metadata.layer;
      }
    });

    const garment: LoadedGarment = {
      metadata,
      scene,
      skinnedMeshes,
      visible: false,
      currentSize: metadata.defaultSize,
    };

    // Initially hidden
    scene.visible = false;

    return garment;
  }

  /**
   * Bind a garment to the avatar skeleton
   */
  private bindToSkeleton(garment: LoadedGarment): void {
    if (!this.avatarSkeleton || !this.parentObject) return;

    for (const mesh of garment.skinnedMeshes) {
      // Create a new skeleton that references the avatar's bones
      const newBones: THREE.Bone[] = [];

      for (const bone of mesh.skeleton.bones) {
        // Find matching bone in avatar skeleton by name
        const avatarBone = this.avatarSkeleton.bones.find(
          (b) => b.name === bone.name || this.bonesMatch(b.name, bone.name)
        );

        if (avatarBone) {
          newBones.push(avatarBone);
        } else {
          // Keep original bone if no match found
          newBones.push(bone);
          console.warn(`[WardrobeManager] No matching bone found for: ${bone.name}`);
        }
      }

      // Create new skeleton with avatar bones
      const newSkeleton = new THREE.Skeleton(newBones, mesh.skeleton.boneInverses);
      mesh.bind(newSkeleton);
    }

    // Add garment scene to parent
    if (!garment.scene.parent) {
      this.parentObject.add(garment.scene);
    }
  }

  /**
   * Check if two bone names match (handles different naming conventions)
   */
  private bonesMatch(a: string, b: string): boolean {
    // Normalize names for comparison
    const normalize = (name: string) =>
      name.toLowerCase().replace(/[_\-\s]/g, '').replace(/mixamorig/i, '');

    return normalize(a) === normalize(b);
  }

  /**
   * Equip a garment (load if necessary and show)
   */
  async equipGarment(metadata: GarmentMetadata): Promise<void> {
    // Load the garment if not already loaded
    const garment = await this.loadGarment(metadata);

    // Unequip any existing garment in the same category
    const existingId = this.state.equipped.get(metadata.category);
    if (existingId && existingId !== metadata.id) {
      this.unequipGarment(metadata.category);
    }

    // Equip the new garment
    garment.visible = true;
    garment.scene.visible = true;
    this.state.equipped.set(metadata.category, metadata.id);

    console.log(`[WardrobeManager] Equipped: ${metadata.name}`);
    this.onGarmentEquipped?.(garment);
  }

  /**
   * Unequip a garment by category
   */
  unequipGarment(category: GarmentCategory): void {
    const garmentId = this.state.equipped.get(category);
    if (!garmentId) return;

    const garment = this.state.loaded.get(garmentId);
    if (garment) {
      garment.visible = false;
      garment.scene.visible = false;
    }

    this.state.equipped.delete(category);
    console.log(`[WardrobeManager] Unequipped category: ${category}`);
    this.onGarmentUnequipped?.(garmentId);
  }

  /**
   * Unequip all garments
   */
  unequipAll(): void {
    for (const category of Object.values(GarmentCategory)) {
      this.unequipGarment(category);
    }
  }

  /**
   * Get currently equipped garment for a category
   */
  getEquipped(category: GarmentCategory): LoadedGarment | null {
    const id = this.state.equipped.get(category);
    if (!id) return null;
    return this.state.loaded.get(id) ?? null;
  }

  /**
   * Get all equipped garments
   */
  getAllEquipped(): LoadedGarment[] {
    const equipped: LoadedGarment[] = [];
    for (const [, id] of this.state.equipped) {
      const garment = this.state.loaded.get(id);
      if (garment) equipped.push(garment);
    }
    return equipped;
  }

  /**
   * Check if a garment is equipped
   */
  isEquipped(garmentId: string): boolean {
    for (const [, id] of this.state.equipped) {
      if (id === garmentId) return true;
    }
    return false;
  }

  /**
   * Change the size of an equipped garment
   */
  setGarmentSize(garmentId: string, size: GarmentSize): void {
    const garment = this.state.loaded.get(garmentId);
    if (!garment) return;

    if (!garment.metadata.availableSizes.includes(size)) {
      console.warn(`[WardrobeManager] Size ${size} not available for ${garmentId}`);
      return;
    }

    garment.currentSize = size;

    // Apply size-based scaling
    const sizeScale = this.getSizeScale(size);
    for (const mesh of garment.skinnedMeshes) {
      mesh.scale.setScalar(sizeScale);
    }
  }

  /**
   * Get scale factor for a size
   */
  private getSizeScale(size: GarmentSize): number {
    const scales: Record<GarmentSize, number> = {
      [GarmentSize.XS]: 0.92,
      [GarmentSize.S]: 0.96,
      [GarmentSize.M]: 1.0,
      [GarmentSize.L]: 1.04,
      [GarmentSize.XL]: 1.08,
      [GarmentSize.XXL]: 1.12,
    };
    return scales[size] ?? 1.0;
  }

  /**
   * Set garment color (if supported)
   */
  setGarmentColor(garmentId: string, colorId: string): void {
    const garment = this.state.loaded.get(garmentId);
    if (!garment) return;

    const color = garment.metadata.colors?.find((c) => c.id === colorId);
    if (!color) {
      console.warn(`[WardrobeManager] Color ${colorId} not found for ${garmentId}`);
      return;
    }

    garment.currentColorId = colorId;

    // Apply color to materials
    for (const mesh of garment.skinnedMeshes) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          if ((mat as THREE.MeshStandardMaterial).color) {
            (mat as THREE.MeshStandardMaterial).color.set(color.hex);
          }
        });
      } else if ((mesh.material as THREE.MeshStandardMaterial).color) {
        (mesh.material as THREE.MeshStandardMaterial).color.set(color.hex);
      }
    }
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: {
    onEquipped?: (garment: LoadedGarment) => void;
    onUnequipped?: (garmentId: string) => void;
  }): void {
    this.onGarmentEquipped = callbacks.onEquipped;
    this.onGarmentUnequipped = callbacks.onUnequipped;
  }

  /**
   * Get all loaded garments
   */
  getLoaded(): LoadedGarment[] {
    return Array.from(this.state.loaded.values());
  }

  /**
   * Unload a specific garment to free memory
   */
  unloadGarment(garmentId: string): void {
    const garment = this.state.loaded.get(garmentId);
    if (!garment) return;

    // Unequip first
    for (const [category, id] of this.state.equipped) {
      if (id === garmentId) {
        this.unequipGarment(category);
        break;
      }
    }

    // Dispose resources
    for (const mesh of garment.skinnedMeshes) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }

    // Remove from parent
    garment.scene.removeFromParent();

    // Remove from loaded
    this.state.loaded.delete(garmentId);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    for (const [id] of this.state.loaded) {
      this.unloadGarment(id);
    }
    this.state.equipped.clear();
    this.state.loaded.clear();
    this.avatarSkeleton = null;
    this.parentObject = null;
  }
}
