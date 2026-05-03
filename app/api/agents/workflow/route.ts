import { NextRequest, NextResponse } from 'next/server';
import { WorkflowStore } from '@/lib/ai/workflow-store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id parameter' }, { status: 400 });
    }

    const workflow = WorkflowStore.getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ success: false, error: `Workflow not found: ${id}` }, { status: 404 });
    }

    return NextResponse.json({ success: true, workflow });
  } catch (error: any) {
    console.error('[WorkflowAPI] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === 'save') {
      const workflow = body?.workflow;
      if (!workflow || !workflow.id) {
        return NextResponse.json({ success: false, error: 'Invalid workflow payload' }, { status: 400 });
      }
      WorkflowStore.saveWorkflow(workflow);
      return NextResponse.json({ success: true, message: 'Workflow saved', id: workflow.id });
    }

    if (action === 'delete') {
      const id = body?.id as string | undefined;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing id for delete' }, { status: 400 });
      }
      const deleted = WorkflowStore.deleteWorkflow(id);
      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('[WorkflowAPI] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
