// Shared brand color utility — single source of truth across all components
// Deterministic hash-based assignment ensures "Aquaguard" always gets the same color
// regardless of which tab or page renders it.

const PALETTE = [
  '#4C78A8', '#54A24B', '#E45756', '#72B7B2', '#EECA3B',
  '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#D67195',
  '#F58518', '#4C78A8', '#54A24B', '#E45756', '#72B7B2',
  '#79B8FF', '#A8D8B9', '#F4A582', '#CAB2D6', '#FFFFB3',
]

// Global cache — persists across all components in the same page
const GLOBAL_CACHE: Record<string, string> = {}

export function brandColor(name: string): string {
  if (GLOBAL_CACHE[name]) return GLOBAL_CACHE[name]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  const c = PALETTE[Math.abs(hash) % PALETTE.length]
  GLOBAL_CACHE[name] = c
  return c
}

// For cases where you need the palette index (e.g., for chart Cell colors)
export function brandColorIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return Math.abs(hash) % PALETTE.length
}

export { PALETTE }
