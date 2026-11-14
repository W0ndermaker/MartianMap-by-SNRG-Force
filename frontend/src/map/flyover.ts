// "Flyover": the camera follows the route from start to goal (for the demo video).

import { HeadingPitchRange, Math as CMath, Matrix4, type Cartesian3, type Viewer } from 'cesium';
import { lonLatToCartesian } from './mars';
import { bearing, cumulative, pointAtDistance, type LonLatElev } from './routeGeometry';

export interface FlyoverOptions {
  /** Total duration in seconds; default keeps the clip inside a 30 s demo video. */
  durationS?: number;
  rangeM?: number;
  pitchDeg?: number;
  heightAt?: (lon: number, lat: number) => number | null;
  onEnd?: () => void;
}

/** Starts the flyover; returns a function that stops it. */
export function startFlyover(viewer: Viewer, path: LonLatElev[], opts: FlyoverOptions = {}): () => void {
  const cum = cumulative(path);
  const total = cum[cum.length - 1];
  const durationMs = (opts.durationS ?? 20) * 1000;
  const range = opts.rangeM ?? Math.min(900, Math.max(250, total / 6));
  const pitch = CMath.toRadians(opts.pitchDeg ?? -28);
  const lookAhead = Math.max(30, total / 40);
  let heading = bearing([path[0][0], path[0][1]], [path[1][0], path[1][1]]);
  let raf = 0;
  let stopped = false;
  const t0 = performance.now();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    opts.onEnd?.();
  };

  const frame = (now: number) => {
    if (stopped) return;
    const u = Math.min(1, (now - t0) / durationMs);
    const eased = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    const d = eased * total;
    const p = pointAtDistance(path, cum, d);
    const q = pointAtDistance(path, cum, Math.min(total, d + lookAhead));
    if (d + 1 < total) {
      const target = bearing([p[0], p[1]], [q[0], q[1]]);
      let delta = target - heading;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      heading += delta * 0.08; // smooth turns
    }
    const ground = opts.heightAt?.(p[0], p[1]) ?? p[2];
    const center: Cartesian3 = lonLatToCartesian(p, ground + 2);
    viewer.camera.lookAt(center, new HeadingPitchRange(heading, pitch, range));
    if (u >= 1) stop();
    else raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}
