from app import models
from fastapi import HTTPException
from sqlalchemy.orm import Session


GEOPOLITICAL_FACTORS = {"Low": 5, "Medium": 15, "High": 30}


def _clamp(value, lower=0, upper=100):
    return round(max(lower, min(upper, value)), 1)


def run_simulation(db: Session, supplier_id, inventory_reduction, shipping_delay_days, demand_increase, geopolitical_risk):
    supplier = db.query(models.Supplier).filter(models.Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Selected supplier was not found.")

    risk = db.query(models.SupplierRiskScore).filter(models.SupplierRiskScore.supplier_id == supplier_id).first()
    inventory = db.query(models.Inventory).filter(models.Inventory.supplier_id == supplier_id).all()
    routes = db.query(models.Logistics).filter(models.Logistics.supplier_id == supplier_id).all()
    components = db.query(models.ProductComponent).filter(models.ProductComponent.supplier_id == supplier_id).all()
    relationships = db.query(models.SupplierRelationship).filter(
        (models.SupplierRelationship.source_supplier == supplier_id) | (models.SupplierRelationship.target_supplier == supplier_id)
    ).all()

    baseline_risk = (risk.risk_probability or 0) * 100 if risk else 0
    baseline_delay = sum(route.transit_time_days or 0 for route in routes) / len(routes) if routes else (supplier.lead_time_days or 0)
    total_stock = sum(item.current_stock or 0 for item in inventory)
    total_safety_stock = sum(item.safety_stock or 0 for item in inventory)
    stock_coverage = min(100, (total_stock / total_safety_stock) * 100) if total_safety_stock else 100
    baseline_service = _clamp(90 + min(10, stock_coverage / 10) - baseline_risk * 0.15)
    geopolitical_factor = GEOPOLITICAL_FACTORS[geopolitical_risk]

    risk_increase = 35 + inventory_reduction * 0.25 + shipping_delay_days * 1.25 + demand_increase * 0.2 + geopolitical_factor
    overall_risk = _clamp(baseline_risk + risk_increase)
    estimated_delay = round(baseline_delay + shipping_delay_days + (supplier.lead_time_days or 0) * 0.15 + demand_increase * 0.05, 1)
    cost_increase = _clamp(baseline_risk * 0.1 + inventory_reduction * 0.3 + shipping_delay_days * 1.5 + demand_increase * 0.25 + geopolitical_factor * 0.4)
    service_level = _clamp(baseline_service - inventory_reduction * 0.35 - shipping_delay_days * 0.8 - demand_increase * 0.25 - geopolitical_factor * 0.25)
    recovery_time = round((supplier.lead_time_days or baseline_delay) + shipping_delay_days + geopolitical_factor / 3 + inventory_reduction * 0.08, 1)

    related_ids = [item.target_supplier if item.source_supplier == supplier_id else item.source_supplier for item in relationships]
    backup_id = supplier.backup_supplier or next((item for item in related_ids if item), None)
    backup = db.query(models.Supplier).filter(models.Supplier.supplier_id == backup_id).first() if backup_id else None
    product_ids = list(dict.fromkeys(item.product_id for item in components if item.product_id))
    products = {item.product_id: item for item in db.query(models.Product).filter(models.Product.product_id.in_(product_ids)).all()} if product_ids else {}
    warehouse_ids = {item.warehouse for item in inventory if item.warehouse}
    destination_countries = {route.destination_country for route in routes if route.destination_country}
    warehouses = db.query(models.Warehouse).all()
    warehouse_ids.update(item.warehouse_id for item in warehouses if item.country in destination_countries)

    return {
        "supplier": {"supplier_id": supplier.supplier_id, "supplier_name": supplier.supplier_name or supplier.supplier_id},
        "kpis": {
            "overall_risk_score": overall_risk,
            "estimated_delivery_delay": estimated_delay,
            "estimated_cost_increase": cost_increase,
            "service_level": service_level,
            "recovery_time": recovery_time,
        },
        "recommended_backup_supplier": {"supplier_id": backup.supplier_id, "supplier_name": backup.supplier_name or backup.supplier_id, "country": backup.country} if backup else None,
        "affected_products": [{"product_id": product_id, "name": products.get(product_id).model if products.get(product_id) else product_id} for product_id in product_ids],
        "affected_warehouses": sorted(warehouse_ids),
        "comparison": [
            {"metric": "Risk score", "before": round(baseline_risk, 1), "after": overall_risk},
            {"metric": "Delivery delay", "before": round(baseline_delay, 1), "after": estimated_delay},
            {"metric": "Cost increase", "before": 0, "after": cost_increase},
            {"metric": "Service level", "before": baseline_service, "after": service_level},
        ],
        "drivers": [
            {"name": "Supplier failure", "impact": 35},
            {"name": "Inventory reduction", "impact": round(inventory_reduction * 0.25, 1)},
            {"name": "Shipping delay", "impact": round(shipping_delay_days * 1.25, 1)},
            {"name": "Demand increase", "impact": round(demand_increase * 0.2, 1)},
            {"name": "Geopolitical risk", "impact": geopolitical_factor},
        ],
    }
