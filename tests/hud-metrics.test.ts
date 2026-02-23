import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HudMetricsCollector } from '../src/hud/metrics.js';

let tmpDir: string;
let collector: HudMetricsCollector;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'hud-metrics-test-'));
  collector = new HudMetricsCollector(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('init()', () => {
  it('creates metrics file with defaults', () => {
    collector.init();
    const metricsPath = join(tmpDir, 'hud-metrics.json');
    expect(existsSync(metricsPath)).toBe(true);
  });

  it('initializes with zero token counts', () => {
    collector.init();
    const metrics = collector.getMetrics();
    expect(metrics.inputTokens).toBe(0);
    expect(metrics.outputTokens).toBe(0);
    expect(metrics.cacheReadTokens).toBe(0);
    expect(metrics.cacheWriteTokens).toBe(0);
  });

  it('initializes with zero cost and cache rate', () => {
    collector.init();
    const metrics = collector.getMetrics();
    expect(metrics.estimatedCost).toBe(0);
    expect(metrics.cacheHitRate).toBe(0);
  });

  it('sets sessionStartedAt to a recent ISO timestamp', () => {
    const before = Date.now();
    collector.init();
    const after = Date.now();
    const metrics = collector.getMetrics();
    const startedAt = new Date(metrics.sessionStartedAt).getTime();
    expect(startedAt).toBeGreaterThanOrEqual(before);
    expect(startedAt).toBeLessThanOrEqual(after);
  });
});

describe('getMetrics()', () => {
  it('returns metrics with calculated sessionDuration', async () => {
    collector.init();
    // Wait a small amount to ensure duration > 0
    await new Promise(resolve => setTimeout(resolve, 10));
    const metrics = collector.getMetrics();
    expect(metrics.sessionDuration).toBeGreaterThan(0);
  });

  it('returns default metrics when file does not exist', () => {
    // No init() called — file does not exist
    const metrics = collector.getMetrics();
    expect(metrics.inputTokens).toBe(0);
    expect(metrics.estimatedCost).toBe(0);
  });

  it('sessionDuration grows over time', async () => {
    collector.init();
    await new Promise(resolve => setTimeout(resolve, 20));
    const first = collector.getMetrics().sessionDuration;
    await new Promise(resolve => setTimeout(resolve, 20));
    const second = collector.getMetrics().sessionDuration;
    expect(second).toBeGreaterThan(first);
  });
});

describe('recordTokenUsage()', () => {
  it('accumulates input tokens correctly', () => {
    collector.init();
    collector.recordTokenUsage(100, 50);
    collector.recordTokenUsage(200, 75);
    const metrics = collector.getMetrics();
    expect(metrics.inputTokens).toBe(300);
  });

  it('accumulates output tokens correctly', () => {
    collector.init();
    collector.recordTokenUsage(100, 50);
    collector.recordTokenUsage(100, 75);
    const metrics = collector.getMetrics();
    expect(metrics.outputTokens).toBe(125);
  });

  it('accumulates cache read and write tokens', () => {
    collector.init();
    collector.recordTokenUsage(100, 50, 30, 20);
    collector.recordTokenUsage(100, 50, 70, 10);
    const metrics = collector.getMetrics();
    expect(metrics.cacheReadTokens).toBe(100);
    expect(metrics.cacheWriteTokens).toBe(30);
  });

  it('calculates cacheHitRate correctly', () => {
    collector.init();
    // inputTokens=100, cacheReadTokens=100 -> totalInput=200, rate=50%
    collector.recordTokenUsage(100, 50, 100, 0);
    const metrics = collector.getMetrics();
    expect(metrics.cacheHitRate).toBeCloseTo(50, 1);
  });

  it('cacheHitRate is 0 when no tokens recorded', () => {
    collector.init();
    collector.recordTokenUsage(0, 0, 0, 0);
    const metrics = collector.getMetrics();
    expect(metrics.cacheHitRate).toBe(0);
  });

  it('cacheHitRate is 100 when all input is from cache', () => {
    collector.init();
    // inputTokens=0, cacheReadTokens=500 -> totalInput=500, rate=100%
    collector.recordTokenUsage(0, 50, 500, 0);
    const metrics = collector.getMetrics();
    expect(metrics.cacheHitRate).toBeCloseTo(100, 1);
  });

  it('updates estimatedCost after recording tokens', () => {
    collector.init();
    collector.recordTokenUsage(1_000_000, 0, 0, 0);
    const metrics = collector.getMetrics();
    // 1M input tokens at $3/MTok = $3.00
    expect(metrics.estimatedCost).toBeCloseTo(3.0, 5);
  });
});

describe('recordRateLimit()', () => {
  it('updates hourlyPercent and weeklyPercent', () => {
    collector.init();
    collector.recordRateLimit(45, 20);
    const metrics = collector.getMetrics();
    expect(metrics.rateLimit.hourlyPercent).toBe(45);
    expect(metrics.rateLimit.weeklyPercent).toBe(20);
  });

  it('sets resetInMs when provided', () => {
    collector.init();
    collector.recordRateLimit(50, 30, 60000);
    const metrics = collector.getMetrics();
    expect(metrics.rateLimit.resetInMs).toBe(60000);
  });

  it('sets resetInMs to null when not provided', () => {
    collector.init();
    collector.recordRateLimit(50, 30);
    const metrics = collector.getMetrics();
    expect(metrics.rateLimit.resetInMs).toBeNull();
  });
});

describe('estimateCost()', () => {
  it('calculates input cost at $3/MTok', () => {
    const cost = collector.estimateCost(1_000_000, 0, 0);
    expect(cost).toBeCloseTo(3.0, 10);
  });

  it('calculates output cost at $15/MTok', () => {
    const cost = collector.estimateCost(0, 1_000_000, 0);
    expect(cost).toBeCloseTo(15.0, 10);
  });

  it('calculates cache read cost at $0.30/MTok', () => {
    const cost = collector.estimateCost(0, 0, 1_000_000);
    expect(cost).toBeCloseTo(0.30, 10);
  });

  it('sums all three cost components', () => {
    // 1M input=$3, 1M output=$15, 1M cacheRead=$0.30 -> $18.30
    const cost = collector.estimateCost(1_000_000, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18.3, 5);
  });

  it('returns 0 for zero tokens', () => {
    expect(collector.estimateCost(0, 0, 0)).toBe(0);
  });

  it('scales proportionally for fractional millions', () => {
    // 500K input = $1.50
    const cost = collector.estimateCost(500_000, 0, 0);
    expect(cost).toBeCloseTo(1.5, 10);
  });
});

describe('reset()', () => {
  it('clears token counts back to zero', () => {
    collector.init();
    collector.recordTokenUsage(500, 200, 100, 50);
    collector.reset();
    const metrics = collector.getMetrics();
    expect(metrics.inputTokens).toBe(0);
    expect(metrics.outputTokens).toBe(0);
    expect(metrics.cacheReadTokens).toBe(0);
    expect(metrics.cacheWriteTokens).toBe(0);
  });

  it('clears estimated cost back to zero', () => {
    collector.init();
    collector.recordTokenUsage(1_000_000, 500_000, 0, 0);
    collector.reset();
    const metrics = collector.getMetrics();
    expect(metrics.estimatedCost).toBe(0);
  });

  it('clears cache hit rate back to zero', () => {
    collector.init();
    collector.recordTokenUsage(100, 50, 100, 0);
    collector.reset();
    const metrics = collector.getMetrics();
    expect(metrics.cacheHitRate).toBe(0);
  });

  it('clears rate limit info', () => {
    collector.init();
    collector.recordRateLimit(80, 60, 30000);
    collector.reset();
    const metrics = collector.getMetrics();
    expect(metrics.rateLimit.hourlyPercent).toBe(0);
    expect(metrics.rateLimit.weeklyPercent).toBe(0);
    expect(metrics.rateLimit.resetInMs).toBeNull();
  });

  it('metrics file still exists after reset', () => {
    collector.init();
    collector.reset();
    const metricsPath = join(tmpDir, 'hud-metrics.json');
    expect(existsSync(metricsPath)).toBe(true);
  });
});
