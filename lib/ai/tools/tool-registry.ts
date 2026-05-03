/**
 * AgentFlow — Tool Registry (Pure LLM)
 *
 * NO external APIs. Every "tool" is an LLM-native operation.
 * The LLM itself IS the tool — it analyzes, summarizes, compares,
 * extracts, calculates, and generates reports using its own knowledge.
 *
 * Tools here are just prompt-engineering patterns, not API calls.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tool metadata for the Master Agent to reference
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolMeta {
  name: string;
  description: string;
  category: 'input' | 'analysis' | 'transform' | 'output';
  promptHint: string; // Injected into the node's system prompt
}

/**
 * All available "tools" — these are prompt patterns, not API integrations.
 * Each one tells the node HOW to approach its task.
 */
const TOOL_REGISTRY: Record<string, ToolMeta> = {
  research: {
    name: 'research',
    description: 'Deep-dive research on a topic using the AI\'s training knowledge. Produces comprehensive, factual analysis.',
    category: 'analysis',
    promptHint: `You are a world-class researcher. Use your extensive knowledge to provide detailed, factual, well-sourced information. Structure your research with clear sections. When you don't know something, say so clearly rather than guessing.`,
  },

  analyze: {
    name: 'analyze',
    description: 'Break down complex information into components, identify patterns, and draw insights.',
    category: 'analysis',
    promptHint: `You are an expert analyst. Break down the provided information systematically. Identify key patterns, trends, strengths, weaknesses, and actionable insights. Use data-driven reasoning.`,
  },

  summarize: {
    name: 'summarize',
    description: 'Condense long text into clear, concise key points.',
    category: 'transform',
    promptHint: `You are a concise summarizer. Extract only the most important information. Use bullet points. Remove fluff. Keep the essence.`,
  },

  compare: {
    name: 'compare',
    description: 'Side-by-side comparison of two or more options with pros/cons.',
    category: 'analysis',
    promptHint: `You are a comparison expert. Create clear side-by-side comparisons. List pros and cons for each option. Provide a balanced, objective assessment. End with a clear recommendation.`,
  },

  calculate: {
    name: 'calculate',
    description: 'Perform calculations, budgets, estimates, and numerical analysis.',
    category: 'transform',
    promptHint: `You are a precise calculator. Show all your work step by step. Double-check your math. Present results in a clear table or structured format. Include totals and summaries.`,
  },

  plan: {
    name: 'plan',
    description: 'Create structured plans, schedules, roadmaps, or step-by-step guides.',
    category: 'output',
    promptHint: `You are a strategic planner. Create detailed, actionable plans with clear timelines, milestones, and deliverables. Consider risks and alternatives. Make it immediately executable.`,
  },

  write: {
    name: 'write',
    description: 'Generate polished written content — reports, articles, emails, documentation.',
    category: 'output',
    promptHint: `You are a professional writer. Produce polished, well-structured content. Use appropriate tone and formatting. Include headers, sections, and clear organization.`,
  },

  extract: {
    name: 'extract',
    description: 'Parse and extract structured data (lists, tables, key-value pairs) from unstructured text.',
    category: 'transform',
    promptHint: `You are a data extraction specialist. Parse the input carefully and extract structured data. Output clean, organized data in the requested format. Be precise — don't add information that isn't in the source.`,
  },

  validate: {
    name: 'validate',
    description: 'Check data, logic, or content for errors, inconsistencies, or quality issues.',
    category: 'analysis',
    promptHint: `You are a quality validator. Check everything for: factual accuracy, logical consistency, completeness, formatting errors, and potential issues. Flag problems clearly with severity levels.`,
  },

  brainstorm: {
    name: 'brainstorm',
    description: 'Generate creative ideas, alternatives, and innovative solutions.',
    category: 'analysis',
    promptHint: `You are a creative thinker. Generate diverse, innovative ideas. Think outside the box. Consider unconventional approaches. Rank ideas by feasibility and impact.`,
  },

  aggregate: {
    name: 'aggregate',
    description: 'Combine and synthesize outputs from multiple sources into a unified result.',
    category: 'transform',
    promptHint: `You are a synthesis expert. Combine all provided inputs into a single, coherent, well-organized output. Resolve conflicts between sources. Ensure nothing important is lost.`,
  },

  format: {
    name: 'format',
    description: 'Transform raw content into a specific format (markdown, JSON, table, etc.).',
    category: 'output',
    promptHint: `You are a formatting expert. Transform the input into the requested format. Ensure clean, consistent formatting. Follow the specified structure exactly.`,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry API
// ─────────────────────────────────────────────────────────────────────────────

/** Get tool metadata by name */
export function getTool(name: string): ToolMeta | undefined {
  return TOOL_REGISTRY[name];
}

/** Get all tool names */
export function getToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

/** Get all tools */
export function getAllTools(): ToolMeta[] {
  return Object.values(TOOL_REGISTRY);
}

/** Get tool prompt hints for a list of tool names (injected into node system prompt) */
export function getToolPromptHints(toolNames: string[]): string {
  return toolNames
    .map(name => TOOL_REGISTRY[name]?.promptHint)
    .filter(Boolean)
    .join('\n\n');
}

/** Get tool descriptions formatted for the Master Agent prompt */
export function getToolDescriptionsForPrompt(): string {
  return Object.values(TOOL_REGISTRY)
    .map(t => `- ${t.name} [${t.category}]: ${t.description}`)
    .join('\n');
}

export default TOOL_REGISTRY;
