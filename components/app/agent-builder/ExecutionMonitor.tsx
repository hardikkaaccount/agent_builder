'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ExecutionState } from '@/types/agent';
import {
  Play,
  Pause,
  StopCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react';

interface ExecutionMonitorProps {
  executionId: string;
  workflowName?: string;
  autoStart?: boolean;
  onComplete?: (state: ExecutionState) => void;
  onError?: (error: string) => void;
}

/**
 * Real-time execution monitor for workflows
 */
export function ExecutionMonitor({
  executionId,
  workflowName = 'Workflow',
  autoStart = true,
  onComplete,
  onError,
}: ExecutionMonitorProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [executionData, setExecutionData] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch execution status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/agents/monitor-execution?executionId=${executionId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }

      const data = await response.json();
      setExecutionData(data);
      setProgress(data.progress.percentage);

      // Update status
      if (data.status === 'completed') {
        setStatus('completed');
        stopPolling();
        if (onComplete) {
          onComplete(data);
        }
      } else if (data.status === 'failed') {
        setStatus('failed');
        stopPolling();
        if (onError) {
          onError(data.error || 'Execution failed');
        }
      } else if (data.status === 'paused') {
        setStatus('paused');
      } else if (data.status === 'running') {
        setStatus('running');
      }

      // Update logs
      if (data.lastLogEntry && !logs.includes(data.lastLogEntry)) {
        setLogs(prev => [...prev, data.lastLogEntry].slice(-20)); // Keep last 20
      }

      setError(null);
    } catch (err: any) {
      console.error('[ExecutionMonitor] Fetch error:', err);
      setError(err.message);
      if (onError) {
        onError(err.message);
      }
    }
  }, [executionId, logs, onComplete, onError]);

  // Start polling
  const startPolling = useCallback(() => {
    if (!pollingInterval) {
      const interval = setInterval(fetchStatus, 1000); // Poll every 1 second
      setPollingInterval(interval);
      setStatus('running');
    }
  }, [pollingInterval, fetchStatus]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

  // Start execution
  const handleStart = async () => {
    try {
      const response = await fetch('/api/agents/execute-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: executionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start execution: ${response.statusText}`);
      }

      startPolling();
    } catch (err: any) {
      console.error('[ExecutionMonitor] Start error:', err);
      setError(err.message);
    }
  };

  // Pause execution
  const handlePause = async () => {
    try {
      await fetch('/api/agents/monitor-execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId,
          action: 'pause',
        }),
      });
      setStatus('paused');
      stopPolling();
    } catch (err: any) {
      console.error('[ExecutionMonitor] Pause error:', err);
      setError(err.message);
    }
  };

  // Resume execution
  const handleResume = async () => {
    try {
      await fetch('/api/agents/monitor-execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId,
          action: 'resume',
        }),
      });
      startPolling();
    } catch (err: any) {
      console.error('[ExecutionMonitor] Resume error:', err);
      setError(err.message);
    }
  };

  // Cancel execution
  const handleCancel = async () => {
    try {
      await fetch('/api/agents/monitor-execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId,
          action: 'cancel',
        }),
      });
      stopPolling();
      setStatus('failed');
    } catch (err: any) {
      console.error('[ExecutionMonitor] Cancel error:', err);
      setError(err.message);
    }
  };

  // Auto-start on mount
  useEffect(() => {
    if (autoStart) {
      handleStart();
    }

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="text-blue-600" size={24} />
            <div>
              <h2 className="text-lg font-bold text-slate-900">{workflowName}</h2>
              <p className="text-sm text-slate-600">Execution ID: {executionId}</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === 'completed'
              ? 'bg-green-100 text-green-700'
              : status === 'failed'
              ? 'bg-red-100 text-red-700'
              : status === 'paused'
              ? 'bg-yellow-100 text-yellow-700'
              : status === 'running'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-700'
          }`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>
      </div>

      {/* Progress Section */}
      {executionData && (
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-900">Progress</span>
              <span className="text-sm font-bold text-blue-600">{progress}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {executionData.progress.completed}
                </div>
                <div className="text-xs text-slate-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {executionData.progress.running}
                </div>
                <div className="text-xs text-slate-600">Running</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {executionData.progress.failed}
                </div>
                <div className="text-xs text-slate-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-600">
                  {executionData.progress.total}
                </div>
                <div className="text-xs text-slate-600">Total</div>
              </div>
            </div>

            {/* Timing */}
            {executionData.timing && (
              <div className="flex justify-between text-xs text-slate-600 mt-3">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  Elapsed: {Math.round(executionData.timing.elapsedMs / 1000)}s
                </div>
                {executionData.timing.estimatedRemainingMs > 0 && (
                  <div>
                    Est. Remaining: {Math.round(executionData.timing.estimatedRemainingMs / 1000)}s
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Node States */}
      {executionData?.nodeStates && (
        <div className="flex-1 overflow-y-auto border-b border-slate-200 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Node Status</h3>
          <div className="space-y-2">
            {executionData.nodeStates.map((node: any) => (
              <div
                key={node.nodeId}
                className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {node.status === 'completed' ? (
                    <CheckCircle className="text-green-600 flex-shrink-0" size={16} />
                  ) : node.status === 'failed' ? (
                    <AlertCircle className="text-red-600 flex-shrink-0" size={16} />
                  ) : node.status === 'running' ? (
                    <Zap className="text-blue-600 animate-pulse flex-shrink-0" size={16} />
                  ) : (
                    <div className="w-4 h-4 bg-slate-300 rounded-full flex-shrink-0" />
                  )}

                  <span className="text-sm text-slate-900 truncate">{node.nodeId}</span>
                </div>

                <div className="flex items-center gap-2">
                  {node.duration && (
                    <span className="text-xs text-slate-600">{node.duration}ms</span>
                  )}
                  {node.retryCount > 0 && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                      Retry {node.retryCount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="border-b border-slate-200 px-6 py-4 max-h-40 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Logs</h3>
          <div className="space-y-1 font-mono text-xs text-slate-600">
            {logs.map((log, i) => (
              <div key={i} className="truncate">{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex gap-2">
        {status === 'idle' && (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Play size={16} />
            Start
          </button>
        )}

        {status === 'running' && (
          <button
            onClick={handlePause}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
          >
            <Pause size={16} />
            Pause
          </button>
        )}

        {status === 'paused' && (
          <>
            <button
              onClick={handleResume}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Play size={16} />
              Resume
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <StopCircle size={16} />
              Cancel
            </button>
          </>
        )}

        {status !== 'idle' && status !== 'running' && (
          <div className="text-sm text-slate-600">
            {status === 'completed' && '✓ Execution completed'}
            {status === 'failed' && '✗ Execution failed'}
            {status === 'paused' && '⏸ Execution paused'}
          </div>
        )}
      </div>
    </div>
  );
}
