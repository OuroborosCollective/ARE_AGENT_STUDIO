import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processes = [
  spawn(process.execPath, ['--env-file-if-exists=backend/.env.local', 'backend/server.js'], { stdio: 'inherit' }),
  spawn(npmCommand, ['run', 'dev', '--prefix', 'frontend'], { stdio: 'inherit' }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) if (!child.killed) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 100).unref();
}
for (const child of processes) {
  child.on('exit', (code, signal) => {
    if (!stopping && (code ?? 0) !== 0) {
      console.error(`dev child exited (${signal || code}); stopping sibling process`);
      stop(code ?? 1);
    }
  });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
