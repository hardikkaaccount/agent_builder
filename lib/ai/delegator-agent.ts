/**
 * Delegator Agent
 * Refines master-generated workflows, optimizes performance, and prepares for execution
 */

import {
  Workflow,
  AgentNode,
} from '@/types/agent';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

export interface DelegationRequest {
  workflow: Workflow;
  constraints?: {
    maxParallelNodes?: number;
    maxDuration?: number;
    priorityNodes?: string[];
    avoidNodes?: string[];
  };
  preferences?: {
    costOptimization?: 'low' | 'medium' | 'high';
    speedOptimization?: 'low' | 'medium' | 'high';
    reliabilityOptimization?: 'low' | 'medium' | 'high';
  };
}

export interface DelegationResult {
  workflow: Workflow;
  optimizations: string[];
  reasoning: string;
  confidence: number;
  nodeAssignments: Record<string, {
    expectedDuration: number;
    complexity: number;
    priority: number;
  }>;
}

const DELEGATOR_SYSTEM_PROMPT = `You are a Delegator Agent specialized in workflow refinement and optimization.

Your role:
1. Analyze the provided workflow DAG
2. Optimize node execution order for performance
3. Assign complexity scores and priority levels
4. Identify parallelization opportunities
5. Detect potential bottlenecks
6. Prepare workflow for execution

Guidelines:
- Maximize parallelization while respecting dependencies
- Consider resource constraints
- Balance speed vs. reliability trade-offs
- Identify critical path and optimize for it
- Generate actionable optimizations

Output Format (JSON):
{
  "optimizations": [
    "Optimization 1",
    "Optimization 2",
    ...
  ],
  "nodeAssignments": {
    "node_id": {
      "expectedDuration": 2000,
      "complexity": "medium",
      "priority": 1
    },
    ...
  },
  "bottlenecks": [
    "Description of bottleneck",
    ...
  ],
  "parallelizationOpportunities": [
    "Description of opportunity",
    ...
  ],
  "reasoning": "Overall strategy and reasoning"
}`;

/**
 * Delegate workflow refinement to AI
 */
export async function delegateWorkflow(
  request: DelegationRequest
): Promise<DelegationResult> {
  const workflow = request.workflow;

  // Build prompt
  const constraintText = request.constraints
    ? `
Constraints:
- Max parallel nodes: ${request.constraints.maxParallelNodes || 'unlimited'}
- Max duration: ${request.constraints.maxDuration || 'unlimited'}ms
- Priority nodes: ${request.constraints.priorityNodes?.join(', ') || 'none'}
- Avoid nodes: ${request.constraints.avoidNodes?.join(', ') || 'none'}
`
    : '';

  const preferencesText = request.preferences
    ? `
Preferences:
- Cost optimization: ${request.preferences.costOptimization || 'balanced'}
- Speed optimization: ${request.preferences.speedOptimization || 'balanced'}
- Reliability optimization: ${request.preferences.reliabilityOptimization || 'balanced'}
`
    : '';

  const prompt = `
Analyze and optimize the following workflow:

Workflow: ${workflow.name}
Goal: ${workflow.goal}
Nodes: ${workflow.nodes.length}
Edges: ${workflow.edges.length}

Nodes Details:
${workflow.nodes
  .map(
    n => `
- ID: ${n.id}
  Name: ${n.name}
  Role: ${n.role}
  Task: ${n.task}
  Dependencies: ${n.dependencies.join(', ') || 'none'}
  Model: ${n.model}
`
  )
  .join('\n')}

Edges:
${workflow.edges.map(e => `${e.from} → ${e.to}`).join('\n')}

${constraintText}
${preferencesText}

Optimize this workflow for execution. Consider:
1. Critical path analysis
2. Parallelization opportunities
3. Resource allocation
4. Potential bottlenecks
5. Execution efficiency

Provide detailed analysis and optimizations.`;

  try {
    console.log('[DelegatorAgent] Starting workflow delegation analysis');

    const model = bedrock('bedrock/us.amazon.nova-pro-v1:0');

    const response = await generateText({
      model,
      system: DELEGATOR_SYSTEM_PROMPT,
      prompt,
      temperature: 0.7,
    });

    console.log('[DelegatorAgent] Analysis complete');

    // Parse response
    const responseText = response.text;

    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse delegator response as JSON');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Build node assignments
    const nodeAssignments: Record<string, any> = {};
    for (const node of workflow.nodes) {
      const assignedNode = analysis.nodeAssignments?.[node.id];
      nodeAssignments[node.id] = {
        expectedDuration: assignedNode?.expectedDuration || 2000,
        complexity: assignedNode?.complexity || 'medium',
        priority: assignedNode?.priority || 1,
      };
    }

    return {
      workflow,
      optimizations: analysis.optimizations || [],
      reasoning: analysis.reasoning || 'Workflow analyzed and optimized',
      confidence: 0.85,
      nodeAssignments,
    };
  } catch (error: any) {
    console.error('[DelegatorAgent] Error:', error);
    throw new Error(`Delegation failed: ${error.message}`);
  }
}

/**
 * Validate delegated workflow
 */
export function validateDelegation(result: DelegationResult): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check all nodes have assignments
  for (const node of result.workflow.nodes) {
    if (!result.nodeAssignments[node.id]) {
      warnings.push(`Node ${node.id} missing assignment`);
    }
  }

  // Check for unrealistic durations
  for (const [nodeId, assignment] of Object.entries(result.nodeAssignments)) {
    if (assignment.expectedDuration < 100) {
      warnings.push(`Node ${nodeId} has unrealistically short duration`);
    }
    if (assignment.expectedDuration > 300000) {
      warnings.push(`Node ${nodeId} has very long expected duration`);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Calculate total estimated time from delegated results
 */
export function calculateDelegatedDuration(result: DelegationResult): number {
  const nodes = result.workflow.nodes;
  const edges = result.workflow.edges;

  // Find critical path
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const durations = new Map(
    Object.entries(result.nodeAssignments).map(([id, info]: [string, any]) => [
      id,
      info.expectedDuration,
    ])
  );

  let criticalDuration = 0;

  // DFS to find longest path
  const visited = new Set<string>();

  const dfs = (nodeId: string): number => {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    const duration = durations.get(nodeId) || 2000;

    if (!node || node.dependencies.length === 0) {
      return duration;
    }

    let maxDependencyDuration = 0;
    for (const depId of node.dependencies) {
      const depDuration = dfs(depId);
      maxDependencyDuration = Math.max(maxDependencyDuration, depDuration);
    }

    return duration + maxDependencyDuration;
  };

  for (const node of nodes) {
    visited.clear();
    const pathDuration = dfs(node.id);
    criticalDuration = Math.max(criticalDuration, pathDuration);
  }

  return criticalDuration;
}
