from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/logistics", tags=["Logistics"])

@router.get("/", response_model=List[schemas.Logistics])
def get_logistics(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return core_service.get_logistics(db, skip=skip, limit=limit)
