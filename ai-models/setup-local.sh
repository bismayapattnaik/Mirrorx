#!/bin/bash

# MirrorX Zero-Cost AI Setup Script
# This script sets up all the free AI models locally

set -e

echo "============================================"
echo "MirrorX Zero-Cost AI Setup"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# 1. Install Ollama (Free Local LLM)
# ============================================

echo -e "${YELLOW}Step 1: Installing Ollama for free text AI...${NC}"

if command -v ollama &> /dev/null; then
    echo -e "${GREEN}Ollama is already installed!${NC}"
else
    echo "Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    echo -e "${GREEN}Ollama installed successfully!${NC}"
fi

# Pull the recommended model (Llama 3.2 3B - fast and free)
echo "Pulling Llama 3.2 model (2GB download)..."
ollama pull llama3.2:3b

echo -e "${GREEN}Ollama setup complete!${NC}"
echo ""

# ============================================
# 2. Set up Python Environment
# ============================================

echo -e "${YELLOW}Step 2: Setting up Python environment...${NC}"

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Virtual environment created."
fi

# Activate and install dependencies
source venv/bin/activate

pip install --upgrade pip

# Install PyTorch with CUDA support (if available)
if command -v nvidia-smi &> /dev/null; then
    echo "NVIDIA GPU detected. Installing PyTorch with CUDA..."
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
else
    echo "No NVIDIA GPU detected. Installing CPU-only PyTorch..."
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
fi

# Install other dependencies
pip install transformers diffusers accelerate
pip install insightface onnxruntime-gpu 2>/dev/null || pip install insightface onnxruntime
pip install Pillow opencv-python numpy
pip install gradio requests python-dotenv

echo -e "${GREEN}Python environment setup complete!${NC}"
echo ""

# ============================================
# 3. Download Face Preservation Models
# ============================================

echo -e "${YELLOW}Step 3: Downloading face preservation models...${NC}"

mkdir -p models

# Download InsightFace models (automatic on first use)
echo "InsightFace models will be downloaded on first use."

# Download face swapper model
if [ ! -f "models/inswapper_128.onnx" ]; then
    echo "Downloading face swapper model..."
    wget -O models/inswapper_128.onnx \
        "https://huggingface.co/deepinsight/inswapper/resolve/main/inswapper_128.onnx" \
        2>/dev/null || echo "Face swapper download failed. Face preservation will be limited."
fi

echo -e "${GREEN}Face models ready!${NC}"
echo ""

# ============================================
# 4. Test Installation
# ============================================

echo -e "${YELLOW}Step 4: Testing installation...${NC}"

# Test Ollama
echo "Testing Ollama..."
ollama run llama3.2:3b "Say hello in 5 words" --format json 2>/dev/null && echo -e "${GREEN}Ollama working!${NC}" || echo -e "${RED}Ollama test failed${NC}"

# Test Python imports
echo "Testing Python imports..."
python3 -c "
import torch
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')

try:
    import insightface
    print('InsightFace: OK')
except:
    print('InsightFace: Not available')

try:
    from diffusers import DiffusionPipeline
    print('Diffusers: OK')
except:
    print('Diffusers: Not available')
"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "To start the local try-on server:"
echo "  cd ai-models/huggingface-space"
echo "  python app.py"
echo ""
echo "To test Ollama style recommendations:"
echo "  ollama run llama3.2:3b 'Analyze this blue cotton shirt for styling'"
echo ""
echo "Environment variables to set in .env:"
echo "  OLLAMA_ENDPOINT=http://localhost:11434"
echo "  SELF_HOSTED_TRYON_ENDPOINT=http://localhost:7860/api/predict"
echo ""
