import { NextRequest, NextResponse } from 'next/server';
import { Store } from '@/lib/ai/workflow-store';

/**
 * Storage Management API
 * GET /api/agents/storage
 * POST /api/agents/storage
 * 
 * Provides persistence statistics and management actions
 */

export async function GET(req: NextRequest) {
  try {
    const stats = Store.getSystemStatistics();
    const exportData = Store.exportAll();

    return NextResponse.json({
      success: true,
      statistics: stats,
      counts: {
        workflows: exportData.workflows.length,
        executions: exportData.executions.length,
      },
      exportedAt: exportData.exportedAt,
    });
  } catch (error: any) {
    console.error('[StorageAPI] Error:', error);
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
    const action = body?.action as string | undefined;

    if (action === 'clear-all') {
      Store.clearAll();
      return NextResponse.json({
        success: true,
        message: 'All workflows and executions cleared',
      });
    }

    if (action === 'export') {
      const exportData = Store.exportAll();
      return NextResponse.json({
        success: true,
        data: exportData,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unsupported action',
        supportedActions: ['clear-all', 'export'],
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[StorageAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
