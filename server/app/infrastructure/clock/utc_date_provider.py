from datetime import date, datetime, timezone

from app.application.abstractions.date_provider import IDateProvider


class UtcDateProvider(IDateProvider):
    def today(self) -> date:
        return datetime.now(timezone.utc).date()
