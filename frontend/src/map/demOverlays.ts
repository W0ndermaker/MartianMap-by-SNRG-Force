// Elevation and slope overlays rendered in the browser from the local HiRISE height grid.
// Slope uses central differences on the ~10 m grid, so it is a ~20 m baseline slope: it smooths
// boulder-scale steepness (stated in the legend).

import { Color, Rectangle, SingleTileImageryProvider } from 'cesium';
import { MARS_RADIUS_M } from './mars';
import type { HeightGrid } from './terrain';
import { token } from '../theme';

/** Opacity of the no-go fill, 0-255. */
const NO_GO_ALPHA = 190;

export interface ColorStop { at: number; rgb: [number, number, number] }

export const ELEVATION_RAMP: ColorStop[] = [
  { at: 0, rgb: [38, 70, 160] },
  { at: 0.25, rgb: [40, 160, 170] },
  { at: 0.5, rgb: [120, 190, 80] },
  { at: 0.75, rgb: [235, 200, 70] },
  { at: 1, rgb: [190, 70, 40] },
];

/** Slope ramp in degrees (display only, no safety meaning). */
export const SLOPE_RAMP: ColorStop[] = [
  { at: 0, rgb: [46, 160, 67] },
  { at: 10, rgb: [170, 200, 60] },
  { at: 20, rgb: [240, 180, 40] },
  { at: 30, rgb: [220, 60, 40] },
  { at: 45, rgb: [120, 20, 90] },
];

function lerpColor(ramp: ColorStop[], v: number): [number, number, number] {
  if (v <= ramp[0].at) return ramp[0].rgb;
  for (let i = 1; i < ramp.length; i++) {
    const a = ramp[i - 1], b = ramp[i];
    if (v <= b.at) {
      const t = (v - a.at) / (b.at - a.at);
      return [0, 1, 2].map((k) => Math.round(a.rgb[k] + (b.rgb[k] - a.rgb[k]) * t)) as [number, number, number];
    }
  }
  return ramp[ramp.length - 1].rgb;
}

export function rampCss(ramp: ColorStop[]): string {
  const max = ramp[ramp.length - 1].at, min = ramp[0].at;
  return `linear-gradient(to right, ${ramp
    .map((s) => `rgb(${s.rgb.join(',')}) ${(((s.at - min) / (max - min)) * 100).toFixed(1)}%`)
    .join(', ')})`;
}

function heights(g: HeightGrid): Float32Array {
  const out = new Float32Array(g.width * g.height);
  for (let i = 0; i < out.length; i++) {
    const v = g.data[i];
    out[i] = v === g.nodata ? NaN : g.offset_m + v * g.scale_m;
  }
  return out;
}

function toProvider(g: HeightGrid, rgba: Uint8ClampedArray): Promise<SingleTileImageryProvider> {
  const canvas = document.createElement('canvas');
  canvas.width = g.width;
  canvas.height = g.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, g.width, g.height), 0, 0);
  return SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'), {
    rectangle: Rectangle.fromDegrees(g.west, g.south, g.east, g.north),
  });
}

export function elevationOverlay(g: HeightGrid) {
  const h = heights(g);
  const rgba = new Uint8ClampedArray(g.width * g.height * 4);
  const span = Math.max(1, g.max_m - g.min_m);
  for (let i = 0; i < h.length; i++) {
    if (Number.isNaN(h[i])) continue;
    const [r, gg, b] = lerpColor(ELEVATION_RAMP, (h[i] - g.min_m) / span);
    rgba.set([r, gg, b, 255], i * 4);
  }
  return toProvider(g, rgba);
}

const slopeCache = new WeakMap<HeightGrid, Float32Array>();

/** Slope in degrees per grid cell (central differences; NaN on no-data), cached per grid. */
export function slopeDegrees(g: HeightGrid): Float32Array {
  const cached = slopeCache.get(g);
  if (cached) return cached;
  const h = heights(g);
  const out = new Float32Array(g.width * g.height);
  const midLat = ((g.north + g.south) / 2) * (Math.PI / 180);
  const dxM = ((g.east - g.west) / (g.width - 1)) * (Math.PI / 180) * MARS_RADIUS_M * Math.cos(midLat);
  const dyM = ((g.north - g.south) / (g.height - 1)) * (Math.PI / 180) * MARS_RADIUS_M;
  const at = (x: number, y: number) => h[Math.min(g.height - 1, Math.max(0, y)) * g.width + Math.min(g.width - 1, Math.max(0, x))];
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) / (2 * dxM);
      const gy = (at(x, y + 1) - at(x, y - 1)) / (2 * dyM);
      out[y * g.width + x] = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
    }
  }
  slopeCache.set(g, out);
  return out;
}

export function slopeOverlay(g: HeightGrid) {
  const slope = slopeDegrees(g);
  const rgba = new Uint8ClampedArray(g.width * g.height * 4);
  for (let i = 0; i < slope.length; i++) {
    if (Number.isNaN(slope[i])) continue;
    const [r, gg, b] = lerpColor(SLOPE_RAMP, slope[i]);
    rgba.set([r, gg, b, 255], i * 4);
  }
  return toProvider(g, rgba);
}

/** Cells steeper than the max-slope limit (impassable for the route planner), red; everything else clear. */
export function noGoOverlay(g: HeightGrid, maxSlopeDeg: number) {
  // Impassable cells: the alert token (src/theme.css), translucent over the imagery.
  const alert = Color.fromCssColorString(token('alert'));
  const noGo = [alert.red * 255, alert.green * 255, alert.blue * 255, NO_GO_ALPHA];
  const slope = slopeDegrees(g);
  const rgba = new Uint8ClampedArray(g.width * g.height * 4);
  for (let i = 0; i < slope.length; i++) {
    if (slope[i] > maxSlopeDeg) rgba.set(noGo, i * 4);
  }
  return toProvider(g, rgba);
}

