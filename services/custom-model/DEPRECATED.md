# ⚠️ DEPRECATED - Custom Model Infrastructure

**Deprecated as of:** February 2026  
**Reason:** Migrated to Gemini 3 Pro Image Preview with native Reference Image Injection

## What Changed

The Virtual Try-On pipeline has been upgraded to use **Gemini 3 Pro Image Preview** (`gemini-3-pro-image-preview`) which provides:

1. **Native Reference Image Injection** - Face identity is preserved by the AI model itself
2. **Lighting Integration** - The AI calculates how room lighting affects the garment
3. **Seam Blending** - Smooth skin-to-fabric transitions without hard compositing
4. **Color Grading** - Automatic white balance matching

## Previous Architecture (Deprecated)

This folder contained a custom IDM-VTON model deployment:
- `inference_server.py` - Flask server for model inference
- `Dockerfile` - Container for GPU deployment
- `deploy.sh` - Vertex AI deployment script
- `docker-compose.yml` - Local testing configuration

## Current Architecture

The new implementation is entirely in:
- `apps/api/src/services/gemini.ts` - Main try-on engine using Gemini 3
- `apps/api/src/services/masking.ts` - Face detection (fallback only)
- `apps/api/src/services/post-processor.ts` - Conditional face restoration

## Migration Notes

- The `restoreIdentity` function is now **conditional** instead of mandatory
- Face overlay only triggers if AI corrupts the face (< 75% similarity)
- This eliminates the "Sticker Effect" from hard pixel compositing

## Cleanup

These files can be safely deleted once the migration is verified in production.
