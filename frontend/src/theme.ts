// Design tokens for code that cannot use CSS classes (the CesiumJS scene, SVG fills).
// The values live only in src/theme.css; this module reads them from the CSS variables.

export type ColorToken =
  | 'bg'
  | 'card'
  | 'text'
  | 'text-2'
  | 'muted'
  | 'route'
  | 'white'
  | 'go'
  | 'caution'
  | 'alert'
  | 'unknown'
  | 'mars'

const cache = new Map<ColorToken, string>()

/** CSS color of a token, e.g. token('route') -> '#22d3ee'. */
export function token(name: ColorToken): string {
  let value = cache.get(name)
  if (!value) {
    value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
    cache.set(name, value)
  }
  return value
}

/** Safety status shown in the interface: one color token, one icon, one word. */
export type Status = 'go' | 'caution' | 'alert' | 'unknown'
