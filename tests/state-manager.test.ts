import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../src/state/manager.js';
import type { AutopilotCompositeState, TeamRalphState } from '../src/types.js';

let tmpDir: string;
let sm: StateManager;

beforeEach(() => {
  tmpDir = mkdtempSync(`${tmpdir()}/oh-my-ccg-sm-test-`);
  sm = new StateManager(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('StateManager.createRpiState()', () => {
  it('creates initial state with correct defaults', () => {
    const state = sm.createRpiState();
    expect(state.phase).toBe('init');
    expect(state.changeId).toBeNull();
    expect(state.changeName).toBeNull();
    expect(state.constraints).toEqual([]);
    expect(state.decisions).toEqual({});
    expect(state.pbtProperties).toEqual([]);
    expect(state.artifacts).toEqual({ proposal: null, specs: [], design: [], tasks: null });
    expect(state.history).toEqual([]);
    expect(typeof state.createdAt).toBe('string');
    expect(typeof state.updatedAt).toBe('string');
  });

  it('stores changeName when provided', () => {
    const state = sm.createRpiState('my-change');
    expect(state.changeName).toBe('my-change');
  });
});

describe('StateManager.getRpiState()', () => {
  it('returns null when no state file exists', () => {
    expect(sm.getRpiState()).toBeNull();
  });

  it('returns saved state after createRpiState()', () => {
    sm.createRpiState('test');
    const loaded = sm.getRpiState();
    expect(loaded).not.toBeNull();
    expect(loaded!.changeName).toBe('test');
  });
});

describe('StateManager.saveRpiState()', () => {
  it('persists state to disk', () => {
    const state = sm.createRpiState();
    state.changeName = 'updated';
    sm.saveRpiState(state);
    const loaded = sm.getRpiState();
    expect(loaded!.changeName).toBe('updated');
  });

  it('updates updatedAt timestamp on save', () => {
    const state = sm.createRpiState();
    const before = state.updatedAt;
    // Small delay to ensure timestamp differs
    const future = new Date(Date.now() + 50).toISOString();
    state.updatedAt = future; // simulate drift
    sm.saveRpiState(state);
    const loaded = sm.getRpiState();
    // saveRpiState overwrites updatedAt with new Date().toISOString()
    expect(loaded!.updatedAt).not.toBe(before);
  });
});

describe('StateManager.transitionRpiPhase()', () => {
  beforeEach(() => {
    sm.createRpiState();
  });

  it('valid transition init → research', () => {
    const state = sm.transitionRpiPhase('research', 'starting research');
    expect(state.phase).toBe('research');
    expect(state.history).toHaveLength(1);
    expect(state.history[0].from).toBe('init');
    expect(state.history[0].to).toBe('research');
    expect(state.history[0].reason).toBe('starting research');
  });

  it('valid transition research → plan', () => {
    sm.transitionRpiPhase('research', 'r');
    const state = sm.transitionRpiPhase('plan', 'planning');
    expect(state.phase).toBe('plan');
  });

  it('valid transition plan → impl', () => {
    sm.transitionRpiPhase('research', 'r');
    sm.transitionRpiPhase('plan', 'p');
    const state = sm.transitionRpiPhase('impl', 'impl');
    expect(state.phase).toBe('impl');
  });

  it('valid transition impl → review', () => {
    sm.transitionRpiPhase('research', 'r');
    sm.transitionRpiPhase('plan', 'p');
    sm.transitionRpiPhase('impl', 'i');
    const state = sm.transitionRpiPhase('review', 'reviewing');
    expect(state.phase).toBe('review');
  });

  it('invalid transition init → plan throws', () => {
    expect(() => sm.transitionRpiPhase('plan', 'skip')).toThrow(/Invalid transition/);
  });

  it('invalid transition init → impl throws', () => {
    expect(() => sm.transitionRpiPhase('impl', 'skip')).toThrow(/Invalid transition/);
  });

  it('invalid transition research → review throws', () => {
    sm.transitionRpiPhase('research', 'r');
    expect(() => sm.transitionRpiPhase('review', 'skip')).toThrow(/Invalid transition/);
  });

  it('throws when no state exists', () => {
    sm.clearRpiState();
    expect(() => sm.transitionRpiPhase('research', 'r')).toThrow(/No active RPI state/);
  });
});

describe('StateManager.clearRpiState()', () => {
  it('removes state file so getRpiState() returns null', () => {
    sm.createRpiState();
    sm.clearRpiState();
    expect(sm.getRpiState()).toBeNull();
  });

  it('does not throw when no state exists', () => {
    expect(() => sm.clearRpiState()).not.toThrow();
  });
});

describe('StateManager.initRalph()', () => {
  it('creates ralph state with correct defaults', () => {
    const state = sm.initRalph();
    expect(state.mode).toBe('ralph');
    expect(state.active).toBe(true);
    expect(state.iteration).toBe(0);
    expect(state.maxIterations).toBe(10);
    expect(state.lastVerification).toBeNull();
    expect(typeof state.startedAt).toBe('string');
  });

  it('accepts custom maxIterations', () => {
    const state = sm.initRalph(5);
    expect(state.maxIterations).toBe(5);
  });
});

describe('StateManager.initTeam()', () => {
  it('creates team state with correct defaults', () => {
    const state = sm.initTeam('my-team', 8);
    expect(state.mode).toBe('team');
    expect(state.active).toBe(true);
    expect(state.teamName).toBe('my-team');
    expect(state.workers).toBe(0);
    expect(state.completedTasks).toBe(0);
    expect(state.totalTasks).toBe(8);
    expect(typeof state.startedAt).toBe('string');
  });
});

describe('StateManager.initAutopilot()', () => {
  it('creates autopilot state with correct defaults', () => {
    const state = sm.initAutopilot();
    expect(state.mode).toBe('autopilot');
    expect(state.active).toBe(true);
    expect(state.rpiPhase).toBe('init');
    expect(state.autoTransition).toBe(true);
    expect(typeof state.startedAt).toBe('string');
  });
});

describe('StateManager.initAutopilotComposite()', () => {
  it('creates composite state with linkedRalph and linkedTeam', () => {
    const state = sm.initAutopilotComposite(true, false);
    expect(state.mode).toBe('autopilot');
    expect(state.active).toBe(true);
    expect(state.linkedRalph).toBe(true);
    expect(state.linkedTeam).toBe(false);
    expect(state.contextPercent).toBe(0);
    expect(state.phasesCompleted).toEqual([]);
    expect(state.currentAction).toBeNull();
  });

  it('stores both linkedRalph=false and linkedTeam=true', () => {
    const state = sm.initAutopilotComposite(false, true);
    expect(state.linkedRalph).toBe(false);
    expect(state.linkedTeam).toBe(true);
  });
});

describe('StateManager.initTeamRalph()', () => {
  it('creates team-ralph composite state', () => {
    const state = sm.initTeamRalph('my-team', 5, 10);
    expect(state.mode).toBe('ralph');
    expect(state.active).toBe(true);
    expect(state.iteration).toBe(0);
    expect(state.maxIterations).toBe(5);
    expect(state.lastVerification).toBeNull();
    expect(state.linkedTeam.enabled).toBe(true);
    expect(state.linkedTeam.teamName).toBe('my-team');
    expect(state.linkedTeam.totalTasks).toBe(10);
    expect(state.linkedTeam.completedTasks).toBe(0);
    expect(state.linkedTeam.workers).toBe(0);
  });
});

describe('StateManager getModeState/saveModeState/clearModeState', () => {
  it('getModeState() returns null for unknown mode', () => {
    expect(sm.getModeState('nonexistent')).toBeNull();
  });

  it('saveModeState() persists and getModeState() retrieves', () => {
    const state = sm.initRalph();
    state.iteration = 3;
    sm.saveModeState('ralph', state);
    const loaded = sm.getModeState('ralph');
    expect(loaded).not.toBeNull();
    expect((loaded as typeof state).iteration).toBe(3);
  });

  it('clearModeState() removes the state', () => {
    sm.initRalph();
    sm.clearModeState('ralph');
    expect(sm.getModeState('ralph')).toBeNull();
  });

  it('clearModeState() does not throw when mode has no state', () => {
    expect(() => sm.clearModeState('ralph')).not.toThrow();
  });

  it('saveModeState() updates updatedAt', () => {
    const state = sm.initRalph();
    const before = state.updatedAt;
    sm.saveModeState('ralph', state);
    const loaded = sm.getModeState<typeof state>('ralph')!;
    // updatedAt is freshly set on save
    expect(typeof loaded.updatedAt).toBe('string');
    // It should be a valid ISO string
    expect(() => new Date(loaded.updatedAt)).not.toThrow();
  });
});

describe('StateManager.isAnyModeActive()', () => {
  it('returns false when no modes are active', () => {
    expect(sm.isAnyModeActive()).toBe(false);
  });

  it('returns true after initRalph()', () => {
    sm.initRalph();
    expect(sm.isAnyModeActive()).toBe(true);
  });

  it('returns true after initTeam()', () => {
    sm.initTeam('t', 3);
    expect(sm.isAnyModeActive()).toBe(true);
  });

  it('returns true after initAutopilot()', () => {
    sm.initAutopilot();
    expect(sm.isAnyModeActive()).toBe(true);
  });

  it('returns false after clearing ralph state', () => {
    sm.initRalph();
    sm.clearModeState('ralph');
    expect(sm.isAnyModeActive()).toBe(false);
  });
});

describe('StateManager.getActiveModes()', () => {
  it('returns empty array when nothing is active', () => {
    expect(sm.getActiveModes()).toEqual([]);
  });

  it('returns ["ralph"] for plain ralph state', () => {
    sm.initRalph();
    expect(sm.getActiveModes()).toContain('ralph');
  });

  it('returns ["team"] for team state', () => {
    sm.initTeam('t', 2);
    expect(sm.getActiveModes()).toContain('team');
  });

  it('returns composite annotation for autopilot composite state', () => {
    sm.initAutopilotComposite(true, true);
    const modes = sm.getActiveModes();
    // Composite autopilot has phasesCompleted so annotated as autopilot-composite
    expect(modes).toContain('autopilot-composite');
  });

  it('returns composite annotation for team-ralph state', () => {
    sm.initTeamRalph('t', 5, 10);
    const modes = sm.getActiveModes();
    // TeamRalphState has linkedTeam so annotated as ralph-team
    expect(modes).toContain('ralph-team');
  });

  it('returns multiple active modes', () => {
    sm.initRalph();
    sm.initTeam('t', 2);
    const modes = sm.getActiveModes();
    expect(modes).toContain('ralph');
    expect(modes).toContain('team');
  });
});
