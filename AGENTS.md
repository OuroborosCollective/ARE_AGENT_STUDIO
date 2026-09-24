# AGENTS.md

## Architecture

ARE Agent Studio is a fullstack monorepo with two Node 22 processes:

- **frontend/** — React 19 + Vite 8 dev server (port 5173, mapped to host 3000).
- **backend/** — dependency-free Node 22 HTTP dataset daemon (port 8080, internal only).

The frontend talks to the backend via a Vite dev-server proxy (`/api` → `http://backend:8080`).
When the browser is NOT on localhost, `frontend/services/serverSyncGateway.ts` uses
`window.location.origin` with port 0, so all API calls are same-origin and rely on the proxy.
The proxy strips the `Origin` header so the backend's CORS allowlist (which defaults to
localhost origins) never rejects proxied requests.

## Running

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

Frontend live-reloads via Vite HMR. Backend live-reloads via `node --watch`.

No external secrets are required to boot. The optional advisory AI gateway
(`ADVISORY_API_URL` / `ADVISORY_API_TOKEN` / `ADVISORY_MODEL`) is disabled by default.

## Verification

- Frontend: `curl http://localhost:3000` returns the Vite-served React app.
- Backend health: `curl http://localhost:3000/api/v1/health` returns JSON.
- Tests: `npm run test:core --prefix frontend` (no install needed), `npm run test --prefix backend`.
