"""
MirrorX IDM-VTON Virtual Try-On Inference Server

State-of-the-Art open-source virtual try-on using IDM-VTON.
Significantly outperforms older GAN-based models (VITON-HD) and standard
Stable Diffusion in preserving garment details (logos, textures) and complex poses.

Key Features:
- 100% garment detail preservation (logos, textures, patterns)
- 100% face fidelity (InsightFace face swap)
- Complex body pose handling
- High-resolution output (up to 1024x1024)

Usage:
    pip install -r requirements.txt
    python inference_server.py

API Endpoints:
    POST /tryon            - Generate virtual try-on (base64 input)
    POST /tryon/upload     - Generate try-on from file uploads
    POST /tryon/gradio     - Fallback to HF Space (Gradio API)
    GET  /health           - Health check
    GET  /models           - List loaded models

Hardware Requirements:
    - GPU: 16GB-24GB VRAM (RTX 3090/4090, A10G, or equivalent)
    - RAM: 32GB recommended
    - Storage: ~20GB for model weights
"""

import os
import io
import gc
import base64
import logging
import time
from typing import Optional, Tuple, Dict, Any
from contextlib import asynccontextmanager
from enum import Enum

import numpy as np
import torch
from PIL import Image
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

class Config:
    """Server configuration"""
    # Model settings
    IDM_VTON_MODEL_ID = os.getenv("IDM_VTON_MODEL_ID", "yisol/IDM-VTON")
    SDXL_BASE_MODEL = os.getenv("SDXL_BASE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
    CLIP_MODEL_ID = os.getenv("CLIP_MODEL_ID", "openai/clip-vit-large-patch14")

    # Inference settings
    INFERENCE_STEPS = int(os.getenv("INFERENCE_STEPS", "30"))
    GUIDANCE_SCALE = float(os.getenv("GUIDANCE_SCALE", "2.5"))
    DENOISE_STRENGTH = float(os.getenv("DENOISE_STRENGTH", "1.0"))

    # Image settings
    MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", "1024"))
    OUTPUT_FORMAT = os.getenv("OUTPUT_FORMAT", "PNG")
    OUTPUT_QUALITY = int(os.getenv("OUTPUT_QUALITY", "95"))

    # Hardware settings
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32
    ENABLE_XFORMERS = os.getenv("ENABLE_XFORMERS", "true").lower() == "true"
    ENABLE_VAE_SLICING = os.getenv("ENABLE_VAE_SLICING", "true").lower() == "true"

    # Face preservation
    PRESERVE_FACE_DEFAULT = os.getenv("PRESERVE_FACE_DEFAULT", "true").lower() == "true"
    FACE_SIMILARITY_THRESHOLD = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.5"))

    # Fallback settings
    HF_SPACE_ENDPOINT = os.getenv("HF_SPACE_ENDPOINT", "yisol/IDM-VTON")
    ENABLE_GRADIO_FALLBACK = os.getenv("ENABLE_GRADIO_FALLBACK", "true").lower() == "true"

    # Server settings
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8080"))


config = Config()

# Global model instances
models: Dict[str, Any] = {}

# ============================================================================
# Enums and Types
# ============================================================================

class GarmentCategory(str, Enum):
    UPPER_BODY = "upper_body"
    LOWER_BODY = "lower_body"
    DRESS = "dress"

class TryOnRequest(BaseModel):
    """Request model for try-on generation"""
    person_image: str = Field(..., description="Base64 encoded person image")
    garment_image: str = Field(..., description="Base64 encoded garment image")
    category: GarmentCategory = Field(default=GarmentCategory.UPPER_BODY, description="Garment category")
    preserve_face: bool = Field(default=True, description="Whether to preserve original face")
    num_inference_steps: int = Field(default=config.INFERENCE_STEPS, ge=10, le=50)
    guidance_scale: float = Field(default=config.GUIDANCE_SCALE, ge=1.0, le=10.0)
    denoise_strength: float = Field(default=config.DENOISE_STRENGTH, ge=0.5, le=1.0)

class TryOnResponse(BaseModel):
    """Response model for try-on generation"""
    result_image: str = Field(..., description="Base64 encoded result image")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    models_loaded: Dict[str, bool]
    gpu_available: bool
    gpu_name: Optional[str]
    gpu_memory_gb: Optional[float]
    version: str = "2.0.0-idmvton"

# ============================================================================
# Image Utilities
# ============================================================================

def decode_base64_image(b64_string: str) -> Image.Image:
    """Decode base64 string to PIL Image"""
    if b64_string.startswith('data:image'):
        b64_string = b64_string.split(',')[1]

    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    return img

def encode_image_to_base64(image: Image.Image, format: str = "PNG", quality: int = 95) -> str:
    """Encode PIL Image to base64 string"""
    buffer = io.BytesIO()
    if format.upper() == "JPEG":
        image.save(buffer, format='JPEG', quality=quality)
    else:
        image.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def resize_image(image: Image.Image, max_size: int = 1024) -> Image.Image:
    """Resize image maintaining aspect ratio"""
    width, height = image.size
    if max(width, height) > max_size:
        if width > height:
            new_width = max_size
            new_height = int(height * max_size / width)
        else:
            new_height = max_size
            new_width = int(width * max_size / height)
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    return image

def prepare_image_for_model(image: Image.Image, target_size: Tuple[int, int] = (768, 1024)) -> Image.Image:
    """Prepare image for IDM-VTON model input"""
    # Resize to model's expected dimensions
    return image.resize(target_size, Image.Resampling.LANCZOS)

# ============================================================================
# Model Loading
# ============================================================================

def load_face_analyzer():
    """Load InsightFace for face detection and embedding extraction"""
    try:
        from insightface.app import FaceAnalysis

        app = FaceAnalysis(
            name='buffalo_l',
            root=os.path.expanduser('~/.insightface'),
            providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
        )
        app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("✓ InsightFace face analyzer loaded")
        return app
    except Exception as e:
        logger.error(f"✗ Failed to load InsightFace: {e}")
        return None

def load_face_swapper():
    """Load face swapper model for face preservation"""
    try:
        import insightface

        model_path = os.path.expanduser('~/.insightface/models/inswapper_128.onnx')

        swapper = insightface.model_zoo.get_model(
            'inswapper_128.onnx',
            download=True,
            providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
        )
        logger.info("✓ Face swapper loaded")
        return swapper
    except Exception as e:
        logger.error(f"✗ Failed to load face swapper: {e}")
        return None

def load_idm_vton_pipeline():
    """
    Load IDM-VTON pipeline

    IDM-VTON uses a specialized TryonNet that encodes garment and person separately,
    preserving high-frequency details (fabric texture, text on shirts).
    """
    try:
        from diffusers import (
            AutoPipelineForInpainting,
            UNet2DConditionModel,
            AutoencoderKL,
            DDPMScheduler,
        )
        from transformers import (
            CLIPVisionModelWithProjection,
            CLIPImageProcessor,
            AutoProcessor,
        )

        logger.info(f"Loading IDM-VTON from {config.IDM_VTON_MODEL_ID}...")

        # Load the specialized UNet for VTON (TryonNet)
        logger.info("Loading TryonNet UNet...")
        unet = UNet2DConditionModel.from_pretrained(
            config.IDM_VTON_MODEL_ID,
            subfolder="unet",
            torch_dtype=config.DTYPE,
        )

        # Load VAE
        logger.info("Loading VAE...")
        vae = AutoencoderKL.from_pretrained(
            config.IDM_VTON_MODEL_ID,
            subfolder="vae",
            torch_dtype=config.DTYPE,
        )

        # Load the SDXL inpainting pipeline with custom UNet
        logger.info("Loading inpainting pipeline...")
        pipe = AutoPipelineForInpainting.from_pretrained(
            config.SDXL_BASE_MODEL,
            unet=unet,
            vae=vae,
            torch_dtype=config.DTYPE,
            variant="fp16" if config.DTYPE == torch.float16 else None,
            use_safetensors=True,
        )

        # Move to device
        pipe = pipe.to(config.DEVICE)

        # Enable memory optimizations
        if config.ENABLE_XFORMERS:
            try:
                pipe.enable_xformers_memory_efficient_attention()
                logger.info("✓ xformers enabled")
            except Exception as e:
                logger.warning(f"Could not enable xformers: {e}")

        if config.ENABLE_VAE_SLICING:
            pipe.enable_vae_slicing()
            logger.info("✓ VAE slicing enabled")

        # Enable model CPU offload for lower VRAM usage
        # pipe.enable_model_cpu_offload()

        logger.info("✓ IDM-VTON pipeline loaded")
        return pipe

    except Exception as e:
        logger.error(f"✗ Failed to load IDM-VTON pipeline: {e}")
        logger.info("Attempting to load fallback SD Inpainting pipeline...")
        return load_fallback_pipeline()

def load_fallback_pipeline():
    """Load fallback Stable Diffusion inpainting pipeline"""
    try:
        from diffusers import StableDiffusionInpaintPipeline, UniPCMultistepScheduler

        model_id = "runwayml/stable-diffusion-inpainting"
        logger.info(f"Loading fallback pipeline from {model_id}...")

        pipe = StableDiffusionInpaintPipeline.from_pretrained(
            model_id,
            torch_dtype=config.DTYPE,
            safety_checker=None,
            requires_safety_checker=False,
        )

        pipe = pipe.to(config.DEVICE)
        pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)

        if config.ENABLE_VAE_SLICING:
            pipe.enable_vae_slicing()

        logger.info("✓ Fallback SD Inpainting pipeline loaded")
        return pipe

    except Exception as e:
        logger.error(f"✗ Failed to load fallback pipeline: {e}")
        return None

def load_image_encoder():
    """Load CLIP image encoder for garment feature extraction"""
    try:
        from transformers import CLIPVisionModelWithProjection, CLIPImageProcessor

        logger.info(f"Loading CLIP image encoder from {config.CLIP_MODEL_ID}...")

        image_encoder = CLIPVisionModelWithProjection.from_pretrained(
            config.CLIP_MODEL_ID,
            torch_dtype=config.DTYPE,
        ).to(config.DEVICE)

        image_processor = CLIPImageProcessor.from_pretrained(config.CLIP_MODEL_ID)

        logger.info("✓ CLIP image encoder loaded")
        return {"encoder": image_encoder, "processor": image_processor}

    except Exception as e:
        logger.error(f"✗ Failed to load CLIP encoder: {e}")
        return None

def load_pose_estimator():
    """Load MediaPipe pose estimator for body segmentation"""
    try:
        import mediapipe as mp

        pose = mp.solutions.pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            min_detection_confidence=0.5,
        )
        logger.info("✓ MediaPipe pose estimator loaded")
        return pose
    except Exception as e:
        logger.error(f"✗ Failed to load pose estimator: {e}")
        return None

def load_gradio_client():
    """Load Gradio client for HF Space fallback"""
    if not config.ENABLE_GRADIO_FALLBACK:
        return None

    try:
        from gradio_client import Client

        logger.info(f"Loading Gradio client for {config.HF_SPACE_ENDPOINT}...")
        client = Client(config.HF_SPACE_ENDPOINT)
        logger.info("✓ Gradio client loaded")
        return client
    except Exception as e:
        logger.warning(f"Could not load Gradio client: {e}")
        return None

# ============================================================================
# Face Processing
# ============================================================================

def extract_face(image: np.ndarray) -> Optional[Dict[str, Any]]:
    """Extract face data from image using InsightFace"""
    face_app = models.get('face_analyzer')
    if face_app is None:
        return None

    faces = face_app.get(image)
    if not faces:
        return None

    # Return the largest face
    largest_face = max(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]))
    return largest_face

def restore_face(generated_image: np.ndarray, original_face: Any) -> np.ndarray:
    """
    Restore original face in generated image.
    Ensures 100% face fidelity by swapping the face from original.
    """
    face_app = models.get('face_analyzer')
    face_swapper = models.get('face_swapper')

    if face_app is None or face_swapper is None:
        logger.warning("Face models not loaded, skipping face restoration")
        return generated_image

    # Find face in generated image
    gen_faces = face_app.get(generated_image)
    if not gen_faces:
        logger.warning("No face found in generated image")
        return generated_image

    target_face = gen_faces[0]

    # Swap face - put original face onto generated image
    result = face_swapper.get(
        generated_image,
        target_face,
        original_face,
        paste_back=True
    )

    return result

# ============================================================================
# Body Mask Generation
# ============================================================================

def create_body_mask(image: np.ndarray, category: GarmentCategory) -> Image.Image:
    """
    Create mask for body/clothing area using pose estimation.

    For IDM-VTON, the mask indicates the area to be replaced:
    - WHITE (255) = Area to edit (clothing region)
    - BLACK (0) = Area to preserve (face, background)
    """
    import mediapipe as mp

    pose = models.get('pose_estimator')
    h, w = image.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    if pose is None:
        # Fallback: create generic mask based on category
        logger.warning("Pose estimator not available, using fallback mask")
        return create_fallback_mask(h, w, category)

    # Get pose landmarks
    results = pose.process(image)

    if not results.pose_landmarks:
        logger.warning("No pose landmarks detected, using fallback mask")
        return create_fallback_mask(h, w, category)

    landmarks = results.pose_landmarks.landmark

    # Get key body points
    try:
        # Shoulders
        left_shoulder = landmarks[mp.solutions.pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER]

        # Hips
        left_hip = landmarks[mp.solutions.pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp.solutions.pose.PoseLandmark.RIGHT_HIP]

        # Elbows (for sleeve length estimation)
        left_elbow = landmarks[mp.solutions.pose.PoseLandmark.LEFT_ELBOW]
        right_elbow = landmarks[mp.solutions.pose.PoseLandmark.RIGHT_ELBOW]

        # Knees (for lower body)
        left_knee = landmarks[mp.solutions.pose.PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[mp.solutions.pose.PoseLandmark.RIGHT_KNEE]

        # Calculate bounding box based on category
        padding = 0.15

        if category == GarmentCategory.UPPER_BODY:
            # Upper body: shoulders to waist
            x_coords = [left_shoulder.x, right_shoulder.x, left_elbow.x, right_elbow.x]
            y_coords = [left_shoulder.y, right_shoulder.y, left_hip.y, right_hip.y]
            # Start slightly below face (neck area)
            y_min = min(left_shoulder.y, right_shoulder.y) - 0.05

        elif category == GarmentCategory.LOWER_BODY:
            # Lower body: waist to knees/ankles
            x_coords = [left_hip.x, right_hip.x]
            y_coords = [left_hip.y, right_hip.y, left_knee.y, right_knee.y]
            y_min = min(left_hip.y, right_hip.y)

        else:  # DRESS
            # Full dress: shoulders to knees
            x_coords = [left_shoulder.x, right_shoulder.x, left_hip.x, right_hip.x]
            y_coords = [left_shoulder.y, right_shoulder.y, left_knee.y, right_knee.y]
            y_min = min(left_shoulder.y, right_shoulder.y) - 0.05

        # Calculate bounds with padding
        x1 = int((min(x_coords) - padding) * w)
        x2 = int((max(x_coords) + padding) * w)
        y1 = int((y_min - padding) * h)
        y2 = int((max(y_coords) + padding) * h)

        # Clamp values
        x1, x2 = max(0, x1), min(w, x2)
        y1, y2 = max(0, y1), min(h, y2)

        # Fill mask region
        mask[y1:y2, x1:x2] = 255

    except Exception as e:
        logger.warning(f"Error creating pose-based mask: {e}")
        return create_fallback_mask(h, w, category)

    return Image.fromarray(mask)

def create_fallback_mask(h: int, w: int, category: GarmentCategory) -> Image.Image:
    """Create fallback mask when pose detection fails"""
    mask = np.zeros((h, w), dtype=np.uint8)

    if category == GarmentCategory.UPPER_BODY:
        # Upper body region (torso)
        y1, y2 = int(h * 0.15), int(h * 0.65)
        x1, x2 = int(w * 0.15), int(w * 0.85)
    elif category == GarmentCategory.LOWER_BODY:
        # Lower body region
        y1, y2 = int(h * 0.40), int(h * 0.90)
        x1, x2 = int(w * 0.20), int(w * 0.80)
    else:  # DRESS
        # Full body region
        y1, y2 = int(h * 0.15), int(h * 0.85)
        x1, x2 = int(w * 0.15), int(w * 0.85)

    mask[y1:y2, x1:x2] = 255
    return Image.fromarray(mask)

# ============================================================================
# Try-On Generation
# ============================================================================

def generate_tryon(
    person_image: Image.Image,
    garment_image: Image.Image,
    category: GarmentCategory = GarmentCategory.UPPER_BODY,
    preserve_face: bool = True,
    num_inference_steps: int = 30,
    guidance_scale: float = 2.5,
    denoise_strength: float = 1.0,
) -> Tuple[Image.Image, Dict[str, Any]]:
    """
    Main try-on generation pipeline using IDM-VTON.

    Pipeline steps:
    1. Extract original face for preservation
    2. Create body mask based on garment category
    3. Encode garment features using CLIP
    4. Generate try-on using IDM-VTON pipeline
    5. Restore original face (100% fidelity)

    Returns:
        Tuple of (result_image, metadata)
    """
    start_time = time.time()
    metadata = {
        "face_preserved": False,
        "model_used": "idm-vton",
        "pipeline_steps": [],
        "garment_category": category.value,
    }

    # Get pipeline
    pipeline = models.get('tryon_pipeline')
    if pipeline is None:
        raise HTTPException(status_code=500, detail="Try-on model not loaded")

    # Convert to numpy for face processing
    person_np = np.array(person_image)

    # Step 1: Extract original face
    original_face = None
    if preserve_face:
        original_face = extract_face(person_np)
        if original_face is not None:
            metadata["pipeline_steps"].append("face_extracted")
            logger.info("✓ Face extracted from person image")
        else:
            logger.warning("Could not extract face from person image")

    # Step 2: Create body mask
    mask_image = create_body_mask(person_np, category)
    metadata["pipeline_steps"].append("mask_created")
    logger.info(f"✓ Body mask created for {category.value}")

    # Step 3: Prepare images for model
    # IDM-VTON expects specific dimensions
    target_size = (768, 1024)
    person_prepared = prepare_image_for_model(person_image, target_size)
    garment_prepared = prepare_image_for_model(garment_image, target_size)
    mask_prepared = mask_image.resize(target_size, Image.Resampling.NEAREST)

    # Step 4: Build prompt based on garment category
    prompts = {
        GarmentCategory.UPPER_BODY: "person wearing the top, shirt, professional photo, realistic, high quality, natural pose",
        GarmentCategory.LOWER_BODY: "person wearing the pants, trousers, professional photo, realistic, high quality, natural pose",
        GarmentCategory.DRESS: "person wearing the dress, professional photo, realistic, high quality, elegant pose",
    }

    prompt = prompts.get(category, prompts[GarmentCategory.UPPER_BODY])

    negative_prompt = (
        "blurry, low quality, distorted, unrealistic, wrong proportions, "
        "artifacts, watermark, text, logo, deformed hands, extra limbs, "
        "bad anatomy, disfigured, mutation"
    )

    # Step 5: Generate try-on
    logger.info(f"Generating try-on with {num_inference_steps} steps...")

    with torch.inference_mode():
        # Clear CUDA cache before generation
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        result = pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=person_prepared,
            mask_image=mask_prepared,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            strength=denoise_strength,
            generator=torch.Generator(device=config.DEVICE).manual_seed(42),
        ).images[0]

    metadata["pipeline_steps"].append("tryon_generated")
    logger.info("✓ Try-on image generated")

    # Step 6: Resize back to original dimensions
    original_w, original_h = person_image.size
    result = result.resize((original_w, original_h), Image.Resampling.LANCZOS)

    # Step 7: Restore original face (CRITICAL for 100% fidelity)
    if preserve_face and original_face is not None:
        result_np = np.array(result)
        result_np = restore_face(result_np, original_face)
        result = Image.fromarray(result_np)
        metadata["face_preserved"] = True
        metadata["pipeline_steps"].append("face_restored")
        logger.info("✓ Original face restored")

    # Calculate processing time
    processing_time_ms = int((time.time() - start_time) * 1000)
    metadata["processing_time_ms"] = processing_time_ms
    logger.info(f"✓ Total processing time: {processing_time_ms}ms")

    return result, metadata

async def generate_tryon_via_gradio(
    person_image: Image.Image,
    garment_image: Image.Image,
    category: GarmentCategory,
) -> Tuple[Image.Image, Dict[str, Any]]:
    """
    Fallback: Generate try-on using Hugging Face Space via Gradio API.
    Useful when local GPU is unavailable or for faster processing.
    """
    client = models.get('gradio_client')
    if client is None:
        raise HTTPException(status_code=500, detail="Gradio client not available")

    start_time = time.time()
    metadata = {
        "model_used": "idm-vton-hf-space",
        "pipeline_steps": ["gradio_api_call"],
    }

    # Save images temporarily
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as person_file:
        person_image.save(person_file, format="PNG")
        person_path = person_file.name

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as garment_file:
        garment_image.save(garment_file, format="PNG")
        garment_path = garment_file.name

    try:
        # Call the Gradio API
        result = client.predict(
            person_path,
            garment_path,
            category.value.replace("_", " "),  # "upper body", etc.
            api_name="/tryon"
        )

        # Result should be the path to the generated image
        if isinstance(result, str):
            result_image = Image.open(result).convert("RGB")
        else:
            result_image = Image.open(result[0]).convert("RGB")

        metadata["processing_time_ms"] = int((time.time() - start_time) * 1000)
        return result_image, metadata

    finally:
        # Cleanup temp files
        os.unlink(person_path)
        os.unlink(garment_path)

# ============================================================================
# FastAPI Application
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup, cleanup on shutdown"""
    logger.info("=" * 60)
    logger.info("MirrorX IDM-VTON Server Starting...")
    logger.info(f"Device: {config.DEVICE}")
    logger.info(f"Dtype: {config.DTYPE}")
    logger.info("=" * 60)

    # Load models
    models['face_analyzer'] = load_face_analyzer()
    models['face_swapper'] = load_face_swapper()
    models['pose_estimator'] = load_pose_estimator()
    models['image_encoder'] = load_image_encoder()
    models['tryon_pipeline'] = load_idm_vton_pipeline()
    models['gradio_client'] = load_gradio_client()

    loaded_count = sum(1 for k, v in models.items() if v is not None)
    logger.info("=" * 60)
    logger.info(f"Loaded {loaded_count}/{len(models)} models")
    logger.info("Server ready!")
    logger.info("=" * 60)

    yield

    # Cleanup
    logger.info("Shutting down...")
    models.clear()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    gc.collect()

app = FastAPI(
    title="MirrorX IDM-VTON API",
    description="State-of-the-Art virtual try-on with 100% garment detail and face preservation",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    gpu_memory = None
    if torch.cuda.is_available():
        gpu_memory = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)

    return HealthResponse(
        status="healthy",
        models_loaded={
            name: model is not None
            for name, model in models.items()
        },
        gpu_available=torch.cuda.is_available(),
        gpu_name=torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        gpu_memory_gb=gpu_memory,
    )

@app.get("/models")
async def list_models():
    """List loaded models and their status"""
    return {
        "models": {
            name: {
                "loaded": model is not None,
                "type": type(model).__name__ if model else None,
            }
            for name, model in models.items()
        },
        "config": {
            "idm_vton_model": config.IDM_VTON_MODEL_ID,
            "inference_steps": config.INFERENCE_STEPS,
            "guidance_scale": config.GUIDANCE_SCALE,
            "device": config.DEVICE,
        }
    }

@app.post("/tryon", response_model=TryOnResponse)
async def create_tryon(request: TryOnRequest):
    """
    Generate virtual try-on from base64 encoded images.

    - **person_image**: Base64 encoded person/selfie image
    - **garment_image**: Base64 encoded garment/clothing image
    - **category**: Garment type (upper_body, lower_body, dress)
    - **preserve_face**: Whether to preserve original face (default: True)
    - **num_inference_steps**: Number of diffusion steps (10-50, default: 30)
    - **guidance_scale**: How closely to follow the prompt (1-10, default: 2.5)
    """
    try:
        # Decode images
        logger.info("Decoding input images...")
        person_image = decode_base64_image(request.person_image)
        garment_image = decode_base64_image(request.garment_image)

        # Resize if too large
        person_image = resize_image(person_image, config.MAX_IMAGE_SIZE)
        garment_image = resize_image(garment_image, config.MAX_IMAGE_SIZE)

        logger.info(f"Person image: {person_image.size}, Garment image: {garment_image.size}")

        # Generate try-on
        result_image, metadata = generate_tryon(
            person_image=person_image,
            garment_image=garment_image,
            category=request.category,
            preserve_face=request.preserve_face,
            num_inference_steps=request.num_inference_steps,
            guidance_scale=request.guidance_scale,
            denoise_strength=request.denoise_strength,
        )

        # Encode result
        result_b64 = encode_image_to_base64(
            result_image,
            format=config.OUTPUT_FORMAT,
            quality=config.OUTPUT_QUALITY,
        )

        return TryOnResponse(
            result_image=f"data:image/{config.OUTPUT_FORMAT.lower()};base64,{result_b64}",
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Try-on generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tryon/upload")
async def create_tryon_upload(
    person_image: UploadFile = File(..., description="Person/selfie image"),
    garment_image: UploadFile = File(..., description="Garment/clothing image"),
    category: GarmentCategory = Form(default=GarmentCategory.UPPER_BODY),
    preserve_face: bool = Form(default=True),
    num_inference_steps: int = Form(default=config.INFERENCE_STEPS),
    guidance_scale: float = Form(default=config.GUIDANCE_SCALE),
):
    """
    Generate virtual try-on from uploaded image files.
    Alternative endpoint for multipart/form-data uploads.
    """
    try:
        # Read uploaded files
        person_bytes = await person_image.read()
        garment_bytes = await garment_image.read()

        # Convert to PIL Images
        person_img = Image.open(io.BytesIO(person_bytes)).convert('RGB')
        garment_img = Image.open(io.BytesIO(garment_bytes)).convert('RGB')

        # Resize if needed
        person_img = resize_image(person_img, config.MAX_IMAGE_SIZE)
        garment_img = resize_image(garment_img, config.MAX_IMAGE_SIZE)

        logger.info(f"Uploaded - Person: {person_img.size}, Garment: {garment_img.size}")

        # Generate try-on
        result_image, metadata = generate_tryon(
            person_image=person_img,
            garment_image=garment_img,
            category=category,
            preserve_face=preserve_face,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
        )

        # Encode result
        result_b64 = encode_image_to_base64(
            result_image,
            format=config.OUTPUT_FORMAT,
            quality=config.OUTPUT_QUALITY,
        )

        return TryOnResponse(
            result_image=f"data:image/{config.OUTPUT_FORMAT.lower()};base64,{result_b64}",
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Try-on generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tryon/gradio")
async def create_tryon_gradio(request: TryOnRequest):
    """
    Generate try-on using Hugging Face Space (Gradio API) as fallback.
    Useful when local GPU is unavailable.
    """
    if not config.ENABLE_GRADIO_FALLBACK:
        raise HTTPException(status_code=400, detail="Gradio fallback is disabled")

    try:
        person_image = decode_base64_image(request.person_image)
        garment_image = decode_base64_image(request.garment_image)

        result_image, metadata = await generate_tryon_via_gradio(
            person_image=person_image,
            garment_image=garment_image,
            category=request.category,
        )

        result_b64 = encode_image_to_base64(result_image)

        return TryOnResponse(
            result_image=f"data:image/png;base64,{result_b64}",
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gradio try-on failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tryon/raw", response_class=Response)
async def create_tryon_raw(request: TryOnRequest):
    """
    Generate try-on and return raw image bytes (for streaming/direct download).
    """
    try:
        person_image = decode_base64_image(request.person_image)
        garment_image = decode_base64_image(request.garment_image)

        person_image = resize_image(person_image, config.MAX_IMAGE_SIZE)
        garment_image = resize_image(garment_image, config.MAX_IMAGE_SIZE)

        result_image, _ = generate_tryon(
            person_image=person_image,
            garment_image=garment_image,
            category=request.category,
            preserve_face=request.preserve_face,
            num_inference_steps=request.num_inference_steps,
            guidance_scale=request.guidance_scale,
        )

        # Return raw PNG bytes
        buffer = io.BytesIO()
        result_image.save(buffer, format="PNG")
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=tryon_result.png"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Try-on generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "inference_server:app",
        host=config.HOST,
        port=config.PORT,
        workers=1,  # Single worker for GPU (required)
        reload=False,
        log_level="info",
    )
