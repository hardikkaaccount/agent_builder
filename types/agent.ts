/**
 * Agent Builder Types
 * Core types for multi-agentic workflow system
 */

// ============================================================================
// AGENT & WORKFLOW TYPES
// ============================================================================

export type BuiltInAgentRole = 'master' | 'coordinator' | 'delegator' | 'worker' | 'validator';
export type AgentRole = BuiltInAgentRole | (string & {});
export type NodeStatus = 'pending' | 'running' | 'testing' | 'success' | 'failed' | 'skipped' | 'retrying';
export type WorkflowStatus = 'draft' | 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'archived';
export type ExecutionEnvironment = 'sandbox' | 'local' | 'cloud';

/**
 * Tool definition for agents to use
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  maxRetries?: number;
}

/**
 * Schema for agent input/output validation
 */
export interface IOSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required?: boolean;
    items?: IOSchema;
    properties?: IOSchema;
  };
}

/**
 * Individual agent node in workflow
 */
export interface AgentNode {
  // Identity
  id: string;
  name: string;
  description: string;
  
  // Role & Configuration
  role: AgentRole;
  task: string;
  systemPrompt?: string;
  
  // Input/Output
  inputs: IOSchema;
  outputs: IOSchema;
  
  // Dependencies & Execution
  dependencies: string[]; // Node IDs this depends on
  skipOnFailure?: boolean; // Skip this node if dependency fails
  
  // Environment & Resources
  environment: Record<string, string>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  
  // Tools & Actions
  tools?: Tool[];
  canExecuteCode?: boolean;
  
  // Success Criteria
  successCriteria?: string[];
  expectedOutputFormat?: Record<string, any>;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Complete workflow DAG
 */
export interface Workflow {
  // Identity
  id: string;
  name: string;
  description: string;
  
  // Goal & Purpose
  goal: string; // Original user prompt/goal
  category?: string; // e.g., "travel", "data-analysis", "content-generation"
  
  // Structure
  nodes: AgentNode[];
  edges: WorkflowEdge[]; // Connections between nodes
  executionOrder: string[]; // Topologically sorted node IDs
  
  // Configuration
  parallelExecution?: boolean;
  maxRetries?: number;
  timeout?: number; // milliseconds
  environment: Record<string, string>; // Global environment vars
  
  // Metadata
  version: number;
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  
  // Statistics
  nodeCount: number;
  edgeCount: number;
  complexity: 'simple' | 'moderate' | 'complex'; // Based on node count & dependencies
}

/**
 * Edge connecting two nodes
 */
export interface WorkflowEdge {
  from: string; // Source node ID
  to: string; // Target node ID
  outputKey?: string; // Which output maps to input
  inputKey?: string; // Which input receives output
}

/**
 * Test result for a node
 */
export interface TestResult {
  passed: boolean;
  criteria: string;
  actualValue: any;
  expectedValue: any;
  message: string;
  timestamp: Date;
}

/**
 * Execution state of a single node
 */
export interface NodeExecution {
  // Identity
  nodeId: string;
  workflowId: string;
  executionId: string;
  
  // Status & Progress
  status: NodeStatus;
  startTime?: Date;
  endTime?: Date;
  
  // Data
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  
  // Testing & Quality
  testResults?: TestResult[];
  validationPassed?: boolean;
  
  // Metrics
  duration?: number; // milliseconds
  retryCount: number;
  maxRetries: number;
  
  // Logs
  logs: ExecutionLog[];
}

/**
 * Complete execution state of workflow
 */
export interface ExecutionState {
  // Identity
  id: string;
  workflowId: string;
  
  // Status
  status: WorkflowStatus;
  startTime: Date;
  endTime?: Date;
  
  // Node executions
  nodeStates: Record<string, NodeExecution>;
  
  // Global data
  globalContext: Record<string, any>;
  
  // Tracking
  completedNodes: string[];
  failedNodes: string[];
  skippedNodes: string[];
  
  // Metrics
  totalDuration?: number;
  nodesCompleted: number;
  nodesFailed: number;
  
  // Logs
  logs: ExecutionLog[];
}

/**
 * Execution log entry
 */
export interface ExecutionLog {
  timestamp: Date;
  nodeId?: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  data?: any;
  source: 'master' | 'coordinator' | 'delegator' | 'worker' | 'validator';
}

// ============================================================================
// AGENT COMMUNICATION TYPES
// ============================================================================

/**
 * Master Agent request/response
 */
export interface MasterAgentInput {
  userPrompt: string;
  context?: string;
  constraints?: string[];
  preferences?: Record<string, any>;
}

export interface MasterAgentOutput {
  workflow: Workflow;
  reasoning: string; // Explanation of why this workflow was created
  alternatives?: Workflow[]; // Alternative workflows user could choose from
  confidence: number; // 0-1, confidence in this workflow
}

/**
 * Delegator Agent request/response
 */
export interface DelegatorAgentInput {
  workflow: Workflow;
  node: AgentNode;
}

export interface DelegatorAgentOutput {
  refinedNode: AgentNode;
  codeTemplate?: string;
  expectedBehavior: string;
}

/**
 * Coordinator Agent request/response
 */
export interface CoordinatorAgentInput {
  workflow: Workflow;
  executionState: ExecutionState;
}

export interface CoordinatorAgentOutput {
  action: 'continue' | 'retry' | 'skip' | 'fail' | 'pause';
  nextNodes: string[];
  reason: string;
}

/**
 * Worker Agent request/response
 */
export interface WorkerAgentInput {
  node: AgentNode;
  inputs: Record<string, any>;
  context: Record<string, any>;
}

export interface WorkerAgentOutput {
  success: boolean;
  output?: Record<string, any>;
  error?: string;
  logs: string[];
}

// ============================================================================
// UI & DISPLAY TYPES
// ============================================================================

/**
 * Workflow for UI display
 */
export interface WorkflowDisplayData {
  workflow: Workflow;
  executionState?: ExecutionState;
  nodePositions?: Record<string, { x: number; y: number }>;
  
  // Computed
  statusCounts: Record<NodeStatus, number>;
  totalExecutionTime?: number;
}

/**
 * Node for UI rendering
 */
export interface NodeDisplayData {
  node: AgentNode;
  execution?: NodeExecution;
  
  // Display
  x: number;
  y: number;
  width: number;
  height: number;
  
  // Computed
  isHighlighted: boolean;
  isSelected: boolean;
  errorCount: number;
}

// ============================================================================
// STORAGE & DATABASE TYPES
// ============================================================================

/**
 * Workflow record for storage
 */
export interface StoredWorkflow {
  id: string;
  data: Workflow;
  savedAt: Date;
  updatedAt: Date;
  tags: string[];
  isPublic: boolean;
  author?: string;
}

/**
 * Execution record for history
 */
export interface StoredExecution {
  id: string;
  workflowId: string;
  data: ExecutionState;
  savedAt: Date;
  status: WorkflowStatus;
  metrics?: {
    totalTime: number;
    averageNodeTime: number;
    successRate: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Agent builder specific errors
 */
export class AgentBuilderError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AgentBuilderError';
  }
}

export class WorkflowValidationError extends AgentBuilderError {
  constructor(message: string, details?: any) {
    super(message, 'WORKFLOW_VALIDATION_ERROR', details);
    this.name = 'WorkflowValidationError';
  }
}

export class NodeExecutionError extends AgentBuilderError {
  constructor(message: string, details?: any) {
    super(message, 'NODE_EXECUTION_ERROR', details);
    this.name = 'NodeExecutionError';
  }
}

export class MasterAgentError extends AgentBuilderError {
  constructor(message: string, details?: any) {
    super(message, 'MASTER_AGENT_ERROR', details);
    this.name = 'MasterAgentError';
  }
}
