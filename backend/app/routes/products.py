from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("", response_model=List[schemas.ProductSummary], include_in_schema=False)
@router.get("/", response_model=List[schemas.ProductSummary])
def get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None),
    category: str | None = Query(None),
    criticality: str | None = Query(None),
    risk: str | None = Query(None),
    sort: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return core_service.get_products(
        db, skip=skip, limit=limit, search=search, category=category,
        criticality=criticality, risk=risk, sort=sort,
    )

@router.get("/summary", response_model=schemas.ProductDashboardSummary)
def get_products_summary(db: Session = Depends(get_db)):
    return core_service.get_products_summary(db)

@router.get("/{product_id}", response_model=schemas.ProductDetail)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = core_service.get_product_detail(db, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
