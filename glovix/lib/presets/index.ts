export interface PresetSection {
  name: string
  path: string
  content: string
  description: string
}

export interface Preset {
  id: string
  name: string
  description: string
  requiredShadcnComponents: string[]
  sections: PresetSection[]
}

import { b27GcrRo } from './b27GcrRo'
import { b0 } from './b0'

export const PRESETS: Record<string, Preset> = {
  'b0': b0,
  'b27GcrRo': b27GcrRo,
}

export function getPreset(id: string): Preset | undefined {
  return PRESETS[id] ?? PRESETS['b0']
}

export function getAllPresetIds(): string[] {
  return Object.keys(PRESETS)
}
