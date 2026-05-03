/**
 * Workflow Store - In-Memory Implementation
 * File-backed persistence layer with an in-memory cache
 */

import fs from 'fs';
import path from 'path';
import { Workflow, ExecutionState } from '@/types/agent';

// ============================================================================
// IN-MEMORY STORES
// ============================================================================

// Global stores (will persist during server lifetime)
const workflows = new Map<string, Workflow>();
const executions = new Map<string, ExecutionState>();
const dataDir = path.join(process.cwd(), '.open-lovable-data');
const storePath = path.join(dataDir, 'agent-store.json');
let storeLoaded = false;

type PersistedStore = {
  workflows: Workflow[];
  executions: ExecutionState[];
};

function ensureDataDir(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function reviveDate(value: any): Date {
  return value ? new Date(value) : new Date();
}

function reviveLogEntry(entry: any) {
  return {
    ...entry,
    timestamp: reviveDate(entry.timestamp),
  };
}

function reviveNodeExecution(entry: any) {
  return {
    ...entry,
    startTime: entry.startTime ? reviveDate(entry.startTime) : undefined,
    endTime: entry.endTime ? reviveDate(entry.endTime) : undefined,
    logs: Array.isArray(entry.logs) ? entry.logs.map(reviveLogEntry) : [],
    testResults: Array.isArray(entry.testResults)
      ? entry.testResults.map((result: any) => ({
          ...result,
          timestamp: reviveDate(result.timestamp),
        }))
      : undefined,
  };
}

function reviveWorkflow(workflow: any): Workflow {
  return {
    ...workflow,
    createdAt: reviveDate(workflow.createdAt),
    updatedAt: reviveDate(workflow.updatedAt),
    nodes: Array.isArray(workflow.nodes)
      ? workflow.nodes.map((node: any) => ({
          ...node,
          createdAt: reviveDate(node.createdAt),
          updatedAt: reviveDate(node.updatedAt),
        }))
      : [],
  };
}

function reviveExecution(execution: any): ExecutionState {
  const nodeStates: Record<string, any> = {};
  for (const [nodeId, state] of Object.entries(execution.nodeStates || {})) {
    nodeStates[nodeId] = reviveNodeExecution(state);
  }

  return {
    ...execution,
    startTime: reviveDate(execution.startTime),
    endTime: execution.endTime ? reviveDate(execution.endTime) : undefined,
    nodeStates,
    logs: Array.isArray(execution.logs) ? execution.logs.map(reviveLogEntry) : [],
  };
}

function loadStoreFromDisk(): void {
  if (storeLoaded) return;
  storeLoaded = true;

  if (!fs.existsSync(storePath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw) as PersistedStore;

    workflows.clear();
    executions.clear();

    for (const workflow of parsed.workflows || []) {
      workflows.set(workflow.id, reviveWorkflow(workflow));
    }

    for (const execution of parsed.executions || []) {
      executions.set(execution.id, reviveExecution(execution));
    }

    console.log(
      `[WorkflowStore] Loaded ${workflows.size} workflows and ${executions.size} executions from disk`
    );
  } catch (error) {
    console.error('[WorkflowStore] Failed to load persisted store:', error);
  }
}

function persistStoreToDisk(): void {
  try {
    ensureDataDir();
    const payload: PersistedStore = {
      workflows: Array.from(workflows.values()),
      executions: Array.from(executions.values()),
    };

    fs.writeFileSync(storePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (error) {
    console.error('[WorkflowStore] Failed to persist store:', error);
  }
}

loadStoreFromDisk();

// ============================================================================
// WORKFLOW OPERATIONS
// ============================================================================

export class WorkflowStore {
  /**
   * Save a workflow
   */
  static saveWorkflow(workflow: Workflow): void {
    workflows.set(workflow.id, {
      ...workflow,
      updatedAt: new Date(),
    });
    persistStoreToDisk();
    console.log(`[WorkflowStore] Saved workflow: ${workflow.id}`);
  }

  /**
   * Get a workflow by ID
   */
  static getWorkflow(id: string): Workflow | null {
    return workflows.get(id) || null;
  }

  /**
   * Get all workflows
   */
  static getAllWorkflows(): Workflow[] {
    return Array.from(workflows.values());
  }

  /**
   * Get workflows by status
   */
  static getWorkflowsByStatus(status: string): Workflow[] {
    return Array.from(workflows.values()).filter(w => w.status === status);
  }

  /**
   * Update workflow status
   */
  static updateWorkflowStatus(id: string, status: string): void {
    const workflow = workflows.get(id);
    if (workflow) {
      workflow.status = status as any;
      workflow.updatedAt = new Date();
      workflows.set(id, workflow);
      persistStoreToDisk();
    }
  }

  /**
   * Delete a workflow
   */
  static deleteWorkflow(id: string): boolean {
    const deleted = workflows.delete(id);
    if (deleted) {
      persistStoreToDisk();
    }
    return deleted;
  }

  /**
   * Search workflows by name or description
   */
  static searchWorkflows(query: string): Workflow[] {
    const lower = query.toLowerCase();
    return Array.from(workflows.values()).filter(
      w =>
        w.name.toLowerCase().includes(lower) ||
        w.description.toLowerCase().includes(lower) ||
        w.goal.toLowerCase().includes(lower)
    );
  }

  /**
   * Get workflow statistics
   */
  static getStatistics() {
    const allWorkflows = Array.from(workflows.values());

    const byStatus = {} as Record<string, number>;
    const byComplexity = {} as Record<string, number>;

    for (const workflow of allWorkflows) {
      byStatus[workflow.status] = (byStatus[workflow.status] || 0) + 1;
      byComplexity[workflow.complexity] =
        (byComplexity[workflow.complexity] || 0) + 1;
    }

    return {
      totalWorkflows: allWorkflows.length,
      byStatus,
      byComplexity,
      totalNodes: allWorkflows.reduce((sum, w) => sum + w.nodeCount, 0),
      averageNodesPerWorkflow:
        allWorkflows.length > 0
          ? allWorkflows.reduce((sum, w) => sum + w.nodeCount, 0) /
            allWorkflows.length
          : 0,
    };
  }

  /**
   * Export workflow as JSON
   */
  static exportWorkflow(id: string): string {
    const workflow = workflows.get(id);
    if (!workflow) throw new Error(`Workflow not found: ${id}`);
    return JSON.stringify(workflow, null, 2);
  }

  /**
   * Import workflow from JSON
   */
  static importWorkflow(json: string): Workflow {
    const workflow = JSON.parse(json) as Workflow;
    // Track import in metadata
    (workflow as any).importedAt = new Date();
    this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Clear all workflows (dev only)
   */
  static clearAll(): void {
    workflows.clear();
    executions.clear();
    persistStoreToDisk();
    console.log('[WorkflowStore] Cleared all workflows and executions');
  }
}

// ============================================================================
// EXECUTION OPERATIONS
// ============================================================================

export class ExecutionStore {
  /**
   * Save execution state
   */
  static saveExecution(execution: ExecutionState): void {
    executions.set(execution.id, {
      ...execution,
      endTime: execution.endTime,
    });
    persistStoreToDisk();
    console.log(`[ExecutionStore] Saved execution: ${execution.id}`);
  }

  /**
   * Get execution by ID
   */
  static getExecution(id: string): ExecutionState | null {
    return executions.get(id) || null;
  }

  /**
   * Get all executions for a workflow
   */
  static getWorkflowExecutions(workflowId: string): ExecutionState[] {
    return Array.from(executions.values()).filter(e => e.workflowId === workflowId);
  }

  /**
   * Get executions by status
   */
  static getExecutionsByStatus(status: string): ExecutionState[] {
    return Array.from(executions.values()).filter(e => e.status === status as any);
  }

  /**
   * Update execution status
   */
  static updateExecutionStatus(id: string, status: string): void {
    const execution = executions.get(id);
    if (execution) {
      execution.status = status as any;
      executions.set(id, execution);
      persistStoreToDisk();
    }
  }

  /**
   * Update execution completion
   */
  static completeExecution(id: string, status: string): void {
    const execution = executions.get(id);
    if (execution) {
      execution.status = status as any;
      execution.endTime = new Date();
      execution.totalDuration = execution.endTime.getTime() - execution.startTime.getTime();
      executions.set(id, execution);
      persistStoreToDisk();
    }
  }

  /**
   * Add log to execution
   */
  static addLog(
    executionId: string,
    logEntry: any
  ): void {
    const execution = executions.get(executionId);
    if (execution) {
      execution.logs.push(logEntry);
      persistStoreToDisk();
    }
  }

  /**
   * Update node execution within a workflow execution
   */
  static updateNodeExecution(
    executionId: string,
    nodeId: string,
    nodeExecution: any
  ): void {
    const execution = executions.get(executionId);
    if (execution) {
      execution.nodeStates[nodeId] = nodeExecution;
      persistStoreToDisk();
    }
  }

  /**
   * Delete execution
   */
  static deleteExecution(id: string): boolean {
    const deleted = executions.delete(id);
    if (deleted) {
      persistStoreToDisk();
    }
    return deleted;
  }

  /**
   * Get execution statistics
   */
  static getStatistics() {
    const allExecutions = Array.from(executions.values());

    const byStatus = {} as Record<string, number>;
    let totalTime = 0;
    let completedCount = 0;

    for (const execution of allExecutions) {
      byStatus[execution.status] = (byStatus[execution.status] || 0) + 1;

      if (execution.totalDuration) {
        totalTime += execution.totalDuration;
        completedCount++;
      }
    }

    return {
      totalExecutions: allExecutions.length,
      byStatus,
      averageExecutionTime:
        completedCount > 0 ? totalTime / completedCount : 0,
      successRate:
        allExecutions.length > 0
          ? ((byStatus.completed || 0) / allExecutions.length) * 100
          : 0,
    };
  }

  /**
   * Get execution history for workflow
   */
  static getWorkflowHistory(workflowId: string) {
    const executions = this.getWorkflowExecutions(workflowId);
    return executions
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, 10);
  }

  /**
   * Clear all executions (dev only)
   */
  static clearAll(): void {
    executions.clear();
    persistStoreToDisk();
    console.log('[ExecutionStore] Cleared all executions');
  }
}

// ============================================================================
// COMBINED STORE OPERATIONS
// ============================================================================

export class Store {
  static workflows = WorkflowStore;
  static executions = ExecutionStore;

  /**
   * Get complete workflow with its execution history
   */
  static getWorkflowWithHistory(workflowId: string) {
    const workflow = WorkflowStore.getWorkflow(workflowId);
    if (!workflow) return null;

    const executions = ExecutionStore.getWorkflowExecutions(workflowId);

    return {
      workflow,
      executions: executions.sort(
        (a, b) => b.startTime.getTime() - a.startTime.getTime()
      ),
      stats: {
        totalExecutions: executions.length,
        completedExecutions: executions.filter(
          e => e.status === 'completed'
        ).length,
        failedExecutions: executions.filter(
          e => e.status === 'failed'
        ).length,
      },
    };
  }

  /**
   * Get all data (for backup/export)
   */
  static exportAll() {
    return {
      workflows: Array.from(workflows.values()),
      executions: Array.from(executions.values()),
      exportedAt: new Date(),
    };
  }

  /**
   * Get system statistics
   */
  static getSystemStatistics() {
    return {
      workflows: WorkflowStore.getStatistics(),
      executions: ExecutionStore.getStatistics(),
    };
  }

  /**
   * Clear everything (dev/testing only)
   */
  static clearAll(): void {
    WorkflowStore.clearAll();
    ExecutionStore.clearAll();
  }
}

export type { Workflow, ExecutionState };
