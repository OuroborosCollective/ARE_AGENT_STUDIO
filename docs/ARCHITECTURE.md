# ARE Agent Studio Architecture

## Architectural objective

ARE Agent Studio is a human-demonstration → imitation-policy → correction → verified-dataset loop. Its key design rule is that every claim is attached to the layer that can actually prove it.

## Runtime planes

### 1. Observation plane

`DeviceCanvas` captures pixels from a browser-supported source and derives a 16-dimensional 4×4 luminance feature vector. It also measures luminance and frame-to-frame motion. It does not infer HP, mana, enemy count, or game success unless a future detector explicitly provides evidence for those fields.

### 2. Human-action plane

Pointer events become normalized `TouchAction` records with coordinates, pointer pressure, event type, and measured pointer duration. These actions are labels. They are never fed back into the image feature vector that is supposed to predict them.

### 3. Policy plane

The active browser policy is a deterministic-seed MLP:

```text
16 image features → 32 → 16 → 4 outputs
                         ├ x
                         ├ y
                         ├ pressure
                         └ touch probability
```

Initialization is seeded. Model export records architecture, seed, weights, and trained-batch count. Training consumes only frame-bound observed pairs.

### 4. DAgger correction plane

When the agent is running and a human takes over, the policy prediction and corrected human action are recorded separately. Immediate/fine-tune training requires the frame feature vector that was observed for that correction. Historical intervention cards without observation evidence do not become training samples.

### 4a. Operation-correction learning side channel

Operational agent proposals can be labelled by an owner as `approve`, `reject`, or `amend`, but only as non-executing evidence. Each correction binds opaque parameter, policy-revision, and observation-evidence hashes; the record is rejected unless it says `execution_state: "not_executed"`. Opting a record into offline learning is a second, owner-confirmed choice.

The resulting deterministic candidate projection is review material with `execution_authority: "none"`. It cannot change routing, permissions, policy weights, or external systems. See `OPERATION_CORRECTION_LEARNING.md`.

### 5. Dataset truth plane

`telemetryToDatasetRows()` serializes only complete frame/action pairs. The Node daemon independently:

1. recomputes the content identity;
2. validates schema/data URL/action/state/publication metadata;
3. serializes concurrent writes;
4. de-duplicates by sample identity;
5. appends canonical JSON to `telemetry.jsonl`;
6. computes the ledger SHA-256;
7. appends a canonical receipt to `receipts.jsonl`.

The browser re-computes and verifies the receipt SHA-256 before treating the operation as accepted.

### 6. Publication plane

Public-HF eligibility is separate from local collection. The Python snapshot builder selects only rows with:

```json
{"publication":{"allowed":true,"basis":"user_confirmed"}}
```

It re-checks sample identities, decodes frames, removes inline base64 from the exported JSONL, hashes every frame and file, and emits a manifest. The publisher verifies the snapshot a second time immediately before upload.

### 7. Device-effect plane

Prediction does not equal execution. Android output requires:

- backend `ENABLE_ADB_BRIDGE=true`;
- optional serial allowlist match;
- configured connected device metadata in the UI;
- agent running;
- output explicitly armed;
- sufficient policy confidence;
- successful backend ADB acknowledgement.

The bridge invokes `adb` with fixed argument arrays and no shell interpolation.

### 8. Advisory plane

An optional server-side OpenAI-compatible endpoint can analyze an image or propose tactical rule candidates. Advisory output:

- is not observation evidence;
- does not fill unknown state fields;
- does not create dataset actions;
- fails closed if configuration/provider/JSON validation fails.

### 9. Public-metrics and pricing plane

The public website consumes only `GET /api/v1/public/metrics`. That endpoint aggregates counts and hashes; it never returns frame data, action targets, raw dataset JSONL, operation corrections, or candidate projections.

The evidence-gated price is derived, not manually typed:

```text
price_cents = 425 + 100 × floor(verified_device_readback_actions / 15)
```

Only authenticated append-only records containing an action command hash, policy revision hash, before/after observation hashes, action receipt hash, device-readback hash, and independent-evidence hash are countable. Unit tests, browser predictions, and claimed outcomes do not count. Direct dataset exports are disabled by default.

## Important separations

```text
buffered locally ≠ accepted by daemon
accepted by daemon ≠ approved for publication
policy predicted ≠ action executed
ADB request sent ≠ device success unless acknowledged
advisory suggestion ≠ observed game fact
fixture test passed ≠ live Android verified
HF Space running ≠ durable dataset persistence
owner correction recorded ≠ permission to learn
offline learning candidate ≠ runtime authorization
test assertion passed ≠ verified imitation action
policy prediction ≠ device-readback reproduction
```

These inequalities are product contracts, not documentation niceties.
