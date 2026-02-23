import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RpiEngine } from '../src/rpi/engine.js';

let tmpDir: string;
let engine: RpiEngine;

beforeEach(() => {
  tmpDir = mkdtempSync(`${tmpdir()}/oh-my-ccg-test-`);
  engine = new RpiEngine(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('RpiEngine.init()', () => {
  it('creates fresh state with phase=init when no state exists', () => {
    const state = engine.init();
    expect(state.phase).toBe('init');
    expect(state.constraints).toEqual([]);
    expect(state.decisions).toEqual({});
    expect(state.pbtProperties).toEqual([]);
    expect(state.changeId).toBeNull();
  });

  it('returns existing state if already initialized', () => {
    const first = engine.init();
    const second = engine.init();
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('stores changeName when provided', () => {
    const state = engine.init('my-feature');
    expect(state.changeName).toBe('my-feature');
  });
});

describe('RpiEngine phase transitions', () => {
  beforeEach(() => {
    engine.init();
  });

  it('startResearch() transitions init → research and sets changeName', () => {
    const state = engine.startResearch('feat-auth');
    expect(state.phase).toBe('research');
    expect(state.changeName).toBe('feat-auth');
  });

  it('startResearch() returns same state if already in research phase', () => {
    engine.startResearch('feat-auth');
    const state = engine.startResearch('feat-auth');
    expect(state.phase).toBe('research');
  });

  it('startPlan() transitions research → plan', () => {
    engine.startResearch('feat-auth');
    const state = engine.startPlan();
    expect(state.phase).toBe('plan');
  });

  it('startImpl() transitions plan → impl', () => {
    engine.startResearch('feat-auth');
    engine.startPlan();
    const state = engine.startImpl();
    expect(state.phase).toBe('impl');
  });

  it('startReview() transitions impl → review', () => {
    engine.startResearch('feat-auth');
    engine.startPlan();
    engine.startImpl();
    const state = engine.startReview();
    expect(state.phase).toBe('review');
  });

  it('invalid transition init → plan throws an error', () => {
    // Still in init phase; going directly to plan should fail
    expect(() => engine.startPlan()).toThrow(/Invalid transition/);
  });

  it('invalid transition init → review throws an error', () => {
    expect(() => engine.startReview()).toThrow(/Cannot start review from phase: init/);
  });

  it('startResearch() throws when called from plan phase', () => {
    engine.startResearch('feat-auth');
    engine.startPlan();
    expect(() => engine.startResearch('feat-auth')).toThrow(/Cannot start research from phase: plan/);
  });
});

describe('RpiEngine.addConstraint()', () => {
  beforeEach(() => {
    engine.init();
  });

  it('adds constraint with auto-generated ID C001', () => {
    const c = engine.addConstraint({
      type: 'hard',
      description: 'Must be fast',
      source: 'user',
      verified: false,
    });
    expect(c.id).toBe('C001');
    expect(c.description).toBe('Must be fast');
  });

  it('increments IDs sequentially: C001, C002', () => {
    const c1 = engine.addConstraint({ type: 'hard', description: 'First', source: 'user', verified: false });
    const c2 = engine.addConstraint({ type: 'soft', description: 'Second', source: 'codex', verified: false });
    expect(c1.id).toBe('C001');
    expect(c2.id).toBe('C002');
  });
});

describe('RpiEngine.getConstraints()', () => {
  beforeEach(() => {
    engine.init();
    engine.addConstraint({ type: 'hard', description: 'Hard one', source: 'user', verified: false });
    engine.addConstraint({ type: 'soft', description: 'Soft one', source: 'gemini', verified: false });
    engine.addConstraint({ type: 'hard', description: 'Another hard', source: 'claude', verified: false });
  });

  it('returns all constraints when no type filter', () => {
    expect(engine.getConstraints()).toHaveLength(3);
  });

  it('filters by hard type', () => {
    const hard = engine.getConstraints('hard');
    expect(hard).toHaveLength(2);
    expect(hard.every(c => c.type === 'hard')).toBe(true);
  });

  it('filters by soft type', () => {
    const soft = engine.getConstraints('soft');
    expect(soft).toHaveLength(1);
    expect(soft[0].type).toBe('soft');
  });
});

describe('RpiEngine.verifyConstraint()', () => {
  beforeEach(() => {
    engine.init();
    engine.addConstraint({ type: 'hard', description: 'Must do X', source: 'user', verified: false });
  });

  it('marks constraint as verified', () => {
    engine.verifyConstraint('C001');
    const constraints = engine.getConstraints();
    expect(constraints[0].verified).toBe(true);
  });

  it('does nothing for unknown ID', () => {
    engine.verifyConstraint('C999');
    expect(engine.getConstraints()[0].verified).toBe(false);
  });
});

describe('RpiEngine.recordDecision()', () => {
  beforeEach(() => {
    engine.init();
  });

  it('stores a decision and retrieves it', () => {
    engine.recordDecision('db', 'postgres');
    expect(engine.getDecisions()).toEqual({ db: 'postgres' });
  });

  it('overwrites a decision with the same key', () => {
    engine.recordDecision('db', 'postgres');
    engine.recordDecision('db', 'sqlite');
    expect(engine.getDecisions().db).toBe('sqlite');
  });
});

describe('RpiEngine.addPbtProperty()', () => {
  beforeEach(() => {
    engine.init();
  });

  it('adds property with auto-generated ID PBT001', () => {
    const prop = engine.addPbtProperty({
      name: 'idempotency',
      description: 'Repeated calls yield same result',
      invariant: 'f(f(x)) === f(x)',
      relatedConstraints: ['C001'],
    });
    expect(prop.id).toBe('PBT001');
    expect(prop.name).toBe('idempotency');
  });

  it('increments PBT IDs: PBT001, PBT002', () => {
    const p1 = engine.addPbtProperty({ name: 'A', description: '', invariant: '', relatedConstraints: [] });
    const p2 = engine.addPbtProperty({ name: 'B', description: '', invariant: '', relatedConstraints: [] });
    expect(p1.id).toBe('PBT001');
    expect(p2.id).toBe('PBT002');
  });

  it('getPbtProperties() returns all added properties', () => {
    engine.addPbtProperty({ name: 'A', description: '', invariant: '', relatedConstraints: [] });
    expect(engine.getPbtProperties()).toHaveLength(1);
  });
});

describe('RpiEngine artifact tracking', () => {
  beforeEach(() => {
    engine.init();
  });

  it('setProposal() tracks proposal path', () => {
    engine.setProposal('/path/to/proposal.md');
    const state = engine.getState()!;
    expect(state.artifacts.proposal).toBe('/path/to/proposal.md');
  });

  it('addSpec() adds spec path and deduplicates', () => {
    engine.addSpec('/specs/auth.md');
    engine.addSpec('/specs/auth.md'); // duplicate
    engine.addSpec('/specs/db.md');
    const state = engine.getState()!;
    expect(state.artifacts.specs).toEqual(['/specs/auth.md', '/specs/db.md']);
  });

  it('addDesign() adds design path and deduplicates', () => {
    engine.addDesign('/design/ui.md');
    engine.addDesign('/design/ui.md'); // duplicate
    const state = engine.getState()!;
    expect(state.artifacts.design).toEqual(['/design/ui.md']);
  });

  it('setTasks() tracks tasks path', () => {
    engine.setTasks('/tasks.md');
    const state = engine.getState()!;
    expect(state.artifacts.tasks).toBe('/tasks.md');
  });
});

describe('RpiEngine.getSummary()', () => {
  it('returns a no-state message when not initialized', () => {
    const msg = engine.getSummary();
    expect(msg).toBe('No active RPI session.');
  });

  it('returns formatted summary with phase, constraints, decisions, pbt', () => {
    engine.init('my-change');
    engine.addConstraint({ type: 'hard', description: 'X', source: 'user', verified: false });
    engine.addConstraint({ type: 'soft', description: 'Y', source: 'user', verified: false });
    engine.recordDecision('key', 'val');
    engine.addPbtProperty({ name: 'P', description: '', invariant: '', relatedConstraints: [] });

    const summary = engine.getSummary();
    expect(summary).toContain('Phase: INIT');
    expect(summary).toContain('Change: my-change');
    expect(summary).toContain('1H / 1S');
    expect(summary).toContain('Decisions: 1');
    expect(summary).toContain('PBT Properties: 1');
  });

  it('includes proposal and tasks in summary when set', () => {
    engine.init();
    engine.setProposal('/proposal.md');
    engine.setTasks('/tasks.md');
    const summary = engine.getSummary();
    expect(summary).toContain('Proposal: /proposal.md');
    expect(summary).toContain('Tasks: /tasks.md');
  });

  it('includes specs count in summary when specs are added', () => {
    engine.init();
    engine.addSpec('/specs/a.md');
    engine.addSpec('/specs/b.md');
    const summary = engine.getSummary();
    expect(summary).toContain('Specs: 2 files');
  });
});

describe('RpiEngine.reset()', () => {
  it('clears all state so getState() returns null', () => {
    engine.init('test');
    engine.reset();
    expect(engine.getState()).toBeNull();
  });

  it('allows re-initialization after reset', () => {
    engine.init('first');
    engine.reset();
    const state = engine.init('second');
    expect(state.changeName).toBe('second');
    expect(state.phase).toBe('init');
  });
});

describe('RpiEngine.getCurrentPhase()', () => {
  it('returns null when no state exists', () => {
    expect(engine.getCurrentPhase()).toBeNull();
  });

  it('returns current phase after init', () => {
    engine.init();
    expect(engine.getCurrentPhase()).toBe('init');
  });
});
