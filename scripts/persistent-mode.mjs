#!/usr/bin/env node

/**
 * Stop hook — prevent stopping if ralph or autopilot is active.
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
      const cwd = data.cwd || process.cwd();
      const stateDir = join(cwd, '.oh-my-ccg', 'state');

      // Check ralph
      const ralphPath = join(stateDir, 'ralph-state.json');
      if (existsSync(ralphPath)) {
        try {
          const ralph = JSON.parse(readFileSync(ralphPath, 'utf-8'));
          if (ralph.active) {
            const iter = ralph.iteration || 0;
            const max = ralph.maxIterations || 10;
            output({
              continue: false,
              suppress: true,
              message: `[oh-my-ccg] Ralph mode active (${iter}/${max}). The boulder never stops. Use /oh-my-ccg:cancel to stop.`,
            });
            return;
          }
        } catch { /* ignore */ }
      }

      // Check autopilot
      const autopilotPath = join(stateDir, 'autopilot-state.json');
      if (existsSync(autopilotPath)) {
        try {
          const autopilot = JSON.parse(readFileSync(autopilotPath, 'utf-8'));
          if (autopilot.active) {
            output({
              continue: false,
              suppress: true,
              message: `[oh-my-ccg] Autopilot active (phase: ${autopilot.rpiPhase || 'unknown'}). Use /oh-my-ccg:cancel to stop.`,
            });
            return;
          }
        } catch { /* ignore */ }
      }

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
