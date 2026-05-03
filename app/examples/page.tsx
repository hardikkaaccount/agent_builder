'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExampleWorkflowShowcase } from '@/components/app/agent-builder/ExampleWorkflowShowcase';
import { WorkflowBuilder } from '@/components/app/agent-builder/WorkflowBuilder';
import { ExecutionMonitor } from '@/components/app/agent-builder/ExecutionMonitor';
import { WorkflowGraphCanvas } from '@/components/app/agent-builder/WorkflowGraphCanvas';
import { Workflow, ExecutionState } from '@/types/agent';

type ViewMode = 'showcase' | 'builder' | 'execution' | 'canvas';

export default function ExamplesPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('showcase');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [currentExecution, setCurrentExecution] = useState<ExecutionState | null>(null);

  const handleWorkflowLoad = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/agents/workflow?id=${encodeURIComponent(workflowId)}`);
      if (!res.ok) throw new Error(`Failed to load workflow: ${res.statusText}`);
      const data = await res.json();
      if (data && data.workflow) {
        setSelectedWorkflow(data.workflow as Workflow);
        setViewMode('builder');
      } else {
        throw new Error('Workflow not found');
      }
    } catch (err) {
      console.error('Error loading workflow from storage:', err);
      alert(`Error loading workflow: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch('/api/agents/execute-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          maxRetries: 3,
          parallelCapacity: 4,
        }),
      });

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.statusText}`);
      }

      const data = await response.json();
      setCurrentExecution(data);
      setViewMode('execution');
    } catch (error) {
      console.error('Error executing workflow:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Example Workflows</h1>
          <p className="text-slate-300">
            Pre-built workflow templates demonstrating the multi-agent orchestration system
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setViewMode('showcase')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
              viewMode === 'showcase'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            📚 Workflow Library
          </button>

          {selectedWorkflow && (
            <>
              <button
                onClick={() => setViewMode('builder')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  viewMode === 'builder'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                🏗️ Workflow Builder
              </button>

              <button
                onClick={() => handleExecuteWorkflow(selectedWorkflow.id)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95`}
              >
                ▶️ Execute Now
              </button>

              <button
                onClick={() => setViewMode('canvas')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  viewMode === 'canvas'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                🧭 DAG Canvas
              </button>
            </>
          )}

          {currentExecution && (
            <button
              onClick={() => setViewMode('execution')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                viewMode === 'execution'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              📊 Execution Monitor
            </button>
          )}

          <button
            onClick={() => router.push('/storage')}
            className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-slate-700 text-slate-200 hover:bg-slate-600"
          >
            🗄️ Storage Dashboard
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto">
        {viewMode === 'showcase' && (
          <ExampleWorkflowShowcase onWorkflowLoad={handleWorkflowLoad} />
        )}

        {viewMode === 'builder' && selectedWorkflow && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-1">
                {selectedWorkflow.name}
              </h2>
              <p className="text-slate-400">{selectedWorkflow.description}</p>
            </div>
            <WorkflowBuilder workflow={selectedWorkflow} />
          </div>
        )}

        {viewMode === 'execution' && currentExecution && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-1">
                Execution Monitor
              </h2>
              <p className="text-slate-400">
                Real-time monitoring of workflow execution
              </p>
            </div>
            <ExecutionMonitor 
              executionId={currentExecution.id}
              workflowName={selectedWorkflow?.name || 'Workflow'}
              autoStart={true}
            />
          </div>
        )}

        {viewMode === 'canvas' && selectedWorkflow && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white mb-1">
                DAG Canvas
              </h2>
              <p className="text-slate-400">
                Visual graph of dependencies and execution flow for {selectedWorkflow.name}
              </p>
            </div>
            <WorkflowGraphCanvas workflow={selectedWorkflow} />
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto bg-slate-700 rounded-lg p-6 border border-slate-600">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          System Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Total Workflows</p>
            <p className="text-lg font-semibold text-white mt-1">3 Templates</p>
          </div>
          <div>
            <p className="text-slate-400">Total Tasks</p>
            <p className="text-lg font-semibold text-white mt-1">20+ Tasks</p>
          </div>
          <div>
            <p className="text-slate-400">Agent Coordination</p>
            <p className="text-lg font-semibold text-white mt-1">Master → Delegator → Coordinator → Workers</p>
          </div>
        </div>
      </div>
    </div>
  );
}
