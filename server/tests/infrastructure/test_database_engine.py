from __future__ import annotations

from app.infrastructure.persistence.engine import DatabaseEngine


class FakeDatabase:
    def __init__(self, connect_error: Exception | None = None, close_error: Exception | None = None) -> None:
        self.connect_error = connect_error
        self.close_error = close_error
        self.closed = 0

    async def aio_connect(self) -> None:
        if self.connect_error is not None:
            raise self.connect_error

    async def aio_close(self) -> None:
        self.closed += 1
        if self.close_error is not None:
            raise self.close_error


class TestConnect:
    async def test_a_reachable_database_marks_the_engine_available(self):
        engine = DatabaseEngine(FakeDatabase())

        await engine.connect()

        assert engine.is_available

    async def test_an_unreachable_database_closes_the_pool_so_it_stops_retrying(self):
        database = FakeDatabase(connect_error=TimeoutError("connection timeout expired"))
        engine = DatabaseEngine(database)

        await engine.connect()

        assert not engine.is_available
        assert database.closed == 1

    async def test_a_failing_close_never_breaks_startup(self):
        database = FakeDatabase(
            connect_error=TimeoutError("down"), close_error=RuntimeError("pool never opened"),
        )
        engine = DatabaseEngine(database)

        await engine.connect()

        assert not engine.is_available

    async def test_disconnect_after_a_failed_connect_does_not_close_again(self):
        database = FakeDatabase(connect_error=TimeoutError("down"))
        engine = DatabaseEngine(database)
        await engine.connect()

        await engine.disconnect()

        assert database.closed == 1
