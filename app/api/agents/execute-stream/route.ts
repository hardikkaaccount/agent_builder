/**
 * AgentFlow — SSE Streaming Execution Engine (V3 Pure LLM)
 *
 * Every node is a focused LLM call. NO external APIs.
 * "Tools" are prompt patterns injected into the system prompt
 * that shape how the LLM approaches each task.
 *
 * Data flows between nodes as structured text context.
 * Zero dependencies beyond the LLM provider (Bedrock).
 */

import { NextRequest } from 'next/server';
import { Workflow } from '@/types/agent';
import { getTool, getToolPromptHints } from '@/lib/ai/tools/tool-registry';
import { writeAgentOutput } from '@/lib/ai/tools/write-file';
import { getProviderForModel } from '@/lib/ai/provider-manager';
import { appConfig } from '@/config/app.config';
import { generateText } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_TIMEOUT_MS = 90_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_CONTEXT_PER_NODE = 3000;
const MAX_TOTAL_CONTEXT = 12000;

// ─── SSE Helpers ─────────────────────────────────────────────────────────────

function sse(type: string, data: Record<string, any>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}
function ts(): string { return new Date().toISOString(); }

// ─── Topological stages ──────────────────────────────────────────────────────

function buildStages(workflow: Workflow): string[][] {
  const resolved = new Set<string>();
  const stages: string[][] = [];
  const remaining = new Set(workflow.nodes.map(n => n.id));

  while (remaining.size > 0) {
    const stage: string[] = [];
    for (const nodeId of remaining) {
      const node = workflow.nodes.find(n => n.id === nodeId)!;
      if (node.dependencies.every(dep => resolved.has(dep))) {
        stage.push(nodeId);
      }
    }
    if (stage.length === 0) break;
    for (const id of stage) { resolved.add(id); remaining.delete(id); }
    stages.push(stage);
  }

  if (remaining.size > 0) {
    throw new Error(`Workflow graph is invalid. Unresolvable nodes: ${Array.from(remaining).join(', ')}`);
  }
  return stages;
}

// ─── Smart context builder ───────────────────────────────────────────────────

function buildContext(
  node: any,
  nodeOutputs: Record<string, any>,
  workflow: Workflow,
  globalContext: Record<string, any>
): string {
  const parts: string[] = [];
  let total = 0;

  // Goal
  const goal = `## Workflow Goal\n${globalContext.workflow_goal || 'N/A'}`;
  parts.push(goal);
  total += goal.length;

  // User-provided data (from environment/inputs)
  if (Object.keys(node.environment || {}).length > 0) {
    const envStr = Object.entries(node.environment)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    const section = `## User Data\n${envStr}`;
    parts.push(section);
    total += section.length;
  }

  // Direct dependencies (full context)
  const directDeps: string[] = node.dependencies || [];
  for (const depId of directDeps) {
    if (total >= MAX_TOTAL_CONTEXT) break;
    const dep = workflow.nodes.find(n => n.id === depId);
    const output = nodeOutputs[depId];
    if (!dep || !output) continue;

    const raw = output._raw || JSON.stringify(output);
    const budget = Math.min(MAX_CONTEXT_PER_NODE, MAX_TOTAL_CONTEXT - total);
    const truncated = raw.slice(0, budget);
    const section = `## Output from: ${dep.name}\n${truncated}${raw.length > budget ? '\n...(truncated)' : ''}`;
    parts.push(section);
    total += section.length;
  }

  // Indirect upstream (compressed)
  const indirect = Object.keys(nodeOutputs).filter(id => !directDeps.includes(id) && id !== node.id);
  if (indirect.length > 0 && total < MAX_TOTAL_CONTEXT) {
    const budget = Math.max(0, MAX_TOTAL_CONTEXT - total);
    const perNode = Math.min(500, Math.floor(budget / indirect.length));

    for (const id of indirect) {
      if (total >= MAX_TOTAL_CONTEXT) break;
      const dep = workflow.nodes.find(n => n.id === id);
      const output = nodeOutputs[id];
      if (!dep || !output) continue;

      const raw = (output._raw || JSON.stringify(output)).slice(0, perNode);
      const line = `**${dep.name}**: ${raw}${raw.length >= perNode ? '...' : ''}`;
      parts.push(line);
      total += line.length;
    }
  }

  return parts.join('\n\n');
}

// ─── Build system prompt ─────────────────────────────────────────────────────

function buildSystemPrompt(node: any, contextStr: string): string {
  // Get tool prompt hints (shapes HOW the LLM approaches the task)
  const toolNames: string[] = (node.tools || [])
    .map((t: any) => typeof t === 'string' ? t : t.name)
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean);

  const toolHints = getToolPromptHints(toolNames);
  const customToolNames = toolNames.filter((name) => !getTool(name));
  const customToolHints = customToolNames.length > 0
    ? customToolNames.map((name) => `- ${name}: Treat this as a custom capability label. Adapt your reasoning style to satisfy "${name}" explicitly.`).join('\n')
    : '';

  const outputDesc = Object.entries(node.outputs || {})
    .map(([key, schema]: [string, any]) => `- **${key}** (${schema.type}): ${schema.description}`)
    .join('\n');

  return `You are a specialized AI agent in a multi-agent pipeline.

## Your Identity
Name: ${node.name}
Role: ${(node.role || 'worker').toUpperCase()}
${toolNames.length > 0 ? `Capabilities: ${toolNames.join(', ')}` : ''}

## Your Approach
${toolHints || 'Execute your task thoroughly and completely.'}
${customToolHints ? `\nCustom capability hints:\n${customToolHints}` : ''}

## Your Task
${node.task}

${node.systemPrompt ? `## Additional Instructions\n${node.systemPrompt}\n` : ''}

## Context From Upstream Agents
${contextStr || 'You are the first agent — no prior context available.'}

## Expected Output
${outputDesc || 'Provide a comprehensive, well-structured response.'}

## Rules
1. Be thorough, specific, and detailed.
2. Structure your response with clear sections and headers.
3. Other agents depend on your output — quality matters.
4. Use facts from your training knowledge. State assumptions clearly.
5. Do NOT wrap your response in JSON unless explicitly asked.`;
}

// ─── Retry with jitter ───────────────────────────────────────────────────────

function retryDelay(attempt: number): number {
  const base = Math.pow(2, attempt) * 1000;
  return Math.min(base * (0.5 + Math.random() * 0.5), 15_000);
}

// ─── Execute single node (pure LLM) ─────────────────────────────────────────

interface NodeResult {
  success: boolean;
  output: any;
  error: string;
  tokens: { prompt: number; completion: number };
  duration: number;
}

async function executeNode(
  node: any,
  contextStr: string,
  executionId: string,
  enqueue: (e: string) => void,
  abortSignal?: AbortSignal
): Promise<NodeResult> {
  const start = Date.now();

  const log = (msg: string, level = 'info') => {
    enqueue(sse('node_log', {
      nodeId: node.id, nodeName: node.name, message: msg, level, timestamp: ts(),
    }));
  };

  const toolNames: string[] = (node.tools || [])
    .map((t: any) => typeof t === 'string' ? t : t.name)
    .filter(Boolean);

  log(`Starting: ${node.name} [${toolNames.join(', ')}]`);

  const systemPrompt = buildSystemPrompt(node, contextStr);

  try {
    const modelId = node.model || appConfig.ai.defaultModel;
    const { client, actualModel } = getProviderForModel(modelId);
    log(`Model: ${actualModel}`);

    // Per-node timeout
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), NODE_TIMEOUT_MS);
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => abort.abort(), { once: true });
    }

    try {
      const response = await generateText({
        model: (client as any)(actualModel),
        system: systemPrompt,
        prompt: `Execute your task now:\n\n${node.task}`,
        temperature: node.temperature ?? 0.5,
        abortSignal: abort.signal,
      });

      clearTimeout(timer);

      const output = response.text || '';
      const duration = Date.now() - start;
      const tokens = {
        prompt: (response as any).usage?.promptTokens ?? 0,
        completion: (response as any).usage?.completionTokens ?? 0,
      };

      writeAgentOutput(executionId, node.id, 'output.md', output);

      log(`✅ Done in ${duration}ms (${output.length} chars, ${tokens.prompt + tokens.completion} tokens)`);

      // Build structured output
      const structured: Record<string, any> = {};
      for (const key of Object.keys(node.outputs || {})) {
        structured[key] = output;
      }

      return {
        success: true,
        output: { ...structured, _raw: output, _duration: duration, _model: actualModel, _tokens: tokens },
        error: '',
        tokens,
        duration,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (error: any) {
    const duration = Date.now() - start;
    const isTimeout = error?.name === 'AbortError';
    const msg = isTimeout ? `Timeout after ${NODE_TIMEOUT_MS / 1000}s` : error?.message || 'Unknown error';
    log(`❌ ${msg}`, 'error');
    return { success: false, output: null, error: msg, tokens: { prompt: 0, completion: 0 }, duration };
  }
}

// ─── Main SSE Handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let workflow: Workflow;
  try {
    const body = await req.json();
    workflow = body.workflow;
    if (!workflow?.nodes) return new Response('Invalid workflow', { status: 400 });
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const reqSignal = req.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;

      const enqueue = (event: string) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(event)); } catch { closed = true; }
      };

      const heartbeat = setInterval(() => enqueue(sse('heartbeat', { timestamp: ts() })), HEARTBEAT_INTERVAL_MS);

      const metrics = {
        totalTokens: { prompt: 0, completion: 0 },
        totalRetries: 0,
        nodeDurations: {} as Record<string, number>,
        nodeTokens: {} as Record<string, { prompt: number; completion: number }>,
      };

      const globalContext: Record<string, any> = {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        workflow_goal: workflow.goal,
        execution_id: executionId,
      };

      const nodeOutputs: Record<string, any> = {};

      try {
        const stages = buildStages(workflow);

        enqueue(sse('execution_started', {
          executionId, workflowId: workflow.id, workflowName: workflow.name,
          nodeCount: workflow.nodes.length, stageCount: stages.length, timestamp: ts(),
        }));

        let failed = false;

        for (let si = 0; si < stages.length; si++) {
          if (reqSignal?.aborted) {
            enqueue(sse('workflow_aborted', { executionId, reason: 'Client disconnected', timestamp: ts() }));
            break;
          }

          const stage = stages[si];
          enqueue(sse('stage_started', { stageIndex: si + 1, stageCount: stages.length, nodeIds: stage, timestamp: ts() }));

          const promises = stage.map(async (nodeId) => {
            const node = workflow.nodes.find(n => n.id === nodeId);
            if (!node) return;

            enqueue(sse('node_started', {
              nodeId: node.id, nodeName: node.name, nodeRole: node.role,
              stageIndex: si + 1, timestamp: ts(),
            }));

            const ctx = buildContext(node, nodeOutputs, workflow, globalContext);

            let result: NodeResult = { success: false, output: null, error: '', tokens: { prompt: 0, completion: 0 }, duration: 0 };
            const maxRetries = workflow.maxRetries ?? 2;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
              if (attempt > 0) {
                metrics.totalRetries++;
                const delay = retryDelay(attempt);
                enqueue(sse('node_log', {
                  nodeId: node.id, nodeName: node.name,
                  message: `Retrying in ${(delay / 1000).toFixed(1)}s (${attempt + 1}/${maxRetries + 1})`,
                  level: 'warning', timestamp: ts(),
                }));
                await new Promise(r => setTimeout(r, delay));
              }
              result = await executeNode(node, ctx, executionId, enqueue, reqSignal);
              if (result.success) break;
            }

            metrics.totalTokens.prompt += result.tokens.prompt;
            metrics.totalTokens.completion += result.tokens.completion;
            metrics.nodeDurations[node.name] = result.duration;
            metrics.nodeTokens[node.name] = result.tokens;

            if (result.success) {
              nodeOutputs[nodeId] = result.output;
              enqueue(sse('node_completed', {
                nodeId: node.id, nodeName: node.name,
                outputPreview: result.output?._raw?.slice(0, 500) || '',
                duration: result.duration, tokens: result.tokens, timestamp: ts(),
              }));
            } else {
              enqueue(sse('node_failed', {
                nodeId: node.id, nodeName: node.name,
                error: result.error, duration: result.duration, timestamp: ts(),
              }));
              if (!node.skipOnFailure) failed = true;
            }
          });

          await Promise.all(promises);

          enqueue(sse('stage_completed', { stageIndex: si + 1, stageCount: stages.length, timestamp: ts() }));

          if (failed) {
            enqueue(sse('workflow_failed', { executionId, reason: 'Node failure', nodeOutputs, timestamp: ts() }));
            break;
          }
        }

        if (!failed && !reqSignal?.aborted) {
          const finalOutput = Object.entries(nodeOutputs).reduce((acc, [id, out]) => {
            const node = workflow.nodes.find(n => n.id === id);
            acc[node?.name || id] = out?._raw || out;
            return acc;
          }, {} as Record<string, any>);

          enqueue(sse('workflow_completed', { executionId, workflowId: workflow.id, finalOutput, nodeOutputs, timestamp: ts() }));

          enqueue(sse('execution_summary', {
            executionId,
            totalDuration: Object.values(metrics.nodeDurations).reduce((a, b) => a + b, 0),
            totalTokens: metrics.totalTokens,
            totalRetries: metrics.totalRetries,
            nodesCompleted: Object.keys(nodeOutputs).length,
            nodesTotal: workflow.nodes.length,
            nodeDurations: metrics.nodeDurations,
            nodeTokens: metrics.nodeTokens,
            timestamp: ts(),
          }));
        }
      } catch (error: any) {
        enqueue(sse('error', { executionId, message: error?.message || 'Server error', timestamp: ts() }));
      } finally {
        clearInterval(heartbeat);
        try { if (!closed) controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
