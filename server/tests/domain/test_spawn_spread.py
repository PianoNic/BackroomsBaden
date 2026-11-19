from __future__ import annotations

import math

from app.domain.world.constants import CELL_SIZE
from app.domain.world.spawn_spread import SPREAD_RADIUS, SpawnSpread

SIZE = 20
CENTRE = (SIZE * CELL_SIZE / 2, SIZE * CELL_SIZE / 2)


def open_spread() -> SpawnSpread:
    return SpawnSpread([1] * (SIZE * SIZE), SIZE, SIZE)


class TestPositions:
    def test_a_single_player_keeps_the_exact_spawn(self):
        assert open_spread().positions(*CENTRE, 1) == [CENTRE]

    def test_nobody_gets_nothing(self):
        assert open_spread().positions(*CENTRE, 0) == []

    def test_every_player_lands_on_their_own_point(self):
        spots = open_spread().positions(*CENTRE, 8)

        assert len(set(spots)) == 8

    def test_players_stand_at_least_a_body_apart(self):
        spots = open_spread().positions(*CENTRE, 8)

        gaps = [
            math.dist(a, b) for i, a in enumerate(spots) for b in spots[i + 1:]
        ]
        assert min(gaps) > 1.0

    def test_spots_stay_within_the_spread_radius(self):
        for spot in open_spread().positions(*CENTRE, 6):
            assert math.dist(spot, CENTRE) <= SPREAD_RADIUS + 1e-9

    def test_a_blocked_spot_falls_back_to_the_centre(self):
        blocked = SpawnSpread([0] * (SIZE * SIZE), SIZE, SIZE)

        assert blocked.positions(*CENTRE, 3) == [CENTRE] * 3
