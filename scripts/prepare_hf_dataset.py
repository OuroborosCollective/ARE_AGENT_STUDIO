#!/usr/bin/env python3
"""Prepare a publishable Hugging Face dataset snapshot from the local ARE Agent Studio ledger.

Only rows explicitly marked publication.allowed=true are exported. The script independently
recomputes each content-addressed sample id before writing frames and JSONL records.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import shutil
from pathlib import Path

SCHEMA = "are-agent-vla.v1"
DATA_URL = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})$")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def expected_sample_id(row: dict) -> str:
    identity = {
        "schema_version": row.get("schema_version"),
        "source": row.get("source"),
        "frame_hash": sha256_bytes(row["input_frame_base64"].encode("utf-8")),
        "action": row.get("target_action_chunk"),
        "timestamp_epoch": row.get("client_metadata", {}).get("timestamp_epoch"),
        "client_id": row.get("client_metadata", {}).get("client_id"),
        "session_id": row.get("client_metadata", {}).get("session_id"),
        "sequence_index": row.get("client_metadata", {}).get("sequence_index"),
    }
    return sha256_bytes(canonical(identity).encode("utf-8"))


def decode_frame(data_url: str) -> tuple[str, bytes]:
    match = DATA_URL.fullmatch(data_url or "")
    if not match:
        raise ValueError("invalid or incomplete image data URL")
    raw = base64.b64decode(match.group(2), validate=True)
    if len(raw) < 16:
        raise ValueError("decoded frame is too small")
    ext = "jpg" if match.group(1) in {"jpeg", "jpg"} else match.group(1)
    return ext, raw


def prepare(ledger: Path, output: Path) -> dict:
    if not ledger.is_file():
        raise FileNotFoundError(f"ledger not found: {ledger}")
    raw_ledger = ledger.read_bytes()
    rows = []
    seen_ids = set()
    skipped_unreviewed = 0
    for line_no, line in enumerate(raw_ledger.decode("utf-8").splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("schema_version") != SCHEMA:
            raise ValueError(f"line {line_no}: unsupported schema")
        metadata = row.get("client_metadata", {})
        if not isinstance(metadata.get("session_id"), str) or not metadata["session_id"].strip():
            raise ValueError(f"line {line_no}: session_id is required")
        if not isinstance(metadata.get("sequence_index"), int) or metadata["sequence_index"] < 0:
            raise ValueError(f"line {line_no}: sequence_index must be a non-negative integer")
        if row.get("sample_id") != expected_sample_id(row):
            raise ValueError(f"line {line_no}: sample_id does not match content identity")
        if row["sample_id"] in seen_ids:
            raise ValueError(f"line {line_no}: duplicate sample_id in source ledger")
        seen_ids.add(row["sample_id"])
        if row.get("publication", {}).get("allowed") is not True:
            skipped_unreviewed += 1
            continue
        if row.get("publication", {}).get("basis") != "user_confirmed":
            raise ValueError(f"line {line_no}: public row is missing user_confirmed publication basis")
        rows.append(row)

    if output.exists():
        shutil.rmtree(output)
    frames_dir = output / "frames"
    data_dir = output / "data"
    frames_dir.mkdir(parents=True)
    data_dir.mkdir(parents=True)

    exported = []
    frame_hashes = {}
    for row in rows:
        ext, frame = decode_frame(row["input_frame_base64"])
        frame_name = f"{row['sample_id']}.{ext}"
        frame_path = frames_dir / frame_name
        frame_path.write_bytes(frame)
        record = dict(row)
        record.pop("input_frame_base64", None)
        record["image"] = f"frames/{frame_name}"
        record["frame_sha256"] = sha256_bytes(frame)
        frame_hashes[row["sample_id"]] = record["frame_sha256"]
        exported.append(record)

    train_path = data_dir / "train.jsonl"
    train_payload = "".join(canonical(row) + "\n" for row in exported)
    train_path.write_text(train_payload, encoding="utf-8")

    episodes = {}
    for record in exported:
        meta = record["client_metadata"]
        episodes.setdefault(meta["session_id"], []).append(record)
    episode_rows = []
    for session_id, records in sorted(episodes.items()):
        sequence_indices = [r["client_metadata"]["sequence_index"] for r in records]
        if len(sequence_indices) != len(set(sequence_indices)):
            raise ValueError(f"session {session_id}: duplicate sequence_index in publishable rows")
        ordered = sorted(records, key=lambda r: (r["client_metadata"]["sequence_index"], r["client_metadata"]["timestamp_epoch"], r["sample_id"]))
        episode_rows.append({
            "session_id": session_id,
            "client_id": ordered[0]["client_metadata"].get("client_id"),
            "sample_ids": [r["sample_id"] for r in ordered],
            "sequence_indices": [r["client_metadata"]["sequence_index"] for r in ordered],
            "start_timestamp_epoch": min(r["client_metadata"]["timestamp_epoch"] for r in ordered),
            "end_timestamp_epoch": max(r["client_metadata"]["timestamp_epoch"] for r in ordered),
            "length": len(ordered),
        })
    episodes_path = data_dir / "episodes.jsonl"
    episodes_payload = "".join(canonical(row) + "\n" for row in episode_rows)
    episodes_path.write_text(episodes_payload, encoding="utf-8")

    manifest_body = {
        "manifest_version": "are-agent-hf-manifest.v1",
        "schema_version": SCHEMA,
        "source_ledger_sha256": sha256_bytes(raw_ledger),
        "selected_rows": len(exported),
        "skipped_unreviewed_rows": skipped_unreviewed,
        "train_jsonl_sha256": sha256_bytes(train_payload.encode("utf-8")),
        "episodes_jsonl_sha256": sha256_bytes(episodes_payload.encode("utf-8")),
        "episode_count": len(episode_rows),
        "frame_hashes": frame_hashes,
        "all_publication_allowed": bool(rows) and all(r.get("publication", {}).get("allowed") is True and r.get("publication", {}).get("basis") == "user_confirmed" for r in rows),
    }
    manifest = dict(manifest_body)
    manifest["manifest_sha256"] = sha256_bytes(canonical(manifest_body).encode("utf-8"))
    (output / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ledger", type=Path, default=Path("backend/data/telemetry.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("huggingface/export"))
    args = parser.parse_args()
    manifest = prepare(args.ledger, args.output)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
