from fastapi import APIRouter

from ..models import ReportSummary
from ..repository import repository


router = APIRouter(tags=["reports"])


@router.get("/reports/summary", response_model=ReportSummary)
def get_report_summary() -> ReportSummary:
    return repository.get_report_summary()
