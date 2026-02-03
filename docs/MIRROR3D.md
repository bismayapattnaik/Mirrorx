# 3D Virtual Mirror - Technical Documentation

A real-time 3D virtual try-on system that tracks user movements via webcam and renders a personalized avatar wearing virtual clothing.

## Overview

The 3D Virtual Mirror is a complete MVP for browser-based virtual try-on with these key features:

- **Real-time pose tracking** using MediaPipe (15-30 FPS on mid-range laptops)
- **3D avatar rendering** with Three.js
- **Personalized body scaling** through calibration
- **Garment system** with support for multiple clothing items
- **Basic occlusion** for hands appearing in front of clothing
- **No cloud GPU required** - runs entirely in the browser

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Application                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     Mirror3DPage                            ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │  Onboarding  │  │  Mirror View │  │ Garment Selector │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    useMirror3D Hook                          ││
│  │  Orchestrates all modules and manages state                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                         Packages                                  │
│                              │                                    │
│  ┌──────────────┐   ┌───────┴───────┐   ┌──────────────────────┐│
│  │   Tracking   │──▶│   Retarget    │──▶│       Avatar         ││
│  │  (MediaPipe) │   │ (Pose→Bones)  │   │  (Load/Scale/Pose)   ││
│  └──────────────┘   └───────────────┘   └──────────────────────┘│
│         │                   │                     │              │
│         ▼                   ▼                     ▼              │
│  ┌──────────────┐   ┌───────────────┐   ┌──────────────────────┐│
│  │   Wardrobe   │──▶│    Render     │──▶│     Compositor       ││
│  │  (Garments)  │   │  (Three.js)   │   │    (Occlusion)       ││
│  └──────────────┘   └───────────────┘   └──────────────────────┘│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Package Structure

```
/packages
  /mirror3d-tracking     # MediaPipe pose/hand tracking
    src/
      types.ts           # Landmark types, tracking config
      smoothing.ts       # Kalman, exponential, One Euro filters
      tracking-manager.ts # Main tracking orchestrator
      index.ts

  /mirror3d-retarget     # Pose-to-skeleton mapping
    src/
      types.ts           # Humanoid bone definitions
      math.ts            # Vec3, Quat, IK solvers
      pose-solver.ts     # MediaPipe → bone rotations
      index.ts

  /mirror3d-avatar       # Avatar loading and management
    src/
      types.ts           # UserProfile, BodyScales
      avatar-manager.ts  # GLB loading, bone mapping
      body-estimator.ts  # Auto body measurement
      index.ts

  /mirror3d-wardrobe     # Garment system
    src/
      types.ts           # GarmentMetadata, categories
      wardrobe-manager.ts # Load, equip, unequip garments
      index.ts

  /mirror3d-render       # Three.js rendering
    src/
      types.ts           # Render config, lighting
      scene-manager.ts   # Scene, camera, lights
      occlusion-compositor.ts # Hand occlusion masking
      index.ts

/apps/web/src/components/mirror3d
  types.ts               # UI-specific types
  useMirror3D.ts         # Main hook orchestrating everything
  Mirror3DOnboarding.tsx # Calibration flow
  Mirror3DView.tsx       # Main mirror UI
  index.ts
```

## Data Schemas

### UserProfile.json
```typescript
interface UserProfile {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  bodyScales: {
    height: number;        // 0.8 - 1.2
    shoulderWidth: number; // 0.8 - 1.3
    torsoWidth: number;    // 0.8 - 1.3
    hipWidth: number;      // 0.8 - 1.3
    armLength: number;     // 0.9 - 1.1
    legLength: number;     // 0.9 - 1.1
    headSize: number;      // 0.9 - 1.1
  };
  faceTexture?: string;    // Base64 data URL (optional)
  capturedPhotos?: {
    front?: string;
    side?: string;
    angle45?: string;
  };
}
```

### GarmentMetadata.json
```typescript
interface GarmentMetadata {
  id: string;
  name: string;
  category: 'top' | 'outerwear' | 'bottom' | 'dress' | 'footwear' | 'accessory';
  layer: number;           // Render order (higher = on top)
  thumbnailUrl?: string;
  glbPath: string;
  brand?: string;
  price?: number;
  currency?: string;
  colors?: Array<{ id: string; name: string; hex: string }>;
  technical: {
    affectedBones: string[];
    hasPhysics?: boolean;
    springBones?: SpringBoneConfig[];
  };
}
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- pnpm 8+
- Modern browser with WebGL support (Chrome, Firefox, Edge, Safari)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd mirrorx

# Install dependencies
pnpm install

# Start development server
pnpm dev:web
```

### Running the 3D Mirror

1. Open `http://localhost:3000/mirror3d` in your browser
2. Allow camera access when prompted
3. Complete the calibration flow (or skip)
4. Use the garment selector to try on clothes
5. Adjust body calibration sliders if needed

## Adding Garments

### Step 1: Prepare the 3D Model

1. Create or download a rigged clothing model
2. Ensure it uses standard humanoid bone names (Mixamo naming supported)
3. Export as GLB format
4. Optimize: < 15,000 triangles, 2048x2048 max textures

### Step 2: Create Metadata

Create a JSON file with garment info:
```json
{
  "id": "my-new-shirt",
  "name": "My New Shirt",
  "category": "top",
  "layer": 2,
  "glbPath": "/assets/garments/my-new-shirt.glb",
  "technical": {
    "affectedBones": ["spine", "chest", "leftUpperArm", "rightUpperArm"]
  }
}
```

### Step 3: Add to Application

1. Place GLB in `/apps/web/public/assets/garments/`
2. Add thumbnail to `/apps/web/public/assets/garments/thumbnails/`
3. Add metadata to `SAMPLE_GARMENTS` in `/apps/web/src/components/mirror3d/types.ts`

## Performance Optimization

### Target: 15-30 FPS on mid-range laptops

Optimizations implemented:
- **Tracking throttling**: MediaPipe runs at max 30 FPS independent of render
- **GPU delegation**: WebGL for tracking when available
- **Lite models**: Using MediaPipe Lite variants
- **Pose smoothing**: One Euro filter reduces jitter with minimal latency
- **Lazy loading**: Garments loaded on-demand
- **Texture compression**: Support for KTX2 textures

### If performance is low:

1. Reduce browser window size
2. Close other GPU-intensive tabs
3. Disable hand tracking (pose-only mode)
4. Use Chrome/Edge (better WebGL performance)

## Troubleshooting

### "Camera access denied"
- Check browser permissions (camera icon in URL bar)
- Ensure no other app is using the camera
- Try refreshing the page

### "Tracking not working"
- Ensure good lighting (not backlit)
- Stand 1-2 meters from camera
- Wear contrasting clothing
- Check if body is fully visible

### "Avatar not visible"
- Check browser console for errors
- Verify WebGL is enabled
- Try a different browser

### "Garments not loading"
- Check network tab for 404 errors
- Verify GLB file paths are correct
- Check browser console for Three.js errors

## API Reference

### useMirror3D Hook

```typescript
const {
  isInitialized,    // boolean - System ready
  isTracking,       // boolean - Tracking active
  status,           // TrackingStatus - FPS, confidence, errors
  userProfile,      // UserProfile - Current user settings
  equippedGarments, // string[] - Equipped garment IDs

  initialize,       // () => Promise<void>
  startTracking,    // () => Promise<void>
  stopTracking,     // () => void
  equipGarment,     // (garment: GarmentMetadata) => Promise<void>
  unequipGarment,   // (category: string) => void
  updateBodyScales, // (scales: Partial<BodyScales>) => void
  saveUserProfile,  // () => void
  resetCalibration, // () => void
  dispose,          // () => void
} = useMirror3D({ containerRef, videoRef });
```

## Browser Support

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome 90+ | ✅ Full | Recommended |
| Edge 90+ | ✅ Full | Chromium-based |
| Firefox 90+ | ✅ Full | Good performance |
| Safari 15+ | ⚠️ Partial | WebGL limitations |
| Mobile Chrome | ⚠️ Partial | Performance varies |
| Mobile Safari | ❌ Limited | WebGL issues |

## License

MIT License - See LICENSE file for details.
