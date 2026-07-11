from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/news", tags=["News"])

@router.get("/", response_model=List[schemas.NewsEvent])
def get_news(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return core_service.get_news_events(db, skip=skip, limit=limit)
