#!/bin/bash
# ============================================================================
# MirrorX Deployment Script
# ============================================================================
#
# This script handles the full deployment of MirrorX including:
# - Environment setup
# - Docker image building
# - Service deployment
# - Health checks
#
# Usage:
#   ./scripts/deploy.sh              # Deploy all services
#   ./scripts/deploy.sh --gpu        # Deploy with GPU support
#   ./scripts/deploy.sh --build      # Force rebuild images
#   ./scripts/deploy.sh --no-cache   # Build without cache
#
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default options
GPU_ENABLED=false
FORCE_BUILD=false
NO_CACHE=false
DETACHED=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --gpu)
            GPU_ENABLED=true
            shift
            ;;
        --build)
            FORCE_BUILD=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --foreground)
            DETACHED=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --gpu         Enable GPU support for ML services"
            echo "  --build       Force rebuild of Docker images"
            echo "  --no-cache    Build images without using cache"
            echo "  --foreground  Run in foreground (not detached)"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Functions
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

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose v2 is not available. Please update Docker."
        exit 1
    fi

    # Check GPU requirements if enabled
    if [ "$GPU_ENABLED" = true ]; then
        if ! command -v nvidia-smi &> /dev/null; then
            log_error "NVIDIA drivers not found. GPU mode requires NVIDIA GPU."
            exit 1
        fi

        if ! docker run --rm --gpus all nvidia/cuda:12.1-base-ubuntu22.04 nvidia-smi &> /dev/null; then
            log_error "NVIDIA Container Toolkit not configured properly."
            log_info "Please install NVIDIA Container Toolkit:"
            log_info "  https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
            exit 1
        fi

        log_success "GPU support verified"
    fi

    log_success "All requirements met"
}

setup_environment() {
    log_info "Setting up environment..."

    cd "$PROJECT_ROOT"

    # Check for .env file
    if [ ! -f .env ]; then
        if [ -f .env.production ]; then
            log_warning ".env file not found. Creating from .env.production..."
            cp .env.production .env
            log_warning "Please edit .env and add your API keys before proceeding."
            echo ""
            echo "Required API keys:"
            echo "  - HF_TOKEN: Hugging Face token for model downloads"
            echo "  - POSTGRES_PASSWORD: Secure database password"
            echo ""
            read -p "Press Enter to continue after editing .env, or Ctrl+C to cancel..."
        else
            log_error ".env file not found. Please create one from .env.production"
            exit 1
        fi
    fi

    # Source environment
    set -a
    source .env
    set +a

    log_success "Environment configured"
}

build_images() {
    log_info "Building Docker images..."

    cd "$PROJECT_ROOT"

    BUILD_ARGS=""
    if [ "$NO_CACHE" = true ]; then
        BUILD_ARGS="--no-cache"
    fi

    # Build images
    docker compose build $BUILD_ARGS

    log_success "Docker images built"
}

download_models() {
    log_info "Checking model availability..."

    # Create model directories
    mkdir -p "$PROJECT_ROOT/models/idm-vton"
    mkdir -p "$PROJECT_ROOT/models/ltx2"
    mkdir -p "$PROJECT_ROOT/models/insightface"

    # Note: Models are downloaded automatically on first run
    # This function can be extended to pre-download models

    log_info "Models will be downloaded on first service start"
    log_warning "First startup may take 10-30 minutes for model downloads"
}

deploy_services() {
    log_info "Deploying services..."

    cd "$PROJECT_ROOT"

    # Build compose command
    COMPOSE_CMD="docker compose"
    COMPOSE_FILES="-f docker-compose.yml"

    if [ "$GPU_ENABLED" = true ]; then
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.gpu.yml"
        log_info "GPU support enabled"
    fi

    # Add build flag if requested
    if [ "$FORCE_BUILD" = true ]; then
        DEPLOY_ARGS="--build"
    else
        DEPLOY_ARGS=""
    fi

    # Add detach flag
    if [ "$DETACHED" = true ]; then
        DEPLOY_ARGS="$DEPLOY_ARGS -d"
    fi

    # Deploy
    $COMPOSE_CMD $COMPOSE_FILES up $DEPLOY_ARGS

    if [ "$DETACHED" = true ]; then
        log_success "Services deployed in background"
    fi
}

wait_for_health() {
    log_info "Waiting for services to become healthy..."

    # Wait for database first
    log_info "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker compose exec -T postgres pg_isready -U mirrorx &> /dev/null; then
            log_success "PostgreSQL is ready"
            break
        fi
        sleep 2
    done

    # Wait for Redis
    log_info "Waiting for Redis..."
    for i in {1..15}; do
        if docker compose exec -T redis redis-cli ping &> /dev/null; then
            log_success "Redis is ready"
            break
        fi
        sleep 1
    done

    # Wait for IDM-VTON (can take a while for model loading)
    log_info "Waiting for IDM-VTON (model loading may take 5-15 minutes)..."
    for i in {1..120}; do
        if curl -sf http://localhost:${IDM_VTON_PORT:-8080}/health &> /dev/null; then
            log_success "IDM-VTON is ready"
            break
        fi
        if [ $i -eq 120 ]; then
            log_warning "IDM-VTON health check timed out (still loading models)"
        fi
        sleep 10
    done

    # Wait for LTX-2
    log_info "Waiting for LTX-2..."
    for i in {1..90}; do
        if curl -sf http://localhost:${LTX2_PORT:-5001}/health &> /dev/null; then
            log_success "LTX-2 is ready"
            break
        fi
        if [ $i -eq 90 ]; then
            log_warning "LTX-2 health check timed out (still loading models)"
        fi
        sleep 10
    done

    # Wait for API
    log_info "Waiting for API..."
    for i in {1..30}; do
        if curl -sf http://localhost:${API_PORT:-3000}/health &> /dev/null; then
            log_success "API is ready"
            break
        fi
        sleep 2
    done
}

print_status() {
    echo ""
    echo "============================================================================"
    echo "                    MirrorX Deployment Complete"
    echo "============================================================================"
    echo ""
    echo "Services:"
    echo "  - API:      http://localhost:${API_PORT:-3000}"
    echo "  - IDM-VTON: http://localhost:${IDM_VTON_PORT:-8080}"
    echo "  - LTX-2:    http://localhost:${LTX2_PORT:-5001}"
    echo ""
    echo "Health Endpoints:"
    echo "  - API:      http://localhost:${API_PORT:-3000}/health"
    echo "  - IDM-VTON: http://localhost:${IDM_VTON_PORT:-8080}/health"
    echo "  - LTX-2:    http://localhost:${LTX2_PORT:-5001}/health"
    echo ""
    echo "Useful Commands:"
    echo "  docker compose logs -f          # View all logs"
    echo "  docker compose logs -f api      # View API logs"
    echo "  docker compose logs -f idm-vton # View IDM-VTON logs"
    echo "  docker compose ps               # Service status"
    echo "  docker compose down             # Stop services"
    echo ""
    if [ "$GPU_ENABLED" = true ]; then
        echo "GPU Mode: ENABLED"
    else
        echo "GPU Mode: DISABLED (use --gpu to enable)"
    fi
    echo "============================================================================"
}

# Main execution
main() {
    echo "============================================================================"
    echo "                    MirrorX Deployment Script"
    echo "============================================================================"
    echo ""

    check_requirements
    setup_environment

    if [ "$FORCE_BUILD" = true ] || [ "$NO_CACHE" = true ]; then
        build_images
    fi

    download_models
    deploy_services

    if [ "$DETACHED" = true ]; then
        wait_for_health
        print_status
    fi
}

main
