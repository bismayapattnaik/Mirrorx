# MirrorX IDM-VTON - Production Dockerfile
#
# State-of-the-Art virtual try-on with:
# - IDM-VTON for 100% garment detail preservation
# - InsightFace for 100% face fidelity
# - MediaPipe for pose estimation
#
# Build: docker build -t mirrorx-idmvton .
# Run: docker run --gpus all -p 8080:8080 mirrorx-idmvton
#
# Hardware Requirements:
# - GPU: 16GB-24GB VRAM (RTX 3090/4090, A10G)
# - RAM: 32GB recommended
# - Storage: ~20GB for model weights

FROM nvidia/cuda:12.1-runtime-ubuntu22.04

# Build arguments
ARG PYTHON_VERSION=3.10
ARG PYTORCH_CUDA=cu121

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Python and CUDA configuration
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=0
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface
ENV HF_HOME=/root/.cache/huggingface
ENV TORCH_HOME=/root/.cache/torch

# IDM-VTON configuration defaults
ENV IDM_VTON_MODEL_ID=yisol/IDM-VTON
ENV SDXL_BASE_MODEL=stabilityai/stable-diffusion-xl-base-1.0
ENV INFERENCE_STEPS=30
ENV GUIDANCE_SCALE=2.5
ENV MAX_IMAGE_SIZE=1024
ENV ENABLE_XFORMERS=true
ENV ENABLE_VAE_SLICING=true

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python${PYTHON_VERSION} \
    python3-pip \
    python${PYTHON_VERSION}-venv \
    python${PYTHON_VERSION}-dev \
    # OpenCV dependencies
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    # Image processing
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    # Build tools
    build-essential \
    cmake \
    git \
    wget \
    curl \
    # MediaPipe dependencies
    libprotobuf-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set Python 3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python${PYTHON_VERSION} 1 \
    && update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python${PYTHON_VERSION} 1

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

WORKDIR /app

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install PyTorch with CUDA support (separate step for caching)
RUN pip install --no-cache-dir \
    torch \
    torchvision \
    --index-url https://download.pytorch.org/whl/${PYTORCH_CUDA}

# Install xformers for memory-efficient attention
RUN pip install --no-cache-dir xformers

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download models during build (optional - increases image size but faster startup)
# Uncomment the sections below to bake models into the image

# Pre-download InsightFace models
RUN python -c "\
from insightface.app import FaceAnalysis; \
app = FaceAnalysis(name='buffalo_l'); \
print('InsightFace models downloaded')" || true

# Pre-download inswapper model
RUN mkdir -p /root/.insightface/models && \
    wget -q -O /root/.insightface/models/inswapper_128.onnx \
    https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx || true

# Pre-download CLIP model (optional)
# RUN python -c "\
# from transformers import CLIPVisionModelWithProjection; \
# model = CLIPVisionModelWithProjection.from_pretrained('openai/clip-vit-large-patch14'); \
# print('CLIP model downloaded')"

# Pre-download IDM-VTON weights (optional - large download ~15GB)
# Uncomment if you want faster cold starts
# RUN python -c "\
# from diffusers import UNet2DConditionModel, AutoencoderKL; \
# unet = UNet2DConditionModel.from_pretrained('yisol/IDM-VTON', subfolder='unet'); \
# vae = AutoencoderKL.from_pretrained('yisol/IDM-VTON', subfolder='vae'); \
# print('IDM-VTON models downloaded')"

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p \
    /root/.insightface/models \
    /root/.cache/huggingface \
    /root/.cache/torch \
    /app/temp \
    /app/logs

# Set proper permissions
RUN chmod +x /app/inference_server.py

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=300s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run server
CMD ["python", "inference_server.py"]
