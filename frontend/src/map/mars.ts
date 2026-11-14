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

export function trekProvider(layer: TrekLayer): WebMapTileServiceImageryProvider {
  return new WebMapTileServiceImageryProvider({
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
