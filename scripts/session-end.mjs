#!/usr/bin/env node
/**
 * SessionEnd hook — clean up and save session summary.
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
      const cwd = data.cwd || data.directory || process.cwd();
      const sessionId = data.session_id || data.sessionId || 'unknown';
      const stateDir = join(cwd, '.oh-my-ccg', 'state');
      const hudStatePath = join(stateDir, 'hud-state.json');
      const historyPath = join(stateDir, 'session-history.json');

      // Read current HUD state
      let hudState = {};
      if (existsSync(hudStatePath)) {
        hudState = JSON.parse(readFileSync(hudStatePath, 'utf-8'));
      }

      // Save session summary to history
      const summary = {
        sessionId,
        endedAt: new Date().toISOString(),
        toolCalls: hudState.toolCalls || 0,
        agentCalls: hudState.agentCalls || 0,
        skillCalls: hudState.skillCalls || 0,
      };

      let history = [];
      if (existsSync(historyPath)) {
        try {
          history = JSON.parse(readFileSync(historyPath, 'utf-8'));
        } catch { history = []; }
      }
      history.push(summary);
      // Keep last 50 sessions
      if (history.length > 50) history = history.slice(-50);

      mkdirSync(stateDir, { recursive: true });
      writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');

      // Clean up HUD state (reset active agents)
      hudState.agents = [];
      hudState.claudeActive = false;
      hudState.codexActive = false;
      hudState.geminiActive = false;
      writeFileSync(hudStatePath, JSON.stringify(hudState, null, 2), 'utf-8');

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
