#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVER_INFO = { name: 'oh-my-ccg-codex', version: '2.1.0' };

// --- Configuration ---

const DEFAULT_MODEL = process.env.OH_MY_CCG_CODEX_MODEL || 'gpt-5.3-codex';
const DEFAULT_TIMEOUT = parseInt(process.env.OH_MY_CCG_CODEX_TIMEOUT || '300000', 10);
const MAX_RETRIES = parseInt(process.env.OH_MY_CCG_CODEX_RETRY_COUNT || '3', 10);
const RETRY_INITIAL_DELAY = parseInt(process.env.OH_MY_CCG_CODEX_RETRY_DELAY || '5000', 10);
const RETRY_MAX_DELAY = parseInt(process.env.OH_MY_CCG_CODEX_RETRY_MAX_DELAY || '60000', 10);
const MAX_STDOUT_BYTES = 10 * 1024 * 1024;

// --- Job State Management ---

const jobs = new Map();        // jobId → JobStatus
const spawnedPids = new Set(); // track PIDs we spawned (safety)

/**
 * @typedef {Object} JobStatus
 * @property {'spawned'|'running'|'completed'|'failed'|'timeout'} status
 * @property {number} [pid]
 * @property {string} model
 * @property {string} agentRole
 * @property {string} spawnedAt
 * @property {string} [completedAt]
 * @property {string} [result]
 * @property {string} [error]
 * @property {boolean} [killedByUser]
 */

function generateJobId() {
  return crypto.randomBytes(4).toString('hex');
}

// --- Tool Definitions ---

const TOOLS = [
  {
    name: 'ask_codex',
    description: 'Send a prompt to Codex (gpt-5.3-codex) for analysis. Recommended roles: architect, planner, critic, analyst, code-reviewer, security-reviewer, test-engineer. Set background=true for parallel execution.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_role: { type: 'string', description: 'Agent perspective (loads matching role prompt from templates/prompts/codex/)' },
        prompt: { type: 'string', description: 'Inline prompt text' },
        context_files: { type: 'array', items: { type: 'string' }, description: 'File paths to include as context' },
        background: { type: 'boolean', description: 'Run in background — returns job_id immediately. Use wait_for_job or check_job_status to get results.' },
        working_directory: { type: 'string', description: 'Working directory for CLI execution' },
        model: { type: 'string', description: `Model override (default: ${DEFAULT_MODEL})` },
        reasoning_effort: { type: 'string', enum: ['minimal', 'low', 'medium', 'high', 'xhigh'], description: 'Reasoning effort level' },
      },
      required: ['agent_role'],
    },
  },
  {
    name: 'wait_for_job',
    description: 'Block (poll) until a background job reaches terminal state (completed, failed, timeout). Uses exponential backoff. Returns the response on success. WARNING: blocks the MCP server for the duration.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job ID returned by ask_codex with background=true' },
        timeout_ms: { type: 'number', description: 'Max wait time in ms (default: 300000, max: 3600000)' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'check_job_status',
    description: 'Non-blocking status check for a background job. Returns current status, metadata, and result if completed.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job ID to check' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'kill_job',
    description: 'Send a signal to a running background job. Only works on jobs in spawned/running state.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'The job ID to kill' },
        signal: { type: 'string', enum: ['SIGTERM', 'SIGINT'], description: 'Signal to send (default: SIGTERM)' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'list_jobs',
    description: 'List background jobs. Filter by status. Results sorted newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        status_filter: { type: 'string', enum: ['active', 'completed', 'failed', 'all'], description: 'Filter by status (default: active)' },
        limit: { type: 'number', description: 'Max results (default: 50)' },
      },
    },
  },
];

// --- Role Prompt Loading ---

function loadRolePrompt(role) {
  if (!role) return '';
  const promptPath = path.join(__dirname, '..', 'templates', 'prompts', 'codex', `${role}.md`);
  try {
    return fs.readFileSync(promptPath, 'utf-8') + '\n\n';
  } catch {
    return '';
  }
}

// --- Context File Injection ---

function buildContextContent(files) {
  if (!files || files.length === 0) return '';
  let content = '';
  for (const f of files) {
    try {
      const stat = fs.statSync(f);
      if (stat.size > 5 * 1024 * 1024) continue; // skip files > 5MB
      const fileContent = fs.readFileSync(f, 'utf-8');
      content += `\n--- ${f} ---\n${fileContent}\n`;
    } catch { /* skip missing/unreadable files */ }
  }
  return content ? `\n\nContext:\n${content}` : '';
}

// --- Codex JSONL Output Parsing ---

function parseCodexOutput(rawOutput) {
  const lines = rawOutput.trim().split('\n');
  let lastMessage = '';

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      if (parsed.type === 'agent_message' ||
          (parsed.item && parsed.item.type === 'message' && parsed.item.role === 'assistant')) {
        const content = parsed.item?.content || parsed.content;
        if (Array.isArray(content)) {
          const textParts = content.filter(c => c.type === 'output_text' || c.type === 'text');
          if (textParts.length > 0) lastMessage = textParts.map(t => t.text).join('\n');
        } else if (typeof content === 'string') {
          lastMessage = content;
        }
      }

      if (parsed.type === 'response.completed' && parsed.response) {
        const output = parsed.response.output;
        if (Array.isArray(output)) {
          for (const msg of output.filter(o => o.type === 'message' && o.role === 'assistant')) {
            if (Array.isArray(msg.content)) {
              const texts = msg.content.filter(c => c.type === 'output_text' || c.type === 'text');
              if (texts.length > 0) lastMessage = texts.map(t => t.text).join('\n');
            }
          }
        }
      }
    } catch { /* skip non-JSON lines */ }
  }

  return lastMessage || rawOutput;
}

// --- Retry Logic ---

function retryDelay(attempt) {
  const base = Math.min(RETRY_INITIAL_DELAY * Math.pow(2, attempt), RETRY_MAX_DELAY);
  return base * (0.5 + Math.random() * 0.5);
}

function isRateLimitError(text) {
  return /429|rate.?limit|too many requests|quota.?exceeded|resource.?exhausted|overloaded|capacity/i.test(text);
}

function isModelError(text) {
  return /model_not_found|model is not supported/i.test(text);
}

// --- Core Execution ---

function executeCodex(args, attempt = 0) {
  return new Promise((resolve) => {
    const workDir = args.working_directory || process.cwd();
    const model = args.model || DEFAULT_MODEL;

    const rolePrompt = loadRolePrompt(args.agent_role);
    const contextContent = buildContextContent(args.context_files);
    const fullPrompt = rolePrompt + (args.prompt || '') + contextContent;

    const cliArgs = ['exec', '-m', model, '--json', '--full-auto', '--skip-git-repo-check'];
    if (args.reasoning_effort) {
      cliArgs.push('-c', `model_reasoning_effort="${args.reasoning_effort}"`);
    }

    const child = spawn('codex', cliArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workDir,
      ...(process.platform === 'win32' ? { shell: true } : {}),
    });

    if (child.pid) spawnedPids.add(child.pid);

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    const timer = setTimeout(() => { child.kill('SIGTERM'); }, DEFAULT_TIMEOUT);

    child.stdin.write(fullPrompt);
    child.stdin.end();

    child.stdout.on('data', (d) => {
      stdoutBytes += d.length;
      if (stdoutBytes <= MAX_STDOUT_BYTES) stdout += d.toString();
    });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (child.pid) spawnedPids.delete(child.pid);

      const combinedOutput = stderr + stdout;

      // Retry on rate limit
      if (code !== 0 && isRateLimitError(combinedOutput) && attempt < MAX_RETRIES) {
        setTimeout(() => executeCodex(args, attempt + 1).then(resolve), retryDelay(attempt));
        return;
      }

      // Model error — no retry (would need fallback chain)
      if (code !== 0 && isModelError(combinedOutput)) {
        resolve({ ok: false, error: `Model error: ${combinedOutput.slice(0, 500)}` });
        return;
      }

      if (code !== 0) {
        resolve({ ok: false, error: `Codex error (exit ${code}): ${(stderr || stdout).slice(0, 1000)}` });
        return;
      }

      resolve({ ok: true, result: parseCodexOutput(stdout) });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (child.pid) spawnedPids.delete(child.pid);

      if (isRateLimitError(err.message) && attempt < MAX_RETRIES) {
        setTimeout(() => executeCodex(args, attempt + 1).then(resolve), retryDelay(attempt));
        return;
      }
      resolve({ ok: false, error: `Codex error: ${err.message}` });
    });
  });
}

// --- Background Execution ---

function executeCodexBackground(args) {
  const jobId = generateJobId();
  const model = args.model || DEFAULT_MODEL;

  jobs.set(jobId, {
    status: 'spawned',
    model,
    agentRole: args.agent_role || '',
    spawnedAt: new Date().toISOString(),
  });

  // Run asynchronously
  setImmediate(async () => {
    const job = jobs.get(jobId);
    if (!job) return;
    job.status = 'running';

    try {
      const outcome = await executeCodex(args);
      // Check if killed by user while running
      const current = jobs.get(jobId);
      if (current && current.killedByUser) return;

      if (outcome.ok) {
        jobs.set(jobId, { ...job, status: 'completed', result: outcome.result, completedAt: new Date().toISOString() });
      } else {
        jobs.set(jobId, { ...job, status: 'failed', error: outcome.error, completedAt: new Date().toISOString() });
      }
    } catch (err) {
      const current = jobs.get(jobId);
      if (current && current.killedByUser) return;
      jobs.set(jobId, { ...job, status: 'failed', error: String(err), completedAt: new Date().toISOString() });
    }
  });

  return jobId;
}

// --- wait_for_job: poll with exponential backoff ---

function waitForJob(jobId, timeoutMs) {
  const timeout = Math.min(timeoutMs || 300000, 3600000);
  const startTime = Date.now();

  return new Promise((resolve) => {
    let delay = 500;     // start at 500ms
    const factor = 1.5;
    const maxDelay = 2000;

    function poll() {
      const job = jobs.get(jobId);
      if (!job) {
        resolve({ error: `Job not found: ${jobId}` });
        return;
      }

      // Terminal states
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'timeout') {
        const response = {
          job_id: jobId,
          status: job.status,
          model: job.model,
          agent_role: job.agentRole,
        };
        if (job.status === 'completed') {
          response.result = job.result;
        } else {
          response.error = job.error;
        }
        resolve(response);
        return;
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        job.status = 'timeout';
        job.error = `wait_for_job timed out after ${timeout}ms`;
        job.completedAt = new Date().toISOString();
        resolve({ job_id: jobId, status: 'timeout', error: job.error });
        return;
      }

      // Schedule next poll with backoff
      delay = Math.min(delay * factor, maxDelay);
      setTimeout(poll, delay);
    }

    poll();
  });
}

// --- kill_job: safe signal delivery ---

function killJob(jobId, signal) {
  const job = jobs.get(jobId);
  if (!job) return { error: `Job not found: ${jobId}` };

  if (job.status !== 'spawned' && job.status !== 'running') {
    return { error: `Job ${jobId} is in terminal state: ${job.status}. Cannot kill.` };
  }

  // Mark killed before sending signal (race condition safety)
  job.killedByUser = true;
  job.status = 'failed';
  job.error = `Killed by user (signal: ${signal || 'SIGTERM'})`;
  job.completedAt = new Date().toISOString();

  // Send signal to process if PID tracked
  if (job.pid && spawnedPids.has(job.pid)) {
    try {
      const sig = signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM';
      process.kill(job.pid, sig);
    } catch { /* process may have already exited */ }
  }

  return { job_id: jobId, status: 'failed', message: `Job killed with ${signal || 'SIGTERM'}` };
}

// --- Tool Handler ---

async function handleToolCall(name, args) {
  switch (name) {
    case 'ask_codex': {
      if (args.background) {
        const jobId = executeCodexBackground(args);
        return { job_id: jobId, status: 'spawned', message: 'Use wait_for_job or check_job_status to get results.' };
      }
      // Foreground: block until complete
      const outcome = await executeCodex(args);
      if (outcome.ok) return { content: outcome.result };
      return { error: outcome.error };
    }

    case 'wait_for_job': {
      return await waitForJob(args.job_id, args.timeout_ms);
    }

    case 'check_job_status': {
      const job = jobs.get(args.job_id);
      if (!job) return { error: `Job not found: ${args.job_id}` };
      const response = {
        job_id: args.job_id,
        status: job.status,
        model: job.model,
        agent_role: job.agentRole,
        spawned_at: job.spawnedAt,
      };
      if (job.completedAt) response.completed_at = job.completedAt;
      if (job.status === 'completed') response.result_preview = (job.result || '').slice(0, 500);
      if (job.error) response.error = job.error;
      if (job.killedByUser) response.killed_by_user = true;
      return response;
    }

    case 'kill_job': {
      return killJob(args.job_id, args.signal);
    }

    case 'list_jobs': {
      const filter = args.status_filter || 'active';
      const limit = Math.min(args.limit || 50, 200);
      const result = [];

      for (const [id, job] of jobs) {
        const isActive = job.status === 'spawned' || job.status === 'running';
        if (filter === 'all' ||
            (filter === 'active' && isActive) ||
            (filter === 'completed' && job.status === 'completed') ||
            (filter === 'failed' && (job.status === 'failed' || job.status === 'timeout'))) {
          result.push({
            job_id: id,
            status: job.status,
            model: job.model,
            agent_role: job.agentRole,
            spawned_at: job.spawnedAt,
            completed_at: job.completedAt,
          });
        }
        if (result.length >= limit) break;
      }

      // Sort newest first
      result.sort((a, b) => (b.spawned_at || '').localeCompare(a.spawned_at || ''));
      return { jobs: result, total: result.length };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// --- MCP JSON-RPC Transport ---

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
        handleToolCall(params.name, params.arguments || {}).then((result) => {
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
        });
        break;
      }
      default:
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch { /* ignore malformed input */ }
});
