import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const operationStudio = fs.readFileSync(path.join(root, 'components', 'OperationCorrectionStudio.tsx'), 'utf8');
const forgeControlRoom = fs.readFileSync(path.join(root, 'components', 'ForgeControlRoom.tsx'), 'utf8');
const observationRecorder = fs.readFileSync(path.join(root, 'components', 'ObservationRecorder.tsx'), 'utf8');
const tacticalMemory = fs.readFileSync(path.join(root, 'components', 'TacticalMemoryView.tsx'), 'utf8');
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

// Forge Control Room truth guards (issue #18)
assert.match(forgeControlRoom, /unavailable/, 'Forge Control Room must render unavailable as an explicit provenance label');
assert.match(forgeControlRoom, /—/, 'Forge Control Room must render unknown values as em-dash, never zero');
assert.doesNotMatch(forgeControlRoom, /mark.?verified|markVerified/i, 'Forge Control Room must not have a manual mark-verified button');
assert.doesNotMatch(forgeControlRoom, /paid.*autonomous|autonomous.*paid/i, 'Forge Control Room must not support autonomous paid run entry');
assert.match(forgeControlRoom, /local.observed|local_observed/, 'Forge Control Room must use local-observed provenance labels');
assert.match(forgeControlRoom, /forge.observed|forge_observed/, 'Forge Control Room must use Forge-observed provenance labels');
assert.match(forgeControlRoom, /verified/, 'Forge Control Room must use verified provenance labels');
assert.match(forgeControlRoom, /partial/, 'Forge Control Room must use partial provenance labels');
assert.match(forgeControlRoom, /derived/, 'Forge Control Room must use derived provenance labels');
assert.match(forgeControlRoom, /Practice/, 'Forge Control Room must gate practice mode explicitly');
assert.match(forgeControlRoom, /quarantine/i, 'Forge Control Room must support quarantine with owner reason');
assert.match(forgeControlRoom, /rights.*gate|rights.*unresolved/i, 'Forge Control Room must block public publish while rights gate is unresolved');
assert.match(app, /FORGE_CONTROL_ROOM/, 'App.tsx must integrate the Forge Control Room mode');

// ObservationRecorder truth-boundary guards (error-family big hunt)
assert.doesNotMatch(observationRecorder, /ESTIMATED HP/, 'HP must not be labeled "estimated"; it is detector-sourced or unobservable, never an estimate');
assert.match(observationRecorder, /HP \(DETECTOR\)/, 'HP field must be attributed to its detector source');
assert.doesNotMatch(observationRecorder, /\[0\.0000, 0\.0000\]/, 'an absent touch must not be rendered as a zero coordinate fact');
assert.match(observationRecorder, /hpPercentage == null/, 'unknown HP must be guarded before rendering, never shown as null%');
assert.match(observationRecorder, /\? '—'/, 'unknown/absent values must render as em-dash, never zero or null');

// TacticalMemoryView advisory truth-boundary guards (error-family big hunt)
assert.match(tacticalMemory, /Advisory est\./, 'advisory HP/Mana/Hostiles must be qualified as estimates, not observed game-state facts');
assert.doesNotMatch(tacticalMemory, />\s*HP: \{aiAnalysisResult\.hpEstimated\}%/, 'advisory HP must not be rendered as a bare observed fact');

console.log('frontend UI truth guards: 31 assertions passed');
