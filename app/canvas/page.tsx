'use client';

import React, { useMemo, useState } from 'react';
import { WorkflowGraphCanvas } from '@/components/app/agent-builder/WorkflowGraphCanvas';
import {
  getExampleWorkflow,
  listExampleWorkflows,
} from '@/lib/ai/example-workflows';

export default function CanvasPage() {
  const options = useMemo(() => listExampleWorkflows(), []);
  const [selectedId, setSelectedId] = useState<string>(options[0]?.id || '');

  const workflow = useMemo(() => {
    return selectedId ? getExampleWorkflow(selectedId) : null;
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Workflow Canvas</h1>
            <p className="text-slate-400 mt-1">
              Visual DAG inspector for example multi-agent workflows
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="wf" className="text-sm text-slate-300">
              Workflow
            </label>
            <select
              id="wf"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm"
            >
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!workflow && (
          <div className="rounded-lg border border-red-700 bg-red-950/40 p-4 text-red-200">
            Could not load the selected workflow.
          </div>
        )}

        {workflow && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Complexity</div>
                <div className="text-lg font-semibold mt-1">{workflow.complexity}</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Nodes</div>
                <div className="text-lg font-semibold mt-1">{workflow.nodeCount}</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Edges</div>
                <div className="text-lg font-semibold mt-1">{workflow.edgeCount}</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Timeout</div>
                <div className="text-lg font-semibold mt-1">{workflow.timeout ?? 0}ms</div>
              </div>
            </div>

            <WorkflowGraphCanvas workflow={workflow} />
          </>
        )}
      </div>
    </div>
  );
}
