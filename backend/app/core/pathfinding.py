"""Least-cost path search on a grid."""

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
