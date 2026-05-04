import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  ChevronRight,
  Code2,
  Database,
  Network,
  Sparkles,
} from "lucide-react";
import {
  marketingStats,
  planTiers,
  supportingFeatures,
  workflowSteps,
} from "@/lib/marketing-content";

export const metadata: Metadata = {
  title: "AgentFlow | Build Production-Ready AI Workflows",
  description:
    "Design, run, and monitor multi-agent workflows with guardrails, live telemetry, and collaboration tooling.",
};

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AgentFlow",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description:
      "A platform to design, execute, and monitor multi-agent workflows with operational guardrails.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "49",
      priceCurrency: "USD",
    },
  };

  return (
    <div
      className="min-h-screen bg-[#020617] text-[#F8FAFC] selection:bg-green-500/30 overflow-hidden relative"
      style={{ fontFamily: "'Fira Sans', system-ui, sans-serif" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 bg-[#22C55E] text-[#020617] px-3 py-2 rounded-md z-50">
        Skip to content
      </a>

      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-green-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/[0.04] blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,41,59,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.1)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <header className="relative z-10 border-b border-[#1E293B]/60 backdrop-blur-md bg-[#0F172A]/80">
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between" aria-label="Main navigation">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#22C55E] flex items-center justify-center glow-box-green">
              <Sparkles className="w-5 h-5 text-[#020617]" />
            </div>
            <span className="text-lg font-bold tracking-tight text-[#F8FAFC]">AgentFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link href="#features" className="hover:text-[#F8FAFC] transition-colors duration-200">
              Features
            </Link>
            <Link href="#workflow" className="hover:text-[#F8FAFC] transition-colors duration-200">
              Workflow
            </Link>
            <Link href="#pricing" className="hover:text-[#F8FAFC] transition-colors duration-200">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-[#F8FAFC] transition-colors duration-200">
              Sign In
            </Link>
            <Link href="/builder" className="group px-5 py-2 rounded-lg font-semibold text-sm bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] transition-colors duration-200 cursor-pointer">
              <span className="flex items-center gap-2">
                Open Builder <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </span>
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content" className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-24 text-center">
        <section className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E] text-sm font-medium mb-8 font-mono">
            <Sparkles className="w-4 h-4" />
            <span>Multi-Agent Orchestration Platform</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            Build <span className="text-[#22C55E] glow-green">Reliable</span>
            <br />
            AI Agent Workflows
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Design, deploy, and monitor AI workflows with production guardrails, collaborative tooling, and live observability.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/builder" className="w-full sm:w-auto group px-8 py-3.5 rounded-lg font-bold text-base bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] transition-colors duration-200 cursor-pointer glow-box-green">
              <span className="flex items-center justify-center gap-2">
                Start Building <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </span>
            </Link>
            <Link href="/examples" className="w-full sm:w-auto px-8 py-3.5 rounded-lg font-semibold text-base bg-[#1E293B]/50 border border-[#1E293B] hover:bg-[#1E293B] transition-colors duration-200 cursor-pointer">
              Explore Examples
            </Link>
          </div>
        </section>

        <section className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto" aria-label="Core capabilities">
          {marketingStats.map((stat) => (
            <article key={stat.label} className="rounded-xl border border-[#1E293B] bg-[#0B1220]/85 p-5 text-left">
              <p className="text-2xl font-bold tracking-tight text-[#F8FAFC]">{stat.value}</p>
              <p className="text-sm text-slate-300 mt-1">{stat.label}</p>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">{stat.context}</p>
            </article>
          ))}
        </section>

        <section className="mt-20 relative max-w-5xl mx-auto" aria-label="Workflow preview">
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
              <div className="flex gap-8 sm:gap-16 relative z-10 px-4">
                <Node icon={<Database className="w-7 h-7 text-slate-400" />} label="Data Source" />
                <Node icon={<Bot className="w-7 h-7 text-[#22C55E]" />} label="Analyzer Agent" active />
                <Node icon={<Code2 className="w-7 h-7 text-slate-400" />} label="Execution" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <section id="features" className="relative z-10 bg-[#0F172A]/40 py-24 border-y border-[#1E293B]/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">Built for Real Operations</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Build faster, maintain control, and keep workflows observable from prototype to production.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {supportingFeatures.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={<feature.icon className={`w-6 h-6 ${feature.iconClass}`} />}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="relative z-10 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Operational Workflow</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              A straightforward lifecycle for planning, executing, and improving multi-agent systems.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {workflowSteps.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-[#1E293B] bg-[#0B1220]/80 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl border border-[#1E293B] bg-[#020617] flex items-center justify-center">
                    <step.icon className={`w-5 h-5 ${step.colorClass}`} />
                  </div>
                  <div className="text-xs text-slate-400 font-mono">STEP {index + 1}</div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-slate-400 leading-relaxed">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative z-10 py-24 border-y border-[#1E293B]/60 bg-[#0F172A]/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Simple, Team-Ready Pricing</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Transparent tiers for independent builders, teams, and enterprise deployment paths.
            </p>
            <p className="text-xs text-slate-500 mt-3">Pricing shown for demonstration and subject to change.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {planTiers.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl p-6 border transition-all duration-200 ${
                  plan.featured
                    ? "border-[#22C55E]/60 bg-[#0A1A12] glow-box-green"
                    : "border-[#1E293B] bg-[#0B1220]/90"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  {plan.featured ? (
                    <span className="text-xs px-2 py-1 rounded-md bg-[#22C55E]/20 text-[#22C55E] font-semibold">
                      RECOMMENDED
                    </span>
                  ) : null}
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-slate-400">{plan.cadence}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-slate-300 text-sm leading-relaxed">
                      <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors duration-200 ${
                    plan.featured
                      ? "bg-[#22C55E] text-[#020617] hover:bg-[#16A34A]"
                      : "bg-[#111827] text-slate-200 hover:bg-[#1F2937]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="rounded-3xl border border-[#1E293B] bg-[linear-gradient(135deg,rgba(34,197,94,0.13),rgba(34,211,238,0.08)_45%,rgba(2,6,23,0.95)_100%)] p-8 md:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-[#020617]/70 border border-[#1E293B] text-slate-300 mb-4">
                <Network className="w-3.5 h-3.5 text-[#22C55E]" />
                Built for teams shipping AI features continuously
              </div>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-4">
                Move from experiments to dependable AI operations.
              </h2>
              <p className="text-slate-300 leading-relaxed">
                AgentFlow brings orchestration, guardrails, and observability together so teams can ship with confidence.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[220px]">
              <Link href="/builder" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] transition-colors duration-200">
                Build Your First Flow
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/examples" className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold bg-[#0F172A] text-slate-200 border border-[#1E293B] hover:bg-[#1E293B]/70 transition-colors duration-200">
                Browse Workflow Examples
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Node({
  icon,
  label,
  active = false,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 ${active ? "scale-105" : "opacity-60"} transition-all duration-200`}>
      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center ${active ? "bg-[#22C55E]/15 border-[#22C55E]/40 glow-box-green" : "bg-[#1E293B]/50 border-[#1E293B]"} border`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-slate-400 font-mono">{label}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="p-6 rounded-xl bg-[#0F172A] border border-[#1E293B] hover:border-[#1E293B]/80 transition-all duration-200 hover:-translate-y-1">
      <div className="w-12 h-12 rounded-xl bg-[#020617] border border-[#1E293B] flex items-center justify-center mb-5">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </article>
  );
}
