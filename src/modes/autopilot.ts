import type { AutopilotState, AutopilotCompositeState, RpiPhase } from '../types.js';
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
   * Start autopilot in composite mode with optional ralph and team linking.
   */
  startComposite(
    requirement?: string,
    options: { linkedRalph?: boolean; linkedTeam?: boolean } = {}
  ): AutopilotCompositeState {
    this.rpi.init(requirement);
    const composite = this.state.initAutopilotComposite(
      options.linkedRalph ?? false,
      options.linkedTeam ?? false
    );
    composite.rpiPhase = this.rpi.getCurrentPhase() ?? 'init';
    this.state.saveModeState('autopilot', composite);
    return composite;
  }

  /**
   * Get current state.
   */
  getState(): AutopilotState | null {
    return this.state.getModeState<AutopilotState>('autopilot');
  }

  /**
   * Get composite state (returns null if not in composite mode).
   */
  getCompositeState(): AutopilotCompositeState | null {
    const s = this.state.getModeState<AutopilotCompositeState>('autopilot');
    if (s && 'phasesCompleted' in s) return s;
    return null;
  }

  /**
   * Advance to the next RPI phase with auto-chaining support.
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

    // Record phase completion in composite state if applicable
    const composite = this.getCompositeState();
    if (composite && currentPhase) {
      this.recordPhaseCompletion(currentPhase);
    }

    autopilot.rpiPhase = nextPhase;
    this.state.saveModeState('autopilot', autopilot);

    return { nextPhase, autoTransition: autopilot.autoTransition };
  }

  /**
   * Return instructions for what should happen in each phase.
   */
  runPhase(phase: RpiPhase): string {
    const composite = this.getCompositeState();
    const linkedRalph = composite?.linkedRalph ?? false;
    const linkedTeam = composite?.linkedTeam ?? false;

    switch (phase) {
      case 'init':
        return 'Initialize RPI state and gather requirements. Run /oh-my-ccg:init to set up the change.';
      case 'research':
        return 'Run CCG research phase: launch Codex and Gemini in parallel to explore constraints. Use /ccg:spec-research.';
      case 'plan':
        return 'Run CCG planning phase: eliminate ambiguities, extract PBT properties. Use /ccg:spec-plan.';
      case 'impl':
        if (linkedTeam && linkedRalph) {
          return 'Spawn Team workers for parallel implementation tasks, then wrap in Ralph execute→verify→fix loop until all tasks verified.';
        }
        if (linkedTeam) {
          return 'Spawn Team workers for parallel implementation tasks. Monitor progress and complete all tasks.';
        }
        if (linkedRalph) {
          return 'Wrap implementation in Ralph execute→verify→fix loop: implement, verify (tests+build+LSP), fix issues, repeat until passing.';
        }
        return 'Run CCG implementation phase: route tasks to appropriate model, rewrite prototypes to production code. Use /ccg:spec-impl.';
      case 'review':
        return 'Run CCG review phase: dual-model cross-validation with Codex and Gemini in parallel. Use /ccg:spec-review.';
    }
  }

  /**
   * Check if Ralph mode should be started based on composite config.
   */
  shouldStartRalph(): boolean {
    const composite = this.getCompositeState();
    return composite?.linkedRalph === true;
  }

  /**
   * Check if Team mode should be started based on composite config.
   */
  shouldStartTeam(): boolean {
    const composite = this.getCompositeState();
    return composite?.linkedTeam === true;
  }

  /**
   * Record completion of a phase in composite state.
   */
  recordPhaseCompletion(phase: RpiPhase): void {
    const composite = this.getCompositeState();
    if (!composite) return;

    if (!composite.phasesCompleted.includes(phase)) {
      composite.phasesCompleted.push(phase);
    }
    composite.currentAction = null;
    this.state.saveModeState('autopilot', composite);
  }

  /**
   * Update the current action description in composite state.
   */
  setCurrentAction(action: string): void {
    const composite = this.getCompositeState();
    if (!composite) return;
    composite.currentAction = action;
    this.state.saveModeState('autopilot', composite);
  }

  /**
   * Check context usage and warn if approaching threshold.
   */
  checkContextUsage(contextPercent: number, threshold = 80): { shouldClear: boolean; message: string } {
    // Update composite state with current context percent
    const composite = this.getCompositeState();
    if (composite) {
      composite.contextPercent = contextPercent;
      this.state.saveModeState('autopilot', composite);
    }

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
    const composite = this.getCompositeState();

    const lines = [
      `Autopilot: ${autopilot.active ? 'ACTIVE' : 'INACTIVE'}`,
      `RPI Phase: ${autopilot.rpiPhase.toUpperCase()}`,
      `Auto-transition: ${autopilot.autoTransition ? 'ON' : 'OFF'}`,
    ];

    if (composite) {
      lines.push(`Composite Mode: ON`);
      lines.push(`  Linked Ralph: ${composite.linkedRalph ? 'YES' : 'NO'}`);
      lines.push(`  Linked Team:  ${composite.linkedTeam ? 'YES' : 'NO'}`);
      lines.push(`  Phases done: [${composite.phasesCompleted.join(', ')}]`);
      if (composite.currentAction) {
        lines.push(`  Current: ${composite.currentAction}`);
      }
      if (composite.contextPercent > 0) {
        lines.push(`  Context: ${composite.contextPercent}%`);
      }
    }

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
