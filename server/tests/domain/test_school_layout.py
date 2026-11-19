from __future__ import annotations

import random
import time

import pytest

from app.domain.world.decorate import _hallway_lights
from app.domain.world.constants import CELL_SIZE
from app.domain.world.generator import _LAYOUT_BUILDERS, generate
from app.domain.world.layout_school import build_layout

from .worldgen_helpers import LayoutProbe, cell_of

SEEDS_BY_SIZE = {40: 50, 60: 50, 80: 50, 120: 15}
CASES = [(size, seed) for size, n in SEEDS_BY_SIZE.items() for seed in range(1, n + 1)]
ROOM_BUDGET = {40: 10, 60: 26, 80: 47, 120: 109}
MIN_LOOPS = {40: 3, 60: 6, 80: 12, 120: 24}
MAX_STUBS = 2
MAX_STUB_LENGTH = 6
MIN_ROOMS_40 = 6
LAYOUT_SECONDS_AT_120 = 0.15
GENERATE_SECONDS_AT_120 = 3.0

_CACHE: dict[tuple[int, int], tuple[object, LayoutProbe]] = {}


def probe_for(size: int, seed: int) -> LayoutProbe:
    key = (size, seed)
    if key not in _CACHE:
        layout = build_layout(random.Random(seed), size, size)
        _CACHE[key] = (layout, LayoutProbe(layout))
    return _CACHE[key][1]


def test_school_is_the_default_style():
    assert "school" in _LAYOUT_BUILDERS
    _, layout = generate(seed=3, width=40, height=40)
    expected = build_layout(random.Random(3), 40, 40)
    assert layout.cells == expected.cells


@pytest.mark.parametrize("size", sorted(SEEDS_BY_SIZE))
def test_same_seed_is_identical_and_seeds_differ(size):
    a = build_layout(random.Random(5), size, size)
    b = build_layout(random.Random(5), size, size)
    c = build_layout(random.Random(6), size, size)
    assert a.cells == b.cells
    assert a.rooms == b.rooms
    assert a.hallways == b.hallways
    assert a.doors == b.doors
    assert a.cells != c.cells


@pytest.mark.parametrize("size,seed", CASES)
class TestSchoolInvariants:
    def test_everything_is_reachable_from_spawn(self, size, seed):
        p = probe_for(size, seed)
        reached = p.reachable()
        assert len(reached) == p.walkable_count()
        assert p.spawn_cell() in p.atrium
        for i, room in enumerate(p.layout.rooms):
            assert p.door_cells[i] in reached
            r = room.rect
            assert (r.x + r.w // 2, r.y + r.h // 2) in reached

    def test_corridors_form_one_component(self, size, seed):
        assert probe_for(size, seed).corridor_components() == 1

    def test_atrium_is_open_at_all_wall_midpoints(self, size, seed):
        p = probe_for(size, seed)
        for cell in p.atrium_midpoint_cells():
            assert p.walkable(*cell), cell

    def test_corridors_are_two_wide_and_never_doubled(self, size, seed):
        p = probe_for(size, seed)
        assert p.narrow_corridor_cells() == []
        assert p.fat_corridor_windows() == []

    def test_rooms_only_touch_corridors_through_their_door(self, size, seed):
        p = probe_for(size, seed)
        assert p.room_wall_violations() == []
        assert p.bad_doors() == []
        assert len(set(p.door_cells.values())) == len(p.layout.rooms)

    def test_corridor_loops_and_few_short_dead_ends(self, size, seed):
        p = probe_for(size, seed)
        assert p.independent_loops() >= MIN_LOOPS[size]
        stubs = p.stub_lengths()
        assert len(stubs) <= MAX_STUBS
        assert all(s <= MAX_STUB_LENGTH for s in stubs)

    def test_hallway_rects_match_painted_corridor(self, size, seed):
        p = probe_for(size, seed)
        halls = p.layout.hallways
        assert p.layout.atrium in halls
        covered = set()
        for h in halls:
            assert h.x >= 1 and h.y >= 1 and h.x + h.w <= size - 1 and h.y + h.h <= size - 1
            for y in range(h.y, h.y + h.h):
                for x in range(h.x, h.x + h.w):
                    assert (x, y) not in covered
                    covered.add((x, y))
                    assert p.walkable(x, y)
                    assert (x, y) not in p.room_of
                    assert (x, y) not in p.door_set
        assert covered == p.corridor

    def test_hallway_lights_land_on_walkable_cells(self, size, seed):
        p = probe_for(size, seed)
        for h in p.layout.hallways:
            for light in _hallway_lights(h):
                cx, cy = cell_of(light.x, light.z)
                assert p.walkable(cx, cy)
                assert (cx, cy) in p.corridor

    def test_room_count_fits_the_render_budget(self, size, seed):
        p = probe_for(size, seed)
        rooms = p.layout.rooms
        assert len(rooms) <= ROOM_BUDGET[size]
        if size == 40:
            assert len(rooms) >= MIN_ROOMS_40
        for room in rooms:
            r = room.rect
            assert r.w >= 4 and r.h >= 4
            assert r.x >= 1 and r.y >= 1 and r.x + r.w <= size - 1 and r.y + r.h <= size - 1
            assert all(p.walkable(x, y) for x in range(r.x, r.x + r.w) for y in range(r.y, r.y + r.h))

    def test_room_door_metadata_matches_geometry(self, size, seed):
        p = probe_for(size, seed)
        for room in p.layout.rooms:
            r = room.rect
            assert (room.door_x, room.door_z) in p.layout.doors
            if room.front_dir in ("N", "S"):
                offset = room.door_w / CELL_SIZE
                assert abs(offset) <= r.w / 2
                assert (room.door_x / CELL_SIZE) == pytest.approx(r.x + r.w / 2 + offset)
            else:
                offset = room.door_w / CELL_SIZE
                assert (room.door_z / CELL_SIZE) == pytest.approx(r.y + r.h / 2 + offset)


def test_layout_generation_is_fast_at_xlarge():
    start = time.perf_counter()
    for seed in range(1, 6):
        build_layout(random.Random(seed), 120, 120)
    assert (time.perf_counter() - start) / 5 < LAYOUT_SECONDS_AT_120


def test_full_generate_at_xlarge_stays_bounded():
    start = time.perf_counter()
    generate(seed=4, width=120, height=120)
    assert time.perf_counter() - start < GENERATE_SECONDS_AT_120
