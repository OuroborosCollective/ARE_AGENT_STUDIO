#!/usr/bin/env python3
"""Tests for the HF Forge-trajectory dataset pipeline (issue #16)."""
import json
import tempfile
import unittest
from pathlib import Path

from prepare_hf_forge_dataset import prepare, canonical, sha256_str
from publish_hf_forge_dataset import validate_forge_snapshot


def make_turn(run_id: str, turn_index: int, prev_hash: str, entry_hash: str) -> dict:
    return {
        "schema_version": "forge-trajectory.v1",
        "run_id": run_id,
        "turn_index": turn_index,
        "entry_sha256": entry_hash,
        "previous_sha256": prev_hash,
        "status": "accepted" if turn_index < 3 else "terminal",
        "predicted_action": {"action_type": "select", "target_ref": "route.a"},
        "submitted_action": {"action_type": "select", "target_ref": "route.a"},
        "accepted": True,
        "observation": {
            "turn_index": turn_index,
            "state_summary": f"Turn {turn_index}",
            "available_actions": ["route.a", "route.b"],
            "observation_evidence_sha256": "e" * 64,
        },
        "policy_revision_sha256": "f" * 64,
        "recorded_at_epoch": 1000 + turn_index,
    }


def make_ledger(path: Path, turns: list[dict]) -> None:
    path.write_text("".join(canonical(t) + "\n" for t in turns), encoding="utf-8")


class PrepareForgeDatasetTest(unittest.TestCase):
    def test_snapshot_is_created_with_manifest_and_episodes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "ledger.jsonl"
            turns = [
                make_turn("run-001", 0, "0" * 64, "a" * 64),
                make_turn("run-001", 1, "a" * 64, "b" * 64),
                make_turn("run-002", 0, "0" * 64, "c" * 64),
            ]
            make_ledger(ledger, turns)
            out = root / "out"
            manifest = prepare(ledger, out)
            self.assertEqual(manifest["total_turn_count"], 3)
            self.assertEqual(manifest["episode_count"], 2)
            self.assertEqual(len(manifest["manifest_sha256"]), 64)
            self.assertTrue((out / "data" / "turns.jsonl").is_file())
            self.assertTrue((out / "data" / "episodes.jsonl").is_file())
            self.assertTrue((out / "dataset_manifest.json").is_file())

    def test_no_rights_record_quarantines_all_turns(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "ledger.jsonl"
            make_ledger(ledger, [make_turn("run-001", 0, "0" * 64, "a" * 64)])
            manifest = prepare(ledger, root / "out")
            self.assertEqual(manifest["exported_turn_count"], 0)
            self.assertEqual(manifest["quarantined_turn_count"], 1)
            self.assertFalse(manifest["public_release_allowed"])

    def test_rights_record_allowing_public_release_exports_turns(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "ledger.jsonl"
            make_ledger(ledger, [make_turn("run-001", 0, "0" * 64, "a" * 64)])
            rights = {
                "schema_version": "forge-publication-rights.v1",
                "policy_terms_urls": ["https://forgeai.gg/terms"],
                "observed_last_updated_dates": ["2026-09-20"],
                "evidence_snapshot_hashes": ["d" * 64],
                "review_date": "2026-09-20",
                "category_permissions": [
                    {
                        "category": "forge_observations_state",
                        "allowed_local_use": True,
                        "allowed_private_hf_upload": True,
                        "allowed_public_redistribution": True,
                        "allowed_model_training": True,
                        "attribution_notice_required": True,
                        "explicit_permission_ref": "forge-support-001",
                    },
                ],
                "reviewer_confirmation": "owner-confirmed",
                "created_at_epoch": 5000,
                "record_sha256": "e" * 64,
            }
            manifest = prepare(ledger, root / "out", rights_record=rights)
            self.assertEqual(manifest["exported_turn_count"], 1)
            self.assertEqual(manifest["quarantined_turn_count"], 0)
            self.assertTrue(manifest["public_release_allowed"])

    def test_duplicate_entry_hash_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "ledger.jsonl"
            turns = [
                make_turn("run-001", 0, "0" * 64, "a" * 64),
                make_turn("run-001", 1, "a" * 64, "a" * 64),  # dup hash
            ]
            make_ledger(ledger, turns)
            with self.assertRaisesRegex(ValueError, "duplicate"):
                prepare(ledger, root / "out")

    def test_non_monotonic_turn_index_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "ledger.jsonl"
            turns = [
                make_turn("run-001", 2, "0" * 64, "a" * 64),
                make_turn("run-001", 0, "a" * 64, "b" * 64),
            ]
            make_ledger(ledger, turns)
            manifest = prepare(ledger, root / "out")
            self.assertTrue(any("non-monotonic" in issue for issue in manifest["data_quality_issues"]))

    def test_publisher_revalidates_snapshot_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "ledger.jsonl"
            make_ledger(ledger, [make_turn("run-001", 0, "0" * 64, "a" * 64)])
            out = root / "out"
            prepare(ledger, out)
            # Tamper with turns.jsonl
            turns_path = out / "data" / "turns.jsonl"
            turns_path.write_text(turns_path.read_text(encoding="utf-8") + "{}\n", encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, "turns.jsonl SHA-256"):
                validate_forge_snapshot(out)

    def test_manifest_hash_tamper_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "ledger.jsonl"
            make_ledger(ledger, [make_turn("run-001", 0, "0" * 64, "a" * 64)])
            out = root / "out"
            prepare(ledger, out)
            manifest_path = out / "dataset_manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["exported_turn_count"] = 999
            manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, "manifest SHA-256"):
                validate_forge_snapshot(out)

    def test_data_quality_issues_block_publication(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "ledger.jsonl"
            turns = [
                make_turn("run-001", 2, "0" * 64, "a" * 64),
                make_turn("run-001", 0, "a" * 64, "b" * 64),
            ]
            make_ledger(ledger, turns)
            out = root / "out"
            prepare(ledger, out)
            with self.assertRaisesRegex(SystemExit, "Data quality"):
                validate_forge_snapshot(out)


if __name__ == "__main__":
    unittest.main()
