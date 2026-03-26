from fastapi import APIRouter, HTTPException, Query, status

from ..models import CashSession, CashSessionClose, CashSessionOpen, DailyCashSummary, ReportSummary
from ..repository import repository


router = APIRouter(tags=["reports"])


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


@router.post("/cash-session/open", response_model=CashSession, status_code=status.HTTP_201_CREATED)
def open_cash_session(payload: CashSessionOpen) -> CashSession:
    try:
        return repository.open_cash_session(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/cash-session/close", response_model=CashSession)
def close_cash_session(payload: CashSessionClose) -> CashSession:
    try:
        return repository.close_cash_session(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
