/**
 * Execution Planner
 * Plans workflow execution, handles retries, parallel execution, and dependency resolution
 */

import {
  Workflow,
  AgentNode,
  ExecutionState,
  NodeExecution,
} from '@/types/agent';
import { topologicalSort, validateWorkflow } from './workflow-utils';

export interface ExecutionPlan {
  workflowId: string;
  executionId: string;
  stages: ExecutionStage[];
  totalNodes: number;
  parallelCapacity: number;
  estimatedDuration: number;
  criticalPath: string[]; // Longest dependency chain
}

export interface ExecutionStage {
  stageNumber: number;
  nodeIds: string[]; // Nodes that can run in parallel
  dependencies: string[]; // All nodes that must complete before this stage
}

/**
 * Plan workflow execution with parallel stages
 */
export function planExecution(
  workflow: Workflow,
  executionId: string,
  parallelCapacity: number = 4
): ExecutionPlan {
  // Validate workflow first
  const validation = validateWorkflow(workflow);
  if (!validation.valid) {
    throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
  }

  // Get topological sort for execution order
  const executionOrder = workflow.executionOrder;

  // Build stages for parallel execution
  const edges = workflow.edges.map(e => [e.from, e.to] as [string, string]);
  const stages = buildExecutionStages(
    workflow.nodes,
    edges,
    parallelCapacity
  );

  // Calculate critical path (longest dependency chain)
  const criticalPath = calculateCriticalPath(workflow.nodes, edges);

  // Estimate duration (rough: 2s per node + dependencies)
  const estimatedDuration = criticalPath.length * 2000 + 1000;

  return {
    workflowId: workflow.id,
    executionId,
    stages,
    totalNodes: workflow.nodes.length,
    parallelCapacity,
    estimatedDuration,
    criticalPath,
  };
}

/**
 * Build execution stages for parallel execution
 */
function buildExecutionStages(
  nodes: AgentNode[],
  edges: Array<[string, string]>,
  maxParallel: number
): ExecutionStage[] {
  const stages: ExecutionStage[] = [];
  const completed = new Set<string>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  while (completed.size < nodes.length) {
    // Find nodes ready to run (all dependencies satisfied)
    const readyNodes = nodes
      .filter(node => !completed.has(node.id))
      .filter(node => {
        const deps = node.dependencies || [];
        return deps.every(dep => completed.has(dep));
      })
      .slice(0, maxParallel);

    if (readyNodes.length === 0) {
      // Shouldn't happen if workflow is valid
      throw new Error('Execution deadlock: no nodes ready to run');
    }

    const stage: ExecutionStage = {
      stageNumber: stages.length + 1,
      nodeIds: readyNodes.map(n => n.id),
      dependencies: Array.from(completed),
    };

    stages.push(stage);
    readyNodes.forEach(n => completed.add(n.id));
  }

  return stages;
}

/**
 * Calculate critical path (longest dependency chain)
 */
function calculateCriticalPath(
  nodes: AgentNode[],
  edges: Array<[string, string]>
): string[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Find all paths from nodes with no dependencies to nodes with no dependents
  const rootNodes = nodes.filter((n: AgentNode) => !n.dependencies || n.dependencies.length === 0);
  const leafNodes = nodes.filter(n => {
    const hasDependent = nodes.some(other => {
      const deps = other.dependencies || [];
      return deps.includes(n.id);
    });
    return !hasDependent;
  });

  let longestPath: string[] = [];

  // DFS from each root to find longest path
  const dfs = (nodeId: string, path: string[]): string[] => {
    const currentPath = [...path, nodeId];

    const node = nodeMap.get(nodeId);
    if (!node) return currentPath;

    // Find all nodes that depend on this one
    const dependents = nodes.filter(n => {
      const deps = n.dependencies || [];
      return deps.includes(nodeId);
    });

    if (dependents.length === 0) {
      // Leaf node
      return currentPath.length > longestPath.length ? currentPath : longestPath;
    }

    for (const dependent of dependents) {
      const resultPath = dfs(dependent.id, currentPath);
      if (resultPath.length > longestPath.length) {
        longestPath = resultPath;
      }
    }

    return longestPath;
  };

  for (const root of rootNodes) {
    dfs(root.id, []);
  }

  return longestPath.length > 0 ? longestPath : [nodes[0]?.id].filter(Boolean);
}

/**
 * Get next stage to execute
 */
export function getNextStage(
  plan: ExecutionPlan,
  executionState: ExecutionState
): ExecutionStage | null {
  // Find first incomplete stage
  for (const stage of plan.stages) {
    const stageComplete = stage.nodeIds.every(
      nodeId => executionState.nodeStates[nodeId]?.status === 'success'
    );

    if (!stageComplete) {
      // Check if all dependencies are satisfied
      const dependenciesSatisfied = stage.dependencies.every(
        depId => executionState.nodeStates[depId]?.status === 'success'
      );

      if (dependenciesSatisfied) {
        return stage;
      }
    }
  }

  return null;
}

/**
 * Check if execution plan is complete
 */
export function isPlanComplete(
  plan: ExecutionPlan,
  executionState: ExecutionState
): boolean {
  return plan.stages.every(stage =>
    stage.nodeIds.every(
      nodeId => executionState.nodeStates[nodeId]?.status === 'success'
    )
  );
}

/**
 * Get execution progress
 */
export function getExecutionProgress(
  plan: ExecutionPlan,
  executionState: ExecutionState
): {
  completed: number;
  total: number;
  percentage: number;
  currentStage: number;
  totalStages: number;
} {
  const completed = Object.values(executionState.nodeStates).filter(
    (ns: any) => ns.status === 'success'
  ).length;

  const currentStageIndex = plan.stages.findIndex(stage =>
    stage.nodeIds.every(
      nodeId => executionState.nodeStates[nodeId]?.status === 'success'
    )
  );

  return {
    completed,
    total: plan.totalNodes,
    percentage: Math.round((completed / plan.totalNodes) * 100),
    currentStage: currentStageIndex + 1,
    totalStages: plan.stages.length,
  };
}

/**
 * Retry node with exponential backoff
 */
export function shouldRetryNode(
  nodeExecution: NodeExecution,
  maxRetries: number = 3
): boolean {
  return (
    nodeExecution.status === 'failed' &&
    nodeExecution.retryCount < maxRetries &&
    nodeExecution.error?.code !== 'FATAL_ERROR'
  );
}

export function getRetryDelay(retryCount: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  return Math.min(1000 * Math.pow(2, retryCount), 30000);
}

/**
 * Check if execution is in a failed state
 */
export function isExecutionFailed(executionState: ExecutionState): boolean {
  return Object.values(executionState.nodeStates).some(
    (ns: any) => ns.status === 'failed'
  );
}

/**
 * Get nodes that failed critical dependencies
 */
export function getFailedDependencyNodes(
  executionState: ExecutionState,
  nodes: AgentNode[]
): AgentNode[] {
  const failedNodeIds = new Set(
    Object.entries(executionState.nodeStates)
      .filter(([_, state]: [string, any]) => state.status === 'failed')
      .map(([nodeId, _]: [string, any]) => nodeId)
  );

  return nodes.filter(node => {
    const deps = node.dependencies || [];
    return deps.some(depId => failedNodeIds.has(depId));
  });
}

/**
 * Format execution plan for logging
 */
export function formatExecutionPlan(plan: ExecutionPlan): string {
  const stagesSummary = plan.stages
    .map(
      (s, i) =>
        `Stage ${i + 1}: [${s.nodeIds.join(', ')}] (depends on: ${s.dependencies.length} nodes)`
    )
    .join('\n');

  return `
Execution Plan for ${plan.workflowId}:
- Total Nodes: ${plan.totalNodes}
- Total Stages: ${plan.stages.length}
- Parallel Capacity: ${plan.parallelCapacity}
- Estimated Duration: ${plan.estimatedDuration}ms
- Critical Path: ${plan.criticalPath.join(' → ')}

Stages:
${stagesSummary}
`;
}
