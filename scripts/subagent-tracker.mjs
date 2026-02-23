#!/usr/bin/env node
/**
 * SubagentStart/SubagentStop hook — track agent lifecycle.
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
      const hookEvent = data.hook_event_name || '';
      const cwd = data.cwd || process.cwd();
      const agentName = data.agent_name || 'unknown';
      const model = data.model || 'sonnet';

      const stateDir = join(cwd, '.oh-my-ccg', 'state');
      const hudStatePath = join(stateDir, 'hud-state.json');
      mkdirSync(stateDir, { recursive: true });

      let hudState = {};
      if (existsSync(hudStatePath)) {
        hudState = JSON.parse(readFileSync(hudStatePath, 'utf-8'));
      }

      if (!hudState.agents) hudState.agents = [];

      if (hookEvent === 'SubagentStart') {
        // Determine model tier
        const tier = model.includes('opus') ? 'O' : model.includes('haiku') ? 'H' : 'S';
        hudState.agents.push({
          name: agentName,
          modelTier: tier,
          startTime: new Date().toISOString(),
          status: 'running',
        });
        hudState.agentCalls = (hudState.agentCalls || 0) + 1;
      }

      if (hookEvent === 'SubagentStop') {
        const idx = hudState.agents.findIndex(a => a.name === agentName);
        if (idx >= 0) {
          const agent = hudState.agents[idx];
          const startTime = new Date(agent.startTime).getTime();
          const duration = Math.round((Date.now() - startTime) / 1000);
          agent.status = 'completed';
          agent.duration = `${duration}s`;
          // Remove from active list after recording
          hudState.agents.splice(idx, 1);
        }
      }

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
