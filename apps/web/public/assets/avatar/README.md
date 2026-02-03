# Avatar Assets

This folder contains the base humanoid avatar model for the Virtual Mirror.

## Required File

```
/avatar
  humanoid.glb     # Base humanoid avatar model
```

## Avatar Model Requirements

### Format
- **GLB format** (GLTF binary)
- Single file containing mesh, skeleton, and materials

### Skeleton (Required Bones)
The avatar must have a standard humanoid skeleton with these bones:

**Core:**
- `Hips` (root bone)
- `Spine`, `Spine1`, `Spine2` (or `Chest`)
- `Neck`
- `Head`

**Arms (both sides):**
- `LeftShoulder` / `RightShoulder`
- `LeftUpperArm` / `RightUpperArm` (or `LeftArm` / `RightArm`)
- `LeftLowerArm` / `RightLowerArm` (or `LeftForeArm` / `RightForeArm`)
- `LeftHand` / `RightHand`

**Legs (both sides):**
- `LeftUpperLeg` / `RightUpperLeg` (or `LeftUpLeg` / `RightUpLeg`)
- `LeftLowerLeg` / `RightLowerLeg` (or `LeftLeg` / `RightLeg`)
- `LeftFoot` / `RightFoot`
- `LeftToes` / `RightToes` (optional)

**Fingers (optional but recommended):**
- Thumb, Index, Middle, Ring, Pinky joints

### Mesh
- Should be a SkinnedMesh bound to the skeleton
- T-pose or A-pose rest position
- ~10,000-20,000 triangles recommended
- Clean UV mapping

### Size
- Height: ~1.7 meters (standing)
- Centered at origin
- Y-up orientation

### Supported Conventions
The system supports multiple naming conventions:
- Standard names: `LeftUpperArm`, `RightShoulder`, etc.
- Mixamo: `mixamorigLeftArm`, `mixamorigRightShoulder`, etc.
- VRM: `J_Bip_L_UpperArm`, etc.
- Blender: `upper_arm_L`, `shoulder_R`, etc.

## Free Avatar Resources

You can download free humanoid avatars from:

1. **Mixamo** (Recommended)
   - https://www.mixamo.com/
   - Download any character
   - Export as FBX, convert to GLB

2. **Ready Player Me**
   - https://readyplayer.me/
   - Create custom avatars
   - Export as GLB

3. **VRoid Hub**
   - https://hub.vroid.com/
   - Anime-style avatars
   - VRM format (convert to GLB)

4. **Sketchfab**
   - Search for "humanoid rigged" or "character rigged"
   - Filter by downloadable and GLB format

## Converting Models

### FBX to GLB (using Blender)
1. Import FBX into Blender
2. Select the armature and mesh
3. File > Export > glTF 2.0 (.glb)
4. Settings:
   - Format: GLB
   - Include: Selected Objects
   - Transform: +Y Up
   - Mesh: Apply Modifiers
   - Animation: Disable if not needed

### VRM to GLB
Use the UniVRM Unity package or online converters like:
- https://vrm.dev/en/

## Placeholder Avatar

If no avatar model is available, the system will create a simple geometric placeholder:
- Capsule body
- Sphere head
- Capsule limbs

This allows testing the tracking and UI without a proper model.
