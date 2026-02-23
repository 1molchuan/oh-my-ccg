import type { RalphState, RalphVerification, TeamRalphState } from '../types.js';
import { StateManager } from '../state/manager.js';

export class RalphLoop {
  private readonly state: StateManager;

  constructor(workDir: string) {
    this.state = new StateManager(workDir);
  }

  /**
   * Start a new ralph loop.
   */
  start(maxIterations = 10): RalphState {
    return this.state.initRalph(maxIterations);
  }

  /**
   * Start ralph loop with team linking for composite orchestration.
   */
  startWithTeam(teamName: string, maxIterations = 10): TeamRalphState {
    return this.state.initTeamRalph(teamName, maxIterations, 0);
  }

  /**
   * Get current ralph state.
   */
  getState(): RalphState | null {
    return this.state.getModeState<RalphState>('ralph');
  }

  /**
   * Get team-linked ralph state (returns null if not in team-linked mode).
   */
  getTeamRalphState(): TeamRalphState | null {
    const s = this.state.getModeState<TeamRalphState>('ralph');
    if (s && 'linkedTeam' in s) return s;
    return null;
  }

  /**
   * Get the linked team name if a team is associated, otherwise null.
   */
  getLinkedTeam(): string | null {
    const teamRalph = this.getTeamRalphState();
    if (!teamRalph) return null;
    return teamRalph.linkedTeam.enabled ? teamRalph.linkedTeam.teamName : null;
  }

  /**
   * Advance to next iteration.
   */
  nextIteration(): RalphState {
    const ralph = this.getState();
    if (!ralph) throw new Error('Ralph not active. Call start() first.');
    if (!ralph.active) throw new Error('Ralph is no longer active.');

    ralph.iteration++;
    this.state.saveModeState('ralph', ralph);
    return ralph;
  }

  /**
   * Record a verification result for the current iteration.
   */
  recordVerification(verification: Omit<RalphVerification, 'timestamp'>): RalphState {
    const ralph = this.getState();
    if (!ralph) throw new Error('Ralph not active.');

    ralph.lastVerification = {
      ...verification,
      timestamp: new Date().toISOString(),
    };

    // If all checks pass, mark as complete
    if (verification.passed) {
      ralph.active = false;
    }

    this.state.saveModeState('ralph', ralph);
    return ralph;
  }

  /**
   * Check if the loop should continue.
   */
  shouldContinue(): { continue: boolean; reason: string } {
    const ralph = this.getState();
    if (!ralph) return { continue: false, reason: 'Ralph not active' };
    if (!ralph.active) return { continue: false, reason: 'Ralph completed or cancelled' };

    if (ralph.iteration >= ralph.maxIterations) {
      ralph.active = false;
      this.state.saveModeState('ralph', ralph);
      return { continue: false, reason: `Max iterations reached (${ralph.maxIterations})` };
    }

    if (ralph.lastVerification?.passed) {
      ralph.active = false;
      this.state.saveModeState('ralph', ralph);
      return { continue: false, reason: 'Verification passed' };
    }

    return { continue: true, reason: `Iteration ${ralph.iteration}/${ralph.maxIterations}` };
  }

  /**
   * Get summary of current ralph state.
   */
  getSummary(): string {
    const ralph = this.getState();
    if (!ralph) return 'Ralph not active.';

    const teamRalph = this.getTeamRalphState();
    const lines = [
      `Ralph Loop: ${ralph.active ? 'ACTIVE' : 'INACTIVE'}`,
      `Iteration: ${ralph.iteration}/${ralph.maxIterations}`,
    ];

    if (teamRalph?.linkedTeam.enabled) {
      const lt = teamRalph.linkedTeam;
      lines.push(`Linked Team: ${lt.teamName ?? '(none)'}`);
      lines.push(`  Workers: ${lt.workers} | Tasks: ${lt.completedTasks}/${lt.totalTasks}`);
    }

    if (ralph.lastVerification) {
      const v = ralph.lastVerification;
      lines.push(`Last Verification: ${v.passed ? 'PASSED' : 'FAILED'}`);
      lines.push(`  Tests: ${v.tests ? 'OK' : 'FAIL'} | Build: ${v.build ? 'OK' : 'FAIL'} | LSP: ${v.lsp ? 'OK' : 'FAIL'}`);
      if (v.issues.length > 0) {
        lines.push(`  Issues: ${v.issues.join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Cancel the ralph loop.
   */
  cancel(): void {
    const ralph = this.getState();
    if (ralph) {
      ralph.active = false;
      this.state.saveModeState('ralph', ralph);
    }
  }

  /**
   * Force clear ralph state.
   */
  reset(): void {
    this.state.clearModeState('ralph');
  }
}
