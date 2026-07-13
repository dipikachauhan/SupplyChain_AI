import json
import os
import re
from typing import Any

import requests
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
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "owner": {"type": "STRING"},
                },
                "required": ["title", "description", "owner"],
            },
        },
        "estimated_timeline": {"type": "STRING"},
        "estimated_cost": {"type": "STRING"},
        "related_supplier": {"type": "ARRAY", "items": {"type": "STRING"}},
        "related_news": {"type": "ARRAY", "items": {"type": "STRING"}},
        "related_risks": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": [
        "executive_summary",
        "priority",
        "confidence_score",
        "business_impact",
        "expected_risk_reduction",
        "recommended_actions",
        "estimated_timeline",
        "estimated_cost",
        "related_supplier",
        "related_news",
        "related_risks",
    ],
}

DEFAULT_MODELS = [
    "moonshotai/kimi-k2:free",
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.1-8b-instruct:free",
]


def _record(item, fields):
    return {field: getattr(item, field, None) for field in fields}


def build_context(db: Session, country=None, supplier_id=None, risk_level=None):
    suppliers = db.query(models.Supplier).all()
    risks = db.query(models.SupplierRiskScore).all()
    risk_by_supplier = {risk.supplier_id: risk for risk in risks}
    visible_suppliers = [
        supplier
        for supplier in suppliers
        if (
            (not country or supplier.country == country)
            and (not supplier_id or supplier.supplier_id == supplier_id)
            and (
                not risk_level
                or (
                    risk_by_supplier.get(supplier.supplier_id)
                    and str(risk_by_supplier[supplier.supplier_id].risk_level).lower()
                    == risk_level.lower()
                )
            )
        )
    ]
    visible_ids = {supplier.supplier_id for supplier in visible_suppliers}
    visible_risks = [risk for risk in risks if risk.supplier_id in visible_ids]
    news = [
        item
        for item in db.query(models.NewsEvent).all()
        if item.affected_supplier in visible_ids or (country and item.country == country)
    ][:15]
    inventory = [item for item in db.query(models.Inventory).all() if item.supplier_id in visible_ids][:30]
    relationships = [
        item
        for item in db.query(models.SupplierRelationship).all()
        if item.source_supplier in visible_ids or item.target_supplier in visible_ids
    ][:30]
    inventory_alerts = sum(
        1
        for item in inventory
        if item.current_stock is not None and item.safety_stock is not None and item.current_stock < item.safety_stock
    )

    return {
        "filters": {"country": country, "supplier_id": supplier_id, "risk_level": risk_level},
        "kpis": {
            "monitored_suppliers": len(visible_suppliers),
            "high_risk_suppliers": sum(str(item.risk_level).lower() in {"high", "critical"} for item in visible_risks),
            "active_news_events": len(news),
            "inventory_alerts": inventory_alerts,
        },
        "suppliers": [
            _record(
                item,
                [
                    "supplier_id",
                    "supplier_name",
                    "country",
                    "component",
                    "criticality",
                    "lead_time_days",
                    "capacity",
                    "inventory_buffer",
                    "backup_supplier",
                    "status",
                ],
            )
            for item in visible_suppliers[:20]
        ],
        "risk_scores": [_record(item, ["supplier_id", "risk_probability", "business_impact", "risk_level", "last_updated"]) for item in visible_risks[:20]],
        "news_events": [_record(item, ["date", "headline", "country", "risk_category", "severity", "affected_supplier", "status"]) for item in news],
        "inventory_status": [_record(item, ["supplier_id", "warehouse", "current_stock", "safety_stock", "buffer_days"]) for item in inventory],
        "network_relationships": [_record(item, ["source_supplier", "target_supplier", "dependency_strength"]) for item in relationships],
    }


def _normalize_text(value: Any, fallback: str = "") -> str:
    text = value if isinstance(value, str) else fallback
    return text.strip() if text else fallback


def _normalize_actions(value: Any) -> list[dict[str, str]]:
    actions = value if isinstance(value, list) else []
    normalized = []
    for index, item in enumerate(actions[:5], start=1):
        if isinstance(item, dict):
            normalized.append(
                {
                    "title": _normalize_text(item.get("title"), f"Action {index}"),
                    "description": _normalize_text(item.get("description"), "Review the operational exposure and execute the mitigation step."),
                    "owner": _normalize_text(item.get("owner"), "Operations"),
                }
            )
        elif isinstance(item, str):
            normalized.append(
                {
                    "title": f"Action {index}",
                    "description": item,
                    "owner": "Operations",
                }
            )
    return normalized


def _normalize_recommendation(raw: Any, context: dict[str, Any]) -> dict[str, Any]:
    recommendation = raw if isinstance(raw, dict) else {}
    suppliers = context.get("suppliers") or []
    news_events = context.get("news_events") or []
    risk_scores = context.get("risk_scores") or []

    supplier_names = [item.get("supplier_name") or item.get("supplier_id") for item in suppliers if item]
    news_headlines = [item.get("headline") for item in news_events if item.get("headline")]
    risk_labels = [item.get("risk_level") or "Unclassified" for item in risk_scores if item]

    priority = _normalize_text(recommendation.get("priority"), "High")
    if priority not in {"Critical", "High", "Medium", "Low"}:
        priority = "High"

    confidence_score = recommendation.get("confidence_score", 78)
    try:
        confidence_score = max(0, min(100, float(confidence_score)))
    except (TypeError, ValueError):
        confidence_score = 78

    result = {
        "executive_summary": _normalize_text(
            recommendation.get("executive_summary"),
            "SupplyLens AI identified a near-term operational risk pattern from the current supplier, inventory, and news context.",
        ),
        "priority": priority,
        "confidence_score": confidence_score,
        "business_impact": _normalize_text(
            recommendation.get("business_impact"),
            "Expected to reduce exposure across the most constrained suppliers and improve operational continuity.",
        ),
        "expected_risk_reduction": _normalize_text(
            recommendation.get("expected_risk_reduction"),
            "Moderate reduction in disruption likelihood through coordinated supplier and inventory actions.",
        ),
        "recommended_actions": _normalize_actions(recommendation.get("recommended_actions")) or [
            {
                "title": "Stabilize supply exposure",
                "description": "Increase monitoring on the highest-risk supplier and confirm backup capacity for affected components.",
                "owner": "Supply Chain Operations",
            },
            {
                "title": "Rebalance inventory",
                "description": "Move safety stock toward the most exposed warehouse or component family.",
                "owner": "Inventory Planning",
            },
        ],
        "estimated_timeline": _normalize_text(recommendation.get("estimated_timeline"), "48 to 72 hours for immediate actions; 2 to 4 weeks for structural mitigation."),
        "estimated_cost": _normalize_text(recommendation.get("estimated_cost"), "Low to medium internal execution cost."),
        "related_supplier": [str(item) for item in (recommendation.get("related_supplier") or supplier_names[:5]) if item],
        "related_news": [str(item) for item in (recommendation.get("related_news") or news_headlines[:5]) if item],
        "related_risks": [str(item) for item in (recommendation.get("related_risks") or risk_labels[:5]) if item],
    }

    if not result["related_supplier"]:
        result["related_supplier"] = supplier_names[:3]
    if not result["related_news"]:
        result["related_news"] = news_headlines[:3]
    if not result["related_risks"]:
        result["related_risks"] = risk_labels[:3]
    return result


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("OpenRouter returned an empty response.")
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _openrouter_request(api_key: str, model: str, context: dict[str, Any]) -> dict[str, Any]:
    prompt = (
        "You are SupplyLens AI, a supply-chain risk advisor. Analyze only the operational context below. "
        "Produce one actionable, evidence-based mitigation recommendation. Do not invent suppliers, news, risks, figures, or policies. "
        "Return JSON matching the supplied schema; confidence_score must be 0-100.\n\n"
        "CONTEXT:\n"
        f"{json.dumps(context, default=str)}"
    )
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "SupplyLens AI"),
        },
        json={
            "model": model,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You must return valid JSON only. "
                        "No markdown, no code fences, no commentary."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        },
        timeout=45,
    )

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid OpenRouter API key.")
    if response.status_code == 429:
        raise HTTPException(status_code=429,detail=response.text
    )
    if response.status_code != 200:
        raise HTTPException(
        status_code=response.status_code,
        detail=response.text
    )
    if response.status_code >= 500:
        raise HTTPException(status_code=502, detail="OpenRouter is temporarily unavailable.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {response.text.strip() or response.reason}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="OpenRouter returned a non-JSON response.") from exc

    content = (((payload or {}).get("choices") or [{}])[0].get("message") or {}).get("content")
    if content is None:
        raise HTTPException(status_code=502, detail="OpenRouter response did not include generated content.")
    return _extract_json(str(content))


def _fallback_recommendation(context: dict[str, Any]) -> dict[str, Any]:
    suppliers = context.get("suppliers") or []
    top_supplier = suppliers[0] if suppliers else {}
    return {
        "executive_summary": "Prioritize supplier stabilization, inventory rebalance, and targeted monitoring on the most exposed operational nodes.",
        "priority": "High",
        "confidence_score": 72,
        "business_impact": "This fallback recommendation is based on current supplier exposure, risk scores, and inventory pressure in the filtered context.",
        "expected_risk_reduction": "Moderate reduction in disruption exposure through near-term control actions.",
        "recommended_actions": [
            {
                "title": "Escalate supplier monitoring",
                "description": "Increase check-ins for the highest-exposure supplier and confirm substitute coverage for affected components.",
                "owner": "Supply Chain Operations",
            },
            {
                "title": "Protect critical inventory",
                "description": "Shift stock toward the most constrained warehouse and confirm reorder buffers are intact.",
                "owner": "Inventory Planning",
            },
        ],
        "estimated_timeline": "Immediate action within 48 hours; structural follow-up in 2 to 4 weeks.",
        "estimated_cost": "Low internal coordination cost.",
        "related_supplier": [top_supplier.get("supplier_name") or top_supplier.get("supplier_id")] if top_supplier else [],
        "related_news": [item.get("headline") for item in (context.get("news_events") or [])[:3] if item.get("headline")],
        "related_risks": [item.get("risk_level") or "Unclassified" for item in (context.get("risk_scores") or [])[:3]],
    }


def _candidate_models() -> list[str]:
    configured = os.getenv("OPENROUTER_MODEL", "").strip()
    models = [configured] if configured else []
    models.extend(DEFAULT_MODELS)
    seen: set[str] = set()
    ordered: list[str] = []
    for model in models:
        if model and model not in seen:
            seen.add(model)
            ordered.append(model)
    return ordered


def generate_recommendation(db: Session, country=None, supplier_id=None, risk_level=None):
    context = build_context(db, country=country, supplier_id=supplier_id, risk_level=risk_level)
    if not context["suppliers"]:
        raise HTTPException(status_code=404, detail="No supplier data matches the selected filters.")

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI recommendations are unavailable: set OPENROUTER_API_KEY in backend/.env and restart the backend.",
        )

    last_error: HTTPException | None = None
    for model in _candidate_models():
        try:
            recommendation = _openrouter_request(api_key, model, context)
            normalized = _normalize_recommendation(recommendation, context)
            return {"recommendation": normalized, "context": {"kpis": context["kpis"], "filters": context["filters"]}}
        except HTTPException as exc:
            last_error = exc
            if exc.status_code in {401, 429}:
                raise
        except (requests.RequestException, json.JSONDecodeError, ValueError) as exc:
            last_error = HTTPException(status_code=502, detail=f"OpenRouter model '{model}' failed: {exc}")

    if last_error is not None and last_error.status_code not in {401, 429}:
        fallback = _normalize_recommendation(_fallback_recommendation(context), context)
        return {"recommendation": fallback, "context": {"kpis": context["kpis"], "filters": context["filters"]}}

    raise HTTPException(status_code=502, detail="Unable to generate a recommendation from OpenRouter.")
