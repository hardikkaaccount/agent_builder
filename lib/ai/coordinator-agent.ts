/**
 * Coordinator Agent
 * Monitors workflow execution, handles failures, and coordinates recovery
 */

import {
  Workflow,
  ExecutionState,
  NodeExecution,
} from '@/types/agent';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

export interface CoordinationRequest {
  workflow: Workflow;
  executionState: ExecutionState;
  failedNodeIds?: string[];
  logs?: string[];
}

export interface CoordinationResult {
  action: 'continue' | 'retry' | 'skip' | 'adjust' | 'abort';
  targetNodeId?: string;
  adjustments?: Record<string, any>;
  reasoning: string;
  confidence: number;
}

const COORDINATOR_SYSTEM_PROMPT = `You are a Coordinator Agent specialized in workflow execution management.

Your role:
1. Monitor workflow execution state
2. Detect failures and performance issues
3. Recommend recovery strategies
4. Coordinate node retries and adjustments
5. Manage execution flow dynamically

Guidelines:
- Prioritize execution completion
- Balance retry attempts vs. failure acceptance
- Recommend retries for transient failures
- Skip optional nodes on system failures
- Abort only on critical, unrecoverable errors
- Consider dependencies when making decisions

Decision Logic:
- Network/timeout errors → RETRY (backoff)
- Missing resources → SKIP (if optional) or ADJUST
- Data validation errors → RETRY with adjustment
- Critical dependency failure → ABORT
- Success path clear → CONTINUE

Output Format (JSON):
{
  "action": "continue|retry|skip|adjust|abort",
  "targetNodeId": "node_id_to_act_on",
  "adjustments": {
    "model": "alternative_model",
    "timeout": 90000,
    ...
  },
  "reasoning": "Detailed reasoning for action"
}`;

/**
 * Coordinate workflow execution
 */
export async function coordinateExecution(
  request: CoordinationRequest
): Promise<CoordinationResult> {
  const { workflow, executionState, failedNodeIds = [], logs = [] } = request;

  // Get failed nodes details
  const failedNodes = workflow.nodes.filter(n => failedNodeIds.includes(n.id));
  const completedNodes = Object.entries(executionState.nodeStates)
    .filter(([_, state]: [string, any]) => state.status === 'success' || state.status === 'completed')
    .map(([id]) => id);

  // Find blocking nodes
  const blockingNodes = workflow.nodes.filter(n => {
    const deps = n.dependencies || [];
    return deps.some(d => failedNodeIds.includes(d));
  });

  const prompt = `
Current Workflow Execution Status:

Workflow: ${workflow.name}
Total Nodes: ${workflow.nodes.length}
Completed: ${completedNodes.length}
Failed: ${failedNodeIds.length}
Blocked: ${blockingNodes.length}

Failed Nodes:
${failedNodes
  .map(
    n => `
- ID: ${n.id}
  Name: ${n.name}
  Task: ${n.task}
  skipOnFailure: ${n.skipOnFailure}
`
  )
  .join('\n')}

Blocked Nodes (waiting on failed):
${blockingNodes
  .map(
    n => `
- ID: ${n.id}
  Name: ${n.name}
  Dependencies: ${n.dependencies.join(', ')}
`
  )
  .join('\n')}

Recent Logs:
${logs.slice(-10).join('\n')}

Execution State:
- Nodes Completed: ${executionState.nodesCompleted}
- Nodes Failed: ${executionState.nodesFailed}
- Progress: ${Math.round((executionState.nodesCompleted / workflow.nodes.length) * 100)}%

Analyze current state and recommend next action:
1. Should we retry failed nodes?
2. Should we skip them?
3. Should we adjust execution parameters?
4. Should we continue with unaffected nodes?
5. Is this fatal enough to abort?

Consider:
- Node skipOnFailure setting
- Impact on downstream nodes
- Total execution progress
- Error severity from logs`;

  try {
    console.log('[CoordinatorAgent] Starting execution coordination');

    const model = bedrock('bedrock/us.amazon.nova-pro-v1:0');

    const response = await generateText({
      model,
      system: COORDINATOR_SYSTEM_PROMPT,
      prompt,
      temperature: 0.6,
    });

    console.log('[CoordinatorAgent] Coordination decision made');

    // Parse response
    const responseText = response.text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to parse coordinator response');
    }

    const decision = JSON.parse(jsonMatch[0]);

    return {
      action: decision.action || 'continue',
      targetNodeId: decision.targetNodeId,
      adjustments: decision.adjustments,
      reasoning: decision.reasoning || 'Execution coordination decision',
      confidence: 0.8,
    };
  } catch (error: any) {
    console.error('[CoordinatorAgent] Error:', error);
    
    // Default: skip if optional, else abort
    if (failedNodes.length > 0 && failedNodes[0].skipOnFailure) {
      return {
        action: 'skip',
        targetNodeId: failedNodes[0].id,
        reasoning: `Default decision: skip optional node (${failedNodes[0].name})`,
        confidence: 0.5,
      };
    }

    return {
      action: 'abort',
      reasoning: `Coordination failure: ${error.message}`,
      confidence: 0.3,
    };
  }
}

/**
 * Analyze execution metrics
 */
export function analyzeExecution(executionState: ExecutionState): {
  successRate: number;
  avgNodeDuration: number;
  bottlenecks: string[];
  recommendations: string[];
} {
  const totalNodes = Object.keys(executionState.nodeStates).length;
  const successfulNodes = executionState.nodesCompleted || 0;
  const failedNodes = executionState.nodesFailed || 0;

  const successRate = (successfulNodes / totalNodes) * 100;

  // Calculate average duration
  let totalDuration = 0;
  let nodeCount = 0;

  for (const state of Object.values(executionState.nodeStates)) {
    const nodeState = state as any;
    if (nodeState.duration) {
      totalDuration += nodeState.duration;
      nodeCount++;
    }
  }

  const avgNodeDuration = nodeCount > 0 ? totalDuration / nodeCount : 0;

  // Identify bottlenecks
  const bottlenecks: string[] = [];
  const recommendations: string[] = [];

  if (successRate < 50) {
    bottlenecks.push('High failure rate detected');
    recommendations.push('Review node configurations and error logs');
  }

  if (avgNodeDuration > 10000) {
    bottlenecks.push('Slow node execution detected');
    recommendations.push('Consider increasing timeout or optimizing node tasks');
  }

  if (failedNodes > 0 && successRate > 80) {
    recommendations.push('Most nodes succeeded despite some failures - consider skip strategy');
  }

  return {
    successRate,
    avgNodeDuration,
    bottlenecks,
    recommendations,
  };
}

/**
 * Determine if execution is recoverable
 */
export function isRecoverable(
  workflow: Workflow,
  executionState: ExecutionState,
  failedNodeIds: string[]
): boolean {
  // Get all nodes that depend on failed nodes
  const affectedNodes = new Set<string>();

  for (const failedId of failedNodeIds) {
    const failedNode = workflow.nodes.find(n => n.id === failedId);
    if (!failedNode) continue;

    // If failed node is marked as skip on failure
    if (failedNode.skipOnFailure) {
      continue;
    }

    // Find all nodes that depend on this one
    for (const node of workflow.nodes) {
      const deps = node.dependencies || [];
      if (deps.includes(failedId)) {
        affectedNodes.add(node.id);
      }
    }
  }

  // If all affected nodes can be skipped, it's recoverable
  const requiresBlocked = Array.from(affectedNodes).some(
    id => !workflow.nodes.find(n => n.id === id)?.skipOnFailure
  );

  return !requiresBlocked;
}
