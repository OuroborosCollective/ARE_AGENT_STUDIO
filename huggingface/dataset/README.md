---
pretty_name: ARE Agent Studio VLA Demonstrations
task_categories:
- robotics
tags:
- vision-language-action
- robotics
- android
- human-demonstrations
- dagger
- provenance
---

![ARE Agent Studio — Signal Control Room](assets/are-signal-hero.png)

# ARE Agent Studio VLA Demonstrations

> **SIGNAL CONTROL ROOM** · Publication-approved human demonstrations with provenance, not synthetic showcase data

This Dataset Card describes the private provenance repository for a future **ARE Agent Studio** release. It does **not** assert that any raw samples have been publicly released or that an APK is available.

When a dataset release is actually published, the release record must name the exact Hub repository and revision and bind them to the `dataset_manifest.json` SHA-256. Do not replace this statement with a guessed or placeholder Hub URL.

## Publication boundary

The public export pipeline includes **only rows marked `publication.allowed=true` with `publication.basis=user_confirmed` at capture time**. Recording a sample locally does not imply permission to publish it. Operators remain responsible for having appropriate rights to distribute captured game imagery and other content.

| Signal lane | Required evidence before a Hub release |
| --- | --- |
| **Capture** | A complete visible frame and an observed human action are paired locally. |
| **Consent** | The individual row carries explicit `publication.allowed=true` and `publication.basis=user_confirmed`. |
| **Snapshot** | The builder creates JSONL, episodes, decoded frames, and a manifest with SHA-256 values. |
| **Publish** | The publisher re-hashes the snapshot immediately before upload and refuses an empty or manipulated export. |

The artwork above is a project visual identity. It is not a captured frame, a device readback, a benchmark visualisation, or a sample contained in a dataset snapshot.

## Schema

The current schema is `are-agent-vla.v1`. The snapshot also contains `data/episodes.jsonl`, which groups approved samples by capture session without inventing missing steps. Important fields include `image`, `source` (`human_demo` or `dagger_correction`), normalized `target_action_chunk`, a 16-dimensional observed visual feature vector when available, state values plus `state_mask`, action metadata, client metadata, and publication metadata.

Unknown state values are represented by a neutral numeric placeholder **only together with `state_mask=0`**; they must not be interpreted as observed zeros.

## Provenance

The export contains `dataset_manifest.json`, including the SHA-256 of the source append-only ledger, the exported JSONL, every decoded frame, and the manifest itself. The local dataset daemon independently content-addresses samples and returns a receipt when rows are accepted.

## Intended use

Research and prototyping around behavioral cloning, DAgger-style human correction, visual control policies, dataset tooling, and reproducible agent evaluation. The dataset does not claim that an action was executed on Android merely because it appears as a policy prediction; device execution is a separate ADB-acknowledged path in ARE Agent Studio.

## Access and non-claims

This source card supplies no raw-dataset download URL, APK download, automatic-action success count, or performance claim. The private provenance repository is not linked as a public dataset release; direct dataset retrieval is never served by the ARE public metrics endpoint. Access settings, license selection, and release visibility must be decided by the repository owner for the published snapshot, not inferred from this card.

## License note

No dataset license is asserted by the automation. The repository owner must select a license compatible with the rights in the captured imagery before the first public release.
