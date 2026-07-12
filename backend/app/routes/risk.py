from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/risk", tags=["Risk"])

@router.get("", response_model=List[schemas.RiskRecord], include_in_schema=False)
@router.get("/", response_model=List[schemas.RiskRecord])
def get_risk(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None),
    country: str | None = Query(None),
    supplier: str | None = Query(None),
    risk: str | None = Query(None),
    criticality: str | None = Query(None),
    category: str | None = Query(None),
    sort: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return core_service.get_risks(
        db, skip=skip, limit=limit, search=search, country=country,
        supplier=supplier, risk=risk, criticality=criticality, category=category, sort=sort,
    )

@router.get("/summary", response_model=schemas.RiskDashboardSummary)
def get_risk_summary(db: Session = Depends(get_db)):
    return core_service.get_risk_summary(db)

@router.get("/{risk_id}", response_model=schemas.RiskDetail)
def get_risk_detail(risk_id: str, db: Session = Depends(get_db)):
    risk = core_service.get_risk_detail(db, risk_id)
    if risk is None:
        raise HTTPException(status_code=404, detail="Risk not found")
    return risk
