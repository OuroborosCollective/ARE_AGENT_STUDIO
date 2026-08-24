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

const inlineStart = html.indexOf('data-are-production-entry="inline"');
const inlineEnd = html.indexOf('</script>', inlineStart);
assert.ok(inlineEnd > inlineStart, 'the embedded production entry must have a closing script tag');
const inlineEntry = html.slice(inlineStart, inlineEnd);
assert.doesNotMatch(inlineEntry, /<\/script/i, 'the embedded production entry must escape closing script sequences');
assert.doesNotMatch(inlineEntry, /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, 'the embedded entry must not contain duplicated page HTML');
const scriptEndsAfterInline = html.slice(inlineStart).match(/<\/script>/gi) ?? [];
assert.equal(scriptEndsAfterInline.length, 2, 'only the embedded entry and the boot fallback may close scripts after the inline entry begins');

console.log('frontend production entry regression: 7 assertions passed');
