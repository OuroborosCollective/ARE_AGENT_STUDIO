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

## Backfill boundary

This bootstrap captures retrievable ARE Agent Studio integration history. It is not a transcript. Older recovered blocks must be appended as `Historical recovery` entries rather than rewriting these records.
