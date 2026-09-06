"use client";

import React from "react";
import { Zap, ChevronDown, Check, Sparkles, Cpu, Rocket, Gauge } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type EffortLevel = "low" | "medium" | "high" | "extra_high" | "max";

export interface EffortOption {
  id: EffortLevel;
  label: string;
  badge: string;
  description: string;
  icon?: React.ReactNode;
}

export const EFFORT_OPTIONS: EffortOption[] = [
  {
    id: "low",
    label: "Low",
    badge: "Low",
    description: "Fastest response with minimal reasoning overhead.",
    icon: <Rocket className="size-3.5 text-emerald-400" />,
  },
  {
    id: "medium",
    label: "Medium",
    badge: "Medium",
    description: "Balanced speed & reasoning depth for coding turns.",
    icon: <Gauge className="size-3.5 text-blue-400" />,
  },
  {
    id: "extra_high",
    label: "Extra High",
    badge: "xHigh",
    description: "Deep reasoning & thorough code verification.",
    icon: <Cpu className="size-3.5 text-purple-400" />,
  },
  {
    id: "max",
    label: "Max",
    badge: "Max",
    description: "Maximum reasoning budget & architectural planning.",
    icon: <Sparkles className="size-3.5 text-amber-400" />,
  },
];

export interface ModelChoiceItem {
  id: string;
  label: string;
  apiModel: string;
  subtitle?: string;
  iconUrl?: string;
}

interface EffortDropdownProps {
  effort: EffortLevel;
  onEffortChange: (effort: EffortLevel) => void;
  selectedModel?: string;
  modelChoices?: ModelChoiceItem[];
  onModelSelect?: (modelId: string) => void;
  isDark?: boolean;
  className?: string;
}

export function EffortDropdown({
  effort,
  onEffortChange,
  selectedModel,
  modelChoices,
  onModelSelect,
  isDark = true,
  className,
}: EffortDropdownProps) {
  const currentEffort =
    EFFORT_OPTIONS.find((e) => e.id === effort) || EFFORT_OPTIONS[2];

  const currentModelObj = modelChoices?.find(
    (m) => m.id === selectedModel || m.label === selectedModel || m.apiModel === selectedModel
  );
  const displayModelLabel = currentModelObj?.label || selectedModel || "Syra Base";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Select model and effort level (${displayModelLabel}, Effort: ${currentEffort.label})`}
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all select-none outline-none",
            "focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-95",
            isDark
              ? "bg-zinc-800/80 text-zinc-200 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 shadow-sm"
              : "bg-zinc-100 text-zinc-800 hover:text-zinc-950 hover:bg-zinc-200 border border-zinc-300/80 shadow-sm",
            className
          )}
        >
          <Zap className="size-3 text-blue-400 fill-blue-400/20 shrink-0" />
          <span className="truncate max-w-[110px] sm:max-w-[140px] font-medium">
            {displayModelLabel}
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
            {currentEffort.badge}
          </span>
          <ChevronDown className="size-3.5 opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={6}
        className={cn(
          "w-64 rounded-2xl p-1.5 shadow-2xl z-50",
          isDark
            ? "bg-[#18181b]/95 border-zinc-800 text-zinc-100 backdrop-blur-xl"
            : "bg-white border-zinc-200 text-zinc-900 shadow-black/10"
        )}
      >
        {/* Section 1: Effort Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2.5 py-2 px-2.5 rounded-xl cursor-pointer">
            <Zap className="size-4 text-blue-400 fill-blue-400/20 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-semibold">Effort Level</div>
              <div className="text-[11px] text-muted-foreground truncate">
                Current: {currentEffort.label}
              </div>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 mr-1">
              {currentEffort.badge}
            </span>
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent
            sideOffset={4}
            className={cn(
              "w-60 rounded-2xl p-1.5 shadow-2xl z-50",
              isDark
                ? "bg-[#18181b]/95 border-zinc-800 text-zinc-100 backdrop-blur-xl"
                : "bg-white border-zinc-200 text-zinc-900"
            )}
          >
            <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Select Effort Budget
            </DropdownMenuLabel>
            {EFFORT_OPTIONS.map((opt) => {
              const isSelected = opt.id === effort;
              return (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => onEffortChange(opt.id)}
                  className={cn(
                    "flex items-start gap-2.5 py-2 px-2.5 rounded-xl cursor-pointer transition-colors",
                    isSelected
                      ? isDark
                        ? "bg-blue-500/15 text-blue-300"
                        : "bg-blue-50 text-blue-900"
                      : "hover:bg-accent"
                  )}
                >
                  <div className="mt-0.5 shrink-0">{opt.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                      {opt.description}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="size-3.5 text-blue-400 shrink-0 mt-0.5" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Section 2: Models listing if choices provided */}
        {modelChoices && modelChoices.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Model Engine
            </DropdownMenuLabel>
            <div className="space-y-0.5">
              {modelChoices.map((choice) => {
                const isSelected =
                  choice.id === selectedModel ||
                  choice.label === selectedModel ||
                  choice.apiModel === selectedModel;
                return (
                  <DropdownMenuItem
                    key={choice.id || choice.apiModel}
                    onClick={() => onModelSelect?.(choice.id || choice.apiModel)}
                    className={cn(
                      "flex items-center gap-2.5 py-2 px-2.5 rounded-xl cursor-pointer transition-colors",
                      isSelected
                        ? isDark
                          ? "bg-white/10 text-white font-medium"
                          : "bg-zinc-100 text-zinc-900 font-medium"
                        : "hover:bg-accent"
                    )}
                  >
                    {choice.iconUrl ? (
                      <img
                        src={choice.iconUrl}
                        alt=""
                        className="size-4 shrink-0 object-contain rounded"
                      />
                    ) : (
                      <div className="size-4 rounded bg-blue-500/20 text-blue-400 grid place-items-center text-[10px] font-bold shrink-0">
                        {(choice.label || choice.apiModel).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate font-medium">
                        {choice.label || choice.apiModel}
                      </div>
                      {choice.subtitle && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {choice.subtitle}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="size-3.5 text-blue-400 shrink-0" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
