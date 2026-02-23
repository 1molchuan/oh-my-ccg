#!/usr/bin/env node

/**
 * UserPromptSubmit hook — detect magic keywords and inject skill references.
 * Reads JSON from stdin, outputs JSON to stdout.
 */

import { readFileSync } from 'fs';

const KEYWORD_MAP = {
  'research': '[MAGIC KEYWORD: /oh-my-ccg:research]',
  'plan': '[MAGIC KEYWORD: /oh-my-ccg:plan]',
  'impl': '[MAGIC KEYWORD: /oh-my-ccg:impl]',
  'review': '[MAGIC KEYWORD: /oh-my-ccg:review]',
  'autopilot': '[MAGIC KEYWORD: /oh-my-ccg:autopilot]',
  'auto': '[MAGIC KEYWORD: /oh-my-ccg:autopilot]',
  'ralph': '[MAGIC KEYWORD: /oh-my-ccg:ralph]',
  "don't stop": '[MAGIC KEYWORD: /oh-my-ccg:ralph]',
  'cancel': '[MAGIC KEYWORD: /oh-my-ccg:cancel]',
  'help': '[MAGIC KEYWORD: /oh-my-ccg:help]',
};

function main() {
  let input = '';

  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const prompt = (data.prompt || '').toLowerCase().trim();

      // Check for exact command patterns first (e.g., "/oh-my-ccg:research")
      if (prompt.startsWith('/oh-my-ccg:')) {
        output({ continue: true });
        return;
      }

      // Check for keyword matches
      for (const [keyword, magic] of Object.entries(KEYWORD_MAP)) {
        // Match whole word at start of prompt or as standalone keyword
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(prompt)) {
          output({
            continue: true,
            message: `${magic} Detected keyword "${keyword}" — activating skill.`,
          });
          return;
        }
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
