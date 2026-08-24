# Verification and evidence policy

## Evidence classes

### Deterministic/unit evidence

The repository includes regression tests for:

- seeded policy initialization/forward determinism;
- training behavior on observed-pair-shaped data;
- serializer no-fabrication rules;
- `TOUCH_UP` encoding;
- receipt SHA verification;
- image/data-row validation;
- dataset idempotency and concurrent duplicate handling;
- tampered-ledger rejection;
- optional-publication gate;
- ADB command argument safety;
- HTTP dataset runtime behavior;
- non-executing operation-correction ledger, owner-confirmed candidate projection, and receipt verification;
- authenticated, append-only verified-imitation ledger validation, including tamper rejection;
- public aggregate metrics and the deterministic €4.25 + €1 / 15 device-readback pricing threshold;
- disabled direct dataset exports in the hosted/public-style default;
- static-SPA/API separation;
- HF snapshot integrity and pre-publish revalidation.

This evidence proves those code contracts, not success on a particular game or Android device.

In particular, a local fixture that exercises the fifteenth pricing threshold does not mean fifteen real actions were imitated. The public counter begins at zero until independently captured device-readback records are accepted by an authenticated evaluator configuration.

### Local runtime evidence

A real local HTTP runtime test starts the Node server on an ephemeral port and exercises API requests over HTTP. That is stronger than calling store functions directly, but it still is not a live-phone test.

### Live-device evidence

A future claim such as "the agent tapped an Android device" should include at minimum:

- repository revision;
- backend runtime revision/build identity;
- configured/allowlisted device serial or privacy-safe device receipt identifier;
- requested normalized action and calculated pixel coordinate;
- actual ADB process acknowledgement/latency;
- ideally an independent post-action screen observation bound to the request.

The current repository does not manufacture this evidence if a device is absent.

### Public dataset evidence

A public HF dataset claim should bind the Hub revision to the local `dataset_manifest.json` hash. A Dataset Card alone is not proof that all source rows were authorized; the publication metadata and manifest are the machine-readable evidence path.

## Fail-closed rules

- no fake provider response when advisory is unavailable;
- no sync success when the daemon is unreachable;
- no public export without explicit publication approval;
- no ADB execution unless backend execution is enabled;
- no state detector claim from a neutral/unknown value;
- no policy training from records missing frame features;
- no "production VLA" claim for aspirational architectures that are not the active runtime.
- no public daemon dataset export by default;
- no priced verified-imitation count without a hash-bound device-readback record;
- no agent-operation learning update or effect authorization from a human correction alone.
