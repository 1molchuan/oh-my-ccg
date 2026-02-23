import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { RpiState, ModeState, RalphState, TeamState, AutopilotState, AutopilotCompositeState, TeamRalphState, RpiPhase } from '../types.js';

export class StateManager {
  private readonly stateDir: string;

  constructor(workDir: string) {
    this.stateDir = join(workDir, '.oh-my-ccg', 'state');
  }

  private ensureDir(): void {
    if (!existsSync(this.stateDir)) {
      mkdirSync(this.stateDir, { recursive: true });
    }
  }

  private statePath(name: string): string {
    return join(this.stateDir, `${name}.json`);
  }

  private readJson<T>(filePath: string): T | null {
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
    } catch {
      return null;
    }
  }

  private writeJson(filePath: string, data: unknown): void {
    this.ensureDir();
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // ── RPI State ──────────────────────────────────────

  getRpiState(): RpiState | null {
    return this.readJson<RpiState>(this.statePath('rpi-state'));
  }

  saveRpiState(state: RpiState): void {
    state.updatedAt = new Date().toISOString();
    this.writeJson(this.statePath('rpi-state'), state);
  }

  createRpiState(changeName?: string): RpiState {
    const state: RpiState = {
      phase: 'init',
      changeId: null,
      changeName: changeName ?? null,
      constraints: [],
      decisions: {},
      pbtProperties: [],
      artifacts: { proposal: null, specs: [], design: [], tasks: null },
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveRpiState(state);
    return state;
  }

  transitionRpiPhase(targetPhase: RpiPhase, reason: string): RpiState {
    const state = this.getRpiState();
    if (!state) throw new Error('No active RPI state. Run /oh-my-ccg:init first.');

    const validTransitions: Record<RpiPhase, RpiPhase[]> = {
      init: ['research'],
      research: ['plan'],
      plan: ['impl'],
      impl: ['review', 'plan'],
      review: ['impl', 'plan'],
    };

    const allowed = validTransitions[state.phase];
    if (!allowed.includes(targetPhase)) {
      throw new Error(`Invalid transition: ${state.phase} → ${targetPhase}. Allowed: ${allowed.join(', ')}`);
    }

    state.history.push({
      from: state.phase,
      to: targetPhase,
      timestamp: new Date().toISOString(),
      reason,
    });
    state.phase = targetPhase;
    this.saveRpiState(state);
    return state;
  }

  clearRpiState(): void {
    const path = this.statePath('rpi-state');
    if (existsSync(path)) unlinkSync(path);
  }

  // ── Mode State ─────────────────────────────────────

  getModeState<T extends ModeState>(mode: string): T | null {
    return this.readJson<T>(this.statePath(`${mode}-state`));
  }

  saveModeState(mode: string, state: ModeState): void {
    state.updatedAt = new Date().toISOString();
    this.writeJson(this.statePath(`${mode}-state`), state);
  }

  clearModeState(mode: string): void {
    const path = this.statePath(`${mode}-state`);
    if (existsSync(path)) unlinkSync(path);
  }

  // ── Ralph ──────────────────────────────────────────

  initRalph(maxIterations = 10): RalphState {
    const state: RalphState = {
      mode: 'ralph',
      active: true,
      iteration: 0,
      maxIterations,
      lastVerification: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveModeState('ralph', state);
    return state;
  }

  // ── Team ───────────────────────────────────────────

  initTeam(teamName: string, totalTasks: number): TeamState {
    const state: TeamState = {
      mode: 'team',
      active: true,
      teamName,
      workers: 0,
      completedTasks: 0,
      totalTasks,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveModeState('team', state);
    return state;
  }

  // ── Autopilot ──────────────────────────────────────

  initAutopilot(): AutopilotState {
    const state: AutopilotState = {
      mode: 'autopilot',
      active: true,
      rpiPhase: 'init',
      autoTransition: true,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveModeState('autopilot', state);
    return state;
  }

  initAutopilotComposite(linkedRalph: boolean, linkedTeam: boolean): AutopilotCompositeState {
    const state: AutopilotCompositeState = {
      mode: 'autopilot',
      active: true,
      rpiPhase: 'init',
      autoTransition: true,
      linkedRalph,
      linkedTeam,
      contextPercent: 0,
      phasesCompleted: [],
      currentAction: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveModeState('autopilot', state);
    return state;
  }

  initTeamRalph(teamName: string, maxIterations: number, totalTasks: number): TeamRalphState {
    const state: TeamRalphState = {
      mode: 'ralph',
      active: true,
      iteration: 0,
      maxIterations,
      lastVerification: null,
      linkedTeam: {
        enabled: true,
        teamName,
        workers: 0,
        completedTasks: 0,
        totalTasks,
      },
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveModeState('ralph', state);
    return state;
  }

  // ── Queries ────────────────────────────────────────

  isAnyModeActive(): boolean {
    for (const mode of ['ralph', 'team', 'autopilot', 'autopilot-composite', 'ralph-team']) {
      const state = this.getModeState(mode);
      if (state?.active) return true;
    }
    // Also check composite states stored under their base mode keys
    const autopilot = this.getModeState<AutopilotCompositeState>('autopilot');
    if (autopilot?.active) return true;
    const ralph = this.getModeState<TeamRalphState>('ralph');
    if (ralph?.active) return true;
    return false;
  }

  getActiveModes(): string[] {
    const active: string[] = [];
    for (const mode of ['ralph', 'team', 'autopilot']) {
      const state = this.getModeState(mode);
      if (state?.active) {
        // Annotate composite modes with a suffix
        const autopilotState = mode === 'autopilot'
          ? this.getModeState<AutopilotCompositeState>('autopilot')
          : null;
        const ralphState = mode === 'ralph'
          ? this.getModeState<TeamRalphState>('ralph')
          : null;

        if (autopilotState?.active && 'phasesCompleted' in autopilotState) {
          active.push('autopilot-composite');
        } else if (ralphState?.active && 'linkedTeam' in ralphState) {
          active.push('ralph-team');
        } else {
          active.push(mode);
        }
      }
    }
    return active;
  }
}
