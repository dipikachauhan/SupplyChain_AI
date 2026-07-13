import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models


RECOMMENDATION_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "executive_summary": {"type": "STRING"},
        "priority": {"type": "STRING", "enum": ["Critical", "High", "Medium", "Low"]},
        "confidence_score": {"type": "NUMBER"},
        "business_impact": {"type": "STRING"},
        "expected_risk_reduction": {"type": "STRING"},
        "recommended_actions": {
            "type": "ARRAY",
            "items": {"type": "OBJECT", "properties": {
                "title": {"type": "STRING"}, "description": {"type": "STRING"}, "owner": {"type": "STRING"}
            }, "required": ["title", "description", "owner"]}
        },
        "estimated_timeline": {"type": "STRING"},
        "estimated_cost": {"type": "STRING"},
        "related_supplier": {"type": "ARRAY", "items": {"type": "STRING"}},
        "related_news": {"type": "ARRAY", "items": {"type": "STRING"}},
        "related_risks": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["executive_summary", "priority", "confidence_score", "business_impact", "expected_risk_reduction", "recommended_actions", "estimated_timeline", "estimated_cost", "related_supplier", "related_news", "related_risks"],
}


def _record(item, fields):
    return {field: getattr(item, field, None) for field in fields}


def build_context(db: Session, country=None, supplier_id=None, risk_level=None):
    suppliers = db.query(models.Supplier).all()
    risks = db.query(models.SupplierRiskScore).all()
    risk_by_supplier = {risk.supplier_id: risk for risk in risks}
    visible_suppliers = [supplier for supplier in suppliers if (
        (not country or supplier.country == country)
        and (not supplier_id or supplier.supplier_id == supplier_id)
        and (not risk_level or (risk_by_supplier.get(supplier.supplier_id) and str(risk_by_supplier[supplier.supplier_id].risk_level).lower() == risk_level.lower()))
    )]
    visible_ids = {supplier.supplier_id for supplier in visible_suppliers}
    visible_risks = [risk for risk in risks if risk.supplier_id in visible_ids]
    news = [item for item in db.query(models.NewsEvent).all() if item.affected_supplier in visible_ids or (country and item.country == country)][:15]
    inventory = [item for item in db.query(models.Inventory).all() if item.supplier_id in visible_ids][:30]
    relationships = [item for item in db.query(models.SupplierRelationship).all() if item.source_supplier in visible_ids or item.target_supplier in visible_ids][:30]
    inventory_alerts = sum(1 for item in inventory if item.current_stock is not None and item.safety_stock is not None and item.current_stock < item.safety_stock)

    return {
        "filters": {"country": country, "supplier_id": supplier_id, "risk_level": risk_level},
        "kpis": {
            "monitored_suppliers": len(visible_suppliers),
            "high_risk_suppliers": sum(str(item.risk_level).lower() in {"high", "critical"} for item in visible_risks),
            "active_news_events": len(news),
            "inventory_alerts": inventory_alerts,
        },
        "suppliers": [_record(item, ["supplier_id", "supplier_name", "country", "component", "criticality", "lead_time_days", "capacity", "inventory_buffer", "backup_supplier", "status"]) for item in visible_suppliers[:20]],
        "risk_scores": [_record(item, ["supplier_id", "risk_probability", "business_impact", "risk_level", "last_updated"]) for item in visible_risks[:20]],
        "news_events": [_record(item, ["date", "headline", "country", "risk_category", "severity", "affected_supplier", "status"]) for item in news],
        "inventory_status": [_record(item, ["supplier_id", "warehouse", "current_stock", "safety_stock", "buffer_days"]) for item in inventory],
        "network_relationships": [_record(item, ["source_supplier", "target_supplier", "dependency_strength"]) for item in relationships],
    }


def _generate_with_gemini(context):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI recommendations are unavailable: set GEMINI_API_KEY in backend/.env (copy backend/.env.example) and restart the backend.")

    prompt = """You are ChainGuard AI, a supply-chain risk advisor. Analyze only the operational context below. Produce one actionable, evidence-based mitigation recommendation. Do not invent suppliers, news, risks, figures, or policies. Return JSON matching the supplied schema; confidence_score must be 0-100.\n\nOPERATIONAL CONTEXT:\n""" + json.dumps(context, default=str)
    request_body = {
        "systemInstruction": {"parts": [{"text": "Provide concise decision support for supply-chain leaders. Never include markdown outside the requested JSON."}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json", "response_schema": RECOMMENDATION_SCHEMA, "temperature": 0.2},
    }
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    request = Request(url, data=json.dumps(request_body).encode("utf-8"), headers={"Content-Type": "application/json", "x-goog-api-key": api_key}, method="POST")
    try:
        with urlopen(request, timeout=35) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise HTTPException(status_code=502, detail=f"Gemini request failed ({error.code}): {detail}") from error
    except URLError as error:
        raise HTTPException(status_code=502, detail="Unable to reach Gemini. Check network access and try again.") from error
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail="Gemini request timed out. Please try again.") from error

    try:
        text = "".join(part.get("text", "") for part in payload["candidates"][0]["content"]["parts"])
        recommendation = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail="Gemini returned an invalid recommendation response. Please try again.") from error
    if not isinstance(recommendation, dict) or any(field not in recommendation for field in RECOMMENDATION_SCHEMA["required"]):
        raise HTTPException(status_code=502, detail="Gemini returned an incomplete recommendation. Please try again.")
    return recommendation


def generate_recommendation(db: Session, country=None, supplier_id=None, risk_level=None):
    context = build_context(db, country=country, supplier_id=supplier_id, risk_level=risk_level)
    if not context["suppliers"]:
        raise HTTPException(status_code=404, detail="No supplier data matches the selected filters.")
    return {"recommendation": _generate_with_gemini(context), "context": {"kpis": context["kpis"], "filters": context["filters"]}}
