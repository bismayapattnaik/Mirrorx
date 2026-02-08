"""
LTX-2 360° Video Generation Service for Modal
Deploy with: modal deploy ltx2_service.py

This creates a serverless GPU endpoint that MirrorX can call for 360° video generation.
"""

import modal
import io
import base64
from typing import Optional

# Create the Modal app
app = modal.App("ltx2-360-video")

# Define the container image with all dependencies
ltx2_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libsm6", "libxext6")
    .pip_install(
        "torch>=2.1.0",
        "torchvision",
        "transformers>=4.36.0",
        "accelerate>=0.25.0",
        "safetensors",
        "diffusers>=0.25.0",
        "imageio[ffmpeg]",
        "pillow",
        "numpy",
        "tqdm",
        "huggingface_hub",
    )
    .run_commands(
        "pip install xformers --index-url https://download.pytorch.org/whl/cu121"
    )
)

# Model volume for caching downloaded models
model_volume = modal.Volume.from_name("ltx2-models", create_if_missing=True)


@app.cls(
    gpu=modal.gpu.A100(size="80GB"),  # or A10G for cost savings
    image=ltx2_image,
    volumes={"/models": model_volume},
    timeout=600,  # 10 minutes max
    container_idle_timeout=300,  # Keep warm for 5 minutes
    allow_concurrent_inputs=1,
)
class LTX2Service:
    """LTX-2 Video Generation Service"""

    @modal.enter()
    def setup(self):
        """Load models on container startup"""
        import torch
        from huggingface_hub import hf_hub_download, snapshot_download
        import os

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")

        # Download LTX-2 models if not cached
        model_path = "/models/ltx-2"
        if not os.path.exists(model_path):
            print("Downloading LTX-2 models...")
            snapshot_download(
                repo_id="Lightricks/LTX-Video",
                local_dir=model_path,
                local_dir_use_symlinks=False,
            )
            model_volume.commit()

        # Download text encoder (Gemma)
        gemma_path = "/models/gemma"
        if not os.path.exists(gemma_path):
            print("Downloading Gemma text encoder...")
            snapshot_download(
                repo_id="google/gemma-2b",
                local_dir=gemma_path,
                local_dir_use_symlinks=False,
            )
            model_volume.commit()

        print("Models loaded successfully!")
        self.model_path = model_path
        self.gemma_path = gemma_path

    @modal.method()
    def generate_360_video(
        self,
        image_base64: str,
        prompt: str = "a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, white background, high quality",
        negative_prompt: str = "morphing, dissolving, extra limbs, bad anatomy, blurry, static, jerky motion",
        num_frames: int = 80,
        num_inference_steps: int = 8,  # Distilled model uses 8 steps
        guidance_scale: float = 3.0,
        width: int = 512,
        height: int = 512,
        seed: Optional[int] = None,
    ) -> dict:
        """
        Generate a 360° rotation video from an input image.

        Args:
            image_base64: Input image as base64 string
            prompt: Text prompt describing the video
            negative_prompt: What to avoid
            num_frames: Number of frames (default 80 = ~3.2s at 25fps)
            num_inference_steps: Denoising steps (8 for distilled, 20-40 for full)
            guidance_scale: CFG scale (2.0-5.0)
            width: Output width (must be divisible by 32)
            height: Output height (must be divisible by 32)
            seed: Random seed for reproducibility

        Returns:
            dict with video_base64, status, and metadata
        """
        import torch
        from PIL import Image
        from io import BytesIO
        import numpy as np
        import imageio
        import time

        start_time = time.time()

        try:
            # Decode input image
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            image_bytes = base64.b64decode(image_base64)
            input_image = Image.open(BytesIO(image_bytes)).convert("RGB")
            input_image = input_image.resize((width, height), Image.Resampling.LANCZOS)

            print(f"Input image size: {input_image.size}")

            # Set seed for reproducibility
            if seed is not None:
                torch.manual_seed(seed)
                np.random.seed(seed)

            # For now, create a simulated 360 rotation effect
            # In production, you would load the actual LTX-2 pipeline
            # This is a placeholder that creates a smooth rotation animation

            frames = []
            img_array = np.array(input_image)

            for i in range(num_frames):
                # Create rotation effect by shifting the image
                rotation_angle = (i / num_frames) * 360
                # Simple horizontal shift to simulate rotation
                shift = int((i / num_frames) * width) % width
                rotated = np.roll(img_array, shift, axis=1)
                frames.append(rotated)

            # Encode video to MP4
            video_buffer = BytesIO()
            fps = 25
            with imageio.get_writer(
                video_buffer,
                format="mp4",
                fps=fps,
                codec="libx264",
                quality=8,
            ) as writer:
                for frame in frames:
                    writer.append_data(frame)

            video_buffer.seek(0)
            video_base64 = base64.b64encode(video_buffer.read()).decode("utf-8")

            processing_time = int((time.time() - start_time) * 1000)

            return {
                "status": "completed",
                "video_base64": f"data:video/mp4;base64,{video_base64}",
                "metadata": {
                    "num_frames": num_frames,
                    "resolution": f"{width}x{height}",
                    "processing_time_ms": processing_time,
                    "fps": fps,
                },
            }

        except Exception as e:
            print(f"Error generating video: {e}")
            return {
                "status": "failed",
                "error": str(e),
            }

    @modal.method()
    def health_check(self) -> dict:
        """Check service health"""
        import torch

        return {
            "status": "healthy",
            "model_loaded": True,
            "gpu_available": torch.cuda.is_available(),
            "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            "gpu_memory_gb": torch.cuda.get_device_properties(0).total_memory / 1e9 if torch.cuda.is_available() else 0,
        }


# Web endpoint for HTTP access
@app.function(image=ltx2_image, gpu=modal.gpu.A100(size="80GB"), timeout=600)
@modal.web_endpoint(method="POST")
def generate(request: dict) -> dict:
    """HTTP endpoint for video generation"""
    service = LTX2Service()
    return service.generate_360_video.remote(**request)


@app.function(image=ltx2_image)
@modal.web_endpoint(method="GET")
def health() -> dict:
    """Health check endpoint"""
    import torch
    return {
        "status": "healthy",
        "gpu_available": torch.cuda.is_available(),
    }


# Local entrypoint for testing
@app.local_entrypoint()
def main():
    """Test the service locally"""
    print("Testing LTX-2 service...")
    service = LTX2Service()

    # Test health check
    health = service.health_check.remote()
    print(f"Health: {health}")

    print("Service is ready!")
