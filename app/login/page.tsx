import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign In | AgentFlow",
  description: "Access your AgentFlow workspace and continue building multi-agent workflows.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-[#F8FAFC] px-6 py-16 flex items-center justify-center">
      <section className="w-full max-w-xl rounded-2xl border border-[#1E293B] bg-[#0B1220]/90 p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 mb-5">
          <ShieldCheck className="w-4 h-4" />
          Authentication
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Sign in to AgentFlow</h1>
        <p className="text-slate-300 leading-relaxed mb-8">
          Full authentication wiring is still in setup for this environment. You can continue by opening the builder directly.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/builder"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold bg-[#22C55E] text-[#020617] hover:bg-[#16A34A] transition-colors duration-200"
          >
            Continue to Builder
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold bg-[#0F172A] text-slate-200 border border-[#1E293B] hover:bg-[#1E293B]/70 transition-colors duration-200"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
