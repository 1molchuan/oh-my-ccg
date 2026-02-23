import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../src/router/model-router.js';

describe('ModelRouter', () => {
  describe('routeTask()', () => {
    it("domain='frontend' routes to gemini", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({ domain: 'frontend' });
      expect(decision.provider).toBe('gemini');
    });

    it("domain='backend' routes to codex", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({ domain: 'backend' });
      expect(decision.provider).toBe('codex');
    });

    it("domain='fullstack' routes to claude", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({ domain: 'fullstack' });
      expect(decision.provider).toBe('claude');
    });

    it("domain='general' routes to claude", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({ domain: 'general' });
      expect(decision.provider).toBe('claude');
    });

    it("no domain defaults to claude", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({});
      expect(decision.provider).toBe('claude');
    });

    it("domain='frontend' uses 'designer' role by default", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({ domain: 'frontend' });
      expect(decision.role).toBe('designer');
    });

    it("domain='backend' uses 'architect' role by default", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({ domain: 'backend' });
      expect(decision.role).toBe('architect');
    });

    it("agentRole overrides default role", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({ domain: 'frontend', agentRole: 'writer' });
      expect(decision.role).toBe('writer');
    });

    it("decision includes a reason string", () => {
      const router = new ModelRouter();
      const decision = router.routeTask({ domain: 'backend' });
      expect(typeof decision.reason).toBe('string');
      expect(decision.reason.length).toBeGreaterThan(0);
    });

    it("domain='frontend' routes to claude when gemini disabled", () => {
      const router = new ModelRouter({ geminiEnabled: false });
      const decision = router.routeTask({ domain: 'frontend' });
      expect(decision.provider).toBe('claude');
    });

    it("domain='backend' routes to claude when codex disabled", () => {
      const router = new ModelRouter({ codexEnabled: false });
      const decision = router.routeTask({ domain: 'backend' });
      expect(decision.provider).toBe('claude');
    });
  });

  describe('parallelRoute()', () => {
    it("returns both codex and gemini decisions for fullstack", () => {
      const router = new ModelRouter();
      const decisions = router.parallelRoute({ domain: 'fullstack' });
      const providers = decisions.map(d => d.provider);
      expect(providers).toContain('codex');
      expect(providers).toContain('gemini');
    });

    it("returns both codex and gemini when requiresCrossValidation=true", () => {
      const router = new ModelRouter();
      const decisions = router.parallelRoute({ requiresCrossValidation: true });
      const providers = decisions.map(d => d.provider);
      expect(providers).toContain('codex');
      expect(providers).toContain('gemini');
    });

    it("returns single decision for backend domain without cross-validation", () => {
      const router = new ModelRouter();
      const decisions = router.parallelRoute({ domain: 'backend' });
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.provider).toBe('codex');
    });

    it("returns single decision for frontend domain without cross-validation", () => {
      const router = new ModelRouter();
      const decisions = router.parallelRoute({ domain: 'frontend' });
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.provider).toBe('gemini');
    });

    it("falls back to claude when both external models disabled", () => {
      const router = new ModelRouter({ codexEnabled: false, geminiEnabled: false });
      const decisions = router.parallelRoute({ requiresCrossValidation: true });
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.provider).toBe('claude');
    });

    it("returns array", () => {
      const router = new ModelRouter();
      const decisions = router.parallelRoute({ domain: 'backend' });
      expect(Array.isArray(decisions)).toBe(true);
    });
  });

  describe('routeForAgent()', () => {
    it("routeForAgent('designer') routes to gemini", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('designer');
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.provider).toBe('gemini');
    });

    it("routeForAgent('architect') routes to codex", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('architect');
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.provider).toBe('codex');
    });

    it("routeForAgent('executor') returns empty array (no external routing)", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('executor');
      expect(decisions).toEqual([]);
    });

    it("routeForAgent('analyst') routes to codex", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('analyst');
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.provider).toBe('codex');
    });

    it("routeForAgent('writer') routes to gemini", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('writer');
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.provider).toBe('gemini');
    });

    it("routeForAgent('planner') routes to both codex and gemini", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('planner');
      const providers = decisions.map(d => d.provider);
      expect(providers).toContain('codex');
      expect(providers).toContain('gemini');
    });

    it("routeForAgent('reviewer') routes to both codex and gemini", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('reviewer');
      const providers = decisions.map(d => d.provider);
      expect(providers).toContain('codex');
      expect(providers).toContain('gemini');
    });

    it("routeForAgent('critic') routes to codex", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('critic');
      expect(decisions[0]!.provider).toBe('codex');
    });

    it("routeForAgent returns empty array for unknown agent", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('nonexistent-agent');
      expect(decisions).toEqual([]);
    });

    it("routeForAgent respects codexEnabled=false", () => {
      const router = new ModelRouter({ codexEnabled: false });
      const decisions = router.routeForAgent('architect');
      expect(decisions).toEqual([]);
    });

    it("routeForAgent respects geminiEnabled=false", () => {
      const router = new ModelRouter({ geminiEnabled: false });
      const decisions = router.routeForAgent('designer');
      expect(decisions).toEqual([]);
    });

    it("each decision has provider, role, and reason", () => {
      const router = new ModelRouter();
      const decisions = router.routeForAgent('architect');
      for (const d of decisions) {
        expect(d.provider).toBeDefined();
        expect(d.role).toBeDefined();
        expect(d.reason).toBeDefined();
      }
    });
  });

  describe('getAvailableModels()', () => {
    it("returns all three providers by default", () => {
      const router = new ModelRouter();
      const models = router.getAvailableModels();
      expect(models).toContain('claude');
      expect(models).toContain('codex');
      expect(models).toContain('gemini');
      expect(models).toHaveLength(3);
    });

    it("always includes 'claude'", () => {
      const router = new ModelRouter({ codexEnabled: false, geminiEnabled: false });
      const models = router.getAvailableModels();
      expect(models).toContain('claude');
      expect(models).toHaveLength(1);
    });

    it("excludes 'codex' when codexEnabled=false", () => {
      const router = new ModelRouter({ codexEnabled: false });
      const models = router.getAvailableModels();
      expect(models).not.toContain('codex');
      expect(models).toContain('gemini');
    });

    it("excludes 'gemini' when geminiEnabled=false", () => {
      const router = new ModelRouter({ geminiEnabled: false });
      const models = router.getAvailableModels();
      expect(models).not.toContain('gemini');
      expect(models).toContain('codex');
    });

    it("returns array of ModelProvider type values", () => {
      const router = new ModelRouter();
      const models = router.getAvailableModels();
      for (const m of models) {
        expect(['claude', 'codex', 'gemini']).toContain(m);
      }
    });
  });
});
