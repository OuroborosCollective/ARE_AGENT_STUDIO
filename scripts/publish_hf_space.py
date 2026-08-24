#!/usr/bin/env python3
"""Create/update the Docker Hugging Face Space for ARE Agent Studio."""
import argparse
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-id", required=True, help="Hugging Face Space repo, e.g. Thorsu/ARE-Agent-Studio")
    parser.add_argument("--private", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    required = [
        Path("Dockerfile"),
        Path("frontend/package.json"),
        Path("backend/server.js"),
        Path("huggingface/space/README.md"),
        Path("assets/are-signal-hero.png"),
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise SystemExit(f"missing Space inputs: {', '.join(missing)}")
    if args.dry_run:
        print(f"ready: {args.repo_id} (Docker Space)")
        return
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise SystemExit("HF_TOKEN is required for publishing")
    from huggingface_hub import HfApi
    api = HfApi(token=token)
    api.create_repo(repo_id=args.repo_id, repo_type="space", space_sdk="docker", private=args.private, exist_ok=True)
    api.upload_folder(
        repo_id=args.repo_id,
        repo_type="space",
        folder_path=".",
        ignore_patterns=[".git/**", "node_modules/**", "frontend/.core-test-build/**", "backend/data/**", "huggingface/export/**", "*.zip", "*.bundle"],
        commit_message="Publish ARE Agent Studio Space source",
    )
    api.upload_file(path_or_fileobj="huggingface/space/README.md", path_in_repo="README.md", repo_id=args.repo_id, repo_type="space", commit_message="Set Space card")
    print(f"published: https://huggingface.co/spaces/{args.repo_id}")


if __name__ == "__main__":
    main()
