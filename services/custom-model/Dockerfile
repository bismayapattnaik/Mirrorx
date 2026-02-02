# MirrorX Custom Try-On Model - Production Dockerfile
# Build: docker build -t mirrorx-tryon .
# Run: docker run --gpus all -p 8080:8080 mirrorx-tryon

FROM nvidia/cuda:12.1-runtime-ubuntu22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    python3.10-venv \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 \
    && update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

WORKDIR /app

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu121 \
    && pip install --no-cache-dir -r requirements.txt

# Pre-download models during build (optional, increases image size)
# Uncomment if you want models baked into the image
# RUN python -c "from diffusers import StableDiffusionInpaintPipeline; StableDiffusionInpaintPipeline.from_pretrained('runwayml/stable-diffusion-inpainting', torch_dtype='float16')"

# Copy application code
COPY . .

# Create model cache directory
RUN mkdir -p /root/.insightface/models /root/.cache/huggingface

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=0
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface
ENV HF_HOME=/root/.cache/huggingface

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run server
CMD ["python", "inference_server.py"]
