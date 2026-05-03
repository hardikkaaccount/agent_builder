'use client';

import React, { useState, useEffect } from 'react';
import { Workflow } from '@/types/agent';
import { cn } from '@/utils/cn';

interface ExampleWorkflowShowcaseProps {
  onWorkflowLoad?: (workflowId: string) => void;
}

interface AvailableWorkflow {
  id: string;
  name: string;
  description: string;
  url: string;
  loadUrl: string;
}

interface WorkflowDetails {
  workflow: Workflow;
  nodeCount: number;
  estimatedDuration: number;
}

export const ExampleWorkflowShowcase: React.FC<ExampleWorkflowShowcaseProps> = ({
  onWorkflowLoad,
}) => {
  const [workflows, setWorkflows] = useState<AvailableWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetails | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);

  // Load available workflows
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/agents/example-workflows?action=list');
        if (!response.ok) {
          throw new Error(`Failed to load workflows: ${response.statusText}`);
        }

        const data = await response.json();
        setWorkflows(data.workflows || []);
      } catch (err) {
        console.error('Error loading workflows:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load workflows'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  // Load workflow details
  const handleSelectWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch(
        `/api/agents/example-workflows?action=get&id=${workflowId}`
      );
      if (!response.ok) {
        throw new Error('Failed to load workflow details');
      }

      const data = await response.json();
      setSelectedWorkflow({
        workflow: data.workflow,
        nodeCount: data.nodeCount,
        estimatedDuration: data.estimatedDuration,
      });
    } catch (err) {
      console.error('Error loading workflow details:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load workflow details'
      );
    }
  };

  // Load workflow to storage
  const handleLoadWorkflow = async (workflowId: string) => {
    try {
      setIsLoadingWorkflow(true);
      setError(null);

      const response = await fetch(
        `/api/agents/example-workflows?action=load&id=${workflowId}`
      );
      if (!response.ok) {
        throw new Error('Failed to load workflow');
      }

      const data = await response.json();
      onWorkflowLoad?.(data.loadedWorkflowId);

      // Show success notification
      alert(
        `✅ Workflow loaded successfully!\nID: ${data.loadedWorkflowId}\n\nReady for execution.`
      );
    } catch (err) {
      console.error('Error loading workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setIsLoadingWorkflow(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          </div>
          <p className="text-gray-600">Loading example workflows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-slate-50 to-slate-100 rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Example Workflows</h2>
        <p className="text-blue-100">
          Pre-built workflow templates for testing and demonstration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Workflow List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">
            Available Templates
          </h3>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {workflows.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700 text-sm">
              No example workflows found
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  onClick={() => handleSelectWorkflow(workflow.id)}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border-2 transition-all duration-200',
                    selectedWorkflow?.workflow.id === workflow.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                  )}
                >
                  <h4 className="font-semibold text-slate-900">
                    {workflow.name}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    {workflow.id}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Workflow Details */}
        <div className="lg:col-span-2">
          {selectedWorkflow ? (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {/* Details Header */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedWorkflow.workflow.name}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedWorkflow.workflow.description}
                </p>
              </div>

              {/* Details Content */}
              <div className="p-6 space-y-6">
                {/* Goal */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Goal</h4>
                  <p className="text-slate-700">
                    {selectedWorkflow.workflow.goal}
                  </p>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                      Number of Tasks
                    </p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {selectedWorkflow.nodeCount}
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                      Est. Duration
                    </p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {Math.round(selectedWorkflow.estimatedDuration / 1000)}s
                    </p>
                  </div>

                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                      Complexity
                    </p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {selectedWorkflow.workflow.complexity || 'moderate'}
                    </p>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
                      Category
                    </p>
                    <p className="text-2xl font-bold text-orange-900 mt-1">
                      {selectedWorkflow.workflow.category || 'General'}
                    </p>
                  </div>
                </div>

                {/* Nodes Summary */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Tasks</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedWorkflow.workflow.nodes.map((node, idx) => (
                      <div
                        key={node.id}
                        className="flex items-start gap-3 p-3 bg-slate-50 rounded border border-slate-200"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex-shrink-0 mt-1">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">
                            {node.name}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {node.description}
                          </p>
                          {node.dependencies.length > 0 && (
                            <p className="text-xs text-slate-500 mt-1">
                              Depends on: {node.dependencies.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleLoadWorkflow(selectedWorkflow.workflow.id)}
                    disabled={isLoadingWorkflow}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-lg font-semibold transition-all duration-200 text-white',
                      isLoadingWorkflow
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                    )}
                  >
                    {isLoadingWorkflow ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      '🚀 Load to Storage'
                    )}
                  </button>

                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        JSON.stringify(selectedWorkflow.workflow, null, 2)
                      )
                    }
                    className="px-4 py-3 rounded-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 transition-all duration-200 active:scale-95"
                  >
                    📋 Copy JSON
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-white rounded-lg border border-slate-200">
              <div className="text-center">
                <p className="text-slate-500 mb-2">Select a workflow to view details</p>
                <p className="text-sm text-slate-400">
                  Choose one from the list on the left
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
