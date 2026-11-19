from __future__ import annotations

import random
from datetime import date

from app.domain.cosmetics.cosmetic_item import CosmeticItem

FEATURED_COUNT = 6
_RARITY_ORDER = ("common", "rare", "epic", "legendary")


class DailyFeaturedSelection:
    def __init__(self, count: int = FEATURED_COUNT) -> None:
        self._count = count

    def select(self, items: list[CosmeticItem], day: date) -> set[str]:
        eligible = sorted(
            (it for it in items if not it.default and not it.unlock),
            key=lambda it: it.id,
        )
        if not eligible:
            return set()

        rng = random.Random(day.toordinal())
        buckets: dict[str, list[str]] = {rarity: [] for rarity in _RARITY_ORDER}
        for it in eligible:
            buckets.setdefault(it.rarity, []).append(it.id)
        for ids in buckets.values():
            rng.shuffle(ids)

        rarities = [rarity for rarity in _RARITY_ORDER if buckets.get(rarity)]
        cursors = {rarity: 0 for rarity in rarities}
        target = min(self._count, len(eligible))
        picked: list[str] = []
        cursor_index = 0
        while len(picked) < target:
            rarity = rarities[cursor_index % len(rarities)]
            cursor_index += 1
            position = cursors[rarity]
            bucket = buckets[rarity]
            if position < len(bucket):
                picked.append(bucket[position])
                cursors[rarity] = position + 1
            if all(cursors[r] >= len(buckets[r]) for r in rarities):
                break
        return set(picked)
