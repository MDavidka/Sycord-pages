"use client"

import { themeConfigs, themes } from "@/lib/webshop-types"
import { Check } from "lucide-react"

interface StylePreviewProps {
  theme: string
  isSelected: boolean
  onSelect: (theme: string) => void
}

export function StylePreview({ theme, isSelected, onSelect }: StylePreviewProps) {
  const config = themeConfigs[theme as keyof typeof themeConfigs]
  const themeData = themes[theme as keyof typeof themes]

  if (!config || !themeData) return null

  return (
    <button
      onClick={() => onSelect(theme)}
      className={`relative group transition-all duration-300 ${isSelected ? "ring-2 ring-blue-500" : ""}`}
    >
      <div
        className={`w-full h-48 rounded-lg overflow-hidden ${config.bg} border-2 ${isSelected ? "border-blue-500" : "border-gray-300"}`}
      >
        {/* Header preview */}
        <div className={`${config.header} px-4 py-3 border-b`}>
          <div className={`h-2 w-24 rounded ${config.accent} opacity-50`}></div>
          <div className={`h-1.5 w-16 rounded mt-2 ${config.accent} opacity-30`}></div>
        </div>

        {/* Cards preview */}
        <div className="px-2 py-2 space-y-2">
          <div className={`${config.card} h-12 rounded opacity-60`}></div>
          <div className={`${config.card} h-12 rounded opacity-60`}></div>
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Label */}
      <div className="mt-3">
        <h3 className="font-semibold text-gray-900">{themeData.name}</h3>
        <p className="text-xs text-gray-600 mt-1">{themeData.description}</p>
      </div>

      {/* Hover effect */}
      <div
        className={`absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-lg transition-all pointer-events-none`}
      ></div>
    </button>
  )
}
