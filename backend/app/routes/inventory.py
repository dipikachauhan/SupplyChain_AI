from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import core as schemas
from app.services import core_service

router = APIRouter(prefix="/inventory", tags=["Inventory"])

@router.get("", response_model=List[schemas.InventorySummary], include_in_schema=False)
@router.get("/", response_model=List[schemas.InventorySummary])
def get_inventory(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None),
    warehouse: str | None = Query(None),
    category: str | None = Query(None),
    status: str | None = Query(None),
    sort: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return core_service.get_inventory(
        db, skip=skip, limit=limit, search=search, warehouse=warehouse,
        category=category, status=status, sort=sort,
    )

@router.get("/summary", response_model=schemas.InventoryDashboardSummary)
def get_inventory_summary(db: Session = Depends(get_db)):
    return core_service.get_inventory_summary(db)

@router.get("/{item_id}", response_model=schemas.InventoryDetail)
def get_inventory_item(item_id: str, db: Session = Depends(get_db)):
    item = core_service.get_inventory_detail(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item
