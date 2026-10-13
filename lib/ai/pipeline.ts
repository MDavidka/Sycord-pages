import { loadPages, saveGeneratedSnapshot } from "./project-store";
import { buildProjectMemory } from "./memory";
import { buildContextPack } from "./rag";
import { parseModelOutput } from "./output-parser";
import { validateChangeset } from "./validators";
import { SYRA_SYSTEM_PROMPT } from "./prompt-templates";
import { callModel } from "@/lib/ai-provider";
import { Mode, IntentResult, BuildPlan } from "./types";
import { getCachedPlan, setCachedPlan, cacheStats } from "./cache";

export interface PipelineOptions {
  projectId: string;
  userId: string;
  prompt: string;
  model: any;
  mode?: string;
  selectedFile?: string;
  stream: any;
}

export async function runSyraPipeline(opts: PipelineOptions) {
  const { projectId, userId, prompt, model, stream, mode = "auto" } = opts;

  await stream.send("stage", { stage: "starting", status: "running", title: "Starting Syra", message: "Loading your project and preparing the builder..." });

  // 1. Snapshot
  await stream.send("memory", { stage: "memory", status: "running", title: "Reading project memory", message: "Checking existing files..." });
  const rawPages = await loadPages(userId, projectId);
  const files = rawPages.map((p: any) => ({ name: p.name, code: p.code, timestamp: p.timestamp, usedFor: p.usedFor }));
  const revision = "rev-" + Date.now();
  const memory = buildProjectMemory(projectId, revision, files);
  await stream.send("memory", { stage: "memory", status: "done", title: "Reading project memory", message: `Loaded ${files.length} files.`, cacheHit: false });

  // 2. Intent Detection
  await stream.send("stage", { stage: "intent", status: "running", title: "Understanding request" });
  let resolvedMode: Mode = (mode as Mode) === "auto" ? (files.length === 0 ? "generate" : "edit") : (mode as Mode);

  const intentPrompt = `Analyze the user prompt and project state to determine the build intent.
User Prompt: ${prompt}
Existing Files Count: ${files.length}
Output strictly as JSON matching this schema: {"mode": "generate"|"edit"|"fix", "confidence": number, "reason": "string", "targetFilesHint": ["file1"], "destructive": boolean}`;

  const intentRes = await callModel({
    model,
    messages: [{ role: "user", content: intentPrompt }]
  });

  let intent: IntentResult = { mode: resolvedMode, confidence: 1, reason: "Fallback intent", targetFilesHint: [], destructive: false };
  if (intentRes.ok) {
    try {
        const parsed = JSON.parse(intentRes.content.match(/\{[\s\S]*\}/)?.[0] || "{}");
        if (parsed.mode) intent.mode = parsed.mode;
        if (parsed.targetFilesHint) intent.targetFilesHint = parsed.targetFilesHint;
    } catch(e) {}
  }

  resolvedMode = intent.mode;
  await stream.send("stage", { stage: "intent", status: "done", title: "Understanding request", message: `Detected ${resolvedMode} mode.`, mode: resolvedMode });

  // 3. RAG Context
  await stream.send("memory", { stage: "context", status: "running", title: "Selecting relevant files" });
  const contextPack = buildContextPack(files, memory, intent);
  await stream.send("memory", { stage: "context", status: "done", title: "Selecting relevant files", message: `Using ${contextPack.fullFiles.length} files fully.` });

  // 4. Plan
  await stream.send("plan", { stage: "planning", status: "running", title: "Planning changes" });

  const systemMsg = SYRA_SYSTEM_PROMPT;
  let contextMsg = "Context Files:\n";
  for (const f of contextPack.fullFiles) {
    contextMsg += `--- FILE: ${f.name} ---\n${f.code}\n\n`;
  }

  const planPrompt = `Mode: ${resolvedMode}\nTask: ${prompt}\n\n${contextMsg}\nGenerate a strict JSON BuildPlan matching the required schema: {"mode": "generate"|"edit"|"fix", "title": "...", "summary": "...", "filesToCreate": [], "filesToModify": [], "filesToDelete": [], "filesToMove": []}`;

  let plan: BuildPlan | null = getCachedPlan(resolvedMode, prompt, revision, model.id, cacheStats);

  if (!plan) {
      const planRes = await callModel({
        model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: planPrompt }
        ]
      });

      if (planRes.ok) {
          try {
              plan = JSON.parse(planRes.content.match(/\{[\s\S]*\}/)?.[0] || "{}") as BuildPlan;
              setCachedPlan(resolvedMode, prompt, revision, model.id, plan);
          } catch(e) {}
      }
  }

  await stream.send("plan", { stage: "planning", status: "done", title: "Plan ready", mode: resolvedMode, plan });

  // 5. Generate Code
  await stream.send("file", { stage: "writing", status: "running", title: "Generating code" });

  const generatePrompt = `Mode: ${resolvedMode}\nTask: ${prompt}\nPlan:\n${JSON.stringify(plan)}\n\n${contextMsg}\nReturn strict JSON matching the required Code output schema: {"files": [{"name": "app/page.tsx", "action": "upsert", "usedFor": "...", "content": "..."}], "delete": [], "move": []}`;

  const modelRes = await callModel({
    model,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: generatePrompt }
    ]
  });

  if (!modelRes.ok) {
    throw new Error(`Provider error: ${modelRes.message}`);
  }

  // Stream each file event for UI
  try {
      const parsedFiles = JSON.parse(modelRes.content.match(/\{[\s\S]*\}/)?.[0] || "{}");
      if (parsedFiles && Array.isArray(parsedFiles.files)) {
          for (const file of parsedFiles.files) {
              await stream.send("file", { stage: "writing", status: "done", title: `Generated ${file.name}`, file: file.name });
          }
      }
  } catch(e) {}

  await stream.send("file", { stage: "writing", status: "done", title: "Generated code" });

  // 6. Parse
  const changeset = parseModelOutput(modelRes.content);
  if (changeset.parserWarnings.length > 0) {
    for (const w of changeset.parserWarnings) {
      await stream.send("diagnostic", { stage: "parsing", severity: w.severity, message: w.message });
    }
  }

  // 7. Validate & Repair
  await stream.send("stage", { stage: "validating", status: "running", title: "Validating project" });
  const diagnostics = validateChangeset(changeset, files);

  let finalChangeset = changeset;

  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      await stream.send("diagnostic", { stage: "validating", severity: d.severity, file: d.file, message: d.message });
    }

    await stream.send("repair", { stage: "repair", status: "running", title: "Auto-repair pass 1", message: `Fixing ${diagnostics.length} validation errors.` });

    const repairMsg = `Your previous output had validation errors:\n${JSON.stringify(diagnostics)}\nPlease fix them and return the strict JSON changeset again.`;
    const repairRes = await callModel({
        model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: generatePrompt },
          { role: "assistant", content: modelRes.content },
          { role: "user", content: repairMsg }
        ]
    });
    if (repairRes.ok) {
        finalChangeset = parseModelOutput(repairRes.content);
        await stream.send("repair", { stage: "repair", status: "done", title: "Repair pass 1 complete" });
    } else {
        await stream.send("repair", { stage: "repair", status: "error", title: "Repair failed" });
    }
  } else {
    await stream.send("stage", { stage: "validating", status: "done", title: "Project validated" });
  }

  // 8. Save
  await stream.send("stage", { stage: "saving", status: "running", title: "Saving project" });
  await saveGeneratedSnapshot(userId, projectId, finalChangeset, resolvedMode);

  await stream.send("saved", { stage: "saving", status: "done", title: "Saved project", changedFiles: finalChangeset.upserts.map(u => u.name) });

  await stream.send("done", { stage: "done", status: "done", title: "Build complete" });
}
