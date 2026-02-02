# MirrorX Custom Model - Quick Start Guide

## 5-Minute Setup (Cloud GPU)

The fastest way to test your own model using RunPod or Vast.ai:

### Step 1: Rent a GPU (~$0.40/hr)

**RunPod:**
1. Go to https://runpod.io
2. Select: RTX 4090 (24GB VRAM) - ~$0.40/hr
3. Choose template: "RunPod Pytorch 2.1"
4. Start instance

**Vast.ai:**
1. Go to https://vast.ai
2. Filter: RTX 4090, PyTorch
3. Rent instance

### Step 2: Clone and Setup

```bash
# SSH into your instance
ssh root@<instance-ip>

# Clone MirrorX
git clone https://github.com/your-repo/Mirrorx.git
cd Mirrorx/services/custom-model

# Make setup executable and run
chmod +x setup.sh
./setup.sh
```

### Step 3: Run Server

```bash
source .venv/bin/activate
python inference_server.py
```

Server will be available at `http://<instance-ip>:8080`

### Step 4: Test

```bash
# Health check
curl http://localhost:8080/health

# Test try-on (with base64 images)
curl -X POST http://localhost:8080/tryon \
  -H "Content-Type: application/json" \
  -d '{
    "person_image": "<base64-person-image>",
    "cloth_image": "<base64-cloth-image>",
    "preserve_face": true
  }'
```

---

## Local Development Setup

### Requirements
- NVIDIA GPU with 12GB+ VRAM (RTX 3060 minimum, 4090 recommended)
- Ubuntu 20.04+ or Windows with WSL2
- CUDA 12.1+
- Python 3.10+

### Setup

```bash
cd services/custom-model

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt

# Run server
python inference_server.py
```

---

## Production Deployment

### Docker (Recommended)

```bash
# Build image
docker build -t mirrorx-tryon .

# Run with GPU
docker run --gpus all -p 8080:8080 mirrorx-tryon

# Or use docker-compose
docker-compose up -d
```

### Kubernetes

See `docs/CUSTOM_AI_MODEL_ROADMAP.md` for full Kubernetes deployment configuration.

---

## Upgrade Path: Better Models

The starter uses Stable Diffusion Inpainting. For production, upgrade to:

### Option 1: IDM-VTON (Recommended)

```bash
# Clone IDM-VTON
git clone https://github.com/yisol/IDM-VTON.git

# Download checkpoints
# See: https://github.com/yisol/IDM-VTON#download-checkpoints

# Update inference_server.py to use IDM-VTON pipeline
```

### Option 2: OOTDiffusion

```bash
# Clone OOTDiffusion
git clone https://github.com/levihsu/OOTDiffusion.git

# Download checkpoints
# See: https://github.com/levihsu/OOTDiffusion#checkpoints
```

---

## Integration with MirrorX API

Update your existing API to use the custom model:

```typescript
// apps/api/src/services/custom-tryon.ts

const CUSTOM_MODEL_URL = process.env.CUSTOM_MODEL_URL || 'http://localhost:8080';

export async function generateCustomTryOn(
  personBase64: string,
  clothBase64: string
): Promise<string> {
  const response = await fetch(`${CUSTOM_MODEL_URL}/tryon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person_image: personBase64,
      cloth_image: clothBase64,
      preserve_face: true
    })
  });

  const result = await response.json();
  return result.result_image;
}
```

---

## Cost Calculator

| Volume | Gemini Cost | Self-Hosted Cost | Savings |
|--------|-------------|------------------|---------|
| 1,000/mo | $20-50 | $100 (server) | -$50 |
| 5,000/mo | $100-250 | $100 (server) | $0-150 |
| 10,000/mo | $200-500 | $100 (server) | $100-400 |
| 50,000/mo | $1,000-2,500 | $200 (server) | $800-2,300 |

**Break-even point: ~5,000 try-ons/month**

---

## Troubleshooting

### CUDA Out of Memory
```bash
# Reduce batch size and use CPU offloading
export MODEL_PRECISION=fp16
export MAX_BATCH_SIZE=1
```

### Models not loading
```bash
# Clear cache and re-download
rm -rf ~/.cache/huggingface
rm -rf ~/.insightface
python inference_server.py
```

### Face not preserved
- Ensure InsightFace and face swapper models are loaded
- Check if face is clearly visible in input image
- Front-facing photos work best

---

## Support

- Roadmap: `docs/CUSTOM_AI_MODEL_ROADMAP.md`
- Model comparison: See roadmap document
- Issues: Check logs at `/var/log/mirrorx/`
