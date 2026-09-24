# Google AI Studio + Firebase/Firestore/Cloud SQL — Optional Support Planes

> Issue #17: Define Google AI Studio + Firebase/Firestore/Cloud SQL as optional
> support planes, never evidence authority.

## Principle

Google tooling is useful for development acceleration and UI/query convenience.
It must **never** become the canonical evidence authority for ARE's causal
truth. ARE's evidence truth lives in GitHub (canonical source) + append-only
ledgers + external Forge receipts.

## Google AI Studio

- Use AI Studio for bounded implementation work: UI components, readmodels,
  integration scaffolding.
- All resulting code returns to GitHub through the workflow defined in the
  architecture issue (#7): AI Studio/dev branch → GitHub diff/PR → ARE tests
  → runtime evidence → Memory.md → exact-head merge.
- No direct canonical-main replacement. AI Studio sync may never overwrite
  `main` as the integration mechanism.
- Re-read current [Build-mode docs](https://ai.google.dev/gemini-api/docs/aistudio-build-mode)
  before relying on sync/deploy behavior.

## Firebase Auth

- May protect dashboard/admin surfaces.
- Authentication proves identity/session according to Firebase.
- It does **not** prove a Forge action or training result.
- Firebase auth state is never treated as Forge evidence.

## Firestore

- Use only as a disposable/rebuildable read projection for UI/query convenience:
  ```
  canonical ledger → projection → dashboard
  ```
- A missing/incorrect Firestore row must **never** mutate or override the
  append-only source ledger.
- Projection must be rebuildable from canonical receipts.
- If Firestore is removed, all canonical trajectories, policy identity,
  reconciliation receipts, rights decisions, and HF provenance remain intact.

## Cloud SQL / PostgreSQL

- Optional relational metadata/index layer for runs, policies, snapshots,
  training jobs, and rights records.
- Do **not** make SQL the sole store of trajectory evidence.
- Store canonical hashes/foreign references and rebuildable indexes.
- The SQL layer may be dropped and rebuilt from canonical ledgers without
  losing evidence.

## Cost / Free-Tier Claims

- Do not hard-code "free" claims from chat memory.
- At deployment time, read back current Google project/billing/tier
  configuration and record actual configured limits.
- If billing cannot be verified, mark cost status as **UNPROVABLE**.

## Secrets

- Google service credentials stay in managed secrets/runtime env
  (`/run/base44/app.env`), never in:
  - Git (any branch, any file)
  - Hugging Face datasets or model artifacts
  - Browser code or client bundles
  - Dataset rows
  - `Memory.md` or `AGENTS.md`

## Exit Criteria

Any Google support service can be removed/rebuilt without losing canonical
Forge trajectories, policy identity, reconciliation receipts, rights
decisions, or HF provenance. The system remains functionally auditable from
GitHub + canonical ledgers + external receipts.

## Implementation Boundary

No code in the Forge structured-control plane may import or depend on
Firebase, Firestore, or Cloud SQL client libraries. Support-plane integration
is a separate, optional layer that reads from canonical ledgers — it never
writes back to them. The `forge_truth_guard.mjs` static guard can be extended
to enforce this boundary if support-plane code is added.
