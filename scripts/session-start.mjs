#!/usr/bin/env node

/**
 * SessionStart hook — restore RPI state and inject context.
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
      const rpiPath = join(stateDir, 'rpi-state.json');

      if (!existsSync(rpiPath)) {
        output({ continue: true });
        return;
      }

      const rpi = JSON.parse(readFileSync(rpiPath, 'utf-8'));
      const phase = rpi.phase || 'unknown';
      const changeName = rpi.changeName || '(none)';
      const constraintCount = (rpi.constraints || []).length;
      const hardCount = (rpi.constraints || []).filter(c => c.type === 'hard').length;
      const softCount = constraintCount - hardCount;
      const pbtCount = (rpi.pbtProperties || []).length;
      const decisionCount = Object.keys(rpi.decisions || {}).length;

      const lines = [
        `# oh-my-ccg RPI State Restored`,
        ``,
        `- **Phase**: ${phase.toUpperCase()}`,
        `- **Change**: ${changeName}`,
        `- **Constraints**: ${hardCount}H / ${softCount}S`,
        `- **Decisions**: ${decisionCount}`,
        `- **PBT Properties**: ${pbtCount}`,
      ];

      if (rpi.artifacts) {
        if (rpi.artifacts.proposal) lines.push(`- **Proposal**: ${rpi.artifacts.proposal}`);
        if (rpi.artifacts.tasks) lines.push(`- **Tasks**: ${rpi.artifacts.tasks}`);
        if (rpi.artifacts.specs?.length) lines.push(`- **Specs**: ${rpi.artifacts.specs.length} files`);
      }

      // Check for active modes
      const modes = ['ralph', 'team', 'autopilot'];
      const activeModes = [];
      for (const mode of modes) {
        const modePath = join(stateDir, `${mode}-state.json`);
        if (existsSync(modePath)) {
          try {
            const modeState = JSON.parse(readFileSync(modePath, 'utf-8'));
            if (modeState.active) activeModes.push(mode);
          } catch { /* skip */ }
        }
      }

      if (activeModes.length > 0) {
        lines.push(`- **Active Modes**: ${activeModes.join(', ')}`);
      }

      // Suggest next action based on phase
      lines.push('');
      switch (phase) {
        case 'init':
          lines.push('Next: `/oh-my-ccg:research "requirement"` to start research phase.');
          break;
        case 'research':
          lines.push('Next: `/oh-my-ccg:plan` to create execution plan.');
          break;
        case 'plan':
          lines.push('Next: `/oh-my-ccg:impl` to start implementation.');
          break;
        case 'impl':
          lines.push('Next: `/oh-my-ccg:review` to run cross-validation review.');
          break;
        case 'review':
          lines.push('Review complete. Start a new cycle with `/oh-my-ccg:research "new requirement"`.');
          break;
      }

      output({
        continue: true,
        message: lines.join('\n'),
      });
    } catch {
      output({ continue: true });
    }
  });
}

function output(result) {
  process.stdout.write(JSON.stringify(result));
}

main();
