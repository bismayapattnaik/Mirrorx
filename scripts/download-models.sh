#!/bin/bash
# ============================================================================
# MirrorX Model Download Script
# ============================================================================
#
# Downloads all required models for IDM-VTON and LTX-2 services.
# Run this before deployment to pre-download models and speed up first start.
#
# Usage:
#   ./scripts/download-models.sh              # Download all models
#   ./scripts/download-models.sh --idm-vton   # Download IDM-VTON only
#   ./scripts/download-models.sh --ltx2       # Download LTX-2 only
#
# Requirements:
#   - Python 3.10+
#   - huggingface_hub package
#   - HF_TOKEN environment variable (for gated models)
#   - 50GB+ free disk space
#
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Model directories
MODELS_DIR="${PROJECT_ROOT}/models"
IDM_VTON_DIR="${MODELS_DIR}/idm-vton"
LTX2_DIR="${MODELS_DIR}/ltx2"
INSIGHTFACE_DIR="${MODELS_DIR}/insightface"

# Default options
DOWNLOAD_IDM_VTON=true
DOWNLOAD_LTX2=true
DOWNLOAD_INSIGHTFACE=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --idm-vton)
            DOWNLOAD_LTX2=false
            shift
            ;;
        --ltx2)
            DOWNLOAD_IDM_VTON=false
            DOWNLOAD_INSIGHTFACE=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --idm-vton    Download IDM-VTON models only"
            echo "  --ltx2        Download LTX-2 models only"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."

    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed."
        exit 1
    fi

    # Check pip packages
    if ! python3 -c "import huggingface_hub" &> /dev/null; then
        log_info "Installing huggingface_hub..."
        pip install huggingface_hub
    fi

    # Check HF token
    if [ -z "$HF_TOKEN" ]; then
        if [ -f "${PROJECT_ROOT}/.env" ]; then
            source "${PROJECT_ROOT}/.env"
        fi
    fi

    if [ -z "$HF_TOKEN" ]; then
        log_warning "HF_TOKEN not set. Some models may require authentication."
        log_info "Set HF_TOKEN environment variable or add to .env file"
    fi

    # Check disk space
    AVAILABLE_SPACE=$(df -BG "${MODELS_DIR}" 2>/dev/null | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "${AVAILABLE_SPACE:-0}" -lt 50 ]; then
        log_warning "Less than 50GB available. Model downloads may fail."
    fi

    log_success "Requirements check completed"
}

create_directories() {
    log_info "Creating model directories..."

    mkdir -p "$IDM_VTON_DIR"
    mkdir -p "$LTX2_DIR"
    mkdir -p "$INSIGHTFACE_DIR"

    log_success "Directories created"
}

download_idm_vton_models() {
    log_info "Downloading IDM-VTON models..."

    # Create Python download script
    cat > /tmp/download_idm_vton.py << 'PYTHON_SCRIPT'
import os
import sys
from huggingface_hub import snapshot_download, hf_hub_download

# Set cache directory
cache_dir = sys.argv[1] if len(sys.argv) > 1 else "./models/idm-vton"
os.makedirs(cache_dir, exist_ok=True)

print(f"Downloading to: {cache_dir}")

# Download IDM-VTON model
print("\n[1/4] Downloading IDM-VTON UNet...")
try:
    snapshot_download(
        "yisol/IDM-VTON",
        local_dir=os.path.join(cache_dir, "IDM-VTON"),
        local_dir_use_symlinks=False,
        resume_download=True,
    )
    print("IDM-VTON downloaded successfully!")
except Exception as e:
    print(f"Warning: Could not download IDM-VTON: {e}")

# Download CLIP model
print("\n[2/4] Downloading CLIP image encoder...")
try:
    snapshot_download(
        "openai/clip-vit-large-patch14",
        local_dir=os.path.join(cache_dir, "clip-vit-large-patch14"),
        local_dir_use_symlinks=False,
        resume_download=True,
    )
    print("CLIP downloaded successfully!")
except Exception as e:
    print(f"Warning: Could not download CLIP: {e}")

# Download SDXL VAE (optional, for fallback)
print("\n[3/4] Downloading SDXL VAE...")
try:
    snapshot_download(
        "stabilityai/sdxl-vae",
        local_dir=os.path.join(cache_dir, "sdxl-vae"),
        local_dir_use_symlinks=False,
        resume_download=True,
    )
    print("SDXL VAE downloaded successfully!")
except Exception as e:
    print(f"Warning: Could not download SDXL VAE: {e}")

print("\n[4/4] IDM-VTON models download complete!")
PYTHON_SCRIPT

    python3 /tmp/download_idm_vton.py "$IDM_VTON_DIR"
    rm /tmp/download_idm_vton.py

    log_success "IDM-VTON models downloaded"
}

download_insightface_models() {
    log_info "Downloading InsightFace models..."

    # Create Python download script
    cat > /tmp/download_insightface.py << 'PYTHON_SCRIPT'
import os
import sys
import urllib.request

cache_dir = sys.argv[1] if len(sys.argv) > 1 else "./models/insightface"
os.makedirs(cache_dir, exist_ok=True)

print(f"Downloading to: {cache_dir}")

# Download buffalo_l model (face detection + recognition)
print("\n[1/2] Downloading buffalo_l face analysis model...")
try:
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name='buffalo_l', root=cache_dir)
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("buffalo_l downloaded successfully!")
except ImportError:
    print("InsightFace not installed, downloading manually...")
    # Manual download from GitHub releases
    buffalo_url = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"
    buffalo_path = os.path.join(cache_dir, "buffalo_l.zip")

    if not os.path.exists(buffalo_path.replace('.zip', '')):
        urllib.request.urlretrieve(buffalo_url, buffalo_path)
        import zipfile
        with zipfile.ZipFile(buffalo_path, 'r') as zip_ref:
            zip_ref.extractall(cache_dir)
        os.remove(buffalo_path)
        print("buffalo_l downloaded successfully!")

# Download inswapper model (face swapping)
print("\n[2/2] Downloading inswapper_128 model...")
inswapper_url = "https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx"
inswapper_path = os.path.join(cache_dir, "inswapper_128.onnx")

if not os.path.exists(inswapper_path):
    urllib.request.urlretrieve(inswapper_url, inswapper_path)
    print("inswapper_128 downloaded successfully!")
else:
    print("inswapper_128 already exists")

print("\nInsightFace models download complete!")
PYTHON_SCRIPT

    python3 /tmp/download_insightface.py "$INSIGHTFACE_DIR"
    rm /tmp/download_insightface.py

    log_success "InsightFace models downloaded"
}

download_ltx2_models() {
    log_info "Downloading LTX-2 models..."

    # Option 1: Clone LTX-2 from GitHub (for local development)
    log_info "Cloning LTX-2 from GitHub..."
    if [ ! -d "$LTX2_DIR/LTX-2" ]; then
        git clone https://github.com/Lightricks/LTX-2.git "$LTX2_DIR/LTX-2" || {
            log_warning "Git clone failed, will download from HuggingFace instead"
        }
    else
        log_info "LTX-2 repo already exists, pulling latest..."
        cd "$LTX2_DIR/LTX-2" && git pull
        cd "$PROJECT_ROOT"
    fi

    # Option 2: Download model weights from HuggingFace
    cat > /tmp/download_ltx2.py << 'PYTHON_SCRIPT'
import os
import sys
from huggingface_hub import snapshot_download

cache_dir = sys.argv[1] if len(sys.argv) > 1 else "./models/ltx2"
os.makedirs(cache_dir, exist_ok=True)

print(f"Downloading to: {cache_dir}")

# Download LTX-Video model weights from HuggingFace
# GitHub repo: https://github.com/Lightricks/LTX-2.git
print("\n[1/2] Downloading LTX-2 model weights from HuggingFace...")
try:
    snapshot_download(
        "Lightricks/LTX-Video",
        local_dir=os.path.join(cache_dir, "LTX-Video"),
        local_dir_use_symlinks=False,
        resume_download=True,
        ignore_patterns=["*.md", "*.txt"],  # Skip docs to save space
    )
    print("LTX-Video downloaded successfully!")
except Exception as e:
    print(f"Warning: Could not download LTX-Video: {e}")
    print("The model will be downloaded on first inference.")

# Download T5 encoder (used for text encoding)
print("\n[2/2] Downloading T5-XXL text encoder...")
try:
    snapshot_download(
        "google/t5-v1_1-xxl",
        local_dir=os.path.join(cache_dir, "t5-v1_1-xxl"),
        local_dir_use_symlinks=False,
        resume_download=True,
        ignore_patterns=["*.md", "*.txt", "*.h5"],
    )
    print("T5-XXL downloaded successfully!")
except Exception as e:
    print(f"Warning: Could not download T5-XXL: {e}")

print("\nLTX-2 models download complete!")
print("\nNote: LTX-2 is open source - https://github.com/Lightricks/LTX-2.git")
PYTHON_SCRIPT

    python3 /tmp/download_ltx2.py "$LTX2_DIR"
    rm /tmp/download_ltx2.py

    log_success "LTX-2 models downloaded"
}

print_summary() {
    echo ""
    echo "============================================================================"
    echo "                    Model Download Complete"
    echo "============================================================================"
    echo ""
    echo "Downloaded models are stored in: ${MODELS_DIR}"
    echo ""

    # Calculate sizes
    if [ -d "$IDM_VTON_DIR" ]; then
        IDM_SIZE=$(du -sh "$IDM_VTON_DIR" 2>/dev/null | cut -f1)
        echo "IDM-VTON models: ${IDM_SIZE:-N/A}"
    fi

    if [ -d "$INSIGHTFACE_DIR" ]; then
        INSIGHT_SIZE=$(du -sh "$INSIGHTFACE_DIR" 2>/dev/null | cut -f1)
        echo "InsightFace models: ${INSIGHT_SIZE:-N/A}"
    fi

    if [ -d "$LTX2_DIR" ]; then
        LTX_SIZE=$(du -sh "$LTX2_DIR" 2>/dev/null | cut -f1)
        echo "LTX-2 models: ${LTX_SIZE:-N/A}"
    fi

    echo ""
    echo "To use pre-downloaded models with Docker:"
    echo "  1. Mount the models directory in docker-compose.yml"
    echo "  2. Set environment variables to point to mounted paths"
    echo ""
    echo "Or update docker-compose.yml volumes to use local paths:"
    echo "  volumes:"
    echo "    - ./models/idm-vton:/app/models"
    echo "============================================================================"
}

# Main execution
main() {
    echo "============================================================================"
    echo "                    MirrorX Model Download Script"
    echo "============================================================================"
    echo ""

    check_requirements
    create_directories

    if [ "$DOWNLOAD_IDM_VTON" = true ]; then
        download_idm_vton_models
    fi

    if [ "$DOWNLOAD_INSIGHTFACE" = true ]; then
        download_insightface_models
    fi

    if [ "$DOWNLOAD_LTX2" = true ]; then
        download_ltx2_models
    fi

    print_summary
}

main
