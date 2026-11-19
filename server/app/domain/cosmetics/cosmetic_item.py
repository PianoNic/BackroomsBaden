from __future__ import annotations

from dataclasses import dataclass

from app.domain.cosmetics.cosmetic_attachment import CosmeticAttachment


@dataclass(frozen=True)
class CosmeticItem:
    id: str
    category: str
    name: str
    price: int
    rarity: str  # common | rare | epic | legendary
    asset_ref: str
    default: bool = False
    attachment: CosmeticAttachment | None = None
    unlock: str = ""

    @property
    def is_locked(self) -> bool:
        return bool(self.unlock)

    @property
    def is_purchasable(self) -> bool:
        return not self.default and not self.unlock
