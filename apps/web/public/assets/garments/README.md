# Garment Assets

This folder contains 3D garment models for the Virtual Mirror.

## File Structure

```
/garments
  /thumbnails        # Thumbnail images for UI (PNG, 160x200px recommended)
    tshirt-white.png
    hoodie-gray.png
    jeans-blue.png
  tshirt-basic.glb   # T-shirt 3D model
  hoodie-classic.glb # Hoodie 3D model
  jeans-slim.glb     # Jeans 3D model
```

## Garment Model Requirements

### Format
- **GLB format** (GLTF binary)
- File size: < 2MB per garment for optimal loading

### Rigging
Garments must be rigged to a standard humanoid skeleton with these bone names:
- **Spine**: `Spine`, `Spine1`, `Spine2`, `Chest`
- **Arms**: `LeftShoulder`, `LeftUpperArm`, `LeftLowerArm`, `LeftHand`, (Right equivalents)
- **Legs**: `LeftUpperLeg`, `LeftLowerLeg`, `LeftFoot`, (Right equivalents)

Mixamo-style naming is also supported (`mixamorigSpine`, etc.)

### Geometry
- Polygon count: 5,000-15,000 triangles recommended
- Single mesh or split by material
- UV mapped for texturing

### Materials
- PBR materials (metallic-roughness workflow)
- Textures: 1024x1024 or 2048x2048 max
- Include:
  - Base color/Albedo
  - Normal map (optional)
  - Roughness (optional)
  - Metallic (optional)

## Metadata JSON

Each garment should have a corresponding metadata file. See `/packages/mirror3d-wardrobe/src/types.ts` for the `GarmentMetadata` interface.

Example `tshirt-basic.json`:
```json
{
  "id": "tshirt-basic-white",
  "name": "Basic T-Shirt",
  "category": "top",
  "layer": 2,
  "thumbnailUrl": "/assets/garments/thumbnails/tshirt-white.png",
  "brand": "MirrorX Basics",
  "price": 29.99,
  "currency": "USD",
  "colors": [
    { "id": "white", "name": "White", "hex": "#ffffff" },
    { "id": "black", "name": "Black", "hex": "#1a1a1a" }
  ],
  "technical": {
    "glbPath": "/assets/garments/tshirt-basic.glb",
    "affectedBones": ["spine", "chest", "leftShoulder", "rightShoulder", "leftUpperArm", "rightUpperArm"]
  }
}
```

## Adding New Garments

1. Export your 3D model as GLB
2. Create a thumbnail image (160x200px PNG)
3. Create a metadata JSON file
4. Place all files in this folder
5. Register the garment in `apps/web/src/components/mirror3d/types.ts` (SAMPLE_GARMENTS array)

## Free Resources

You can find free CC0/MIT licensed garment models at:
- [Mixamo](https://www.mixamo.com/) - Characters with clothes
- [Sketchfab](https://sketchfab.com/) - Search for "rigged clothing"
- [CGTrader](https://www.cgtrader.com/) - Free section
- [TurboSquid](https://www.turbosquid.com/) - Free section
