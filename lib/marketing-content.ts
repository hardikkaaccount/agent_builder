import { Bot, Clock3, LineChart, Rocket, Shield, Sparkles, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MarketingStat {
  label: string;
  value: string;
  context: string;
}

export interface WorkflowStep {
  title: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
}

export interface PlanTier {
  name: string;
  price: string;
  cadence: string;
  points: string[];
  cta: string;
  href: string;
  featured?: boolean;
}

export const marketingStats: MarketingStat[] = [
  { label: "Live Agent Canvas", value: "Real-time", context: "Visual node state + streamed execution logs" },
  { label: "Safety Controls", value: "Built-in", context: "Sandbox isolation, guarded tools, and timeouts" },
  { label: "Team Workflow", value: "Collaborative", context: "Reusable templates and shared execution history" },
];

export const workflowSteps: WorkflowStep[] = [
  {
    title: "Define Objective",
    description: "Capture your product goal and acceptance criteria in one place.",
    icon: Sparkles,
    colorClass: "text-[#22C55E]",
  },
  {
    title: "Assemble Agents",
    description: "Connect planner, worker, and validator agents with typed tool boundaries.",
    icon: Bot,
    colorClass: "text-cyan-300",
  },
  {
    title: "Execute Transparently",
    description: "Observe telemetry, command traces, and outputs while jobs are running.",
    icon: LineChart,
    colorClass: "text-amber-300",
  },
  {
    title: "Ship and Iterate",
    description: "Promote proven workflows and continuously improve from execution feedback.",
    icon: Rocket,
    colorClass: "text-fuchsia-300",
  },
];

export const planTiers: PlanTier[] = [
  {
    name: "Starter",
    price: "$0",
    cadence: "/month",
    points: ["Single-user workspace", "Core workflow builder", "Community support"],
    cta: "Start Free",
    href: "/builder",
  },
  {
    name: "Team",
    price: "$49",
    cadence: "/seat/month",
    points: ["Shared workspaces", "Execution analytics", "Priority support"],
    cta: "Try Team",
    href: "/builder",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    points: ["Private deployment options", "SSO and compliance controls", "Dedicated onboarding"],
    cta: "Talk to Sales",
    href: "/generation",
  },
];

export const supportingFeatures = [
  {
    title: "Visual Workflow Builder",
    description: "Map complex multi-step agent systems without writing orchestration boilerplate.",
    icon: Users,
    iconClass: "text-[#22C55E]",
  },
  {
    title: "Deterministic Execution Controls",
    description: "Track each step with retries, bounded resources, and explicit failure surfaces.",
    icon: Clock3,
    iconClass: "text-amber-300",
  },
  {
    title: "Production Safety by Default",
    description: "Run generated code in isolated environments with restricted capabilities.",
    icon: Shield,
    iconClass: "text-cyan-300",
  },
  {
    title: "Operator-Friendly Monitoring",
    description: "Surface telemetry and stream logs in one place for faster troubleshooting.",
    icon: Zap,
    iconClass: "text-fuchsia-300",
  },
];
