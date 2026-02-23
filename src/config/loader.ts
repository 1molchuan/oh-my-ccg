import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { OhMyCcgConfig } from '../types.js';
import { DEFAULT_CONFIG, validateConfig } from './schema.js';

export { DEFAULT_CONFIG } from './schema.js';

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal) &&
      targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal)
    ) {
      (result as Record<string, unknown>)[key as string] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else if (sourceVal !== undefined) {
      (result as Record<string, unknown>)[key as string] = sourceVal;
    }
  }
  return result;
}

function loadJsonConfig(filePath: string): Partial<OhMyCcgConfig> {
  if (!existsSync(filePath)) return {};
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Partial<OhMyCcgConfig>;
  } catch {
    return {};
  }
}

/**
 * Apply environment variable overrides onto the merged config.
 *
 * Mapping:
 *   OH_MY_CCG_LOCALE                    → locale
 *   OH_MY_CCG_DEFAULT_MODEL             → defaultModel
 *   OH_MY_CCG_HUD_PRESET                → hud.preset
 *   OH_MY_CCG_RALPH_MAX_ITERATIONS      → ralph.maxIterations  (number)
 *   OH_MY_CCG_AUTOPILOT_CONTEXT_THRESHOLD → autopilot.contextThreshold (number)
 *   OH_MY_CCG_WORKTREE_ENABLED          → worktree.enabled  (boolean)
 *   OH_MY_CCG_CODEX_ENABLED             → models.codex.enabled  (boolean)
 *   OH_MY_CCG_GEMINI_ENABLED            → models.gemini.enabled (boolean)
 */
export function applyEnvOverrides(config: OhMyCcgConfig): OhMyCcgConfig {
  const env = process.env;
  const result = deepMerge(
    config as unknown as Record<string, unknown>,
    {} as Record<string, unknown>,
  ) as unknown as OhMyCcgConfig;

  if (env.OH_MY_CCG_LOCALE !== undefined) {
    (result as unknown as Record<string, unknown>).locale = env.OH_MY_CCG_LOCALE;
  }

  if (env.OH_MY_CCG_DEFAULT_MODEL !== undefined) {
    (result as unknown as Record<string, unknown>).defaultModel = env.OH_MY_CCG_DEFAULT_MODEL;
  }

  if (env.OH_MY_CCG_HUD_PRESET !== undefined) {
    result.hud = { ...result.hud, preset: env.OH_MY_CCG_HUD_PRESET as OhMyCcgConfig['hud']['preset'] };
  }

  if (env.OH_MY_CCG_RALPH_MAX_ITERATIONS !== undefined) {
    const val = Number(env.OH_MY_CCG_RALPH_MAX_ITERATIONS);
    if (!Number.isNaN(val)) {
      result.ralph = { ...result.ralph, maxIterations: val };
    }
  }

  if (env.OH_MY_CCG_AUTOPILOT_CONTEXT_THRESHOLD !== undefined) {
    const val = Number(env.OH_MY_CCG_AUTOPILOT_CONTEXT_THRESHOLD);
    if (!Number.isNaN(val)) {
      result.autopilot = { ...result.autopilot, contextThreshold: val };
    }
  }

  if (env.OH_MY_CCG_WORKTREE_ENABLED !== undefined) {
    const enabled = env.OH_MY_CCG_WORKTREE_ENABLED === 'true' || env.OH_MY_CCG_WORKTREE_ENABLED === '1';
    result.worktree = { ...result.worktree, enabled };
  }

  if (env.OH_MY_CCG_CODEX_ENABLED !== undefined) {
    const enabled = env.OH_MY_CCG_CODEX_ENABLED === 'true' || env.OH_MY_CCG_CODEX_ENABLED === '1';
    result.models = {
      ...result.models,
      codex: { ...result.models.codex, enabled },
    };
  }

  if (env.OH_MY_CCG_GEMINI_ENABLED !== undefined) {
    const enabled = env.OH_MY_CCG_GEMINI_ENABLED === 'true' || env.OH_MY_CCG_GEMINI_ENABLED === '1';
    result.models = {
      ...result.models,
      gemini: { ...result.models.gemini, enabled },
    };
  }

  return result;
}

/**
 * Load and merge config from three sources in priority order:
 *   DEFAULT → global (~/.oh-my-ccg/config.json) → project ({workDir}/.oh-my-ccg/config.json) → ENV
 */
export function loadConfig(workDir: string): OhMyCcgConfig {
  // 1. Start from defaults
  let merged: OhMyCcgConfig = { ...DEFAULT_CONFIG };

  // 2. Merge global config
  const globalConfigPath = join(homedir(), '.oh-my-ccg', 'config.json');
  const globalConfig = loadJsonConfig(globalConfigPath);
  if (Object.keys(globalConfig).length > 0) {
    merged = deepMerge(
      merged as unknown as Record<string, unknown>,
      globalConfig as Record<string, unknown>,
    ) as unknown as OhMyCcgConfig;
  }

  // 3. Merge project config
  const projectConfigPath = join(workDir, '.oh-my-ccg', 'config.json');
  const projectConfig = loadJsonConfig(projectConfigPath);
  if (Object.keys(projectConfig).length > 0) {
    merged = deepMerge(
      merged as unknown as Record<string, unknown>,
      projectConfig as Record<string, unknown>,
    ) as unknown as OhMyCcgConfig;
  }

  // 4. Validate
  if (!validateConfig(merged)) {
    console.error('[oh-my-ccg] Invalid config, using defaults');
    return applyEnvOverrides({ ...DEFAULT_CONFIG });
  }

  // 5. Apply ENV overrides last
  return applyEnvOverrides(merged);
}
