// Look of the 3D scene (design/reference/Main.dc.html, TurnBack.dc.html): colors come from the
// design tokens (src/theme.css); every mark on the terrain gets a 2-3 px dark halo and every
// label a dark backing, so red and amber stay readable on the rust-colored ground.

import { Cartesian2, Color, HeightReference, LabelStyle } from 'cesium'
import { token, type ColorToken } from '../theme'

/** Vertical exaggeration of the terrain, shown on the map ("TERRAIN ×1.5 VERTICAL"). */
export const VERTICAL_EXAGGERATION = 1.5

export function cesiumColor(name: ColorToken, alpha = 1): Color {
  const color = Color.fromCssColorString(token(name))
  if (!color) throw new Error(`Design token --color-${name} is not defined (src/theme.css)`)
  return color.withAlpha(alpha)
}

function svgIcon(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/** Crew base: light dot with a dark halo inside a soft route-colored ring. */
export function baseIcon(): string {
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
      `<circle cx="24" cy="24" r="22" fill="${token('route')}" fill-opacity="0.15"/>` +
      `<circle cx="24" cy="24" r="9" fill="${token('text')}" stroke="${token('bg')}" stroke-width="3"/></svg>`,
  )
}

/** Map pin with a dark halo; the goal is route-colored, other points of interest muted. */
export function pinIcon(fill: ColorToken): string {
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="-17 -36 34 40">` +
      `<path d="M0 0 C-12 -16 -14 -24 -14 -30 A14 14 0 0 1 14 -30 C14 -24 12 -16 0 0 Z" fill="${token(fill)}" stroke="${token('bg')}" stroke-width="3"/>` +
      `<circle cy="-30" r="5" fill="${token('bg')}"/></svg>`,
  )
}

/** Start of a route that does not begin at the base: small light dot with a dark halo. */
export function startIcon(): string {
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
      `<circle cx="12" cy="12" r="8" fill="${token('text')}" stroke="${token('bg')}" stroke-width="3"/></svg>`,
  )
}

/** Steep section: amber caution triangle with a dark halo and a dark exclamation mark. */
export function hazardIcon(): string {
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="32" viewBox="-17 -18 34 32">` +
      `<path d="M0 -15 L14 10 L-14 10 Z" fill="${token('caution')}" stroke="${token('bg')}" stroke-width="3" stroke-linejoin="round"/>` +
      `<rect x="-1.5" y="-6" width="3" height="8" fill="${token('bg')}"/><rect x="-1.5" y="4" width="3" height="3" fill="${token('bg')}"/></svg>`,
  )
}

/** Mono caps label on a dark backing. */
export function labelGraphics(text: string, offsetY = -34, fill: ColorToken = 'text') {
  return {
    text,
    font: '600 13px "JetBrains Mono", ui-monospace, monospace',
    fillColor: cesiumColor(fill),
    style: LabelStyle.FILL,
    showBackground: true,
    backgroundColor: cesiumColor('bg', 0.85),
    backgroundPadding: new Cartesian2(8, 5),
    pixelOffset: new Cartesian2(0, offsetY),
    heightReference: HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  }
}
