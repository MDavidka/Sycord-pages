import {
  Check,
  Circle,
  FileText,
  Globe2,
  ImageIcon,
  MessageSquare,
  PencilLine,
  Search,
  Sparkles,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import type {
  AgentActivityItem,
  AgentActivitySearch,
  AgentActivityStep,
  AgentActivityText,
  AgentActivityTool,
  AgentActivityTrace,
  AgentSearchResult,
} from "./types";

function StepRow({ item }: { item: AgentActivityStep }) {
  const state = item.status ?? "complete";

  return (
    <div className="flex min-h-7 items-start gap-2.5 rounded-md px-1.5 py-1 text-xs">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-4 shrink-0 place-items-center text-muted-foreground/70"
      >
        {state === "complete" ? (
          <Check className="size-3.5 text-emerald-400" strokeWidth={2} />
        ) : state === "active" ? (
          <span className="relative grid size-3 place-items-center">
            <motion.span
              className="absolute inset-0 rounded-full bg-primary/20"
              animate={{ opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
            />
            <span className="size-1.5 rounded-full bg-primary" />
          </span>
        ) : (
          <Circle className="size-2.5 text-muted-foreground/40" strokeWidth={1.5} />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 leading-5",
          state === "pending" ? "text-muted-foreground/55" : "text-foreground/90 font-medium",
        )}
      >
        {item.label}
      </span>
      {item.meta ? (
        <span className="shrink-0 leading-5 text-muted-foreground/55 font-mono text-[11px]">
          {item.meta}
        </span>
      ) : null}
    </div>
  );
}

function TextRow({ item }: { item: AgentActivityText }) {
  return (
    <div className="rounded-lg bg-black/20 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 p-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
      {item.content}
    </div>
  );
}

function SearchResultRow({
  result,
}: {
  result: AgentSearchResult;
}) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 place-items-center text-muted-foreground"
      >
        {result.icon ?? <Globe2 className="size-3" strokeWidth={2} />}
      </span>
      <span className="min-w-0 truncate font-medium text-foreground/90 text-xs">
        {result.title}
      </span>
      {result.domain ? (
        <span className="min-w-0 truncate text-[11px] text-muted-foreground/55">
          {result.domain}
        </span>
      ) : null}
    </>
  );
  const className = cn(
    "flex min-h-6 items-center gap-2 rounded-md px-1.5 py-0.5 text-left outline-none transition-colors hover:bg-muted/40",
    result.url && "focus-visible:ring-2 focus-visible:ring-ring",
  );

  return result.url ? (
    <a href={result.url} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

function SearchRow({ item }: { item: AgentActivitySearch }) {
  const reduce = useReducedMotion() ?? false;
  const enter = reduce ? { opacity: 1 } : { opacity: 0, y: 6 };
  const visible = { opacity: 1, y: 0 };
  const exit = reduce ? { opacity: 0 } : { opacity: 0, y: -3 };
  const transition = reduce
    ? { duration: 0 }
    : {
        opacity: { duration: 0.18, ease: EASE_OUT },
        y: SPRING_LAYOUT,
        layout: SPRING_LAYOUT,
      };

  return (
    <div className="space-y-0.5 text-xs">
      <div className="flex min-h-7 items-center gap-2 rounded-md px-1.5 py-1 text-muted-foreground">
        <Search aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.7} />
        <span className="min-w-0 truncate font-medium">{item.query}</span>
      </div>
      {item.results?.length ? (
        <div className="space-y-0.5 pl-4">
          <AnimatePresence initial mode="popLayout">
            {item.results.map((result) => (
              <motion.div
                layout="position"
                key={result.id}
                initial={enter}
                animate={visible}
                exit={exit}
                transition={transition}
              >
                <SearchResultRow result={result} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}

function ActionIcon({ action }: { action: string }) {
  const a = String(action || "").toLowerCase();
  if (a.includes("read") || a.includes("view") || a.includes("file_read")) return <FileText className="size-3.5" />;
  if (a.includes("edit") || a.includes("write") || a.includes("patch") || a.includes("create")) {
    return <PencilLine className="size-3.5" />;
  }
  if (a.includes("command") || a.includes("run") || a.includes("terminal")) return <SquareTerminal className="size-3.5" />;
  if (a.includes("search") || a.includes("grep")) return <Search className="size-3.5" />;
  if (a.includes("preview")) return <Sparkles className="size-3.5" />;
  return <Wrench className="size-3.5" />;
}

function ToolRow({ item }: { item: AgentActivityTool }) {
  const action = item.action.charAt(0).toUpperCase() + item.action.slice(1);

  return (
    <div className="flex min-h-7 min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 leading-5 text-xs">
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 place-items-center text-muted-foreground/70"
      >
        <ActionIcon action={item.action} />
      </span>
      <span className="shrink-0 font-medium text-foreground/90">{action}</span>
      <span className="min-w-0 flex-1 truncate rounded-md bg-muted/70 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
        {item.target}
      </span>
      {typeof item.additions === "number" || typeof item.deletions === "number" ? (
        <span className="flex shrink-0 items-center gap-1.5 font-mono tabular-nums text-[11px]">
          {typeof item.additions === "number" ? (
            <span className="text-emerald-500">+{item.additions}</span>
          ) : null}
          {typeof item.deletions === "number" ? (
            <span className="text-rose-500">−{item.deletions}</span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function TraceIcon({ kind }: { kind: AgentActivityTrace["kind"] }) {
  if (kind === "thinking") return <Sparkles className="size-3.5 text-amber-400" />;
  if (kind === "message") return <MessageSquare className="size-3.5" />;
  if (kind === "write") return <PencilLine className="size-3.5" />;
  if (kind === "run") return <SquareTerminal className="size-3.5" />;
  if (kind === "read") return <FileText className="size-3.5" />;
  return <Wrench className="size-3.5" />;
}

function TraceRow({ item }: { item: AgentActivityTrace }) {
  return (
    <div className="grid min-h-7 grid-cols-[1rem_auto_minmax(0,1fr)] items-center gap-2 rounded-md px-1.5 py-0.5 text-xs">
      <span
        aria-hidden="true"
        className="grid size-4 place-items-center text-muted-foreground/70"
      >
        {item.icon ?? <TraceIcon kind={item.kind} />}
      </span>
      <span className="font-medium text-foreground/90">{item.label}</span>
      {item.detail ? (
        <span className="min-w-0 truncate rounded-md bg-muted/70 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {item.detail}
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

export function ActivityRow({ item }: { item: AgentActivityItem }) {
  if (item.type === "text") return <TextRow item={item} />;
  if (item.type === "search") return <SearchRow item={item} />;
  if (item.type === "tool") return <ToolRow item={item} />;
  if (item.type === "trace") return <TraceRow item={item} />;
  return <StepRow item={item} />;
}
