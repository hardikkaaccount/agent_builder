'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Workflow, AgentNode, NodeExecution, ExecutionState } from '@/types/agent';
import { 
  Zap, 
  Save, 
  Trash2, 
  Play, 
  Activity, 
  Settings, 
  Database, 
  Shield, 
  Cpu, 
  Code, 
  ChevronRight, 
  ArrowRight,
  Workflow as WorkflowIcon,
  Search,
  Plus,
  Layers,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkflowBuilderProps {
  workflow: Workflow;
  onExecute?: (workflowId: string) => void;
  onSave?: (workflow: Workflow) => void;
  onDelete?: (workflowId: string) => void;
  isLoading?: boolean;
  editable?: boolean;
  executionState?: ExecutionState;
}

/**
 * WorkflowBuilder - UI/UX Pro Max Edition (v2.6)
 * A premium, technical DAG visualization for agentic workflows with SVG connections.
 */
export function WorkflowBuilder({
  workflow,
  onExecute,
  onSave,
  onDelete,
  isLoading = false,
  editable = false,
  executionState,
}: WorkflowBuilderProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const selectedNodeData = useMemo(() => 
    workflow.nodes.find(n => n.id === selectedNode),
    [workflow.nodes, selectedNode]
  );

  const stages = useMemo(() => getStages(workflow), [workflow]);

  return (
    <div className="relative flex flex-col h-full bg-transparent select-none overflow-hidden" style={{ fontFamily: "'Fira Sans', system-ui, sans-serif" }}>
      {/* Main Canvas */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Canvas Background Grid */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(30,41,59,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.15)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_60%,transparent_100%)]" />
        </div>

        <div className="flex-1 relative overflow-auto p-20 no-scrollbar">
          <div className="flex flex-col gap-24 max-w-5xl mx-auto relative z-10">
            {/* SVG Connection Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minHeight: '100%' }}>
              <defs>
                <linearGradient id="line-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(34, 197, 94, 0.3)" />
                  <stop offset="100%" stopColor="rgba(34, 211, 238, 0.3)" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              {stages.map((stage, stageIdx) => (
                stageIdx < stages.length - 1 && (
                  <React.Fragment key={`connections-${stageIdx}`}>
                    {stage.nodes.map(node => (
                      stages[stageIdx + 1].nodes.map(nextNode => {
                        if (nextNode.dependencies.includes(node.id)) {
                          return (
                            <motion.path
                              key={`${node.id}-${nextNode.id}`}
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ duration: 1, delay: stageIdx * 0.2 }}
                              d={`M ${getAnchorX(node, stage, stageIdx)} ${getAnchorY(node, stage, stageIdx)} C ${getAnchorX(node, stage, stageIdx)} ${getAnchorY(node, stage, stageIdx) + 60}, ${getAnchorX(nextNode, stages[stageIdx+1], stageIdx+1)} ${getAnchorY(nextNode, stages[stageIdx+1], stageIdx+1) - 60}, ${getAnchorX(nextNode, stages[stageIdx+1], stageIdx+1)} ${getAnchorY(nextNode, stages[stageIdx+1], stageIdx+1)}`}
                              stroke="url(#line-gradient)"
                              strokeWidth="2"
                              fill="none"
                              filter="url(#glow)"
                              strokeDasharray="6 6"
                              className="animate-[dash_30s_linear_infinite]"
                            />
                          );
                        }
                        return null;
                      })
                    ))}
                  </React.Fragment>
                )
              ))}
            </svg>

            {/* Hierarchical Stages View */}
            {stages.map((stage, stageIdx) => (
              <div key={stageIdx} className="flex flex-col gap-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="px-4 py-1.5 rounded-lg bg-[#0F172A] border border-[#1E293B] text-[9px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: "'Fira Code', monospace" }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    Stage {stageIdx + 1}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-[#1E293B] to-transparent" />
                </div>
                
                <div className="flex flex-wrap justify-center gap-12">
                  {stage.nodes.map(node => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      isSelected={selectedNode === node.id}
                      onClick={() => setSelectedNode(node.id)}
                      execution={executionState?.nodeStates[node.id]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas Controls */}
        <div className="absolute bottom-6 left-6 flex items-center gap-1 p-1.5 bg-[#0F172A] border border-[#1E293B] rounded-xl z-30">
          {[
            { icon: Plus, label: 'Zoom In' },
            { icon: Search, label: 'Fit View' },
            { icon: Layers, label: 'Auto Layout' }
          ].map((control, i) => (
            <button key={i} className="p-2 rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-[#F8FAFC] transition-colors duration-200 cursor-pointer group relative" title={control.label}>
              <control.icon size={16} />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-[#1E293B] text-[8px] font-medium text-[#F8FAFC] opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap uppercase tracking-wider pointer-events-none" style={{ fontFamily: "'Fira Code', monospace" }}>
                {control.label}
              </span>
            </button>
          ))}
        </div>

        {/* Details Side Panel */}
        <AnimatePresence>
          {selectedNodeData && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-[400px] bg-[#0F172A] border-l border-[#1E293B] overflow-hidden flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.6)] relative z-40"
            >
              <NodeDetailsPanel 
                node={selectedNodeData} 
                workflow={workflow} 
                execution={executionState?.nodeStates[selectedNodeData.id]}
                onClose={() => setSelectedNode(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -1000;
          }
        }
      `}</style>
    </div>
  );
}

// Helper functions for SVG anchors (Approximate for static layout)
function getAnchorX(node: AgentNode, stage: { nodes: AgentNode[] }, stageIdx: number) {
  const nodeIdx = stage.nodes.indexOf(node);
  const totalNodes = stage.nodes.length;
  const containerWidth = 1000; // Hypothetical container width
  return (containerWidth / (totalNodes + 1)) * (nodeIdx + 1);
}

function getAnchorY(node: AgentNode, stage: { nodes: AgentNode[] }, stageIdx: number) {
  return stageIdx * 300 + 100; // stage height + offset
}

/**
 * Node Card - UI/UX Pro Max Edition
 */
function NodeCard({ 
  node, 
  isSelected, 
  onClick,
  execution 
}: { 
  node: AgentNode; 
  isSelected: boolean; 
  onClick: () => void;
  execution?: NodeExecution;
}) {
  const status = execution?.status || 'pending';
  
  const statusConfig = {
    pending: { color: 'text-slate-500', border: 'border-[#1E293B]', glow: 'transparent', icon: Clock },
    running: { color: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'rgba(34,211,238,0.08)', icon: Activity },
    completed: { color: 'text-[#22C55E]', border: 'border-[#22C55E]/30', glow: 'rgba(34,197,94,0.08)', icon: CheckCircle2 },
    failed: { color: 'text-red-400', border: 'border-red-500/30', glow: 'rgba(239,68,68,0.08)', icon: AlertCircle },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`relative w-[300px] rounded-2xl cursor-pointer transition-all duration-200 group ${
        isSelected ? 'ring-1 ring-[#22C55E]/40 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'hover:shadow-[0_0_30px_rgba(34,197,94,0.05)]'
      }`}
    >
      <div className={`w-full h-full bg-[#0F172A] rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden border ${config.border} transition-colors duration-200`}>
        {/* Status Background Glow */}
        <div 
          className="absolute top-0 right-0 w-28 h-28 blur-3xl opacity-30 pointer-events-none transition-colors duration-300" 
          style={{ backgroundColor: config.glow }}
        />

        <div className="flex items-start justify-between relative z-10">
          <div className={`p-2.5 rounded-xl bg-[#020617] border ${config.border} flex items-center justify-center transition-colors duration-200`}>
            <Icon className={`w-5 h-5 ${config.color} ${status === 'running' ? 'animate-pulse' : ''}`} />
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-[9px] font-semibold uppercase tracking-widest ${config.color} mb-2 transition-colors duration-200`} style={{ fontFamily: "'Fira Code', monospace" }}>
              {status}
            </span>
            <div className="flex -space-x-1.5">
              <div className="w-5 h-5 rounded-full bg-[#020617] border border-[#1E293B] flex items-center justify-center" title="Model">
                <Cpu size={10} className="text-slate-500" />
              </div>
              <div className="w-5 h-5 rounded-full bg-[#020617] border border-[#1E293B] flex items-center justify-center" title="Context">
                <Layers size={10} className="text-slate-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <h4 className="text-sm font-semibold text-[#F8FAFC] mb-1.5 group-hover:text-[#22C55E] transition-colors duration-200 tracking-tight">
            {node.name}
          </h4>
          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
            {node.task}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[#1E293B]/60 relative z-10" style={{ fontFamily: "'Fira Code', monospace" }}>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#020617] border border-[#1E293B] text-[8px] font-medium uppercase tracking-wider text-slate-500 group-hover:text-[#22C55E] transition-colors duration-200">
            <Cpu size={10} className="text-[#22C55E]/50 group-hover:text-[#22C55E]" />
            {(node.model ?? '').split('/').pop()?.split(':').shift() ?? 'default'}
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#020617] border border-[#1E293B] text-[8px] font-medium uppercase tracking-wider text-slate-500 group-hover:text-cyan-400 transition-colors duration-200">
            <Shield size={10} className="text-cyan-400/50 group-hover:text-cyan-400" />
            {node.role}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Node Details Panel - UI/UX Pro Max Edition
 */
function NodeDetailsPanel({ 
  node, 
  workflow, 
  execution,
  onClose 
}: { 
  node: AgentNode; 
  workflow: Workflow; 
  execution?: NodeExecution;
  onClose: () => void;
}) {
  const dependentNodes = workflow.nodes.filter(n => n.dependencies.includes(node.id));
  const parentNodes = workflow.nodes.filter(n => node.dependencies.includes(n.id));

  return (
    <div className="h-full flex flex-col p-8 select-text no-scrollbar overflow-auto bg-[#0F172A]" style={{ fontFamily: "'Fira Sans', system-ui, sans-serif" }}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#22C55E]" />
          </div>
          <h2 className="text-lg font-semibold text-[#F8FAFC] tracking-tight">Configuration</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-2.5 rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-[#F8FAFC] transition-colors duration-200 cursor-pointer"
        >
          <ChevronDown className="w-5 h-5 rotate-[-90deg]" />
        </button>
      </div>

      <div className="space-y-8">
        {/* Core Identity */}
        <section>
          <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-3 ml-0.5 block" style={{ fontFamily: "'Fira Code', monospace" }}>Agent Identity</label>
          <div className="p-5 bg-[#020617] rounded-xl border border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#F8FAFC]">{node.name}</span>
              <span className="text-[9px] text-slate-600" style={{ fontFamily: "'Fira Code', monospace" }}>ID: {node.id}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "{node.task}"
            </p>
          </div>
        </section>

        {/* Model Spec */}
        <section>
          <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-3 ml-0.5 block" style={{ fontFamily: "'Fira Code', monospace" }}>Compute Spec</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[#020617] border border-[#1E293B] rounded-xl flex flex-col gap-1.5 hover:border-[#1E293B]/80 transition-colors duration-200">
              <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider" style={{ fontFamily: "'Fira Code', monospace" }}>Model</span>
              <span className="text-xs font-medium text-slate-300 truncate" style={{ fontFamily: "'Fira Code', monospace" }}>{(node.model ?? 'default').split('/').pop()}</span>
            </div>
            <div className="p-4 bg-[#020617] border border-[#1E293B] rounded-xl flex flex-col gap-1.5 hover:border-[#1E293B]/80 transition-colors duration-200">
              <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider" style={{ fontFamily: "'Fira Code', monospace" }}>Entropy</span>
              <span className="text-xs font-medium text-slate-300" style={{ fontFamily: "'Fira Code', monospace" }}>0.7 (Stable)</span>
            </div>
          </div>
        </section>

        {/* Data Lineage */}
        <section>
          <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-3 ml-0.5 block" style={{ fontFamily: "'Fira Code', monospace" }}>Pipeline Topology</label>
          <div className="space-y-3">
            {parentNodes.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[9px] text-slate-600 font-medium ml-0.5 uppercase" style={{ fontFamily: "'Fira Code', monospace" }}>Inherits From</span>
                <div className="flex flex-wrap gap-2">
                  {parentNodes.map(p => (
                    <div key={p.id} className="px-3 py-1.5 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20 text-[10px] text-[#22C55E] font-medium flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-[#22C55E]" />
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {dependentNodes.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[9px] text-slate-600 font-medium ml-0.5 uppercase" style={{ fontFamily: "'Fira Code', monospace" }}>Propagates To</span>
                <div className="flex flex-wrap gap-2">
                  {dependentNodes.map(d => (
                    <div key={d.id} className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 font-medium flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-cyan-400" />
                      {d.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Agent Output Data */}
        {execution?.output && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[9px] font-semibold text-[#22C55E] uppercase tracking-widest ml-0.5" style={{ fontFamily: "'Fira Code', monospace" }}>Result</label>
              <button className="text-[9px] text-slate-500 hover:text-[#22C55E] flex items-center gap-1.5 font-medium transition-colors duration-200 cursor-pointer" style={{ fontFamily: "'Fira Code', monospace" }}>
                <ExternalLink size={11} /> VIEW
              </button>
            </div>
            <div className="bg-[#020617] border border-[#22C55E]/20 rounded-xl p-5 overflow-hidden">
              <pre className="text-[10px] text-[#22C55E]/80 overflow-auto max-h-[400px] whitespace-pre-wrap leading-relaxed select-text no-scrollbar" style={{ fontFamily: "'Fira Code', monospace" }}>
                {JSON.stringify(execution.output, null, 2)}
              </pre>
            </div>
          </section>
        )}

        {/* Error Handling */}
        {execution?.error && (
          <section>
            <label className="text-[9px] font-semibold text-red-400 uppercase tracking-widest ml-0.5 mb-3 block" style={{ fontFamily: "'Fira Code', monospace" }}>Fault Diagnosis</label>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
              <p className="text-xs text-red-300 leading-relaxed" style={{ fontFamily: "'Fira Code', monospace" }}>
                {execution.error.message}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Utility: Group nodes into stages for hierarchical visualization
 */
function getStages(workflow: Workflow): { nodes: AgentNode[] }[] {
  const stages: { nodes: AgentNode[] }[] = [];
  const processed = new Set<string>();
  let remaining = [...workflow.nodes];

  while (remaining.length > 0) {
    const stageNodes = remaining.filter(node => 
      node.dependencies.every(depId => processed.has(depId))
    );

    if (stageNodes.length === 0) break; // Circular dependency safety

    stages.push({ nodes: stageNodes });
    stageNodes.forEach(node => {
      processed.add(node.id);
      remaining = remaining.filter(n => n.id !== node.id);
    });
  }

  return stages;
}
