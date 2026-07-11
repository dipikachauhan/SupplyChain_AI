from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/", response_model=schemas.DashboardMetrics)
def get_dashboard(db: Session = Depends(get_db)):
    return core_service.get_dashboard_metrics(db)
