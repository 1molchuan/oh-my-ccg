import type { OhMyCcgConfig, HudConfig } from '../types.js';

export const DEFAULT_HUD_CONFIG: HudConfig = {
  preset: 'focused',
  elements: {
    rpiPhase: true,
    openspecChange: true,
    constraints: true,
    pbtProperties: true,
    multiModelStatus: true,
    agents: true,
    agentsFormat: 'multiline',
    agentsMaxLines: 3,
    orchestrationMode: true,
    contextBar: true,
    rateLimits: true,
    taskProgress: true,
    versionLabel: true,
    sessionAnalytics: false,
    showCost: false,
    showCache: false,
    callCounts: true,
    maxOutputLines: 10,
    safeMode: true,
  },
  thresholds: {
    contextWarning: 70,
    contextCritical: 85,
    ralphWarning: 7,
    budgetWarning: 2.0,
    budgetCritical: 5.0,
  },
};

export const DEFAULT_CONFIG: OhMyCcgConfig = {
  version: '1.0.0',
  hud: DEFAULT_HUD_CONFIG,
  defaultModel: 'sonnet',
  openspec: {
    enabled: true,
    autoInit: false,
  },
  models: {
    codex: { enabled: true, defaultRole: 'architect' },
    gemini: { enabled: true, defaultRole: 'designer' },
  },
  ralph: {
    maxIterations: 10,
  },
  autopilot: {
    contextThreshold: 80,
  },
};

export function validateConfig(config: unknown): config is OhMyCcgConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  return typeof c.version === 'string';
}
