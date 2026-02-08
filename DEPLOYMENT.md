# MirrorX Production Deployment Guide

This guide covers deploying MirrorX with IDM-VTON and LTX-2 models for production use.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MirrorX Stack                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Web App   │────│  API Server │────│  PostgreSQL │         │
│  │   (React)   │    │  (Node.js)  │    │  (Database) │         │
│  └─────────────┘    └──────┬──────┘    └─────────────┘         │
│                            │                                     │
│              ┌─────────────┼─────────────┐                      │
│              │             │             │                      │
│              ▼             ▼             ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  IDM-VTON   │  │   LTX-2     │  │    Redis    │             │
│  │  (PyTorch)  │  │  (PyTorch)  │  │   (Cache)   │             │
│  │  Port 8080  │  │  Port 5001  │  │  Port 6379  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU VRAM | 16GB | 24GB |
| System RAM | 32GB | 64GB |
| Storage | 50GB | 100GB |
| CPU | 8 cores | 16+ cores |

### Supported GPUs
- NVIDIA RTX 3090/3090 Ti
- NVIDIA RTX 4090
- NVIDIA A10G (AWS)
- NVIDIA A100 (Cloud)
- NVIDIA L4/L40 (Cloud)

### Software Requirements
- Docker 24.0+
- Docker Compose v2+
- NVIDIA Container Toolkit (for GPU)
- CUDA 12.1+

## Quick Start

### 1. Clone and Setup

```bash
# Clone repository
git clone <repository-url>
cd Mirrorx

# Copy environment template
cp .env.production .env

# Edit .env with your API keys
nano .env
```

### 2. Configure Environment

Edit `.env` with your credentials:

```bash
# Required
HF_TOKEN=your_huggingface_token
POSTGRES_PASSWORD=your_secure_password

# Optional (for fallback)
GOOGLE_AI_API_KEY=your_gemini_key
REPLICATE_API_TOKEN=your_replicate_token
```

### 3. Deploy

```bash
# Deploy with GPU support
./scripts/deploy.sh --gpu

# Or deploy CPU-only (slower inference)
./scripts/deploy.sh
```

### 4. Verify Deployment

```bash
# Check service health
curl http://localhost:3000/health      # API
curl http://localhost:8080/health      # IDM-VTON
curl http://localhost:5001/health      # LTX-2

# View logs
docker compose logs -f
```

## Detailed Setup

### Pre-Download Models (Optional)

Pre-downloading models speeds up first startup:

```bash
./scripts/download-models.sh

# Download only IDM-VTON models
./scripts/download-models.sh --idm-vton

# Download only LTX-2 models
./scripts/download-models.sh --ltx2
```

### Manual Docker Deployment

```bash
# Build images
docker compose build

# Start with GPU
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

# Start without GPU (uses Gradio fallback)
docker compose up -d
```

### Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:3000 | Main API server |
| IDM-VTON | http://localhost:8080 | Virtual try-on inference |
| LTX-2 | http://localhost:5001 | 360° video generation |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

## Training Models

### Training LTX-2 for 360° Rotation

1. **Prepare Dataset**

   Place your 360° rotation videos in a folder:
   ```bash
   mkdir -p raw_360_videos
   # Add your .mp4 files here
   ```

2. **Create Training Dataset**
   ```bash
   ./scripts/train.sh prepare-dataset ./raw_360_videos
   ```

3. **Start Training**
   ```bash
   # Single GPU
   ./scripts/train.sh ltx2

   # Multi-GPU
   accelerate launch --multi_gpu packages/ltx-trainer/scripts/train_ltx2_360.py \
       --config packages/ltx-trainer/configs/ltx2_360_lora.yaml
   ```

4. **Use Trained Weights**

   Copy trained LoRA weights to the LTX-2 service:
   ```bash
   cp -r outputs/ltx2_360/checkpoint-5000/* services/video-generation/lora_weights/
   ```

### Training MirrorX-VTON (Optional)

1. **Prepare VTON Dataset**
   ```
   data/
   ├── train/
   │   ├── person/      # Full body photos
   │   ├── cloth/       # Garment images
   │   └── pairs.json   # Mapping file
   └── val/
       └── ...
   ```

2. **Start Training**
   ```bash
   ./scripts/train.sh vton
   ```

## API Endpoints

### Virtual Try-On

```bash
# Standard try-on (Gemini)
POST /tryon
Content-Type: multipart/form-data
- selfie_image: File
- product_image: File
- mode: PART | FULL_FIT
- gender: male | female

# IDM-VTON try-on (higher quality)
POST /tryon/idmvton
Content-Type: multipart/form-data
- selfie_image: File
- product_image: File
- category: upper_body | lower_body | dress
- preserve_face: true | false
```

### 360° Video Generation

```bash
# Submit 360° video job
POST /tryon/360
Content-Type: multipart/form-data
- image: File (or image_base64)
- prompt: string
- num_frames: int (default: 80)

# Full pipeline (VTON + 360° video)
POST /tryon/360/full
Content-Type: multipart/form-data
- selfie_image: File
- product_image: File
- category: upper_body | lower_body | dress

# Check job status
GET /tryon/360/:jobId

# Download video
GET /tryon/360/:jobId/download
```

### Health Checks

```bash
GET /health                 # Main API
GET /tryon/idmvton/health   # IDM-VTON service
GET /tryon/360/health       # LTX-2 service
GET /tryon/decart/health    # Decart AI (video)
```

## Configuration

### IDM-VTON Settings

| Variable | Default | Description |
|----------|---------|-------------|
| IDM_VTON_SERVICE_URL | http://localhost:8080 | Service URL |
| INFERENCE_STEPS | 30 | Diffusion steps |
| GUIDANCE_SCALE | 2.5 | Classifier-free guidance |
| MAX_IMAGE_SIZE | 1024 | Max input resolution |
| PRESERVE_FACE_DEFAULT | true | Enable face preservation |

### LTX-2 Settings

| Variable | Default | Description |
|----------|---------|-------------|
| LTX2_SERVICE_URL | http://localhost:5001 | Service URL |
| DEFAULT_NUM_FRAMES | 80 | Frames per video |
| DEFAULT_INFERENCE_STEPS | 40 | Diffusion steps |
| MAX_CONCURRENT_JOBS | 2 | Parallel jobs |

## Monitoring

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f idm-vton
docker compose logs -f ltx2
docker compose logs -f api
```

### Resource Usage

```bash
# GPU usage
nvidia-smi -l 1

# Container stats
docker stats
```

## Troubleshooting

### Common Issues

1. **GPU not detected**
   ```bash
   # Check NVIDIA driver
   nvidia-smi

   # Check container toolkit
   docker run --rm --gpus all nvidia/cuda:12.1-base-ubuntu22.04 nvidia-smi
   ```

2. **Out of GPU memory**
   - Reduce `MAX_CONCURRENT_JOBS` to 1
   - Enable `ENABLE_VAE_SLICING=true`
   - Reduce `MAX_IMAGE_SIZE` to 768

3. **Model download fails**
   - Check `HF_TOKEN` is set correctly
   - Ensure sufficient disk space
   - Try manual download with `./scripts/download-models.sh`

4. **Service unhealthy**
   ```bash
   # Check detailed logs
   docker compose logs idm-vton --tail 100

   # Restart service
   docker compose restart idm-vton
   ```

### Performance Optimization

1. **Enable TensorRT** (2-3x faster)
   ```bash
   # In IDM-VTON Dockerfile, uncomment TensorRT installation
   ```

2. **Use FP16/BF16 precision**
   ```bash
   # Set in .env
   DTYPE=float16
   ```

3. **Increase batch size** (more VRAM needed)
   ```bash
   BATCH_SIZE=2
   ```

## Scaling

### Multi-GPU Setup

```yaml
# docker-compose.gpu.yml
services:
  idm-vton:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']  # First GPU
              capabilities: [gpu]

  ltx2:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['1']  # Second GPU
              capabilities: [gpu]
```

### Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests (coming soon).

## Security

1. **API Authentication**
   - JWT tokens required for all endpoints
   - Rate limiting enabled by default

2. **Network Security**
   - Internal services not exposed to internet
   - Use reverse proxy (nginx/traefik) for SSL

3. **Secrets Management**
   - Use Docker secrets or Kubernetes secrets
   - Never commit `.env` to version control

## Support

- **Issues**: https://github.com/your-org/mirrorx/issues
- **Documentation**: https://docs.mirrorx.ai
- **Discord**: https://discord.gg/mirrorx
