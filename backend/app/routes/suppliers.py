from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])

@router.get("", response_model=List[schemas.SupplierSummary], include_in_schema=False)
@router.get("/", response_model=List[schemas.SupplierSummary])
def get_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None),
    country: str | None = Query(None),
    criticality: str | None = Query(None),
    risk_level: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return core_service.get_suppliers(
        db,
        skip=skip,
        limit=limit,
        q=q,
        country=country,
        criticality=criticality,
        risk_level=risk_level,
    )

@router.get("/high-risk", response_model=List[schemas.SupplierSummary])
def get_high_risk_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return core_service.get_suppliers(db, skip=skip, limit=limit, risk_level="High")

@router.get("/search", response_model=List[schemas.SupplierSummary])
def search_suppliers(
    q: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return core_service.get_suppliers(db, skip=skip, limit=limit, q=q)

@router.get("/country/{country}", response_model=List[schemas.SupplierSummary])
def get_suppliers_by_country(
    country: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return core_service.get_suppliers(db, skip=skip, limit=limit, country=country)

@router.get("/criticality/{level}", response_model=List[schemas.SupplierSummary])
def get_suppliers_by_criticality(
    level: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return core_service.get_suppliers(db, skip=skip, limit=limit, criticality=level)

@router.get("/{supplier_id}", response_model=schemas.SupplierDetail)
def get_supplier(supplier_id: str, db: Session = Depends(get_db)):
    supplier = core_service.get_supplier_detail(db, supplier_id=supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier
