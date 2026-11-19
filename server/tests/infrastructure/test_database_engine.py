from __future__ import annotations

from app.infrastructure.persistence.engine import CONNECT_TIMEOUT_S, DatabaseEngine


class FakePool:
    def __init__(self, wait_error: Exception | None) -> None:
        self.wait_error = wait_error
        self.waited_with: float | None = None

    async def wait(self, timeout: float) -> None:
        self.waited_with = timeout
        if self.wait_error is not None:
            raise self.wait_error


class FakeBackend:
    def __init__(self, pool: FakePool) -> None:
        self.pool = pool


class FakeDatabase:
    def __init__(
        self,
        connect_error: Exception | None = None,
        close_error: Exception | None = None,
        pool_error: Exception | None = None,
    ) -> None:
        self.connect_error = connect_error
        self.close_error = close_error
        self.pool_backend = FakeBackend(FakePool(pool_error))
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


class TestFirstConnection:
    async def test_a_pool_that_opens_without_connecting_is_not_available(self):
        database = FakeDatabase(pool_error=TimeoutError("pool timeout"))
        engine = DatabaseEngine(database)

        await engine.connect()

        assert not engine.is_available
        assert database.closed == 1

    async def test_the_engine_waits_a_bounded_time_for_the_first_connection(self):
        database = FakeDatabase()
        engine = DatabaseEngine(database)

        await engine.connect()

        assert database.pool_backend.pool.waited_with == CONNECT_TIMEOUT_S
        assert engine.is_available
