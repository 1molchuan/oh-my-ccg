import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

type NotepadSection = 'all' | 'priority' | 'working' | 'manual';

interface NotepadStats {
  totalSize: number;
  prioritySize: number;
  workingEntries: number;
  manualEntries: number;
  oldestWorking: string | null;
}

export class NotepadManager {
  private readonly filePath: string;

  constructor(workDir: string) {
    this.filePath = join(workDir, '.oh-my-ccg', 'notepad.md');
  }

  private ensureFile(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, this.emptyTemplate(), 'utf-8');
    }
  }

  private emptyTemplate(): string {
    return [
      '# oh-my-ccg Notepad',
      '',
      '## Priority Context',
      '',
      '',
      '## Working Memory',
      '',
      '',
      '## Manual Notes',
      '',
      '',
    ].join('\n');
  }

  private readRaw(): string {
    this.ensureFile();
    return readFileSync(this.filePath, 'utf-8');
  }

  private writeRaw(content: string): void {
    this.ensureFile();
    writeFileSync(this.filePath, content, 'utf-8');
  }

  private extractSection(content: string, section: string): string {
    const regex = new RegExp(`## ${section}\\n([\\s\\S]*?)(?=\\n## |$)`);
    const match = content.match(regex);
    return match?.[1]?.trim() ?? '';
  }

  private replaceSection(content: string, section: string, newContent: string): string {
    const regex = new RegExp(`(## ${section}\\n)[\\s\\S]*?(?=\\n## |$)`);
    return content.replace(regex, `$1${newContent}\n\n`);
  }

  /**
   * Read notepad content.
   */
  read(section: NotepadSection = 'all'): string {
    const content = this.readRaw();
    if (section === 'all') return content;

    const sectionMap: Record<string, string> = {
      priority: 'Priority Context',
      working: 'Working Memory',
      manual: 'Manual Notes',
    };

    return this.extractSection(content, sectionMap[section] ?? section);
  }

  /**
   * Write priority context (replaces existing, max 500 chars).
   */
  writePriority(text: string): void {
    const truncated = text.slice(0, 500);
    let content = this.readRaw();
    content = this.replaceSection(content, 'Priority Context', truncated);
    this.writeRaw(content);
  }

  /**
   * Add a timestamped working memory entry.
   */
  addWorking(text: string): void {
    const timestamp = new Date().toISOString();
    const entry = `### ${timestamp}\n${text}`;
    let content = this.readRaw();
    const existing = this.extractSection(content, 'Working Memory');
    const updated = existing ? `${existing}\n\n${entry}` : entry;
    content = this.replaceSection(content, 'Working Memory', updated);
    this.writeRaw(content);
  }

  /**
   * Add a permanent manual note.
   */
  addManual(text: string): void {
    const timestamp = new Date().toISOString();
    const entry = `### ${timestamp}\n${text}`;
    let content = this.readRaw();
    const existing = this.extractSection(content, 'Manual Notes');
    const updated = existing ? `${existing}\n\n${entry}` : entry;
    content = this.replaceSection(content, 'Manual Notes', updated);
    this.writeRaw(content);
  }

  /**
   * Prune working memory entries older than N days.
   */
  prune(daysOld = 7): number {
    const content = this.readRaw();
    const working = this.extractSection(content, 'Working Memory');
    if (!working) return 0;

    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const entries = working.split(/(?=### \d{4}-)/);
    let pruned = 0;

    const kept = entries.filter(entry => {
      const match = entry.match(/### (\d{4}-[^\n]+)/);
      if (!match) return true;
      const entryDate = new Date(match[1]).getTime();
      if (isNaN(entryDate)) return true;
      if (entryDate < cutoff) {
        pruned++;
        return false;
      }
      return true;
    });

    if (pruned > 0) {
      const updated = this.replaceSection(content, 'Working Memory', kept.join('').trim());
      this.writeRaw(updated);
    }

    return pruned;
  }

  /**
   * Get notepad statistics.
   */
  getStats(): NotepadStats {
    const content = this.readRaw();
    const priority = this.extractSection(content, 'Priority Context');
    const working = this.extractSection(content, 'Working Memory');
    const manual = this.extractSection(content, 'Manual Notes');

    const workingEntries = (working.match(/### \d{4}-/g) || []).length;
    const manualEntries = (manual.match(/### \d{4}-/g) || []).length;

    // Find oldest working entry
    const timestamps = [...working.matchAll(/### (\d{4}-[^\n]+)/g)].map(m => m[1]);
    const oldestWorking = timestamps.length > 0
      ? timestamps.sort()[0]
      : null;

    return {
      totalSize: content.length,
      prioritySize: priority.length,
      workingEntries,
      manualEntries,
      oldestWorking,
    };
  }
}
