/**
 * Forge runner health endpoint — private readiness readback.
 *
 * Implements issue #11: exposes private health/readiness that distinguishes:
 *   - process alive
 *   - contract reachable
 *   - credential configured
 *   - active run state
 *   - ledger trusted
 *   - reconciliation backlog
 *
 * This file must not import protected visual-path modules or reference the
 * frozen visual-control schema. The static guard enforces this.
 */

export function getRunnerHealth(runner) {
  return {
    process_alive: true,
    contract_loaded: runner.contract != null,
    contract_reachable: runner.contractReadbackVerified === true,
    credential_configured: runner.actionClient?.vault?.hasCredentials?.() ?? false,
    active_run_state: runner.stateMachine?.state ?? 'IDLE',
    ledger_trusted: runner.trajectoryStore?.initialized ?? false,
    reconciliation_backlog: runner.reconciliationBacklog ?? 0,
  };
}

/**
 * Create a minimal HTTP health handler for the runner.
 * Returns a function suitable for http.createServer.
 */
export function createHealthHandler(runner) {
  return (req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' });
      res.end();
      return;
    }
    if (req.url === '/health' || req.url === '/ready') {
      const health = getRunnerHealth(runner);
      const ready = health.process_alive && health.contract_reachable && health.credential_configured
        && health.ledger_trusted && health.reconciliation_backlog === 0
        && runner.qualificationReady === true;
      const allHealthy = req.url === '/health' ? health.process_alive : ready;
      health.ready = ready;
      res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  };
}
