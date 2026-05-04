'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, Bot, User, Loader2, RefreshCw, ExternalLink,
  Code2, Network, Eye, FileCode, ChevronRight, Terminal, X,
  FolderOpen, File, Activity, Cpu, Play, AlertCircle, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface GeneratedFile {
  path: string;
  content: string;
}

interface BuilderState {
  phase: 'idle' | 'creating-sandbox' | 'generating' | 'applying' | 'ready' | 'editing' | 'error';
  sandboxId: string | null;
  sandboxUrl: string | null;
  files: GeneratedFile[];
  error: string | null;
}

type RightTab = 'preview' | 'code' | 'nodes';

// ─────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1', role: 'assistant',
      content: 'Welcome to AgentFlow. Describe the AI agent you want to build and I\'ll generate a complete working application for you.\n\nExamples:\n• "Build a travel planning agent"\n• "Create a code review assistant"\n• "Make a customer support chatbot"',
      timestamp: new Date()
    }
  ]);
  const [state, setState] = useState<BuilderState>({
    phase: 'idle',
    sandboxId: null,
    sandboxUrl: null,
    files: [],
    error: null,
  });
  const [rightTab, setRightTab] = useState<RightTab>('preview');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [streamingText, setStreamingText] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageCounterRef = useRef(0);

  const createMessageId = useCallback(() => {
    messageCounterRef.current += 1;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `msg-${Date.now()}-${messageCounterRef.current}`;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((role: 'user' | 'assistant' | 'system', content: string) => {
    setMessages(prev => [...prev, {
      id: createMessageId(),
      role,
      content,
      timestamp: new Date()
    }]);
  }, [createMessageId]);

  // ─── Step 1: Create Sandbox ────────────────────────────────
  const createSandbox = useCallback(async (): Promise<{ sandboxId: string; url: string } | null> => {
    setState(prev => ({ ...prev, phase: 'creating-sandbox', error: null }));
    addMessage('system', 'Setting up sandbox environment...');

    try {
      const res = await fetch('/api/create-ai-sandbox', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create sandbox');
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Sandbox creation failed');

      setState(prev => ({
        ...prev,
        sandboxId: data.sandboxId,
        sandboxUrl: data.url,
      }));
      addMessage('system', 'Sandbox ready. Generating your agent...');
      return { sandboxId: data.sandboxId, url: data.url };
    } catch (err: any) {
      setState(prev => ({ ...prev, phase: 'error', error: err.message }));
      addMessage('assistant', `Failed to create sandbox: ${err.message}`);
      return null;
    }
  }, [addMessage]);

  // ─── Step 2: Generate Code ─────────────────────────────────
  const generateCode = useCallback(async (userPrompt: string, sandboxId: string, isEdit: boolean): Promise<string | null> => {
    setState(prev => ({ ...prev, phase: isEdit ? 'editing' : 'generating' }));

    try {
      const res = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: isEdit
            ? userPrompt
            : `Build a complete, production-quality React application for the following AI agent:\n\n"${userPrompt}"\n\nRequirements:\n- Create a beautiful, modern dark-themed UI using Tailwind CSS\n- Include all necessary components (input forms, output displays, loading states)\n- Add realistic mock functionality that demonstrates the agent's capabilities\n- Include placeholder environment variable references where real API integrations would go (e.g. process.env.REACT_APP_API_KEY)\n- Make it fully interactive and responsive\n- Use lucide-react for icons\n- Add smooth animations and transitions\n- Include a header with the agent name and a professional layout`,
          model: 'google/gemini-2.5-flash',
          isEdit,
          context: {
            sandboxId,
            currentFiles: {}
          }
        })
      });

      if (!res.ok) throw new Error('Code generation failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'stream' && data.text) {
                fullResponse += data.text;
                setStreamingText(fullResponse.slice(-200));
              } else if (data.type === 'status') {
                addMessage('system', data.message);
              } else if (data.type === 'conversation' && data.text) {
                // AI explanation text — show to user
                
              } else if (data.type === 'component') {
                addMessage('system', `Generated: ${data.name}`);
              } else if (data.type === 'complete') {
                fullResponse = data.generatedCode || fullResponse;
              } else if (data.type === 'warning') {
                addMessage('system', `Warning: ${data.message}`);
              }
            } catch { /* skip parse errors */ }
          }
        }
      }

      setStreamingText('');
      return fullResponse;
    } catch (err: any) {
      setState(prev => ({ ...prev, phase: 'error', error: err.message }));
      addMessage('assistant', `Code generation failed: ${err.message}`);
      return null;
    }
  }, [addMessage]);

  // ─── Step 3: Apply Code ────────────────────────────────────
  const applyCode = useCallback(async (response: string, sandboxId: string, isEdit: boolean): Promise<boolean> => {
    setState(prev => ({ ...prev, phase: 'applying' }));
    addMessage('system', 'Applying code to sandbox...');

    try {
      const res = await fetch('/api/apply-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response,
          isEdit,
          sandboxId,
          packages: []
        })
      });

      if (!res.ok) throw new Error('Failed to apply code');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'file-complete') {
                addMessage('system', `Applied: ${data.fileName}`);
              } else if (data.type === 'file-progress') {
                // File being written — silent
              } else if (data.type === 'step') {
                addMessage('system', data.message);
              } else if (data.type === 'package-progress') {
                if (data.message) addMessage('system', data.message);
              } else if (data.type === 'error') {
                addMessage('system', `Error: ${data.error}`);
              } else if (data.type === 'complete') {
                // Done
              }
            } catch { /* skip */ }
          }
        }
      }

      // Fetch file contents from sandbox
      addMessage('system', 'Fetching generated files...');
      try {
        const filesRes = await fetch('/api/get-sandbox-files');
        if (filesRes.ok) {
          const filesData = await filesRes.json();
          if (filesData.success && filesData.files) {
            // API returns Record<string, string> — path → raw content
            const fileList: GeneratedFile[] = Object.entries(filesData.files)
              .map(([path, content]: [string, any]) => ({
                path,
                content: typeof content === 'string' ? content : (content?.content || '')
              }))
              .filter((f: GeneratedFile) =>
                !f.path.includes('node_modules') &&
                !f.path.includes('.git') &&
                !f.path.includes('package-lock')
              );
            setState(prev => ({ ...prev, files: fileList }));
            addMessage('system', `Loaded ${fileList.length} files`);
          }
        }
      } catch { /* continue without files */ }

      setState(prev => ({ ...prev, phase: 'ready' }));
      setIframeKey(prev => prev + 1);
      return true;
    } catch (err: any) {
      setState(prev => ({ ...prev, phase: 'error', error: err.message }));
      addMessage('assistant', `Failed to apply code: ${err.message}`);
      return false;
    }
  }, [addMessage]);

  // ─── Main Submit Handler ───────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const userPrompt = prompt.trim();
    if (!userPrompt) return;

    setPrompt('');
    addMessage('user', userPrompt);

    const isEdit = state.sandboxId !== null && state.phase === 'ready';

    // Step 1: Create sandbox if needed
    let sandboxId = state.sandboxId;
    if (!sandboxId) {
      const sandbox = await createSandbox();
      if (!sandbox) return;
      sandboxId = sandbox.sandboxId;
    }

    // Step 2: Generate code
    const code = await generateCode(userPrompt, sandboxId, isEdit);
    if (!code) return;

    // Step 3: Apply code
    const success = await applyCode(code, sandboxId, isEdit);

    if (success) {
      // Wait for Vite to rebuild
      await new Promise(resolve => setTimeout(resolve, 3000));
      setIframeKey(prev => prev + 1);
      setRightTab('preview');
      addMessage('assistant',
        isEdit
          ? 'Changes applied! The preview has been updated.'
          : 'Your agent is ready! Check the live preview. You can iterate by describing changes in the chat.'
      );
    }
  }, [prompt, state.sandboxId, state.phase, addMessage, createSandbox, generateCode, applyCode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isProcessing = ['creating-sandbox', 'generating', 'applying', 'editing'].includes(state.phase);

  const phaseLabel: Record<string, string> = {
    'idle': 'Ready',
    'creating-sandbox': 'Creating Sandbox...',
    'generating': 'Generating Code...',
    'applying': 'Applying to Sandbox...',
    'ready': 'Live',
    'editing': 'Updating...',
    'error': 'Error',
  };

  // ─── Get selected file content ─────────────────────────────
  const selectedFileContent = selectedFile
    ? state.files.find(f => f.path === selectedFile)?.content || ''
    : '';

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-[#020617] text-[#F8FAFC] flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ─── Header ─── */}
      <header className="relative z-50 h-14 min-h-[56px] shrink-0 border-b border-[#1E293B]/60 bg-[#0F172A]/95 backdrop-blur-sm px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#22C55E] flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.3)]">
            <Sparkles size={16} className="text-[#020617]" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-[#F8FAFC] leading-none block">AgentFlow</span>
            <span className="text-[9px] font-medium text-[#22C55E]/70 uppercase tracking-widest" style={{ fontFamily: "'Fira Code', monospace" }}>Agent Builder</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wider ${
            state.phase === 'ready'
              ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
              : state.phase === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : isProcessing
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
              : 'bg-[#1E293B] border-[#1E293B] text-slate-500'
          }`} style={{ fontFamily: "'Fira Code', monospace" }}>
            {isProcessing && <Loader2 size={10} className="animate-spin" />}
            {state.phase === 'ready' && <Activity size={10} />}
            {state.phase === 'error' && <AlertCircle size={10} />}
            {phaseLabel[state.phase]}
          </div>

          {state.sandboxUrl && (
            <a href={state.sandboxUrl} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-[#F8FAFC] transition-colors">
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Chat Panel ─── */}
        <div className="w-[380px] min-w-[340px] border-r border-[#1E293B]/60 flex flex-col bg-[#0F172A]/50">

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role !== 'user' && (
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'assistant'
                      ? 'bg-[#22C55E]/10 border border-[#22C55E]/20'
                      : 'bg-cyan-500/10 border border-cyan-500/20'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Bot size={14} className="text-[#22C55E]" />
                      : <Terminal size={12} className="text-cyan-400" />
                    }
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#22C55E] text-[#020617] font-medium'
                    : msg.role === 'system'
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px]'
                    : 'bg-[#1E293B]/60 text-slate-300'
                }`}>
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={14} className="text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming indicator */}
            {isProcessing && streamingText && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Loader2 size={12} className="text-cyan-400 animate-spin" />
                </div>
                <div className="bg-[#1E293B]/60 rounded-xl px-4 py-3 text-[11px] text-slate-500 max-w-[85%] overflow-hidden" style={{ fontFamily: "'Fira Code', monospace" }}>
                  <span className="opacity-60">{streamingText.slice(-100)}...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-[#1E293B]/60">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={state.phase === 'ready'
                  ? 'Describe changes...'
                  : 'Describe your agent...'
                }
                disabled={isProcessing}
                rows={1}
                className="flex-1 bg-[#020617] border border-[#1E293B] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] placeholder:text-slate-600 resize-none focus:outline-none focus:border-[#22C55E]/50 transition-colors disabled:opacity-50"
                style={{ minHeight: 44, maxHeight: 120 }}
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || isProcessing}
                className="w-11 h-11 rounded-xl bg-[#22C55E] text-[#020617] flex items-center justify-center hover:bg-[#16A34A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* ─── CENTER + RIGHT: Preview / Code / Nodes ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tab Bar */}
          <div className="h-11 min-h-[44px] border-b border-[#1E293B]/60 bg-[#0F172A]/80 flex items-center px-4 gap-1">
            {([
              { id: 'preview', icon: Eye, label: 'Preview' },
              { id: 'code', icon: Code2, label: 'Code' },
              { id: 'nodes', icon: Network, label: 'Nodes' },
            ] as { id: RightTab; icon: any; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  rightTab === tab.id
                    ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-[#1E293B]/50'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}

            <div className="flex-1" />

            {rightTab === 'preview' && state.sandboxUrl && (
              <button onClick={() => setIframeKey(p => p + 1)} className="p-1.5 rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-[#F8FAFC] transition-colors" title="Refresh preview">
                <RefreshCw size={13} />
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 relative overflow-hidden">

            {/* ─── Preview Tab ─── */}
            {rightTab === 'preview' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#020617]">
                {state.sandboxUrl ? (
                  <iframe
                    key={iframeKey}
                    src={state.sandboxUrl}
                    className="w-full h-full border-0"
                    title="Agent Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <div className="text-center max-w-md px-8">
                    <div className="w-20 h-20 rounded-2xl bg-[#1E293B]/50 border border-[#1E293B] flex items-center justify-center mx-auto mb-6">
                      <Sparkles size={32} className="text-[#22C55E]/40" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">No preview yet</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Describe the AI agent you want to build in the chat and I'll generate a live working application.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ─── Code Tab ─── */}
            {rightTab === 'code' && (
              <div className="absolute inset-0 flex">
                {/* File Tree */}
                <div className="w-56 min-w-[200px] border-r border-[#1E293B]/60 overflow-y-auto no-scrollbar bg-[#0F172A]/50 p-3">
                  <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-3 px-2" style={{ fontFamily: "'Fira Code', monospace" }}>
                    Files ({state.files.length})
                  </div>
                  {state.files.length === 0 ? (
                    <div className="text-xs text-slate-600 px-2 py-4">No files generated yet</div>
                  ) : (
                    <div className="space-y-0.5">
                      {state.files
                        .sort((a, b) => a.path.localeCompare(b.path))
                        .map(file => (
                          <button
                            key={file.path}
                            onClick={() => setSelectedFile(file.path)}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] flex items-center gap-2 transition-colors truncate ${
                              selectedFile === file.path
                                ? 'bg-[#22C55E]/10 text-[#22C55E]'
                                : 'text-slate-400 hover:bg-[#1E293B]/50 hover:text-slate-300'
                            }`}
                          >
                            <FileCode size={12} className="shrink-0" />
                            <span className="truncate">{file.path.split('/').pop()}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Code Viewer */}
                <div className="flex-1 overflow-auto no-scrollbar bg-[#020617] p-4">
                  {selectedFile ? (
                    <div>
                      <div className="text-[10px] text-slate-600 mb-3 px-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                        {selectedFile}
                      </div>
                      <pre className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'Fira Code', monospace" }}>
                        {selectedFileContent}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-slate-600">
                      Select a file to view its contents
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Nodes Tab ─── */}
            {rightTab === 'nodes' && (
              <div className="absolute inset-0 overflow-auto no-scrollbar p-8">
                <div className="max-w-3xl mx-auto">
                  <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-6" style={{ fontFamily: "'Fira Code', monospace" }}>
                    Architecture Breakdown
                  </div>

                  {state.files.length === 0 ? (
                    <div className="text-sm text-slate-600 text-center py-16">
                      Generate an agent to see its architecture
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {state.files
                        .filter(f => f.path.endsWith('.jsx') || f.path.endsWith('.tsx') || f.path.endsWith('.js') || f.path.endsWith('.ts'))
                        .map((file, idx) => {
                          const fileName = file.path.split('/').pop() || file.path;
                          const isComponent = /^[A-Z]/.test(fileName.replace(/\.(jsx|tsx|js|ts)$/, ''));
                          const imports = (file.content.match(/import .+ from ['"](.+)['"]/g) || [])
                            .map(m => m.match(/from ['"](.+)['"]/)?.[1] || '')
                            .filter(m => m.startsWith('./') || m.startsWith('../'));

                          return (
                            <motion.div
                              key={file.path}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 hover:border-[#22C55E]/20 transition-colors"
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isComponent
                                    ? 'bg-[#22C55E]/10 border border-[#22C55E]/20'
                                    : 'bg-cyan-500/10 border border-cyan-500/20'
                                }`}>
                                  {isComponent
                                    ? <Cpu size={14} className="text-[#22C55E]" />
                                    : <FileCode size={14} className="text-cyan-400" />
                                  }
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-[#F8FAFC]">{fileName}</div>
                                  <div className="text-[10px] text-slate-500" style={{ fontFamily: "'Fira Code', monospace" }}>
                                    {isComponent ? 'Component' : 'Module'} · {file.content.split('\n').length} lines
                                  </div>
                                </div>
                              </div>

                              {imports.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {imports.map((imp, impIdx) => (
                                    <span key={`${imp}-${impIdx}`} className="px-2 py-0.5 rounded-md bg-[#020617] border border-[#1E293B] text-[9px] text-slate-500" style={{ fontFamily: "'Fira Code', monospace" }}>
                                      {imp}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
