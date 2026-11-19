from __future__ import annotations

import math

from app.domain.world.constants import CELL_SIZE

SPREAD_RADIUS = 1.6


class SpawnSpread:
    def __init__(self, cells: list[int], width: int, height: int) -> None:
        self._cells = cells
        self._width = width
        self._height = height

    def positions(self, cx: float, cz: float, count: int) -> list[tuple[float, float]]:
        if count <= 1:
            return [(cx, cz)] * max(count, 0)
        out: list[tuple[float, float]] = []
        for i in range(count):
            angle = 2 * math.pi * i / count
            x = cx + math.cos(angle) * SPREAD_RADIUS
            z = cz + math.sin(angle) * SPREAD_RADIUS
            out.append((x, z) if self._walkable(x, z) else (cx, cz))
        return out

    def _walkable(self, x: float, z: float) -> bool:
        gx = int(x / CELL_SIZE)
        gz = int(z / CELL_SIZE)
        if not (0 <= gx < self._width and 0 <= gz < self._height):
            return False
        return self._cells[gz * self._width + gx] == 1
