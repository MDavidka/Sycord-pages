"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EffortLevel = "low" | "medium" | "high" | "extra_high" | "max";

export interface EffortItem {
  id: EffortLevel;
  label: string;
  badge: string;
  description?: string;
}

export const EFFORT_LIST: EffortItem[] = [
  { id: "low", label: "Low", badge: "Low", description: "Ultra fast generation" },
  { id: "medium", label: "Medium", badge: "Medium", description: "Balanced speed & depth" },
  { id: "high", label: "High", badge: "High", description: "Deep reasoning & verification" },
  { id: "extra_high", label: "Extra High", badge: "Extra High", description: "Maximum thinking depth" },
  { id: "max", label: "Max", badge: "Max", description: "Maximum reasoning budget" },
];

export interface ModelChoiceItem {
  id: string;
  label: string;
  apiModel: string;
  subtitle?: string;
  iconUrl?: string;
}

interface ModelEffortSelectorProps {
  effort: EffortLevel;
  onEffortChange: (effort: EffortLevel) => void;
  selectedModel?: string;
  modelChoices?: ModelChoiceItem[];
  onModelSelect?: (modelId: string) => void;
  onAddModelsClick?: () => void;
  isDark?: boolean;
  className?: string;
}

type SubView = "none" | "effort" | "models";

export function ModelEffortSelector({
  effort,
  onEffortChange,
  selectedModel,
  modelChoices = [],
  onModelSelect,
  onAddModelsClick,
  isDark = true,
  className,
}: ModelEffortSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubView, setActiveSubView] = useState<SubView>("none");
  const containerRef = useRef<HTMLDivElement>(null);

  // Default models if choices are empty
  const defaultModels: ModelChoiceItem[] = useMemo(
    () => [
      { id: "syra-base", label: "Ara Medium", apiModel: "syra-base" },
      { id: "syra-havy", label: "Ara High", apiModel: "syra-havy" },
      { id: "syra-ultra", label: "Ara Extra High", apiModel: "syra-ultra" },
    ],
    []
  );

  const effectiveModels = modelChoices.length > 0 ? modelChoices : defaultModels;

  // Find active model and effort objects
  const activeModelObj = effectiveModels.find(
    (m) =>
      m.id === selectedModel ||
      m.label === selectedModel ||
      m.apiModel === selectedModel
  ) || effectiveModels[0];

  const currentEffortObj =
    EFFORT_LIST.find((e) => e.id === effort) || EFFORT_LIST[3];

  const isFastActive = effort === "low";

  // Fast mode toggle
  const handleToggleFast = () => {
    if (isFastActive) {
      onEffortChange("extra_high");
    } else {
      onEffortChange("low");
    }
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setActiveSubView("none");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setActiveSubView("none");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Model family display name
  const modelFamilyName = activeModelObj.label.split(" ")[0] || "Ara";

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <style jsx>{`
        @keyframes shimmer-blue-cooldown {
          0% {
            background-position: 200% 0;
          }
          26% {
            background-position: -200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        @keyframes shimmer-yellow-cooldown {
          0% {
            background-position: 200% 0;
          }
          20% {
            background-position: -200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        .shimmer-xhigh {
          background: linear-gradient(
            90deg,
            #60a5fa 0%,
            #93c5fd 30%,
            #ffffff 50%,
            #93c5fd 70%,
            #60a5fa 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-blue-cooldown 6.5s ease-in-out infinite;
        }
        .shimmer-max {
          background: linear-gradient(
            90deg,
            #eab308 0%,
            #fef08a 30%,
            #ffffff 50%,
            #fef08a 70%,
            #eab308 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-yellow-cooldown 4s ease-in-out infinite;
        }
      `}</style>

      {/* Trigger Button: Idle state has no background */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isOpen) setActiveSubView("none");
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "flex items-center gap-1.5 h-8 px-2 rounded-lg text-xs font-medium transition-colors select-none outline-none cursor-pointer",
          "focus-visible:ring-1 focus-visible:ring-zinc-400",
          isOpen
            ? isDark
              ? "bg-white/10 text-white"
              : "bg-black/10 text-zinc-950"
            : isDark
            ? "bg-transparent text-zinc-300 hover:text-white hover:bg-white/5"
            : "bg-transparent text-zinc-700 hover:text-zinc-950 hover:bg-black/5"
        )}
      >
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {modelFamilyName}
        </span>
        <span
          className={cn(
            "font-normal transition-all",
            effort === "extra_high"
              ? "shimmer-xhigh font-medium"
              : effort === "max"
              ? "shimmer-max font-semibold"
              : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          {currentEffortObj.label}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-zinc-400 transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Popover Card & Submenus */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Model and Effort configuration"
          className="absolute bottom-full mb-2 left-0 z-50 flex flex-col sm:flex-row items-start gap-1.5 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Primary Popover Card (Fast [toggle], Effort [Extra High >], Model [Ara >]) */}
          <div
            className={cn(
              "w-[210px] sm:w-[220px] rounded-2xl p-1.5 shadow-xl backdrop-blur-xl border",
              isDark
                ? "bg-[#1c1d1f] border-[#2a2b2e] text-[#e5e5e5]"
                : "bg-white border-zinc-200 text-zinc-900 shadow-zinc-200/50"
            )}
          >
            {/* Row 1: Fast + Switch Toggle */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <span>Fast</span>
              <button
                type="button"
                role="switch"
                aria-checked={isFastActive}
                onClick={handleToggleFast}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  isFastActive
                    ? "bg-blue-600"
                    : isDark
                    ? "bg-zinc-700"
                    : "bg-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    isFastActive ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Row 2: Effort + Subtrigger */}
            <button
              type="button"
              onClick={() =>
                setActiveSubView((prev) => (prev === "effort" ? "none" : "effort"))
              }
              onMouseEnter={() => {
                if (typeof window !== "undefined" && window.innerWidth >= 640) {
                  setActiveSubView("effort");
                }
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                activeSubView === "effort"
                  ? isDark
                    ? "bg-white/10 text-white"
                    : "bg-zinc-100 text-zinc-950"
                  : isDark
                  ? "text-zinc-200 hover:bg-white/5"
                  : "text-zinc-800 hover:bg-zinc-100"
              )}
            >
              <span>Effort</span>
              <div className="flex items-center gap-1 text-zinc-400 text-sm font-normal">
                <span
                  className={cn(
                    effort === "extra_high"
                      ? "shimmer-xhigh font-medium"
                      : effort === "max"
                      ? "shimmer-max font-semibold"
                      : ""
                  )}
                >
                  {currentEffortObj.label}
                </span>
                <ChevronRight className="size-3.5 text-zinc-400" />
              </div>
            </button>

            {/* Row 3: Model + Subtrigger */}
            <button
              type="button"
              onClick={() =>
                setActiveSubView((prev) => (prev === "models" ? "none" : "models"))
              }
              onMouseEnter={() => {
                if (typeof window !== "undefined" && window.innerWidth >= 640) {
                  setActiveSubView("models");
                }
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                activeSubView === "models"
                  ? isDark
                    ? "bg-white/10 text-white"
                    : "bg-zinc-100 text-zinc-950"
                  : isDark
                  ? "text-zinc-200 hover:bg-white/5"
                  : "text-zinc-800 hover:bg-zinc-100"
              )}
            >
              <span>Model</span>
              <div className="flex items-center gap-1 text-zinc-400 text-sm font-normal">
                <span className="truncate max-w-[80px]">
                  {modelFamilyName}
                </span>
                <ChevronRight className="size-3.5 text-zinc-400" />
              </div>
            </button>
          </div>

          {/* Submenu Panel (Direct list, no back button, no search input) */}
          {activeSubView !== "none" && (
            <div
              className={cn(
                "w-[230px] sm:w-[240px] rounded-2xl p-1.5 shadow-xl backdrop-blur-xl border transition-all animate-in fade-in-0 slide-in-from-left-2 duration-150",
                isDark
                  ? "bg-[#1c1d1f] border-[#2a2b2e] text-[#e5e5e5]"
                  : "bg-white border-zinc-200 text-zinc-900 shadow-zinc-200/50"
              )}
            >
              {/* Models Submenu View */}
              {activeSubView === "models" && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                    {modelFamilyName} Models
                  </div>

                  {/* Models List */}
                  <div className="space-y-0.5 max-h-56 overflow-y-auto pr-0.5">
                    {effectiveModels.map((model) => {
                      const isSelected =
                        model.id === activeModelObj.id ||
                        model.label === activeModelObj.label ||
                        model.apiModel === activeModelObj.apiModel;
                      return (
                        <button
                          key={model.id || model.apiModel}
                          type="button"
                          onClick={() => {
                            onModelSelect?.(model.id || model.apiModel);
                            setActiveSubView("none");
                            setIsOpen(false);
                          }}
                          className={cn(
                            "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors",
                            isSelected
                              ? isDark
                                ? "bg-white/10 text-white font-semibold"
                                : "bg-zinc-100 text-zinc-950 font-semibold"
                              : isDark
                              ? "text-zinc-300 hover:bg-white/5"
                              : "text-zinc-700 hover:bg-zinc-100"
                          )}
                        >
                          <span className="truncate">{model.label}</span>
                          {isSelected && (
                            <Check className="size-3.5 text-blue-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Fresh space at bottom for + Add Models */}
                  <div className="pt-1 mt-1 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        onAddModelsClick?.();
                        setActiveSubView("none");
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors",
                        isDark
                          ? "text-zinc-300 hover:bg-white/5"
                          : "text-zinc-700 hover:bg-zinc-100"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Plus className="size-3.5 text-zinc-400" />
                        <span>Add Models</span>
                      </div>
                      <ChevronRight className="size-3.5 text-zinc-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* Effort Submenu View */}
              {activeSubView === "effort" && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                    Effort Level
                  </div>

                  <div className="space-y-0.5">
                    {EFFORT_LIST.map((item) => {
                      const isSelected = item.id === effort;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onEffortChange(item.id);
                            setActiveSubView("none");
                          }}
                          className={cn(
                            "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors",
                            isSelected
                              ? isDark
                                ? "bg-white/10 text-white font-semibold"
                                : "bg-zinc-100 text-zinc-950 font-semibold"
                              : isDark
                              ? "text-zinc-300 hover:bg-white/5"
                              : "text-zinc-700 hover:bg-zinc-100"
                          )}
                        >
                          <div className="flex flex-col">
                            <span
                              className={cn(
                                item.id === "extra_high"
                                  ? isSelected ? "shimmer-xhigh font-semibold" : ""
                                  : item.id === "max"
                                  ? isSelected ? "shimmer-max font-semibold" : ""
                                  : ""
                              )}
                            >
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="text-[10px] text-zinc-400 font-normal">
                                {item.description}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="size-3.5 text-blue-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
