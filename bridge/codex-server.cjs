#!/usr/bin/env node
'use strict';

const { execSync, spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVER_INFO = { name: 'oh-my-ccg-codex', version: '1.0.0' };
const jobs = new Map();

const TOOLS = [
  {
    name: 'ask_codex',
    description: 'Send a prompt to Codex (gpt-5.3-codex) for analysis. Recommended roles: architect, planner, critic, analyst, code-reviewer, security-reviewer, test-engineer.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_role: { type: 'string', description: 'Agent perspective for Codex' },
        prompt: { type: 'string', description: 'Inline prompt text' },
        context_files: { type: 'array', items: { type: 'string' }, description: 'File paths to include as context' },
        background: { type: 'boolean', description: 'Run in background' },
        working_directory: { type: 'string' },
      },
      required: ['agent_role'],
    },
  },
  {
    name: 'check_job_status',
    description: 'Check status of a background job',
    inputSchema: { type: 'object', properties: { job_id: { type: 'string' } }, required: ['job_id'] },
  },
  {
    name: 'list_jobs',
    description: 'List background jobs',
    inputSchema: { type: 'object', properties: { status_filter: { type: 'string' } } },
  },
];

function buildCodexCommand(args) {
  const parts = ['codeagent-wrapper', '--backend', 'codex'];
  if (args.agent_role) parts.push('--role', args.agent_role);
  if (args.working_directory) parts.push(args.working_directory);
  else parts.push(process.cwd());
  return parts;
}

function runCodex(args) {
  const workDir = args.working_directory || process.cwd();
  let contextContent = '';

  if (args.context_files && args.context_files.length > 0) {
    for (const f of args.context_files) {
      try {
        const content = fs.readFileSync(f, 'utf-8');
        contextContent += `\n--- ${f} ---\n${content}\n`;
      } catch { /* skip missing files */ }
    }
  }

  const prompt = (args.prompt || '') + (contextContent ? `\n\nContext:\n${contextContent}` : '');

  try {
    const cmdParts = buildCodexCommand(args);
    const cmd = cmdParts.join(' ');
    const result = execSync(cmd, {
      input: prompt,
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.toString('utf-8');
  } catch (err) {
    return `Codex error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function handleToolCall(name, args) {
  switch (name) {
    case 'ask_codex': {
      if (args.background) {
        const jobId = crypto.randomUUID().slice(0, 8);
        jobs.set(jobId, { status: 'running', startedAt: new Date().toISOString() });

        // Run async
        setImmediate(() => {
          try {
            const result = runCodex(args);
            jobs.set(jobId, { status: 'completed', result, completedAt: new Date().toISOString() });
          } catch (err) {
            jobs.set(jobId, { status: 'failed', error: String(err), completedAt: new Date().toISOString() });
          }
        });

        return { job_id: jobId, status: 'running' };
      }
      return { content: runCodex(args) };
    }

    case 'check_job_status': {
      const job = jobs.get(args.job_id);
      if (!job) return { error: 'Job not found' };
      return job;
    }

    case 'list_jobs': {
      const filter = args.status_filter || 'all';
      const result = [];
      for (const [id, job] of jobs) {
        if (filter === 'all' || job.status === filter) {
          result.push({ id, ...job });
        }
      }
      return { jobs: result };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

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
  } catch { /* ignore */ }
});
