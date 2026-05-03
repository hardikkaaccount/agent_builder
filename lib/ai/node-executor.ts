/**
 * Node Executor
 * Executes individual agent nodes and manages their I/O
 */

import {
  AgentNode,
  NodeExecution,
} from '@/types/agent';
import { generateNodeId } from './workflow-utils';
import { getProviderForModel } from './provider-manager';
import { generateText } from 'ai';
import { appConfig } from '@/config/app.config';

export interface NodeExecutionContext {
  nodeId: string;
  nodeExecution: NodeExecution;
  previousOutputs: Map<string, any>;
  globalContext: Record<string, any>;
  environment: Record<string, string>;
  sandbox?: {
    sandboxId: string;
    url: string;
  };
}

export interface NodeExecutionResult {
  success: boolean;
  nodeId: string;
  output?: any;
  error?: string;
  duration: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
  logs: string[];
}

/**
 * Execute a single node
 */
export async function executeNode(
  node: AgentNode,
  context: NodeExecutionContext,
  timeout: number = 60000
): Promise<NodeExecutionResult> {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    console.log(`[NodeExecutor] Starting execution of node: ${node.name}`);
    logs.push(`[${new Date().toISOString()}] Starting node execution`);

    // Validate inputs
    const validationResult = validateNodeInputs(node, context.previousOutputs, context.globalContext, context.environment);
    if (!validationResult.valid) {
      throw new Error(`Input validation failed: ${validationResult.errors.join(', ')}`);
    }
    logs.push(`[${new Date().toISOString()}] Inputs validated`);

    // Prepare inputs for the node
    const nodeInputs = prepareNodeInputs(node, context.previousOutputs, context.globalContext, context.environment);
    logs.push(`[${new Date().toISOString()}] Prepared inputs: ${Object.keys(nodeInputs).join(', ')}`);

    // Build system prompt with context
    const systemPrompt = buildNodeSystemPrompt(node, nodeInputs, context);

    // Call AI to execute node
    const modelId = node.model || appConfig.ai.defaultModel;
    const { client, actualModel } = getProviderForModel(modelId);

    console.log(`[NodeExecutor] Calling model: ${modelId} (actual: ${actualModel})`);
    logs.push(`[${new Date().toISOString()}] Calling model: ${modelId}`);

    const response = await Promise.race([
      generateText({
        model: client(actualModel),
        system: systemPrompt,
        prompt: node.task,
        temperature: node.temperature ?? 0.7,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Node execution timeout')), timeout)
      ),
    ] as const);

    logs.push(`[${new Date().toISOString()}] Model response received`);

    // Parse output according to node's expected format
    const responseText = (response as any).text || String(response);
    
    const parsedOutput = parseNodeOutput(node, responseText);
    logs.push(`[${new Date().toISOString()}] Output parsed: ${Object.keys(parsedOutput).join(', ')}`);

    // Validate output
    const outputValidation = validateNodeOutput(node, parsedOutput);
    if (!outputValidation.valid) {
      throw new Error(`Output validation failed: ${outputValidation.errors.join(', ')}`);
    }
    logs.push(`[${new Date().toISOString()}] Output validated`);

    const duration = Date.now() - startTime;
    console.log(`[NodeExecutor] Node completed: ${node.name} (${duration}ms)`);

    return {
      success: true,
      nodeId: node.id,
      output: parsedOutput,
      duration,
      logs,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    logs.push(`[${new Date().toISOString()}] Error: ${errorMsg}`);

    console.error(`[NodeExecutor] Node failed: ${node.name}`, error);

    return {
      success: false,
      nodeId: node.id,
      error: errorMsg,
      duration,
      logs,
    };
  }
}

/**
 * Validate node inputs against defined schema
 */
function validateNodeInputs(
  node: AgentNode,
  previousOutputs: Map<string, any>,
  globalContext: Record<string, any> = {},
  environment: Record<string, string> = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [inputName, inputSchema] of Object.entries(node.inputs)) {
    const required = (inputSchema as any).required !== false;

    // Check if input is provided
    let hasInput = false;

    // Check for exact match from previous nodes
    if (previousOutputs.has(inputName)) {
      hasInput = true;
    }

    // Check for contextual match (partial name)
    for (const [key, value] of previousOutputs) {
      if (key.toLowerCase().includes(inputName.toLowerCase()) && value !== undefined) {
        hasInput = true;
        break;
      }
    }

    // Check in global context
    if (!hasInput && globalContext[inputName] !== undefined) {
      hasInput = true;
    }

    // Check in environment
    if (!hasInput && environment[inputName] !== undefined) {
      hasInput = true;
    }

    // Final fuzzy check in global context/environment
    if (!hasInput) {
      for (const key of [...Object.keys(globalContext), ...Object.keys(environment)]) {
        if (key.toLowerCase().includes(inputName.toLowerCase())) {
          hasInput = true;
          break;
        }
      }
    }

    if (required && !hasInput) {
      // Special case: if this is a starting node (no dependencies) and we have a goal, 
      // we can consider the goal as a universal input provider.
      if (node.dependencies.length === 0 && globalContext['workflow_goal']) {
        console.log(`[NodeExecutor] Mapping workflow_goal to missing input "${inputName}" for starting node`);
        hasInput = true;
      } else {
        errors.push(`Required input "${inputName}" not provided`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Prepare node inputs by collecting from previous outputs
 */
function prepareNodeInputs(
  node: AgentNode,
  previousOutputs: Map<string, any>,
  globalContext: Record<string, any> = {},
  environment: Record<string, string> = {}
): Record<string, any> {
  const inputs: Record<string, any> = {};

  for (const [inputName] of Object.entries(node.inputs)) {
    // Direct match
    if (previousOutputs.has(inputName)) {
      inputs[inputName] = previousOutputs.get(inputName);
    } else {
      // Contextual match
      for (const [key, value] of previousOutputs) {
        if (key.toLowerCase().includes(inputName.toLowerCase())) {
          inputs[inputName] = value;
          break;
        }
      }
    }

    // Fallback to global context
    if (inputs[inputName] === undefined) {
      if (globalContext[inputName] !== undefined) {
        inputs[inputName] = globalContext[inputName];
      } else {
        // Fuzzy match in global context
        for (const [key, value] of Object.entries(globalContext)) {
          if (key.toLowerCase().includes(inputName.toLowerCase())) {
            inputs[inputName] = value;
            break;
          }
        }
      }
    }

    // Fallback to environment
    if (inputs[inputName] === undefined) {
      if (environment[inputName] !== undefined) {
        inputs[inputName] = environment[inputName];
      } else {
        // Fuzzy match in environment
        for (const [key, value] of Object.entries(environment)) {
          if (key.toLowerCase().includes(inputName.toLowerCase())) {
            inputs[inputName] = value;
            break;
          }
        }
      }
    }

    // Final fallback for starting nodes: use workflow_goal
    if (inputs[inputName] === undefined && node.dependencies.length === 0) {
      inputs[inputName] = globalContext['workflow_goal'];
    }
  }

  return inputs;
}

/**
 * Build system prompt for node execution
 */
function buildNodeSystemPrompt(
  node: AgentNode,
  inputs: Record<string, any>,
  context: NodeExecutionContext
): string {
  let prompt = `You are a specialized agent with the following role and responsibilities:

Role: ${node.role}
Task: ${node.task}

${node.systemPrompt ? `System Instructions:\n${node.systemPrompt}\n` : ''}

Available Inputs:
${Object.entries(inputs)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Expected Outputs:
${Object.entries(node.outputs)
  .map(([key, schema]: [string, any]) => `- ${key} (${schema.type}): ${schema.description || 'output'}`)
  .join('\n')}

${
  node.expectedOutputFormat
    ? `\nExpected Output Format:\n${JSON.stringify(node.expectedOutputFormat, null, 2)}`
    : ''
}

${
  node.successCriteria && node.successCriteria.length > 0
    ? `\nSuccess Criteria:\n${node.successCriteria.map((c: string) => `- ${c}`).join('\n')}`
    : ''
}

${
  node.tools && node.tools.length > 0
    ? `\nAvailable Tools:\n${node.tools.map((t: any) => `- ${t.name}: ${t.description}`).join('\n')}`
    : ''
}

Complete your task and provide a clear, well-structured response that matches the expected outputs.`;

  return prompt;
}

/**
 * Parse node output from AI response
 */
function parseNodeOutput(node: AgentNode, response: string): Record<string, any> {
  const output: Record<string, any> = {};

  // Try to parse JSON if expected format is JSON
  if (node.expectedOutputFormat?.type === 'json') {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('[NodeExecutor] Failed to parse JSON from response, using text');
    }
  }

  // Default: map response to outputs
  for (const [outputName, outputSchema] of Object.entries(node.outputs)) {
    const type = (outputSchema as any).type || 'string';

    if (type === 'string') {
      output[outputName] = response;
    } else if (type === 'array') {
      // Try to extract array from response
      output[outputName] = [response];
    } else if (type === 'object') {
      // Try to parse as object
      try {
        const match = response.match(/\{[\s\S]*\}/);
        output[outputName] = match ? JSON.parse(match[0]) : { value: response };
      } catch {
        output[outputName] = { value: response };
      }
    } else {
      output[outputName] = response;
    }
  }

  return output;
}

/**
 * Validate node output against defined schema
 */
function validateNodeOutput(
  node: AgentNode,
  output: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [outputName, outputSchema] of Object.entries(node.outputs)) {
    const type = (outputSchema as any).type;
    const value = output[outputName];

    if (value === undefined) {
      errors.push(`Missing required output: ${outputName}`);
      continue;
    }

    // Type checking
    if (type === 'string' && typeof value !== 'string') {
      errors.push(`Output ${outputName} should be string, got ${typeof value}`);
    } else if (type === 'array' && !Array.isArray(value)) {
      errors.push(`Output ${outputName} should be array, got ${typeof value}`);
    } else if (type === 'object' && typeof value !== 'object') {
      errors.push(`Output ${outputName} should be object, got ${typeof value}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Log node execution for debugging
 */
export function logNodeExecution(result: NodeExecutionResult): string {
  const status = result.success ? '✓' : '✗';
  const duration = `${result.duration}ms`;

  let log = `${status} Node ${result.nodeId} (${duration})`;

  if (result.error) {
    log += `\n  Error: ${result.error}`;
  }

  if (result.output) {
    log += `\n  Output: ${JSON.stringify(result.output).substring(0, 100)}...`;
  }

  return log;
}

/**
 * Compose node outputs into workflow context
 */
export function composeOutputs(
  results: Map<string, NodeExecutionResult>
): Map<string, any> {
  const outputs = new Map<string, any>();

  for (const [nodeId, result] of results) {
    if (result.success && result.output) {
      // Add each output key
      for (const [key, value] of Object.entries(result.output)) {
        outputs.set(key, value);
        // Also store with node prefix for clarity
        outputs.set(`${nodeId}/${key}`, value);
      }
    }
  }

  return outputs;
}
