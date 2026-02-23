import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenSpecChange } from '../types.js';

export class OpenSpecBridge {
  private readonly workDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
  }

  /**
   * Check if OpenSpec CLI is available.
   */
  isAvailable(): boolean {
    try {
      execSync('npx openspec --version', { cwd: this.workDir, stdio: 'pipe', timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if project is initialized with OpenSpec.
   */
  isInitialized(): boolean {
    return existsSync(join(this.workDir, 'openspec'));
  }

  /**
   * Initialize OpenSpec for the project.
   */
  init(): { success: boolean; message: string } {
    try {
      const output = execSync('npx openspec init --tools claude', {
        cwd: this.workDir,
        stdio: 'pipe',
        timeout: 30000,
      }).toString().trim();
      return { success: true, message: output };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `OpenSpec init failed: ${msg}` };
    }
  }

  /**
   * Create a new change.
   */
  newChange(name: string): { success: boolean; message: string } {
    try {
      const output = execSync(`npx openspec new change "${name}"`, {
        cwd: this.workDir,
        stdio: 'pipe',
        timeout: 15000,
      }).toString().trim();
      return { success: true, message: output };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to create change: ${msg}` };
    }
  }

  /**
   * List all changes.
   */
  listChanges(): OpenSpecChange[] {
    try {
      const output = execSync('npx openspec list --json', {
        cwd: this.workDir,
        stdio: 'pipe',
        timeout: 10000,
      }).toString().trim();
      return JSON.parse(output) as OpenSpecChange[];
    } catch {
      return [];
    }
  }

  /**
   * Get status of a specific change.
   */
  getChangeStatus(changeId: string): Record<string, unknown> | null {
    try {
      const output = execSync(`npx openspec status --change "${changeId}" --json`, {
        cwd: this.workDir,
        stdio: 'pipe',
        timeout: 10000,
      }).toString().trim();
      return JSON.parse(output) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Get instructions for a specific change artifact.
   */
  getInstructions(artifactId: string, changeName: string): string | null {
    try {
      return execSync(`npx openspec instructions ${artifactId} --change "${changeName}"`, {
        cwd: this.workDir,
        stdio: 'pipe',
        timeout: 10000,
      }).toString().trim();
    } catch {
      return null;
    }
  }

  /**
   * Get the change directory path.
   */
  getChangePath(changeName: string): string {
    return join(this.workDir, 'openspec', 'changes', changeName);
  }
}
