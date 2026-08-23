# Human-Correction Learning for Agent Operations

## Scope

This lane transfers one narrow DAgger-style idea into agent operations:

```text
typed proposal + bound observation evidence
        ↓
owner labels: approve / reject / amend
        ↓
append-only correction receipt
        ↓
owner-consented offline candidate projection
        ↓
separate review before any policy or routing change
```

It is intentionally **not** an action executor, consent substitute, or live policy updater.

## Record contract

`are-agent-operation-correction.v1` binds a correction to:

- `context`: session, sequence index, optional mission and attempt references;
- `proposal`: operation type, opaque target reference, parameter hash, policy-revision hash, observation-evidence hash, requested time, and risk tier;
- `correction`: owner reference, decision, reason code, optional non-secret rationale, optional amended action summary plus amended parameter hash;
- `learning`: a separate per-record owner-confirmation switch.

Raw parameters are not stored. The proposal must state `execution_state: "not_executed"`; a record claiming requested, successful, failed, or otherwise executed effects is rejected.

The daemon derives both `proposal_sha256` and `correction_id` from canonical JSON. Client placeholders are never authoritative. It revalidates every persisted record at startup and rejects invalid JSON, duplicate correction identities, incorrect hashes, malformed consent, or any effect claim.

## Consent boundary

Recording an owner correction and allowing it to participate in an offline learning projection are separate choices.

```text
recorded correction             ≠ permission to learn from it
owner-confirmed learning row    ≠ active policy update
candidate projection            ≠ authorization to execute
approval label                  ≠ standing authority
receipt                          ≠ proof of external effect
```

The UI defaults to **Reject** and learning disabled. Its action preview shows `not_executed` as a fixed field. A user may opt one correction into candidate generation, but there is no “always allow,” background retraining, or direct mutation of an agent runtime.

## Candidate projection

`GET /api/v1/operation-corrections/candidates` deterministically groups only rows with:

```json
{"learning":{"allowed":true,"basis":"owner_confirmed"}}
```

by exact operation type, risk tier, owner decision, reason code, and optional amended-action/parameter-hash fields. Each result includes the source-ledger hash, ordered contributing correction IDs, a content-addressed candidate ID, and the invariant:

```json
{"execution_authority":"none","status":"candidate_only"}
```

This is a review projection. A future system may create a separately versioned routing or permission policy from selected candidates, but that change needs its own owner consent, code revision, test evidence, and runtime readback.

## API and hosted defaults

- `POST /api/v1/operation-corrections/push` accepts correction evidence only when `OPERATION_CORRECTION_WRITE_ENABLED=true`.
- `GET /api/v1/operation-corrections/stats` exposes count and ledger hash.
- `GET /api/v1/operation-corrections/export.jsonl` and `/candidates` require an authenticated operational configuration; they are not public website endpoints.
- Hosted Docker defaults `OPERATION_CORRECTION_WRITE_ENABLED=false`, alongside disabled dataset writes and ADB.

The correction ledger is intentionally not included in the public gameplay/VLA Hugging Face snapshot path. Operation feedback can contain sensitive operational context even when raw parameters are hashed; publication needs a dedicated rights, redaction, retention, and owner-approval design.

## Verification

Backend regressions prove:

- append-only, content-addressed, idempotent correction records;
- startup rejection of a tampered persisted identity;
- refusal of a non-`not_executed` proposal;
- refusal of `learning.allowed=true` without `owner_confirmed` basis;
- deterministic replay of candidate projections;
- real local HTTP receipt and candidate readback;
- hosted-style refusal while operation-correction writes are disabled.

These tests do not prove that any external agent action occurred, that a candidate should become a policy, or that a learning-derived policy is safe for deployment.
