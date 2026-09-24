#!/usr/bin/env python3
"""Prepare a Hugging Face Forge-trajectory dataset snapshot from a verified
Forge trajectory ledger.

This is a SEPARATE dataset family from are-agent-vla.v1. It never appends to
or reinterprets the existing VLA dataset.

Default dataset repo: Thorsu/are-agent-forge-trajectories (private/gated until
the rights gate authorizes public release).

Exported structure:
  data/turns.jsonl          — permitted structured turn records
  data/episodes.jsonl       — run-level episode index
  data/policies.jsonl      — policy revisions referenced by episodes
  data/corrections.jsonl   — only corrections eligible for publication
  data/reconciliations.jsonl — permitted external-verification summaries
  dataset_manifest.json     — immutable manifest binding all hashes
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

FORGE_DATASET_FAMILY = "Thorsu/are-agent-forge-trajectories"
FORGE_MANIFEST_VERSION = "are-agent-forge-hf-manifest.v1"

SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
REF_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_str(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_turn_record(turn: dict, line_no: int) -> list[str]:
    errors = []
    if turn.get("schema_version") != "forge-trajectory.v1":
        errors.append(f"line {line_no}: expected schema forge-trajectory.v1")
    if not REF_RE.match(turn.get("run_id", "")):
        errors.append(f"line {line_no}: invalid run_id")
    if not SHA256_RE.match(turn.get("entry_sha256", "")):
        errors.append(f"line {line_no}: invalid entry_sha256")
    if not SHA256_RE.match(turn.get("previous_sha256", "") if turn.get("previous_sha256") else "0" * 64):
        errors.append(f"line {line_no}: invalid previous_sha256")
    if not isinstance(turn.get("turn_index"), int) or turn["turn_index"] < 0:
        errors.append(f"line {line_no}: turn_index must be non-negative integer")
    return errors


def validate_episode_record(ep: dict) -> list[str]:
    errors = []
    if not REF_RE.match(ep.get("run_id", "")):
        errors.append("invalid run_id")
    if not SHA256_RE.match(ep.get("root_hash", "")):
        errors.append("invalid root_hash")
    if not isinstance(ep.get("turn_count"), int) or ep["turn_count"] < 0:
        errors.append("turn_count must be non-negative integer")
    return errors


def prepare(ledger_path: Path, output: Path, rights_record: dict | None = None) -> dict:
    """Build a Forge-trajectory HF dataset snapshot from a trajectory ledger.

    Args:
        ledger_path: Path to the JSONL trajectory ledger (one turn record per line).
        output: Output directory for the snapshot.
        rights_record: Optional publication-rights record dict. If provided,
            fields are classified against it. If None, all fields default
            to private/quarantined (fail-closed).

    Returns:
        The dataset manifest dict.
    """
    if not ledger_path.is_file():
        raise FileNotFoundError(f"ledger not found: {ledger_path}")

    raw_ledger = ledger_path.read_bytes()
    turns = []
    seen_ids = set()
    for line_no, line in enumerate(raw_ledger.decode("utf-8").splitlines(), 1):
        if not line.strip():
            continue
        turn = json.loads(line)
        errors = validate_turn_record(turn, line_no)
        if errors:
            raise ValueError("; ".join(errors))
        if turn["entry_sha256"] in seen_ids:
            raise ValueError(f"line {line_no}: duplicate entry_sha256")
        seen_ids.add(turn["entry_sha256"])
        turns.append(turn)

    # Build episodes from turns
    episodes_map: dict[str, list[dict]] = {}
    for turn in turns:
        episodes_map.setdefault(turn["run_id"], []).append(turn)

    episodes = []
    for run_id, run_turns in sorted(episodes_map.items()):
        sorted_turns = sorted(run_turns, key=lambda t: t["turn_index"])
        root_hash = sorted_turns[-1]["entry_sha256"] if sorted_turns else "0" * 64
        episodes.append({
            "run_id": run_id,
            "root_hash": root_hash,
            "turn_count": len(sorted_turns),
            "turn_entry_hashes": [t["entry_sha256"] for t in sorted_turns],
            "terminal_status": sorted_turns[-1].get("status", "unknown") if sorted_turns else "unknown",
        })

    # Data quality checks
    dq_issues = []
    # Duplicate identity check
    if len(seen_ids) != len(turns):
        dq_issues.append("duplicate turn entries detected")
    # Monotonic turn index within episode
    for ep in episodes:
        indices = [t["turn_index"] for t in episodes_map[ep["run_id"]]]
        if indices != sorted(indices):
            dq_issues.append(f"non-monotonic turn index in run {ep['run_id']}")
        if len(indices) != len(set(indices)):
            dq_issues.append(f"duplicate turn index in run {ep['run_id']}")
    # Missing turn/gap reporting
    for ep in episodes:
        indices = sorted(t["turn_index"] for t in episodes_map[ep["run_id"]])
        for i in range(1, len(indices)):
            if indices[i] != indices[i - 1] + 1:
                dq_issues.append(f"gap in turn index in run {ep['run_id']} between {indices[i-1]} and {indices[i]}")

    # Rights classification (fail-closed if no rights record)
    quarantined_count = 0
    quarantined_reasons = []
    if rights_record is None:
        quarantined_count = len(turns)
        quarantined_reasons.append("No rights record provided — all fields default to private/quarantined.")
        exported_turns = []
    else:
        # Check if public redistribution is allowed for the relevant category
        perms = {p["category"]: p for p in rights_record.get("category_permissions", [])}
        forge_obs_perms = perms.get("forge_observations_state", {})
        if forge_obs_perms.get("allowed_public_redistribution"):
            exported_turns = turns
        else:
            quarantined_count = len(turns)
            quarantined_reasons.append("forge_observations_state does not allow public redistribution.")
            exported_turns = []

    if output.exists():
        shutil.rmtree(output)
    data_dir = output / "data"
    data_dir.mkdir(parents=True)

    # Write turns.jsonl
    turns_payload = "".join(canonical(t) + "\n" for t in exported_turns)
    turns_path = data_dir / "turns.jsonl"
    turns_path.write_text(turns_payload, encoding="utf-8")

    # Write episodes.jsonl
    episodes_payload = "".join(canonical(ep) + "\n" for ep in episodes)
    episodes_path = data_dir / "episodes.jsonl"
    episodes_path.write_text(episodes_payload, encoding="utf-8")

    # Write policies.jsonl (empty for now — populated when policy revisions exist)
    policies_payload = ""
    policies_path = data_dir / "policies.jsonl"
    policies_path.write_text(policies_payload, encoding="utf-8")

    # Write corrections.jsonl (empty — populated when corrections exist)
    corrections_payload = ""
    corrections_path = data_dir / "corrections.jsonl"
    corrections_path.write_text(corrections_payload, encoding="utf-8")

    # Write reconciliations.jsonl (empty — populated when reconciliation receipts exist)
    reconciliations_payload = ""
    reconciliations_path = data_dir / "reconciliations.jsonl"
    reconciliations_path.write_text(reconciliations_payload, encoding="utf-8")

    # Build manifest
    manifest_body = {
        "manifest_version": FORGE_MANIFEST_VERSION,
        "dataset_family": FORGE_DATASET_FAMILY,
        "source_ledger_sha256": sha256_bytes(raw_ledger),
        "source_git_sha": None,
        "rights_record_sha256": rights_record.get("record_sha256") if rights_record else None,
        "exported_turn_count": len(exported_turns),
        "total_turn_count": len(turns),
        "quarantined_turn_count": quarantined_count,
        "quarantined_reasons": quarantined_reasons,
        "episode_count": len(episodes),
        "turns_jsonl_sha256": sha256_str(turns_payload),
        "episodes_jsonl_sha256": sha256_str(episodes_payload),
        "policies_jsonl_sha256": sha256_str(policies_payload),
        "corrections_jsonl_sha256": sha256_str(corrections_payload),
        "reconciliations_jsonl_sha256": sha256_str(reconciliations_payload),
        "data_quality_issues": dq_issues,
        "public_release_allowed": rights_record is not None and quarantined_count == 0,
    }
    manifest = dict(manifest_body)
    manifest["manifest_sha256"] = sha256_str(canonical(manifest_body))
    (output / "dataset_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Prepare HF Forge-trajectory dataset snapshot")
    parser.add_argument("--ledger", type=Path, required=True, help="Path to Forge trajectory JSONL ledger")
    parser.add_argument("--output", type=Path, default=Path("huggingface/forge-export"))
    parser.add_argument("--rights-record", type=Path, default=None, help="Path to publication-rights record JSON")
    args = parser.parse_args()

    rights_record = None
    if args.rights_record and args.rights_record.is_file():
        rights_record = json.loads(args.rights_record.read_text(encoding="utf-8"))

    manifest = prepare(args.ledger, args.output, rights_record)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
