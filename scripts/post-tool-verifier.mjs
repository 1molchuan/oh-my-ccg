#!/usr/bin/env node
/**
 * PostToolUse hook — verify results and track metrics.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

function main() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const toolName = data.tool_name || '';
      const cwd = data.cwd || process.cwd();
      let message = '';

      // Suggest verification after file modifications
      if (toolName === 'Write' || toolName === 'Edit') {
        message = 'File written. Test the changes to ensure they work correctly.';
      }

      // Remind about background operations
      if (toolName === 'Bash') {
        const response = data.tool_response || '';
        if (response.includes('run_in_background') || response.includes('Background')) {
          message = 'Background operation detected. Remember to verify results before proceeding.';
        }
      }

      // Track metrics in hud-state.json
      try {
        const stateDir = join(cwd, '.oh-my-ccg', 'state');
        const hudStatePath = join(stateDir, 'hud-state.json');
        mkdirSync(stateDir, { recursive: true });

        let hudState = {};
        if (existsSync(hudStatePath)) {
          hudState = JSON.parse(readFileSync(hudStatePath, 'utf-8'));
        }

        hudState.toolCalls = (hudState.toolCalls || 0) + 1;
        if (toolName === 'Task') hudState.agentCalls = (hudState.agentCalls || 0) + 1;
        if (toolName === 'Skill') hudState.skillCalls = (hudState.skillCalls || 0) + 1;
        hudState.lastToolUse = { tool: toolName, timestamp: new Date().toISOString() };

        writeFileSync(hudStatePath, JSON.stringify(hudState, null, 2), 'utf-8');
      } catch { /* ignore metric tracking failures */ }

      output({ continue: true, ...(message ? { message } : {}) });
    } catch {
      output({ continue: true });
    }
  });
}

function output(result) {
  process.stdout.write(JSON.stringify(result));
}
main();
