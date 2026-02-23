#!/usr/bin/env node
/**
 * PreToolUse hook — suggest parallel execution for independent tasks.
 */
import { readFileSync, existsSync } from 'fs';
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

      // Check for opportunities to suggest parallel execution
      if (toolName === 'Bash') {
        const toolInput = data.tool_input || '';
        if (toolInput.includes('npm install') || toolInput.includes('npm run build') || toolInput.includes('npm test')) {
          output({
            continue: true,
            message: 'Use parallel execution for independent tasks. Use run_in_background for long operations (npm install, builds, tests).',
          });
          return;
        }
      }

      // Track tool usage in hud-state
      try {
        const hudStatePath = join(cwd, '.oh-my-ccg', 'state', 'hud-state.json');
        if (existsSync(hudStatePath)) {
          const hudState = JSON.parse(readFileSync(hudStatePath, 'utf-8'));
          hudState.toolCalls = (hudState.toolCalls || 0) + 1;
          // Don't write here to avoid race conditions; post-tool-verifier handles it
        }
      } catch { /* ignore */ }

      output({ continue: true });
    } catch {
      output({ continue: true });
    }
  });
}

function output(result) {
  process.stdout.write(JSON.stringify(result));
}
main();
