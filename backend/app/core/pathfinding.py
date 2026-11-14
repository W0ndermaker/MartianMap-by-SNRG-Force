"""Least-cost path search on a grid."""

import itertools

import numpy as np
from skimage.graph import route_through_array


def find_path(
    cost: np.ndarray, start: tuple[int, int], goal: tuple[int, int]
) -> list[tuple[int, int]] | None:
    """Return the least-cost 8-connected path of (row, col) cells, or None if unreachable.

    Args:
        cost: cost per cell (seconds per meter); inf or NaN cells are impassable.
        start: (row, col) of the start cell.
        goal: (row, col) of the goal cell.
    """
    safe = np.where(np.isfinite(cost), cost, np.inf)
    try:
        path, _ = route_through_array(safe, start, goal, fully_connected=True, geometric=True)
    except ValueError:
        return None
    return [(int(r), int(c)) for r, c in path]


# Sampling step along straight segments, in cells. Small enough that a segment cannot cross a
# cell corner without a sample landing in that cell often; checked samples are reused by densify.
LINE_STEP = 0.1


def _line_samples(a: np.ndarray, b: np.ndarray, step: float = LINE_STEP) -> np.ndarray:
    """Points from a to b (row, col floats) spaced at most ``step`` cells, both ends included."""
    n = max(int(np.ceil(np.hypot(*(b - a)) / step)), 1)
    t = np.linspace(0.0, 1.0, n + 1)[:, None]
    return a + (b - a) * t


def smooth_path(
    path: list[tuple[int, int]], cost: np.ndarray, cell_size_m: float, max_misses: int = 12
) -> list[tuple[float, float]]:
    """Any-angle post-processing of an 8-connected grid path ("string pulling").

    A run of grid steps is replaced by a straight segment only when every cell the segment
    crosses is passable and the segment's travel cost is not higher than the cost of the grid
    steps it replaces, so smoothing never cuts through steep terrain or makes the route slower.
    Returns the kept vertices as (row, col) cell-centre coordinates.
    """
    if len(path) < 3:
        return [(float(r), float(c)) for r, c in path]
    rc = np.asarray(path, dtype=float)
    # Travel cost of the grid path, same discretisation as route_through_array(geometric=True).
    cell_cost = cost[rc[:, 0].astype(int), rc[:, 1].astype(int)]
    step_len = np.hypot(*np.diff(rc, axis=0).T) * cell_size_m
    prefix = np.concatenate(([0.0], np.cumsum(step_len * (cell_cost[:-1] + cell_cost[1:]) / 2)))

    rows, cols = cost.shape

    def segment_ok(i: int, j: int) -> bool:
        pts = _line_samples(rc[i], rc[j])
        cells = np.rint(pts).astype(int)
        if (cells < 0).any() or (cells[:, 0] >= rows).any() or (cells[:, 1] >= cols).any():
            return False
        c = cost[cells[:, 0], cells[:, 1]]
        if not np.isfinite(c).all():
            return False
        seg = np.hypot(*np.diff(pts, axis=0).T) * cell_size_m
        line_cost = float((seg * (c[:-1] + c[1:]) / 2).sum())
        return line_cost <= (prefix[j] - prefix[i]) * (1 + 1e-9)

    kept = [0]
    i = 0
    n = len(path)
    while i < n - 1:
        best = i + 1
        misses = 0
        for j in range(i + 2, n):
            if segment_ok(i, j):
                best = j
                misses = 0
            else:
                misses += 1
                if misses > max_misses:
                    break
        kept.append(best)
        i = best
    return [(float(rc[k, 0]), float(rc[k, 1])) for k in kept]


def densify(vertices: list[tuple[float, float]], step: float = 1.0) -> np.ndarray:
    """Sample a polyline of (row, col) vertices about every ``step`` cells (vertices kept).

    Samples are taken from the same fine sampling that smooth_path checks for passability, so
    every sampled cell has been verified. Shape (N, 2).
    """
    v = np.asarray(vertices, dtype=float)
    if len(v) == 1:
        return v
    k = max(round(step / LINE_STEP), 1)
    parts = []
    for a, b in itertools.pairwise(v):
        fine = _line_samples(a, b)
        parts.append(fine[:-1][::k])
    return np.vstack([*parts, v[-1:]])
