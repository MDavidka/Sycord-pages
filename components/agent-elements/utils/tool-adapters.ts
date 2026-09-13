import type { TimelineStep, StepState } from "../types/timeline";

function calculateDiffStatsFromPatch(
  patches: Array<{ lines?: string[] }>,
): string | undefined {
  let addedLines = 0;
  let removedLines = 0;

  for (const patch of patches) {
    if (!patch.lines) continue;
    for (const line of patch.lines) {
      if (line.startsWith("+")) addedLines++;
      else if (line.startsWith("-")) removedLines++;
    }
  }

  if (addedLines === 0 && removedLines === 0) return undefined;

  const parts: string[] = [];
  if (addedLines > 0) parts.push(`+${addedLines}`);
  if (removedLines > 0) parts.push(`-${removedLines}`);
  return parts.join(" ");
}

function getDiffLinesFromPatch(
  patches: Array<{ lines?: string[] }>,
): { type: "add" | "remove" | "context"; content: string }[] {
  const result: { type: "add" | "remove" | "context"; content: string }[] = [];

  for (const patch of patches) {
    if (!patch.lines) continue;
    for (const line of patch.lines) {
      if (line.startsWith("+")) {
        result.push({ type: "add", content: line.slice(1) });
      } else if (line.startsWith("-")) {
        result.push({ type: "remove", content: line.slice(1) });
      } else if (line.startsWith(" ")) {
        result.push({ type: "context", content: line.slice(1) });
      }
    }
  }

  return result;
}

export function mapToolStateToStepState(
  aiState: "partial-call" | "call" | "result",
): StepState {
  return aiState === "result" ? "complete" : "animating";
}

export function mapToolNameToVariant(
  toolName: string,
): "thinking" | "action" | "search" | undefined {
  const lower = toolName.toLowerCase();
  if (lower === "thinking" || lower === "reasoning") return "thinking";
  if (
    lower === "websearch" ||
    lower === "web_search" ||
    lower === "grep" ||
    lower === "glob" ||
    lower === "webfetch" ||
    lower === "web_fetch" ||
    lower === "list_files" ||
    lower === "syte_list_files"
  )
    return "search";
  if (
    lower === "bash" ||
    lower === "run_command" ||
    lower === "syte_run_command" ||
    lower === "executecommand" ||
    lower === "install_package" ||
    lower === "syte_install_package" ||
    lower === "write" ||
    lower === "write_file" ||
    lower === "syte_write_file" ||
    lower === "createfile" ||
    lower === "edit" ||
    lower === "edit_file" ||
    lower === "syte_edit_file" ||
    lower === "apply_patch" ||
    lower === "delete_file" ||
    lower === "syte_delete_file" ||
    lower === "deletefile" ||
    lower === "create_folder" ||
    lower === "syte_create_folder" ||
    lower === "rename_file" ||
    lower === "move_file" ||
    lower === "start_preview" ||
    lower === "take_screenshot" ||
    lower === "check_types" ||
    lower === "run_lint"
  )
    return "action";
  return undefined;
}

function extractToolDetail(
  toolName: string,
  args: Record<string, any>,
): string {
  const lower = toolName.toLowerCase();
  switch (lower) {
    case "bash":
    case "run_command":
    case "syte_run_command":
    case "executecommand":
      return (args?.command || args?.cmd) ? String(args?.command || args?.cmd).slice(0, 80) : "";
    case "install_package":
    case "syte_install_package":
      return (args?.package_name || args?.package || args?.name) ? String(args?.package_name || args?.package || args?.name).slice(0, 80) : "";
    case "edit":
    case "edit_file":
    case "syte_edit_file":
    case "apply_patch":
    case "write":
    case "write_file":
    case "syte_write_file":
    case "createfile":
    case "read":
    case "read_file":
    case "syte_read_file":
    case "readfile":
    case "delete_file":
    case "syte_delete_file":
    case "deletefile":
    case "create_folder":
    case "syte_create_folder": {
      const p = args?.file_path || args?.path || args?.target_file || args?.folder_path || "";
      return p ? (String(p).split("/").pop() ?? "") : "";
    }
    case "rename_file":
    case "move_file": {
      const oldP = (args?.old_path || args?.from || args?.source_path || "").split("/").pop() ?? "";
      const newP = (args?.new_path || args?.to || args?.destination_path || "").split("/").pop() ?? "";
      return oldP && newP ? `${oldP} → ${newP}` : oldP || newP;
    }
    case "grep":
    case "glob":
      return args?.pattern ? String(args.pattern) : "";
    case "list_files":
    case "syte_list_files":
      return args?.path || args?.directory ? String(args?.path || args?.directory) : "Workspace";
    case "websearch":
    case "web_search":
      return args?.query ? String(args.query) : "";
    case "webfetch":
    case "web_fetch":
      return args?.url ? String(args.url).slice(0, 60) : "";
    case "start_preview":
      return args?.port ? `port ${args.port}` : "preview";
    case "take_screenshot":
      return args?.route || args?.url ? String(args?.route || args?.url) : "screenshot";
    case "check_types":
      return "TypeScript";
    case "run_lint":
      return "Code hygiene";
    default:
      return "";
  }
}

export function mapToolInvocationToStep(
  toolCallId: string,
  toolInvocation: {
    toolName: string;
    args?: Record<string, any>;
    state: "partial-call" | "call" | "result";
    result?: any;
  },
): Extract<TimelineStep, { type: "tool-call" }> {
  const { toolName, args = {}, result } = toolInvocation;
  const lower = toolName.toLowerCase();
  const displayToolName =
    toolName === "PlanWrite"
      ? "Plan"
      : toolName === "TodoWrite"
        ? "Todo"
        : toolName === "run_command" || toolName === "syte_run_command"
          ? "Bash"
          : toolName === "read_file" || toolName === "syte_read_file"
            ? "Read"
            : toolName === "write_file" || toolName === "syte_write_file"
              ? "Write"
              : toolName === "edit_file" || toolName === "syte_edit_file"
                ? "Edit"
                : toolName === "list_files" || toolName === "syte_list_files"
                  ? "List Files"
                  : toolName;
  const detail = extractToolDetail(toolName, args);

  const step: Extract<TimelineStep, { type: "tool-call" }> = {
    id: toolCallId,
    type: "tool-call",
    toolName: displayToolName,
    toolDetail: detail,
    duration: Number.MAX_SAFE_INTEGER,
    toolVariant: mapToolNameToVariant(toolName),
  };

  const isBash =
    toolName === "Bash" ||
    lower === "run_command" ||
    lower === "syte_run_command" ||
    lower === "executecommand";

  if (isBash) {
    step.bashCommand = (args?.command || args?.cmd) ? String(args?.command || args?.cmd) : undefined;
    if (toolInvocation.state === "result" && result) {
      if (typeof result === "string") {
        step.bashOutput = result;
        step.bashSuccess = true;
      } else if (typeof result === "object") {
        const stdout =
          typeof result?.stdout === "string"
            ? result.stdout
            : typeof result?.output === "string"
              ? result.output
              : "";
        const stderr = typeof result?.stderr === "string" ? result.stderr : "";
        step.bashOutput = [stdout, stderr]
          .filter(Boolean)
          .join(stdout && stderr ? "\n" : "");
        const exitCode = result?.exitCode ?? result?.exit_code;
        step.bashSuccess = exitCode === undefined ? true : exitCode === 0;
      } else {
        step.bashOutput = JSON.stringify(result);
        step.bashSuccess = true;
      }
    }
  }

  const isFileTool =
    toolName === "Edit" ||
    toolName === "Write" ||
    toolName === "Read" ||
    lower === "edit_file" ||
    lower === "syte_edit_file" ||
    lower === "write_file" ||
    lower === "syte_write_file" ||
    lower === "read_file" ||
    lower === "syte_read_file" ||
    lower === "delete_file" ||
    lower === "syte_delete_file" ||
    lower === "createfile" ||
    lower === "readfile" ||
    lower === "deletefile";

  if (isFileTool) {
    const rawPath = args?.file_path || args?.path || args?.target_file;
    step.filePath = rawPath ? String(rawPath) : undefined;
  }

  const isWriteTool =
    toolName === "Write" ||
    lower === "write_file" ||
    lower === "syte_write_file" ||
    lower === "createfile";

  if (isWriteTool) {
    const content =
      typeof result?.content === "string"
        ? result.content
        : typeof args?.content === "string"
          ? args.content
          : typeof args?.code_content === "string"
            ? args.code_content
            : "";

    if (content) {
      const lines = content.split("\n");
      step.diffStats = `+${lines.length}`;
      step.diffLines = lines.map((line: string) => ({
        type: "add",
        content: line,
      }));
    }
  }

  const isEditTool =
    toolName === "Edit" ||
    lower === "edit_file" ||
    lower === "syte_edit_file" ||
    lower === "apply_patch";

  if (isEditTool) {
    if (Array.isArray(result?.structuredPatch)) {
      step.diffStats = calculateDiffStatsFromPatch(result.structuredPatch);
      step.diffLines = getDiffLinesFromPatch(result.structuredPatch);
    } else {
      const oldContent = args?.old_text || args?.old_string || args?.target_content || "";
      const newContent = args?.new_text || args?.new_string || args?.replacement_content || "";
      if (oldContent || newContent) {
        const removed = oldContent ? String(oldContent).split("\n") : [];
        const added = newContent ? String(newContent).split("\n") : [];
        step.diffLines = [
          ...removed.map((content: string) => ({ type: "remove" as const, content })),
          ...added.map((content: string) => ({ type: "add" as const, content })),
        ];
        step.diffStats = `+${added.length} -${removed.length}`;
      }
    }
  }

  if (
    toolName === "WebSearch" ||
    lower === "web_search" ||
    toolName === "Grep" ||
    toolName === "Glob" ||
    lower === "list_files" ||
    lower === "syte_list_files"
  ) {
    step.searchQuery =
      (args?.query ?? args?.pattern ?? args?.path ?? args?.directory)
        ? String(args?.query ?? args?.pattern ?? args?.path ?? args?.directory)
        : undefined;
    step.searchSource =
      toolName === "WebSearch" || lower === "web_search" ? "web" : "code";
  }

  if (
    lower === "thinking" ||
    lower === "reasoning"
  ) {
    step.thoughtContent =
      typeof args?.thought === "string"
        ? args.thought
        : typeof result === "string"
          ? result
          : undefined;
  }

  return step;
}
