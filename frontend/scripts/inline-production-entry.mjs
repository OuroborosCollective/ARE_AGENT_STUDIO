import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '..', 'dist');
const indexPath = path.join(dist, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const entryMatch = html.match(/<script type="module" crossorigin src="(\/assets\/[^\"]+\.js)"><\/script>/);

if (!entryMatch) {
  throw new Error('Vite production entry was not found in dist/index.html');
}

const entryAsset = entryMatch[1];
const entryPath = path.join(dist, entryAsset.replace(/^\//, ''));
const source = fs.readFileSync(entryPath, 'utf8');

if (/\bimport\s*(?:\(|['"])/.test(source)) {
  throw new Error('Production entry is not self-contained and cannot be safely inlined');
}

const inlineSource = source.replace(/<\/script/gi, '<\\/script');
const inlined = html.replace(
  entryMatch[0],
  `<script type="module" data-are-production-entry="inline">\n${inlineSource}\n</script>`,
);

fs.writeFileSync(indexPath, inlined, 'utf8');
console.log(`inlined production entry: ${entryAsset}`);
