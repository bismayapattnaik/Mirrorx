#!/bin/bash
# =============================================================================
# LTX-2 360 Video Generation Service - Setup Script
# =============================================================================
#
# This script sets up the LTX-2 video generation service for local development
# or production deployment.
#
# Usage:
#   ./setup.sh              # Full setup with venv and dependencies
#   ./setup.sh --docker     # Docker-based setup
#   ./setup.sh --help       # Show help
#
# Requirements:
#   - Python 3.10+
#   - CUDA 12.1+ (for GPU support)
#   - FFmpeg
#   - ~15GB free disk space (for model download)
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/venv"
MODELS_DIR="${SCRIPT_DIR}/models"
OUTPUTS_DIR="${SCRIPT_DIR}/outputs"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     LTX-2 360° Video Generation Service - Setup               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

check_python() {
    print_step "Checking Python version..."

    if command -v python3.11 &> /dev/null; then
        PYTHON_CMD="python3.11"
    elif command -v python3.10 &> /dev/null; then
        PYTHON_CMD="python3.10"
    elif command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    else
        print_error "Python 3.10+ is required but not found."
        exit 1
    fi

    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)
    print_info "Found Python: $PYTHON_VERSION"
}

check_cuda() {
    print_step "Checking CUDA availability..."

    if command -v nvidia-smi &> /dev/null; then
        CUDA_VERSION=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
        GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
        print_info "GPU detected: $GPU_NAME (Driver: $CUDA_VERSION)"
    else
        print_warning "NVIDIA GPU not detected. Will use CPU (much slower)."
    fi
}

check_ffmpeg() {
    print_step "Checking FFmpeg..."

    if command -v ffmpeg &> /dev/null; then
        FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -1)
        print_info "Found: $FFMPEG_VERSION"
    else
        print_error "FFmpeg is required but not found."
        print_info "Install with: apt-get install ffmpeg (Linux) or brew install ffmpeg (macOS)"
        exit 1
    fi
}

setup_venv() {
    print_step "Setting up Python virtual environment..."

    if [ -d "$VENV_DIR" ]; then
        print_warning "Virtual environment already exists at $VENV_DIR"
        read -p "Recreate? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$VENV_DIR"
        else
            return
        fi
    fi

    $PYTHON_CMD -m venv "$VENV_DIR"
    print_info "Virtual environment created at $VENV_DIR"
}

install_dependencies() {
    print_step "Installing Python dependencies..."

    source "$VENV_DIR/bin/activate"

    # Upgrade pip
    pip install --upgrade pip setuptools wheel

    # Install PyTorch with CUDA support
    print_info "Installing PyTorch with CUDA support..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

    # Install remaining dependencies
    print_info "Installing remaining dependencies..."
    pip install -r "$SCRIPT_DIR/requirements.txt"

    # Try to install xformers for memory efficiency
    print_info "Attempting to install xformers (optional)..."
    pip install xformers --index-url https://download.pytorch.org/whl/cu121 || print_warning "xformers installation failed (non-critical)"

    print_info "Dependencies installed successfully!"
}

create_directories() {
    print_step "Creating required directories..."

    mkdir -p "$MODELS_DIR"
    mkdir -p "$OUTPUTS_DIR"
    mkdir -p "$SCRIPT_DIR/lora_weights"

    print_info "Directories created:"
    print_info "  - Models: $MODELS_DIR"
    print_info "  - Outputs: $OUTPUTS_DIR"
    print_info "  - LoRA weights: $SCRIPT_DIR/lora_weights"
}

download_base_model() {
    print_step "Pre-downloading base model..."

    source "$VENV_DIR/bin/activate"

    python3 << 'EOF'
import os
os.environ['HF_HOME'] = os.path.join(os.path.dirname(__file__), 'models')

print("Downloading LTX-Video base model...")
print("This may take a while (~10GB)...")

try:
    from diffusers import DiffusionPipeline
    pipeline = DiffusionPipeline.from_pretrained(
        "Lightricks/LTX-Video",
        torch_dtype="auto",
    )
    print("Model downloaded successfully!")
except Exception as e:
    print(f"Model download failed: {e}")
    print("The model will be downloaded on first run.")
EOF
}

create_env_file() {
    print_step "Creating .env configuration file..."

    ENV_FILE="$SCRIPT_DIR/.env"

    if [ -f "$ENV_FILE" ]; then
        print_warning ".env file already exists. Skipping."
        return
    fi

    cat > "$ENV_FILE" << EOF
# LTX-2 360 Video Generation Service Configuration
# Copy this file to .env and modify as needed

# Model Configuration
BASE_MODEL=Lightricks/LTX-Video
LORA_PATH=./lora_weights
DEVICE=cuda

# Server Configuration
HOST=0.0.0.0
PORT=5001

# Performance Tuning
MAX_CONCURRENT_JOBS=2
DEFAULT_NUM_FRAMES=80
DEFAULT_INFERENCE_STEPS=40
DEFAULT_GUIDANCE_SCALE=3.0
DEFAULT_IMAGE_GUIDANCE_SCALE=1.8

# Storage
OUTPUT_DIR=./outputs
HF_HOME=./models
EOF

    print_info "Created .env file at $ENV_FILE"
}

setup_docker() {
    print_step "Setting up Docker environment..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed."
        print_info "Install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check NVIDIA Docker runtime
    if ! docker info 2>/dev/null | grep -q "nvidia"; then
        print_warning "NVIDIA Docker runtime not detected."
        print_info "For GPU support, install nvidia-docker: https://github.com/NVIDIA/nvidia-docker"
    fi

    print_info "Building Docker image..."
    docker-compose build

    print_info "Docker setup complete!"
    print_info "Run with: docker-compose up"
}

print_success() {
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    Setup Complete!                            ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "To start the service:"
    echo ""
    echo "  1. Activate virtual environment:"
    echo "     source venv/bin/activate"
    echo ""
    echo "  2. Start the server:"
    echo "     python inference_360.py"
    echo ""
    echo "  3. Or use Docker:"
    echo "     docker-compose up"
    echo ""
    echo "The service will be available at: http://localhost:5001"
    echo ""
    echo "API Documentation: http://localhost:5001/docs"
    echo "Health Check: http://localhost:5001/health"
    echo ""
    echo "To train your own LoRA weights, see:"
    echo "  packages/ltx-trainer/README.md"
    echo ""
}

show_help() {
    echo "LTX-2 360 Video Generation Service - Setup Script"
    echo ""
    echo "Usage: ./setup.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --docker        Use Docker-based setup"
    echo "  --no-download   Skip model pre-download"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./setup.sh                    # Full local setup"
    echo "  ./setup.sh --docker           # Docker setup"
    echo "  ./setup.sh --no-download      # Setup without model download"
    echo ""
}

# =============================================================================
# Main Script
# =============================================================================

print_header

# Parse arguments
USE_DOCKER=false
SKIP_DOWNLOAD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)
            USE_DOCKER=true
            shift
            ;;
        --no-download)
            SKIP_DOWNLOAD=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run setup
if [ "$USE_DOCKER" = true ]; then
    check_ffmpeg
    setup_docker
else
    check_python
    check_cuda
    check_ffmpeg
    setup_venv
    install_dependencies
    create_directories
    create_env_file

    if [ "$SKIP_DOWNLOAD" = false ]; then
        download_base_model
    fi
fi

print_success
