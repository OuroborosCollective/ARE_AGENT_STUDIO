import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, '..', 'src', 'App.jsx'), 'utf8');
const metrics = fs.readFileSync(path.join(here, '..', 'src', 'publicMetrics.js'), 'utf8');

test('public site is wired to the aggregate-only metrics contract', () => {
  assert.match(metrics, /\/api\/v1\/public\/metrics/);
  assert.doesNotMatch(`${app}\n${metrics}`, /dataset\/export|operation-corrections\/export|verified-imitations\/push|telemetry\/push/);
});

test('unavailable data remains visibly unavailable instead of being replaced by a claim', () => {
  assert.match(app, /metrics \? formatCount\(metrics\.verifiedDeviceReadbackActions\) : '—'/);
  assert.match(app, /metrics \? formatEuro\(metrics\.currentPriceCents\) : '—'/);
  assert.match(app, /Zahlung noch nicht aktiviert/);
});
