#!/usr/bin/env python3
"""
MirrorX LTX-2 360° Video Generation - Modal Deployment

Deploy to Modal for serverless GPU inference.
Modal provides on-demand A10G/A100 GPUs with pay-per-second billing.

Usage:
    # Install Modal
    pip install modal
    modal token new

    # Deploy
    modal deploy modal_deploy.py

    # Test locally
    modal run modal_deploy.py::test_generate

    # View logs
    modal logs mirrorx-ltx2

Endpoints after deployment:
    - POST /generate-360  - Generate 360° video from image
    - GET  /health        - Health check
"""

import modal
import os

# Create Modal app
app = modal.App("mirrorx-ltx2")

# Define container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch>=2.1.0",
        "torchvision>=0.16.0",
        "diffusers>=0.28.0",
        "transformers>=4.40.0",
        "accelerate>=0.29.0",
        "peft>=0.10.0",
        "safetensors>=0.4.0",
        "pillow>=10.0.0",
        "imageio>=2.34.0",
        "imageio-ffmpeg>=0.4.9",
        "numpy>=1.26.0",
        "fastapi>=0.110.0",
        "pydantic>=2.5.0",
    )
)

# Persistent volume for model cache
model_volume = modal.Volume.from_name("mirrorx-models", create_if_missing=True)

# ============================================================================
# Model Loading (Cached)
# ============================================================================

@app.cls(
    image=image,
    gpu="A10G",  # Options: "T4", "A10G", "A100"
    timeout=600,
    container_idle_timeout=120,  # Keep warm for 2 minutes
    volumes={"/models": model_volume},
    secrets=[modal.Secret.from_name("huggingface", required=False)],
)
class LTX2Generator:
    """LTX-2 Video Generator class for Modal deployment."""

    @modal.enter()
    def load_model(self):
        """Load model when container starts (cached between calls)."""
        import torch
        from diffusers import DiffusionPipeline

        print("Loading LTX-2 model...")

        # Set cache directory
        cache_dir = "/models/ltx-video"
        os.makedirs(cache_dir, exist_ok=True)
        os.environ["HF_HOME"] = cache_dir
        os.environ["TRANSFORMERS_CACHE"] = cache_dir

        # Load LTX-2 pipeline from official repo
        # GitHub: https://github.com/Lightricks/LTX-2.git
        try:
            # Try loading from HuggingFace (preferred for Modal)
            self.pipeline = DiffusionPipeline.from_pretrained(
                "Lightricks/LTX-Video",  # Official HF model
                torch_dtype=torch.float16,
                cache_dir=cache_dir,
            )
            self.pipeline = self.pipeline.to("cuda")

            # Enable memory optimizations
            if hasattr(self.pipeline, 'enable_vae_slicing'):
                self.pipeline.enable_vae_slicing()
            if hasattr(self.pipeline, 'enable_vae_tiling'):
                self.pipeline.enable_vae_tiling()

            print("Model loaded successfully!")
            self.model_loaded = True

        except Exception as e:
            print(f"Error loading model: {e}")
            self.model_loaded = False
            self.pipeline = None

    @modal.method()
    def generate(
        self,
        image_base64: str,
        prompt: str = "a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, 4k",
        negative_prompt: str = "morphing, dissolving, extra limbs, bad anatomy, blurry, static",
        num_frames: int = 80,
        num_inference_steps: int = 40,
        guidance_scale: float = 3.0,
        width: int = 512,
        height: int = 512,
        seed: int = None,
    ) -> dict:
        """
        Generate a 360° rotation video from an image.

        Args:
            image_base64: Base64 encoded input image
            prompt: Text prompt for generation
            negative_prompt: Negative prompt
            num_frames: Number of frames (default 80 = ~3.3s at 24fps)
            num_inference_steps: Denoising steps
            guidance_scale: Classifier-free guidance scale
            width: Output width
            height: Output height
            seed: Random seed for reproducibility

        Returns:
            Dict with video_base64 and metadata
        """
        import torch
        from PIL import Image
        import base64
        import io
        import time

        if not self.model_loaded or self.pipeline is None:
            return {"error": "Model not loaded", "status": "error"}

        start_time = time.time()

        try:
            # Decode input image
            if "," in image_base64:
                image_data = base64.b64decode(image_base64.split(",")[1])
            else:
                image_data = base64.b64decode(image_base64)

            image = Image.open(io.BytesIO(image_data)).convert("RGB")
            image = image.resize((width, height), Image.Resampling.LANCZOS)

            # Set seed
            generator = None
            if seed is not None:
                generator = torch.Generator(device="cuda").manual_seed(seed)

            print(f"Generating {num_frames} frames at {width}x{height}...")

            # Generate video
            with torch.inference_mode():
                output = self.pipeline(
                    image=image,
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    num_frames=num_frames,
                    num_inference_steps=num_inference_steps,
                    guidance_scale=guidance_scale,
                    generator=generator,
                    output_type="pil",
                )

            # Get frames
            frames = output.frames[0] if hasattr(output, 'frames') else output.images

            # Export to video
            from diffusers.utils import export_to_video
            import tempfile

            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
                temp_path = f.name
                export_to_video(frames, temp_path, fps=24)

                # Read video bytes
                with open(temp_path, "rb") as video_file:
                    video_bytes = video_file.read()
                    video_base64 = base64.b64encode(video_bytes).decode()

            # Cleanup
            os.unlink(temp_path)

            processing_time = int((time.time() - start_time) * 1000)
            print(f"Generation complete in {processing_time}ms")

            return {
                "video_base64": f"data:video/mp4;base64,{video_base64}",
                "status": "completed",
                "metadata": {
                    "num_frames": num_frames,
                    "resolution": f"{width}x{height}",
                    "processing_time_ms": processing_time,
                    "fps": 24,
                },
            }

        except Exception as e:
            print(f"Generation error: {e}")
            return {
                "error": str(e),
                "status": "failed",
            }

    @modal.method()
    def health_check(self) -> dict:
        """Return health status."""
        import torch

        return {
            "status": "healthy" if self.model_loaded else "unhealthy",
            "model_loaded": self.model_loaded,
            "gpu_available": torch.cuda.is_available(),
            "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            "version": "1.0.0",
        }


# ============================================================================
# Web Endpoints
# ============================================================================

@app.function(image=image, timeout=60)
@modal.web_endpoint(method="GET")
def health():
    """Health check endpoint."""
    generator = LTX2Generator()
    return generator.health_check.remote()


@app.function(image=image, timeout=600)
@modal.web_endpoint(method="POST")
def generate_360(request: dict):
    """
    Generate 360° rotation video.

    Request body:
    {
        "image_base64": "data:image/jpeg;base64,...",
        "prompt": "optional custom prompt",
        "num_frames": 80,
        "num_inference_steps": 40,
        "guidance_scale": 3.0,
        "width": 512,
        "height": 512,
        "seed": null
    }
    """
    generator = LTX2Generator()

    return generator.generate.remote(
        image_base64=request.get("image_base64", ""),
        prompt=request.get("prompt", "a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, 4k"),
        negative_prompt=request.get("negative_prompt", "morphing, dissolving, extra limbs, bad anatomy, blurry, static"),
        num_frames=request.get("num_frames", 80),
        num_inference_steps=request.get("num_inference_steps", 40),
        guidance_scale=request.get("guidance_scale", 3.0),
        width=request.get("width", 512),
        height=request.get("height", 512),
        seed=request.get("seed"),
    )


# ============================================================================
# Local Testing
# ============================================================================

@app.local_entrypoint()
def test_generate():
    """Test the generator locally."""
    import base64

    # Create a simple test image (red square)
    from PIL import Image
    import io

    test_image = Image.new("RGB", (512, 512), color="red")
    buffer = io.BytesIO()
    test_image.save(buffer, format="JPEG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode()

    # Test health
    generator = LTX2Generator()
    health = generator.health_check.remote()
    print(f"Health: {health}")

    # Test generation (with minimal frames for speed)
    result = generator.generate.remote(
        image_base64=image_base64,
        prompt="a rotating red square",
        num_frames=16,
        num_inference_steps=10,
    )
    print(f"Result: {result.get('status')}")

    if result.get("status") == "completed":
        print(f"Video generated! Processing time: {result['metadata']['processing_time_ms']}ms")


# ============================================================================
# Deployment Instructions
# ============================================================================
"""
DEPLOYMENT STEPS:

1. Install Modal:
   pip install modal
   modal token new

2. Create HuggingFace secret (optional, for private models):
   modal secret create huggingface HF_TOKEN=<your-token>

3. Deploy:
   modal deploy modal_deploy.py

4. Get your endpoint URLs:
   - Health: https://<your-username>--mirrorx-ltx2-health.modal.run
   - Generate: https://<your-username>--mirrorx-ltx2-generate-360.modal.run

5. Set in Render environment:
   LTX2_SERVICE_URL=https://<your-username>--mirrorx-ltx2-generate-360.modal.run

6. Test:
   curl https://<your-username>--mirrorx-ltx2-health.modal.run

COSTS (Modal pricing as of 2024):
- A10G GPU: $0.000463/sec (~$1.67/hr)
- Typical 360° video (60s): ~$0.03-0.05
- Container startup: ~10-30s (first call, then cached)
"""
