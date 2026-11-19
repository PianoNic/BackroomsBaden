"""Cosmetic catalog — the server-authoritative source of truth.

Prices and categories live here so the client can never fake them. `asset_ref`
is category-polymorphic and interpreted client-side:
  - body        -> a hex colour ("" = the default sampled colour)
  - facePattern -> a texture path under client `public/`
  - hat         -> a procedural mesh key ("cone", "halo", "gradcap", "crown"),
                   or a `models/...` glTF path (see below)
  - backpack    -> a procedural mesh key, a `models/...` glTF path, or "" (none)
  - mask        -> a procedural mesh key, a `models/...` glTF path, or "" (none)
  - handitem    -> a `models/...` glTF path, or "" (the default held chair)
  - title       -> "text|#hexcolor"
  A ref that starts with `models/` is a glTF asset path: the client loads it
  as `/${assetRef}.glb`. Everything else stays whatever its category expects.
`default` items are free and auto-owned by everyone (including guests). Items
with a non-empty `unlock` are never purchasable — they are granted for free to
any account holding that achievement id (see `ids_unlocked_by`).
"""
from __future__ import annotations

from datetime import date

from app.domain.cosmetics.cosmetic_attachment import CosmeticAttachment
from app.domain.cosmetics.cosmetic_item import CosmeticItem
from app.domain.cosmetics.daily_selection import DailyFeaturedSelection

CATEGORIES = ("body", "facePattern", "hat", "title", "backpack", "mask", "handitem")

_ITEMS: list[CosmeticItem] = [
    # --- body themes ---
    CosmeticItem("body_default", "body", "Standard Issue", 0, "common", "", True),
    CosmeticItem("body_hazmat", "body", "Hazmat Green", 150, "common", "#3fa34d"),
    CosmeticItem("body_camo", "body", "Forest Camo", 150, "common", "#4a5d3a"),
    CosmeticItem("body_hotpink", "body", "Hot Pink", 250, "common", "#ff4fa0"),
    CosmeticItem("body_royal", "body", "Royal Blue", 250, "common", "#2456d6"),
    CosmeticItem("body_schulrot", "body", "Schulrot", 350, "rare", "#c61824"),
    CosmeticItem("body_void", "body", "Void Black", 400, "rare", "#0c0c10"),
    CosmeticItem("body_toxic", "body", "Toxic Lime", 400, "rare", "#9eff2e"),
    CosmeticItem("body_lava", "body", "Lava Orange", 450, "rare", "#ff5a1f"),
    CosmeticItem("body_neon", "body", "Neon Cyan", 600, "epic", "#19e6ff"),
    CosmeticItem("body_ghost", "body", "Ghost White", 650, "epic", "#f2f4ff"),
    CosmeticItem("body_gold", "body", "Golden Hour", 900, "epic", "#d4a017"),
    # --- face patterns (PNGs under client public/cosmetics/faces/) ---
    CosmeticItem("face_smiley", "facePattern", "Pixel Smiley", 200, "common", "/cosmetics/faces/smiley.png"),
    CosmeticItem("face_wink", "facePattern", "Wink", 200, "common", "/cosmetics/faces/wink.png"),
    CosmeticItem("face_angry", "facePattern", "Grumpy", 300, "common", "/cosmetics/faces/angry.png"),
    CosmeticItem("face_xeyes", "facePattern", "X_X", 350, "rare", "/cosmetics/faces/xeyes.png"),
    CosmeticItem("face_shades", "facePattern", "Deal With It", 450, "rare", "/cosmetics/faces/shades.png"),
    CosmeticItem("face_heart", "facePattern", "Heart Eyes", 500, "rare", "/cosmetics/faces/heart.png"),
    CosmeticItem("face_robot", "facePattern", "Roboter", 700, "epic", "/cosmetics/faces/robot.png"),
    CosmeticItem("face_ghost", "facePattern", "Spooked", 750, "epic", "/cosmetics/faces/ghost.png"),
    # --- hats (procedural mesh keys, built client-side) ---
    CosmeticItem("hat_grad", "hat", "Graduation Cap", 0, "common", "gradcap", True),
    CosmeticItem("hat_beret", "hat", "Künstler-Beret", 200, "common", "beret"),
    CosmeticItem("hat_party", "hat", "Party Cone", 250, "common", "cone"),
    CosmeticItem("hat_propeller", "hat", "Propeller Cap", 350, "common", "propeller"),
    CosmeticItem("hat_viking", "hat", "Viking Helm", 600, "rare", "viking"),
    CosmeticItem("hat_sombrero", "hat", "Sombrero", 650, "rare", "sombrero"),
    CosmeticItem("hat_halo", "hat", "Detention Halo", 800, "epic", "halo"),
    CosmeticItem("hat_headset", "hat", "Gamer Headset", 800, "epic", "headset"),
    CosmeticItem("hat_tophat", "hat", "Rektor's Top Hat", 900, "epic", "tophat"),
    CosmeticItem("hat_alien", "hat", "Alien Antenna", 1000, "epic", "antenna"),
    CosmeticItem("hat_wizard", "hat", "Prüfungs-Magier", 1500, "legendary", "wizard"),
    CosmeticItem("hat_crown", "hat", "Class President Crown", 2000, "legendary", "crown"),
    # --- titles ---
    CosmeticItem("title_newkid", "title", "New Kid", 0, "common", "New Kid|#9fb3c8", True),
    CosmeticItem("title_monitor", "title", "Hall Monitor", 250, "common", "Hall Monitor|#7fd0ff"),
    CosmeticItem("title_hausmeister", "title", "Hausmeister", 400, "common", "Hausmeister|#b0a08a"),
    CosmeticItem("title_pet", "title", "Teacher's Pet", 500, "rare", "Teacher's Pet|#ffb3d9"),
    CosmeticItem("title_detention", "title", "Detention Regular", 550, "rare", "Detention Regular|#ff6b4a"),
    CosmeticItem("title_honor", "title", "Honor Roll", 700, "rare", "Honor Roll|#7dff9e"),
    CosmeticItem("title_speedrun", "title", "Speedrunner", 900, "epic", "Speedrunner|#19e6ff"),
    CosmeticItem("title_vip", "title", "VIP", 1000, "epic", "VIP|#ffd24a"),
    CosmeticItem("title_veteran", "title", "Backrooms Veteran", 1200, "epic", "Backrooms Veteran|#c9a227"),
    CosmeticItem("title_king", "title", "Pausenkönig", 1800, "legendary", "Pausenkönig|#ffd24a"),
    # --- backpacks (worn on the back, local space +Z) ---
    CosmeticItem("backpack_none", "backpack", "Ohne Rucksack", 0, "common", "", True),
    CosmeticItem(
        "backpack_schul", "backpack", "Schulrucksack", 200, "common",
        "models/cosmetics/backpack_rucksack",
        attachment=CosmeticAttachment(x=0.0, y=0.10, z=0.34, scale=0.13),
    ),
    CosmeticItem(
        "backpack_turnbeutel", "backpack", "Turnbeutel", 250, "common", "models/cosmetics/backpack_turnbeutel",
        attachment=CosmeticAttachment(x=0.0, y=0.05, z=0.32, scale=0.13),
    ),
    CosmeticItem(
        "backpack_koffer", "backpack", "Retro-Koffer", 450, "rare",
        "models/cosmetics/backpack_koffer",
        attachment=CosmeticAttachment(x=0.0, y=0.05, z=0.35, scale=0.8),
    ),
    CosmeticItem(
        "backpack_abfallsack", "backpack", "Abfallsack", 500, "rare",
        "models/cosmetics/backpack_abfallsack",
        attachment=CosmeticAttachment(x=0.0, y=0.05, z=0.34, scale=1.0),
    ),
    CosmeticItem(
        "backpack_karton", "backpack", "Umzugskarton", 800, "epic",
        "models/cosmetics/backpack_karton",
        attachment=CosmeticAttachment(x=0.0, y=0.15, z=0.36, scale=1.7),
    ),
    CosmeticItem(
        "backpack_schwimmweste", "backpack", "Schwimmweste", 900, "epic",
        "models/cosmetics/backpack_schwimmweste",
        attachment=CosmeticAttachment(x=0.0, y=0.15, z=0.30, scale=0.65),
    ),
    CosmeticItem(
        "backpack_zement", "backpack", "Zementsack", 1400, "legendary",
        "models/cosmetics/backpack_zement",
        attachment=CosmeticAttachment(x=0.0, y=0.05, z=0.34, scale=3.0),
    ),
    CosmeticItem(
        "backpack_sani", "backpack", "Sanitätsrucksack", 0, "epic",
        "models/pickups/medkit", unlock="ach_medic",
        attachment=CosmeticAttachment(x=0.0, y=0.15, z=0.32, scale=1.2),
    ),
    # --- masks (worn on the face, local space -Z) ---
    CosmeticItem("mask_none", "mask", "Ohne Maske", 0, "common", "", True),
    CosmeticItem(
        "mask_schutzbrille", "mask", "Schutzbrille", 250, "common", "models/cosmetics/mask_schutzbrille",
        attachment=CosmeticAttachment(x=0.0, y=0.25, z=-0.33, scale=0.18),
    ),
    CosmeticItem(
        "mask_papiertuete", "mask", "Papiertüte", 400, "rare", "models/cosmetics/mask_papiertuete",
        attachment=CosmeticAttachment(x=0.0, y=0.20, z=-0.30, scale=0.9),
    ),
    CosmeticItem(
        "mask_rennbrille", "mask", "Rennbrille", 0, "rare", "models/cosmetics/mask_rennbrille",
        unlock="ach_speedrun",
        attachment=CosmeticAttachment(x=0.0, y=0.25, z=-0.33, scale=0.17),
    ),
    CosmeticItem(
        "mask_gas", "mask", "Gasmaske", 1200, "legendary", "models/pickups/goggles",
        attachment=CosmeticAttachment(x=0.0, y=0.22, z=-0.32, scale=1.0),
    ),
    # --- hats (new glTF hat alongside the procedural ones above) ---
    CosmeticItem(
        "hat_fischer", "hat", "Fischerhut", 700, "epic",
        "models/cosmetics/hat_fischer",
        attachment=CosmeticAttachment(x=0.0, y=0.85, z=0.0, scale=0.18),
    ),
    # --- hand items (first-person held-chair viewmodel, camera space) ---
    CosmeticItem("handitem_stuhl", "handitem", "Standard-Stuhl", 0, "common", "", True),
    CosmeticItem(
        "handitem_besen", "handitem", "Hausmeister-Besen", 300, "common",
        "models/cosmetics/handitem_besen",
        attachment=CosmeticAttachment(x=0.25, y=-0.20, z=0.40, scale=0.7),
    ),
    CosmeticItem(
        "handitem_lupe", "handitem", "Lupe", 400, "rare",
        "models/cosmetics/handitem_lupe",
        attachment=CosmeticAttachment(x=0.22, y=-0.18, z=0.35, scale=1.0),
    ),
    CosmeticItem(
        "handitem_taschenlampe", "handitem", "Taschenlampe", 550, "rare",
        "models/cosmetics/handitem_taschenlampe",
        attachment=CosmeticAttachment(x=0.24, y=-0.19, z=0.38, scale=0.11),
    ),
    CosmeticItem(
        "handitem_werkzeugkoffer", "handitem", "Werkzeugkoffer", 800, "epic",
        "models/cosmetics/handitem_werkzeugkoffer",
        attachment=CosmeticAttachment(x=0.26, y=-0.22, z=0.42, scale=0.7),
    ),
    CosmeticItem(
        "handitem_megafon", "handitem", "Megafon", 1500, "legendary",
        "models/cosmetics/handitem_megafon",
        attachment=CosmeticAttachment(x=0.25, y=-0.20, z=0.40, scale=1.0),
    ),
    CosmeticItem(
        "handitem_signal", "handitem", "Signal-Lampe", 0, "epic",
        "models/cosmetics/handitem_signal", unlock="ach_houdini",
        attachment=CosmeticAttachment(x=0.25, y=-0.20, z=0.40, scale=0.33),
    ),
]


class CosmeticCatalog:
    def __init__(self) -> None:
        self._items = _ITEMS
        self._by_id = {it.id: it for it in _ITEMS}
        self._daily_selection = DailyFeaturedSelection()

    def get(self, cosmetic_id: str | None) -> CosmeticItem | None:
        if cosmetic_id is None:
            return None
        return self._by_id.get(cosmetic_id)

    def items(self) -> list[CosmeticItem]:
        return list(self._items)

    def default_ids(self) -> set[str]:
        return {it.id for it in self._items if it.default}

    def default_equipped(self) -> dict[str, str]:
        return {it.category: it.id for it in self._items if it.default}

    def ids_unlocked_by(self, achievement_ids: set[str]) -> set[str]:
        return {it.id for it in self._items if it.unlock and it.unlock in achievement_ids}

    def featured_ids(self, day: date) -> set[str]:
        return self._daily_selection.select(self._items, day)

    def purchase_rejection(self, item: CosmeticItem) -> str | None:
        if item.default:
            return "owned"
        if item.is_locked:
            return "locked"
        return None

    def to_dto(self, day: date) -> list[dict]:
        featured = self.featured_ids(day)
        return [
            {
                "id": it.id, "category": it.category, "name": it.name,
                "price": it.price, "rarity": it.rarity,
                "assetRef": it.asset_ref, "default": it.default,
                "attach": it.attachment.to_dto() if it.attachment is not None else None,
                "featured": it.id in featured,
                "unlock": it.unlock,
            }
            for it in self._items
        ]

    def validate_equipped(self, equipped: dict[str, str]) -> dict[str, str]:
        out: dict[str, str] = {}
        for category, cosmetic_id in equipped.items():
            item = self._by_id.get(cosmetic_id)
            if item is not None and item.category == category:
                out[category] = cosmetic_id
        return out


cosmetic_catalog = CosmeticCatalog()
