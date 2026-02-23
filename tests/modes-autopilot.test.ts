import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AutopilotEngine } from '../src/modes/autopilot.js';

describe('AutopilotEngine', () => {
  let workDir: string;
  let engine: AutopilotEngine;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'autopilot-test-'));
    engine = new AutopilotEngine(workDir);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  describe('start()', () => {
    it('initializes autopilot with active=true', () => {
      const state = engine.start();
      expect(state.active).toBe(true);
      expect(state.mode).toBe('autopilot');
      expect(state.rpiPhase).toBe('init');
    });

    it('initializes RPI state when requirement is provided', () => {
      const state = engine.start('Add user authentication');
      expect(state.active).toBe(true);
      // RPI engine should have been initialized with the requirement
      const rpiState = engine['rpi'].getState();
      expect(rpiState).not.toBeNull();
      expect(rpiState?.phase).toBe('init');
    });

    it('initializes without requirement', () => {
      const state = engine.start();
      expect(state.active).toBe(true);
      const rpiState = engine['rpi'].getState();
      expect(rpiState).not.toBeNull();
    });
  });

  describe('getState()', () => {
    it('returns null before start', () => {
      const state = engine.getState();
      expect(state).toBeNull();
    });

    it('returns state after start', () => {
      engine.start();
      const state = engine.getState();
      expect(state).not.toBeNull();
      expect(state?.active).toBe(true);
    });
  });

  describe('advancePhase()', () => {
    it('progresses from init to research', () => {
      engine.start();
      const result = engine.advancePhase();
      expect(result.nextPhase).toBe('research');
    });

    it('progresses from research to plan', () => {
      engine.start();
      engine.advancePhase(); // init -> research
      // Manually update RPI phase to research so advancePhase reads correctly
      const state = engine.getState()!;
      state.rpiPhase = 'research';
      engine['state'].saveModeState('autopilot', state);
      // Also transition RPI engine state
      engine['rpi']['state'].transitionRpiPhase('research', 'test');
      const result = engine.advancePhase();
      expect(result.nextPhase).toBe('plan');
    });

    it('progresses through all phases: init→research→plan→impl→review', () => {
      engine.start();
      const phases = ['research', 'plan', 'impl', 'review'] as const;

      for (const expectedPhase of phases) {
        const result = engine.advancePhase();
        expect(result.nextPhase).toBe(expectedPhase);

        // Sync autopilot rpiPhase with RPI engine for next advance
        if (expectedPhase !== 'review') {
          const s = engine.getState()!;
          s.rpiPhase = expectedPhase;
          engine['state'].saveModeState('autopilot', s);
          // Transition RPI state to match
          try {
            engine['rpi']['state'].transitionRpiPhase(expectedPhase, 'test');
          } catch {
            // ignore invalid transitions in test sync
          }
        }
      }
    });

    it('sets active=false after advancing past review phase', () => {
      engine.start();
      // Manually put state in review phase
      const s = engine.getState()!;
      s.rpiPhase = 'review';
      engine['state'].saveModeState('autopilot', s);
      // Also update RPI state to review (go through impl first)
      try {
        engine['rpi']['state'].transitionRpiPhase('research', 'test');
        engine['rpi']['state'].transitionRpiPhase('plan', 'test');
        engine['rpi']['state'].transitionRpiPhase('impl', 'test');
        engine['rpi']['state'].transitionRpiPhase('review', 'test');
      } catch {
        // ignore
      }

      const result = engine.advancePhase();
      expect(result.nextPhase).toBe('review');
      expect(engine.getState()?.active).toBe(false);
    });

    it('throws when autopilot is not active', () => {
      engine.start();
      engine.cancel();
      expect(() => engine.advancePhase()).toThrow('Autopilot not active.');
    });
  });

  describe('checkContextUsage()', () => {
    it('returns shouldClear=true when over threshold', () => {
      engine.start();
      const result = engine.checkContextUsage(85, 80);
      expect(result.shouldClear).toBe(true);
      expect(result.message).toContain('85%');
    });

    it('returns shouldClear=true when exactly at threshold', () => {
      engine.start();
      const result = engine.checkContextUsage(80, 80);
      expect(result.shouldClear).toBe(true);
    });

    it('returns shouldClear=false when under threshold', () => {
      engine.start();
      const result = engine.checkContextUsage(70, 80);
      expect(result.shouldClear).toBe(false);
      expect(result.message).toBe('');
    });

    it('uses default threshold of 80 when not specified', () => {
      engine.start();
      const over = engine.checkContextUsage(90);
      expect(over.shouldClear).toBe(true);
      const under = engine.checkContextUsage(79);
      expect(under.shouldClear).toBe(false);
    });
  });

  describe('getSummary()', () => {
    it('returns not-active message before start', () => {
      const summary = engine.getSummary();
      expect(summary).toBe('Autopilot not active.');
    });

    it('returns formatted string after start', () => {
      engine.start();
      const summary = engine.getSummary();
      expect(summary).toContain('Autopilot:');
      expect(summary).toContain('RPI Phase:');
    });
  });

  describe('cancel()', () => {
    it('sets active=false', () => {
      engine.start();
      expect(engine.getState()?.active).toBe(true);
      engine.cancel();
      expect(engine.getState()?.active).toBe(false);
    });

    it('is a no-op when not started', () => {
      expect(() => engine.cancel()).not.toThrow();
    });
  });

  describe('reset()', () => {
    it('clears state entirely', () => {
      engine.start();
      expect(engine.getState()).not.toBeNull();
      engine.reset();
      expect(engine.getState()).toBeNull();
    });
  });

  describe('startComposite()', () => {
    it('creates composite state with linkedRalph flag', () => {
      const composite = engine.startComposite('test', { linkedRalph: true, linkedTeam: false });
      expect(composite.linkedRalph).toBe(true);
      expect(composite.linkedTeam).toBe(false);
      expect(composite.active).toBe(true);
      expect(composite.phasesCompleted).toEqual([]);
    });

    it('creates composite state with linkedTeam flag', () => {
      const composite = engine.startComposite('test', { linkedRalph: false, linkedTeam: true });
      expect(composite.linkedTeam).toBe(true);
      expect(composite.linkedRalph).toBe(false);
    });

    it('creates composite state with both flags', () => {
      const composite = engine.startComposite('test', { linkedRalph: true, linkedTeam: true });
      expect(composite.linkedRalph).toBe(true);
      expect(composite.linkedTeam).toBe(true);
    });

    it('defaults flags to false when options omitted', () => {
      const composite = engine.startComposite('test');
      expect(composite.linkedRalph).toBe(false);
      expect(composite.linkedTeam).toBe(false);
    });
  });

  describe('recordPhaseCompletion()', () => {
    it('adds phase to phasesCompleted', () => {
      engine.startComposite('test');
      engine.recordPhaseCompletion('init');
      const composite = engine.getCompositeState();
      expect(composite?.phasesCompleted).toContain('init');
    });

    it('does not duplicate phases', () => {
      engine.startComposite('test');
      engine.recordPhaseCompletion('init');
      engine.recordPhaseCompletion('init');
      const composite = engine.getCompositeState();
      expect(composite?.phasesCompleted.filter(p => p === 'init').length).toBe(1);
    });

    it('is a no-op when not in composite mode', () => {
      engine.start();
      expect(() => engine.recordPhaseCompletion('init')).not.toThrow();
    });
  });

  describe('shouldStartRalph()', () => {
    it('returns true when linkedRalph is set', () => {
      engine.startComposite('test', { linkedRalph: true });
      expect(engine.shouldStartRalph()).toBe(true);
    });

    it('returns false when linkedRalph is not set', () => {
      engine.startComposite('test', { linkedRalph: false });
      expect(engine.shouldStartRalph()).toBe(false);
    });

    it('returns false when not in composite mode', () => {
      engine.start();
      expect(engine.shouldStartRalph()).toBe(false);
    });
  });

  describe('shouldStartTeam()', () => {
    it('returns true when linkedTeam is set', () => {
      engine.startComposite('test', { linkedTeam: true });
      expect(engine.shouldStartTeam()).toBe(true);
    });

    it('returns false when linkedTeam is not set', () => {
      engine.startComposite('test', { linkedTeam: false });
      expect(engine.shouldStartTeam()).toBe(false);
    });

    it('returns false when not in composite mode', () => {
      engine.start();
      expect(engine.shouldStartTeam()).toBe(false);
    });
  });
});
