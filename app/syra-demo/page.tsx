import React from 'react';
import { SyraAIBuilder } from '@/components/syra-ai-builder';

/**
 * Demo page for the Syra AI Builder Pipeline
 * 
 * This page showcases the complete Syra pipeline with:
 * - Real-time pipeline visualization
 * - AI memory caching and management
 * - Intent detection and RAG-based context selection
 * - Structured planning for complex builds
 * - Code generation with validation
 * - Automatic repair with diagnostics
 * - Build history and analytics
 */
export default function SyraDemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white">Syra AI Website Builder</h1>
            <p className="text-lg text-slate-400">
              Advanced AI-powered code generation with intelligent pipeline orchestration
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <FeatureCard
              icon="🧠"
              title="AI Memory"
              description="Smart caching of project structure, imports, and design tokens"
            />
            <FeatureCard
              icon="⚡"
              title="Intent Detection"
              description="Automatically determines scope and complexity of requests"
            />
            <FeatureCard
              icon="🔍"
              title="RAG Context"
              description="Intelligent file selection based on relevance scoring"
            />
            <FeatureCard
              icon="🛡️"
              title="Auto-Repair"
              description="Automatic fixing of common issues with diagnostics"
            />
          </div>
        </div>

        {/* Main Builder */}
        <SyraAIBuilder
          projectId="demo-project-001"
          projectName="Syra Demo Project"
        />

        {/* Pipeline Documentation */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold text-white">Pipeline Stages</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <StageCard
              number="1"
              title="AI Memory"
              description="Loads or builds project memory including file metadata, import graph, and design system tokens. Uses SHA-256 hashing to detect if cache is still valid."
            />
            <StageCard
              number="2"
              title="Intent Detection"
              description="Analyzes the prompt to determine user intent (create page, component, API, fix bug, etc.) and estimates complexity (small, medium, large)."
            />
            <StageCard
              number="3"
              title="RAG Context Selection"
              description="Uses Retrieval-Augmented Generation to select the most relevant files from the project based on intent, keywords, and import relationships."
            />
            <StageCard
              number="4"
              title="Plan Generation"
              description="Creates a structured plan with steps, dependencies, and priorities for complex changes. Skipped for simple requests."
            />
            <StageCard
              number="5"
              title="Code Generation"
              description="Generates code using the AI model, with context from selected files and optional structured plan."
            />
            <StageCard
              number="6"
              title="Validation"
              description="Validates syntax, imports, accessibility, and patterns. Returns diagnostic report with suggested fixes."
            />
            <StageCard
              number="7"
              title="Auto-Repair"
              description="Automatically applies fixes for common issues (max 3 passes). Each pass re-validates the code."
            />
            <StageCard
              number="8"
              title="Build Record"
              description="Saves build history with metrics including duration, repairs, cache hits, and token usage for analytics."
            />
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold text-white">Key Features</h2>

          <div className="space-y-4">
            <HighlightCard
              title="Smart Memory Caching"
              items={[
                'Project revision hashing with SHA-256',
                'File metadata extraction and analysis',
                'Import graph building for dependency tracking',
                'Design system token extraction',
                'Cache hit statistics for performance monitoring',
              ]}
            />

            <HighlightCard
              title="Intelligent Context Selection"
              items={[
                'RAG scoring based on file type, keywords, and import graph',
                'Dynamic token limit management',
                'Relevance weighting and diversity calculation',
                'Smart file filtering to stay within context windows',
              ]}
            />

            <HighlightCard
              title="Comprehensive Validation"
              items={[
                'Syntax checking (braces, quotes, brackets)',
                'Import path validation',
                'React/TypeScript pattern detection',
                'Accessibility checks (alt text, aria-labels)',
                'Style consistency verification',
              ]}
            />

            <HighlightCard
              title="Automatic Repair"
              items={[
                'Brace and quote mismatch fixing',
                'Import extension cleanup',
                'React import insertion',
                'Alt text generation for images',
                'Try/catch wrapping for async functions',
                'Max 3 repair passes with revalidation',
              ]}
            />

            <HighlightCard
              title="Build Analytics"
              items={[
                'Complete build history with status tracking',
                'Success rate and average duration metrics',
                'Repair pass statistics',
                'Cache hit rate analysis',
                'Failed build debugging and analysis',
              ]}
            />
          </div>
        </div>

        {/* MongoDB Collections */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold text-white">Data Storage</h2>

          <p className="text-slate-300">
            The Syra pipeline persists data in MongoDB with the following collections:
          </p>

          <div className="grid gap-4">
            <CollectionCard
              name="projectMemory"
              description="Cached AI memory for projects"
              fields={['projectId', 'projectName', 'memory (AIMemory object)', 'accessCount', 'lastAccessed']}
            />
            <CollectionCard
              name="buildPlans"
              description="Structured plans for complex builds"
              fields={['projectId', 'plan (BuildPlan object)', 'status', 'generatedCode', 'feedback']}
            />
            <CollectionCard
              name="buildHistory"
              description="Complete build history and audit trail"
              fields={['projectId', 'record (BuildRecord object)', 'tags', 'indexedTokens']}
            />
            <CollectionCard
              name="projectConfig"
              description="Project configuration and AI settings"
              fields={['projectId', 'framework', 'aiSettings', 'buildSettings', 'owner']}
            />
            <CollectionCard
              name="diagnostics"
              description="Validation diagnostics archive"
              fields={['projectId', 'buildId', 'diagnostics array', 'score', 'timestamp']}
            />
          </div>
        </div>

        {/* Getting Started */}
        <div className="mt-12 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-4 text-xl font-bold text-white">Getting Started</h2>
          <ol className="space-y-2 text-slate-300">
            <li>
              <span className="font-semibold">1. Enter a prompt</span> - Describe what you want to build in natural language
            </li>
            <li>
              <span className="font-semibold">2. Watch the pipeline</span> - See real-time visualization of each stage
            </li>
            <li>
              <span className="font-semibold">3. Review the code</span> - Inspect the generated code with syntax highlighting
            </li>
            <li>
              <span className="font-semibold">4. Copy to clipboard</span> - Use the generated code in your project
            </li>
            <li>
              <span className="font-semibold">5. View history</span> - Check previous builds and statistics
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-2 font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

interface StageCardProps {
  number: string;
  title: string;
  description: string;
}

function StageCard({ number, title, description }: StageCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
          {number}
        </div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface HighlightCardProps {
  title: string;
  items: string[];
}

function HighlightCard({ title, items }: HighlightCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <h3 className="font-semibold text-white">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CollectionCardProps {
  name: string;
  description: string;
  fields: string[];
}

function CollectionCard({ name, description, fields }: CollectionCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <h3 className="font-mono font-semibold text-blue-400">{name}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {fields.map((field, i) => (
          <span key={i} className="rounded bg-slate-700/50 px-2 py-1 font-mono text-xs text-slate-300">
            {field}
          </span>
        ))}
      </div>
    </div>
  );
}
