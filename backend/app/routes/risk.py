from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/risk", tags=["Risk"])

@router.get("/", response_model=List[schemas.SupplierRiskScore])
def get_risk(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return core_service.get_risk_scores(db, skip=skip, limit=limit)
