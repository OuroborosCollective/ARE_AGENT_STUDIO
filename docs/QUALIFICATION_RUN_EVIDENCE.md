# ForgeAI Qualification Run — Evidence Bundle Structure

> Issue #20: Execute first real Forge practice benchmark, reconcile, learn & snapshot.
>
> **Status: BLOCKED** — No free/practice run is available or confirmed.
> This issue must NOT be converted into a paid purchase.

## Preconditions (all must be met before execution)

- [x] Structured policy contract live (#8)
- [x] Forge adapter live and current contract re-read (#9)
- [x] Dedicated VPS runner deployed (#11)
- [x] Trusted trajectory ledger (#10)
- [x] Reconciliation pipeline ready (#12)
- [x] Learning pipeline ready but disabled until terminal (#13)
- [x] HF private snapshot pipeline ready (#16)
- [x] Rights gate installed (#15)
- [x] Training/evaluation receipt lane ready (#14)
- [x] CI/contract-drift/security gates installed (#19)
- [ ] Remaining practice allowance or an explicitly owner-authorized existing run confirmed through real Forge readback

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

**Current status: BLOCKED — awaiting practice run availability or owner authorization.**
