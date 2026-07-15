import json
import logging
import os
import re
from datetime import datetime
from collections import defaultdict
from typing import Any

from openai import OpenAI
from sqlalchemy.orm import Session

from app import models


logger = logging.getLogger(__name__)

GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "qwen/qwen3-32b",
    "openai/gpt-oss-20b",
]


def _record(item, fields):
    if not item:
        return {}
    return {field: getattr(item, field, None) for field in fields}


def _normalize_text(value: Any, fallback: str = "") -> str:
    text = value if isinstance(value, str) else fallback
    return text.strip() if text else fallback


def _normalize_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        text = str(item).strip()
        if text:
            result.append(text)
    return result


def _safe_float(value: Any, fallback: float | None = None) -> float | None:
    try:
        if value is None:
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _safe_int(value: Any, fallback: int = 0) -> int:
    try:
        if value is None:
            return fallback
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _risk_rank(level: Any) -> int:
    ordering = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    return ordering.get(str(level or "").lower(), 0)


def _risk_label(rank: int) -> str:
    return {4: "Critical", 3: "High", 2: "Medium", 1: "Low"}.get(rank, "Medium")


def _extract_keywords(text: Any) -> set[str]:
    content = str(text or "").lower()
    keywords = {
        "weather": {"typhoon", "hurricane", "flood", "storm", "earthquake", "wildfire", "snow", "severe weather"},
        "logistics": {"port congestion", "port", "shipping delay", "freight", "route", "carrier", "transit"},
        "cyber": {"cyber", "ransomware", "breach", "malware", "security", "hack"},
        "finance": {"bankrupt", "insolv", "liquidity", "credit", "default", "financial"},
        "labor": {"strike", "labor", "union", "work stoppage", "shutdown"},
        "political": {"sanction", "export control", "tariff", "political", "restriction", "regulation"},
        "factory": {"factory", "plant", "production halt", "shutdown", "outage", "fire"},
    }
    hits = set()
    for label, terms in keywords.items():
        if any(term in content for term in terms):
            hits.add(label)
    return hits


def _format_pct(value: float | None) -> str:
    if value is None:
        return "unknown"
    return f"{value:.0f}%"


def _coverage_days(current_stock: Any, safety_stock: Any, buffer_days: Any) -> int:
    current = _safe_int(current_stock, 0)
    safety = _safe_int(safety_stock, 0)
    buffer_value = _safe_int(buffer_days, 0)
    if safety <= 0:
        return max(buffer_value, 0)
    ratio = current / max(safety, 1)
    return max(0, min(60, round(ratio * max(buffer_value, 1))))


def _parse_severity(value: Any) -> int:
    text = str(value or "").lower()
    if text in {"critical", "severe", "high"}:
        return 3
    if text in {"medium", "moderate"}:
        return 2
    if text in {"low", "minor"}:
        return 1
    return 0


def _data_completeness(selected: dict[str, Any], risk: dict[str, Any], inventory: list[dict[str, Any]], logistics: list[dict[str, Any]], news: list[dict[str, Any]], alternates: list[dict[str, Any]]) -> tuple[int, list[str]]:
    checks = [
        ("supplier name", bool(selected.get("supplier_name") or selected.get("supplier_id"))),
        ("component", bool(selected.get("component"))),
        ("country", bool(selected.get("country"))),
        ("risk score", bool(risk.get("risk_probability") is not None or risk.get("risk_level"))),
        ("inventory", bool(inventory)),
        ("logistics", bool(logistics)),
        ("news", bool(news)),
        ("alternate suppliers", bool(alternates)),
    ]
    missing = [name for name, ok in checks if not ok]
    completeness = round((len(checks) - len(missing)) / len(checks) * 100)
    return completeness, missing


def _news_signals(news: list[dict[str, Any]]) -> dict[str, Any]:
    categories: dict[str, int] = defaultdict(int)
    signals: set[str] = set()
    max_severity = 0
    for event in news:
        if not isinstance(event, dict):
            continue
        category = str(event.get("risk_category") or "").strip().lower()
        if category:
            categories[category] += 1
        max_severity = max(max_severity, _parse_severity(event.get("severity")))
        signals |= _extract_keywords(event.get("headline"))
    return {"categories": categories, "signals": signals, "max_severity": max_severity}


def _inventory_metrics(inventory: list[dict[str, Any]]) -> dict[str, Any]:
    if not inventory:
        return {"current_stock": 0, "safety_stock": 0, "coverage_days": 0, "below_safety": False, "buffer_days": 0}
    current_stock = sum(_safe_int(row.get("current_stock"), 0) for row in inventory if isinstance(row, dict))
    safety_stock = sum(_safe_int(row.get("safety_stock"), 0) for row in inventory if isinstance(row, dict))
    buffer_days = max((_safe_int(row.get("buffer_days"), 0) for row in inventory if isinstance(row, dict)), default=0)
    below_safety = current_stock < safety_stock
    coverage_days = _coverage_days(current_stock, safety_stock, buffer_days)
    return {
        "current_stock": current_stock,
        "safety_stock": safety_stock,
        "coverage_days": coverage_days,
        "below_safety": below_safety,
        "buffer_days": buffer_days,
    }


def _logistics_signals(logistics: list[dict[str, Any]], news_signals: set[str]) -> list[str]:
    routes = []
    for row in logistics:
        if not isinstance(row, dict):
            continue
        method = str(row.get("transport_method") or "").lower()
        if any(signal in news_signals for signal in {"weather", "logistics", "political", "factory"}):
            if method:
                routes.append(f"{row.get('origin_port') or row.get('origin_country')} -> {row.get('destination_port') or row.get('destination_country')} via {row.get('transport_method')}")
        elif method:
            routes.append(f"{row.get('origin_port') or row.get('origin_country')} -> {row.get('destination_port') or row.get('destination_country')} via {row.get('transport_method')}")
    return routes[:5]


def _supplier_dependency(product_map: dict[str, list[dict[str, Any]]], supplier_id: str | None) -> dict[str, Any]:
    products = product_map.get(supplier_id, [])
    components = defaultdict(int)
    for item in products:
        component = item.get("component")
        if component:
            components[component] += 1
    total_products = len(products)
    critical_products = sum(1 for item in products if str(item.get("segment") or "").lower() in {"flagship", "premium", "critical"})
    return {
        "total_products": total_products,
        "critical_products": critical_products,
        "components": dict(components),
    }


def _supplier_inventory_rows(rows: list[Any]) -> list[dict[str, Any]]:
    return [
        _record(row, ["supplier_id", "current_stock", "safety_stock", "buffer_days", "warehouse"])
        for row in rows
    ]


def _product_impact_rows(product_map: dict[str, list[dict[str, Any]]], supplier_id: str | None, inventory_metrics: dict[str, Any], dependency: dict[str, Any]) -> list[dict[str, Any]]:
    products = []
    raw_products = product_map.get(supplier_id, [])
    if not raw_products:
        return products
    current_inventory = _safe_int(inventory_metrics.get("current_stock"), 0)
    supplier_dependency = min(100, max(10, 40 + dependency.get("critical_products", 0) * 15 + dependency.get("total_products", 0) * 5))
    per_product_inventory = round(current_inventory / max(len(raw_products), 1))
    for item in raw_products[:10]:
        products.append(
            {
                "product_id": item.get("product_id"),
                "model": item.get("model"),
                "segment": item.get("segment"),
                "component": item.get("component"),
                "current_inventory": per_product_inventory,
                "criticality": "High" if str(item.get("segment") or "").lower() in {"flagship", "premium"} else "Medium",
                "supplier_dependency": supplier_dependency,
            }
        )
    return products


def _build_product_map(db: Session) -> dict[str, list[dict[str, Any]]]:
    products = {item.product_id: item for item in db.query(models.Product).all()}
    product_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in db.query(models.ProductComponent).all():
        product = products.get(getattr(item, "product_id", None))
        product_map[getattr(item, "supplier_id", None)].append(
            {
                "product_id": getattr(item, "product_id", None),
                "model": getattr(product, "model", None) if product else None,
                "segment": getattr(product, "segment", None) if product else None,
                "component": getattr(item, "component", None),
            }
        )
    return product_map


def _select_supplier(db: Session, supplier_id=None, country=None, risk_level=None):
    suppliers = db.query(models.Supplier).all()
    risks = db.query(models.SupplierRiskScore).all()
    risk_by_supplier = {getattr(risk, "supplier_id", None): risk for risk in risks}

    if supplier_id:
        selected = next((item for item in suppliers if getattr(item, "supplier_id", None) == supplier_id), None)
        if selected:
            return selected, suppliers, risks, risk_by_supplier

    filtered = []
    for supplier in suppliers:
        if country and getattr(supplier, "country", None) != country:
            continue
        if risk_level:
            supplier_risk = risk_by_supplier.get(getattr(supplier, "supplier_id", None))
            if str(getattr(supplier_risk, "risk_level", "")).lower() != str(risk_level).lower():
                continue
        filtered.append(supplier)

    selected = filtered[0] if filtered else (suppliers[0] if suppliers else None)
    return selected, suppliers, risks, risk_by_supplier


def _build_alternate_suppliers(db: Session, supplier: Any, risk_by_supplier: dict[str, Any], selected_risk: Any) -> list[dict[str, Any]]:
    selected_component = getattr(supplier, "component", None)
    if not selected_component:
        return []

    candidates = db.query(models.Supplier).filter(
        models.Supplier.component == selected_component,
        models.Supplier.supplier_id != getattr(supplier, "supplier_id", None),
    ).all()

    alternates = []
    for candidate in candidates:
        risk = risk_by_supplier.get(getattr(candidate, "supplier_id", None))
        risk_probability = _safe_float(getattr(risk, "risk_probability", None))
        business_impact = _safe_float(getattr(risk, "business_impact", None))
        lead_time = _safe_int(getattr(candidate, "lead_time_days", None), 0)
        capacity = _safe_int(getattr(candidate, "capacity", None), 0)
        compatibility = 100
        if getattr(candidate, "country", None) != getattr(supplier, "country", None):
            compatibility -= 4
        if getattr(candidate, "criticality", None) != getattr(supplier, "criticality", None):
            compatibility -= 3
        if _risk_rank(getattr(risk, "risk_level", None)) > _risk_rank(getattr(selected_risk, "risk_level", None)):
            compatibility -= 8
        if not capacity:
            compatibility -= 6
        if lead_time > _safe_int(getattr(supplier, "lead_time_days", None), lead_time):
            compatibility -= 5
        compatibility = max(60, min(99, compatibility))
        alternates.append(
            {
                "supplier_id": getattr(candidate, "supplier_id", None),
                "supplier_name": getattr(candidate, "supplier_name", None) or getattr(candidate, "supplier_id", None),
                "country": getattr(candidate, "country", None),
                "component": getattr(candidate, "component", None),
                "criticality": getattr(candidate, "criticality", None),
                "risk_level": getattr(risk, "risk_level", None) or "Unknown",
                "risk_probability": risk_probability,
                "business_impact": business_impact,
                "capacity": capacity or None,
                "lead_time_days": lead_time or None,
                "compatibility_score": compatibility,
                "lead_time": f"{lead_time} days" if lead_time else "Unknown",
                "reason": (
                    f"Existing supplier for identical {selected_component} family with lower operational risk and available capacity."
                    if _risk_rank(getattr(risk, "risk_level", None)) <= 2
                    else f"Existing supplier for identical {selected_component} family and should be qualified as a contingency option."
                ),
            }
        )

    alternates.sort(
        key=lambda item: (
            -(item.get("compatibility_score") or 0),
            _risk_rank(item.get("risk_level")),
            -(item.get("capacity") or 0),
            item.get("lead_time_days") or 9999,
            item.get("supplier_name") or "",
        )
    )
    return alternates[:5]


def _build_context(db: Session, supplier_id=None, country=None, risk_level=None):
    selected, suppliers, risks, risk_by_supplier = _select_supplier(
        db,
        supplier_id=supplier_id,
        country=country,
        risk_level=risk_level,
    )
    if not selected:
        return {
            "selectedSupplier": {},
            "supplierRisk": {},
            "products": [],
            "inventory": [],
            "news": [],
            "network": [],
            "alternateSuppliers": [],
            "allSuppliers": [],
            "kpis": {
                "monitored_suppliers": 0,
                "high_risk_suppliers": 0,
                "active_news_events": 0,
                "inventory_alerts": 0,
            },
            "filters": {"supplier_id": supplier_id, "country": country, "risk_level": risk_level},
        }

    product_map = _build_product_map(db)
    inventory_rows = db.query(models.Inventory).filter(models.Inventory.supplier_id == getattr(selected, "supplier_id", None)).all()
    logistics_rows = db.query(models.Logistics).filter(models.Logistics.supplier_id == getattr(selected, "supplier_id", None)).all()
    news_rows = db.query(models.NewsEvent).filter(models.NewsEvent.affected_supplier == getattr(selected, "supplier_id", None)).all()
    relationships = db.query(models.SupplierRelationship).filter(
        (models.SupplierRelationship.source_supplier == getattr(selected, "supplier_id", None))
        | (models.SupplierRelationship.target_supplier == getattr(selected, "supplier_id", None))
    ).all()

    supplier_risk = risk_by_supplier.get(getattr(selected, "supplier_id", None))
    alternate_suppliers = _build_alternate_suppliers(db, selected, risk_by_supplier, supplier_risk)
    all_inventory = db.query(models.Inventory).all()
    all_news = db.query(models.NewsEvent).all()
    product_dependency = _supplier_dependency(product_map, getattr(selected, "supplier_id", None))
    inventory_view = _supplier_inventory_rows(inventory_rows)
    inventory_metrics = _inventory_metrics(inventory_view)
    news_signals = _news_signals([_record(row, ["date", "headline", "country", "risk_category", "severity", "affected_supplier", "status"]) for row in news_rows])
    logistics_routes = _logistics_signals([_record(row, ["route_id", "supplier_id", "origin_country", "destination_country", "origin_port", "destination_port", "transport_method", "transit_time_days"]) for row in logistics_rows], news_signals["signals"])
    product_impact = _product_impact_rows(product_map, getattr(selected, "supplier_id", None), inventory_metrics, product_dependency)
    completeness, missing = _data_completeness(
        _record(selected, ["supplier_id", "supplier_name", "country", "component", "criticality", "lead_time_days", "capacity", "inventory_buffer", "backup_supplier", "status"]),
        _record(supplier_risk, ["supplier_id", "risk_probability", "business_impact", "risk_level", "last_updated"]),
        inventory_view,
        logistics_rows and [_record(row, ["route_id", "supplier_id", "origin_country", "destination_country", "origin_port", "destination_port", "transport_method", "transit_time_days"]) for row in logistics_rows] or [],
        news_rows and [_record(row, ["date", "headline", "country", "risk_category", "severity", "affected_supplier", "status"]) for row in news_rows] or [],
        alternate_suppliers,
    )
    supplier_name = getattr(selected, "supplier_name", None) or getattr(selected, "supplier_id", None)
    supplier_component = getattr(selected, "component", None) or "Unknown component"
    supplier_country = getattr(selected, "country", None) or "Unknown country"

    return {
        "selectedSupplier": _record(
            selected,
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
        ),
        "supplierRisk": _record(supplier_risk, ["supplier_id", "risk_probability", "business_impact", "risk_level", "last_updated"]),
        "products": product_map.get(getattr(selected, "supplier_id", None), [])[:10],
        "inventory": inventory_view[:10],
        "logistics": [
            _record(
                row,
                [
                    "route_id",
                    "supplier_id",
                    "origin_country",
                    "destination_country",
                    "origin_port",
                    "destination_port",
                    "transport_method",
                    "transit_time_days",
                ],
            )
            for row in logistics_rows[:10]
        ],
        "news": [
            _record(row, ["date", "headline", "country", "risk_category", "severity", "affected_supplier", "status"])
            for row in news_rows[:8]
        ],
        "network": [
            _record(row, ["source_supplier", "target_supplier", "dependency_strength"])
            for row in relationships[:8]
        ],
        "alternateSuppliers": alternate_suppliers,
        "allSuppliers": [
            _record(
                supplier,
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
            for supplier in suppliers
        ],
        "kpis": {
            "monitored_suppliers": len(suppliers),
            "high_risk_suppliers": sum(_risk_rank(getattr(item, "risk_level", None)) >= 3 for item in risks),
            "active_news_events": len(all_news),
            "inventory_alerts": sum(
                1
                for row in all_inventory
                if getattr(row, "current_stock", None) is not None
                and getattr(row, "safety_stock", None) is not None
                and getattr(row, "current_stock", 0) < getattr(row, "safety_stock", 0)
            ),
        },
        "analysis": {
            "supplier_name": supplier_name,
            "component": supplier_component,
            "country": supplier_country,
            "dependency": product_dependency,
            "inventory": inventory_metrics,
            "product_impact": product_impact,
            "news_signals": {
                "categories": dict(news_signals["categories"]),
                "signals": sorted(news_signals["signals"]),
                "max_severity": news_signals["max_severity"],
            },
            "logistics_routes": logistics_routes,
            "completeness": completeness,
            "missing": missing,
        },
        "filters": {"supplier_id": supplier_id, "country": country, "risk_level": risk_level},
    }


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("Groq returned an empty response.")
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


def _groq_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("GROQ_API_KEY"),
        base_url="https://api.groq.com/openai/v1",
        timeout=45,
        max_retries=0,
    )


def _is_retryable_model_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None) or getattr(exc, "status", None)
    if status_code in {408, 429, 500, 502, 503, 504}:
        return True
    message = str(exc).lower()
    return any(
        token in message
        for token in (
            "rate limit",
            "rate_limit",
            "timeout",
            "timed out",
            "temporarily unavailable",
            "service unavailable",
            "internal server error",
            "server error",
            "quota exceeded",
            "insufficient_quota",
            "model not found",
            "not found",
            "does not exist",
            "unavailable",
        )
    )


def _candidate_models() -> list[str]:
    configured = os.getenv("GROQ_MODEL", "").strip()
    models_list = [configured] if configured else []
    models_list.extend(GROQ_MODELS)
    seen: set[str] = set()
    ordered: list[str] = []
    for model in models_list:
        if model and model not in seen:
            seen.add(model)
            ordered.append(model)
    return ordered


def _render_prompt(context: dict[str, Any]) -> str:
    prompt_context = _build_prompt_context(context)
    return (
        "You are a Senior Supply Chain Risk Consultant for a global smartphone manufacturer.\n"
        "You are given operational data collected from enterprise supply chain systems.\n"
        "Do not invent suppliers.\n"
        "Do not invent inventory.\n"
        "Do not invent risk scores.\n"
        "Base every recommendation only on the supplied context.\n"
        "Generate practical mitigation strategies.\n"
        "Return ONLY valid JSON. Do not wrap it in markdown or code fences.\n\n"
        f"CONTEXT:\n{json.dumps(prompt_context, default=str)}"
    )


def _build_prompt_context(context: dict[str, Any]) -> dict[str, Any]:
    selected = context.get("selectedSupplier") or {}
    risk = context.get("supplierRisk") or {}
    inventory = context.get("inventory") or []
    logistics = context.get("logistics") or []
    news = context.get("news") or []
    network = context.get("network") or []
    alternates = context.get("alternateSuppliers") or []
    products = context.get("products") or []
    analysis = context.get("analysis") or {}
    return {
        "supplier": selected,
        "risk": risk,
        "analysis": analysis,
        "products": products,
        "inventory": inventory,
        "logistics": logistics,
        "news": news,
        "network": network,
        "alternate_suppliers": alternates,
    }


def _join_names(items: list[dict[str, Any]], limit: int = 3) -> str:
    names = []
    for item in items[:limit]:
        name = item.get("supplier_name") or item.get("supplier_id")
        if name:
            names.append(str(name))
    return ", ".join(names) if names else "no alternate suppliers found"


def _fallback_strategy(context: dict[str, Any]) -> dict[str, Any]:
    selected = context.get("selectedSupplier") or {}
    risk = context.get("supplierRisk") or {}
    inventory = context.get("inventory") or []
    news = context.get("news") or []
    logistics = context.get("logistics") or []
    network = context.get("network") or []
    alternates = context.get("alternateSuppliers") or []
    products = context.get("products") or []
    analysis = context.get("analysis") or {}
    product_impact = context.get("productImpact") or analysis.get("product_impact") or []
    risk_probability = _safe_float(risk.get("risk_probability"), 0.0) or 0.0
    risk_level = _normalize_text(risk.get("risk_level"), "Medium")
    inventory_metrics = analysis.get("inventory") or _inventory_metrics(inventory)
    completeness = _safe_int(analysis.get("completeness"), 0)
    news_categories = analysis.get("news_signals", {}).get("categories", {})
    signals = set(analysis.get("news_signals", {}).get("signals", []))
    dependency = analysis.get("dependency") or {}
    impacted_products = [
        item.get("model") or item.get("product_id")
        for item in products
        if isinstance(item, dict) and (item.get("model") or item.get("product_id"))
    ]
    affected_products_count = len(impacted_products)
    severity_rank = max(_risk_rank(risk_level), _parse_severity(news[0].get("severity") if news else None))

    current_stock = _safe_int(inventory_metrics.get("current_stock"), 0)
    safety_stock = _safe_int(inventory_metrics.get("safety_stock"), 0)
    coverage_days = _safe_int(inventory_metrics.get("coverage_days"), 0)
    buffer_days = _safe_int(inventory_metrics.get("buffer_days"), 0)
    news_headlines = [item.get("headline") for item in news if isinstance(item, dict) and item.get("headline")]
    network_notes = [f"{item.get('source_supplier')} -> {item.get('target_supplier')}" for item in network if isinstance(item, dict) and (item.get("source_supplier") or item.get("target_supplier"))]
    alternate_cards = []
    for alt in alternates:
        if not isinstance(alt, dict):
            continue
        alternate_cards.append(
            {
                "supplier_id": alt.get("supplier_id"),
                "supplier_name": alt.get("supplier_name") or alt.get("supplier_id"),
                "country": alt.get("country"),
                "component": alt.get("component") or selected.get("component"),
                "risk_level": alt.get("risk_level"),
                "risk_probability": alt.get("risk_probability"),
                "lead_time_days": alt.get("lead_time_days"),
                "lead_time": alt.get("lead_time") or (f"{alt.get('lead_time_days')} days" if alt.get("lead_time_days") else "Unknown"),
                "capacity": alt.get("capacity"),
                "compatibility_score": alt.get("compatibility_score"),
                "business_impact": alt.get("business_impact"),
                "reason": alt.get("reason") or "Existing supplier with compatible component coverage.",
            }
        )

    supplier_name = selected.get("supplier_name") or selected.get("supplier_id") or "Unknown supplier"
    component = selected.get("component") or "the selected component"
    country = selected.get("country") or "the selected country"
    lead_time = selected.get("lead_time_days")
    business_importance = "critical" if _risk_rank(selected.get("criticality")) >= 3 or dependency.get("critical_products", 0) >= 2 else "material"
    if severity_rank >= 3 or inventory_metrics.get("below_safety"):
        overall_risk = "High"
    elif risk_probability >= 70 or _risk_rank(risk_level) >= 3:
        overall_risk = "High"
    elif risk_probability >= 40 or news_headlines or network_notes:
        overall_risk = "Medium"
    else:
        overall_risk = "Low"

    if severity_rank >= 4:
        overall_risk = "Critical"

    actions = []
    if inventory_metrics.get("below_safety"):
        actions.append(f"Expedite replenishment for {supplier_name} because current stock is {current_stock} units versus safety stock of {safety_stock} units.")
    if signals & {"weather", "logistics", "political"}:
        actions.append("Reroute logistics through alternate carriers or corridors to reduce transit disruption risk.")
    if signals & {"cyber"}:
        actions.append("Review supplier cybersecurity controls and request incident status confirmation.")
    if signals & {"factory", "labor"}:
        actions.append("Activate contingency sourcing and increase inbound monitoring for production interruptions.")
    if risk_probability >= 60 or _risk_rank(risk_level) >= 3:
        actions.append("Increase supplier monitoring cadence and require daily status updates until the risk level declines.")
    if not actions:
        actions.append("Maintain normal monitoring while validating that no new disruption signals appear.")

    supplier_strategy = []
    if dependency.get("critical_products", 0) > 0:
        supplier_strategy.append(f"{supplier_name} supports {dependency.get('total_products', 0)} product programs and {dependency.get('critical_products', 0)} critical products, so dependency is operationally material.")
    else:
        supplier_strategy.append(f"{supplier_name} supplies {component} for the current portfolio and remains important because of the current exposure profile.")
    supplier_strategy.append(f"Supplier dependency is high because {max(1, len(alternates))} alternate supplier option(s) are available but require qualification and allocation planning.")
    if alternates:
        supplier_strategy.append(f"Qualify {alternates[0].get('supplier_name') or alternates[0].get('supplier_id')} as a secondary source for {component}.")
    if _risk_rank(risk_level) >= 3 or risk_probability >= 60:
        supplier_strategy.append("Reduce concentration on this supplier until operational stability and news flow improve.")
    else:
        supplier_strategy.append("Continue controlled sourcing while keeping qualification progress active.")

    logistics_strategy = []
    if "weather" in signals:
        logistics_strategy.append("Use alternate shipping corridors or ports to bypass weather-affected routes.")
    if "logistics" in signals:
        logistics_strategy.append("Split shipments across carriers and rebalance lane allocation to reduce congestion exposure.")
    if "political" in signals:
        logistics_strategy.append("Increase shipment frequency before restrictions tighten and hold safety inventory at destination sites.")
    if "factory" in signals:
        logistics_strategy.append("Stage parts closer to assembly sites and pull forward shipments ahead of expected production outages.")
    if "cyber" in signals:
        logistics_strategy.append("Avoid touching direct logistics systems beyond approved channels while supplier incident checks are in progress.")
    if not logistics_strategy:
        logistics_strategy.append("Keep the current routing plan, but preserve a validated alternate corridor for escalation.")
    if _risk_rank(risk_level) >= 3 and any(item.get("segment") in {"Flagship", "Premium"} for item in products if isinstance(item, dict)):
        logistics_strategy.append("Use air freight selectively for high-priority products only if coverage days fall below the next procurement window.")

    inventory_strategy = [
        f"Current inventory is {current_stock} units versus a safety stock of {safety_stock} units.",
        f"Inventory coverage is estimated at {coverage_days} days based on the current buffer profile.",
    ]
    if inventory_metrics.get("below_safety"):
        inventory_strategy.append("Increase buffer stock before the next procurement cycle.")
    elif coverage_days and coverage_days < 20:
        inventory_strategy.append("Reorder earlier than planned to restore coverage above the target threshold.")
    else:
        inventory_strategy.append("Hold current stock levels while monitoring for new disruptions.")

    long_term = []
    if len({row.get("country") for row in alternates if isinstance(row, dict) and row.get("country")}) > 1:
        long_term.append("Diversify suppliers across countries to reduce single-region concentration risk.")
    else:
        long_term.append("Qualify secondary suppliers in additional countries to reduce geographic concentration.")
    if alternates:
        long_term.append("Increase quarterly supplier scorecard reviews and track alternate qualification progress.")
    if risk_probability >= 50 or _risk_rank(risk_level) >= 3:
        long_term.append("Reduce dependence on single-source supply by adding one additional qualified source for the component family.")
    if completeness < 80:
        long_term.append("Improve data completeness for missing operational fields so risk scoring remains explainable.")
    if not long_term:
        long_term.append("Continue normal supplier governance and maintain periodic review cadence.")

    revenue_exposure = "Moderate"
    if severity_rank >= 4 or risk_probability >= 80:
        revenue_exposure = "High"
    elif risk_probability < 30 and not inventory_metrics.get("below_safety"):
        revenue_exposure = "Low"

    delay_low = 10 if overall_risk in {"High", "Critical"} else 3
    delay_high = 14 if overall_risk in {"High", "Critical"} else 7
    affected_products = max(1, affected_products_count)

    return {
        "overallRisk": overall_risk,
        "executiveSummary": (
            f"{supplier_name} supplies critical {component} components used across {affected_products} product line(s). "
            f"Recent news and logistics signals point to {overall_risk.lower()} operational exposure in {country}. "
            f"Current inventory provides approximately {coverage_days} days of coverage, while alternate suppliers are available if conditions worsen."
        ),
        "immediateActions": actions,
        "inventoryStrategy": inventory_strategy,
        "supplierStrategy": supplier_strategy,
        "logisticsStrategy": logistics_strategy,
        "longTermStrategy": long_term,
        "expectedBusinessImpact": (
            f"Production delay: {delay_low}-{delay_high} days. "
            f"Affected products: {affected_products}. "
            f"Operational impact: {'High' if overall_risk in {'High', 'Critical'} else 'Medium'}. "
            f"Revenue exposure: {revenue_exposure}. "
            f"Priority: {'High' if overall_risk in {'High', 'Critical'} else 'Medium'}."
        ),
        "confidence": _calculate_confidence(context),
        "alternateSuppliers": alternate_cards,
        "contextSummary": {
            "supplier": selected,
            "risk": risk,
            "products": product_impact or products,
            "inventory": inventory,
            "logistics": logistics,
            "news": news,
            "network": network,
            "alternateSuppliers": alternate_cards,
            "kpis": context.get("kpis") or {},
            "analysis": analysis,
        },
    }


def _calculate_confidence(context: dict[str, Any]) -> int:
    selected = context.get("selectedSupplier") or {}
    risk = context.get("supplierRisk") or {}
    analysis = context.get("analysis") or {}
    inventory = analysis.get("inventory") or _inventory_metrics(context.get("inventory") or [])
    completeness = _safe_int(analysis.get("completeness"), 0)
    alternates = context.get("alternateSuppliers") or []
    news = context.get("news") or []
    logistics = context.get("logistics") or []

    base = 66
    risk_rank = _risk_rank(risk.get("risk_level"))
    risk_probability = _safe_float(risk.get("risk_probability"), 0.0) or 0.0
    score = base
    score += min(10, completeness * 0.12)
    score += min(8, len(alternates) * 2)
    score += min(8, len(news) * 1.5)
    score += min(5, len(logistics) * 1.2)
    score += min(8, risk_rank * 2)
    score += min(6, max(0, 100 - _safe_int(inventory.get("coverage_days"), 0)) * 0.05)
    score += min(5, risk_probability * 0.03)
    if inventory.get("below_safety"):
        score += 3
    if selected.get("backup_supplier"):
        score += 2
    if completeness < 50:
        score -= 7
    score -= max(0, 4 - len(news)) * 1.5
    score -= max(0, 3 - len(alternates)) * 1.0
    score = max(60, min(98, round(score)))
    return score


def _parse_model_response(content: Any) -> dict[str, Any]:
    if isinstance(content, dict):
        return content
    return _extract_json(str(content))


def _groq_request(client: OpenAI, model: str, context: dict[str, Any]) -> dict[str, Any]:
    response = client.chat.completions.create(
        model=model,
        temperature=0.2,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a Senior Supply Chain Risk Consultant for a global smartphone manufacturer.\n"
                    "You are given operational data collected from enterprise supply chain systems.\n"
                    "Do not invent suppliers.\n"
                    "Do not invent inventory.\n"
                    "Do not invent risk scores.\n"
                    "Base every recommendation only on the supplied context.\n"
                    "Generate practical mitigation strategies.\n"
                    "Return ONLY valid JSON. No markdown. No code fences. No commentary."
                ),
            },
            {"role": "user", "content": _render_prompt(context)},
        ],
    )

    first_choice = response.choices[0] if getattr(response, "choices", None) else None
    message = getattr(first_choice, "message", None)
    content = getattr(message, "content", None)
    if content is None:
        raise ValueError("Groq response did not include generated content.")
    return _parse_model_response(content)


def generate_recommendation(db: Session, country=None, supplier_id=None, risk_level=None):
    context = _build_context(db, supplier_id=supplier_id, country=country, risk_level=risk_level)
    client = _groq_client()
    candidate_models = _candidate_models()
    last_error: Exception | None = None

    for index, model in enumerate(candidate_models):
        logger.info("Using model: %s", model)
        try:
            recommendation = _groq_request(client, model, context)
            strategy = _normalize_strategy(recommendation, context)
            return {"recommendation": strategy, "context": strategy.get("contextSummary") or {}}
        except Exception as exc:
            last_error = exc
            message = str(exc).lower()
            status_code = getattr(exc, "status_code", None) or getattr(exc, "status", None)
            if status_code == 401 or "authentication" in message or "api key" in message:
                logger.warning("Groq authentication failed for model %s: %s", model, exc)
            if _is_retryable_model_error(exc):
                logger.warning("Model failed.")
            else:
                logger.warning("Model %s failed with non-retryable error: %s", model, exc)

        next_model = candidate_models[index + 1] if index + 1 < len(candidate_models) else None
        if next_model:
            logger.info("Switching to: %s", next_model)

    fallback = _normalize_strategy(_fallback_strategy(context), context)
    if last_error is not None:
        logger.warning("All Groq models failed; returning backend fallback strategy: %s", last_error)
    return {"recommendation": fallback, "context": fallback.get("contextSummary") or {}}


def _normalize_strategy(raw: Any, context: dict[str, Any]) -> dict[str, Any]:
    recommendation = raw if isinstance(raw, dict) else {}
    fallback = _fallback_strategy(context)

    def pick(key: str):
        value = recommendation.get(key)
        if value is None or value == "":
            return fallback.get(key)
        return value

    alternate_suppliers = pick("alternateSuppliers")
    if not isinstance(alternate_suppliers, list):
        alternate_suppliers = fallback.get("alternateSuppliers") or []

    result = {
        "overallRisk": _normalize_text(pick("overallRisk"), "Medium"),
        "executiveSummary": _normalize_text(pick("executiveSummary"), fallback.get("executiveSummary", "")),
        "immediateActions": _normalize_list(pick("immediateActions")) or fallback.get("immediateActions") or [],
        "inventoryStrategy": _normalize_list(pick("inventoryStrategy")) or fallback.get("inventoryStrategy") or [],
        "supplierStrategy": _normalize_list(pick("supplierStrategy")) or fallback.get("supplierStrategy") or [],
        "logisticsStrategy": _normalize_list(pick("logisticsStrategy")) or fallback.get("logisticsStrategy") or [],
        "longTermStrategy": _normalize_list(pick("longTermStrategy")) or fallback.get("longTermStrategy") or [],
        "expectedBusinessImpact": _normalize_text(
            pick("expectedBusinessImpact"),
            fallback.get("expectedBusinessImpact", ""),
        ),
        "confidence": _safe_float(pick("confidence"), _safe_float(fallback.get("confidence"), 72)) or 72,
        "alternateSuppliers": alternate_suppliers,
        "contextSummary": context.get("contextSummary") or fallback.get("contextSummary") or {},
    }
    result["confidence"] = max(60, min(98, round(_safe_float(result["confidence"], 72) or 72)))
    return result
