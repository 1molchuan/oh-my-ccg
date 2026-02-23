#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVER_INFO = { name: 'oh-my-ccg-gemini', version: '2.1.0' };

// --- Configuration ---

const DEFAULT_MODEL = process.env.OH_MY_CCG_GEMINI_MODEL || 'gemini-3-pro-preview';
const DEFAULT_TIMEOUT = parseInt(process.env.OH_MY_CCG_GEMINI_TIMEOUT || '300000', 10);
const MAX_RETRIES = parseInt(process.env.OH_MY_CCG_GEMINI_RETRY_COUNT || '3', 10);
const RETRY_INITIAL_DELAY = parseInt(process.env.OH_MY_CCG_GEMINI_RETRY_DELAY || '5000', 10);
const RETRY_MAX_DELAY = parseInt(process.env.OH_MY_CCG_GEMINI_RETRY_MAX_DELAY || '60000', 10);
const MAX_STDOUT_BYTES = 10 * 1024 * 1024;

const MODEL_FALLBACK_CHAIN = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
];

// --- Job State Management ---

const jobs = new Map();
const spawnedPids = new Set();

function generateJobId() {
  return crypto.randomBytes(4).toString('hex');
}

// --- Tool Definitions ---

const TOOLS = [
  {
    name: 'ask_gemini',
    description: 'Send a prompt to Gemini (gemini-3-pro-preview) for analysis. 1M token context window. Recommended roles: designer, writer, vision. Set background=true for parallel execution.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_role: { type: 'string', description: 'Agent perspective (loads matching role prompt from templates/prompts/gemini/)' },
        prompt: { type: 'string', description: 'Inline prompt text' },
        files: { type: 'array', items: { type: 'string' }, description: 'File paths to include as context' },
        background: { type: 'boolean', description: 'Run in background — returns job_id immediately. Use wait_for_job or check_job_status to get results.' },
        working_directory: { type: 'string', description: 'Working directory for CLI execution' },
        model: { type: 'string', description: `Model override (default: ${DEFAULT_MODEL}). Auto-fallback chain if model not found.` },
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
        job_id: { type: 'string', description: 'The job ID returned by ask_gemini with background=true' },
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
  const promptPath = path.join(__dirname, '..', 'templates', 'prompts', 'gemini', `${role}.md`);
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
      if (stat.size > 5 * 1024 * 1024) continue;
      const fileContent = fs.readFileSync(f, 'utf-8');
      content += `\n--- ${f} ---\n${fileContent}\n`;
    } catch { /* skip */ }
  }
  return content ? `\n\nContext:\n${content}` : '';
}

// --- Retry Logic ---

function retryDelay(attempt) {
  const base = Math.min(RETRY_INITIAL_DELAY * Math.pow(2, attempt), RETRY_MAX_DELAY);
  return base * (0.5 + Math.random() * 0.5);
}

function isRateLimitError(text) {
  return /429|rate.?limit|too many requests|quota.?exceeded|resource.?exhausted|overloaded|capacity/i.test(text);
}

function isModelNotFound(text) {
  return /model_not_found|model is not supported|not found/i.test(text);
}

// --- Core Execution: single model attempt ---

function executeGeminiWithModel(args, model, attempt = 0) {
  return new Promise((resolve, reject) => {
    const workDir = args.working_directory || process.cwd();

    const rolePrompt = loadRolePrompt(args.agent_role);
    const contextContent = buildContextContent(args.files);
    const fullPrompt = rolePrompt + (args.prompt || '') + contextContent;

    const cliArgs = ['-p=.', '--yolo'];
    if (model) cliArgs.push('--model', model);

    const child = spawn('gemini', cliArgs, {
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

      if (code !== 0) {
        const combined = stderr + stdout;
        if (isModelNotFound(combined)) {
          reject(new Error('MODEL_NOT_FOUND'));
          return;
        }
        if (isRateLimitError(combined) && attempt < MAX_RETRIES) {
          setTimeout(() => executeGeminiWithModel(args, model, attempt + 1).then(resolve).catch(reject), retryDelay(attempt));
          return;
        }
        resolve({ ok: false, error: `Gemini error (exit ${code}): ${(stderr || stdout).slice(0, 1000)}` });
        return;
      }
      resolve({ ok: true, result: stdout.trim() });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (child.pid) spawnedPids.delete(child.pid);
      reject(err);
    });
  });
}

// --- Core Execution: with model fallback chain ---

async function executeGemini(args) {
  const requestedModel = args.model || DEFAULT_MODEL;

  const startIdx = MODEL_FALLBACK_CHAIN.indexOf(requestedModel);
  const chain = startIdx >= 0
    ? MODEL_FALLBACK_CHAIN.slice(startIdx)
    : [requestedModel, ...MODEL_FALLBACK_CHAIN];

  let lastError = '';
  let usedFallback = false;
  let fallbackModel = null;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      const outcome = await executeGeminiWithModel(args, model);
      if (i > 0) {
        outcome.usedFallback = true;
        outcome.fallbackModel = model;
      }
      return outcome;
    } catch (err) {
      if (err.message === 'MODEL_NOT_FOUND' && i < chain.length - 1) {
        usedFallback = true;
        fallbackModel = chain[i + 1];
        continue;
      }
      lastError = err.message;
    }
  }

  return { ok: false, error: `All models in fallback chain failed. Last error: ${lastError}` };
}

// --- Background Execution ---

function executeGeminiBackground(args) {
  const jobId = generateJobId();
  const model = args.model || DEFAULT_MODEL;

  jobs.set(jobId, {
    status: 'spawned',
    model,
    agentRole: args.agent_role || '',
    spawnedAt: new Date().toISOString(),
  });

  setImmediate(async () => {
    const job = jobs.get(jobId);
    if (!job) return;
    job.status = 'running';

    try {
      const outcome = await executeGemini(args);
      const current = jobs.get(jobId);
      if (current && current.killedByUser) return;

      if (outcome.ok) {
        const update = { ...job, status: 'completed', result: outcome.result, completedAt: new Date().toISOString() };
        if (outcome.usedFallback) {
          update.usedFallback = true;
          update.fallbackModel = outcome.fallbackModel;
        }
        jobs.set(jobId, update);
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

// --- wait_for_job ---

function waitForJob(jobId, timeoutMs) {
  const timeout = Math.min(timeoutMs || 300000, 3600000);
  const startTime = Date.now();

  return new Promise((resolve) => {
    let delay = 500;
    const factor = 1.5;
    const maxDelay = 2000;

    function poll() {
      const job = jobs.get(jobId);
      if (!job) {
        resolve({ error: `Job not found: ${jobId}` });
        return;
      }

      if (job.status === 'completed' || job.status === 'failed' || job.status === 'timeout') {
        const response = {
          job_id: jobId,
          status: job.status,
          model: job.model,
          agent_role: job.agentRole,
        };
        if (job.status === 'completed') {
          response.result = job.result;
          if (job.usedFallback) {
            response.used_fallback = true;
            response.fallback_model = job.fallbackModel;
          }
        } else {
          response.error = job.error;
        }
        resolve(response);
        return;
      }

      if (Date.now() - startTime > timeout) {
        job.status = 'timeout';
        job.error = `wait_for_job timed out after ${timeout}ms`;
        job.completedAt = new Date().toISOString();
        resolve({ job_id: jobId, status: 'timeout', error: job.error });
        return;
      }

      delay = Math.min(delay * factor, maxDelay);
      setTimeout(poll, delay);
    }

    poll();
  });
}

// --- kill_job ---

function killJob(jobId, signal) {
  const job = jobs.get(jobId);
  if (!job) return { error: `Job not found: ${jobId}` };

  if (job.status !== 'spawned' && job.status !== 'running') {
    return { error: `Job ${jobId} is in terminal state: ${job.status}. Cannot kill.` };
  }

  job.killedByUser = true;
  job.status = 'failed';
  job.error = `Killed by user (signal: ${signal || 'SIGTERM'})`;
  job.completedAt = new Date().toISOString();

  if (job.pid && spawnedPids.has(job.pid)) {
    try {
      process.kill(job.pid, signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM');
    } catch { /* already exited */ }
  }

  return { job_id: jobId, status: 'failed', message: `Job killed with ${signal || 'SIGTERM'}` };
}

// --- Tool Handler ---

async function handleToolCall(name, args) {
  switch (name) {
    case 'ask_gemini': {
      if (args.background) {
        const jobId = executeGeminiBackground(args);
        return { job_id: jobId, status: 'spawned', message: 'Use wait_for_job or check_job_status to get results.' };
      }
      const outcome = await executeGemini(args);
      if (outcome.ok) {
        const result = { content: outcome.result };
        if (outcome.usedFallback) {
          result.used_fallback = true;
          result.fallback_model = outcome.fallbackModel;
        }
        return result;
      }
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
      if (job.usedFallback) {
        response.used_fallback = true;
        response.fallback_model = job.fallbackModel;
      }
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
