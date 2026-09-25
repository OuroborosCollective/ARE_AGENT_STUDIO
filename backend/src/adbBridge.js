import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);

const SERIAL_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export function createAdbBridge({ enabled = false, allowedSerials = [], executor = execFileAsync } = {}) {
  const allow = new Set(allowedSerials.filter(Boolean));

  async function injectTap({ serial, x, y, width, height }) {
    if (!enabled) {
      const err = new Error('ADB bridge is disabled');
      err.code = 'ADB_DISABLED';
      throw err;
    }
    if (typeof serial !== 'string' || !SERIAL_RE.test(serial)) {
      const err = new Error('device serial must be a non-secret reference');
      err.code = 'ADB_INVALID_INPUT';
      throw err;
    }
    if (allow.size > 0 && !allow.has(serial)) {
      const err = new Error('device serial is not allowlisted');
      err.code = 'ADB_SERIAL_DENIED';
      throw err;
    }
    if (![x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
      const err = new Error('normalized x/y must be in [0,1]');
      err.code = 'ADB_INVALID_INPUT';
      throw err;
    }
    if (![width, height].every((v) => Number.isInteger(v) && v > 0 && v <= 16384)) {
      const err = new Error('invalid device resolution');
      err.code = 'ADB_INVALID_INPUT';
      throw err;
    }

    const pxX = Math.round(x * (width - 1));
    const pxY = Math.round(y * (height - 1));
    const started = performance.now();
    try {
      await executor('adb', ['-s', serial, 'shell', 'input', 'tap', String(pxX), String(pxY)], { timeout: 5000, windowsHide: true });
    } catch (cause) {
      // A device/adb execution failure is a bad-gateway condition, not a client
      // error. Previously this surfaced as an uncoded Error and was mapped to 400.
      const err = new Error(`adb execution failed: ${cause?.message || cause}`);
      err.code = 'ADB_EXECUTION_ERROR';
      throw err;
    }
    return { injected: true, serial, px_x: pxX, px_y: pxY, latency_ms: Number((performance.now() - started).toFixed(3)) };
  }

  return { injectTap, enabled };
}
