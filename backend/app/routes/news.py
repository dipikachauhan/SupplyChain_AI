from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/news", tags=["News"])

@router.get("", response_model=List[schemas.NewsEventSummary], include_in_schema=False)
@router.get("/", response_model=List[schemas.NewsEventSummary])
def get_news(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), search: str | None = None, country: str | None = None, supplier: str | None = None, severity: str | None = None, category: str | None = None, date: str | None = None, sort: str | None = None, db: Session = Depends(get_db)):
    return core_service.get_news_events(db, skip, limit, search, country, supplier, severity, category, date, sort)

@router.get("/summary", response_model=schemas.NewsDashboardSummary)
def get_news_summary(db: Session = Depends(get_db)):
    return core_service.get_news_summary(db)

@router.get("/category/{category}", response_model=List[schemas.NewsEventSummary])
def get_news_by_category(category: str, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    return core_service.get_news_events(db, skip=skip, limit=limit, category=category)

@router.get("/{news_id}", response_model=schemas.NewsEventDetail)
def get_news_detail(news_id: int, db: Session = Depends(get_db)):
    event = core_service.get_news_detail(db, news_id)
    if event is None:
        raise HTTPException(status_code=404, detail="News event not found")
    return event
