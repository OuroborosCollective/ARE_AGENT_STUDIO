---
title: ARE Agent Studio
emoji: 🎮
colorFrom: cyan
colorTo: emerald
sdk: docker
app_port: 7860
pinned: false
---

![ARE Agent Studio — Signal Control Room](assets/are-signal-hero.png)

# ARE Agent Studio

> **SIGNAL CONTROL ROOM** · Human demonstration → evidence-bound sample → correction-aware policy research

This is the source card for a Docker-based Hugging Face Space. Publishing it does **not** claim a public dataset, an APK, or a measured autonomous result.

| Signal lane | Public Space boundary |
| --- | --- |
| **Observe** | Browser-visible frames and visual features are inputs to the Studio; an illustration is never a recorded frame. |
| **Teach** | Human actions can be recorded as labels and DAgger-style corrections when bound to observed features. |
| **Prove** | Dataset acceptance depends on an append-only ledger and a SHA-256 receipt, not on a UI animation. |
| **Execute** | Android output remains separately armed and acknowledged; a policy prediction is not a device action. |

## Public-mode guardrails

The public Space is intended for Studio, prediction, and data-tooling exploration. Its container configuration keeps shared dataset writes and ADB output disabled. A hosted Space is therefore neither an Android execution environment nor a durable collection backend.

- No browser key or provider secret is part of this card.
- No raw dataset rows, frames, action traces, operation-correction records, or candidates are exposed by this presentation surface.
- A future public contribution flow must use authentication and a durable, consent-aware collector outside ephemeral Space storage.

## Evidence status

This card deliberately displays no hard-coded dataset size, success rate, latency, automatic-action count, pricing total, or benchmark claim. Those values may be presented publicly only through the aggregate `/api/v1/public/metrics` endpoint after their underlying ledgers exist and validate. Tests, fixtures, drawings, and policy predictions never increase verified device-readback counts.

## Publication links

- **Source repository:** [OuroborosCollective/ARE_AGENT_STUDIO](https://github.com/OuroborosCollective/ARE_AGENT_STUDIO)
- **Hugging Face dataset:** A private provenance repository exists; it publishes no raw samples and no public download link. A public Hub dataset link will be added only after an explicitly publication-approved, hash-verified snapshot is published.
- **APK / checkout:** not configured here. This Space does not distribute an APK or process payments.

## Visual language

The Signal Control Room treatment uses dark glass, cyan observation paths, and emerald verified paths. It is an interface identity only: it must not be read as a telemetry visualisation, an execution trace, or a performance chart.

## Operator note

Before publishing, run the repository checks and set all hosted write controls to their secure defaults. The Docker image must keep `DATASET_WRITE_ENABLED=false`, `DATASET_EXPORT_ENABLED=false`, `OPERATION_CORRECTION_WRITE_ENABLED=false`, `VERIFIED_IMITATION_WRITE_ENABLED=false`, and `ENABLE_ADB_BRIDGE=false` unless an authenticated, explicitly approved deployment design replaces those defaults.
