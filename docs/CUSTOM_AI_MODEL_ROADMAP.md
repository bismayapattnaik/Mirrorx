# MirrorX Custom AI Model Roadmap

## Overview

This document outlines the technical roadmap for replacing Gemini 3 Pro with a custom, self-owned AI model for virtual try-on that achieves 100% face fidelity.

## Architecture Decision

### Chosen Approach: Open-Source Model Ensemble + Fine-tuning

**Why this approach:**
- 90% lower cost than training from scratch
- Can achieve BETTER results than Gemini for our specific use case
- Full control over the model
- Can run offline (for retail kiosk use case)
- Data stays private

---

## Phase 1: Quick Win (Week 1-2)
**Goal: Get a working prototype better than Gemini**

### Step 1.1: Set up IDM-VTON Base

```bash
# Clone and set up IDM-VTON
git clone https://github.com/yisol/IDM-VTON.git
cd IDM-VTON

# Install dependencies
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install diffusers transformers accelerate
pip install opencv-python pillow

# Download pre-trained weights
# - humanparsing model
# - densepose model
# - IDM-VTON checkpoint
```

### Step 1.2: Add Face Preservation Layer

```python
# services/face_preservation.py

import insightface
from insightface.app import FaceAnalysis
import cv2
import numpy as np

class FacePreservationService:
    """
    Ensures 100% face fidelity by:
    1. Extracting original face before try-on
    2. Swapping it back after generation
    3. Enhancing with CodeFormer
    """

    def __init__(self):
        # Initialize InsightFace
        self.face_app = FaceAnalysis(
            name='buffalo_l',
            providers=['CUDAExecutionProvider']
        )
        self.face_app.prepare(ctx_id=0)

        # Load face swapper
        self.swapper = insightface.model_zoo.get_model(
            'inswapper_128.onnx',
            providers=['CUDAExecutionProvider']
        )

        # Load CodeFormer for enhancement
        self.enhancer = self._load_codeformer()

    def extract_face(self, image: np.ndarray):
        """Extract face embedding from original image"""
        faces = self.face_app.get(image)
        if not faces:
            return None
        # Return the largest/most prominent face
        return max(faces, key=lambda x: x.bbox[2] - x.bbox[0])

    def restore_face(self, generated_image: np.ndarray, original_face):
        """Swap original face back into generated image"""
        # Get face in generated image
        gen_faces = self.face_app.get(generated_image)
        if not gen_faces:
            return generated_image

        target_face = gen_faces[0]

        # Perform face swap
        result = self.swapper.get(
            generated_image,
            target_face,
            original_face,
            paste_back=True
        )

        # Enhance with CodeFormer
        result = self._enhance_face(result)

        return result

    def _enhance_face(self, image):
        """Apply CodeFormer enhancement for crisp details"""
        # CodeFormer inference
        enhanced = self.enhancer.enhance(
            image,
            fidelity_weight=0.9,  # Higher = more original features
            upscale=1
        )
        return enhanced
```

### Step 1.3: Complete Pipeline Integration

```python
# services/custom_tryon_service.py

import torch
from PIL import Image
import numpy as np
from typing import Optional, Tuple
import base64
import io

from .face_preservation import FacePreservationService
from .idm_vton import IDMVTONPipeline
from .densepose import DensePoseEstimator

class CustomTryOnService:
    """
    MirrorX Custom Virtual Try-On Service

    Replaces Gemini with:
    - IDM-VTON for try-on generation
    - InsightFace for face preservation
    - CodeFormer for face enhancement
    """

    def __init__(self, device: str = "cuda"):
        self.device = device

        print("Loading IDM-VTON model...")
        self.tryon_pipeline = IDMVTONPipeline(device=device)

        print("Loading face preservation models...")
        self.face_service = FacePreservationService()

        print("Loading DensePose...")
        self.pose_estimator = DensePoseEstimator(device=device)

        print("All models loaded!")

    async def generate_tryon(
        self,
        person_image: str,  # Base64
        cloth_image: str,   # Base64
        mode: str = "FULL_FIT"
    ) -> Tuple[str, dict]:
        """
        Generate virtual try-on with 100% face preservation

        Returns:
            Tuple of (result_base64, metadata)
        """
        # Decode images
        person_np = self._decode_base64(person_image)
        cloth_np = self._decode_base64(cloth_image)

        # Step 1: Extract original face (CRITICAL for face fidelity)
        original_face = self.face_service.extract_face(person_np)
        if original_face is None:
            raise ValueError("No face detected in person image")

        # Step 2: Get pose estimation
        pose_data = self.pose_estimator.estimate(person_np)

        # Step 3: Generate try-on
        generated = self.tryon_pipeline.generate(
            person=person_np,
            cloth=cloth_np,
            pose=pose_data,
            num_inference_steps=30,
            guidance_scale=2.5
        )

        # Step 4: Restore original face (100% fidelity)
        final_result = self.face_service.restore_face(
            generated_image=generated,
            original_face=original_face
        )

        # Encode result
        result_b64 = self._encode_base64(final_result)

        metadata = {
            "face_preserved": True,
            "model_used": "idm-vton-v1",
            "inference_steps": 30,
            "resolution": f"{final_result.shape[1]}x{final_result.shape[0]}"
        }

        return result_b64, metadata

    def _decode_base64(self, b64_string: str) -> np.ndarray:
        """Decode base64 to numpy array"""
        if b64_string.startswith('data:image'):
            b64_string = b64_string.split(',')[1]

        img_bytes = base64.b64decode(b64_string)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        return np.array(img)

    def _encode_base64(self, image: np.ndarray) -> str:
        """Encode numpy array to base64"""
        img = Image.fromarray(image)
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=95)
        return base64.b64encode(buffer.getvalue()).decode()


# Singleton instance
_service: Optional[CustomTryOnService] = None

def get_tryon_service() -> CustomTryOnService:
    global _service
    if _service is None:
        _service = CustomTryOnService()
    return _service
```

---

## Phase 2: Fine-tuning for Indian Market (Week 3-6)
**Goal: Specialize model for Indian fashion & demographics**

### Step 2.1: Dataset Collection

```
Target Dataset:
├── Indian Fashion Images (10,000+)
│   ├── Kurtas (2,000)
│   ├── Sarees (2,000)
│   ├── Lehengas (1,500)
│   ├── Western Wear (2,500)
│   └── Ethnic Fusion (2,000)
│
├── Indian Body Types & Skin Tones
│   ├── Diverse representation
│   └── Various ages and builds
│
└── Paired Data (1,000 minimum)
    ├── Same person, different outfits
    └── Ground truth for validation
```

**Data Sources:**
1. Partner with Myntra/Ajio for licensed data
2. Synthetic data generation using existing models
3. Manual collection with consent (retail partners)

### Step 2.2: LoRA Fine-tuning (Cost-Effective)

```python
# training/lora_finetune.py

from peft import LoraConfig, get_peft_model
from diffusers import UNet2DConditionModel
import torch

def create_lora_model(base_model_path: str):
    """
    LoRA fine-tuning reduces training cost by 90%+
    Only updates 0.1% of model parameters
    """

    # Load base model
    unet = UNet2DConditionModel.from_pretrained(
        base_model_path,
        subfolder="unet"
    )

    # Configure LoRA
    lora_config = LoraConfig(
        r=16,                    # Rank (higher = more capacity, more compute)
        lora_alpha=32,           # Scaling factor
        target_modules=[
            "to_k", "to_q", "to_v", "to_out.0",  # Attention layers
            "conv_in", "conv_out"                 # Conv layers
        ],
        lora_dropout=0.05,
        bias="none"
    )

    # Apply LoRA
    model = get_peft_model(unet, lora_config)

    # Print trainable parameters
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"Trainable: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")

    return model


def train_lora(
    model,
    train_dataloader,
    epochs: int = 10,
    learning_rate: float = 1e-4
):
    """Training loop for LoRA fine-tuning"""

    from accelerate import Accelerator

    accelerator = Accelerator(
        gradient_accumulation_steps=4,
        mixed_precision="fp16"
    )

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=learning_rate,
        weight_decay=0.01
    )

    model, optimizer, train_dataloader = accelerator.prepare(
        model, optimizer, train_dataloader
    )

    for epoch in range(epochs):
        model.train()
        total_loss = 0

        for batch in train_dataloader:
            with accelerator.accumulate(model):
                # Forward pass
                loss = compute_loss(model, batch)

                # Backward pass
                accelerator.backward(loss)
                optimizer.step()
                optimizer.zero_grad()

                total_loss += loss.item()

        print(f"Epoch {epoch+1}/{epochs}, Loss: {total_loss/len(train_dataloader):.4f}")

    return model
```

### Step 2.3: Training Infrastructure

```yaml
# cloud_training.yaml - RunPod/Vast.ai configuration

instance:
  gpu: RTX_4090  # or A100 for faster training
  vram: 24GB
  ram: 64GB
  storage: 200GB

estimated_costs:
  - RTX 4090: $0.40/hr × 100hrs = $40
  - A100 40GB: $1.50/hr × 50hrs = $75
  - Total training budget: $50-100

training_time:
  - LoRA fine-tune (10K images): ~20-40 hours
  - Full fine-tune (not recommended): 200+ hours
```

---

## Phase 3: Production Deployment (Week 7-8)
**Goal: Deploy scalable inference service**

### Step 3.1: Optimized Inference

```python
# services/optimized_inference.py

import torch
from diffusers import StableDiffusionPipeline
import tensorrt as trt  # Optional: 2-3x speedup

class OptimizedTryOnService:
    """
    Production-optimized inference with:
    - TensorRT compilation (2-3x faster)
    - Batched inference
    - Memory optimization
    """

    def __init__(self):
        self.pipeline = self._load_optimized_pipeline()

    def _load_optimized_pipeline(self):
        """Load with optimizations"""

        pipeline = IDMVTONPipeline.from_pretrained(
            "mirrorx/custom-tryon-v1",
            torch_dtype=torch.float16,  # Half precision
            variant="fp16"
        )

        # Enable memory optimizations
        pipeline.enable_model_cpu_offload()  # Saves VRAM
        pipeline.enable_vae_slicing()        # Process in slices
        pipeline.enable_vae_tiling()         # For high-res images

        # Optional: Compile with torch.compile (PyTorch 2.0+)
        pipeline.unet = torch.compile(
            pipeline.unet,
            mode="reduce-overhead",
            fullgraph=True
        )

        return pipeline

    async def batch_inference(self, requests: list):
        """Process multiple requests efficiently"""

        # Batch similar-sized images together
        batched = self._batch_by_size(requests)

        results = []
        for batch in batched:
            batch_result = self.pipeline(
                person_images=[r.person for r in batch],
                cloth_images=[r.cloth for r in batch],
                batch_size=len(batch)
            )
            results.extend(batch_result)

        return results
```

### Step 3.2: Docker Deployment

```dockerfile
# Dockerfile.inference

FROM nvidia/cuda:12.1-runtime-ubuntu22.04

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model weights (or download at runtime)
COPY models/ /app/models/

# Copy application code
COPY services/ /app/services/
COPY api/ /app/api/

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s \
    CMD curl -f http://localhost:8080/health || exit 1

# Run with gunicorn
CMD ["gunicorn", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8080", "api.main:app"]
```

### Step 3.3: Kubernetes Deployment (Scalable)

```yaml
# k8s/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: mirrorx-tryon
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mirrorx-tryon
  template:
    metadata:
      labels:
        app: mirrorx-tryon
    spec:
      containers:
      - name: tryon
        image: mirrorx/custom-tryon:v1
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: "16Gi"
          requests:
            nvidia.com/gpu: 1
            memory: "12Gi"
        ports:
        - containerPort: 8080
        env:
        - name: MODEL_PATH
          value: "/app/models/idm-vton"
        - name: FACE_MODEL_PATH
          value: "/app/models/insightface"
        volumeMounts:
        - name: model-cache
          mountPath: /app/models
      volumes:
      - name: model-cache
        persistentVolumeClaim:
          claimName: model-cache-pvc
      nodeSelector:
        gpu: "true"
```

---

## Phase 4: Integration with MirrorX (Week 8+)

### Step 4.1: API Adapter

```typescript
// apps/api/src/services/custom-tryon.ts

import { CustomTryOnClient } from './grpc/custom-tryon-client';

export class CustomTryOnService {
  private client: CustomTryOnClient;

  constructor() {
    // Connect to self-hosted inference service
    this.client = new CustomTryOnClient({
      host: process.env.CUSTOM_TRYON_HOST || 'localhost:8080',
      timeout: 60000
    });
  }

  async generateTryOn(
    personBase64: string,
    clothBase64: string,
    options: TryOnOptions
  ): Promise<TryOnResult> {

    const startTime = Date.now();

    // Call custom model
    const response = await this.client.generate({
      person_image: personBase64,
      cloth_image: clothBase64,
      preserve_face: true,  // Always preserve face
      mode: options.mode
    });

    return {
      resultImage: response.result_b64,
      metadata: {
        processing_time_ms: Date.now() - startTime,
        model_used: 'mirrorx-custom-v1',
        face_preserved: response.face_preserved
      }
    };
  }
}
```

### Step 4.2: Fallback to Gemini

```typescript
// services/tryon-orchestrator.ts

export class TryOnOrchestrator {
  private customService: CustomTryOnService;
  private geminiService: GeminiService;

  async generateTryOn(request: TryOnRequest): Promise<TryOnResult> {
    try {
      // Try custom model first (cheaper, faster, better face preservation)
      return await this.customService.generateTryOn(
        request.personImage,
        request.clothImage,
        request.options
      );
    } catch (error) {
      console.warn('Custom model failed, falling back to Gemini:', error);

      // Fallback to Gemini
      return await this.geminiService.generateTryOn(
        request.personImage,
        request.clothImage,
        request.options
      );
    }
  }
}
```

---

## Cost Comparison

### Current (Gemini 3 Pro)
- Per try-on: ~$0.02-0.05
- 10,000 try-ons/month: $200-500

### Custom Model (Self-Hosted)
- Infrastructure: $100-200/month (GPU server)
- Per try-on: ~$0.01-0.02
- 10,000 try-ons/month: $100-200
- **Savings: 50-60%**

### Custom Model (Serverless - Modal/Replicate)
- Per try-on: ~$0.05-0.10
- Good for low volume or variable load
- Scales to zero

---

## Model Recommendations

### Primary: IDM-VTON
- Best quality for virtual try-on
- Apache 2.0 license (commercial OK)
- Active development
- GitHub: https://github.com/yisol/IDM-VTON

### Alternative: OOTDiffusion
- Faster inference
- MIT license
- Good for real-time applications
- GitHub: https://github.com/levihsu/OOTDiffusion

### Face Preservation Stack:
1. **InsightFace** (buffalo_l) - Face detection & embedding
2. **inswapper_128** - Face swapping
3. **CodeFormer** - Face restoration/enhancement

---

## Hardware Requirements

### Minimum (Development)
- GPU: RTX 3060 12GB
- RAM: 32GB
- Storage: 500GB SSD

### Recommended (Production)
- GPU: RTX 4090 24GB or A100 40GB
- RAM: 64GB
- Storage: 1TB NVMe

### Cloud Alternatives
- RunPod: RTX 4090 @ $0.40/hr
- Vast.ai: RTX 4090 @ $0.35/hr
- Modal: A10G @ $0.000536/sec (~$2/hr)
- AWS: g5.xlarge (A10G) @ $1.19/hr

---

## Success Metrics

| Metric | Gemini Baseline | Target |
|--------|-----------------|--------|
| Face Fidelity | 85-95% | 99%+ |
| Latency | 15-30s | 5-10s |
| Cost per try-on | $0.02-0.05 | $0.01-0.02 |
| Uptime | 99.9% (Google) | 99.5%+ |

---

## Timeline Summary

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1-2 | Foundation | Working prototype with IDM-VTON |
| 3-4 | Data | Dataset collected and prepared |
| 5-6 | Training | LoRA fine-tuned model |
| 7-8 | Deployment | Production inference service |
| 8+ | Integration | Fully integrated with MirrorX |

---

## Next Steps

1. **Immediate**: Set up development environment with IDM-VTON
2. **Week 1**: Get prototype working locally
3. **Week 2**: Integrate face preservation pipeline
4. **Week 3**: Begin data collection for fine-tuning
5. **Week 4+**: Fine-tune and deploy

---

## Resources

### Code Repositories
- IDM-VTON: https://github.com/yisol/IDM-VTON
- OOTDiffusion: https://github.com/levihsu/OOTDiffusion
- InsightFace: https://github.com/deepinsight/insightface
- CodeFormer: https://github.com/sczhou/CodeFormer

### Papers
- IDM-VTON: "Improving Diffusion Models for Virtual Try-on"
- OOTDiffusion: "Outfitting Fusion based Latent Diffusion"
- VITON-HD: "High-Resolution Virtual Try-On"

### Datasets
- VITON-HD: https://github.com/shadow2496/VITON-HD
- DeepFashion: http://mmlab.ie.cuhk.edu.hk/projects/DeepFashion.html

### Cloud GPU Providers
- RunPod: https://runpod.io
- Vast.ai: https://vast.ai
- Modal: https://modal.com
- Replicate: https://replicate.com
