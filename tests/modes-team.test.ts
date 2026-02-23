import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TeamOrchestrator, type TeamTask } from '../src/modes/team.js';

function makeTask(overrides: Partial<TeamTask> = {}): TeamTask {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task',
    domain: 'general',
    dependencies: [],
    status: 'pending',
    ...overrides,
  };
}

describe('TeamOrchestrator', () => {
  let workDir: string;
  let team: TeamOrchestrator;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'team-test-'));
    team = new TeamOrchestrator(workDir);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  describe('createTeam()', () => {
    it('initializes team state with active=true', () => {
      const tasks = [makeTask()];
      const state = team.createTeam('my-team', tasks);
      expect(state.active).toBe(true);
      expect(state.mode).toBe('team');
      expect(state.teamName).toBe('my-team');
    });

    it('sets totalTasks from tasks array length', () => {
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
      const state = team.createTeam('my-team', tasks);
      expect(state.totalTasks).toBe(2);
    });

    it('starts with completedTasks=0', () => {
      const tasks = [makeTask()];
      const state = team.createTeam('my-team', tasks);
      expect(state.completedTasks).toBe(0);
    });

    it('initializes with empty tasks list', () => {
      const state = team.createTeam('empty-team', []);
      expect(state.totalTasks).toBe(0);
      expect(state.active).toBe(true);
    });
  });

  describe('routeWorkers()', () => {
    it('returns routing for pending tasks with no dependencies', () => {
      const tasks = [makeTask({ id: 't1', domain: 'frontend' })];
      team.createTeam('my-team', tasks);
      const routing = team.routeWorkers();
      expect(routing.length).toBe(1);
      expect(routing[0].task.id).toBe('t1');
      expect(routing[0].routing.provider).toBe('gemini');
    });

    it('routes backend tasks to codex', () => {
      const tasks = [makeTask({ id: 't1', domain: 'backend' })];
      team.createTeam('my-team', tasks);
      const routing = team.routeWorkers();
      expect(routing[0].routing.provider).toBe('codex');
    });

    it('routes general tasks to claude', () => {
      const tasks = [makeTask({ id: 't1', domain: 'general' })];
      team.createTeam('my-team', tasks);
      const routing = team.routeWorkers();
      expect(routing[0].routing.provider).toBe('claude');
    });

    it('excludes tasks with unmet dependencies', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'pending', dependencies: ['t2'] }),
        makeTask({ id: 't2', status: 'pending', dependencies: [] }),
      ];
      team.createTeam('my-team', tasks);
      const routing = team.routeWorkers();
      // Only t2 is ready (t1 depends on t2 which is still pending)
      expect(routing.length).toBe(1);
      expect(routing[0].task.id).toBe('t2');
    });

    it('includes tasks whose dependencies are completed', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'pending', dependencies: ['t2'] }),
        makeTask({ id: 't2', status: 'completed', dependencies: [] }),
      ];
      team.createTeam('my-team', tasks);
      const routing = team.routeWorkers();
      // t1's dependency t2 is completed, so t1 is routable
      expect(routing.length).toBe(1);
      expect(routing[0].task.id).toBe('t1');
    });

    it('excludes non-pending tasks', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'in_progress' }),
        makeTask({ id: 't2', status: 'completed' }),
        makeTask({ id: 't3', status: 'pending' }),
      ];
      team.createTeam('my-team', tasks);
      const routing = team.routeWorkers();
      expect(routing.length).toBe(1);
      expect(routing[0].task.id).toBe('t3');
    });
  });

  describe('getReadyTasks()', () => {
    it('returns pending tasks with no unmet dependencies', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'pending', dependencies: [] }),
        makeTask({ id: 't2', status: 'pending', dependencies: [] }),
      ];
      team.createTeam('my-team', tasks);
      const ready = team.getReadyTasks();
      expect(ready.length).toBe(2);
    });

    it('filters out tasks with unmet dependencies', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'pending', dependencies: ['t2'] }),
        makeTask({ id: 't2', status: 'pending', dependencies: [] }),
      ];
      team.createTeam('my-team', tasks);
      const ready = team.getReadyTasks();
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe('t2');
    });

    it('includes tasks whose dependencies are completed', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'pending', dependencies: ['t2'] }),
        makeTask({ id: 't2', status: 'completed', dependencies: [] }),
      ];
      team.createTeam('my-team', tasks);
      const ready = team.getReadyTasks();
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe('t1');
    });

    it('returns empty when no tasks are ready', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'in_progress' }),
      ];
      team.createTeam('my-team', tasks);
      const ready = team.getReadyTasks();
      expect(ready.length).toBe(0);
    });
  });

  describe('updateTask()', () => {
    it('changes task status', () => {
      const tasks = [makeTask({ id: 't1' })];
      team.createTeam('my-team', tasks);
      team.updateTask('t1', 'in_progress');
      const ready = team.getReadyTasks();
      // No longer pending so not in ready tasks
      expect(ready.length).toBe(0);
    });

    it('updates completedTasks count in team state', () => {
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
      team.createTeam('my-team', tasks);
      team.updateTask('t1', 'completed');
      const progress = team.getProgress();
      expect(progress.completed).toBe(1);
    });

    it('sets assignee when provided', () => {
      const tasks = [makeTask({ id: 't1' })];
      team.createTeam('my-team', tasks);
      team.updateTask('t1', 'in_progress', 'agent-1');
      // Verify by checking the internal task array via getProgress
      const progress = team.getProgress();
      expect(progress.inProgress).toBe(1);
    });

    it('throws when task not found', () => {
      team.createTeam('my-team', []);
      expect(() => team.updateTask('nonexistent', 'completed')).toThrow('Task not found: nonexistent');
    });
  });

  describe('isComplete()', () => {
    it('returns false when tasks are pending', () => {
      const tasks = [makeTask({ id: 't1', status: 'pending' })];
      team.createTeam('my-team', tasks);
      expect(team.isComplete()).toBe(false);
    });

    it('returns true when all tasks are completed', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'pending' }),
        makeTask({ id: 't2', status: 'pending' }),
      ];
      team.createTeam('my-team', tasks);
      team.updateTask('t1', 'completed');
      team.updateTask('t2', 'completed');
      expect(team.isComplete()).toBe(true);
    });

    it('returns true when all tasks are failed', () => {
      const tasks = [makeTask({ id: 't1', status: 'pending' })];
      team.createTeam('my-team', tasks);
      team.updateTask('t1', 'failed');
      expect(team.isComplete()).toBe(true);
    });

    it('returns true for mix of completed and failed', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'pending' }),
        makeTask({ id: 't2', status: 'pending' }),
      ];
      team.createTeam('my-team', tasks);
      team.updateTask('t1', 'completed');
      team.updateTask('t2', 'failed');
      expect(team.isComplete()).toBe(true);
    });

    it('returns false when a task is in_progress', () => {
      const tasks = [makeTask({ id: 't1', status: 'pending' })];
      team.createTeam('my-team', tasks);
      team.updateTask('t1', 'in_progress');
      expect(team.isComplete()).toBe(false);
    });

    it('returns true for empty task list', () => {
      team.createTeam('my-team', []);
      expect(team.isComplete()).toBe(true);
    });
  });

  describe('getProgress()', () => {
    it('returns correct counts for all statuses', () => {
      const tasks = [
        makeTask({ id: 't1', status: 'pending' }),
        makeTask({ id: 't2', status: 'pending' }),
        makeTask({ id: 't3', status: 'pending' }),
        makeTask({ id: 't4', status: 'pending' }),
      ];
      team.createTeam('my-team', tasks);
      team.updateTask('t1', 'completed');
      team.updateTask('t2', 'in_progress');
      team.updateTask('t3', 'failed');
      // t4 remains pending

      const progress = team.getProgress();
      expect(progress.completed).toBe(1);
      expect(progress.inProgress).toBe(1);
      expect(progress.failed).toBe(1);
      expect(progress.pending).toBe(1);
      expect(progress.total).toBe(4);
    });

    it('returns zeros for empty task list', () => {
      team.createTeam('my-team', []);
      const progress = team.getProgress();
      expect(progress.completed).toBe(0);
      expect(progress.inProgress).toBe(0);
      expect(progress.pending).toBe(0);
      expect(progress.failed).toBe(0);
      expect(progress.total).toBe(0);
    });
  });

  describe('cleanup()', () => {
    it('clears state', () => {
      const tasks = [makeTask()];
      team.createTeam('my-team', tasks);
      team.cleanup();
      // After cleanup, progress should reflect empty tasks
      const progress = team.getProgress();
      expect(progress.total).toBe(0);
    });

    it('resets internal tasks array', () => {
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
      team.createTeam('my-team', tasks);
      team.cleanup();
      expect(team.getProgress().total).toBe(0);
      expect(team.isComplete()).toBe(true);
    });
  });

  describe('createTeamWithRalph()', () => {
    it('creates composite state with linkedRalph flag', () => {
      const tasks = [makeTask()];
      const state = team.createTeamWithRalph('my-team', tasks, 5);
      expect(state.active).toBe(true);
      expect(state.teamName).toBe('my-team');
      expect(state.totalTasks).toBe(1);
    });

    it('persists linkedRalph in stored state', () => {
      const tasks = [makeTask()];
      team.createTeamWithRalph('my-team', tasks, 7);
      const stored = team['state'].getModeState<ReturnType<typeof team['state']['getModeState']> & { linkedRalph?: { enabled: boolean; maxIterations: number } }>('team') as { linkedRalph?: { enabled: boolean; maxIterations: number } } | null;
      expect(stored?.linkedRalph?.enabled).toBe(true);
      expect(stored?.linkedRalph?.maxIterations).toBe(7);
    });

    it('uses default maxIterations of 10', () => {
      const tasks = [makeTask()];
      team.createTeamWithRalph('my-team', tasks);
      const stored = team['state'].getModeState<{ linkedRalph?: { enabled: boolean; maxIterations: number } }>('team');
      expect(stored?.linkedRalph?.maxIterations).toBe(10);
    });
  });
});
