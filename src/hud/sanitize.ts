/**
 * Strip ANSI escape sequences that could corrupt terminal rendering.
 * Allows only known-safe color/style sequences.
 */

const SAFE_ANSI = /\x1b\[([\d;]*m)/g;
const ALL_ANSI = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b[()][AB012]|\x1b[>=<]/g;

export function stripUnsafeAnsi(text: string): string {
  // Collect safe sequences
  const safeMatches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = SAFE_ANSI.exec(text)) !== null) {
    safeMatches.add(match[0]);
  }

  // Remove all ANSI, then we'll add back safe ones via our renderer
  return text.replace(ALL_ANSI, '');
}

/**
 * Replace Unicode characters that may not render in all terminals.
 */
export function unicodeToAscii(text: string): string {
  const replacements: Record<string, string> = {
    '●': '*',
    '○': 'o',
    '✕': 'x',
    '⏳': '~',
    '◆': '#',
    '├': '|',
    '└': '\\',
    '─': '-',
    '│': '|',
    '💰': '$',
    '💾': '%',
  };

  let result = text;
  for (const [unicode, ascii] of Object.entries(replacements)) {
    result = result.replaceAll(unicode, ascii);
  }
  return result;
}

/**
 * Truncate a line to fit terminal width.
 */
export function truncateLine(line: string, maxWidth: number): string {
  // Strip ANSI for length calculation
  const stripped = line.replace(ALL_ANSI, '');
  if (stripped.length <= maxWidth) return line;

  // Truncate the visible content
  const stripped_truncated = stripped.slice(0, maxWidth - 3) + '...';
  return stripped_truncated;
}

/**
 * Full sanitization pipeline.
 */
export function sanitize(text: string, safeMode: boolean): string {
  let result = text;
  if (safeMode) {
    result = stripUnsafeAnsi(result);
    result = unicodeToAscii(result);
  }
  return result;
}
