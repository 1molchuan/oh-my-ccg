#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Simple JSON-RPC over stdio MCP server
const SERVER_INFO = {
  name: 'oh-my-ccg-tools',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'rpi_state_read',
    description: 'Read current RPI state (phase, constraints, decisions, artifacts)',
    inputSchema: { type: 'object', properties: { workDir: { type: 'string' } }, required: ['workDir'] },
  },
  {
    name: 'rpi_state_write',
    description: 'Update RPI state fields',
    inputSchema: {
      type: 'object',
      properties: {
        workDir: { type: 'string' },
        updates: { type: 'object' },
      },
      required: ['workDir', 'updates'],
    },
  },
  {
    name: 'notepad_read',
    description: 'Read notepad content',
    inputSchema: { type: 'object', properties: { workDir: { type: 'string' } }, required: ['workDir'] },
  },
  {
    name: 'notepad_write',
    description: 'Append to notepad',
    inputSchema: {
      type: 'object',
      properties: { workDir: { type: 'string' }, content: { type: 'string' } },
      required: ['workDir', 'content'],
    },
  },
  {
    name: 'project_memory_read',
    description: 'Read project memory',
    inputSchema: { type: 'object', properties: { workDir: { type: 'string' } }, required: ['workDir'] },
  },
  {
    name: 'project_memory_write',
    description: 'Write to project memory',
    inputSchema: {
      type: 'object',
      properties: { workDir: { type: 'string' }, memory: { type: 'object' } },
      required: ['workDir', 'memory'],
    },
  },
  {
    name: 'mode_state_read',
    description: 'Read orchestration mode state (ralph, team, autopilot)',
    inputSchema: {
      type: 'object',
      properties: { workDir: { type: 'string' }, mode: { type: 'string', enum: ['ralph', 'team', 'autopilot'] } },
      required: ['workDir', 'mode'],
    },
  },
  {
    name: 'mode_state_write',
    description: 'Update orchestration mode state',
    inputSchema: {
      type: 'object',
      properties: { workDir: { type: 'string' }, mode: { type: 'string' }, updates: { type: 'object' } },
      required: ['workDir', 'mode', 'updates'],
    },
  },
  {
    name: 'notepad_read_section',
    description: 'Read a specific notepad section (priority, working, manual)',
    inputSchema: {
      type: 'object',
      properties: { workDir: { type: 'string' }, section: { type: 'string', enum: ['all', 'priority', 'working', 'manual'] } },
      required: ['workDir'],
    },
  },
  {
    name: 'notepad_write_priority',
    description: 'Set priority context (max 500 chars, always loaded)',
    inputSchema: {
      type: 'object',
      properties: { workDir: { type: 'string' }, content: { type: 'string' } },
      required: ['workDir', 'content'],
    },
  },
  {
    name: 'hud_state_read',
    description: 'Read HUD metrics state (tool calls, agent activity, session analytics)',
    inputSchema: {
      type: 'object',
      properties: { workDir: { type: 'string' } },
      required: ['workDir'],
    },
  },
];

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { return null; }
}

function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function handleToolCall(name, args) {
  const workDir = args.workDir || process.cwd();
  const stateDir = path.join(workDir, '.oh-my-ccg', 'state');

  switch (name) {
    case 'rpi_state_read':
      return readJsonFile(path.join(stateDir, 'rpi-state.json')) || { error: 'No RPI state found' };

    case 'rpi_state_write': {
      const statePath = path.join(stateDir, 'rpi-state.json');
      const current = readJsonFile(statePath) || {};
      const updated = { ...current, ...args.updates, updatedAt: new Date().toISOString() };
      writeJsonFile(statePath, updated);
      return { success: true, state: updated };
    }

    case 'notepad_read': {
      const notepadPath = path.join(workDir, '.oh-my-ccg', 'notepad.md');
      if (!fs.existsSync(notepadPath)) return { content: '' };
      return { content: fs.readFileSync(notepadPath, 'utf-8') };
    }

    case 'notepad_write': {
      const notepadPath = path.join(workDir, '.oh-my-ccg', 'notepad.md');
      const dir = path.dirname(notepadPath);
      fs.mkdirSync(dir, { recursive: true });
      const timestamp = new Date().toISOString();
      const entry = `\n## ${timestamp}\n${args.content}\n`;
      fs.appendFileSync(notepadPath, entry, 'utf-8');
      return { success: true };
    }

    case 'project_memory_read': {
      return readJsonFile(path.join(workDir, '.oh-my-ccg', 'project-memory.json')) || {};
    }

    case 'project_memory_write': {
      const memPath = path.join(workDir, '.oh-my-ccg', 'project-memory.json');
      const current = readJsonFile(memPath) || {};
      const merged = { ...current, ...args.memory };
      writeJsonFile(memPath, merged);
      return { success: true, memory: merged };
    }

    case 'mode_state_read': {
      const mode = args.mode;
      if (!mode) return { error: 'mode is required' };
      return readJsonFile(path.join(stateDir, `${mode}-state.json`)) || { error: `No ${mode} state found` };
    }

    case 'mode_state_write': {
      const mode = args.mode;
      if (!mode) return { error: 'mode is required' };
      const modeStatePath = path.join(stateDir, `${mode}-state.json`);
      const current = readJsonFile(modeStatePath) || {};
      const updated = { ...current, ...args.updates, updatedAt: new Date().toISOString() };
      writeJsonFile(modeStatePath, updated);
      return { success: true, state: updated };
    }

    case 'notepad_read_section': {
      const notepadPath = path.join(workDir, '.oh-my-ccg', 'notepad.md');
      if (!fs.existsSync(notepadPath)) return { content: '' };
      const raw = fs.readFileSync(notepadPath, 'utf-8');
      const section = args.section || 'all';
      if (section === 'all') return { content: raw };

      // Parse sections by header markers
      const sectionMarkers = { priority: '# Priority Context', working: '# Working Memory', manual: '# Manual Notes' };
      const marker = sectionMarkers[section];
      if (!marker) return { error: `Unknown section: ${section}` };

      const startIdx = raw.indexOf(marker);
      if (startIdx === -1) return { content: '' };

      // Find next section marker or end of file
      const otherMarkers = Object.values(sectionMarkers).filter(m => m !== marker);
      let endIdx = raw.length;
      for (const other of otherMarkers) {
        const idx = raw.indexOf(other, startIdx + marker.length);
        if (idx !== -1 && idx < endIdx) endIdx = idx;
      }

      return { content: raw.substring(startIdx, endIdx).trim() };
    }

    case 'notepad_write_priority': {
      const notepadPath = path.join(workDir, '.oh-my-ccg', 'notepad.md');
      const dir = path.dirname(notepadPath);
      fs.mkdirSync(dir, { recursive: true });

      const content = (args.content || '').substring(0, 500); // max 500 chars
      let raw = '';
      if (fs.existsSync(notepadPath)) {
        raw = fs.readFileSync(notepadPath, 'utf-8');
      }

      const marker = '# Priority Context';
      const startIdx = raw.indexOf(marker);
      if (startIdx === -1) {
        // Prepend priority section
        raw = `${marker}\n${content}\n\n${raw}`;
      } else {
        // Find end of priority section (next # header or end)
        const nextHeader = raw.indexOf('\n# ', startIdx + marker.length);
        const endIdx = nextHeader === -1 ? raw.length : nextHeader;
        raw = raw.substring(0, startIdx) + `${marker}\n${content}\n` + raw.substring(endIdx);
      }

      fs.writeFileSync(notepadPath, raw, 'utf-8');
      return { success: true };
    }

    case 'hud_state_read': {
      const hudState = readJsonFile(path.join(stateDir, 'hud-state.json')) || {};
      const rpiState = readJsonFile(path.join(stateDir, 'rpi-state.json'));
      const ralphState = readJsonFile(path.join(stateDir, 'ralph-state.json'));
      const teamState = readJsonFile(path.join(stateDir, 'team-state.json'));
      const autopilotState = readJsonFile(path.join(stateDir, 'autopilot-state.json'));
      return {
        hud: hudState,
        rpiPhase: rpiState?.phase || null,
        changeName: rpiState?.changeName || null,
        ralph: ralphState ? { iteration: ralphState.iteration, max: ralphState.maxIterations, active: ralphState.active } : null,
        team: teamState ? { workers: teamState.workers?.length || 0, active: teamState.active } : null,
        autopilot: autopilotState ? { phase: autopilotState.currentPhase, active: autopilotState.active } : null,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// MCP JSON-RPC protocol handler
const rl = readline.createInterface({ input: process.stdin });

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    const { id, method, params } = msg;

    switch (method) {
      case 'initialize':
        send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: SERVER_INFO } });
        break;

      case 'initialized':
        // No response needed
        break;

      case 'tools/list':
        send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
        break;

      case 'tools/call': {
        const result = handleToolCall(params.name, params.arguments || {});
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
        break;
      }

      default:
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (err) {
    // Silently ignore parse errors
  }
});
