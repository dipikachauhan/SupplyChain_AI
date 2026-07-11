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

def get_products(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Product).offset(skip).limit(limit).all()

def get_inventory(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Inventory).offset(skip).limit(limit).all()

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
