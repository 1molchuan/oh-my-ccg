import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { HudMetrics } from '../types.js';

const DEFAULT_METRICS: HudMetrics = {
  sessionDuration: 0,
  sessionStartedAt: new Date().toISOString(),
  estimatedCost: 0,
  cacheHitRate: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  rateLimit: { hourlyPercent: 0, weeklyPercent: 0, resetInMs: null },
};

export class HudMetricsCollector {
  private readonly metricsPath: string;

  constructor(stateDir: string) {
    this.metricsPath = join(stateDir, 'hud-metrics.json');
  }

  // Create initial metrics file with current timestamp as session start
  init(): void {
    const initial: HudMetrics = {
      ...DEFAULT_METRICS,
      sessionStartedAt: new Date().toISOString(),
    };
    this.save(initial);
  }

  // Load metrics and recalculate sessionDuration from sessionStartedAt
  getMetrics(): HudMetrics {
    const metrics = this.load();
    const startedAt = new Date(metrics.sessionStartedAt).getTime();
    const now = Date.now();
    metrics.sessionDuration = now - startedAt;
    return metrics;
  }

  // Accumulate token counts and recalculate cost and cache hit rate
  recordTokenUsage(
    input: number,
    output: number,
    cacheRead = 0,
    cacheWrite = 0,
  ): void {
    const metrics = this.load();
    metrics.inputTokens += input;
    metrics.outputTokens += output;
    metrics.cacheReadTokens += cacheRead;
    metrics.cacheWriteTokens += cacheWrite;
    metrics.estimatedCost = this.estimateCost(
      metrics.inputTokens,
      metrics.outputTokens,
      metrics.cacheReadTokens,
    );
    const totalInput = metrics.inputTokens + metrics.cacheReadTokens;
    metrics.cacheHitRate =
      totalInput > 0 ? (metrics.cacheReadTokens / totalInput) * 100 : 0;
    this.save(metrics);
  }

  // Update rate limit info
  recordRateLimit(
    hourlyPercent: number,
    weeklyPercent: number,
    resetInMs?: number,
  ): void {
    const metrics = this.load();
    metrics.rateLimit = {
      hourlyPercent,
      weeklyPercent,
      resetInMs: resetInMs ?? null,
    };
    this.save(metrics);
  }

  // Calculate cost using Claude pricing: input=$3/MTok, output=$15/MTok, cacheRead=$0.30/MTok
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens: number,
  ): number {
    const inputCost = (inputTokens / 1_000_000) * 3.0;
    const outputCost = (outputTokens / 1_000_000) * 15.0;
    const cacheReadCost = (cacheReadTokens / 1_000_000) * 0.30;
    return inputCost + outputCost + cacheReadCost;
  }

  // Clear metrics file
  reset(): void {
    this.save({ ...DEFAULT_METRICS });
  }

  private load(): HudMetrics {
    if (!existsSync(this.metricsPath)) {
      return { ...DEFAULT_METRICS };
    }
    try {
      const raw = readFileSync(this.metricsPath, 'utf-8');
      return JSON.parse(raw) as HudMetrics;
    } catch {
      return { ...DEFAULT_METRICS };
    }
  }

  private save(metrics: HudMetrics): void {
    const dir = dirname(this.metricsPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
  }
}
