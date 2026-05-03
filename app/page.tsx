"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, Network, Zap, Shield, ChevronRight, Activity, Code2, Database, Sparkles, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#020617] text-[#F8FAFC] selection:bg-green-500/30 overflow-hidden relative" style={{ fontFamily: "'Fira Sans', system-ui, sans-serif" }}>
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-green-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/[0.04] blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,41,59,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.1)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-[#1E293B]/60 backdrop-blur-md bg-[#0F172A]/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#22C55E] flex items-center justify-center glow-box-green">
              <Sparkles className="w-5 h-5 text-[#020617]" />
            </div>
            <span className="text-lg font-bold tracking-tight text-[#F8FAFC]">
              AgentFlow
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link href="#features" className="hover:text-[#F8FAFC] transition-colors duration-200">Features</Link>
            <Link href="#workflow" className="hover:text-[#F8FAFC] transition-colors duration-200">Workflows</Link>
            <Link href="#pricing" className="hover:text-[#F8FAFC] transition-colors duration-200">Pricing</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-[#F8FAFC] transition-colors duration-200">
              Sign In
            </Link>
            <Link href="/generation" className="group px-5 py-2 rounded-lg font-semibold text-sm bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] transition-colors duration-200 cursor-pointer">
              <span className="flex items-center gap-2">
                Open Builder <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E] text-sm font-medium mb-8" style={{ fontFamily: "'Fira Code', monospace" }}>
            <Sparkles className="w-4 h-4" />
            <span>Next-Gen Autonomous Agents</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            Build <span className="text-[#22C55E] glow-green">Intelligent</span>
            <br />Agent Workflows
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Design, deploy, and monitor multi-level AI agents with our intuitive visual builder. Scale your operations with autonomous intelligence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/generation" className="w-full sm:w-auto group px-8 py-3.5 rounded-lg font-bold text-base bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] transition-colors duration-200 cursor-pointer glow-box-green">
              <span className="flex items-center justify-center gap-2">
                Start Building <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </span>
            </Link>
            <Link href="#demo" className="w-full sm:w-auto px-8 py-3.5 rounded-lg font-semibold text-base bg-[#1E293B]/50 border border-[#1E293B] hover:bg-[#1E293B] transition-colors duration-200 cursor-pointer">
              Watch Demo
            </Link>
          </div>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-24 relative max-w-5xl mx-auto"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10" />
          <div className="rounded-xl border border-[#1E293B] bg-[#0F172A]/60 p-4 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[#22C55E]/5 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-4 px-2 relative z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            
            <div className="aspect-[16/9] rounded-lg bg-[#020617] border border-[#1E293B] relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <svg viewBox="0 0 800 400" className="w-full h-full text-[#22C55E]">
                  <path d="M 200 200 C 300 200, 300 100, 400 100 S 500 200, 600 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5,5" />
                  <path d="M 200 200 C 300 200, 300 300, 400 300 S 500 200, 600 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5,5" />
                </svg>
              </div>
              <div className="flex gap-16 relative z-10">
                <Node icon={<Database className="w-7 h-7 text-slate-400" />} label="Data Source" />
                <Node icon={<Bot className="w-7 h-7 text-[#22C55E]" />} label="Analyzer Agent" active />
                <Node icon={<Code2 className="w-7 h-7 text-slate-400" />} label="Execution" />
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Features Grid */}
      <section id="features" className="relative z-10 bg-[#0F172A]/40 py-28 border-t border-[#1E293B]/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">Powerful Agent Capabilities</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">Everything you need to orchestrate complex AI workflows in production.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Network className="w-7 h-7 text-[#22C55E]" />}
              title="Visual Workflow Builder"
              description="Drag and drop agents, tools, and data sources to create sophisticated multi-step pipelines without writing code."
            />
            <FeatureCard 
              icon={<Zap className="w-7 h-7 text-amber-400" />}
              title="Real-time Execution"
              description="Watch your agents think, reason, and act in real-time with comprehensive streaming logs and state inspection."
            />
            <FeatureCard 
              icon={<Shield className="w-7 h-7 text-cyan-400" />}
              title="Secure Environments"
              description="Run generated code safely in isolated sandboxes with strict permission controls and timeout limitations."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Node({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 ${active ? 'scale-105' : 'opacity-60'} transition-all duration-200`}>
      <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${active ? 'bg-[#22C55E]/15 border-[#22C55E]/40 glow-box-green' : 'bg-[#1E293B]/50 border-[#1E293B]'} border`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-slate-400" style={{ fontFamily: "'Fira Code', monospace" }}>{label}</span>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-7 rounded-xl bg-[#0F172A] border border-[#1E293B] hover:border-[#1E293B]/80 transition-all duration-200 hover:-translate-y-1 group cursor-pointer">
      <div className="w-12 h-12 rounded-xl bg-[#020617] border border-[#1E293B] flex items-center justify-center mb-5 transition-colors duration-200">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}