import type { RpiState, RpiPhase, RpiConstraint, PbtProperty } from '../types.js';
import { StateManager } from '../state/manager.js';

export class RpiEngine {
  private readonly state: StateManager;

  constructor(workDir: string) {
    this.state = new StateManager(workDir);
  }

  // ── Lifecycle ──────────────────────────────────────

  init(changeName?: string): RpiState {
    const existing = this.state.getRpiState();
    if (existing) {
      return existing;
    }
    return this.state.createRpiState(changeName);
  }

  getCurrentPhase(): RpiPhase | null {
    return this.state.getRpiState()?.phase ?? null;
  }

  getState(): RpiState | null {
    return this.state.getRpiState();
  }

  // ── Phase Transitions ─────────────────────────────

  startResearch(changeName: string): RpiState {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state. Run init first.');

    if (rpi.phase === 'init') {
      rpi.changeName = changeName;
      this.state.saveRpiState(rpi);
      return this.state.transitionRpiPhase('research', `Starting research: ${changeName}`);
    }

    if (rpi.phase === 'research') {
      return rpi; // Already in research phase
    }

    throw new Error(`Cannot start research from phase: ${rpi.phase}`);
  }

  startPlan(): RpiState {
    return this.state.transitionRpiPhase('plan', 'Starting plan phase');
  }

  startImpl(): RpiState {
    return this.state.transitionRpiPhase('impl', 'Starting implementation phase');
  }

  startReview(): RpiState {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state.');
    // Review can be started from impl
    if (rpi.phase === 'impl') {
      return this.state.transitionRpiPhase('review', 'Starting review phase');
    }
    throw new Error(`Cannot start review from phase: ${rpi.phase}`);
  }

  // ── Constraint Management ─────────────────────────

  addConstraint(constraint: Omit<RpiConstraint, 'id'>): RpiConstraint {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state.');

    const newConstraint: RpiConstraint = {
      ...constraint,
      id: `C${String(rpi.constraints.length + 1).padStart(3, '0')}`,
    };
    rpi.constraints.push(newConstraint);
    this.state.saveRpiState(rpi);
    return newConstraint;
  }

  getConstraints(type?: 'hard' | 'soft'): RpiConstraint[] {
    const rpi = this.state.getRpiState();
    if (!rpi) return [];
    if (!type) return rpi.constraints;
    return rpi.constraints.filter(c => c.type === type);
  }

  verifyConstraint(id: string): void {
    const rpi = this.state.getRpiState();
    if (!rpi) return;
    const constraint = rpi.constraints.find(c => c.id === id);
    if (constraint) {
      constraint.verified = true;
      this.state.saveRpiState(rpi);
    }
  }

  // ── Decision Tracking ─────────────────────────────

  recordDecision(key: string, value: string): void {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state.');
    rpi.decisions[key] = value;
    this.state.saveRpiState(rpi);
  }

  getDecisions(): Record<string, string> {
    return this.state.getRpiState()?.decisions ?? {};
  }

  // ── PBT Properties ────────────────────────────────

  addPbtProperty(prop: Omit<PbtProperty, 'id'>): PbtProperty {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state.');

    const newProp: PbtProperty = {
      ...prop,
      id: `PBT${String(rpi.pbtProperties.length + 1).padStart(3, '0')}`,
    };
    rpi.pbtProperties.push(newProp);
    this.state.saveRpiState(rpi);
    return newProp;
  }

  getPbtProperties(): PbtProperty[] {
    return this.state.getRpiState()?.pbtProperties ?? [];
  }

  // ── Artifact Tracking ─────────────────────────────

  setProposal(path: string): void {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state.');
    rpi.artifacts.proposal = path;
    this.state.saveRpiState(rpi);
  }

  addSpec(path: string): void {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state.');
    if (!rpi.artifacts.specs.includes(path)) {
      rpi.artifacts.specs.push(path);
      this.state.saveRpiState(rpi);
    }
  }

  addDesign(path: string): void {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state.');
    if (!rpi.artifacts.design.includes(path)) {
      rpi.artifacts.design.push(path);
      this.state.saveRpiState(rpi);
    }
  }

  setTasks(path: string): void {
    const rpi = this.state.getRpiState();
    if (!rpi) throw new Error('No RPI state.');
    rpi.artifacts.tasks = path;
    this.state.saveRpiState(rpi);
  }

  // ── Summary ────────────────────────────────────────

  getSummary(): string {
    const rpi = this.state.getRpiState();
    if (!rpi) return 'No active RPI session.';

    const lines = [
      `Phase: ${rpi.phase.toUpperCase()}`,
      `Change: ${rpi.changeName ?? '(none)'}`,
      `Constraints: ${rpi.constraints.filter(c => c.type === 'hard').length}H / ${rpi.constraints.filter(c => c.type === 'soft').length}S`,
      `Decisions: ${Object.keys(rpi.decisions).length}`,
      `PBT Properties: ${rpi.pbtProperties.length}`,
    ];

    if (rpi.artifacts.proposal) lines.push(`Proposal: ${rpi.artifacts.proposal}`);
    if (rpi.artifacts.tasks) lines.push(`Tasks: ${rpi.artifacts.tasks}`);
    if (rpi.artifacts.specs.length) lines.push(`Specs: ${rpi.artifacts.specs.length} files`);

    return lines.join('\n');
  }

  // ── Reset ──────────────────────────────────────────

  reset(): void {
    this.state.clearRpiState();
  }
}
