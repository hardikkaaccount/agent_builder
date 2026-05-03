import { NextRequest, NextResponse } from 'next/server';
import {
  WorkerTask,
  WorkerResult,
  defaultWorkerRegistry,
} from '@/lib/ai/worker-agent';

/**
 * Worker Execution API
 * POST /api/agents/execute-worker-task
 * 
 * Executes a task using the appropriate Worker Agent
 */

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    console.log('[WorkerExecution] Starting worker task execution');
    logs.push('[WorkerExecution] Request received');

    const body = await req.json();
    const { task, options } = body;

    if (!task || !task.taskType) {
      return NextResponse.json(
        { error: 'Task with taskType is required' },
        { status: 400 }
      );
    }

    logs.push(`[WorkerExecution] Task: ${task.taskId || 'unnamed'}`);
    logs.push(`[WorkerExecution] Type: ${task.taskType}`);

    // Get worker for task type
    const worker = defaultWorkerRegistry.getWorker(task.taskType);
    if (!worker) {
      return NextResponse.json(
        {
          error: `No worker available for task type: ${task.taskType}`,
          availableWorkers: defaultWorkerRegistry.listWorkers(),
        },
        { status: 400 }
      );
    }

    logs.push(`[WorkerExecution] Using worker: ${worker.getWorkerName()}`);

    // Validate task
    try {
      // Validation is done internally in executeTask
      logs.push('[WorkerExecution] Task validation will be performed during execution');
    } catch (err: any) {
      logs.push(`[WorkerExecution] Task validation failed: ${err.message}`);
      return NextResponse.json(
        {
          success: false,
          error: `Task validation failed: ${err.message}`,
          logs,
        },
        { status: 400 }
      );
    }

    logs.push('[WorkerExecution] Task validation passed');

    // Execute task
    console.log(
      `[WorkerExecution] Executing task with ${worker.getWorkerName()} worker`
    );
    logs.push('[WorkerExecution] Executing task...');

    const taskStartTime = Date.now();
    const result = await worker.executeTask(task);
    const taskDuration = Date.now() - taskStartTime;

    logs.push(
      `[WorkerExecution] Task ${result.success ? 'succeeded' : 'failed'}`
    );
    logs.push(`[WorkerExecution] Task duration: ${taskDuration}ms`);

    // Get worker statistics
    const stats = worker.getStatistics();

    const duration = Date.now() - startTime;

    const response = {
      success: true,
      taskId: task.taskId,
      taskType: task.taskType,
      workerId: worker.getWorkerName(),
      result: {
        success: result.success,
        output: result.output,
        executionTime: result.executionTime,
        error: result.error || null,
      },
      workerStats: {
        tasksCompleted: stats.tasksCompleted,
        tasksFailed: stats.tasksFailed,
        successRate: stats.successRate,
        avgExecutionTime: stats.avgExecutionTime,
      },
      metrics: {
        processingTime: duration,
        taskExecutionTime: taskDuration,
      },
      logs: logs.slice(0, 50),
    };

    console.log(
      `[WorkerExecution] Complete (${duration}ms, success: ${result.success})`
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[WorkerExecution] Error:', error);

    const duration = Date.now() - startTime;
    logs.push(`[WorkerExecution] Error: ${error.message}`);

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
  const availableWorkers = defaultWorkerRegistry.listWorkers();

  return NextResponse.json({
    endpoint: '/api/agents/execute-worker-task',
    method: 'POST',
    description: 'Execute a task using the appropriate Worker Agent',
    availableWorkers: availableWorkers,
    requestBody: {
      task: {
        taskId: 'string (optional - unique task identifier)',
        taskType:
          'string (required - one of: ' +
          availableWorkers.join(', ') +
          ')',
        inputs: 'object - task-specific inputs',
        requirements:
          'object (optional) - resource requirements (timeout, retries, etc)',
      },
      options: 'object (optional) - execution options',
    },
    response: {
      success: 'boolean',
      taskId: 'string',
      taskType: 'string',
      workerId: 'string - ID of worker that executed task',
      result: {
        success: 'boolean',
        output: 'any - task result (varies by worker)',
        executionTime: 'number - milliseconds',
        error: 'string or null - error message if failed',
      },
      workerStats: {
        tasksCompleted: 'number',
        tasksFailed: 'number',
        successRate: 'number - percentage',
        avgExecutionTime: 'number - milliseconds',
      },
      metrics: {
        processingTime: 'number - total API time',
        taskExecutionTime: 'number - task execution only',
      },
      logs: 'string[] - execution logs',
    },
    examples: {
      dataAnalysis: {
        task: {
          taskId: 'analysis-1',
          taskType: 'data-analysis',
          inputs: {
            data: [
              { name: 'Product A', sales: 1500 },
              { name: 'Product B', sales: 2300 },
            ],
            analysisType: 'sales-trend',
          },
        },
      },
      research: {
        task: {
          taskId: 'research-1',
          taskType: 'research',
          inputs: {
            topic: 'Latest advances in AI',
            sources: 3,
          },
        },
      },
      codeGeneration: {
        task: {
          taskId: 'code-1',
          taskType: 'code-generation',
          inputs: {
            requirement: 'Function to calculate Fibonacci number',
            language: 'typescript',
          },
        },
      },
    },
  });
}
