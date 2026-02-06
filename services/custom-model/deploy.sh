#!/bin/bash
set -e # Exit on error

# --- CONFIG ---
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
REPO_NAME="mirrorx-ai"
IMAGE_NAME="vton-engine"
TAG="v1"
MODEL_DISPLAY_NAME="mirrorx-vton-pro"
ENDPOINT_NAME="mirrorx-production"

echo "🔥 STARTING DEPLOYMENT FOR PROJECT: $PROJECT_ID"

# 1. Create Artifact Registry (Stores the Docker Image)
echo "📦 Ensuring Artifact Registry exists..."
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="MirrorX AI Models" || true

# 2. Build & Push
echo "🐳 Building Docker Image (This takes time)..."
gcloud auth configure-docker $REGION-docker.pkg.dev
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$TAG ./services/custom-model
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$TAG

# 3. Upload Model to Vertex AI
echo "🧠 Uploading Model to Vertex AI..."
gcloud ai models upload \
  --region=$REGION \
  --display-name=$MODEL_DISPLAY_NAME \
  --container-image-uri=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$TAG \
  --container-predict-route="/predict" \
  --container-health-route="/health" \
  --container-ports=8080

# 4. Deploy Endpoint
echo "🚀 Deploying Endpoint (Allocating GPU)..."
# Create Endpoint if not exists
ENDPOINT_ID=$(gcloud ai endpoints list --region=$REGION --filter="display_name=$ENDPOINT_NAME" --format="value(name)" || true)
if [ -z "$ENDPOINT_ID" ]; then
    gcloud ai endpoints create --region=$REGION --display-name=$ENDPOINT_NAME
    ENDPOINT_ID=$(gcloud ai endpoints list --region=$REGION --filter="display_name=$ENDPOINT_NAME" --format="value(name)")
fi

# Get Model ID
MODEL_ID=$(gcloud ai models list --region=$REGION --filter="display_name=$MODEL_DISPLAY_NAME" --format="value(name)" | head -n 1)

# Deploy to GPU Machine (T4)
gcloud ai endpoints deploy-model $ENDPOINT_ID \
  --region=$REGION \
  --model=$MODEL_ID \
  --display-name="vton-v1" \
  --machine-type="n1-standard-4" \
  --accelerator="type=nvidia-tesla-t4,count=1" \
  --min-replica-count=1 \
  --max-replica-count=1 \
  --traffic-split="0=100"

echo "✅ DEPLOYMENT COMPLETE!"
echo "Your Endpoint ID is: $ENDPOINT_ID"
echo "Update your .env file with VERTEX_ENDPOINT_ID=$ENDPOINT_ID"
