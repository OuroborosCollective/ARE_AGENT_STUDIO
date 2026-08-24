import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const forbiddenFiles = [
  'backend/.env.local',
  'frontend/services/geminiService.ts',
  'frontend/vertex-ai-proxy-interceptor.js',
];
for (const file of forbiddenFiles) if (fs.existsSync(file)) failures.push(`forbidden truth-path file exists: ${file}`);

const checks = [
  ['frontend/services', /\[BASE64_IMAGE_TENSOR\]|Math\.random\(|Production-grade/g],
  ['frontend/App.tsx', /Math\.random\(|enemiesDetected:\s*2\b|detectedHp:\s*85\b/g],
  ['frontend/components', /42(?:\.0)?\s*ms\s*VLA\s*Loop|4\.2\s*ms|12\.4\s*ms|Production Python Project Source Files/g],
];
function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target).flatMap((name) => walk(path.join(target, name)));
}
for (const [target, pattern] of checks) {
  for (const file of walk(target).filter((name) => /\.(ts|tsx|js)$/.test(name))) {
    const text = fs.readFileSync(file, 'utf8');
    if (pattern.test(text)) failures.push(`truth-scan pattern ${pattern} found in ${file}`);
    pattern.lastIndex = 0;
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('truth scan: production paths contain no known prototype evidence fallbacks');
