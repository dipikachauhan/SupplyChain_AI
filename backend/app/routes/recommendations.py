from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.ai_recommendation_service import generate_recommendation

router = APIRouter(prefix="/recommendations", tags=["AI Recommendations"])


class RecommendationRequest(BaseModel):
    country: str | None = None
    supplier_id: str | None = None
    risk_level: str | None = None


@router.post("/generate")
def create_ai_recommendation(request: RecommendationRequest, db: Session = Depends(get_db)):
    return generate_recommendation(db, country=request.country, supplier_id=request.supplier_id, risk_level=request.risk_level)
