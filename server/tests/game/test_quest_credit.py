from __future__ import annotations

from app.application.dtos.world import Objective, Spot
from app.game.broadcaster import Broadcaster
from app.game.handlers.chair_handler import ChairHandler
from app.game.handlers.noise_handler import NoiseHandler
from app.game.handlers.quest_handler import QuestHandler

from ..conftest import add_player, make_lobby


def make_quest_handler() -> QuestHandler:
    broadcaster = Broadcaster()
    return QuestHandler(broadcaster, ChairHandler(broadcaster, NoiseHandler()))


def lobby_with_coop_spot(min_players: int):
    lobby = make_lobby()
    lobby.world.objectives = [
        Objective(
            id="o", text="Push the fridge", kind="press_e", interact=True,
            spots=[Spot(x=10.0, z=10.0)], min_players=min_players,
        ),
    ]
    return lobby


class TestCoopCredit:
    async def test_everyone_standing_at_the_spot_is_credited(self):
        lobby = lobby_with_coop_spot(2)
        presser = add_player(lobby, "presser", x=10.0, z=10.0)
        helper = add_player(lobby, "helper", x=10.5, z=10.0)
        bystander = add_player(lobby, "bystander", x=30.0, z=30.0)

        await make_quest_handler().try_complete_spots(lobby, presser, require_interact=True)

        assert presser.tasks_done == 1
        assert helper.tasks_done == 1
        assert bystander.tasks_done == 0

    async def test_a_solo_task_credits_only_the_player_who_did_it(self):
        lobby = lobby_with_coop_spot(1)
        presser = add_player(lobby, "presser", x=10.0, z=10.0)
        neighbour = add_player(lobby, "neighbour", x=10.5, z=10.0)

        await make_quest_handler().try_complete_spots(lobby, presser, require_interact=True)

        assert presser.tasks_done == 1
        assert neighbour.tasks_done == 0

    async def test_a_lone_player_completes_a_coop_spot_through_the_clamp(self):
        lobby = lobby_with_coop_spot(2)
        only = add_player(lobby, "only", x=10.0, z=10.0)

        await make_quest_handler().try_complete_spots(lobby, only, require_interact=True)

        assert only.tasks_done == 1
        assert lobby.world.objectives[0].done
