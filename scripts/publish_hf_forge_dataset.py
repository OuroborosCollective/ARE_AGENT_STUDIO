#!/usr/bin/env python3
"""Publish a verified Forge-trajectory dataset snapshot to Hugging Face.

Revalidates every referenced file immediately before upload and records the
returned HF commit/revision. No mutable "latest" may be used as provenance.

Default private/gated until the rights gate authorizes public release.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from prepare_hf_forge_dataset import canonical, sha256_str, sha256_bytes, FORGE_DATASET_FAMILY


def validate_forge_snapshot(folder: Path) -> dict:
    """Revalidate every file in the snapshot against the manifest before upload."""
    manifest_path = folder / "dataset_manifest.json"
    if not manifest_path.is_file():
        raise SystemExit("dataset_manifest.json is missing; run prepare_hf_forge_dataset.py first")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if manifest.get("manifest_version") != "are-agent-forge-hf-manifest.v1":
        raise SystemExit("manifest version is not are-agent-forge-hf-manifest.v1")

    # Verify manifest hash
    claimed_hash = manifest.get("manifest_sha256")
    body = {k: v for k, v in manifest.items() if k != "manifest_sha256"}
    actual_hash = sha256_str(canonical(body))
    if claimed_hash != actual_hash:
        raise SystemExit("dataset manifest SHA-256 does not match its canonical body")

    # Revalidate each data file
    data_files = {
        "turns.jsonl": "turns_jsonl_sha256",
        "episodes.jsonl": "episodes_jsonl_sha256",
        "policies.jsonl": "policies_jsonl_sha256",
        "corrections.jsonl": "corrections_jsonl_sha256",
        "reconciliations.jsonl": "reconciliations_jsonl_sha256",
    }
    for filename, hash_key in data_files.items():
        file_path = folder / "data" / filename
        if not file_path.is_file():
            raise SystemExit(f"{filename} is missing from snapshot")
        actual = sha256_bytes(file_path.read_bytes())
        if actual != manifest.get(hash_key):
            raise SystemExit(f"{filename} SHA-256 does not match the dataset manifest")

    # Check data quality first (applies to both public and private)
    if manifest.get("data_quality_issues"):
        raise SystemExit(f"Data quality issues detected: {'; '.join(manifest['data_quality_issues'])}")

    # Check public release gate
    if manifest.get("public_release_allowed") is not True and not os.environ.get("FORCE_PRIVATE_PUBLISH"):
        raise SystemExit(
            "Public release is not allowed by the rights gate. "
            "Set FORCE_PRIVATE_PUBLISH=1 to publish as private/gated."
        )

    return manifest


def main():
    parser = argparse.ArgumentParser(description="Publish HF Forge-trajectory dataset")
    parser.add_argument("--repo-id", default=FORGE_DATASET_FAMILY, help="Hugging Face dataset repo ID")
    parser.add_argument("--folder", type=Path, default=Path("huggingface/forge-export"))
    parser.add_argument("--private", action="store_true", default=True, help="Publish as private (default)")
    parser.add_argument("--public", action="store_true", help="Publish as public (requires rights gate)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    manifest = validate_forge_snapshot(args.folder)

    if args.public and not manifest.get("public_release_allowed"):
        raise SystemExit("Cannot publish publicly: rights gate does not allow public redistribution.")

    if args.dry_run:
        print(json.dumps({
            "ready": True,
            "repo_id": args.repo_id,
            "manifest_sha256": manifest["manifest_sha256"],
            "exported_turns": manifest["exported_turn_count"],
            "episodes": manifest["episode_count"],
            "public_release": manifest.get("public_release_allowed", False) and args.public,
        }, indent=2))
        return

    token = os.environ.get("HF_TOKEN")
    if not token:
        raise SystemExit("HF_TOKEN is required for publishing")
    from huggingface_hub import HfApi
    api = HfApi(token=token)
    api.create_repo(repo_id=args.repo_id, repo_type="dataset", private=not args.public, exist_ok=True)
    commit_info = api.upload_folder(
        repo_id=args.repo_id,
        repo_type="dataset",
        folder_path=str(args.folder),
        commit_message=f"Publish Forge-trajectory snapshot {manifest['manifest_sha256'][:12]}",
    )
    revision = commit_info.oid if hasattr(commit_info, "oid") else str(commit_info)
    print(json.dumps({
        "published": True,
        "repo_id": args.repo_id,
        "manifest_sha256": manifest["manifest_sha256"],
        "hf_revision": revision,
    }, indent=2))


if __name__ == "__main__":
    main()
