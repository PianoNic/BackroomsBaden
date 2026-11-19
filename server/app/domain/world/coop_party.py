from __future__ import annotations

from app.application.dtos.world import Objective

TOGETHER_SUFFIX = " — 2 players together"


class CoopPartyPolicy:
    @staticmethod
    def apply(objectives: list[Objective], party_size: int) -> None:
        size = max(1, party_size)
        for obj in objectives:
            if obj.min_players <= size:
                continue
            obj.min_players = size
            if size == 1:
                obj.text = obj.text.replace(TOGETHER_SUFFIX, "")
            else:
                obj.text = obj.text.replace(TOGETHER_SUFFIX, f" — {size} players together")
