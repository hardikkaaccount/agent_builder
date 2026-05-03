import { NextRequest, NextResponse } from 'next/server';
import {
  getExampleWorkflow,
  listExampleWorkflows,
} from '../../../../lib/ai/example-workflows';
import { WorkflowStore } from '@/lib/ai/workflow-store';

/**
 * Example Workflows API
 * GET /api/agents/example-workflows
 * 
 * Manage and load example workflows
 */

export async function GET(req: NextRequest) {
  const logs: string[] = [];

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const workflowId = searchParams.get('id');

    if (action === 'list') {
      console.log('[ExampleWorkflows] Listing available workflows');
      logs.push('[ExampleWorkflows] Retrieving available example workflows');

      const workflows = listExampleWorkflows();
      logs.push(`[ExampleWorkflows] Found ${workflows.length} example workflows`);

      return NextResponse.json({
        success: true,
        workflows: workflows.map((w: { id: string; name: string; description: string }) => ({
          ...w,
          url: `/api/agents/example-workflows?action=get&id=${w.id}`,
          loadUrl: `/api/agents/example-workflows?action=load&id=${w.id}`,
        })),
        count: workflows.length,
        logs: logs.slice(0, 20),
      });
    }

    if (action === 'get' && workflowId) {
      console.log(`[ExampleWorkflows] Getting workflow: ${workflowId}`);
      logs.push(`[ExampleWorkflows] Retrieving workflow: ${workflowId}`);

      const workflow = getExampleWorkflow(workflowId);
      if (!workflow) {
        return NextResponse.json(
          {
            error: `Workflow not found: ${workflowId}`,
            availableWorkflows: listExampleWorkflows().map((w: { id: string }) => w.id),
          },
          { status: 404 }
        );
      }

      logs.push(`[ExampleWorkflows] Workflow loaded: ${workflow.name}`);
      logs.push(
        `[ExampleWorkflows] Nodes: ${workflow.nodes.length}, complexity: ${workflow.complexity}`
      );

      return NextResponse.json({
        success: true,
        workflow,
        nodeCount: workflow.nodes.length,
        estimatedDuration: workflow.timeout ?? 0,
        logs: logs.slice(0, 20),
      });
    }

    if (action === 'load' && workflowId) {
      console.log(`[ExampleWorkflows] Loading workflow to storage: ${workflowId}`);
      logs.push(`[ExampleWorkflows] Loading workflow to storage: ${workflowId}`);

      const workflow = getExampleWorkflow(workflowId);
      if (!workflow) {
        return NextResponse.json(
          {
            error: `Workflow not found: ${workflowId}`,
            availableWorkflows: listExampleWorkflows().map((w: { id: string }) => w.id),
          },
          { status: 404 }
        );
      }

      // Create a copy with unique ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const loadedWorkflow = {
        ...workflow,
        id: `${workflow.id}-${timestamp}`,
        status: 'draft' as const,
      };

      WorkflowStore.saveWorkflow(loadedWorkflow);

      logs.push(
        `[ExampleWorkflows] Workflow loaded to storage: ${loadedWorkflow.id}`
      );

      return NextResponse.json({
        success: true,
        loadedWorkflowId: loadedWorkflow.id,
        originalWorkflowId: workflow.id,
        nodeCount: workflow.nodes.length,
        message: `Workflow "${workflow.name}" loaded and ready for execution`,
        logs: logs.slice(0, 20),
      });
    }

    // Default: list actions
    return NextResponse.json({
      endpoint: '/api/agents/example-workflows',
      method: 'GET',
      description: 'Access example workflow templates and load them to storage',
      actions: {
        list: {
          url: '?action=list',
          description: 'List all available example workflows',
          response:
            'Array of available workflows with ids, names, descriptions',
        },
        get: {
          url: '?action=get&id=WORKFLOW_ID',
          description: 'Get detailed workflow definition',
          response: 'Complete workflow object with all nodes and configuration',
        },
        load: {
          url: '?action=load&id=WORKFLOW_ID',
          description:
            'Load example workflow to storage with unique timestamp ID',
          response:
            'Loaded workflow ID ready for execution and delegation/coordination',
        },
      },
      availableWorkflows: listExampleWorkflows(),
      examples: {
        listAll: '/api/agents/example-workflows?action=list',
        getTravelAgent:
          '/api/agents/example-workflows?action=get&id=travel-agent-workflow',
        loadDataAnalysis:
          '/api/agents/example-workflows?action=load&id=data-analysis-workflow',
      },
    });
  } catch (error: any) {
    console.error('[ExampleWorkflows] Error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: logs.slice(0, 20),
      },
      { status: 500 }
    );
  }
}
