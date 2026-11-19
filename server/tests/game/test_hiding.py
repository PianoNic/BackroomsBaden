"""Hide-in-closet rules (issues #35, #36, #38)."""
from __future__ import annotations

import time

from app.game.broadcaster import Broadcaster
from app.game.handlers.chair_handler import ChairHandler
from app.domain.world.teachers import TeacherState
from app.game.handlers.hiding_handler import EXIT_GRACE_S, HidingHandler
from app.game.handlers.revive_handler import ReviveHandler
from app.game.teacher_loop import TeacherLoop
from app.game.handlers.noise_handler import NoiseHandler
from app.application.commands.back_to_lobby_command import BackToLobbyHandler

from ..conftest import add_chair, add_hideout, add_player, make_lobby


def make_hiding_handler() -> HidingHandler:
    broadcaster = Broadcaster()
    noise_handler = NoiseHandler()
    chair_handler = ChairHandler(broadcaster, noise_handler)
    return HidingHandler(broadcaster, noise_handler, chair_handler)


def a_teacher(x: float, z: float) -> TeacherState:
    return TeacherState(
        id="t1", image="t.png", name="T", subject="S", ability="endurance",
        x=x, z=z, tx=x, tz=z,
    )


def make_teacher_loop() -> TeacherLoop:
    broadcaster = Broadcaster()
    noise_handler = NoiseHandler()
    return TeacherLoop(
        None, broadcaster, None, ChairHandler(broadcaster, noise_handler), None,
        noise_handler, None, ReviveHandler(broadcaster), None,
    )


class TestRoundReset:
    """#35 — closets are rebuilt from the new world each round."""

    def test_hideouts_are_cleared(self):
        lobby = make_lobby()
        lobby.phase = "lost"
        add_hideout(lobby, "h1", 10.0, 10.0)
        add_hideout(lobby, "h2", 20.0, 20.0)

        BackToLobbyHandler()._reset_runtime_state(lobby)

        # Left behind, a stale closet would sit at last round's coordinates —
        # and `hide` resolves by proximity, with no closet id to sanity-check.
        assert lobby.hideouts == {}

    def test_hidden_player_is_released(self):
        lobby = make_lobby()
        lobby.phase = "lost"
        p = add_player(lobby)
        add_hideout(lobby, "h1", 10.0, 10.0, occupied_by=p.id)
        p.hidden_in = "h1"

        BackToLobbyHandler()._reset_runtime_state(lobby)

        # A dangling id would make the next round drop all their move packets.
        assert p.hidden_in is None
        assert lobby.status == "waiting"


class TestClosetChoice:
    """#36 — occupancy beats proximity."""

    async def test_free_closet_wins_over_nearer_occupied_one(self):
        lobby = make_lobby()
        me = add_player(lobby, "me", x=0.0, z=0.0)
        add_player(lobby, "other", x=1.0, z=0.0)
        add_hideout(lobby, "near", 1.0, 0.0, occupied_by="other")
        add_hideout(lobby, "far", 1.8, 0.0)   # still inside HIDE_RADIUS
        hiding = make_hiding_handler()

        await hiding.handle_hide(lobby, me)

        assert me.hidden_in == "far"
        assert lobby.hideouts["far"].occupied_by == "me"

    async def test_denied_when_every_closet_in_range_is_taken(self):
        lobby = make_lobby()
        me = add_player(lobby, "me", x=0.0, z=0.0)
        add_player(lobby, "other", x=1.0, z=0.0)
        add_hideout(lobby, "only", 1.0, 0.0, occupied_by="other")
        hiding = make_hiding_handler()

        await hiding.handle_hide(lobby, me)

        assert me.hidden_in is None
        assert me.channel.json_sent[-1] == {"type": "hide_denied", "reason": "occupied"}

    async def test_nothing_in_range_stays_silent(self):
        lobby = make_lobby()
        me = add_player(lobby, "me", x=0.0, z=0.0)
        add_hideout(lobby, "far", 50.0, 0.0)
        hiding = make_hiding_handler()

        await hiding.handle_hide(lobby, me)

        assert me.hidden_in is None
        assert me.channel.json_sent == []   # no denial banner for an empty press


class TestEnteringWithAChair:
    """#38 — a chair cannot come into the closet."""

    async def test_held_chair_is_dropped_on_entry(self):
        lobby = make_lobby()
        me = add_player(lobby, "me", x=0.0, z=0.0)
        add_chair(lobby, "c1", 0.0, 0.0, held_by="me")
        add_hideout(lobby, "h1", 1.0, 0.0)
        hiding = make_hiding_handler()

        await hiding.handle_hide(lobby, me)

        assert me.hidden_in == "h1"
        # Otherwise it stays invisibly held by someone who can't use it.
        assert lobby.chairs["c1"].held_by is None


class TestClimbingOut:
    """Stepping out of a closet beside a teacher is not an instant catch."""

    async def test_exit_grants_a_short_catch_immunity(self):
        lobby = make_lobby()
        me = add_player(lobby, "me", x=0.0, z=0.0)
        add_hideout(lobby, "h1", 1.0, 0.0)
        hiding = make_hiding_handler()
        await hiding.handle_hide(lobby, me)
        assert me.is_catchable(time.monotonic())

        await hiding.handle_hide(lobby, me)

        now = time.monotonic()
        assert me.hidden_in is None
        assert not me.is_catchable(now)
        assert me.is_catchable(now + EXIT_GRACE_S + 0.01)

    async def test_a_teacher_beside_the_closet_cannot_catch_a_player_who_just_climbed_out(self):
        lobby = make_lobby()
        me = add_player(lobby, "me", x=0.0, z=0.0)
        add_hideout(lobby, "h1", 1.0, 0.0)
        hiding = make_hiding_handler()
        await hiding.handle_hide(lobby, me)
        await hiding.handle_hide(lobby, me)
        lobby.teachers = [a_teacher(me.x + 0.3, me.z)]
        loop = make_teacher_loop()

        await loop._check_catches(lobby)

        assert me.id not in lobby.dead

    async def test_the_same_teacher_catches_once_the_grace_has_passed(self):
        lobby = make_lobby()
        me = add_player(lobby, "me", x=0.0, z=0.0)
        me.catch_immune_until = time.monotonic() - 0.1
        lobby.teachers = [a_teacher(me.x + 0.3, me.z)]
        loop = make_teacher_loop()

        await loop._check_catches(lobby)

        assert me.id in lobby.dead
