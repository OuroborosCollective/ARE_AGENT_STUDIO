import { createHttpServer } from './src/httpServer.js';

const host = process.env.API_BACKEND_HOST || '127.0.0.1';
const port = Number(process.env.API_BACKEND_PORT || 8080);
const { server } = await createHttpServer();

server.listen(port, host, () => {
  console.log(`ARE Agent Studio dataset daemon listening at http://${host}:${port}`);
  console.log(`ADB bridge: ${String(process.env.ENABLE_ADB_BRIDGE).toLowerCase() === 'true' ? 'enabled' : 'disabled'}`);
  console.log(`Operation-correction writes: ${String(process.env.OPERATION_CORRECTION_WRITE_ENABLED).toLowerCase() === 'true' ? 'enabled' : 'disabled'}`);
  console.log(`Verified-imitation writes: ${String(process.env.VERIFIED_IMITATION_WRITE_ENABLED).toLowerCase() === 'true' ? 'enabled' : 'disabled'}`);
  console.log(`Dataset export: ${String(process.env.DATASET_EXPORT_ENABLED).toLowerCase() === 'true' ? 'enabled (authenticated only)' : 'disabled'}`);
});
