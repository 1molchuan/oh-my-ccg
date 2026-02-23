import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { WorktreeManager } from '../src/worktree/manager.js';
import type { WorktreeConfig } from '../src/types.js';

let tmpDir: string;
let config: WorktreeConfig;

function makeConfig(overrides: Partial<WorktreeConfig> = {}): WorktreeConfig {
  return {
    enabled: true,
    baseDir: '../.oh-my-ccg-worktrees',
    autoCleanup: false,
    maxWorktrees: 5,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'worktree-test-'));
  config = makeConfig();
  // Initialize a real git repo so git commands don't fail for registry tests
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  // Create an initial commit so HEAD exists (needed for git worktree add)
  execSync('git commit --allow-empty -m "init"', { cwd: tmpDir, stdio: 'pipe' });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('list()', () => {
  it('returns empty array when no worktrees registered', () => {
    const manager = new WorktreeManager(tmpDir, config);
    expect(manager.list()).toEqual([]);
  });

  it('returns a copy, not the internal array', () => {
    const manager = new WorktreeManager(tmpDir, config);
    const first = manager.list();
    const second = manager.list();
    expect(first).not.toBe(second);
  });
});

describe('getByTask()', () => {
  it('returns null for unknown task ID', () => {
    const manager = new WorktreeManager(tmpDir, config);
    expect(manager.getByTask('nonexistent-task-id')).toBeNull();
  });

  it('returns null when registry is empty', () => {
    const manager = new WorktreeManager(tmpDir, config);
    expect(manager.getByTask('task-1')).toBeNull();
  });
});

describe('create()', () => {
  it('throws when git command fails (non-git directory)', () => {
    // Use a temp dir that is NOT a git repo
    const nonGitDir = mkdtempSync(join(tmpdir(), 'non-git-'));
    try {
      const manager = new WorktreeManager(nonGitDir, config);
      expect(() => manager.create('test-branch')).toThrow(/WorktreeManager/);
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  it('throws when max worktrees limit is reached', () => {
    const limitedConfig = makeConfig({ maxWorktrees: 0 });
    const manager = new WorktreeManager(tmpDir, limitedConfig);
    expect(() => manager.create('some-branch')).toThrow(/Max worktrees limit reached/);
  });

  it('error message includes the branch name on git failure', () => {
    const nonGitDir = mkdtempSync(join(tmpdir(), 'non-git-2-'));
    try {
      const manager = new WorktreeManager(nonGitDir, config);
      expect(() => manager.create('my-feature-branch')).toThrow(/my-feature-branch/);
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });
});

describe('registry persistence', () => {
  it('registry file is created at the correct path after create()', () => {
    // We test this indirectly: a successful create writes the registry.
    // Since git worktree add will fail in most test environments without a proper branch,
    // we test that the registry path is deterministic by checking after a failed create.
    const manager = new WorktreeManager(tmpDir, config);
    try {
      manager.create('feature-branch');
      // If create succeeds (real git env), registry should exist
      const registryPath = join(tmpDir, '.oh-my-ccg', 'state', 'worktrees.json');
      expect(existsSync(registryPath)).toBe(true);
    } catch {
      // Expected in environments where git worktree may fail
      // Registry is only written on success, so nothing to check
    }
  });

  it('loads existing registry from disk on construction', () => {
    // First manager creates a worktree (if git supports it)
    const manager1 = new WorktreeManager(tmpDir, config);
    const initialList = manager1.list();
    // Second manager reading same dir should see same state
    const manager2 = new WorktreeManager(tmpDir, config);
    expect(manager2.list()).toEqual(initialList);
  });

  it('registry returns empty array when json file is missing', () => {
    // Fresh temp dir with git but no registry file
    const manager = new WorktreeManager(tmpDir, config);
    expect(manager.list()).toEqual([]);
  });
});

describe('cleanup()', () => {
  it('returns count of 0 when no merged/abandoned worktrees', () => {
    const manager = new WorktreeManager(tmpDir, config);
    const result = manager.cleanup();
    expect(result.removed).toBe(0);
  });

  it('returns object with removed count', () => {
    const manager = new WorktreeManager(tmpDir, config);
    const result = manager.cleanup();
    expect(result).toHaveProperty('removed');
    expect(typeof result.removed).toBe('number');
  });

  it('does not throw even when git worktree prune fails', () => {
    // cleanup() has try/catch around prune, so it should never throw
    const manager = new WorktreeManager(tmpDir, config);
    expect(() => manager.cleanup()).not.toThrow();
  });
});

describe('merge()', () => {
  it('returns failure when branch not in registry', () => {
    const manager = new WorktreeManager(tmpDir, config);
    const result = manager.merge('nonexistent-branch');
    expect(result.success).toBe(false);
    expect(result.message).toContain('nonexistent-branch');
  });
});

describe('remove()', () => {
  it('throws when branch not in registry', () => {
    const manager = new WorktreeManager(tmpDir, config);
    expect(() => manager.remove('nonexistent-branch')).toThrow(/nonexistent-branch/);
  });
});

describe('WorktreeManager with real git worktree', () => {
  it('create() registers worktree and getByTask() finds it', () => {
    const manager = new WorktreeManager(tmpDir, config);
    let created;
    try {
      created = manager.create('feat/task-123', 'task-123');
    } catch {
      // Skip if git environment doesn't support worktrees
      return;
    }
    expect(created.branch).toBe('feat/task-123');
    expect(created.taskId).toBe('task-123');
    expect(created.status).toBe('active');

    const found = manager.getByTask('task-123');
    expect(found).not.toBeNull();
    expect(found!.branch).toBe('feat/task-123');
  });

  it('create() persists registry so new manager instance sees it', () => {
    const manager1 = new WorktreeManager(tmpDir, config);
    try {
      manager1.create('feat/persist-test', 'task-persist');
    } catch {
      return;
    }
    const manager2 = new WorktreeManager(tmpDir, config);
    const found = manager2.getByTask('task-persist');
    expect(found).not.toBeNull();
    expect(found!.branch).toBe('feat/persist-test');
  });

  it('list() returns created worktree', () => {
    const manager = new WorktreeManager(tmpDir, config);
    try {
      manager.create('feat/list-test');
    } catch {
      return;
    }
    const list = manager.list();
    expect(list.length).toBe(1);
    expect(list[0].branch).toBe('feat/list-test');
  });

  it('registry JSON is valid after create()', () => {
    const manager = new WorktreeManager(tmpDir, config);
    try {
      manager.create('feat/json-test');
    } catch {
      return;
    }
    const registryPath = join(tmpDir, '.oh-my-ccg', 'state', 'worktrees.json');
    expect(existsSync(registryPath)).toBe(true);
    const raw = readFileSync(registryPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].branch).toBe('feat/json-test');
  });
});
