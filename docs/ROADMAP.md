# ARE Agent Studio Roadmap

This roadmap deliberately separates planned capability from the active runtime.

## Next evidence milestone: closed-loop Android execution

Goal: prove `prediction → requested ADB action → device acknowledgement → post-action observation` as one correlated chain.

- bind each action request to a unique action receipt ID;
- record target revision/runtime identity and privacy-safe device identity;
- capture a post-action frame after a defined observation delay;
- link pre-frame, policy output, ADB acknowledgement, and post-frame by one receipt;
- add device-backed regression scenarios without treating emulator fixtures as physical-device proof.

## Policy v2: real spatial + temporal vision

The current 4×4 luminance MLP is intentionally small. A future model lane can add:

- CNN/ViT visual encoder;
- temporal frame window or recurrent/transformer state;
- observed multi-step action chunks assembled from episode sequences;
- uncertainty/calibration output used to request human correction;
- exported model card bound to dataset revision + training configuration + evaluation receipt.

The v2 model should live behind the same dataset/action contracts so the Studio can compare policies without rewriting evidence boundaries.

## Dataset v2

- immutable named snapshots bound to Hub commit SHA;
- explicit source/game/title/content-rights metadata;
- train/validation/test split policy at episode level to prevent frame leakage across splits;
- optional exact-frame dedupe plus side-channel perceptual similarity analysis;
- session/episode statistics and correction density;
- data-quality reports generated from source rows, never hardcoded dashboards;
- privacy/redaction review lane before public eligibility;
- quarantine state for rows whose publication basis or source rights become uncertain.

## Active learning

Turn DAgger into a real acquisition policy:

1. policy emits calibrated uncertainty;
2. high-uncertainty states are queued for human review;
3. correction is bound to the exact observation and prediction;
4. new model training consumes only accepted corrections;
5. before/after evaluation uses a frozen replay set.

## Reproducible training

- deterministic training seed;
- immutable input dataset manifest;
- exact code revision;
- pinned environment/container digest;
- training config hash;
- output weights hash;
- evaluation manifest;
- Hugging Face model repository per released policy family.

## Evidence-backed public metrics and commerce

The public site can show only values derived from canonical ledgers. Before any production checkout or usage ledger is enabled:

- bind a public metrics deployment to a reviewed backend revision and a durable ledger volume;
- preserve the distinction between test fixtures, local records, authenticated evaluator records, and independently reviewed device readbacks;
- create the Hugging Face project before publishing its link; do not imply public availability from local export tooling;
- issue and reconcile checkout receipts in a dedicated payment service; keep PayPal/crypto credentials outside the browser and this data daemon;
- design a separately consented OpenRouter execution-fee ledger with provider receipts, user-visible spend limits, and explicit authorization per charge.

No future commerce integration may infer permission to train on, publish, or execute against customer data.

## Public/community collection

Do not turn the public Space's ephemeral filesystem into the collection backend. A community path should add:

- authenticated collector identities;
- durable object storage for frames;
- append-only metadata store;
- rate/size quotas;
- content-rights acknowledgement;
- moderation/quarantine before public release;
- signed or server-verifiable receipts returned to contributors;
- dataset snapshot generation from the durable canonical store.

## Benchmarking

Create frozen replay packs from redistributable or internally authorized video sources. Measure separately:

- vision/policy latency;
- action coordinate error;
- touch-state accuracy;
- sequence consistency;
- DAgger correction rate;
- device action acknowledgement latency;
- closed-loop task outcome where the game exposes a legitimate observable success signal.

Never collapse these into one synthetic "agent score" without a defined derivation.

## Capture transports

- browser display capture remains the universal baseline;
- add an explicit local Android capture bridge for ADB/scrcpy frames;
- optionally add WebRTC for low-latency remote collectors;
- advertise only transport formats actually decoded by the active capture implementation.

## Privacy and rights

Before a broad public dataset launch, add a review surface that can flag or redact notifications, account identifiers, chat, email, payment data, faces, and other sensitive overlays. Keep raw private evidence and publishable derivatives as separate artifacts with separate hashes.
