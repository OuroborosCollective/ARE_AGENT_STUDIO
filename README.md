# ARE Agent Studio

**ARE Agent Studio** is an evidence-bound experimental studio for learning visual mobile-game control from human demonstrations.

It captures a real browser-visible frame and a real pointer action, turns that pair into a provenance-aware VLA-style dataset row, trains a small deterministic in-browser imitation policy, records DAgger-style human corrections, and can optionally forward a predicted tap to an explicitly armed Android ADB bridge.

The project deliberately separates **prediction**, **dataset acceptance**, **advisory AI**, and **device execution**. A drawn trajectory is not evidence that Android received a tap; a local buffered sample is not evidence that a dataset daemon accepted it; and a provider-generated tactical suggestion is never treated as observed game state.

## What exists today

```text
Browser capture / local video / compatible video URL
                      │
                      ▼
              frame + 4x4 luminance
              visual feature vector
                      │
          Human pointer action (label)
                      │
          ┌───────────┴────────────┐
          ▼                        ▼
  local imitation policy      paired telemetry
    16 → 32 → 16 → 4               │
          │                         ▼
          │                dataset codec v1
          │                         │
          │                 HTTP dataset daemon
          │                         │
          │                 append-only JSONL
          │                         │
          │                  SHA-256 receipt
          │                         │
          ▼                         ▼
  policy prediction          HF snapshot builder
          │                         │
          │                 publication gate
          │                         │
          │                         ▼
          │                Hugging Face Dataset
          │
      explicit arm
          │
          ▼
   opt-in ADB bridge
          │
          ▼
   Android tap acknowledgement
```

### Implemented truth boundaries

- **Observation:** policy input is derived from captured frame pixels. Touch coordinates are targets, not input features.
- **Training:** the browser MLP trains only on recorded frame/action pairs. No synthetic epochs are injected into production training state.
- **DAgger:** a human takeover is stored as a correction only when it can be bound to an observed frame feature vector.
- **Dataset:** accepted rows are content-addressed and written to an append-only JSONL ledger. The daemon returns a SHA-256-bound receipt; the browser verifies that receipt before counting a sync as successful.
- **Concurrent collectors:** dataset appends are serialized, duplicate sample identities are idempotent, and an existing ledger is revalidated when the daemon starts.
- **Unknown state:** HP, mana, enemy count, and similar values are not fabricated. Unknown values use a `state_mask` so zero never silently means "observed zero".
- **Publication:** capture defaults to private/local. A row reaches the public HF export only after an explicit per-sample publication opt-in with `user_confirmed` basis.
- **Device output:** ADB is disabled by default, serials can be allowlisted, and calls use fixed `execFile` arguments instead of shell interpolation.
- **Advisory AI:** an optional server-side OpenAI-compatible vision endpoint may suggest tactical candidates. It is fail-closed and outside the dataset/runtime truth path.
- **Project runs:** the Studio can save named projects and independent runs in browser IndexedDB. A run restores only its own frames, rules, DAgger records and policy checkpoint; display capture, recording, ADB output and credentials are never silently restored. This is local browser-profile organization, not an authenticated account or server-side multi-user boundary.
- **Human-correction learning:** owner labels for proposed agent operations are a separate, append-only side channel. They can create offline review candidates only; they never authorize or execute a proposed effect.
- **Public metrics/pricing:** the public metrics endpoint exposes aggregate counts and ledger hashes only. It starts at zero verified imitations unless a separate authenticated device-readback ledger contains complete evidence; unit tests and UI assertions never raise that count or the price.

## Repository layout

- `frontend/` — React/Vite Studio, capture UI, deterministic MLP, DAgger, dataset inspector, runtime verification.
- `backend/` — dependency-free Node 22 dataset daemon, receipt ledger, optional ADB bridge, optional advisory gateway.
- `scripts/prepare_hf_dataset.py` — converts publication-approved ledger rows into an HF snapshot with decoded frames.
- `scripts/publish_hf_dataset.py` — re-verifies every snapshot hash immediately before upload.
- `scripts/publish_hf_space.py` — publishes the Docker-based Studio Space.
- `huggingface/dataset/` — Dataset Card source.
- `huggingface/space/` — Space Card source.
- `docs/ARCHITECTURE.md` — detailed boundaries and flows.
- `docs/DATASET.md` — schema and provenance contract.
- `docs/VERIFICATION.md` — what may and may not be called verified.
- `docs/OPERATION_CORRECTION_LEARNING.md` — consent-gated human-correction side channel for agent operations.
- `docs/ROADMAP.md` — next capability lanes without presenting plans as runtime.
- `docs/RELEASE_STATUS.md` — verified vs. pending release evidence.

## Local run

Prerequisites: Node 22 and Python 3.12+ for the HF snapshot tools.

```bash
npm install --prefix frontend --ignore-scripts
cp backend/.env.example backend/.env.local
npm run dev
```

Frontend defaults to `http://localhost:5173`; the dataset daemon defaults to `http://127.0.0.1:8080`.

`backend/.env.local` is ignored by Git. Do not commit tokens or credentials.

## Verification

Dependency-free regressions can run without installing frontend packages:

```bash
npm run test --prefix backend
npm run test:core --prefix frontend
python scripts/test_hf_dataset.py
node scripts/truth_scan.mjs
```

With frontend dependencies installed, run the complete gate:

```bash
npm run check
```

The complete gate adds TypeScript checking and a production Vite build. CI runs the same checks on pull requests.

## Dataset collection and Hugging Face

1. Capture gameplay through a browser-visible source and record human interactions.
2. Keep **Public Dataset Eligibility** off unless you have the right to redistribute the captured imagery.
3. Push rows to the local dataset daemon. Only its verified receipt increases the synced-row counter.
4. Prepare a public snapshot:

```bash
python scripts/prepare_hf_dataset.py \
  --ledger backend/data/telemetry.jsonl \
  --output huggingface/export
```

5. Inspect `huggingface/export/dataset_manifest.json` and the selected rows.
6. Dry-run the publisher:

```bash
python scripts/publish_hf_dataset.py \
  --repo-id YOUR_HF_NAMESPACE/ARE-Agent-Studio-VLA-Dataset \
  --dry-run
```

7. Install the publishing client with `python -m pip install -r requirements-hf.txt`, set `HF_TOKEN`, and publish. The publisher re-hashes the manifest, JSONL, episode index, and every frame before upload.

A public dataset is intentionally **not** generated from example/mock rows. No approved real samples means no public dataset snapshot.

## Hugging Face Space

The root `Dockerfile` builds the React frontend and serves it from the same Node runtime as the dataset daemon. In hosted mode the frontend uses same-origin API routes.

```bash
python scripts/publish_hf_space.py \
  --repo-id YOUR_HF_NAMESPACE/ARE-Agent-Studio \
  --dry-run
```

The public Space should be used for Studio/prediction/data tooling. **ADB and shared dataset writes are disabled in the Space image.** This prevents an unauthenticated public Space from becoming an accidental shared capture sink. A future public-contribution mode should use an authenticated durable collector rather than ephemeral Space disk.

## Public metrics, early-adopter price, and links

`GET /api/v1/public/metrics` is intentionally the only public website-oriented data surface. It returns aggregate counts, ledger hashes, a content-addressed snapshot hash, link status, and the deterministic price policy; it never contains frames, actions, raw dataset rows, correction records, or operational candidates.

The price policy is €4.25 initially and adds €1.00 for each complete group of 15 **authenticated, hash-bound device-readback evaluation records**. A test fixture, policy prediction, or a self-reported result does not count. With no such ledger records, the published count is `0` and the price remains €4.25.

Direct daemon export is disabled by default with `DATASET_EXPORT_ENABLED=false`. The public site may link to a real Hugging Face project only after one exists; it must not invent a dataset or APK download URL. `PUBLIC_HUGGING_FACE_PROJECT_URL`, `PUBLIC_APK_RELEASE_URL`, and `PUBLIC_CHECKOUT_URL` are opt-in HTTPS link configuration values, not credentials. The daemon itself does not process PayPal, crypto, or OpenRouter charges.

## Optional Android action bridge

ADB output is intentionally not enabled by checking a UI box alone. Configure the backend explicitly:

```env
ENABLE_ADB_BRIDGE=true
ADB_ALLOWED_SERIALS=your-device-serial
```

Then configure the same serial/resolution in the Studio. Human touch or the ESC killswitch disarms autonomous output.

## Optional advisory provider

The Studio no longer embeds a provider key in browser code. The active **learning and control** path is the deterministic `16 → 32 → 16 → 4` browser MLP; it does not use an LLM. An optional LLM/VLM is limited to the separate **advisory** path, where a human manually requests a tactical candidate in Memory. It cannot train the policy, add dataset evidence, or send an ADB command.

To use that advisory path, configure a fixed approved server-side OpenAI-compatible endpoint:

```env
ADVISORY_PROVIDER_LABEL=Approved OpenAI-compatible route
ADVISORY_API_URL=https://provider.example/v1/chat/completions
ADVISORY_API_TOKEN=...
ADVISORY_MODEL=...
```

This supports a compatible provider/router such as OpenRouter, or an OmniRoute deployment if it genuinely implements the required vision-capable Chat Completions contract. The key stays on the trusted server; the Studio only reads non-secret route status from `/api/v1/health`. The **Model Route** menu displays that state and the non-secret provider/model label. The browser does not offer a key field or arbitrary endpoint chooser.

MCP is not the runtime model or device-control transport here. It can help external systems orchestrate tools, but the Studio’s advisory request is ordinary server-side HTTPS and the policy/device paths keep their separate evidence and consent boundaries.

If the route is unavailable or returns invalid JSON, no tactical rule is fabricated.

## Local projects and resumable runs

Use **Projects** before recording to create a named local project and its first run. Each run receives its own stable `session_id`, deterministic policy seed and IndexedDB checkpoint. Switching runs first disarms recording and Android output, stops any live display observation, clears transient frame data, and then restores only the selected run’s saved learning state.

The project name remains a browser-local organizational label and is not inserted into dataset rows, public metrics, or Hugging Face exports. A user account, cloud sync, cross-device resume, or server-enforced project isolation is not implemented yet; those require authenticated owner identity and server ACLs rather than a cosmetic menu.

## Current scope and non-claims

ARE Agent Studio is a research/prototyping system, not a proven general-purpose VLA model and not evidence of successful autonomous gameplay on arbitrary games. The current learned policy is a small `16 → 32 → 16 → 4` MLP over a 4×4 luminance feature representation. A richer CNN/temporal policy is a future model lane, not something the present runtime pretends to contain.

The repository also does **not** claim that ADB execution has been validated on every Android target, that browser video sources work with every scrcpy transport, or that a public HF dataset exists before real publication-approved samples have been collected.

It also does **not** claim authenticated multi-user project isolation. The current Projects menu is a durable local browser workspace only.

## Responsible data collection

Only capture and publish content you are authorized to use. Avoid private notifications, account identifiers, chat messages, personal data, credentials, payment information, or other sensitive overlays. Public dataset eligibility is deliberately opt-in, not inferred from the fact that recording was possible.

## License

No repository license is selected by this bootstrap. The repository owner should choose the code and dataset licenses explicitly before public redistribution.
