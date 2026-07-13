from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.simulation_service import run_simulation

router = APIRouter(prefix="/simulation", tags=["Simulation"])


class SimulationRequest(BaseModel):
    supplier_id: str
    inventory_reduction: int = Field(0, ge=0, le=100)
    shipping_delay_days: int = Field(0, ge=0, le=60)
    demand_increase: int = Field(0, ge=0, le=100)
    geopolitical_risk: str = "Low"


@router.post("/run")
def run_supply_chain_simulation(request: SimulationRequest, db: Session = Depends(get_db)):
    if request.geopolitical_risk not in {"Low", "Medium", "High"}:
        raise HTTPException(status_code=422, detail="Geopolitical risk must be Low, Medium, or High.")
    return run_simulation(db, **request.model_dump())
