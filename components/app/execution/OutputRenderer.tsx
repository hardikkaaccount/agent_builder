'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Download,
  CheckCircle,
  FileText,
  BarChart2,
  Code2,
  List,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

interface OutputRendererProps {
  /** Map of nodeName -> raw output string */
  nodeOutputs: Record<string, string>;
  workflowName: string;
}

/**
 * Detects the best rendering mode for a string.
 */
function detectType(content: string): 'code' | 'json' | 'list' | 'markdown' {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('```') || /^(function|import|export|const|class|def |import )/m.test(trimmed)) return 'code';
  if (/^[-*•]\s/m.test(trimmed) || /^\d+\.\s/m.test(trimmed)) return 'list';
  return 'markdown';
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function downloadOutput(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-renderers
// ─────────────────────────────────────────────────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown rendering: headings, bold, code spans, paragraphs
  const lines = content.split('\n');

  const renderLine = (line: string, idx: number) => {
    if (line.startsWith('### ')) return <h3 key={idx} className="text-sm font-semibold text-[#22C55E] mt-4 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith('## ')) return <h2 key={idx} className="text-base font-semibold text-[#F8FAFC] mt-5 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith('# ')) return <h1 key={idx} className="text-lg font-bold text-[#F8FAFC] mt-6 mb-3">{line.slice(2)}</h1>;
    if (line.startsWith('---') || line.startsWith('===')) return <hr key={idx} className="border-[#1E293B] my-4" />;
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      return (
        <div key={idx} className="flex gap-2 text-slate-300 text-sm leading-relaxed">
          <span className="text-[#22C55E] shrink-0 mt-0.5">▸</span>
          <span dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />
        </div>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      return (
        <div key={idx} className="flex gap-3 text-slate-300 text-sm leading-relaxed">
          <span className="text-cyan-500 font-black shrink-0 w-5 text-right">{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: renderInline(line.replace(/^\d+\.\s/, '')) }} />
        </div>
      );
    }
    if (line.trim() === '') return <div key={idx} className="h-2" />;
    return <p key={idx} className="text-slate-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />;
  };

  return <div className="space-y-1.5">{lines.map(renderLine)}</div>;
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#F8FAFC] font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="text-slate-200">$1</em>')
    .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded text-[10px] bg-[#1E293B] text-cyan-400" style="font-family: Fira Code, monospace">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-[#22C55E] underline hover:text-[#16A34A]">$1</a>');
}

function JsonRenderer({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content);
    const pretty = JSON.stringify(parsed, null, 2);
    return (
      <pre className="text-[11px] text-cyan-300 font-mono whitespace-pre-wrap overflow-auto leading-relaxed">
        {pretty}
      </pre>
    );
  } catch {
    return <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap">{content}</pre>;
  }
}

function CodeRenderer({ content }: { content: string }) {
  return (
    <pre className="text-[11px] text-[#22C55E]/80 whitespace-pre-wrap overflow-auto leading-relaxed bg-[#020617] rounded-xl p-4" style={{ fontFamily: "'Fira Code', monospace" }}>
      {content}
    </pre>
  );
}

function ListRenderer({ content }: { content: string }) {
  const items = content
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, ''));

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-slate-300 text-sm leading-relaxed">
          <span className="w-5 h-5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/20 text-[#22C55E] text-[9px] font-semibold flex items-center justify-center shrink-0 mt-0.5" style={{ fontFamily: "'Fira Code', monospace" }}>
            {i + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single node output card
// ─────────────────────────────────────────────────────────────────────────────

function NodeOutputCard({ name, content }: { name: string; content: string }) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const type = detectType(content);

  const typeIcons = {
    markdown: <FileText size={14} className="text-emerald-400" />,
    json: <BarChart2 size={14} className="text-cyan-400" />,
    code: <Code2 size={14} className="text-purple-400" />,
    list: <List size={14} className="text-amber-400" />,
  };

  const handleCopy = () => {
    copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#1E293B] bg-[#0F172A]/60 overflow-hidden"
    >
      {/* Card Header */}
      <div
        className="px-5 py-3.5 flex items-center justify-between border-b border-[#1E293B]/60 cursor-pointer hover:bg-[#1E293B]/20 transition-colors duration-200"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#020617] border border-[#1E293B] flex items-center justify-center">
            {typeIcons[type]}
          </div>
          <div>
            <p className="text-xs font-semibold text-[#F8FAFC]">{name}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest" style={{ fontFamily: "'Fira Code', monospace" }}>
              {type} · {(content.length / 1000).toFixed(1)}k chars
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="p-1.5 rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-[#F8FAFC] transition-colors duration-200 cursor-pointer"
            title="Copy"
          >
            {copied ? <CheckCircle size={14} className="text-[#22C55E]" /> : <Copy size={14} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadOutput(`${name.replace(/\s+/g, '-').toLowerCase()}.md`, content);
            }}
            className="p-1.5 rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-[#F8FAFC] transition-colors duration-200 cursor-pointer"
            title="Download"
          >
            <Download size={14} />
          </button>
          {expanded ? (
            <ChevronUp size={14} className="text-slate-500" />
          ) : (
            <ChevronDown size={14} className="text-slate-500" />
          )}
        </div>
      </div>

      {/* Card Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 max-h-96 overflow-auto no-scrollbar">
              {type === 'markdown' && <MarkdownRenderer content={content} />}
              {type === 'json' && <JsonRenderer content={content} />}
              {type === 'code' && <CodeRenderer content={content} />}
              {type === 'list' && <ListRenderer content={content} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main OutputRenderer component
// ─────────────────────────────────────────────────────────────────────────────

export function OutputRenderer({ nodeOutputs, workflowName }: OutputRendererProps) {
  const entries = Object.entries(nodeOutputs).filter(([, v]) => v && v.length > 0);
  const [copied, setCopied] = useState(false);

  const allContent = entries.map(([name, content]) => `# ${name}\n\n${content}`).join('\n\n---\n\n');

  const handleDownloadAll = () => {
    downloadOutput(`${workflowName.replace(/\s+/g, '-').toLowerCase()}-results.md`, allContent);
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-14 h-14 rounded-xl bg-[#1E293B]/30 border border-[#1E293B] flex items-center justify-center mb-4">
          <FileText size={24} className="text-slate-600" />
        </div>
        <p className="text-slate-500 text-sm">No output available yet</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ fontFamily: "'Fira Sans', system-ui, sans-serif" }}>
      {/* Output Header */}
      <div className="px-5 py-3.5 border-b border-[#1E293B]/60 bg-[#0F172A]/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-300" style={{ fontFamily: "'Fira Code', monospace" }}>
            Results
          </span>
          <span className="px-2 py-0.5 rounded-md bg-[#1E293B] text-[9px] font-semibold text-slate-400" style={{ fontFamily: "'Fira Code', monospace" }}>
            {entries.length} outputs
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              copyToClipboard(allContent);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E293B]/50 border border-[#1E293B] text-[9px] font-semibold uppercase text-slate-400 hover:text-[#F8FAFC] transition-colors duration-200 cursor-pointer" style={{ fontFamily: "'Fira Code', monospace" }}
          >
            {copied ? <CheckCircle size={12} className="text-[#22C55E]" /> : <Copy size={12} />}
            Copy All
          </button>
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#22C55E]/10 border border-[#22C55E]/20 text-[9px] font-semibold uppercase text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors duration-200 cursor-pointer" style={{ fontFamily: "'Fira Code', monospace" }}
          >
            <Download size={12} />
            Export
          </button>
        </div>
      </div>

      {/* Output Cards */}
      <div className="flex-1 overflow-auto p-5 space-y-4 no-scrollbar">
        {entries.map(([name, content]) => (
          <NodeOutputCard key={name} name={name} content={content} />
        ))}
      </div>
    </div>
  );
}
