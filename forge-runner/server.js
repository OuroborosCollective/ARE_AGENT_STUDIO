/** Read-only process host. Boot does not imply a configured gameplay runner. */
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { ForgeRunner } from './runner.js';
import { createHealthHandler } from './health.js';

export async function startRunnerServer({ port = 8090, host = '127.0.0.1', dataDir = '/data', runner } = {}) {
  const instance = runner ?? new ForgeRunner({ dataDir, trajectoryStore: null, actionClient: null, policy: null, contract: null });
  await instance.restart();
  const server = http.createServer(createHealthHandler(instance));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const server = await startRunnerServer({
      port: Number(process.env.FORGE_RUNNER_PORT ?? 8090),
      host: process.env.FORGE_RUNNER_BIND ?? '127.0.0.1',
      dataDir: process.env.FORGE_RUNNER_DATA_DIR ?? '/data',
    });
    console.log(JSON.stringify({ process_alive: true, mode: 'read-only', gameplay: 'BLOCKED', port: server.address().port }));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
  } catch {
    console.error('Forge runner startup failed; inspect configuration and durable state privately.');
    process.exitCode = 1;
  }
}
