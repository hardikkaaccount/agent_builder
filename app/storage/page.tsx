'use client';

import React, { useEffect, useState } from 'react';

type StorageResponse = {
  success: boolean;
  statistics?: {
    workflows: {
      totalWorkflows: number;
      byStatus: Record<string, number>;
      byComplexity: Record<string, number>;
      totalNodes: number;
      averageNodesPerWorkflow: number;
    };
    executions: {
      totalExecutions: number;
      byStatus: Record<string, number>;
      averageExecutionTime: number;
      successRate: number;
    };
  };
  counts?: {
    workflows: number;
    executions: number;
  };
  exportedAt?: string;
  error?: string;
};

export default function StoragePage() {
  const [data, setData] = useState<StorageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agents/storage');
      const json = (await response.json()) as StorageResponse;
      setData(json);
    } catch (error) {
      setData({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const runAction = async (action: 'clear-all' | 'export') => {
    setActionLoading(action);
    setMessage('');
    try {
      const response = await fetch('/api/agents/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Action failed');
      }

      if (action === 'export') {
        await navigator.clipboard.writeText(JSON.stringify(json.data, null, 2));
        setMessage('Export copied to clipboard');
      } else {
        setMessage('Storage cleared successfully');
      }

      await fetchStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Storage Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Inspect persisted workflows and execution history stored on disk.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runAction('export')}
            disabled={actionLoading !== null}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading === 'export' ? 'Exporting...' : 'Export JSON'}
          </button>
          <button
            onClick={() => runAction('clear-all')}
            disabled={actionLoading !== null}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {actionLoading === 'clear-all' ? 'Clearing...' : 'Clear All'}
          </button>
          <button
            onClick={fetchStats}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
            {message}
          </div>
        )}

        {loading && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-6 text-slate-400">
            Loading storage statistics...
          </div>
        )}

        {!loading && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
              <h2 className="text-xl font-semibold">Workflow Storage</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <StatCard label="Total Workflows" value={String(data.statistics?.workflows.totalWorkflows ?? 0)} />
                <StatCard label="Total Nodes" value={String(data.statistics?.workflows.totalNodes ?? 0)} />
                <StatCard label="Avg Nodes / Workflow" value={String(Math.round(data.statistics?.workflows.averageNodesPerWorkflow ?? 0))} />
                <StatCard label="Persisted Records" value={String(data.counts?.workflows ?? 0)} />
              </div>
              <pre className="text-xs bg-slate-950/80 rounded-lg p-4 overflow-auto max-h-64">
{JSON.stringify(data.statistics?.workflows.byStatus ?? {}, null, 2)}
              </pre>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
              <h2 className="text-xl font-semibold">Execution History</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <StatCard label="Total Executions" value={String(data.statistics?.executions.totalExecutions ?? 0)} />
                <StatCard label="Success Rate" value={`${Math.round(data.statistics?.executions.successRate ?? 0)}%`} />
                <StatCard label="Avg Time" value={`${Math.round(data.statistics?.executions.averageExecutionTime ?? 0)}ms`} />
                <StatCard label="Persisted Records" value={String(data.counts?.executions ?? 0)} />
              </div>
              <pre className="text-xs bg-slate-950/80 rounded-lg p-4 overflow-auto max-h-64">
{JSON.stringify(data.statistics?.executions.byStatus ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {!loading && data?.exportedAt && (
          <div className="text-xs text-slate-500">
            Last export snapshot: {new Date(data.exportedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
      <div className="text-slate-400 text-xs uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
