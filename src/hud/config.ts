import type { HudConfig, HudPreset, HudElements, HudThresholds } from '../types.js';

const DEFAULT_THRESHOLDS: HudThresholds = {
  contextWarning: 70,
  contextCritical: 85,
  ralphWarning: 7,
  budgetWarning: 2.0,
  budgetCritical: 5.0,
};

const PRESET_ELEMENTS: Record<HudPreset, Partial<HudElements>> = {
  minimal: {
    rpiPhase: true,
    orchestrationMode: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'count',
    taskProgress: true,
    versionLabel: true,
    openspecChange: false,
    constraints: false,
    pbtProperties: false,
    multiModelStatus: false,
    rateLimits: false,
    sessionAnalytics: false,
    showCost: false,
    showCache: false,
    callCounts: false,
    maxOutputLines: 1,
    safeMode: true,
  },
  focused: {
    rpiPhase: true,
    orchestrationMode: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'multiline',
    agentsMaxLines: 3,
    taskProgress: true,
    versionLabel: true,
    openspecChange: true,
    constraints: true,
    pbtProperties: true,
    multiModelStatus: false,
    rateLimits: true,
    sessionAnalytics: false,
    showCost: false,
    showCache: false,
    callCounts: true,
    maxOutputLines: 6,
    safeMode: true,
  },
  full: {
    rpiPhase: true,
    orchestrationMode: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'multiline',
    agentsMaxLines: 8,
    taskProgress: true,
    versionLabel: true,
    openspecChange: true,
    constraints: true,
    pbtProperties: true,
    multiModelStatus: true,
    rateLimits: true,
    sessionAnalytics: true,
    showCost: true,
    showCache: true,
    callCounts: true,
    maxOutputLines: 14,
    safeMode: true,
  },
  analytics: {
    rpiPhase: true,
    orchestrationMode: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'codes',
    taskProgress: true,
    versionLabel: true,
    openspecChange: true,
    constraints: false,
    pbtProperties: false,
    multiModelStatus: false,
    rateLimits: true,
    sessionAnalytics: true,
    showCost: true,
    showCache: true,
    callCounts: true,
    maxOutputLines: 5,
    safeMode: true,
  },
};

const DEFAULT_ELEMENTS: HudElements = {
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
};

export function resolveHudConfig(userConfig?: Partial<HudConfig>): HudConfig {
  const preset = userConfig?.preset ?? 'focused';
  const presetElements = PRESET_ELEMENTS[preset] ?? PRESET_ELEMENTS.focused;

  const elements: HudElements = {
    ...DEFAULT_ELEMENTS,
    ...presetElements,
    ...(userConfig?.elements ?? {}),
  };

  const thresholds: HudThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(userConfig?.thresholds ?? {}),
  };

  return { preset, elements, thresholds };
}
