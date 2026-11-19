from __future__ import annotations

from app.domain.cosmetics.cosmetic_catalog import CosmeticCatalog
from app.game.broadcaster import Broadcaster
from app.game.handlers.cosmetic_handler import CosmeticHandler

from ..conftest import add_player, make_lobby


class _Availability:
    is_available = True


class _ExplodingRepository:
    async def purchase(self, account_id, item):
        raise AssertionError("purchase must not reach the repository")


class _RecordingBroadcaster(Broadcaster):
    def __init__(self) -> None:
        super().__init__()
        self.sent: list[dict] = []

    async def send_safe(self, conn, payload) -> None:
        self.sent.append(payload)


async def test_ws_buy_of_unlock_item_is_rejected_as_locked():
    lobby = make_lobby()
    me = add_player(lobby, "me")
    me.account_id = 1
    broadcaster = _RecordingBroadcaster()
    handler = CosmeticHandler(broadcaster, _ExplodingRepository(), CosmeticCatalog(), _Availability())

    await handler.handle_buy_cosmetic(lobby, me, "mask_rennbrille")

    assert broadcaster.sent[0]["ok"] is False
    assert broadcaster.sent[0]["reason"] == "locked"
    assert "mask_rennbrille" not in me.owned_cosmetics


async def test_ws_equip_of_unowned_or_mismatched_new_category_item_is_ignored():
    lobby = make_lobby()
    me = add_player(lobby, "me")
    handler = CosmeticHandler(_RecordingBroadcaster(), None, CosmeticCatalog(), _Availability())

    await handler.handle_set_cosmetic(lobby, me, "mask", "mask_schutzbrille")
    assert "mask" not in me.equipped_cosmetics

    me.owned_cosmetics.add("mask_schutzbrille")
    await handler.handle_set_cosmetic(lobby, me, "backpack", "mask_schutzbrille")
    assert "backpack" not in me.equipped_cosmetics
