'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Copy, AlertCircle, Info, Loader2, CheckCircle2 } from 'lucide-react';
import { PipelineVisualization, type PipelineStage, type PipelineStats } from './syra-pipeline-viz';

interface BuildState {
  stage: PipelineStage;
  stats?: PipelineStats;
  generatedCode?: string;
  error?: string;
  validationReport?: string;
}

interface SyraAIBuilderProps {
  projectId: string;
  projectName: string;
  onCodeGenerated?: (code: string) => void;
}

export function SyraAIBuilder({ projectId, projectName, onCodeGenerated }: SyraAIBuilderProps) {
  const [prompt, setPrompt] = useState('');
  const [buildState, setBuildState] = useState<BuildState>({ stage: 'idle' });
  const [buildHistory, setBuildHistory] = useState<Array<{ prompt: string; timestamp: Date; status: 'success' | 'error' }>>([]);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    console.log('[v0] Starting Syra build with prompt:', prompt.substring(0, 50));

    setBuildState({ stage: 'memory' });

    try {
      // Step 1: Memory loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBuildState(prev => ({ ...prev, stage: 'intent', stats: { cacheHit: false } }));

      // Step 2: Intent detection
      await new Promise(resolve => setTimeout(resolve, 800));
      setBuildState(prev => ({ ...prev, stage: 'rag' }));

      // Step 3: RAG context selection
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBuildState(prev => ({
        ...prev,
        stage: 'planning',
        stats: { cacheHit: false, contextFiles: 5, contextTokens: 2300 },
      }));

      // Step 4: Planning (if needed)
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Step 5: Code generation
      setBuildState(prev => ({ ...prev, stage: 'generating' }));
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 6: Validation
      setBuildState(prev => ({ ...prev, stage: 'validating' }));
      await new Promise(resolve => setTimeout(resolve, 800));

      // Step 7: Auto-repair
      setBuildState(prev => ({ ...prev, stage: 'repairing' }));
      await new Promise(resolve => setTimeout(resolve, 600));

      // Generate placeholder code
      const generatedCode = generatePlaceholderCode(prompt);

      setBuildState({
        stage: 'complete',
        generatedCode,
        stats: {
          cacheHit: false,
          contextFiles: 5,
          contextTokens: 2300,
          planCreated: true,
          validationScore: 0.95,
          repairsPassed: 0,
        },
      });

      setBuildHistory(prev => [
        { prompt, timestamp: new Date(), status: 'success' },
        ...prev,
      ]);

      onCodeGenerated?.(generatedCode);
    } catch (error) {
      console.error('[v0] Build failed:', error);
      setBuildState({
        stage: 'error',
        error: error instanceof Error ? error.message : 'Build failed. Please try again.',
      });

      setBuildHistory(prev => [
        { prompt, timestamp: new Date(), status: 'error' },
        ...prev,
      ]);
    }
  };

  const copyToClipboard = () => {
    if (buildState.generatedCode) {
      navigator.clipboard.writeText(buildState.generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <h1 className="text-2xl font-bold text-white">Syra AI Builder</h1>
        <p className="mt-1 text-sm text-slate-400">
          Project: <span className="font-semibold text-slate-300">{projectName}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Panel: Input & History */}
        <div className="space-y-4 lg:col-span-1">
          {/* Prompt Input */}
          <form onSubmit={handleBuild} className="space-y-3 rounded-lg bg-slate-900 p-4">
            <label className="block text-xs font-semibold uppercase text-slate-400">Describe what to build</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={buildState.stage !== 'idle' && buildState.stage !== 'complete' && buildState.stage !== 'error'}
              placeholder="Create a modern card component with hover effects..."
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
              rows={4}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || (buildState.stage !== 'idle' && buildState.stage !== 'complete' && buildState.stage !== 'error')}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50 hover:enabled:shadow-lg"
            >
              {buildState.stage !== 'idle' && buildState.stage !== 'complete' && buildState.stage !== 'error' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Build
                </>
              )}
            </button>
          </form>

          {/* Build History */}
          {buildHistory.length > 0 && (
            <div className="rounded-lg bg-slate-900 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase text-slate-400">Build History</h3>
              <div className="space-y-2">
                {buildHistory.slice(0, 5).map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2 rounded border border-slate-700 bg-slate-800/50 p-2 text-xs"
                  >
                    {entry.status === 'success' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-200">{entry.prompt}</p>
                      <p className="text-slate-500">{entry.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Pipeline & Code */}
        <div className="space-y-4 lg:col-span-2">
          {/* Pipeline Visualization */}
          <PipelineVisualization
            stage={buildState.stage}
            stats={buildState.stats}
            error={buildState.error}
          />

          {/* Generated Code */}
          <AnimatePresence mode="wait">
            {buildState.generatedCode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-lg bg-slate-900 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-100">Generated Code</h3>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div ref={codeRef} className="overflow-x-auto">
                  <pre className="max-h-96 bg-slate-950 p-4 text-xs text-slate-300">
                    <code>{buildState.generatedCode}</code>
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation Report */}
          {buildState.validationReport && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-blue-700 bg-blue-900/20 p-4"
            >
              <div className="flex gap-3">
                <Info className="h-5 w-5 flex-shrink-0 text-blue-400" />
                <div className="text-xs text-blue-200">
                  <p className="font-semibold">Validation Report</p>
                  <pre className="mt-2 overflow-x-auto font-mono text-xs">{buildState.validationReport}</pre>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Generate placeholder code based on prompt
 */
function generatePlaceholderCode(prompt: string): string {
  const isComponent = prompt.toLowerCase().includes('component');
  const isPage = prompt.toLowerCase().includes('page');
  const hasHover = prompt.toLowerCase().includes('hover');
  const isCard = prompt.toLowerCase().includes('card');

  if (isPage) {
    return `'use client';

import React from 'react';

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <h1 className="text-4xl font-bold text-white">Welcome</h1>
        <p className="mt-4 text-lg text-slate-300">
          This page was generated by Syra AI Builder based on your prompt.
        </p>
      </div>
    </main>
  );
}`;
  }

  if (isCard) {
    return `'use client';

import React from 'react';

export function Card({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className={\"rounded-lg border border-slate-700 bg-slate-800 p-6 transition-all duration-300 ${hasHover ? 'hover:shadow-lg hover:border-slate-500' : ''}\`}>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mt-2 text-slate-400">{description}</p>}
      {children}
    </div>
  );
}

export default Card;`;
  }

  if (isComponent) {
    return `'use client';

import React from 'react';

interface ${prompt.match(/\\w+/)?.[0]?.charAt(0).toUpperCase()}ComponentProps {
  // Define your props here
}

export function ${prompt.match(/\\w+/)?.[0]?.charAt(0).toUpperCase()}Component(props: ${prompt.match(/\\w+/)?.[0]?.charAt(0).toUpperCase()}ComponentProps) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 p-6">
      {/* Component content */}
      <p className="text-white">Generated component content goes here</p>
    </div>
  );
}`;
  }

  return `'use client';

import React from 'react';

export default function GeneratedComponent() {
  const [state, setState] = React.useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="rounded-lg bg-slate-800 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white">Generated by Syra</h1>
        <p className="mt-4 text-slate-300">Prompt: ${prompt}</p>
        <button
          onClick={() => setState(!state)}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Click Me
        </button>
      </div>
    </div>
  );
}`;
}
