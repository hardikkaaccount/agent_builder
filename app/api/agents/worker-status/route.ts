import { NextRequest, NextResponse } from 'next/server';
import { defaultWorkerRegistry } from '@/lib/ai/worker-agent';

/**
 * Worker Status API
 * GET /api/agents/worker-status
 * 
 * Returns available workers and their statistics
 */

export async function GET(req: NextRequest) {
  const logs: string[] = [];

  try {
    console.log('[WorkerStatus] Retrieving worker status');
    logs.push('[WorkerStatus] Retrieving worker list and statistics');

    const workerIds = defaultWorkerRegistry.listWorkers();
    const detailedWorkers = workerIds.map((taskTypeId) => {
      const worker = defaultWorkerRegistry.getWorker(taskTypeId);
      const stats = worker?.getStatistics();

      return {
        id: taskTypeId,
        name: worker?.getWorkerName() || taskTypeId,
        description: worker ? 'Worker available' : '',
        taskType: taskTypeId,
        stats: stats
          ? {
              tasksCompleted: stats.tasksCompleted,
              tasksFailed: stats.tasksFailed,
              successRate: stats.successRate,
              avgExecutionTime: stats.avgExecutionTime,
            }
          : null,
      };
    });

    logs.push(
      `[WorkerStatus] Found ${detailedWorkers.length} workers available`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      workers: detailedWorkers,
      totalWorkers: detailedWorkers.length,
      logs,
    });
  } catch (error: any) {
    console.error('[WorkerStatus] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, workerId } = body;

    if (action === 'reset-stats' && workerId) {
      const worker = defaultWorkerRegistry.getWorker(workerId);
      if (!worker) {
        return NextResponse.json(
          { error: `Worker not found: ${workerId}` },
          { status: 404 }
        );
      }

      // Reset would need to be implemented in worker
      // For now, return success
      return NextResponse.json({
        success: true,
        message: `Stats for ${workerId} would be reset (not yet implemented)`,
      });
    }

    return NextResponse.json(
      {
        error: 'Unknown action',
        supportedActions: ['reset-stats'],
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
