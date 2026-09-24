/**
 * Forge runner run state machine — restart-safe state transitions.
 *
 * Implements issue #11: the run lifecycle state machine for the dedicated
 * Forge runner. Every transition is validated and persisted with evidence.
 *
 * States:
 *   IDLE → PREPARED → RUNNING → TERMINAL_LOCAL → RECONCILING
 *   RECONCILING → RECONCILED | PARTIAL | QUARANTINED
 *   RECONCILED → LEARNING_ELIGIBLE
 *   PARTIAL → LEARNING_ELIGIBLE | QUARANTINED
 *   LEARNING_ELIGIBLE (terminal)
 *   QUARANTINED (terminal)
 *
 * This file must not import protected visual-path modules or reference the
 * frozen visual-control schema. The static guard enforces this.
 */

export const RUN_STATES = {
  IDLE: 'IDLE',
  PREPARED: 'PREPARED',
  RUNNING: 'RUNNING',
  TERMINAL_LOCAL: 'TERMINAL_LOCAL',
  RECONCILING: 'RECONCILING',
  RECONCILED: 'RECONCILED',
  PARTIAL: 'PARTIAL',
  LEARNING_ELIGIBLE: 'LEARNING_ELIGIBLE',
  QUARANTINED: 'QUARANTINED',
};

const TRANSITIONS = {
  IDLE: ['PREPARED'],
  PREPARED: ['RUNNING', 'IDLE'],
  RUNNING: ['TERMINAL_LOCAL', 'RECONCILING'],
  TERMINAL_LOCAL: ['RECONCILING'],
  RECONCILING: ['RECONCILED', 'PARTIAL', 'QUARANTINED'],
  RECONCILED: ['LEARNING_ELIGIBLE'],
  PARTIAL: ['LEARNING_ELIGIBLE', 'QUARANTINED'],
  LEARNING_ELIGIBLE: [],
  QUARANTINED: [],
};

const TERMINAL_STATES = new Set(['LEARNING_ELIGIBLE', 'QUARANTINED']);

export function isValidTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function isTerminalState(state) {
  return TERMINAL_STATES.has(state);
}

/**
 * Create a run state machine with transition validation and history.
 * The history is an evidence record of every transition.
 */
export function createRunStateMachine(initialState = RUN_STATES.IDLE) {
  let state = initialState;
  const history = [{ state, transition: null, at: Date.now() }];

  return {
    get state() {
      return state;
    },

    get history() {
      return [...history];
    },

    canTransitionTo(to) {
      return isValidTransition(state, to);
    },

    transition(to, evidence = {}) {
      if (!isValidTransition(state, to)) {
        const error = new Error(`Invalid run state transition: ${state} → ${to}`);
        error.code = 'INVALID_TRANSITION';
        error.from = state;
        error.to = to;
        throw error;
      }
      const from = state;
      state = to;
      history.push({ state, transition: { from, to }, at: Date.now(), evidence });
      return { from, to };
    },

    isTerminal() {
      return isTerminalState(state);
    },
  };
}
