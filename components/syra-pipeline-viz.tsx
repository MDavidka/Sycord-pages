'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Loader2, Zap, Brain, Search, FileText, Shield } from 'lucide-react';

export type PipelineStage = 'idle' | 'memory' | 'intent' | 'rag' | 'planning' | 'generating' | 'validating' | 'repairing' | 'complete' | 'error';

export interface PipelineStats {
  cacheHit?: boolean;
  contextFiles?: number;
  contextTokens?: number;
  planCreated?: boolean;
  validationScore?: number;
  repairsPassed?: number;
}

interface PipelineVizProps {
  stage: PipelineStage;
  stats?: PipelineStats;
  error?: string;
}

const stageConfig = {
  memory: { label: 'AI Memory', icon: Brain, color: 'from-blue-500 to-blue-600' },
  intent: { label: 'Intent Detection', icon: Zap, color: 'from-purple-500 to-purple-600' },
  rag: { label: 'RAG Context', icon: Search, color: 'from-amber-500 to-amber-600' },
  planning: { label: 'Plan Generation', icon: FileText, color: 'from-green-500 to-green-600' },
  generating: { label: 'Code Generation', icon: Zap, color: 'from-cyan-500 to-cyan-600' },
  validating: { label: 'Validation', icon: Shield, color: 'from-indigo-500 to-indigo-600' },
  repairing: { label: 'Auto-Repair', icon: Zap, color: 'from-orange-500 to-orange-600' },
};

const stages: PipelineStage[] = ['memory', 'intent', 'rag', 'planning', 'generating', 'validating', 'repairing'];

export function PipelineVisualization({ stage, stats, error }: PipelineVizProps) {
  const [expandedStage, setExpandedStage] = useState<PipelineStage | null>(null);

  const getStageStatus = (stageKey: PipelineStage): 'pending' | 'active' | 'complete' | 'error' => {
    if (stage === 'error') return 'error';
    if (stageKey === stage) return 'active';
    if (stages.indexOf(stageKey) < stages.indexOf(stage)) return 'complete';
    return 'pending';
  };

  return (
    <div className="w-full space-y-6">
      {/* Pipeline Progress */}
      <div className="rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-100">Syra Pipeline Execution</h3>

        {/* Stage Timeline */}
        <div className="space-y-3">
          {stages.map((stageKey, index) => {
            const status = getStageStatus(stageKey as PipelineStage);
            const config = stageConfig[stageKey as PipelineStage];
            const Icon = config.icon;

            return (
              <motion.div
                key={stageKey}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3"
              >
                {/* Status Indicator */}
                <div className="relative h-10 w-10 flex-shrink-0">
                  {status === 'active' && (
                    <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-white/20 to-transparent" />
                  )}
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                      status === 'complete'
                        ? 'bg-gradient-to-br from-green-500 to-green-600'
                        : status === 'active'
                          ? `bg-gradient-to-br ${config.color}`
                          : status === 'error'
                            ? 'bg-gradient-to-br from-red-500 to-red-600'
                            : 'bg-slate-700'
                    }`}
                  >
                    {status === 'complete' && <Check className="h-5 w-5 text-white" />}
                    {status === 'active' && <Loader2 className="h-5 w-5 animate-spin text-white" />}
                    {status === 'error' && <AlertCircle className="h-5 w-5 text-white" />}
                    {status === 'pending' && <Icon className="h-5 w-5 text-slate-400" />}
                  </div>
                </div>

                {/* Stage Label */}
                <button
                  onClick={() => setExpandedStage(expandedStage === stageKey ? null : stageKey)}
                  className="flex-1 text-left transition-colors hover:text-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">{config.label}</span>
                    {status === 'active' && (
                      <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                    )}
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Stage Details */}
        {expandedStage && stats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4"
          >
            <h4 className="mb-3 text-sm font-semibold text-slate-100">
              {stageConfig[expandedStage]?.label || 'Stage Details'}
            </h4>
            <StageDetails stage={expandedStage} stats={stats} />
          </motion.div>
        )}

        {/* Error Display */}
        {error && stage === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-lg border border-red-700 bg-red-900/20 p-4"
          >
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-red-200">Pipeline Error</p>
                <p className="mt-1 text-xs text-red-300">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Statistics Cards */}
      {stats && stage === 'complete' && <StatsCards stats={stats} />}
    </div>
  );
}

interface StageDetailsProps {
  stage: PipelineStage;
  stats: PipelineStats;
}

function StageDetails({ stage, stats }: StageDetailsProps) {
  const details: Record<PipelineStage, React.ReactNode> = {
    idle: null,
    memory: (
      <div className="space-y-2 text-xs text-slate-300">
        <p>Cache Status: {stats.cacheHit ? '✓ Cache Hit' : '✗ Cache Miss (Building new memory)'}</p>
        <p>Project Memory: Building file metadata, import graph, and design system tokens</p>
      </div>
    ),
    intent: (
      <div className="space-y-2 text-xs text-slate-300">
        <p>Analyzing user intent from prompt</p>
        <p>Determining scope and required planning depth</p>
      </div>
    ),
    rag: (
      <div className="space-y-2 text-xs text-slate-300">
        <p>Context Files: {stats.contextFiles || 0}</p>
        <p>Context Tokens: {stats.contextTokens || 0}</p>
        <p>Using RAG to select most relevant files for code generation</p>
      </div>
    ),
    planning: (
      <div className="space-y-2 text-xs text-slate-300">
        <p>Plan Created: {stats.planCreated ? '✓ Yes' : '✗ No (Skipped for simple changes)'}</p>
        <p>Structured plan helps ensure complex changes are well-organized</p>
      </div>
    ),
    generating: (
      <div className="space-y-2 text-xs text-slate-300">
        <p>Generating code based on intent, context, and plan</p>
        <p>Using AI model with project memory and RAG-selected files</p>
      </div>
    ),
    validating: (
      <div className="space-y-2 text-xs text-slate-300">
        <p>Validation Score: {stats.validationScore ? `${(stats.validationScore * 100).toFixed(0)}%` : 'N/A'}</p>
        <p>Checking syntax, imports, accessibility, and best practices</p>
      </div>
    ),
    repairing: (
      <div className="space-y-2 text-xs text-slate-300">
        <p>Repair Passes: {stats.repairsPassed || 0}</p>
        <p>Auto-fixing common issues to improve code quality</p>
      </div>
    ),
    complete: (
      <div className="space-y-2 text-xs text-slate-300">
        <p>Pipeline complete! Generated code is ready for use</p>
      </div>
    ),
    error: (
      <div className="space-y-2 text-xs text-red-300">
        <p>Pipeline encountered an error. Review the error message above.</p>
      </div>
    ),
  };

  return <div>{details[stage]}</div>;
}

interface StatsCardsProps {
  stats: PipelineStats;
}

function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { label: 'Cache Hit', value: stats.cacheHit ? 'Yes' : 'No', icon: '⚡' },
    { label: 'Context Files', value: stats.contextFiles || 0, icon: '📄' },
    { label: 'Context Tokens', value: stats.contextTokens || 0, icon: '🔤' },
    { label: 'Validation Score', value: stats.validationScore ? `${(stats.validationScore * 100).toFixed(0)}%` : 'N/A', icon: '✓' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-lg bg-slate-800 p-3"
        >
          <p className="mb-1 text-xs text-slate-400">{card.label}</p>
          <p className="text-lg font-semibold text-slate-100">
            {card.icon} {card.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
