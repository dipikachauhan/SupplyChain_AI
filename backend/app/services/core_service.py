from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models import core as models

def _risk_summary(risk_score):
    if risk_score is None:
        return None

    return {
        "risk_probability": risk_score.risk_probability,
        "business_impact": risk_score.business_impact,
        "risk_level": risk_score.risk_level,
        "last_updated": risk_score.last_updated,
    }

def _supplier_summary(db: Session, supplier):
    supplier_data = {
        column.name: getattr(supplier, column.name)
        for column in models.Supplier.__table__.columns
    }
    risk_score = db.query(models.SupplierRiskScore).filter(
        models.SupplierRiskScore.supplier_id == supplier.supplier_id
    ).first()
    supplier_data["risk_score"] = _risk_summary(risk_score)
    return supplier_data

def get_suppliers(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    country: str | None = None,
    criticality: str | None = None,
    risk_level: str | None = None,
):
    query = db.query(models.Supplier).outerjoin(
        models.SupplierRiskScore,
        models.SupplierRiskScore.supplier_id == models.Supplier.supplier_id,
    )

    if q:
        search_term = f"%{q.strip().lower()}%"
        query = query.filter(or_(
            func.lower(models.Supplier.supplier_id).like(search_term),
            func.lower(models.Supplier.supplier_name).like(search_term),
            func.lower(models.Supplier.country).like(search_term),
        ))
    if country:
        query = query.filter(func.lower(models.Supplier.country) == country.strip().lower())
    if criticality:
        query = query.filter(func.lower(models.Supplier.criticality) == criticality.strip().lower())
    if risk_level:
        query = query.filter(
            func.lower(models.SupplierRiskScore.risk_level) == risk_level.strip().lower()
        )

    suppliers = query.order_by(models.Supplier.supplier_id).offset(skip).limit(limit).all()
    return [_supplier_summary(db, supplier) for supplier in suppliers]

def get_supplier_by_id(db: Session, supplier_id: str):
    return db.query(models.Supplier).filter(models.Supplier.supplier_id == supplier_id).first()

def get_supplier_detail(db: Session, supplier_id: str):
    supplier = get_supplier_by_id(db, supplier_id)
    if supplier is None:
        return None

    detail = _supplier_summary(db, supplier)
    detail["products"] = [
        {"product_id": item.product_id, "component": item.component}
        for item in db.query(models.ProductComponent).filter(
            models.ProductComponent.supplier_id == supplier_id
        ).all()
    ]
    detail["recent_news"] = [
        {
            "id": item.id,
            "date": item.date,
            "headline": item.headline,
            "country": item.country,
            "risk_category": item.risk_category,
            "severity": item.severity,
            "status": item.status,
        }
        for item in db.query(models.NewsEvent).filter(
            models.NewsEvent.affected_supplier == supplier_id
        ).order_by(models.NewsEvent.date.desc()).limit(10).all()
    ]
    detail["logistics_relationships"] = db.query(models.Logistics).filter(
        models.Logistics.supplier_id == supplier_id
    ).all()
    detail["supplier_relationships"] = db.query(models.SupplierRelationship).filter(or_(
        models.SupplierRelationship.source_supplier == supplier_id,
        models.SupplierRelationship.target_supplier == supplier_id,
    )).all()
    return detail

_CRITICALITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}
_RISK_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def _rank(value, ranks):
    return ranks.get(str(value or "").strip().lower(), 0)


def _product_summary(db: Session, product):
    components = db.query(models.ProductComponent).filter(
        models.ProductComponent.product_id == product.product_id
    ).order_by(models.ProductComponent.id).all()
    supplier_ids = list(dict.fromkeys(item.supplier_id for item in components if item.supplier_id))
    suppliers = {
        supplier.supplier_id: supplier
        for supplier in db.query(models.Supplier).filter(
            models.Supplier.supplier_id.in_(supplier_ids)
        ).all()
    } if supplier_ids else {}
    risk_scores = {
        item.supplier_id: item
        for item in db.query(models.SupplierRiskScore).filter(
            models.SupplierRiskScore.supplier_id.in_(supplier_ids)
        ).all()
    } if supplier_ids else {}
    inventory = {
        item.supplier_id: item
        for item in db.query(models.Inventory).filter(
            models.Inventory.supplier_id.in_(supplier_ids)
        ).all()
    } if supplier_ids else {}

    primary_supplier_id = supplier_ids[0] if supplier_ids else None
    primary_supplier = suppliers.get(primary_supplier_id) if primary_supplier_id else None
    supplier_risks = [risk_scores[item] for item in supplier_ids if item in risk_scores]
    risk_values = [item.risk_probability for item in supplier_risks if item.risk_probability is not None]
    risk_score = sum(risk_values) / len(risk_values) if risk_values else None
    highest_risk = max(supplier_risks, key=lambda item: _rank(item.risk_level, _RISK_RANK), default=None)
    supplier_criticalities = [supplier.criticality for supplier in suppliers.values() if supplier.criticality]
    criticality = max(supplier_criticalities, key=lambda item: _rank(item, _CRITICALITY_RANK), default=None)
    inventory_level = sum(
        item.current_stock or 0 for item in (inventory[supplier_id] for supplier_id in supplier_ids if supplier_id in inventory)
    )
    reorder_point = sum(
        item.safety_stock or 0 for item in (inventory[supplier_id] for supplier_id in supplier_ids if supplier_id in inventory)
    )

    return {
        "product_id": product.product_id,
        "model": product.model,
        "launch_year": product.launch_year,
        "segment": product.segment,
        "category": product.segment,
        "primary_supplier_id": primary_supplier_id,
        "primary_supplier": primary_supplier.supplier_name if primary_supplier else None,
        "primary_supplier_country": primary_supplier.country if primary_supplier else None,
        "criticality": criticality,
        "risk": {
            "risk_score": risk_score,
            "risk_level": highest_risk.risk_level if highest_risk else None,
            "business_impact": max(
                (item.business_impact for item in supplier_risks if item.business_impact is not None),
                default=None,
            ),
        },
        "inventory_level": inventory_level,
        "reorder_point": reorder_point,
        "status": "Below reorder point" if inventory_level < reorder_point else "In stock",
    }, components, suppliers, risk_scores


def get_products(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    category: str | None = None,
    criticality: str | None = None,
    risk: str | None = None,
    sort: str | None = None,
):
    products = [_product_summary(db, product)[0] for product in db.query(models.Product).all()]

    if search:
        search_term = search.strip().lower()
        products = [item for item in products if search_term in str(item["product_id"] or "").lower() or search_term in str(item["model"] or "").lower()]
    if category:
        products = [item for item in products if str(item["category"] or "").lower() == category.strip().lower()]
    if criticality:
        products = [item for item in products if str(item["criticality"] or "").lower() == criticality.strip().lower()]
    if risk:
        products = [item for item in products if str((item["risk"] or {}).get("risk_level") or "").lower() == risk.strip().lower()]

    sort_key = (sort or "product_id").lower()
    sort_fields = {
        "product": lambda item: str(item["model"] or "").lower(),
        "product_name": lambda item: str(item["model"] or "").lower(),
        "product_id": lambda item: str(item["product_id"] or "").lower(),
        "category": lambda item: str(item["category"] or "").lower(),
        "primary_supplier": lambda item: str(item["primary_supplier"] or "").lower(),
        "criticality": lambda item: _rank(item["criticality"], _CRITICALITY_RANK),
        "risk": lambda item: (item["risk"] or {}).get("risk_score") or -1,
        "risk_score": lambda item: (item["risk"] or {}).get("risk_score") or -1,
        "inventory": lambda item: item["inventory_level"] or 0,
        "inventory_level": lambda item: item["inventory_level"] or 0,
    }
    products.sort(key=sort_fields.get(sort_key, sort_fields["product_id"]), reverse=sort_key in {"risk", "risk_score", "inventory", "inventory_level", "criticality"})
    return products[skip:skip + limit]


def get_product_detail(db: Session, product_id: str):
    product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if product is None:
        return None

    summary, components, suppliers, risk_scores = _product_summary(db, product)
    associated_suppliers = []
    for component in components:
        supplier = suppliers.get(component.supplier_id)
        risk_score = risk_scores.get(component.supplier_id)
        associated_suppliers.append({
            "supplier_id": component.supplier_id,
            "supplier_name": supplier.supplier_name if supplier else None,
            "component": component.component,
            "country": supplier.country if supplier else None,
            "criticality": supplier.criticality if supplier else None,
            "risk_score": risk_score.risk_probability if risk_score else None,
            "risk_level": risk_score.risk_level if risk_score else None,
        })

    primary_supplier = suppliers.get(summary["primary_supplier_id"])
    return {
        **summary,
        "description": None,
        "lead_time_days": primary_supplier.lead_time_days if primary_supplier else None,
        "associated_suppliers": associated_suppliers,
        "business_impact": (summary["risk"] or {}).get("business_impact"),
        "notes": None,
    }


def get_products_summary(db: Session):
    products = get_products(db, limit=500)
    risk_scores = [item["risk"]["risk_score"] for item in products if item.get("risk") and item["risk"].get("risk_score") is not None]
    inventory_levels = [item["inventory_level"] for item in products if item["inventory_level"] is not None]
    return {
        "total_products": len(products),
        "total_categories": len({item["category"] for item in products if item["category"]}),
        "average_risk_score": sum(risk_scores) / len(risk_scores) if risk_scores else None,
        "average_inventory": sum(inventory_levels) / len(inventory_levels) if inventory_levels else None,
        "products_below_reorder_point": sum(item["inventory_level"] < item["reorder_point"] for item in products),
        "critical_products": sum(str(item["criticality"] or "").lower() in {"high", "critical"} for item in products),
    }

def _inventory_status(current_stock, reorder_point):
    current_stock = current_stock or 0
    reorder_point = reorder_point or 0
    if current_stock == 0:
        return "Out of Stock"
    if reorder_point and current_stock <= reorder_point * 0.5:
        return "Critical"
    if reorder_point and current_stock <= reorder_point:
        return "Low Stock"
    return "Healthy"


def _inventory_summary(db: Session, inventory_item):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.supplier_id == inventory_item.supplier_id
    ).first()
    warehouse = db.query(models.Warehouse).filter(
        models.Warehouse.warehouse_id == inventory_item.warehouse
    ).first()
    risk_score = db.query(models.SupplierRiskScore).filter(
        models.SupplierRiskScore.supplier_id == inventory_item.supplier_id
    ).first()
    maximum_capacity = warehouse.storage_capacity if warehouse else None
    utilization = (
        inventory_item.current_stock / maximum_capacity
        if maximum_capacity and inventory_item.current_stock is not None
        else None
    )
    return {
        "item_id": f"INV-{inventory_item.id:04d}",
        "inventory_id": inventory_item.id,
        "item_name": supplier.component if supplier else None,
        "category": supplier.component if supplier else None,
        "warehouse": inventory_item.warehouse,
        "current_stock": inventory_item.current_stock,
        "reorder_point": inventory_item.safety_stock,
        "maximum_capacity": maximum_capacity,
        "utilization": utilization,
        "status": _inventory_status(inventory_item.current_stock, inventory_item.safety_stock),
        "last_updated": risk_score.last_updated if risk_score else None,
    }


def get_inventory(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    warehouse: str | None = None,
    category: str | None = None,
    status: str | None = None,
    sort: str | None = None,
):
    inventory = [_inventory_summary(db, item) for item in db.query(models.Inventory).all()]

    if search:
        search_term = search.strip().lower()
        inventory = [item for item in inventory if search_term in item["item_id"].lower() or search_term in str(item["item_name"] or "").lower()]
    if warehouse:
        inventory = [item for item in inventory if str(item["warehouse"] or "").lower() == warehouse.strip().lower()]
    if category:
        inventory = [item for item in inventory if str(item["category"] or "").lower() == category.strip().lower()]
    if status:
        inventory = [item for item in inventory if str(item["status"] or "").lower() == status.strip().lower()]

    sort_key = (sort or "item_id").lower()
    sort_fields = {
        "item": lambda item: str(item["item_name"] or "").lower(),
        "item_name": lambda item: str(item["item_name"] or "").lower(),
        "item_id": lambda item: item["inventory_id"],
        "category": lambda item: str(item["category"] or "").lower(),
        "warehouse": lambda item: str(item["warehouse"] or "").lower(),
        "current_stock": lambda item: item["current_stock"] or 0,
        "reorder_point": lambda item: item["reorder_point"] or 0,
        "utilization": lambda item: item["utilization"] or 0,
        "status": lambda item: str(item["status"] or "").lower(),
        "last_updated": lambda item: str(item["last_updated"] or ""),
    }
    inventory.sort(
        key=sort_fields.get(sort_key, sort_fields["item_id"]),
        reverse=sort_key in {"current_stock", "reorder_point", "utilization", "last_updated"},
    )
    return inventory[skip:skip + limit]


def get_inventory_detail(db: Session, item_id: str):
    normalized_id = item_id.removeprefix("INV-")
    if not normalized_id.isdigit():
        return None
    inventory_item = db.query(models.Inventory).filter(
        models.Inventory.id == int(normalized_id)
    ).first()
    if inventory_item is None:
        return None

    detail = _inventory_summary(db, inventory_item)
    supplier = db.query(models.Supplier).filter(
        models.Supplier.supplier_id == inventory_item.supplier_id
    ).first()
    product_component = db.query(models.ProductComponent).filter(
        models.ProductComponent.supplier_id == inventory_item.supplier_id
    ).order_by(models.ProductComponent.id).first()
    product = db.query(models.Product).filter(
        models.Product.product_id == product_component.product_id
    ).first() if product_component else None
    latest_note = db.query(models.MitigationLog).filter(
        models.MitigationLog.supplier_id == inventory_item.supplier_id
    ).order_by(models.MitigationLog.timestamp.desc()).first()
    business_notes = latest_note.recommendation or latest_note.issue if latest_note else None

    return {
        **detail,
        "associated_product_id": product.product_id if product else None,
        "associated_product": product.model if product else None,
        "primary_supplier_id": supplier.supplier_id if supplier else inventory_item.supplier_id,
        "primary_supplier": supplier.supplier_name if supplier else None,
        "supplier_country": supplier.country if supplier else None,
        "lead_time_days": supplier.lead_time_days if supplier else None,
        "recent_inventory_movement": None,
        "business_notes": business_notes,
    }


def get_inventory_summary(db: Session):
    inventory = get_inventory(db, limit=500)
    utilization = [item["utilization"] for item in inventory if item["utilization"] is not None]
    return {
        "total_inventory_items": len(inventory),
        "total_warehouses": len({item["warehouse"] for item in inventory if item["warehouse"]}),
        "total_inventory_quantity": sum(item["current_stock"] or 0 for item in inventory),
        "low_stock_items": sum(item["status"] in {"Low Stock", "Critical", "Out of Stock"} for item in inventory),
        "out_of_stock_items": sum(item["status"] == "Out of Stock" for item in inventory),
        "average_utilization": sum(utilization) / len(utilization) if utilization else None,
    }

def get_logistics(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Logistics).offset(skip).limit(limit).all()

def get_news_events(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.NewsEvent).offset(skip).limit(limit).all()

def get_risk_scores(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.SupplierRiskScore).offset(skip).limit(limit).all()

def get_dashboard_metrics(db: Session):
    total_suppliers = db.query(func.count(models.Supplier.supplier_id)).scalar() or 0
    total_products = db.query(func.count(models.Product.product_id)).scalar() or 0
    high_risk_suppliers = db.query(func.count(models.SupplierRiskScore.id)).filter(
        models.SupplierRiskScore.risk_level == 'High'
    ).scalar() or 0
    recent_news_count = db.query(func.count(models.NewsEvent.id)).scalar() or 0
    total_inventory_items = db.query(func.sum(models.Inventory.current_stock)).scalar() or 0

    return {
        "total_suppliers": total_suppliers,
        "total_products": total_products,
        "high_risk_suppliers": high_risk_suppliers,
        "recent_news_count": recent_news_count,
        "total_inventory": int(total_inventory_items)
    }
