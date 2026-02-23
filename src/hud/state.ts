import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RpiPhase } from '../types.js';

export interface HudState {
  // RPI
  rpiPhase: RpiPhase | null;
  changeName: string | null;
  constraintsHard: number;
  constraintsSoft: number;
  pbtCount: number;
  tasksCompleted: number;
  tasksTotal: number;

  // Orchestration
  ralphIteration: number | null;
  ralphMax: number | null;
  autopilotPhase: string | null;
  teamWorkers: number | null;

  // Models
  claudeActive: boolean;
  codexActive: boolean;
  geminiActive: boolean;
  claudeTask: string;
  codexTask: string;
  geminiTask: string;

  // Agents
  agents: AgentInfo[];

  // Session
  contextPercent: number;
  toolCalls: number;
  agentCalls: number;
  skillCalls: number;
}

export interface AgentInfo {
  name: string;
  modelTier: 'O' | 'S' | 'H';
  duration: string;
  status: string;
}

function readJson(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function collectHudState(workDir: string, transcriptData?: Record<string, unknown>): HudState {
  const stateDir = join(workDir, '.oh-my-ccg', 'state');

  // RPI state
  const rpi = readJson(join(stateDir, 'rpi-state.json'));
  const constraints = (rpi?.constraints as Array<{ type: string }>) ?? [];
  const pbtProperties = (rpi?.pbtProperties as unknown[]) ?? [];

  // Mode states
  const ralph = readJson(join(stateDir, 'ralph-state.json'));
  const autopilot = readJson(join(stateDir, 'autopilot-state.json'));
  const team = readJson(join(stateDir, 'team-state.json'));

  // HUD-specific state (written by hooks/parser)
  const hudState = readJson(join(stateDir, 'hud-state.json'));

  // Context from transcript
  const contextPercent = (transcriptData?.context_window as number) ?? 0;

  return {
    rpiPhase: (rpi?.phase as RpiPhase) ?? null,
    changeName: (rpi?.changeName as string) ?? null,
    constraintsHard: constraints.filter(c => c.type === 'hard').length,
    constraintsSoft: constraints.filter(c => c.type === 'soft').length,
    pbtCount: pbtProperties.length,
    tasksCompleted: (hudState?.tasksCompleted as number) ?? 0,
    tasksTotal: (hudState?.tasksTotal as number) ?? 0,

    ralphIteration: ralph?.active ? (ralph.iteration as number) : null,
    ralphMax: ralph?.active ? (ralph.maxIterations as number) : null,
    autopilotPhase: autopilot?.active ? (autopilot.rpiPhase as string) : null,
    teamWorkers: team?.active ? (team.workers as number) : null,

    claudeActive: (hudState?.claudeActive as boolean) ?? true,
    codexActive: (hudState?.codexActive as boolean) ?? false,
    geminiActive: (hudState?.geminiActive as boolean) ?? false,
    claudeTask: (hudState?.claudeTask as string) ?? '',
    codexTask: (hudState?.codexTask as string) ?? '',
    geminiTask: (hudState?.geminiTask as string) ?? '',

    agents: (hudState?.agents as AgentInfo[]) ?? [],

    contextPercent,
    toolCalls: (hudState?.toolCalls as number) ?? 0,
    agentCalls: (hudState?.agentCalls as number) ?? 0,
    skillCalls: (hudState?.skillCalls as number) ?? 0,
  };
}
