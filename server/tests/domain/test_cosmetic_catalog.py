from datetime import date
from pathlib import Path

from app.domain.cosmetics.cosmetic_catalog import CATEGORIES, CosmeticCatalog
from app.domain.cosmetics.daily_selection import FEATURED_COUNT, DailyFeaturedSelection


def test_every_default_item_is_free_and_marked_default():
    catalog = CosmeticCatalog()
    for category, cosmetic_id in catalog.default_equipped().items():
        item = catalog.get(cosmetic_id)
        assert item is not None
        assert item.default is True
        assert item.price == 0
        assert item.category == category


def test_default_equipped_has_at_most_one_entry_per_category():
    catalog = CosmeticCatalog()
    equipped = catalog.default_equipped()
    assert set(equipped.keys()).issubset(set(CATEGORIES))
    assert len(equipped) == len({it.category for it in catalog.items() if it.default})


def test_get_returns_none_for_missing_or_none_id():
    catalog = CosmeticCatalog()
    assert catalog.get(None) is None
    assert catalog.get("nope") is None


def test_validate_equipped_drops_wrong_category_and_unknown_id():
    catalog = CosmeticCatalog()
    default_body = catalog.default_equipped()["body"]
    result = catalog.validate_equipped({
        "body": default_body,
        "hat": default_body,
        "title": "nope",
    })
    assert result == {"body": default_body}


def test_to_dto_keys_and_length():
    catalog = CosmeticCatalog()
    dtos = catalog.to_dto(date(2026, 1, 1))
    assert len(dtos) == len(catalog.items())
    for dto in dtos:
        assert list(dto.keys()) == [
            "id", "category", "name", "price", "rarity", "assetRef", "default",
            "attach", "featured", "unlock",
        ]


def test_every_item_category_is_known_and_ids_are_unique():
    catalog = CosmeticCatalog()
    items = catalog.items()
    ids = [it.id for it in items]
    assert len(ids) == len(set(ids))
    for it in items:
        assert it.category in CATEGORIES


NEW_CATEGORIES = ("backpack", "mask", "handitem")
NEW_ITEM_IDS = ("hat_fischer",)

PRICE_BANDS = {
    "common": (150, 300), "rare": (350, 650), "epic": (700, 1000), "legendary": (1200, 2000),
}


def test_every_equippable_category_has_exactly_one_default_except_face_pattern():
    catalog = CosmeticCatalog()
    for category in CATEGORIES:
        defaults = [it for it in catalog.items() if it.category == category and it.default]
        expected = 0 if category == "facePattern" else 1
        assert len(defaults) == expected, category


def test_purchasable_prices_fall_within_rarity_bands():
    for it in CosmeticCatalog().items():
        if it.default or it.unlock:
            continue
        if it.category not in NEW_CATEGORIES and it.id not in NEW_ITEM_IDS:
            continue
        low, high = PRICE_BANDS[it.rarity]
        assert low <= it.price <= high, it.id


def test_unlock_and_default_items_are_not_purchasable():
    catalog = CosmeticCatalog()
    unlock_items = [it for it in catalog.items() if it.unlock]
    assert unlock_items
    for it in unlock_items:
        assert catalog.purchase_rejection(it) == "locked"
    for it in catalog.items():
        if it.default:
            assert catalog.purchase_rejection(it) == "owned"
    assert catalog.purchase_rejection(catalog.get("body_hazmat")) is None


def test_ids_unlocked_by_maps_achievement_ids_to_items():
    catalog = CosmeticCatalog()
    assert catalog.ids_unlocked_by({"ach_medic"}) == {"backpack_sani"}
    assert catalog.ids_unlocked_by(set()) == set()


def test_validate_equipped_handles_new_categories():
    catalog = CosmeticCatalog()
    result = catalog.validate_equipped({
        "backpack": "backpack_schul",
        "mask": "backpack_schul",
        "handitem": "nope",
        "hat": "hat_fischer",
    })
    assert result == {"backpack": "backpack_schul", "hat": "hat_fischer"}


def test_to_dto_marks_featured_for_the_given_day():
    catalog = CosmeticCatalog()
    day = date(2026, 3, 4)
    dtos = catalog.to_dto(day)
    assert {d["id"] for d in dtos if d["featured"]} == catalog.featured_ids(day)


class TestDailyFeaturedSelection:
    def test_is_deterministic_per_date(self):
        catalog = CosmeticCatalog()
        assert catalog.featured_ids(date(2026, 5, 1)) == catalog.featured_ids(date(2026, 5, 1))

    def test_changes_across_dates(self):
        catalog = CosmeticCatalog()
        days = [date(2026, 5, d) for d in range(1, 15)]
        assert len({frozenset(catalog.featured_ids(d)) for d in days}) > 1

    def test_has_configured_count_and_mixes_rarities(self):
        catalog = CosmeticCatalog()
        for d in range(1, 10):
            ids = catalog.featured_ids(date(2026, 6, d))
            assert len(ids) == FEATURED_COUNT
            assert len({catalog.get(i).rarity for i in ids}) > 1

    def test_excludes_defaults_and_unlock_items(self):
        catalog = CosmeticCatalog()
        for d in range(1, 30):
            for i in catalog.featured_ids(date(2026, 7, d)):
                item = catalog.get(i)
                assert not item.default and not item.unlock

    def test_custom_count_is_respected(self):
        selection = DailyFeaturedSelection(count=3)
        assert len(selection.select(CosmeticCatalog().items(), date(2026, 1, 1))) == 3


def test_every_model_asset_ref_has_a_glb_in_client_public():
    models_root = Path(__file__).resolve().parents[3] / "client" / "public"
    refs = [it.asset_ref for it in CosmeticCatalog().items() if it.asset_ref.startswith("models/")]
    assert refs
    for ref in refs:
        assert (models_root / f"{ref}.glb").is_file(), ref
