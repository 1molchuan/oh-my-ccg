// oh-my-ccg core type definitions

// ─── RPI Phase ─────────────────────────────────────────────

export type RpiPhase = 'init' | 'research' | 'plan' | 'impl' | 'review';

export interface RpiConstraint {
  id: string;
  type: 'hard' | 'soft';
  description: string;
  source: 'user' | 'codex' | 'gemini' | 'claude';
  verified: boolean;
}

export interface PbtProperty {
  id: string;
  name: string;
  description: string;
  invariant: string;
  relatedConstraints: string[];
}

export interface RpiState {
  phase: RpiPhase;
  changeId: string | null;
  changeName: string | null;
  constraints: RpiConstraint[];
  decisions: Record<string, string>;
  pbtProperties: PbtProperty[];
  artifacts: RpiArtifacts;
  history: RpiPhaseTransition[];
  createdAt: string;
  updatedAt: string;
}

export interface RpiArtifacts {
  proposal: string | null;
  specs: string[];
  design: string[];
  tasks: string | null;
}

export interface RpiPhaseTransition {
  from: RpiPhase;
  to: RpiPhase;
  timestamp: string;
  reason: string;
}

// ─── Agent ─────────────────────────────────────────────────

export type AgentName =
  | 'explore' | 'analyst' | 'planner' | 'architect'
  | 'executor' | 'debugger' | 'verifier' | 'reviewer'
  | 'test-engineer' | 'designer' | 'writer'
  | 'build-fixer' | 'critic' | 'git-master' | 'scientist';

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export interface AgentDefinition {
  name: AgentName;
  description: string;
  model: ModelTier;
  modelRouting?: ModelRoutingRule[];
}

export interface ModelRoutingRule {
  provider: 'codex' | 'gemini';
  role: string;
  when: string;
}

// ─── Model Router ──────────────────────────────────────────

export type ModelProvider = 'claude' | 'codex' | 'gemini';

export interface ModelRoutingDecision {
  provider: ModelProvider;
  role: string;
  reason: string;
}

export interface ModelResponse {
  provider: ModelProvider;
  role: string;
  content: string;
  jobId?: string;
  durationMs?: number;
}

// ─── Orchestration Modes ───────────────────────────────────

export type OrchestrationMode = 'team' | 'ralph' | 'autopilot';

export interface ModeState {
  mode: OrchestrationMode;
  active: boolean;
  iteration?: number;
  maxIterations?: number;
  phase?: string;
  startedAt: string;
  updatedAt: string;
}

export interface RalphState extends ModeState {
  mode: 'ralph';
  iteration: number;
  maxIterations: number;
  lastVerification: RalphVerification | null;
}

export interface RalphVerification {
  passed: boolean;
  tests: boolean;
  build: boolean;
  lsp: boolean;
  issues: string[];
  timestamp: string;
}

export interface TeamState extends ModeState {
  mode: 'team';
  teamName: string;
  workers: number;
  completedTasks: number;
  totalTasks: number;
}

export interface AutopilotState extends ModeState {
  mode: 'autopilot';
  rpiPhase: RpiPhase;
  autoTransition: boolean;
}

// ─── OpenSpec Bridge ───────────────────────────────────────

export interface OpenSpecChange {
  id: string;
  name: string;
  status: 'proposed' | 'planned' | 'in-progress' | 'completed' | 'archived';
}

// ─── HUD ───────────────────────────────────────────────────

export type HudPreset = 'minimal' | 'focused' | 'full' | 'analytics';

export interface HudConfig {
  preset: HudPreset;
  elements: HudElements;
  thresholds: HudThresholds;
}

export interface HudElements {
  rpiPhase: boolean;
  openspecChange: boolean;
  constraints: boolean;
  pbtProperties: boolean;
  multiModelStatus: boolean;
  agents: boolean;
  agentsFormat: 'count' | 'codes' | 'multiline';
  agentsMaxLines: number;
  orchestrationMode: boolean;
  contextBar: boolean;
  rateLimits: boolean;
  taskProgress: boolean;
  versionLabel: boolean;
  sessionAnalytics: boolean;
  showCost: boolean;
  showCache: boolean;
  callCounts: boolean;
  maxOutputLines: number;
  safeMode: boolean;
}

export interface HudThresholds {
  contextWarning: number;
  contextCritical: number;
  ralphWarning: number;
  budgetWarning: number;
  budgetCritical: number;
}

// ─── Composite Orchestration ──────────────────────────────

export interface TeamRalphState extends ModeState {
  mode: 'ralph';
  iteration: number;
  maxIterations: number;
  lastVerification: RalphVerification | null;
  linkedTeam: {
    enabled: boolean;
    teamName: string | null;
    workers: number;
    completedTasks: number;
    totalTasks: number;
  };
}

export interface AutopilotCompositeState extends ModeState {
  mode: 'autopilot';
  rpiPhase: RpiPhase;
  autoTransition: boolean;
  linkedRalph: boolean;
  linkedTeam: boolean;
  contextPercent: number;
  phasesCompleted: RpiPhase[];
  currentAction: string | null;
}

// ─── Git Worktree ─────────────────────────────────────────

export interface WorktreeInfo {
  path: string;
  branch: string;
  taskId: string | null;
  createdAt: string;
  status: 'active' | 'merged' | 'abandoned';
}

export interface WorktreeConfig {
  enabled: boolean;
  baseDir: string;           // default: '../.oh-my-ccg-worktrees'
  autoCleanup: boolean;
  maxWorktrees: number;
}

// ─── HUD Metrics ──────────────────────────────────────────

export interface HudMetrics {
  sessionDuration: number;   // ms
  sessionStartedAt: string;
  estimatedCost: number;     // USD
  cacheHitRate: number;      // 0-100
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  rateLimit: {
    hourlyPercent: number;
    weeklyPercent: number;
    resetInMs: number | null;
  };
}

// ─── i18n ─────────────────────────────────────────────────

export type Locale = 'zh' | 'en';

export interface I18nConfig {
  locale: Locale;
  fallback: Locale;
}

export type MessageKey =
  | 'rpi.init' | 'rpi.research' | 'rpi.plan' | 'rpi.impl' | 'rpi.review'
  | 'autopilot.started' | 'autopilot.cancelled' | 'autopilot.contextWarning'
  | 'autopilot.phaseComplete' | 'autopilot.allComplete'
  | 'ralph.started' | 'ralph.iteration' | 'ralph.passed' | 'ralph.failed' | 'ralph.maxReached'
  | 'team.created' | 'team.complete' | 'team.progress'
  | 'worktree.created' | 'worktree.merged' | 'worktree.cleaned'
  | 'error.noRpiState' | 'error.invalidTransition' | 'error.modeNotActive'
  | 'hud.contextWarning' | 'hud.contextCritical' | 'hud.budgetWarning';

export type MessageCatalog = Record<MessageKey, string>;

// ─── Config ────────────────────────────────────────────────

export interface OhMyCcgConfig {
  version: string;
  hud: HudConfig;
  defaultModel: ModelTier;
  locale: Locale;
  openspec: {
    enabled: boolean;
    autoInit: boolean;
  };
  models: {
    codex: { enabled: boolean; defaultRole: string };
    gemini: { enabled: boolean; defaultRole: string };
  };
  ralph: {
    maxIterations: number;
    linkedTeam: boolean;
  };
  autopilot: {
    contextThreshold: number;
    linkedRalph: boolean;
    linkedTeam: boolean;
  };
  worktree: WorktreeConfig;
}

// ─── State Manager ─────────────────────────────────────────

export interface StateManagerOptions {
  workDir: string;
  stateDir?: string;
}

// ─── Hook System ───────────────────────────────────────────

export type HookEvent =
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'PreCompact'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'SessionEnd';

export interface HookInput {
  hook_event_name: HookEvent;
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: string;
  tool_response?: string;
  prompt?: string;
}

export interface HookOutput {
  continue: boolean;
  suppress?: boolean;
  message?: string;
}
