/**
 * Worker Agent Template
 * Base template for specialized worker agents to execute specific types of tasks
 */

import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

export interface WorkerTask {
  taskId: string;
  taskType: string; // e.g., 'data-analysis', 'code-generation', 'research'
  description: string;
  inputs: Record<string, any>;
  requirements?: {
    model?: string;
    temperature?: number;
    timeout?: number;
    tools?: string[];
  };
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  output: Record<string, any>;
  executionTime: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
  error?: string;
  metadata?: Record<string, any>;
}

export interface WorkerConfiguration {
  name: string;
  taskType: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  toolDefinitions?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
}

/**
 * Base Worker Agent Class
 * Extend this class to create specialized workers
 */
export class WorkerAgent {
  protected config: WorkerConfiguration;
  protected taskHistory: WorkerTask[] = [];
  protected resultHistory: WorkerResult[] = [];

  constructor(config: WorkerConfiguration) {
    this.config = config;
  }

  /**
   * Execute a task
   */
  async executeTask(task: WorkerTask): Promise<WorkerResult> {
    const startTime = Date.now();

    try {
      console.log(
        `[${this.config.name}] Starting task: ${task.description}`
      );

      // Validate task
      this.validateTask(task);

      // Build prompt
      const prompt = this.buildPrompt(task);

      // Get model
      const model = bedrock(
        task.requirements?.model || this.config.model
      );

      // Execute
      const response = await generateText({
        model,
        system: this.config.systemPrompt,
        prompt,
        temperature: task.requirements?.temperature ?? this.config.temperature,
      });

      const output = this.parseOutput(task, response.text);

      const result: WorkerResult = {
        taskId: task.taskId,
        success: true,
        output,
        executionTime: Date.now() - startTime,
      };

      this.taskHistory.push(task);
      this.resultHistory.push(result);

      console.log(
        `[${this.config.name}] Task completed: ${task.taskId} (${result.executionTime}ms)`
      );

      return result;
    } catch (error: any) {
      const result: WorkerResult = {
        taskId: task.taskId,
        success: false,
        output: {},
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };

      this.resultHistory.push(result);

      console.error(
        `[${this.config.name}] Task failed: ${task.taskId}`,
        error
      );

      return result;
    }
  }

  /**
   * Get worker name
   */
  getWorkerName(): string {
    return this.config.name;
  }

  /**
   * Get worker task type
   */
  getTaskType(): string {
    return this.config.taskType;
  }

  /**
   * Validate incoming task
   */
  protected validateTask(task: WorkerTask): void {
    if (!task.taskId) {
      throw new Error('Task must have a taskId');
    }

    if (task.taskType !== this.config.taskType) {
      throw new Error(
        `Task type mismatch: expected ${this.config.taskType}, got ${task.taskType}`
      );
    }

    if (!task.description) {
      throw new Error('Task must have a description');
    }
  }

  /**
   * Build prompt for task - override in subclasses
   */
  protected buildPrompt(task: WorkerTask): string {
    return `
Task: ${task.description}

Inputs:
${Object.entries(task.inputs)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Please complete this task and provide clear output.`;
  }

  /**
   * Parse output - override in subclasses for custom parsing
   */
  protected parseOutput(task: WorkerTask, response: string): Record<string, any> {
    return {
      result: response,
      raw: response,
    };
  }

  /**
   * Get task history
   */
  getTaskHistory(): WorkerTask[] {
    return [...this.taskHistory];
  }

  /**
   * Get result history
   */
  getResultHistory(): WorkerResult[] {
    return [...this.resultHistory];
  }

  /**
   * Get worker statistics
   */
  getStatistics(): {
    tasksCompleted: number;
    tasksFailed: number;
    successRate: number;
    avgExecutionTime: number;
  } {
    const completed = this.resultHistory.filter(r => r.success).length;
    const failed = this.resultHistory.filter(r => !r.success).length;
    const total = this.resultHistory.length;

    const avgExecutionTime = total > 0
      ? this.resultHistory.reduce((sum, r) => sum + r.executionTime, 0) / total
      : 0;

    return {
      tasksCompleted: completed,
      tasksFailed: failed,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      avgExecutionTime,
    };
  }
}

/**
 * Data Analysis Worker
 * Specialized for analyzing data and generating insights
 */
export class DataAnalysisWorker extends WorkerAgent {
  constructor() {
    super({
      name: 'DataAnalysisWorker',
      taskType: 'data-analysis',
      description: 'Analyzes data and generates insights',
      model: 'bedrock/us.amazon.nova-pro-v1:0',
      temperature: 0.5,
      maxTokens: 2048,
      systemPrompt: `You are a data analysis specialist.

Your tasks:
- Analyze provided data
- Identify patterns and trends
- Calculate statistics
- Generate actionable insights
- Create clear visualizations descriptions

Provide structured, data-driven analysis with confidence levels.`,
    });
  }

  protected buildPrompt(task: WorkerTask): string {
    const { dataSet = '', metrics = [], insights = true } = task.inputs;

    return `
Analyze the following data:

${dataSet}

Focus on these metrics:
- ${(metrics as string[]).join('\n- ')}

Generate ${insights ? 'detailed insights and recommendations' : 'basic statistics'}.`;
  }

  protected parseOutput(
    task: WorkerTask,
    response: string
  ): Record<string, any> {
    return {
      analysis: response,
      insights: response.split('\n').filter(line => line.toLowerCase().includes('insight') || line.toLowerCase().includes('pattern')),
    };
  }
}

/**
 * Research Worker
 * Specialized for gathering and synthesizing research information
 */
export class ResearchWorker extends WorkerAgent {
  constructor() {
    super({
      name: 'ResearchWorker',
      taskType: 'research',
      description: 'Conducts research and synthesizes information',
      model: 'bedrock/us.amazon.nova-pro-v1:0',
      temperature: 0.6,
      maxTokens: 3000,
      systemPrompt: `You are a research specialist.

Your tasks:
- Research and gather information
- Synthesize findings
- Cite sources and evidence
- Provide balanced perspectives
- Generate comprehensive reports

Focus on accuracy, relevance, and clarity.`,
    });
  }

  protected buildPrompt(task: WorkerTask): string {
    const { topic = '', scope = 'broad', depth = 'medium' } = task.inputs;

    return `
Research Topic: ${topic}

Scope: ${scope}
Depth: ${depth}

Conduct thorough research and provide:
1. Key findings
2. Supporting evidence
3. Different perspectives
4. Recommendations
5. Sources (simulated)`;
  }

  protected parseOutput(
    task: WorkerTask,
    response: string
  ): Record<string, any> {
    const sections = response.split(/\n(?=\d\.|Key|Supporting|Perspectives|Recommendations)/);

    return {
      findings: sections[0] || response,
      evidence: sections[1] || '',
      perspectives: sections[2] || '',
      recommendations: sections[3] || '',
      fullReport: response,
    };
  }
}

/**
 * Code Generation Worker
 * Specialized for generating code and technical solutions
 */
export class CodeGenerationWorker extends WorkerAgent {
  constructor() {
    super({
      name: 'CodeGenerationWorker',
      taskType: 'code-generation',
      description: 'Generates code and technical solutions',
      model: 'bedrock/us.amazon.nova-pro-v1:0',
      temperature: 0.3,
      maxTokens: 4000,
      systemPrompt: `You are an expert software engineer.

Your tasks:
- Generate clean, production-ready code
- Follow best practices and patterns
- Include error handling
- Add documentation comments
- Optimize for performance and maintainability

Output code with clear structure and explanations.`,
    });
  }

  protected buildPrompt(task: WorkerTask): string {
    const {
      language = 'typescript',
      requirement = '',
      context = '',
    } = task.inputs;

    return `
Language: ${language}

Requirement: ${requirement}

${context ? `Context: ${context}` : ''}

Generate complete, well-documented code that meets the requirement.
Include:
- Main implementation
- Error handling
- Type definitions (if applicable)
- Usage example`;
  }

  protected parseOutput(
    task: WorkerTask,
    response: string
  ): Record<string, any> {
    // Extract code blocks
    const codeBlocks = (response.match(/```[\s\S]*?```/g) || []).map(block =>
      block.replace(/^```\w+\n/, '').replace(/```$/, '')
    );

    return {
      code: codeBlocks[0] || response,
      allCode: codeBlocks,
      explanation: response,
    };
  }
}

/**
 * Worker Registry
 * Manages available worker types
 */
export class WorkerRegistry {
  private workers: Map<string, WorkerAgent> = new Map();

  /**
   * Register a worker
   */
  register(taskType: string, worker: WorkerAgent): void {
    this.workers.set(taskType, worker);
    console.log(`[WorkerRegistry] Registered worker for task type: ${taskType}`);
  }

  /**
   * Get worker for task type
   */
  getWorker(taskType: string): WorkerAgent | null {
    return this.workers.get(taskType) || null;
  }

  /**
   * List available workers
   */
  listWorkers(): string[] {
    return Array.from(this.workers.keys());
  }

  /**
   * Execute task with appropriate worker
   */
  async executeTask(task: WorkerTask): Promise<WorkerResult> {
    const worker = this.getWorker(task.taskType);

    if (!worker) {
      throw new Error(`No worker registered for task type: ${task.taskType}`);
    }

    return worker.executeTask(task);
  }
}

// Create default registry with built-in workers
export const defaultWorkerRegistry = new WorkerRegistry();
defaultWorkerRegistry.register('data-analysis', new DataAnalysisWorker());
defaultWorkerRegistry.register('research', new ResearchWorker());
defaultWorkerRegistry.register('code-generation', new CodeGenerationWorker());
