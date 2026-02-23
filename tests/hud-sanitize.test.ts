import { describe, it, expect } from 'vitest';
import { stripUnsafeAnsi, unicodeToAscii, truncateLine, sanitize } from '../src/hud/sanitize.js';

describe('stripUnsafeAnsi()', () => {
  it('removes cursor movement sequences', () => {
    const input = '\x1b[2A hello \x1b[1B world';
    const result = stripUnsafeAnsi(input);
    expect(result).toBe(' hello  world');
  });

  it('removes OSC sequences (window title etc)', () => {
    const input = '\x1b]0;My Title\x07hello';
    const result = stripUnsafeAnsi(input);
    expect(result).toBe('hello');
  });

  it('removes erase sequences', () => {
    const input = '\x1b[2Jhello\x1b[K world';
    const result = stripUnsafeAnsi(input);
    expect(result).toBe('hello world');
  });

  it('strips all ANSI sequences from mixed input', () => {
    const input = '\x1b[32mgreen\x1b[0m \x1b[2Acursor\x1b[1B';
    const result = stripUnsafeAnsi(input);
    // ALL_ANSI regex strips everything including color codes
    expect(result).not.toContain('\x1b[');
  });

  it('returns plain text unchanged when no ANSI present', () => {
    const input = 'hello world 123';
    expect(stripUnsafeAnsi(input)).toBe('hello world 123');
  });

  it('handles empty string', () => {
    expect(stripUnsafeAnsi('')).toBe('');
  });

  it('removes charset designation sequences', () => {
    const input = '\x1b(Bhello\x1b)0';
    const result = stripUnsafeAnsi(input);
    expect(result).toBe('hello');
  });
});

describe('unicodeToAscii()', () => {
  it('replaces bullet filled circle with *', () => {
    expect(unicodeToAscii('● active')).toBe('* active');
  });

  it('replaces open circle with o', () => {
    expect(unicodeToAscii('○ idle')).toBe('o idle');
  });

  it('replaces cross mark with x', () => {
    expect(unicodeToAscii('✕ error')).toBe('x error');
  });

  it('replaces hourglass with ~', () => {
    expect(unicodeToAscii('⏳ waiting')).toBe('~ waiting');
  });

  it('replaces diamond with #', () => {
    expect(unicodeToAscii('◆IMPL')).toBe('#IMPL');
  });

  it('replaces tree branch characters', () => {
    expect(unicodeToAscii('├─ agent')).toBe('|- agent');
  });

  it('replaces tree end character', () => {
    expect(unicodeToAscii('└─ last')).toBe('\\- last');
  });

  it('replaces pipe character', () => {
    expect(unicodeToAscii('│ line')).toBe('| line');
  });

  it('replaces money bag with $', () => {
    expect(unicodeToAscii('💰1.24')).toBe('$1.24');
  });

  it('replaces floppy disk with %', () => {
    expect(unicodeToAscii('💾30% cache')).toBe('%30% cache');
  });

  it('replaces multiple unicode chars in one string', () => {
    const input = '● active ○ idle ◆IMPL';
    expect(unicodeToAscii(input)).toBe('* active o idle #IMPL');
  });

  it('leaves plain ASCII unchanged', () => {
    const input = 'hello world [CCG]';
    expect(unicodeToAscii(input)).toBe('hello world [CCG]');
  });
});

describe('truncateLine()', () => {
  it('returns line unchanged when within maxWidth', () => {
    const line = 'hello world';
    expect(truncateLine(line, 20)).toBe('hello world');
  });

  it('returns line unchanged when exactly maxWidth', () => {
    const line = 'hello';
    expect(truncateLine(line, 5)).toBe('hello');
  });

  it('truncates long line with ellipsis', () => {
    const line = 'abcdefghijklmnopqrstuvwxyz';
    const result = truncateLine(line, 10);
    expect(result).toBe('abcdefg...');
    expect(result.length).toBe(10);
  });

  it('measures visible length ignoring ANSI codes', () => {
    // ANSI codes don't count toward visible length
    const line = '\x1b[32mhello\x1b[0m'; // visible: "hello" = 5 chars
    const result = truncateLine(line, 10);
    // "hello" is only 5 visible chars, under limit of 10 -> no truncation
    expect(result).toBe('\x1b[32mhello\x1b[0m');
  });

  it('truncates and strips ANSI when content exceeds maxWidth', () => {
    const long = 'a'.repeat(30);
    const result = truncateLine(long, 10);
    expect(result.length).toBe(10);
    expect(result).toMatch(/\.\.\.$/);
  });
});

describe('sanitize()', () => {
  it('in safe mode strips unsafe ANSI sequences', () => {
    const input = '\x1b[2Ahello\x1b[0mworld';
    const result = sanitize(input, true);
    expect(result).not.toContain('\x1b[2A');
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });

  it('in safe mode replaces unicode with ASCII', () => {
    const input = '◆IMPL ctx:67%';
    const result = sanitize(input, true);
    expect(result).toContain('#IMPL');
    expect(result).toContain('ctx:67%');
  });

  it('in safe mode processes both ANSI and unicode', () => {
    const input = '\x1b[32m● active\x1b[0m\x1b[2A';
    const result = sanitize(input, true);
    expect(result).not.toContain('\x1b[');
    expect(result).toContain('* active');
  });

  it('with safeMode=false passes text through unchanged', () => {
    const input = '\x1b[32m● active\x1b[0m ◆IMPL';
    const result = sanitize(input, false);
    // With safeMode false, no transformation applied
    expect(result).toBe(input);
  });

  it('handles empty string in safe mode', () => {
    expect(sanitize('', true)).toBe('');
  });

  it('handles empty string with safeMode=false', () => {
    expect(sanitize('', false)).toBe('');
  });
});
