from fastapi import APIRouter, HTTPException

from ..device_service import device_service
from ..logging_config import get_logger
from ..models import ScaleConfig, ScaleReadRequest, ScaleReadResult, ScaleStatus, SerialPortInfo

router = APIRouter(tags=["devices"])
logger = get_logger("devices-router")


@router.get("/devices/scale/status", response_model=ScaleStatus)
def get_scale_status() -> ScaleStatus:
    return device_service.get_scale_status()


@router.get("/devices/scale/config", response_model=ScaleConfig)
def get_scale_config() -> ScaleConfig:
    return device_service.get_scale_config()


@router.put("/devices/scale/config", response_model=ScaleConfig)
def update_scale_config(payload: ScaleConfig) -> ScaleConfig:
    return device_service.save_scale_config(payload)


@router.get("/devices/scale/ports", response_model=list[SerialPortInfo])
def list_scale_ports() -> list[SerialPortInfo]:
    return device_service.list_serial_ports()


@router.post("/devices/scale/read", response_model=ScaleReadResult)
def read_scale(payload: ScaleReadRequest | None = None) -> ScaleReadResult:
    try:
        simulated_weight = payload.simulated_weight if payload else None
        return device_service.read_scale(simulated_weight=simulated_weight)
    except ValueError as exc:
        logger.warning("Lectura de balanza rechazada: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
