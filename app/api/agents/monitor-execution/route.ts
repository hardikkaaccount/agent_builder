import { NextRequest, NextResponse } from 'next/server';
import { ExecutionStore } from '@/lib/ai/workflow-store';

/**
 * Monitor Execution API
 * GET /api/agents/monitor-execution?executionId=xxx
 * 
 * Returns real-time execution status and progress
 */

export async function GET(req: NextRequest) {
  try {
    const executionId = req.nextUrl.searchParams.get('executionId');

    if (!executionId) {
      return NextResponse.json(
        { error: 'executionId parameter is required' },
        { status: 400 }
      );
    }

    console.log('[MonitorExecution] Fetching execution status:', executionId);

    // Get execution from storage
    const execution = ExecutionStore.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        {
          error: 'Execution not found',
          executionId,
        },
        { status: 404 }
      );
    }

    // Calculate progress
    const totalNodes = Object.keys(execution.nodeStates).length;
    const completedNodes = Object.values(execution.nodeStates).filter(
      (ns: any) => ns.status === 'success'
    ).length;
    const failedNodes = Object.values(execution.nodeStates).filter(
      (ns: any) => ns.status === 'failed'
    ).length;
    const skippedNodes = Object.values(execution.nodeStates).filter(
      (ns: any) => ns.status === 'skipped'
    ).length;
    const runningNodes = Object.values(execution.nodeStates).filter(
      (ns: any) => ns.status === 'running'
    ).length;

    const percentage = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    // Calculate elapsed time
    const elapsedMs =
      new Date().getTime() - (execution.startTime?.getTime() || 0);
    const estimatedRemainingMs = (execution.totalDuration || 0) > elapsedMs
      ? (execution.totalDuration || 0) - elapsedMs
      : 0;

    // Get node details
    const nodeDetails = Object.entries(execution.nodeStates).map(([nodeId, state]: [string, any]) => ({
      nodeId,
      status: state.status,
      retryCount: state.retryCount,
      duration: state.duration,
      error: state.error?.message || state.error,
      output: state.output ? Object.keys(state.output) : [],
    }));

    const lastLog = execution.logs[execution.logs.length - 1];
    const lastLogEntry = typeof lastLog === 'string' ? lastLog : (lastLog as any)?.message || '';
    
    const response = {
      executionId,
      workflowId: execution.workflowId,
      status: execution.status,
      progress: {
        completed: completedNodes,
        failed: failedNodes,
        skipped: skippedNodes,
        running: runningNodes,
        total: totalNodes,
        percentage,
      },
      timing: {
        startedAt: execution.startTime,
        completedAt: execution.endTime,
        elapsedMs,
        estimatedRemainingMs,
      },
      metrics: {
        totalDuration: execution.totalDuration,
        nodesCompleted: execution.nodesCompleted,
        nodesFailed: execution.nodesFailed,
      },
      nodeStates: nodeDetails,
      lastLogEntry: lastLogEntry,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[MonitorExecution] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { executionId, action } = body;

    if (!executionId || !action) {
      return NextResponse.json(
        { error: 'executionId and action are required' },
        { status: 400 }
      );
    }

    // Get execution
    const execution = ExecutionStore.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    // Handle actions
    switch (action) {
      case 'pause':
        execution.status = 'paused';
        console.log('[MonitorExecution] Paused execution:', executionId);
        break;

      case 'resume':
        if (execution.status === 'paused') {
          execution.status = 'running';
          console.log('[MonitorExecution] Resumed execution:', executionId);
        }
        break;

      case 'cancel':
        execution.status = 'failed' as any;
        console.log('[MonitorExecution] Cancelled execution:', executionId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Update execution
    try {
      ExecutionStore.saveExecution(execution);
    } catch (err) {
      console.error('[MonitorExecution] Failed to update execution:', err);
    }

    return NextResponse.json({
      success: true,
      executionId,
      action,
      status: execution.status,
    });
  } catch (error: any) {
    console.error('[MonitorExecution] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
