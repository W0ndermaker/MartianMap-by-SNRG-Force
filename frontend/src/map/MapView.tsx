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
  GeoJsonDataSource,
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
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer,
  defined,
  type Entity,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import type { LonLat, LonLatElev } from '../api/types';
import { loadFallback, type FallbackRoute } from '../api/client';
import { useAppStore, type LayerId } from '../store/appStore';
import { elevationOverlay, slopeOverlay } from './demOverlays';
import { startFlyover } from './flyover';
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
import { bandRuns, cumulative, pointAtDistance, type SlopeBand } from './routeGeometry';
import { createLocalTerrain, type LocalTerrain } from './terrain';
import { useBackendBootstrap, useRoutePlanner } from './useBackendData';

/** Cesium ion asset id of "Cesium Mars" (secondary source: Cesium Sandcastle "Mars" example; verify in your ion account). */
const CESIUM_MARS_ASSET_ID = 3644333;
const ION_TOKEN = (import.meta.env.VITE_CESIUM_ION_TOKEN ?? '').trim();

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
    font: '600 13px system-ui, -apple-system, Segoe UI, sans-serif',
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

export default function MapView() {
  useBackendBootstrap();
  useRoutePlanner();

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const terrainRef = useRef<LocalTerrain | null>(null);
  const sources = useRef<Record<string, CustomDataSource>>({});
  const overlayLayers = useRef<Partial<Record<LayerId, ImageryLayer>>>({});
  const imageryRef = useRef<ImageryLayerCollection | null>(null);
  const curiosityRef = useRef<GeoJsonDataSource | null>(null);
  const stopFlyRef = useRef<(() => void) | null>(null);

  const [mode, setMode] = useState<TerrainMode>('local');
  const [viewerReady, setViewerReady] = useState(0);
  const [terrainNote, setTerrainNote] = useState<string | null>(null);
  const [elevRange, setElevRange] = useState<[number, number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);
  const [fallbackRoutes, setFallbackRoutes] = useState<FallbackRoute[]>([]);

  const health = useAppStore((s) => s.health);
  const backendOnline = useAppStore((s) => s.backendOnline);
  const poi = useAppStore((s) => s.poi);
  const start = useAppStore((s) => s.start);
  const goal = useAppStore((s) => s.goal);
  const route = useAppStore((s) => s.route);
  const routePhase = useAppStore((s) => s.routePhase);
  const maxSlopeDeg = useAppStore((s) => s.maxSlopeDeg);
  const layers = useAppStore((s) => s.layers);
  const selectedPoiId = useAppStore((s) => s.selectedPoiId);
  const profileHoverIndex = useAppStore((s) => s.profileHoverIndex);

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

    for (const name of ['bounds', 'tracks', 'route', 'hazards', 'poi', 'points', 'highlight']) {
      const ds = new CustomDataSource(name);
      sources.current[name] = ds;
      void viewer.dataSources.add(ds);
    }

    // Base imagery, coarse to fine: MOLA shade (global) -> CTX -> HiRISE.
    const addBase = (target: ImageryLayerCollection) => {
      for (const l of [TREK_LAYERS.molaShade, TREK_LAYERS.ctx, TREK_LAYERS.hirise]) {
        target.add(new ImageryLayer(trekProvider(l)));
      }
    };
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
      container.removeEventListener('gesturestart', onGestureStart, opts);
      container.removeEventListener('gesturechange', onGestureChange, opts);
      container.removeEventListener('gestureend', onGestureStart, opts);
      container.removeEventListener('wheel', onWheel, opts);
      stopFlyRef.current?.();
      stopFlyRef.current = null;
      overlayLayers.current = {};
      imageryRef.current = null;
      curiosityRef.current = null;
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
      if (!st.start || (st.start && st.goal)) {
        if (st.goal) st.resetPoints();
        st.setStart(p);
      } else {
        st.setGoal(p);
      }
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
  }, [poi, selectedPoiId, viewerReady]);

  // ---------- route line coloured by slope ----------
  useEffect(() => {
    const ds = sources.current.route;
    const hz = sources.current.hazards;
    if (!ds || !hz) return;
    ds.entities.removeAll();
    hz.entities.removeAll();
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
          font: '600 12px system-ui, sans-serif',
          distanceDisplayCondition: new DistanceDisplayCondition(0, 2500),
        },
      });
    }

    // frame the new route (skip while a flyover owns the camera)
    const viewer = viewerRef.current;
    if (viewer && !stopFlyRef.current) {
      const sphere = BoundingSphere.fromPoints(
        coords.map((c) => lonLatToCartesian(c, terrainRef.current?.heightAt(toCesiumLon(c[0]), c[1]) ?? c[2])),
      );
      const r = Math.max(250, sphere.radius);
      viewer.camera.flyToBoundingSphere(sphere, {
        offset: new HeadingPitchRange(viewer.camera.heading, CMath.toRadians(-42), r * 2.8),
        duration: 1.4,
      });
    }
  }, [route, maxSlopeDeg, viewerReady]);

  // ---------- profile hover highlight ----------
  const routeCum = useMemo(() => {
    const c = route?.path?.coordinates;
    return c && c.length > 1 ? cumulative(c) : null;
  }, [route]);

  useEffect(() => {
    const ds = sources.current.highlight;
    if (!ds) return;
    ds.entities.removeAll();
    const coords = route?.path?.coordinates;
    const prof = route?.profile;
    if (profileHoverIndex == null || !coords || !prof || !routeCum || !prof[profileHoverIndex]) return;
    const p: LonLatElev = pointAtDistance(coords, routeCum, prof[profileHoverIndex].dist_m);
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
      label: labelGraphics(`${Math.round(prof[profileHoverIndex].dist_m)} m · ${prof[profileHoverIndex].slope_deg.toFixed(1)}°`, -22),
    });
  }, [profileHoverIndex, route, routeCum, viewerReady]);

  // ---------- switchable layers ----------
  useEffect(() => {
    const viewer = viewerRef.current;
    const imagery = imageryRef.current;
    if (!viewer || !imagery) return;
    let cancelled = false;
    const fine = terrainRef.current?.fine ?? null;
    const want = (id: LayerId) => layers[id];
    const ensure = async (id: Exclude<LayerId, 'curiosity'>) => {
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
      else if (id === 'geology') provider = trekProvider(TREK_LAYERS.geology);
      else if (!fine) {
        setNotice('Elevation and slope layers need the local HiRISE terrain, which is not loaded.');
        return;
      } else provider = id === 'elevation' ? await elevationOverlay(fine) : await slopeOverlay(fine);
      if (cancelled || overlayLayers.current[id] || viewer.isDestroyed()) return;
      const layer = new ImageryLayer(provider, { alpha: id === 'geology' ? 0.55 : 0.7 });
      imagery.add(layer);
      overlayLayers.current[id] = layer;
    };
    void Promise.all((['elevation', 'slope', 'thermal', 'geology'] as const).map(ensure));

    // Curiosity traverse (vector, clamped to the ground)
    (async () => {
      if (want('curiosity')) {
        if (curiosityRef.current) {
          curiosityRef.current.show = true;
          return;
        }
        try {
          const ds = await GeoJsonDataSource.load(`${import.meta.env.BASE_URL}data/gale_traverse.geojson`, {
            clampToGround: true,
            stroke: Color.fromCssColorString('#ff7b39'),
            strokeWidth: 3,
          });
          if (cancelled || viewer.isDestroyed()) return;
          await viewer.dataSources.add(ds);
          curiosityRef.current = ds;
        } catch {
          setNotice('Curiosity traverse file could not be loaded.');
        }
      } else if (curiosityRef.current) {
        curiosityRef.current.show = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [layers, viewerReady]);

  // ---------- fallback routes list (offline mode) ----------
  useEffect(() => {
    if (backendOnline === false) void loadFallback().then((f) => setFallbackRoutes(f?.routes ?? []));
  }, [backendOnline]);

  const pickFallback = useCallback((r: FallbackRoute) => {
    const st = useAppStore.getState();
    st.setRoute('ok', r.response, 'Route service is offline. Showing a precomputed route.', 'fallback', r.name);
    st.setStart(r.start);
    st.setGoal(r.goal);
  }, []);

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
    if (routePhase !== 'ok' && stopFlyRef.current) stopFlyRef.current();
  }, [routePhase]);

  // ---------- deep link for demos: ?route=<precomputed id>[&flyover=1] ----------
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (!viewerReady || !health || deepLinkDone.current) return;
    const q = new URLSearchParams(window.location.search);
    const id = q.get('route');
    if (!id) return;
    deepLinkDone.current = true;
    void loadFallback().then((f) => {
      const r = f?.routes.find((x) => x.id === id);
      if (!r) {
        setNotice(`Unknown precomputed route "${id}".`);
        return;
      }
      const st = useAppStore.getState();
      st.setRoute('ok', r.response, null, 'fallback', r.name);
      st.setStart(r.start);
      st.setGoal(r.goal);
      if (q.get('flyover') === '1') setTimeout(() => toggleFlyover(), 2500);
    });
  }, [viewerReady, health, toggleFlyover]);

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
        fallbackRoutes={fallbackRoutes}
        onPickFallback={pickFallback}
      />
    </div>
  );
}
