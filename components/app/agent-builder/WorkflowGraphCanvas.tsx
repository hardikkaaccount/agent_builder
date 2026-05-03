'use client';

import React, { useMemo, useState } from 'react';
import { AgentNode, Workflow } from '@/types/agent';

interface WorkflowGraphCanvasProps {
  workflow: Workflow;
}

type PositionedNode = {
  node: AgentNode;
  level: number;
  lane: number;
  x: number;
  y: number;
};

const NODE_W = 220;
const NODE_H = 92;
const COL_GAP = 180;
const ROW_GAP = 40;
const PAD_X = 48;
const PAD_Y = 48;

function buildLevels(workflow: Workflow): Map<string, number> {
  const levelById = new Map<string, number>();
  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));

  const visit = (id: string): number => {
    if (levelById.has(id)) return levelById.get(id)!;
    const node = nodeMap.get(id);
    if (!node || node.dependencies.length === 0) {
      levelById.set(id, 0);
      return 0;
    }

    let maxDepLevel = 0;
    for (const depId of node.dependencies) {
      maxDepLevel = Math.max(maxDepLevel, visit(depId));
    }
    levelById.set(id, maxDepLevel + 1);
    return maxDepLevel + 1;
  };

  workflow.nodes.forEach((n) => visit(n.id));
  return levelById;
}

function getNodeColor(node: AgentNode): string {
  if (node.role === 'master') return '#0f766e';
  if (node.role === 'coordinator') return '#1d4ed8';
  if (node.role === 'delegator') return '#7c3aed';
  if (node.role === 'validator') return '#b45309';
  return '#334155';
}

export function WorkflowGraphCanvas({ workflow }: WorkflowGraphCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const { positionedNodes, width, height, edgePaths, criticalPathSet, dependencyMap, descendantMap } = useMemo(() => {
    const levels = buildLevels(workflow);
    const grouped = new Map<number, AgentNode[]>();
    const dependencyMap = new Map<string, string[]>();
    const descendantMap = new Map<string, string[]>();

    for (const node of workflow.nodes) {
      const lv = levels.get(node.id) ?? 0;
      const arr = grouped.get(lv) ?? [];
      arr.push(node);
      grouped.set(lv, arr);
      dependencyMap.set(node.id, [...node.dependencies]);
    }

    for (const node of workflow.nodes) {
      for (const depId of node.dependencies) {
        const arr = descendantMap.get(depId) ?? [];
        arr.push(node.id);
        descendantMap.set(depId, arr);
      }
    }

    const longestTo: Record<string, number> = {};
    const prevNode: Record<string, string | null> = {};
    const visit = (nodeId: string): number => {
      if (longestTo[nodeId] !== undefined) return longestTo[nodeId];
      const node = workflow.nodes.find((n) => n.id === nodeId);
      if (!node) return 0;
      if (node.dependencies.length === 0) {
        longestTo[nodeId] = 1;
        prevNode[nodeId] = null;
        return 1;
      }

      let bestLength = 0;
      let bestPrev: string | null = null;
      for (const depId of node.dependencies) {
        const len = visit(depId);
        if (len > bestLength) {
          bestLength = len;
          bestPrev = depId;
        }
      }

      longestTo[nodeId] = bestLength + 1;
      prevNode[nodeId] = bestPrev;
      return longestTo[nodeId];
    };

    workflow.nodes.forEach((node) => visit(node.id));

    let bestNodeId = workflow.nodes[0]?.id ?? '';
    for (const node of workflow.nodes) {
      if ((longestTo[node.id] ?? 0) > (longestTo[bestNodeId] ?? 0)) {
        bestNodeId = node.id;
      }
    }

    const criticalPathSet = new Set<string>();
    let cursor: string | null = bestNodeId;
    while (cursor) {
      criticalPathSet.add(cursor);
      cursor = prevNode[cursor] ?? null;
    }

    const maxLevel = Math.max(0, ...Array.from(grouped.keys()));

    const positioned: PositionedNode[] = [];
    for (const [lv, nodes] of grouped.entries()) {
      nodes.sort((a, b) => {
        const aOrder = workflow.executionOrder.indexOf(a.id);
        const bOrder = workflow.executionOrder.indexOf(b.id);
        return aOrder - bOrder;
      });

      nodes.forEach((node, idx) => {
        const x = PAD_X + lv * (NODE_W + COL_GAP);
        const y = PAD_Y + idx * (NODE_H + ROW_GAP);
        positioned.push({ node, level: lv, lane: idx, x, y });
      });
    }

    const maxLane = Math.max(0, ...positioned.map((p) => p.lane));
    const svgWidth = PAD_X * 2 + (maxLevel + 1) * NODE_W + maxLevel * COL_GAP;
    const svgHeight = PAD_Y * 2 + (maxLane + 1) * NODE_H + maxLane * ROW_GAP;

    const posMap = new Map(positioned.map((p) => [p.node.id, p]));
    const paths = workflow.edges
      .map((e) => {
        const from = posMap.get(e.from);
        const to = posMap.get(e.to);
        if (!from || !to) return null;

        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const cx1 = x1 + 56;
        const cx2 = x2 - 56;
        return { id: `${e.from}->${e.to}`, from: e.from, to: e.to, d: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}` };
      })
      .filter(Boolean) as Array<{ id: string; from: string; to: string; d: string }>;

    return { positionedNodes: positioned, width: svgWidth, height: svgHeight, edgePaths: paths, criticalPathSet, dependencyMap, descendantMap };
  }, [workflow]);

  const activeNodeId = hoveredNodeId || selectedNodeId;
  const activeNode = activeNodeId
    ? workflow.nodes.find((n) => n.id === activeNodeId) ?? null
    : null;

  const highlightedIds = useMemo(() => {
    if (!activeNodeId) return new Set<string>();

    const connected = new Set<string>([activeNodeId]);
    const stack = [activeNodeId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      const deps = dependencyMap.get(current) || [];
      const children = descendantMap.get(current) || [];

      for (const nextId of [...deps, ...children]) {
        if (!connected.has(nextId)) {
          connected.add(nextId);
          stack.push(nextId);
        }
      }
    }

    return connected;
  }, [activeNodeId, dependencyMap, descendantMap]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 overflow-auto">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 px-4 py-3 text-xs text-slate-300">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Active node</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /> Critical path</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-500" /> Connected graph</span>
        </div>
        <svg width={width} height={height} className="min-w-full min-h-[420px]">
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
            </marker>
          </defs>

          {edgePaths.map((edge) => (
            <path
              key={edge.id}
              d={edge.d}
              fill="none"
              stroke={highlightedIds.size === 0 ? '#64748b' : highlightedIds.has(edge.from) && highlightedIds.has(edge.to) ? '#22d3ee' : '#334155'}
              strokeWidth={highlightedIds.size === 0 ? 2 : highlightedIds.has(edge.from) && highlightedIds.has(edge.to) ? 3 : 1.5}
              markerEnd="url(#arrowhead)"
              opacity={highlightedIds.size === 0 ? 0.8 : highlightedIds.has(edge.from) && highlightedIds.has(edge.to) ? 1 : 0.25}
            />
          ))}

          {positionedNodes.map((p) => {
            const isSelected = selectedNodeId === p.node.id;
            const isHovered = hoveredNodeId === p.node.id;
            const isCritical = criticalPathSet.has(p.node.id);
            const isConnected = highlightedIds.size === 0 || highlightedIds.has(p.node.id);
            return (
              <g
                key={p.node.id}
                transform={`translate(${p.x}, ${p.y})`}
                onClick={() => setSelectedNodeId(p.node.id)}
                onMouseEnter={() => setHoveredNodeId(p.node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{ cursor: 'pointer', opacity: isConnected ? 1 : 0.35 }}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx="12"
                  fill={isSelected || isHovered ? '#1e293b' : '#0f172a'}
                  stroke={isCritical ? '#f59e0b' : isSelected || isHovered ? '#22d3ee' : '#334155'}
                  strokeWidth={isCritical ? 2.5 : isSelected || isHovered ? 2.5 : 1.5}
                />
                <rect width={NODE_W} height={6} rx="12" fill={isCritical ? '#f59e0b' : getNodeColor(p.node)} />
                <text x={12} y={28} fill="#e2e8f0" fontSize="13" fontWeight="700">
                  {p.node.name.length > 28 ? `${p.node.name.slice(0, 28)}...` : p.node.name}
                </text>
                <text x={12} y={48} fill="#94a3b8" fontSize="11">
                  {p.node.role.toUpperCase()}
                </text>
                <text x={12} y={66} fill="#94a3b8" fontSize="11">
                  deps: {p.node.dependencies.length}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-slate-100">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300 mb-3">Node Details</h3>
        {!activeNode && (
          <p className="text-sm text-slate-400">Select any node in the canvas to inspect task details and dependencies.</p>
        )}
        {activeNode && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-slate-400">Name</div>
              <div className="font-semibold text-slate-100">{activeNode.name}</div>
            </div>
            <div>
              <div className="text-slate-400">Role</div>
              <div>{activeNode.role}</div>
            </div>
            <div>
              <div className="text-slate-400">Task</div>
              <div>{activeNode.task}</div>
            </div>
            <div>
              <div className="text-slate-400">Dependencies</div>
              <div>{activeNode.dependencies.length > 0 ? activeNode.dependencies.join(', ') : 'None'}</div>
            </div>
            <div>
              <div className="text-slate-400">Input Keys</div>
              <div>{Object.keys(activeNode.inputs).join(', ') || 'None'}</div>
            </div>
            <div>
              <div className="text-slate-400">Output Keys</div>
              <div>{Object.keys(activeNode.outputs).join(', ') || 'None'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
