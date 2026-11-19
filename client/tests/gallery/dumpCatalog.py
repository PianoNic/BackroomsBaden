import json
import sys
from datetime import date

from app.domain.cosmetics.cosmetic_catalog import CosmeticCatalog


class CatalogDumper:
    def __init__(self, target: str) -> None:
        self.target = target

    def run(self) -> None:
        payload = CosmeticCatalog().to_dto(date.today())
        with open(self.target, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)


CatalogDumper(sys.argv[1]).run()
