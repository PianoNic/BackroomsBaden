"""Teachers start a chase by seeing a player, not by being close through a wall."""
from __future__ import annotations

import random

from app.domain.world.constants import CELL_SIZE
from app.domain.world.physics import TEACHER_CHASE_RADIUS
from app.domain.world.teacher_ai import CHASE_MEMORY_S, _pick_target, step_teacher
from app.domain.world.teachers import TeacherState, _set_grid

SIZE = 20
WALL_COLUMN = 10
Z = 4.5 * CELL_SIZE
SEEN = (6.0 * CELL_SIZE, Z)
EAST_OF_WALL = (13.5 * CELL_SIZE, Z)
WEST_OF_WALL = (7.5 * CELL_SIZE, Z)


def open_grid() -> list[int]:
    return [1] * (SIZE * SIZE)


def walled_grid() -> list[int]:
    cells = open_grid()
    for cz in range(SIZE):
        cells[cz * SIZE + WALL_COLUMN] = 0
    return cells


def a_teacher(ability: str = "endurance", x: float = WEST_OF_WALL[0], z: float = Z) -> TeacherState:
    return TeacherState(
        id="t", image="t.png", name="T", subject="S", ability=ability,
        x=x, z=z, tx=x, tz=z,
    )


def pick(t: TeacherState, cells: list[int], players: list[tuple[float, float]], now: float = 100.0):
    _set_grid(SIZE, SIZE)
    return _pick_target(t, players, [], random.Random(1), [], now, cells)


class TestStartingAChase:
    def test_a_player_in_sight_inside_the_radius_is_chased(self):
        t = a_teacher(x=2.0 * CELL_SIZE)

        assert pick(t, open_grid(), [(8.0 * CELL_SIZE, Z)]) == (8.0 * CELL_SIZE, Z)

    def test_a_player_close_but_behind_a_wall_is_not_chased(self):
        cells = walled_grid()
        t = a_teacher()
        player = EAST_OF_WALL

        assert pick(t, cells, [player]) != player

    def test_a_player_in_sight_beyond_the_radius_is_not_chased(self):
        t = a_teacher(x=0.5 * CELL_SIZE)
        far = (0.5 * CELL_SIZE + TEACHER_CHASE_RADIUS + 4.0, Z)

        assert pick(t, open_grid(), [far]) != far

    def test_the_ict_teacher_still_tracks_through_walls(self):
        cells = walled_grid()
        t = a_teacher(ability="minimap_xray")
        player = EAST_OF_WALL

        assert pick(t, cells, [player]) == player

    def test_the_nearest_visible_player_wins_over_a_nearer_hidden_one(self):
        cells = walled_grid()
        t = a_teacher()
        behind_wall = EAST_OF_WALL
        in_sight = (3.0 * CELL_SIZE, Z)

        assert pick(t, cells, [behind_wall, in_sight]) == in_sight


class TestLosingAChase:
    def test_the_teacher_walks_to_where_it_last_saw_the_player(self):
        cells = walled_grid()
        t = a_teacher()
        pick(t, open_grid(), [SEEN], now=100.0)

        target = pick(t, cells, [EAST_OF_WALL], now=100.0 + CHASE_MEMORY_S / 2)

        assert target == SEEN

    def test_the_memory_expires(self):
        cells = walled_grid()
        t = a_teacher()
        pick(t, open_grid(), [SEEN], now=100.0)

        target = pick(t, cells, [EAST_OF_WALL], now=100.0 + CHASE_MEMORY_S + 1.0)

        assert target != SEEN

    def test_arriving_at_the_last_seen_spot_ends_the_chase(self):
        cells = walled_grid()
        t = a_teacher()
        pick(t, open_grid(), [SEEN], now=100.0)
        t.x, t.z = SEEN[0] + 0.5, SEEN[1]

        pick(t, cells, [EAST_OF_WALL], now=101.0)

        assert t.seen_until == 0.0

    def test_a_walled_in_player_never_becomes_the_target_while_stepping(self):
        cells = walled_grid()
        t = a_teacher()
        _set_grid(SIZE, SIZE)

        for step in range(40):
            step_teacher(
                t, cells, [], [EAST_OF_WALL], 0.125, random.Random(2), [], 100.0 + step * 0.125,
            )

        assert (t.tx, t.tz) != EAST_OF_WALL
