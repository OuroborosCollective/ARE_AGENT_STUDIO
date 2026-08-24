# Dataset contract

## Schema

Current row schema: `are-agent-vla.v1`.

A canonical row contains:

- `sample_id` — server-derived SHA-256 content identity;
- `source` — `human_demo` or `dagger_correction`;
- `input_frame_base64` — complete PNG/JPEG/WebP data URL in the local ledger;
- `feature_vector` — optional 16-element visual feature vector;
- `target_action_chunk` — currently exactly the observed action, never an invented future horizon;
- `state_vector` and `state_mask` — numeric state representation plus observed/unknown mask;
- `observation_metadata` — provenance class for optional state values;
- `action_metadata` — event type, measured duration, correction flag;
- `client_metadata` — collector/client/device/timestamp/frame identifiers plus `session_id` and `sequence_index`;
- `publication` — explicit public-export decision.

## Action encoding

```text
[x, y, pressure, touch]
```

All values are normalized to `[0,1]`. `TOUCH_DOWN` and `TOUCH_MOVE` use `touch=1`; `TOUCH_UP` uses `touch=0`.

## Unknown values

A numeric zero can be a real measurement or a placeholder for an unknown field. The `state_mask` removes that ambiguity:

- mask `1` — corresponding state value was observed by an identified detector/source;
- mask `0` — value is unknown and the numeric slot is only a neutral placeholder.

## Sample identity

The dataset daemon derives `sample_id` from canonical JSON over:

```text
schema_version
source
SHA256(full frame data URL)
target_action_chunk
timestamp_epoch
client_id
```

The identity also binds `session_id` and `sequence_index`, so sequence provenance cannot be silently moved between episodes. The client-provided placeholder is never trusted as canonical identity.

## Receipt

Successful append returns `are-agent-receipt.v1` with requested/accepted/duplicate counts, accepted sample IDs, ledger SHA-256, and receipt SHA-256. The receipt SHA is calculated over the canonical receipt body excluding `receipt_sha256` itself.

## Append-only behavior

The daemon revalidates the existing ledger on startup. Invalid JSON, an invalid row, duplicate persisted sample IDs, or a sample identity that does not match row content prevents that ledger from being treated as trusted.

Concurrent appends are serialized so two collectors cannot both accept the same unseen sample in a race.

## Hugging Face snapshot

The public snapshot changes frame representation:

```text
input_frame_base64 → frames/<sample_id>.<ext>
                      + image path in train.jsonl
                      + frame_sha256
```

`dataset_manifest.json` binds:

- original ledger SHA-256;
- exported row count;
- skipped-unreviewed count;
- `train.jsonl` SHA-256;
- every exported frame SHA-256;
- the canonical manifest body SHA-256.

The publisher revalidates those values immediately before upload.

## Episode index

The HF snapshot also writes `data/episodes.jsonl`. Each record groups only actually exported samples by `session_id`, preserving the original `sequence_index` values and timestamps. Gaps are allowed because a session may contain local-only rows that were not approved for publication; duplicate sequence indices inside one public episode are rejected rather than guessed into an order.

This index is intended for future temporal policies and action-chunk assembly without fabricating intermediate actions.
