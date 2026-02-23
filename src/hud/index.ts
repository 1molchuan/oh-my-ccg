#!/usr/bin/env node

import { createInterface } from 'node:readline';
import { collectHudState } from './state.js';
import { parseTranscript } from './parser.js';
import { render } from './renderer.js';
import { resolveHudConfig } from './config.js';
import { loadConfig } from '../config/loader.js';

/**
 * HUD entry point for Claude Code statusline.
 *
 * Reads JSON from stdin: { transcript_path, model, context_window }
 * Outputs rendered HUD to stdout.
 */

interface StatusLineInput {
  transcript_path?: string;
  model?: string;
  context_window?: number;
}

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin });

  for await (const line of rl) {
    try {
      const input = JSON.parse(line) as StatusLineInput;
      const workDir = process.cwd();

      // Load config
      const config = loadConfig(workDir);
      const hudConfig = resolveHudConfig(config.hud);

      // Parse transcript for metrics
      const transcript = input.transcript_path
        ? parseTranscript(input.transcript_path)
        : null;

      // Collect state from files
      const state = collectHudState(workDir, {
        context_window: input.context_window ?? 0,
      });

      // Merge transcript data into state
      if (transcript) {
        state.toolCalls = transcript.toolCalls;
        state.agentCalls = transcript.agentCalls;
        state.skillCalls = transcript.skillCalls;
        if (transcript.agents.length > 0) {
          state.agents = transcript.agents;
        }
      }

      // Render and output
      const output = render(state, hudConfig);
      process.stdout.write(output + '\n');
    } catch {
      // On any error, output a safe minimal line
      process.stdout.write('[CCG] | ◆IDLE\n');
    }
  }
}

main().catch(() => process.exit(1));
