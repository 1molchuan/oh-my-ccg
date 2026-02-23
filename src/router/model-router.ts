import type { ModelProvider, ModelRoutingDecision, ModelResponse } from '../types.js';

export interface RouteOptions {
  domain?: 'frontend' | 'backend' | 'fullstack' | 'general';
  agentRole?: string;
  requiresCrossValidation?: boolean;
}

export class ModelRouter {
  private codexEnabled: boolean;
  private geminiEnabled: boolean;

  constructor(options: { codexEnabled?: boolean; geminiEnabled?: boolean } = {}) {
    this.codexEnabled = options.codexEnabled ?? true;
    this.geminiEnabled = options.geminiEnabled ?? true;
  }

  /**
   * Route a single task to the most appropriate model provider.
   */
  routeTask(options: RouteOptions): ModelRoutingDecision {
    const { domain = 'general', agentRole } = options;

    // Frontend-heavy tasks → Gemini
    if (domain === 'frontend' && this.geminiEnabled) {
      return {
        provider: 'gemini',
        role: agentRole ?? 'designer',
        reason: `Frontend domain routed to Gemini (${agentRole ?? 'designer'})`,
      };
    }

    // Backend-heavy tasks → Codex
    if (domain === 'backend' && this.codexEnabled) {
      return {
        provider: 'codex',
        role: agentRole ?? 'architect',
        reason: `Backend domain routed to Codex (${agentRole ?? 'architect'})`,
      };
    }

    // Fullstack or general → Claude (with optional cross-validation)
    return {
      provider: 'claude',
      role: agentRole ?? 'executor',
      reason: `General domain handled by Claude (${agentRole ?? 'executor'})`,
    };
  }

  /**
   * Determine parallel routing for cross-validation scenarios.
   * Returns multiple routing decisions to be executed in parallel.
   */
  parallelRoute(options: RouteOptions): ModelRoutingDecision[] {
    const decisions: ModelRoutingDecision[] = [];
    const { agentRole, requiresCrossValidation } = options;

    if (requiresCrossValidation || options.domain === 'fullstack') {
      // Cross-validation: both Codex and Gemini
      if (this.codexEnabled) {
        decisions.push({
          provider: 'codex',
          role: agentRole ?? 'architect',
          reason: 'Cross-validation: Codex for backend/logic perspective',
        });
      }
      if (this.geminiEnabled) {
        decisions.push({
          provider: 'gemini',
          role: agentRole ?? 'designer',
          reason: 'Cross-validation: Gemini for frontend/pattern perspective',
        });
      }
    } else {
      // Single best route
      decisions.push(this.routeTask(options));
    }

    // Fallback to Claude if no external models available
    if (decisions.length === 0) {
      decisions.push({
        provider: 'claude',
        role: agentRole ?? 'executor',
        reason: 'Fallback: no external models available',
      });
    }

    return decisions;
  }

  /**
   * Get routing decisions for a specific agent based on its model_routing rules.
   */
  routeForAgent(agentName: string): ModelRoutingDecision[] {
    const agentRouting: Record<string, { codex?: string; gemini?: string }> = {
      analyst: { codex: 'analyst' },
      planner: { codex: 'planner', gemini: 'designer' },
      architect: { codex: 'architect' },
      verifier: { codex: 'code-reviewer' },
      reviewer: { codex: 'code-reviewer', gemini: 'designer' },
      critic: { codex: 'critic' },
      'test-engineer': { codex: 'test-engineer' },
      designer: { gemini: 'designer' },
      writer: { gemini: 'writer' },
    };

    const routing = agentRouting[agentName];
    if (!routing) return [];

    const decisions: ModelRoutingDecision[] = [];
    if (routing.codex && this.codexEnabled) {
      decisions.push({
        provider: 'codex',
        role: routing.codex,
        reason: `Agent ${agentName} routes to Codex as ${routing.codex}`,
      });
    }
    if (routing.gemini && this.geminiEnabled) {
      decisions.push({
        provider: 'gemini',
        role: routing.gemini,
        reason: `Agent ${agentName} routes to Gemini as ${routing.gemini}`,
      });
    }

    return decisions;
  }

  /**
   * Check model availability.
   */
  getAvailableModels(): ModelProvider[] {
    const models: ModelProvider[] = ['claude'];
    if (this.codexEnabled) models.push('codex');
    if (this.geminiEnabled) models.push('gemini');
    return models;
  }
}
