from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .device_service import device_service
from .logging_config import get_logger
from .repository import repository
from .routers import devices, items, reports
from .runtime_paths import resource_root

logger = get_logger("api")
FRONTEND_DIST = resource_root() / "frontend" / "dist"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Inicializando backend local.")
    repository.initialize()
    device_service.initialize()
    yield
    logger.info("Cierre de backend local.")


app = FastAPI(
    title="AppStock API",
    version="0.4.0",
    description="Backend local para control de stock y tesorería.",
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


@app.get("/assets/{asset_path:path}", include_in_schema=False)
def serve_frontend_assets(asset_path: str) -> FileResponse:
    asset_file = FRONTEND_ASSETS / asset_path
    if not asset_file.exists() or not asset_file.is_file():
        raise HTTPException(status_code=404, detail="Recurso no encontrado.")
    return FileResponse(asset_file)


@app.get("/", include_in_schema=False)
def serve_frontend_index() -> FileResponse:
    index_file = FRONTEND_DIST / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend compilado no disponible.")
    return FileResponse(index_file)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend_spa(full_path: str) -> FileResponse:
    if full_path.startswith("api/") or full_path == "health":
        raise HTTPException(status_code=404, detail="Ruta no encontrada.")

    requested_file = FRONTEND_DIST / full_path
    if requested_file.exists() and requested_file.is_file():
        return FileResponse(requested_file)

    index_file = FRONTEND_DIST / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend compilado no disponible.")
    return FileResponse(index_file)
