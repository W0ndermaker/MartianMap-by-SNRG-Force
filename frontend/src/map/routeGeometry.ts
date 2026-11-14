// Pure geometry helpers for routes (no Cesium objects): distances along the path, slope bands,
// position at a given distance. Distances on the Mars sphere.

import type { LonLat, ProfilePoint } from '../api/types';

/** Path vertex from the API: [longitude east, latitude, elevation m]. */
export type LonLatElev = [number, number, number];

const R_MARS = 3396190;

/** Great-circle distance on the Mars sphere, metres. */
export function distanceM(a: LonLat, b: LonLat): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MARS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type SlopeBand = 'low' | 'mid' | 'high';

/**
 * Display bands relative to the user's max-slope limit (the backend treats anything steeper as impassable).
 * Red starts where the backend flags a hazard (HAZARD_SLOPE_FRACTION = 0.8 of the limit); the 50 % split for
 * yellow is a display convention. Both are MODEL ASSUMPTIONS, not physiological thresholds.
 */
export const BAND_SPLIT = { mid: 0.5, high: 0.8 };

export function bandFor(slopeDeg: number, maxSlopeDeg: number): SlopeBand {
  if (slopeDeg >= maxSlopeDeg * BAND_SPLIT.high) return 'high';
  if (slopeDeg >= maxSlopeDeg * BAND_SPLIT.mid) return 'mid';
  return 'low';
}

export function cumulative(path: LonLatElev[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + distanceM([path[i - 1][0], path[i - 1][1]], [path[i][0], path[i][1]]));
  }
  return out;
}

/** Slope at a distance along the route, from the nearest profile sample. */
export function slopeAt(profile: ProfilePoint[], distM: number): number {
  if (!profile.length) return 0;
  let lo = 0, hi = profile.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (profile[mid].dist_m <= distM) lo = mid; else hi = mid;
  }
  return Math.abs(distM - profile[lo].dist_m) <= Math.abs(profile[hi].dist_m - distM)
    ? profile[lo].slope_deg : profile[hi].slope_deg;
}

export interface BandRun { band: SlopeBand; coords: LonLatElev[] }

/** Splits the path into runs of equal slope band; runs share their boundary vertex so the line stays continuous. */
export function bandRuns(path: LonLatElev[], profile: ProfilePoint[], maxSlopeDeg: number): BandRun[] {
  if (path.length < 2) return [];
  const cum = cumulative(path);
  const runs: BandRun[] = [];
  for (let i = 1; i < path.length; i++) {
    const band = bandFor(slopeAt(profile, (cum[i - 1] + cum[i]) / 2), maxSlopeDeg);
    const last = runs[runs.length - 1];
    if (last && last.band === band) last.coords.push(path[i]);
    else runs.push({ band, coords: [path[i - 1], path[i]] });
  }
  return runs;
}

/** Interpolated [lon, lat, elev] at a distance along the path (clamped to the ends). */
export function pointAtDistance(path: LonLatElev[], cum: number[], d: number): LonLatElev {
  if (d <= 0) return path[0];
  const total = cum[cum.length - 1];
  if (d >= total) return path[path.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const t = (d - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
  const a = path[lo], b = path[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Initial bearing from a to b, radians clockwise from north. */
export function bearing(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r);
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r);
  return Math.atan2(y, x);
}

export interface StraightRun {
  coords: LonLat[]
  steep: boolean
}

export interface StraightLine {
  runs: StraightRun[]
  /** Length of the straight line steeper than the limit, metres. */
  steepM: number
  maxSlopeDeg: number
  lengthM: number
}

/** Ground slope in degrees at a point, from heights 1 cell (stepM) around it; null without data. */
export function groundSlopeAt(
  heightAt: (lon: number, lat: number) => number | null,
  p: LonLat,
  stepM: number,
): number | null {
  const dLat = ((stepM / R_MARS) * 180) / Math.PI
  const dLon = dLat / Math.cos((p[1] * Math.PI) / 180)
  const e = heightAt(p[0] + dLon, p[1])
  const w = heightAt(p[0] - dLon, p[1])
  const n = heightAt(p[0], p[1] + dLat)
  const s = heightAt(p[0], p[1] - dLat)
  if (e == null || w == null || n == null || s == null) return null
  return (Math.atan(Math.hypot((e - w) / (2 * stepM), (n - s) / (2 * stepM))) * 180) / Math.PI
}

/**
 * The straight line from start to goal, sampled every stepM and split into runs that are within or
 * above the slope limit: the "what if you walked straight there" comparison for the route.
 */
export function straightLine(
  start: LonLat,
  goal: LonLat,
  heightAt: (lon: number, lat: number) => number | null,
  maxSlopeDeg: number,
  stepM: number,
): StraightLine {
  const lengthM = distanceM(start, goal)
  const n = Math.max(2, Math.ceil(lengthM / stepM))
  const runs: StraightRun[] = []
  let steepM = 0
  let maxSlope = 0
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p: LonLat = [start[0] + (goal[0] - start[0]) * t, start[1] + (goal[1] - start[1]) * t]
    const slope = groundSlopeAt(heightAt, p, stepM) ?? 0
    maxSlope = Math.max(maxSlope, slope)
    const steep = slope > maxSlopeDeg
    if (steep && i > 0) steepM += lengthM / n
    const last = runs[runs.length - 1]
    if (last && last.steep === steep) last.coords.push(p)
    else {
      // start the new run at the previous point so the runs join without gaps
      const prev = last ? last.coords[last.coords.length - 1] : null
      runs.push({ coords: prev ? [prev, p] : [p], steep })
    }
  }
  return { runs, steepM, maxSlopeDeg: maxSlope, lengthM }
}
