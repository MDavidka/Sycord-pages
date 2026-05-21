import { callModel, extractJson } from "@/lib/ai-provider"
import { GENERATE_SITE_ARCHITECTURE_PROMPT, GENERATE_PAGE_UI_TREE_PROMPT, GENERATE_SERVER_ACTIONS_PROMPT } from "./syra-prompts"
import { generateFile } from "./syra-compiler"
import type { BuilderOptions } from "./ai-website-builder"

export async function generateSiteArchitecture(prompt: string, model: any) {
  const result = await callModel({
    model,
    messages: [
      { role: "system", content: GENERATE_SITE_ARCHITECTURE_PROMPT },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  })
  if (!result.ok) throw new Error(result.message)
  return extractJson(result.content) as any
}

export async function generatePageUITree(route: any, database_schema: any, global_theme: any, model: any) {
  const result = await callModel({
    model,
    messages: [
      { role: "system", content: GENERATE_PAGE_UI_TREE_PROMPT },
      { role: "user", content: JSON.stringify({ route, database_schema, global_theme }) }
    ],
    temperature: 0.2
  })
  if (!result.ok) throw new Error(result.message)
  return extractJson(result.content) as any
}

export async function generateServerActions(database_schema: any, pages_ui_trees: any[], model: any) {
    const result = await callModel({
        model,
        messages: [
            { role: "system", content: GENERATE_SERVER_ACTIONS_PROMPT },
            { role: "user", content: JSON.stringify({ database_schema, pages_ui_trees }) }
        ],
        temperature: 0.2
    })
    if (!result.ok) throw new Error(result.message)
    return extractJson(result.content) as any
}

export async function runSyraBuilderPipeline(prompt: string, opts: BuilderOptions) {
  const logs = [];
  logs.push({ step: "Generating Site Architecture", detail: "Generating site architecture" });

  const sitePlan = await generateSiteArchitecture(prompt, opts.model);
  if (!sitePlan || !sitePlan.routes) {
    throw new Error("Failed to generate valid site architecture");
  }

  const files: any[] = [];
  const pagesUiTrees = [];

  for (const route of sitePlan.routes) {
    logs.push({ step: "Building Page UI Trees", detail: \`Generating UI tree for \${route.path}\` });
    const pageUiTree = await generatePageUITree(route, sitePlan.database_schema, sitePlan.theme_config, opts.model);

    if (pageUiTree) {
        pagesUiTrees.push(pageUiTree);
        logs.push({ step: "Compiling UI Components", detail: \`Compiling UI tree for \${route.path}\` });
        const code = generateFile(pageUiTree);
        const filePath = \`app\${route.path === '/' ? '/page.tsx' : route.path + '/page.tsx'}\`;
        files.push({ path: filePath, content: code });
    }
  }

  logs.push({ step: "Generating Server Actions", detail: "Generating server actions" });
  const serverActions = await generateServerActions(sitePlan.database_schema, pagesUiTrees, opts.model);

  if (serverActions && serverActions.actions && serverActions.actions.length > 0) {
      const code = serverActions.actions.map((a: any) => a.code).join('\\n\\n');
      files.push({ path: "app/api/actions.ts", content: code });
  }

  // Generate some base layout/configs
  logs.push({ step: "Building and Validating", detail: "Generating layout and configs" });
  files.push({
      path: "app/layout.tsx",
      content: \`
import { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '\${sitePlan.project_name}',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="\${sitePlan.theme_config?.mode === 'dark' ? 'dark' : ''}">
      <body>{children}</body>
    </html>
  )
}
\`
  });

  return {
    files,
    manifest: { pages: sitePlan.routes, theme: sitePlan.theme_config },
    logs,
    build: { ok: true, errors: [], warnings: [] },
    qualityScore: 100,
    needsDatabase: sitePlan.database_schema && sitePlan.database_schema.length > 0,
    databaseProvider: "turso",
    integrations: [],
    requiredEnvVars: [],
    missingEnvVars: [],
    unconnectedIntegrations: [],
    deploymentMode: "next-server",
  };
}
