/**
 * Write File Tool
 * Writes agent output to the .open-lovable-data directory under a unique execution namespace
 */

import fs from 'fs';
import path from 'path';

export interface WriteFileResult {
  success: boolean;
  filePath: string;
  error?: string;
}

export function writeAgentOutput(
  executionId: string,
  nodeId: string,
  filename: string,
  content: string
): WriteFileResult {
  try {
    const outputDir = path.join(
      process.cwd(),
      '.open-lovable-data',
      'executions',
      executionId,
      nodeId
    );
    fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { success: true, filePath };
  } catch (error: any) {
    return {
      success: false,
      filePath: '',
      error: error.message,
    };
  }
}

export function readAgentOutput(
  executionId: string,
  nodeId: string,
  filename: string
): string | null {
  try {
    const filePath = path.join(
      process.cwd(),
      '.open-lovable-data',
      'executions',
      executionId,
      nodeId,
      filename
    );
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function listExecutionOutputs(executionId: string): string[] {
  try {
    const outputDir = path.join(
      process.cwd(),
      '.open-lovable-data',
      'executions',
      executionId
    );
    if (!fs.existsSync(outputDir)) return [];

    const results: string[] = [];
    const nodes = fs.readdirSync(outputDir);
    for (const node of nodes) {
      const nodeDir = path.join(outputDir, node);
      const files = fs.readdirSync(nodeDir);
      for (const file of files) {
        results.push(path.join(node, file));
      }
    }
    return results;
  } catch {
    return [];
  }
}
