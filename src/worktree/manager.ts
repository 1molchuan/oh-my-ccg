import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { WorktreeInfo, WorktreeConfig } from '../types.js';

const REGISTRY_FILE = '.oh-my-ccg/state/worktrees.json';

export class WorktreeManager {
  private workDir: string;
  private config: WorktreeConfig;
  private registry: WorktreeInfo[];

  constructor(workDir: string, config: WorktreeConfig) {
    this.workDir = workDir;
    this.config = config;
    this.registry = this.loadRegistry();
  }

  /**
   * Create a new git worktree for the given branch.
   * Registers the worktree in the state registry.
   */
  create(branch: string, taskId?: string): WorktreeInfo {
    if (this.registry.length >= this.config.maxWorktrees) {
      throw new Error(
        `[WorktreeManager] Max worktrees limit reached (${this.config.maxWorktrees}). ` +
        `Run cleanup() to remove merged/abandoned worktrees.`,
      );
    }

    const worktreePath = resolve(join(this.workDir, this.config.baseDir, branch));

    try {
      execSync(`git worktree add "${worktreePath}" -b "${branch}"`, {
        cwd: this.workDir,
        stdio: 'pipe',
      });
    } catch (err) {
      throw new Error(
        `[WorktreeManager] Failed to create worktree for branch "${branch}": ${(err as Error).message}`,
      );
    }

    const info: WorktreeInfo = {
      path: worktreePath,
      branch,
      taskId: taskId ?? null,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    this.registry.push(info);
    this.saveRegistry();
    return info;
  }

  /**
   * Return all registered worktrees.
   */
  list(): WorktreeInfo[] {
    return [...this.registry];
  }

  /**
   * Find a worktree by its associated task ID.
   */
  getByTask(taskId: string): WorktreeInfo | null {
    return this.registry.find((w) => w.taskId === taskId) ?? null;
  }

  /**
   * Merge a worktree branch back into the current branch, then mark it as merged.
   */
  merge(branch: string): { success: boolean; message: string } {
    const entry = this.registry.find((w) => w.branch === branch);
    if (!entry) {
      return { success: false, message: `No worktree registered for branch "${branch}".` };
    }

    try {
      execSync(`git merge "${branch}"`, {
        cwd: this.workDir,
        stdio: 'pipe',
      });
    } catch (err) {
      return {
        success: false,
        message: `[WorktreeManager] Merge failed for branch "${branch}": ${(err as Error).message}`,
      };
    }

    entry.status = 'merged';
    this.saveRegistry();
    return { success: true, message: `Branch "${branch}" merged successfully.` };
  }

  /**
   * Remove a git worktree and delete its entry from the registry.
   */
  remove(branch: string): void {
    const index = this.registry.findIndex((w) => w.branch === branch);
    if (index === -1) {
      throw new Error(`[WorktreeManager] No worktree registered for branch "${branch}".`);
    }

    const entry = this.registry[index];

    try {
      execSync(`git worktree remove "${entry.path}" --force`, {
        cwd: this.workDir,
        stdio: 'pipe',
      });
    } catch (err) {
      throw new Error(
        `[WorktreeManager] Failed to remove worktree "${entry.path}": ${(err as Error).message}`,
      );
    }

    this.registry.splice(index, 1);
    this.saveRegistry();
  }

  /**
   * Remove all worktrees with status 'merged' or 'abandoned', then run git worktree prune.
   */
  cleanup(): { removed: number } {
    const toRemove = this.registry.filter(
      (w) => w.status === 'merged' || w.status === 'abandoned',
    );

    let removed = 0;
    for (const entry of toRemove) {
      try {
        execSync(`git worktree remove "${entry.path}" --force`, {
          cwd: this.workDir,
          stdio: 'pipe',
        });
        removed++;
      } catch {
        // Best-effort removal; continue with the rest
      }
      this.registry = this.registry.filter((w) => w.branch !== entry.branch);
    }

    try {
      execSync('git worktree prune', { cwd: this.workDir, stdio: 'pipe' });
    } catch {
      // Non-fatal: prune failure does not block cleanup result
    }

    this.saveRegistry();
    return { removed };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private loadRegistry(): WorktreeInfo[] {
    const registryPath = join(this.workDir, REGISTRY_FILE);
    if (!existsSync(registryPath)) {
      return [];
    }
    try {
      const raw = readFileSync(registryPath, 'utf-8');
      return JSON.parse(raw) as WorktreeInfo[];
    } catch {
      return [];
    }
  }

  private saveRegistry(): void {
    const registryPath = join(this.workDir, REGISTRY_FILE);
    const dir = join(this.workDir, '.oh-my-ccg', 'state');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(registryPath, JSON.stringify(this.registry, null, 2), 'utf-8');
  }
}
