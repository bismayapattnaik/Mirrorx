# LTX-2 360° Rotation Training Toolkit

Fine-tune LTX-2 video generation model to produce 360-degree rotation videos from static images. This enables the MirrorX pipeline to generate rotating fashion videos from IDM-VTON outputs.

## Overview

The training toolkit provides:
- **Dataset preparation** for 360° rotation videos
- **LoRA fine-tuning** configuration optimized for rotation motion
- **Integration** with the MirrorX video generation service

## Prerequisites

- Python 3.10+
- CUDA 12.1+ with compatible GPU (24GB+ VRAM recommended)
- FFmpeg for video processing
- ~50GB disk space for models and training data

## Quick Start

### 1. Setup Environment

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install xformers for memory efficiency (optional but recommended)
pip install xformers --index-url https://download.pytorch.org/whl/cu121
```

### 2. Prepare Training Data

Collect 360-degree rotation videos of people wearing fashion items. Videos should:
- Show a person rotating 360 degrees
- Have consistent studio lighting
- Be 3-5 seconds long
- Have clean backgrounds (preferably white/neutral)

Organize videos in a directory:
```
raw_360_videos/
├── video_001.mp4
├── video_002.mp4
├── dress_rotation_01.mp4
└── ...
```

Create the training dataset:
```bash
python scripts/prepare_360_dataset.py \
  --video_dir ./raw_360_videos \
  --output ./datasets/360_train.jsonl \
  --validate
```

Optional: Provide additional metadata per video:
```json
// video_metadata.json
{
  "video_001.mp4": {
    "clothing_type": "red evening dress",
    "rotation_direction": "clockwise",
    "background": "studio"
  }
}
```

Then run:
```bash
python scripts/prepare_360_dataset.py \
  --video_dir ./raw_360_videos \
  --output ./datasets/360_train.jsonl \
  --metadata_file ./video_metadata.json \
  --validate
```

### 3. Start Training

```bash
# Single GPU training
accelerate launch -m ltx_trainer.train \
  --config configs/ltx2_360_lora.yaml

# Multi-GPU training
accelerate launch --multi_gpu -m ltx_trainer.train \
  --config configs/ltx2_360_lora.yaml
```

Training will save checkpoints to `./outputs/ltx2_360/`.

### 4. Monitor Training

```bash
# View TensorBoard logs
tensorboard --logdir ./logs/ltx2_360
```

## Configuration

### `configs/ltx2_360_lora.yaml`

Key settings to adjust:

| Setting | Default | Description |
|---------|---------|-------------|
| `lora.r` | 128 | LoRA rank (higher = more capacity, more memory) |
| `dataset.num_frames` | 121 | Frames per video (~4s at 30fps) |
| `dataset.width/height` | 512 | Training resolution |
| `training.learning_rate` | 1e-4 | Learning rate |
| `training.max_train_steps` | 5000 | Total training steps |
| `training.condition_on_start_frame` | true | Enable image-to-video mode |

### Memory Optimization

For GPUs with less VRAM:

```yaml
training:
  batch_size: 1
  gradient_accumulation_steps: 8  # Increase to compensate

model:
  gradient_checkpointing: true
  enable_xformers: true

lora:
  r: 64  # Reduce from 128
```

## Dataset Format

The training JSONL file format:

```jsonl
{"video_path": "/abs/path/video.mp4", "caption": "a 360-degree rotating shot of a person wearing fashion clothing, studio lighting, white background, high quality, 4k"}
{"video_path": "/abs/path/video2.mp4", "caption": "a 360-degree rotating shot of a person wearing a red dress, studio lighting, white background, high quality, 4k"}
```

## Integration with MirrorX

After training, copy the LoRA weights to the video generation service:

```bash
# Copy latest checkpoint
cp -r ./outputs/ltx2_360/checkpoint-5000 ../services/video-generation/lora_weights

# Or set environment variable
export LORA_PATH=/path/to/outputs/ltx2_360/checkpoint-5000
```

Then start the video generation service:

```bash
cd ../services/video-generation
./setup.sh
python inference_360.py
```

## Tips for Best Results

### Data Quality
- Use high-quality videos (1080p+, good lighting)
- Ensure consistent rotation speed
- Include variety: different body types, clothing styles, poses
- Minimum 100 videos recommended, 500+ for best results

### Training
- Start with lower learning rate (5e-5) if loss is unstable
- Use validation prompts to monitor quality
- Save checkpoints frequently to find best iteration

### Captions
- Keep caption structure consistent
- Use trigger phrase "360-degree rotating shot" in all captions
- Add specific clothing descriptions for better control

## Troubleshooting

### Out of Memory
- Reduce `batch_size` and increase `gradient_accumulation_steps`
- Enable `gradient_checkpointing` and `enable_xformers`
- Reduce `lora.r` to 64 or 32
- Reduce `dataset.num_frames`

### Poor Motion Quality
- Increase training steps
- Verify video quality in dataset
- Check caption consistency
- Try higher `lora.r`

### Model Not Learning Rotation
- Ensure `condition_on_start_frame: true`
- Verify videos show full 360° rotation
- Check caption trigger phrase matches inference prompts

## License

MIT License - See LICENSE file for details.
