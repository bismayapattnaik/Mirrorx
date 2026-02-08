#!/bin/bash
# ============================================================================
# MirrorX Training Script
# ============================================================================
#
# Unified training script for all MirrorX models:
# - IDM-VTON fine-tuning
# - LTX-2 360° rotation LoRA
#
# Usage:
#   ./scripts/train.sh ltx2                  # Train LTX-2 LoRA
#   ./scripts/train.sh ltx2 --resume 2500    # Resume from checkpoint
#   ./scripts/train.sh vton                  # Train VTON model
#   ./scripts/train.sh prepare-dataset       # Prepare 360° dataset
#
# Requirements:
#   - Python 3.10+
#   - CUDA 12.1+
#   - GPU with 16GB+ VRAM
#   - Training data prepared
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

check_gpu() {
    log_info "Checking GPU availability..."

    if ! command -v nvidia-smi &> /dev/null; then
        log_error "NVIDIA GPU not detected. Training requires a GPU."
        exit 1
    fi

    nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader
    echo ""

    # Check VRAM
    VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
    if [ "${VRAM:-0}" -lt 16000 ]; then
        log_warning "GPU has less than 16GB VRAM. Training may be slow or fail."
    fi

    log_success "GPU check passed"
}

setup_environment() {
    log_info "Setting up training environment..."

    cd "$PROJECT_ROOT"

    # Activate virtual environment if exists
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
        log_info "Virtual environment activated"
    fi

    # Check for required packages
    python3 -c "import torch; import diffusers; import peft; import accelerate" 2>/dev/null || {
        log_info "Installing training dependencies..."
        pip install -r packages/ltx-trainer/requirements.txt
    }

    log_success "Environment ready"
}

train_ltx2() {
    log_info "Starting LTX-2 360° LoRA training..."

    cd "$PROJECT_ROOT"

    CONFIG_PATH="packages/ltx-trainer/configs/ltx2_360_lora.yaml"
    TRAIN_SCRIPT="packages/ltx-trainer/scripts/train_ltx2_360.py"

    # Check for dataset
    if [ ! -f "datasets/360_train.jsonl" ]; then
        log_warning "Training dataset not found at datasets/360_train.jsonl"
        log_info "Run './scripts/train.sh prepare-dataset' first"
        log_info "Or provide your own dataset in JSONL format"
        exit 1
    fi

    # Parse additional arguments
    RESUME_ARG=""
    OUTPUT_ARG=""

    shift  # Remove 'ltx2' from arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --resume)
                RESUME_ARG="--resume checkpoint-$2"
                shift 2
                ;;
            --output)
                OUTPUT_ARG="--output_dir $2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    # Check for multi-GPU
    NUM_GPUS=$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l)

    if [ "$NUM_GPUS" -gt 1 ]; then
        log_info "Multi-GPU detected ($NUM_GPUS GPUs). Using distributed training..."
        accelerate launch \
            --multi_gpu \
            --num_processes $NUM_GPUS \
            --mixed_precision fp16 \
            "$TRAIN_SCRIPT" \
            --config "$CONFIG_PATH" \
            $RESUME_ARG $OUTPUT_ARG
    else
        log_info "Single GPU training..."
        python3 "$TRAIN_SCRIPT" \
            --config "$CONFIG_PATH" \
            $RESUME_ARG $OUTPUT_ARG
    fi

    log_success "LTX-2 training completed!"
    log_info "Trained LoRA weights saved to: outputs/ltx2_360/"
}

train_vton() {
    log_info "Starting MirrorX-VTON training..."

    cd "$PROJECT_ROOT"

    CONFIG_PATH="ai-models/training/config.yaml"
    TRAIN_SCRIPT="ai-models/training/train_mirrorx_vton.py"

    # Check for dataset
    if [ ! -d "data/train" ]; then
        log_warning "Training data not found at data/train/"
        log_info "Please prepare your VTON dataset with the following structure:"
        echo "  data/"
        echo "    train/"
        echo "      person/     # Full body photos"
        echo "      cloth/      # Garment images"
        echo "      pairs.json  # Person-cloth-target triplets"
        exit 1
    fi

    # Check for multi-GPU
    NUM_GPUS=$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l)

    if [ "$NUM_GPUS" -gt 1 ]; then
        log_info "Multi-GPU detected ($NUM_GPUS GPUs). Using distributed training..."
        accelerate launch \
            --multi_gpu \
            --num_processes $NUM_GPUS \
            --mixed_precision bf16 \
            "$TRAIN_SCRIPT" \
            --config "$CONFIG_PATH"
    else
        log_info "Single GPU training..."
        python3 "$TRAIN_SCRIPT" --config "$CONFIG_PATH"
    fi

    log_success "VTON training completed!"
    log_info "Trained model saved to: checkpoints/"
}

prepare_dataset() {
    log_info "Preparing 360° rotation dataset..."

    cd "$PROJECT_ROOT"

    PREPARE_SCRIPT="packages/ltx-trainer/scripts/prepare_360_dataset.py"
    VIDEO_DIR="${1:-raw_360_videos}"
    OUTPUT_FILE="datasets/360_train.jsonl"

    # Check for video directory
    if [ ! -d "$VIDEO_DIR" ]; then
        log_error "Video directory not found: $VIDEO_DIR"
        echo ""
        echo "To prepare a dataset, you need 360° rotation videos."
        echo ""
        echo "Options to get training data:"
        echo "  1. Record your own 360° rotating mannequin videos"
        echo "  2. Use synthetic data from 3D rendering software"
        echo "  3. Download existing fashion video datasets"
        echo ""
        echo "Place your videos in: $VIDEO_DIR"
        echo "Supported formats: mp4, mov, avi, mkv, webm"
        exit 1
    fi

    # Count videos
    VIDEO_COUNT=$(find "$VIDEO_DIR" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.avi" -o -name "*.mkv" -o -name "*.webm" \) | wc -l)
    log_info "Found $VIDEO_COUNT videos in $VIDEO_DIR"

    if [ "$VIDEO_COUNT" -lt 10 ]; then
        log_warning "Recommended minimum: 50-100 videos for quality LoRA training"
    fi

    # Create output directory
    mkdir -p datasets

    # Run preparation script
    python3 "$PREPARE_SCRIPT" \
        --video_dir "$VIDEO_DIR" \
        --output "$OUTPUT_FILE" \
        --caption_trigger "360-degree rotating shot" \
        --validate \
        --num_workers 4

    log_success "Dataset prepared!"
    log_info "Dataset saved to: $OUTPUT_FILE"
    log_info "Entry count: $(wc -l < "$OUTPUT_FILE")"
}

show_help() {
    echo "MirrorX Training Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  ltx2              Train LTX-2 360° rotation LoRA"
    echo "  vton              Train MirrorX-VTON model"
    echo "  prepare-dataset   Prepare 360° rotation dataset from videos"
    echo ""
    echo "Options:"
    echo "  --resume <step>   Resume training from checkpoint"
    echo "  --output <dir>    Override output directory"
    echo ""
    echo "Examples:"
    echo "  $0 ltx2                           # Train LTX-2 LoRA"
    echo "  $0 ltx2 --resume 2500             # Resume from step 2500"
    echo "  $0 prepare-dataset ./my_videos    # Prepare dataset from videos"
    echo ""
    echo "Prerequisites:"
    echo "  1. Prepare your training data"
    echo "  2. Configure training in configs/*.yaml"
    echo "  3. Run training with appropriate GPU"
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi

    COMMAND=$1

    case $COMMAND in
        ltx2)
            check_gpu
            setup_environment
            train_ltx2 "$@"
            ;;
        vton)
            check_gpu
            setup_environment
            train_vton "$@"
            ;;
        prepare-dataset)
            shift
            prepare_dataset "$@"
            ;;
        --help|-h|help)
            show_help
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
