# AGENTS.md — ARE Agent Studio

> Read this file before any integration work session. It is the root agent instruction layer.

## Project identity

ARE Agent Studio is an evidence-bound experimental studio for learning visual mobile-game control from human demonstrations. It captures real browser-visible frames and real pointer actions, turns them into provenance-aware VLA-style dataset rows, trains a small deterministic in-browser imitation policy, records DAgger-style human corrections, and can optionally forward a predicted tap to an explicitly armed Android ADB bridge.

This project is **not** Sovereign Studio ATO, Arelorian WASD, Echoes of Aurion, or any other OuroborosCollective project. No cross-project authority leakage is permitted.

## Canonical source

- **GitHub `main` is the only canonical source branch.**
- Google AI Studio may assist with development/UI work but is **not** an authority that may bypass review.
- AI Studio changes must arrive through a dedicated branch or mirror-to-PR workflow. Never permit an AI Studio sync action to overwrite canonical `main` as the integration mechanism.
- If the connected AI Studio project cannot target branches safely, use a dedicated mirror repository/branch and import diffs through PRs. Never solve the limitation by force-replacing `main`.

## Runtime planes

### Visual-control plane (existing, frozen)

- Browser capture → 4×4 luminance feature vector → deterministic 16→32→16→4 MLP → tap prediction.
- Dataset schema: `are-agent-vla.v1` — **must not be semantically changed** by Forge integration work.
- Protected modules: `frontend/services/neuralPolicyEngine.ts`, `frontend/services/datasetCodec.ts`, `frontend/services/serverSyncGateway.ts`, `frontend/services/receiptVerifier.ts`.
- A static guard (`scripts/forge_truth_guard.mjs`) fails CI if any forge-related file imports or mutates these modules.

### Structured-control plane (planned, ForgeAI)

- A separate versioned policy contract for structured/text-based agent control (Forge trajectories).
- Uses a new schema, never `are-agent-vla.v1`.
- See `docs/FORGEAI_INTEGRATION.md` for the full design spec.

## Canonical status vocabulary

Every claim must use exactly one of these statuses:

| Status | Meaning |
|---|---|
| **OBSERVED** | Directly captured from a real runtime source (frame, pointer, device readback). |
| **DERIVED** | Computed from observed data via a deterministic function (hash, count, aggregate). |
| **VERIFIED** | Independently reconciled against an external authority (Forge readback, device acknowledgement). |
| **PARTIAL** | Some evidence exists but the chain is incomplete. |
| **UNOBSERVABLE** | The value cannot be captured from any available source. |
| **UNPROVABLE** | The claim cannot be confirmed or denied with available evidence. |
| **REJECTED** | Evidence was checked and the claim is false. |

Never render an unknown value as zero or as a verified fact. Use `UNOBSERVABLE` or `UNPROVABLE` instead.

## Non-negotiable truth boundaries

1. Keep `are-agent-vla.v1` semantically unchanged. Forge trajectories use a new schema.
2. Prediction ≠ submitted action.
3. Submitted action ≠ accepted Forge turn.
4. Local trajectory ≠ externally verified trajectory until independent Forge readback reconciles it.
5. Score/replay metadata from Forge must be stored as external evidence, not regenerated locally and called authoritative.
6. Practice-run automation must never silently become paid-entry automation. Anything paid stays explicitly human-approved.
7. Run credentials/API keys never enter Git, HF datasets, public prompts, browser storage, Memory.md, screenshots, or public metrics.
8. Learning from a run happens only after the run is terminal and immutable (v1).
9. Owner/human corrections are separate evidence records and never rewrite the historical action actually taken.
10. No fixture, mock, local test, UI animation, or synthetic replay may increment externally verified Forge success counters.
11. Public dataset publication is fail-closed when rights/terms are uncertain.
12. Aurion/WASD/Sovereign are NOT execution authorities for this integration. No cross-project authority leakage.

## Test commands

From `package.json` and `.github/workflows/ci.yml`:

```bash
# Backend regression and syntax checks
npm run test --prefix backend && npm run check --prefix backend

# Frontend core regressions (no install needed)
npm run test:core --prefix frontend

# Frontend public-claim and visual-asset guards
npm run test:ui-truth --prefix frontend

# Frontend typecheck
npm run typecheck --prefix frontend

# Frontend production build
npm run build --prefix frontend

# Frontend production-entry regression
npm run test:production-entry --prefix frontend

# Public-site metrics regression
npm run test:metrics --prefix marketing-site

# Public-site production build and Sites packaging
npm run build --prefix marketing-site && npm run test:sites --prefix marketing-site

# Dataset builder regressions
python scripts/test_hf_dataset.py

# HF presentation regressions
python scripts/test_hf_presentation.py

# Truth-path scan (prototype evidence fallbacks)
node scripts/truth_scan.mjs

# Determinism scan (forbids Date.now / new Date / Math.random outside the clock module)
node scripts/determinism_scan.mjs

# Forge architecture guard (visual-path isolation)
node scripts/forge_truth_guard.mjs

# Full check (runs most of the above)
npm run check

# Docker image packaging
docker build --tag are-agent-studio:ci .
```

## Memory.md workflow

1. Read `Memory.md` before every work session.
2. Append exactly one entry after each completed work block and before merge.
3. Record: task, decisions, touched surfaces, tests/evidence, learned result, open points, next safe step.
4. Append-only; corrections are new entries.
5. Secrets never belong in `Memory.md`.

## Forge-specific restrictions

- ForgeAI remains external game/evaluation authority. ARE records and reconciles Forge results; ARE never fabricates Forge success from local predictions.
- A dedicated Forge runner lives outside the public HF Space runtime, preferably on a VPS.
- Learning is post-run/offline only for v1. A completed run is immutable input to a later policy revision.
- Forge-owned/raw content is quarantined from public export until its redistribution/training-publication basis is explicit.
- See `docs/FORGEAI_INTEGRATION.md` for the full design spec.

## Secret ownership and prohibited locations

Secrets (API keys, credentials, tokens) must never appear in:
- Git (any branch, any file)
- Hugging Face datasets or model artifacts
- Public prompts or browser storage
- `Memory.md`
- Screenshots
- Public metrics endpoints
- `AGENTS.md`

Secrets are delivered out-of-band and stored in the platform-managed env file (`/run/base44/app.env`), referenced via compose `env_file`.

## AI Studio workflow

```
AI Studio/dev branch → GitHub diff/PR → ARE tests → runtime evidence → Memory.md → exact-head merge
```

Re-read the current [Google AI Studio Build-mode docs](https://ai.google.dev/gemini-api/docs/aistudio-build-mode) before implementation because behavior can change.

## Base44 dev environment

- **Frontend**: React 19 + Vite 8 dev server (port 5173, mapped to host 3000).
- **Backend**: dependency-free Node 22 HTTP dataset daemon (port 8080, internal only).
- The frontend talks to the backend via a Vite dev-server proxy (`/api` → `http://backend:8080`).
- The proxy strips the `Origin` header so the backend's CORS allowlist never rejects proxied requests.

### Running

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

Frontend live-reloads via Vite HMR. Backend live-reloads via `node --watch`.

No external secrets are required to boot. The optional advisory AI gateway (`ADVISORY_API_URL` / `ADVISORY_API_TOKEN` / `ADVISORY_MODEL`) is disabled by default.

### Verification

- Frontend: `curl http://localhost:3000` returns the Vite-served React app.
- Backend health: `curl http://localhost:3000/api/v1/health` returns JSON.

### Determinism & responsive layout

- All wall-clock time and unique identifiers route through the central deterministic clock modules (`frontend/services/deterministicClock.ts`, `backend/src/deterministicClock.js`, `forge-runner/deterministicClock.js`). In production they return real time (provenance preserved); in tests `enableDeterministicMode()` pins a monotonic counter for reproducibility. `scripts/determinism_scan.mjs` fails CI if any non-test, non-frozen source calls `Date.now`, `new Date`, or `Math.random` directly. `performance.now` is allowed (measurement/animation only).
- `frontend/hooks/useDeviceDetect.ts` classifies the viewport (phone/tablet/desktop) and drives the responsive layout. The Navbar shows a mobile mode `<select>` below the `lg` breakpoint (the desktop button row is hidden there); the device canvas scales with `max-w` so it never overflows small phones.
