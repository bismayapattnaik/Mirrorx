#!/bin/bash

# MirrorX Custom Model Setup Script
# This script sets up the environment for running your own AI model

set -e

echo "=========================================="
echo "MirrorX Custom Model Setup"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check CUDA
echo -e "\n${YELLOW}Checking CUDA...${NC}"
if command -v nvidia-smi &> /dev/null; then
    nvidia-smi --query-gpu=name,memory.total --format=csv
    echo -e "${GREEN}CUDA is available!${NC}"
else
    echo -e "${RED}WARNING: CUDA not found. GPU acceleration will not work.${NC}"
    echo "For production, you need an NVIDIA GPU with CUDA support."
fi

# Create virtual environment
echo -e "\n${YELLOW}Creating virtual environment...${NC}"
python3 -m venv .venv
source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install PyTorch with CUDA support
echo -e "\n${YELLOW}Installing PyTorch with CUDA...${NC}"
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Install other requirements
echo -e "\n${YELLOW}Installing requirements...${NC}"
pip install -r requirements.txt

# Download InsightFace models
echo -e "\n${YELLOW}Downloading InsightFace models...${NC}"
python3 << 'EOF'
import os
from insightface.app import FaceAnalysis

print("Downloading buffalo_l model...")
app = FaceAnalysis(name='buffalo_l')
app.prepare(ctx_id=-1)  # CPU for download
print("InsightFace models downloaded!")
EOF

# Download face swapper model
echo -e "\n${YELLOW}Downloading face swapper model...${NC}"
mkdir -p ~/.insightface/models
if [ ! -f ~/.insightface/models/inswapper_128.onnx ]; then
    echo "Please download inswapper_128.onnx manually from:"
    echo "https://huggingface.co/deepinsight/inswapper/resolve/main/inswapper_128.onnx"
    echo "And place it in ~/.insightface/models/"
else
    echo "Face swapper model already exists"
fi

# Pre-download Stable Diffusion model
echo -e "\n${YELLOW}Pre-downloading Stable Diffusion model...${NC}"
python3 << 'EOF'
from diffusers import StableDiffusionInpaintPipeline
import torch

print("Downloading Stable Diffusion Inpainting model...")
print("This may take a few minutes...")

pipeline = StableDiffusionInpaintPipeline.from_pretrained(
    "runwayml/stable-diffusion-inpainting",
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    safety_checker=None
)
print("Model downloaded!")
EOF

echo -e "\n${GREEN}=========================================="
echo "Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "To run the server:"
echo "  source .venv/bin/activate"
echo "  python inference_server.py"
echo ""
echo "API will be available at: http://localhost:8080"
echo "API docs at: http://localhost:8080/docs"
echo ""
echo -e "${YELLOW}For better results, consider using:${NC}"
echo "  1. IDM-VTON (https://github.com/yisol/IDM-VTON)"
echo "  2. OOTDiffusion (https://github.com/levihsu/OOTDiffusion)"
echo ""
echo "See CUSTOM_AI_MODEL_ROADMAP.md for full implementation guide."
