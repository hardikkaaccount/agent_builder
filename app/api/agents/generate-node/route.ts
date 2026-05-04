import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import type { AgentNode, Workflow } from '@/types/agent';
import { appConfig } from '@/config/app.config';
import { getProviderForModel } from '@/lib/ai/provider-manager';
import { generateNodeId } from '@/lib/ai/workflow-utils';

const NODE_GENERATOR_PROMPT = `You design ONE custom workflow node for an AI agent pipeline.

Rules:
1. Return ONLY valid JSON.
2. Role is free-form (no fixed enum).
3. Tools are free-form capability labels.
4. Task must be specific and executable.
5. Keep names concise and readable.

JSON shape:
{
  "name": "string",
  "description": "string",
  "role": "string",
  "task": "string",
  "tools": ["string"],
  "inputs": { "key": { "type": "string", "description": "..." } },
  "outputs": { "key": { "type": "string", "description": "..." } },
  "systemPrompt": "optional string"
}`;

function safeParseJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  return JSON.parse(candidate);
}

function normalizeSchema(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object') return {};
  const schema: Record<string, any> = {};
  for (const [key, raw] of Object.entries(value as Record<string, any>)) {
    if (typeof raw === 'object' && raw !== null) {
      schema[key] = {
        type: typeof raw.type === 'string' ? raw.type : 'string',
        description: typeof raw.description === 'string' ? raw.description : `${key} field`,
      };
    } else {
      schema[key] = { type: 'string', description: `${key} field` };
    }
  }
  return schema;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body?.prompt || '').toString().trim();
    const workflow = body?.workflow as Workflow | undefined;
    const requestedDependencies = Array.isArray(body?.dependencies)
      ? body.dependencies.map((d: unknown) => String(d))
      : [];

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const modelId = body?.modelId || appConfig.ai.defaultModel;
    const { client, actualModel } = getProviderForModel(modelId);

    const workflowContext = workflow
      ? `Current workflow goal: ${workflow.goal}\nExisting nodes: ${workflow.nodes.map((n) => `${n.id}:${n.name}`).join(', ')}`
      : 'No existing workflow context provided.';

    const result = await generateText({
      model: client(actualModel),
      system: NODE_GENERATOR_PROMPT,
      prompt: `User request for new node:\n${prompt}\n\n${workflowContext}\n\nGenerate a single node.`,
      temperature: 0.4,
    });

    const parsed = safeParseJson(result.text);

    const node: Partial<AgentNode> = {
      id: generateNodeId('custom'),
      name: typeof parsed.name === 'string' ? parsed.name : 'custom-node',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      role: typeof parsed.role === 'string' ? parsed.role : 'custom',
      task: typeof parsed.task === 'string' ? parsed.task : prompt,
      systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : undefined,
      inputs: normalizeSchema(parsed.inputs),
      outputs: normalizeSchema(parsed.outputs),
      dependencies: requestedDependencies,
      tools: Array.isArray(parsed.tools)
        ? parsed.tools
            .filter((t: unknown): t is string => typeof t === 'string')
            .map((t: string) => t.trim().toLowerCase())
            .filter(Boolean)
            .map((name: string) => ({
              name,
              description: `Custom capability: ${name}`,
              inputSchema: {},
              outputSchema: {},
            }))
        : [],
      environment: {},
      model: appConfig.ai.defaultModel,
      temperature: 0.5,
      maxTokens: 4096,
      topP: 1,
      canExecuteCode: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    return NextResponse.json({ node });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate node' },
      { status: 500 }
    );
  }
}
