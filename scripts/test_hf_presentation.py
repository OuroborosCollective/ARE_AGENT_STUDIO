#!/usr/bin/env python3
"""Regression checks for truthful Hugging Face presentation assets and cards."""

import base64
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from prepare_hf_dataset import canonical, expected_sample_id, prepare


ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / "assets" / "are-signal-hero.png"
SPACE_CARD = ROOT / "huggingface" / "space" / "README.md"
DATASET_CARD = ROOT / "huggingface" / "dataset" / "README.md"


class HuggingFacePresentationTest(unittest.TestCase):
    def test_shared_signal_artwork_exists_and_is_not_a_dataset_frame(self):
        self.assertTrue(ASSET.is_file())
        self.assertGreater(ASSET.stat().st_size, 1024)
        asset_note = (ROOT / "assets" / "README.md").read_text(encoding="utf-8")
        self.assertIn("does not depict a captured gameplay frame", asset_note)
        self.assertIn("not a training row", asset_note)

    def test_cards_share_the_real_local_asset_and_do_not_invent_a_hub_release(self):
        for card in (SPACE_CARD, DATASET_CARD):
            text = card.read_text(encoding="utf-8")
            self.assertIn("assets/are-signal-hero.png", text)
            self.assertNotIn("https://huggingface.co/datasets/", text)
            self.assertNotIn("https://huggingface.co/spaces/Thorsu/ARE-Agent-Studio", text)
        self.assertIn("does **not** claim that a public Space", SPACE_CARD.read_text(encoding="utf-8"))
        self.assertIn("not proof that a public dataset repository exists", DATASET_CARD.read_text(encoding="utf-8"))

    def test_space_packaging_preflight_requires_the_presentation_asset(self):
        result = subprocess.run(
            [sys.executable, "scripts/publish_hf_space.py", "--repo-id", "local/ci-preflight", "--dry-run"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn("ready: local/ci-preflight (Docker Space)", result.stdout)

    def test_dataset_publisher_dry_run_keeps_card_and_artwork_as_required_inputs(self):
        frame = base64.b64encode(b"0123456789abcdef0123456789abcdef").decode()
        row = {
            "schema_version": "are-agent-vla.v1",
            "sample_id": "placeholder",
            "source": "human_demo",
            "instruction": "presentation regression fixture",
            "input_frame_base64": f"data:image/png;base64,{frame}",
            "genre": "FPS",
            "genre_criteria": {},
            "state_vector": [0, 0, 0, 0, 1, 0],
            "state_mask": [0, 0, 0, 1, 1, 1],
            "observation_metadata": {"hp_source": "unknown", "mana_source": "unknown", "enemies_source": "unknown"},
            "publication": {"allowed": True, "basis": "user_confirmed"},
            "target_action_chunk": [[0.25, 0.75, 0.5, 1]],
            "tactical_reasoning": "",
            "feature_vector": [0.5] * 16,
            "action_metadata": {"event_type": "TOUCH_DOWN", "duration_ms": 0, "is_correction": False},
            "client_metadata": {"client_id": "test", "device_model": "test", "timestamp_epoch": 1, "frame_id": 1, "session_id": "presentation", "sequence_index": 0},
        }
        row["sample_id"] = expected_sample_id(row)
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Path(tmp)
            ledger = fixture / "telemetry.jsonl"
            ledger.write_text(canonical(row) + "\n", encoding="utf-8")
            output = fixture / "snapshot"
            prepare(ledger, output)
            result = subprocess.run(
                [
                    sys.executable,
                    "scripts/publish_hf_dataset.py",
                    "--repo-id",
                    "local/presentation-preflight",
                    "--folder",
                    str(output),
                    "--dry-run",
                ],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ready"])
        self.assertEqual(payload["repo_id"], "local/presentation-preflight")


if __name__ == "__main__":
    unittest.main()
