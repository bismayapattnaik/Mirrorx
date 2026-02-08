# LTX-2 360° Video Generation Service

FastAPI-based inference service for generating 360-degree rotation videos from static images using a fine-tuned LTX-2 model.

## Overview

This service is part of the MirrorX virtual try-on pipeline:

```
User Photo + Garment → [IDM-VTON] → Static Try-On → [LTX-2 360°] → Rotating Video
```

The service accepts a static image (typically from IDM-VTON) and generates a video showing the person rotating 360 degrees, allowing customers to see how the garment looks from all angles.

## Features

- **Async Job Processing**: Submit jobs and poll for completion
- **Sync Generation**: Direct video generation for quick results
- **GPU Acceleration**: CUDA support with memory optimizations
- **LoRA Integration**: Load fine-tuned rotation weights
- **Health Monitoring**: Health check endpoint for service discovery
- **Docker Ready**: Production-ready containerization

## Quick Start

### Option 1: Local Setup

```bash
# Run setup script
./setup.sh

# Activate virtual environment
source venv/bin/activate

# Start the server
python inference_360.py
```

### Option 2: Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build manually
docker build -t ltx2-video .
docker run --gpus all -p 5001:5001 ltx2-video
```

The service will be available at `http://localhost:5001`.

## API Endpoints

### Health Check
```http
GET /health
```

Returns service health status, model loading state, and GPU information.

### Submit Generation Job (Async)
```http
POST /generate-360
Content-Type: multipart/form-data

image: <file>
prompt: "a 360-degree rotating shot..."
num_frames: 80
num_inference_steps: 40
```

Returns a job ID for status tracking.

### Get Job Status
```http
GET /job/{job_id}
```

Returns current job status, progress, and result URL when complete.

### Download Video
```http
GET /download/{job_id}
```

Downloads the generated video (MP4) for a completed job.

### Sync Generation
```http
POST /generate-360/sync
```

Generates video synchronously and returns MP4 directly. Use for quick testing; prefer async for production.

### List Jobs
```http
GET /jobs?status=completed&limit=50
```

Lists all jobs, optionally filtered by status.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_MODEL` | `Lightricks/LTX-Video` | HuggingFace model ID |
| `LORA_PATH` | `./outputs/ltx2_360/checkpoint-5000` | Path to LoRA weights |
| `DEVICE` | `cuda` | Device (cuda/cpu) |
| `PORT` | `5001` | Service port |
| `MAX_CONCURRENT_JOBS` | `2` | Max parallel generation jobs |
| `DEFAULT_NUM_FRAMES` | `80` | Default frames (~3s at 24fps) |
| `DEFAULT_INFERENCE_STEPS` | `40` | Denoising steps |
| `DEFAULT_GUIDANCE_SCALE` | `3.0` | Text guidance strength |
| `DEFAULT_IMAGE_GUIDANCE_SCALE` | `1.8` | Image preservation strength |

## Integration with Node.js API

The MirrorX API integrates with this service via `ltx2-service.ts`:

```typescript
import { ltx2Service } from './services/ltx2-service';

// Generate 360° video from try-on result
const result = await ltx2Service.generate360TryOn(
  userImageBuffer,
  garmentImageBuffer,
  { category: 'upper_body' }
);

// Poll for completion
const status = await ltx2Service.waitForCompletion(result.jobId);

// Download video
const videoBuffer = await ltx2Service.downloadVideo(result.jobId);
```

## Training Custom LoRA Weights

To train your own rotation LoRA:

1. Prepare training data (360° rotation videos)
2. Use the training toolkit in `packages/ltx-trainer/`
3. Copy trained weights to `./lora_weights/`

See `packages/ltx-trainer/README.md` for detailed instructions.

## GPU Memory Requirements

| Resolution | Frames | VRAM Required |
|------------|--------|---------------|
| 512x512 | 80 | ~12GB |
| 512x512 | 120 | ~16GB |
| 768x768 | 80 | ~20GB |
| 1024x1024 | 80 | ~32GB |

For GPUs with less VRAM, the service automatically enables:
- VAE slicing
- VAE tiling
- CPU offloading (if needed)

## API Documentation

Interactive API docs available at:
- Swagger UI: `http://localhost:5001/docs`
- ReDoc: `http://localhost:5001/redoc`

## Troubleshooting

### Model Not Loading
- Ensure sufficient disk space (~10GB for base model)
- Check HuggingFace token if model is gated
- Verify CUDA installation with `nvidia-smi`

### Out of Memory
- Reduce `num_frames` or resolution
- Ensure `xformers` is installed
- Lower `MAX_CONCURRENT_JOBS` to 1

### Slow Generation
- Enable CUDA (`DEVICE=cuda`)
- Install xformers for memory-efficient attention
- Use lower `num_inference_steps` (30 instead of 40)

### LoRA Not Loading
- Verify `LORA_PATH` points to valid checkpoint
- Check LoRA was trained with compatible diffusers version
- Try without LoRA first to verify base model works

## License

MIT License - See LICENSE file for details.
