import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(here, '..', 'dist', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

assert.match(html, /data-are-production-entry="inline"/, 'the production entry must be embedded in the rendered HTML');
const beforeInlineEntry = html.slice(0, html.indexOf('data-are-production-entry="inline"'));
assert.doesNotMatch(beforeInlineEntry, /<script type="module" crossorigin src="\/assets\/[^\"]+\.js"><\/script>/, 'the public page must not depend on an external module entry request');
assert.match(html, /ARE Studio client startup failed/, 'the embedded entry must include the runtime failure boundary');

console.log('frontend production entry regression: 3 assertions passed');
