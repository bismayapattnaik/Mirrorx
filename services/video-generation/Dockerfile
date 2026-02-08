# LTX-2 360 Video Generation Service Dockerfile
# Optimized for GPU inference with CUDA support

# =============================================================================
# Base Image Selection
# =============================================================================
# Use NVIDIA CUDA base image for GPU support
# For CPU-only deployments, use: python:3.11-slim-bookworm
ARG BASE_IMAGE=nvidia/cuda:12.1.0-runtime-ubuntu22.04

FROM ${BASE_IMAGE}

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# =============================================================================
# System Dependencies
# =============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Python
    python3.11 \
    python3.11-venv \
    python3-pip \
    # Build tools (for compiling some Python packages)
    build-essential \
    # Video processing
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    # Image processing
    libgl1-mesa-glx \
    libglib2.0-0 \
    libjpeg-dev \
    libpng-dev \
    # Utilities
    curl \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Upgrade pip
RUN python -m pip install --upgrade pip setuptools wheel

# =============================================================================
# Application Setup
# =============================================================================
WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .

# Install Python dependencies
# Split into multiple steps for better caching
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

RUN pip install \
    diffusers>=0.28.0 \
    transformers>=4.40.0 \
    accelerate>=0.29.0 \
    peft>=0.10.0 \
    safetensors>=0.4.0

RUN pip install \
    fastapi>=0.110.0 \
    uvicorn[standard]>=0.29.0 \
    python-multipart>=0.0.9 \
    Pillow>=10.0.0 \
    opencv-python>=4.9.0 \
    imageio>=2.34.0 \
    imageio-ffmpeg>=0.4.9 \
    numpy>=1.26.0 \
    einops>=0.7.0 \
    tqdm>=4.66.0

# Optional: Install xformers for memory-efficient attention
RUN pip install xformers --index-url https://download.pytorch.org/whl/cu121 || true

# Copy application code
COPY inference_360.py .

# =============================================================================
# Model Cache Directory
# =============================================================================
# Create directories for model cache and outputs
RUN mkdir -p /app/models /app/outputs /tmp/ltx2_outputs

# Set HuggingFace cache directory
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models
ENV DIFFUSERS_CACHE=/app/models

# =============================================================================
# Runtime Configuration
# =============================================================================
# Default environment variables (can be overridden at runtime)
ENV LORA_PATH=/app/lora_weights
ENV BASE_MODEL=Lightricks/LTX-Video
ENV DEVICE=cuda
ENV MAX_CONCURRENT_JOBS=2
ENV OUTPUT_DIR=/tmp/ltx2_outputs
ENV PORT=5001
ENV HOST=0.0.0.0

# Expose the service port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# =============================================================================
# Startup Command
# =============================================================================
# Use uvicorn directly for production
CMD ["python", "-m", "uvicorn", "inference_360:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "1"]
