import { NextRequest, NextResponse } from 'next/server';
import { Workflow } from '@/types/agent';
import { delegateWorkflow, validateDelegation, calculateDelegatedDuration } from '@/lib/ai/delegator-agent';
import { WorkflowStore } from '@/lib/ai/workflow-store';

/**
 * Delegation API
 * POST /api/agents/delegate-workflow
 * 
 * Delegates workflow refinement and optimization to the Delegator Agent
 */

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    console.log('[DelegateWorkflow] Starting delegation request');
    logs.push('[DelegateWorkflow] Request received');

    const body = await req.json();
    const {
      workflowId,
      workflow: inlineWorkflow,
      constraints,
      preferences,
    } = body;

    // Load or use provided workflow
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
      logs.push(`[DelegateWorkflow] Loaded workflow: ${workflowId}`);
    }

    if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty workflow' },
        { status: 400 }
      );
    }

    logs.push(
      `[DelegateWorkflow] Delegating workflow with ${workflow.nodes.length} nodes`
    );

    // Delegate to Delegator Agent
    console.log('[DelegateWorkflow] Calling Delegator Agent');

    const delegationResult = await delegateWorkflow({
      workflow,
      constraints,
      preferences,
    });

    logs.push('[DelegateWorkflow] Delegation complete');

    // Validate delegation
    const validation = validateDelegation(delegationResult);
    if (!validation.valid) {
      logs.push(
        `[DelegateWorkflow] Validation warnings: ${validation.warnings.join(', ')}`
      );
    }

    // Calculate estimated duration
    const estimatedDuration = calculateDelegatedDuration(delegationResult);
    logs.push(
      `[DelegateWorkflow] Estimated execution time: ${estimatedDuration}ms`
    );

    const duration = Date.now() - startTime;

    // Prepare response
    const response = {
      success: true,
      workflow: delegationResult.workflow,
      optimizations: delegationResult.optimizations,
      reasoning: delegationResult.reasoning,
      confidence: delegationResult.confidence,
      nodeAssignments: delegationResult.nodeAssignments,
      estimatedDuration,
      validationWarnings: validation.warnings,
      metrics: {
        processingTime: duration,
        optimizationCount: delegationResult.optimizations.length,
      },
      logs: logs.slice(0, 50),
    };

    console.log(
      `[DelegateWorkflow] Complete (${duration}ms, ${delegationResult.optimizations.length} optimizations)`
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[DelegateWorkflow] Error:', error);

    const duration = Date.now() - startTime;
    logs.push(`[DelegateWorkflow] Error: ${error.message}`);

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
    endpoint: '/api/agents/delegate-workflow',
    method: 'POST',
    description: 'Refine and optimize a workflow using the Delegator Agent',
    requestBody: {
      workflowId: 'string (optional - loads from storage)',
      workflow: 'Workflow object (optional - uses inline workflow)',
      constraints: {
        maxParallelNodes: 'number (optional)',
        maxDuration: 'number in ms (optional)',
        priorityNodes: 'string[] (optional)',
        avoidNodes: 'string[] (optional)',
      },
      preferences: {
        costOptimization: 'low|medium|high (optional)',
        speedOptimization: 'low|medium|high (optional)',
        reliabilityOptimization: 'low|medium|high (optional)',
      },
    },
    response: {
      success: 'boolean',
      workflow: 'Optimized Workflow object',
      optimizations: 'string[] - list of optimizations applied',
      reasoning: 'string - reasoning behind optimizations',
      confidence: 'number - confidence level 0-1',
      nodeAssignments: 'object - assignments for each node',
      estimatedDuration: 'number - estimated execution time in ms',
      validationWarnings: 'string[] - any validation warnings',
      metrics: 'object with processingTime and optimizationCount',
      logs: 'string[] - execution logs',
    },
  });
}
