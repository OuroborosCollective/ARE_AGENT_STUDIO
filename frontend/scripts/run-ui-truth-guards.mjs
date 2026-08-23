import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const operationStudio = fs.readFileSync(path.join(root, 'components', 'OperationCorrectionStudio.tsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'index.tsx'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

assert.doesNotMatch(operationStudio, /Verified deterministic candidate projection/, 'an unsigned readback must not be presented as verified');
assert.match(operationStudio, /returned by the configured daemon/, 'candidate reads must be attributed to their configured daemon');
assert.match(operationStudio, /not a receipt or execution record/, 'candidate reads must retain their non-execution boundary');
assert.match(app, /signal-shell/, 'the Studio shell must apply the shared Signal Control Room treatment');
assert.match(shell, /are-signal-hero\.png/, 'the shared visual asset must be referenced by the Studio shell');
assert.ok(fs.existsSync(path.join(root, 'public', 'assets', 'are-signal-hero.png')), 'the referenced visual asset must be present in the build input');
assert.match(shell, /studio-boot-fallback/, 'the static shell must keep a visible recovery surface before the client mounts');
assert.match(shell, /The interactive client did not start/, 'a failed script load must not leave a black viewport');
assert.match(entry, /StudioStartupBoundary/, 'a React render failure must be contained by the startup boundary');
assert.match(entry, /rootElement\.dataset\.areMounted = 'true'/, 'the static shell must be marked mounted only after React takes control');
assert.match(packageJson, /inline-production-entry\.mjs/, 'the production build must inline its self-contained client entry');

console.log('frontend UI truth guards: 11 assertions passed');
