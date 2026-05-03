import { NextRequest, NextResponse } from 'next/server';
import { Workflow, ExecutionState } from '@/types/agent';
import {
  coordinateExecution,
  analyzeExecution,
  isRecoverable,
} from '@/lib/ai/coordinator-agent';
import { WorkflowStore, ExecutionStore } from '@/lib/ai/workflow-store';

/**
 * Coordination API
 * POST /api/agents/coordinate-execution
 * 
 * Coordinates workflow execution, handles failures, and recommends recovery
 */

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    console.log('[CoordinateExecution] Starting coordination request');
    logs.push('[CoordinateExecution] Request received');

    const body = await req.json();
    const {
      workflowId,
      executionId,
      workflow: inlineWorkflow,
      executionState: inlineState,
    } = body;

    // Load workflow
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
      logs.push(`[CoordinateExecution] Loaded workflow: ${workflowId}`);
    }

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow is required' },
        { status: 400 }
      );
    }

    // Load execution state
    let executionState = inlineState as ExecutionState;
    if (executionId) {
      const stored = ExecutionStore.getExecution(executionId);
      if (!stored) {
        return NextResponse.json(
          { error: `Execution not found: ${executionId}` },
          { status: 404 }
        );
      }
      executionState = stored;
      logs.push(`[CoordinateExecution] Loaded execution: ${executionId}`);
    }

    if (!executionState) {
      return NextResponse.json(
        { error: 'Execution state is required' },
        { status: 400 }
      );
    }

    logs.push('[CoordinateExecution] Analyzing execution state');

    // Find failed nodes
    const failedNodeIds = Object.entries(executionState.nodeStates)
      .filter(([_, state]: [string, any]) => state.status === 'failed')
      .map(([id]) => id);

    logs.push(`[CoordinateExecution] Found ${failedNodeIds.length} failed nodes`);

    // Analyze execution
    const analysis = analyzeExecution(executionState);
    logs.push(`[CoordinateExecution] Success rate: ${analysis.successRate.toFixed(1)}%`);

    // Coordinate recovery
    let coordinationResult = null;
    let recommendation = 'continue';

    if (failedNodeIds.length > 0) {
      console.log('[CoordinateExecution] Calling Coordinator Agent');

      coordinationResult = await coordinateExecution({
        workflow,
        executionState,
        failedNodeIds,
        logs: logs.slice(0, 20),
      });

      recommendation = coordinationResult.action;
      logs.push(
        `[CoordinateExecution] Coordinator recommends: ${recommendation}`
      );
    }

    // Check recoverability
    const recoverable =
      failedNodeIds.length === 0 ||
      isRecoverable(workflow, executionState, failedNodeIds);

    logs.push(
      `[CoordinateExecution] Execution ${recoverable ? 'is recoverable' : 'is NOT recoverable'}`
    );

    const duration = Date.now() - startTime;

    // Prepare response
    const response = {
      success: true,
      executionId: executionState.id,
      workflowId: workflow.id,
      status: executionState.status,
      analysis: {
        successRate: analysis.successRate,
        avgNodeDuration: analysis.avgNodeDuration,
        bottlenecks: analysis.bottlenecks,
        recommendations: analysis.recommendations,
      },
      coordination: {
        requiredAction: recommendation,
        actionDetails: coordinationResult,
        isRecoverable: recoverable,
      },
      failedNodeCount: failedNodeIds.length,
      failedNodes: failedNodeIds,
      metrics: {
        processingTime: duration,
        completedNodes: executionState.nodesCompleted,
        failedNodes: executionState.nodesFailed,
      },
      logs: logs.slice(0, 50),
    };

    console.log(
      `[CoordinateExecution] Complete (${duration}ms, recommendation: ${recommendation})`
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[CoordinateExecution] Error:', error);

    const duration = Date.now() - startTime;
    logs.push(`[CoordinateExecution] Error: ${error.message}`);

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
    endpoint: '/api/agents/coordinate-execution',
    method: 'POST',
    description:
      'Analyze execution state and coordinate recovery using the Coordinator Agent',
    requestBody: {
      workflowId: 'string (optional - loads from storage)',
      executionId: 'string (optional - loads from storage)',
      workflow: 'Workflow object (optional)',
      executionState: 'ExecutionState object (optional)',
    },
    response: {
      success: 'boolean',
      executionId: 'string',
      workflowId: 'string',
      status: 'current workflow status',
      analysis: {
        successRate: 'number - percentage of successful nodes',
        avgNodeDuration: 'number - average node execution time',
        bottlenecks: 'string[] - identified bottlenecks',
        recommendations: 'string[] - improvement recommendations',
      },
      coordination: {
        requiredAction: 'continue|retry|skip|adjust|abort',
        actionDetails: 'detailed coordination result',
        isRecoverable: 'boolean - whether execution can be recovered',
      },
      failedNodeCount: 'number',
      failedNodes: 'string[] - IDs of failed nodes',
      metrics: 'object with timing and counts',
      logs: 'string[] - execution logs',
    },
  });
}
