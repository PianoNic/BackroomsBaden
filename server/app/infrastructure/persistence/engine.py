from __future__ import annotations

import logging

import peewee_async

from app.application.abstractions.database_availability import IDatabaseAvailability
from app.infrastructure.configuration.settings import Settings, settings

log = logging.getLogger("nachsitzen.db")

CONNECT_TIMEOUT_S = 5.0


class DatabaseEngine(IDatabaseAvailability):
    def __init__(self, database) -> None:
        self._database = database
        self._ready = False

    @classmethod
    def from_settings(cls, settings: Settings) -> "DatabaseEngine":
        database = peewee_async.Psycopg3Database(
            database=settings.db_name,
            user=settings.db_user,
            password=settings.db_password,
            host=settings.db_host,
            port=settings.db_port,
            pool_params={"min_size": settings.db_pool_min, "max_size": settings.db_pool_max},
        )
        return cls(database)

    @property
    def database(self):
        return self._database

    @property
    def is_available(self) -> bool:
        return self._ready

    async def connect(self) -> None:
        try:
            await self._database.aio_connect()
            await self._wait_for_first_connection()
            self._ready = True
            log.info("Database connected (%s:%s/%s)",
                     settings.db_host, settings.db_port, settings.db_name)
        except Exception as exc:  # noqa: BLE001 — DB is optional, never fatal
            self._ready = False
            log.warning("Database unavailable — accounts/persistence disabled: %s", exc)
            await self._stop_retrying()

    async def _wait_for_first_connection(self) -> None:
        backend = getattr(self._database, "pool_backend", None)
        pool = getattr(backend, "pool", None)
        if pool is not None:
            await pool.wait(timeout=CONNECT_TIMEOUT_S)

    async def _stop_retrying(self) -> None:
        try:
            await self._database.aio_close()
        except Exception as exc:  # noqa: BLE001
            log.debug("Closing the unreachable database pool failed: %s", exc)

    async def disconnect(self) -> None:
        if self._ready:
            await self._database.aio_close()
            self._ready = False


database_engine = DatabaseEngine.from_settings(settings)
