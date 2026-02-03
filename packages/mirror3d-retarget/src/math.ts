/**
 * @fileoverview Math utilities for pose retargeting
 * Vector and quaternion operations for skeletal animation
 */

/**
 * Simple 3D vector class
 */
export class Vec3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  static fromArray(arr: number[]): Vec3 {
    return new Vec3(arr[0] || 0, arr[1] || 0, arr[2] || 0);
  }

  static fromObject(obj: { x: number; y: number; z: number }): Vec3 {
    return new Vec3(obj.x, obj.y, obj.z);
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  add(v: Vec3): Vec3 {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: Vec3): Vec3 {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize(): Vec3 {
    const len = this.length();
    if (len === 0) return new Vec3(0, 1, 0); // Default up vector
    return this.scale(1 / len);
  }

  negate(): Vec3 {
    return new Vec3(-this.x, -this.y, -this.z);
  }

  lerp(v: Vec3, t: number): Vec3 {
    return new Vec3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toObject(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }
}

/**
 * Quaternion class for rotations
 */
export class Quat {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public w: number = 1
  ) {}

  static identity(): Quat {
    return new Quat(0, 0, 0, 1);
  }

  static fromAxisAngle(axis: Vec3, angle: number): Quat {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    const normalizedAxis = axis.normalize();
    return new Quat(
      normalizedAxis.x * s,
      normalizedAxis.y * s,
      normalizedAxis.z * s,
      Math.cos(halfAngle)
    );
  }

  /**
   * Create quaternion that rotates fromDir to toDir
   */
  static fromToRotation(fromDir: Vec3, toDir: Vec3): Quat {
    const from = fromDir.normalize();
    const to = toDir.normalize();

    const dot = from.dot(to);

    // Parallel vectors
    if (dot > 0.999999) {
      return Quat.identity();
    }

    // Opposite vectors
    if (dot < -0.999999) {
      // Find an orthogonal axis
      let axis = new Vec3(1, 0, 0).cross(from);
      if (axis.lengthSq() < 0.000001) {
        axis = new Vec3(0, 1, 0).cross(from);
      }
      return Quat.fromAxisAngle(axis.normalize(), Math.PI);
    }

    const axis = from.cross(to);
    const s = Math.sqrt((1 + dot) * 2);
    const invs = 1 / s;

    return new Quat(
      axis.x * invs,
      axis.y * invs,
      axis.z * invs,
      s * 0.5
    ).normalize();
  }

  /**
   * Create quaternion from euler angles (XYZ order)
   */
  static fromEuler(x: number, y: number, z: number): Quat {
    const cx = Math.cos(x / 2);
    const cy = Math.cos(y / 2);
    const cz = Math.cos(z / 2);
    const sx = Math.sin(x / 2);
    const sy = Math.sin(y / 2);
    const sz = Math.sin(z / 2);

    return new Quat(
      sx * cy * cz - cx * sy * sz,
      cx * sy * cz + sx * cy * sz,
      cx * cy * sz - sx * sy * cz,
      cx * cy * cz + sx * sy * sz
    );
  }

  static fromObject(obj: { x: number; y: number; z: number; w: number }): Quat {
    return new Quat(obj.x, obj.y, obj.z, obj.w);
  }

  clone(): Quat {
    return new Quat(this.x, this.y, this.z, this.w);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  normalize(): Quat {
    const len = this.length();
    if (len === 0) return Quat.identity();
    return new Quat(this.x / len, this.y / len, this.z / len, this.w / len);
  }

  conjugate(): Quat {
    return new Quat(-this.x, -this.y, -this.z, this.w);
  }

  inverse(): Quat {
    const lenSq = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    if (lenSq === 0) return Quat.identity();
    return new Quat(-this.x / lenSq, -this.y / lenSq, -this.z / lenSq, this.w / lenSq);
  }

  /**
   * Multiply two quaternions (this * q)
   */
  multiply(q: Quat): Quat {
    return new Quat(
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z
    );
  }

  /**
   * Rotate a vector by this quaternion
   */
  rotateVector(v: Vec3): Vec3 {
    const qv = new Quat(v.x, v.y, v.z, 0);
    const result = this.multiply(qv).multiply(this.conjugate());
    return new Vec3(result.x, result.y, result.z);
  }

  /**
   * Spherical linear interpolation
   */
  slerp(q: Quat, t: number): Quat {
    let dot = this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;

    // If dot is negative, negate one quaternion to take the shorter path
    let target = q;
    if (dot < 0) {
      target = new Quat(-q.x, -q.y, -q.z, -q.w);
      dot = -dot;
    }

    // If quaternions are very close, use linear interpolation
    if (dot > 0.9995) {
      return new Quat(
        this.x + t * (target.x - this.x),
        this.y + t * (target.y - this.y),
        this.z + t * (target.z - this.z),
        this.w + t * (target.w - this.w)
      ).normalize();
    }

    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);

    const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
    const s1 = sinTheta / sinTheta0;

    return new Quat(
      s0 * this.x + s1 * target.x,
      s0 * this.y + s1 * target.y,
      s0 * this.z + s1 * target.z,
      s0 * this.w + s1 * target.w
    );
  }

  /**
   * Convert to euler angles (XYZ order)
   */
  toEuler(): Vec3 {
    // Roll (x-axis rotation)
    const sinrCosp = 2 * (this.w * this.x + this.y * this.z);
    const cosrCosp = 1 - 2 * (this.x * this.x + this.y * this.y);
    const roll = Math.atan2(sinrCosp, cosrCosp);

    // Pitch (y-axis rotation)
    const sinp = 2 * (this.w * this.y - this.z * this.x);
    let pitch: number;
    if (Math.abs(sinp) >= 1) {
      pitch = Math.sign(sinp) * Math.PI / 2; // Gimbal lock
    } else {
      pitch = Math.asin(sinp);
    }

    // Yaw (z-axis rotation)
    const sinyCosp = 2 * (this.w * this.z + this.x * this.y);
    const cosyCosp = 1 - 2 * (this.y * this.y + this.z * this.z);
    const yaw = Math.atan2(sinyCosp, cosyCosp);

    return new Vec3(roll, pitch, yaw);
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w];
  }

  toObject(): { x: number; y: number; z: number; w: number } {
    return { x: this.x, y: this.y, z: this.z, w: this.w };
  }
}

/**
 * Calculate the rotation needed to align a bone from one position to another
 * @param boneStart - Start position of the bone
 * @param boneEnd - End position of the bone
 * @param targetEnd - Target end position
 * @param boneRestDirection - The rest pose direction of the bone
 */
export function calculateBoneRotation(
  boneStart: Vec3,
  boneEnd: Vec3,
  targetEnd: Vec3,
  boneRestDirection: Vec3 = new Vec3(0, 1, 0)
): Quat {
  const currentDir = boneEnd.sub(boneStart).normalize();
  const targetDir = targetEnd.sub(boneStart).normalize();
  return Quat.fromToRotation(currentDir, targetDir);
}

/**
 * Clamp a quaternion rotation to specified euler limits
 */
export function clampRotation(
  rotation: Quat,
  minEuler: Vec3,
  maxEuler: Vec3
): Quat {
  const euler = rotation.toEuler();
  const clampedEuler = new Vec3(
    Math.max(minEuler.x, Math.min(maxEuler.x, euler.x)),
    Math.max(minEuler.y, Math.min(maxEuler.y, euler.y)),
    Math.max(minEuler.z, Math.min(maxEuler.z, euler.z))
  );
  return Quat.fromEuler(clampedEuler.x, clampedEuler.y, clampedEuler.z);
}

/**
 * Calculate the angle between two vectors
 */
export function angleBetween(a: Vec3, b: Vec3): number {
  const dot = a.normalize().dot(b.normalize());
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/**
 * Two-bone IK solver (for arm/leg chains)
 * Returns the rotations for the upper and lower bones
 */
export function solveTwoBoneIK(
  rootPos: Vec3,
  upperLength: number,
  lowerLength: number,
  targetPos: Vec3,
  poleVector: Vec3 = new Vec3(0, 0, 1),
  upperRestDir: Vec3 = new Vec3(0, -1, 0),
  lowerRestDir: Vec3 = new Vec3(0, -1, 0)
): { upperRotation: Quat; lowerRotation: Quat } {
  const toTarget = targetPos.sub(rootPos);
  const targetDist = toTarget.length();
  const totalLength = upperLength + lowerLength;

  // Clamp target distance to reachable range
  const clampedDist = Math.max(Math.abs(upperLength - lowerLength) + 0.001,
                                Math.min(totalLength - 0.001, targetDist));

  // Calculate elbow angle using law of cosines
  const cosElbow = (upperLength * upperLength + lowerLength * lowerLength - clampedDist * clampedDist)
                   / (2 * upperLength * lowerLength);
  const elbowAngle = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosElbow)));

  // Calculate shoulder angle
  const cosShoulder = (upperLength * upperLength + clampedDist * clampedDist - lowerLength * lowerLength)
                      / (2 * upperLength * clampedDist);
  const shoulderAngle = Math.acos(Math.max(-1, Math.min(1, cosShoulder)));

  // Calculate the plane of the arm using pole vector
  const targetDir = toTarget.normalize();
  const poleDir = poleVector.sub(targetDir.scale(poleVector.dot(targetDir))).normalize();

  // Build rotation for upper bone
  // First rotate to point at target, then rotate by shoulder angle in the pole plane
  const upperRotation = Quat.fromToRotation(upperRestDir, targetDir)
    .multiply(Quat.fromAxisAngle(targetDir.cross(poleDir).normalize(), -shoulderAngle));

  // Lower bone rotation (just the elbow bend)
  const lowerRotation = Quat.fromAxisAngle(poleDir, elbowAngle);

  return { upperRotation, lowerRotation };
}

/**
 * Look-at rotation (for head tracking)
 */
export function lookAtRotation(
  forward: Vec3 = new Vec3(0, 0, 1),
  up: Vec3 = new Vec3(0, 1, 0),
  targetDir: Vec3
): Quat {
  const targetNorm = targetDir.normalize();

  // Get rotation to point forward at target
  const forwardRot = Quat.fromToRotation(forward, targetNorm);

  // Preserve up vector as much as possible
  const rotatedUp = forwardRot.rotateVector(up);
  const desiredUp = up.sub(targetNorm.scale(up.dot(targetNorm))).normalize();

  if (desiredUp.lengthSq() > 0.0001) {
    const upRot = Quat.fromToRotation(rotatedUp, desiredUp);
    return upRot.multiply(forwardRot);
  }

  return forwardRot;
}
