# LTX-2 Modal Deployment for MirrorX

This deploys LTX-2 as a serverless GPU service on Modal.

## Prerequisites

1. Install Modal CLI:
   ```bash
   pip install modal
   ```

2. Authenticate with Modal:
   ```bash
   modal setup
   ```

## Deployment

Deploy the service:

```bash
cd infra/modal
modal deploy ltx2_service.py
```

After deployment, you'll get a URL like:
```
https://your-username--ltx2-360-video-generate.modal.run
```

## Configure MirrorX

Add this URL to your Render environment:

```
LTX2_SERVICE_URL=https://your-username--ltx2-360-video-generate.modal.run
```

The service auto-detects Modal URLs and uses synchronous mode.

## Endpoints

- `POST /` - Generate 360° video
  ```json
  {
    "image_base64": "data:image/jpeg;base64,...",
    "prompt": "a 360-degree rotating shot...",
    "num_frames": 80,
    "num_inference_steps": 8,
    "guidance_scale": 3.0,
    "width": 512,
    "height": 512
  }
  ```

- `GET /health` - Health check

## Cost Estimation

- A100 (80GB): ~$3/hour
- A10G (24GB): ~$1/hour (sufficient for 512x512)

Modal only charges for actual compute time (serverless).

## Customization

Edit `ltx2_service.py` to:
- Use A10G for lower cost: `gpu=modal.gpu.A10G()`
- Adjust timeout and warm-up settings
- Add LoRA support for style customization
