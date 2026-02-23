import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DEFAULT_CONFIG, loadConfig, applyEnvOverrides } from '../src/config/loader.js';
import { validateConfig } from '../src/config/schema.js';
import type { OhMyCcgConfig } from '../src/types.js';

// ── DEFAULT_CONFIG ─────────────────────────────────────────────────────────────

describe('DEFAULT_CONFIG', () => {
  it('has expected top-level shape', () => {
    expect(DEFAULT_CONFIG).toHaveProperty('version');
    expect(DEFAULT_CONFIG).toHaveProperty('hud');
    expect(DEFAULT_CONFIG).toHaveProperty('defaultModel');
    expect(DEFAULT_CONFIG).toHaveProperty('locale');
    expect(DEFAULT_CONFIG).toHaveProperty('openspec');
    expect(DEFAULT_CONFIG).toHaveProperty('models');
    expect(DEFAULT_CONFIG).toHaveProperty('ralph');
    expect(DEFAULT_CONFIG).toHaveProperty('autopilot');
    expect(DEFAULT_CONFIG).toHaveProperty('worktree');
  });

  it('has correct default values', () => {
    expect(DEFAULT_CONFIG.version).toBe('1.0.0');
    expect(DEFAULT_CONFIG.defaultModel).toBe('sonnet');
    expect(DEFAULT_CONFIG.locale).toBe('zh');
  });

  it('has correct hud defaults', () => {
    expect(DEFAULT_CONFIG.hud.preset).toBe('focused');
    expect(DEFAULT_CONFIG.hud.thresholds.contextWarning).toBe(70);
    expect(DEFAULT_CONFIG.hud.thresholds.contextCritical).toBe(85);
    expect(DEFAULT_CONFIG.hud.thresholds.ralphWarning).toBe(7);
    expect(DEFAULT_CONFIG.hud.thresholds.budgetWarning).toBe(2.0);
    expect(DEFAULT_CONFIG.hud.thresholds.budgetCritical).toBe(5.0);
  });

  it('has correct openspec defaults', () => {
    expect(DEFAULT_CONFIG.openspec.enabled).toBe(true);
    expect(DEFAULT_CONFIG.openspec.autoInit).toBe(false);
  });

  it('has correct models defaults', () => {
    expect(DEFAULT_CONFIG.models.codex.enabled).toBe(true);
    expect(DEFAULT_CONFIG.models.codex.defaultRole).toBe('architect');
    expect(DEFAULT_CONFIG.models.gemini.enabled).toBe(true);
    expect(DEFAULT_CONFIG.models.gemini.defaultRole).toBe('designer');
  });

  it('has correct ralph defaults', () => {
    expect(DEFAULT_CONFIG.ralph.maxIterations).toBe(10);
    expect(DEFAULT_CONFIG.ralph.linkedTeam).toBe(false);
  });

  it('has correct autopilot defaults', () => {
    expect(DEFAULT_CONFIG.autopilot.contextThreshold).toBe(80);
    expect(DEFAULT_CONFIG.autopilot.linkedRalph).toBe(true);
    expect(DEFAULT_CONFIG.autopilot.linkedTeam).toBe(true);
  });

  it('has correct worktree defaults', () => {
    expect(DEFAULT_CONFIG.worktree.enabled).toBe(false);
    expect(DEFAULT_CONFIG.worktree.baseDir).toBe('../.oh-my-ccg-worktrees');
    expect(DEFAULT_CONFIG.worktree.autoCleanup).toBe(true);
    expect(DEFAULT_CONFIG.worktree.maxWorktrees).toBe(5);
  });
});

// ── validateConfig ─────────────────────────────────────────────────────────────

describe('validateConfig()', () => {
  it('returns true for a valid config object', () => {
    expect(validateConfig(DEFAULT_CONFIG)).toBe(true);
  });

  it('returns true for a minimal object with version string', () => {
    expect(validateConfig({ version: '2.0.0' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(validateConfig(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(validateConfig(undefined)).toBe(false);
  });

  it('returns false for an object missing version', () => {
    expect(validateConfig({ locale: 'en' })).toBe(false);
  });

  it('returns false for an object with non-string version', () => {
    expect(validateConfig({ version: 42 })).toBe(false);
  });

  it('returns false for a primitive value', () => {
    expect(validateConfig('string')).toBe(false);
    expect(validateConfig(42)).toBe(false);
  });
});

// ── loadConfig ─────────────────────────────────────────────────────────────────

describe('loadConfig()', () => {
  let tmpDir: string;
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tmpDir = mkdtempSync(`${tmpdir()}/oh-my-ccg-config-test-`);
    savedEnv = { ...process.env };
    // Clear env overrides so they don't pollute these tests
    delete process.env.OH_MY_CCG_LOCALE;
    delete process.env.OH_MY_CCG_DEFAULT_MODEL;
    delete process.env.OH_MY_CCG_HUD_PRESET;
    delete process.env.OH_MY_CCG_RALPH_MAX_ITERATIONS;
    delete process.env.OH_MY_CCG_WORKTREE_ENABLED;
    delete process.env.OH_MY_CCG_CODEX_ENABLED;
    delete process.env.OH_MY_CCG_GEMINI_ENABLED;
    delete process.env.OH_MY_CCG_AUTOPILOT_CONTEXT_THRESHOLD;
  });

  afterEach(() => {
    process.env = savedEnv;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', () => {
    const config = loadConfig(tmpDir);
    expect(config.version).toBe(DEFAULT_CONFIG.version);
    expect(config.defaultModel).toBe(DEFAULT_CONFIG.defaultModel);
    expect(config.locale).toBe(DEFAULT_CONFIG.locale);
  });

  it('merges project config over defaults', () => {
    const projectDir = join(tmpDir, '.oh-my-ccg');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, 'config.json'),
      JSON.stringify({ version: '1.0.0', locale: 'en', defaultModel: 'opus' }),
      'utf-8',
    );

    const config = loadConfig(tmpDir);
    expect(config.locale).toBe('en');
    expect(config.defaultModel).toBe('opus');
  });

  it('project config deep-merges nested fields', () => {
    const projectDir = join(tmpDir, '.oh-my-ccg');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, 'config.json'),
      JSON.stringify({ version: '1.0.0', ralph: { maxIterations: 20 } }),
      'utf-8',
    );

    const config = loadConfig(tmpDir);
    expect(config.ralph.maxIterations).toBe(20);
    // linkedTeam should remain from defaults
    expect(config.ralph.linkedTeam).toBe(DEFAULT_CONFIG.ralph.linkedTeam);
  });

  it('falls back to defaults when project config is invalid JSON', () => {
    const projectDir = join(tmpDir, '.oh-my-ccg');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'config.json'), 'NOT JSON', 'utf-8');

    const config = loadConfig(tmpDir);
    expect(config.version).toBe(DEFAULT_CONFIG.version);
  });
});

// ── applyEnvOverrides ──────────────────────────────────────────────────────────

describe('applyEnvOverrides()', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let baseConfig: OhMyCcgConfig;

  beforeEach(() => {
    savedEnv = { ...process.env };
    baseConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as OhMyCcgConfig;
    // Clear all OH_MY_CCG_* vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('OH_MY_CCG_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('OH_MY_CCG_LOCALE sets locale', () => {
    process.env.OH_MY_CCG_LOCALE = 'en';
    const result = applyEnvOverrides(baseConfig);
    expect(result.locale).toBe('en');
  });

  it('OH_MY_CCG_DEFAULT_MODEL sets defaultModel', () => {
    process.env.OH_MY_CCG_DEFAULT_MODEL = 'opus';
    const result = applyEnvOverrides(baseConfig);
    expect(result.defaultModel).toBe('opus');
  });

  it('OH_MY_CCG_HUD_PRESET sets hud.preset', () => {
    process.env.OH_MY_CCG_HUD_PRESET = 'minimal';
    const result = applyEnvOverrides(baseConfig);
    expect(result.hud.preset).toBe('minimal');
  });

  it('OH_MY_CCG_RALPH_MAX_ITERATIONS sets ralph.maxIterations as number', () => {
    process.env.OH_MY_CCG_RALPH_MAX_ITERATIONS = '25';
    const result = applyEnvOverrides(baseConfig);
    expect(result.ralph.maxIterations).toBe(25);
    expect(typeof result.ralph.maxIterations).toBe('number');
  });

  it('OH_MY_CCG_RALPH_MAX_ITERATIONS ignores non-numeric value', () => {
    process.env.OH_MY_CCG_RALPH_MAX_ITERATIONS = 'not-a-number';
    const result = applyEnvOverrides(baseConfig);
    expect(result.ralph.maxIterations).toBe(DEFAULT_CONFIG.ralph.maxIterations);
  });

  it('OH_MY_CCG_WORKTREE_ENABLED="true" sets worktree.enabled to true', () => {
    process.env.OH_MY_CCG_WORKTREE_ENABLED = 'true';
    const result = applyEnvOverrides(baseConfig);
    expect(result.worktree.enabled).toBe(true);
  });

  it('OH_MY_CCG_WORKTREE_ENABLED="1" sets worktree.enabled to true', () => {
    process.env.OH_MY_CCG_WORKTREE_ENABLED = '1';
    const result = applyEnvOverrides(baseConfig);
    expect(result.worktree.enabled).toBe(true);
  });

  it('OH_MY_CCG_WORKTREE_ENABLED="false" sets worktree.enabled to false', () => {
    process.env.OH_MY_CCG_WORKTREE_ENABLED = 'false';
    const result = applyEnvOverrides(baseConfig);
    expect(result.worktree.enabled).toBe(false);
  });

  it('ENV overrides do not mutate the original config', () => {
    process.env.OH_MY_CCG_LOCALE = 'en';
    process.env.OH_MY_CCG_DEFAULT_MODEL = 'opus';
    const original = JSON.parse(JSON.stringify(baseConfig)) as OhMyCcgConfig;
    applyEnvOverrides(baseConfig);
    expect(baseConfig.locale).toBe(original.locale);
    expect(baseConfig.defaultModel).toBe(original.defaultModel);
  });

  it('no env vars set: returns config with same values', () => {
    const result = applyEnvOverrides(baseConfig);
    expect(result.locale).toBe(baseConfig.locale);
    expect(result.defaultModel).toBe(baseConfig.defaultModel);
    expect(result.ralph.maxIterations).toBe(baseConfig.ralph.maxIterations);
  });

  it('OH_MY_CCG_AUTOPILOT_CONTEXT_THRESHOLD sets autopilot.contextThreshold as number', () => {
    process.env.OH_MY_CCG_AUTOPILOT_CONTEXT_THRESHOLD = '90';
    const result = applyEnvOverrides(baseConfig);
    expect(result.autopilot.contextThreshold).toBe(90);
  });
});
