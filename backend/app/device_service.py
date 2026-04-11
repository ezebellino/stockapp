from __future__ import annotations

import json
from abc import ABC, abstractmethod
from datetime import datetime

from .logging_config import get_logger
from .models import ScaleConfig, ScaleReadResult, ScaleStatus, SerialPortInfo
from .runtime_paths import app_root

logger = get_logger("devices")

try:
    import serial  # type: ignore
except ImportError:  # pragma: no cover
    serial = None

try:
    from serial.tools import list_ports  # type: ignore
except ImportError:  # pragma: no cover
    list_ports = None


class ScaleProvider(ABC):
    provider_name: str
    connection_type: str

    @abstractmethod
    def is_ready(self, config: ScaleConfig) -> tuple[bool, str]:
        raise NotImplementedError

    @abstractmethod
    def read_weight(self, config: ScaleConfig, *, simulated_weight: float | None = None) -> ScaleReadResult:
        raise NotImplementedError


class MockScaleProvider(ScaleProvider):
    provider_name = "mock"
    connection_type = "manual"

    def is_ready(self, config: ScaleConfig) -> tuple[bool, str]:
        if not config.enabled:
            return False, "La balanza está desactivada."
        return True, "Proveedor de prueba listo para simular lecturas."

    def read_weight(self, config: ScaleConfig, *, simulated_weight: float | None = None) -> ScaleReadResult:
        weight = config.simulated_weight if simulated_weight is None else simulated_weight
        return ScaleReadResult(
            provider=self.provider_name,
            connection_type=self.connection_type,
            weight=weight,
            unit=config.unit,
            stable=True,
            raw_value=f"SIM:{weight:.3f}{config.unit}",
            measured_at=datetime.now().isoformat(timespec="seconds"),
        )


class SerialScaleProvider(ScaleProvider):
    provider_name = "serial"
    connection_type = "serial"

    def is_ready(self, config: ScaleConfig) -> tuple[bool, str]:
        if not config.enabled:
            return False, "La balanza está desactivada."
        if serial is None:
            return False, "pyserial no está instalado en el entorno local."
        if not config.port:
            return False, "Falta configurar el puerto COM."
        return True, f"Proveedor serial listo para leer desde {config.port}."

    def read_weight(self, config: ScaleConfig, *, simulated_weight: float | None = None) -> ScaleReadResult:
        if serial is None:
            raise ValueError("pyserial no está instalado. Ejecutá la sincronización de dependencias del backend.")
        if not config.port:
            raise ValueError("No hay puerto configurado para la balanza serial.")

        timeout = max(config.timeout_ms / 1000, 0.1)
        with serial.Serial(config.port, baudrate=config.baudrate, timeout=timeout) as connection:  # type: ignore[attr-defined]
            samples: list[tuple[float, str]] = []
            max_attempts = max(config.stable_read_count * 3, config.stable_read_count)

            for _ in range(max_attempts):
                raw_bytes = connection.readline()
                if not raw_bytes:
                    continue
                raw_value = raw_bytes.decode(errors="ignore").strip()
                if not raw_value:
                    continue
                parsed = self._parse_weight(raw_value)
                if parsed is None:
                    continue
                samples.append((parsed, raw_value))
                if len(samples) >= config.stable_read_count:
                    break

        if len(samples) < config.stable_read_count:
            raise ValueError("No se pudo obtener una lectura estable desde la balanza serial.")

        weight, raw_value = samples[-1]
        return ScaleReadResult(
            provider=self.provider_name,
            connection_type=self.connection_type,
            weight=weight,
            unit=config.unit,
            stable=True,
            raw_value=raw_value,
            measured_at=datetime.now().isoformat(timespec="seconds"),
        )

    @staticmethod
    def _parse_weight(raw_value: str) -> float | None:
        cleaned = raw_value.strip().replace(",", ".")
        allowed = []
        decimal_seen = False
        sign_seen = False
        for char in cleaned:
            if char in "+-" and not sign_seen and not allowed:
                allowed.append(char)
                sign_seen = True
            elif char.isdigit():
                allowed.append(char)
            elif char == "." and not decimal_seen:
                allowed.append(char)
                decimal_seen = True
        if not allowed:
            return None
        try:
            return float("".join(allowed))
        except ValueError:
            return None


class DeviceService:
    def __init__(self) -> None:
        base_root = app_root()
        self._config_path = (base_root / "backend" / "data" / "device_settings.json") if (base_root / "backend").exists() else (base_root / "data" / "device_settings.json")
        self._providers: dict[str, ScaleProvider] = {
            "mock": MockScaleProvider(),
            "serial": SerialScaleProvider(),
        }

    def initialize(self) -> None:
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        if not self._config_path.exists():
            self.save_scale_config(ScaleConfig())

    def get_scale_config(self) -> ScaleConfig:
        self.initialize()
        raw = json.loads(self._config_path.read_text(encoding="utf-8"))
        scale_data = raw.get("scale", {})
        return ScaleConfig(**scale_data)

    def save_scale_config(self, config: ScaleConfig) -> ScaleConfig:
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"scale": config.model_dump()}
        self._config_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        logger.info("Configuración de balanza actualizada: provider=%s, connection_type=%s", config.provider, config.connection_type)
        return config

    def get_scale_status(self) -> ScaleStatus:
        config = self.get_scale_config()
        provider = self._providers.get(config.provider)
        if provider is None:
            return ScaleStatus(
                configured=False,
                enabled=config.enabled,
                provider=config.provider,
                connection_type=config.connection_type,
                ready=False,
                serial_supported=serial is not None,
                available_providers=sorted(self._providers),
                detail="El proveedor configurado no existe.",
            )

        ready, detail = provider.is_ready(config)
        configured = bool(config.port or config.host or provider.provider_name == "mock")
        return ScaleStatus(
            configured=configured,
            enabled=config.enabled,
            provider=config.provider,
            connection_type=config.connection_type,
            ready=ready,
            serial_supported=serial is not None,
            available_providers=sorted(self._providers),
            detail=detail,
        )

    def read_scale(self, *, simulated_weight: float | None = None) -> ScaleReadResult:
        config = self.get_scale_config()
        provider = self._providers.get(config.provider)
        if provider is None:
            raise ValueError("El proveedor configurado no está disponible.")
        ready, detail = provider.is_ready(config)
        if not ready:
            raise ValueError(detail)
        return provider.read_weight(config, simulated_weight=simulated_weight)

    def list_serial_ports(self) -> list[SerialPortInfo]:
        if serial is None or list_ports is None:
            return []
        ports = list_ports.comports()
        return [
            SerialPortInfo(device=port.device, description=port.description or port.device, hwid=port.hwid or "")
            for port in ports
        ]


device_service = DeviceService()
