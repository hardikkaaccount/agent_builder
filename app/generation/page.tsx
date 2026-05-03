'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Workflow, ExecutionState } from '@/types/agent';
import { WorkflowBuilder } from '@/components/app/agent-builder/WorkflowBuilder';
import { OutputRenderer } from '@/components/app/execution/OutputRenderer';
import {
  Sparkles, AlertCircle, CheckCircle, Network, ChevronDown,
  Cpu, ShieldCheck, Activity, MessageSquare, Send, Bot, User,
  Settings, History, Layers, Search, Zap, TerminalSquare,
  FileOutput, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  id: string;
}

interface SSENodeState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  outputPreview?: string;
  error?: string;
  duration?: number;
}

interface TelemetryEntry {
  type: string;
  nodeId?: string;
  nodeName?: string;
  message?: string;
  level?: string;
  tool?: string;
  timestamp: string;
}

type RightPanelView = 'dag' | 'output' | 'telemetry';

export default function GenerationPage() {
  const [goal, setGoal] = useState('');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([{
    id: '1', role: 'assistant',
    content: 'System online. I am your Master Orchestrator. Describe your objective and I will architect a multi-agent system to execute it.',
    timestamp: new Date()
  }]);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodeStates, setNodeStates] = useState<Record<string, SSENodeState>>({});
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([]);
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, string>>({});
  const [executionComplete, setExecutionComplete] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanelView>('dag');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const telemetryEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { telemetryEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [telemetry]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role, content, timestamp: new Date() }]);
  };

  const addTelemetry = useCallback((entry: TelemetryEntry) => {
    setTelemetry(prev => [...prev.slice(-200), entry]);
  }, []);

  const handleGenerateWorkflow = async (userGoal: string) => {
    if (!userGoal.trim()) return;
    setLoading(true);
    setError('');
    addMessage('user', userGoal);
    setGoal('');

    try {
      const res = await fetch('/api/agents/master-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: userGoal, userPrompt: userGoal, constraints: [] }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'API error');
      const data = await res.json();
      setWorkflow(data.workflow);
      setNodeStates({});
      setTelemetry([]);
      setNodeOutputs({});
      setExecutionComplete(false);
      setRightPanel('dag');
      addMessage('assistant',
        `✅ Synthesized **${data.workflow.name}** — ${data.workflow.nodes.length} specialized agents across ${data.workflow.nodes.length} execution stages.\n\nClick **Execute Pipeline** to run the workflow in real-time.`
      );
    } catch (err: any) {
      const msg = err.message || 'Synthesis failed';
      setError(msg);
      addMessage('assistant', `❌ Synthesis failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteWorkflow = useCallback(() => {
    if (!workflow || isExecuting) return;

    setIsExecuting(true);
    setExecutionComplete(false);
    setTelemetry([]);
    setNodeOutputs({});
    // Reset all nodes to pending
    const initial: Record<string, SSENodeState> = {};
    workflow.nodes.forEach(n => { initial[n.id] = { status: 'pending' }; });
    setNodeStates(initial);
    setRightPanel('dag');

    addMessage('assistant', `🚀 Execution started — ${workflow.nodes.length} agents deploying...`);

    // Use XHR for SSE-style streaming over POST
    const xhr = new XMLHttpRequest();
    eventSourceRef.current = xhr;
    let offset = 0;

    xhr.open('POST', '/api/agents/execute-stream', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onprogress = () => {
      const chunk = xhr.responseText.slice(offset);
      offset = xhr.responseText.length;

      const lines = chunk.split('\n');
      let eventType = '';
      let dataStr = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataStr = line.slice(6).trim();
          if (eventType && dataStr) {
            try {
              const data = JSON.parse(dataStr);
              handleSSEEvent(eventType, data);
            } catch {}
            eventType = '';
            dataStr = '';
          }
        }
      }
    };

    xhr.onload = () => {
      setIsExecuting(false);
    };

    xhr.onerror = () => {
      setIsExecuting(false);
      setError('Connection to execution engine lost');
      addMessage('assistant', '❌ Connection lost. Please retry.');
    };

    xhr.send(JSON.stringify({ workflow }));
  }, [workflow, isExecuting]);

  const handleSSEEvent = useCallback((type: string, data: any) => {
    // Skip heartbeat from telemetry — it's just a keepalive
    if (type === 'heartbeat') return;

    addTelemetry({ type, nodeId: data.nodeId, nodeName: data.nodeName, timestamp: data.timestamp });

    switch (type) {
      case 'node_started':
        setNodeStates(prev => ({ ...prev, [data.nodeId]: { status: 'running' } }));
        break;

      case 'node_log':
      case 'node_tool_call':
      case 'node_tool_result':
        addTelemetry({
          type,
          nodeId: data.nodeId,
          nodeName: data.nodeName,
          message: data.message || (type === 'node_tool_call' ? `Calling tool: ${data.tool}` : `Tool result received: ${data.tool}`),
          level: data.level || 'info',
          tool: data.tool,
          timestamp: data.timestamp,
        });
        break;

      case 'node_completed':
        setNodeStates(prev => ({
          ...prev,
          [data.nodeId]: { status: 'completed', outputPreview: data.outputPreview, duration: data.duration }
        }));
        break;

      case 'node_failed':
        setNodeStates(prev => ({
          ...prev,
          [data.nodeId]: { status: 'failed', error: data.error }
        }));
        break;

      case 'workflow_completed': {
        setExecutionComplete(true);
        setIsExecuting(false);
        const outputs: Record<string, string> = {};
        if (data.nodeOutputs) {
          Object.entries(data.nodeOutputs).forEach(([nodeId, out]: [string, any]) => {
            const node = workflow?.nodes.find(n => n.id === nodeId);
            if (node) outputs[node.name] = out?._raw || JSON.stringify(out);
          });
        }
        setNodeOutputs(outputs);
        setRightPanel('output');
        addMessage('assistant',
          `✅ **Workflow complete!** All ${Object.keys(data.nodeOutputs || {}).length} agents finished successfully. View results in the **Output** panel →`
        );
        break;
      }

      case 'workflow_failed':
        setIsExecuting(false);
        addMessage('assistant', `❌ Workflow failed: ${data.reason}`);
        break;

      case 'workflow_aborted':
        setIsExecuting(false);
        addMessage('assistant', `⏹️ Workflow aborted. ${data.completedNodes?.length || 0} nodes completed before abort.`);
        break;

      case 'execution_summary':
        addTelemetry({
          type: 'execution_summary',
          message: `Summary: ${data.nodesCompleted}/${data.nodesTotal} nodes, ${data.totalTokens?.prompt + data.totalTokens?.completion} tokens, ${data.totalToolCalls} tool calls, ${data.totalRetries} retries`,
          timestamp: data.timestamp,
        });
        break;
    }
  }, [workflow, addTelemetry]);


  // Build an executionState-compatible object for WorkflowBuilder
  const executionState: ExecutionState | undefined = workflow ? {
    id: 'live',
    workflowId: workflow.id,
    status: isExecuting ? 'running' : executionComplete ? 'completed' : 'pending' as any,
    startTime: new Date(),
    nodeStates: Object.fromEntries(
      Object.entries(nodeStates).map(([nodeId, s]) => [nodeId, {
        nodeId, workflowId: workflow.id, executionId: 'live',
        status: s.status === 'completed' ? 'success' : s.status as any,
        retryCount: 0, maxRetries: 2, input: {}, logs: [],
        output: s.outputPreview ? { preview: s.outputPreview } : undefined,
        error: s.error ? { message: s.error } : undefined,
      }])
    ),
    globalContext: {},
    completedNodes: Object.entries(nodeStates).filter(([,s]) => s.status === 'completed').map(([id]) => id),
    failedNodes: Object.entries(nodeStates).filter(([,s]) => s.status === 'failed').map(([id]) => id),
    skippedNodes: [],
    nodesCompleted: Object.values(nodeStates).filter(s => s.status === 'completed').length,
    nodesFailed: Object.values(nodeStates).filter(s => s.status === 'failed').length,
    logs: telemetry.map(t => ({
      timestamp: new Date(t.timestamp),
      level: (t.level as any) || 'info',
      message: t.message || t.type,
      source: 'worker' as any,
      nodeId: t.nodeId,
    })),
  } : undefined;

  return (
    <div className="h-screen w-full bg-[#020617] text-[#F8FAFC] flex flex-col overflow-hidden" style={{ fontFamily: "'Fira Sans', system-ui, sans-serif" }}>

      {/* Header — fixed height, always visible */}
      <header className="relative z-50 h-14 min-h-[56px] shrink-0 border-b border-[#1E293B]/60 bg-[#0F172A] px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#22C55E] flex items-center justify-center">
            <Sparkles size={16} className="text-[#020617]" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-[#F8FAFC] leading-none block">AgentFlow</span>
            <span className="text-[9px] font-medium text-[#22C55E]/70 uppercase tracking-widest" style={{ fontFamily: "'Fira Code', monospace" }}>v3.0 · engine</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2">
            {[
              { icon: <Cpu size={11} className="text-[#22C55E]" />, label: 'Nova Pro' },
              { icon: <ShieldCheck size={11} className="text-cyan-400" />, label: 'Secure' },
              { icon: <Activity size={11} className={isExecuting ? 'text-[#22C55E] animate-pulse' : 'text-slate-600'} />, label: isExecuting ? 'Live' : 'Idle' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1E293B]/50 border border-[#1E293B] text-[9px] font-semibold text-slate-400 uppercase tracking-wider" style={{ fontFamily: "'Fira Code', monospace" }}>
                {icon} {label}
              </div>
            ))}
          </div>
          <div className="w-px h-5 bg-[#1E293B]" />
          <button className="p-2 rounded-lg bg-[#1E293B]/50 border border-[#1E293B] text-slate-400 hover:text-[#F8FAFC] hover:bg-[#1E293B] transition-colors duration-200 cursor-pointer">
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Main body — fills remaining space */}
      <main className="flex-1 flex min-h-0 gap-[1px] p-2 pt-2">
        {/* ── Left: Chat ── */}
        <section className="w-[360px] shrink-0 border border-[#1E293B]/60 bg-[#0F172A]/30 flex flex-col min-h-0 rounded-xl overflow-hidden">
          <div className="h-12 shrink-0 px-5 border-b border-[#1E293B]/60 bg-[#0F172A]/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={13} className="text-[#22C55E]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400" style={{ fontFamily: "'Fira Code', monospace" }}>Orchestrator</span>
            </div>
            <History size={13} className="text-slate-600 cursor-pointer hover:text-[#F8FAFC] transition-colors duration-200" />
          </div>

          <div className="flex-1 overflow-auto px-5 py-4 space-y-5 no-scrollbar">
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center ${
                  msg.role === 'assistant'
                    ? 'bg-[#22C55E]/10 text-[#22C55E]'
                    : 'bg-[#1E293B] text-slate-400'
                }`}>
                  {msg.role === 'assistant' ? <Bot size={13} /> : <User size={13} />}
                </div>
                <div className={`flex flex-col gap-1 max-w-[82%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`px-3 py-2.5 rounded-lg text-[12px] leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'bg-[#1E293B]/40 border border-[#1E293B]/60 text-slate-300'
                      : 'bg-[#22C55E] text-[#020617] font-semibold'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[8px] text-slate-600 uppercase px-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#22C55E]/10 flex items-center justify-center">
                  <Bot size={13} className="text-[#22C55E] animate-pulse" />
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-[#1E293B]/40 border border-[#1E293B]/60 text-slate-500 italic text-xs">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]/40 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]/40 animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]/40 animate-pulse" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="shrink-0 p-4 border-t border-[#1E293B]/60 bg-[#0F172A]/60">
            <div className="relative bg-[#020617] rounded-lg border border-[#1E293B] overflow-hidden focus-within:border-[#22C55E]/30 transition-colors duration-200">
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateWorkflow(goal); } }}
                placeholder="Describe your objective..."
                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-xs text-[#F8FAFC] p-3 pr-12 resize-none h-[56px] placeholder:text-slate-600" style={{ fontFamily: "'Fira Sans', sans-serif" }}
              />
              <button onClick={() => handleGenerateWorkflow(goal)} disabled={loading || !goal.trim()}
                className="absolute bottom-2 right-2 p-2 rounded-md bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer">
                <Send size={14} />
              </button>
            </div>
            <p className="text-[8px] text-slate-600 uppercase tracking-widest mt-1 px-1" style={{ fontFamily: "'Fira Code', monospace" }}>Enter to send · Shift+Enter for newline</p>
          </div>
        </section>

        {/* ── Right: Canvas ── */}
        <section className="flex-1 bg-[#020617] flex flex-col min-h-0 min-w-0 border border-[#1E293B]/60 rounded-xl overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="h-12 shrink-0 border-b border-[#1E293B]/60 px-5 flex items-center justify-between bg-[#0F172A]/40 z-20">
            <div className="flex items-center gap-1">
              {([
                { id: 'dag', icon: <LayoutGrid size={12} />, label: 'Pipeline' },
                { id: 'output', icon: <FileOutput size={12} />, label: 'Output' },
                { id: 'telemetry', icon: <TerminalSquare size={12} />, label: 'Logs' },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setRightPanel(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
                    rightPanel === tab.id
                      ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
                      : 'text-slate-500 hover:text-[#F8FAFC] hover:bg-[#1E293B]/40 border border-transparent'
                  }`} style={{ fontFamily: "'Fira Code', monospace" }}>
                  {tab.icon} {tab.label}
                  {tab.id === 'output' && executionComplete && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] ml-1" />
                  )}
                </button>
              ))}
              {workflow && (
                <>
                  <div className="w-px h-4 bg-[#1E293B] mx-3" />
                  <span className="text-[10px] font-medium text-slate-400 truncate max-w-[200px]">{workflow.name}</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#1E293B] text-[9px] font-semibold text-slate-400 ml-2" style={{ fontFamily: "'Fira Code', monospace" }}>
                    {workflow.nodes.length} nodes
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {workflow && (
                <button onClick={handleExecuteWorkflow} disabled={isExecuting}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-[#22C55E] text-[#020617] text-[10px] font-bold uppercase tracking-wider hover:bg-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer glow-box-green" style={{ fontFamily: "'Fira Code', monospace" }}>
                  {isExecuting ? <Activity size={12} className="animate-spin" /> : <Zap size={12} />}
                  {isExecuting ? 'Running...' : 'Execute'}
                </button>
              )}
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 relative min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {/* DAG Panel */}
              {rightPanel === 'dag' && (
                <motion.div key="dag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                  {workflow ? (
                    <WorkflowBuilder
                      workflow={workflow}
                      onExecute={() => handleExecuteWorkflow()}
                      isLoading={isExecuting}
                      executionState={executionState}
                      editable={true}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center max-w-xs">
                        <div className="w-14 h-14 rounded-xl bg-[#1E293B]/30 border border-[#1E293B] flex items-center justify-center mx-auto mb-5">
                          <Network size={24} className="text-slate-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-400 mb-2">Awaiting Pipeline</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">Describe your objective in the chat to generate a multi-agent workflow.</p>
                      </div>
                      <div className="absolute inset-0 -z-10 opacity-[0.015] bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:40px_40px]" />
                    </div>
                  )}
                </motion.div>
              )}

              {/* Output Panel */}
              {rightPanel === 'output' && (
                <motion.div key="output" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                  <OutputRenderer nodeOutputs={nodeOutputs} workflowName={workflow?.name || 'Workflow'} />
                </motion.div>
              )}

              {/* Telemetry Panel */}
              {rightPanel === 'telemetry' && (
                <motion.div key="telemetry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col bg-[#020617]">
                  <div className="flex-1 overflow-auto p-6 text-[10px] space-y-1.5 no-scrollbar" style={{ fontFamily: "'Fira Code', monospace" }}>
                    {telemetry.length === 0 ? (
                      <div className="text-slate-600 italic mt-8 text-center text-xs">Execute a pipeline to see real-time logs.</div>
                    ) : (
                      telemetry.map((t, i) => (
                        <div key={i} className="flex gap-3 group items-start py-0.5 hover:bg-[#1E293B]/20 px-2 -mx-2 rounded transition-colors duration-150">
                          <span className="text-slate-700 shrink-0 tabular-nums">[{new Date(t.timestamp).toLocaleTimeString()}]</span>
                          <span className={`shrink-0 w-16 font-semibold uppercase ${
                            t.type === 'node_failed' || t.level === 'error' ? 'text-red-400' :
                            t.type === 'node_tool_call' ? 'text-amber-400' :
                            t.type === 'node_completed' || t.type === 'workflow_completed' ? 'text-[#22C55E]' :
                            'text-cyan-400'
                          }`}>{t.type.replace('node_', '').replace('workflow_', 'wf_').slice(0, 10)}</span>
                          <span className="text-slate-500 group-hover:text-slate-300 transition-colors duration-200">
                            {t.nodeName && <span className="text-slate-600">[{t.nodeName}] </span>}
                            {t.message || t.type}
                          </span>
                        </div>
                      ))
                    )}
                    {isExecuting && (
                      <div className="flex gap-3 italic text-cyan-400/30 animate-pulse px-2">
                        <span className="text-slate-700">[{new Date().toLocaleTimeString()}]</span>
                        <span className="w-16 font-semibold">STREAM</span>
                        <span>awaiting next cycle...</span>
                      </div>
                    )}
                    <div ref={telemetryEndRef} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating Error Toast */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                  className="absolute bottom-4 right-4 z-50 p-3.5 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 items-start backdrop-blur-md max-w-sm">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={14} />
                  <div>
                    <p className="text-xs font-medium text-red-200 leading-relaxed">{error}</p>
                    <button onClick={() => setError('')} className="text-[9px] text-red-400 hover:text-red-300 mt-1 uppercase tracking-widest cursor-pointer transition-colors duration-200" style={{ fontFamily: "'Fira Code', monospace" }}>Dismiss</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}
