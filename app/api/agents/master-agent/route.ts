/**
 * AgentFlow — Master Agent V3 (Pure LLM)
 *
 * Decomposes any user goal into a DAG of specialized LLM agents.
 * NO external APIs required. Each node is a focused LLM call.
 *
 * The magic: each node gets a custom system prompt shaped by its
 * assigned "tools" (prompt patterns like research, analyze, compare).
 * Data flows between nodes as structured text context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import {
  Workflow,
  AgentNode,
  MasterAgentInput,
  MasterAgentOutput,
  AgentBuilderError,
  MasterAgentError,
} from '@/types/agent';
import {
  generateWorkflowId,
  generateNodeId,
  validateWorkflow,
  topologicalSort,
  calculateComplexity,
} from '@/lib/ai/workflow-utils';
import { getProviderForModel } from '@/lib/ai/provider-manager';
import { getToolDescriptionsForPrompt, getToolNames } from '@/lib/ai/tools/tool-registry';
import { appConfig } from '@/config/app.config';

// ============================================================================
// SYSTEM PROMPT — V3 Pure LLM
// ============================================================================

const MASTER_AGENT_SYSTEM_PROMPT = `You are the Master Agent — an AI architect that decomposes ANY user goal into a pipeline of specialized AI agents.

## HOW IT WORKS
1. User describes a goal in plain text
2. You break it into a DAG of agent nodes
3. Each node is a focused AI call that does ONE thing well
4. Nodes pass their output to downstream nodes as context
5. The final node produces the end result

## AVAILABLE CAPABILITIES (assign to nodes via "tools" array)
${getToolDescriptionsForPrompt()}

## NODE DESIGN RULES

### Task Descriptions — BE EXTREMELY SPECIFIC
BAD: "Research flights"
GOOD: "Research round-trip flight options from New York (JFK) to Tokyo (NRT/HND) for March 15-22, 2025. Compare economy and business class. List: airline, price range, duration, stops, and departure times. Focus on the 5 best value options."

### Structure
- Each node does ONE focused task
- Use 3-8 nodes for most goals
- Nodes with no dependencies run in PARALLEL (same stage)
- Final node should aggregate/format all results
- Node names: lowercase-hyphenated (e.g. "market-analysis", "budget-planner")

### Roles
- worker: Does a specific task (90% of nodes)
- coordinator: Combines outputs from multiple workers
- validator: Quality-checks before final output

## USER DATA
If the user provides specific data, numbers, URLs, or context — pass it through as node inputs. Nodes can reference this data in their tasks.

## OUTPUT FORMAT
Respond with ONLY valid JSON (no markdown fences, no extra text):

{
  "workflow": {
    "id": "wf-<slug>",
    "name": "Human Readable Name",
    "description": "One-line description of what this pipeline does",
    "goal": "<user's exact goal>",
    "category": "<research|analysis|planning|content|comparison|data|general>",
    "nodes": [
      {
        "id": "<unique-slug>",
        "name": "descriptive-name",
        "role": "worker",
        "task": "EXTREMELY DETAILED task description. Tell the agent exactly what to do, what to focus on, what format to output. The more specific, the better the result.",
        "tools": ["research", "analyze"],
        "inputs": {
          "field_name": { "type": "string", "description": "what this input is" }
        },
        "outputs": {
          "field_name": { "type": "string", "description": "what this output contains" }
        },
        "dependencies": []
      }
    ],
    "edges": [
      { "from": "source-id", "to": "target-id" }
    ]
  },
  "reasoning": "Brief explanation of the pipeline architecture",
  "confidence": 0.95
}

## EXAMPLES

### "Compare React vs Vue vs Svelte for a new project"
Nodes:
1. react-researcher (worker, tools: ["research"]) — "Research React.js in depth: current version, ecosystem size, performance benchmarks, learning curve, major companies using it, pros and cons. Be factual and detailed."
2. vue-researcher (worker, tools: ["research"]) — same for Vue
3. svelte-researcher (worker, tools: ["research"]) — same for Svelte
4. framework-comparator (coordinator, tools: ["compare", "analyze"], deps: [1,2,3]) — "Compare all three frameworks side-by-side on: performance, ecosystem, learning curve, job market, scalability. Create a comparison table."
5. recommendation-writer (worker, tools: ["write"], deps: [4]) — "Write a clear recommendation report with a final verdict."

### "Create a marketing strategy for a SaaS product"
Nodes:
1. market-researcher (worker, tools: ["research"]) — "Research current SaaS marketing trends, channels, and strategies that work in 2025."
2. audience-analyzer (worker, tools: ["analyze"]) — "Define ideal customer profiles and buyer personas for a SaaS product."
3. channel-strategist (worker, tools: ["plan", "analyze"], deps: [1,2]) — "Plan the marketing channels and budget allocation."
4. content-planner (worker, tools: ["plan", "brainstorm"], deps: [2]) — "Create a 90-day content calendar with topics and formats."
5. strategy-assembler (coordinator, tools: ["aggregate", "write"], deps: [3,4]) — "Assemble the complete marketing strategy document."
`;

// ============================================================================
// PARSER
// ============================================================================

function parseWorkflowResponse(response: string): {
  workflow: Workflow;
  reasoning: string;
  confidence: number;
} {
  try {
    let jsonStr = response;

    // Strip markdown fences
    const fenceMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1];
    } else {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.workflow?.nodes) {
      throw new Error('Missing workflow.nodes in response');
    }

    const workflow = enrichWorkflow(parsed.workflow);

    const validation = validateWorkflow(workflow);
    if (!validation.valid) {
      console.warn('[MasterAgent] Validation issues:', validation.errors);
    }

    return {
      workflow,
      reasoning: parsed.reasoning || '',
      confidence: parsed.confidence ?? 0.85,
    };
  } catch (error: any) {
    throw new MasterAgentError(
      `Failed to parse workflow: ${error.message}`,
      { originalError: error, response: response.slice(0, 500) }
    );
  }
}

// ============================================================================
// ENRICHMENT
// ============================================================================

const VALID_TOOLS = new Set(getToolNames());

function enrichWorkflow(data: any): Workflow {
  const nodes = (data.nodes || []).map((n: any) => enrichNode(n));

  // Auto-derive edges from dependencies
  const edges = (data.edges && data.edges.length > 0)
    ? data.edges
    : nodes.flatMap((n: AgentNode) =>
        n.dependencies.map((dep: string) => ({ from: dep, to: n.id }))
      );

  const executionOrder = topologicalSort(nodes, edges) || nodes.map((n: AgentNode) => n.id);
  const maxDeps = Math.max(0, ...nodes.map((n: AgentNode) => n.dependencies.length));

  return {
    id: data.id || generateWorkflowId(),
    name: data.name || 'Untitled Workflow',
    description: data.description || '',
    goal: data.goal || '',
    category: data.category || 'general',
    nodes,
    edges,
    executionOrder,
    status: 'draft',
    version: 1,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    complexity: calculateComplexity(nodes.length, edges.length, maxDeps),
    parallelExecution: true,
    maxRetries: 2,
    environment: data.environment || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function enrichNode(data: any): AgentNode {
  // Filter tools to valid registry entries
  const rawTools: string[] = (data.tools || []).filter((t: string) => typeof t === 'string');
  const validTools = rawTools.filter(t => VALID_TOOLS.has(t));

  // If no tools assigned, infer from role
  if (validTools.length === 0) {
    if (data.role === 'coordinator') validTools.push('aggregate');
    else if (data.role === 'validator') validTools.push('validate');
    else validTools.push('research'); // default for workers
  }

  return {
    id: data.id || generateNodeId(),
    name: data.name || 'node',
    description: data.description || data.task || '',
    role: data.role || 'worker',
    task: data.task || '',
    systemPrompt: data.systemPrompt,
    inputs: normalizeIO(data.inputs || {}),
    outputs: normalizeIO(data.outputs || {}),
    dependencies: data.dependencies || [],
    skipOnFailure: data.skipOnFailure ?? false,
    environment: data.environment || {},
    model: data.model || appConfig.ai.defaultModel,
    temperature: data.temperature ?? 0.5,
    maxTokens: data.maxTokens ?? 4096,
    topP: data.topP ?? 1,
    tools: validTools.map(name => ({
      name,
      description: '',
      inputSchema: {},
      outputSchema: {},
    })),
    canExecuteCode: false,
    successCriteria: [],
    expectedOutputFormat: data.expectedOutputFormat,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };
}

function normalizeIO(schema: any): Record<string, any> {
  if (typeof schema !== 'object' || schema === null) return {};
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(schema)) {
    if (typeof val === 'object' && val !== null) out[key] = val;
    else out[key] = { type: 'string', description: String(val) };
  }
  return out;
}

// ============================================================================
// API
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    console.log('[MasterAgent V3] Starting...');
    const body: MasterAgentInput = await req.json();

    if (!body.userPrompt) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 });
    }

    console.log('[MasterAgent V3] Goal:', body.userPrompt);

    const prompt = `User Goal: ${body.userPrompt}
${body.context ? `\nUser Context: ${body.context}` : ''}
${body.constraints?.length ? `\nConstraints:\n${body.constraints.map(c => `- ${c}`).join('\n')}` : ''}

Decompose this into a multi-agent pipeline. Make each node's task EXTREMELY specific and actionable.`;

    const modelId = (body as any).modelId || appConfig.ai.defaultModel;
    const { client, actualModel } = getProviderForModel(modelId);

    const response = await generateText({
      model: client(actualModel),
      system: MASTER_AGENT_SYSTEM_PROMPT,
      prompt,
      temperature: 0.5,
    });

    const parsed = parseWorkflowResponse(response.text);

    // Log
    for (const node of parsed.workflow.nodes) {
      const tools = (node.tools || []).map((t: any) => typeof t === 'string' ? t : t.name);
      console.log(`  → ${node.name} [${node.role}] tools: [${tools.join(', ')}]`);
    }
    console.log(`[MasterAgent V3] ${parsed.workflow.nodes.length} nodes, ${parsed.workflow.complexity}`);

    return NextResponse.json({
      workflow: parsed.workflow,
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
    } as MasterAgentOutput);

  } catch (error: any) {
    console.error('[MasterAgent V3] Error:', error);
    if (error instanceof AgentBuilderError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Master Agent V3 (Pure LLM)',
    version: '3.0.0',
    description: 'Decomposes any goal into a multi-agent pipeline. No external APIs needed.',
    capabilities: getToolNames(),
  });
}
