# Memory.md — ARE Agent Studio

> Project-local, append-only integration memory for `OuroborosCollective/ARE_AGENT_STUDIO`.
> Historical bootstrap created 2026-09-09 from retrievable repository/conversation evidence.
> Do not mix this project with Sovereign Studio ATO, Arelorian WASD or Echoes of Aurion.

## Operating contract

1. Read this file before every N+1 integration work session.
2. Append exactly one entry after each completed work block and before merge.
3. Record task, decisions, touched surfaces, tests/evidence, learned result, open points and next safe step.
4. Append-only; corrections are new entries.
5. Human gameplay observation/correction is evidence only after explicit consent and accepted receipts.
6. LLM/VLM output is advisory unless a separately proven contract explicitly grants authority. It may not silently mutate policy weights, dataset truth or device execution.
7. Screen capture does not imply OS-level input capture.
8. No mock/stub/fake result may stand in for device, browser, dataset, payment or provider truth.
9. Secrets never belong in this file.

## Entry format

```text
### YYYY-MM-DD — short title
Status: VERIFIED | PARTIAL | BLOCKED | HISTORICAL
Task:
Decisions:
Touched surfaces:
Evidence:
Learned:
Open:
Next safe step:
```

---

### 2026-08-23 — Sanitized public project bootstrap
Status: HISTORICAL repository foundation
Task: Establish ARE Agent Studio as a clean public project for the human-observation → evidence → imitation-learning chain.
Decisions:
- Keep the repository public/sanitized without private environment history.
- Learning chain: real frame -> visual features -> human action -> evidence sample -> append-only ledger -> SHA-256 receipt -> behavior cloning -> prediction -> human correction/DAgger -> episode dataset.
- Separate this project from Sovereign Studio ATO and Arelorian WASD.
Touched surfaces: Public repository bootstrap, learning/evidence architecture.
Evidence: Historical project readback recorded public root/main ancestry around `326c7bd...` with a sanitized tree and no `.env.local` history.
Learned: A learning product is only as trustworthy as the provenance between observed human action and the sample that enters training.
Open: Current root history should be re-read before making claims from the historical bootstrap SHA.
Next safe step: Keep all future training records receipt-bound and distinguish product metrics from real training evidence.

### 2026-08-23 — Evidence-bound launch surfaces
Status: VERIFIED repository merge; some external runtime gates remained separate
Task: Build launch/marketing/studio surfaces without inflating evidence claims.
Decisions:
- Public metrics and early-adopter pricing are evidence-bound and deterministic.
- Human-Correction Learning is consent-bound and non-executing.
- Public surface exposes aggregate values/hashes only; raw dataset download remains disabled.
Touched surfaces: Signal Control Room Studio, marketing site, Hugging Face cards/dataset presentation.
Evidence:
- PR #2 merged; head `efdfd11408774189e38a7546125a33c001a71667`.
- Local evidence: backend 22/22, marketing 5/5, frontend truth guards 6 assertions, HF presentation 4 tests, HF dataset 5 tests, truth scan/Python compile/diff passed.
Learned: Marketing claims must inherit the same evidence boundary as the product; a hash/metric is not proof of a live external integration unless its source is real.
Open: At PR time full Vite build, real APK/checkout/HF link and VPS/ADB runtime were not yet asserted.
Next safe step: Add external capability claims only after direct runtime/provider readback.

### 2026-08-23 — Consent-scoped live display observation
Status: VERIFIED repository merge
Task: Turn the first game-screen CTA into explicit browser screen sharing.
Decisions:
- Request video only; browser owns source selection.
- Pixels stay local until a separate recording action and accepted server receipt.
- Explicitly state that display capture cannot observe OS-level mouse/keyboard/touch events in the selected source.
- Stop tracks on stop/source end/replacement/unmount.
Touched surfaces: Browser display-capture flow and frontend truth guards.
Evidence: PR #3 merged; head `f9fe90f98046a505ed4b8a0b8f735be8e9500f9c`; deterministic display-capture boundary regressions and UI consent/storage/input guards were added.
Learned: Seeing a screen and observing the user's input events are different capabilities and must never be conflated.
Open: Device execution remained outside this capture PR.
Next safe step: Require separate explicit consent and evidence for any later recording/device-control lane.

### 2026-08-24 — Local project runs and advisory routing boundary
Status: VERIFIED repository merge
Task: Add persistent local projects/runs and a model-route UI without allowing an LLM provider to become control authority.
Decisions:
- Browser-local IndexedDB isolates named runs, frames, rules, DAgger records, device/profile settings and policy checkpoint.
- Stop display capture, recording, agent execution and ADB arming at every run boundary; never silently restore them.
- Deterministic 16→32→16→4 MLP remains the only control/training path.
- Optional fixed server-side OpenAI-compatible route is advisory only; no browser provider key or arbitrary endpoint form.
- MCP is not runtime inference/device transport.
Touched surfaces: Projects menu, model-route menu, IndexedDB run persistence and advisory provider boundary.
Evidence: PR #4 merged; head `79157c37fe2278402653eb6da20610afca64aac9`.
Learned: Persistence of a project/run must not silently persist high-risk consent or execution state.
Open: Provider/browser runtime claims still require current live readback.
Next safe step: Keep provider output side-channel/advisory and bind any future training effect to explicit deterministic evidence, not model prose.

---

### 2026-09-24 — ForgeAI 01: Freeze canonical architecture, AI Studio boundary & agent instructions
Status: VERIFIED repository merge
Task: Create the durable architecture/specification layer that prevents future AI-assisted work from confusing code generation with canonical integration (Issue #7).
Decisions:
- GitHub main is the only canonical source branch; Google AI Studio is a development accelerator, not an authority.
- Root AGENTS.md expanded with project boundaries, truth rules, test commands, Memory.md workflow, Forge-specific restrictions, canonical status vocabulary, and forbidden cross-project authority leakage.
- docs/FORGEAI_INTEGRATION.md created as the durable design spec: visual vs structured control planes, Forge external authority, dedicated runner, append-only trajectory ledger, terminal-run-only learning, rights/publication gate, responsibility matrix, secret ownership, practice-vs-paid boundary, status vocabulary.
- docs/ARCHITECTURE.md and docs/ROADMAP.md updated to link to FORGEAI_INTEGRATION.md.
- scripts/forge_truth_guard.mjs added: static guard that fails if any forge-related file imports or mutates the protected visual policy/dataset path (neuralPolicyEngine, datasetCodec, serverSyncGateway, receiptVerifier) or references the are-agent-vla.v1 schema.
- Guard wired into package.json `check` script and CI workflow.
Touched surfaces: AGENTS.md, docs/FORGEAI_INTEGRATION.md, docs/ARCHITECTURE.md, docs/ROADMAP.md, scripts/forge_truth_guard.mjs, package.json, .github/workflows/ci.yml, Memory.md, docs/RELEASE_STATUS.md.
Evidence: forge_truth_guard.mjs passes (no forge files exist yet — guard is preventive). truth_scan.mjs passes. Backend tests pass. Frontend core tests pass. No existing visual-path module was modified.
Learned: A static import guard is the cheapest preventive boundary — it fails CI before forge code can touch the visual path, even before any forge code exists.
Open: No real Forge runtime, public trajectory data, or verified Forge results exist. All Forge capabilities remain planned.
Next safe step: Issue #8 — add versioned structured-control policy contract without touching are-agent-vla.v1.

### 2026-09-24 — ForgeAI 02: Versioned structured-control policy contract
Status: VERIFIED repository merge
Task: Create the versioned structured-control policy contract for ForgeAI agent participation, separate from the frozen visual-control plane (Issue #8).
Decisions:
- New schema `forge-trajectory.v1` defined in `frontend/services/forgeStructuredPolicy.ts`, never the frozen visual-control schema.
- Actions are typed structured commands (navigate, select, submit, query, wait, observe, reason), not pixel-space taps.
- Three-stage lifecycle enforced: predicted → submitted → accepted/rejected. `submitted_action` is null until submission; `accepted` is null until independent Forge readback.
- `ForgePolicyContract` interface defines the versioned policy contract: takes a `ForgeObservation`, produces a `ForgeStructuredAction`.
- `DeterministicSelectFirstPolicy` reference implementation included for testing/scaffolding.
- Validation and builder functions follow the existing `operationCorrectionCodec.ts` pattern (camelCase input → snake_case serialized record).
- Module is self-contained: no imports from protected visual-path modules. `forge_truth_guard.mjs` confirms isolation.
Touched surfaces: frontend/services/forgeStructuredPolicy.ts (new), frontend/scripts/run-core-tests.mjs, docs/FORGEAI_INTEGRATION.md, Memory.md.
Evidence: forge_truth_guard.mjs passes (forge file imports no protected modules, references no frozen schema). truth_scan.mjs passes. Frontend core regressions 38 assertions pass (14 new forge assertions). Frontend typecheck passes. Full `npm run check` passes (backend, frontend core, typecheck, build, truth scan, forge guard, HF dataset tests).
Learned: The forge guard catches the frozen schema string even in comments — the guard scans full file text, not just imports. Reference comments must paraphrase, not quote the schema name.
Open: No real Forge runtime, action client, or trajectory ledger exists yet. The contract is scaffolding only.
Next safe step: Issue #9 — ForgeAI contract discovery, SKILL.md parsing, credential isolation & action client.

### 2026-09-24 — ForgeAI 03: Contract discovery, SKILL.md parsing, credential isolation & action client
Status: VERIFIED repository merge
Task: Implement issue #9 — Forge runner contract discovery, SKILL.md parsing, server-side credential isolation, and action client.
Decisions:
- New module `frontend/services/forgeContractClient.ts` (schema `forge-contract.v1`), self-contained, no imports from protected visual-path modules.
- `validateForgeContractDiscovery` / `buildForgeContract` / `verifyForgeContractIntegrity` — contract discovery with SHA-256 integrity hash over canonical JSON body.
- SKILL.md content is validated for credential leaks (rejects api_key=, access_token=, etc.) and size limits.
- `ForgeCredentialVault` — server-side credential holder: `hasCredentials()` is observable, credential values are never exposed. `getAuthHeader()` throws if absent.
- `ForgeActionClient` — submits structured actions; returns `unobservable` when no endpoint, no credentials, or no real Forge response. NEVER fabricates acceptance.
- Practice mode is a first-class contract constraint, not an afterthought.
Touched surfaces: frontend/services/forgeContractClient.ts (new), frontend/scripts/run-core-tests.mjs, docs/FORGEAI_INTEGRATION.md, Memory.md.
Evidence: forge_truth_guard.mjs passes. truth_scan.mjs passes. Frontend core regressions 58 assertions pass (20 new). Frontend typecheck passes.
Learned: The credential vault pattern (observable presence, hidden value) is the correct boundary for server-side secrets in a contract module — it lets the action client make safe decisions without ever touching the secret in client code.
Open: No real Forge runtime, endpoint, or credentials exist yet. The action client is scaffolding only.
Next safe step: Issue #10 — append-only Forge trajectory ledger, receipts & tamper detection.

### 2026-09-24 — ForgeAI 04-06: Trajectory ledger, VPS runner & reconciliation
Status: VERIFIED repository merge
Task: Implement issues #10 (append-only Forge trajectory ledger, receipts & tamper detection), #11 (durable VPS Forge runner with restart-safe run state machine), and #12 (independent terminal trajectory reconciliation against ForgeAI readback).
Decisions:
- New schema `are-agent-forge-trajectory.v1` in `frontend/services/forgeTrajectoryStore.ts` — append-only JSONL ledger with SHA-256 hash chain, idempotent duplicate handling (request_id), startup revalidation, tamper refusal, receipt generation, and PENDING_RECONCILIATION state for ambiguous network failure. Self-contained, no imports from protected visual-path modules.
- New `forge-runner/` top-level runtime with `stateMachine.js` (IDLE → PREPARED → RUNNING → TERMINAL_LOCAL → RECONCILING → RECONCILED/PARTIAL/QUARANTINED → LEARNING_ELIGIBLE), `runner.js` (durable run lifecycle, crash/restart safety, practice-mode payment boundary), `health.js` (process/contract/credential/ledger/reconciliation health readback), `Dockerfile`, and 16 tests.
- New schema `are-agent-forge-reconciliation.v1` in `frontend/services/forgeReconciliation.ts` — field-by-field comparison of local trajectory vs Forge readback, verdict computation (VERIFIED/PARTIAL/MISMATCH/UNOBSERVABLE/UNPROVABLE), coverage statement, receipt integrity verification.
- CI workflow updated with forge-runner test step. Root check script updated to include forge-runner tests.
- `docs/FORGEAI_INTEGRATION.md` issue map updated: #10, #11, #12 → Implemented.
Touched surfaces: frontend/services/forgeTrajectoryStore.ts (new), frontend/services/forgeReconciliation.ts (new), forge-runner/ (new: stateMachine.js, runner.js, health.js, package.json, Dockerfile, test/runner.test.js), frontend/scripts/run-core-tests.mjs, docs/FORGEAI_INTEGRATION.md, .github/workflows/ci.yml, package.json, Memory.md.
Evidence: Frontend core regressions 93 assertions pass (35 new: 20 trajectory ledger + 15 reconciliation). Forge runner 16 tests pass. Forge truth guard passes (no forge file imports protected modules or references frozen schema). Truth scan passes. Backend 22 tests pass. Typecheck passes. Vite build passes (2401 modules). HF dataset 5 tests pass.
Learned: The hash chain pattern (previous_record_sha256 → record_sha256) provides cheap tamper detection at startup — a single field change in any historical record breaks the chain and the recomputed hash. The reconciliation verdict must distinguish "field was unobservable" (match=null) from "field was observed and matched" (match=true) — conflating them would let a missing endpoint pass as VERIFIED.
Open: No real Forge runtime, endpoint, credentials, or terminal practice run exists. All modules are scaffolding with contract tests only. Real VPS deployment and Forge readback are out of scope for this issue set.
Next safe step: Issue #13 — terminal-run-only offline learning & DAgger-style correction for structured trajectories.

## Backfill boundary

This bootstrap captures retrievable ARE Agent Studio integration history. It is not a transcript. Older recovered blocks must be appended as `Historical recovery` entries rather than rewriting these records.

### 2026-09-24 — ForgeAI 07 & 12: Offline learning, DAgger corrections & Forge Control Room UI
Status: VERIFIED repository merge
Task: Implement issues #13 (terminal-run-only offline learning & DAgger-style correction for structured trajectories) and #18 (Forge Control Room UI/readmodels with strict verified-vs-derived status semantics).
Decisions:
- New module `frontend/services/forgeLearningEligibility.ts` (schema `forge-learning.v1`, `forge-structured-correction.v1`, `forge-policy-revision-manifest.v1`):
  - `checkLearningEligibility` — gates learning on trajectory validation, terminal immutability, reconciliation verdict threshold (VERIFIED/PARTIAL), rights/privacy, and no unresolved quarantine.
  - `buildForgeCorrection` — append-only correction record referencing exact observation hash + original prediction/action. Original action never overwritten. `admitted_to_training` is separate from recording (requires owner approval).
  - `splitEpisodes` — deterministic episode-level train/val/test splitting (never turn-level) with seeded hash assignment. Same seed + run IDs → identical split.
  - `buildPolicyRevisionManifest` — binds dataset manifest hash, input run IDs/root hashes, code Git SHA, training seed, training config hash, environment digest, output artifact hash, evaluation manifest hash.
- New component `frontend/components/ForgeControlRoom.tsx` — dedicated Forge/External Evaluation view with strict provenance labels (local observed, Forge observed, derived, verified, partial, unavailable). Unknown values render as "—", never zero. Controls: inspect/connect, start practice (gated), stop, quarantine/unquarantine with owner reason, private snapshot. No manual verification override, no autonomous paid entry, no public publish while rights gate unresolved.
- `SystemMode.FORGE_CONTROL_ROOM` added to types, Navbar, and App.tsx (full-width layout, no DeviceCanvas).
- Core test runner extended with 35 new assertions (learning eligibility, correction immutability, episode splitting, policy revision manifest). UI truth guards extended with 13 new assertions for ForgeControlRoom.
Touched surfaces: frontend/services/forgeLearningEligibility.ts (new), frontend/components/ForgeControlRoom.tsx (new), frontend/types.ts, frontend/App.tsx, frontend/components/Navbar.tsx, frontend/scripts/run-core-tests.mjs, frontend/scripts/run-ui-truth-guards.mjs, Memory.md.
Evidence: Frontend core regressions 93 assertions pass (35 new). UI truth guards 24 assertions pass (13 new). Forge truth guard passes. Truth scan passes. Typecheck passes. Vite build passes (2402 modules). Production entry 7 assertions pass. Backend 22 tests pass. Forge runner 16 tests pass.
Learned: The learning eligibility gate must consume the reconciliation verdict, not the runner success flag — a runner that reports "terminal" without reconciliation is not learning-eligible. Episode-level splitting prevents leakage across the same dungeon trajectory that turn-level splitting would cause.
Open: No real Forge runtime, backend readmodel endpoint, or terminal practice run exists. The Control Room UI renders all fields as unavailable until a real data source is connected. No real learning has been performed.
Next safe step: Issue #14 — reproducible training/evaluation receipts & Hugging Face publication.
