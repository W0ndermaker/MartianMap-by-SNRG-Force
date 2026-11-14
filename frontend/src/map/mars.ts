// Mars constants, coordinate helpers and Mars Trek WMTS layer definitions.
// Every layer URL, zoom limit and extent below was checked against the Trek WMTSCapabilities
// and product index on 2026-11-14 (see docs/sources.md).

import {
  Cartesian3,
  Cartographic,
  Credit,
  Ellipsoid,
  GeographicTilingScheme,
  Math as CMath,
  Rectangle,
  WebMapTileServiceImageryProvider,
} from 'cesium';
import type { LonLat } from '../api/types';

/** Mars sphere used by the USGS DEMs and Mars Trek equirectangular tiles (IAU2000:104905), metres. */
export const MARS_RADIUS_M = 3396190;
export const MARS_SPHERE = new Ellipsoid(MARS_RADIUS_M, MARS_RADIUS_M, MARS_RADIUS_M);

/** Contract longitudes are east 0..360; Cesium works in -180..180. */
export function toCesiumLon(lonEast: number): number {
  return lonEast > 180 ? lonEast - 360 : lonEast;
}

export function toEast360(lon: number): number {
  const l = ((lon % 360) + 360) % 360;
  return Math.round(l * 1e7) / 1e7;
}

export function lonLatToCartesian(p: LonLat | [number, number, number], height = 0): Cartesian3 {
  return Cartesian3.fromDegrees(toCesiumLon(p[0]), p[1], height, MARS_SPHERE);
}

export function cartographicToLonLat(c: Cartographic): LonLat {
  return [toEast360(CMath.toDegrees(c.longitude)), Math.round(CMath.toDegrees(c.latitude) * 1e7) / 1e7];
}

export function inBounds(p: LonLat, b: [number, number, number, number]): boolean {
  return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
}

/** Mars Trek tile grid: level 0 = 2 x 1 tiles of 180 deg, origin at lon -180 / lat +90. */
export function trekTilingScheme(): GeographicTilingScheme {
  return new GeographicTilingScheme({ ellipsoid: MARS_SPHERE, numberOfLevelZeroTilesX: 2, numberOfLevelZeroTilesY: 1 });
}

export interface TrekLayer {
  id: string;
  title: string;
  url: string;
  maxLevel: number;
  /** West, south, east, north in degrees (-180..180); limits requests to the product footprint. */
  extent?: [number, number, number, number];
  credit: string;
}

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const tpl = (layer: string, ext = 'png') =>
  `${TREK}/${layer}/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.${ext}`;

export const TREK_LAYERS = {
  vikingColor: {
    id: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    title: 'Viking MDIM 2.1 global colour mosaic (232 m)',
    url: tpl('Mars_Viking_MDIM21_ClrMosaic_global_232m', 'jpg'),
    maxLevel: 7,
    credit: 'NASA/JPL/USGS (Viking MDIM 2.1) via Mars Trek',
  },
  molaShade: {
    id: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
    title: 'MOLA color hillshade (global, 463 m)',
    url: tpl('Mars_MGS_MOLA_ClrShade_merge_global_463m', 'jpg'),
    maxLevel: 7,
    credit: 'NASA/JPL/GSFC MOLA via Mars Trek',
  },
  ctx: {
    id: 'curiosity_ctx_mosaic',
    title: 'MRO CTX, Curiosity roving site mosaic',
    url: tpl('curiosity_ctx_mosaic'),
    maxLevel: 10,
    extent: [136.2768326, -7.2137273, 139.3864225, -3.5804738],
    credit: 'NASA/JPL/MSSS (CTX) via Mars Trek',
  },
  hirise: {
    id: 'curiosity_hirise_mosaic',
    title: 'MRO HiRISE, Curiosity roving site mosaic (~0.6 m/px)',
    url: tpl('curiosity_hirise_mosaic'),
    maxLevel: 16,
    extent: [137.1224669, -4.9254743, 137.7298129, -4.2489588],
    credit: 'NASA/JPL/University of Arizona (HiRISE) via Mars Trek',
  },
  thermal: {
    id: 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018',
    title: 'Odyssey THEMIS daytime infrared (100 m)',
    url: tpl('THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018'),
    maxLevel: 9,
    extent: [-179.9999997, -65.0006576, 179.9998849, 65.0007535],
    credit: 'NASA/JPL/ASU (THEMIS) via Mars Trek',
  },
  geology: {
    id: 'SIM3292_Global_Geology',
    title: 'USGS geologic map of Mars, SIM 3292',
    url: 'https://trek.nasa.gov/mars/trekarcgis/rest/services/SIM3292_Global_Geology/MapServer/WMTS/tile/1.0.0/SIM3292_Global_Geology/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.png',
    maxLevel: 11,
    credit: 'USGS SIM 3292 (Tanaka et al., 2014) via Mars Trek',
  },
} satisfies Record<string, TrekLayer>;

// ---------- Mars colour tint for the grayscale HiRISE / CTX mosaics ----------
// HiRISE RED and CTX are single-band (grayscale) products. For readability the map can map gray levels to a
// Mars-like palette. This is a VISUALISATION, not true colour (labelled in the UI).
const TINT_STOPS: [number, [number, number, number]][] = [
  [0, [28, 16, 12]],
  [70, [96, 52, 32]],
  [140, [170, 102, 62]],
  [200, [214, 156, 106]],
  [255, [246, 214, 178]],
];
const TINT_LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    let k = 1;
    while (k < TINT_STOPS.length - 1 && v > TINT_STOPS[k][0]) k++;
    const [a, ca] = TINT_STOPS[k - 1];
    const [b, cb] = TINT_STOPS[k];
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    for (let c = 0; c < 3; c++) lut[v * 3 + c] = ca[c] + (cb[c] - ca[c]) * t;
  }
  return lut;
})();

function tintImage(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const g = p[i]; // grayscale: R = G = B
    p[i] = TINT_LUT[g * 3];
    p[i + 1] = TINT_LUT[g * 3 + 1];
    p[i + 2] = TINT_LUT[g * 3 + 2];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

class TintedWmtsProvider extends WebMapTileServiceImageryProvider {
  requestImage(...args: Parameters<WebMapTileServiceImageryProvider['requestImage']>) {
    const p = super.requestImage(...args);
    if (!p) return p;
    return p.then((img) => tintImage(img as CanvasImageSource & { width: number; height: number }));
  }
}

export function trekProvider(layer: TrekLayer, opts: { tint?: boolean } = {}): WebMapTileServiceImageryProvider {
  const Ctor = opts.tint ? TintedWmtsProvider : WebMapTileServiceImageryProvider;
  return new Ctor({
    url: layer.url,
    layer: layer.id,
    style: 'default',
    tileMatrixSetID: 'default028mm',
    tilingScheme: trekTilingScheme(),
    maximumLevel: layer.maxLevel,
    rectangle: layer.extent ? Rectangle.fromDegrees(...layer.extent) : undefined,
    credit: new Credit(layer.credit),
  });
}

/** Default camera target: lower Mount Sharp, boxwork area (Curiosity sols ~4540-4830). */
export const BOXWORK_ANCHOR: LonLat = [137.382, -4.803];
