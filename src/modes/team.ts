import type { TeamState } from '../types.js';
import { StateManager } from '../state/manager.js';
import { ModelRouter } from '../router/model-router.js';

export interface TeamTask {
  id: string;
  title: string;
  description: string;
  domain: 'frontend' | 'backend' | 'fullstack' | 'general';
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignee?: string;
}

export class TeamOrchestrator {
  private readonly state: StateManager;
  private readonly router: ModelRouter;
  private tasks: TeamTask[] = [];

  constructor(workDir: string) {
    this.state = new StateManager(workDir);
    this.router = new ModelRouter();
  }

  /**
   * Initialize team mode with a set of tasks.
   */
  createTeam(teamName: string, tasks: TeamTask[]): TeamState {
    this.tasks = tasks;
    return this.state.initTeam(teamName, tasks.length);
  }

  /**
   * Initialize team mode linked to a Ralph loop for composite orchestration.
   * Each task will be wrapped in a ralph execute->verify->fix cycle.
   */
  createTeamWithRalph(teamName: string, tasks: TeamTask[], ralphMaxIterations = 10): TeamState {
    this.tasks = tasks;
    const teamState = this.state.initTeam(teamName, tasks.length);

    // Record the ralph link in state
    const stored = this.state.getModeState<TeamState & { linkedRalph?: { enabled: boolean; maxIterations: number } }>('team');
    if (stored) {
      stored.linkedRalph = { enabled: true, maxIterations: ralphMaxIterations };
      this.state.saveModeState('team', stored);
    }

    return teamState;
  }

  /**
   * Get routing recommendations for each task.
   * Frontend tasks route to Gemini-enhanced workers, backend to Codex.
   */
  routeWorkers(): Array<{ task: TeamTask; routing: ReturnType<ModelRouter['routeTask']> }> {
    return this.tasks
      .filter(t => t.status === 'pending')
      .filter(t => t.dependencies.every(dep =>
        this.tasks.find(d => d.id === dep)?.status === 'completed'
      ))
      .map(task => ({
        task,
        routing: this.router.routeTask({ domain: task.domain }),
      }));
  }

  /**
   * Get tasks ready for execution (no unmet dependencies).
   */
  getReadyTasks(): TeamTask[] {
    return this.tasks.filter(t =>
      t.status === 'pending' &&
      t.dependencies.every(dep =>
        this.tasks.find(d => d.id === dep)?.status === 'completed'
      )
    );
  }

  /**
   * Update task status.
   */
  updateTask(taskId: string, status: TeamTask['status'], assignee?: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    task.status = status;
    if (assignee) task.assignee = assignee;

    // Update team state
    const teamState = this.state.getModeState<TeamState>('team');
    if (teamState) {
      teamState.completedTasks = this.tasks.filter(t => t.status === 'completed').length;
      this.state.saveModeState('team', teamState);
    }
  }

  /**
   * Check if all tasks are complete.
   */
  isComplete(): boolean {
    return this.tasks.every(t => t.status === 'completed' || t.status === 'failed');
  }

  /**
   * Get progress summary.
   */
  getProgress(): { completed: number; inProgress: number; pending: number; failed: number; total: number } {
    return {
      completed: this.tasks.filter(t => t.status === 'completed').length,
      inProgress: this.tasks.filter(t => t.status === 'in_progress').length,
      pending: this.tasks.filter(t => t.status === 'pending').length,
      failed: this.tasks.filter(t => t.status === 'failed').length,
      total: this.tasks.length,
    };
  }

  /**
   * Get the worktree path assigned to a task (stub for future worktree integration).
   * Returns null until worktree support is fully implemented.
   */
  getWorktreeAssignment(taskId: string): string | null {
    // Worktree integration is not yet implemented.
    // Future: look up WorktreeInfo by taskId and return its path.
    void taskId;
    return null;
  }

  /**
   * Clean up team state.
   */
  cleanup(): void {
    this.state.clearModeState('team');
    this.tasks = [];
  }
}
