from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CosmeticAttachment:
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    scale: float = 1.0
    yaw: float = 0.0
    pitch: float = 0.0

    def to_dto(self) -> dict:
        return {
            "x": self.x, "y": self.y, "z": self.z,
            "scale": self.scale, "yaw": self.yaw, "pitch": self.pitch,
        }
