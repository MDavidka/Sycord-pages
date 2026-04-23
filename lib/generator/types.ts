// ============================================
// AI Generator Pipeline Types
// ============================================

// --- Style JSON Types ---
export interface StyleComponentChild {
  id?: string;
  component: string;
  props: Record<string, unknown>;
  children?: StyleComponentChild[];
}

export interface StyleLayoutItem {
  id: string;
  component: string;
  props: Record<string, unknown>;
  children?: StyleComponentChild[];
}

export interface StyleJSON {
  pageId: string;
  path: string;
  layout: StyleLayoutItem[];
}

// --- Function JSON Types ---
export interface StateBlock {
  type: "state";
  code: string;
}

export interface EffectBlock {
  type: "effect";
  code: string;
}

export interface HandlerBlock {
  targetId: string;
  event: string;
  handler: string;
}

export type LogicBlock = StateBlock | EffectBlock | HandlerBlock;

export interface FunctionJSON {
  targetPage: string;
  logicBlocks: LogicBlock[];
}

// --- Cheat Sheet Types ---
export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
}

export interface CheatSheetComponent {
  name: string;
  importPath: string;
  description: string;
  props: ComponentProp[];
  children?: string; // "none" | "text" | "components"
}

export interface CheatSheet {
  version: string;
  updatedAt: string;
  components: CheatSheetComponent[];
}

// --- Generation State Types ---
export interface BlankFunction {
  id: string;
  targetId: string;
  event: string;
  filled: boolean;
}

export interface GenerationCache {
  sessionId: string;
  styleJSON: StyleJSON | null;
  functionJSON: FunctionJSON | null;
  blankFunctions: BlankFunction[];
  outputTSX: string | null;
  status: "idle" | "generating-style" | "generating-functions" | "orchestrating" | "complete" | "error";
  error?: string;
}

// --- API Request/Response Types ---
export interface GenerateStyleRequest {
  prompt: string;
  cheatSheet: CheatSheet;
}

export interface GenerateStyleResponse {
  success: boolean;
  styleJSON?: StyleJSON;
  blankFunctions?: BlankFunction[];
  error?: string;
}

export interface GenerateFunctionsRequest {
  styleJSON: StyleJSON;
  blankFunctions: BlankFunction[];
  cheatSheet: CheatSheet;
}

export interface GenerateFunctionsResponse {
  success: boolean;
  functionJSON?: FunctionJSON;
  error?: string;
}

export interface OrchestrateRequest {
  styleJSON: StyleJSON;
  functionJSON: FunctionJSON;
  cheatSheet: CheatSheet;
}

export interface OrchestrateResponse {
  success: boolean;
  outputTSX?: string;
  imports?: string[];
  error?: string; // Can contain multiple errors joined by semicolons
  validationErrors?: string[]; // Individual validation errors
}

// --- Debug Panel Types ---
export interface DebugStep {
  step: "style" | "functions" | "orchestrate";
  status: "pending" | "running" | "complete" | "error";
  startTime?: number;
  endTime?: number;
  data?: unknown;
  error?: string;
}

export interface DebugState {
  steps: DebugStep[];
  currentStep: number;
  styleJSON: StyleJSON | null;
  functionJSON: FunctionJSON | null;
  outputTSX: string | null;
  blankFunctions: BlankFunction[];
}
