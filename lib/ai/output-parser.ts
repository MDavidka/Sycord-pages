import { ParsedFileChangeSet, Diagnostic } from "./types";

export function parseModelOutput(content: string): ParsedFileChangeSet {
  const result: ParsedFileChangeSet = { upserts: [], deletes: [], moves: [], parserWarnings: [] };

  if (!content) {
    result.parserWarnings.push({ file: "output", severity: "error", code: "EMPTY_OUTPUT", message: "Model returned empty output." });
    return result;
  }

  const trimmed = content.trim();
  let parsed: any = null;

  try {
    parsed = extractJson(trimmed);
  } catch (err: any) {
    result.parserWarnings.push({ file: "output", severity: "error", code: "PARSE_FAILED", message: `Failed to parse output as JSON: ${err.message}` });
  }

  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.files)) {
      for (const file of parsed.files) {
        if (!file.name) continue;
        if (file.action === "upsert" && typeof file.content === "string") {
            let fileContent = file.content;
            if (fileContent.startsWith("```") && fileContent.endsWith("```")) {
                const lines = fileContent.split("\n");
                lines.shift();
                lines.pop();
                fileContent = lines.join("\n");
                result.parserWarnings.push({ file: file.name, severity: "warning", code: "MARKDOWN_FENCES", message: "Stripped markdown fences from file content." });
            }
            result.upserts.push({ name: file.name, content: fileContent, usedFor: file.usedFor || "" });
        } else if (file.action === "delete") {
            result.deletes.push(file.name);
        }
      }
    }
    if (Array.isArray(parsed.delete)) {
        for (const f of parsed.delete) {
            if (typeof f === "string") result.deletes.push(f);
            else if (f && typeof f === "object" && typeof f.name === "string") result.deletes.push(f.name);
        }
    }
    if (Array.isArray(parsed.move)) {
        for (const f of parsed.move) {
            if (f && typeof f === "object" && typeof f.from === "string" && typeof f.to === "string") {
                result.moves.push({ from: f.from, to: f.to });
            }
        }
    }
  }

  return result;
}

export function extractJson<T = unknown>(content: string): T | null {
  if (!content) return null;
  const trimmed = content.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as T;
    } catch {
      // fall through
    }
  }

  const firstArray = trimmed.indexOf("[");
  const firstObject = trimmed.indexOf("{");
  const startChar = firstArray >= 0 && (firstArray < firstObject || firstObject < 0) ? "[" : "{";
  const closeChar = startChar === "[" ? "]" : "}";
  const startIdx = trimmed.indexOf(startChar);
  if (startIdx >= 0) {
    let depth = 0;
    let endIdx = -1;
    let inString = false;
    let escaped = false;
    for (let i = startIdx; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === startChar) depth++;
      else if (ch === closeChar) { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    if (endIdx > startIdx) {
      try {
        const jsonStr = trimmed.slice(startIdx, endIdx + 1);
        return JSON.parse(jsonStr) as T;
      } catch {
        // fall through
      }
    }
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}
