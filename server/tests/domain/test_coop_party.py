from __future__ import annotations

from app.application.dtos.world import Objective, Spot
from app.domain.world.coop_party import CoopPartyPolicy


def coop(text: str = "Flip 2 cafeteria tables — 2 players together") -> Objective:
    return Objective(
        id="o", text=text, kind="press_e", interact=True,
        spots=[Spot(x=1.0, z=1.0)], min_players=2,
    )


def solo() -> Objective:
    return Objective(id="s", text="Wash your hands at the sink", spots=[Spot(x=1.0, z=1.0)])


class TestCoopPartyPolicy:
    def test_a_solo_party_drops_the_together_suffix_and_the_requirement(self):
        objectives = [coop()]

        CoopPartyPolicy.apply(objectives, 1)

        assert objectives[0].min_players == 1
        assert objectives[0].text == "Flip 2 cafeteria tables"

    def test_a_pair_keeps_the_text_and_the_requirement(self):
        objectives = [coop()]

        CoopPartyPolicy.apply(objectives, 2)

        assert objectives[0].min_players == 2
        assert objectives[0].text.endswith("2 players together")

    def test_a_larger_party_changes_nothing(self):
        objectives = [coop()]

        CoopPartyPolicy.apply(objectives, 4)

        assert objectives[0].min_players == 2

    def test_solo_objectives_are_untouched(self):
        objectives = [solo()]

        CoopPartyPolicy.apply(objectives, 1)

        assert objectives[0].text == "Wash your hands at the sink"
        assert objectives[0].min_players == 1

    def test_an_empty_party_is_treated_as_one_player(self):
        objectives = [coop()]

        CoopPartyPolicy.apply(objectives, 0)

        assert objectives[0].min_players == 1
