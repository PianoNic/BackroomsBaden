from mediatorx import DictResolver, Mediator

from app.application.commands.end_round_command import EndRoundCommand, EndRoundHandler
from app.application.notifications.persist_rewards_handler import PersistRewardsHandler
from app.application.notifications.round_ended_notification import RoundEndedNotification
from app.application.notifications.unlock_achievements_handler import UnlockAchievementsHandler
from app.domain.achievements.achievement_catalog import achievement_catalog
from app.domain.cosmetics.cosmetic_catalog import CosmeticCatalog
from app.domain.progression.achievement_evaluator import AchievementEvaluator
from app.domain.progression.level_calculator import LevelCalculator
from app.domain.progression.reward_calculator import RewardCalculator
from app.domain.progression.scoreboard_builder import ScoreboardBuilder
from app.infrastructure.persistence.repositories.peewee_account_repository import PeeweeAccountRepository
from app.infrastructure.persistence.repositories.peewee_achievement_repository import (
    PeeweeAchievementRepository,
)
from app.infrastructure.persistence.repositories.peewee_profile_repository import PeeweeProfileRepository

from ..conftest import add_player, make_lobby


def _build_mediator(engine, levels: LevelCalculator) -> Mediator:
    profiles = PeeweeProfileRepository(engine)
    achievements = PeeweeAchievementRepository(engine)
    scoreboard_builder = ScoreboardBuilder(RewardCalculator(), levels)

    resolver = DictResolver()
    mediator = Mediator(resolver=resolver)
    resolver.add_factory(EndRoundHandler, lambda: EndRoundHandler(scoreboard_builder, mediator))
    resolver.add_factory(PersistRewardsHandler, lambda: PersistRewardsHandler(profiles, levels, engine))
    resolver.add_factory(
        UnlockAchievementsHandler,
        lambda: UnlockAchievementsHandler(
            AchievementEvaluator(), achievements, achievement_catalog, profiles, engine,
        ),
    )
    mediator.register(EndRoundCommand, EndRoundHandler)
    mediator.register_notification(RoundEndedNotification, PersistRewardsHandler)
    mediator.register_notification(RoundEndedNotification, UnlockAchievementsHandler)
    return mediator


async def test_a_guest_connection_gets_saved_false(account_engine):
    lobby = make_lobby()
    lobby.phase = "escape"
    guest = add_player(lobby, "guest")
    lobby.extracted.add(guest.id)

    mediator = _build_mediator(account_engine, LevelCalculator())
    await mediator.send(EndRoundCommand(lobby, "won"))

    frame = guest.channel.json_sent[-1]
    assert frame["type"] == "game_won"
    assert frame["scoreboard"]["selfRewards"]["saved"] is False


async def test_each_connection_receives_its_own_reward_block(account_engine):
    lobby = make_lobby()
    lobby.phase = "escape"
    a = add_player(lobby, "a")
    b = add_player(lobby, "b")
    lobby.extracted.add("a")
    lobby.dead.add("b")

    mediator = _build_mediator(account_engine, LevelCalculator())
    await mediator.send(EndRoundCommand(lobby, "won"))

    frame_a = a.channel.json_sent[-1]
    frame_b = b.channel.json_sent[-1]
    assert frame_a["scoreboard"]["selfRewards"] is not None
    assert frame_b["scoreboard"]["selfRewards"] is not None
    assert frame_a["scoreboard"]["selfRewards"] != frame_b["scoreboard"]["selfRewards"]


async def test_signed_in_account_reflects_its_persisted_level(account_engine):
    levels = LevelCalculator()
    accounts = PeeweeAccountRepository(account_engine)
    acct = await accounts.upsert("google", "sub-1", "Hans Ueli")
    profiles = PeeweeProfileRepository(account_engine)
    await profiles.ensure(acct.id)
    await profiles.apply_round_rewards(acct.id, 5_000, 0)
    expected_level_before, _, _ = levels.level_from_total(5_000)

    lobby = make_lobby()
    lobby.phase = "escape"
    player = add_player(lobby, "signed_in")
    player.account_id = acct.id
    lobby.extracted.add(player.id)

    mediator = _build_mediator(account_engine, levels)
    await mediator.send(EndRoundCommand(lobby, "won"))

    rewards = player.channel.json_sent[-1]["scoreboard"]["selfRewards"]
    assert rewards["saved"] is True
    assert rewards["levelBefore"] == expected_level_before


class _StubEvaluator:
    def __init__(self, earned):
        self._earned = earned

    def evaluate_round(self, lobby, result, player, duration_ms):
        return list(self._earned)


async def test_new_achievement_unlock_grants_its_cosmetic_in_lobby(account_engine):
    profiles = PeeweeProfileRepository(account_engine)
    handler = UnlockAchievementsHandler(
        _StubEvaluator(["ach_medic"]), PeeweeAchievementRepository(account_engine),
        achievement_catalog, profiles, account_engine, CosmeticCatalog(),
    )
    acct = await PeeweeAccountRepository(account_engine).upsert("google", "sub-ach", "Hans Ueli")
    await profiles.ensure(acct.id)
    lobby = make_lobby()
    me = add_player(lobby, "me")
    me.account_id = acct.id

    await handler.handle(RoundEndedNotification(lobby, "won", {me.id: {}}, 1000))

    assert "backpack_sani" in me.owned_cosmetics
