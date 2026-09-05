"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Zap, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type EffortLevel = "low" | "medium" | "high" | "extra_high";

export interface EffortStep {
  id: EffortLevel;
  label: string;
  shortLabel: string;
  speedLabel: string;
  description: string;
}

export const EFFORT_STEPS: EffortStep[] = [
  {
    id: "low",
    label: "Low",
    shortLabel: "Low",
    speedLabel: "Fastest",
    description: "Ultra fast generation with concise, immediate reasoning.",
  },
  {
    id: "medium",
    label: "Medium",
    shortLabel: "Medium",
    speedLabel: "Balanced",
    description: "Balanced speed and reasoning depth for standard coding tasks.",
  },
  {
    id: "high",
    label: "High",
    shortLabel: "High",
    speedLabel: "Deep",
    description: "Deep reasoning and comprehensive verification before changes.",
  },
  {
    id: "extra_high",
    label: "Extra High",
    shortLabel: "Extra High",
    speedLabel: "Maximum",
    description: "Maximum reasoning budget & thorough multi-step architecture planning.",
  },
];

interface EffortSliderProps {
  value: EffortLevel;
  onChange: (level: EffortLevel) => void;
  isDark?: boolean;
  className?: string;
}

export function EffortSlider({
  value,
  onChange,
  isDark = true,
  className,
}: EffortSliderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const currentIndex = Math.max(
    0,
    EFFORT_STEPS.findIndex((s) => s.id === value)
  );
  const currentStep = EFFORT_STEPS[currentIndex] || EFFORT_STEPS[3];

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
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

  // Handle position calculation on slider track
  const setStepFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = relativeX / (rect.width || 1);
      const totalSteps = EFFORT_STEPS.length - 1;
      const stepIndex = Math.round(percentage * totalSteps);
      const clampedIndex = Math.max(0, Math.min(stepIndex, totalSteps));
      const targetStep = EFFORT_STEPS[clampedIndex];
      if (targetStep && targetStep.id !== value) {
        onChange(targetStep.id);
      }
    },
    [value, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setStepFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    setStepFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  // Step percentage: 0%, 33.33%, 66.67%, 100%
  const stepPercentage = (currentIndex / (EFFORT_STEPS.length - 1)) * 100;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger Button: matches 'Select effort ⌵' pill in user's design */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={`Effort: ${currentStep.label} (${currentStep.speedLabel})`}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all select-none outline-none",
          isOpen
            ? "bg-zinc-800 text-blue-400 border border-blue-500/30 ring-2 ring-blue-500/20"
            : isDark
            ? "bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700/60"
            : "bg-zinc-100 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200 border border-zinc-300/80"
        )}
      >
        <span className="truncate">Select effort</span>
        <ChevronDown
          className={cn(
            "size-3.5 opacity-60 transition-transform duration-200",
            isOpen && "rotate-180 text-blue-400 opacity-100"
          )}
        />
      </button>

      {/* Floating Popover Card (matching media_1788648443422.png) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Effort level selection"
          className={cn(
            "absolute bottom-full mb-2.5 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-50",
            "w-[280px] sm:w-[300px] rounded-2xl p-3.5",
            "bg-[#18181b]/95 backdrop-blur-xl border border-zinc-700/70",
            "shadow-2xl shadow-black/80 ring-1 ring-white/10 animate-in fade-in-0 zoom-in-95 duration-150"
          )}
        >
          {/* Row 1: Zap icon, Label, and Level badge (e.g. Extra High >) */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="grid size-6 place-items-center rounded-lg bg-blue-500/10 text-blue-400">
                <Zap className="size-3.5 fill-blue-500 text-blue-400" />
              </div>
              <span className="text-xs font-medium text-zinc-200 truncate">
                Speed / Intelligence
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                // Cycle to next level on badge click
                const nextIndex = (currentIndex + 1) % EFFORT_STEPS.length;
                onChange(EFFORT_STEPS[nextIndex].id);
              }}
              className="group flex items-center gap-0.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>{currentStep.label}</span>
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Row 2: Stepped Pill Slider Track */}
          <div className="px-1 py-1">
            <div
              ref={trackRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative h-4 w-full rounded-full bg-zinc-700/60 cursor-pointer select-none touch-none flex items-center"
            >
              {/* Active Glowing Track (0 to thumb) */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.6)] relative overflow-hidden transition-all duration-75"
                style={{ width: `${stepPercentage}%` }}
              >
                {/* Subtle sparkle effect on the active track */}
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.8),transparent_50%)]" />
              </div>

              {/* Step indicator dots across the track */}
              {EFFORT_STEPS.map((step, idx) => {
                const pct = (idx / (EFFORT_STEPS.length - 1)) * 100;
                const isPassed = idx <= currentIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    aria-label={`Select ${step.label} effort`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(step.id);
                    }}
                    className="absolute -translate-x-1/2 grid size-3 place-items-center z-10 cursor-pointer"
                    style={{ left: `${pct}%` }}
                  >
                    <span
                      className={cn(
                        "rounded-full transition-all",
                        isPassed
                          ? "size-1 bg-white/70 shadow-sm"
                          : "size-1.5 bg-zinc-400/40 hover:bg-zinc-300/60"
                      )}
                    />
                  </button>
                );
              })}

              {/* White Circular Thumb (matches uploaded image) */}
              <div
                className="absolute size-6 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] border border-white/90 transform -translate-x-1/2 pointer-events-none transition-all duration-75 flex items-center justify-center z-20"
                style={{ left: `${stepPercentage}%` }}
              >
                <div className="size-1.5 rounded-full bg-blue-500/40" />
              </div>
            </div>
          </div>

          {/* Row 3: Description footnote */}
          <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
              {currentStep.speedLabel}
            </span>
            <span className="truncate max-w-[200px] text-right text-zinc-300">
              {currentStep.description}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
