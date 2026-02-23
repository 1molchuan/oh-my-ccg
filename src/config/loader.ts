import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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

export function loadConfig(workDir: string): OhMyCcgConfig {
  const configPath = join(workDir, '.oh-my-ccg', 'config.json');

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(raw);

    const merged = deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      userConfig as Record<string, unknown>,
    );

    if (!validateConfig(merged)) {
      console.error('[oh-my-ccg] Invalid config, using defaults');
      return { ...DEFAULT_CONFIG };
    }

    return merged as unknown as OhMyCcgConfig;
  } catch {
    console.error('[oh-my-ccg] Failed to load config, using defaults');
    return { ...DEFAULT_CONFIG };
  }
}
