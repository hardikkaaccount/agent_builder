/**
 * Workflow Utilities
 * Helper functions for workflow creation, validation, and manipulation
 */

import {
  Workflow,
  AgentNode,
  WorkflowEdge,
  WorkflowValidationError,
  NodeStatus,
} from '@/types/agent';

/**
 * Validate workflow for structural integrity
 */
export function validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check nodes exist
  if (!workflow.nodes || workflow.nodes.length === 0) {
    errors.push('Workflow must have at least one node');
  }

  // Check for cycles using DFS
  if (hasCycle(workflow.nodes, workflow.edges)) {
    errors.push('Workflow contains circular dependencies');
  }

  // Check all dependencies are resolvable
  const nodeIds = new Set(workflow.nodes.map(n => n.id));
  for (const node of workflow.nodes) {
    for (const dep of node.dependencies) {
      if (!nodeIds.has(dep)) {
        errors.push(`Node "${node.name}" depends on non-existent node "${dep}"`);
      }
    }
  }

  // Check edges reference valid nodes
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references non-existent source node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references non-existent target node: ${edge.to}`);
    }
  }

  // Validate execution order (topological sort)
  const sorted = topologicalSort(workflow.nodes, workflow.edges);
  if (!sorted) {
    errors.push('Cannot determine valid execution order (might contain cycles)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if workflow has cycles using DFS
 */
function hasCycle(nodes: AgentNode[], edges: WorkflowEdge[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    // Get all outgoing edges
    const outgoing = edges
      .filter(e => e.from === nodeId)
      .map(e => e.to);

    for (const neighbor of outgoing) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true; // Cycle detected
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Topological sort for workflow execution order
 */
export function topologicalSort(
  nodes: AgentNode[],
  edges: WorkflowEdge[]
): string[] | null {
  const nodeIds = new Set(nodes.map(n => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build adjacency list and calculate in-degrees
  for (const edge of edges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      const current = inDegree.get(edge.to) || 0;
      inDegree.set(edge.to, current + 1);
      
      const adj = adjacency.get(edge.from) || [];
      adj.push(edge.to);
      adjacency.set(edge.from, adj);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const neighbor of adjacency.get(node) || []) {
      const degree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, degree);
      
      if (degree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check if all nodes were processed
  if (result.length !== nodes.length) {
    return null; // Cycle detected
  }

  return result;
}

/**
 * Calculate workflow complexity based on structure
 */
export function calculateComplexity(
  nodeCount: number,
  edgeCount: number,
  maxDependencies: number
): 'simple' | 'moderate' | 'complex' {
  // Simple: 1-3 nodes, linear
  if (nodeCount <= 3 && edgeCount <= nodeCount - 1) {
    return 'simple';
  }

  // Complex: 8+ nodes or high branching
  if (nodeCount >= 8 || maxDependencies >= 4) {
    return 'complex';
  }

  // Moderate: everything else
  return 'moderate';
}

/**
 * Generate unique node ID
 */
export function generateNodeId(prefix: string = 'node'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate unique workflow ID
 */
export function generateWorkflowId(prefix: string = 'workflow'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Get node by ID from workflow
 */
export function getNode(workflow: Workflow, nodeId: string): AgentNode | undefined {
  return workflow.nodes.find(n => n.id === nodeId);
}

/**
 * Get all dependencies of a node (recursive)
 */
export function getNodeDependencies(
  workflow: Workflow,
  nodeId: string,
  visited = new Set<string>()
): AgentNode[] {
  const node = getNode(workflow, nodeId);
  if (!node) return [];

  const deps: AgentNode[] = [];
  const toVisit = [...node.dependencies];

  while (toVisit.length > 0) {
    const depId = toVisit.shift()!;
    if (visited.has(depId)) continue;

    visited.add(depId);
    const depNode = getNode(workflow, depId);
    if (depNode) {
      deps.push(depNode);
      toVisit.push(...depNode.dependencies);
    }
  }

  return deps;
}

/**
 * Get all nodes that depend on a given node (reverse dependencies)
 */
export function getDependentNodes(
  workflow: Workflow,
  nodeId: string
): AgentNode[] {
  return workflow.nodes.filter(n =>
    n.dependencies.includes(nodeId)
  );
}

/**
 * Format workflow for API response
 */
export function formatWorkflowResponse(workflow: Workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    goal: workflow.goal,
    nodeCount: workflow.nodeCount,
    complexity: workflow.complexity,
    status: workflow.status,
    createdAt: workflow.createdAt,
    nodes: workflow.nodes.map(n => ({
      id: n.id,
      name: n.name,
      role: n.role,
      task: n.task,
      dependencies: n.dependencies,
    })),
  };
}

/**
 * Clone workflow with new ID (for templates)
 */
export function cloneWorkflow(workflow: Workflow, newName: string): Workflow {
  const cloned = JSON.parse(JSON.stringify(workflow));
  cloned.id = generateWorkflowId();
  cloned.name = newName;
  cloned.createdAt = new Date();
  cloned.updatedAt = new Date();
  cloned.version = 1;
  return cloned;
}

/**
 * Count status occurrences in nodes
 */
export function countNodesByStatus(
  statuses: Record<string, NodeStatus>
): Record<NodeStatus, number> {
  const counts: Record<NodeStatus, number> = {
    pending: 0,
    running: 0,
    testing: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    retrying: 0,
  };

  for (const status of Object.values(statuses)) {
    counts[status]++;
  }

  return counts;
}

/**
 * Add a new node to the workflow
 */
export function addNodeToWorkflow(workflow: Workflow, node: Partial<AgentNode>): Workflow {
  const newNode: AgentNode = {
    id: node.id || generateNodeId(),
    name: node.name || 'New Agent',
    description: node.description || '',
    role: node.role || 'worker',
    task: node.task || 'New task description',
    inputs: node.inputs || {},
    outputs: node.outputs || {},
    dependencies: node.dependencies || [],
    environment: node.environment || {},
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...node,
  };

  const newNodes = [...workflow.nodes, newNode];
  const newEdges = [
    ...workflow.edges,
    ...newNode.dependencies.map(dep => ({ from: dep, to: newNode.id })),
  ];

  return {
    ...workflow,
    nodes: newNodes,
    edges: newEdges,
    nodeCount: newNodes.length,
    edgeCount: newEdges.length,
    executionOrder: topologicalSort(newNodes, newEdges) || newNodes.map(n => n.id),
    updatedAt: new Date(),
  };
}

/**
 * Update an existing node in the workflow
 */
export function updateNodeInWorkflow(workflow: Workflow, nodeId: string, updates: Partial<AgentNode>): Workflow {
  const nodeIndex = workflow.nodes.findIndex(n => n.id === nodeId);
  if (nodeIndex === -1) return workflow;

  const oldNode = workflow.nodes[nodeIndex];
  const newNode = { ...oldNode, ...updates, updatedAt: new Date() };
  
  const newNodes = [...workflow.nodes];
  newNodes[nodeIndex] = newNode;

  // Rebuild edges if dependencies changed
  let newEdges = workflow.edges;
  if (updates.dependencies) {
    // Remove old edges targeting this node
    newEdges = newEdges.filter(e => e.to !== nodeId);
    // Add new edges
    newEdges = [
      ...newEdges,
      ...updates.dependencies.map(dep => ({ from: dep, to: nodeId })),
    ];
  }

  return {
    ...workflow,
    nodes: newNodes,
    edges: newEdges,
    edgeCount: newEdges.length,
    executionOrder: topologicalSort(newNodes, newEdges) || newNodes.map(n => n.id),
    updatedAt: new Date(),
  };
}

/**
 * Remove a node from the workflow
 */
export function removeNodeFromWorkflow(workflow: Workflow, nodeId: string): Workflow {
  const newNodes = workflow.nodes.filter(n => n.id !== nodeId);
  
  // Remove edges connected to this node
  const newEdges = workflow.edges.filter(e => e.from !== nodeId && e.to !== nodeId);

  // Remove this node from other nodes' dependencies
  const cleanedNodes = newNodes.map(n => {
    if (n.dependencies.includes(nodeId)) {
      return {
        ...n,
        dependencies: n.dependencies.filter(d => d !== nodeId),
      };
    }
    return n;
  });

  return {
    ...workflow,
    nodes: cleanedNodes,
    edges: newEdges,
    nodeCount: cleanedNodes.length,
    edgeCount: newEdges.length,
    executionOrder: topologicalSort(cleanedNodes, newEdges) || cleanedNodes.map(n => n.id),
    updatedAt: new Date(),
  };
}
