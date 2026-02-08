#!/usr/bin/env python3
"""
LTX-2 360-Degree Dataset Preparation Script

Creates a JSONL dataset for LTX-2 training from a folder of 360-degree rotation videos.
The script scans for video files and generates the required training metadata with
appropriate captions that trigger rotational behavior.

Usage:
    python prepare_360_dataset.py --video_dir ./raw_360_videos --output ./datasets/360_train.jsonl

    # With custom caption trigger and additional metadata
    python prepare_360_dataset.py \
        --video_dir ./raw_360_videos \
        --output ./datasets/360_train.jsonl \
        --caption_trigger "360-degree rotating shot" \
        --metadata_file ./video_metadata.json \
        --validate
"""

import os
import json
import argparse
import subprocess
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class VideoMetadata:
    """Metadata for a training video."""
    video_path: str
    caption: str
    duration_seconds: Optional[float] = None
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    frame_count: Optional[int] = None
    file_hash: Optional[str] = None
    clothing_type: Optional[str] = None
    rotation_direction: str = "clockwise"
    background: str = "studio"


def get_video_info(video_path: str) -> Dict[str, Any]:
    """
    Extract video metadata using ffprobe.

    Args:
        video_path: Path to the video file

    Returns:
        Dictionary with video metadata (duration, fps, dimensions, frame_count)
    """
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            logger.warning(f"ffprobe failed for {video_path}")
            return {}

        data = json.loads(result.stdout)

        # Extract video stream info
        video_stream = None
        for stream in data.get('streams', []):
            if stream.get('codec_type') == 'video':
                video_stream = stream
                break

        if not video_stream:
            return {}

        # Parse frame rate (can be "30/1" or "29.97")
        fps_str = video_stream.get('r_frame_rate', '30/1')
        if '/' in fps_str:
            num, denom = fps_str.split('/')
            fps = float(num) / float(denom) if float(denom) != 0 else 30.0
        else:
            fps = float(fps_str)

        return {
            'duration_seconds': float(data.get('format', {}).get('duration', 0)),
            'fps': fps,
            'width': int(video_stream.get('width', 0)),
            'height': int(video_stream.get('height', 0)),
            'frame_count': int(video_stream.get('nb_frames', 0)) or None
        }

    except Exception as e:
        logger.warning(f"Error getting video info for {video_path}: {e}")
        return {}


def compute_file_hash(file_path: str, chunk_size: int = 8192) -> str:
    """Compute MD5 hash of a file for deduplication."""
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(chunk_size), b''):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        logger.warning(f"Error computing hash for {file_path}: {e}")
        return ""


def generate_caption(
    caption_trigger: str,
    clothing_type: Optional[str] = None,
    rotation_direction: str = "clockwise",
    background: str = "studio"
) -> str:
    """
    Generate a training caption for the video.

    The caption is critical for triggering rotational behavior in the fine-tuned model.

    Args:
        caption_trigger: Base trigger phrase (e.g., "360-degree rotating shot")
        clothing_type: Optional specific clothing description
        rotation_direction: Direction of rotation
        background: Background type

    Returns:
        Formatted caption string
    """
    # Build caption components
    parts = [f"a {caption_trigger} of a person"]

    if clothing_type:
        parts.append(f"wearing {clothing_type}")
    else:
        parts.append("wearing fashion clothing")

    # Add quality descriptors that help the model
    quality_terms = ["studio lighting", "white background", "high quality", "4k"]
    if background != "studio":
        quality_terms[1] = f"{background} background"

    parts.extend(quality_terms)

    # Add rotation direction hint
    if rotation_direction != "clockwise":
        parts.append(f"{rotation_direction} rotation")

    return ", ".join(parts)


def process_video(
    video_path: Path,
    caption_trigger: str,
    validate: bool = False,
    metadata_lookup: Optional[Dict[str, Dict]] = None
) -> Optional[VideoMetadata]:
    """
    Process a single video file and create its metadata entry.

    Args:
        video_path: Path to the video file
        caption_trigger: Caption trigger phrase
        validate: Whether to validate video with ffprobe
        metadata_lookup: Optional dictionary of additional metadata keyed by filename

    Returns:
        VideoMetadata object or None if video is invalid
    """
    abs_path = str(video_path.absolute())

    # Get additional metadata if available
    extra_meta = {}
    if metadata_lookup:
        filename = video_path.name
        stem = video_path.stem
        extra_meta = metadata_lookup.get(filename, metadata_lookup.get(stem, {}))

    # Extract clothing type from filename or metadata
    clothing_type = extra_meta.get('clothing_type')
    rotation_direction = extra_meta.get('rotation_direction', 'clockwise')
    background = extra_meta.get('background', 'studio')

    # Generate caption
    caption = generate_caption(
        caption_trigger,
        clothing_type=clothing_type,
        rotation_direction=rotation_direction,
        background=background
    )

    # Create base metadata
    metadata = VideoMetadata(
        video_path=abs_path,
        caption=caption,
        clothing_type=clothing_type,
        rotation_direction=rotation_direction,
        background=background
    )

    # Optionally validate and get video info
    if validate:
        video_info = get_video_info(abs_path)

        if not video_info:
            logger.warning(f"Skipping invalid video: {video_path}")
            return None

        # Check minimum requirements
        duration = video_info.get('duration_seconds', 0)
        if duration < 1.0:
            logger.warning(f"Skipping video shorter than 1s: {video_path} ({duration}s)")
            return None

        width = video_info.get('width', 0)
        height = video_info.get('height', 0)
        if width < 256 or height < 256:
            logger.warning(f"Skipping low resolution video: {video_path} ({width}x{height})")
            return None

        metadata.duration_seconds = video_info.get('duration_seconds')
        metadata.fps = video_info.get('fps')
        metadata.width = video_info.get('width')
        metadata.height = video_info.get('height')
        metadata.frame_count = video_info.get('frame_count')
        metadata.file_hash = compute_file_hash(abs_path)

    return metadata


def load_metadata_file(metadata_path: str) -> Dict[str, Dict]:
    """
    Load additional metadata from a JSON file.

    Expected format:
    {
        "video_001.mp4": {
            "clothing_type": "red dress",
            "rotation_direction": "clockwise",
            "background": "studio"
        },
        ...
    }
    """
    try:
        with open(metadata_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Could not load metadata file: {e}")
        return {}


def prepare_dataset(
    video_dir: str,
    output_jsonl: str,
    caption_trigger: str = "360-degree rotating shot",
    metadata_file: Optional[str] = None,
    validate: bool = False,
    num_workers: int = 4,
    deduplicate: bool = True
) -> int:
    """
    Creates a JSONL dataset for LTX-2 training from a folder of videos.

    Args:
        video_dir: Directory containing raw 360-degree videos
        output_jsonl: Output JSONL file path
        caption_trigger: Trigger phrase for 360-degree rotation (appears in all captions)
        metadata_file: Optional JSON file with per-video metadata
        validate: Whether to validate videos with ffprobe
        num_workers: Number of parallel workers for processing
        deduplicate: Whether to skip duplicate videos based on hash

    Returns:
        Number of videos successfully processed
    """
    video_path = Path(video_dir)

    if not video_path.exists():
        raise ValueError(f"Video directory does not exist: {video_dir}")

    logger.info(f"Scanning {video_dir} for videos...")

    # Supported video extensions
    valid_extensions = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

    # Find all video files
    video_files: List[Path] = []
    for ext in valid_extensions:
        video_files.extend(video_path.rglob(f"*{ext}"))
        video_files.extend(video_path.rglob(f"*{ext.upper()}"))

    # Remove duplicates (in case of case-insensitive filesystems)
    video_files = list(set(video_files))

    logger.info(f"Found {len(video_files)} video files")

    if not video_files:
        logger.warning("No video files found!")
        return 0

    # Load additional metadata if provided
    metadata_lookup = {}
    if metadata_file:
        metadata_lookup = load_metadata_file(metadata_file)
        logger.info(f"Loaded metadata for {len(metadata_lookup)} videos")

    # Process videos
    data: List[VideoMetadata] = []
    seen_hashes: set = set()

    if validate and num_workers > 1:
        # Parallel processing with validation
        logger.info(f"Processing videos with {num_workers} workers...")
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(
                    process_video,
                    video_file,
                    caption_trigger,
                    validate,
                    metadata_lookup
                ): video_file
                for video_file in video_files
            }

            for future in as_completed(futures):
                video_file = futures[future]
                try:
                    metadata = future.result()
                    if metadata:
                        # Deduplicate by hash
                        if deduplicate and metadata.file_hash:
                            if metadata.file_hash in seen_hashes:
                                logger.info(f"Skipping duplicate: {video_file}")
                                continue
                            seen_hashes.add(metadata.file_hash)
                        data.append(metadata)
                except Exception as e:
                    logger.error(f"Error processing {video_file}: {e}")
    else:
        # Sequential processing
        for video_file in video_files:
            try:
                metadata = process_video(
                    video_file,
                    caption_trigger,
                    validate,
                    metadata_lookup
                )
                if metadata:
                    if deduplicate and metadata.file_hash:
                        if metadata.file_hash in seen_hashes:
                            logger.info(f"Skipping duplicate: {video_file}")
                            continue
                        seen_hashes.add(metadata.file_hash)
                    data.append(metadata)
            except Exception as e:
                logger.error(f"Error processing {video_file}: {e}")

    logger.info(f"Successfully processed {len(data)} videos")

    # Create output directory if needed
    output_path = Path(output_jsonl)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write JSONL
    logger.info(f"Writing dataset to {output_jsonl}...")

    with open(output_jsonl, 'w') as f:
        for entry in data:
            # Convert to dict, removing None values for cleaner output
            entry_dict = {k: v for k, v in asdict(entry).items() if v is not None}
            f.write(json.dumps(entry_dict) + '\n')

    logger.info(f"Done! Dataset saved with {len(data)} entries.")
    logger.info(f"You can now use this JSONL for training with:")
    logger.info(f"  accelerate launch -m ltx_trainer.train --config configs/ltx2_360_lora.yaml")

    return len(data)


def main():
    parser = argparse.ArgumentParser(
        description="Prepare a JSONL dataset for LTX-2 360-degree rotation fine-tuning",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Basic usage
    python prepare_360_dataset.py --video_dir ./raw_360_videos --output ./datasets/360_train.jsonl

    # With validation and custom caption
    python prepare_360_dataset.py \\
        --video_dir ./raw_360_videos \\
        --output ./datasets/360_train.jsonl \\
        --caption_trigger "full body 360 rotation" \\
        --validate \\
        --num_workers 8

    # With additional metadata file
    python prepare_360_dataset.py \\
        --video_dir ./raw_360_videos \\
        --output ./datasets/360_train.jsonl \\
        --metadata_file ./video_annotations.json
        """
    )

    parser.add_argument(
        "--video_dir",
        type=str,
        required=True,
        help="Folder containing raw 360-degree rotation videos"
    )

    parser.add_argument(
        "--output",
        type=str,
        default="train_360.jsonl",
        help="Output JSONL file path (default: train_360.jsonl)"
    )

    parser.add_argument(
        "--caption_trigger",
        type=str,
        default="360-degree rotating shot",
        help="Trigger phrase for 360 rotation (default: '360-degree rotating shot')"
    )

    parser.add_argument(
        "--metadata_file",
        type=str,
        default=None,
        help="Optional JSON file with per-video metadata (clothing type, etc.)"
    )

    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate videos using ffprobe (extracts duration, resolution, etc.)"
    )

    parser.add_argument(
        "--num_workers",
        type=int,
        default=4,
        help="Number of parallel workers for validation (default: 4)"
    )

    parser.add_argument(
        "--no_deduplicate",
        action="store_true",
        help="Disable deduplication based on file hash"
    )

    args = parser.parse_args()

    try:
        count = prepare_dataset(
            video_dir=args.video_dir,
            output_jsonl=args.output,
            caption_trigger=args.caption_trigger,
            metadata_file=args.metadata_file,
            validate=args.validate,
            num_workers=args.num_workers,
            deduplicate=not args.no_deduplicate
        )

        if count == 0:
            logger.warning("No videos were processed. Check your video directory.")
            exit(1)

    except Exception as e:
        logger.error(f"Dataset preparation failed: {e}")
        exit(1)


if __name__ == "__main__":
    main()
