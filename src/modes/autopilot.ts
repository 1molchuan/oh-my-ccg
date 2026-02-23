import type { AutopilotState, RpiPhase } from '../types.js';
import { StateManager } from '../state/manager.js';
import { RpiEngine } from '../rpi/engine.js';

export class AutopilotEngine {
  private readonly state: StateManager;
  private readonly rpi: RpiEngine;

  constructor(workDir: string) {
    this.state = new StateManager(workDir);
    this.rpi = new RpiEngine(workDir);
  }

  /**
   * Start autopilot with a requirement.
   */
  start(requirement?: string): AutopilotState {
    // Initialize RPI if needed
    this.rpi.init(requirement);

    const autopilot = this.state.initAutopilot();
    autopilot.rpiPhase = this.rpi.getCurrentPhase() ?? 'init';
    this.state.saveModeState('autopilot', autopilot);
    return autopilot;
  }

  /**
   * Get current state.
   */
  getState(): AutopilotState | null {
    return this.state.getModeState<AutopilotState>('autopilot');
  }

  /**
   * Advance to the next RPI phase.
   */
  advancePhase(): { nextPhase: RpiPhase; autoTransition: boolean } {
    const autopilot = this.getState();
    if (!autopilot?.active) throw new Error('Autopilot not active.');

    const currentPhase = this.rpi.getCurrentPhase();
    const phaseOrder: RpiPhase[] = ['init', 'research', 'plan', 'impl', 'review'];
    const currentIndex = phaseOrder.indexOf(currentPhase ?? 'init');
    const nextPhase = phaseOrder[currentIndex + 1];

    if (!nextPhase) {
      // Completed all phases
      autopilot.active = false;
      this.state.saveModeState('autopilot', autopilot);
      return { nextPhase: 'review', autoTransition: false };
    }

    autopilot.rpiPhase = nextPhase;
    this.state.saveModeState('autopilot', autopilot);

    return { nextPhase, autoTransition: autopilot.autoTransition };
  }

  /**
   * Check context usage and suggest /clear if threshold exceeded.
   */
  checkContextUsage(contextPercent: number, threshold = 80): { shouldClear: boolean; message: string } {
    if (contextPercent >= threshold) {
      return {
        shouldClear: true,
        message: `Context usage at ${contextPercent}% (threshold: ${threshold}%). Suggest /clear to continue. State is persisted in .oh-my-ccg/state/.`,
      };
    }
    return { shouldClear: false, message: '' };
  }

  /**
   * Get autopilot summary.
   */
  getSummary(): string {
    const autopilot = this.getState();
    if (!autopilot) return 'Autopilot not active.';

    const rpiState = this.rpi.getState();
    const lines = [
      `Autopilot: ${autopilot.active ? 'ACTIVE' : 'INACTIVE'}`,
      `RPI Phase: ${autopilot.rpiPhase.toUpperCase()}`,
      `Auto-transition: ${autopilot.autoTransition ? 'ON' : 'OFF'}`,
    ];

    if (rpiState) {
      lines.push(`Change: ${rpiState.changeName ?? '(none)'}`);
      lines.push(`Constraints: ${rpiState.constraints.length}`);
    }

    return lines.join('\n');
  }

  /**
   * Cancel autopilot.
   */
  cancel(): void {
    const autopilot = this.getState();
    if (autopilot) {
      autopilot.active = false;
      this.state.saveModeState('autopilot', autopilot);
    }
  }

  /**
   * Force reset.
   */
  reset(): void {
    this.state.clearModeState('autopilot');
  }
}
