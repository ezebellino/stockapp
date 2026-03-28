import csv
from io import StringIO

from fastapi import APIRouter, HTTPException, Query, Response, status

from ..logging_config import get_logger
from ..models import CashSession, CashSessionClose, CashSessionOpen, DailyCashSummary, DailySalesPoint, ReportSummary
from ..repository import repository


router = APIRouter(tags=["reports"])
logger = get_logger("reports")


@router.get("/reports/summary", response_model=ReportSummary)
def get_report_summary(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
) -> ReportSummary:
    return repository.get_report_summary(start_date=start_date, end_date=end_date)


@router.get("/reports/cash-summary", response_model=DailyCashSummary)
def get_cash_summary(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
) -> DailyCashSummary:
    return repository.get_daily_cash_summary(start_date=start_date, end_date=end_date)


@router.get("/reports/daily-sales", response_model=list[DailySalesPoint])
def get_daily_sales(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    limit: int = Query(default=14, ge=1, le=90),
) -> list[DailySalesPoint]:
    return repository.get_daily_sales_series(start_date=start_date, end_date=end_date, limit=limit)


@router.get("/reports/export.csv")
def export_reports_csv(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
) -> Response:
    report_summary = repository.get_report_summary(start_date=start_date, end_date=end_date)
    cash_summary = repository.get_daily_cash_summary(start_date=start_date, end_date=end_date)
    sales = repository.list_sales_for_period(start_date=start_date, end_date=end_date)
    sessions = repository.list_cash_sessions_for_period(start_date=start_date, end_date=end_date)

    buffer = StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["tipo", "campo", "valor"])
    writer.writerow(["periodo", "desde", start_date or ""])
    writer.writerow(["periodo", "hasta", end_date or ""])
    writer.writerow(["resumen", "recaudacion", report_summary.total_revenue])
    writer.writerow(["resumen", "ganancia", report_summary.total_profit])
    writer.writerow(["resumen", "ventas", report_summary.total_sales_count])
    writer.writerow(["resumen", "unidades_vendidas", report_summary.total_units_sold])
    writer.writerow(["caja", "esperado", cash_summary.expected_cash_now])
    writer.writerow([])

    writer.writerow(["ventas", "id", "codigo", "producto", "categoria", "cantidad", "precio_unitario", "medio_pago", "total", "recaudacion", "ganancia", "fecha"])
    for sale in sales:
        writer.writerow([
            "venta",
            sale.id,
            sale.code,
            sale.item_name,
            sale.category,
            sale.quantity,
            sale.unit_price,
            sale.payment_method,
            sale.total_amount,
            sale.revenue,
            sale.profit,
            sale.created_at,
        ])

    writer.writerow([])
    writer.writerow(["jornadas", "id", "estado", "apertura", "cierre", "monto_inicial", "esperado", "real", "diferencia", "notas"])
    for session in sessions:
        writer.writerow([
            "jornada",
            session.id,
            session.status,
            session.opened_at,
            session.closed_at or "",
            session.opening_amount,
            session.expected_cash_amount,
            session.actual_cash_amount or "",
            session.difference_amount or "",
            session.notes,
        ])

    filename = f"tesoreria_{start_date or 'inicio'}_{end_date or 'hoy'}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/cash-session/open", response_model=CashSession, status_code=status.HTTP_201_CREATED)
def open_cash_session(payload: CashSessionOpen) -> CashSession:
    try:
        return repository.open_cash_session(payload)
    except ValueError as exc:
        logger.warning("No se pudo abrir caja: %s", exc)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/cash-session/close", response_model=CashSession)
def close_cash_session(payload: CashSessionClose) -> CashSession:
    try:
        return repository.close_cash_session(payload)
    except ValueError as exc:
        logger.warning("No se pudo cerrar caja: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


