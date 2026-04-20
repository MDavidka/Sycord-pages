import { componentManifest } from "@/lib/ai-builder/manifest"

const MAX_PROMPT_LENGTH = 1000

export function prepareInput(rawPrompt: string): { prompt: string; cheatsheet: string[] } {
  const prompt = rawPrompt.trim().slice(0, MAX_PROMPT_LENGTH)
  const cheatsheet = Object.keys(componentManifest)

  if (prompt.length < 5) {
    throw new Error("Prompt too short")
  }

  if (cheatsheet.length === 0) {
    throw new Error("Empty manifest")
  }

  return { prompt, cheatsheet }
}
