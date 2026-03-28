from sqlite3 import IntegrityError

from fastapi import APIRouter, HTTPException, Query, Response, status

from ..logging_config import get_logger
from ..models import (
    Category,
    CategoryCreate,
    InventoryMovement,
    SaleCreate,
    SaleRecord,
    StockAdjustment,
    StockItem,
    StockItemCreate,
    StockItemUpdate,
)
from ..repository import repository


router = APIRouter(tags=["items"])
logger = get_logger("items")


@router.get("/categories", response_model=list[Category])
def list_categories() -> list[Category]:
    return repository.list_categories()


@router.post("/categories", response_model=Category, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate) -> Category:
    try:
        return repository.create_category(payload.name)
    except ValueError as exc:
        logger.warning("No se pudo crear la categoria '%s': %s", payload.name, exc)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/items", response_model=list[StockItem])
def list_items() -> list[StockItem]:
    return repository.list_items()


@router.get("/items/{item_id}", response_model=StockItem)
def get_item(item_id: int) -> StockItem:
    item = repository.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado.")
    return item


@router.get("/items/code/{code}", response_model=StockItem)
def get_item_by_code(code: str) -> StockItem:
    item = repository.get_by_code(code)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado.")
    return item


@router.get("/items/{item_id}/movements", response_model=list[InventoryMovement])
def get_item_movements(item_id: int, limit: int = Query(default=20, ge=1, le=100)) -> list[InventoryMovement]:
    return repository.list_movements(limit=limit, item_id=item_id)


@router.get("/movements", response_model=list[InventoryMovement])
def list_movements(limit: int = Query(default=20, ge=1, le=100)) -> list[InventoryMovement]:
    return repository.list_movements(limit=limit)


@router.post("/items", response_model=StockItem, status_code=status.HTTP_201_CREATED)
def create_item(payload: StockItemCreate) -> StockItem:
    if repository.get_by_code(payload.code):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un producto con ese codigo.",
        )
    return repository.create_item(payload)


@router.put("/items/{item_id}", response_model=StockItem)
def update_item(item_id: int, payload: StockItemUpdate) -> StockItem:
    existing = repository.get_by_code(payload.code)
    if existing is not None and existing.id != item_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe otro producto con ese codigo.",
        )

    try:
        item = repository.update_item(item_id, payload)
    except IntegrityError as exc:
        logger.exception("Conflicto al actualizar item %s con codigo %s", item_id, payload.code)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo actualizar el producto por un conflicto de codigo.",
        ) from exc

    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado.")
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int) -> Response:
    deleted = repository.delete_item(item_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/items/{code}/scan", response_model=StockItem)
def scan_item(code: str, payload: StockAdjustment) -> StockItem:
    item = repository.increase_stock(code, payload.amount)
    if item is None:
        logger.warning("Escaneo fallido para codigo inexistente: %s", code)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado para el codigo escaneado.",
        )
    return item


@router.post("/sales", response_model=SaleRecord, status_code=status.HTTP_201_CREATED)
def create_sale(payload: SaleCreate) -> SaleRecord:
    try:
        sale, _item = repository.record_sale(payload)
    except ValueError as exc:
        logger.warning("No se pudo registrar venta para codigo %s: %s", payload.code, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return sale
