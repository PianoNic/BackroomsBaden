import pytest
from pydantic import ValidationError

from app.application.dtos.packets import SetCosmeticPkt
from app.domain.cosmetics.cosmetic_catalog import CATEGORIES


@pytest.mark.parametrize("category", CATEGORIES)
def test_every_catalog_category_is_accepted(category):
    pkt = SetCosmeticPkt(type="set_cosmetic", category=category, cosmeticId="x")
    assert pkt.category == category


def test_unknown_category_is_rejected():
    with pytest.raises(ValidationError):
        SetCosmeticPkt(type="set_cosmetic", category="footstep", cosmeticId="x")
