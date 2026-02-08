# MirrorX Deployment on Render + Vercel

This guide covers deploying MirrorX with:
- **Frontend**: Vercel
- **Backend API**: Render
- **GPU Services**: External providers (since Render doesn't have GPUs)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Vercel (Frontend)          Render (Backend)                   │
│   ┌─────────────┐           ┌─────────────────┐                 │
│   │   Next.js   │◄─────────►│   Node.js API   │                 │
│   │   Web App   │           │   (Express)     │                 │
│   └─────────────┘           └────────┬────────┘                 │
│                                      │                           │
│                    ┌─────────────────┼─────────────────┐        │
│                    │                 │                 │        │
│                    ▼                 ▼                 ▼        │
│            ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│            │  PostgreSQL │  │    Redis    │  │  External   │   │
│            │  (Render)   │  │  (Render)   │  │  GPU APIs   │   │
│            └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                     │           │
│                              ┌──────────────────────┼───┐       │
│                              │                      │   │       │
│                              ▼                      ▼   ▼       │
│                      ┌─────────────┐      ┌─────────────────┐  │
│                      │  HF Spaces  │      │ Modal/RunPod/   │  │
│                      │  IDM-VTON   │      │ Replicate       │  │
│                      │  (Free)     │      │ (LTX-2)         │  │
│                      └─────────────┘      └─────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## GPU Service Options

Since Render doesn't have GPU instances, here are your options:

| Option | IDM-VTON | LTX-2 | Cost | Latency |
|--------|----------|-------|------|---------|
| **HF Spaces (Free)** | ✅ Built-in | ❌ | Free | 30-60s |
| **Replicate** | ✅ | ✅ | Pay per use | 10-30s |
| **Modal** | ✅ | ✅ | Pay per use | 5-20s |
| **RunPod** | ✅ | ✅ | Pay per hour | 5-15s |

### Recommended Setup

1. **IDM-VTON**: Use HuggingFace Spaces (free, already configured)
2. **LTX-2 360°**: Deploy to Modal or use Replicate

---

## Step 1: Deploy Backend to Render

### Option A: Using Blueprint (Recommended)

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your repository
5. Render will detect `render.yaml` and create all services

### Option B: Manual Setup

1. **Create PostgreSQL Database**
   - New → PostgreSQL
   - Name: `mirrorx-db`
   - Plan: Starter ($7/mo) or Free (with limitations)

2. **Create Redis**
   - New → Redis
   - Name: `mirrorx-redis`
   - Plan: Starter ($7/mo) or Free

3. **Create Web Service**
   - New → Web Service
   - Connect your repo
   - Root Directory: `apps/api`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Environment: Node

### Environment Variables (Render Dashboard)

Set these in your web service settings:

```bash
# Required
NODE_ENV=production
PORT=3000
DATABASE_URL=<auto-populated from Render PostgreSQL>
REDIS_URL=<auto-populated from Render Redis>

# IDM-VTON (HF Spaces fallback - free)
IDM_VTON_SERVICE_URL=https://yisol-idm-vton.hf.space
IDM_VTON_ENABLE_FALLBACK=true
IDM_VTON_TIMEOUT=180000

# LTX-2 (open source - https://github.com/Lightricks/LTX-2.git)
# Set after deploying to Modal
LTX2_SERVICE_URL=<your-modal-endpoint>
LTX2_TIMEOUT=300000

# HuggingFace Token (for model downloads)
# Get yours at: https://huggingface.co/settings/tokens
HF_TOKEN=<your-huggingface-token>

# API Keys
GOOGLE_AI_API_KEY=<your-key>
JWT_SECRET=<generate-secure-random-string>

# Optional
REPLICATE_API_TOKEN=<if-using-replicate>
DECART_API_KEY=<if-using-decart>
```

**Note on LTX-2**: LTX-2 is fully open source!
- GitHub: https://github.com/Lightricks/LTX-2.git
- HuggingFace: Lightricks/LTX-Video
- No API key required - just deploy to Modal for GPU inference

---

## Step 2: Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Import your repository
3. Set the root directory to your frontend folder (e.g., `apps/web`)
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://mirrorx-api.onrender.com
   ```
5. Deploy

---

## Step 3: Setup GPU Services

### Option 1: HuggingFace Spaces (IDM-VTON - FREE)

IDM-VTON is already available on HF Spaces. The API is pre-configured to use it as fallback:

```bash
# Already configured in your API
IDM_VTON_SERVICE_URL=https://yisol-idm-vton.hf.space
IDM_VTON_ENABLE_FALLBACK=true
```

**Note**: Free tier has queue times of 30-60 seconds. For faster inference, upgrade to HF Spaces GPU ($9/hr).

### Option 2: Replicate (IDM-VTON + LTX-2)

Replicate hosts many try-on models. Add to your environment:

```bash
REPLICATE_API_TOKEN=<your-token>
```

The API already supports Replicate fallback.

### Option 3: Modal (Recommended for LTX-2)

Deploy the LTX-2 service to Modal for on-demand GPU inference:

1. **Install Modal CLI**
   ```bash
   pip install modal
   modal token new
   ```

2. **Create Modal deployment file**

Create `services/video-generation/modal_deploy.py`:

```python
import modal

app = modal.App("mirrorx-ltx2")

# Define the image with all dependencies
image = modal.Image.debian_slim().pip_install(
    "torch",
    "diffusers>=0.28.0",
    "transformers>=4.40.0",
    "accelerate",
    "peft",
    "safetensors",
    "fastapi",
    "uvicorn",
    "pillow",
    "imageio",
    "imageio-ffmpeg",
)

@app.function(
    image=image,
    gpu="A10G",  # or "T4" for cheaper
    timeout=600,
    container_idle_timeout=60,
)
@modal.web_endpoint(method="POST")
def generate_360(image_base64: str, prompt: str, num_frames: int = 80):
    """Generate 360° rotation video from image."""
    import torch
    from diffusers import DiffusionPipeline
    from PIL import Image
    import base64
    import io

    # Decode image
    image_data = base64.b64decode(image_base64.split(",")[1] if "," in image_base64 else image_base64)
    image = Image.open(io.BytesIO(image_data)).convert("RGB")

    # Load model (cached after first call)
    pipeline = DiffusionPipeline.from_pretrained(
        "Lightricks/LTX-Video",
        torch_dtype=torch.float16,
    ).to("cuda")

    # Generate video
    output = pipeline(
        image=image,
        prompt=prompt,
        num_frames=num_frames,
        num_inference_steps=40,
        guidance_scale=3.0,
    )

    # Export to video bytes
    from diffusers.utils import export_to_video
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        export_to_video(output.frames[0], f.name, fps=24)
        with open(f.name, "rb") as video_file:
            video_base64 = base64.b64encode(video_file.read()).decode()

    return {"video_base64": video_base64}

@app.function(image=image)
@modal.web_endpoint(method="GET")
def health():
    return {"status": "healthy", "gpu": "available"}
```

3. **Deploy to Modal**
   ```bash
   modal deploy services/video-generation/modal_deploy.py
   ```

4. **Get your endpoint URL** and set it in Render:
   ```bash
   LTX2_SERVICE_URL=https://your-username--mirrorx-ltx2-generate-360.modal.run
   ```

### Option 4: RunPod (Self-Hosted GPU)

For lowest latency, deploy to RunPod:

1. Go to [RunPod](https://runpod.io)
2. Create a GPU Pod (RTX 3090 or A10G)
3. Deploy using Docker:
   ```bash
   docker run -d -p 5001:5001 --gpus all \
     -e HF_TOKEN=<your-token> \
     your-registry/mirrorx-ltx2:latest
   ```
4. Use the pod URL in Render:
   ```bash
   LTX2_SERVICE_URL=https://your-pod-id.runpod.io:5001
   ```

---

## Step 4: Configure API for External Services

Update your API to handle external GPU services. The code already supports this via environment variables.

### For HF Spaces (IDM-VTON)

Already configured - uses Gradio client internally.

### For Modal/RunPod (LTX-2)

Update `apps/api/src/services/ltx2-service.ts` if needed to match your Modal endpoint format.

---

## Deployment Checklist

- [ ] Push code to GitHub
- [ ] Deploy to Render using Blueprint or manually
- [ ] Set all environment variables in Render
- [ ] Deploy frontend to Vercel
- [ ] Set `NEXT_PUBLIC_API_URL` in Vercel
- [ ] (Optional) Deploy LTX-2 to Modal for 360° videos
- [ ] Test all endpoints

## Testing

```bash
# Test API health
curl https://mirrorx-api.onrender.com/health

# Test IDM-VTON (uses HF Spaces)
curl https://mirrorx-api.onrender.com/tryon/idmvton/health

# Test try-on
curl -X POST https://mirrorx-api.onrender.com/tryon/demo \
  -F "selfie_image=@selfie.jpg" \
  -F "product_image=@shirt.jpg"
```

## Cost Estimation

| Service | Provider | Cost |
|---------|----------|------|
| API | Render Starter | $7/mo |
| PostgreSQL | Render Starter | $7/mo |
| Redis | Render Starter | $7/mo |
| IDM-VTON | HF Spaces Free | $0 |
| LTX-2 | Modal (on-demand) | ~$0.50/video |
| Frontend | Vercel Free | $0 |
| **Total** | | **~$21/mo + usage** |

For higher traffic, upgrade Render plans and consider HF Spaces GPU ($9/hr) for faster IDM-VTON.

## Troubleshooting

### Slow IDM-VTON Response
- HF Spaces free tier has queue times
- Solution: Upgrade to HF Spaces GPU or use Replicate

### LTX-2 Not Working
- Check Modal deployment logs: `modal logs mirrorx-ltx2`
- Ensure `LTX2_SERVICE_URL` is set correctly

### Database Connection Issues
- Verify `DATABASE_URL` is set from Render PostgreSQL
- Check Render logs for connection errors

### CORS Errors
- Add your Vercel domain to API CORS settings
- Check `apps/api/src/index.ts` CORS configuration
