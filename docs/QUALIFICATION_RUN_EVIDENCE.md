# ForgeAI Qualification Run — Evidence Bundle Structure

> Issue #20: Execute first real Forge practice benchmark, reconcile, learn & snapshot.
>
> **Status: BLOCKED** — Account-specific practice allowance and a deployed gameplay runner are not verified. Public Forge discovery is reachable; that does not prove zero remaining allowance.
> This issue must NOT be converted into a paid purchase.

## Preconditions (all must be met before execution)

These are live acceptance gates, not a source-file inventory. Closed prerequisite
issues demonstrate merged scaffolding, not a deployed integration.

- [ ] Structured policy bound to the live run contract (#8)
- [ ] Real authenticated adapter integrated and current run contract re-read (#9)
- [ ] Dedicated VPS gameplay runner deployed at exact source/image revision (#11)
- [ ] Trusted durable trajectory ledger connected to the runner (#10)
- [ ] Independent reconciliation pipeline connected and tested (#12)
- [ ] Learning pipeline ready and disabled until terminal (#13)
- [ ] HF private snapshot pipeline ready with permitted input fields (#16)
- [ ] Current rights decision bound to a reviewed record (#15)
- [ ] Training receipt lane verified, if training is part of the wave (#14)
- [ ] CI/full regressions green on the exact deployment revision (#19)
- [ ] Remaining free allowance or authorized owned run confirmed by authenticated Forge readback

The bundle builder accepts full 40/64-character Git IDs and digest-pinned images.
Each precondition needs a `readinessEvidence[id]` reference containing
`receiptSha256`, `sourceRef`, and the exact `gitSha`. The orchestrator must verify
those receipts before supplying them. The builder binds references; it cannot
independently verify remote facts or authenticate the caller. Post-run learning
and snapshot outputs are optional, never prerequisites for a first run.
A terminal bundle requires run identity, trajectory root, reconciliation receipt,
coverage and VERIFIED/PARTIAL verdict. The bundle's integrity hash alone does
not establish independent verification of any result.

## Read-only operational check

```bash
npm start --prefix forge-runner
npm run preflight --prefix forge-runner
```

The service binds to `127.0.0.1:8090` by default. It has no gameplay/mutation route.
`GET /health` returns 200 for a live process; `GET /ready` returns 503 until
verified contract/ledger/credentials and qualification readiness are supplied.
The default host deliberately has no gameplay adapters. It must not be described
as a deployed autonomous player. `FORGE_RUNNER_DATA_DIR` selects durable state;
corrupt state fails startup. Public preflight only performs three GET requests,
hashes the observed documents, and exits 2 (BLOCKED) because account allowance
and VPS readiness are not established by public documents.

## 2026-10-02 source/runtime audit

- Public registry, compatibility SKILL and connector OpenAPI returned HTTP 200.
  Receipt: `docs/evidence/forge-public-preflight-2026-10-02.json`.
- Current connector contract exposes discovery, free entry, owned runs, context,
  turns and events. HTTP 200 on a turn may mean accepted **or soft-rejected**;
  an adapter must parse the game response rather than infer acceptance from HTTP.
- No authenticated Forge connector is available in this work session. The
  expected Forge account/run environment variables and a VPS deployment target
  are not configured here. This does not prove they are absent elsewhere.
- Huggi lookup could not resolve `Thorsu/are-agent-forge-trajectories` in the
  connected context. No dataset was created or uploaded during this audit.
- The existing `ForgeActionClient.submitAction` is still a non-network scaffold.
  The existing runner also needs durable pre-submit ledger wiring, async transport
  handling, policy freeze enforcement, and full learning eligibility evaluation
  before any gameplay deployment. A string reconciliation verdict alone is not
  sufficient authorization to learn.
- Current public terms/research pages do not supply a field-level permission
  record for our proposed training/export use. Public and private export remain
  subject to the existing rights gate; no Forge content was published.
- The process host and readiness regressions are local runtime evidence only;
  they are not VPS, external gameplay, training, or Hugging Face publication proof.

**If no free/practice run is available, STOP with BLOCKED. Do not convert this issue into a paid purchase.**

## Evidence bundle (to be populated on first real run)

The evidence bundle must include references/hashes for:

| Field | Status |
|---|---|
| Run ID | UNOBSERVABLE — no run executed |
| Dungeon ID | UNOBSERVABLE — no run executed |
| Forge contract hash | UNOBSERVABLE — no run executed |
| Trajectory root hash | UNOBSERVABLE — no run executed |
| Terminal state | UNOBSERVABLE — no run executed |
| Externally observed score/result | UNOBSERVABLE — no run executed |
| Reconciliation coverage/verdict | UNOBSERVABLE — no run executed |
| Policy revision that actually played | UNOBSERVABLE — no run executed |
| Learning receipt | UNPROVABLE — no run to learn from |
| Policy N+1 artifact hash | UNPROVABLE — no learning performed |
| HF snapshot manifest/revision | UNPROVABLE — no snapshot uploaded |
| Exact source/runtime revision | DERIVED — Git SHA available, no runtime deployed |

## Execution checklist (to be followed when unblocked)

1. Record pre-run environment receipt: Git SHA, runner image digest, policy revision/config hash, Forge contract/SKILL hash.
2. Start/attach exactly one authorized practice run.
3. Freeze policy for entire run.
4. Persist every turn in the append-only trajectory chain.
5. On ambiguous transport failure, reconcile before sending another action.
6. Reach terminal state or record real failure/timeout exactly as observed.
7. Fetch independent Forge metadata/readback.
8. Produce reconciliation receipt.
9. Decide learning eligibility mechanically.
10. If eligible, generate offline learning candidates and policy N+1; do not rewrite the run.
11. Prepare a private HF snapshot of permitted data and bind its manifest hash.
12. Publish publicly only if #15 rights gate explicitly allows it; otherwise retain private/gated snapshot and record why.

## Outcome language

"Successful" means only what Forge actually reports and reconciliation proves.
A low score, death, invalid action or failed strategy is still valuable valid
evidence if recorded honestly.

## Exit criteria

We possess one externally grounded, end-to-end ARE Forge episode whose provenance
can be followed from source Git revision → runner digest → policy → each
action/response → Forge readback → reconciliation → optional offline learning
→ HF snapshot, with no paid action and no fake evidence.

**Current status: BLOCKED — requires authenticated Forge readback and completed, evidenced gameplay wiring/deployment.**

## Authenticated account transport (2026-10-02)

`FORGEAI_API_KEY` is consumed by `.github/workflows/forge-account-readback.yml`
from the owner's Actions secret. This controlled workflow performs only GET
requests to the fixed Forge origin, refuses redirects, bounds time/body size,
and never retries or creates a run. It runs on main or the named integration
branch, never on a pull-request event.

Published technical receipts contain only source revision, HTTP/error status and
endpoint references. Account allowance, run identities/counts, raw provider
responses and response hashes are excluded from public artifacts and logs.
An authenticated runtime request was exercised successfully before merge.
Gameplay/VPS deployment and field-level rights decisions remain separate gates.
Funding a wallet does not itself authorize payment.
