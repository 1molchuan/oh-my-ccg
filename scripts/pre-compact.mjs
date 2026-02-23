#!/usr/bin/env node

/**
 * PreCompact hook — save critical state before context compaction.
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
      const cwd = data.cwd || process.cwd();
      const stateDir = join(cwd, '.oh-my-ccg', 'state');
      const rpiPath = join(stateDir, 'rpi-state.json');
      const backupPath = join(stateDir, 'compact-backup.json');

      if (!existsSync(rpiPath)) {
        output({ continue: true });
        return;
      }

      // Read current RPI state
      const rpi = JSON.parse(readFileSync(rpiPath, 'utf-8'));

      // Create compact backup with essential fields
      const backup = {
        timestamp: new Date().toISOString(),
        rpiPhase: rpi.phase,
        changeName: rpi.changeName,
        constraintsSummary: {
          total: (rpi.constraints || []).length,
          hard: (rpi.constraints || []).filter(c => c.type === 'hard').length,
          soft: (rpi.constraints || []).filter(c => c.type === 'soft').length,
        },
        decisionsCount: Object.keys(rpi.decisions || {}).length,
        pbtCount: (rpi.pbtProperties || []).length,
        artifacts: rpi.artifacts || {},
      };

      // Also collect active modes
      const modes = {};
      for (const mode of ['ralph', 'team', 'autopilot']) {
        const modePath = join(stateDir, `${mode}-state.json`);
        if (existsSync(modePath)) {
          try {
            const modeState = JSON.parse(readFileSync(modePath, 'utf-8'));
            if (modeState.active) {
              modes[mode] = {
                active: true,
                iteration: modeState.iteration,
                phase: modeState.phase || modeState.rpiPhase,
              };
            }
          } catch { /* skip */ }
        }
      }
      backup.activeModes = modes;

      // Write backup
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');

      output({
        continue: true,
        message: `[oh-my-ccg] State backed up before compaction (phase: ${rpi.phase}, change: ${rpi.changeName || 'none'})`,
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
