# MirrorX IDM-VTON - Quick Start Guide

## Overview

This service implements **IDM-VTON** (Image-based Virtual Try-On Network), the current state-of-the-art open-source model for virtual try-on. It significantly outperforms older GAN-based models (like VITON-HD) and standard Stable Diffusion in preserving:

- **Garment details**: Logos, textures, patterns, text on shirts
- **Face fidelity**: 100% face preservation using InsightFace
- **Body poses**: Complex and natural poses

## Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU VRAM | 16GB | 24GB |
| GPU | RTX 3090 | RTX 4090 / A10G |
| RAM | 16GB | 32GB |
| Storage | 30GB | 50GB |
| CUDA | 12.1+ | 12.1+ |

---

## Quick Start (5 Minutes)

### Option 1: Docker (Recommended)

```bash
# Navigate to custom-model directory
cd services/custom-model

# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f mirrorx-idmvton

# Verify health
curl http://localhost:8080/health
```

### Option 2: Cloud GPU (RunPod/Vast.ai)

**RunPod:**
1. Go to https://runpod.io
2. Select: RTX 4090 (24GB VRAM) - ~$0.40/hr
3. Choose template: "RunPod PyTorch 2.1"
4. Start instance

```bash
# SSH into your instance
ssh root@<instance-ip>

# Clone MirrorX
git clone https://github.com/your-repo/Mirrorx.git
cd Mirrorx/services/custom-model

# Run with Docker
docker-compose up -d
```

### Option 3: Local Development

```bash
cd services/custom-model

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install PyTorch with CUDA
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Install dependencies
pip install -r requirements.txt

# Run server
python inference_server.py
```

---

## API Reference

### Health Check

```bash
GET /health

Response:
{
  "status": "healthy",
  "models_loaded": {
    "face_analyzer": true,
    "face_swapper": true,
    "pose_estimator": true,
    "image_encoder": true,
    "tryon_pipeline": true,
    "gradio_client": true
  },
  "gpu_available": true,
  "gpu_name": "NVIDIA GeForce RTX 4090",
  "gpu_memory_gb": 24.0,
  "version": "2.0.0-idmvton"
}
```

### Generate Try-On (Base64)

```bash
POST /tryon
Content-Type: application/json

{
  "person_image": "data:image/jpeg;base64,<base64-encoded-image>",
  "garment_image": "data:image/jpeg;base64,<base64-encoded-image>",
  "category": "upper_body",  # upper_body | lower_body | dress
  "preserve_face": true,
  "num_inference_steps": 30,
  "guidance_scale": 2.5,
  "denoise_strength": 1.0
}

Response:
{
  "result_image": "data:image/png;base64,<base64-encoded-result>",
  "metadata": {
    "face_preserved": true,
    "model_used": "idm-vton",
    "pipeline_steps": ["face_extracted", "mask_created", "tryon_generated", "face_restored"],
    "garment_category": "upper_body",
    "processing_time_ms": 15234
  }
}
```

### Generate Try-On (File Upload)

```bash
POST /tryon/upload
Content-Type: multipart/form-data

person_image: <file>
garment_image: <file>
category: upper_body
preserve_face: true
num_inference_steps: 30
guidance_scale: 2.5
```

### List Loaded Models

```bash
GET /models

Response:
{
  "models": {
    "face_analyzer": {"loaded": true, "type": "FaceAnalysis"},
    "face_swapper": {"loaded": true, "type": "INSwapper"},
    "pose_estimator": {"loaded": true, "type": "Pose"},
    "image_encoder": {"loaded": true, "type": "dict"},
    "tryon_pipeline": {"loaded": true, "type": "StableDiffusionInpaintPipeline"},
    "gradio_client": {"loaded": true, "type": "Client"}
  },
  "config": {
    "idm_vton_model": "yisol/IDM-VTON",
    "inference_steps": 30,
    "guidance_scale": 2.5,
    "device": "cuda"
  }
}
```

---

## Node.js Integration

Use the provided TypeScript service to integrate with your Node.js backend:

```typescript
// Import the service
import { idmVtonService, generateIDMVTONImage } from './services/idm-vton-service';

// Option 1: Using the service class
const result = await idmVtonService.generateTryOn({
  personImage: personBase64,
  garmentImage: garmentBase64,
  category: 'upper_body',
  preserveFace: true,
});

console.log('Result:', result.resultImage);
console.log('Face preserved:', result.metadata.facePreserved);

// Option 2: Using the convenience function
const resultImage = await generateIDMVTONImage(
  personBase64,
  garmentBase64,
  'upper_body',
  true
);

// Option 3: Using the hybrid service (IDM-VTON + Gemini fallback)
import { hybridIdmVtonService } from './services/idm-vton-service';

const result = await hybridIdmVtonService.generateTryOn(
  personBase64,
  garmentBase64,
  { category: 'upper_body', preserveFace: true }
);

console.log('Source:', result.source); // 'idm-vton' or 'gemini'
```

### Environment Variables

Configure the Node.js service with these environment variables:

```bash
# IDM-VTON Service URL
IDM_VTON_SERVICE_URL=http://localhost:8080

# Request timeout (ms)
IDM_VTON_TIMEOUT=180000

# Retry configuration
IDM_VTON_MAX_RETRIES=3
IDM_VTON_RETRY_DELAY=2000

# Enable HF Space fallback
IDM_VTON_ENABLE_FALLBACK=true
```

---

## Configuration

### Python Server Environment Variables

```bash
# Model Configuration
IDM_VTON_MODEL_ID=yisol/IDM-VTON
SDXL_BASE_MODEL=stabilityai/stable-diffusion-xl-base-1.0
CLIP_MODEL_ID=openai/clip-vit-large-patch14

# Inference Settings
INFERENCE_STEPS=30        # 10-50, higher = better quality, slower
GUIDANCE_SCALE=2.5        # 1-10, higher = more prompt adherence
DENOISE_STRENGTH=1.0      # 0.5-1.0, higher = more changes

# Image Settings
MAX_IMAGE_SIZE=1024       # Max dimension for input images
OUTPUT_FORMAT=PNG         # PNG or JPEG
OUTPUT_QUALITY=95         # JPEG quality (if using JPEG)

# Optimization
ENABLE_XFORMERS=true      # Memory-efficient attention
ENABLE_VAE_SLICING=true   # Reduces VRAM usage

# Face Preservation
PRESERVE_FACE_DEFAULT=true
FACE_SIMILARITY_THRESHOLD=0.5

# Fallback
ENABLE_GRADIO_FALLBACK=true
HF_SPACE_ENDPOINT=yisol/IDM-VTON

# Server
HOST=0.0.0.0
PORT=8080
```

---

## Architecture

### Pipeline Flow

```
USER INPUT (selfie + garment)
    ↓
[1. FACE EXTRACTION]
  └─ InsightFace extracts face from original image
    ↓
[2. BODY MASK GENERATION]
  └─ MediaPipe detects pose landmarks
  └─ Creates mask based on garment category
    ↓
[3. IMAGE PREPARATION]
  └─ Resize to 768x1024 (IDM-VTON input size)
  └─ Prepare garment image
    ↓
[4. IDM-VTON GENERATION]
  └─ TryonNet encodes garment features separately
  └─ Preserves high-frequency details (textures, logos)
  └─ Generates person wearing garment
    ↓
[5. FACE RESTORATION]
  └─ InsightFace detects face in generated image
  └─ Face swapper overlays original face
  └─ 100% face fidelity guaranteed
    ↓
OUTPUT: High-quality try-on image
```

### Models Used

| Model | Purpose | Size | License |
|-------|---------|------|---------|
| IDM-VTON | Virtual try-on generation | ~15GB | CC-BY-NC-SA 4.0 |
| InsightFace | Face detection/embedding | ~500MB | MIT |
| inswapper_128 | Face swapping | ~500MB | MIT |
| MediaPipe | Pose estimation | ~50MB | Apache 2.0 |
| CLIP | Image encoding | ~600MB | MIT |

---

## Performance Tuning

### For Faster Inference

```bash
# Reduce inference steps (faster, slightly lower quality)
INFERENCE_STEPS=20

# Use lower resolution
MAX_IMAGE_SIZE=768

# Enable all optimizations
ENABLE_XFORMERS=true
ENABLE_VAE_SLICING=true
```

### For Better Quality

```bash
# Increase inference steps
INFERENCE_STEPS=40

# Higher resolution
MAX_IMAGE_SIZE=1024

# Fine-tune guidance
GUIDANCE_SCALE=3.0
```

### For Lower VRAM Usage

```bash
# Enable CPU offloading in inference_server.py
# Uncomment: pipe.enable_model_cpu_offload()

# Use VAE slicing
ENABLE_VAE_SLICING=true

# Reduce batch size
MAX_BATCH_SIZE=1
```

---

## Monitoring

### Enable Prometheus + Grafana

```bash
# Start with monitoring profile
docker-compose --profile monitoring up -d

# Access Grafana
open http://localhost:3001
# Login: admin / admin
```

### View Logs

```bash
# Docker logs
docker-compose logs -f mirrorx-idmvton

# Application logs
tail -f logs/inference.log
```

---

## Troubleshooting

### CUDA Out of Memory

```bash
# 1. Reduce image size
MAX_IMAGE_SIZE=768

# 2. Enable memory optimizations
ENABLE_XFORMERS=true
ENABLE_VAE_SLICING=true

# 3. Clear GPU memory
nvidia-smi --gpu-reset
```

### Models Not Loading

```bash
# Clear cache and re-download
rm -rf ~/.cache/huggingface
rm -rf ~/.insightface
docker-compose down -v
docker-compose up -d
```

### Face Not Preserved

1. Ensure face is clearly visible in input image
2. Front-facing photos work best
3. Check if InsightFace models are loaded: `curl http://localhost:8080/models`

### Connection Refused

```bash
# Check if server is running
docker-compose ps

# Check server logs
docker-compose logs mirrorx-idmvton

# Verify port is exposed
curl http://localhost:8080/health
```

### Slow First Request

The first request downloads model weights (~15GB). Subsequent requests are much faster.

To pre-download models, uncomment the model download sections in `Dockerfile` and rebuild.

---

## Alternative: CatVTON (Faster)

If IDM-VTON is too slow, switch to CatVTON for faster processing (~5s vs 15-30s):

```bash
# Update environment variable
IDM_VTON_MODEL_ID=Zheng-Chong/CatVTON

# Or use the Gradio fallback
ENABLE_GRADIO_FALLBACK=true
HF_SPACE_ENDPOINT=Zheng-Chong/CatVTON
```

Note: CatVTON is faster but slightly less accurate in texture preservation.

---

## Cost Comparison

| Volume | Gemini Cost | IDM-VTON (Self-Hosted) | Savings |
|--------|-------------|------------------------|---------|
| 1,000/mo | $20-50 | $100 (cloud GPU) | -$50 |
| 5,000/mo | $100-250 | $100 (cloud GPU) | $0-150 |
| 10,000/mo | $200-500 | $150 (cloud GPU) | $50-350 |
| 50,000/mo | $1,000-2,500 | $300 (dedicated GPU) | $700-2,200 |

**Break-even point: ~5,000 try-ons/month**

---

## Support

- **Documentation**: `docs/CUSTOM_AI_MODEL_ROADMAP.md`
- **Model comparison**: See roadmap document
- **Issues**: Check server logs at `/app/logs/`
- **GitHub**: https://github.com/yisol/IDM-VTON
