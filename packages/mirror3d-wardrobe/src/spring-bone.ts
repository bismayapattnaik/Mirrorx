/**
 * @fileoverview Spring bone physics for cloth simulation
 * Phase 2: Implements secondary motion for garments using Verlet integration
 */

import * as THREE from 'three';
import type { SpringBoneConfig } from './types';

/**
 * Spring bone particle for physics simulation
 */
interface SpringParticle {
  /** Current position */
  position: THREE.Vector3;
  /** Previous position (for Verlet integration) */
  previousPosition: THREE.Vector3;
  /** Rest position (local space) */
  restPosition: THREE.Vector3;
  /** Bone reference */
  bone: THREE.Bone;
  /** Parent particle index (-1 for root) */
  parentIndex: number;
  /** Rest length to parent */
  restLength: number;
  /** Mass for physics calculation */
  mass: number;
  /** Whether this particle is pinned (no movement) */
  pinned: boolean;
}

/**
 * Spring bone chain configuration
 */
export interface SpringChainConfig {
  /** Root bone name */
  rootBoneName: string;
  /** End bone name (optional, auto-detect if not specified) */
  endBoneName?: string;
  /** Stiffness (0-1) - how much the chain resists movement */
  stiffness: number;
  /** Damping (0-1) - how quickly oscillation stops */
  damping: number;
  /** Gravity influence (0-1) */
  gravity: number;
  /** Wind/external force influence */
  windInfluence: number;
  /** Collision radius for each bone */
  collisionRadius: number;
  /** Number of constraint iterations */
  iterations: number;
}

const DEFAULT_CHAIN_CONFIG: Partial<SpringChainConfig> = {
  stiffness: 0.5,
  damping: 0.1,
  gravity: 0.5,
  windInfluence: 0.0,
  collisionRadius: 0.02,
  iterations: 3,
};

/**
 * Spring bone system for cloth physics simulation
 */
export class SpringBoneSystem {
  private chains: Map<string, SpringChain> = new Map();
  private globalGravity: THREE.Vector3 = new THREE.Vector3(0, -9.81, 0);
  private windForce: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private timeScale: number = 1.0;
  private paused: boolean = false;

  // Collision spheres (e.g., body parts)
  private colliders: Array<{
    position: THREE.Vector3;
    radius: number;
    boneName?: string;
    boneRef?: THREE.Bone;
  }> = [];

  constructor() {
    // Pre-warm vectors for performance
  }

  /**
   * Add a spring bone chain from config
   */
  addChainFromConfig(
    skeleton: THREE.Skeleton,
    config: SpringBoneConfig
  ): void {
    // Find matching bones
    const matchingBones = this.findMatchingBones(skeleton, config.boneName);

    for (const bone of matchingBones) {
      const chainConfig: SpringChainConfig = {
        rootBoneName: bone.name,
        stiffness: config.stiffness,
        damping: config.damping,
        gravity: config.gravityFactor,
        windInfluence: 0,
        collisionRadius: 0.02,
        iterations: 3,
      };

      this.addChain(skeleton, chainConfig);
    }
  }

  /**
   * Find bones matching a name or pattern
   */
  private findMatchingBones(skeleton: THREE.Skeleton, pattern: string): THREE.Bone[] {
    const matches: THREE.Bone[] = [];

    if (pattern.includes('*')) {
      // Wildcard pattern
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$', 'i');
      for (const bone of skeleton.bones) {
        if (regex.test(bone.name)) {
          matches.push(bone);
        }
      }
    } else {
      // Exact match
      const bone = skeleton.bones.find(b =>
        b.name === pattern || b.name.toLowerCase() === pattern.toLowerCase()
      );
      if (bone) {
        matches.push(bone);
      }
    }

    return matches;
  }

  /**
   * Add a spring bone chain
   */
  addChain(skeleton: THREE.Skeleton, config: SpringChainConfig): SpringChain | null {
    const fullConfig = { ...DEFAULT_CHAIN_CONFIG, ...config } as SpringChainConfig;

    // Find root bone
    const rootBone = skeleton.bones.find(b => b.name === config.rootBoneName);
    if (!rootBone) {
      console.warn(`[SpringBoneSystem] Root bone not found: ${config.rootBoneName}`);
      return null;
    }

    // Create chain
    const chain = new SpringChain(rootBone, fullConfig);
    this.chains.set(config.rootBoneName, chain);

    console.log(`[SpringBoneSystem] Added chain: ${config.rootBoneName} with ${chain.getParticleCount()} particles`);

    return chain;
  }

  /**
   * Remove a chain
   */
  removeChain(rootBoneName: string): void {
    this.chains.delete(rootBoneName);
  }

  /**
   * Add a collision sphere
   */
  addCollider(position: THREE.Vector3, radius: number, boneName?: string): void {
    this.colliders.push({ position: position.clone(), radius, boneName });
  }

  /**
   * Update collider from bone position
   */
  updateColliderFromBone(skeleton: THREE.Skeleton): void {
    for (const collider of this.colliders) {
      if (collider.boneName) {
        if (!collider.boneRef) {
          collider.boneRef = skeleton.bones.find(b => b.name === collider.boneName);
        }
        if (collider.boneRef) {
          collider.boneRef.getWorldPosition(collider.position);
        }
      }
    }
  }

  /**
   * Set global gravity
   */
  setGravity(x: number, y: number, z: number): void {
    this.globalGravity.set(x, y, z);
  }

  /**
   * Set wind force
   */
  setWind(x: number, y: number, z: number): void {
    this.windForce.set(x, y, z);
  }

  /**
   * Set time scale for slow-mo or speed-up
   */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, Math.min(3.0, scale));
  }

  /**
   * Pause/unpause simulation
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /**
   * Update all spring bone chains
   */
  update(deltaTime: number): void {
    if (this.paused) return;

    const dt = deltaTime * this.timeScale;

    for (const chain of this.chains.values()) {
      chain.update(dt, this.globalGravity, this.windForce, this.colliders);
    }
  }

  /**
   * Reset all chains to rest position
   */
  reset(): void {
    for (const chain of this.chains.values()) {
      chain.reset();
    }
  }

  /**
   * Get total particle count across all chains
   */
  getParticleCount(): number {
    let count = 0;
    for (const chain of this.chains.values()) {
      count += chain.getParticleCount();
    }
    return count;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.chains.clear();
    this.colliders = [];
  }
}

/**
 * Individual spring bone chain
 */
class SpringChain {
  private particles: SpringParticle[] = [];
  private config: SpringChainConfig;

  // Temp vectors for calculations
  private tempVec1 = new THREE.Vector3();
  private tempVec2 = new THREE.Vector3();
  private tempVec3 = new THREE.Vector3();

  constructor(rootBone: THREE.Bone, config: SpringChainConfig) {
    this.config = config;
    this.buildChain(rootBone);
  }

  /**
   * Build particle chain from bone hierarchy
   */
  private buildChain(rootBone: THREE.Bone): void {
    const bones = this.collectBones(rootBone);

    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i];
      const worldPos = new THREE.Vector3();
      bone.getWorldPosition(worldPos);

      const particle: SpringParticle = {
        position: worldPos.clone(),
        previousPosition: worldPos.clone(),
        restPosition: bone.position.clone(),
        bone,
        parentIndex: i - 1,
        restLength: 0,
        mass: 1.0,
        pinned: i === 0, // Pin the root
      };

      // Calculate rest length to parent
      if (i > 0) {
        const parentPos = new THREE.Vector3();
        bones[i - 1].getWorldPosition(parentPos);
        particle.restLength = worldPos.distanceTo(parentPos);
      }

      this.particles.push(particle);
    }
  }

  /**
   * Collect all bones in the chain
   */
  private collectBones(root: THREE.Bone): THREE.Bone[] {
    const bones: THREE.Bone[] = [root];
    let current: THREE.Bone = root;

    while (current.children && current.children.length > 0) {
      // Follow the first bone child
      const childBone = current.children.find((c: THREE.Object3D) => (c as THREE.Bone).isBone);
      if (!childBone) break;

      bones.push(childBone as THREE.Bone);
      current = childBone as THREE.Bone;

      // Limit chain length
      if (bones.length > 20) break;
    }

    return bones;
  }

  /**
   * Update the spring chain physics
   */
  update(
    dt: number,
    gravity: THREE.Vector3,
    wind: THREE.Vector3,
    colliders: Array<{ position: THREE.Vector3; radius: number }>
  ): void {
    // Clamp delta time to prevent instability
    const fixedDt = Math.min(dt, 1 / 30);

    // Update pinned particles from their bones
    for (const particle of this.particles) {
      if (particle.pinned) {
        particle.bone.getWorldPosition(particle.position);
        particle.previousPosition.copy(particle.position);
      }
    }

    // Apply forces and integrate
    this.integrate(fixedDt, gravity, wind);

    // Solve constraints
    for (let i = 0; i < this.config.iterations; i++) {
      this.solveDistanceConstraints();
      this.solveCollisions(colliders);
    }

    // Apply results back to bones
    this.applyToBones();
  }

  /**
   * Verlet integration step
   */
  private integrate(dt: number, gravity: THREE.Vector3, wind: THREE.Vector3): void {
    const { damping, gravity: gravityScale, windInfluence, stiffness } = this.config;
    const dampingFactor = 1 - damping;

    for (let i = 1; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.pinned) continue;

      // Calculate velocity from Verlet
      this.tempVec1.subVectors(particle.position, particle.previousPosition);

      // Apply damping
      this.tempVec1.multiplyScalar(dampingFactor);

      // Calculate acceleration from forces
      this.tempVec2.copy(gravity).multiplyScalar(gravityScale * dt * dt);
      this.tempVec2.add(wind.clone().multiplyScalar(windInfluence * dt * dt));

      // Stiffness - pull towards rest position relative to parent
      if (i > 0 && stiffness > 0) {
        const parent = this.particles[particle.parentIndex];
        const targetDir = this.tempVec3.copy(particle.restPosition).normalize();

        // Get parent's world orientation
        parent.bone.getWorldQuaternion(this.tempVec3 as any);

        // Calculate target position
        const targetPos = parent.position.clone()
          .add(targetDir.multiplyScalar(particle.restLength));

        // Pull towards target
        const stiffnessForce = targetPos.sub(particle.position)
          .multiplyScalar(stiffness * 0.1);
        this.tempVec2.add(stiffnessForce);
      }

      // Verlet integration
      particle.previousPosition.copy(particle.position);
      particle.position.add(this.tempVec1).add(this.tempVec2);
    }
  }

  /**
   * Solve distance constraints between particles
   */
  private solveDistanceConstraints(): void {
    for (let i = 1; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const parent = this.particles[particle.parentIndex];

      // Calculate current distance
      this.tempVec1.subVectors(particle.position, parent.position);
      const currentDist = this.tempVec1.length();

      if (currentDist < 0.0001) continue;

      // Calculate correction
      const error = (currentDist - particle.restLength) / currentDist;

      if (!parent.pinned && !particle.pinned) {
        // Both can move - split correction
        this.tempVec2.copy(this.tempVec1).multiplyScalar(error * 0.5);
        parent.position.add(this.tempVec2);
        particle.position.sub(this.tempVec2);
      } else if (!particle.pinned) {
        // Only particle can move
        this.tempVec2.copy(this.tempVec1).multiplyScalar(error);
        particle.position.sub(this.tempVec2);
      }
    }
  }

  /**
   * Solve collisions with spheres
   */
  private solveCollisions(
    colliders: Array<{ position: THREE.Vector3; radius: number }>
  ): void {
    const { collisionRadius } = this.config;

    for (const particle of this.particles) {
      if (particle.pinned) continue;

      for (const collider of colliders) {
        this.tempVec1.subVectors(particle.position, collider.position);
        const dist = this.tempVec1.length();
        const minDist = collider.radius + collisionRadius;

        if (dist < minDist && dist > 0.0001) {
          // Push particle out of collider
          const correction = (minDist - dist) / dist;
          this.tempVec1.multiplyScalar(correction);
          particle.position.add(this.tempVec1);
        }
      }
    }
  }

  /**
   * Apply particle positions back to bones
   */
  private applyToBones(): void {
    for (let i = 1; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const parent = this.particles[particle.parentIndex];

      // Calculate direction from parent to particle in world space
      this.tempVec1.subVectors(particle.position, parent.position).normalize();

      // Get the bone's rest direction in world space
      const restDir = new THREE.Vector3(0, 1, 0); // Assuming Y-up rest pose

      // Calculate rotation from rest to current direction
      const quaternion = new THREE.Quaternion().setFromUnitVectors(restDir, this.tempVec1);

      // Convert to parent's local space and apply
      const parentWorldQuat = new THREE.Quaternion();
      parent.bone.getWorldQuaternion(parentWorldQuat);
      parentWorldQuat.invert();

      quaternion.premultiply(parentWorldQuat);

      // Blend with original rotation for stability
      parent.bone.quaternion.slerp(quaternion, 0.5);
    }
  }

  /**
   * Reset chain to rest position
   */
  reset(): void {
    for (const particle of this.particles) {
      particle.bone.getWorldPosition(particle.position);
      particle.previousPosition.copy(particle.position);
    }
  }

  /**
   * Get particle count
   */
  getParticleCount(): number {
    return this.particles.length;
  }
}

/**
 * Create spring bone system from garment metadata
 */
export function createSpringBoneSystemFromMetadata(
  skeleton: THREE.Skeleton,
  springBoneConfigs: SpringBoneConfig[]
): SpringBoneSystem {
  const system = new SpringBoneSystem();

  for (const config of springBoneConfigs) {
    system.addChainFromConfig(skeleton, config);
  }

  return system;
}
