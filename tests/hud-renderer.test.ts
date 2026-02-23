import { describe, it, expect } from 'vitest';
import { render } from '../src/hud/renderer.js';
import type { HudConfig, HudElements, HudThresholds } from '../src/types.js';
import type { HudState } from '../src/hud/state.js';

// ── Helpers ───────────────────────────────────────────────

function mockHudState(overrides: Partial<HudState> = {}): HudState {
  return {
    rpiPhase: 'impl',
    changeName: null,
    constraintsHard: 0,
    constraintsSoft: 0,
    pbtCount: 0,
    tasksCompleted: 0,
    tasksTotal: 0,
    ralphIteration: null,
    ralphMax: null,
    autopilotPhase: null,
    teamWorkers: null,
    claudeActive: true,
    codexActive: false,
    geminiActive: false,
    claudeTask: '',
    codexTask: '',
    geminiTask: '',
    agents: [],
    contextPercent: 67,
    toolCalls: 0,
    agentCalls: 0,
    skillCalls: 0,
    metrics: null,
    sessionDuration: '',
    estimatedCost: 0,
    cacheHitRate: 0,
    ...overrides,
  };
}

const BASE_THRESHOLDS: HudThresholds = {
  contextWarning: 70,
  contextCritical: 85,
  ralphWarning: 7,
  budgetWarning: 2.0,
  budgetCritical: 5.0,
};

const BASE_ELEMENTS: HudElements = {
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

function mockHudConfig(preset: HudConfig['preset'], elementOverrides: Partial<HudElements> = {}): HudConfig {
  const presetElements: Record<HudConfig['preset'], Partial<HudElements>> = {
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

  return {
    preset,
    elements: { ...BASE_ELEMENTS, ...presetElements[preset], ...elementOverrides },
    thresholds: BASE_THRESHOLDS,
  };
}

// Strip ANSI codes for assertion clarity
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// ── Tests ─────────────────────────────────────────────────

describe('render() - minimal preset', () => {
  it('returns a single-line string', () => {
    const state = mockHudState();
    const config = mockHudConfig('minimal');
    const output = render(state, config);
    expect(output).not.toContain('\n');
  });

  it('contains the CCG label', () => {
    const output = stripAnsi(render(mockHudState(), mockHudConfig('minimal')));
    expect(output).toContain('[CCG]');
  });

  it('contains RPI phase indicator IMPL', () => {
    const output = stripAnsi(render(mockHudState({ rpiPhase: 'impl' }), mockHudConfig('minimal')));
    expect(output).toContain('IMPL');
  });

  it('contains context bar with percent', () => {
    const output = stripAnsi(render(mockHudState({ contextPercent: 67 }), mockHudConfig('minimal')));
    expect(output).toContain('ctx:67%');
  });

  it('shows IDLE when rpiPhase is null', () => {
    const output = stripAnsi(render(mockHudState({ rpiPhase: null }), mockHudConfig('minimal')));
    expect(output).toContain('IDLE');
  });

  it('shows agent count when agents present', () => {
    const state = mockHudState({
      agents: [
        { name: 'executor', modelTier: 'S', duration: '5s', status: 'running' },
      ],
    });
    const output = stripAnsi(render(state, mockHudConfig('minimal')));
    expect(output).toContain('agents:1');
  });

  it('shows task progress when tasks set', () => {
    const state = mockHudState({ tasksCompleted: 3, tasksTotal: 5 });
    const output = stripAnsi(render(state, mockHudConfig('minimal')));
    expect(output).toContain('tasks: 3/5');
  });
});

describe('render() - focused preset', () => {
  it('returns a multi-line string', () => {
    const state = mockHudState({ changeName: 'my-feature' });
    const config = mockHudConfig('focused');
    const output = render(state, config);
    expect(output).toContain('\n');
  });

  it('contains RPI phase indicator', () => {
    const output = stripAnsi(render(mockHudState({ rpiPhase: 'plan' }), mockHudConfig('focused')));
    expect(output).toContain('PLAN');
  });

  it('contains context bar', () => {
    const output = stripAnsi(render(mockHudState({ contextPercent: 42 }), mockHudConfig('focused')));
    expect(output).toContain('ctx:42%');
  });

  it('shows change name when set', () => {
    const state = mockHudState({ changeName: 'auth-feature' });
    const output = stripAnsi(render(state, mockHudConfig('focused')));
    expect(output).toContain('auth-feature');
  });

  it('shows call counts when set', () => {
    const state = mockHudState({ toolCalls: 5, agentCalls: 2 });
    const output = stripAnsi(render(state, mockHudConfig('focused')));
    expect(output).toContain('T:5');
    expect(output).toContain('A:2');
  });

  it('respects maxOutputLines config', () => {
    const state = mockHudState({
      changeName: 'test',
      agents: [
        { name: 'executor', modelTier: 'S', duration: '5s', status: 'running' },
        { name: 'verifier', modelTier: 'H', duration: '2s', status: 'done' },
        { name: 'planner', modelTier: 'O', duration: '8s', status: 'running' },
      ],
    });
    const config = mockHudConfig('focused', { maxOutputLines: 2 });
    const output = render(state, config);
    const lines = output.split('\n');
    expect(lines.length).toBeLessThanOrEqual(2);
  });
});

describe('render() - full preset', () => {
  it('returns a multi-line string', () => {
    const output = render(mockHudState(), mockHudConfig('full'));
    expect(output).toContain('\n');
  });

  it('contains RPI phase indicator', () => {
    const output = stripAnsi(render(mockHudState({ rpiPhase: 'research' }), mockHudConfig('full')));
    expect(output).toContain('RESEARCH');
  });

  it('contains context bar', () => {
    const output = stripAnsi(render(mockHudState({ contextPercent: 55 }), mockHudConfig('full')));
    expect(output).toContain('ctx:55%');
  });

  it('contains multi-model status section', () => {
    const output = stripAnsi(render(mockHudState(), mockHudConfig('full')));
    expect(output).toContain('models:');
    expect(output).toContain('Claude');
    expect(output).toContain('Codex');
    expect(output).toContain('Gemini');
  });

  it('shows rate limits when metrics present', () => {
    const state = mockHudState({
      metrics: {
        sessionDuration: 60000,
        sessionStartedAt: new Date().toISOString(),
        estimatedCost: 0.5,
        cacheHitRate: 30,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        cacheWriteTokens: 100,
        rateLimit: { hourlyPercent: 25, weeklyPercent: 10, resetInMs: null },
      },
      estimatedCost: 0.5,
      cacheHitRate: 30,
    });
    const output = stripAnsi(render(state, mockHudConfig('full')));
    expect(output).toContain('rate:');
    expect(output).toContain('25%');
  });
});

describe('render() - phase indicator colors', () => {
  const phases: Array<'init' | 'research' | 'plan' | 'impl' | 'review'> = [
    'init', 'research', 'plan', 'impl', 'review',
  ];

  for (const phase of phases) {
    it(`phase "${phase}" produces different output than other phases`, () => {
      const config = mockHudConfig('minimal', { safeMode: false });
      const output = render(mockHudState({ rpiPhase: phase }), config);
      expect(output).toContain(phase.toUpperCase());
    });
  }

  it('different phases produce different ANSI color codes', () => {
    const config = mockHudConfig('minimal', { safeMode: false });
    const implOutput = render(mockHudState({ rpiPhase: 'impl' }), config);
    const reviewOutput = render(mockHudState({ rpiPhase: 'review' }), config);
    // impl uses GREEN (\x1b[32m), review uses MAGENTA (\x1b[35m)
    expect(implOutput).toContain('\x1b[32m');
    expect(reviewOutput).toContain('\x1b[35m');
    expect(implOutput).not.toEqual(reviewOutput);
  });
});

describe('render() - orchestration modes', () => {
  it('shows ralph iteration when ralph is active', () => {
    const state = mockHudState({ ralphIteration: 3, ralphMax: 10 });
    const output = stripAnsi(render(state, mockHudConfig('minimal')));
    expect(output).toContain('ralph:3/10');
  });

  it('shows autopilot phase when active', () => {
    const state = mockHudState({ autopilotPhase: 'research' });
    const output = stripAnsi(render(state, mockHudConfig('minimal')));
    expect(output).toContain('AP:research');
  });

  it('shows team workers when active', () => {
    const state = mockHudState({ teamWorkers: 4 });
    const output = stripAnsi(render(state, mockHudConfig('minimal')));
    expect(output).toContain('team:4w');
  });
});
