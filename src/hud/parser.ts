import { readFileSync, existsSync, statSync } from 'node:fs';
import type { AgentInfo } from './state.js';

interface TranscriptEntry {
  type: string;
  tool_name?: string;
  agent_name?: string;
  model?: string;
  message?: string;
  cost_usd?: number;
  cache_hit?: boolean;
  timestamp?: string;
}

export interface ParsedTranscript {
  toolCalls: number;
  agentCalls: number;
  skillCalls: number;
  agents: AgentInfo[];
  totalCost: number;
  cacheHits: number;
  totalRequests: number;
  model: string;
  contextWindow: number;
}

const TAIL_BYTES = 512 * 1024; // 500KB tail optimization

export function parseTranscript(transcriptPath: string): ParsedTranscript {
  const result: ParsedTranscript = {
    toolCalls: 0,
    agentCalls: 0,
    skillCalls: 0,
    agents: [],
    totalCost: 0,
    cacheHits: 0,
    totalRequests: 0,
    model: 'unknown',
    contextWindow: 0,
  };

  if (!existsSync(transcriptPath)) return result;

  try {
    const stat = statSync(transcriptPath);
    let content: string;

    // Tail optimization for large transcripts
    if (stat.size > TAIL_BYTES) {
      const fd = require('fs').openSync(transcriptPath, 'r');
      const buffer = Buffer.alloc(TAIL_BYTES);
      require('fs').readSync(fd, buffer, 0, TAIL_BYTES, stat.size - TAIL_BYTES);
      require('fs').closeSync(fd);
      content = buffer.toString('utf-8');
      // Skip first partial line
      const firstNewline = content.indexOf('\n');
      if (firstNewline >= 0) content = content.slice(firstNewline + 1);
    } else {
      content = readFileSync(transcriptPath, 'utf-8');
    }

    const lines = content.split('\n').filter(Boolean);
    const activeAgents = new Map<string, AgentInfo>();

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as TranscriptEntry;

        if (entry.type === 'tool_use' || entry.type === 'tool_result') {
          result.toolCalls++;
          if (entry.tool_name === 'Task') result.agentCalls++;
          if (entry.tool_name === 'Skill') result.skillCalls++;
        }

        if (entry.type === 'agent_start' && entry.agent_name) {
          const tier = entry.model?.includes('opus') ? 'O' :
                       entry.model?.includes('haiku') ? 'H' : 'S';
          activeAgents.set(entry.agent_name, {
            name: entry.agent_name,
            modelTier: tier as 'O' | 'S' | 'H',
            duration: '0s',
            status: 'running',
          });
        }

        if (entry.type === 'agent_end' && entry.agent_name) {
          activeAgents.delete(entry.agent_name);
        }

        if (entry.cost_usd) result.totalCost += entry.cost_usd;
        if (entry.cache_hit !== undefined) {
          result.totalRequests++;
          if (entry.cache_hit) result.cacheHits++;
        }

        if (entry.model) result.model = entry.model;
      } catch {
        // Skip malformed lines
      }
    }

    result.agents = [...activeAgents.values()];
    return result;
  } catch {
    return result;
  }
}
