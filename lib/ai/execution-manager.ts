/**
 * Execution Manager
 * Orchestrates workflow execution with state management, retries, and monitoring
 */

import {
  Workflow,
  ExecutionState,
  NodeExecution,
} from '@/types/agent';
import {
  ExecutionPlan,
  planExecution,
  getNextStage,
  isPlanComplete,
  getExecutionProgress,
  shouldRetryNode,
  getRetryDelay,
  isExecutionFailed,
} from './execution-planner';
import {
  executeNode,
  NodeExecutionContext,
  NodeExecutionResult,
  composeOutputs,
} from './node-executor';
import { generateNodeId } from './workflow-utils';

export interface ExecutionManagerConfig {
  maxRetries?: number;
  parallelCapacity?: number;
  timeout?: number;
  progressCallback?: (progress: any) => void;
  logCallback?: (message: string) => void;
}

/**
 * Manages workflow execution lifecycle
 */
export class ExecutionManager {
  private workflow: Workflow;
  private executionId: string;
  private executionState: ExecutionState;
  private plan: ExecutionPlan;
  private config: ExecutionManagerConfig;
  private results: Map<string, NodeExecutionResult> = new Map();
  private running: boolean = false;
  private paused: boolean = false;

  constructor(
    workflow: Workflow,
    executionId: string,
    config: ExecutionManagerConfig = {}
  ) {
    this.workflow = workflow;
    this.executionId = executionId;
    this.config = {
      maxRetries: 3,
      parallelCapacity: 4,
      timeout: 60000,
      ...config,
    };

    // Initialize execution state
    this.executionState = {
      id: executionId,
      workflowId: workflow.id,
      status: 'pending' as any,
      startTime: new Date(),
      nodeStates: {},
      globalContext: {},
      completedNodes: [],
      failedNodes: [],
      skippedNodes: [],
      nodesCompleted: 0,
      nodesFailed: 0,
      logs: [],
    };

    // Initialize node states
    for (const node of workflow.nodes) {
      this.executionState.nodeStates[node.id] = {
        nodeId: node.id,
        workflowId: workflow.id,
        executionId,
        status: 'pending',
        retryCount: 0,
        maxRetries: this.config.maxRetries || 3,
        input: {},
        logs: [],
      };
    }

    // Plan execution
    this.plan = planExecution(
      workflow,
      executionId,
      this.config.parallelCapacity
    );

    this.log(
      `[ExecutionManager] Created execution plan with ${this.plan.stages.length} stages`
    );
  }

  /**
   * Execute the workflow
   */
  async execute(): Promise<ExecutionState> {
    this.running = true;
    this.executionState.status = 'running';
    this.executionState.startTime = new Date();

    try {
      this.log(`[ExecutionManager] Starting workflow execution`);

      // Execute stages sequentially
      for (const stage of this.plan.stages) {
        if (!this.running) {
          this.log(`[ExecutionManager] Execution paused`);
          this.executionState.status = 'paused';
          break;
        }

        await this.executeStage(stage);

        // Check for failures
        if (isExecutionFailed(this.executionState)) {
          this.log(`[ExecutionManager] Execution failed due to critical node failure`);
          this.executionState.status = 'failed';
          break;
        }
      }

      // Finalize execution
      if (this.running && !isExecutionFailed(this.executionState)) {
        this.executionState.status = 'completed';
        this.log(`[ExecutionManager] Workflow execution completed successfully`);
      }
    } catch (error: any) {
      this.log(`[ExecutionManager] Execution error: ${error.message}`);
      this.executionState.status = 'failed';
    } finally {
      this.running = false;
      this.executionState.endTime = new Date();
      this.executionState.totalDuration =
        (this.executionState.endTime?.getTime() || 0) -
        (this.executionState.startTime?.getTime() || 0);
    }

    return this.executionState;
  }

  /**
   * Execute all nodes in a stage (can run in parallel)
   */
  private async executeStage(stage: any): Promise<void> {
    this.log(
      `[ExecutionManager] Executing stage ${stage.stageNumber}: [${stage.nodeIds.join(', ')}]`
    );

    // Execute nodes in parallel
    const nodePromises = stage.nodeIds.map((nodeId: string) =>
      this.executeNodeWithRetry(nodeId)
    );

    await Promise.all(nodePromises);

    // Report progress
    this.reportProgress();
  }

  /**
   * Execute a single node with retry logic
   */
  private async executeNodeWithRetry(nodeId: string): Promise<void> {
    const node = this.workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      this.log(`[ExecutionManager] Node not found: ${nodeId}`);
      return;
    }

    const nodeState = this.executionState.nodeStates[nodeId];
    let result: NodeExecutionResult | null = null;

    try {
      // Execute with retries
      while (nodeState.retryCount <= (this.config.maxRetries || 3)) {
        try {
          nodeState.status = 'running';

          this.log(
            `[ExecutionManager] Executing node: ${node.name} (attempt ${nodeState.retryCount + 1})`
          );

          // Create execution context
          const context: NodeExecutionContext = {
            nodeId,
            nodeExecution: nodeState,
            previousOutputs: composeOutputs(this.results),
            globalContext: this.executionState.globalContext,
            environment: this.workflow.environment || {},
          };

          // Execute node
          result = await executeNode(
            node,
            context,
            this.config.timeout
          );

          // Store result
          this.results.set(nodeId, result);

          if (result.success) {
            nodeState.status = 'success';
            nodeState.output = result.output;
            nodeState.duration = result.duration;
            this.executionState.nodesCompleted++;
            this.executionState.completedNodes.push(nodeId);

            this.log(
              `[ExecutionManager] Node completed: ${node.name} (${result.duration}ms)`
            );

            break; // Success, exit retry loop
          } else {
            // Node failed, check if should retry
            nodeState.status = 'failed';
            nodeState.error = { message: result.error || 'Unknown error' };
            nodeState.retryCount++;

            if (
              shouldRetryNode(nodeState, this.config.maxRetries)
            ) {
              const delay = getRetryDelay(nodeState.retryCount);
              this.log(
                `[ExecutionManager] Node failed, retrying in ${delay}ms: ${node.name} - Error: ${result.error}`
              );

              await new Promise(resolve => setTimeout(resolve, delay));
              continue; // Retry
            } else {
              this.log(
                `[ExecutionManager] Node failed and no retries remaining: ${node.name}`
              );
              break; // No more retries
            }
          }
        } catch (err: any) {
          nodeState.retryCount++;
          nodeState.error = err.message;

          if (nodeState.retryCount <= (this.config.maxRetries || 3)) {
            const delay = getRetryDelay(nodeState.retryCount);
            this.log(
              `[ExecutionManager] Node error, retrying in ${delay}ms: ${err.message}`
            );

            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            this.log(
              `[ExecutionManager] Node failed after ${nodeState.retryCount} attempts: ${node.name}`
            );
            nodeState.status = 'failed';
            break;
          }
        }
      }

      // Handle skip on failure
      if (nodeState.status === 'failed' && node.skipOnFailure) {
        nodeState.status = 'skipped';
        this.executionState.skippedNodes.push(nodeId);
        this.log(`[ExecutionManager] Node skipped due to skipOnFailure flag: ${node.name}`);
      } else if (nodeState.status === 'failed') {
        this.executionState.nodesFailed++;
        this.executionState.failedNodes.push(nodeId);
      }
    } catch (error: any) {
      this.log(`[ExecutionManager] Unexpected error in node execution: ${error.message}`);
      nodeState.status = 'failed';
      nodeState.error = { message: error.message };
      this.executionState.nodesFailed++;
      this.executionState.failedNodes.push(nodeId);
    }
  }

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    return this.executionState;
  }

  /**
   * Get execution plan
   */
  getPlan(): ExecutionPlan {
    return this.plan;
  }

  /**
   * Get execution progress
   */
  getProgress() {
    return getExecutionProgress(this.plan, this.executionState);
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.paused = true;
    this.running = false;
    this.executionState.status = 'paused';
    this.log(`[ExecutionManager] Execution paused`);
  }

  /**
   * Resume execution
   */
  async resume(): Promise<ExecutionState> {
    if (!this.paused) {
      this.log(`[ExecutionManager] Execution is not paused`);
      return this.executionState;
    }

    this.paused = false;
    this.log(`[ExecutionManager] Resuming execution`);

    return this.execute();
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    this.running = false;
    this.paused = false;
    this.executionState.status = 'failed' as any;
    this.log(`[ExecutionManager] Execution cancelled`);
  }

  /**
   * Get node result
   */
  getNodeResult(nodeId: string): NodeExecutionResult | undefined {
    return this.results.get(nodeId);
  }

  /**
   * Get all results
   */
  getAllResults(): Map<string, NodeExecutionResult> {
    return new Map(this.results);
  }

  /**
   * Report progress
   */
  private reportProgress(): void {
    const progress = this.getProgress();
    this.log(
      `[ExecutionManager] Progress: ${progress.completed}/${progress.total} nodes (${progress.percentage}%)`
    );

    if (this.config.progressCallback) {
      this.config.progressCallback(progress);
    }
  }

  /**
   * Log message
   */
  private log(message: string): void {
    this.executionState.logs.push({
      timestamp: new Date(),
      level: 'info',
      message,
      source: 'master',
    } as any);

    if (this.config.logCallback) {
      this.config.logCallback(message);
    } else {
      console.log(message);
    }
  }
}

/**
 * Create and execute a workflow
 */
export async function executeWorkflow(
  workflow: Workflow,
  config?: ExecutionManagerConfig
): Promise<ExecutionState> {
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const manager = new ExecutionManager(workflow, executionId, config);

  return manager.execute();
}
