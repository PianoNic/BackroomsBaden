from __future__ import annotations

import random
from dataclasses import dataclass, field

from app.domain.world.constants import CELL_SIZE
from app.domain.world.layout._types import (
    ATRIUM_SIZE,
    Direction,
    Layout,
    Rect,
    Room,
    set_grid,
)

LANE_W = 2
BLOCK_MIN = 6
EDGE_BLOCK_MAX = 10
DOUBLE_MIN = 11
BLOCK_MAX = 17
ROOM_DEPTH_MAX = 7
ROOM_W_MIN = 4
SEGMENT_MIN = 12
SEGMENT_MAX = 30
FLANK_PIECE_MIN = 6
BIG_ROOM_CHANCE = 0.1
ROOMS_PER_AREA = 150
MEAN_WIDTH_START = {40: 14}
MEAN_WIDTH_DEFAULT = 10
MEAN_WIDTH_STEP = 2
MEAN_WIDTH_LIMIT = 40

SMALL_ARCHETYPES = (
    ("classroom", 6),
    ("teacher_room", 3),
    ("toilet", 2),
    ("janitor_room", 1),
    ("server_room", 1),
    ("chemistry_lab", 2),
)
MID_ARCHETYPES = (
    ("classroom", 6),
    ("teacher_room", 3),
    ("chemistry_lab", 2),
)
BIG_ARCHETYPES = (
    ("classroom", 6),
    ("chemistry_lab", 2),
    ("gym", 3),
    ("cafeteria", 3),
)
UNIQUE_ARCHETYPES = ("gym", "cafeteria")


@dataclass
class Band:
    y0: int
    y1: int
    top_lane: bool
    bottom_lane: bool
    flank: str | None = None
    rungs: list[int] = field(default_factory=list)


@dataclass
class Slot:
    rect: Rect
    front_dir: Direction
    door_x: int
    door_y: int


class AxisPlanner:
    def __init__(self, rng: random.Random) -> None:
        self._rng = rng
        self._memo: dict[int, bool] = {}

    def feasible(self, rem: int) -> bool:
        cached = self._memo.get(rem)
        if cached is not None:
            return cached
        ok = BLOCK_MIN <= rem <= EDGE_BLOCK_MAX
        if not ok:
            for h in range(BLOCK_MIN, BLOCK_MAX + 1):
                r = rem - h
                if r == LANE_W + 1 or (r >= LANE_W + BLOCK_MIN and self.feasible(r - LANE_W)):
                    ok = True
                    break
        self._memo[rem] = ok
        return ok

    def plan(self, rem: int) -> list[tuple[int, bool]]:
        out: list[tuple[int, bool]] = []
        while True:
            options: list[tuple[str, int, int]] = []
            if BLOCK_MIN <= rem <= EDGE_BLOCK_MAX:
                options.append(("edge", rem, 4))
            for h in range(BLOCK_MIN, BLOCK_MAX + 1):
                r = rem - h
                weight = 4 if h >= DOUBLE_MIN else 1
                if r == LANE_W + 1:
                    options.append(("perimeter", h, weight))
                elif r >= LANE_W + BLOCK_MIN and self.feasible(r - LANE_W):
                    options.append(("lane", h, weight))
            if not options:
                return out
            kind, h, _ = self._rng.choices(options, weights=[o[2] for o in options])[0]
            if kind == "edge":
                out.append((h, False))
                return out
            out.append((h, True))
            if kind == "perimeter":
                return out
            rem -= h + LANE_W


class RungPlanner:
    def __init__(self, rng: random.Random, left: int, right: int, spine: int) -> None:
        self._rng = rng
        self._fixed = [left, spine, right]

    def plan(self, previous: list[int]) -> list[int]:
        left, spine, right = self._fixed
        xs = [left]
        xs += self._split(left + LANE_W, spine)
        xs.append(spine)
        xs += self._split(spine + LANE_W, right)
        xs.append(right)
        self._snap(xs, previous)
        return xs

    def _split(self, start: int, end: int) -> list[int]:
        total = end - start
        ks = [
            k for k in range(0, total // SEGMENT_MIN)
            if (k + 1) * SEGMENT_MIN <= total - LANE_W * k <= (k + 1) * SEGMENT_MAX
        ]
        k = self._rng.choice(ks) if ks else 0
        if k == 0:
            return []
        free = total - LANE_W * k - (k + 1) * SEGMENT_MIN
        cuts = sorted(self._rng.randint(0, free) for _ in range(k))
        out: list[int] = []
        prev_cut = 0
        pos = start
        for i, cut in enumerate(cuts):
            pos += SEGMENT_MIN + (cut - prev_cut)
            out.append(pos)
            pos += LANE_W
            prev_cut = cut
        return out

    def _snap(self, xs: list[int], previous: list[int]) -> None:
        fixed = set(self._fixed)
        for i in range(1, len(xs) - 1):
            if xs[i] in fixed:
                continue
            for px in previous:
                if px in fixed or abs(px - xs[i]) > 4 or px == xs[i]:
                    continue
                if px - (xs[i - 1] + LANE_W) >= SEGMENT_MIN and xs[i + 1] - (px + LANE_W) >= SEGMENT_MIN:
                    if self._rng.random() < 0.6:
                        xs[i] = px
                    break


class RoomFiller:
    def __init__(self, rng: random.Random, mean_width: int) -> None:
        self._rng = rng
        self._mean = mean_width

    def fill(self, band: Band, s0: int, s1: int) -> list[Slot]:
        zone_x0, zone_w = s0 + 1, s1 - s0 - 2
        zone_h = band.y1 - band.y0 - 2
        if zone_w < ROOM_W_MIN or zone_h < BLOCK_MIN - 2:
            return []
        rows = self._rows(band, zone_h)
        slots: list[Slot] = []
        for y, depth, side in rows:
            for x, w in self._partition(zone_x0, zone_w):
                rect = Rect(x, y, w, depth)
                dx = x + (w - 1 + self._rng.randint(0, 1)) // 2 if w % 2 == 0 else x + w // 2
                dy = y - 1 if side == "N" else y + depth
                slots.append(Slot(rect, side, dx, dy))
        return slots

    def _rows(self, band: Band, zone_h: int) -> list[tuple[int, int, Direction]]:
        y = band.y0 + 1
        if band.top_lane and band.bottom_lane:
            if zone_h >= 2 * ROOM_W_MIN + 1:
                if self._rng.random() < BIG_ROOM_CHANCE and zone_h <= 13:
                    return [(y, zone_h, self._rng.choice(("N", "S")))]
                lo = max(ROOM_W_MIN, zone_h - 1 - ROOM_DEPTH_MAX)
                hi = min(ROOM_DEPTH_MAX, zone_h - 1 - ROOM_W_MIN)
                d1 = self._rng.randint(lo, hi)
                d2 = zone_h - 1 - d1
                return [(y, d1, "N"), (y + d1 + 1, d2, "S")]
            return [(y, zone_h, self._rng.choice(("N", "S")))]
        if band.top_lane:
            return [(y, zone_h, "N")]
        if band.bottom_lane:
            return [(y, zone_h, "S")]
        return []

    def _partition(self, x0: int, zone_w: int) -> list[tuple[int, int]]:
        n = max(1, round((zone_w + 1) / (self._mean + 1)))
        while n > 1 and (zone_w - (n - 1)) / n < ROOM_W_MIN + 1:
            n -= 1
        room_cells = zone_w - (n - 1)
        extra = room_cells - ROOM_W_MIN * n
        weights = [self._rng.uniform(0.7, 1.3) for _ in range(n)]
        total = sum(weights)
        widths = [ROOM_W_MIN + int(extra * wgt / total) for wgt in weights]
        left = room_cells - sum(widths)
        for i in range(left):
            widths[self._rng.randrange(n)] += 1
        out: list[tuple[int, int]] = []
        x = x0
        for w in widths:
            out.append((x, w))
            x += w + 1
        return out


class ArchetypePicker:
    def __init__(self, rng: random.Random) -> None:
        self._rng = rng
        self._used: set[str] = set()

    def assign(self, rooms: list[Room]) -> None:
        for room in rooms:
            room.archetype = self._pick(room.rect)

    def _pick(self, rect: Rect) -> str:
        area = rect.w * rect.h
        if rect.w >= 10 and rect.h >= 6:
            table = BIG_ARCHETYPES
        elif area > 60:
            table = MID_ARCHETYPES
        else:
            table = SMALL_ARCHETYPES
        options = [(k, w) for k, w in table if k not in self._used]
        kind = self._rng.choices([o[0] for o in options], weights=[o[1] for o in options])[0]
        if kind in UNIQUE_ARCHETYPES:
            self._used.add(kind)
        return kind


class SchoolLayoutBuilder:
    def __init__(self, rng: random.Random, width: int, height: int) -> None:
        self._rng = rng
        self._w = width
        self._h = height
        self._ax = (width - ATRIUM_SIZE) // 2
        self._ay = (height - ATRIUM_SIZE) // 2
        self._cx = self._ax + ATRIUM_SIZE // 2
        self._cy = self._ay + ATRIUM_SIZE // 2
        self._left = 1
        self._right = width - 3
        self._lane_x1 = width - 1

    def build(self) -> Layout:
        layout = Layout(width=self._w, height=self._h)
        atrium = Rect(self._ax, self._ay, ATRIUM_SIZE, ATRIUM_SIZE)
        layout.atrium = atrium
        bands, lanes = self._plan_axis()
        self._plan_rungs(bands)
        hallways = [atrium] + self._spine_lane_parts() + lanes + self._rung_rects(bands)
        layout.hallways = hallways
        cells = [0] * (self._w * self._h)
        for rect in hallways:
            self._paint(cells, rect)
        slots_by_mean = self._fill_within_budget(bands)
        rooms = self._make_rooms(slots_by_mean)
        ArchetypePicker(self._rng).assign(rooms)
        for room in rooms:
            self._paint(cells, room.rect)
            cells[int(room.door_z // CELL_SIZE) * self._w + int(room.door_x // CELL_SIZE)] = 1
            layout.doors.append((room.door_x, room.door_z))
        layout.rooms = rooms
        layout.cells = cells
        return layout

    def _paint(self, cells: list[int], r: Rect) -> None:
        for y in range(r.y, r.y + r.h):
            row = y * self._w
            for x in range(r.x, r.x + r.w):
                cells[row + x] = 1

    def _plan_axis(self) -> tuple[list[Band], list[Rect]]:
        planner = AxisPlanner(self._rng)
        spine_top = self._cy - 1
        spine_end = self._cy + 1
        up = planner.plan(spine_top)
        down = planner.plan(self._h - spine_end)
        lane_len = self._lane_x1 - self._left
        bands: list[Band] = []
        lanes: list[Rect] = []
        pos = spine_top
        up_bands: list[Band] = []
        for i, (h, far_lane) in enumerate(up):
            band = Band(pos - h, pos, far_lane, True, "above" if i == 0 else None)
            up_bands.append(band)
            pos -= h
            if far_lane:
                lanes.append(Rect(self._left, pos - LANE_W, lane_len, LANE_W))
                pos -= LANE_W
        bands.extend(reversed(up_bands))
        pos = spine_end
        for i, (h, far_lane) in enumerate(down):
            bands.append(Band(pos, pos + h, True, far_lane, "below" if i == 0 else None))
            pos += h
            if far_lane:
                lanes.append(Rect(self._left, pos, lane_len, LANE_W))
                pos += LANE_W
        return bands, lanes

    def _spine_lane_parts(self) -> list[Rect]:
        y = self._cy - 1
        left_w = self._ax - self._left
        right_x = self._ax + ATRIUM_SIZE
        return [
            Rect(self._left, y, left_w, LANE_W),
            Rect(right_x, y, self._lane_x1 - right_x, LANE_W),
        ]

    def _plan_rungs(self, bands: list[Band]) -> None:
        planner = RungPlanner(self._rng, self._left, self._right, self._cx - 1)
        previous: list[int] = []
        for band in bands:
            if band.top_lane and band.bottom_lane:
                band.rungs = planner.plan(previous)
                previous = band.rungs
            else:
                previous = []

    def _rung_rects(self, bands: list[Band]) -> list[Rect]:
        out: list[Rect] = []
        spine = self._cx - 1
        for band in bands:
            for x in band.rungs:
                y0, y1 = band.y0, band.y1
                if x == spine and band.flank == "above":
                    y1 = self._ay
                elif x == spine and band.flank == "below":
                    y0 = self._ay + ATRIUM_SIZE
                out.append(Rect(x, y0, LANE_W, y1 - y0))
        return out

    def _segments(self, band: Band) -> list[tuple[int, int]]:
        if not band.rungs:
            return [(0, self._w)]
        segs = [
            (a + LANE_W, b) for a, b in zip(band.rungs, band.rungs[1:])
        ]
        if band.flank is None:
            return segs
        out: list[tuple[int, int]] = []
        flank0, flank1 = self._ax - 1, self._ax + ATRIUM_SIZE + 1
        for s0, s1 in segs:
            if s1 <= flank0 or s0 >= flank1:
                out.append((s0, s1))
                continue
            if self._ax - s0 >= FLANK_PIECE_MIN:
                out.append((s0, self._ax))
            if s1 - (self._ax + ATRIUM_SIZE) >= FLANK_PIECE_MIN:
                out.append((self._ax + ATRIUM_SIZE, s1))
        return out

    def _fill_within_budget(self, bands: list[Band]) -> list[Slot]:
        cap = self._w * self._h // ROOMS_PER_AREA
        mean = MEAN_WIDTH_START.get(self._w, MEAN_WIDTH_DEFAULT)
        slots: list[Slot] = []
        while True:
            filler = RoomFiller(self._rng, mean)
            slots = []
            for band in bands:
                for s0, s1 in self._segments(band):
                    slots.extend(filler.fill(band, s0, s1))
            if len(slots) <= cap or mean >= MEAN_WIDTH_LIMIT:
                return slots
            mean += MEAN_WIDTH_STEP

    def _make_rooms(self, slots: list[Slot]) -> list[Room]:
        rooms: list[Room] = []
        for s in slots:
            r = s.rect
            room = Room(rect=r, archetype="classroom", front_dir=s.front_dir)
            room.door_x = (s.door_x + 0.5) * CELL_SIZE
            room.door_z = (s.door_y + 0.5) * CELL_SIZE
            if s.front_dir in ("N", "S"):
                room.door_w = ((s.door_x + 0.5) - (r.x + r.w / 2)) * CELL_SIZE
            else:
                room.door_w = ((s.door_y + 0.5) - (r.y + r.h / 2)) * CELL_SIZE
            rooms.append(room)
        return rooms


def build_layout(rng: random.Random, width: int = 120, height: int = 120) -> Layout:
    set_grid(width, height)
    return SchoolLayoutBuilder(rng, width, height).build()
