// 3D map of the Gale crater working area (developer A).
// Default mode: Cesium globe on the Mars sphere, Mars Trek imagery, local terrain from USGS HiRISE DEM.
// Optional mode (needs VITE_CESIUM_ION_TOKEN): Cesium Mars global 3D tileset from Cesium ion.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileset,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  Ellipsoid,
  Globe,
  HeadingPitchRange,
  HeightReference,
  ImageryLayer,
  ImageryLayerCollection,
  Ion,
  LabelStyle,
  Math as CMath,
  Matrix4,
  PolylineDashMaterialProperty,
  RequestScheduler,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer,
  defined,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import traverseUrl from '@data/curiosity_traverse.geojson?url';
import reachUrl from '@data/reach_from_base.geojson?url';
import { offlineDemoPairs } from '../api/offline';
import type { LonLat, TraverseCollection } from '../api/types';
import { useAppStore } from '../store/useAppStore';
import { useCopilotStore } from '../store/useCopilotStore';
import { elevationOverlay, noGoOverlay, slopeOverlay } from './demOverlays';
import { startFlyover } from './flyover';
import { useMapStore, type MapLayerId } from './mapStore';
import MapHud from './MapHud';
import {
  BOXWORK_ANCHOR,
  MARS_SPHERE,
  TREK_LAYERS,
  cartographicToLonLat,
  inBounds,
  lonLatToCartesian,
  toCesiumLon,
  trekProvider,
} from './mars';
import {
  bandRuns,
  bearing,
  cumulative,
  pointAtDistance,
  straightLine,
  type LonLatElev,
  type SlopeBand,
} from './routeGeometry';
import { createLocalTerrain, type LocalTerrain } from './terrain';

/** Cesium ion asset id of "Cesium Mars" (secondary source: Cesium Sandcastle "Mars" example; verify in your ion account). */
const CESIUM_MARS_ASSET_ID = 3644333;
const ION_TOKEN = (import.meta.env.VITE_CESIUM_ION_TOKEN ?? '').trim();

// Mars Trek answers each tile in ~1.5 s; allow more parallel requests than Cesium's default (18).
RequestScheduler.requestsByServer['trek.nasa.gov:443'] = 40;

export type TerrainMode = 'local' | 'ion';

const BAND_COLOR: Record<SlopeBand, Color> = {
  low: Color.fromCssColorString('#2ea043'),
  mid: Color.fromCssColorString('#f0b429'),
  high: Color.fromCssColorString('#e5484d'),
};

const POI_COLOR: Record<string, string> = { science: '#a371f7', base: '#3fb6ff', rover_stop: '#f7a94b' };

function svgIcon(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const HAZARD_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="26" viewBox="0 0 28 26">' +
    '<path d="M14 1 L27 25 H1 Z" fill="#e5484d" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' +
    '<rect x="12.6" y="8" width="2.8" height="9" rx="1.2" fill="#fff"/><circle cx="14" cy="20.6" r="1.6" fill="#fff"/></svg>',
);

function poiIcon(kind: string): string {
  const c = POI_COLOR[kind] ?? '#cccccc';
  const letter = kind === 'science' ? 'S' : kind === 'base' ? 'B' : 'R';
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">` +
      `<path d="M15 37 C15 37 2 22 2 14 A13 13 0 0 1 28 14 C28 22 15 37 15 37 Z" fill="${c}" stroke="#fff" stroke-width="2"/>` +
      `<text x="15" y="19" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`,
  );
}

function endpointIcon(label: 'A' | 'B'): string {
  const c = label === 'A' ? '#3fb950' : '#58a6ff';
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">` +
      `<circle cx="15" cy="15" r="12" fill="${c}" stroke="#fff" stroke-width="3"/>` +
      `<text x="15" y="20" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`,
  );
}

function labelGraphics(text: string, offsetY = -34) {
  return {
    text,
    font: '600 13px "JetBrains Mono", ui-monospace, monospace',
    fillColor: Color.WHITE,
    outlineColor: Color.BLACK,
    outlineWidth: 3,
    style: LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cartesian2(0, offsetY),
    heightReference: HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    showBackground: false,
  };
}

/** Joins consecutive drive segments of the traverse file into continuous lines (fewer ground polylines). */
function traverseChains(fc: TraverseCollection): LonLat[][] {
  const chains: LonLat[][] = [];
  for (const f of fc.features) {
    if (f.geometry.type !== 'LineString') continue;
    const pts = f.geometry.coordinates.map((c) => [c[0], c[1]] as LonLat);
    if (pts.length < 2) continue;
    const last = chains[chains.length - 1];
    const tail = last?.[last.length - 1];
    if (tail && Math.abs(tail[0] - pts[0][0]) < 2e-6 && Math.abs(tail[1] - pts[0][1]) < 2e-6) last.push(...pts.slice(1));
    else chains.push(pts);
  }
  return chains;
}

/** Ring pieces shorter than this share of the ring's main line are not drawn. */
const RING_MIN_SHARE = 0.15;

interface GeoJsonRings {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'MultiLineString'; coordinates: [number, number][][] };
    properties: { kind: 'ring' | 'walkback'; minutes: number; label: string; area_km2: number };
  }[];
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const terrainRef = useRef<LocalTerrain | null>(null);
  const sources = useRef<Record<string, CustomDataSource>>({});
  const overlayLayers = useRef<Partial<Record<MapLayerId, ImageryLayer>>>({});
  const imageryRef = useRef<ImageryLayerCollection | null>(null);
  const baseRef = useRef<ImageryLayer[]>([]);
  const baseTintRef = useRef<boolean | null>(null);
  const [tilesPending, setTilesPending] = useState(0);
  const tint = useMapStore((s) => s.tint);
  const mapLayers = useMapStore((s) => s.layers);
  const hoverDistM = useMapStore((s) => s.hoverDistM);
  const stopFlyRef = useRef<(() => void) | null>(null);
  const framedRouteRef = useRef<unknown>(null);

  const [mode, setMode] = useState<TerrainMode>('local');
  const [viewerReady, setViewerReady] = useState(0);
  const [terrainNote, setTerrainNote] = useState<string | null>(null);
  const [elevRange, setElevRange] = useState<[number, number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // notices are hints: hide them automatically
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  const [flying, setFlying] = useState(false);

  const health = useAppStore((s) => s.health);
  const poi = useAppStore((s) => s.poi);
  const start = useAppStore((s) => s.start);
  const goal = useAppStore((s) => s.goal);
  const route = useAppStore((s) => s.route);
  const routeState = useAppStore((s) => s.routeState);
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg);
  const layers = useAppStore((s) => s.layers);
  const selectedPoiId = useAppStore((s) => s.selectedPoiId);

  const bounds = health?.bounds ?? null;

  // ---------- viewer lifecycle ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let destroyed = false;
    const ellipsoid = mode === 'ion' ? Ellipsoid.MARS : MARS_SPHERE;
    Ellipsoid.default = ellipsoid;
    if (ION_TOKEN) Ion.defaultAccessToken = ION_TOKEN;

    const viewer = new Viewer(container, {
      globe: new Globe(ellipsoid),
      baseLayer: false,
      geocoder: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      homeButton: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: false,
    });
    viewerRef.current = viewer;
    const scene = viewer.scene;
    scene.backgroundColor = Color.fromCssColorString('#05060a');
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
    scene.globe.showGroundAtmosphere = false;
    scene.globe.baseColor = Color.fromCssColorString('#5a3a28');
    scene.globe.depthTestAgainstTerrain = true;
    scene.globe.maximumScreenSpaceError = 1.5;
    scene.fog.enabled = false;
    scene.screenSpaceCameraController.minimumZoomDistance = 30;

    // Trackpad pinch: Safari sends WebKit gesture events, Chrome/Firefox send ctrl+wheel. Cesium ignores both
    // (and Safari would zoom the whole page), so turn them into camera zoom here.
    const zoomBy = (factor: number) => {
      if (!Number.isFinite(factor) || factor <= 0 || viewer.isDestroyed()) return;
      const cam = viewer.camera;
      const carto = cam.positionCartographic;
      const ground = scene.globe.getHeight(carto) ?? terrainRef.current?.heightAt(CMath.toDegrees(carto.longitude), CMath.toDegrees(carto.latitude)) ?? 0;
      const agl = Math.max(60, carto.height - ground);
      const amount = agl * (1 - 1 / factor);
      if (amount > 0) cam.zoomIn(Math.min(amount, agl - 40));
      else cam.zoomOut(Math.min(-amount, 5e6));
    };
    let lastScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const s = (e as unknown as { scale: number }).scale;
      if (s > 0) zoomBy(s / lastScale);
      lastScale = s;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // plain two-finger scroll is handled by Cesium itself
      e.preventDefault();
      e.stopPropagation();
      zoomBy(Math.exp(-e.deltaY * 0.012));
    };
    const opts: AddEventListenerOptions = { passive: false, capture: true };
    container.addEventListener('gesturestart', onGestureStart, opts);
    container.addEventListener('gesturechange', onGestureChange, opts);
    container.addEventListener('gestureend', onGestureStart, opts);
    container.addEventListener('wheel', onWheel, opts);

    for (const name of ['bounds', 'tracks', 'reach', 'straight', 'route', 'hazards', 'poi', 'points', 'highlight', 'copilot']) {
      const ds = new CustomDataSource(name);
      sources.current[name] = ds;
      void viewer.dataSources.add(ds);
    }

    // Base imagery, coarse to fine: Viking colour mosaic (global, true colour) -> CTX -> HiRISE
    // (CTX/HiRISE are grayscale; optionally tinted, see mars.ts).
    const addBase = (target: ImageryLayerCollection) => {
      target.add(new ImageryLayer(trekProvider(TREK_LAYERS.vikingColor)));
      const tint = useMapStore.getState().tint;
      baseRef.current = [TREK_LAYERS.ctx, TREK_LAYERS.hirise].map((l) => {
        const il = new ImageryLayer(trekProvider(l, { tint }));
        target.add(il);
        return il;
      });
      baseTintRef.current = tint;
    };
    const tileListener = scene.globe.tileLoadProgressEvent.addEventListener((n: number) => setTilesPending(n));
    imageryRef.current = viewer.imageryLayers;
    if (mode === 'local') addBase(viewer.imageryLayers);

    (async () => {
      if (mode === 'ion') {
        try {
          const tileset = await Cesium3DTileset.fromIonAssetId(CESIUM_MARS_ASSET_ID, { enableCollision: true });
          if (destroyed) return;
          scene.primitives.add(tileset);
          scene.globe.show = false;
          // Cesium >= 1.13x drapes imagery on 3D Tiles: Mars Trek layers go on the tileset itself.
          addBase(tileset.imageryLayers);
          imageryRef.current = tileset.imageryLayers;
          setTerrainNote('Terrain: Cesium Mars 3D tiles (Cesium ion, MOLA/HRSC based) with Mars Trek imagery draped on top.');
        } catch (e) {
          if (destroyed) return;
          setTerrainNote(null);
          setNotice(`Cesium Mars could not be loaded (${e instanceof Error ? e.message : 'unknown error'}). Switched back to local terrain.`);
          setMode('local');
          return;
        }
      } else {
        const t = await createLocalTerrain();
        if (destroyed) return;
        terrainRef.current = t;
        if (t) {
          viewer.terrainProvider = t.provider;
          if (t.fine) setElevRange([t.fine.min_m, t.fine.max_m]);
          setTerrainNote(t.fine ? `Terrain: ${t.fine.source}` : `Terrain: ${t.context?.source}`);
        } else {
          setTerrainNote('Terrain data not found: showing a smooth sphere.');
        }
      }
      setViewerReady((n) => n + 1);
    })();

    return () => {
      destroyed = true;
      tileListener();
      baseRef.current = [];
      container.removeEventListener('gesturestart', onGestureStart, opts);
      container.removeEventListener('gesturechange', onGestureChange, opts);
      container.removeEventListener('gestureend', onGestureStart, opts);
      container.removeEventListener('wheel', onWheel, opts);
      stopFlyRef.current?.();
      stopFlyRef.current = null;
      overlayLayers.current = {};
      imageryRef.current = null;
      sources.current = {};
      terrainRef.current = null;
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [mode]);

  // ---------- camera to the working area ----------
  const flyHome = useCallback((duration = 1.5) => {
    const viewer = viewerRef.current;
    const b = useAppStore.getState().health?.bounds;
    if (!viewer) return;
    const center: LonLat = b ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : BOXWORK_ANCHOR;
    const h = terrainRef.current?.heightAt(toCesiumLon(center[0]), center[1]) ?? -4000;
    const radius = b ? Math.max(b[2] - b[0], b[3] - b[1]) * 59270 * 0.6 : 6000;
    viewer.camera.flyToBoundingSphere(new BoundingSphere(lonLatToCartesian(center, h), radius), {
      offset: new HeadingPitchRange(CMath.toRadians(15), CMath.toRadians(-38), radius * 2.1),
      duration,
    });
  }, []);

  useEffect(() => {
    if (viewerReady && health) flyHome(0);
  }, [viewerReady, health, flyHome]);

  // ---------- working-area frame ----------
  useEffect(() => {
    const ds = sources.current.bounds;
    if (!ds) return;
    ds.entities.removeAll();
    if (!bounds) return;
    const [w, s, e, n] = bounds;
    const ring: LonLat[] = [[w, s], [e, s], [e, n], [w, n], [w, s]];
    ds.entities.add({
      polyline: {
        positions: ring.map((p) => lonLatToCartesian(p)),
        clampToGround: true,
        width: 3,
        material: new PolylineDashMaterialProperty({ color: Color.fromCssColorString('#ffd166'), dashLength: 24 }),
      },
    });
    ds.entities.add({
      position: lonLatToCartesian([w, n]),
      label: { ...labelGraphics('Working area', -14), horizontalOrigin: 1 },
    });
  }, [bounds, viewerReady]);

  // ---------- clicks: POI select, start / goal ----------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((ev: ScreenSpaceEventHandler.PositionedEvent) => {
      const st = useAppStore.getState();
      const picked = viewer.scene.pick(ev.position);
      const ent: Entity | undefined = picked?.id;
      const poiId = ent?.properties?.poiId?.getValue();
      if (poiId) {
        st.selectPoi(poiId);
        return;
      }
      // Zoomed out to a regional / globe view: clicks are for looking around, not for placing points.
      if (viewer.camera.positionCartographic.height > 150000) return;
      let cart: Cartesian3 | undefined;
      if (mode === 'ion' && viewer.scene.pickPositionSupported) cart = viewer.scene.pickPosition(ev.position);
      if (!defined(cart)) {
        const ray = viewer.camera.getPickRay(ev.position);
        cart = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
      }
      if (!cart) return;
      const p = cartographicToLonLat(Cartographic.fromCartesian(cart, viewer.scene.globe.ellipsoid));
      const b = st.health?.bounds;
      if (b && !inBounds(p, b)) {
        setNotice('That point is outside the working area. Click inside the dashed frame.');
        return;
      }
      setNotice(null);
      st.placePoint(p); // shared store: start, then goal (plans the route), then a new start
    }, ScreenSpaceEventType.LEFT_CLICK);
    return () => handler.destroy();
  }, [viewerReady, mode]);

  // ---------- start / goal markers ----------
  useEffect(() => {
    const ds = sources.current.points;
    if (!ds) return;
    ds.entities.removeAll();
    const add = (p: LonLat, label: 'A' | 'B', text: string) =>
      ds.entities.add({
        position: lonLatToCartesian(p),
        billboard: {
          image: endpointIcon(label),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: labelGraphics(text, -26),
      });
    if (start) add(start, 'A', 'Start');
    if (goal) add(goal, 'B', 'Goal');
  }, [start, goal, viewerReady]);

  // ---------- POI markers ----------
  useEffect(() => {
    const ds = sources.current.poi;
    if (!ds) return;
    ds.entities.removeAll();
    ds.show = layers.poi;
    for (const f of poi?.features ?? []) {
      const pr = f.properties;
      const selected = pr.id === selectedPoiId;
      ds.entities.add({
        position: lonLatToCartesian(f.geometry.coordinates),
        billboard: {
          image: poiIcon(pr.kind),
          verticalOrigin: VerticalOrigin.BOTTOM,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scale: selected ? 1.25 : 1,
        },
        label: { ...labelGraphics(pr.name, selected ? -52 : -44), fillColor: selected ? Color.YELLOW : Color.WHITE },
        properties: { poiId: pr.id },
      });
    }
  }, [poi, selectedPoiId, layers.poi, viewerReady]);

  // ---------- route line coloured by slope ----------
  useEffect(() => {
    const ds = sources.current.route;
    const hz = sources.current.hazards;
    if (!ds || !hz) return;
    ds.entities.removeAll();
    hz.entities.removeAll();
    ds.show = layers.route;
    hz.show = layers.hazards;
    const coords = route?.status === 'ok' ? route.path?.coordinates : null;
    if (!coords || coords.length < 2) return;
    const all = coords.map((c) => lonLatToCartesian(c));
    ds.entities.add({ polyline: { positions: all, clampToGround: true, width: 13, material: Color.BLACK.withAlpha(0.45) } });
    for (const run of bandRuns(coords, route?.profile ?? [], maxSlopeDeg)) {
      ds.entities.add({
        polyline: { positions: run.coords.map((c) => lonLatToCartesian(c)), clampToGround: true, width: 8, material: BAND_COLOR[run.band] },
      });
    }
    for (const h of route?.hazards ?? []) {
      hz.entities.add({
        position: lonLatToCartesian(h.position),
        billboard: {
          image: HAZARD_ICON,
          verticalOrigin: VerticalOrigin.BOTTOM,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        // text only when zoomed in, so it does not cover Start/Goal in overview
        label: {
          ...labelGraphics(`${h.note} (${h.value.toFixed(1)}°)`, -30),
          font: '600 12px "JetBrains Mono", ui-monospace, monospace',
          distanceDisplayCondition: new DistanceDisplayCondition(0, 2500),
        },
      });
    }

    // frame a new route (not on layer toggles, not while a flyover owns the camera)
    const viewer = viewerRef.current;
    if (viewer && !stopFlyRef.current && framedRouteRef.current !== route) {
      framedRouteRef.current = route;
      const sphere = BoundingSphere.fromPoints(
        coords.map((c) => lonLatToCartesian(c, terrainRef.current?.heightAt(toCesiumLon(c[0]), c[1]) ?? c[2])),
      );
      const r = Math.max(250, sphere.radius);
      viewer.camera.flyToBoundingSphere(sphere, {
        offset: new HeadingPitchRange(viewer.camera.heading, CMath.toRadians(-45), r * 3.6),
        duration: 1.4,
      });
    }
  }, [route, maxSlopeDeg, layers.route, layers.hazards, viewerReady]);

  // ---------- straight line vs route: what walking straight to the goal would cross ----------
  const setStraight = useMapStore((s) => s.setStraight);
  useEffect(() => {
    const ds = sources.current.straight;
    if (!ds) return;
    ds.entities.removeAll();
    const t = terrainRef.current;
    const ok = route?.status === 'ok' && start && goal && t;
    if (!ok) {
      setStraight(null);
      return;
    }
    const heightAt = (lon: number, lat: number) => t.heightAt(toCesiumLon(lon), lat);
    const line = straightLine(start, goal, heightAt, maxSlopeDeg, health?.cell_size_m ?? 10);
    setStraight({ steepM: line.steepM, maxSlopeDeg: line.maxSlopeDeg, lengthM: line.lengthM });
    ds.show = layers.straight;
    for (const run of line.runs) {
      if (run.coords.length < 2) continue;
      ds.entities.add({
        polyline: {
          positions: run.coords.map((c) => lonLatToCartesian(c)),
          clampToGround: true,
          width: run.steep ? 7 : 3,
          material: run.steep
            ? Color.fromCssColorString('#e879f9')
            : new PolylineDashMaterialProperty({ color: Color.WHITE.withAlpha(0.7), dashLength: 16 }),
        },
      });
    }
  }, [route, start, goal, maxSlopeDeg, layers.straight, elevRange, viewerReady, health, setStraight]);

  // ---------- walk-back rings from the base (precomputed by the backend) ----------
  const [reachData, setReachData] = useState<GeoJsonRings | null>(null);
  const [ringsShown, setRingsShown] = useState(0);
  useEffect(() => {
    if (!layers.reach || reachData) return;
    fetch(reachUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: GeoJsonRings) => setReachData(d))
      .catch(() => setNotice('Walk-back rings could not be loaded.'));
  }, [layers.reach, reachData]);
  // Rings appear one by one, spreading out from the base.
  useEffect(() => {
    if (!layers.reach || !reachData) {
      setRingsShown(0);
      return;
    }
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setRingsShown(n);
      if (n >= reachData.features.length) clearInterval(id);
    }, 450);
    return () => clearInterval(id);
  }, [layers.reach, reachData]);
  useEffect(() => {
    const ds = sources.current.reach;
    if (!ds) return;
    ds.entities.removeAll();
    if (!reachData || !layers.reach) return;
    const feats = reachData.features.slice(0, ringsShown);
    feats.forEach((f, i) => {
      const walkback = f.properties.kind === 'walkback';
      const color = walkback
        ? Color.WHITE
        : Color.fromCssColorString('#22d3ee').withAlpha(0.95 - (0.45 * i) / Math.max(1, feats.length));
      let longest: [number, number][] = [];
      for (const line of f.geometry.coordinates) if (line.length > longest.length) longest = line;
      // Draw the main boundary and big lobes only; small islands around single knobs are noise here.
      for (const line of f.geometry.coordinates) {
        if (line.length < longest.length * RING_MIN_SHARE) continue;
        ds.entities.add({
          polyline: {
            positions: line.map((c) => lonLatToCartesian(c)),
            clampToGround: true,
            width: walkback ? 5 : 3,
            material: color,
          },
        });
      }
      if (longest.length) {
        const at = longest[Math.floor(longest.length * 0.35)];
        ds.entities.add({
          position: lonLatToCartesian(at),
          label: {
            ...labelGraphics(walkback ? 'Walk-back limit' : f.properties.label, -10),
            fillColor: walkback ? Color.WHITE : Color.fromCssColorString('#a5f3fc'),
          },
        });
      }
    });
  }, [reachData, ringsShown, layers.reach, viewerReady]);

  // ---------- EVA Copilot demo: astronaut marker, way out / way back, chase camera ----------
  const copilotScenario = useCopilotStore((s) => s.scenario);
  const copilotIndex = useCopilotStore((s) => s.index);
  const copilotState = useCopilotStore((s) => s.state);
  const chaseHeading = useRef<number | null>(null);
  const copilotActive = copilotState === 'playing' || copilotState === 'done';
  useEffect(() => {
    const ds = sources.current.copilot;
    const viewer = viewerRef.current;
    if (!ds || !viewer) return;
    ds.entities.removeAll();
    // The demo has its own route: hide the planner's lines while it plays.
    for (const name of ['route', 'hazards', 'straight', 'tracks'] as const) {
      const other = sources.current[name];
      const normal = name === 'tracks' ? layers.traverse : layers[name];
      if (other) other.show = copilotActive ? false : normal;
    }
    if (!copilotActive || !copilotScenario) {
      if (chaseHeading.current !== null) viewer.camera.lookAtTransform(Matrix4.IDENTITY);
      chaseHeading.current = null;
      return;
    }
    const steps = copilotScenario.steps;
    const step = steps[Math.min(copilotIndex, steps.length - 1)];
    const line = (coords: [number, number, number][], css: string, width: number) =>
      ds.entities.add({
        polyline: { positions: coords.map((c) => lonLatToCartesian(c)), clampToGround: true, width, material: Color.fromCssColorString(css) },
      });
    line(copilotScenario.outbound_path.coordinates, '#22d3ee', 6);
    if (step.phase === 'back' && copilotScenario.return_path) line(copilotScenario.return_path.coordinates, '#e879f9', 7);
    const level = step.copilot.level;
    ds.entities.add({
      position: lonLatToCartesian(step.position),
      point: {
        pixelSize: 16,
        color: level === 'go' ? Color.CYAN : level === 'caution' ? Color.fromCssColorString('#fef9c3') : Color.fromCssColorString('#e879f9'),
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: labelGraphics(`Astronaut · O₂ ${Math.round(step.o2_pct)} %`, -22),
    });

    // Chase camera: low behind the astronaut, looking along the walk.
    if (copilotState !== 'playing') return;
    stopFlyRef.current?.();
    const next = steps[Math.min(copilotIndex + 3, steps.length - 1)];
    const target = next === step ? (chaseHeading.current ?? 0) : bearing(step.position, next.position);
    if (chaseHeading.current === null) chaseHeading.current = target;
    else {
      const delta = Math.atan2(Math.sin(target - chaseHeading.current), Math.cos(target - chaseHeading.current));
      chaseHeading.current += delta * 0.25;
    }
    const t = terrainRef.current;
    const ground = t?.heightAt(toCesiumLon(step.position[0]), step.position[1]) ?? -4500;
    viewer.camera.lookAt(
      lonLatToCartesian(step.position, ground + 2),
      new HeadingPitchRange(chaseHeading.current, CMath.toRadians(-22), 420),
    );
  }, [copilotScenario, copilotIndex, copilotState, copilotActive, layers, viewerReady]);

  // ---------- profile hover highlight ----------
  const routeCum = useMemo(() => {
    const c = route?.path?.coordinates;
    return c && c.length > 1 ? cumulative(c) : null;
  }, [route]);

  useEffect(() => {
    const ds = sources.current.highlight;
    if (!ds) return;
    ds.entities.removeAll();
    const coords = route?.status === 'ok' ? route.path?.coordinates : null;
    const prof = route?.profile;
    if (hoverDistM == null || !coords || !prof?.length || !routeCum) return;
    // nearest profile sample for the label
    const sample = prof.reduce((a, b) => (Math.abs(b.dist_m - hoverDistM) < Math.abs(a.dist_m - hoverDistM) ? b : a));
    // profile distances follow the route length; scale to our along-path distance
    const total = routeCum[routeCum.length - 1];
    const scale = route?.distance_m ? total / route.distance_m : 1;
    const p: LonLatElev = pointAtDistance(coords, routeCum, hoverDistM * scale);
    ds.entities.add({
      position: lonLatToCartesian(p),
      point: {
        pixelSize: 16,
        color: Color.YELLOW,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: labelGraphics(`${Math.round(sample.dist_m)} m · ${sample.slope_deg.toFixed(1)}°`, -22),
    });
  }, [hoverDistM, route, routeCum, viewerReady]);

  // ---------- swap CTX/HiRISE between tinted and grayscale in place ----------
  useEffect(() => {
    const imagery = imageryRef.current;
    if (!imagery || baseTintRef.current === null || baseTintRef.current === tint) return;
    const sources = [TREK_LAYERS.ctx, TREK_LAYERS.hirise];
    baseRef.current = baseRef.current.map((old, i) => {
      const index = imagery.indexOf(old);
      const fresh = new ImageryLayer(trekProvider(sources[i], { tint }));
      imagery.remove(old, true);
      imagery.add(fresh, index >= 0 ? index : undefined);
      return fresh;
    });
    baseTintRef.current = tint;
  }, [tint, viewerReady]);

  // ---------- switchable layers ----------
  useEffect(() => {
    const viewer = viewerRef.current;
    const imagery = imageryRef.current;
    if (!viewer || !imagery) return;
    let cancelled = false;
    const fine = terrainRef.current?.fine ?? null;
    const want = (id: MapLayerId) => mapLayers[id];
    const ensure = async (id: MapLayerId) => {
      const existing = overlayLayers.current[id];
      if (!want(id)) {
        if (existing) {
          imagery.remove(existing, true);
          delete overlayLayers.current[id];
        }
        return;
      }
      if (existing) return;
      let provider;
      if (id === 'thermal') provider = trekProvider(TREK_LAYERS.thermal);
      else if (id === 'mola') provider = trekProvider(TREK_LAYERS.molaShade);
      else if (id === 'geology') provider = trekProvider(TREK_LAYERS.geology);
      else if (!fine) {
        setNotice('Elevation, slope and no-go layers need the local HiRISE terrain, which is not loaded.');
        return;
      } else if (id === 'nogo') provider = await noGoOverlay(fine, useAppStore.getState().maxSlopeDeg);
      else provider = id === 'elevation' ? await elevationOverlay(fine) : await slopeOverlay(fine);
      if (cancelled || overlayLayers.current[id] || viewer.isDestroyed()) return;
      const layer = new ImageryLayer(provider, { alpha: id === 'geology' ? 0.55 : id === 'mola' ? 0.6 : id === 'nogo' ? 0.85 : 0.7 });
      imagery.add(layer);
      overlayLayers.current[id] = layer;
    };
    void Promise.all((['elevation', 'slope', 'thermal', 'geology', 'mola', 'nogo'] as const).map(ensure));

    return () => {
      cancelled = true;
    };
  }, [mapLayers, viewerReady]);

  // no-go mask follows the max-slope slider: rebuild it when the limit changes
  useEffect(() => {
    const imagery = imageryRef.current;
    const old = overlayLayers.current.nogo;
    const fine = terrainRef.current?.fine;
    if (!imagery || !old || !fine) return;
    let cancelled = false;
    void noGoOverlay(fine, maxSlopeDeg).then((provider) => {
      if (cancelled || overlayLayers.current.nogo !== old || imagery.isDestroyed()) return;
      const index = imagery.indexOf(old);
      const fresh = new ImageryLayer(provider, { alpha: 0.85 });
      imagery.remove(old, true);
      imagery.add(fresh, index >= 0 ? index : undefined);
      overlayLayers.current.nogo = fresh;
    });
    return () => {
      cancelled = true;
    };
  }, [maxSlopeDeg]);

  // ---------- Curiosity traverse (file prepared by developer C) ----------
  useEffect(() => {
    const ds = sources.current.tracks;
    if (!ds) return;
    let cancelled = false;
    ds.show = layers.traverse;
    if (ds.entities.values.length) return;
    fetch(traverseUrl)
      .then((r) => r.json() as Promise<TraverseCollection>)
      .then((fc) => {
        if (cancelled) return;
        const color = Color.fromCssColorString('#ff7b39');
        for (const chain of traverseChains(fc)) {
          ds.entities.add({ polyline: { positions: chain.map((p) => lonLatToCartesian(p)), clampToGround: true, width: 3, material: color } });
        }
      })
      .catch(() => setNotice('Curiosity traverse file could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [layers.traverse, viewerReady]);

  // ---------- route problems: say it on the map too ----------
  useEffect(() => {
    if (routeState === 'error') setNotice('Route planning failed. Try again.');
    else if (route && route.status !== 'ok')
      setNotice(route.reason ?? (route.status === 'out_of_bounds' ? 'A point is outside the working area.' : 'No passable route.'));
  }, [route, routeState]);

  // ---------- flyover ----------
  const toggleFlyover = useCallback(() => {
    const viewer = viewerRef.current;
    if (stopFlyRef.current) {
      stopFlyRef.current();
      return;
    }
    const coords = useAppStore.getState().route?.path?.coordinates;
    if (!viewer || !coords || coords.length < 2) return;
    setFlying(true);
    const t = terrainRef.current;
    stopFlyRef.current = startFlyover(viewer, coords, {
      heightAt: t ? (lon, lat) => t.heightAt(toCesiumLon(lon), lat) : undefined,
      onEnd: () => {
        stopFlyRef.current = null;
        setFlying(false);
      },
    });
  }, []);

  useEffect(() => {
    if (stopFlyRef.current && route?.status !== 'ok') stopFlyRef.current();
  }, [route]);

  // ---------- deep links for demos: ?demo=<n>  or  ?start=lon,lat&goal=lon,lat ; add &flyover=1 ----------
  const deepLinkDone = useRef(false);
  const flyWhenReady = useRef(false);
  useEffect(() => {
    if (!viewerReady || !health || deepLinkDone.current) return;
    const q = new URLSearchParams(window.location.search);
    const parse = (v: string | null): LonLat | null => {
      const n = v?.split(',').map(Number);
      return n && n.length === 2 && n.every(Number.isFinite) ? [n[0], n[1]] : null;
    };
    const demo = q.get('demo');
    const fromParams = parse(q.get('start')) && parse(q.get('goal'))
      ? Promise.resolve({ start: parse(q.get('start')) as LonLat, goal: parse(q.get('goal')) as LonLat })
      : demo !== null
        ? offlineDemoPairs().then((pairs) => pairs[Number(demo)] ?? null)
        : null;
    if (!fromParams) return;
    deepLinkDone.current = true;
    flyWhenReady.current = q.get('flyover') === '1';
    void fromParams.then((pair) => {
      if (!pair) {
        setNotice(`Unknown demo route "${demo}".`);
        return;
      }
      const st = useAppStore.getState();
      if ('max_slope_deg' in pair && typeof pair.max_slope_deg === 'number')
        st.showDemo({ ...pair, max_slope_deg: pair.max_slope_deg });
      else {
        st.placePoint(pair.start);
        st.placePoint(pair.goal);
      }
    });
  }, [viewerReady, health]);

  useEffect(() => {
    if (!flyWhenReady.current || routeState !== 'ready' || route?.status !== 'ok') return;
    flyWhenReady.current = false;
    const t = setTimeout(() => toggleFlyover(), 2200);
    return () => clearTimeout(t);
  }, [route, routeState, toggleFlyover]);

  // keep the camera unlocked if the component re-renders mid-flight after a mode switch
  useEffect(() => () => viewerRef.current?.camera.lookAtTransform(Matrix4.IDENTITY), []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0 touch-none" />
      <MapHud
        mode={mode}
        ionAvailable={Boolean(ION_TOKEN)}
        onModeChange={setMode}
        terrainNote={terrainNote}
        elevRange={elevRange}
        notice={notice}
        onDismissNotice={() => setNotice(null)}
        flying={flying}
        onFlyover={toggleFlyover}
        onHome={() => flyHome()}
        canFly={route?.status === 'ok' && !!route.path}
        routeLoading={routeState === 'loading'}
        hasRoute={route?.status === 'ok' && layers.route}
        tilesPending={tilesPending}
      />
    </div>
  );
}
