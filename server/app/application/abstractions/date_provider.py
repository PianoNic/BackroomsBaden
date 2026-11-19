from abc import ABC, abstractmethod
from datetime import date


class IDateProvider(ABC):
    @abstractmethod
    def today(self) -> date: ...
