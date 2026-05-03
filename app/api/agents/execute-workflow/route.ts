import { NextRequest, NextResponse } from 'next/server';
import { Workflow, ExecutionState } from '@/types/agent';
import { ExecutionManager } from '@/lib/ai/execution-manager';
import { WorkflowStore, ExecutionStore } from '@/lib/ai/workflow-store';

/**
 * Execute Workflow API
 * POST /api/agents/execute-workflow
 * 
 * Request body:
 * {
 *   workflowId: string (optional - if not provided, uses workflow object)
 *   workflow: Workflow (optional - if not provided, loads from storage)
 *   maxRetries?: number
 *   parallelCapacity?: number
 *   timeout?: number
 * }
 */

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    console.log('[ExecuteWorkflow] Starting workflow execution request');
    logs.push('[ExecuteWorkflow] Request received');

    const body = await req.json();
    const { workflowId, workflow: inlineWorkflow, maxRetries, parallelCapacity, timeout } = body;

    if (!workflowId && !inlineWorkflow) {
      return NextResponse.json(
        { error: 'Either workflowId or workflow object is required' },
        { status: 400 }
      );
    }

    // Load workflow if needed
    let workflow = inlineWorkflow as Workflow;

    if (workflowId) {
      const stored = WorkflowStore.getWorkflow(workflowId);
      if (!stored) {
        return NextResponse.json(
          { error: `Workflow not found: ${workflowId}` },
          { status: 404 }
        );
      }
      workflow = stored;
      logs.push(`[ExecuteWorkflow] Loaded workflow from storage: ${workflowId}`);
    }

    if (!workflow || !workflow.id) {
      return NextResponse.json(
        { error: 'Invalid workflow' },
        { status: 400 }
      );
    }

    // Validate workflow
    if (!workflow.nodes || workflow.nodes.length === 0) {
      return NextResponse.json(
        { error: 'Workflow has no nodes' },
        { status: 400 }
      );
    }

    logs.push(
      `[ExecuteWorkflow] Workflow loaded: ${workflow.name} (${workflow.nodes.length} nodes)`
    );

    // Create execution manager
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const manager = new ExecutionManager(workflow, executionId, {
      maxRetries: maxRetries ?? 3,
      parallelCapacity: parallelCapacity ?? 4,
      timeout: timeout ?? 60000,
      logCallback: (msg: string) => logs.push(msg),
    });

    // Seed global context with workflow data
    const initialState = manager.getState();
    initialState.globalContext = {
      workflow_goal: workflow.goal,
      workflow_name: workflow.name,
      ...workflow.environment
    };

    logs.push(`[ExecuteWorkflow] Created execution manager: ${executionId}`);

    // Execute workflow
    console.log('[ExecuteWorkflow] Starting execution');
    const executionState = await manager.execute();

    const duration = Date.now() - startTime;

    // Store execution for history
    try {
      ExecutionStore.saveExecution(executionState);
    } catch (err) {
      console.error('[ExecuteWorkflow] Failed to store execution:', err);
    }

    logs.push(`[ExecuteWorkflow] Execution completed in ${duration}ms`);

    console.log(
      `[ExecuteWorkflow] Execution completed: ${executionState.status} (${duration}ms)`
    );

    // Prepare response
    const response = {
      success: executionState.status === 'completed',
      executionId: executionState.id,
      status: executionState.status,
      workflowId: workflow.id,
      workflowName: workflow.name,
      nodeCount: workflow.nodes.length,
      completedNodes: executionState.nodesCompleted,
      failedNodes: executionState.nodesFailed,
      skippedNodes: executionState.skippedNodes.length,
      metrics: {
        totalDuration: executionState.totalDuration,
        nodesCompleted: executionState.nodesCompleted,
        nodesFailed: executionState.nodesFailed,
      },
      logs: logs.slice(0, 50), // Last 50 log entries
      executionState: executionState,
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[ExecuteWorkflow] Error:', error);
    logs.push(`[ExecuteWorkflow] Error: ${error.message}`);

    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: logs.slice(0, 50),
        duration,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/agents/execute-workflow',
    method: 'POST',
    description: 'Execute a workflow and return the final execution state',
    requestBody: {
      workflowId: 'string (optional - loads from storage)',
      workflow: 'Workflow object (optional - uses inline workflow)',
      maxRetries: 'number (optional, default 3)',
      parallelCapacity: 'number (optional, default 4)',
      timeout: 'number (optional, default 60000)',
    },
    response: {
      success: 'boolean',
      executionId: 'string',
      status: 'enum: pending | running | completed | failed | paused | cancelled',
      workflowId: 'string',
      workflowName: 'string',
      nodeCount: 'number',
      completedNodes: 'number',
      failedNodes: 'number',
      skippedNodes: 'number',
      metrics: 'object with totalDuration, nodesCompleted, etc.',
      logs: 'string[]',
      executionState: 'full ExecutionState object',
      timestamp: 'ISO date string',
    },
  });
}
