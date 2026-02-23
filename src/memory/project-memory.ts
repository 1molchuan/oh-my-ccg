import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

type MemorySection = 'all' | 'techStack' | 'build' | 'conventions' | 'structure' | 'notes' | 'directives';

interface ProjectNote {
  category: string;
  content: string;
  timestamp: string;
}

interface ProjectDirective {
  directive: string;
  priority: 'high' | 'normal';
  context?: string;
  timestamp: string;
}

interface ProjectMemoryData {
  techStack?: string;
  build?: string;
  conventions?: string;
  structure?: string;
  notes?: ProjectNote[];
  directives?: ProjectDirective[];
}

export class ProjectMemoryManager {
  private readonly filePath: string;

  constructor(workDir: string) {
    this.filePath = join(workDir, '.oh-my-ccg', 'project-memory.json');
  }

  private ensureFile(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, JSON.stringify({}, null, 2), 'utf-8');
    }
  }

  private readData(): ProjectMemoryData {
    this.ensureFile();
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8'));
    } catch {
      return {};
    }
  }

  private writeData(data: ProjectMemoryData): void {
    this.ensureFile();
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Read project memory (all or specific section).
   */
  read(section: MemorySection = 'all'): ProjectMemoryData | unknown {
    const data = this.readData();
    if (section === 'all') return data;
    return data[section as keyof ProjectMemoryData] ?? null;
  }

  /**
   * Write project memory (replace or merge).
   */
  write(memory: Partial<ProjectMemoryData>, merge = true): void {
    if (merge) {
      const existing = this.readData();
      this.writeData({ ...existing, ...memory });
    } else {
      this.writeData(memory as ProjectMemoryData);
    }
  }

  /**
   * Add a categorized note.
   */
  addNote(category: string, content: string): void {
    const data = this.readData();
    if (!data.notes) data.notes = [];

    data.notes.push({
      category,
      content,
      timestamp: new Date().toISOString(),
    });

    this.writeData(data);
  }

  /**
   * Add a persistent directive.
   */
  addDirective(directive: string, priority: 'high' | 'normal' = 'normal', context?: string): void {
    const data = this.readData();
    if (!data.directives) data.directives = [];

    data.directives.push({
      directive,
      priority,
      context,
      timestamp: new Date().toISOString(),
    });

    this.writeData(data);
  }

  /**
   * Get notes by category.
   */
  getNotesByCategory(category: string): ProjectNote[] {
    const data = this.readData();
    return (data.notes ?? []).filter(n => n.category === category);
  }

  /**
   * Get directives by priority.
   */
  getDirectivesByPriority(priority?: 'high' | 'normal'): ProjectDirective[] {
    const data = this.readData();
    const directives = data.directives ?? [];
    if (!priority) return directives;
    return directives.filter(d => d.priority === priority);
  }
}
