"""Grid helpers shared by the worldgen tests."""
from __future__ import annotations

from collections import deque

from app.domain.world.constants import CELL_SIZE

WALKABLE = 1


def cell_of(x: float, z: float) -> tuple[int, int]:
    """World coordinates -> cell coordinates, the same way the services do."""
    return int(x / CELL_SIZE), int(z / CELL_SIZE)


def is_walkable(cells: list[int], width: int, height: int, cx: int, cz: int) -> bool:
    if not (0 <= cx < width and 0 <= cz < height):
        return False
    return cells[cz * width + cx] == WALKABLE


def reachable_from(
    cells: list[int], width: int, height: int, start: tuple[int, int],
) -> set[tuple[int, int]]:
    """Flood fill of walkable cells, 4-connected — matching `pathfind`."""
    sx, sz = start
    if not is_walkable(cells, width, height, sx, sz):
        return set()
    seen = {(sx, sz)}
    queue = deque([(sx, sz)])
    while queue:
        cx, cz = queue.popleft()
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = (cx + dx, cz + dz)
            if nxt in seen or not is_walkable(cells, width, height, *nxt):
                continue
            seen.add(nxt)
            queue.append(nxt)
    return seen


def nearest_walkable(
    cells: list[int], width: int, height: int, cx: int, cz: int, radius: int = 3,
) -> tuple[int, int] | None:
    """Closest walkable cell to (cx, cz) within `radius`.

    Props and their interact spots are placed *against* walls, so a spot's own
    cell is often solid — what matters for reachability is that a player can
    stand next to it.
    """
    if is_walkable(cells, width, height, cx, cz):
        return cx, cz
    best: tuple[int, int] | None = None
    best_d = None
    for dz in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            nx, nz = cx + dx, cz + dz
            if not is_walkable(cells, width, height, nx, nz):
                continue
            d = dx * dx + dz * dz
            if best_d is None or d < best_d:
                best_d, best = d, (nx, nz)
    return best


class LayoutProbe:
    NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1))

    def __init__(self, layout) -> None:
        self.layout = layout
        self.w = layout.width
        self.h = layout.height
        self.cells = layout.cells
        self.room_of: dict[tuple[int, int], int] = {}
        for i, room in enumerate(layout.rooms):
            r = room.rect
            for y in range(r.y, r.y + r.h):
                for x in range(r.x, r.x + r.w):
                    self.room_of[(x, y)] = i
        self.door_cells = {
            i: (int(room.door_x / CELL_SIZE), int(room.door_z / CELL_SIZE))
            for i, room in enumerate(layout.rooms)
        }
        self.door_set = set(self.door_cells.values())
        self.atrium = {
            (x, y)
            for y in range(layout.atrium.y, layout.atrium.y + layout.atrium.h)
            for x in range(layout.atrium.x, layout.atrium.x + layout.atrium.w)
        }
        self.corridor = {
            (x, y)
            for y in range(self.h)
            for x in range(self.w)
            if self.walkable(x, y)
            and (x, y) not in self.room_of
            and (x, y) not in self.door_set
        }

    def walkable(self, x: int, y: int) -> bool:
        return is_walkable(self.cells, self.w, self.h, x, y)

    def spawn_cell(self) -> tuple[int, int]:
        a = self.layout.atrium
        return a.x + a.w // 2, a.y + a.h // 2

    def reachable(self) -> set[tuple[int, int]]:
        return reachable_from(self.cells, self.w, self.h, self.spawn_cell())

    def walkable_count(self) -> int:
        return sum(self.cells)

    def corridor_components(self) -> int:
        seen: set[tuple[int, int]] = set()
        count = 0
        for start in sorted(self.corridor):
            if start in seen:
                continue
            count += 1
            seen.add(start)
            queue = deque([start])
            while queue:
                cx, cy = queue.popleft()
                for dx, dy in self.NEIGHBOURS:
                    nxt = (cx + dx, cy + dy)
                    if nxt in self.corridor and nxt not in seen:
                        seen.add(nxt)
                        queue.append(nxt)
        return count

    def atrium_midpoint_cells(self) -> list[tuple[int, int]]:
        a = self.layout.atrium
        cx, cy = a.x + a.w // 2, a.y + a.h // 2
        return [
            (cx - 1, a.y - 1), (cx, a.y - 1),
            (cx - 1, a.y + a.h), (cx, a.y + a.h),
            (a.x - 1, cy - 1), (a.x - 1, cy),
            (a.x + a.w, cy - 1), (a.x + a.w, cy),
        ]

    def _run(self, x: int, y: int, dx: int, dy: int) -> int:
        n = 1
        cx, cy = x + dx, y + dy
        while (cx, cy) in self.corridor:
            n += 1
            cx, cy = cx + dx, cy + dy
        cx, cy = x - dx, y - dy
        while (cx, cy) in self.corridor:
            n += 1
            cx, cy = cx - dx, cy - dy
        return n

    def narrow_corridor_cells(self) -> list[tuple[int, int]]:
        return [
            p for p in sorted(self.corridor)
            if p not in self.atrium
            and min(self._run(p[0], p[1], 1, 0), self._run(p[0], p[1], 0, 1)) < 2
        ]

    def fat_corridor_windows(self) -> list[tuple[int, int]]:
        free = self.corridor - self.atrium
        out = []
        for x, y in sorted(free):
            if all(
                (x + i, y + j) in free
                for j in range(4) for i in range(4)
            ):
                out.append((x, y))
        return out

    def room_wall_violations(self) -> list[tuple[int, int]]:
        bad = []
        for (x, y), i in sorted(self.room_of.items()):
            for dx, dy in self.NEIGHBOURS:
                q = (x + dx, y + dy)
                if self.room_of.get(q) == i or not self.walkable(*q):
                    continue
                if q == self.door_cells[i]:
                    continue
                bad.append((x, y))
        return bad

    def bad_doors(self) -> list[int]:
        out = []
        for i, room in enumerate(self.layout.rooms):
            dx, dy = self.door_cells[i]
            outward = {"N": (0, -1), "S": (0, 1), "W": (-1, 0), "E": (1, 0)}[room.front_dir]
            inward = (-outward[0], -outward[1])
            if (dx + outward[0], dy + outward[1]) not in self.corridor:
                out.append(i)
            elif self.room_of.get((dx + inward[0], dy + inward[1])) != i:
                out.append(i)
        return out

    def hall_graph(self) -> dict[int, set[int]]:
        halls = self.layout.hallways
        graph: dict[int, set[int]] = {i: set() for i in range(len(halls))}
        for i, a in enumerate(halls):
            for j in range(i + 1, len(halls)):
                if self._touch(a, halls[j]):
                    graph[i].add(j)
                    graph[j].add(i)
        return graph

    @staticmethod
    def _touch(a, b) -> bool:
        x_overlap = min(a.x + a.w, b.x + b.w) - max(a.x, b.x)
        y_overlap = min(a.y + a.h, b.y + b.h) - max(a.y, b.y)
        if x_overlap > 0 and (a.y + a.h == b.y or b.y + b.h == a.y):
            return True
        return y_overlap > 0 and (a.x + a.w == b.x or b.x + b.w == a.x)

    def independent_loops(self) -> int:
        graph = self.hall_graph()
        edges = sum(len(v) for v in graph.values()) // 2
        seen: set[int] = set()
        comps = 0
        for start in graph:
            if start in seen:
                continue
            comps += 1
            stack = [start]
            seen.add(start)
            while stack:
                n = stack.pop()
                for m in sorted(graph[n]):
                    if m not in seen:
                        seen.add(m)
                        stack.append(m)
        return edges - len(graph) + comps

    def stub_lengths(self) -> list[int]:
        halls = self.layout.hallways
        return [
            max(halls[i].w, halls[i].h)
            for i, nbrs in self.hall_graph().items()
            if len(nbrs) <= 1 and halls[i] is not self.layout.atrium
        ]
