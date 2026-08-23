#!/usr/bin/env python3
import base64
import json
import tempfile
import unittest
from pathlib import Path
from prepare_hf_dataset import canonical, expected_sample_id, prepare
from publish_hf_dataset import validate_snapshot


def row(allowed: bool, ts: int):
    payload = {
        "schema_version": "are-agent-vla.v1",
        "sample_id": "placeholder",
        "source": "human_demo",
        "instruction": "demo",
        "input_frame_base64": "data:image/png;base64," + base64.b64encode(b"0123456789abcdef0123456789abcdef").decode(),
        "genre": "FPS",
        "genre_criteria": {},
        "state_vector": [0, 0, 0, 0, 1, 0],
        "state_mask": [0, 0, 0, 1, 1, 1],
        "observation_metadata": {"hp_source": "unknown", "mana_source": "unknown", "enemies_source": "unknown"},
        "publication": {"allowed": allowed, "basis": "user_confirmed" if allowed else "unreviewed"},
        "target_action_chunk": [[0.25, 0.75, 0.5, 1]],
        "tactical_reasoning": "",
        "feature_vector": [0.5] * 16,
        "action_metadata": {"event_type": "TOUCH_DOWN", "duration_ms": 0, "is_correction": False},
        "client_metadata": {"client_id": "test", "device_model": "test", "timestamp_epoch": ts, "frame_id": ts, "session_id": "session-a", "sequence_index": ts},
    }
    payload["sample_id"] = expected_sample_id(payload)
    return payload


class PrepareDatasetTest(unittest.TestCase):
    def test_only_approved_rows_are_exported_and_manifest_is_hashed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "telemetry.jsonl"
            ledger.write_text(canonical(row(True, 1)) + "\n" + canonical(row(False, 2)) + "\n", encoding="utf-8")
            manifest = prepare(ledger, root / "out")
            self.assertEqual(manifest["selected_rows"], 1)
            self.assertEqual(manifest["skipped_unreviewed_rows"], 1)
            self.assertEqual(len(manifest["manifest_sha256"]), 64)
            records = (root / "out/data/train.jsonl").read_text().splitlines()
            self.assertEqual(len(records), 1)
            exported = json.loads(records[0])
            self.assertNotIn("input_frame_base64", exported)
            self.assertTrue((root / "out" / exported["image"]).is_file())
            episodes = [json.loads(line) for line in (root / "out/data/episodes.jsonl").read_text().splitlines()]
            self.assertEqual(episodes[0]["session_id"], "session-a")
            self.assertEqual(episodes[0]["sample_ids"], [exported["sample_id"]])

    def test_tampered_sample_identity_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bad = row(True, 1)
            bad["sample_id"] = "0" * 64
            ledger = root / "telemetry.jsonl"
            ledger.write_text(canonical(bad) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "sample_id"):
                prepare(ledger, root / "out")

    def test_publisher_revalidates_snapshot_files_before_upload(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "telemetry.jsonl"
            ledger.write_text(canonical(row(True, 1)) + "\n", encoding="utf-8")
            out = root / "out"
            prepare(ledger, out)
            self.assertEqual(validate_snapshot(out)["selected_rows"], 1)
            train = out / "data" / "train.jsonl"
            train.write_text(train.read_text(encoding="utf-8") + "{}\n", encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, "train.jsonl SHA-256"):
                validate_snapshot(out)

    def test_duplicate_sequence_index_in_one_public_episode_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            first = row(True, 1)
            second = row(True, 2)
            second["client_metadata"]["sequence_index"] = first["client_metadata"]["sequence_index"]
            second["sample_id"] = expected_sample_id(second)
            ledger = root / "telemetry.jsonl"
            ledger.write_text(canonical(first) + "\n" + canonical(second) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "duplicate sequence_index"):
                prepare(ledger, root / "out")

    def test_public_row_requires_user_confirmed_basis(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bad = row(True, 1)
            bad["publication"] = {"allowed": True, "basis": "unreviewed"}
            bad["sample_id"] = expected_sample_id(bad)
            ledger = root / "telemetry.jsonl"
            ledger.write_text(canonical(bad) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "user_confirmed"):
                prepare(ledger, root / "out")


if __name__ == "__main__":
    unittest.main()
