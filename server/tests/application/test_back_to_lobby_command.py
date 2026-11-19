from app.application.commands.back_to_lobby_command import BackToLobbyCommand, BackToLobbyHandler

from ..conftest import add_hideout, add_player, make_lobby


async def test_ignored_while_the_round_is_not_over():
    lobby = make_lobby()
    lobby.phase = "escape"
    me = add_player(lobby)

    did_reset = await BackToLobbyHandler().handle(BackToLobbyCommand(lobby, me))

    assert did_reset is False
    assert lobby.phase == "escape"


async def test_resets_runtime_state_and_returns_to_waiting():
    lobby = make_lobby()
    lobby.phase = "won"
    me = add_player(lobby)
    add_hideout(lobby, "h1", 10.0, 10.0, occupied_by=me.id)
    me.hidden_in = "h1"
    me.tasks_done = 3
    lobby.dead.add("someone")
    lobby.rewards_applied = True
    lobby.round_rewards = {"someone": {"xpEarned": 1}}

    did_reset = await BackToLobbyHandler().handle(BackToLobbyCommand(lobby, me))

    assert did_reset is True
    assert lobby.status == "waiting"
    assert lobby.phase == "tasks"
    assert lobby.hideouts == {}
    assert me.hidden_in is None
    assert me.tasks_done == 0
    assert lobby.dead == set()
    assert lobby.rewards_applied is False
    assert lobby.round_rewards == {}


async def test_admin_reclaims_the_role_with_the_resume_token_after_the_reset():
    lobby = make_lobby()
    lobby.phase = "won"
    host = add_player(lobby, "host")
    guest = add_player(lobby, "guest")
    lobby.admin_id = host.id

    await BackToLobbyHandler().handle(BackToLobbyCommand(lobby, guest))
    token = lobby.admin_resume_token
    lobby.admin_id = guest.id

    assert token
    assert lobby.claim_admin("host-new", "wrong") is False
    assert lobby.admin_id == guest.id
    assert lobby.claim_admin("host-new", token) is True
    assert lobby.admin_id == "host-new"
    assert lobby.admin_resume_token is None
    assert lobby.claim_admin("intruder", token) is False
    assert lobby.admin_id == "host-new"


async def test_starting_a_round_discards_the_resume_token():
    lobby = make_lobby()
    lobby.admin_id = "host"
    token = lobby.issue_admin_resume_token()

    lobby.clear_admin_resume_token()

    assert lobby.claim_admin("host-new", token) is False
