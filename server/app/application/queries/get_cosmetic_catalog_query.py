from dataclasses import dataclass
from datetime import datetime, timezone

from mediatorx import IQuery, IQueryHandler

from app.application.dtos.cosmetic_item_dto import CosmeticItemDto
from app.domain.cosmetics.cosmetic_catalog import CosmeticCatalog


@dataclass
class GetCosmeticCatalogQuery(IQuery[list[CosmeticItemDto]]):
    pass


class GetCosmeticCatalogHandler(IQueryHandler[GetCosmeticCatalogQuery, list[CosmeticItemDto]]):
    def __init__(self, catalog: CosmeticCatalog) -> None:
        self._catalog = catalog

    async def handle(self, query: GetCosmeticCatalogQuery) -> list[CosmeticItemDto]:
        featured = self._catalog.featured_ids(datetime.now(timezone.utc).date())
        return [
            CosmeticItemDto(
                id=it.id, category=it.category, name=it.name, price=it.price,
                rarity=it.rarity, asset_ref=it.asset_ref, default=it.default,
                attach=it.attachment.to_dto() if it.attachment is not None else None,
                featured=it.id in featured,
                unlock=it.unlock,
            )
            for it in self._catalog.items()
        ]
