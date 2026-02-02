---
title: MirrorX Virtual Try-On
emoji: 👗
colorFrom: purple
colorTo: gold
sdk: gradio
sdk_version: 4.0.0
app_file: app.py
pinned: true
license: apache-2.0
suggested_hardware: t4-small
---

# MirrorX Zero-Cost Virtual Try-On

Free AI-powered virtual try-on using open-source models.

## Features

- **Virtual Try-On**: See how clothes look on you instantly
- **Face Preservation**: 100% facial fidelity using InsightFace
- **Multiple Categories**: Supports tops, bottoms, and dresses
- **API Access**: Integrate into your own applications

## Models Used

| Model | License | Purpose |
|-------|---------|---------|
| OOTDiffusion | Apache 2.0 | Virtual try-on generation |
| InsightFace | MIT | Face detection & preservation |
| CodeFormer | MIT | Face enhancement |

## API Usage

```python
import requests
import base64

# Encode images
with open("person.jpg", "rb") as f:
    person_b64 = base64.b64encode(f.read()).decode()
with open("clothing.jpg", "rb") as f:
    clothing_b64 = base64.b64encode(f.read()).decode()

# Call API
response = requests.post(
    "https://YOUR-SPACE.hf.space/api/predict",
    json={
        "data": [person_b64, clothing_b64, "upperbody", True, 20, 2.0]
    }
)

result = response.json()
result_image_b64 = result["data"][0]
```

## Local Development

```bash
# Clone this space
git clone https://huggingface.co/spaces/YOUR-USERNAME/mirrorx-tryon

# Install dependencies
pip install -r requirements.txt

# Download face swapper model (optional, for face preservation)
wget https://huggingface.co/deepinsight/inswapper/resolve/main/inswapper_128.onnx

# Run locally
python app.py
```

## Cost Comparison

| Solution | Cost per Try-On | Monthly (50K tries) |
|----------|-----------------|---------------------|
| Google Gemini | $0.02-0.05 | $1,000-2,500 |
| This Space (Free) | $0.00 | $0 |
| Self-hosted GPU | $0.005 | $250 |

## Integration with MirrorX

This space is designed to integrate with the MirrorX platform as a zero-cost alternative to Gemini API.

See `/apps/api/src/services/zero-cost-tryon.ts` for the integration code.

## License

Apache 2.0 - Free for commercial use.
