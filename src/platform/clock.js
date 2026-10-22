import { finite, integer, identifier } from '../contracts/validation.js';

/**
 * Fixed simulation clock. The host supplies active elapsed seconds and owns RAF.
 * advance(elapsed, (dt, tickIndex, simTime) => void) processes at most maxSteps.
 * Paused time is excluded, backlog is retained, invalid runs require reset.
 * No Date/performance/DOM or implicit wall-clock sampling occurs here.
 * @param {{step?:number,maxSteps?:number}} options
 */
export function createFixedClock({ step = 1 / 120, maxSteps = 8 } = {}) {
  finite(step, 'step', Number.MIN_VALUE);
  integer(maxSteps, 'maxSteps', 1);
  const maxLag = 0.1; // Spec: invalidate when active clock exceeds simulation by >100ms.
  const epsilon = step * 1e-9;
  let ticks = 0; let activeTime = 0; let timeCorrection = 0;
  let paused = false; let pauseReason = null; let valid = true; let advancing = false;
  const backlog = () => Math.max(0, activeTime - ticks * step);
  const snapshot = () => Object.freeze({
    step, maxSteps, ticks, simTime: ticks * step, activeTime, backlog: backlog(),
    alpha: Math.min(1, backlog() / step), paused, pauseReason, valid
  });
  function idle() { if (advancing) throw new Error('Clock cannot be changed during a step'); }
  return Object.freeze({
    advance(elapsed, onStep) {
      idle(); finite(elapsed, 'elapsed', 0);
      if (typeof onStep !== 'function') throw new TypeError('onStep must be a function');
      if (paused) return snapshot();
      // Compensated summation keeps frame rounding from accumulating into a
      // missing physics tick after minutes of otherwise identical elapsed time.
      const correctedElapsed = elapsed - timeCorrection;
      const nextTime = activeTime + correctedElapsed;
      finite(nextTime, 'elapsed total', 0);
      timeCorrection = (nextTime - activeTime) - correctedElapsed;
      activeTime = nextTime;
      advancing = true;
      try {
        let steps = 0;
        while (steps < maxSteps && backlog() + epsilon >= step) {
          const result = onStep(step, ticks, ticks * step);
          if (result && typeof result.then === 'function') throw new TypeError('Clock steps must be synchronous');
          ticks++; steps++;
        }
      } catch (error) {
        paused = true; valid = false; pauseReason = 'step-error';
        throw error;
      } finally { advancing = false; }
      if (backlog() > maxLag + epsilon) {
        paused = true; valid = false; pauseReason = 'overload';
      }
      return snapshot();
    },
    pause(reason = 'manual') { idle(); identifier(reason, 'pause reason'); paused = true; pauseReason = reason; return snapshot(); },
    resume() {
      idle();
      if (!valid) throw new Error('Invalid clock requires reset before resume');
      paused = false; pauseReason = null; return snapshot();
    },
    reset() { idle(); ticks = 0; activeTime = 0; timeCorrection = 0; paused = false; pauseReason = null; valid = true; return snapshot(); },
    snapshot
  });
}
