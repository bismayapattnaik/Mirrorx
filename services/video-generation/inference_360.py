#!/usr/bin/env python3
"""
LTX-2 360-Degree Video Generation Inference Service

This FastAPI service loads a fine-tuned LTX-2 model and generates 360-degree
rotation videos from static IDM-VTON output images.

The service:
1. Loads the base LTX-Video model
2. Applies fine-tuned LoRA weights for rotation understanding
3. Accepts static images and generates rotating videos
4. Returns video as MP4 bytes or saves to file

Usage:
    uvicorn inference_360:app --host 0.0.0.0 --port 5001 --reload

Environment Variables:
    LORA_PATH: Path to fine-tuned LoRA weights (default: ./outputs/ltx2_360/checkpoint-5000)
    BASE_MODEL: HuggingFace model ID (default: Lightricks/LTX-Video)
    DEVICE: cuda or cpu (default: auto-detect)
    MAX_CONCURRENT_JOBS: Maximum concurrent generation jobs (default: 2)
"""

import os
import io
import uuid
import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

import torch
from PIL import Image
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

@dataclass
class ServiceConfig:
    """Service configuration with environment variable overrides."""
    lora_path: str = os.getenv("LORA_PATH", "./outputs/ltx2_360/checkpoint-5000")
    base_model: str = os.getenv("BASE_MODEL", "Lightricks/LTX-Video")
    device: str = os.getenv("DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
    max_concurrent_jobs: int = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))
    output_dir: str = os.getenv("OUTPUT_DIR", "/tmp/ltx2_outputs")
    enable_queue: bool = os.getenv("ENABLE_QUEUE", "true").lower() == "true"
    default_num_frames: int = int(os.getenv("DEFAULT_NUM_FRAMES", "80"))
    default_inference_steps: int = int(os.getenv("DEFAULT_INFERENCE_STEPS", "40"))
    default_guidance_scale: float = float(os.getenv("DEFAULT_GUIDANCE_SCALE", "3.0"))
    default_image_guidance_scale: float = float(os.getenv("DEFAULT_IMAGE_GUIDANCE_SCALE", "1.8"))

config = ServiceConfig()

# ============================================================================
# Models and Types
# ============================================================================

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class GenerationRequest(BaseModel):
    """Request model for 360 video generation."""
    prompt: Optional[str] = Field(
        default="a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, 4k",
        description="Text prompt for video generation"
    )
    negative_prompt: Optional[str] = Field(
        default="morphing, dissolving, extra limbs, bad anatomy, blurry, static, jerky motion",
        description="Negative prompt to avoid unwanted artifacts"
    )
    num_frames: Optional[int] = Field(
        default=None,
        ge=16, le=200,
        description="Number of frames to generate"
    )
    num_inference_steps: Optional[int] = Field(
        default=None,
        ge=10, le=100,
        description="Number of denoising steps"
    )
    guidance_scale: Optional[float] = Field(
        default=None,
        ge=1.0, le=20.0,
        description="Text guidance scale"
    )
    image_guidance_scale: Optional[float] = Field(
        default=None,
        ge=1.0, le=5.0,
        description="Image guidance scale for identity preservation"
    )
    seed: Optional[int] = Field(
        default=None,
        description="Random seed for reproducibility"
    )
    width: Optional[int] = Field(
        default=512,
        ge=256, le=1024,
        description="Output video width"
    )
    height: Optional[int] = Field(
        default=512,
        ge=256, le=1024,
        description="Output video height"
    )

class JobResponse(BaseModel):
    """Response model for job status."""
    job_id: str
    status: JobStatus
    created_at: str
    completed_at: Optional[str] = None
    progress: float = 0.0
    result_url: Optional[str] = None
    error_message: Optional[str] = None
    processing_time_ms: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    model_loaded: bool
    lora_loaded: bool
    device: str
    gpu_available: bool
    gpu_name: Optional[str] = None
    gpu_memory_gb: Optional[float] = None
    version: str = "1.0.0"
    concurrent_jobs: int = 0
    max_concurrent_jobs: int = 0

# ============================================================================
# Global State
# ============================================================================

# Pipeline will be loaded on startup
pipeline = None
lora_loaded = False

# Job tracking
jobs: Dict[str, Dict[str, Any]] = {}
job_semaphore = asyncio.Semaphore(config.max_concurrent_jobs)

# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="LTX-2 360 Video Generation Service",
    description="Generate 360-degree rotation videos from static images using fine-tuned LTX-2",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Model Loading
# ============================================================================

def load_model():
    """Load the LTX-2 model and LoRA weights."""
    global pipeline, lora_loaded

    logger.info(f"Loading LTX-2 model on {config.device}...")

    try:
        # Import diffusers components
        # Note: Exact imports depend on diffusers version and LTX-Video implementation
        from diffusers import DiffusionPipeline
        from diffusers.utils import export_to_video

        # Try to load the image-to-video pipeline
        # The exact class name may vary based on the model version
        try:
            from diffusers import LTXImageToVideoPipeline
            pipeline_class = LTXImageToVideoPipeline
            logger.info("Using LTXImageToVideoPipeline")
        except ImportError:
            # Fallback to generic pipeline
            pipeline_class = DiffusionPipeline
            logger.info("Using generic DiffusionPipeline")

        # Load base model
        pipeline = pipeline_class.from_pretrained(
            config.base_model,
            torch_dtype=torch.float16 if config.device == "cuda" else torch.float32,
            variant="fp16" if config.device == "cuda" else None,
        )

        pipeline = pipeline.to(config.device)

        logger.info("Base model loaded successfully!")

        # Load LoRA weights if available
        if os.path.exists(config.lora_path):
            logger.info(f"Loading LoRA weights from {config.lora_path}...")

            try:
                pipeline.load_lora_weights(config.lora_path, adapter_name="rotation_360")
                pipeline.set_adapters(["rotation_360"], adapter_weights=[1.0])
                lora_loaded = True
                logger.info("LoRA weights loaded successfully!")
            except Exception as e:
                logger.warning(f"Failed to load LoRA weights: {e}")
                logger.warning("Proceeding without LoRA (base model only)")
        else:
            logger.warning(f"LoRA path not found: {config.lora_path}")
            logger.warning("Proceeding without LoRA (base model only)")

        # Enable memory optimizations if available
        if hasattr(pipeline, 'enable_model_cpu_offload') and config.device == "cuda":
            # Only enable for low-memory GPUs
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
            if gpu_memory < 24:
                logger.info("Enabling CPU offload for low-memory GPU")
                pipeline.enable_model_cpu_offload()

        if hasattr(pipeline, 'enable_vae_slicing'):
            pipeline.enable_vae_slicing()
            logger.info("VAE slicing enabled")

        if hasattr(pipeline, 'enable_vae_tiling'):
            pipeline.enable_vae_tiling()
            logger.info("VAE tiling enabled")

        logger.info("Model initialization complete!")
        return True

    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise

# ============================================================================
# Video Generation
# ============================================================================

async def generate_video(
    image: Image.Image,
    request: GenerationRequest,
    job_id: str
) -> Path:
    """
    Generate a 360-degree rotation video from a static image.

    Args:
        image: Input PIL Image (from IDM-VTON)
        request: Generation parameters
        job_id: Job ID for tracking

    Returns:
        Path to the generated video file
    """
    global pipeline

    if pipeline is None:
        raise RuntimeError("Model not loaded")

    # Use default values if not specified
    num_frames = request.num_frames or config.default_num_frames
    num_inference_steps = request.num_inference_steps or config.default_inference_steps
    guidance_scale = request.guidance_scale or config.default_guidance_scale
    image_guidance_scale = request.image_guidance_scale or config.default_image_guidance_scale

    # Resize image to target resolution
    target_size = (request.width, request.height)
    if image.size != target_size:
        image = image.resize(target_size, Image.Resampling.LANCZOS)

    # Set seed for reproducibility
    generator = None
    if request.seed is not None:
        generator = torch.Generator(device=config.device).manual_seed(request.seed)

    logger.info(f"[Job {job_id}] Generating {num_frames} frames at {target_size}...")

    # Generate video
    with torch.inference_mode():
        try:
            # Try with image_guidance_scale if supported
            output = pipeline(
                image=image,
                prompt=request.prompt,
                negative_prompt=request.negative_prompt,
                num_frames=num_frames,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                image_guidance_scale=image_guidance_scale,
                generator=generator,
                decode_chunk_size=8,
                output_type="pil",  # Get PIL frames
            )
        except TypeError as e:
            # Some pipeline versions may not support all parameters
            logger.warning(f"Retrying without image_guidance_scale: {e}")
            output = pipeline(
                image=image,
                prompt=request.prompt,
                negative_prompt=request.negative_prompt,
                num_frames=num_frames,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                generator=generator,
                output_type="pil",
            )

    # Extract frames
    frames = output.frames[0] if hasattr(output, 'frames') else output.images

    # Create output directory
    output_dir = Path(config.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save video
    output_path = output_dir / f"{job_id}.mp4"

    # Use diffusers export utility or manual ffmpeg
    try:
        from diffusers.utils import export_to_video
        export_to_video(frames, str(output_path), fps=24)
    except ImportError:
        # Manual video export using PIL and ffmpeg
        await export_frames_to_video(frames, output_path, fps=24)

    logger.info(f"[Job {job_id}] Video saved to {output_path}")
    return output_path


async def export_frames_to_video(frames: List[Image.Image], output_path: Path, fps: int = 24):
    """Export PIL frames to MP4 video using ffmpeg."""
    import subprocess

    # Create temporary directory for frames
    with tempfile.TemporaryDirectory() as tmpdir:
        # Save frames as images
        for i, frame in enumerate(frames):
            frame_path = Path(tmpdir) / f"frame_{i:06d}.png"
            frame.save(frame_path)

        # Use ffmpeg to create video
        cmd = [
            'ffmpeg', '-y',
            '-framerate', str(fps),
            '-i', str(Path(tmpdir) / 'frame_%06d.png'),
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            '-crf', '23',
            str(output_path)
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {stderr.decode()}")


async def process_job(job_id: str, image: Image.Image, request: GenerationRequest):
    """Process a video generation job."""
    async with job_semaphore:
        try:
            jobs[job_id]["status"] = JobStatus.PROCESSING
            jobs[job_id]["progress"] = 0.1

            start_time = datetime.now()

            # Generate video
            output_path = await generate_video(image, request, job_id)

            end_time = datetime.now()
            processing_time = int((end_time - start_time).total_seconds() * 1000)

            # Update job status
            jobs[job_id].update({
                "status": JobStatus.COMPLETED,
                "completed_at": end_time.isoformat(),
                "progress": 1.0,
                "result_url": f"/download/{job_id}",
                "processing_time_ms": processing_time,
                "metadata": {
                    "output_path": str(output_path),
                    "num_frames": request.num_frames or config.default_num_frames,
                    "resolution": f"{request.width}x{request.height}",
                }
            })

            logger.info(f"[Job {job_id}] Completed in {processing_time}ms")

        except Exception as e:
            logger.error(f"[Job {job_id}] Failed: {e}")
            jobs[job_id].update({
                "status": JobStatus.FAILED,
                "completed_at": datetime.now().isoformat(),
                "error_message": str(e),
                "progress": 0.0
            })

# ============================================================================
# API Endpoints
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Load model on startup."""
    try:
        load_model()
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")
        # Don't crash - allow health endpoint to report unhealthy status

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check service health and model status."""
    gpu_available = torch.cuda.is_available()
    gpu_name = None
    gpu_memory_gb = None

    if gpu_available:
        try:
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory_gb = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2)
        except Exception:
            pass

    # Count active jobs
    active_jobs = sum(1 for j in jobs.values() if j["status"] == JobStatus.PROCESSING)

    return HealthResponse(
        status="healthy" if pipeline is not None else "unhealthy",
        model_loaded=pipeline is not None,
        lora_loaded=lora_loaded,
        device=config.device,
        gpu_available=gpu_available,
        gpu_name=gpu_name,
        gpu_memory_gb=gpu_memory_gb,
        concurrent_jobs=active_jobs,
        max_concurrent_jobs=config.max_concurrent_jobs
    )


@app.post("/generate-360", response_model=JobResponse)
async def generate_360(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(..., description="Input image (VTON result)"),
    prompt: str = Form(default="a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, 4k"),
    negative_prompt: str = Form(default="morphing, dissolving, extra limbs, bad anatomy, blurry, static, jerky motion"),
    num_frames: int = Form(default=80, ge=16, le=200),
    num_inference_steps: int = Form(default=40, ge=10, le=100),
    guidance_scale: float = Form(default=3.0, ge=1.0, le=20.0),
    image_guidance_scale: float = Form(default=1.8, ge=1.0, le=5.0),
    width: int = Form(default=512, ge=256, le=1024),
    height: int = Form(default=512, ge=256, le=1024),
    seed: Optional[int] = Form(default=None),
):
    """
    Submit a 360-degree video generation job.

    This endpoint accepts a static image (typically from IDM-VTON) and
    generates a video showing the person rotating 360 degrees.

    Returns a job ID that can be used to check status and download the result.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Read and validate image
    try:
        image_bytes = await image.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    # Create job
    job_id = str(uuid.uuid4())
    created_at = datetime.now()

    request = GenerationRequest(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_frames=num_frames,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        image_guidance_scale=image_guidance_scale,
        width=width,
        height=height,
        seed=seed,
    )

    jobs[job_id] = {
        "job_id": job_id,
        "status": JobStatus.PENDING,
        "created_at": created_at.isoformat(),
        "completed_at": None,
        "progress": 0.0,
        "result_url": None,
        "error_message": None,
        "processing_time_ms": None,
        "metadata": None,
    }

    # Queue job for processing
    background_tasks.add_task(process_job, job_id, pil_image, request)

    logger.info(f"[Job {job_id}] Created - {num_frames} frames, {width}x{height}")

    return JobResponse(**jobs[job_id])


@app.post("/generate-360/sync")
async def generate_360_sync(
    image: UploadFile = File(..., description="Input image (VTON result)"),
    prompt: str = Form(default="a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, 4k"),
    negative_prompt: str = Form(default="morphing, dissolving, extra limbs, bad anatomy, blurry, static, jerky motion"),
    num_frames: int = Form(default=80, ge=16, le=200),
    num_inference_steps: int = Form(default=40, ge=10, le=100),
    guidance_scale: float = Form(default=3.0, ge=1.0, le=20.0),
    image_guidance_scale: float = Form(default=1.8, ge=1.0, le=5.0),
    width: int = Form(default=512, ge=256, le=1024),
    height: int = Form(default=512, ge=256, le=1024),
    seed: Optional[int] = Form(default=None),
):
    """
    Generate a 360-degree video synchronously and return the video directly.

    Warning: This endpoint will block until generation is complete (~60-120s).
    For production use, prefer the async /generate-360 endpoint.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Read and validate image
    try:
        image_bytes = await image.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    job_id = str(uuid.uuid4())

    request = GenerationRequest(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_frames=num_frames,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        image_guidance_scale=image_guidance_scale,
        width=width,
        height=height,
        seed=seed,
    )

    try:
        async with job_semaphore:
            output_path = await generate_video(pil_image, request, job_id)

        # Read video and return
        with open(output_path, "rb") as f:
            video_bytes = f.read()

        # Cleanup
        output_path.unlink(missing_ok=True)

        return StreamingResponse(
            io.BytesIO(video_bytes),
            media_type="video/mp4",
            headers={
                "Content-Disposition": f"attachment; filename=360_rotation_{job_id}.mp4"
            }
        )

    except Exception as e:
        logger.error(f"Sync generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/job/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str):
    """Get the status of a video generation job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResponse(**jobs[job_id])


@app.get("/download/{job_id}")
async def download_video(job_id: str):
    """Download the generated video for a completed job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    if job["status"] != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed. Status: {job['status']}"
        )

    output_path = Path(job["metadata"]["output_path"])

    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    def iterfile():
        with open(output_path, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f"attachment; filename=360_rotation_{job_id}.mp4"
        }
    )


@app.delete("/job/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its generated video."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]

    # Delete video file if exists
    if job.get("metadata", {}).get("output_path"):
        output_path = Path(job["metadata"]["output_path"])
        output_path.unlink(missing_ok=True)

    # Remove job from tracking
    del jobs[job_id]

    return {"message": f"Job {job_id} deleted"}


@app.get("/jobs")
async def list_jobs(status: Optional[JobStatus] = None, limit: int = 50):
    """List all jobs, optionally filtered by status."""
    result = []

    for job in sorted(jobs.values(), key=lambda x: x["created_at"], reverse=True):
        if status is None or job["status"] == status:
            result.append(JobResponse(**job))
            if len(result) >= limit:
                break

    return result


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "5001"))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting LTX-2 360 Video Service on {host}:{port}")

    uvicorn.run(
        "inference_360:app",
        host=host,
        port=port,
        reload=os.getenv("RELOAD", "false").lower() == "true",
        workers=1,  # Single worker for GPU model
    )
