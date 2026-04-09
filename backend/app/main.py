from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .device_service import device_service
from .logging_config import get_logger
from .repository import repository
from .routers import devices, items, reports

logger = get_logger("api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Inicializando backend local.")
    repository.initialize()
    device_service.initialize()
    yield
    logger.info("Cierre de backend local.")


app = FastAPI(
    title="AppStock API",
    version="0.2.0",
    description="Backend local para control de stock y tesoreria.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_server_errors(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Error no controlado en %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor."})

    if response.status_code >= 500:
        logger.error("Respuesta 5xx en %s %s", request.method, request.url.path)
    return response


app.include_router(items.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(devices.router, prefix="/api")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
