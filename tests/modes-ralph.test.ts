import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RalphLoop } from '../src/modes/ralph.js';

describe('RalphLoop', () => {
  let workDir: string;
  let ralph: RalphLoop;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'ralph-test-'));
    ralph = new RalphLoop(workDir);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  describe('start()', () => {
    it('creates ralph with iteration=0 and active=true', () => {
      const state = ralph.start();
      expect(state.active).toBe(true);
      expect(state.iteration).toBe(0);
      expect(state.mode).toBe('ralph');
    });

    it('uses default maxIterations of 10', () => {
      const state = ralph.start();
      expect(state.maxIterations).toBe(10);
    });

    it('respects custom maxIterations', () => {
      const state = ralph.start(5);
      expect(state.maxIterations).toBe(5);
    });

    it('starts with null lastVerification', () => {
      const state = ralph.start();
      expect(state.lastVerification).toBeNull();
    });
  });

  describe('getState()', () => {
    it('returns null before start', () => {
      expect(ralph.getState()).toBeNull();
    });

    it('returns state after start', () => {
      ralph.start();
      const state = ralph.getState();
      expect(state).not.toBeNull();
      expect(state?.active).toBe(true);
    });
  });

  describe('nextIteration()', () => {
    it('increments iteration', () => {
      ralph.start();
      const state = ralph.nextIteration();
      expect(state.iteration).toBe(1);
    });

    it('increments iteration multiple times', () => {
      ralph.start();
      ralph.nextIteration();
      const state = ralph.nextIteration();
      expect(state.iteration).toBe(2);
    });

    it('throws when ralph is not started', () => {
      expect(() => ralph.nextIteration()).toThrow('Ralph not active. Call start() first.');
    });

    it('throws when ralph is no longer active', () => {
      ralph.start();
      ralph.cancel();
      expect(() => ralph.nextIteration()).toThrow('Ralph is no longer active.');
    });
  });

  describe('recordVerification()', () => {
    it('sets active=false when passed=true', () => {
      ralph.start();
      const state = ralph.recordVerification({
        passed: true,
        tests: true,
        build: true,
        lsp: true,
        issues: [],
      });
      expect(state.active).toBe(false);
    });

    it('keeps active=true when passed=false', () => {
      ralph.start();
      const state = ralph.recordVerification({
        passed: false,
        tests: false,
        build: true,
        lsp: true,
        issues: ['test failures'],
      });
      expect(state.active).toBe(true);
    });

    it('records verification with timestamp', () => {
      ralph.start();
      ralph.recordVerification({
        passed: false,
        tests: false,
        build: true,
        lsp: true,
        issues: [],
      });
      const state = ralph.getState();
      expect(state?.lastVerification).not.toBeNull();
      expect(state?.lastVerification?.timestamp).toBeDefined();
    });

    it('records issues correctly', () => {
      ralph.start();
      const issues = ['build error', 'test failure'];
      ralph.recordVerification({ passed: false, tests: false, build: false, lsp: true, issues });
      const state = ralph.getState();
      expect(state?.lastVerification?.issues).toEqual(issues);
    });

    it('throws when ralph is not started', () => {
      expect(() =>
        ralph.recordVerification({ passed: true, tests: true, build: true, lsp: true, issues: [] })
      ).toThrow('Ralph not active.');
    });
  });

  describe('shouldContinue()', () => {
    it('returns continue=true when under max iterations', () => {
      ralph.start(10);
      const result = ralph.shouldContinue();
      expect(result.continue).toBe(true);
    });

    it('returns continue=false and sets active=false when at max iterations', () => {
      ralph.start(2);
      ralph.nextIteration();
      ralph.nextIteration();
      const result = ralph.shouldContinue();
      expect(result.continue).toBe(false);
      expect(result.reason).toContain('Max iterations reached');
      expect(ralph.getState()?.active).toBe(false);
    });

    it('returns continue=false when verification passed', () => {
      ralph.start();
      ralph.recordVerification({ passed: true, tests: true, build: true, lsp: true, issues: [] });
      // active is now false from recordVerification
      const result = ralph.shouldContinue();
      expect(result.continue).toBe(false);
    });

    it('returns continue=false when ralph not started', () => {
      const result = ralph.shouldContinue();
      expect(result.continue).toBe(false);
      expect(result.reason).toBe('Ralph not active');
    });

    it('returns continue=false when cancelled', () => {
      ralph.start();
      ralph.cancel();
      const result = ralph.shouldContinue();
      expect(result.continue).toBe(false);
    });

    it('includes iteration info in reason when continuing', () => {
      ralph.start(5);
      ralph.nextIteration();
      const result = ralph.shouldContinue();
      expect(result.continue).toBe(true);
      expect(result.reason).toContain('1/5');
    });
  });

  describe('getSummary()', () => {
    it('returns not-active message before start', () => {
      expect(ralph.getSummary()).toBe('Ralph not active.');
    });

    it('includes iteration info', () => {
      ralph.start(10);
      ralph.nextIteration();
      const summary = ralph.getSummary();
      expect(summary).toContain('Iteration: 1/10');
    });

    it('shows ACTIVE status when active', () => {
      ralph.start();
      expect(ralph.getSummary()).toContain('ACTIVE');
    });

    it('shows INACTIVE status after cancel', () => {
      ralph.start();
      ralph.cancel();
      expect(ralph.getSummary()).toContain('INACTIVE');
    });

    it('includes verification info when available', () => {
      ralph.start();
      ralph.recordVerification({ passed: false, tests: false, build: true, lsp: true, issues: ['err'] });
      const summary = ralph.getSummary();
      expect(summary).toContain('Last Verification');
      expect(summary).toContain('FAILED');
    });
  });

  describe('cancel()', () => {
    it('sets active=false', () => {
      ralph.start();
      expect(ralph.getState()?.active).toBe(true);
      ralph.cancel();
      expect(ralph.getState()?.active).toBe(false);
    });

    it('is a no-op when not started', () => {
      expect(() => ralph.cancel()).not.toThrow();
    });
  });

  describe('reset()', () => {
    it('clears state entirely', () => {
      ralph.start();
      expect(ralph.getState()).not.toBeNull();
      ralph.reset();
      expect(ralph.getState()).toBeNull();
    });
  });

  describe('startWithTeam()', () => {
    it('creates linked team state', () => {
      const state = ralph.startWithTeam('my-team', 5);
      expect(state.mode).toBe('ralph');
      expect(state.active).toBe(true);
      expect(state.maxIterations).toBe(5);
      expect(state.linkedTeam.enabled).toBe(true);
      expect(state.linkedTeam.teamName).toBe('my-team');
    });

    it('uses default maxIterations of 10', () => {
      const state = ralph.startWithTeam('my-team');
      expect(state.maxIterations).toBe(10);
    });

    it('getLinkedTeam() returns team name when enabled', () => {
      ralph.startWithTeam('alpha-team');
      expect(ralph.getLinkedTeam()).toBe('alpha-team');
    });

    it('getLinkedTeam() returns null for plain ralph', () => {
      ralph.start();
      expect(ralph.getLinkedTeam()).toBeNull();
    });

    it('getTeamRalphState() returns state when in team mode', () => {
      ralph.startWithTeam('beta-team');
      const teamState = ralph.getTeamRalphState();
      expect(teamState).not.toBeNull();
      expect(teamState?.linkedTeam.teamName).toBe('beta-team');
    });

    it('getTeamRalphState() returns null for plain ralph', () => {
      ralph.start();
      expect(ralph.getTeamRalphState()).toBeNull();
    });
  });
});
