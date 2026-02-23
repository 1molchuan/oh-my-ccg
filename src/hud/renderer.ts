import type { HudConfig, HudPreset } from '../types.js';
import type { HudState, AgentInfo } from './state.js';
import { sanitize, truncateLine } from './sanitize.js';

// ANSI color helpers
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const GRAY = '\x1b[90m';

// RPI phase colors
const PHASE_COLORS: Record<string, string> = {
  init: BLUE,
  research: CYAN,
  plan: YELLOW,
  impl: GREEN,
  review: MAGENTA,
};

function phaseIndicator(phase: string | null): string {
  if (!phase) return `${GRAY}◆IDLE${RESET}`;
  const color = PHASE_COLORS[phase] ?? WHITE;
  return `${color}${BOLD}◆${phase.toUpperCase()}${RESET}`;
}

function contextBar(percent: number, config: HudConfig): string {
  const { contextWarning, contextCritical } = config.thresholds;
  const color = percent >= contextCritical ? RED :
                percent >= contextWarning ? YELLOW : GREEN;
  return `${color}ctx:${percent}%${RESET}`;
}

function orchestrationMode(state: HudState): string {
  const parts: string[] = [];
  if (state.ralphIteration !== null) {
    parts.push(`ralph:${state.ralphIteration}/${state.ralphMax}`);
  }
  if (state.autopilotPhase) {
    parts.push(`AP:${state.autopilotPhase}`);
  }
  if (state.teamWorkers !== null) {
    parts.push(`team:${state.teamWorkers}w`);
  }
  return parts.join(' ');
}

function agentCodes(agents: AgentInfo[]): string {
  return agents.map(a => {
    const color = a.modelTier === 'O' ? MAGENTA :
                  a.modelTier === 'H' ? GREEN : YELLOW;
    return `${color}${a.modelTier}${RESET}`;
  }).join('');
}

function agentTree(agents: AgentInfo[], maxLines: number): string[] {
  const lines: string[] = [];
  const shown = agents.slice(0, maxLines);

  for (let i = 0; i < shown.length; i++) {
    const a = shown[i];
    const isLast = i === shown.length - 1;
    const prefix = isLast ? '└─' : '├─';
    const color = a.modelTier === 'O' ? MAGENTA :
                  a.modelTier === 'H' ? GREEN : YELLOW;
    const tierChar = `${color}${a.modelTier}${RESET}`;
    lines.push(`${prefix} ${tierChar} ${WHITE}${a.name.padEnd(12)}${RESET} ${DIM}${a.duration.padEnd(4)}${RESET} ${a.status}`);
  }

  if (agents.length > maxLines) {
    lines.push(`${DIM}   +${agents.length - maxLines} more${RESET}`);
  }

  return lines;
}

function taskProgress(completed: number, total: number): string {
  if (total === 0) return '';
  return `tasks: ${completed}/${total}`;
}

function callCounts(state: HudState): string {
  const parts: string[] = [];
  if (state.toolCalls > 0) parts.push(`T:${state.toolCalls}`);
  if (state.agentCalls > 0) parts.push(`A:${state.agentCalls}`);
  if (state.skillCalls > 0) parts.push(`S:${state.skillCalls}`);
  return parts.join(' ');
}

// ── Metrics Helpers ───────────────────────────────────────

// Format milliseconds as "19m" or "2h15m"
function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
}

// Format USD cost as "$1.24"
function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

// Compose the metrics footer line
function metricsLine(state: HudState, config: HudConfig): string {
  const parts: string[] = [];
  if (state.sessionDuration) {
    parts.push(`session:${state.sessionDuration}`);
  }
  if (config.elements.showCost) {
    parts.push(`${formatCost(state.estimatedCost)}`);
  }
  if (config.elements.showCache) {
    parts.push(`cache:${Math.round(state.cacheHitRate)}%`);
  }
  return parts.join(' | ');
}

// ── Preset Renderers ──────────────────────────────────────

function renderMinimal(state: HudState, config: HudConfig): string {
  const parts = [
    `${BOLD}[CCG]${RESET}`,
    phaseIndicator(state.rpiPhase),
  ];

  const mode = orchestrationMode(state);
  if (mode) parts.push(mode);

  parts.push(contextBar(state.contextPercent, config));

  if (state.agents.length > 0) {
    parts.push(`agents:${state.agents.length}`);
  }

  const tp = taskProgress(state.tasksCompleted, state.tasksTotal);
  if (tp) parts.push(tp);

  return parts.join(' | ');
}

function renderFocused(state: HudState, config: HudConfig): string[] {
  const lines: string[] = [];

  // Line 1: Main status
  const mainParts = [
    `${BOLD}[CCG#1.0.0]${RESET}`,
    phaseIndicator(state.rpiPhase),
  ];

  const mode = orchestrationMode(state);
  if (mode) mainParts.push(mode);

  mainParts.push(contextBar(state.contextPercent, config));

  if (config.elements.agents && state.agents.length > 0) {
    mainParts.push(`agents:${agentCodes(state.agents)}`);
  }

  const cc = callCounts(state);
  if (config.elements.callCounts && cc) mainParts.push(cc);

  lines.push(mainParts.join(' | '));

  // Line 2: Change info
  if (config.elements.openspecChange && state.changeName) {
    const changeParts = [`change: ${state.changeName}`];
    const tp = taskProgress(state.tasksCompleted, state.tasksTotal);
    if (tp) changeParts.push(tp);
    if (config.elements.pbtProperties && state.pbtCount > 0) {
      changeParts.push(`PBT: ${state.pbtCount} props`);
    }
    lines.push(changeParts.join(' | '));
  }

  // Lines 3+: Agent tree
  if (config.elements.agents && config.elements.agentsFormat === 'multiline' && state.agents.length > 0) {
    lines.push(...agentTree(state.agents, config.elements.agentsMaxLines));
  }

  // Footer: session analytics
  if (config.elements.sessionAnalytics) {
    const ml = metricsLine(state, config);
    if (ml) lines.push(ml);
  }

  return lines;
}

function renderFull(state: HudState, config: HudConfig): string[] {
  const lines: string[] = [];

  // Git info line (placeholder)
  lines.push(`${DIM}oh-my-ccg/main | ${state.agents.length > 0 ? state.agents[0].name : 'idle'}${RESET}`);

  // Main status line
  const mainParts = [
    `${BOLD}[CCG#1.0.0]${RESET}`,
    phaseIndicator(state.rpiPhase),
    contextBar(state.contextPercent, config),
    callCounts(state),
  ];
  const mode = orchestrationMode(state);
  if (mode) mainParts.push(mode);
  lines.push(mainParts.join(' | '));

  // RPI context line
  if (state.changeName) {
    const ctxParts = [`change: ${state.changeName}`];
    if (config.elements.constraints) {
      ctxParts.push(`constraints: ${state.constraintsHard}H/${state.constraintsSoft}S`);
    }
    lines.push(ctxParts.join(' | '));
  }

  // Multi-model status
  if (config.elements.multiModelStatus) {
    lines.push(`${DIM}models:${RESET}`);
    const claudeStatus = state.claudeActive ? `${GREEN}●${RESET} active` : `${GRAY}○${RESET} idle`;
    lines.push(`  Claude  ${claudeStatus}  ${state.claudeTask}`);
    const codexStatus = state.codexActive ? `${GREEN}●${RESET} running` : `${GRAY}○${RESET} idle`;
    lines.push(`  Codex   ${codexStatus}  ${state.codexTask}`);
    const geminiStatus = state.geminiActive ? `${GREEN}●${RESET} running` : `${GRAY}○${RESET} idle`;
    lines.push(`  Gemini  ${geminiStatus}  ${state.geminiTask}`);
  }

  // Agent tree
  if (config.elements.agents && state.agents.length > 0) {
    lines.push(`${DIM}agents:${RESET}`);
    lines.push(...agentTree(state.agents, config.elements.agentsMaxLines));
  }

  // Tasks + analytics
  const footerParts: string[] = [];
  const tp = taskProgress(state.tasksCompleted, state.tasksTotal);
  if (tp) footerParts.push(tp);
  if (footerParts.length > 0) lines.push(footerParts.join(' | '));

  // Metrics footer: session duration, cost, cache rate
  if (state.metrics) {
    const dur = formatDuration(state.metrics.sessionDuration);
    const cost = formatCost(state.estimatedCost);
    const cacheRate = Math.round(state.cacheHitRate);
    lines.push(`session:${dur} | 💰${cost} | 💾${cacheRate}% cache`);
  }

  // Rate limit display
  if (config.elements.rateLimits && state.metrics) {
    const { hourlyPercent, weeklyPercent } = state.metrics.rateLimit;
    lines.push(`rate: ${hourlyPercent}% hourly | ${weeklyPercent}% weekly`);
  }

  return lines;
}

// ── Main Render ───────────────────────────────────────────

export function render(state: HudState, config: HudConfig): string {
  let output: string[];

  switch (config.preset) {
    case 'minimal':
      output = [renderMinimal(state, config)];
      break;
    case 'focused':
      output = renderFocused(state, config);
      break;
    case 'full':
      output = renderFull(state, config);
      break;
    case 'analytics':
      output = renderFocused(state, config); // analytics uses focused layout with extra metrics
      break;
    default:
      output = renderFocused(state, config);
  }

  // Apply max output lines
  if (output.length > config.elements.maxOutputLines) {
    output = output.slice(0, config.elements.maxOutputLines);
  }

  // Sanitize if needed
  const joined = output.join('\n');
  return sanitize(joined, config.elements.safeMode);
}
