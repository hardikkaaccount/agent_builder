/**
 * AgentFlow — Test Pipeline
 *
 * Automated end-to-end test that validates:
 * 1. Master Agent generates valid workflows from prompts
 * 2. Nodes have proper tools assigned
 * 3. Dependencies resolve correctly
 * 4. Workflow structure is sound (DAG, no cycles)
 */

import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getProviderForModel } from '@/lib/ai/provider-manager';
import { getToolNames } from '@/lib/ai/tools/tool-registry';
import { appConfig } from '@/config/app.config';
import { validateWorkflow, topologicalSort } from '@/lib/ai/workflow-utils';

interface TestCase {
  name: string;
  prompt: string;
  minNodes: number;
  maxNodes: number;
  requiredTools: string[];
  requireParallelStage: boolean;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details: string;
  nodeCount?: number;
  toolsFound?: string[];
  errors: string[];
}

const TEST_CASES: TestCase[] = [
  {
    name: 'Simple Research Task',
    prompt: 'Research the pros and cons of remote work in 2025',
    minNodes: 2,
    maxNodes: 6,
    requiredTools: ['research'],
    requireParallelStage: false,
  },
  {
    name: 'Comparison Task',
    prompt: 'Compare Python vs JavaScript for backend development',
    minNodes: 3,
    maxNodes: 8,
    requiredTools: ['research', 'compare'],
    requireParallelStage: true,
  },
  {
    name: 'Planning Task',
    prompt: 'Create a 30-day fitness plan for a beginner',
    minNodes: 2,
    maxNodes: 7,
    requiredTools: ['plan'],
    requireParallelStage: false,
  },
  {
    name: 'Complex Multi-Step',
    prompt: 'Analyze the electric vehicle market, compare top 5 EV brands, and create an investment recommendation report',
    minNodes: 4,
    maxNodes: 10,
    requiredTools: ['research', 'analyze'],
    requireParallelStage: true,
  },
];

export async function GET() {
  const results: TestResult[] = [];
  const validToolNames = new Set(getToolNames());
  const masterAgentUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/agents/master-agent`;

  for (const tc of TEST_CASES) {
    const start = Date.now();
    const errors: string[] = [];
    let nodeCount = 0;
    let toolsFound: string[] = [];

    try {
      // Call master agent internally
      const res = await fetch(masterAgentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: tc.prompt }),
      });

      if (!res.ok) {
        errors.push(`Master Agent returned ${res.status}: ${await res.text()}`);
      } else {
        const data = await res.json();
        const wf = data.workflow;

        if (!wf) {
          errors.push('No workflow returned');
        } else {
          nodeCount = wf.nodes?.length || 0;

          // Check node count
          if (nodeCount < tc.minNodes) errors.push(`Too few nodes: ${nodeCount} < ${tc.minNodes}`);
          if (nodeCount > tc.maxNodes) errors.push(`Too many nodes: ${nodeCount} > ${tc.maxNodes}`);

          // Check tools
          const allTools: string[] = [];
          for (const node of wf.nodes || []) {
            const nodeTools = (node.tools || []).map((t: any) => typeof t === 'string' ? t : t.name);
            allTools.push(...nodeTools);

            // Validate tools are from registry
            for (const t of nodeTools) {
              if (!validToolNames.has(t)) {
                errors.push(`Node "${node.name}" has unknown tool: ${t}`);
              }
            }

            // Check task is detailed (>50 chars)
            if ((node.task || '').length < 50) {
              errors.push(`Node "${node.name}" has vague task (${(node.task || '').length} chars)`);
            }
          }

          toolsFound = [...new Set(allTools)];

          // Check required tools
          for (const req of tc.requiredTools) {
            if (!allTools.includes(req)) {
              errors.push(`Missing required tool: ${req}`);
            }
          }

          // Check DAG structure
          const validation = validateWorkflow(wf);
          if (!validation.valid) {
            errors.push(...validation.errors);
          }

          // Check parallel stages
          if (tc.requireParallelStage) {
            const stages: string[][] = [];
            const resolved = new Set<string>();
            const remaining = new Set<string>(wf.nodes.map((n: any) => n.id as string));

            while (remaining.size > 0) {
              const stage: string[] = [];
              for (const id of remaining) {
                const node = wf.nodes.find((n: any) => n.id === id);
                if (node && (node.dependencies || []).every((d: string) => resolved.has(d))) {
                  stage.push(id);
                }
              }
              if (stage.length === 0) break;
              for (const id of stage) { resolved.add(id); remaining.delete(id); }
              stages.push(stage);
            }

            const hasParallel = stages.some(s => s.length > 1);
            if (!hasParallel) {
              errors.push('Expected at least one parallel stage but all stages are sequential');
            }
          }
        }
      }
    } catch (err: any) {
      errors.push(`Exception: ${err.message}`);
    }

    results.push({
      name: tc.name,
      passed: errors.length === 0,
      duration: Date.now() - start,
      details: errors.length === 0 ? `✅ ${nodeCount} nodes, tools: [${toolsFound.join(', ')}]` : errors.join('; '),
      nodeCount,
      toolsFound,
      errors,
    });
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  return NextResponse.json({
    summary: `${passed}/${total} tests passed`,
    allPassed: passed === total,
    results,
    timestamp: new Date().toISOString(),
  });
}
