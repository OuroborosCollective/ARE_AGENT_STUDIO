# ForgeAI Integration Design Spec

> Durable design specification for the ARE × ForgeAI integration.
> This document is the recovery point for any agent that needs to reconstruct the intended integration without guessing.
> Status: **PLANNED** — no Forge runtime, public trajectory data, or verified Forge results exist yet.

## Purpose

Turn ARE Agent Studio into a real ForgeAI participant without weakening the existing evidence model. ARE must be able to run as an external ForgeAI agent, record each externally authoritative turn, learn only from completed runs, produce revision-bound policy artifacts, and publish only legally/contractually permitted learning data to Hugging Face.

## Control planes

### Visual-control plane (existing, frozen)

- Input: browser-captured frame → 4×4 luminance feature vector (16 dimensions).
- Policy: deterministic-seed MLP (16→32→16→4).
- Dataset schema: `are-agent-vla.v1` — must not be semantically changed by Forge work.
- Protected modules: `frontend/services/neuralPolicyEngine.ts`, `frontend/services/datasetCodec.ts`, `frontend/services/serverSyncGateway.ts`, `frontend/services/receiptVerifier.ts`.
- A static guard (`scripts/forge_truth_guard.mjs`) enforces isolation.

### Structured-control plane (planned, ForgeAI)

- A separate versioned policy contract for structured/text-based agent control.
- Uses a new schema (e.g. `forge-trajectory.v1`), never `are-agent-vla.v1`.
- Actions are typed structured commands submitted to the Forge action client, not pixel-space taps.
- The structured policy may not import or mutate visual-path modules.

## Forge external authority

- ForgeAI is the external game/evaluation authority. ARE records and reconciles Forge results.
- ARE never fabricates Forge success from local predictions.
- Prediction ≠ submitted action. Submitted action ≠ accepted Forge turn.
- Score/replay metadata from Forge is stored as external evidence, not regenerated locally.
- Local trajectory ≠ externally verified trajectory until independent Forge readback reconciles it.

## Dedicated non-public Forge runner

- A dedicated Forge runner lives outside the public HF Space runtime, preferably on a VPS.
- It reads the run-scoped Forge contract, keeps run state, submits only allowed actions, keeps credentials server-side, and writes an ARE-owned append-only trajectory ledger.
- The runner is restart-safe: run state persists across crashes and resumes without duplicating or losing turns.
- The public HF Space must not serve as the Forge runner.

## Append-only trajectory/evidence plane

- Each externally authoritative turn is recorded in an append-only trajectory ledger.
- The ledger uses a hash chain: each entry includes the SHA-256 of the previous entry.
- Tamper detection: any modification to a past entry breaks the chain.
- Receipts are issued per accepted turn and verified before counting.
- Forge-owned/raw content is quarantined from public export until its redistribution basis is explicit.

## Terminal-run-only learning (v1)

- Learning from a run happens only after the run is terminal and immutable.
- A completed run is immutable input to a later policy revision.
- Mid-run self-training must not blur which policy produced a benchmark result.
- Owner/human corrections are separate evidence records and never rewrite the historical action actually taken.

## Rights/publication gate

- Public dataset publication is fail-closed when rights/terms are uncertain.
- Hugging Face receives revision-bound datasets/model artifacts only after publication-rights checks.
- Forge-owned/raw content is quarantined from public export until its redistribution/training-publication basis is explicit.
- A separate Hugging Face Forge-trajectory dataset pipeline with immutable manifests is planned.

## Practice-vs-paid run boundary

- Practice-run automation must never silently become paid-entry automation.
- Anything paid stays explicitly human-approved in the Forge UI/contract.
- The runner must distinguish practice runs from paid entries and never escalate without explicit consent.

## Responsibility matrix

| Entity | Role |
|---|---|
| **GitHub (main)** | Canonical source. All changes arrive through PRs with tests. |
| **Hugging Face** | Publication target for revision-bound datasets and model artifacts. Not a code authority. |
| **Google AI Studio** | Development accelerator. May assist with UI/code but cannot bypass PR/regression/evidence gates. Changes arrive through branches/PRs. |
| **VPS** | Hosts the dedicated Forge runner. Isolated from the public HF Space. Keeps credentials server-side. |
| **ForgeAI** | External game/evaluation authority. ARE records and reconciles; never fabricates. |

## Secret ownership and prohibited locations

Secrets (Forge API keys, credentials, tokens) must never appear in:
- Git (any branch, any file)
- Hugging Face datasets or model artifacts
- Public prompts or browser storage
- `Memory.md` or `AGENTS.md`
- Screenshots
- Public metrics endpoints

Secrets are kept server-side on the VPS runner or delivered via platform-managed env files.

## Canonical status vocabulary

| Status | Meaning |
|---|---|
| **OBSERVED** | Directly captured from a real runtime source. |
| **DERIVED** | Computed from observed data via a deterministic function. |
| **VERIFIED** | Independently reconciled against an external authority (Forge readback). |
| **PARTIAL** | Some evidence exists but the chain is incomplete. |
| **UNOBSERVABLE** | The value cannot be captured from any available source. |
| **UNPROVABLE** | The claim cannot be confirmed or denied with available evidence. |
| **REJECTED** | Evidence was checked and the claim is false. |

## Forbidden cross-project authority leakage

- Aurion/WASD/Sovereign are NOT execution authorities for this integration.
- No code, config, or documentation from other OuroborosCollective projects may be imported as authority.
- Each project's evidence model is independent.

## Verification gates

- `scripts/forge_truth_guard.mjs` — static guard: fails if forge-related files import or mutate the visual policy/dataset path.
- `scripts/forge_secret_scan.mjs` — security gate: scans forge files and build output for credential/secret patterns.
- `scripts/forge_contract_drift_guard.mjs` — contract-drift gate: verifies expected schema versions and exports exist in their modules.
- `scripts/truth_scan.mjs` — existing guard: fails if prototype evidence fallbacks appear in production paths.
- Full CI (`.github/workflows/ci.yml`) runs backend tests, frontend tests, typecheck, build, truth scan, forge guard, forge secret scan, contract-drift guard, forge runner tests, forge dataset tests, HF tests, and Docker packaging.

## Implementation issue map

| Issue | Title | Status |
|---|---|---|
| #7 | Freeze canonical architecture, AI Studio boundary & agent instructions | This issue |
| #8 | Versioned structured-control policy contract | Implemented |
| #9 | ForgeAI contract discovery, SKILL.md parsing, credential isolation & action client | Implemented |
| #10 | Append-only Forge trajectory ledger, receipts & tamper detection | Implemented |
| #11 | Durable VPS Forge runner with restart-safe run state machine | Implemented |
| #12 | Independent terminal trajectory reconciliation against ForgeAI readback | Implemented |
| #13 | Terminal-run-only offline learning & DAgger-style correction for structured trajectories | Implemented |
| #14 | Reproducible training/evaluation receipts & HF model artifact lane | Implemented |
| #15 | ForgeAI rights/terms publication gate before public trajectory release | Implemented |
| #16 | Separate HF Forge-trajectory dataset pipeline with immutable manifests | Implemented |
| #17 | Google AI Studio + Firebase/Firestore/Cloud SQL as optional support planes | Implemented (docs/GOOGLE_SUPPORT_PLANES.md) |
| #18 | Forge Control Room UI/readmodels with strict verified-vs-derived status semantics | Implemented |
| #19 | CI, contract-drift, security & exact-head release gates for Forge integration | Implemented |
| #20 | Qualification run: first real Forge practice benchmark | Blocked (no practice run available) |
