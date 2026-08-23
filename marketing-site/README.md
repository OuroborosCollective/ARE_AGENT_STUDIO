# ARE Agent Studio — public evidence surface

This is the Sites-ready public website for ARE Agent Studio. It implements the Signal Control Room presentation shared by the Studio frontend and the Hugging Face Cards.

## Public data boundary

The page requests only `GET /api/v1/public/metrics` (or the HTTPS URL configured as `VITE_ARE_PUBLIC_METRICS_URL`). It renders aggregate counts, ledger hashes, the deterministic price state, and explicitly configured project/release/checkout links. It never requests frames, action rows, correction records, candidates, or a dataset export.

When the endpoint is absent, invalid, or unavailable, the page shows `—` for live values rather than fabricating a zero, a price, or a success claim.

## Configuration

`VITE_ARE_PUBLIC_METRICS_URL` is optional. Leave it unset only when this site shares an origin with the ARE backend. Set it to the externally reachable HTTPS public-metrics endpoint before a standalone deploy.

The backend remains the source of truth for all public links:

- `PUBLIC_HUGGING_FACE_PROJECT_URL`
- `PUBLIC_APK_CLIENT_REPOSITORY_URL`
- `PUBLIC_APK_RELEASE_URL`
- `PUBLIC_CHECKOUT_URL`
- `PUBLIC_PAYMENT_PROVIDER`

No value is added in the website source as a substitute for an unverified project, APK release, payment provider, or dataset publication.

## Checks

```bash
npm run test:metrics
npm run build
npm run test:sites
```
