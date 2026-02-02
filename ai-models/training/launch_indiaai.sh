#!/bin/bash

# ============================================
# MirrorX-VTON Training Launch Script
# For IndiaAI Compute H100/A100 GPUs
# ============================================

set -e

echo "============================================"
echo "MirrorX-VTON Training on IndiaAI Compute"
echo "============================================"

# Configuration
NUM_GPUS=${NUM_GPUS:-8}
BATCH_SIZE=${BATCH_SIZE:-4}
CONFIG_FILE=${CONFIG_FILE:-"config.yaml"}
OUTPUT_DIR=${OUTPUT_DIR:-"./checkpoints"}
DATA_DIR=${DATA_DIR:-"./data"}

# Check GPU availability
echo "Checking GPU availability..."
nvidia-smi

# Environment setup
export CUDA_VISIBLE_DEVICES=0,1,2,3,4,5,6,7
export WANDB_MODE=${WANDB_MODE:-"online"}
export TOKENIZERS_PARALLELISM=false

# Install dependencies (if not already installed)
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Download base model (if not cached)
echo "Downloading base model (if needed)..."
python -c "
from diffusers import StableDiffusionXLPipeline
print('Downloading SDXL base model...')
StableDiffusionXLPipeline.from_pretrained(
    'stabilityai/stable-diffusion-xl-base-1.0',
    torch_dtype='auto',
)
print('Model downloaded successfully!')
"

# ============================================
# Multi-GPU Training with Accelerate
# ============================================

echo ""
echo "Starting training with $NUM_GPUS GPUs..."
echo "Batch size per GPU: $BATCH_SIZE"
echo "Effective batch size: $((BATCH_SIZE * 4 * NUM_GPUS))"
echo ""

# Create accelerate config if not exists
if [ ! -f "accelerate_config.yaml" ]; then
    cat > accelerate_config.yaml << EOF
compute_environment: LOCAL_MACHINE
distributed_type: MULTI_GPU
downcast_bf16: 'no'
gpu_ids: all
machine_rank: 0
main_training_function: main
mixed_precision: bf16
num_machines: 1
num_processes: $NUM_GPUS
rdzv_backend: static
same_network: true
tpu_env: []
tpu_use_cluster: false
tpu_use_sudo: false
use_cpu: false
EOF
fi

# Launch training
accelerate launch \
    --config_file accelerate_config.yaml \
    --num_processes $NUM_GPUS \
    train_mirrorx_vton.py \
    --config $CONFIG_FILE \
    --output_dir $OUTPUT_DIR \
    --data_dir $DATA_DIR

echo ""
echo "============================================"
echo "Training completed!"
echo "Checkpoints saved to: $OUTPUT_DIR"
echo "============================================"


# ============================================
# Cost Estimation (after training)
# ============================================

echo ""
echo "Cost Estimate (IndiaAI Compute):"
echo "================================"
echo "GPU Type: H100 80GB x $NUM_GPUS"
echo "Rate: ₹92/GPU/hour (IndiaAI subsidized)"
echo ""

# Calculate training time (rough estimate)
# Assuming ~200 hours for full training
TRAINING_HOURS=200
TOTAL_GPU_HOURS=$((TRAINING_HOURS * NUM_GPUS))
TOTAL_COST=$((TOTAL_GPU_HOURS * 92))

echo "Estimated training time: ~$TRAINING_HOURS hours"
echo "Total GPU hours: $TOTAL_GPU_HOURS"
echo "Estimated cost: ₹$TOTAL_COST (~₹$((TOTAL_COST / 100000)) Lakhs)"
echo ""
echo "Compare to Gemini API cost:"
echo "50,000 try-ons/month x ₹3 = ₹1,50,000/month"
echo "Annual Gemini cost: ₹18,00,000 (₹18 Lakhs)"
echo "Training ROI: ${((1800000 / TOTAL_COST))}x return"
