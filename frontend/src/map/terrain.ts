// Local 3D terrain for the Gale site, built from USGS elevation models (no Cesium ion needed).
// fine:    HiRISE DEM mosaic (1 m source) averaged to ~10 m over the working area + margin
// context: HRSC-MOLA blended DEM (200 m) over ~60 x 70 km around it
// Both are prepared by the data scripts and stored as uint16 heightmaps (see public/data/terrain/*.json).

import { CustomHeightmapTerrainProvider, GeographicTilingScheme } from 'cesium';
import { MARS_SPHERE } from './mars';

export interface HeightGrid {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
  offset_m: number;
  scale_m: number;
  nodata: number;
  min_m: number;
  max_m: number;
  source: string;
  data: Uint16Array;
}

async function loadGrid(name: string): Promise<HeightGrid | null> {
  const base = `${import.meta.env.BASE_URL}data/terrain/${name}`;
  try {
    const [metaRes, binRes] = await Promise.all([fetch(`${base}.json`), fetch(`${base}.bin`)]);
    if (!metaRes.ok || !binRes.ok) return null;
    const meta = await metaRes.json();
    const buf = await binRes.arrayBuffer();
    if (buf.byteLength !== meta.width * meta.height * 2) return null;
    return { ...meta, data: new Uint16Array(buf) } as HeightGrid;
  } catch {
    return null;
  }
}

/** Bilinear height in metres at lon/lat (degrees, -180..180), or null outside the grid / on no-data. */
export function sampleGrid(g: HeightGrid, lon: number, lat: number): number | null {
  if (lon < g.west || lon > g.east || lat < g.south || lat > g.north) return null;
  const fx = ((lon - g.west) / (g.east - g.west)) * (g.width - 1);
  const fy = ((g.north - lat) / (g.north - g.south)) * (g.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, g.width - 1);
  const y1 = Math.min(y0 + 1, g.height - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const v = (x: number, y: number) => g.data[y * g.width + x];
  const a = v(x0, y0), b = v(x1, y0), c = v(x0, y1), d = v(x1, y1);
  if (a === g.nodata || b === g.nodata || c === g.nodata || d === g.nodata) {
    const near = v(Math.round(fx), Math.round(fy));
    return near === g.nodata ? null : g.offset_m + near * g.scale_m;
  }
  const top = a + (b - a) * tx;
  const bot = c + (d - c) * tx;
  return g.offset_m + (top + (bot - top) * ty) * g.scale_m;
}

export interface LocalTerrain {
  provider: CustomHeightmapTerrainProvider;
  fine: HeightGrid | null;
  context: HeightGrid | null;
  heightAt: (lon: number, lat: number) => number | null;
}

const SAMPLES = 33;

export async function createLocalTerrain(): Promise<LocalTerrain | null> {
  const [fine, context] = await Promise.all([loadGrid('gale_fine'), loadGrid('gale_context')]);
  if (!fine && !context) return null;
  const far = context ? context.min_m : (fine as HeightGrid).min_m;
  // The 200 m context DEM and the HiRISE DEM differ by up to tens of metres locally; blend them over a
  // ~1 km band inside the fine grid edge so there is no visible step. The working area lies deeper
  // inside the fine grid (>= 0.02 deg from its edge), so routes always sit on pure HiRISE terrain.
  const FEATHER_DEG = 0.015;
  const heightAt = (lon: number, lat: number): number | null => {
    const f = fine ? sampleGrid(fine, lon, lat) : null;
    const c = context ? sampleGrid(context, lon, lat) : null;
    if (f == null) return c;
    if (c == null || !fine) return f;
    const edge = Math.min(lon - fine.west, fine.east - lon, lat - fine.south, fine.north - lat);
    if (edge >= FEATHER_DEG) return f;
    const t = Math.max(0, edge / FEATHER_DEG);
    const w = t * t * (3 - 2 * t); // smoothstep
    return c + (f - c) * w;
  };

  const tilingScheme = new GeographicTilingScheme({ ellipsoid: MARS_SPHERE });
  const provider = new CustomHeightmapTerrainProvider({
    width: SAMPLES,
    height: SAMPLES,
    tilingScheme,
    callback: (x, y, level) => {
      const r = tilingScheme.tileXYToRectangle(x, y, level);
      const out = new Float32Array(SAMPLES * SAMPLES);
      const w = (r.west * 180) / Math.PI, e = (r.east * 180) / Math.PI;
      const n = (r.north * 180) / Math.PI, s = (r.south * 180) / Math.PI;
      for (let j = 0; j < SAMPLES; j++) {
        const lat = n - ((n - s) * j) / (SAMPLES - 1);
        for (let i = 0; i < SAMPLES; i++) {
          const lon = w + ((e - w) * i) / (SAMPLES - 1);
          out[j * SAMPLES + i] = heightAt(lon, lat) ?? far;
        }
      }
      return out;
    },
  });
  return { provider, fine, context, heightAt };
}
