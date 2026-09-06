"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Check,
  Zap,
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

type SubView = "none" | "effort" | "models" | "add_models";

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
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Focus search input when models subview opens
  useEffect(() => {
    if (activeSubView === "models") {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [activeSubView]);

  // Filtered models
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return effectiveModels;
    const q = searchQuery.toLowerCase();
    return effectiveModels.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.apiModel.toLowerCase().includes(q) ||
        (m.subtitle && m.subtitle.toLowerCase().includes(q))
    );
  }, [effectiveModels, searchQuery]);

  // Trigger label matching image: e.g. "Ara Extra High ⌵"
  const modelFamilyName = activeModelObj.label.split(" ")[0] || "Ara";
  const triggerLabel = `${modelFamilyName} ${currentEffortObj.label}`;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger Button: Pill in image e.g. 'Ara Extra High ⌵' */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isOpen) setActiveSubView("none");
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all select-none outline-none",
          "focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-95",
          isOpen
            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white ring-1 ring-zinc-400 dark:ring-zinc-600"
            : isDark
            ? "bg-zinc-800/90 text-zinc-200 hover:text-white hover:bg-zinc-800 border border-zinc-700/60 shadow-sm"
            : "bg-zinc-100 text-zinc-800 hover:text-zinc-950 hover:bg-zinc-200 border border-zinc-300/80 shadow-sm"
        )}
      >
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {modelFamilyName}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400 font-normal">
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
          className="absolute bottom-full mb-2 right-0 z-50 flex flex-col sm:flex-row items-end sm:items-stretch gap-1.5 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Submenu Panel (Model search or Effort selection) - On desktop renders to the left of the main menu */}
          {activeSubView !== "none" && (
            <div
              className={cn(
                "w-[240px] sm:w-[250px] rounded-2xl p-2 shadow-2xl backdrop-blur-xl border transition-all animate-in fade-in-0 slide-in-from-right-2 duration-150",
                isDark
                  ? "bg-[#18181b]/98 border-zinc-800 text-zinc-100"
                  : "bg-white/98 border-zinc-200 text-zinc-900"
              )}
            >
              {/* Models Submenu View */}
              {activeSubView === "models" && (
                <div className="space-y-1.5">
                  {/* Mobile Back Header */}
                  <div className="flex sm:hidden items-center gap-1 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setActiveSubView("none")}
                      className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-xs flex items-center gap-1"
                    >
                      <ChevronLeft className="size-3.5" /> Back
                    </button>
                  </div>

                  {/* Search Models Input */}
                  <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50">
                    <Search className="size-3.5 text-zinc-400 shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search models"
                      className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
                    />
                  </div>

                  {/* Section Label */}
                  <div className="px-2 pt-1 text-[11px] font-medium text-zinc-400">
                    {modelFamilyName} Models
                  </div>

                  {/* Models List */}
                  <div className="space-y-0.5 max-h-52 overflow-y-auto pr-0.5">
                    {filteredModels.map((model) => {
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
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
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

                  {/* Bottom: + Add Models > */}
                  <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        onAddModelsClick?.();
                        setActiveSubView("none");
                        setIsOpen(false);
                      }}
                      className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <Plus className="size-3 text-zinc-400" />
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
                  {/* Mobile Back Header */}
                  <div className="flex sm:hidden items-center gap-1 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setActiveSubView("none")}
                      className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-xs flex items-center gap-1"
                    >
                      <ChevronLeft className="size-3.5" /> Back
                    </button>
                  </div>

                  <div className="px-2 py-1 text-[11px] font-medium text-zinc-400">
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
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
                          )}
                        >
                          <div className="flex flex-col">
                            <span>{item.label}</span>
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

          {/* Primary Popover Card (matching image: Fast [toggle], Effort [Extra High >], Model [Ara >]) */}
          <div
            className={cn(
              "w-[210px] sm:w-[220px] rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl border",
              isDark
                ? "bg-[#18181b]/98 border-zinc-800 text-zinc-100"
                : "bg-white/98 border-zinc-200 text-zinc-900"
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
                    : "bg-zinc-300 dark:bg-zinc-700"
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
                // Open on hover on desktop viewports
                if (window.innerWidth >= 640) setActiveSubView("effort");
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                activeSubView === "effort"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
              )}
            >
              <span>Effort</span>
              <div className="flex items-center gap-1 text-zinc-400 text-sm font-normal">
                <span>{currentEffortObj.label}</span>
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
                // Open on hover on desktop viewports
                if (window.innerWidth >= 640) setActiveSubView("models");
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                activeSubView === "models"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
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
        </div>
      )}
    </div>
  );
}
