import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectMemoryManager } from '../src/memory/project-memory.js';

describe('ProjectMemoryManager', () => {
  let workDir: string;
  let manager: ProjectMemoryManager;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'project-memory-test-'));
    manager = new ProjectMemoryManager(workDir);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("read() returns empty object when no file", () => {
    const data = manager.read();
    expect(data).toEqual({});
  });

  it("read('techStack') returns null when section doesn't exist", () => {
    const section = manager.read('techStack');
    expect(section).toBeNull();
  });

  it("read('techStack') returns the techStack value after writing", () => {
    manager.write({ techStack: 'TypeScript, Node.js' });
    const section = manager.read('techStack');
    expect(section).toBe('TypeScript, Node.js');
  });

  it("write({ techStack: '...' }) writes the section", () => {
    manager.write({ techStack: 'React, Vite' });
    const all = manager.read('all') as Record<string, unknown>;
    expect(all.techStack).toBe('React, Vite');
  });

  it("write(data, merge=true) merges with existing data by default", () => {
    manager.write({ techStack: 'TypeScript' });
    manager.write({ build: 'npm run build' });
    const all = manager.read('all') as Record<string, unknown>;
    expect(all.techStack).toBe('TypeScript');
    expect(all.build).toBe('npm run build');
  });

  it("write(data, merge=false) replaces all existing data", () => {
    manager.write({ techStack: 'TypeScript' });
    manager.write({ build: 'npm run build' }, false);
    const all = manager.read('all') as Record<string, unknown>;
    expect(all.techStack).toBeUndefined();
    expect(all.build).toBe('npm run build');
  });

  it("write(data, merge=true) overwrites matching keys", () => {
    manager.write({ techStack: 'TypeScript' });
    manager.write({ techStack: 'Go' }, true);
    const section = manager.read('techStack');
    expect(section).toBe('Go');
  });

  it("addNote(category, content) adds a note", () => {
    manager.addNote('architecture', 'Use hexagonal architecture');
    const notes = manager.getNotesByCategory('architecture');
    expect(notes).toHaveLength(1);
    expect(notes[0]!.content).toBe('Use hexagonal architecture');
    expect(notes[0]!.category).toBe('architecture');
    expect(notes[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("addNote accumulates multiple notes", () => {
    manager.addNote('build', 'note one');
    manager.addNote('build', 'note two');
    manager.addNote('test', 'note three');
    const buildNotes = manager.getNotesByCategory('build');
    expect(buildNotes).toHaveLength(2);
  });

  it("getNotesByCategory filters correctly", () => {
    manager.addNote('deploy', 'deploy note');
    manager.addNote('env', 'env note');
    manager.addNote('deploy', 'another deploy note');

    const deployNotes = manager.getNotesByCategory('deploy');
    const envNotes = manager.getNotesByCategory('env');
    const missingNotes = manager.getNotesByCategory('nonexistent');

    expect(deployNotes).toHaveLength(2);
    expect(envNotes).toHaveLength(1);
    expect(missingNotes).toHaveLength(0);
  });

  it("getNotesByCategory returns empty array when no notes exist", () => {
    const notes = manager.getNotesByCategory('anything');
    expect(notes).toEqual([]);
  });

  it("addDirective(directive, priority) adds a directive", () => {
    manager.addDirective('Always use strict mode', 'high');
    const directives = manager.getDirectivesByPriority('high');
    expect(directives).toHaveLength(1);
    expect(directives[0]!.directive).toBe('Always use strict mode');
    expect(directives[0]!.priority).toBe('high');
    expect(directives[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("addDirective defaults to 'normal' priority", () => {
    manager.addDirective('Use tabs for indentation');
    const directives = manager.getDirectivesByPriority('normal');
    expect(directives).toHaveLength(1);
    expect(directives[0]!.directive).toBe('Use tabs for indentation');
  });

  it("addDirective stores optional context", () => {
    manager.addDirective('No console.log in production', 'high', 'enforced by linter');
    const directives = manager.getDirectivesByPriority('high');
    expect(directives[0]!.context).toBe('enforced by linter');
  });

  it("getDirectivesByPriority('high') filters correctly", () => {
    manager.addDirective('High directive one', 'high');
    manager.addDirective('Normal directive', 'normal');
    manager.addDirective('High directive two', 'high');

    const highDirectives = manager.getDirectivesByPriority('high');
    const normalDirectives = manager.getDirectivesByPriority('normal');

    expect(highDirectives).toHaveLength(2);
    expect(normalDirectives).toHaveLength(1);
  });

  it("getDirectivesByPriority() with no argument returns all directives", () => {
    manager.addDirective('High one', 'high');
    manager.addDirective('Normal one', 'normal');

    const all = manager.getDirectivesByPriority();
    expect(all).toHaveLength(2);
  });

  it("getDirectivesByPriority returns empty array when no directives", () => {
    const directives = manager.getDirectivesByPriority('high');
    expect(directives).toEqual([]);
  });

  it("read('build') returns the build section", () => {
    manager.write({ build: 'tsc && node dist/index.js' });
    expect(manager.read('build')).toBe('tsc && node dist/index.js');
  });

  it("read('conventions') returns the conventions section", () => {
    manager.write({ conventions: 'PascalCase for classes' });
    expect(manager.read('conventions')).toBe('PascalCase for classes');
  });

  it("read('structure') returns the structure section", () => {
    manager.write({ structure: 'src/modules/...' });
    expect(manager.read('structure')).toBe('src/modules/...');
  });
});
