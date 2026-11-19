from dataclasses import dataclass

from mediatorx import IQuery, IQueryHandler

from app.application.abstractions.date_provider import IDateProvider
from app.application.dtos.cosmetic_item_dto import CosmeticItemDto
from app.domain.cosmetics.cosmetic_catalog import CosmeticCatalog


@dataclass
class GetCosmeticCatalogQuery(IQuery[list[CosmeticItemDto]]):
    pass


class GetCosmeticCatalogHandler(IQueryHandler[GetCosmeticCatalogQuery, list[CosmeticItemDto]]):
    def __init__(self, catalog: CosmeticCatalog, dates: IDateProvider) -> None:
        self._catalog = catalog
        self._dates = dates

    async def handle(self, query: GetCosmeticCatalogQuery) -> list[CosmeticItemDto]:
        rows = self._catalog.to_dto(self._dates.today())
        return [
            CosmeticItemDto(
                id=row["id"], category=row["category"], name=row["name"],
                price=row["price"], rarity=row["rarity"], asset_ref=row["assetRef"],
                default=row["default"], attach=row["attach"],
                featured=row["featured"], unlock=row["unlock"],
            )
            for row in rows
        ]
