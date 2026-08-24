# Release status

## Verified in the current source tree

- dependency-free Node dataset daemon starts and responds over real local HTTP;
- complete dataset rows are validated, content-addressed, serialized, de-duplicated, and receipt-bound;
- concurrent duplicate appends serialize to one accepted row;
- persisted ledger rows are revalidated on daemon startup;
- browser receipt verification rejects inconsistent/tampered receipt bodies;
- policy initialization is deterministic for an explicit seed;
- core training consumes frame-feature/action pairs and reduces loss in regression input;
- `TOUCH_UP` is encoded as `touch=0` across dataset/training paths;
- dataset rows preserve capture session and sequence identity;
- HF snapshot generation selects only explicit publication-approved rows and creates a real episode index;
- HF publisher re-verifies manifest, JSONL, episodes, frame hashes, and publication metadata before upload;
- public Docker Space configuration disables shared dataset writes and ADB by default;
- public aggregate metrics return only counts, hashes, and deterministic pricing state; direct dataset export defaults to disabled;
- an authenticated verified-imitation ledger accepts only hash-bound device-readback records and revalidates them at startup;
- operation-correction learning remains an owner-consented, non-executing candidate path with no execution authority;
- the public-site source uses only the aggregate public-metrics contract and renders unavailable values as unavailable rather than fabricating live evidence;
- the Signal Control Room visual system is shared by the Studio frontend, public-site source, and local Hugging Face Cards;
- optional advisory provider fails closed when absent or malformed;
- named browser-local project runs isolate saved frames, rules, DAgger records and policy checkpoints; restoring a run keeps display capture, recording and Android output off;
- known prototype fake-evidence markers are rejected by the truth scan.

## Environment limitation in this workspace

The current execution environment cannot reach the npm registry through `npm install`. Therefore the real React/Vite dependency build was not executed here. A structural TypeScript readback over every `.ts/.tsx` source was run with temporary external-module declaration stubs outside the repository, but that is not a substitute for `npm run typecheck && npm run build` with the pinned packages.

CI is configured to perform the real dependency install, TypeScript check, frontend build, backend tests, HF tests, and truth scan on GitHub.

## Not yet verified / intentionally not claimed

- physical Android ADB execution on a real device;
- end-to-end autonomous success in any particular game;
- browser compatibility for every remote video transport;
- production-scale multi-collector storage;
- authenticated multi-user projects, server-side owner ACLs, cloud sync or cross-device project resume;
- a public Hugging Face dataset containing real captured samples;
- a counted device-readback imitation record from a physical Android device (the public count starts at zero until such evidence exists);
- a published APK/release artifact;
- a configured PayPal or crypto checkout, or any OpenRouter execution-fee ledger;
- a publicly deployed public site connected to an externally reachable ARE public-metrics endpoint;
- a rendered public marketing video (a generated voiceover exists, but the selected video renderer did not have sufficient credit to start a render);
- a published HF model repository;
- a CNN/ViT/GRU/Transformer policy in the active runtime;
- public redistribution rights for any captured third-party game imagery;
- selected code or dataset license.
