#!/usr/bin/env python3
"""Create/update a Hugging Face dataset repo from a verified, publication-approved snapshot."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def validate_snapshot(folder: Path) -> dict:
    manifest_path = folder / "dataset_manifest.json"
    if not manifest_path.is_file():
        raise SystemExit("dataset_manifest.json is missing; run prepare_hf_dataset.py first")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("selected_rows", 0) < 1:
        raise SystemExit("refusing to publish an empty dataset snapshot")
    if manifest.get("all_publication_allowed") is not True:
        raise SystemExit("refusing to publish rows without explicit publication approval")

    claimed_manifest_hash = manifest.get("manifest_sha256")
    body = {key: value for key, value in manifest.items() if key != "manifest_sha256"}
    actual_manifest_hash = sha256_bytes(canonical(body).encode("utf-8"))
    if claimed_manifest_hash != actual_manifest_hash:
        raise SystemExit("dataset manifest SHA-256 does not match its canonical body")

    train_path = folder / "data" / "train.jsonl"
    if not train_path.is_file() or sha256_bytes(train_path.read_bytes()) != manifest.get("train_jsonl_sha256"):
        raise SystemExit("train.jsonl SHA-256 does not match the dataset manifest")

    episodes_path = folder / "data" / "episodes.jsonl"
    if not episodes_path.is_file() or sha256_bytes(episodes_path.read_bytes()) != manifest.get("episodes_jsonl_sha256"):
        raise SystemExit("episodes.jsonl SHA-256 does not match the dataset manifest")

    records = [json.loads(line) for line in train_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(records) != manifest["selected_rows"]:
        raise SystemExit("train.jsonl row count does not match the dataset manifest")
    for record in records:
        if record.get("publication") != {"allowed": True, "basis": "user_confirmed"}:
            raise SystemExit("train.jsonl contains a row without explicit publication approval")
        sample_id = record.get("sample_id")
        relative_image = record.get("image")
        frame_path = folder / str(relative_image)
        expected_hash = manifest.get("frame_hashes", {}).get(sample_id)
        if not frame_path.is_file() or not expected_hash or sha256_bytes(frame_path.read_bytes()) != expected_hash:
            raise SystemExit(f"frame SHA-256 does not match manifest for sample {sample_id}")
        if record.get("frame_sha256") != expected_hash:
            raise SystemExit(f"train row frame_sha256 does not match manifest for sample {sample_id}")

    episodes = [json.loads(line) for line in episodes_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(episodes) != manifest.get("episode_count"):
        raise SystemExit("episodes.jsonl count does not match the dataset manifest")
    episode_sample_ids = [sample_id for episode in episodes for sample_id in episode.get("sample_ids", [])]
    if sorted(episode_sample_ids) != sorted(record.get("sample_id") for record in records):
        raise SystemExit("episode index does not partition the exported dataset rows exactly once")
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-id", required=True, help="Hugging Face dataset repo, e.g. Thorsu/ARE-Agent-Studio-VLA-Dataset")
    parser.add_argument("--folder", type=Path, default=Path("huggingface/export"))
    parser.add_argument("--private", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    card = Path("huggingface/dataset/README.md")
    visual_asset = Path("assets/are-signal-hero.png")
    missing_presentation = [str(path) for path in (card, visual_asset) if not path.is_file()]
    if missing_presentation:
        raise SystemExit(f"missing dataset presentation inputs: {', '.join(missing_presentation)}")

    manifest = validate_snapshot(args.folder)
    if args.dry_run:
        print(json.dumps({"ready": True, "repo_id": args.repo_id, "manifest_sha256": manifest["manifest_sha256"], "rows": manifest["selected_rows"]}, indent=2))
        return
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise SystemExit("HF_TOKEN is required for publishing")
    from huggingface_hub import HfApi
    api = HfApi(token=token)
    api.create_repo(repo_id=args.repo_id, repo_type="dataset", private=args.private, exist_ok=True)
    api.upload_folder(
        repo_id=args.repo_id,
        repo_type="dataset",
        folder_path=str(args.folder),
        commit_message=f"Publish verified dataset snapshot {manifest['manifest_sha256'][:12]}",
    )
    api.upload_file(
        path_or_fileobj=str(visual_asset),
        path_in_repo="assets/are-signal-hero.png",
        repo_id=args.repo_id,
        repo_type="dataset",
        commit_message="Update Dataset Card presentation asset",
    )
    api.upload_file(path_or_fileobj=str(card), path_in_repo="README.md", repo_id=args.repo_id, repo_type="dataset", commit_message="Update Dataset Card")
    print(json.dumps({"published": True, "repo_id": args.repo_id, "manifest_sha256": manifest["manifest_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
