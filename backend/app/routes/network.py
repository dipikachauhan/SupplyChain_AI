from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import core_service

router = APIRouter(prefix="/network", tags=["Supply Chain Network"])


@router.get("/overview")
def get_network_overview(
    country: str | None = Query(None),
    supplier_id: str | None = Query(None),
    product_id: str | None = Query(None),
    risk_level: str | None = Query(None),
    db: Session = Depends(get_db),
):
    return core_service.get_network_overview(
        db, country=country, supplier_id=supplier_id,
        product_id=product_id, risk_level=risk_level,
    )


@router.get("/nodes/{node_id}")
def get_network_node(node_id: str, db: Session = Depends(get_db)):
    return core_service.get_network_node_detail(db, node_id)
