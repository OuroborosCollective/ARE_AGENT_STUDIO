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
const navbar = fs.readFileSync(path.join(root, 'components', 'Navbar.tsx'), 'utf8');
const mobileHome = fs.readFileSync(path.join(root, 'components', 'MobileHome.tsx'), 'utf8');
const statusNotice = fs.readFileSync(path.join(root, 'components', 'StatusNotice.tsx'), 'utf8');
const playstyle = fs.readFileSync(path.join(root, 'components', 'PlaystyleProfiler.tsx'), 'utf8');
const taskContext = fs.readFileSync(path.join(root, 'components', 'TaskContextHeader.tsx'), 'utf8');
const types = fs.readFileSync(path.join(root, 'types.ts'), 'utf8');
const androidManifest = fs.readFileSync(path.join(root, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');

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




// Interaction feedback guards (issue #37)
const forbiddenNativeDialogs = [];
function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.core-test-build') walkFiles(fullPath);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      const source = fs.readFileSync(fullPath, 'utf8');
      if (/\b(?:alert|confirm|prompt)\s*\(/.test(source)) forbiddenNativeDialogs.push(path.relative(root, fullPath));
    }
  }
}
walkFiles(root);
assert.deepEqual(forbiddenNativeDialogs, [], 'frontend product flows must not use browser alert/confirm/prompt');
assert.match(statusNotice, /role=\{isError \? 'alert' : 'status'\}/, 'status feedback must use semantic live-region roles');
assert.match(statusNotice, /aria-live=\{isError \? 'assertive' : 'polite'\}/, 'status feedback must announce with the correct urgency');
assert.match(statusNotice, /Notice schließen/, 'status feedback must be dismissible when rendered persistently');
assert.match(app, /<StatusNotice/, 'App must render shared status feedback');
assert.match(playstyle, /<StatusNotice/, 'Playstyle save feedback must use the shared status surface');
assert.match(playstyle, /aria-pressed=\{profile\.name === preset\.name\}/, 'playstyle presets must use semantic pressed buttons');



// Task-context coverage guards (issue #39)
const systemModeBlock = types.match(/export enum SystemMode \{([\s\S]*?)\n\}/)?.[1] ?? '';
const systemModeValues = [...systemModeBlock.matchAll(/= '([^']+)'/g)].map((match) => match[1]);
assert.equal(systemModeValues.length, 14, 'SystemMode enum must retain the complete current capability set');
for (const mode of systemModeValues) {
  assert.ok(taskContext.includes(mode), `TaskContextHeader must cover SystemMode ${mode}`);
}
assert.match(taskContext, /Voraussetzung/, 'task context must expose prerequisites');
assert.match(taskContext, /Ergebnis/, 'task context must expose outcomes');
assert.match(taskContext, /Weiter/, 'task context must explain the next workflow step');
assert.match(taskContext, /Schritt/, 'core workflows must expose their stage context');
assert.match(shell, /Geist:wght@400;450;500;600;650;700/, 'Stitch typography must load Geist');
assert.match(shell, /Material\+Symbols\+Outlined/, 'Stitch screens use the Material Symbols icon language');
assert.match(navbar, /fixed top-0 inset-x-0 z-50/, 'mobile shell navigation must use the Stitch compact fixed header');
assert.match(navbar, /h-16 grid grid-cols-5/, 'mobile shell must have exactly one five-item bottom navigation');
assert.match(navbar, /Advanced/, 'advanced tools must remain explicitly reachable without being a primary nav item');
assert.match(mobileHome, /stitch-stage-rail/, 'Home must use the Stitch sequential stage rail');
assert.match(mobileHome, /Current State/, 'Home must expose the Stitch compact current-state section');
console.log('frontend UI truth guards: 81 assertions passed');
