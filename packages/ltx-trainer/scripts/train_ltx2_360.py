#!/usr/bin/env python3
"""
LTX-2 360-Degree Rotation LoRA Training Script

Fine-tunes LTX-Video model to generate 360-degree rotation videos from static images.
This is designed for image-to-video generation where the input is a virtual try-on result.

Usage:
    # Single GPU training
    python train_ltx2_360.py --config ../configs/ltx2_360_lora.yaml

    # Multi-GPU training with accelerate
    accelerate launch train_ltx2_360.py --config ../configs/ltx2_360_lora.yaml

    # Resume from checkpoint
    python train_ltx2_360.py --config ../configs/ltx2_360_lora.yaml --resume checkpoint-2500

Requirements:
    - Python 3.10+
    - CUDA 12.1+
    - GPU with 16GB+ VRAM (24GB recommended)
    - Prepared dataset (use prepare_360_dataset.py first)
"""

import os
import sys
import json
import math
import logging
import argparse
import random
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from tqdm.auto import tqdm

# Video processing
import imageio
import cv2

# Hugging Face libraries
from diffusers import (
    DiffusionPipeline,
    DDPMScheduler,
    AutoencoderKLTemporalDecoder,
    FlowMatchEulerDiscreteScheduler,
)
from diffusers.optimization import get_scheduler
from diffusers.utils import export_to_video
from transformers import T5Tokenizer, T5EncoderModel
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from safetensors.torch import save_file, load_file

# Accelerate for distributed training
from accelerate import Accelerator
from accelerate.logging import get_logger
from accelerate.utils import set_seed, ProjectConfiguration

# Configuration
import yaml
from omegaconf import OmegaConf

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = get_logger(__name__)


# =============================================================================
# Configuration Classes
# =============================================================================

@dataclass
class ModelConfig:
    name: str = "Lightricks/LTX-Video"
    variant: str = "standard"
    dtype: str = "float16"
    gradient_checkpointing: bool = True
    enable_xformers: bool = True


@dataclass
class LoRAConfig:
    r: int = 128
    alpha: int = 256
    dropout: float = 0.1
    target_modules: List[str] = field(default_factory=lambda: [
        "to_q", "to_k", "to_v", "to_out.0",
        "temporal_self_attn.to_q", "temporal_self_attn.to_k",
        "temporal_self_attn.to_v", "temporal_self_attn.to_out.0",
    ])
    use_rslora: bool = True
    init_lora_weights: str = "gaussian"


@dataclass
class DatasetConfig:
    train_data: str = "./datasets/360_train.jsonl"
    val_data: Optional[str] = None
    video_column: str = "video_path"
    caption_column: str = "caption"
    width: int = 512
    height: int = 512
    num_frames: int = 121
    sample_stride: int = 1
    fps: int = 30


@dataclass
class TrainingConfig:
    batch_size: int = 1
    gradient_accumulation_steps: int = 4
    learning_rate: float = 1e-4
    lr_scheduler: str = "cosine"
    lr_warmup_steps: int = 500
    max_train_steps: int = 5000
    checkpointing_steps: int = 500
    resume_from_checkpoint: Optional[str] = None
    mixed_precision: str = "fp16"
    seed: int = 42
    max_grad_norm: float = 1.0
    weight_decay: float = 0.01
    adam_beta1: float = 0.9
    adam_beta2: float = 0.999
    use_ema: bool = True
    ema_decay: float = 0.9999
    condition_on_start_frame: bool = True
    start_frame_noise_level: float = 0.05
    num_conditioning_frames: int = 1
    conditioning_dropout_prob: float = 0.1


@dataclass
class Config:
    experiment_id: str = "ltx2_360_rotation_v1"
    output_dir: str = "./outputs/ltx2_360"
    logging_dir: str = "./logs/ltx2_360"
    model: ModelConfig = field(default_factory=ModelConfig)
    lora: LoRAConfig = field(default_factory=LoRAConfig)
    dataset: DatasetConfig = field(default_factory=DatasetConfig)
    training: TrainingConfig = field(default_factory=TrainingConfig)


def load_config(config_path: str) -> Config:
    """Load configuration from YAML file."""
    with open(config_path, 'r') as f:
        config_dict = yaml.safe_load(f)

    # Create nested dataclass instances
    model_config = ModelConfig(**config_dict.get('model', {}))
    lora_config = LoRAConfig(**config_dict.get('lora', {}))
    dataset_config = DatasetConfig(**config_dict.get('dataset', {}))
    training_config = TrainingConfig(**config_dict.get('training', {}))

    return Config(
        experiment_id=config_dict.get('experiment_id', 'ltx2_360_rotation_v1'),
        output_dir=config_dict.get('output_dir', './outputs/ltx2_360'),
        logging_dir=config_dict.get('logging_dir', './logs/ltx2_360'),
        model=model_config,
        lora=lora_config,
        dataset=dataset_config,
        training=training_config,
    )


# =============================================================================
# Video Dataset
# =============================================================================

class Video360Dataset(Dataset):
    """
    Dataset for 360-degree rotation videos.

    Expects a JSONL file with entries containing:
    - video_path: Path to the video file
    - caption: Text description with rotation trigger phrase
    """

    def __init__(
        self,
        data_path: str,
        num_frames: int = 121,
        width: int = 512,
        height: int = 512,
        sample_stride: int = 1,
        fps: int = 30,
    ):
        self.data_path = Path(data_path)
        self.num_frames = num_frames
        self.width = width
        self.height = height
        self.sample_stride = sample_stride
        self.fps = fps

        # Load dataset entries
        self.entries = []
        if self.data_path.exists():
            with open(self.data_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        self.entries.append(json.loads(line))

        logger.info(f"Loaded {len(self.entries)} video entries from {data_path}")

    def __len__(self):
        return len(self.entries)

    def _load_video(self, video_path: str) -> Optional[torch.Tensor]:
        """Load video and extract frames."""
        try:
            reader = imageio.get_reader(video_path, 'ffmpeg')
            frames = []

            # Get video info
            meta = reader.get_meta_data()
            video_fps = meta.get('fps', 30)
            total_frames = meta.get('nframes', len(reader))

            # Calculate frame indices to sample
            # For full 360 rotation, we want evenly spaced frames
            if total_frames <= self.num_frames:
                indices = list(range(total_frames))
            else:
                indices = np.linspace(0, total_frames - 1, self.num_frames, dtype=int)

            for idx in indices:
                try:
                    frame = reader.get_data(idx)
                    # Resize frame
                    frame = cv2.resize(frame, (self.width, self.height), interpolation=cv2.INTER_LANCZOS4)
                    frames.append(frame)
                except Exception:
                    break

            reader.close()

            if len(frames) < self.num_frames:
                # Pad with last frame if not enough frames
                while len(frames) < self.num_frames:
                    frames.append(frames[-1])

            # Convert to tensor: [T, H, W, C] -> [C, T, H, W]
            frames = np.stack(frames, axis=0)
            frames = torch.from_numpy(frames).float()
            frames = frames.permute(3, 0, 1, 2)  # [C, T, H, W]

            # Normalize to [-1, 1]
            frames = (frames / 127.5) - 1.0

            return frames

        except Exception as e:
            logger.warning(f"Error loading video {video_path}: {e}")
            return None

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        entry = self.entries[idx]
        video_path = entry.get('video_path', '')
        caption = entry.get('caption', '')

        # Load video
        video = self._load_video(video_path)

        if video is None:
            # Return dummy data for failed loads
            video = torch.zeros(3, self.num_frames, self.height, self.width)

        return {
            'video': video,
            'caption': caption,
            'video_path': video_path,
        }


# =============================================================================
# Training Utilities
# =============================================================================

def encode_prompt(
    tokenizer: T5Tokenizer,
    text_encoder: T5EncoderModel,
    prompt: str,
    device: torch.device,
    max_length: int = 512,
) -> torch.Tensor:
    """Encode text prompt using T5 encoder."""
    text_inputs = tokenizer(
        prompt,
        padding="max_length",
        max_length=max_length,
        truncation=True,
        return_tensors="pt",
    )

    text_input_ids = text_inputs.input_ids.to(device)
    attention_mask = text_inputs.attention_mask.to(device)

    with torch.no_grad():
        text_embeddings = text_encoder(
            text_input_ids,
            attention_mask=attention_mask,
        )[0]

    return text_embeddings


def compute_loss(
    model,
    noise_scheduler,
    latents: torch.Tensor,
    text_embeddings: torch.Tensor,
    timesteps: torch.Tensor,
    first_frame_latents: Optional[torch.Tensor] = None,
    conditioning_dropout_prob: float = 0.1,
) -> torch.Tensor:
    """Compute training loss."""
    # Add noise to latents
    noise = torch.randn_like(latents)
    noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

    # Classifier-free guidance: randomly drop conditioning
    if first_frame_latents is not None and random.random() < conditioning_dropout_prob:
        first_frame_latents = None

    # Predict noise
    if first_frame_latents is not None:
        # Concatenate conditioning frame latents
        model_input = torch.cat([noisy_latents, first_frame_latents], dim=2)
    else:
        model_input = noisy_latents

    noise_pred = model(
        model_input,
        timesteps,
        encoder_hidden_states=text_embeddings,
        return_dict=False,
    )[0]

    # MSE loss
    loss = F.mse_loss(noise_pred, noise, reduction="mean")

    return loss


# =============================================================================
# EMA (Exponential Moving Average)
# =============================================================================

class EMAModel:
    """Exponential Moving Average for model parameters."""

    def __init__(self, model, decay: float = 0.9999):
        self.model = model
        self.decay = decay
        self.shadow = {}
        self.backup = {}

        # Initialize shadow parameters
        for name, param in model.named_parameters():
            if param.requires_grad:
                self.shadow[name] = param.data.clone()

    def update(self):
        """Update shadow parameters."""
        for name, param in self.model.named_parameters():
            if param.requires_grad:
                self.shadow[name] = (
                    self.decay * self.shadow[name] +
                    (1 - self.decay) * param.data
                )

    def apply_shadow(self):
        """Apply shadow parameters to model."""
        for name, param in self.model.named_parameters():
            if param.requires_grad:
                self.backup[name] = param.data.clone()
                param.data = self.shadow[name]

    def restore(self):
        """Restore original parameters."""
        for name, param in self.model.named_parameters():
            if param.requires_grad and name in self.backup:
                param.data = self.backup[name]
        self.backup = {}

    def state_dict(self):
        return self.shadow.copy()

    def load_state_dict(self, state_dict):
        self.shadow = state_dict.copy()


# =============================================================================
# Main Trainer
# =============================================================================

class LTX360Trainer:
    """Main trainer for LTX-2 360-degree rotation LoRA fine-tuning."""

    def __init__(self, config: Config):
        self.config = config
        self.global_step = 0

        # Set seed
        set_seed(config.training.seed)

        # Create output directories
        Path(config.output_dir).mkdir(parents=True, exist_ok=True)
        Path(config.logging_dir).mkdir(parents=True, exist_ok=True)

        # Initialize accelerator
        self.accelerator = Accelerator(
            mixed_precision=config.training.mixed_precision,
            gradient_accumulation_steps=config.training.gradient_accumulation_steps,
            log_with="tensorboard",
            project_config=ProjectConfiguration(
                project_dir=config.output_dir,
                logging_dir=config.logging_dir,
            ),
        )

        if self.accelerator.is_main_process:
            self.accelerator.init_trackers(config.experiment_id)

        # Determine dtype
        weight_dtype = torch.float16 if config.training.mixed_precision == "fp16" else torch.float32
        if config.training.mixed_precision == "bf16":
            weight_dtype = torch.bfloat16
        self.weight_dtype = weight_dtype

        # Load models
        self._load_models()

        # Setup LoRA
        self._setup_lora()

        # Load dataset
        self._load_dataset()

        # Setup optimizer and scheduler
        self._setup_optimizer()

        # Setup EMA
        if config.training.use_ema:
            self.ema = EMAModel(self.transformer, decay=config.training.ema_decay)
        else:
            self.ema = None

        # Prepare for distributed training
        self._prepare_training()

    def _load_models(self):
        """Load LTX-Video model components."""
        logger.info(f"Loading model from {self.config.model.name}...")

        # Load the full pipeline first to get all components
        try:
            # Try to load LTX-Video pipeline
            pipeline = DiffusionPipeline.from_pretrained(
                self.config.model.name,
                torch_dtype=self.weight_dtype,
            )

            # Extract components
            self.transformer = pipeline.transformer
            self.vae = pipeline.vae
            self.text_encoder = pipeline.text_encoder
            self.tokenizer = pipeline.tokenizer
            self.scheduler = pipeline.scheduler

            logger.info("Successfully loaded LTX-Video pipeline")

        except Exception as e:
            logger.warning(f"Could not load LTX-Video, trying alternative approach: {e}")

            # Fallback: Load components individually
            from diffusers import UNet3DConditionModel

            self.transformer = UNet3DConditionModel.from_pretrained(
                self.config.model.name,
                subfolder="transformer",
                torch_dtype=self.weight_dtype,
            )

            self.vae = AutoencoderKLTemporalDecoder.from_pretrained(
                self.config.model.name,
                subfolder="vae",
                torch_dtype=self.weight_dtype,
            )

            self.text_encoder = T5EncoderModel.from_pretrained(
                "google/t5-v1_1-xxl",
                torch_dtype=self.weight_dtype,
            )

            self.tokenizer = T5Tokenizer.from_pretrained("google/t5-v1_1-xxl")

            self.scheduler = FlowMatchEulerDiscreteScheduler.from_pretrained(
                self.config.model.name,
                subfolder="scheduler",
            )

        # Freeze VAE and text encoder
        self.vae.requires_grad_(False)
        self.text_encoder.requires_grad_(False)

        # Enable gradient checkpointing if requested
        if self.config.model.gradient_checkpointing:
            self.transformer.enable_gradient_checkpointing()

        # Enable xformers if available
        if self.config.model.enable_xformers:
            try:
                self.transformer.enable_xformers_memory_efficient_attention()
                logger.info("xformers memory efficient attention enabled")
            except Exception as e:
                logger.warning(f"Could not enable xformers: {e}")

    def _setup_lora(self):
        """Setup LoRA for the transformer."""
        logger.info(f"Setting up LoRA with rank {self.config.lora.r}...")

        # Determine which modules exist in the model
        available_modules = set()
        for name, _ in self.transformer.named_modules():
            available_modules.add(name.split('.')[-1])

        # Filter target modules to only those that exist
        target_modules = []
        for module in self.config.lora.target_modules:
            module_name = module.split('.')[-1]
            if module_name in available_modules or module in available_modules:
                target_modules.append(module)

        if not target_modules:
            # Default to common attention modules
            target_modules = ["to_q", "to_k", "to_v", "to_out.0"]

        logger.info(f"LoRA target modules: {target_modules}")

        lora_config = LoraConfig(
            r=self.config.lora.r,
            lora_alpha=self.config.lora.alpha,
            lora_dropout=self.config.lora.dropout,
            target_modules=target_modules,
            init_lora_weights=self.config.lora.init_lora_weights,
            use_rslora=self.config.lora.use_rslora,
        )

        self.transformer = get_peft_model(self.transformer, lora_config)
        self.transformer.print_trainable_parameters()

    def _load_dataset(self):
        """Load training dataset."""
        logger.info(f"Loading dataset from {self.config.dataset.train_data}...")

        self.train_dataset = Video360Dataset(
            data_path=self.config.dataset.train_data,
            num_frames=self.config.dataset.num_frames,
            width=self.config.dataset.width,
            height=self.config.dataset.height,
            sample_stride=self.config.dataset.sample_stride,
            fps=self.config.dataset.fps,
        )

        self.train_dataloader = DataLoader(
            self.train_dataset,
            batch_size=self.config.training.batch_size,
            shuffle=True,
            num_workers=4,
            pin_memory=True,
            drop_last=True,
        )

    def _setup_optimizer(self):
        """Setup optimizer and learning rate scheduler."""
        # Get trainable parameters
        trainable_params = [p for p in self.transformer.parameters() if p.requires_grad]

        self.optimizer = torch.optim.AdamW(
            trainable_params,
            lr=self.config.training.learning_rate,
            betas=(self.config.training.adam_beta1, self.config.training.adam_beta2),
            weight_decay=self.config.training.weight_decay,
        )

        # Calculate total training steps
        num_update_steps_per_epoch = math.ceil(
            len(self.train_dataloader) / self.config.training.gradient_accumulation_steps
        )
        max_train_steps = self.config.training.max_train_steps

        self.lr_scheduler = get_scheduler(
            self.config.training.lr_scheduler,
            optimizer=self.optimizer,
            num_warmup_steps=self.config.training.lr_warmup_steps,
            num_training_steps=max_train_steps,
        )

    def _prepare_training(self):
        """Prepare for distributed training."""
        self.transformer, self.optimizer, self.train_dataloader, self.lr_scheduler = (
            self.accelerator.prepare(
                self.transformer, self.optimizer, self.train_dataloader, self.lr_scheduler
            )
        )

        # Move frozen models to device
        self.vae.to(self.accelerator.device, dtype=self.weight_dtype)
        self.text_encoder.to(self.accelerator.device, dtype=self.weight_dtype)

    def train_step(self, batch: Dict[str, Any]) -> float:
        """Execute single training step."""
        video = batch['video']  # [B, C, T, H, W]
        captions = batch['caption']

        # Encode video to latents
        with torch.no_grad():
            # Reshape for VAE: [B, C, T, H, W] -> [B*T, C, H, W]
            b, c, t, h, w = video.shape
            video_flat = video.permute(0, 2, 1, 3, 4).reshape(b * t, c, h, w)

            # Encode
            latents = self.vae.encode(video_flat.to(self.weight_dtype)).latent_dist.sample()
            latents = latents * self.vae.config.scaling_factor

            # Reshape back: [B*T, C, H, W] -> [B, T, C, H, W] -> [B, C, T, H, W]
            latent_h, latent_w = latents.shape[-2:]
            latent_c = latents.shape[1]
            latents = latents.reshape(b, t, latent_c, latent_h, latent_w)
            latents = latents.permute(0, 2, 1, 3, 4)  # [B, C, T, H, W]

        # Extract first frame latents for conditioning
        first_frame_latents = None
        if self.config.training.condition_on_start_frame:
            first_frame_latents = latents[:, :, :1, :, :]

            # Add small noise for regularization
            if self.config.training.start_frame_noise_level > 0:
                noise_level = self.config.training.start_frame_noise_level
                first_frame_latents = first_frame_latents + noise_level * torch.randn_like(first_frame_latents)

        # Encode text prompts
        text_embeddings = []
        for caption in captions:
            emb = encode_prompt(
                self.tokenizer,
                self.text_encoder,
                caption,
                self.accelerator.device,
            )
            text_embeddings.append(emb)
        text_embeddings = torch.cat(text_embeddings, dim=0)

        # Sample timesteps
        bsz = latents.shape[0]
        timesteps = torch.randint(
            0, self.scheduler.config.num_train_timesteps,
            (bsz,), device=latents.device
        ).long()

        # Compute loss
        loss = compute_loss(
            self.transformer,
            self.scheduler,
            latents,
            text_embeddings,
            timesteps,
            first_frame_latents=first_frame_latents,
            conditioning_dropout_prob=self.config.training.conditioning_dropout_prob,
        )

        return loss

    def save_checkpoint(self, step: int):
        """Save model checkpoint."""
        if not self.accelerator.is_main_process:
            return

        checkpoint_dir = Path(self.config.output_dir) / f"checkpoint-{step}"
        checkpoint_dir.mkdir(parents=True, exist_ok=True)

        # Unwrap model and save LoRA weights
        unwrapped_model = self.accelerator.unwrap_model(self.transformer)
        unwrapped_model.save_pretrained(checkpoint_dir)

        # Save EMA weights if available
        if self.ema is not None:
            ema_path = checkpoint_dir / "ema_weights.safetensors"
            save_file(self.ema.state_dict(), str(ema_path))

        # Save training state
        training_state = {
            'global_step': self.global_step,
            'config': asdict(self.config) if hasattr(self.config, '__dataclass_fields__') else str(self.config),
        }
        with open(checkpoint_dir / 'training_state.json', 'w') as f:
            json.dump(training_state, f, indent=2, default=str)

        logger.info(f"Saved checkpoint to {checkpoint_dir}")

    def train(self):
        """Main training loop."""
        logger.info("=" * 60)
        logger.info("Starting LTX-2 360° Rotation LoRA Training")
        logger.info(f"Experiment: {self.config.experiment_id}")
        logger.info(f"Output: {self.config.output_dir}")
        logger.info(f"Max steps: {self.config.training.max_train_steps}")
        logger.info(f"Batch size: {self.config.training.batch_size}")
        logger.info(f"Gradient accumulation: {self.config.training.gradient_accumulation_steps}")
        logger.info(f"Effective batch size: {self.config.training.batch_size * self.config.training.gradient_accumulation_steps * self.accelerator.num_processes}")
        logger.info("=" * 60)

        # Progress bar
        progress_bar = tqdm(
            range(self.config.training.max_train_steps),
            desc="Training",
            disable=not self.accelerator.is_main_process,
        )

        # Training loop
        self.transformer.train()

        while self.global_step < self.config.training.max_train_steps:
            for batch in self.train_dataloader:
                with self.accelerator.accumulate(self.transformer):
                    # Forward pass
                    loss = self.train_step(batch)

                    # Backward pass
                    self.accelerator.backward(loss)

                    # Gradient clipping
                    if self.accelerator.sync_gradients:
                        self.accelerator.clip_grad_norm_(
                            self.transformer.parameters(),
                            self.config.training.max_grad_norm
                        )

                    # Optimizer step
                    self.optimizer.step()
                    self.lr_scheduler.step()
                    self.optimizer.zero_grad()

                # Update EMA
                if self.ema is not None and self.accelerator.sync_gradients:
                    self.ema.update()

                # Update step counter
                if self.accelerator.sync_gradients:
                    self.global_step += 1
                    progress_bar.update(1)

                    # Logging
                    if self.global_step % 10 == 0:
                        lr = self.lr_scheduler.get_last_lr()[0]
                        progress_bar.set_postfix({
                            'loss': f'{loss.item():.4f}',
                            'lr': f'{lr:.2e}',
                        })

                        self.accelerator.log({
                            'train/loss': loss.item(),
                            'train/lr': lr,
                            'train/step': self.global_step,
                        }, step=self.global_step)

                    # Checkpointing
                    if self.global_step % self.config.training.checkpointing_steps == 0:
                        self.save_checkpoint(self.global_step)

                    # Check if done
                    if self.global_step >= self.config.training.max_train_steps:
                        break

        # Save final checkpoint
        self.save_checkpoint(self.global_step)

        # End tracking
        self.accelerator.end_training()

        logger.info("Training completed!")
        return self.global_step


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Train LTX-2 360° Rotation LoRA")
    parser.add_argument(
        "--config",
        type=str,
        default="../configs/ltx2_360_lora.yaml",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--resume",
        type=str,
        default=None,
        help="Checkpoint to resume from (e.g., checkpoint-2500)"
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=None,
        help="Override output directory"
    )
    args = parser.parse_args()

    # Load configuration
    config_path = Path(args.config)
    if config_path.exists():
        config = load_config(str(config_path))
    else:
        logger.warning(f"Config not found at {config_path}, using defaults")
        config = Config()

    # Override output directory if specified
    if args.output_dir:
        config.output_dir = args.output_dir

    # Handle resume
    if args.resume:
        config.training.resume_from_checkpoint = args.resume

    # Create trainer and train
    trainer = LTX360Trainer(config)
    trainer.train()


if __name__ == "__main__":
    main()
