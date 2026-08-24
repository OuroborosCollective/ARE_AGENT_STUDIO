import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '..', 'dist');
const indexPath = path.join(dist, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const entryMatch = html.match(/<script type="module" crossorigin src="(\/assets\/[^\"]+\.js)"><\/script>/);
const styleMatch = html.match(/<link rel="stylesheet" crossorigin href="(\/assets\/[^\"]+\.css)">/);

if (!entryMatch || !styleMatch) {
  throw new Error('Vite production entry or compiled stylesheet was not found in dist/index.html');
}

const entryAsset = entryMatch[1];
const entryPath = path.join(dist, entryAsset.replace(/^\//, ''));
const source = fs.readFileSync(entryPath, 'utf8');
const styleAsset = styleMatch[1];
const stylePath = path.join(dist, styleAsset.replace(/^\//, ''));
const stylesheet = fs.readFileSync(stylePath, 'utf8');

if (/\bimport\s*(?:\(|['"])/.test(source)) {
  throw new Error('Production entry is not self-contained and cannot be safely inlined');
}

const inlineSource = source.replace(/<\/script/gi, () => '<' + '\\' + '/script');

if (/<\/script/i.test(inlineSource)) {
  throw new Error('Production entry still contains an unescaped </script sequence');
}

const inlinedEntry = html.replace(
  entryMatch[0],
  () => `<script type="module" data-are-production-entry="inline">\n${inlineSource}\n</script>`,
);

if (/<\/style/i.test(stylesheet)) {
  throw new Error('Compiled stylesheet contains an unsafe </style sequence');
}

const inlined = inlinedEntry.replace(
  styleMatch[0],
  () => `<style data-are-production-styles="inline">\n${stylesheet}\n</style>`,
);

fs.writeFileSync(indexPath, inlined, 'utf8');
console.log(`inlined production entry and stylesheet: ${entryAsset}, ${styleAsset}`);
